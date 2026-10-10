/**
 * P7-C server-only bridge: P6 Commerce Lite HTTP contract <-> P7-B
 * isolated Postgres ledger. All SQL functions are private nal_private.
 *
 * This module has NO database connection, Supabase client, Edge Deno.serve,
 * HTTP listener, service-role key, PG secret or storage signer.
 * A real deployment requires independently approved parameterized
 * Postgres client, checked server-side PG adapter and private email worker.
 */
import {quoteNalItem} from '../order-engine.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64=/^[0-9a-f]{64}$/;
const PRODUCT=/^[a-z0-9-]{1,120}$/;
const OID=/^nal_[a-f0-9]{32}$/;
const STATES=new Set(['READY','IN_PROGRESS','DONE','CANCELED','PARTIAL_CANCELED','EXPIRED','ABORTED']);
const KINDS=new Set(['pdf','reading_circle','class_session']);
const PK='nal-products-private';
const OBJECT=/^[a-z0-9][a-z0-9/_-]*\.pdf$/;
const rpcNames=Object.freeze({
 begin:'nal_private.commerce_os_begin_order',
 byClaim:'nal_private.commerce_os_order_by_claim',
 settle:'nal_private.commerce_os_apply_provider',
 queue:'nal_private.commerce_os_queue_receipt',
 reserve:'nal_private.commerce_os_reserve_receipt',
 finish:'nal_private.commerce_os_finish_receipt',
 can:'nal_private.commerce_os_can_deliver',
 canReceipt:'nal_private.commerce_os_can_receipt_deliver'
});
const bytes=x=>typeof x==='string'&&x.length>0;
const validProvider=p=>p&&PRODUCT.test(p.code||'')&&bytes(p.merchantId)
  &&p.merchantId.length<=200&&Array.isArray(p.checkoutOrigins)
  &&p.checkoutOrigins.length>0
  &&p.checkoutOrigins.every(x=>{
    try{const url=new URL(x);return url.origin===x&&url.protocol==='https:'
      &&!url.username&&!url.password;}catch{return false;}
  })
  &&typeof p.createCheckout==='function'
  &&typeof p.lookupPayment==='function';
const normalizedEmail=s=>typeof s==='string'?s.trim().toLowerCase():'';
const validOrder=(o,expected)=>{
 if(!o||!UUID.test(o.id||'')||o.productId!==expected.offerId
  ||o.kind!==expected.kind||o.slotId!==(expected.slotId??null)
  ||o.providerCode!==expected.providerCode||o.providerOrderId!==expected.providerOrderId
  ||o.merchantId!==expected.merchantId||o.currency!=='KRW'
  ||!Number.isSafeInteger(o.amountWon)||o.amountWon<100
  ||!bytes(o.fileVersion)
  ||!['pending','paid','refunded','refund_requested','cancelled','review_required'].includes(o.status))
  throw Error('GUEST_LEDGER_PROJECTION_MISMATCH');
 return o;
};
const secureCheckout=(raw,origins)=>{
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.hash
    ||!origins.includes(url.origin))throw Error('INVALID_PROVIDER_CHECKOUT_ORIGIN');
  return url.href;
 }catch{throw Error('INVALID_PROVIDER_CHECKOUT_ORIGIN');}
};
const validResult=x=>x&&typeof x==='object'&&typeof x.state==='string'
  &&['pending','paid','refund_requested','refunded','cancelled','review_required'].includes(x.state);

/**
 * Database adapter:
 * db.exec({name,args}) must be a parameterized, server-only private RPC.
 * db.getOffer({offerId}), db.getSlot({slotId}) are service-only lookups.
 * db.getPrivatePdf({orderId}) returns an ACTIVE file mapping of a
 * final approved edition in nal-products-private; not a public URL.
 * All database methods must recheck permission when called, not trust input.
 *
 * The original PDF-only P6 browser uses productId -> offerId. Reading/class
 * reservations share this ledger through prepareProgramOrder() but are
 * NOT yet wired to public customer checkout or READ. Do not sell early.
 */
