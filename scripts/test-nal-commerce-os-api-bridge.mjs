import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServerOrderIssuer} from '../integration/nal-commerce-os/server/server-order-issuer.mjs';
import {composeCommerceApi} from '../integration/nal-commerce-os/server/compose-guest-api.mjs';
import {planVerifiedSettlement} from '../integration/nal-commerce-os/order-engine.mjs';

const STORAGE='https://abcdefghijklmnopqrst.supabase.co';
const SITE='https://daily-coach-ing.com';
const PG='https://pay.example.invalid';
const NOW=Date.now();
const READ_SLOT='11111111-1111-4111-8111-111111111111';
const CLASS_SLOT='22222222-2222-4222-8222-222222222222';
const allOn={
 enabled:true,providerConfigured:true,ledgerReviewed:true,
 privacyNoticeApproved:true,refundGuardReviewed:true,
 emailSenderReady:true,deliveryReviewed:true,customerReleaseApproved:true
};
const pdf={id:'pdf-fixture',kind:'pdf',title:'합성 테스트 PDF 도서',priceWon:6900,
 currency:'KRW',edition:'v7-approved',published:true,saleStatus:'available',
 policyApproved:true,termsApproved:true,fileApproved:true,privateFileReady:true,
 licenseType:'personal-use',hostApproved:false};
const reading={...pdf,id:'read-fixture',kind:'reading_circle',priceWon:19000,
 licenseType:'single-participant',hostApproved:true};
