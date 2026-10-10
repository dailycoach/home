/**
 * NAL COMMERCE OS: provider-neutral single-merchant order policy.
 * Pure domain logic only. NEVER updates production DB, authorizes a card,
 * allocates a seat or sends a PDF. Those require atomic, reviewed adapters.
 */
export const SELLABLE_KINDS=Object.freeze(['pdf','reading_circle','class_session']);
export const ORDER_STATES=Object.freeze(['pending','paid','refund_requested','refunded','cancelled','review_required']);
const ID=/^[a-z0-9-]{1,120}$/;
const SESSION=/^[a-z0-9-]{1,120}$/;
const REVENUE_CURRENCY='KRW';
const safeInt=x=>Number.isSafeInteger(x)&&x>=0;
const fail=reason=>Object.freeze({ok:false,reason});
const freshDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const ALLOW_UNITS=new Set(['personal-use','single-participant']);

export function quoteNalItem(item,{at=Date.now(),providerMinimumWon=100}={}) {
  if(!item||typeof item!=='object'||Array.isArray(item)
    ||!SELLABLE_KINDS.includes(item.kind)||!ID.test(item.id||''))
    return fail('INVALID_ITEM');
  if(!Number.isFinite(at)||!safeInt(providerMinimumWon)||providerMinimumWon<100)
    return fail('INVALID_CHECKOUT_CONTEXT');
  if(item.published!==true||item.saleStatus!=='available'
    ||item.policyApproved!==true||item.termsApproved!==true)
    return fail('NOT_FOR_SALE');
  if(typeof item.title!=='string'||item.title.trim().length<2||item.title.length>120
    ||!safeInt(item.priceWon)||item.priceWon===0||item.priceWon<providerMinimumWon
    ||item.currency!==REVENUE_CURRENCY)
    return fail('PRICE_OR_TITLE_NOT_READY');

  const result={
    kind:item.kind,sourceId:item.id,title:item.title.trim(),quantity:1,
    unitAmountWon:item.priceWon,totalAmountWon:item.priceWon,
    currency:'KRW',version:String(item.version||'').trim(),
    sessionId:null,fulfillmentKind:null,licenseType:null,
    requiresAtomicInventory:false
  };
  if(!result.version||result.version.length>80)return fail('EDITION_NOT_APPROVED');
  if(item.kind==='pdf'){
    if(item.fileApproved!==true||item.privateFileReady!==true
      ||item.licenseType!=='personal-use')return fail('PDF_NOT_READY');
    result.fulfillmentKind='private_pdf';result.licenseType='personal-use';
  }else{
    const s=item.session;
    if(!s||!SESSION.test(s.id||'')||s.published!==true
      ||!freshDate(s.startsAt)||Date.parse(s.startsAt)<=at
      ||!freshDate(s.registrationDeadline)
      ||Date.parse(s.registrationDeadline)<at
      ||Date.parse(s.registrationDeadline)>=Date.parse(s.startsAt)
      ||!safeInt(s.capacity)||s.capacity<1||!safeInt(s.reserved)
      ||s.reserved>=s.capacity)
      return fail('SESSION_FULL_OR_NOT_READY');
    if(item.hostApproved!==true)return fail('HOST_REVIEW_REQUIRED');
    result.sessionId=s.id;
    result.requiresAtomicInventory=true;
    result.fulfillmentKind=item.kind==='reading_circle'?'reading_pass':'class_pass';
    result.licenseType='single-participant';
  }
  return Object.freeze({ok:true,quote:Object.freeze(result)});
}
export function noClientPriceOverride(serverQuote,browserInput){
  if(!serverQuote?.ok||!serverQuote.quote) return false;
  if(!browserInput||typeof browserInput!=='object'||Array.isArray(browserInput))return false;
  // Only SKU and optional session selection are allowed. No monetary amounts,
  // inventory, privileges, bucket paths, license upgrades or discounts.
  const keys=Object.keys(browserInput);
  return keys.every(k=>['id','sessionId'].includes(k))
    &&keys.includes('id')&&browserInput.id===serverQuote.quote.sourceId
    &&(serverQuote.quote.sessionId===null
       ?!keys.includes('sessionId'):browserInput.sessionId===serverQuote.quote.sessionId);
}
const providerStatuses=new Set(['READY','IN_PROGRESS','DONE','CANCELED','PARTIAL_CANCELED','EXPIRED','ABORTED']);
export function planVerifiedSettlement(order,payment){
  if(!order||typeof order!=='object'||!ORDER_STATES.includes(order.status)
    ||!SELLABLE_KINDS.includes(order.kind)||typeof order.id!=='string'||!order.id
    ||!safeInt(order.amountWon)||order.amountWon<100||order.currency!=='KRW')
    return fail('INVALID_ORDER');
  if(!payment||payment.authoritative!==true||payment.source!=='provider-server-lookup'
    ||payment.orderId!==order.id||payment.providerOrderId!==order.providerOrderId
    ||payment.merchantId!==order.merchantId||payment.currency!=='KRW'
    ||payment.amountWon!==order.amountWon
    ||!providerStatuses.has(payment.status)
    ||typeof payment.paymentKey!=='string'||!payment.paymentKey
    ||(order.paymentKey&&order.paymentKey!==payment.paymentKey))
    return fail('PAYMENT_BINDING_REJECTED');
  if(payment.status==='DONE'){
    if(['refund_requested','refunded','cancelled','review_required'].includes(order.status)
      ||order.revoked===true)return fail('NO_REGRANT_AFTER_TERMINAL');
    if(order.status==='paid')return Object.freeze({ok:true,nextStatus:'paid',effect:'none',reason:'IDEMPOTENT'});
    if(order.kind==='pdf'&&order.fileApprovedAtOrder!==true)
      return fail('FILE_EDITION_NOT_READY');
    if(order.kind!=='pdf'&&order.inventoryReservationConfirmed!==true)
      return fail('NO_ATOMIC_SEAT_RESERVATION');
    return Object.freeze({
      ok:true,nextStatus:'paid',
      effect:order.kind==='pdf'?'issue_pdf':order.kind==='reading_circle'?'issue_reading_pass':'issue_class_pass',
      reason:'VERIFIED_DONE'
    });
  }
  if(payment.status==='CANCELED'||payment.status==='PARTIAL_CANCELED'){
    if(order.status==='refunded')return Object.freeze({ok:true,nextStatus:'refunded',effect:'none',reason:'REPEAT_REFUND'});
    if(order.status==='cancelled'||order.status==='review_required')return fail('TERMINAL_CONFLICT');
    return Object.freeze({
      ok:true,
      nextStatus:payment.status==='CANCELED'?'refunded':'refund_requested',
      effect:order.status==='paid'?'revoke_entitlement_and_pass':'none',
      reason:'VERIFIED_REFUND'
    });
  }
  if(payment.status==='EXPIRED'||payment.status==='ABORTED'){
    if(order.status!=='pending')return fail('STALE_PAYMENT_EVENT');
    return Object.freeze({ok:true,nextStatus:'cancelled',effect:'release_pending_reservation',reason:'PAYMENT_EXPIRED'});
  }
  if(order.status!=='pending')return fail('NONFINAL_AFTER_SETTLEMENT');
  return Object.freeze({ok:true,nextStatus:'pending',effect:'none',reason:'PAYMENT_PENDING'});
}
export function summarizeSafeOrders(orders) {
  if(!Array.isArray(orders))return fail('INVALID_LEDGER');
  const summary={totalOrders:0,paidOrders:0,pendingOrders:0,refundReviews:0,
    paidGrossWon:0,byKind:{pdf:0,reading_circle:0,class_session:0}};
  for(const o of orders){
    if(!o||!ORDER_STATES.includes(o.status)||!SELLABLE_KINDS.includes(o.kind)
      ||!safeInt(o.amountWon))return fail('INVALID_LEDGER_ROW');
    summary.totalOrders++;
    if(o.status==='paid'){summary.paidOrders++;summary.paidGrossWon+=o.amountWon;summary.byKind[o.kind]++;}
    if(o.status==='pending')summary.pendingOrders++;
    if(o.status==='refund_requested'||o.status==='review_required')summary.refundReviews++;
    if(!Number.isSafeInteger(summary.paidGrossWon))return fail('TOTAL_OVERFLOW');
  }
  return Object.freeze({ok:true,summary:Object.freeze(summary)});
}
