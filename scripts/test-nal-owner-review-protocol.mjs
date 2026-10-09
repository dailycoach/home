import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareOwnerReviewBinding, DEFAULT_RELEASE, REVIEW_RPC } from '../integration/nal-stabilization-04b/owner-review-protocol.mjs';

const T=Date.parse('2026-10-10T00:00:00Z');
const UID='123e4567-e89b-42d3-a456-426614174000';
const OTHER='123e4567-e89b-42d3-a456-426614174001';
const REQ='223e4567-e89b-42d3-a456-426614174000';
const TOKEN='c3ludGhldGlj.c3ludGhldGlj.c2lnbmF0dXJl';
const approval = Object.freeze({
  enabled:true, ownerAuthReviewed:true, privacyNoticeApproved:true,
  backendApproved:true, destructiveApiExposed:false
});
const actor = (update={}) => ({
  id:UID, userRecordId:UID, authenticated:true,role:'authenticated',
  isAnonymous:false,deleted:false,banned:false, verifiedByAuthServer:true,
  adminAccountRechecked:true,
  emailConfirmedAt:new Date(T-60000).toISOString(),
  verifiedAt:new Date(T).toISOString(),
  user_metadata:{role:'owner',admin:true},...update
});
const request = (action='queue',payload={},extra={})=>({
  method:'POST', origin:'https://daily-coach-ing.com',
  contentType:'application/json; charset=utf-8',
  authorization:'Bearer '+TOKEN,
  body:JSON.stringify({action,payload}),...extra
});
const deps = (extra={}) => ({
  release:approval,
  verifyAuthenticatedUser:async()=>actor(),
  isCurrentOwner:async()=>true,
  now:()=>T,...extra
});
let cases=0;
async function allow(data,dependencies,action,owner=UID) {
  const reply=await prepareOwnerReviewBinding(data,dependencies);
  assert.equal(reply.ok,true,JSON.stringify(reply));
  assert.equal(reply.internalOnly,true);
  assert.equal(reply.rpcName,REVIEW_RPC);
  assert.equal(reply.rpcArgs.p_owner_id,owner);
  assert.equal(reply.rpcArgs.p_action,action);
  assert.equal(Object.keys(reply.rpcArgs).sort().join(','),'p_action,p_owner_id,p_payload');
  assert.equal('authorization' in reply,false);
  assert.equal('serviceKey' in reply,false);
  assert.equal(JSON.stringify(reply).includes(TOKEN),false);
  cases++;
  return reply;
}
async function deny(data,dependencies,code) {
  const response=await prepareOwnerReviewBinding(data,dependencies);
  assert.equal(response.ok,false,JSON.stringify(response));
  assert.equal(response.code,code,`Expected ${code}, got ${JSON.stringify(response)}`);
  assert(!('rpcArgs' in response),'No denied request may prepare privileged RPC args');
  cases++;
}
await allow(request(),deps(),'queue');
await allow(request('preview',{requestId:REQ.toUpperCase()}),deps(),'preview');
await allow(request('start-review',{requestId:REQ,confirmed:true}),deps(),'start-review');
{
  const rep=await prepareOwnerReviewBinding(request('start-review',{requestId:REQ,confirmed:true}),deps());
  assert.deepEqual(rep.rpcArgs.p_payload,{requestId:REQ,confirmed:true});
  cases++;
}

// Current server release state: NO privilege check or RPC planning is allowed.
{
  let verifications=0,lookups=0;
  const policy=deps({release:DEFAULT_RELEASE,
    verifyAuthenticatedUser:async()=>{verifications++;return actor();},
    isCurrentOwner:async()=>{lookups++;return true;}});
  await deny(request(),policy,'REVIEW_NOT_RELEASED');
  assert.equal(verifications,0);assert.equal(lookups,0);
  cases++;
}
for(const key of ['enabled','ownerAuthReviewed','privacyNoticeApproved','backendApproved']) {
  await deny(request(),deps({release:{...approval,[key]:false}}),'REVIEW_NOT_RELEASED');
}
await deny(request(),deps({release:{...approval,destructiveApiExposed:true}}),'REVIEW_NOT_RELEASED');
await deny(request(),deps({release:{...approval,ownerAuthReviewed:null}}),'REVIEW_NOT_RELEASED');
await deny(request(),deps({release:{...approval,approvedPrivacyNotice:true}}),'REVIEW_NOT_RELEASED');

