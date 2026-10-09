/**
 * Review-only state transition model for NAL PDF commerce.
 *
 * NOT imported by Supabase, NOT a deployed payment handler, NOT a provider
 * adapter. Tests the desired monotonic refund/entitlement invariant before
 * a separately approved Postgres patch is created and integrated.
 */
const validOrderStates=new Set(['pending','paid','refund_requested','refunded','cancelled']);
const validProviderStates=new Set(['READY','IN_PROGRESS','DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED']);
const terminalStates=new Set(['refund_requested','refunded','cancelled']);
const deny=(reason)=>Object.freeze({status:'review_required',effect:'none',reason});

export function evaluatePaymentTransition(previous,observation) {
  if (!previous || !validOrderStates.has(previous.status) ||
      typeof previous.orderId!=='string'||!previous.orderId ||
      !observation || !validProviderStates.has(observation.status)) return deny('INVALID_STATE');

  if(observation.verifiedByProvider!==true || observation.orderId!==previous.orderId ||
     observation.currency!=='KRW' || observation.merchantMatches!==true ||
     !Number.isInteger(previous.amount) || previous.amount<100 ||
     observation.totalAmount!==previous.amount ||
     typeof observation.paymentKey!=='string'||!observation.paymentKey) return deny('PROVIDER_BINDING_REQUIRED');

  if(previous.paymentKey && previous.paymentKey!==observation.paymentKey)
    return deny('PAYMENT_KEY_MISMATCH');

  if(observation.status==='DONE') {
    if(terminalStates.has(previous.status) || previous.revoked===true)
      return deny('TERMINAL_OR_REVOKED_ORDER_NEVER_REGRANT');
    if(previous.status==='paid')return Object.freeze({status:'paid',effect:'none',reason:'IDEMPOTENT_DONE'});
    return Object.freeze({status:'paid',effect:'grant',reason:'VERIFIED_SETTLEMENT'});
  }
  if(observation.status==='CANCELED'||observation.status==='PARTIAL_CANCELED') {
    if(previous.status==='refunded') return Object.freeze({status:'refunded',effect:'none',reason:'IDEMPOTENT_REFUND'});
    if(previous.status==='cancelled')return deny('CANCELLED_ORDER_PROVIDER_REVIEW');
    return Object.freeze({
      status:observation.status==='CANCELED'?'refunded':'refund_requested',
      effect:previous.status==='paid'?'revoke':'none',
      reason:'VERIFIED_REFUND_OR_PARTIAL_REFUND'
    });
  }
  if(observation.status==='ABORTED'||observation.status==='EXPIRED'){
    if(previous.status==='pending')return Object.freeze({status:'cancelled',effect:'none',reason:'UNPAID_EXPIRATION'});
    return deny('LATE_ABORT_OR_EXPIRY_REVIEW');
  }
  if(previous.status==='paid'||terminalStates.has(previous.status))return deny('NONFINAL_PROVIDER_AFTER_SETTLEMENT');
  return Object.freeze({status:previous.status,effect:'none',reason:'PENDING_PROVIDER_STATE'});
}
