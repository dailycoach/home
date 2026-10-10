/**
 * Server-only deterministic credentials for NAL P7-C order idempotency.
 * This is NOT a browser library, Edge entrypoint, connected PG or mail worker.
 * A future approved deployment must obtain its private key from a managed
 * secret store; never ship it in JS assets, logs, URLs, or source control.
 *
 * Domain separation prevents provider IDs and buyer claim tokens from
 * being interchangeable. Identical valid retries yield the same claim digest.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[a-z0-9-]{1,120}$/;
const EMAIL=/^[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,180}\.[A-Z]{2,30}$/i;
const b64url=bytes=>btoa(String.fromCharCode(...bytes))
  .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const hex=bytes=>[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
const normEmail=value=>typeof value==='string'?value.trim().toLowerCase():'';
const norm=x=>typeof x==='string'?x.trim():'';
export async function createServerOrderIssuer({secretBytes,merchantId,providerCode}={}) {
  if(!(secretBytes instanceof Uint8Array)||secretBytes.byteLength<32
    ||secretBytes.every(v=>v===secretBytes[0])
    ||typeof merchantId!=='string'||merchantId.length<1||merchantId.length>200
    ||!ID.test(providerCode||''))
    throw Error('MISSING_SERVER_ONLY_ORDER_SECRET');
  const key=await crypto.subtle.importKey('raw',secretBytes,
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=async(parts)=>{
    const message=new TextEncoder().encode(parts.join('\u001F'));
    return new Uint8Array(await crypto.subtle.sign('HMAC',key,message));
  };
  const validate=({requestId,email,offerId,slotId=null})=>{
    const e=normEmail(email);
    if(!UUID.test(requestId||'')||!EMAIL.test(e)||!ID.test(offerId||'')
      ||(slotId!==null&&!UUID.test(slotId)))throw Error('INVALID_ORDER_ISSUER_CONTEXT');
    return {e,slot:slotId??'none'};
  };
  const makeClaim=async({requestId,email,offerId,slotId=null})=>{
    const {e,slot}=validate({requestId,email,offerId,slotId});
    return b64url(await signed(['nal','guest','proof','v1',providerCode,merchantId,
      requestId.toLowerCase(),e,offerId,slot]));
  };
  const makeProviderOrderId=async({requestId,email,offerId,slotId=null})=>{
    const {e,slot}=validate({requestId,email,offerId,slotId});
    const raw=await signed(['nal','provider','order','v1',providerCode,merchantId,
      requestId.toLowerCase(),e,offerId,slot]);
    return 'nal_'+hex(raw).slice(0,32);
  };
  return Object.freeze({
    issueClaim:makeClaim,
    issueProviderOrderId:makeProviderOrderId,
    providerCode,merchantId
  });
}
