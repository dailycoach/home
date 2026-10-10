import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

if(process.env.PGDATABASE!=='nal_ci_ledger')throw Error('NOT_AN_EPHEMERAL_TEST_DATABASE');
const run=sql=>new Promise((resolve,reject)=>{
 const child=spawn('psql',['-X','-At','-q','-v','ON_ERROR_STOP=1','-c',sql],{
  env:process.env,stdio:['ignore','pipe','pipe']
 });
 let stdout='',stderr='';
 child.stdout.on('data',d=>{stdout+=d.toString()});
 child.stderr.on('data',d=>{stderr+=d.toString()});
 child.on('error',reject);
 child.on('close',code=>resolve({code,stdout:stdout.trim(),stderr}));
});
async function get(sql){
 const r=await run(sql);
 assert.equal(r.code,0,r.stderr);return r.stdout;
}
const orderId=await get("SELECT id::text FROM nal_private.commerce_os_orders WHERE provider_order_id='provider-bridge-receipt-race'");
assert.match(orderId,/^[a-f0-9-]{36}$/);
const reserve="SET ROLE service_role; SELECT COALESCE(nal_private.commerce_os_reserve_receipt('"+
  orderId+"',repeat('c',64))::text,'null');";
const results=await Promise.all(Array.from({length:8},()=>run(reserve)));
assert(results.every(r=>r.code===0),results.filter(r=>r.code!==0).map(x=>x.stderr).join('\n'));
const winners=results.filter(x=>x.stdout.includes('"id"'));
const losers=results.filter(x=>x.stdout.endsWith('null'));
assert.equal(winners.length,1,'Exactly one email proof must reserve; got '+winners.length);
assert.equal(losers.length,7,'All additional concurrent receipt claims must be denied');
assert.equal(await get("SELECT state FROM nal_private.commerce_os_receipt_tokens WHERE order_id='"+
  orderId+"' AND token_digest=repeat('c',64)"),'reserved');
assert.equal(await get("SET ROLE service_role; SELECT nal_private.commerce_os_can_receipt_deliver('"+
  orderId+"',repeat('c',64))"),'t');
assert.equal(await get("SET ROLE service_role; SELECT nal_private.commerce_os_finish_receipt('"+
  orderId+"',repeat('c',64),true)"),'t');
assert.equal(await get("SET ROLE service_role; SELECT COALESCE(nal_private.commerce_os_reserve_receipt('"+
  orderId+"',repeat('c',64))::text,'null')"),'null');
assert.equal(await get("SELECT state FROM nal_private.commerce_os_receipt_tokens WHERE order_id='"+
  orderId+"' AND token_digest=repeat('c',64)"),'redeemed');
console.log('NAL P7-C isolated PostgreSQL receipt race PASS: 8 parallel claims, 1 winner / 7 denied, irrevocably single-use, no real email or PG');
