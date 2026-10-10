/**
 * Synthetic P7-C API -> parameterized psql -> REAL isolated PostgreSQL 16.
 * Provider and Storage responses remain mocked. This is NOT a server adapter:
 * psql requires local CI and no production credentials or network calls.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createServerOrderIssuer} from '../integration/nal-commerce-os/server/server-order-issuer.mjs';
import {composeCommerceApi} from '../integration/nal-commerce-os/server/compose-guest-api.mjs';

if(process.env.PGDATABASE!=='nal_ci_ledger' || process.env.PGHOST!=='127.0.0.1')
 throw Error('NOT_ISOLATED_POSTGRES_FOR_P7C');
const SITE='https://daily-coach-ing.com';
const STORAGE='https://abcdefghijklmnopqrst.supabase.co';
const PG='https://pay.example.invalid';
const approved={
 enabled:true,providerConfigured:true,ledgerReviewed:true,
 privacyNoticeApproved:true,refundGuardReviewed:true,
 emailSenderReady:true,deliveryReviewed:true,customerReleaseApproved:true
};
let assertions=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);assertions++;};
const input=(action,payload)=>new Request(STORAGE+'/functions/v1/nal-commerce-lite',{
 method:'POST',headers:{Origin:SITE,'Content-Type':'application/json'},
 body:JSON.stringify({action,...payload})
});
const reply=async r=>({status:r.status,body:await r.json()});
const SEPARATOR='__NULL__';
function psql(sql,vars={}){
 return new Promise((resolve,reject)=>{
  const args=['-X','-A','-t','-q','-v','ON_ERROR_STOP=1'];
  for(const [key,val] of Object.entries(vars)){
   if(!/^[a-z_]+$/.test(key))throw Error('ILLEGAL_SYNTHETIC_VARIABLE');
   args.push('-v',key+'='+(val===null||val===undefined?SEPARATOR:String(val)));
  }
  const processChild=spawn('psql',args,{env:process.env,stdio:['pipe','pipe','pipe']});
  let out='',err='';
  processChild.stdout.on('data',d=>{out+=d.toString()});
  processChild.stderr.on('data',d=>{err+=d.toString()});
  processChild.on('error',reject);
  processChild.on('close',code=>{
   if(code!==0)reject(Error('ISOLATED_POSTGRES_QUERY_REJECTED: '+err.slice(0,400)));
   else resolve(out.trim());
  });
  processChild.stdin.end('SET ROLE service_role;\n'+sql+'\n');
 });
}
function cast(key,type){return "NULLIF(:'"+key+"','"+SEPARATOR+"')::"+type;}
const argsByFunction={
 commerce_os_begin_order:[
  ['p_request_id','uuid'],['p_email','text'],['p_claim_digest','text'],
  ['p_offer_id','text'],['p_slot_id','uuid'],['p_provider_code','text'],
  ['p_provider_order_id','text'],['p_merchant_id','text']
 ],
 commerce_os_order_by_claim:[['p_order_id','uuid'],['p_claim_digest','text']],
 commerce_os_apply_provider:[
  ['p_order_id','uuid'],['p_provider_order_id','text'],['p_merchant_id','text'],
  ['p_payment_key','text'],['p_amount_won','integer'],['p_currency','text'],
  ['p_provider_state','text'],['p_provider_event_id','text'],['p_server_verified','boolean']
 ],
 commerce_os_queue_receipt:[['p_order_id','uuid']],
 commerce_os_reserve_receipt:[['p_order_id','uuid'],['p_token_digest','text']],
 commerce_os_finish_receipt:[['p_order_id','uuid'],['p_token_digest','text'],['p_issued','boolean']],
 commerce_os_can_deliver:[['p_order_id','uuid'],['p_claim_digest','text'],['p_kind','text']],
 commerce_os_can_receipt_deliver:[['p_order_id','uuid'],['p_token_digest','text']]
};
function parseResult(raw,kind){
 if(kind==='boolean')return raw==='t'||raw==='true';
 if(!raw||raw==='null')return null;
 try{return JSON.parse(raw);}catch{throw Error('INVALID_ISOLATED_DB_JSON');}
}
const db={
 async exec({name,args}){
  const method=name.split('.')[1];
  if(name!=='nal_private.'+method || !Object.hasOwn(argsByFunction,method))
   throw Error('UNREGISTERED_LEDGER_FUNCTION');
  const values=argsByFunction[method];
  if(Object.keys(args).length!==values.length || values.some(([n])=>!Object.hasOwn(args,n)))
   throw Error('WRONG_PRIVATE_RPC_PARAMETER_SET');
  const sql='SELECT nal_private.'+method+'('+
   values.map(([n,t])=>cast(n,t)).join(',')+')::text;';
  const raw=await psql(sql,args);
  const kind=['commerce_os_queue_receipt','commerce_os_finish_receipt',
   'commerce_os_can_deliver','commerce_os_can_receipt_deliver'].includes(method)
   ?'boolean':'json';
  return parseResult(raw,kind);
 },
 async getOffer({offerId}){
  const sql="SELECT jsonb_build_object("+
   "'id',id,'kind',kind,'title',title,'priceWon',price_won,"+
   "'currency',currency,'edition',edition,'published',published,"+
   "'saleStatus',sale_status,'policyApproved',policy_approved,"+
   "'termsApproved',terms_approved,'fileApproved',file_ready,"+
   "'privateFileReady',file_ready,'licenseType',license_type,"+
   "'hostApproved',host_approved)::text "+
   "FROM nal_private.commerce_os_offers WHERE id="+cast('offerid','text')+";";
  return parseResult(await psql(sql,{offerid:offerId}),'json');
 },
 async getSlot({slotId,offerId}){
  const sql="SELECT jsonb_build_object('id',id::text,"+
   "'startsAt',starts_at,'registrationDeadline',registration_deadline,"+
   "'published',published,'capacity',capacity,"+
   "'reserved',held_count+confirmed_count)::text "+
   "FROM nal_private.commerce_os_slots WHERE id="+cast('slotid','uuid')+
   " AND offer_id="+cast('offerid','text')+";";
  return parseResult(await psql(sql,{slotid:slotId,offerid:offerId}),'json');
 },
 async getPrivatePdf({orderId}){
  // Synthetic Storage fixture: only immutable edition is read from real PG.
  // Actual private file existence, active mapping and signing are NOT tested.
  const sql="SELECT jsonb_build_object('offerId',l.offer_id,"+
   "'orderEdition',l.edition_snapshot,'fileEdition',l.edition_snapshot)::text "+
   "FROM nal_private.commerce_os_order_lines l WHERE l.order_id="+
   cast('orderid','uuid')+" AND l.kind='pdf';";
  const row=parseResult(await psql(sql,{orderid:orderId}),'json');
  return row?{
   ...row,active:true,bucketId:'nal-products-private',
   editionApproved:true,storageObjectExists:true,
   objectPath:row.offerId+'/v7/original.pdf',
   downloadName:'nal_synthetic.pdf',linkMaxSeconds:300
  }:null;
 }
};
const issuer=await createServerOrderIssuer({
 secretBytes:Uint8Array.from({length:32},(_,i)=>i+1),
 providerCode:'testpg',merchantId:'merchant-fixture'
});
let providerStatus='READY',providerEpoch=0;
const provider={
 code:'testpg',merchantId:'merchant-fixture',checkoutOrigins:[PG],
 minimumAmountWon:100,
 async createCheckout(order){
  return {checkoutUrl:PG+'/pay/'+order.providerOrderId};
 },
 async lookupPayment(order){
  return {
   authoritative:true,source:'provider-server-lookup',
   providerCode:'testpg',merchantId:'merchant-fixture',
   orderId:order.id,providerOrderId:order.providerOrderId,
   currency:'KRW',amountWon:order.amountWon,
   paymentKey:'payment-api-'+order.id.slice(0,8),
   status:providerStatus,
   providerEventId:'api-'+order.id.slice(0,8)+'-'+providerStatus.toLowerCase()+'-'+providerEpoch
  };
 }
};
let mockStorageSignings=0;
const signPrivatePdf=async({bucketId,objectPath,maxSeconds})=>{
 mockStorageSignings++;
 assert.equal(bucketId,'nal-products-private');
 assert(maxSeconds<=300);
 return {downloadUrl:STORAGE+'/storage/v1/object/sign/'+
   bucketId+'/'+objectPath+'?token=synthetic-p7c-no-real-storage'};
};
const limit={allow:async()=>true};
const composed=composeCommerceApi({
 release:approved,db,issuer,provider,signPrivatePdf,limit,
 storageOrigin:STORAGE,allowedOrigins:[SITE]
});
eq(composed.ready,true,'composed synthetic real DB adapter');
const requestId=randomUUID();
const purchase={productId:'pdf-test',email:'CI-PAYMENT@example.invalid',accepted:true,requestId};
const first=await reply(await composed.handler(input('create',purchase)));
eq(first.status,200,'public handler order -> actual private Postgres');
eq(first.body.checkoutUrl.startsWith(PG+'/pay/nal_'),true,'mock provider checkout only');
const same=await reply(await composed.handler(input('create',purchase)));
eq(same.status,200,'same UUID server HMAC replay');
eq(same.body.orderId,first.body.orderId,'same private Postgres order');
eq(same.body.claimToken,first.body.claimToken,'same opaque buyer proof');
const wrong=await reply(await composed.handler(input('create',
 {...purchase,email:'forged@example.invalid'})));
eq(wrong.status,503,'foreign buyer cannot hijack same request ID');
const orderId=first.body.orderId,claimToken=first.body.claimToken;
const orderCheck={
 action:'status',orderId,claimToken
};
const before=await reply(await composed.handler(input('status',{orderId,claimToken})));
eq(before.body.state,'pending','provider READY stays unpaid');
providerStatus='DONE';
const paid=await reply(await composed.handler(input('status',{orderId,claimToken})));
eq(paid.status,200,'server-verified mock DONE -> actual PG settlement');
eq(paid.body.state,'paid','private DB order paid');
eq(paid.body.canDownload,true,'customer may receive mock private PDF signed link');
const signed=await reply(await composed.handler(input('download',{orderId,claimToken})));
eq(signed.status,200,'signed mock URL only after real private ledger verified');
eq(signed.body.downloadUrl.includes('/storage/v1/object/sign/nal-products-private/'),true);
eq(mockStorageSignings,1,'signer mock called after validated paid order');
const outbox=await psql("SELECT count(*)::int FROM nal_private.commerce_os_receipt_outbox WHERE order_id="+
 cast('orderid','uuid')+";",{orderid:orderId});
eq(outbox,'1','real private DB receipt outbox idempotent');
const receiptToken='Q'.repeat(43);
const claimDigestBuf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(receiptToken));
const receiptDigest=[...new Uint8Array(claimDigestBuf)]
 .map(x=>x.toString(16).padStart(2,'0')).join('');
const receiptSql='SELECT nal_private.commerce_os_issue_receipt('+
 cast('orderid','uuid')+','+cast('digest','text')+",now()+interval '45 minutes');";
eq(await psql(receiptSql,{orderid:orderId,digest:receiptDigest}),'t',
 'synthetic mail worker inserts hashed receipt proof, no actual email');
const claim=await reply(await composed.handler(input('redeem',{orderId,receiptToken})));
eq(claim.status,200,'one-time receipt real PG reservation and mock signed URL');
const double=await reply(await composed.handler(input('redeem',{orderId,receiptToken})));
eq(double.status,403,'second email proof cannot redeem');
providerStatus='CANCELED';
const refunded=await reply(await composed.handler(input('status',{orderId,claimToken})));
eq(refunded.body.state,'refunded','refund propagated to real Postgres ledger');
eq(refunded.body.canDownload,false,'revoked PDF loses access');
const blocked=await reply(await composed.handler(input('download',{orderId,claimToken})));
eq(blocked.status,403,'revoked private PDF cannot be re-signed');
providerStatus='DONE';providerEpoch++;
const late=await reply(await composed.handler(input('status',{orderId,claimToken})));
eq(late.status,503,'new stale DONE cannot restore a refunded paid record');
const finalState=await psql("SELECT status FROM nal_private.commerce_os_orders WHERE id="+
 cast('orderid','uuid')+";",{orderid:orderId});
eq(finalState,'refunded','actual private ledger remains terminal after stale DONE');
const reading=await composed.prepareProgramOrder({
 kind:'reading_circle',offerId:'read-test',
 slotId:'11111111-1111-4111-8111-111111111111',
 email:'reader-p7c@example.invalid',requestId:randomUUID(),accepted:true
});
eq(reading.kind,'reading_circle','program uses same private ledger');
eq(reading.amountWon,19000,'program price derives from actual PG private offer');
eq(reading.checkoutUrl.startsWith(PG),true,'mock PG link only');
const seats=await psql("SELECT held_count::int FROM nal_private.commerce_os_slots WHERE id="+
 cast('slotid','uuid')+";",{slotid:'11111111-1111-4111-8111-111111111111'});
eq(seats,'1','reader reservation used real row lock and allocated one seat');
await assert.rejects(composed.prepareProgramOrder({
 kind:'reading_circle',offerId:'read-test',
 slotId:'11111111-1111-4111-8111-111111111111',
 email:'overbooking@example.invalid',requestId:randomUUID(),accepted:true
}),/SESSION_FULL_OR_NOT_READY|ISOLATED_POSTGRES_QUERY_REJECTED/);
assertions++;
console.log('NAL P7-C API→isolated Postgres PASS: '+assertions+
 ' checks, durable idempotency/receipt/refund/reading seat, mock PG+Storage only, no real email');
