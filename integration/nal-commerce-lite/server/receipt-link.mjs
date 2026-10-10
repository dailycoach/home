/**
 * NAL guest receipt link creation (SOURCE-ONLY, pure Web Crypto).
 * Caller may email the URL but must store ONLY tokenDigest, not the raw token.
 * No real email provider or database is connected here.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECEIPT_TOKEN=/^[A-Za-z0-9_-]{40,128}$/;
const ORIGIN='https://daily-coach-ing.com';
export async function hashReceiptToken(token){
  if(typeof token!=='string'||!RECEIPT_TOKEN.test(token))throw Error('INVALID_RECEIPT_TOKEN');
  const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  return [...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function mintReceiptLink({orderId,siteOrigin=ORIGIN,now=Date.now(),minutes=45}={}){
  if(!UUID.test(orderId||'')||siteOrigin!==ORIGIN
    ||!Number.isFinite(now)||!Number.isInteger(minutes)||minutes<5||minutes>60)
    throw Error('INVALID_RECEIPT_CONTEXT');
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const digest=await hashReceiptToken(token);
  const url=new URL('/nal/commerce/claim/',siteOrigin);
  // Fragments are not sent with HTTP requests, so the raw token is not in
  // CDN/request logs or page queries. Page JS must remove the fragment at once.
  url.hash=new URLSearchParams({order:orderId,token}).toString();
  return Object.freeze({url:url.href,tokenDigest:digest,expiresAt:new Date(now+minutes*60000).toISOString()});
}
