import assert from 'node:assert/strict';
import {createUnifiedDeliveryWorker,DEFAULT_DELIVERY_RELEASE}
 from '../integration/nal-commerce-os/server/unified-delivery-worker.mjs';
import {createDeliveryLinkPorts,mintProgramPassClaim}
 from '../integration/nal-commerce-os/server/delivery-links.mjs';

const O='11111111-1111-4111-8111-111111111111';
const LEASE='22222222-2222-4222-8222-222222222222';
const AT=Date.parse('2026-10-11T01:00:00Z');
const approval={
 enabled:true,ownerReviewApproved:true,deliveryDbDeployed:true,
 emailDomainVerified:true,emailProviderConnected:true,
 pdfReceiptReady:true,programClaimPageReady:true,
 customerPrivacyApproved:true,productionApproved:true
};
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const safe=(x)=>assert(!String(x).includes('service_role')&&!String(x).includes('password'));
const job=(kind='private_pdf',eventKind='grant')=>({
 orderId:O,leaseId:LEASE,fulfillmentKind:kind,eventKind,
 title:'합성 테스트 마음도구',email:'buyer@example.invalid',
 attempts:1,slotId:kind==='private_pdf'?null:'33333333-3333-4333-8333-333333333333'
});
function fixture({kind='private_pdf',eventKind='grant',sendFails=false,
 invalidLink=false,refundMidway=false,badLease=false}={}){
 const calls=[],emails=[],issues=[];
 let claimed=false,checkCount=0;
 const ports=createDeliveryLinkPorts({
  pdfTokens:{issue:async obj=>{issues.push({type:'pdf',...obj});return true;}},
  passTokens:{issue:async obj=>{issues.push({type:'program',...obj});return true;}},
  clock:()=>AT
 });
 return {
  calls,emails,issues,
  worker:createUnifiedDeliveryWorker({
    release:approval,
    queue:{
     leaseNext:async()=>{
      calls.push('lease');
      if(claimed)return null;
      claimed=true;
      return badLease?{...job(kind,eventKind),leaseId:'BAD'}:job(kind,eventKind);
     },
     complete:async args=>{
      calls.push('complete:'+String(args.sent));
      eq(args.orderId,O,'complete order ID');
      eq(args.eventKind,eventKind,'complete event');
      eq(args.leaseId,LEASE,'complete lease proof');
      return args.sent?'sent':'retry';
     }
    },
    eligibility:{recheck:async()=>{
      checkCount++;calls.push('recheck');
      return !refundMidway||checkCount===1;
    }},
    pdf:ports.pdf,programs:ports.programs,
    mailer:{send:async payload=>{
      calls.push('send');emails.push(payload);
      if(sendFails)throw Error('synthetic-email-error');
      safe(JSON.stringify({subject:payload.subject,idempotencyKey:payload.idempotencyKey}));
    }}
  })
 };
}
{
 const calls=[];
 const f=createUnifiedDeliveryWorker({
  queue:{leaseNext:async()=>{calls.push('illegal');}},
  release:DEFAULT_DELIVERY_RELEASE
 });
 eq(f.ready,false,'default delivery OFF');
 eq(await f.runOnce(),{state:'disabled'},'OFF does not process');
 eq(calls.length,0,'no queue call');
}
for(const key of Object.keys(approval)){
 const f=createUnifiedDeliveryWorker({
  release:{...approval,[key]:false},
  queue:{leaseNext:async()=>{throw Error('NO QUEUE WHEN OFF');}}
 });
 eq(f.ready,false,'missing approval '+key);
 eq(await f.runOnce(),{state:'disabled'},'disallowed release '+key);
}
for(const name of ['private_pdf','reading_pass','class_pass']){
 const f=fixture({kind:name});
 eq(f.worker.ready,true,'mock-approved worker can compose');
 const res=await f.worker.runOnce();
 eq(res,{state:'sent',kind:name,eventKind:'grant'},'proper notification for '+name);
 eq(f.emails.length,1,'one email for '+name);
 eq(f.emails[0].to,'buyer@example.invalid','verified recipient');
 eq(f.emails[0].idempotencyKey,'nal:delivery:v1:'+O+':grant','stable dedupe key');
 const url=f.emails[0].text.split('\n').find(s=>s.startsWith('https://'));
 const parsed=new URL(url);
 eq(parsed.origin,'https://daily-coach-ing.com','owned domain only');
 eq(parsed.pathname,name==='private_pdf'?'/nal/commerce/claim/':'/nal/commerce/pass/','private route');
 eq(parsed.search,'','secret absent from query');
 assert.match(parsed.hash,/#order=/);checks++;
 eq(f.issues.length,1,'only one stored digest');
 assert.match(f.issues[0].tokenDigest,/^[a-f0-9]{64}$/);checks++;
 eq(f.issues[0].orderId,O,'stored for intended order');
 eq(await f.worker.runOnce(),{state:'empty'},'one notification not duplicated');
}
{
 const f=fixture({kind:'reading_pass',eventKind:'revoke'});
 eq(await f.worker.runOnce(),{state:'sent',kind:'reading_pass',eventKind:'revoke'},'refund message');
 eq(f.issues.length,0,'refund generates no fresh bearer token');
 eq(f.emails[0].text.includes('https://'),false,'refund notice has no access link');
 eq(f.emails[0].idempotencyKey,'nal:delivery:v1:'+O+':revoke','refund dedupe distinct');
}
{
 const f=fixture({sendFails:true});
 eq(await f.worker.runOnce(),{state:'retry_or_review'},'email transport failure cannot claim sent');
 assert(f.calls.includes('complete:false'));checks++;
}
{
 const f=fixture({refundMidway:true});
 eq(await f.worker.runOnce(),{state:'retry_or_review'},'refund before send prevents delivery');
 eq(f.emails.length,0,'no send after post-claim revocation');
 eq(f.issues.length,1,'pre-refund receipt digest issued (must be denied at redemption)');
 assert(f.calls.includes('complete:false'));checks++;
}
{
 const f=fixture({badLease:true});
 eq(await f.worker.runOnce(),{state:'invalid-job'},'invalid server lease rejects');
 eq(f.emails.length,0,'invalid DB data does not send');
 eq(f.calls.filter(x=>x.startsWith('complete:')).length,0,'malformed lease cannot complete');
}
{
 const f=createUnifiedDeliveryWorker({
  release:approval,
  queue:{leaseNext:async()=>job(),complete:async()=>{throw Error('unused');}},
  eligibility:{recheck:async()=>true},
  pdf:{prepare:async()=>({url:'https://phishing.invalid/nal/commerce/claim/#order='+O+'&token='+'X'.repeat(43)})},
  programs:{prepare:async()=>({url:''})},
  mailer:{send:async()=>{throw Error('MUST_NOT_SEND_TO_UNKNOWN_DOMAIN');}}
 });
 eq(await f.runOnce(),{state:'retry_or_review'},'reject off-domain token link');
}
{
 const at=await mintProgramPassClaim({orderId:O,kind:'class_pass',now:AT,hours:24});
 assert.match(at.tokenDigest,/^[a-f0-9]{64}$/);checks++;
 eq(at.expiresAt,new Date(AT+86400000).toISOString(),'one-day expiry');
 await assert.rejects(mintProgramPassClaim({orderId:O,kind:'private_pdf',now:AT}),/INVALID/);checks++;
 await assert.rejects(mintProgramPassClaim({orderId:O,kind:'class_pass',now:AT,hours:49}),/INVALID/);checks++;
}
console.log('NAL P7-D unified delivery worker synthetic PASS: '+checks+
 ' checks, 3 entitlements, refund/retry/idempotent email, digest-only claims; NO real email');
