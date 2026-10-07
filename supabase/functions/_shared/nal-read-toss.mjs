// Fixed official provider host. Response projection excludes card/account/customer data.
const STATES=new Set(['READY','IN_PROGRESS','DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED']);
export class PaymentError extends Error{constructor(code,status=503){super(code);this.code=code;this.status=status;}}
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export function normalizePayment(raw,order){
 if(!raw||raw.orderId!==order.providerOrderId||raw.mId!==order.merchantId||raw.currency!=='KRW'
  ||!Number.isInteger(raw.totalAmount)||raw.totalAmount!==order.amount||!Number.isInteger(raw.balanceAmount)
  ||raw.balanceAmount<0||raw.balanceAmount>raw.totalAmount||!STATES.has(raw.status)
  ||typeof raw.paymentKey!=='string'||!raw.paymentKey||raw.paymentKey.length>200
  ||(order.paymentKey&&raw.paymentKey!==order.paymentKey))throw new PaymentError('PAYMENT_BINDING_REVIEW',409);
 if(raw.approvedAt!=null&&!date(raw.approvedAt))throw new PaymentError('PAYMENT_DATE_REVIEW',409);
 if(['DONE','PARTIAL_CANCELED'].includes(raw.status)&&!date(raw.approvedAt))throw new PaymentError('PAYMENT_STATE_REVIEW',409);
 if(raw.approvedAt&&!['카드','간편결제'].includes(raw.method))throw new PaymentError('UNSUPPORTED_METHOD_REVIEW',409);
 if(raw.cancels!=null&&!Array.isArray(raw.cancels))throw new PaymentError('PAYMENT_CANCEL_REVIEW',409);
 if((raw.cancels||[]).length>1000)throw new PaymentError('PAYMENT_CANCEL_REVIEW',409);
 const cancels=(raw.cancels||[]).map(c=>{
  if(!Number.isInteger(c.cancelAmount)||c.cancelAmount<=0||typeof c.transactionKey!=='string'||c.transactionKey.length>200
   ||!date(c.canceledAt)||c.cancelStatus!=='DONE')throw new PaymentError('PAYMENT_CANCEL_REVIEW',409);
  return {cancelAmount:c.cancelAmount,transactionKey:c.transactionKey,cancelStatus:c.cancelStatus,canceledAt:c.canceledAt};
 });
 if(raw.approvedAt&&raw.totalAmount-raw.balanceAmount!==cancels.reduce((n,c)=>n+c.cancelAmount,0))throw new PaymentError('PAYMENT_BALANCE_REVIEW',409);
 return {orderId:raw.orderId,paymentKey:raw.paymentKey,mId:raw.mId,currency:'KRW',totalAmount:raw.totalAmount,
  balanceAmount:raw.balanceAmount,status:raw.status,approvedAt:raw.approvedAt??null,
  lastTransactionKey:typeof raw.lastTransactionKey==='string'?raw.lastTransactionKey:null,cancels};
}
export function createTossProvider({secretKey,fetcher=fetch}){
 if(!/^(test|live)_sk_/.test(secretKey||''))throw new PaymentError('PAYMENT_CONFIGURATION_UNAVAILABLE');
 const auth='Basic '+btoa(secretKey+':');
 async function api(path,{body,key}={}){
  const response=await fetcher('https://api.tosspayments.com'+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{Authorization:auth,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>null);
  if(!response.ok){if(response.status===404&&['NOT_FOUND_PAYMENT','NOT_FOUND'].includes(result?.code))throw new PaymentError('NOT_FOUND_PAYMENT',404);
   throw new PaymentError('PROVIDER_'+(typeof result?.code==='string'?result.code.replace(/[^A-Z0-9_]/g,'').slice(0,60):response.status));}
  return result;
 }
 return {
  getByOrder:id=>api('/v1/payments/orders/'+encodeURIComponent(id)),
  confirm:order=>api('/v1/payments/confirm',{key:order.confirmKey,body:{orderId:order.providerOrderId,paymentKey:order.paymentKey,amount:order.amount}}),
  cancel:(order,refund)=>api('/v1/payments/'+encodeURIComponent(order.paymentKey)+'/cancel',{
   key:refund.key,body:{cancelAmount:refund.amount,cancelReason:refund.reason}})
 };
}
export async function processReadPayment({orderId,processor,provider,mode,merchantId,refundsEnabled}){
 const order=await processor('lease',{orderId});if(order.busy)return {pending:true};
 const context={orderId,lease:order.lease};
 try{
  if(order.mode!==mode||order.merchantId!==merchantId)throw new PaymentError('PAYMENT_MODE_REVIEW',409);
  let payment;
  try{payment=normalizePayment(await provider.getByOrder(order.providerOrderId),order);}
  catch(e){if(e.code==='NOT_FOUND_PAYMENT'){await processor('no-payment',context);return {pending:true};}throw e;}
  if(payment.status==='IN_PROGRESS'&&order.confirmStartedAt){
   if(Date.now()-Date.parse(order.confirmStartedAt)>14*86400000)throw new PaymentError('CONFIRM_REVIEW_REQUIRED',409);
   let failure=null;
   try{await provider.confirm({...order,paymentKey:payment.paymentKey});}catch(e){failure=e;}
   payment=normalizePayment(await provider.getByOrder(order.providerOrderId),{...order,paymentKey:payment.paymentKey});
   if(failure&&payment.status!=='DONE'&&!['CANCELED','PARTIAL_CANCELED'].includes(payment.status))throw failure;
  }
  let refundTransactionKey=null,refundId=null;
  if(order.refund&&refundsEnabled){
   const refund=order.refund,currentRefunded=payment.totalAmount-payment.balanceAmount;
   if(currentRefunded!==refund.baseRefunded||refund.amount>payment.balanceAmount||!['DONE','PARTIAL_CANCELED'].includes(payment.status)){
    await processor('apply',{...context,payment,refundReviewId:refund.id});
    return {recorded:true,review:'REFUND_EXTERNAL_CHANGE_REVIEW'};
   }
   const canceled=normalizePayment(await provider.cancel({...order,paymentKey:payment.paymentKey},refund),{...order,paymentKey:payment.paymentKey});
   const txn=canceled.cancels.find(x=>x.transactionKey===canceled.lastTransactionKey&&x.cancelAmount===refund.amount);
   if(!txn)throw new PaymentError('REFUND_TRANSACTION_REVIEW',409);
   refundId=refund.id;refundTransactionKey=txn.transactionKey;
   payment=normalizePayment(await provider.getByOrder(order.providerOrderId),{...order,paymentKey:payment.paymentKey});
  }
  await processor('apply',{...context,payment,...(refundId?{refundId,refundTransactionKey}:{})});
  return {recorded:true};
 }catch(error){
  try{await processor('fail',{...context,code:typeof error.code==='string'?error.code:'PAYMENT_RETRY_REQUIRED'});}catch{}
  throw error;
 }
}
