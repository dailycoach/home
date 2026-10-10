import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const read=async path=>readFile(path,'utf8');
const json=async path=>JSON.parse(await read(path));
const release=await json('nal/data/commerce-lite.release.json');
const catalog=await json('nal/data/products.json');
const site=await json('nal/data/site.json');
const frontend=await read('nal/assets/js/nal-commerce-lite.js');
const backend=await read('integration/nal-commerce-lite/server/commerce-handler.mjs');
const guestLedger=await read('integration/nal-commerce-lite/PROPOSAL_ONLY_guest_ledger.sql');
const outbox=await read('integration/nal-commerce-lite/server/receipt-outbox.mjs');
const receipt=await read('integration/nal-commerce-lite/server/receipt-link.mjs');
const errors=[];
function check(value,error){if(!value)errors.push(error);}
check(release.schemaVersion===1&&release.module==='nal-commerce-lite','invalid commerce release contract');
for(const key of ['clientEnabled','serverReady','pgConfigured','approvedPrivacyNotice','approvedTermsAndRefunds',
 'settlementGuardReviewed','fulfillmentReady','emailReceiptReady','customerReleaseApproved']){
 check(release[key]===false,'commerce gate '+key+' must remain OFF');
}
check(release.provider===null&&release.minimumAmountWon===null,'PG and payment minimum must remain unassigned');
check(Array.isArray(release.allowedCheckoutOrigins)&&release.allowedCheckoutOrigins.length===0,
 'checkout provider origin allowlist must remain unassigned');
for(const key of ['account','storePurchase','checkout','secureDownload','orderLibrary']) {
 check(site.features?.[key]===false,'NAL source site feature '+key+' enabled early');
}
for(const id of ['nal-small-book-01-mind-reset','nal-small-book-02-relationship','nal-small-book-03-next-step']){
 const p=catalog.products.find(x=>x.id===id);
 check(p?.price===0&&p?.published===true&&p?.stockStatus==='available'
  &&p?.purchaseUrl?.startsWith('/nal/assets/downloads/free/')&&p.purchaseUrl===p.sampleUrl,
  'free book modified: '+id);
}
for(const [id,price] of [['dailycoaching-awareness-100',100],['dailycoaching-awareness-1000',1000],['dailycoaching-awareness-10000',10000]]){
 const p=catalog.products.find(x=>x.id===id);
 check(p?.stockStatus==='comingSoon'&&p?.price===price&&p.purchaseUrl===null,
  'AWARENESS early sale: '+id);
}
const pages=[
 'nal/commerce/index.html','nal/commerce/complete/index.html','nal/commerce/claim/index.html'
];
for(const path of pages){
 const html=await read(path);
 check(/<html lang="ko">/.test(html),'lang missing '+path);
 check(/<meta name="robots" content="noindex,nofollow,noarchive">/.test(html),
  'noindex/noarchive lost '+path);
 check(/<meta name="referrer" content="no-referrer">/.test(html),'referrer hardening lost '+path);
 check(/<main\b/.test(html),'main landmark missing '+path);
 check(!/js\.tosspayments\.com|cdn\.jsdelivr\.net\/npm\/@supabase/.test(html),
  'commerce page must not load a provider/auth SDK '+path);
 check(html.includes('/nal/assets/js/nal-commerce-lite.js'),'commerce script missing '+path);
 check(html.includes('/nal/assets/css/nal-commerce-lite.css'),'commerce stylesheet missing '+path);
}
check(!/TossPayments|paypal|payapp/i.test(frontend),'frontend tied to a chosen PG');
check(frontend.includes('if(!valid)return;') && frontend.includes('canRelease(gate)'),
 'client must check release gate before entering checkout');
check(frontend.includes('sessionStorage')&&frontend.includes('claimToken'),'browser checkout proof missing');
check(frontend.includes('takeReceiptFragment')&&frontend.includes('replaceState'),
 'email proof must be removed from navigation history');
check(frontend.includes('validSignedUrl'),'signed PDF link validation missing');
check(backend.includes('DEFAULT_COMMERCE_RELEASE')&&backend.includes('enabled:false'),
 'server default OFF gate missing');
for(const field of ['providerConfigured','ledgerReviewed','privacyNoticeApproved','refundGuardReviewed',
  'emailSenderReady','deliveryReviewed','customerReleaseApproved']){
 check(backend.includes(field+':false'),'backend release gate '+field+' must default OFF');
}
check(backend.includes("!['create','status','download','redeem'].includes(action)"),
 'public endpoint action allowlist changed');
check(backend.includes("payment.source==='provider-server-lookup'")
 &&backend.includes('provider.lookupPayment(order)')
 &&backend.includes('store.applyProviderResult'),
 'payment authority must derive from server/provider not redirect');
check(backend.includes('store.reserveReceiptProof')&&backend.includes('store.finishReceiptProof'),
 'one-time email receipt reservation absent');
check(backend.includes('createSignedDownload')&&backend.includes("ledger.state!=='paid'"),
 'delivery must be blocked unless provider DONE and paid ledger');
check(guestLedger.includes("NAL GUEST COMMERCE SCHEMA IS NOT APPROVED")
 &&guestLedger.includes("current_setting('nal.commerce_lite_schema_approved', true)"),
 'unapproved private DB schema patch could become executable');
check(guestLedger.includes('REVOKE ALL ON nal_private.commerce_guest_orders FROM PUBLIC,anon,authenticated')
 &&guestLedger.includes('ENABLE ROW LEVEL SECURITY'),
 'private guest table must not be exposed');
check(guestLedger.includes('Refunded guest order cannot regain entitlement'),
 'refund/entitlement monotonic transition must be part of future SQL');
check(receipt.includes('crypto.subtle.digest')&&receipt.includes('url.hash='),
 'receipt link must use a hashed token and URL fragment');
check(outbox.includes('getPaidGuestOrder')&&outbox.includes('mailer.send')
 &&outbox.includes('tokens.issue'),
 'verified-paid receipt worker or token storage missing');
try{
 await access('supabase/functions/nal-commerce-lite/index.ts');
 errors.push('provider-less guest Edge function must NOT be deployed/staged inside active functions');
}catch{}
if(errors.length){
 console.error('NAL COMMERCE LITE source gate FAIL ('+errors.length+')');
 for(const e of errors)console.error('- '+e);
 process.exit(1);
}
console.log('NAL COMMERCE LITE source gate PASS: 3 offline noindex views, free PDFs unaffected, default OFF, no provider or deployable Edge, private ledger proposal locked');
