/**
 * NAL P7-C composition root.
 * No Deno.serve() and no deployment entrypoint. Only an approved server
 * with its own secret store can pass provider, issuer, private parameterized
 * database, storage signer and durable rate limiter ports.
 *
 * The default branch explicitly returns 503 without touching dependencies.
 */
import {
  createCommerceLiteHandler,DEFAULT_COMMERCE_RELEASE
} from '../../nal-commerce-lite/server/commerce-handler.mjs';
import {createUnifiedGuestBridge} from './unified-guest-bridge.mjs';

const APPROVALS=[
 'enabled','providerConfigured','ledgerReviewed','privacyNoticeApproved',
 'refundGuardReviewed','emailSenderReady','deliveryReviewed','customerReleaseApproved'
];
const approved=x=>!!x&&APPROVALS.every(k=>x[k]===true);
const failClosed=()=>{
 const handler=createCommerceLiteHandler({release:DEFAULT_COMMERCE_RELEASE});
 return Object.freeze({
   ready:false,
   handler,
   prepareProgramOrder:async()=>{throw Error('COMMERCE_NOT_ENABLED');}
 });
};
export function composeCommerceApi({
 release=DEFAULT_COMMERCE_RELEASE,
 db,issuer,provider,signPrivatePdf,limit,
 storageOrigin='https://invalid.supabase.co',
 allowedOrigins=['https://daily-coach-ing.com'],
 clock=Date.now
}={}) {
 if(!approved(release))return failClosed();
 if(typeof storageOrigin!=='string'
   ||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(storageOrigin)
   ||!Array.isArray(allowedOrigins)||!allowedOrigins.length
   ||allowedOrigins.some(x=>{
      try{return new URL(x).origin!==x||!x.startsWith('https://');}
      catch{return true;}
   }))
   return failClosed();
 let bridge;
 try{
  bridge=createUnifiedGuestBridge({db,issuer,provider,signPrivatePdf,limit,at:clock});
 }catch{return failClosed();}
 const handler=createCommerceLiteHandler({
   release,allowedOrigins,
   minimumAmountWon:bridge.minimumAmountWon,
   provider:bridge.provider,
   store:bridge.store,catalog:bridge.catalog,
   delivery:bridge.delivery,issueClaim:bridge.issueClaim,
   limit:bridge.limit,storageOrigin
 });
 return Object.freeze({
   ready:true,
   handler,
   prepareProgramOrder:bridge.prepareProgramOrder
 });
}
