import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
// No signup, real user token, or payment request. OFF is not an authentication PASS.
const cfg=JSON.parse(readFileSync('nal/data/backend.json','utf8'));
assert.equal(cfg.url,'https://tdglznjjkgaulerbduwt.supabase.co');
const rows=[];
async function check(label,url,options,classify){
 try{
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
  const text=await r.text();let body=null;try{body=JSON.parse(text);}catch{}
  rows.push({label,status:r.status,result:classify(r,text,body)});
 }catch(error){rows.push({label,status:null,result:'BLOCKED_NETWORK',error:error.name});}
}
for(const slug of ['nal-read-enroll','nal-read-daily']){
 const url=cfg.url+'/functions/v1/'+slug;
 const action=slug==='nal-read-enroll'?'access':'bootstrap';
 for(const token of ['', 'invalid-test-token']){
  await check(slug+(token?' invalid token':' missing token'),url,{method:'POST',headers:{
   apikey:cfg.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})
  },body:JSON.stringify({action,seasonSlug:'trend-2027'})},(r,_t,b)=>{
   if(r.status===401)return 'PASS_AUTH_REJECTION';
   if(r.status===503&&['NAL READ foundation is not enabled','NAL READ daily engine is not enabled'].includes(b?.error))return 'BLOCKED_DISABLED_BEFORE_AUTH';
   return 'FAIL_UNEXPECTED_RESPONSE';
  });
 }
 await check(slug+' CORS preflight',url,{method:'OPTIONS',headers:{Origin:'https://daily-coach-ing.com',
  'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type'
 }},(r,text)=>r.status===204&&text===''?'PASS':'FAIL');
}
for(const table of ['nal_read_seasons','nal_product_entitlements','nal_read_enrollments','nal_read_answers','nal_read_day_progress']){
 await check(table+' anonymous REST',cfg.url+'/rest/v1/'+table+'?select=id&limit=1',{
  headers:{apikey:cfg.publishableKey}
 },(r,t)=>[401,403].includes(r.status)||(r.status===200&&t.trim()==='[]')?'PASS_NO_ROWS':'FAIL');
}
const out=process.env.NAL_QA_OUTPUT||'/tmp/nal-read-hosted-perimeter.json';
mkdirSync(path.dirname(out),{recursive:true});
const blocked=rows.filter(x=>x.result.startsWith('BLOCKED')).length;
const failed=rows.filter(x=>x.result.startsWith('FAIL')).length;
const report={checkedAt:new Date().toISOString(),project:'nal-platform',blocked,failed,
 status:failed?'FAIL':blocked?'BLOCKED':'PASS',
 scope:'Unauthenticated perimeter only. Disabled response does not prove JWT/auth enforcement. No email/Auth/session E2E.',checks:rows};
writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(failed||blocked)process.exitCode=1;
