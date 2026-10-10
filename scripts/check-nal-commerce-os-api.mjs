import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
const json=async p=>JSON.parse(await read(p));
const gate=await json('integration/nal-commerce-os/api-release-review.json');
const privateSql=await read('integration/nal-commerce-os/PROPOSAL_ONLY_guest_bridge.sql');
const originalSql=await read('integration/nal-commerce-os/PROPOSAL_ONLY_unified_order_ledger.sql');
const frontend=await read('nal/assets/js/nal-commerce-lite.js');
const basic=await read('integration/nal-commerce-lite/server/commerce-handler.mjs');
const issuer=await read('integration/nal-commerce-os/server/server-order-issuer.mjs');
const bridge=await read('integration/nal-commerce-os/server/unified-guest-bridge.mjs');
const compose=await read('integration/nal-commerce-os/server/compose-guest-api.mjs');
const site=await json('nal/data/site.json');
const guest=await json('nal/data/commerce-lite.release.json');
const admin=await json('nal/data/commerce-admin.release.json');
const fail=[];const check=(okay,reason)=>{if(!okay)fail.push(reason);};
check(gate.schemaVersion===1&&gate.module==='nal-commerce-os-api'
 &&gate.stage==='P7_C_SOURCE_AND_EPHEMERAL_POSTGRES',
 'P7-C release contract not recognized');
for(const [name,value] of Object.entries(gate)){
 if(name.endsWith('Enabled')||name.endsWith('Deployed')||name.endsWith('Connected')
   ||name.endsWith('Approved')||name.endsWith('Chosen')||name.endsWith('Reviewed')){
  check(value===false,'P7-C release gate '+name+' enabled');
 }
}
check(gate.noProductionEffects===true&&gate.provider===null,'P7-C must have no active PG');
for(const field of ['checkout','storePurchase','secureDownload','account','orderLibrary']){
 check(site.features?.[field]===false,'production storefront '+field+' must remain OFF');
}
check(guest.clientEnabled===false&&guest.serverReady===false&&
 guest.pgConfigured===false&&guest.customerReleaseApproved===false,
 'P6 customer sales are enabled');
check(admin.uiEnabled===false&&admin.backendDeployed===false,
 'P7-A owner admin is enabled before actual Auth');
check(privateSql.includes("current_database() IS DISTINCT FROM 'nal_ci_ledger'")
 &&privateSql.includes("current_setting('nal.commerce_os_ci_approval',true) IS DISTINCT FROM 'isolated'"),
 'private P7-C SQL must be isolated from customer databases');
check(!/SET\s+nal\.commerce_os_ci_approval\s*=/i.test(privateSql),
 'P7-C SQL must not auto-approve itself');
check((privateSql.match(/CREATE TABLE nal_private\.commerce_os_/g)||[]).length===2,
 'P7-C has exactly 2 supplementary private tables');
check((privateSql.match(/CREATE FUNCTION nal_private\.commerce_os_/g)||[]).length===6,
 'P7-C has exactly 6 independent service functions');
check(privateSql.includes('ENABLE ROW LEVEL SECURITY')
 &&privateSql.includes('FROM PUBLIC,anon,authenticated')
 &&privateSql.includes('TO service_role'),
 'P7-C receipt/customer data must stay server-only');
check(!privateSql.includes('SECURITY DEFINER')
 &&!privateSql.includes('CREATE POLICY'),
 'P7-C must not introduce unreviewed privileged/public policies');
check(privateSql.includes("commerce_os_order_by_claim")
 &&privateSql.includes("o.claim_digest=p_claim_digest")
 &&!privateSql.includes("'buyer_email',o.buyer_email"),
 'guest order lookup must verify hashed buyer proof and omit PII');
check(privateSql.includes('commerce_os_receipt_tokens')
 &&privateSql.includes('token_digest char(64)')
 &&privateSql.includes("state='redeemed'")
 &&privateSql.includes("state='reserved' AND t.reserved_until>now()"),
 'one-time private email receipt state guard missing');
check(privateSql.includes("o.status<>'paid'")
 &&privateSql.includes("o.revoked_at IS NOT NULL")
 &&privateSql.includes("can_deliver"),
 'receipts cannot be issued or consumed after cancellation');
check(privateSql.includes('commerce_os_receipt_outbox')
 &&privateSql.includes('ON CONFLICT(order_id) DO NOTHING'),
 'receipt queue must be idempotent');
check(originalSql.includes('REFUNDED_ORDER_CANNOT_BE_REGRANTED')
 &&originalSql.includes('SELECT * INTO o FROM nal_private.commerce_os_orders WHERE id=p_order_id FOR UPDATE'),
 'P7-B refund and lock invariants missing');
check(issuer.includes("name:'HMAC'")&&issuer.includes("hash:'SHA-256'")
 &&issuer.includes('secretBytes.byteLength<32')
 &&issuer.includes("['nal','guest','proof','v1'")
 &&issuer.includes("['nal','provider','order','v1'"),
 'server-only idempotent HMAC claim or domain isolation missing');
check(basic.includes('issueClaim=async()=>newProof()')
 &&basic.includes('const claimToken=await issueClaim'),
 'P6 guest checkout is not wired for stable server proof retries');
check(bridge.includes('nal_private.commerce_os_begin_order')
 &&bridge.includes('nal_private.commerce_os_order_by_claim')
 &&bridge.includes('nal_private.commerce_os_apply_provider')
 &&bridge.includes('nal_private.commerce_os_can_receipt_deliver'),
 'guest bridge must bind only private order/receipt ledger RPCs');
check(bridge.includes("p_server_verified:true")
 &&bridge.includes("verifiedPayment.source!=='provider-server-lookup'")
 &&bridge.includes('providerEventId'),
 'payment calls must originate from verified provider lookup with event ID');
check(bridge.includes('original.fileEdition!==original.orderEdition')
 &&bridge.includes("original.bucketId!==PK")
 &&bridge.includes('DELIVERY_REVOKED_BEFORE_RELEASE'),
 'private signed PDF must match edition and recheck refund after signature');
check(compose.includes('return failClosed()')
 &&compose.includes('DEFAULT_COMMERCE_RELEASE')
 &&compose.includes('createUnifiedGuestBridge'),
 'server composition must fail closed without full authorization');
check(!/service_role|TOSS_SECRET_KEY|PAYAPP_API_KEY|merchantSecret/.test(frontend),
 'browser must not contain merchant or database credentials');
for(const path of [
 'supabase/functions/nal-commerce-lite/index.ts',
 'supabase/functions/nal-commerce-os/index.ts',
 'supabase/functions/nal-commerce-admin/index.ts',
 'supabase/functions/nal-commerce-unified/index.ts'
]){
 try{await access(path);fail.push('Unreviewed deployable Edge source '+path);}catch{}
}
if(fail.length){
 console.error('NAL P7-C source interlock FAIL ('+fail.length+')');
 for(const item of fail)console.error('- '+item);
 process.exit(1);
}
console.log('NAL P7-C source interlock PASS: 6 private RPCs, 2 receipt tables, HMAC domain separation, refund recheck, PG + owner + sales OFF');
