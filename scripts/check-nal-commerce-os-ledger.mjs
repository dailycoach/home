import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

const sql=await readFile('integration/nal-commerce-os/PROPOSAL_ONLY_unified_order_ledger.sql','utf8');
const approval=JSON.parse(await readFile('integration/nal-commerce-os/ledger-release-review.json','utf8'));
const src=await readFile('integration/nal-commerce-os/order-engine.mjs','utf8');
const gate=JSON.parse(await readFile('nal/data/commerce-admin.release.json','utf8'));
const lite=JSON.parse(await readFile('nal/data/commerce-lite.release.json','utf8');
const site=JSON.parse(await readFile('nal/data/site.json','utf8'));
const errors=[];const check=(ok,msg)=>{if(!ok)errors.push(msg);};
check(approval.module==='nal-commerce-os-ledger'&&approval.stage==='P7_B_ISOLATED_POSTGRES_ONLY',
  'P7-B release manifest invalid');
for(const x of ['productionEnabled','sqlMigrationApplied','publicCheckoutEnabled',
 'ownerAuthApproved','paymentProviderSelected','paymentWebhookConfigured','serverEdgeDeployed','customerBookingEnabled']){
 check(approval[x]===false,'P7-B release '+x+' must stay false');
}
check(sql.includes("current_database() IS DISTINCT FROM 'nal_ci_ledger'"),
  'CI-only database name gate removed');
check(sql.includes("current_setting('nal.commerce_os_ci_approval',true) IS DISTINCT FROM 'isolated'"),
  'isolated session approval check removed');
check(!/SET\s+nal\.commerce_os_ci_approval\s*=/i.test(sql),
  'proposal SQL must not self-approve its session gate');
const tables=(sql.match(/CREATE TABLE nal_private\.commerce_os_[a-z_]+/g)||[]);
check(tables.length===7,'expected 7 isolated private commerce tables');
check(sql.includes('ENABLE ROW LEVEL SECURITY')&&sql.includes('FROM PUBLIC,anon,authenticated'),
 'DB ACL/RLS must remain private');
check(sql.includes('FOR UPDATE')&&sql.includes('pg_advisory_xact_lock'),
 'atomic seat or idempotency serialization lost');
check(sql.includes('held_count+confirmed_count<=capacity'),
 'slot capacity guard removed');
check(sql.includes('SESSION_FULL_OR_CLOSED')&&sql.includes('held_count=held_count+1'),
 'seat capacity reservation lost');
check(sql.includes('confirmed_count=confirmed_count+1')&&sql.includes('held_count=held_count-1'),
 'seat fulfillment must atomically replace hold with confirmed');
check(sql.includes('refunded')&&sql.includes('refund_requested')&&
 sql.includes('REFUNDED_ORDER_CANNOT_BE_REGRANTED')&&
 sql.includes('NO_PAYMENT_REGRANT_AFTER_TERMINAL'),
 'terminal refund guard missing');
check(sql.includes('review_required')&&sql.includes('LATE_NONFINAL_PROVIDER_STATE')&&
 sql.includes('o.expires_at<=now()'),
 'late charge/expiry review guard lost');
check(sql.includes("current_user<>'service_role'"),
 'server-only RPC execution guard missing');
check(sql.includes('p_server_verified IS DISTINCT FROM true')&&
 sql.includes('p_merchant_id')&&sql.includes('p_amount_won'),
 'PG server proof/amount/merchant binding check missing');
check(sql.includes('UNIQUE(provider_code,provider_event_id)'),
 'provider webhook idempotency uniqueness missing');
check(!sql.includes('CREATE POLICY')&&
 !sql.includes('SECURITY DEFINER'),
 'do not add public grants or privileged security definer functions');
check(gate.uiEnabled===false&&gate.backendDeployed===false&&
 lite.clientEnabled===false&&lite.pgConfigured===false,
 'admin and guest-sale routes must remain OFF');
for(const feature of ['checkout','storePurchase','secureDownload','account']){
 check(site.features?.[feature]===false,'Main NAL sales flag '+feature+' enabled prematurely');
}
check(src.includes('NO_ATOMIC_SEAT_RESERVATION')&&src.includes('NO_REGRANT_AFTER_TERMINAL'),
 'isolated order engine refund/seat guards lost');
for(const p of ['supabase/functions/nal-commerce-os/index.ts','supabase/functions/nal-commerce-admin/index.ts']){
 try{await access(p);errors.push('new privileged Edge source unexpectedly deployed: '+p);}catch{}
}
if(errors.length){
 console.error('NAL P7-B private ledger lock FAIL ('+errors.length+')');
 for(const e of errors)console.error('- '+e);
 process.exit(1);
}
console.log('NAL P7-B private ledger lock PASS: 7 isolated tables, 5 functions, SQL approval guard, atomic seats, refund monotonicity, site/Admin/PG still OFF');
