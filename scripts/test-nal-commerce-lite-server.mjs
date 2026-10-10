import assert from 'node:assert/strict';
import { createCommerceLiteHandler } from '../integration/nal-commerce-lite/server/commerce-handler.mjs';
import { evaluatePaymentTransition } from '../integration/nal-stabilization-05/payment-transition-model.mjs';
import { mintReceiptLink,hashReceiptToken } from '../integration/nal-commerce-lite/server/receipt-link.mjs';

const ORIGIN='https://daily-coach-ing.com';
const STORAGE='https://abcdefghijklmnopqrst.supabase.co';
const PAYMENT_ORIGIN='https://pay.example.invalid';
const ORDER='11111111-1111-4111-8111-111111111111';
const REQUEST=crypto.randomUUID();
const RECIPIENT='someone@example.invalid';
const ID='dailycoaching-awareness-1000';
const release={enabled:true,providerConfigured:true,ledgerReviewed:true,privacyNoticeApproved:true,
  refundGuardReviewed:true,emailSenderReady:true,deliveryReviewed:true,customerReleaseApproved:true};
const LIVE={id:ID,title:'반응에서 선택으로',version:'7-approved',price:1000,
  published:true,stockStatus:'available',deliveryType:'digital',
  editionApproved:true,privateFileReady:true,policyApproved:true};
const tokenURL=STORAGE+'/storage/v1/object/sign/nal-products-private/'+ID+'/v7/original.pdf?token=synthetic';
const counts=()=>({catalog:0,create:0,checkout:0,lookup:0,read:0,settle:0,emails:0,sign:0,reserve:0,finish:0,rate:0});
const copy=x=>JSON.parse(JSON.stringify(x));
const req=(payload,options={})=>new Request(ORIGIN+'/functions/v1/nal-commerce-lite',{
  method:options.method||'POST',
  headers:{Origin:options.origin??ORIGIN,'Content-Type':options.contentType??'application/json'},
  ...(options.method==='GET'?{}:{body:options.raw??JSON.stringify(payload)})
});
const body=async res=>({status:res.status,json:await res.json()});
function fixture(overrides={}) {
  const stats=counts();
  let current=null,mailSent=false,paidState='READY',tokenHash=null,tokenUsed=false,reserved=false;
  const pending=()=>current;
  const provider={
    code:'sandbox-pg',checkoutOrigins:[PAYMENT_ORIGIN],
    createCheckout:async()=>{stats.checkout++;return {checkoutUrl:PAYMENT_ORIGIN+'/checkout/'+ORDER};},
    lookupPayment:async(order)=>{
      stats.lookup++;
      return {authoritative:true,source:'provider-server-lookup',providerCode:'sandbox-pg',
        orderId:order.id,providerOrderId:order.providerOrderId,merchantId:order.merchantId,
        amountWon:order.amountWon,currency:'KRW',paymentKey:'synthetic-payment',status:paidState};
    }
  };
  const store={
    createPending:async({requestId,email,claimDigest,providerCode,product})=>{
      stats.create++;
      if(requestId!==REQUEST||email!==RECIPIENT||!claimDigest||providerCode!=='sandbox-pg')throw Error('invalid create fixture');
      current={id:ORDER,productId:product.id,amountWon:product.price,fileVersion:product.version,
        currency:'KRW',providerCode:'sandbox-pg',providerOrderId:'sandbox-'+ORDER,
        merchantId:'synthetic-merchant',paymentKey:null,status:'pending',
        revoked:false,claimDigest,email};
      return current;
    },
    findByClaim:async({orderId,claimDigest})=>{
      stats.read++;
      return current&&current.id===orderId&&current.claimDigest===claimDigest?current:null;
    },
    applyProviderResult:async({orderId,verifiedPayment})=>{
      stats.settle++;
      if(!current||orderId!==current.id)throw Error('missing order');
      const next=evaluatePaymentTransition({
        orderId:current.id,status:current.status,amount:current.amountWon,
        paymentKey:current.paymentKey,revoked:current.revoked
      },{
        status:verifiedPayment.status,
        verifiedByProvider:verifiedPayment.authoritative,
        merchantMatches:verifiedPayment.merchantId===current.merchantId,
        orderId:verifiedPayment.orderId,currency:verifiedPayment.currency,
        totalAmount:verifiedPayment.amountWon,paymentKey:verifiedPayment.paymentKey
      });
      if(next.status!=='review_required'){
        current.status=next.status;
        current.revoked ||= next.effect==='revoke';
        if(next.effect==='grant')current.paymentKey=verifiedPayment.paymentKey;
      }
      return {state:next.status};
    },
    queueReceiptOnce:async({orderId})=>{
      assert.equal(orderId,ORDER);
      if(!mailSent){mailSent=true;stats.emails++;}
      return true;
    },
    reserveReceiptProof:async({orderId,tokenDigest})=>{
      stats.reserve++;
      if(!current||orderId!==current.id||current.status!=='paid'
        ||current.revoked||tokenUsed||reserved||tokenDigest!==tokenHash)return null;
      reserved=true;return current;
    },
    finishReceiptProof:async({orderId,tokenDigest,issued})=>{
      stats.finish++;
      if(orderId!==current?.id||tokenDigest!==tokenHash||!reserved)return false;
      reserved=false;if(issued)tokenUsed=true;
      return true;
    }
  };
  const catalog={findPaidProduct:async(id)=>{stats.catalog++;return id===ID?LIVE:null;}};
  const delivery={createSignedDownload:async({orderId,claimDigest,receiptTokenDigest,maxSeconds})=>{
    stats.sign++;
    if(orderId!==ORDER||maxSeconds!==300||current?.status!=='paid'||current.revoked)throw Error('cannot sign');
    if(!claimDigest&&!receiptTokenDigest)throw Error('no guest or email proof');
    if(receiptTokenDigest&&!reserved)throw Error('receipt not reserved');
    return {downloadUrl:tokenURL};
  }};
  const limit={allow:async()=>{stats.rate++;return true;}};
  const deps={release,allowedOrigins:[ORIGIN],minimumAmountWon:100,
    provider,store,catalog,delivery,limit,storageOrigin:STORAGE,...overrides};
  return {
    handler:createCommerceLiteHandler(deps),stats,
    setProviderState:(v)=>{paidState=v;},
    setReceiptDigest:(v)=>{tokenHash=v;},
    order:pending,provider,store,catalog,delivery,deps
  };
}
let cases=0;
const expect=async(handler,payload,expectedStatus,expectedError,options)=>{
  const res=await body(await handler(req(payload,options)));
  assert.equal(res.status,expectedStatus,JSON.stringify({payload,res}));
  if(expectedError)assert.equal(res.json.error,expectedError);
  cases++;return res.json;
};
const create={action:'create',productId:ID,email:' Someone@Example.Invalid ',accepted:true,requestId:REQUEST};