const course={...reading,id:'class-fixture',kind:'class_session',priceWon:35000};
const approvedSessions={
 [READ_SLOT]:{id:READ_SLOT,offerId:'read-fixture',published:true,
   startsAt:new Date(NOW+3*86400000).toISOString(),
   registrationDeadline:new Date(NOW+2*86400000).toISOString(),capacity:1,reserved:0},
 [CLASS_SLOT]:{id:CLASS_SLOT,offerId:'class-fixture',published:true,
   startsAt:new Date(NOW+5*86400000).toISOString(),
   registrationDeadline:new Date(NOW+4*86400000).toISOString(),capacity:2,reserved:0}
};
const settings={
 issuerSecret:Uint8Array.from({length:32},(_,i)=>i+1),
 merchantId:'synthetic-merchant',providerCode:'testpg'
};
const stringify=x=>JSON.stringify(x);
let cases=0;
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);cases++};
const reply=async r=>({status:r.status,json:await r.json()});
const request=(payload,options={})=>new Request(STORAGE+'/functions/v1/nal-commerce-lite',{
 method:options.method||'POST',
 headers:{Origin:options.origin??SITE,'Content-Type':options.type??'application/json'},
 ...(options.method==='GET'?{}:{body:JSON.stringify(payload)})
});
const extractDigest=async token=>{
 const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return [...new Uint8Array(data)].map(x=>x.toString(16).padStart(2,'0')).join('');
};
async function build({release=allOn,lookupOverride=null,badSigner=false}={}){
 const orders=new Map(),requestIds=new Map(),events=new Map(),receipts=new Set();
 const tokens=new Map(),log=[],slots=structuredClone(approvedSessions);
 const issuer=await createServerOrderIssuer(settings);
 let status='READY';
 const provider={
  code:'testpg',merchantId:settings.merchantId,checkoutOrigins:[PG],minimumAmountWon:100,
  createCheckout:async o=>{log.push('checkout');return {checkoutUrl:PG+'/pay/'+o.providerOrderId};},
  lookupPayment:async o=>{
   log.push('provider-lookup');
   if(lookupOverride)return lookupOverride(o,status);
   return {
    authoritative:true,source:'provider-server-lookup',
    providerCode:'testpg',orderId:o.id,providerOrderId:o.providerOrderId,
    merchantId:'synthetic-merchant',amountWon:o.amountWon,currency:'KRW',
    status,paymentKey:'payment-synthetic-'+o.id.slice(0,8),
    providerEventId:'event-'+status.toLowerCase()+'-'+o.id.slice(0,8)
   };
  }
 };
 const offers=new Map([pdf,reading,course].map(o=>[o.id,{...o}]));
 const db={
  async getOffer({offerId}){log.push('read-offer');return offers.get(offerId)??null;},
  async getSlot({slotId,offerId}){
   log.push('read-slot');const s=slots[slotId];
   return s?.offerId===offerId?s:null;
  },
  async getPrivatePdf({orderId}){
   log.push('private-file');
   const o=orders.get(orderId);
   if(!o)return null;
   return {
    active:true,offerId:o.productId,orderEdition:o.fileVersion,
    fileEdition:o.fileVersion,editionApproved:true,bucketId:'nal-products-private',
    storageObjectExists:true,objectPath:o.productId+'/v7/original.pdf',
    downloadName:'nal_synthetic.pdf',linkMaxSeconds:300
   };
  },
  async exec({name,args}){
   log.push(name);
   if(!name.startsWith('nal_private.commerce_os_'))throw Error('Untrusted RPC');
   const method=name.slice('nal_private.commerce_os_'.length);
   if(method==='begin_order'){
    const id=args.p_request_id,prior=requestIds.get(id);
    if(prior){
     if(prior.email!==args.p_email||prior.claimDigest!==args.p_claim_digest
      ||prior.productId!==args.p_offer_id||prior.slotId!==args.p_slot_id
      ||prior.providerOrderId!==args.p_provider_order_id)
      throw Error('REQUEST_ID_REUSED_WITH_DIFFERENT_ORDER');
     return {orderId:prior.id,amountWon:prior.amountWon,state:prior.status,idempotent:true};
    }
    const offer=offers.get(args.p_offer_id);
    if(!offer||offer.saleStatus!=='available'||!offer.published)throw Error('OFFER_UNAVAILABLE');
    const slot=slots[args.p_slot_id];
    if(offer.kind!=='pdf'){
     if(!slot||slot.offerId!==offer.id||slot.reserved>=slot.capacity)throw Error('SESSION_FULL');
     slot.reserved++;
    }
    const orderId=randomUUID();
    const o={id:orderId,productId:offer.id,kind:offer.kind,
      slotId:args.p_slot_id,status:'pending',amountWon:offer.priceWon,currency:'KRW',
      providerCode:args.p_provider_code,providerOrderId:args.p_provider_order_id,
      merchantId:args.p_merchant_id,fileVersion:offer.edition,orderName:offer.title,
      claimDigest:args.p_claim_digest,email:args.p_email,paymentKey:null,
      revoked:false,fileApprovedAtOrder:true,
      inventoryReservationConfirmed:offer.kind!=='pdf'};
    orders.set(orderId,o);requestIds.set(id,o);
    return {orderId,amountWon:o.amountWon,state:o.status,idempotent:false};
   }
   if(method==='order_by_claim'){
    const o=orders.get(args.p_order_id);
    if(!o||o.claimDigest!==args.p_claim_digest)return null;
    const {claimDigest,email,fileApprovedAtOrder,inventoryReservationConfirmed,...safe}=o;
    return {...safe};
   }
   if(method==='apply_provider'){
    assert.equal(args.p_server_verified,true,'only trusted server bridge may set SQL verification marker');
    const o=orders.get(args.p_order_id);
    if(!o)throw Error('ORDER_UNAVAILABLE');
    if(args.p_provider_order_id!==o.providerOrderId
      ||args.p_merchant_id!==o.merchantId||args.p_amount_won!==o.amountWon
      ||args.p_currency!=='KRW')throw Error('PROVIDER_BINDING_REJECTED');
    const key=args.p_provider_event_id;
    if(events.has(key))return events.get(key);
    const next=planVerifiedSettlement(o,{
      authoritative:true,source:'provider-server-lookup',orderId:o.id,
      providerOrderId:o.providerOrderId,merchantId:o.merchantId,
      amountWon:o.amountWon,currency:'KRW',status:args.p_provider_state,
      paymentKey:args.p_payment_key
    });
    if(!next.ok)throw Error(next.reason);
    o.status=next.nextStatus;
    if(next.effect==='revoke_entitlement_and_pass')o.revoked=true;
    if(next.effect==='issue_pdf'||next.effect==='issue_reading_pass'
      ||next.effect==='issue_class_pass')o.paymentKey=args.p_payment_key;
    if(next.effect==='release_pending_reservation'&&o.slotId)slots[o.slotId].reserved--;
    const result={state:o.status,effect:next.effect,idempotent:false};
    events.set(key,result);return result;
   }
   if(method==='queue_receipt'){
    const o=orders.get(args.p_order_id);
    if(!o||o.status!=='paid'||o.revoked||o.kind!=='pdf')return false;
    receipts.add(o.id);return true;
   }
   if(method==='reserve_receipt'){
    const o=orders.get(args.p_order_id),t=tokens.get(args.p_token_digest);
    if(!o||o.status!=='paid'||o.revoked||!t||t.orderId!==o.id||t.state!=='new')return null;
    t.state='reserved';
    const {claimDigest,email,fileApprovedAtOrder,inventoryReservationConfirmed,...safe}=o;
    return safe;
   }
   if(method==='finish_receipt'){
    const t=tokens.get(args.p_token_digest);
    if(!t||t.orderId!==args.p_order_id||t.state!=='reserved')return false;
    const o=orders.get(args.p_order_id);
    if(!args.p_issued){t.state='new';return false;}
    if(o.status!=='paid'||o.revoked)return false;
    t.state='redeemed';return true;
   }
   if(method==='can_deliver'){
    const o=orders.get(args.p_order_id);
    return !!o&&o.status==='paid'&&!o.revoked&&o.kind==='pdf'
      &&o.claimDigest===args.p_claim_digest&&args.p_kind==='private_pdf';
   }
   if(method==='can_receipt_deliver'){
    const o=orders.get(args.p_order_id),t=tokens.get(args.p_token_digest);
    return !!o&&o.status==='paid'&&!o.revoked&&o.kind==='pdf'
      &&t?.state==='reserved'&&t.orderId===o.id;
   }
   throw Error('Unregistered SQL method '+method);
  }
 };
 const signPrivatePdf=async({bucketId,objectPath,downloadName,maxSeconds})=>{
  log.push('sign');
  assert.equal(bucketId,'nal-products-private');
  assert(objectPath.endsWith('original.pdf'));
  assert.equal(downloadName,'nal_synthetic.pdf');
  assert(maxSeconds<=300);
  return {downloadUrl:badSigner?'https://evil.invalid/file.pdf?token=bad':
    STORAGE+'/storage/v1/object/sign/'+bucketId+'/'+objectPath+'?token=synthetic'};
 };
 const limit={allow:async()=>{log.push('rate');return true;}};
 const api=composeCommerceApi({release,issuer,provider,db,signPrivatePdf,limit,
   storageOrigin:STORAGE,allowedOrigins:[SITE]});
 return {api,db,issuer,offers,slots,orders,requestIds,events,receipts,tokens,log,
   setStatus:v=>{status=v;},provider};
}
{
 assert.rejects(createServerOrderIssuer({...settings,issuerSecret:undefined,secretBytes:new Uint8Array(32)}));
 // A private key must be provided separately; never a fixed client/public key.
 await assert.rejects(createServerOrderIssuer({secretBytes:new Uint8Array(32),
   providerCode:'testpg',merchantId:'synthetic-merchant'}));
 cases+=2;
}
{
 const issuer=await createServerOrderIssuer({
   secretBytes:settings.issuerSecret,merchantId:settings.merchantId,providerCode:settings.providerCode
 });
 const context={requestId:randomUUID(),email:' TEST@Example.Invalid ',offerId:'pdf-fixture'};
 const a=await issuer.issueClaim(context),b=await issuer.issueClaim(context);
 eq(a,b,'identical retry must have stable proof');
 eq(a.length,43,'HMAC output 256 bit / Base64URL');
 const c=await issuer.issueClaim({...context,email:'someone-else@example.invalid'});
 assert.notEqual(a,c);cases++;
 const p=await issuer.issueProviderOrderId(context);
 assert.match(p,/^nal_[a-f0-9]{32}$/);cases++;
 assert.notEqual(p,a,'domain-separated provider identifier and buyer proof');cases++;
}
{
 const f=await build({release:{...allOn,enabled:false}});
 const r=await reply(await f.api.handler(request({
   action:'create',productId:'pdf-fixture',email:'a@example.invalid',
   accepted:true,requestId:randomUUID()
 })));
 eq(r.status,503,'release OFF must deny HTTP');
 eq(f.api.ready,false,'release OFF composer result');
 eq(f.log.length,0,'no DB reads while disabled');
}
{
 const f=await build();
 eq(f.api.ready,true,'synthetic composition available (not deployed)');
 const requestId=randomUUID(),email=' Customer@Example.Invalid ';
 const input={action:'create',productId:'pdf-fixture',email,accepted:true,requestId};
 const first=await reply(await f.api.handler(request(input)));
 eq(first.status,200,'paid PDF order assembled');
 assert.match(first.json.claimToken,/^[A-Za-z0-9_-]{43}$/);cases++;
 assert(first.json.checkoutUrl.startsWith(PG+'/pay/nal_'));cases++;
 assert(!first.json.checkoutUrl.includes(first.json.claimToken));cases++;
 const second=await reply(await f.api.handler(request(input)));
 eq(second.status,200,'idempotent rerun allowed before PG approval');
 eq(second.json.orderId,first.json.orderId,'same order');
 eq(second.json.claimToken,first.json.claimToken,'same opaque proof');
 eq(f.orders.size,1,'exactly one order');
 const forged=await reply(await f.api.handler(request({...input,email:'forged@example.invalid'})));
 eq(forged.status,503,'same request UUID different customer rejected');
 eq(f.orders.size,1,'no duplicate order after tampered retry');
 const injected=await reply(await f.api.handler(request({...input,amountWon:1})));
 eq(injected.status,400,'browser-supplied price rejected');
 const forgedOrigin=await reply(await f.api.handler(request(input,{origin:'https://evil.invalid'})));
 eq(forgedOrigin.status,403,'untrusted checkout origin denied');
 const proof={action:'status',orderId:first.json.orderId,claimToken:first.json.claimToken};
 const pending=await reply(await f.api.handler(request(proof)));
 eq(pending.json.state,'pending','provider not DONE');
 eq(pending.json.canDownload,false,'pending never signs');
 f.setStatus('DONE');
 const paid=await reply(await f.api.handler(request(proof)));
 eq(paid.json.state,'paid','verified DONE updated one private order');
 eq(paid.json.canDownload,true,'paid PDF may be delivered');
 eq(f.receipts.size,1,'one idempotent mail job scheduled');
 const down=await reply(await f.api.handler(request({...proof,action:'download'})));
 eq(down.status,200,'signed PDF issued only after verified paid');
 assert(down.json.downloadUrl.startsWith(STORAGE+'/storage/v1/object/sign/nal-products-private/'));cases++;
 eq(f.log.filter(x=>x==='sign').length,1,'one mock Storage signing call');
 const digest=await extractDigest(first.json.claimToken);
 eq(digest.length,64,'claim digest generated');
 eq([...f.orders.values()][0].claimDigest,digest,'no raw checkout proof in order table');
 f.setStatus('CANCELED');
 const refunded=await reply(await f.api.handler(request(proof)));
 eq(refunded.json.state,'refunded','provider cancellation revokes');
 eq(refunded.json.canDownload,false,'cancel cannot deliver');
 const forbidden=await reply(await f.api.handler(request({...proof,action:'download'})));
 eq(forbidden.status,403,'refund denies new signed URL');
 f.setStatus('DONE');
 const replay=await reply(await f.api.handler(request(proof)));
 eq(replay.status,503,'late DONE rejected after refund');
 eq([...f.orders.values()][0].status,'refunded','refund terminal unchanged');
}
{
 const f=await build({badSigner:true});
 const reqId=randomUUID();
 const first=await reply(await f.api.handler(request({
   action:'create',productId:'pdf-fixture',email:'buyer@example.invalid',accepted:true,requestId:reqId
 })));
 f.setStatus('DONE');
 const proof={action:'status',orderId:first.json.orderId,claimToken:first.json.claimToken};
 await f.api.handler(request(proof));
 const no=await reply(await f.api.handler(request({...proof,action:'download'})));
 eq(no.status,503,'malicious signer URL rejected by original P6 HTTP guard');
}
{
 const f=await build();
 const reqId=randomUUID();
 const first=await reply(await f.api.handler(request({
   action:'create',productId:'pdf-fixture',email:'mail@example.invalid',accepted:true,requestId:reqId
 })));
 f.setStatus('DONE');
 await f.api.handler(request({action:'status',orderId:first.json.orderId,claimToken:first.json.claimToken}));
 const receiptToken='R'.repeat(43),digest=await extractDigest(receiptToken);
 f.tokens.set(digest,{state:'new',orderId:first.json.orderId});
 const redeemed=await reply(await f.api.handler(request({
   action:'redeem',orderId:first.json.orderId,receiptToken
 })));
 eq(redeemed.status,200,'one-time email receipt gives signed PDF with verified payment');
 eq(f.tokens.get(digest).state,'redeemed','one-time claim consumed');
 const replay=await reply(await f.api.handler(request({
   action:'redeem',orderId:first.json.orderId,receiptToken
 })));
 eq(replay.status,403,'reused receipt token rejected');
}
{
 const f=await build();
 const order=await f.api.prepareProgramOrder({
  kind:'reading_circle',offerId:'read-fixture',slotId:READ_SLOT,
  email:'reader@example.invalid',requestId:randomUUID(),accepted:true
 });
 eq(order.kind,'reading_circle','reading order type');
 eq(order.amountWon,19000,'server reading price frozen');
 eq(f.slots[READ_SLOT].reserved,1,'exactly one reading seat held');
 await assert.rejects(f.api.prepareProgramOrder({
  kind:'reading_circle',offerId:'read-fixture',slotId:READ_SLOT,
  email:'second@example.invalid',requestId:randomUUID(),accepted:true
 }),/SESSION_FULL|SESSION_FULL_OR_NOT_READY/);cases++;
 const lesson=await f.api.prepareProgramOrder({
  kind:'class_session',offerId:'class-fixture',slotId:CLASS_SLOT,
  email:'student@example.invalid',requestId:randomUUID(),accepted:true
 });
 eq(lesson.kind,'class_session','class order type');
 eq(lesson.amountWon,35000,'class amount from server quote');
 await assert.rejects(f.api.prepareProgramOrder({
  kind:'class_session',offerId:'class-fixture',slotId:CLASS_SLOT,
  email:'student@example.invalid',requestId:randomUUID(),accepted:false
 }),/CONSENT/);cases++;
}
console.log('NAL P7-C guest API composition synthetic PASS: '+cases+
 ' assertions covering HMAC idempotency, PG authority, private SQL port, PDFs, refunds, email proof, capacity; no real money/DB/email');
