/**
 * NAL P7-D server-only receipt/pass URL minting. NOT an email sender,
 * a public program pass route or an authorization authority.
 * Database must validate a paid/nonrevoked entitlement when saving digest.
 */
import {mintReceiptLink} from '../../nal-commerce-lite/server/receipt-link.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS=new Set(['reading_pass','class_pass']);
const ORIGIN='https://daily-coach-ing.com';
const digest=async v=>{
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
};
const token=()=>{
 const data=new Uint8Array(32);
 crypto.getRandomValues(data);
 return btoa(String.fromCharCode(...data)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};
const hoursAllowed=x=>Number.isInteger(x)&&x>=1&&x<=48;
export async function mintProgramPassClaim({
 orderId,kind,now=Date.now(),hours=24,origin=ORIGIN
}={}){
 if(!UUID.test(orderId||'')||!KINDS.has(kind)
  ||!Number.isFinite(now)||!hoursAllowed(hours)||origin!==ORIGIN)
  throw Error('INVALID_PRIVATE_PROGRAM_PASS_CONTEXT');
 const raw=token();
 const tDigest=await digest(raw);
 const expiresAt=new Date(now+hours*60*60*1000).toISOString();
 const u=new URL('/nal/commerce/pass/',origin);
 // The token is in fragment, so it is not sent to the website origin
 // on initial GET. The FUTURE client must clear hash from history at once.
 u.hash=new URLSearchParams({order:orderId,token:raw}).toString();
 return Object.freeze({kind,orderId,url:u.href,tokenDigest:tDigest,expiresAt});
}
export function createDeliveryLinkPorts({
 pdfTokens,passTokens,clock=Date.now
}={}){
 if(typeof pdfTokens?.issue!=='function'
   ||typeof passTokens?.issue!=='function'||typeof clock!=='function')
  throw Error('DELIVERY_TOKEN_STORAGE_UNAVAILABLE');
 return Object.freeze({
  pdf:Object.freeze({
   async prepare({orderId}={}){
    const receipt=await mintReceiptLink({orderId,now:clock()});
    const stored=await pdfTokens.issue({
      orderId,tokenDigest:receipt.tokenDigest,expiresAt:receipt.expiresAt
    });
    if(stored!==true)throw Error('PDF_RECEIPT_NOT_ISSUED');
    return {url:receipt.url};
   }
  }),
  programs:Object.freeze({
   async prepare({orderId,kind}={}){
    const pass=await mintProgramPassClaim({orderId,kind,now:clock()});
    const stored=await passTokens.issue({
      orderId,kind,tokenDigest:pass.tokenDigest,expiresAt:pass.expiresAt
    });
    if(stored!==true)throw Error('PROGRAM_PASS_NOT_ISSUED');
    return {url:pass.url};
   }
  })
 });
}
