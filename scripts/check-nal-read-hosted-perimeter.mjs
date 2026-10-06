import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
// Read-only perimeter checks: NO real signup, valid user token, or payment request.
const cfg=JSON.parse(readFileSync('nal/data/backend.json','utf8'));
assert.equal(cfg.url,'https://tdglznjjkgaulerbduwt.supabase.co');
const rows=[];
async function check(label,url,options,predicate){
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
 const text=await r.text();
 const passed=predicate(r,text);
 rows.push({label,status:r.status,passed});
 assert.ok(passed,`${label}: unexpected status ${r.status}`);
}
for(const slug of ['nal-read-enroll','nal-read-daily']){
 const url=cfg.url+'/functions/v1/'+slug;
 const action=slug==='nal-read-enroll'?'access':'bootstrap';
 for(const token of ['', 'invalid-test-token']){
  await check(slug+(token?' invalid token':' missing token'),url,{method:'POST',headers:{
   apikey:cfg.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})
  },body:JSON.stringify({action,seasonSlug:'trend-2027'})},r=>r.status===401);
 }
 await check(slug+' CORS preflight',url,{method:'OPTIONS',headers:{Origin:'https://daily-coach-ing.com',
  'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type'
 }},(r,text)=>r.status===204&&text==='');
}
for(const table of ['nal_read_seasons','nal_product_entitlements','nal_read_enrollments','nal_read_answers','nal_read_day_progress']){
 await check(table+' anonymous REST',cfg.url+'/rest/v1/'+table+'?select=id&limit=1',{
  headers:{apikey:cfg.publishableKey}
 },(r,t)=>[401,403].includes(r.status)||(r.status===200&&t.trim()==='[]'));
}
const out=process.env.NAL_QA_OUTPUT||'/tmp/nal-read-hosted-perimeter.json';
mkdirSync(path.dirname(out),{recursive:true});
const report={checkedAt:new Date().toISOString(),project:'nal-platform',
 scope:'Unauthenticated perimeter only. Not real email/Auth/session/user flow E2E.',checks:rows};
writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