await deny(request('queue',{}, {method:'GET'}),deps(),'METHOD_NOT_ALLOWED');
await deny(request('queue',{}, {method:'OPTIONS'}),deps(),'METHOD_NOT_ALLOWED');
await deny(request('queue',{}, {origin:'https://evil.invalid'}),deps(),'ORIGIN_BLOCKED');
await deny(request('queue',{}, {origin:null}),deps(),'ORIGIN_BLOCKED');
await deny(request('queue',{}, {contentType:'text/plain'}),deps(),'JSON_REQUIRED');
await deny(request('queue',{}, {contentType:null}),deps(),'JSON_REQUIRED');
await deny(request('queue',{}, {authorization:null}),deps(),'LOGIN_REQUIRED');
await deny(request('queue',{}, {authorization:''}),deps(),'LOGIN_REQUIRED');
await deny(request('queue',{}, {authorization:'Bearer sb_publishable_not_a_jwt'}),deps(),'INVALID_USER_TOKEN');
await deny(request('queue',{}, {authorization:'Bearer '+ 'x'.repeat(8195)}),deps(),'INVALID_USER_TOKEN');
await deny(request('queue',{}, {body:'{malformed'}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('queue',{}, {body:JSON.stringify({action:'queue'})}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('queue',{}, {body:JSON.stringify({action:'queue',payload:{},ownerId:UID})}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('queue',{}, {body:JSON.stringify({action:'queue',payload:{},role:'owner'})}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('queue',{ownerId:UID}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('queue',{p_owner_id:UID}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('queue',{p_user_id:UID}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('queue',{metadata:{owner:true}}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('preview',{}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('preview',{requestId:'not-uuid'}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('preview',{requestId:OTHER.slice(0,14)+'3'+OTHER.slice(15)}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('preview',{requestId:REQ,confirmed:true}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('start-review',{requestId:REQ}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('start-review',{requestId:REQ,confirmed:'true'}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('start-review',{requestId:REQ,confirmed:false}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('start-review',{requestId:REQ,confirmed:true,nonce:'x'}),deps(),'INVALID_REVIEW_REQUEST');
for(const action of ['approve-journal','execute-journal','delete','enable-erasure','add-owner','reset-review']) {
  await deny(request(action,{}),deps(),'INVALID_REVIEW_REQUEST');
}
await deny(request('queue',{}, {body:' '.repeat(3001)}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('queue',{}, {body:JSON.stringify({action:'queue',payload:['x']})}),deps(),'INVALID_REVIEW_REQUEST');
await deny(request('queue',{}, {body:JSON.stringify({action:'queue',payload:null})}),deps(),'INVALID_REVIEW_REQUEST');

for(const wrong of [
 {id:OTHER},
 {authenticated:false},
 {role:'owner'},
 {role:'anon'},
 {isAnonymous:true},
 {deleted:true},
 {banned:true},
 {verifiedByAuthServer:false},
 {adminAccountRechecked:false},
 {userRecordId:OTHER},
 {verifiedAt:new Date(T-31000).toISOString()},
 {verifiedAt:new Date(T+6000).toISOString()},
 {emailConfirmedAt:new Date(T+60000).toISOString()},
 {emailConfirmedAt:'no-date'},
 {verifiedAt:'bad-date'},
]) {
  await deny(request(),deps({verifyAuthenticatedUser:async()=>actor(wrong)}),'USER_NOT_ELIGIBLE');
}
await deny(request(),deps({verifyAuthenticatedUser:async()=>{throw Error('revoked session');}}),'AUTH_VERIFICATION_FAILED');
await deny(request(),deps({verifyAuthenticatedUser:async()=>null}),'USER_NOT_ELIGIBLE');
await deny(request(),deps({verifyAuthenticatedUser:async()=>actor(),isCurrentOwner:async()=>false}),'OWNER_REQUIRED');
await deny(request(),deps({verifyAuthenticatedUser:async()=>actor(),isCurrentOwner:async()=>null}),'OWNER_REQUIRED');
await deny(request(),deps({verifyAuthenticatedUser:async()=>actor(),isCurrentOwner:async()=>{throw Error('DB unavailable');}}),'OWNER_MEMBERSHIP_UNAVAILABLE');
await deny(request(),deps({verifyAuthenticatedUser:null}),'OWNER_SERVER_NOT_CONFIGURED');
await deny(request(),deps({isCurrentOwner:null}),'OWNER_SERVER_NOT_CONFIGURED');

// Identity and owner role are checked FRESH on every request and never cached.
{
  let authCalls=0,ownerCalls=0,role=true;
  const d=deps({verifyAuthenticatedUser:async()=>{authCalls++;return actor();},
   isCurrentOwner:async()=>{ownerCalls++;return role;}});
  await allow(request(),d,'queue');
  role=false;
  await deny(request(),d,'OWNER_REQUIRED');
  assert.equal(authCalls,2);
  assert.equal(ownerCalls,2);
  cases++;
}

// Metadata claiming owner must NEVER substitute for DB membership.
{
 const roleClaim=actor({user_metadata:{role:'owner',is_admin:true}});
 await deny(request(),deps({verifyAuthenticatedUser:async()=>roleClaim,isCurrentOwner:async()=>false}),'OWNER_REQUIRED');
}

// Replay/stale proof rejection.
await deny(request(),deps({verifyAuthenticatedUser:async()=>actor({verifiedAt:new Date(T-40000).toISOString()})}),'USER_NOT_ELIGIBLE');

// Binding source must still be from verified user even when action body differs.
const verification=await allow(request('preview',{requestId:REQ.toUpperCase()}),deps(),'preview');
assert.equal(verification.rpcArgs.p_owner_id,UID);
assert.deepEqual(verification.rpcArgs.p_payload,{requestId:REQ});
cases++;

// The audited common RPC helper forces p_user_id and has NO owner RPC allowance.
// P4-B must not modify it or add owner grants via this test fixture.
const common = await readFile('integration/nal-stabilization-04/reference/nal-read-auth.mjs','utf8');
assert(common.includes("...args,p_user_id:verified.user_id"));
assert(!common.includes("'nal_read_privacy_admin'"));
cases++;
const staticFlags=JSON.parse(await readFile('nal/data/read-privacy-review.release.json','utf8'));
assert.equal(staticFlags.ownerAuthBindingReviewed,false);
assert.equal(staticFlags.backendDeployed,false);
assert.equal(staticFlags.uiEnabled,false);
cases++;

console.log(`NAL P4-B owner identity-to-RPC protocol simulation PASS: ${cases} cases, no network, no auth tokens, no privilege grants or DB writes`);
