import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
if(process.env.NAL_QA_ISOLATED_DATABASE!=='1')throw new Error('Disposable CI database only');
const sql=(q)=>execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-Atc',q],{encoding:'utf8',timeout:15000}).trim();
if(sql('select current_database()')!=='nal_read_fix03')throw new Error('Wrong database');
const secret='nal-fix03-disposable-jwt-secret-not-for-real-use';
function jwt(role,sub){const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const data=enc({alg:'HS256',typ:'JWT'})+'.'+enc({role,sub,exp:Math.floor(Date.now()/1000)+300});
 return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');}
const user=randomUUID(),order=randomUUID(),item=randomUUID(),slug='transport-'+randomUUID().slice(0,8);
const serviceToken=jwt('service_role'),clientToken=jwt('authenticated',user);
let checks=0;
function eq(a,b){assert.deepEqual(a,b);checks++;}
function proof(overrides={}){return JSON.stringify({user_id:user,email_confirmed_at:new Date(Date.now()-86400000).toISOString(),is_anonymous:false,deleted_at:null,banned_until:null,verified_at:new Date().toISOString(),...overrides});}
async function rpc(name,args,identity=proof(),token=serviceToken){
 const res=await fetch('http://127.0.0.1:3300/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(identity===null?{}:{'x-nal-read-verified':identity})},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
 return {status:res.status,body:await res.json()};
}
try{
 sql(`insert into auth.users(id,email_confirmed_at) values('${user}',now());
 insert into public.nal_catalog(kind,id,published,body) values('products','${slug}',false,'{"title":"Transport QA"}');
 insert into public.nal_orders(id,user_id,amount_won,status) values('${order}','${user}',0,'paid');
 insert into public.nal_order_items(id,order_id,catalog_kind,catalog_id,title_snapshot,quantity,unit_price_won) values('${item}','${order}','products','${slug}','QA',1,0);
 insert into public.nal_read_seasons(slug,title,product_id,status) values('${slug}','Transport QA','${slug}','open');
 insert into nal_private.read_test_allowlist(user_id,season_id,approval_ref) select '${user}',id,'disposable CI' from public.nal_read_seasons where slug='${slug}';
 update nal_private.read_release_control set mode='test_only';
 insert into nal_private.read_days(season_id,day_number,title,status,day_type) select id,0,'Before','published','before' from public.nal_read_seasons where slug='${slug}';
 insert into nal_private.read_day_steps(day_id,step_order,step_type,prompt,status,required) select d.id,1,'QUESTION','QA question','published',true from nal_private.read_days d join public.nal_read_seasons s on s.id=d.season_id where s.slug='${slug}';`);
 const args={p_user_id:user,p_season_slug:slug};
 let r=await rpc('nal_issue_read_enrollment',{...args,p_order_id:order,p_request_id:randomUUID()});
 eq(r.status,200);eq(r.body.allowed,true);
 r=await rpc('nal_get_read_access',args,null);eq(r.body.allowed,false);eq(r.body.reason,'verified_identity_required');
 r=await rpc('nal_get_read_access',args,proof(),clientToken);eq([401,403].includes(r.status),true);
 r=await rpc('nal_get_read_access',args,'bad-json');eq(r.body.allowed,false);
 r=await rpc('nal_get_read_access',args,proof({verified_at:new Date(Date.now()-60000).toISOString()}));eq(r.body.allowed,false);
 r=await rpc('nal_get_read_access',args,proof({user_id:randomUUID()}));eq(r.body.allowed,false);
 r=await rpc('nal_get_read_day',{...args,p_day_number:0});eq(r.status,200);eq(r.body.steps.length,1);
 r=await rpc('nal_save_read_answer',{...args,p_day_number:0,p_step_order:1,p_answer_text:'   ',p_answer_json:null});eq(r.status,400);
 r=await rpc('nal_save_read_answer',{...args,p_day_number:0,p_step_order:1,p_answer_text:'v',p_answer_json:null});eq(r.status,200);eq(r.body.saved,true);
 r=await rpc('nal_complete_read_day',{...args,p_day_number:0});eq(r.status,200);eq(r.body.completed,true);
 r=await rpc('nal_get_read_day',{...args,p_day_number:0},null);eq([401,403].includes(r.status),true);
 r=await rpc('nal_get_read_day',{...args,p_day_number:0});eq(r.status,200);eq(r.body.steps[0].answerText,'v');
 sql(`update nal_private.read_release_control set mode='off'`);
 r=await rpc('nal_get_read_access',args);eq(r.body.allowed,false);eq(r.body.reason,'read_release_off');
 eq(sql("select has_any_column_privilege('service_role','auth.users','select')"),'f');
 console.log(`NAL-FIX-03 PostgREST HTTP transport: ${checks} assertions PASS; synthetic server JWT/proof, disposable DB`);
}finally{
 // This script cannot run unless the explicitly disposable database name matches.
 sql(`begin;
 delete from public.nal_read_answers where user_id='${user}';
 delete from public.nal_read_day_progress where user_id='${user}';
 delete from nal_private.read_enrollment_requests where user_id='${user}';
 delete from public.nal_read_enrollments where user_id='${user}';
 delete from public.nal_product_entitlements where user_id='${user}';
 delete from nal_private.read_test_allowlist where user_id='${user}';
 delete from nal_private.read_day_steps where day_id in (select d.id from nal_private.read_days d join public.nal_read_seasons s on s.id=d.season_id where s.slug='${slug}');
 delete from nal_private.read_days where season_id in (select id from public.nal_read_seasons where slug='${slug}');
 delete from public.nal_read_seasons where slug='${slug}';
 delete from public.nal_order_items where order_id='${order}';
 delete from public.nal_orders where id='${order}';
 delete from auth.users where id='${user}';
 delete from public.nal_catalog where kind='products' and id='${slug}';
 update nal_private.read_release_control set mode='off'; commit;`);
}