{
 const f=fixture({release:{...release,enabled:false}});
 await expect(f.handler,create,503,'COMMERCE_NOT_ENABLED');
 assert.deepEqual(f.stats,counts(),'release OFF cannot even parse a buyer email or touch a DB port');
}
for(const key of Object.keys(release)){
  const f=fixture({release:{...release,[key]:false}});
  await expect(f.handler,create,503,'COMMERCE_NOT_ENABLED');
  assert.equal(f.stats.create,0);
}
{
 const f=fixture({provider:null});
 await expect(f.handler,create,503,'COMMERCE_NOT_ENABLED');
}
{
 const f=fixture();
 await expect(f.handler,create,403,'ORIGIN_DENIED',{origin:'https://evil.invalid'});
 await expect(f.handler,create,405,'POST_REQUIRED',{method:'GET'});
 await expect(f.handler,create,415,'JSON_REQUIRED',{contentType:'text/plain'});
 assert.equal(f.stats.create,0);
}
for (const [name,invalid] of [
 ['missing email',{...create,email:''}],
 ['invalid domain',{...create,email:'a@example'}],
 ['accepted string',{...create,accepted:'true'}],
 ['accepted false',{...create,accepted:false}],
 ['product id invalid',{...create,productId:'INVALID'}],
 ['request id invalid',{...create,requestId:'bad'}],
 ['user price injected',{...create,price:1}],
 ['user role injected',{...create,role:'admin'}],
 ['body action mismatch',{...create,action:'confirm'}],
]) {
 const f=fixture();
 await expect(f.handler,invalid,400,name==='body action mismatch'?'INVALID_ACTION':'INVALID_ORDER_INPUT');
 assert.equal(f.stats.create,0,name);
}
{
 const f=fixture({catalog:{findPaidProduct:async()=>({...LIVE,stockStatus:'comingSoon'})}});
 await expect(f.handler,create,409,'PRODUCT_NOT_FOR_SALE');
 assert.equal(f.stats.create,0);
}
{
 const f=fixture({catalog:{findPaidProduct:async()=>({...LIVE,price:0})}});
 await expect(f.handler,create,409,'PRODUCT_NOT_FOR_SALE');
}
{
 const f=fixture({catalog:{findPaidProduct:async()=>({...LIVE,editionApproved:false})}});
 await expect(f.handler,create,409,'PRODUCT_NOT_FOR_SALE');
}
{
 const f=fixture({provider:{...fixture().provider,createCheckout:async()=>({checkoutUrl:'https://evil.invalid/pay'})}});
 await expect(f.handler,create,503,'CHECKOUT_NOT_READY');
}
{
 const f=fixture({provider:{...fixture().provider,createCheckout:async()=>({checkoutUrl:PAYMENT_ORIGIN+'/pay/#claim=leaked'})}});
 await expect(f.handler,create,503,'CHECKOUT_NOT_READY');
}
{
 const f=fixture();
 const created=await expect(f.handler,create,200);
 assert.equal(created.orderId,ORDER);assert(created.checkoutUrl.startsWith(PAYMENT_ORIGIN));
 assert(/^[A-Za-z0-9_-]{40,128}$/.test(created.claimToken));
 assert(!JSON.stringify(created).includes(RECIPIENT),'email not returned');
 assert(!created.checkoutUrl.includes(created.claimToken),'checkout proof not sent to provider');
 assert.equal(f.order().amountWon,1000,'server product price is authoritative');
 await expect(f.handler,{action:'status',orderId:ORDER,claimToken:'wrong'},400,'INVALID_PROOF');
 await expect(f.handler,{action:'status',orderId:ORDER,claimToken:'X'.repeat(43)},403,'ORDER_NOT_ACCESSIBLE');
 let status=await expect(f.handler,{action:'status',orderId:ORDER,claimToken:created.claimToken},200);
 assert.deepEqual(status,{state:'pending',canDownload:false});
 f.setProviderState('DONE');
 status=await expect(f.handler,{action:'status',orderId:ORDER,claimToken:created.claimToken},200);
 assert.deepEqual(status,{state:'paid',canDownload:true});
 assert.equal(f.stats.emails,1,'receipt job only once');
 await expect(f.handler,{action:'status',orderId:ORDER,claimToken:created.claimToken},200);
 assert.equal(f.stats.emails,1,'duplicate paid callback cannot double-send');
 const result=await expect(f.handler,{action:'download',orderId:ORDER,claimToken:created.claimToken},200);
 assert.equal(result.downloadUrl,tokenURL);
 f.setProviderState('CANCELED');
 const cancelled=await expect(f.handler,{action:'status',orderId:ORDER,claimToken:created.claimToken},200);
 assert.deepEqual(cancelled,{state:'refunded',canDownload:false});
 await expect(f.handler,{action:'download',orderId:ORDER,claimToken:created.claimToken},403,'DOWNLOAD_NOT_AUTHORIZED');
 f.setProviderState('DONE'); // late / replayed payment DONE must not revive.
 const replay=await expect(f.handler,{action:'status',orderId:ORDER,claimToken:created.claimToken},200);
 assert.deepEqual(replay,{state:'review_required',canDownload:false});
 assert.equal(f.order().status,'refunded');
 assert.equal(f.order().revoked,true);
}
{
 const f=fixture();
 const created=await expect(f.handler,create,200);
 f.setProviderState('DONE');
 const receipt=await mintReceiptLink({orderId:ORDER});
 f.setReceiptDigest(receipt.tokenDigest);
 assert(!new URL(receipt.url).searchParams.has('token'),'email token only in URL fragment');
 const fragment=new URLSearchParams(new URL(receipt.url).hash.slice(1));
 const token=fragment.get('token');
 assert.equal(await hashReceiptToken(token),receipt.tokenDigest);
 await expect(f.handler,{action:'redeem',orderId:ORDER,receiptToken:'A'.repeat(43)},403,'RECEIPT_NOT_VALID');
 await expect(f.handler,{action:'redeem',orderId:ORDER,receiptToken:token},403,'RECEIPT_NOT_VALID'); // no verified paid ledger yet
 const settled=await expect(f.handler,{action:'status',orderId:ORDER,claimToken:created.claimToken},200);
 assert.equal(settled.state,'paid');
 const signed=await expect(f.handler,{action:'redeem',orderId:ORDER,receiptToken:token},200);
 assert.equal(signed.downloadUrl,tokenURL);
 assert.equal(f.stats.finish,1);
 await expect(f.handler,{action:'redeem',orderId:ORDER,receiptToken:token},403,'RECEIPT_NOT_VALID');
}
{
 const f=fixture();
 const created=await expect(f.handler,create,200);
 f.setProviderState('DONE');
 await expect(f.handler,{action:'status',orderId:ORDER,claimToken:created.claimToken},200);
 const faulty=fixture({delivery:{createSignedDownload:async()=>({downloadUrl:'https://evil.invalid/file.pdf?token=bad'})}});
 const made=await expect(faulty.handler,create,200);
 faulty.setProviderState('DONE');
 await expect(faulty.handler,{action:'status',orderId:ORDER,claimToken:made.claimToken},200);
 await expect(faulty.handler,{action:'download',orderId:ORDER,claimToken:made.claimToken},503,'DELIVERY_NOT_READY');
}
{
 const f=fixture({limit:{allow:async()=>false}});
 await expect(f.handler,create,429,'TRY_LATER');
}
{
 const f=fixture();
 const made=await expect(f.handler,create,200);
 f.setProviderState('DONE');
 await expect(f.handler,{action:'status',orderId:ORDER,claimToken:made.claimToken},200);
 f.setProviderState('PARTIAL_CANCELED');
 const refund=await expect(f.handler,{action:'status',orderId:ORDER,claimToken:made.claimToken},200);
 assert.equal(refund.state,'refund_requested');
 await expect(f.handler,{action:'download',orderId:ORDER,claimToken:made.claimToken},403,'DOWNLOAD_NOT_AUTHORIZED');
}
console.log('NAL COMMERCE LITE server synthetic PASS: '+cases+' cases, no real PG, database, Auth or email calls');
