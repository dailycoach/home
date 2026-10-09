import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const run=()=>spawnSync(process.execPath,['scripts/check-nal-payment-release-lock.mjs'],{
  encoding:'utf8',timeout:30000,maxBuffer:1024*1024
});
const baseline=run();
assert.equal(baseline.status,0,'P5 baseline must pass: '+baseline.stdout+' '+baseline.stderr);
const mutateJson=(fn)=>(content)=>{const data=JSON.parse(content);fn(data);return JSON.stringify(data);};
const tests=[
 ['checkout toggle enabled','nal/data/site.json',mutateJson(x=>{x.features.checkout=true;}),'live storefront gate checkout must remain OFF'],
 ['paid storefront enabled','nal/data/site.json',mutateJson(x=>{x.features.storePurchase=true;}),'live storefront gate storePurchase must remain OFF'],
 ['private downloads enabled','nal/data/site.json',mutateJson(x=>{x.features.secureDownload=true;}),'live storefront gate secureDownload must remain OFF'],
 ['buyer account enabled','nal/data/site.json',mutateJson(x=>{x.features.account=true;}),'live storefront gate account must remain OFF'],
 ['free starter charged','nal/data/products.json',mutateJson(x=>{
   x.products.find(p=>p.id==='nal-small-book-01-mind-reset').price=100;
 }),'free product nal-small-book-01-mind-reset must remain free/available'],
 ['free starter checkout redirect','nal/data/products.json',mutateJson(x=>{
   x.products.find(p=>p.id==='nal-small-book-02-relationship').purchaseUrl='/nal/checkout/';
 }),'free product nal-small-book-02-relationship must not require checkout'],
 ['paid AWARENESS opened early','nal/data/products.json',mutateJson(x=>{
   x.products.find(p=>p.id==='dailycoaching-awareness-100').stockStatus='available';
 }),'unreleased paid product dailycoaching-awareness-100 must remain nonpurchasable'],
 ['paid AWARENESS checkout connected early','nal/data/products.json',mutateJson(x=>{
   x.products.find(p=>p.id==='dailycoaching-awareness-10000').purchaseUrl='/nal/checkout/';
 }),'unreleased paid product dailycoaching-awareness-10000 must remain nonpurchasable'],
 ['merchant key marked verified','integration/nal-stabilization-05/payment-release-review.json',mutateJson(x=>{
   x.merchantKeysVerified=true;
 }),'payment release approval merchantKeysVerified must remain false'],
 ['payment release approved without QA','integration/nal-stabilization-05/payment-release-review.json',mutateJson(x=>{
   x.releaseApproved=true;
 }),'payment release approval releaseApproved must remain false'],
 ['live QA invented','integration/nal-stabilization-05/payment-release-review.json',mutateJson(x=>{
   x.currentOperation.customerPaymentTestsRun=true;
 }),'payment release gate customerPaymentTestsRun must remain OFF'],
 ['terminal refund risk falsely marked resolved','integration/nal-stabilization-05/payment-release-review.json',mutateJson(x=>{
   x.unresolvedBlockers.find(b=>b.id==='P5-01').status='RESOLVED';
 }),'P5 unresolved blocker P5-01 must remain visible'],
 ['Toss server gate deleted','supabase/functions/nal-toss-checkout/index.ts',
  x=>x.replace("NAL_TOSS_PAYMENTS_ENABLED') === 'true'","NAL_TOSS_PAYMENTS_DISABLED') === 'true'"),
  'Toss checkout must require explicit server gate'],
 ['webhook revalidation replaced','supabase/functions/nal-toss-webhook/handler.mjs',
  x=>x.replace('lookupPayment(hinted.paymentKey)','trustWebhookBody(hinted.paymentKey)'),
  'webhook must re-fetch and verify provider payment'],
 ['download TTL extended','supabase/functions/nal-digital-download/handler.mjs',
  x=>x.replace('Math.min(600,','Math.min(3600,'),
  'private-bucket or signed-link TTL guard missing'],
 ['SQL replay guard removed','integration/nal-stabilization-05/PROPOSAL_ONLY_reconcile_terminal_guard.sql',
  x=>x.replace("o.status in ('refunded','refund_requested','cancelled')","o.status in ('refunded')"),
  'P5 deferred SQL patch missing approval/terminal replay guard'],
 ['SQL review approval auto-set','integration/nal-stabilization-05/PROPOSAL_ONLY_reconcile_terminal_guard.sql',
  x=>x.replace("BEGIN;\nSET LOCAL lock_timeout", "BEGIN;\nSET LOCAL nal.p5_change_approved='approved';\nSET LOCAL lock_timeout"),
  'P5 SQL proposal must never auto-grant review approval']
];
let detected=0;
for (const [name,file,mutate,required] of tests) {
  const original=await readFile(file,'utf8');
  try {
    const changed=mutate(original);
    assert.notEqual(changed,original,'mutation not applied: '+name);
    await writeFile(file,changed);
    const result=run(),output=result.stdout+'\n'+result.stderr;
    assert.notEqual(result.status,0,'release checker improperly passed: '+name+'\n'+output);
    assert(output.includes(required),'wrong P5 failure detector '+name+': '+output);
    detected++;
  } finally {
    await writeFile(file,original);
  }
}
const restored=run();
assert.equal(restored.status,0,'restored P5 release state failed: '+restored.stdout+' '+restored.stderr);
console.log('NAL P5 release negative guards PASS: '+detected+' injected release/payment/SQL regressions and restored baseline');
