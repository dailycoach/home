import assert from 'node:assert/strict';
import {createReadAuthBoundary} from '../supabase/functions/_shared/nal-read-auth.mjs';
import {createReadDailyHandler} from '../supabase/functions/nal-read-daily/handler.mjs';
import {createReadEnrollmentHandler} from '../supabase/functions/nal-read-enroll/handler.mjs';
const base='https://abcdefghijklmnopqrst.supabase.co', publicKey='fixture-public',serviceKey='fixture-secret';
const now=Date.parse('2026-10-07T00:00:00Z'),uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const user={id:uid,role:'authenticated',email:'qa@example.invalid',email_confirmed_at:'2026-10-01T00:00:00Z',is_anonymous:false};
let checks=0;
function eq(a,b){assert.deepEqual(a,b);checks++;}
async function rejects(f){await assert.rejects(f);checks++;}
function setup({live=user,account=user,status=200,clock=()=>now,rpcStatus=200,rpcBody={allowed:true},fetcher}={}){
 const calls=[];
 const boundary=createReadAuthBoundary({base,publicKey,serviceKey,clock,fetcher:fetcher||(async(url,init)=>{
  calls.push({url,init});
  if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify(live),{status});
  if(url.includes('/auth/v1/admin/users/'))return new Response(JSON.stringify(account),{status});
  return new Response(JSON.stringify(rpcBody),{status:rpcStatus});
 })});
 return {boundary,calls};
}
{
 const {boundary,calls}=setup();await rejects(()=>boundary.rpc(uid,'nal_get_read_access',{}));
 eq(await boundary.authenticate('real-user-token'),{id:uid});
 await boundary.rpc(uid,'nal_get_read_access',{p_season_slug:'trend-2027'});
 eq(calls.length,3);eq(calls[0].init.headers.Authorization,'Bearer real-user-token');
 eq(calls[0].init.headers.apikey,publicKey);eq(calls[1].url,base+'/auth/v1/admin/users/'+uid);
 eq(calls[1].init.headers.Authorization,'Bearer '+serviceKey);
 const h=JSON.parse(calls[2].init.headers['x-nal-read-verified']);
 eq(h.user_id,uid);eq(h.is_anonymous,false);eq(h.deleted_at,null);eq(h.banned_until,null);
 eq(Object.hasOwn(h,'email'),false);eq(Object.hasOwn(h,'token'),false);
 eq(JSON.parse(calls[2].init.body).p_user_id,uid);eq(calls[2].init.redirect,'error');
 await rejects(()=>boundary.rpc(other,'nal_get_read_access',{}));
 await rejects(()=>boundary.rpc(uid,'nal_get_read_access',{p_user_id:other}));
 await rejects(()=>boundary.rpc(uid,'nal_create_product_order',{}));
}
for(const field of [
 {email_confirmed_at:null},{email_confirmed_at:'bad'},{email_confirmed_at:'2099-01-01T00:00:00Z'},
 {is_anonymous:true},{is_anonymous:undefined},{role:'service_role'},{email:''},
 {deleted_at:'2026-10-01T00:00:00Z'},{banned_until:'2099-01-01T00:00:00Z'},{banned_until:'invalid'}
]){
 let {boundary,calls}=setup({live:{...user,...field}});await rejects(()=>boundary.authenticate('token'));
 eq(calls.length,1);await rejects(()=>boundary.rpc(uid,'nal_get_read_access',{}));
 ({boundary,calls}=setup({account:{...user,...field}}));await rejects(()=>boundary.authenticate('token'));
 eq(calls.length,2);await rejects(()=>boundary.rpc(uid,'nal_get_read_access',{}));
}
{
 const {boundary}=setup({account:{...user,id:other}});await rejects(()=>boundary.authenticate('token'));
}
{
 const {boundary}=setup({live:{...user,email_confirmed_at:null,user_metadata:{email_confirmed:true,role:'authenticated'}}});
 await rejects(()=>boundary.authenticate('token'));
}
for(const status of [401,403,500]){const {boundary}=setup({status});await rejects(()=>boundary.authenticate('bad-token'));}
{
 let time=now;const {boundary}=setup({clock:()=>time});await boundary.authenticate('token');time+=31000;
 await rejects(()=>boundary.rpc(uid,'nal_get_read_access',{}));
}
{
 const {boundary,calls}=setup();await boundary.authenticate('token');await rejects(()=>boundary.authenticate(''));
 await rejects(()=>boundary.rpc(uid,'nal_get_read_access',{}));eq(calls.length,2);
}
{
 const b1=setup(),b2=setup({live:{...user,id:other},account:{...user,id:other}});
 await Promise.all([b1.boundary.authenticate('user-one'),b2.boundary.authenticate('user-two')]);
 await Promise.all([b1.boundary.rpc(uid,'nal_get_read_access',{}),b2.boundary.rpc(other,'nal_get_read_access',{})]);
 eq(JSON.parse(b1.calls.at(-1).init.headers['x-nal-read-verified']).user_id,uid);
 eq(JSON.parse(b2.calls.at(-1).init.headers['x-nal-read-verified']).user_id,other);
}
{
 const {boundary}=setup({rpcStatus:403,rpcBody:{code:'42501',message:'Read access unavailable'}});
 await boundary.authenticate('token');try{await boundary.rpc(uid,'nal_get_read_access',{});assert.fail('must reject');}
 catch(e){eq(e.code,'42501');}
}
const origin='https://qa.example.test';
function request(body,token='token',headers={}){return new Request(origin,{method:'POST',headers:{origin,authorization:token?'Bearer '+token:'','content-type':'application/json',...headers},body:JSON.stringify(body)});}
for(const kind of ['enroll','daily']){
 const {boundary,calls}=setup();
 const deps={enabled:true,origins:[origin],authenticate:boundary.authenticate,
  access:(id,slug)=>boundary.rpc(id,'nal_get_read_access',{p_season_slug:slug}),
  claim:(id,slug,o,r)=>boundary.rpc(id,'nal_issue_read_enrollment',{p_season_slug:slug,p_order_id:o,p_request_id:r}),
  bootstrap:(id,slug)=>boundary.rpc(id,'nal_read_bootstrap',{p_season_slug:slug})};
 const factory=kind==='enroll'?createReadEnrollmentHandler:createReadDailyHandler;
 const payload={action:kind==='enroll'?'access':'bootstrap',seasonSlug:'trend-2027',userId:other};
 const r=await factory(deps)(request(payload,'token',{'x-nal-read-verified':JSON.stringify({user_id:other})}));
 eq(r.status,200);eq(JSON.parse(calls.at(-1).init.headers['x-nal-read-verified']).user_id,uid);
 eq(JSON.parse(calls.at(-1).init.body).p_user_id,uid);
 eq((await factory({...deps,enabled:false})(request(payload,''))).status,401);
 const failed=setup({status:401});
 eq((await factory({...deps,authenticate:failed.boundary.authenticate})(request(payload,'bad'))).status,401);
 eq(failed.calls.length,1);
}
console.log(`NAL-FIX-03 Auth boundary: ${checks} assertions PASS (synthetic Auth HTTP responses, real boundary code)`);
