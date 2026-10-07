import {createTossProvider,processReadPayment} from './nal-read-toss.mjs';
export function paymentConfig(env){
 const base=env.get('SUPABASE_URL')||'',publicKey=env.get('SUPABASE_ANON_KEY')||'',serviceKey=env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const clientKey=env.get('NAL_READ_TOSS_CLIENT_KEY')||'',secretKey=env.get('NAL_READ_TOSS_SECRET_KEY')||'',merchantId=env.get('NAL_READ_TOSS_MID')||'';
 const mode=env.get('NAL_READ_TOSS_MODE')||'test';
 const ready=/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(base)&&!!publicKey&&!!serviceKey&&['test','live'].includes(mode)
  &&clientKey.startsWith(mode+'_ck_')&&secretKey.startsWith(mode+'_sk_')&&!!merchantId;
 return {base,publicKey,serviceKey,clientKey,secretKey,merchantId,mode,
  enabled:ready&&env.get('NAL_READ_PAYMENTS_ENABLED')==='true',
  checkoutEnabled:ready&&env.get('NAL_READ_CHECKOUT_ENABLED')==='true'&&env.get('NAL_READ_ENABLED')==='true',
  // BUILD08: actual refunds are executed in the merchant console, not NAL.
  // A previously configured NAL_READ_REFUNDS_ENABLED flag cannot re-enable them.
  refundsEnabled:false,
  origins:(env.get('NAL_ALLOWED_ORIGINS')||'https://daily-coach-ing.com').split(',').map(x=>x.trim()).filter(Boolean)};
}
export function paymentRuntime(cfg){
 const processor=async(action,payload)=>{
  const r=await fetch(cfg.base+'/rest/v1/rpc/nal_read_payment_processor',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{apikey:cfg.serviceKey,Authorization:'Bearer '+cfg.serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_payload:payload})});
  const value=await r.json().catch(()=>null);if(!r.ok){const e=new Error('Payment processing unavailable');e.code=value?.code;throw e;}return value;
 };
 return {processor,process:orderId=>processReadPayment({orderId,processor,provider:createTossProvider({secretKey:cfg.secretKey}),
  mode:cfg.mode,merchantId:cfg.merchantId,refundsEnabled:false})};
}
