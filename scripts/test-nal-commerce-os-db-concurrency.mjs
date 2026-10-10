import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

if(process.env.PGDATABASE!=='nal_ci_ledger')throw Error('NEVER_RUN_ON_NON_EPHEMERAL_DB');
const SLOT='33333333-3333-4333-8333-333333333333';
const SLOT_IDEMP='44444444-4444-4444-8444-444444444444';
let count=0;
const query=(sql)=>new Promise((resolve,reject)=>{
 const cp=spawn('psql',['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql],{
  env:process.env,stdio:['ignore','pipe','pipe']
 });
 let out='',err='';
 cp.stdout.on('data',d=>{out+=d.toString()});
 cp.stderr.on('data',d=>{err+=d.toString()});
 cp.on('error',reject);
 cp.on('close',code=>resolve({code,out,err}));
});
async function inspect(sql){
 const r=await query(sql);
 assert.equal(r.code,0,r.err);return r.out.trim();
}
function begin(requestId,providerOrderId,slotId,claimLetter,email){
 return "SET ROLE service_role; SELECT nal_private.commerce_os_begin_order("+
 ["'"+requestId+"'","'"+email+"'","repeat('"+claimLetter+"',64)",
  "'read-race'","'"+slotId+"'","'testpg'","'"+providerOrderId+"'",
  "'merchant-race'"].join(",")+
 ")::text;";
}
const requests=Array.from({length:12},(_,i)=>({
 request:randomUUID(),order:'provider-race-'+(i+1),claim:i.toString(16).slice(-1)
}));
const results=await Promise.all(requests.map((r,i)=>query(begin(r.request,r.order,SLOT,r.claim,'race'+i+'@example.invalid'))));
const succeeded=results.filter(x=>x.code===0);
const failed=results.filter(x=>x.code!==0);
assert.equal(succeeded.length,1,'Exactly one buyer must get capacity=1, got '+succeeded.length);
assert.equal(failed.length,11,'Every other buyer must receive an explicit rejection');
assert(failed.every(x=>x.err.includes('SESSION_FULL_OR_CLOSED')),'Unexpected race failure:\n'+failed.map(x=>x.err).join('\n'));
count+=12;
assert.equal(await inspect("SELECT held_count||':'||confirmed_count FROM nal_private.commerce_os_slots WHERE id='"+SLOT+"'"),'1:0');
assert.equal(await inspect("SELECT count(*) FROM nal_private.commerce_os_orders WHERE provider_order_id LIKE 'provider-race-%'"),'1');
count+=2;

// Same idempotency key across parallel requests must create exactly ONE hold.
const id=randomUUID(),providerId='provider-idempotent-race-001';
const attempts=await Promise.all(Array.from({length:10},()=>query(
 begin(id,providerId,SLOT_IDEMP,'a','same@example.invalid')
)));
assert(attempts.every(x=>x.code===0),'same request token should not conflict:\n'+attempts.map(x=>x.err).join('\n'));
const ids=attempts.map(x=>{const m=x.out.match(/"orderId":\s*"([a-f0-9-]{36})"/);return m?.[1]||'';});
assert.equal(new Set(ids).size,1,'All duplicate requests should reference same order');
assert(ids[0],'Synthetic order ID missing');
assert.equal(await inspect("SELECT held_count||':'||confirmed_count FROM nal_private.commerce_os_slots WHERE id='"+SLOT_IDEMP+"'"),'1:0');
assert.equal(await inspect("SELECT count(*) FROM nal_private.commerce_os_orders WHERE request_id='"+id+"'"),'1');
count+=12;

const misused=await query(begin(id,providerId,SLOT_IDEMP,'b','hijack@example.invalid'));
assert.notEqual(misused.code,0,'reused request with new identity must be rejected');
assert(misused.err.includes('REQUEST_ID_REUSED_WITH_DIFFERENT_ORDER'),misused.err);
count++;
console.log('NAL P7-B real ephemeral PostgreSQL concurrency PASS: '+count+' concurrent/idempotent requests, capacity never exceeded, no production DB');
