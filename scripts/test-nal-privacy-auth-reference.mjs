import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadAuthBoundary } from '../integration/nal-stabilization-04/reference/nal-read-auth.mjs';
import { createAccountHandler } from '../integration/nal-stabilization-04/reference/nal-account-handler.mjs';

const referenceFiles = new Map([
  ['integration/nal-stabilization-04/reference/nal-read-auth.mjs','a6bd91783a7ab2047714e25bfbf3bc254251aa7b'],
  ['integration/nal-stabilization-04/reference/nal-account-handler.mjs','8ffc72b6306735ba9a5ff320390443f47c558d81']
]);
for (const [file,expected] of referenceFiles) {
  const bytes=await readFile(file);
  const hash=createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
  assert.equal(hash,expected,`Audited deployed-source reference changed: ${file}`);
}

const base='https://tdglznjjkgaulerbduwt.supabase.co';
const userId='123e4567-e89b-42d3-a456-426614174000';
const otherId='123e4567-e89b-42d3-a456-426614174001';
const tick=Date.parse('2026-10-10T00:00:00Z');
const validUser=()=>({id:userId,role:'authenticated',is_anonymous:false,email:'synthetic@example.invalid',
  email_confirmed_at:new Date(tick-60000).toISOString(),deleted_at:null,banned_until:null,
  user_metadata:{role:'owner',is_admin:true}});
const response=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
const called=[];
const fetcher=async (url,options)=>{
  called.push({url,method:options.method,headers:options.headers,body:options.body});
  if(url.endsWith('/auth/v1/user')){
    if(options.headers.Authorization==='Bearer invalid-token')return response(401,{});
    return response(200,validUser());
  }
  if(url.includes('/auth/v1/admin/users/'))return response(200,validUser());
  if(url.includes('/rest/v1/rpc/'))return response(200,{success:true});
  throw new Error('No synthetic test route: '+url);
};
const make=()=>createReadAuthBoundary({base,publicKey:'synthetic-public-key',serviceKey:'synthetic-service-key',fetcher,clock:()=>tick});
let tests=0;
const auth=make();
assert.deepEqual(await auth.authenticate('valid-token'),{id:userId}); tests++;
const result=await auth.rpc(userId,'nal_read_privacy',{p_action:'inventory',p_payload:{}});
assert.equal(result.success,true);
const rpc=called.find(x=>x.url.endsWith('/rpc/nal_read_privacy'));
assert.equal(JSON.parse(rpc.body).p_user_id,userId);
assert.equal(rpc.headers.Authorization,'Bearer synthetic-service-key');
assert.equal(JSON.parse(rpc.headers['x-nal-read-verified']).user_id,userId);
tests++;
await assert.rejects(auth.rpc(userId,'nal_read_privacy_admin',{p_action:'queue',p_payload:{}}),/Invalid READ operation/); tests++;
await assert.rejects(auth.rpc(otherId,'nal_read_privacy',{p_action:'inventory'}),/Invalid session/); tests++;
await assert.rejects(auth.rpc(userId,'nal_read_privacy',{p_user_id:otherId,p_action:'inventory'}),/Invalid READ operation/); tests++;
// A forged browser user_metadata.role='owner' must never add an owner RPC to the allowlist.
assert.equal(called.filter(x=>x.url.endsWith('/rpc/nal_read_privacy_admin')).length,0); tests++;
await assert.rejects(auth.authenticate('invalid-token'),/Invalid session/); tests++;
await assert.rejects(auth.rpc(userId,'nal_read_privacy',{p_action:'inventory'}),/Invalid session/); tests++;
// Never let a user from a different Auth admin record pass identity confirmation.
const mismatched=make();
const originalAdmin=async (url,options)=>{
  if(url.includes('/auth/v1/admin/users/'))return response(200,{...validUser(),id:otherId});
  return fetcher(url,options);
};
const boundary=createReadAuthBoundary({base,publicKey:'synthetic-public-key',serviceKey:'synthetic-service-key',
  fetcher:originalAdmin,clock:()=>tick});
await assert.rejects(boundary.authenticate('valid-token'),/Invalid session/);tests++;
const banned=createReadAuthBoundary({base,publicKey:'synthetic-public-key',serviceKey:'synthetic-service-key',clock:()=>tick,
 fetcher:async (url)=>response(200,{...validUser(),banned_until:new Date(tick+3600000).toISOString()})});
await assert.rejects(banned.authenticate('valid-token'),/Invalid session/);tests++;
const anonymous=createReadAuthBoundary({base,publicKey:'synthetic-public-key',serviceKey:'synthetic-service-key',clock:()=>tick,
 fetcher:async()=>response(200,{...validUser(),is_anonymous:true})});
await assert.rejects(anonymous.authenticate('valid-token'),/Invalid session/);tests++;

const allowed=['https://daily-coach-ing.com'];
let mutations=0;
const handler=createAccountHandler({
 enabled:true,privacyEnabled:false,origins:allowed,
 authenticate:async()=>({id:userId}),
 catalog:async()=>({available:[]}),
 operate:async()=>{mutations++;return {leaked:true};}
});
const url=base+'/functions/v1/nal-account';
const request=(body,token='valid-token',origin=allowed[0])=>new Request(url,{
 method:'POST',headers:{Origin:origin,Authorization:token?'Bearer '+token:'','Content-Type':'application/json'},
 body:JSON.stringify(body)
});
const area=(action)=>({area:'privacy',action,payload:{}});
let res=await handler(request(area('inventory')));
assert.equal(res.status,503,'Member privacy API disabled before policy approval');
assert.equal(mutations,0);tests++;
res=await handler(request(area('inventory'),''));
assert.equal(res.status,401);tests++;
res=await handler(request(area('execute-journal')));
assert.equal(res.status,400);tests++;
res=await handler(request(area('request')));
assert.equal(res.status,503);tests++;
res=await handler(request(area('inventory'),'valid-token','https://evil.invalid'));
assert.equal(res.status,403);tests++;
console.log(`NAL P4 deployed-source Auth model PASS: ${tests} negative and positive synthetic checks, zero privileged owner RPC calls and zero mutations`);
