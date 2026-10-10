/**
 * NAL COMMERCE LITE · server-side, provider-neutral HTTP contract (SOURCE ONLY).
 *
 * No deployed Edge entrypoint imports this file. Missing any independently
 * reviewed dependency/flag means HTTP 503; never a synthetic paid result.
 *
 * A real adapter must authenticate a payment with the provider's server API.
 * The store must settle payments transactionally and refuse refund -> paid
 * re-grants, and the delivery port must independently recheck the entitlement.
 */
export const DEFAULT_COMMERCE_RELEASE = Object.freeze({
  enabled:false,providerConfigured:false,ledgerReviewed:false,
  privacyNoticeApproved:false,refundGuardReviewed:false,
  emailSenderReady:false,deliveryReviewed:false,customerReleaseApproved:false
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[a-z0-9-]{1,120}$/;
const CLAIM=/^[A-Za-z0-9_-]{40,128}$/;
const EMAIL=/^[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,180}\.[A-Z]{2,30}$/i;
const STATUSES=new Set(['READY','IN_PROGRESS','DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED']);
const MAX_POST_BYTES=4096;
const err=(status,error)=>({status,error});
const exact=(obj,keys)=>!!obj&&typeof obj==='object'&&!Array.isArray(obj)
  &&Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));
const json=(status,obj,origin,allowed)=>new Response(JSON.stringify(obj),{
  status,headers:{
    'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'Vary':'Origin','X-Content-Type-Options':'nosniff',
    ...(allowed&&origin?{'Access-Control-Allow-Origin':origin}:{})
  }
});
const ready=r=>r?.enabled===true&&r.providerConfigured===true
 &&r.ledgerReviewed===true&&r.privacyNoticeApproved===true
 &&r.refundGuardReviewed===true&&r.emailSenderReady===true
 &&r.deliveryReviewed===true&&r.customerReleaseApproved===true;

async function boundedJson(request) {
  const reader=request.body?.getReader();
  if(!reader)throw err(400,'INVALID_BODY');
  let size=0;const chunks=[];
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_POST_BYTES){await reader.cancel();throw err(413,'REQUEST_TOO_LARGE');}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const merged=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(merged));}
  catch{throw err(400,'INVALID_JSON');}
}
const normalizeEmail=s=>typeof s==='string'?s.trim().toLowerCase():'';
const proof=s=>typeof s==='string'&&CLAIM.test(s);
const productOK=(p,minimum)=>p?.published===true&&p?.stockStatus==='available'
 &&p?.deliveryType==='digital'&&ID.test(p.id||'')
 &&Number.isSafeInteger(p.price)&&p.price>=minimum
 &&typeof p.title==='string'&&p.title.length>=2&&p.title.length<=100
 &&typeof p.version==='string'&&p.version.length>0&&p.version.length<=80
 &&p.editionApproved===true&&p.privateFileReady===true
 &&p.policyApproved===true;
