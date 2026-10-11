/**
 * P7-E actual HTTP handler -> parameterized test-only psql -> disposable
 * PostgreSQL. Fake payment revalidation: NOT connected to a merchant.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createPassClaimHandler} from '../integration/nal-commerce-os/server/pass-claim-handler.mjs';

if(process.env.PGDATABASE!=='nal_ci_ledger'||process.env.PGHOST!=='127.0.0.1')
 throw Error('P7E_TEST_REQUIRES_DISPOSABLE_POSTGRES');
const SITE='https://daily-coach-ing.com';
const ORDER_SLOT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BUYER='C'.repeat(43);
const RECEIPT='P'.repeat(43);
const sha=async value=>{
 const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
};
const buyerDigest=await sha(BUYER),tokenDigest=await sha(RECEIPT);
const EMPTY='__NULL__';
function val(key,type){return "NULLIF(:'"+key+"','"+EMPTY+"')::"+type;}
function query(sql,values={}){
 return new Promise((resolve,reject)=>{
  const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1'];
  for(const [k,v] of Object.entries(values)){
   if(!/^[a-z0-9_]+$/.test(k))throw Error('INVALID_PSQL_VAR');
   args.push('-v',k+'='+(v===null?EMPTY:String(v)));
  }
  const cp=spawn('psql',args,{env:process.env,stdio:['pipe','pipe','pipe']});
  let out='',err='';
  cp.stdout.on('data',d=>out+=d.toString());
  cp.stderr.on('data',d=>err+=d.toString());
  cp.on('error',reject);
  cp.on('close',status=>{
   if(status!==0)reject(Error('LOCAL_DATABASE_ERROR '+err.slice(0,550)));
   else resolve(out.trim());
  });
  cp.stdin.end('SET ROLE service_role;\n'+sql+'\n');
 });
}
const choose=(str)=>str===''||str==='null'?null:JSON.parse(str);
let tested=0;const eq=(a,b,message)=>{assert.deepEqual(a,b,message);tested++;};
const request=(action,body={},origin=SITE)=>new Request('https://abcdefghijklmnopqrst.supabase.co/functions/v1/nal-commerce-pass',{
 method:'POST',
 headers:{Origin:origin,'Content-Type':'application/json'},
 body:JSON.stringify({action,orderId:orderId,...body})
});
const reply=async r=>({status:r.status,body:await r.json(),headers:r.headers});

await query("INSERT INTO nal_private.commerce_os_slots"+
 " (id,offer_id,starts_at,registration_deadline,capacity,published,slot_status)"+
 " VALUES ("+val('slot','uuid')+",'read-delivery',now()+interval '20 days',"+
 " now()+interval '19 days',1,true,'available');",{slot:ORDER_SLOT});

const requestId=randomUUID();
const created=choose(await query(
 'SELECT nal_private.commerce_os_begin_order('+
 [val('requestid','uuid'),val('email','text'),val('digest','text'),
  "'read-delivery'",val('slot','uuid'),
  "'testpg'","'provider-p7e-http'","'merchant-fixture'"].join(',')+')::text;',
 {requestid:requestId,email:'testbuyer@example.invalid',digest:buyerDigest,slot:ORDER_SLOT}
));
const orderId=created.orderId;
assert.match(orderId,/^[0-9a-f-]{36}$/);tested++;
await query("SELECT nal_private.commerce_os_apply_provider("+
 [val('orderid','uuid'),"'provider-p7e-http'","'merchant-fixture'",
 "'payment-p7e-http'",'19000',"'KRW'","'DONE'","'event-p7e-http-done'",'true'].join(',')+")::text;",
 {orderid:orderId});
eq(await query("SELECT nal_private.commerce_os_issue_pass_claim("+
 val('orderid','uuid')+','+val('digest','text')+
 ",now()+interval '24 hours')::text;",{orderid:orderId,digest:tokenDigest}),'true',
 'private one-use program token issued only after mock-verified ledger payment');

const ledger={
 async reservePass({orderId,tokenDigest}){
  const raw=await query("SELECT coalesce(nal_private.commerce_os_reserve_pass_claim("+
   val('id','uuid')+','+val('digest','text')+")::text,'null');",
  {id:orderId,digest:tokenDigest});
  return choose(raw);
 },
 async finishPass({orderId,tokenDigest,issued}){
  const raw=await query('SELECT nal_private.commerce_os_finish_pass_claim('+
   val('id','uuid')+','+val('digest','text')+','+val('issued','boolean')+')::text;',
   {id:orderId,digest:tokenDigest,issued});
  return raw==='true'||raw==='t';
 },
 async lookupBuyerProof({orderId,claimDigest}){
  const raw=await query("SELECT coalesce(nal_private.commerce_os_order_by_claim("+
   val('id','uuid')+','+val('digest','text')+")::text,'null');",
  {id:orderId,digest:claimDigest});
  return choose(raw);
 },
 async queueResend({orderId,claimDigest,requestId}){
  const raw=await query("SELECT nal_private.commerce_os_queue_pass_resend("+
   val('id','uuid')+','+val('digest','text')+','+val('requestid','uuid')+')::text;',
  {id:orderId,digest:claimDigest,requestid:requestId});
  return raw==='true'||raw==='t';
 }
};
const release={
 enabled:true,privateLedgerApproved:true,providerVerificationApproved:true,
 consumerPassApproved:true,privacyAndRefundApproved:true,
 rateLimitReviewed:true,resendWorkerApproved:true,productionApproved:true
};
let fakeProviderRequests=0;
const payment={revalidate:async({orderId})=>{
 fakeProviderRequests++;
 const status=await query("SELECT status FROM nal_private.commerce_os_orders WHERE id="+
 val('id','uuid')+';',{id:orderId});
 // This is an isolated fake, not a real independent PG server lookup.
 return status==='paid';
}};
const handler=createPassClaimHandler({release,db:ledger,payment,rateLimit:{allow:async()=>true}});
eq((await reply(await handler(request('verify',{receiptToken:'X'.repeat(43)})))).status,403,
 'wrong bearer cannot reserve or view another attendees pass');
const verified=await reply(await handler(request('verify',{receiptToken:RECEIPT})));
eq(verified.status,200,'buyer verifies actual private PostgreSQL one-time program token');
eq(verified.body.kind,'reading_pass','reading right, no generic fake ticket');
eq(verified.body.title,'합성 독서모임 참가권','server title snapshot');
eq(verified.body.state,'confirmed','server-side paid state');
assert(!JSON.stringify(verified.body).includes('testbuyer@example.invalid'));tested++;
assert(!JSON.stringify(verified.body).includes('payment-p7e-http'));tested++;
eq((await reply(await handler(request('verify',{receiptToken:RECEIPT})))).status,403,
 'reserved token cannot be verified simultaneously');
eq((await reply(await handler(request('confirm',{receiptToken:RECEIPT})))).status,200,
 'one-use token is finalized in actual SQL transaction');
eq((await reply(await handler(request('confirm',{receiptToken:RECEIPT})))).status,403,
 'already redeemed token cannot be reconfirmed');
eq(await query('SELECT state FROM nal_private.commerce_os_pass_claims WHERE order_id='+
 val('id','uuid')+' AND token_digest='+val('digest','text')+';',
 {id:orderId,digest:tokenDigest}),'redeemed','private SQL records one redemption');

const valid=await reply(await handler(request('resend',{claimToken:BUYER,requestId:randomUUID()})));
eq(valid.status,202,'valid original purchaser gets generic enqueue acceptance');
eq(valid.body,{accepted:true},'never show if email actually queued');
eq(await query("SELECT count(*)::int FROM nal_private.commerce_os_pass_resend_jobs WHERE order_id="+
 val('id','uuid')+';',{id:orderId}),'1','one real SQL email job queued');
eq((await reply(await handler(request('resend',{claimToken:'Z'.repeat(43),requestId:randomUUID()})))).status,
 202,'wrong proof returns same generic 202');
eq(await query("SELECT count(*)::int FROM nal_private.commerce_os_pass_resend_jobs WHERE order_id="+
 val('id','uuid')+';',{id:orderId}),'1','wrong proof cannot create email job');
eq((await reply(await handler(request('resend',{claimToken:BUYER,requestId:randomUUID()})))).status,202,
 'additional resend inside 15-minute window non-enumerating');
eq(await query("SELECT count(*)::int FROM nal_private.commerce_os_pass_resend_jobs WHERE order_id="+
 val('id','uuid')+';',{id:orderId}),'1','cooldown prevents duplicate SQL outbox');

const jobId=await query('SELECT id::text FROM nal_private.commerce_os_pass_resend_jobs WHERE order_id='+
 val('id','uuid')+';',{id:orderId});
const leased=choose(await query("SELECT coalesce(nal_private.commerce_os_lease_pass_resend("+
 val('job','uuid')+")::text,'null');",{job:jobId}));
eq(leased.kind,'reading_pass','single server resend lease');
eq(leased.email,'testbuyer@example.invalid','worker receives original stored email only');
await query("SELECT nal_private.commerce_os_apply_provider("+
 [val('orderid','uuid'),"'provider-p7e-http'","'merchant-fixture'",
 "'payment-p7e-http'",'19000',"'KRW'","'PARTIAL_CANCELED'","'event-p7e-http-refund'",'true'].join(',')+")::text;",
 {orderid:orderId});
eq(await query('SELECT state FROM nal_private.commerce_os_pass_resend_jobs WHERE id='+
 val('job','uuid')+';',{job:jobId}),'cancelled','refund cancels leased resend atomically');
eq(await query('SELECT nal_private.commerce_os_finish_pass_resend('+
 val('job','uuid')+','+val('lease','uuid')+',true)::text;',
 {job:jobId,lease:leased.leaseId}),'stale','refunded worker cannot ACK an email');
eq((await reply(await handler(request('resend',{claimToken:BUYER,requestId:randomUUID()})))).status,
 202,'refund still does not reveal order status');
eq(await query("SELECT count(*)::int FROM nal_private.commerce_os_pass_resend_jobs WHERE order_id="+
 val('id','uuid')+';',{id:orderId}),'1','refunded customer cannot create new resend job');
assert(fakeProviderRequests>0);tested++;
console.log('NAL P7-E REAL disposable PostgreSQL HTTP PASS: '+tested+
 ' checks of pass verify/confirm, same-email proof resend, cooldown and refund cancellation; PG MOCK; no mail');
