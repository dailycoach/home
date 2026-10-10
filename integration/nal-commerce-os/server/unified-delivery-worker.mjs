/**
 * P7-D NAL COMMERCE OS: one notification engine for PDF, reading circle,
 * and class sales. This is SOURCE ONLY and has no Deno.serve/email/network.
 *
 * The private P7-B ledger already issues/revokes the entitlement in the same
 * payment transaction. This worker only notifies a verified buyer; it never
 * creates payment rights, bookable seats or public PDF URLs.
 *
 * Delivery is AT-LEAST-ONCE under crash/retry: a real email provider must
 * enforce idempotencyKey per order+event for practical deduplication.
 */
export const DEFAULT_DELIVERY_RELEASE=Object.freeze({
 enabled:false, ownerReviewApproved:false, deliveryDbDeployed:false,
 emailDomainVerified:false, emailProviderConnected:false,
 pdfReceiptReady:false, programClaimPageReady:false,
 customerPrivacyApproved:false, productionApproved:false
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES=new Set(['private_pdf','reading_pass','class_pass']);
const EVENTS=new Set(['grant','revoke']);
const EMAIL=/^[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,180}\.[A-Z]{2,30}$/i;
const ALLOW=['https://daily-coach-ing.com'];
const paths={private_pdf:'/nal/commerce/claim/',reading_pass:'/nal/commerce/pass/',class_pass:'/nal/commerce/pass/'};
const complete=r=>r?.enabled===true&&r.ownerReviewApproved===true
 &&r.deliveryDbDeployed===true&&r.emailDomainVerified===true
 &&r.emailProviderConnected===true&&r.pdfReceiptReady===true
 &&r.programClaimPageReady===true&&r.customerPrivacyApproved===true
 &&r.productionApproved===true;
function trustedJob(j){
 return j && UUID.test(j.orderId||'')&&UUID.test(j.leaseId||'')
  &&EVENTS.has(j.eventKind)&&TYPES.has(j.fulfillmentKind)
  &&EMAIL.test(j.email||'') && j.email===j.email.toLowerCase()
  &&typeof j.title==='string'&&j.title.length>=2&&j.title.length<=120
  &&Number.isSafeInteger(j.attempts)&&j.attempts>=1&&j.attempts<=5;
}
function safeLink(raw,type){
 if(typeof raw!=='string'||!TYPES.has(type))return false;
 try{
  const u=new URL(raw);
  const p=new URLSearchParams(u.hash.slice(1));
  return ALLOW.includes(u.origin)&&u.protocol==='https:'
   &&u.pathname===paths[type]&&!u.search&&!u.username&&!u.password
   &&p.size===2&&p.has('order')&&p.has('token')
   &&UUID.test(p.get('order')||'')
   &&/^[A-Za-z0-9_-]{43}$/.test(p.get('token')||'');
 }catch{return false;}
}
function messageFor(job,link){
 const name=job.fulfillmentKind==='private_pdf'?'마음도구 PDF':
   job.fulfillmentKind==='reading_pass'?'독서모임':'클래스';
 const idempotencyKey='nal:delivery:v1:'+job.orderId+':'+job.eventKind;
 if(job.eventKind==='revoke'){
  return {to:job.email,idempotencyKey,
   subject:'[NAL · 날빛] '+name+' 이용 상태 변경 안내',
   text:'신청하신 '+name+'의 이용 상태가 변경되었습니다.\n'+
    '이 안내는 환불금 입금을 확정하는 영수증이 아닙니다. 자세한 상태는 고객지원에 문의해 주세요.\n'};
 }
 return {to:job.email,idempotencyKey,
  subject:'[NAL · 날빛] '+name+' 구매 확인 안내',
  text:'구매하신 '+name+'이 준비되었습니다.\n'+
   '아래 링크는 주문자에게만 전달되는 일회용 확인 링크입니다.\n'+
   '다른 사람에게 전달하지 마세요.\n'+link+'\n'
 };
}
/**
 * Injected server-only ports:
 * queue.leaseNext() => validated job, or null (SQL row-locked lease)
 * queue.complete({orderId,eventKind,leaseId,sent,errorCode})
 * eligibility.recheck(job) => boolean, reads current order + entitlement
 * pdf.prepare({orderId}) => one-use link with SHA-256 already stored by P7-C
 * programs.prepare({orderId,kind}) => P7-D private SQL pass claim, hashed
 * mailer.send({to,subject,text,idempotencyKey}) with provider dedupe.
 *
 * Leases and idempotency are persisted in isolated SQL; this loop performs
 * NO real network calls or delivery until separately configured and approved.
 */
export function createUnifiedDeliveryWorker({
 release=DEFAULT_DELIVERY_RELEASE,
 queue,eligibility,pdf,programs,mailer
}={}){
 const ready=complete(release)
  &&typeof queue?.leaseNext==='function'
  &&typeof queue?.complete==='function'
  &&typeof eligibility?.recheck==='function'
  &&typeof pdf?.prepare==='function'
  &&typeof programs?.prepare==='function'
  &&typeof mailer?.send==='function';
 return Object.freeze({
  ready,
  async runOnce(){
   if(!ready)return {state:'disabled'};
   let job=null;
   try{
    job=await queue.leaseNext();
    if(job===null)return {state:'empty'};
    if(!trustedJob(job))return {state:'invalid-job'};
    if(await eligibility.recheck(job)!==true)throw Error('NOT_AUTHORIZED');
    let url=null;
    if(job.eventKind==='grant'){
     const result=job.fulfillmentKind==='private_pdf'
       ?await pdf.prepare({orderId:job.orderId})
       :await programs.prepare({orderId:job.orderId,kind:job.fulfillmentKind});
     url=result?.url;
     if(!safeLink(url,job.fulfillmentKind))throw Error('UNSAFE_DELIVERY_LINK');
     if(new URL(url).hash.includes(job.email))throw Error('PII_IN_LINK');
     // A refund can race email token issuance. Do not SEND unless DB says
     // the current entitlement is still valid immediately before transport.
     if(await eligibility.recheck(job)!==true)throw Error('REVOKED_BEFORE_SEND');
    }
    const message=messageFor(job,url);
    // The email adapter MUST accept a stable idempotency key and MUST NOT
    // leak buyer email, claim secret, SMTP creds or provider payload in logs.
    await mailer.send(message);
    const state=await queue.complete({
      orderId:job.orderId,eventKind:job.eventKind,
      leaseId:job.leaseId,sent:true,errorCode:null
    });
    if(state!=='sent')return {state:'review_required'};
    return {state:'sent',kind:job.fulfillmentKind,eventKind:job.eventKind};
   }catch{
    if(job&&trustedJob(job)){
     try{
      await queue.complete({
       orderId:job.orderId,eventKind:job.eventKind,
       leaseId:job.leaseId,sent:false,errorCode:'SEND_RETRY_FAILED'
      });
     }catch{}
    }
    return {state:'retry_or_review'};
   }
  }
 });
}