function approvedPayment(payment,order) {
  return payment?.authoritative===true&&payment.source==='provider-server-lookup'
   &&payment.providerCode===order.providerCode
   &&payment.orderId===order.id
   &&payment.providerOrderId===order.providerOrderId
   &&payment.merchantId===order.merchantId
   &&payment.currency==='KRW'
   &&payment.amountWon===order.amountWon
   &&STATUSES.has(payment.status)
   &&typeof payment.paymentKey==='string'&&payment.paymentKey.length>0
   &&payment.paymentKey.length<=200;
}
function newProof() {
  const bytes=new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function digest(value) {
  const hash=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function secureCheckoutUrl(value,origins){
  try{
    const u=new URL(value);
    return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash
     &&Array.isArray(origins)&&origins.includes(u.origin)?u.href:null;
  }catch{return null;}
}
function validDownload(url,storageOrigin) {
  try{
    const u=new URL(url);
    return u.protocol==='https:'&&u.origin===storageOrigin
      &&u.pathname.startsWith('/storage/v1/object/sign/nal-products-private/')
      &&u.searchParams.has('token')&&!u.username&&!u.password&&!u.hash;
  }catch{return false;}
}
function safeOrderShape(order){
  return order&&UUID.test(order.id||'')&&typeof order.providerOrderId==='string'
    &&order.providerOrderId.length>=8
    &&typeof order.merchantId==='string'&&order.merchantId.length>0
    &&typeof order.providerCode==='string'&&order.providerCode.length>0
    &&typeof order.productId==='string'&&ID.test(order.productId)
    &&Number.isSafeInteger(order.amountWon)&&order.amountWon>=100
    &&order.currency==='KRW'&&typeof order.fileVersion==='string';
}

/**
 * Injected server-only ports:
 * catalog.findPaidProduct(id)
 * store.createPending({requestId,email,product,claimDigest,providerCode})
 * store.findByClaim({orderId,claimDigest})
 * store.applyProviderResult({orderId,verifiedPayment}) : transactional & monotonic
 * store.queueReceiptOnce({orderId}) : idempotent verified-payment email job
 * provider.createCheckout(order), provider.lookupPayment(order)
 * delivery.createSignedDownload({orderId,claimDigest,maxSeconds}) : atomically recheck
 * limit.allow({email,action,origin}) : abuse prevention
 *
 * The store functions MUST trust only server-owned data and never client prices.
 * Static/client release flags alone NEVER authorize payments.
 */
export function createCommerceLiteHandler({
  release=DEFAULT_COMMERCE_RELEASE,allowedOrigins=['https://daily-coach-ing.com'],
  minimumAmountWon=100,provider,store,catalog,delivery,limit,
  storageOrigin='https://invalid.supabase.co'
}={}) {
  return async function handle(request) {
    const origin=request.headers.get('Origin')||'';
    const allowed=allowedOrigins.includes(origin);
    if(origin&&!allowed)return json(403,{error:'ORIGIN_DENIED'},origin,false);
    if(request.method==='OPTIONS'){
      return new Response(null,{status:204,headers:{
        'Cache-Control':'no-store','Vary':'Origin',
        ...(allowed?{'Access-Control-Allow-Origin':origin}:{})
      }});
    }
    if(request.method!=='POST')return json(405,{error:'POST_REQUIRED'},origin,allowed);
    // Check readiness BEFORE reading/storing email or contacting any provider.
    if(!ready(release)||!Number.isSafeInteger(minimumAmountWon)||minimumAmountWon<100
       ||!provider?.code||!Array.isArray(provider.checkoutOrigins)||!provider.checkoutOrigins.length
       ||typeof catalog?.findPaidProduct!=='function'
       ||typeof store?.createPending!=='function'
       ||typeof store?.findByClaim!=='function'
       ||typeof store?.applyProviderResult!=='function'
       ||typeof store?.queueReceiptOnce!=='function'
       ||typeof store?.reserveReceiptProof!=='function'
       ||typeof store?.finishReceiptProof!=='function'
       ||typeof provider?.createCheckout!=='function'
       ||typeof provider?.lookupPayment!=='function'
       ||typeof delivery?.createSignedDownload!=='function'
       ||typeof limit?.allow!=='function'
       ||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(storageOrigin)
    )return json(503,{error:'COMMERCE_NOT_ENABLED'},origin,allowed);
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))
      return json(415,{error:'JSON_REQUIRED'},origin,allowed);

    let data;
    try{data=await boundedJson(request);}
    catch(e){return json(e?.status||400,{error:e?.error||'INVALID_BODY'},origin,allowed);}
    if(!data||typeof data!=='object'||Array.isArray(data))
      return json(400,{error:'INVALID_BODY'},origin,allowed);

    const action=data.action;
    if(!['create','status','download','redeem'].includes(action))
      return json(400,{error:'INVALID_ACTION'},origin,allowed);
    if(action==='create') {
      if(!exact(data,['action','productId','email','accepted','requestId'])
        ||!ID.test(data.productId||'')||!UUID.test(data.requestId||'')
        ||data.accepted!==true||!EMAIL.test(normalizeEmail(data.email))
      )return json(400,{error:'INVALID_ORDER_INPUT'},origin,allowed);
      const email=normalizeEmail(data.email);
      try{
        if(await limit.allow({email,action,origin})!==true)
          return json(429,{error:'TRY_LATER'},origin,allowed);
        const product=await catalog.findPaidProduct(data.productId);
        if(!productOK(product,minimumAmountWon))
          return json(409,{error:'PRODUCT_NOT_FOR_SALE'},origin,allowed);
        const claimToken=newProof(),claimDigest=await digest(claimToken);
        const order=await store.createPending({
          requestId:data.requestId,email,claimDigest,providerCode:provider.code,
          product:{
            id:product.id,title:product.title,price:product.price,
            currency:'KRW',version:product.version
          }
        });
        if(!safeOrderShape(order)||order.productId!==product.id
          ||order.amountWon!==product.price||order.fileVersion!==product.version
          ||order.providerCode!==provider.code
          ||order.status!=='pending')
          throw Error('Unsafe order snapshot');
        const payment=await provider.createCheckout(order);
        const checkoutUrl=secureCheckoutUrl(payment?.checkoutUrl,provider.checkoutOrigins);
        if(!checkoutUrl)throw Error('Unsafe provider redirect');
        return json(200,{orderId:order.id,claimToken,checkoutUrl},origin,allowed);
      }catch{
        return json(503,{error:'CHECKOUT_NOT_READY'},origin,allowed);
      }
    }

    if(action==='redeem') {
      if(!exact(data,['action','orderId','receiptToken'])||
        !UUID.test(data.orderId||'')||!proof(data.receiptToken))
        return json(400,{error:'INVALID_RECEIPT_PROOF'},origin,allowed);
      let reserved=false;
      let tokenDigest;
      try{
        if(await limit.allow({action,origin})!==true)
          return json(429,{error:'TRY_LATER'},origin,allowed);
        tokenDigest=await digest(data.receiptToken);
        // The private DB port must atomically check token one-time TTL, payment
        // revocation and place a short-lived reservation against concurrent use.
        const order=await store.reserveReceiptProof({orderId:data.orderId,tokenDigest});
        if(!safeOrderShape(order)||order.id!==data.orderId)
          return json(403,{error:'RECEIPT_NOT_VALID'},origin,allowed);
        reserved=true;
        const payment=await provider.lookupPayment(order);
        if(!approvedPayment(payment,order))
          return json(503,{error:'PAYMENT_REVIEW_REQUIRED'},origin,allowed);
        const ledger=await store.applyProviderResult({orderId:order.id,verifiedPayment:payment});
        if(ledger?.state!=='paid'||payment.status!=='DONE')
          return json(403,{error:'DOWNLOAD_NOT_AUTHORIZED'},origin,allowed);
        const signed=await delivery.createSignedDownload({
          orderId:order.id,receiptTokenDigest:tokenDigest,maxSeconds:300
        });
        if(!validDownload(signed?.downloadUrl,storageOrigin))
          return json(503,{error:'DELIVERY_NOT_READY'},origin,allowed);
        if(await store.finishReceiptProof({orderId:order.id,tokenDigest,issued:true})!==true)
          return json(503,{error:'RECEIPT_FINALIZE_FAILED'},origin,allowed);
        reserved=false;
        return json(200,{downloadUrl:signed.downloadUrl},origin,allowed);
      }catch{
        return json(503,{error:'RECEIPT_VERIFICATION_UNAVAILABLE'},origin,allowed);
      }finally{
        if(reserved){
          try{await store.finishReceiptProof({orderId:data.orderId,tokenDigest,issued:false});}
          catch{ /* A pending claim recovers only via DB reservation timeout. */ }
        }
      }
    }

    if(!exact(data,['action','orderId','claimToken'])||
       !UUID.test(data.orderId||'')||!proof(data.claimToken))
      return json(400,{error:'INVALID_PROOF'},origin,allowed);
    try{
      if(await limit.allow({action,origin})!==true)
        return json(429,{error:'TRY_LATER'},origin,allowed);
      const claimDigest=await digest(data.claimToken);
      const order=await store.findByClaim({orderId:data.orderId,claimDigest});
      if(!safeOrderShape(order)||order.id!==data.orderId)
        return json(403,{error:'ORDER_NOT_ACCESSIBLE'},origin,allowed);
      // A browser/provider redirect is never proof of payment.
      const payment=await provider.lookupPayment(order);
      if(!approvedPayment(payment,order))
        return json(503,{error:'PAYMENT_REVIEW_REQUIRED'},origin,allowed);
      const ledger=await store.applyProviderResult({orderId:order.id,verifiedPayment:payment});
      if(!ledger||!['pending','paid','refunded','cancelled','refund_requested','review_required'].includes(ledger.state))
        return json(503,{error:'SETTLEMENT_REVIEW_REQUIRED'},origin,allowed);
      if(ledger.state==='paid'&&payment.status!=='DONE')
        return json(503,{error:'PAYMENT_STATE_DISAGREEMENT'},origin,allowed);
      if(ledger.state==='paid')await store.queueReceiptOnce({orderId:order.id});
      if(action==='status')return json(200,{
        state:ledger.state,canDownload:ledger.state==='paid'&&payment.status==='DONE'
      },origin,allowed);
      if(ledger.state!=='paid'||payment.status!=='DONE')
        return json(403,{error:'DOWNLOAD_NOT_AUTHORIZED'},origin,allowed);

      // Recheck active order/payment/entitlement at signing time inside delivery.
      const result=await delivery.createSignedDownload({
        orderId:order.id,claimDigest,maxSeconds:300
      });
      if(!validDownload(result?.downloadUrl,storageOrigin))
        return json(503,{error:'DELIVERY_NOT_READY'},origin,allowed);
      return json(200,{downloadUrl:result.downloadUrl},origin,allowed);
    }catch{
      return json(503,{error:'ORDER_VERIFICATION_UNAVAILABLE'},origin,allowed);
    }
  };
}
