import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

const read=async p=>readFile(p,'utf8');
const json=async p=>JSON.parse(await read(p));
const gate=await json('nal/data/commerce-admin.release.json');
const lite=await json('nal/data/commerce-lite.release.json');
const site=await json('nal/data/site.json');
const page=await read('nal/commerce/admin/index.html');
const ui=await read('nal/assets/js/nal-commerce-admin.js');
const css=await read('nal/assets/css/nal-commerce-admin.css');
const api=await read('integration/nal-commerce-os/admin-handler.mjs');
const engine=await read('integration/nal-commerce-os/order-engine.mjs');
const problems=[];
const check=(ok,msg)=>{if(!ok)problems.push(msg);};
check(gate.schemaVersion===1&&gate.module==='nal-commerce-admin','admin release manifest identity');
for(const k of ['uiEnabled','ownerAuthReviewed','serverGateConfigured','privacyNoticeApproved',
  'writePermissionsReviewed','backendDeployed','productionApproved','publicProductSalesEnabled']){
  check(gate[k]===false,'admin '+k+' must remain disabled');
}
check(Array.isArray(gate.actions.read)&&gate.actions.read.length===7,'read actions must remain 7');
check(Array.isArray(gate.actions.drafts)&&gate.actions.drafts.length===2,
 'admin only permits private draft writes');
for(const action of ['execute-refund','grant-owner','publish-live','sign-download','approve-payment']){
 check(gate.actions.prohibited.includes(action),'blocked action '+action+' missing');
}
check(lite.clientEnabled===false&&lite.pgConfigured===false&&lite.customerReleaseApproved===false,
 'legacy guest checkout must remain OFF');
for(const key of ['account','checkout','storePurchase','secureDownload']){
 check(site.features?.[key]===false,'main site flag '+key+' must remain OFF');
}
check(page.includes('<meta name="robots" content="noindex,nofollow,noarchive">'),
 'admin noindex / noarchive lost');
check(page.includes('<meta name="referrer" content="no-referrer">'),
 'admin referrer protection lost');
for(const route of ['overview','catalog','programs','bookings','orders','delivery']){
 check(page.includes('data-admin-nav="'+route+'"'),'admin menu missing '+route);
}
check(page.includes('id="na-private" hidden'),'private panel must default hidden');
check(page.includes('/nal/assets/js/nal-commerce-admin.js'),
 'admin script not loaded');
check(page.includes('/nal/assets/css/nal-commerce-admin.css'),
 'admin styling not loaded');
check(!page.includes('js.tosspayments.com')&&!page.includes('cdn.jsdelivr.net'),
 'unreviewed external provider/auth scripts on admin page');
check(!/innerHTML|localStorage|service_role/i.test(ui),
 'browser must not render unsafe HTML/store owner tokens/reference privileged keys');
check(ui.includes('if(!approved(gate))')&&ui.includes('NALCommerceAdminBridge'),
 'owner auth bridge release interlock missing');
check(ui.includes("app.released=false")===false,
 'admin JS baseline unexpected'); // state uses released:false in object
check(ui.includes('const app={released:false'),'admin runtime must start OFF');
check(api.includes('DEFAULT_ADMIN_RELEASE')&&api.includes('enabled:false'),
 'server admin gate must default OFF');
check(api.includes("isExistingOwner(who.id)")&&api.includes('verifiedByAuthServer'),
 'server must check verified identity and owner role');
check(api.includes("!['create','download']")===false,
 'admin must not import customer checkout state machine');
const guardedDraftReturns=(api.match(/published:false,saleStatus:'draft'/g)||[]).length;
check(guardedDraftReturns===2&&!api.includes("published:true,saleStatus:'draft'"),
 'admin drafts must never set publication to true');
check(api.includes("['catalog-draft-save'")===false,
 'admin action allowlist should retain centralized ADMIN_ACTIONS');
for(const disallowed of ['execute-refund','refund-approve','grant-owner','publish-live','approve-payment','sign-download']){
 check(!api.includes("'"+disallowed+"'"),'admin API must not offer privileged action '+disallowed);
}
check(engine.includes("'reading_circle'")&&engine.includes("'class_session'")
  &&engine.includes("'pdf'"),'three purchase types not modeled');
check(engine.includes("NO_ATOMIC_SEAT_RESERVATION")
  &&engine.includes("NO_REGRANT_AFTER_TERMINAL"),'capacity or refund contract disappeared');
check(css.includes('@media(max-width:740px)'),'admin mobile navigation missing');
for(const path of ['supabase/functions/nal-commerce-admin/index.ts',
  'supabase/functions/nal-commerce-admin/handler.mjs']){
 try{await access(path);problems.push('unreviewed admin Edge route present: '+path);}catch{}
}
if(problems.length){
 console.error('NAL COMMERCE ADMIN source lock FAIL ('+problems.length+')');
 for(const p of problems)console.error('- '+p);
 process.exit(1);
}
console.log('NAL COMMERCE ADMIN source lock PASS: six gated panels, verified owner server contract, no payment/refund/admin role grants and main sales OFF');
