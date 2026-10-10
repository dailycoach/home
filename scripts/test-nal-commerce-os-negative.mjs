import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

const run=()=>spawnSync(process.execPath,['scripts/check-nal-commerce-os-admin.mjs'],{
 encoding:'utf8',timeout:30000,maxBuffer:1024*1024
});
const clean=run();
assert.equal(clean.status,0,'Clean Commerce Admin protection must PASS: '+clean.stdout+' '+clean.stderr);
const mutateJson=callback=>src=>{const j=JSON.parse(src);callback(j);return JSON.stringify(j);};
const cases=[
 ['owner UI enabled early','nal/data/commerce-admin.release.json',mutateJson(j=>{j.uiEnabled=true;}),'admin uiEnabled must remain disabled'],
 ['owner role approval forged','nal/data/commerce-admin.release.json',mutateJson(j=>{j.ownerAuthReviewed=true;}),'admin ownerAuthReviewed must remain disabled'],
 ['backend deployed falsely flagged','nal/data/commerce-admin.release.json',mutateJson(j=>{j.backendDeployed=true;}),'admin backendDeployed must remain disabled'],
 ['new user role action added','nal/data/commerce-admin.release.json',mutateJson(j=>{j.actions.prohibited=j.actions.prohibited.filter(x=>x!=='grant-owner');}),'blocked action grant-owner missing'],
 ['paid store enabled early','nal/data/site.json',mutateJson(j=>{j.features.storePurchase=true;}),'main site flag storePurchase must remain OFF'],
 ['admin view indexable','nal/commerce/admin/index.html',s=>s.replace('noindex,nofollow,noarchive','index,follow'),'admin noindex / noarchive lost'],
 ['privacy referrer removed','nal/commerce/admin/index.html',s=>s.replace('no-referrer','unsafe-url'),'admin referrer protection lost'],
 ['remove reservations menu','nal/commerce/admin/index.html',s=>s.replace('data-admin-nav="bookings"','data-admin-nav="hidden"'),'admin menu missing bookings'],
 ['expose panels without gate','nal/commerce/admin/index.html',s=>s.replace('id="na-private" hidden','id="na-private"'),'private panel must default hidden'],
 ['remove owner member verification','integration/nal-commerce-os/admin-handler.mjs',s=>s.replace('isExistingOwner(who.id)','isExistingOwnerFromBrowser(who.id)'),'server must check verified identity and owner role'],
 ['allow draft publication','integration/nal-commerce-os/admin-handler.mjs',s=>s.replace("published:false,saleStatus:'draft'","published:true,saleStatus:'draft'"),'admin drafts must never set publication to true'],
 ['remove seat confirmation','integration/nal-commerce-os/order-engine.mjs',s=>s.replace('NO_ATOMIC_SEAT_RESERVATION','ALLOW_SEAT_WITHOUT_RESERVATION'),'capacity or refund contract disappeared'],
 ['remove refund no-regrant','integration/nal-commerce-os/order-engine.mjs',s=>s.replace('NO_REGRANT_AFTER_TERMINAL','REGRANT_ALLOWED'),'capacity or refund contract disappeared'],
 ['remove release browser interlock','nal/assets/js/nal-commerce-admin.js',s=>s.replace('if(!approved(gate))','if(false)'),'owner auth bridge release interlock missing']
];
let pass=0;
for(const [name,file,mutate,expected] of cases){
 const original=await readFile(file,'utf8');
 try{
  const next=mutate(original);
  assert.notEqual(next,original,'No mutation: '+name);
  await writeFile(file,next,'utf8');
  const result=run(),out=result.stdout+'\n'+result.stderr;
  assert.notEqual(result.status,0,'Guard accepted unsafe change '+name+'\n'+out);
  assert(out.includes(expected),'Unexpected guard error '+name+'\n'+out);
  pass++;
 }finally{await writeFile(file,original,'utf8');}
}
const final=run();
assert.equal(final.status,0,'Clean guard not restored: '+final.stdout+' '+final.stderr);
console.log('NAL COMMERCE ADMIN negative guard PASS: '+pass+' injected source/privacy/sales/owner/seat hazards rejected and pristine tree restored');
