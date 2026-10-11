import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';

if(process.env.PGDATABASE!=='nal_ci_ledger'||process.env.PGHOST!=='127.0.0.1')
 throw Error('ONLY_DISPOSABLE_POSTGRES_ALLOWED');
function run(query){
 return new Promise((resolve,reject)=>{
  const child=spawn('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',query],{
   env:process.env,stdio:['ignore','pipe','pipe']
  });
  let output='',errors='';
  child.stdout.on('data',d=>output+=d.toString());
  child.stderr.on('data',d=>errors+=d.toString());
  child.on('error',reject);
  child.on('close',code=>resolve({code,output:output.trim(),errors}));
 });
}
async function select(query){
 const x=await run(query);
 assert.equal(x.code,0,x.errors);return x.output;
}
const orderId=await select("SELECT id::text FROM nal_private.commerce_os_orders "+
 "WHERE provider_order_id='provider-resend-race'");
assert.match(orderId,/^[a-f0-9-]{36}$/);
const requests=Array.from({length:8},()=>randomUUID());
const queue=x=>"SET ROLE service_role; SELECT nal_private.commerce_os_queue_pass_resend('"+
 orderId+"',repeat('c',64),'"+x+"');";
const queued=await Promise.all(requests.map(id=>run(queue(id))));
assert(queued.every(x=>x.code===0),queued.map(x=>x.errors).join('\n'));
const yes=queued.filter(x=>x.output==='t').length;
const no=queued.filter(x=>x.output==='f').length;
assert.equal(yes,1,'one requested resend should be queued');
assert.equal(no,7,'seven identical-time requests must be rate-limited');
const requestId=requests[queued.findIndex(x=>x.output==='t')];
assert.equal(await select(queue(requestId)),'t','same request UUID remains idempotent');
assert.equal(await select("SELECT count(*)::int FROM nal_private.commerce_os_pass_resend_jobs "+
 "WHERE order_id='"+orderId+"'"),'1');
const jobId=await select("SELECT id::text FROM nal_private.commerce_os_pass_resend_jobs "+
 "WHERE order_id='"+orderId+"'");
assert.match(jobId,/^[a-f0-9-]{36}$/);
const lease="SET ROLE service_role; SELECT coalesce("+
 "nal_private.commerce_os_lease_pass_resend('"+jobId+"')::text,'null');";
const leased=await Promise.all(Array.from({length:8},()=>run(lease)));
assert(leased.every(x=>x.code===0),leased.map(x=>x.errors).join('\n'));
const grants=leased.filter(x=>x.output.includes('"leaseId"'));
const denied=leased.filter(x=>x.output==='null');
assert.equal(grants.length,1,'only one worker can own the mail job');
assert.equal(denied.length,7,'seven workers must not create duplicate sends');
const info=JSON.parse(grants[0].output);
assert.equal(info.kind,'reading_pass');
assert.equal(info.orderId,orderId);
assert.equal(info.email,'race-resend@example.invalid');
assert.equal(await select("SET ROLE service_role; SELECT nal_private.commerce_os_finish_pass_resend('"+
 jobId+"','"+info.leaseId+"',true)"),'sent');
assert.equal(await select("SET ROLE service_role; SELECT nal_private.commerce_os_finish_pass_resend('"+
 jobId+"','"+info.leaseId+"',true)"),'stale');
assert.equal(await select(lease),'null');
assert.equal(await select("SELECT state FROM nal_private.commerce_os_pass_resend_jobs "+
 "WHERE id='"+jobId+"'"),'sent');
console.log('NAL P7-E real isolated PostgreSQL: 8 concurrent resend requests -> 1 accepted; 8 mail workers -> 1 lease; replay denied');
