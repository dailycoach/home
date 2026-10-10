import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

if(process.env.PGDATABASE!=='nal_ci_ledger'||process.env.PGHOST!=='127.0.0.1')
 throw Error('ONLY_EPHEMERAL_POSTGRES_IS_ALLOWED');
function query(sql){
 return new Promise((resolve,reject)=>{
  const child=spawn('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',sql],{
   env:process.env,stdio:['ignore','pipe','pipe']
  });
  let out='',err='';
  child.stdout.on('data',x=>out+=x.toString());
  child.stderr.on('data',x=>err+=x.toString());
  child.on('error',reject);
  child.on('close',code=>resolve({code,out:out.trim(),err}));
 });
}
async function sql(s){
 const x=await query(s);assert.equal(x.code,0,x.err);return x.out;
}
const pdfId=await sql("SELECT id::text FROM nal_private.commerce_os_orders WHERE provider_order_id='provider-delivery-race-mail'");
const passId=await sql("SELECT id::text FROM nal_private.commerce_os_orders WHERE provider_order_id='provider-delivery-race-pass'");
assert.match(pdfId,/^[a-f0-9-]{36}$/);
assert.match(passId,/^[a-f0-9-]{36}$/);
const claimEmail="SET ROLE service_role; SELECT coalesce("+
 "nal_private.commerce_os_lease_delivery('"+pdfId+"','grant')::text,'null');";
const emailRuns=await Promise.all(Array.from({length:8},()=>query(claimEmail)));
assert(emailRuns.every(x=>x.code===0),emailRuns.map(x=>x.err).join('\n'));
const emailWinners=emailRuns.filter(x=>x.out.includes('"leaseId"'));
const emailLosers=emailRuns.filter(x=>x.out==='null');
assert.equal(emailWinners.length,1,'Only one worker may lease a PDF confirmation');
assert.equal(emailLosers.length,7,'Seven concurrent workers must skip leased job');
const first=JSON.parse(emailWinners[0].out);
assert.equal(first.eventKind,'grant');
assert.equal(first.fulfillmentKind,'private_pdf');
assert.equal(await sql("SET ROLE service_role; SELECT nal_private.commerce_os_finish_delivery('"+
 pdfId+"','grant','"+first.leaseId+"',true,NULL)"),'sent');
assert.equal(await sql(claimEmail),'null');
assert.equal(await sql("SELECT state FROM nal_private.commerce_os_delivery_jobs WHERE order_id='"+
 pdfId+"' AND event_kind='grant'"),'sent');

const claimPass="SET ROLE service_role; SELECT coalesce("+
 "nal_private.commerce_os_reserve_pass_claim('"+passId+"',repeat('9',64))::text,'null');";
const passRuns=await Promise.all(Array.from({length:8},()=>query(claimPass)));
assert(passRuns.every(x=>x.code===0),passRuns.map(x=>x.err).join('\n'));
const passWinners=passRuns.filter(x=>x.out.includes('"kind"'));
const passLosers=passRuns.filter(x=>x.out==='null');
assert.equal(passWinners.length,1,'Only one attendee may reserve a pass-token claim');
assert.equal(passLosers.length,7,'Seven duplicate claims must be denied');
const pass=JSON.parse(passWinners[0].out);
assert.equal(pass.kind,'reading_pass');
assert.equal(pass.orderId,passId);
assert.equal(await sql("SET ROLE service_role; SELECT nal_private.commerce_os_finish_pass_claim('"+
 passId+"',repeat('9',64),true)"),'t');
assert.equal(await sql(claimPass),'null');
assert.equal(await sql("SELECT state FROM nal_private.commerce_os_pass_claims WHERE order_id='"+
 passId+"' AND token_digest=repeat('9',64)"),'redeemed');
console.log('NAL P7-D real disposable Postgres concurrency PASS: 8 notification workers -> 1 lease, 8 attendee links -> 1 claim; no duplicate sends or passes');
