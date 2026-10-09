import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const loadJson=async path=>JSON.parse(await readFile(path,'utf8'));
const review=await loadJson('integration/nal-stabilization-05/payment-release-review.json');
const site=await loadJson('nal/data/site.json');
const {products}=await loadJson('nal/data/products.json');
const checkoutIndex=await readFile('supabase/functions/nal-toss-checkout/index.ts','utf8');
const webhookIndex=await readFile('supabase/functions/nal-toss-webhook/index.ts','utf8');
const digitalIndex=await readFile('supabase/functions/nal-digital-download/index.ts','utf8');
const checkout=await readFile('supabase/functions/nal-toss-checkout/handler.mjs','utf8');
const webhook=await readFile('supabase/functions/nal-toss-webhook/handler.mjs','utf8');
const download=await readFile('supabase/functions/nal-digital-download/handler.mjs','utf8');
const paymentsRuntime=await readFile('integration/nal-stabilization-04/reference/nal-read-auth.mjs','utf8');
const guardedSql=await readFile('integration/nal-stabilization-05/PROPOSAL_ONLY_reconcile_terminal_guard.sql','utf8');
const failures=[];
const check=(value,reason)=>{if(!value)failures.push(reason);};

check(review.schemaVersion===1 && review.phase==='P5_AUDIT_AND_SYNTHETIC','invalid P5 review manifest');
for(const [key,value] of Object.entries(review.currentOperation||{})){
  if (key.endsWith('Enabled')||key==='customerPaymentTestsRun')check(value===false,'payment release gate '+key+' must remain OFF');
}
for(const key of ['merchantKeysVerified','webhookRegisteredVerified','originalPublicationVersionVerified',
'approvedPrivacyPolicy','approvedDigitalRefundPolicy','approvedOperatorLegalDetails','realPaymentQAApproved','releaseApproved']) {
  check(review[key]===false,'payment release approval '+key+' must remain false');
}
check(Array.isArray(review.unresolvedBlockers)&&review.unresolvedBlockers.length>=6,'P5 release blockers missing');
for(const code of ['P5-01','P5-02','P5-03','P5-04','P5-05','P5-06']){
  check(review.unresolvedBlockers.some(x=>x.id===code&&x.status==='OPEN'),'P5 unresolved blocker '+code+' must remain visible');
}
for(const key of ['storePurchase','checkout','secureDownload','account','orderLibrary']){
  check(site.features?.[key]===false,'live storefront gate '+key+' must remain OFF');
}
check(guardedSql.includes("current_setting('nal.p5_change_approved',true)") &&
      guardedSql.includes("P5 paid settlement patch not approved for execution") &&
      guardedSql.includes("Production payment function changed since P5 audit") &&
      guardedSql.includes("Terminal or revoked order requires settlement review") &&
      guardedSql.includes("o.status in ('refunded','refund_requested','cancelled')") &&
      guardedSql.includes("e.revoked_at is not null"),
      'P5 deferred SQL patch missing approval/terminal replay guard');
check(!guardedSql.includes("SET LOCAL nal.p5_change_approved='approved'"),
      'P5 SQL proposal must never auto-grant review approval');

const free=new Map([
['nal-small-book-01-mind-reset',37],['nal-small-book-02-relationship',39],['nal-small-book-03-next-step',37]
]);
for(const [id,pages] of free){
  const p=products.find(x=>x.id===id);
  check(p?.published===true&&p?.price===0&&p?.stockStatus==='available','free product '+id+' must remain free/available');
  check(p?.pageCount===pages,'free product '+id+' page count changed');
  check(typeof p?.purchaseUrl==='string'&&p.purchaseUrl.startsWith('/nal/assets/downloads/free/')&&
    p.purchaseUrl===p.sampleUrl&&p.previewUrl===p.purchaseUrl,'free product '+id+' must not require checkout');
}
for(const [id,price] of [['dailycoaching-awareness-100',100],['dailycoaching-awareness-1000',1000],['dailycoaching-awareness-10000',10000]]){
  const p=products.find(x=>x.id===id);
  check(p?.published===true&&p?.stockStatus==='comingSoon'&&p?.price===price&&p?.purchaseUrl===null,
    'unreleased paid product '+id+' must remain nonpurchasable');
}
check(checkoutIndex.includes("NAL_TOSS_PAYMENTS_ENABLED') === 'true'"),'Toss checkout must require explicit server gate');
check(webhookIndex.includes("NAL_TOSS_PAYMENTS_ENABLED') === 'true'"),'Toss webhook must require explicit server gate');
check(digitalIndex.includes("NAL_DIGITAL_DELIVERY_ENABLED') === 'true'"),'paid download must require explicit server gate');
check(checkout.includes("if (!enabled) return response(503"),'checkout missing fail-closed disabled behavior');
check(webhook.includes("if (!enabled) return response(503"),'webhook missing fail-closed disabled behavior');
check(download.includes("if (!enabled) return response(503"),'digital download missing fail-closed disabled behavior');
check(checkout.includes("order.amount !== input.amount")&&checkout.includes("payment?.status !== 'DONE'"),
  'checkout amount or provider confirmation check missing');
check(webhook.includes('lookupPayment(hinted.paymentKey)')&&webhook.includes('payment.paymentKey !== hinted.paymentKey'),
  'webhook must re-fetch and verify provider payment');
check(download.includes("grant?.bucket_id !== 'nal-products-private'")&&download.includes('Math.min(600,'),
  'private-bucket or signed-link TTL guard missing');
check(paymentsRuntime.includes('nal_read_privacy')&&!paymentsRuntime.includes("'nal_read_privacy_admin'"),
  'P4 owner Auth isolation regressed');

for(const file of ['nal/checkout/index.html','nal/checkout/success/index.html','nal/checkout/fail/index.html']){
  try{
    const html=await readFile(file,'utf8');
    check(/<meta name="robots" content="noindex/i.test(html),'unreleased checkout must remain noindex: '+file);
  }catch{failures.push('checkout route missing: '+file);}
}
if(failures.length){
  console.error('NAL P5 release lock FAIL ('+failures.length+')');
  for(const reason of failures)console.error('- '+reason);
  process.exit(1);
}
console.log('NAL P5 release lock PASS: free PDFs preserved, paid store/Edge gates OFF, webhook provider recheck, private downloads and 6 open blockers');
