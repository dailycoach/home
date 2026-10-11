/**
 * NAL P7-E privately re-send an existing paid program attendee's email.
 * Source only; no deployed queue cron, email provider or Supabase connection.
 * This never creates a new booking/payment or changes the entitlement.
 *
 * Retries are AT-LEAST-ONCE. Sender must dedupe idempotencyKey by jobId.
 */
export const DEFAULT_PASS_RESEND_RELEASE=Object.freeze({
 enabled:false,privateLedgerReviewed:false,emailProviderConnected:false,
 emailDomainVerified:false,programClaimApproved:false,
 buyerPrivacyApproved:false,productionApproved:false
});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const EMAIL=/^[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,180}\.[A-Z]{2,30}$/i;
const KINDS=new Set(['reading_pass','class_pass']);
const ready=r=>r?.enabled===true&&r.privateLedgerReviewed===true
 &&r.emailProviderConnected===true&&r.emailDomainVerified===true
 &&r.programClaimApproved===true&&r.buyerPrivacyApproved===true
 &&r.productionApproved===true;
function validJob(job){
 return job&&UUID.test(job.jobId||'')&&UUID.test(job.orderId||'')
  &&UUID.test(job.leaseId||'')&&KINDS.has(job.kind)
  &&EMAIL.test(job.email||'')&&job.email===job.email.toLowerCase()
  &&typeof job.title==='string'&&job.title.length>=2&&job.title.length<=120
  &&Number.isFinite(Date.parse(job.startsAt))
  &&Date.parse(job.startsAt)>Date.now()
  &&Number.isInteger(job.attempts)&&job.attempts>=1&&job.attempts<=5;
}
function safePassLink(raw,job){
 try{
  const u=new URL(raw),p=new URLSearchParams(u.hash.slice(1));
  return u.origin==='https://daily-coach-ing.com' &&u.protocol==='https:'
   &&u.pathname==='/nal/commerce/pass/'&&!u.search&&!u.username&&!u.password
   &&p.size===2&&p.get('order')===job.orderId
   &&/^[A-Za-z0-9_-]{43}$/.test(p.get('token')||'');
 }catch{return false;}
}
export function createPassResendWorker({
 release=DEFAULT_PASS_RESEND_RELEASE,
 queue,eligibility,programs,mailer
}={}){
 const enabled=ready(release)
  &&typeof queue?.leaseNext==='function'&&typeof queue?.finish==='function'
  &&typeof eligibility?.recheck==='function'
  &&typeof programs?.prepare==='function'
  &&typeof mailer?.send==='function';
 return Object.freeze({
  ready:enabled,
  async runOnce(){
   if(!enabled)return {state:'disabled'};
   let job=null;
   try{
    job=await queue.leaseNext();
    if(job===null)return {state:'empty'};
    if(!validJob(job))return {state:'invalid'};
    if(await eligibility.recheck(job)!==true)throw Error('NO_ACTIVE_PASS');
    const link=await programs.prepare({orderId:job.orderId,kind:job.kind});
    if(!safePassLink(link?.url,job))throw Error('UNSAFE_PRIVATE_LINK');
    // Provider could refund while the claim is being minted.
    if(await eligibility.recheck(job)!==true)throw Error('REFUND_BEFORE_SEND');
    const name=job.kind==='reading_pass'?'독서모임':'클래스';
    await mailer.send({
     to:job.email,
     subject:'[NAL · 날빛] '+name+' 참가권 안내 재발송',
     text:'신청하신 '+name+'의 참가권 확인 링크입니다.\n'+
      '이용 기간 내 본인만 열어 주세요.\n'+link.url+'\n',
     idempotencyKey:'nal:pass-resend:v1:'+job.jobId
    });
    const result=await queue.finish({jobId:job.jobId,leaseId:job.leaseId,sent:true});
    return result==='sent'?{state:'sent',kind:job.kind}:{state:'review_required'};
   }catch{
    if(job&&validJob(job)){
     try{await queue.finish({
      jobId:job.jobId,leaseId:job.leaseId,sent:false
     });}catch{}
    }
    return {state:'retry_or_review'};
   }
  }
 });
}
