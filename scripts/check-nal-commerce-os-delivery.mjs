import {readFile,access} from 'node:fs/promises';
const text=path=>readFile(path,'utf8');
const json=async path=>JSON.parse(await text(path));
const review=await json('integration/nal-commerce-os/delivery-release-review.json');
const site=await json('nal/data/site.json');
const lite=await json('nal/data/commerce-lite.release.json');
const admin=await json('nal/data/commerce-admin.release.json');
const delivery=await text('integration/nal-commerce-os/PROPOSAL_ONLY_delivery_engine.sql');
const oldSql=await text('integration/nal-commerce-os/PROPOSAL_ONLY_unified_order_ledger.sql');
const worker=await text('integration/nal-commerce-os/server/unified-delivery-worker.mjs');
const links=await text('integration/nal-commerce-os/server/delivery-links.mjs');
const failures=[];const check=(value,reason)=>{if(!value)failures.push(reason);};
check(review.schemaVersion===1&&review.module==='nal-commerce-os-delivery'
 &&review.phase==='P7_D_SOURCE_AND_DISPOSABLE_POSTGRES','P7-D release identity mismatch');
for(const [key,value] of Object.entries(review)){
 if(key.endsWith('Enabled')||key.endsWith('Deployed')||key.endsWith('Approved')
   ||key.endsWith('Connected')||key.endsWith('Verified')
   ||key.endsWith('Published')||key.endsWith('Sent')
   ||key.endsWith('IssuedToCustomer')){
  check(value===false,'P7-D unexpected release flag '+key);
 }
}
check(review.noProductionEffects===true && review.legacyPdfReceiptWorkerEnabled===false,
 'P7-D and legacy PDF receipt workers must both remain OFF');
check(review.programClaimRouteStatus==='not-created-or-live',
 'program claim route must not be falsely declared available');
for(const field of ['storePurchase','checkout','secureDownload','account','orderLibrary']){
 check(site.features?.[field]===false,'production NAL feature '+field+' enabled');
}
check(lite.clientEnabled===false&&lite.customerReleaseApproved===false
 &&admin.uiEnabled===false&&admin.backendDeployed===false,
 'P6 sales or P7 owner admin released prematurely');
check(delivery.includes("current_database() IS DISTINCT FROM 'nal_ci_ledger'")
 &&delivery.includes("current_setting('nal.commerce_os_ci_approval',true) IS DISTINCT FROM 'isolated'")
 &&!delivery.includes("SET nal.commerce_os_ci_approval='isolated'"),
 'P7-D SQL lacks execution restriction or self-approves');
check((delivery.match(/CREATE TABLE nal_private\.commerce_os_/g)||[]).length===2,
 'expect exactly 2 P7-D private tables');
check((delivery.match(/CREATE FUNCTION nal_private\.commerce_os_/g)||[]).length===6,
 'expect exactly 6 P7-D private functions');
check(delivery.includes('CREATE TRIGGER commerce_os_fulfillment_delivery')
 &&delivery.includes('AFTER INSERT OR UPDATE OF status')
 &&delivery.includes("OLD.status='active' AND NEW.status='revoked'"),
 'payment-driven delivery enqueue/refund cancellation missing');
check(delivery.includes('PRIMARY KEY(order_id,event_kind)')
 &&delivery.includes('lease_id=lease')
 &&delivery.includes('FOR UPDATE')
 &&delivery.includes("j.lease_id IS DISTINCT FROM p_lease_id"),
 'one job, lease lock or idempotent ack missing');
check(delivery.includes('valid_state IS DISTINCT FROM TRUE')
 &&delivery.includes('allowed IS DISTINCT FROM TRUE'),
 'nullable authorization must fail closed');
const triggerStart=delivery.indexOf('CREATE FUNCTION nal_private.commerce_os_after_fulfillment()');
const triggerEnd=delivery.indexOf('END $fn$;',triggerStart);
const triggerSource=delivery.slice(triggerStart,triggerEnd);
check(triggerStart>=0&&triggerEnd>triggerStart
 &&triggerSource.includes("state='cancelled',lease_id=NULL,lease_until=NULL")
 &&triggerSource.includes("state='revoked',reserved_until=NULL")
 &&triggerSource.includes("WHERE order_id=NEW.order_id AND event_kind='grant'"),
 'refund must cancel unsent notices and unredeemed program pass links');
check(delivery.includes("token_digest char(64)")
 &&delivery.includes("state='redeemed'")
 &&delivery.includes("TOO_MANY_PASS_CLAIMS")
 &&delivery.includes("t.reserved_until>now()"),
 'one-time program-pass proof and bounded replay controls missing');
check((delivery.match(/ENABLE ROW LEVEL SECURITY/g)||[]).length===2
 &&(delivery.match(/FROM PUBLIC,anon,authenticated/g)||[]).length===2
 &&(delivery.match(/TO service_role/g)||[]).length===2
 &&delivery.includes('REVOKE ALL ON TABLE')
 &&delivery.includes('REVOKE ALL ON FUNCTION')
 &&!delivery.includes('SECURITY DEFINER')
 &&!delivery.includes('REVOKE ALL ON ALL'),
 'P7-D private grant/RLS security boundary missing');
check(oldSql.includes('REFUNDED_ORDER_CANNOT_BE_REGRANTED')
 &&oldSql.includes('commerce_os_can_deliver'),
 'P7-B refund and signed PDF predicates must remain');
check(worker.includes('DEFAULT_DELIVERY_RELEASE')
 &&worker.includes('enabled:false')
 &&(worker.match(/await eligibility\.recheck\(job\)/g)||[]).length===2
 &&worker.includes('mailer.send(message)')
 &&worker.includes('queue.complete({')
 &&worker.includes('idempotencyKey'),
 'unified email worker lacks fail-closed, refund recheck or send idempotency');
check(links.includes("getRandomValues(data)")
 &&links.includes("'SHA-256'")
 &&links.includes("url:u.href")
 &&links.includes('passTokens.issue'),
 'program pass secret/hash and private link protocol missing');
for(const path of [
 'supabase/functions/nal-commerce-delivery/index.ts',
 'supabase/functions/nal-commerce-os-delivery/index.ts',
 'nal/commerce/pass/index.html'
]){
 try{await access(path);failures.push('Unapproved delivery endpoint/consumer pass UI exists: '+path);}catch{}
}
if(failures.length){
 console.error('NAL P7-D DELIVERY RELEASE LOCK FAIL ('+failures.length+')');
 for(const problem of failures)console.error('- '+problem);
 process.exit(1);
}
console.log('NAL P7-D unified delivery source lock PASS: 2 private tables, 6 functions, refunded passes revoked, email and PG OFF');
