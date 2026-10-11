/**
 * NAL P7-E: account-free program pass verification and buyer-proof-gated resend.
 * SOURCE ONLY. There is no Edge entrypoint, actual PG verification, email
 * transport, privileged Supabase client or DB connection in this module.
 *
 * A static UI gate is NOT an authorization boundary; this handler defaults OFF
 * and requires independently reviewed server-only ports before use.
 */
export const DEFAULT_PASS_API_RELEASE=Object.freeze({
 enabled:false,privateLedgerApproved:false,providerVerificationApproved:false,
 consumerPassApproved:false,privacyAndRefundApproved:false,
 rateLimitReviewed:false,resendWorkerApproved:false,productionApproved:false
});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const KINDS=new Set(['reading_pass','class_pass']);
const MAX_BODY=4096;
const ready=r=>r?.enabled===true&&r.privateLedgerApproved===true
 &&r.providerVerificationApproved===true&&r.consumerPassApproved===true
 &&r.privacyAndRefundApproved===true&&r.rateLimitReviewed===true
 &&r.resendWorkerApproved===true&&r.productionApproved===true;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)
 &&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const reply=(code,data,origin='',allowed=false)=>new Response(JSON.stringify(data),{
 status:code,headers:{
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff',
  'Vary':'Origin',...(allowed&&origin?{'Access-Control-Allow-Origin':origin}:{})
 }
});
async function jsonBody(request){
 if(!request.body)return null;
 const reader=request.body.getReader(),chunks=[];
 let size=0;
 try{
  while(true){
   const part=await reader.read();
   if(part.done)break;
   size+=part.value.byteLength;
   if(size>MAX_BODY){await reader.cancel();return null;}
   chunks.push(part.value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;
 for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{return null;}
}
async function sha(value){
 const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
const privateSummary=x=>x&&typeof x==='object'
 &&x.state==='confirmed'&&KINDS.has(x.kind)
 &&UUID.test(x.orderId||'')&&UUID.test(x.slotId||'')
 &&typeof x.title==='string'&&x.title.length>=2&&x.title.length<=120
 &&typeof x.startsAt==='string'&&Number.isFinite(Date.parse(x.startsAt))
 &&Date.parse(x.startsAt)>Date.now();
export function createPassClaimHandler({
 release=DEFAULT_PASS_API_RELEASE,
 origins=['https://daily-coach-ing.com'],
 db,payment,rateLimit
}={}){
 return async request=>{
  const origin=request.headers.get('Origin')||'';
  if(!origins.includes(origin))return reply(403,{error:'ORIGIN_DENIED'});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
   'Vary':'Origin','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,
   'Access-Control-Allow-Methods':'POST, OPTIONS',
   'Access-Control-Allow-Headers':'apikey, content-type'
  }});
  if(request.method!=='POST')return reply(405,{error:'POST_REQUIRED'},origin,true);
  if(!ready(release)||typeof db?.reservePass!=='function'
   ||typeof db?.finishPass!=='function'||typeof db?.lookupBuyerProof!=='function'
   ||typeof db?.queueResend!=='function'
   ||typeof payment?.revalidate!=='function'
   ||typeof rateLimit?.allow!=='function')
   return reply(503,{error:'PASS_NOT_ENABLED'},origin,true);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))
   return reply(415,{error:'JSON_REQUIRED'},origin,true);
  const data=await jsonBody(request);
  if(!data||typeof data!=='object'||Array.isArray(data))
   return reply(400,{error:'INVALID_REQUEST'},origin,true);
  const action=data.action;
  if(!['verify','confirm','resend'].includes(action))
   return reply(400,{error:'INVALID_ACTION'},origin,true);
  if(!UUID.test(data.orderId||''))
   return reply(400,{error:'INVALID_ORDER'},origin,true);
  if(action==='resend'){
   if(!exact(data,['action','orderId','claimToken','requestId'])
     ||!TOKEN.test(data.claimToken||'')||!UUID.test(data.requestId||''))
    return reply(400,{error:'INVALID_PROOF'},origin,true);
   try{
    if(await rateLimit.allow({action,origin,orderId:data.orderId})!==true)
     return reply(429,{error:'TRY_LATER'},origin,true);
    const digest=await sha(data.claimToken);
    // The proof is bound to the actual original checkout. Neither order ID
    // nor email address alone can authorize another message.
    const owner=await db.lookupBuyerProof({orderId:data.orderId,claimDigest:digest});
    if(owner&&owner.id===data.orderId
      &&['reading_circle','class_session'].includes(owner.kind)
      &&owner.status==='paid'&&owner.revoked===false
      &&await payment.revalidate({orderId:data.orderId})===true){
      await db.queueResend({orderId:data.orderId,claimDigest:digest,
        requestId:data.requestId});
    }
   }catch{
    // Never reveal order existence or authorization through resend outcome.
   }
   return reply(202,{accepted:true},origin,true);
  }
  if(!exact(data,['action','orderId','receiptToken'])
    ||!TOKEN.test(data.receiptToken||''))
   return reply(400,{error:'INVALID_PROOF'},origin,true);
  const digest=await sha(data.receiptToken);
  try{
   if(await rateLimit.allow({action,origin,orderId:data.orderId})!==true)
    return reply(429,{error:'TRY_LATER'},origin,true);
   if(action==='verify'){
    const ticket=await db.reservePass({orderId:data.orderId,tokenDigest:digest});
    if(!ticket||ticket.orderId!==data.orderId||!privateSummary(ticket))
     return reply(403,{error:'PASS_NOT_VERIFIED'},origin,true);
    try{
     if(await payment.revalidate({orderId:data.orderId})!==true)
      throw Error('PROVIDER_NOT_CONFIRMED');
     return reply(200,{
      orderId:ticket.orderId,kind:ticket.kind,title:ticket.title,
      startsAt:ticket.startsAt,slotId:ticket.slotId,state:'confirmed'
     },origin,true);
    }catch{
     await db.finishPass({orderId:data.orderId,tokenDigest:digest,issued:false})
       .catch(()=>false);
     return reply(503,{error:'PAYMENT_REVIEW_REQUIRED'},origin,true);
    }
   }
   if(await payment.revalidate({orderId:data.orderId})!==true)
    return reply(503,{error:'PAYMENT_REVIEW_REQUIRED'},origin,true);
   const result=await db.finishPass({
    orderId:data.orderId,tokenDigest:digest,issued:true
   });
   if(result!==true)return reply(403,{error:'PASS_NOT_VERIFIED'},origin,true);
   return reply(200,{state:'confirmed'},origin,true);
  }catch{
   return reply(503,{error:'VERIFICATION_UNAVAILABLE'},origin,true);
  }
 };
}