export function createUnifiedGuestBridge({
 db,issuer,provider,signPrivatePdf,limit,at=Date.now
}={}) {
 if(!db||typeof db.exec!=='function'||typeof db.getOffer!=='function'
   ||typeof db.getSlot!=='function'||typeof db.getPrivatePdf!=='function'
   ||!issuer||typeof issuer.issueClaim!=='function'
   ||typeof issuer.issueProviderOrderId!=='function'
   ||!validProvider(provider)
   ||issuer.providerCode!==provider.code||issuer.merchantId!==provider.merchantId
   ||typeof signPrivatePdf!=='function'
   ||typeof limit?.allow!=='function'
   ||typeof at!=='function')
   throw Error('UNREVIEWED_GUEST_BACKEND_DEPENDENCY');
 const call=(key,args)=>db.exec({name:rpcNames[key],args});
 const snapshot=async offerId=>{
  if(!PRODUCT.test(offerId||''))throw Error('INVALID_OFFER_ID');
  const o=await db.getOffer({offerId});
  if(!o||o.id!==offerId||!KINDS.has(o.kind))throw Error('OFFER_NOT_READY');
  return o;
 };
 const quote=async({offerId,kind,slotId=null})=>{
  const offer=await snapshot(offerId);
  if(offer.kind!==kind)throw Error('OFFER_KIND_MISMATCH');
  const session=kind==='pdf'?null:await db.getSlot({slotId,offerId});
  const item={
   kind,id:offer.id,title:offer.title,priceWon:offer.priceWon,
   currency:offer.currency,version:offer.edition,published:offer.published,
   saleStatus:offer.saleStatus,policyApproved:offer.policyApproved,
   termsApproved:offer.termsApproved,fileApproved:offer.fileApproved,
   privateFileReady:offer.privateFileReady,licenseType:offer.licenseType,
   hostApproved:offer.hostApproved,session:session||undefined
  };
  const result=quoteNalItem(item,{at:at(),providerMinimumWon:provider.minimumAmountWon??100});
  if(!result.ok)throw Error(result.reason);
  if(result.quote.sessionId!==(slotId??null))throw Error('SESSION_QUOTE_NOT_MATCHED');
  return result.quote;
 };
 const pending=async({requestId,email,claimDigest,kind,offerId,slotId=null})=>{
  if(!UUID.test(requestId||'')||!HEX64.test(claimDigest||'')
    ||!KINDS.has(kind)||!PRODUCT.test(offerId||'')
    ||(slotId!==null&&!UUID.test(slotId)))
    throw Error('INVALID_PENDING_ORDER_CONTEXT');
  const mail=normalizedEmail(email);
  if(!mail||!mail.includes('@'))throw Error('INVALID_EMAIL');
  const q=await quote({offerId,kind,slotId});
  const providerOrderId=await issuer.issueProviderOrderId({
    requestId,email:mail,offerId,slotId
  });
  if(!OID.test(providerOrderId))throw Error('INVALID_SERVER_PROVIDER_ORDER_ID');
  const result=await call('begin',{
    p_request_id:requestId,p_email:mail,p_claim_digest:claimDigest,
    p_offer_id:offerId,p_slot_id:slotId,
    p_provider_code:provider.code,p_provider_order_id:providerOrderId,
    p_merchant_id:provider.merchantId
  });
  const orderId=result?.orderId;
  if(!UUID.test(orderId||''))throw Error('ORDER_NOT_CREATED');
  const found=await call('byClaim',{p_order_id:orderId,p_claim_digest:claimDigest});
  const order=validOrder(found,{offerId,kind,slotId,providerCode:provider.code,
    providerOrderId,merchantId:provider.merchantId});
  if(order.amountWon!==q.totalAmountWon||order.fileVersion!==q.version
    ||order.status!=='pending')throw Error('ORDER_SNAPSHOT_CHANGED');
  return Object.freeze({...order,quote:q});
 };
 const catalog=Object.freeze({
  async findPaidProduct(id){
    try{
     const q=await quote({kind:'pdf',offerId:id});
     return {
      id,title:q.title,version:q.version,price:q.totalAmountWon,
      published:true,stockStatus:'available',deliveryType:'digital',
      editionApproved:true,privateFileReady:true,policyApproved:true
     };
    }catch{return null;}
  }
 });
 const store=Object.freeze({
  async createPending({requestId,email,claimDigest,providerCode,product}){
   if(providerCode!==provider.code||!product||!PRODUCT.test(product.id||''))
     throw Error('PROVIDER_OR_PRODUCT_NOT_VERIFIED');
   const order=await pending({
    requestId,email,claimDigest,kind:'pdf',offerId:product.id,slotId:null
   });
   if(order.amountWon!==product.price||order.fileVersion!==product.version
     ||product.currency!=='KRW')throw Error('ORDER_PRICE_EDITION_NOT_MATCHED');
   return order;
  },
  async findByClaim({orderId,claimDigest}){
   if(!UUID.test(orderId||'')||!HEX64.test(claimDigest||''))return null;
   const item=await call('byClaim',{p_order_id:orderId,p_claim_digest:claimDigest});
   if(!item)return null;
   if(!KINDS.has(item.kind)||!PRODUCT.test(item.productId||'')
     ||item.providerCode!==provider.code||item.merchantId!==provider.merchantId
     ||item.currency!=='KRW')throw Error('UNTRUSTED_ORDER_SNAPSHOT');
   return item;
  },
  async applyProviderResult({orderId,verifiedPayment}){
   if(!UUID.test(orderId||'')||!verifiedPayment
     ||verifiedPayment.authoritative!==true
     ||verifiedPayment.source!=='provider-server-lookup'
     ||verifiedPayment.providerCode!==provider.code
     ||verifiedPayment.merchantId!==provider.merchantId
     ||!STATES.has(verifiedPayment.status)
     ||typeof verifiedPayment.providerEventId!=='string'
     ||!/^[-_A-Za-z0-9]{8,200}$/.test(verifiedPayment.providerEventId)
     ||typeof verifiedPayment.paymentKey!=='string'
     ||verifiedPayment.paymentKey.length<1||verifiedPayment.paymentKey.length>200
     ||!Number.isSafeInteger(verifiedPayment.amountWon))
      throw Error('SERVER_PROVIDER_RESULT_REQUIRED');
   const v=await call('settle',{
    p_order_id:orderId,p_provider_order_id:verifiedPayment.providerOrderId,
    p_merchant_id:provider.merchantId,p_payment_key:verifiedPayment.paymentKey,
    p_amount_won:verifiedPayment.amountWon,p_currency:verifiedPayment.currency,
    p_provider_state:verifiedPayment.status,
    p_provider_event_id:verifiedPayment.providerEventId,
    // This flag is only ever constructed here after the trusted provider
    // server-to-server lookup; it MUST NOT be copied from browser/webhook.
    p_server_verified:true
   });
   if(!validResult(v))throw Error('UNTRUSTED_LEDGER_SETTLEMENT');
   return v;
  },
  async queueReceiptOnce({orderId}){
   if(!UUID.test(orderId||''))throw Error('INVALID_ORDER_ID');
   const done=await call('queue',{p_order_id:orderId});
   if(done!==true)throw Error('RECEIPT_NOT_QUEUED');
   return true;
  },
  async reserveReceiptProof({orderId,tokenDigest}){
   if(!UUID.test(orderId||'')||!HEX64.test(tokenDigest||''))return null;
   return call('reserve',{p_order_id:orderId,p_token_digest:tokenDigest});
  },
  async finishReceiptProof({orderId,tokenDigest,issued}){
   if(!UUID.test(orderId||'')||!HEX64.test(tokenDigest||'')
     ||typeof issued!=='boolean')return false;
   return call('finish',{p_order_id:orderId,p_token_digest:tokenDigest,p_issued:issued});
  }
 });
 const delivery=Object.freeze({
  async createSignedDownload({orderId,claimDigest,receiptTokenDigest,maxSeconds}){
   if(!UUID.test(orderId||'')||!Number.isSafeInteger(maxSeconds)
     ||maxSeconds<1||maxSeconds>300
     ||Boolean(claimDigest)===Boolean(receiptTokenDigest)
     ||(claimDigest&&!HEX64.test(claimDigest))
     ||(receiptTokenDigest&&!HEX64.test(receiptTokenDigest)))
      throw Error('INVALID_DELIVERY_PROOF');
   const method=claimDigest?'can':'canReceipt';
   const permitted=await call(method,claimDigest?
    {p_order_id:orderId,p_claim_digest:claimDigest,p_kind:'private_pdf'}:
    {p_order_id:orderId,p_token_digest:receiptTokenDigest});
   if(permitted!==true)throw Error('DOWNLOAD_NOT_AUTHORIZED');
   // Fetch immutable approved filename/version only from private DB/Storage.
   // No object path is ever supplied by a browser or included in JSON output.
   const original=await db.getPrivatePdf({orderId});
   if(!original||original.active!==true||original.bucketId!==PK
     ||original.storageObjectExists!==true||original.editionApproved!==true
     ||typeof original.objectPath!=='string'||!OBJECT.test(original.objectPath)
     ||original.objectPath.includes('..')
     ||typeof original.downloadName!=='string'
     ||!/^[a-zA-Z0-9가-힣_-]+\.pdf$/.test(original.downloadName)
     ||!Number.isInteger(original.linkMaxSeconds)
     ||original.linkMaxSeconds<1)
    throw Error('PRIVATE_PDF_EDITION_NOT_APPROVED');
   const ttl=Math.min(maxSeconds,original.linkMaxSeconds,300);
   const signed=await signPrivatePdf({
    bucketId:PK,objectPath:original.objectPath,
    downloadName:original.downloadName,maxSeconds:ttl
   });
   if(!signed||typeof signed.downloadUrl!=='string')throw Error('PRIVATE_SIGNING_FAILED');
   // One more independent revocation check after signature creation.
   const stillAllowed=await call(method,claimDigest?
    {p_order_id:orderId,p_claim_digest:claimDigest,p_kind:'private_pdf'}:
    {p_order_id:orderId,p_token_digest:receiptTokenDigest});
   if(stillAllowed!==true)throw Error('DELIVERY_REVOKED_BEFORE_RELEASE');
   return {downloadUrl:signed.downloadUrl};
  }
 });
 async function prepareProgramOrder({kind,offerId,slotId,email,requestId,accepted}={}){
  if(accepted!==true||!['reading_circle','class_session'].includes(kind))
    throw Error('PROGRAM_CONSENT_REQUIRED');
  const normalized=normalizedEmail(email);
  const claimToken=await issuer.issueClaim({requestId,email:normalized,offerId,slotId});
  if(!/^[A-Za-z0-9_-]{43}$/.test(claimToken))throw Error('INVALID_PROGRAM_CLAIM');
  const claimHashBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(claimToken));
  const claimDigest=[...new Uint8Array(claimHashBytes)]
    .map(x=>x.toString(16).padStart(2,'0')).join('');
  const order=await pending({requestId,email:normalized,claimDigest,kind,offerId,slotId});
  const redirect=await provider.createCheckout(order);
  const checkoutUrl=secureCheckout(redirect?.checkoutUrl,provider.checkoutOrigins);
  return Object.freeze({
   orderId:order.id,claimToken,checkoutUrl,kind,amountWon:order.amountWon
  });
 }
 const issueClaim=async({requestId,email,productId,providerCode})=>{
  if(providerCode!==provider.code)throw Error('UNEXPECTED_PROVIDER');
  return issuer.issueClaim({requestId,email,offerId:productId,slotId:null});
 };
 return Object.freeze({catalog,store,delivery,limit,issueClaim,prepareProgramOrder,
  provider,minimumAmountWon:provider.minimumAmountWon??100});
}
