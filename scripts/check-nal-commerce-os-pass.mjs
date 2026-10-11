import {readFile,access} from 'node:fs/promises';
const read=p=>readFile(p,'utf8');
const json=async p=>JSON.parse(await read(p));
const release=await json('nal/data/commerce-pass.release.json');
const delivery=await json('integration/nal-commerce-os/delivery-release-review.json');
const site=await json('nal/data/site.json');
const lite=await json('nal/data/commerce-lite.release.json');
const admin=await json('nal/data/commerce-admin.release.json');
const html=await read('nal/commerce/pass/index.html');
const client=await read('nal/assets/js/nal-commerce-pass.js');
const css=await read('nal/assets/css/nal-commerce-pass.css');
const server=await read('integration/nal-commerce-os/server/pass-claim-handler.mjs');
const sql=await read('integration/nal-commerce-os/PROPOSAL_ONLY_pass_resend.sql');
const worker=await read('integration/nal-commerce-os/server/pass-resend-worker.mjs');
const issues=[];const check=(v,m)=>{if(!v)issues.push(m);};
check(release.schemaVersion===1&&release.module==='nal-commerce-pass'
 &&release.phase==='P7_E_SOURCE_ONLY','P7-E manifest identity must be preserved');
for(const [key,value] of Object.entries(release)){
 if(key.endsWith('Enabled')||key.endsWith('Reviewed')||key.endsWith('Approved')
  ||key.endsWith('Connected')||key.endsWith('Ready')){
  check(value===false,'P7-E public pass release '+key+' must stay OFF');
 }
}
check(release.noProductionEffects===true,'P7-E source-only declaration removed');
check(delivery.programClaimRouteStatus==='staged-no-server'
 &&delivery.programClaimsReleaseApproved===false
 &&delivery.unifiedWorkerEnabled===false,
 'P7-D reference must acknowledge staged but OFF customer route');
check(html.includes('<meta name="robots" content="noindex,nofollow,noarchive">')
 &&html.includes('<meta name="referrer" content="no-referrer">')
 &&html.includes('id="np-pass-details"')&&html.includes('hidden')
 &&html.includes('id="np-resend"')&&html.includes('disabled')
 &&html.includes('/nal/assets/js/nal-commerce-pass.js'),
 'Noindex private pass UI must default hidden and disabled');
check(css.includes(':focus-visible')&&css.includes('@media(max-width:720px)'),
 'private pass view accessibility/mobile CSS missing');
check(client.includes('history.replaceState')
 &&client.includes('const claim=wipeUrlFragment();')
 &&client.includes("if(!approved(gate))")
 &&client.includes('resendApproved(gate)')
 &&client.includes('sessionStorage?.getItem(proofKey)'),
 'browser fragment secret removal and independent OFF release gate missing');
check(!/innerHTML|document\.write|localStorage|service_role|sb_secret_/i.test(client),
 'browser pass script may expose secrets or untrusted HTML');
check(client.includes("if(!proof||!button)return;")
 &&client.includes("post(config,'resend',{...proof"),
 'resend must require original checkout buyer proof');
check(server.includes('DEFAULT_PASS_API_RELEASE')
 &&server.includes('enabled:false')
 &&server.includes("!['verify','confirm','resend'].includes(action)")
 &&server.includes("const owner=await db.lookupBuyerProof")
 &&server.includes("owner.status==='paid'")
 &&server.includes('payment.revalidate')
 &&server.includes("return reply(202,{accepted:true}"),
 'non-enumerating proof-gated pass API must fail closed');
check(server.includes("receiptToken")&&server.includes("tokenDigest:digest")
 &&server.includes("issued:true")
 &&server.includes("issued:false")
 &&server.includes("const privateSummary")
 &&!server.includes('service_role'),
 'ticket must use hashed one-time token and sanitized response');
check(sql.includes("current_database() IS DISTINCT FROM 'nal_ci_ledger'")
 &&sql.includes("current_setting('nal.commerce_os_ci_approval',true) IS DISTINCT FROM 'isolated'")
 &&!sql.includes("SET nal.commerce_os_ci_approval='isolated'"),
 'P7-E SQL must reject live Supabase and not self-approve');
check((sql.match(/CREATE TABLE nal_private\.commerce_os_/g)||[]).length===1
 &&(sql.match(/CREATE FUNCTION nal_private\.commerce_os_/g)||[]).length===4,
 'P7-E must add exactly one private table and four service-only functions');
check(sql.includes('CREATE TRIGGER commerce_os_cancel_program_resends')
 &&sql.includes("OLD.status='active' AND NEW.status='revoked'")
 &&sql.includes("state='cancelled',lease_id=NULL,lease_until=NULL"),
 'refund must cancel unfinished resend jobs in same DB transaction');
check(sql.includes("o.claim_digest IS DISTINCT FROM p_claim_digest")
 &&sql.includes("created_at>now()-interval '15 minutes'")
 &&sql.includes("created_at>now()-interval '24 hours'")
 &&sql.includes(")>=3")
 &&sql.includes('pg_advisory')===false,
 'buyer proof, 15-min cooldown and 3-per-day cap must remain');
check(sql.includes('FOR UPDATE')&&sql.includes("p_request_id")
 &&sql.includes('UNIQUE')&&sql.includes('lease_id IS DISTINCT FROM p_lease_id'),
 'resend idempotency, row-lock and lease checks absent');
check(sql.includes('ENABLE ROW LEVEL SECURITY')
 &&sql.includes('FROM PUBLIC,anon,authenticated')
 &&sql.includes('TO service_role')
 &&!sql.includes('SECURITY DEFINER')
 &&!sql.includes('REVOKE ALL ON ALL'),
 'no public DB grants or security-definer on program resend');
check(worker.includes('DEFAULT_PASS_RESEND_RELEASE')
 &&worker.includes('enabled:false')
 &&(worker.match(/await eligibility\.recheck\(job\)/g)||[]).length===2
 &&worker.includes('idempotencyKey:')
 &&worker.includes("if(!safePassLink(link?.url,job))"),
 'worker must default OFF and recheck rights before any email');
for(const key of ['storePurchase','checkout','secureDownload','account','orderLibrary']){
 check(site.features?.[key]===false,'live NAL paid feature '+key+' must be OFF');
}
check(lite.clientEnabled===false&&admin.uiEnabled===false,
 'prior paid sale/admin gate must remain OFF');
for(const path of [
 'supabase/functions/nal-commerce-pass/index.ts',
 'supabase/functions/nal-pass-resend/index.ts'
]){
 try{await access(path);issues.push('Unapproved deployable pass Edge function: '+path);}catch{}
}
if(issues.length){
 console.error('NAL P7-E PASS SOURCE LOCK FAIL ('+issues.length+')');
 for(const issue of issues)console.error('- '+issue);
 process.exit(1);
}
console.log('NAL P7-E pass source lock PASS: noindex fragment-proof UI, 1 table, 4 functions, buyer-only resend rate cap, PG/email OFF');
