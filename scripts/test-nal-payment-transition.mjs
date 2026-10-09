import assert from 'node:assert/strict';
import { evaluatePaymentTransition } from '../integration/nal-stabilization-05/payment-transition-model.mjs';

const oid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const key='pk_synthetic_no_real_payment';
const base={orderId:oid,status:'pending',amount:1000,paymentKey:null,revoked:false};
const paid={...base,status:'paid',paymentKey:key};
const refunded={...paid,status:'refunded',revoked:true};
const partial={...paid,status:'refund_requested',revoked:true};
const cancelled={...paid,status:'cancelled',revoked:true};
const obs=(status='DONE',extra={})=>({
  status,verifiedByProvider:true,orderId:oid,paymentKey:key,merchantMatches:true,
  currency:'KRW',totalAmount:1000,...extra
});

const tests=[
 ['pending verified DONE grants',base,obs(), 'paid','grant','VERIFIED_SETTLEMENT'],
 ['paid duplicate DONE idempotent',paid,obs(), 'paid','none','IDEMPOTENT_DONE'],
 ['refunded followed by stale DONE never regrants',refunded,obs(), 'review_required','none','TERMINAL_OR_REVOKED_ORDER_NEVER_REGRANT'],
 ['partial refund followed by DONE never regrants',partial,obs(), 'review_required','none','TERMINAL_OR_REVOKED_ORDER_NEVER_REGRANT'],
 ['cancelled followed by stale DONE never regrants',cancelled,obs(), 'review_required','none','TERMINAL_OR_REVOKED_ORDER_NEVER_REGRANT'],
 ['paid but revoked followed by DONE', {...paid,revoked:true},obs(), 'review_required','none','TERMINAL_OR_REVOKED_ORDER_NEVER_REGRANT'],
 ['paid fully canceled must revoke',paid,obs('CANCELED'), 'refunded','revoke','VERIFIED_REFUND_OR_PARTIAL_REFUND'],
 ['paid partially canceled must revoke',paid,obs('PARTIAL_CANCELED'), 'refund_requested','revoke','VERIFIED_REFUND_OR_PARTIAL_REFUND'],
 ['refunded duplicate cancellation idempotent',refunded,obs('CANCELED'), 'refunded','none','IDEMPOTENT_REFUND'],
 ['partial followed by full cancellation',partial,obs('CANCELED'), 'refunded','none','VERIFIED_REFUND_OR_PARTIAL_REFUND'],
 ['cancelled duplicate cancellation requires manual review',cancelled,obs('CANCELED'), 'review_required','none','CANCELLED_ORDER_PROVIDER_REVIEW'],
 ['pending provider cancellation',base,obs('CANCELED'), 'refunded','none','VERIFIED_REFUND_OR_PARTIAL_REFUND'],
 ['pending partial cancellation',base,obs('PARTIAL_CANCELED'), 'refund_requested','none','VERIFIED_REFUND_OR_PARTIAL_REFUND'],
 ['pending expired',base,obs('EXPIRED'), 'cancelled','none','UNPAID_EXPIRATION'],
 ['pending aborted',base,obs('ABORTED'), 'cancelled','none','UNPAID_EXPIRATION'],
 ['paid expired later',paid,obs('EXPIRED'), 'review_required','none','LATE_ABORT_OR_EXPIRY_REVIEW'],
 ['paid aborted later',paid,obs('ABORTED'), 'review_required','none','LATE_ABORT_OR_EXPIRY_REVIEW'],
 ['pending ready',base,obs('READY'), 'pending','none','PENDING_PROVIDER_STATE'],
 ['pending in progress',base,obs('IN_PROGRESS'), 'pending','none','PENDING_PROVIDER_STATE'],
 ['paid goes to ready after settlement',paid,obs('READY'), 'review_required','none','NONFINAL_PROVIDER_AFTER_SETTLEMENT'],
 ['partial goes to ready',partial,obs('READY'), 'review_required','none','NONFINAL_PROVIDER_AFTER_SETTLEMENT'],
 ['missing verifiedByProvider',base,obs('DONE',{verifiedByProvider:false}), 'review_required','none','PROVIDER_BINDING_REQUIRED'],
 ['wrong order',base,obs('DONE',{orderId:'forged'}), 'review_required','none','PROVIDER_BINDING_REQUIRED'],
 ['wrong amount',base,obs('DONE',{totalAmount:900}), 'review_required','none','PROVIDER_BINDING_REQUIRED'],
 ['wrong currency',base,obs('DONE',{currency:'USD'}), 'review_required','none','PROVIDER_BINDING_REQUIRED'],
 ['wrong merchant',base,obs('DONE',{merchantMatches:false}), 'review_required','none','PROVIDER_BINDING_REQUIRED'],
 ['missing paymentKey',base,obs('DONE',{paymentKey:''}), 'review_required','none','PROVIDER_BINDING_REQUIRED'],
 ['paid different paymentKey',paid,obs('DONE',{paymentKey:'pk_other'}), 'review_required','none','PAYMENT_KEY_MISMATCH'],
 ['refunded different paymentKey',refunded,obs('DONE',{paymentKey:'pk_other'}), 'review_required','none','PAYMENT_KEY_MISMATCH'],
 ['invalid order state',{...base,status:'unknown'},obs(), 'review_required','none','INVALID_STATE'],
 ['invalid provider state',base,obs('UNEXPECTED'), 'review_required','none','INVALID_STATE'],
 ['invalid order amount',{...base,amount:0},obs('DONE',{totalAmount:0}), 'review_required','none','PROVIDER_BINDING_REQUIRED'],
 ['provider totalAmount is string',base,obs('DONE',{totalAmount:'1000'}), 'review_required','none','PROVIDER_BINDING_REQUIRED'],
 ['pending missing orderId',{...base,orderId:''},obs(), 'review_required','none','INVALID_STATE']
];
for(const [name,previous,provider,status,effect,reason] of tests) {
 const before=JSON.stringify(previous);
 const result=evaluatePaymentTransition(previous,provider);
 assert.deepEqual(result,{status,effect,reason},name);
 assert.equal(JSON.stringify(previous),before,'state model may not mutate previous order: '+name);
 assert(!('entitlementId' in result)&&!('storagePath' in result),'no storage or entitlement changes in synthetic model');
}

const sequences=[
 [
  ['DONE','paid','grant'],['CANCELED','refunded','revoke'],['DONE','review_required','none']
 ],
 [
  ['DONE','paid','grant'],['PARTIAL_CANCELED','refund_requested','revoke'],['DONE','review_required','none']
 ]
];
for(const seq of sequences) {
 let state={...base};
 for(const [providerStatus,expectedState,effect] of seq) {
  const result=evaluatePaymentTransition(state,obs(providerStatus));
  assert.equal(result.status,expectedState);
  assert.equal(result.effect,effect);
  if(result.status!=='review_required')state={...state,status:result.status,
    paymentKey:key,revoked:state.revoked||result.effect==='revoke'};
  if(state.revoked)assert.notEqual(result.effect,'grant','no entitlement regrant after any refund');
 }
}
console.log('NAL payment transition model PASS: '+tests.length+' isolated cases, '+sequences.length+' refund/replay sequences; no provider, DB or payment calls');
