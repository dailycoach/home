import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPassClaimHandler,DEFAULT_PASS_API_RELEASE}
 from '../integration/nal-commerce-os/server/pass-claim-handler.mjs';
import {createPassResendWorker,DEFAULT_PASS_RESEND_RELEASE}
 from '../integration/nal-commerce-os/server/pass-resend-worker.mjs';
import {mintProgramPassClaim}
 from '../integration/nal-commerce-os/server/delivery-links.mjs';

const ORIGIN='https://daily-coach-ing.com';
const ORDER='11111111-1111-4111-8111-111111111111';
const SLOT='22222222-2222-4222-8222-222222222222';
const TOKEN='P'.repeat(43),BUYER='C'.repeat(43);
const STARTS=new Date(Date.now()+3*86400000).toISOString();
const ON={
 enabled:true,privateLedgerApproved:true,providerVerificationApproved:true,
 consumerPassApproved:true,privacyAndRefundApproved:true,
 rateLimitReviewed:true,resendWorkerApproved:true,productionApproved:true
};
const SEND_ON={
 enabled:true,privateLedgerReviewed:true,emailProviderConnected:true,
 emailDomainVerified:true,programClaimApproved:true,
 buyerPrivacyApproved:true,productionApproved:true
};
const sha=async token=>{
 const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
};
const PASS_DIGEST=await sha(TOKEN),CLAIM_DIGEST=await sha(BUYER);
const req=(action,extra={},opt={})=>new Request(
 'https://abcdefghijklmnopqrst.supabase.co/functions/v1/nal-commerce-pass',{
 method:opt.method||'POST',
 headers:{Origin:opt.origin??ORIGIN,'Content-Type':opt.contentType??'application/json'},
 ...(opt.method==='GET'||opt.method==='OPTIONS'?{}:{
  body:opt.raw??JSON.stringify({action,orderId:ORDER,...extra})
 })
});
let checks=0;
const equal=(v,w,msg)=>{assert.deepEqual(v,w,msg);checks++};
const read=async response=>({code:response.status,body:await response.json(),headers:response.headers});
async function verify(handler,action,extra,opt){
 const r=await read(await handler(req(action,extra,opt)));
 assert.equal(r.headers.get('Cache-Control'),'no-store');
 checks++;return r;
}
function fixture({release=ON,providerPaid=true,allow=true,invalidSummary=false}={}){
 const calls=[];let tokenState='new',paid=providerPaid,queued=0;
 const db={
  reservePass:async({orderId,tokenDigest})=>{
   calls.push('reserve');
   if(orderId!==ORDER||tokenDigest!==PASS_DIGEST||!paid||tokenState!=='new')return null;
   tokenState='reserved';
   return {
    orderId:ORDER,slotId:SLOT,kind:'reading_pass',startsAt:STARTS,
    title:'합성 테스트 독서모임',state:invalidSummary?'unverified':'confirmed',
    email:'never-expose@example.invalid',meetingUrl:'https://private.invalid/meeting'
   };
  },
  finishPass:async({orderId,tokenDigest,issued})=>{
   calls.push('finish:'+String(issued));
   if(orderId!==ORDER||tokenDigest!==PASS_DIGEST||tokenState!=='reserved')return false;
   if(!issued){tokenState='new';return false;}
   if(!paid)return false;
   tokenState='redeemed';return true;
  },
  lookupBuyerProof:async({orderId,claimDigest})=>{
   calls.push('lookup');
   if(orderId!==ORDER||claimDigest!==CLAIM_DIGEST)return null;
   return {id:ORDER,kind:'reading_circle',status:paid?'paid':'refunded',revoked:!paid};
  },
  queueResend:async({orderId,claimDigest,requestId})=>{
   calls.push('queue');
   assert.equal(orderId,ORDER);assert.equal(claimDigest,CLAIM_DIGEST);
   assert.match(requestId,/^[a-f0-9-]{36}$/);queued++;return true;
  }
 };
 const payment={revalidate:async()=>{calls.push('provider');return paid;}};
 const rateLimit={allow:async()=>{calls.push('limit');return allow;}};
 const handler=createPassClaimHandler({release,db,payment,rateLimit});
 return {handler,calls,setPaid:v=>paid=v,token:()=>tokenState,queued:()=>queued};
}
{
 const f=fixture({release:DEFAULT_PASS_API_RELEASE});
 const response=await verify(f.handler,'verify',{receiptToken:TOKEN});
 equal(response.code,503,'default API is disabled');
 equal(f.calls.length,0,'no private calls before approval');
}
for(const key of Object.keys(ON)){
 const f=fixture({release:{...ON,[key]:false}});
 const x=await verify(f.handler,'resend',{claimToken:BUYER,requestId:randomUUID()});
 equal(x.code,503,'missing server approval '+key);
 equal(f.calls.length,0,'no database on missing approval '+key);
}
{
 const f=fixture();
 equal((await verify(f.handler,'verify',{receiptToken:TOKEN},{origin:'https://evil.invalid'})).code,403,'wrong Origin');
 equal((await verify(f.handler,'verify',{receiptToken:TOKEN},{method:'GET'})).code,405,'GET is forbidden');
 equal((await verify(f.handler,'verify',{receiptToken:TOKEN},{contentType:'text/plain'})).code,415,'JSON only');
 equal((await verify(f.handler,'refund',{})).code,400,'client cannot execute refund');
 equal((await verify(f.handler,'verify',{receiptToken:'short'})).code,400,'bad bearer syntax');
 equal((await verify(f.handler,'verify',{receiptToken:TOKEN,amountWon:10})).code,400,'money injection forbidden');
 equal(f.calls.length,0,'bad request has no DB calls');
}
{
 const f=fixture();
 const first=await verify(f.handler,'verify',{receiptToken:TOKEN});
 equal(first.code,200,'verified real owner program claim');
 equal(first.body,{
  orderId:ORDER,kind:'reading_pass',title:'합성 테스트 독서모임',
  startsAt:STARTS,slotId:SLOT,state:'confirmed'
 },'only safe ticket fields projected');
 assert(!JSON.stringify(first).includes('never-expose@example.invalid'));checks++;
 assert(!JSON.stringify(first).includes('private.invalid'));checks++;
 equal(f.token(),'reserved','verify alone reserves 2-minute token');
 const result=await verify(f.handler,'confirm',{receiptToken:TOKEN});
 equal(result.code,200,'buyer can finalize pass');
 equal(result.body,{state:'confirmed'},'confirmation reveals no PII');
 equal(f.token(),'redeemed','single-use claim consumed');
 equal((await verify(f.handler,'verify',{receiptToken:TOKEN})).code,403,'cannot reuse consumed pass token');
}
{
 const f=fixture({providerPaid:false});
 const result=await verify(f.handler,'verify',{receiptToken:TOKEN});
 equal(result.code,403,'no pass if provider marks refunded');
 equal(f.calls.includes('reserve'),true,'private reservation attempt remains protected');
}
{
 const f=fixture();
 const before=await verify(f.handler,'resend',{claimToken:BUYER,requestId:randomUUID()});
 equal(before.code,202,'valid purchaser can request nonenumerating resend');
 equal(before.body,{accepted:true},'never disclose whether a message is queued');
 equal(f.queued(),1,'server-only queued one resend');
 const wrong=await verify(f.handler,'resend',{claimToken:'X'.repeat(43),requestId:randomUUID()});
 equal(wrong.code,202,'wrong proof still has generic acceptance');
 equal(f.queued(),1,'wrong proof never queues');
 f.setPaid(false);
 const cancelled=await verify(f.handler,'resend',{claimToken:BUYER,requestId:randomUUID()});
 equal(cancelled.code,202,'refund does not reveal order state');
 equal(f.queued(),1,'refund cannot queue another email');
}
{
 const f=fixture({allow:false});
 equal((await verify(f.handler,'resend',{claimToken:BUYER,requestId:randomUUID()})).code,429,
  'rate limiter required');
 equal(f.queued(),0,'no mail job if rate limit hit');
}
{
 const f=fixture({invalidSummary:true});
 equal((await verify(f.handler,'verify',{receiptToken:TOKEN})).code,403,
  'unsigned summary is rejected');
}
{
 const worker=createPassResendWorker({release:DEFAULT_PASS_RESEND_RELEASE});
 equal(worker.ready,false,'resend worker defaults OFF');
 equal(await worker.runOnce(),{state:'disabled'},'resend cannot run without mail provider');
}
const workerJob={
 jobId:randomUUID(),orderId:ORDER,leaseId:randomUUID(),kind:'reading_pass',
 email:'buyer@example.invalid',title:'합성 테스트 독서모임',
 startsAt:STARTS,attempts:1
};
function mockWorker({mailFails=false,refundAfterMint=false,wrongLink=false}={}){
 const calls=[],messages=[],prepared=[];
 let checks=0,used=false;
 const worker=createPassResendWorker({
  release:SEND_ON,
  queue:{
   leaseNext:async()=>{calls.push('lease');if(used)return null;used=true;return workerJob;},
   finish:async obj=>{calls.push('finish:'+obj.sent);return obj.sent?'sent':'retry';}
  },
  eligibility:{recheck:async()=>{
   calls.push('recheck');checks++;return !refundAfterMint||checks===1;
  }},
  programs:{prepare:async()=>{
   calls.push('mint');const generated=await mintProgramPassClaim({
    orderId:ORDER,kind:'reading_pass'
   });
   prepared.push(generated);
   return {url:wrongLink?'https://attacker.invalid/pass/#token=bad':generated.url};
  }},
  mailer:{send:async message=>{
   calls.push('mail');messages.push(message);
   if(mailFails)throw Error('synthetic SMTP outage');
  }}
 });
 return {worker,calls,messages,prepared};
}
{
 const f=mockWorker();
 equal(f.worker.ready,true,'synthetic complete composition');
 equal(await f.worker.runOnce(),{state:'sent',kind:'reading_pass'},'valid email job');
 equal(f.messages.length,1,'only one mock email');
 equal(f.messages[0].idempotencyKey,'nal:pass-resend:v1:'+workerJob.jobId,'stable provider dedupe');
 assert(f.messages[0].text.includes('/nal/commerce/pass/#order='));checks++;
 assert(!f.messages[0].text.includes('https://attacker.invalid'));checks++;
 equal(await f.worker.runOnce(),{state:'empty'},'no duplicate worker message');
}
for(const scenario of [{mailFails:true},{refundAfterMint:true},{wrongLink:true}]){
 const f=mockWorker(scenario);
 equal(await f.worker.runOnce(),{state:'retry_or_review'},'sender fails closed');
 assert(f.calls.includes('finish:false'));checks++;
 if(scenario.refundAfterMint||scenario.wrongLink)equal(f.messages.length,0,'no unsafe mail sent');
}
console.log('NAL P7-E pass HTTP and resend worker synthetic PASS: '+checks+
 ' checks; account-free one-time ticket, generic resend, rate limit, refund + no actual email');
