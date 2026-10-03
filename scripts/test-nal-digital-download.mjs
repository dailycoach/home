import assert from 'node:assert/strict';
import { createDownloadHandler } from '../supabase/functions/nal-digital-download/handler.mjs';
let checks=0;
const entitlementId='60000000-0000-4000-8000-000000000001', requestId='20000000-0000-4000-8000-000000000001';
const actor={id:'00000000-0000-4000-8000-000000000001',email_confirmed_at:'2026-10-03T00:00:00Z'};
const origin='https://daily-coach-ing.com';
const now=Date.parse('2026-10-03T12:00:00Z');
const grant={bucket_id:'nal-products-private',object_path:'qa-product/v1/original.pdf',download_name:'qa.pdf',expires_at:new Date(now+600000).toISOString()};
const calls=[];
const deps={enabled:true,origins:[origin],now:()=>now,authenticate:async()=>actor,reserve:async(...args)=>{calls.push(['reserve',...args]);return grant;},sign:async(...args)=>{calls.push(['sign',...args]);return 'https://project.supabase.co/storage/v1/object/sign/qa?token=test';},finish:async(...args)=>{calls.push(['finish',...args]);return args.at(-1);}};
function request({method='POST',headers={},body={entitlementId,requestId}}={}) {return new Request('https://project.supabase.co/functions/v1/nal-digital-download',{method,headers:{Origin:origin,Authorization:'Bearer verified-token','Content-Type':'application/json',...headers},body:['GET','OPTIONS'].includes(method)?undefined:JSON.stringify(body)});}
async function status(expected,overrides={},input={}) {const result=await createDownloadHandler({...deps,...overrides})(request(input));assert.equal(result.status,expected);checks++;return result;}
await status(503,{enabled:false});await status(405,{}, {method:'GET'});await status(204,{}, {method:'OPTIONS'});
await status(403,{}, {headers:{Origin:'https://hostile.test'}});await status(401,{}, {headers:{Authorization:''}});
await status(401,{authenticate:async()=>({...actor,email_confirmed_at:null})});await status(401,{authenticate:async()=>({...actor,is_anonymous:true})});
await status(415,{}, {headers:{'Content-Type':'text/plain'}});await status(400,{}, {body:{entitlementId,requestId,userId:'forged'}});await status(400,{}, {body:{entitlementId:'bad',requestId}});
await status(403,{reserve:async()=>{throw Error('Other owner');}});
let result=await status(200);let payload=await result.json();assert.deepEqual(Object.keys(payload).sort(),['downloadUrl','expiresAt']);checks++;
assert.equal(result.headers.get('cache-control'),'no-store');checks++;assert.equal(result.headers.get('access-control-allow-origin'),origin);checks++;
assert(calls.some(c=>c[0]==='reserve'&&c[1]===actor.id));checks++;assert(calls.some(c=>c[0]==='sign'&&c[3]===600));checks++;
calls.length=0;await status(503,{sign:async()=>{throw Error('Storage');}});assert(calls.some(c=>c[0]==='finish'&&c.at(-1)===false));checks++;
calls.length=0;await status(503,{reserve:async()=>({...grant,bucket_id:'public'})});assert(calls.some(c=>c[0]==='finish'&&c.at(-1)===false));checks++;
await status(403,{reserve:async()=>({...grant,expires_at:'invalid'})});await status(403,{reserve:async()=>({...grant,expires_at:new Date(now-1).toISOString()})});
await status(503,{finish:async()=>false});
calls.length=0;await status(200,{reserve:async()=>({...grant,expires_at:new Date(now+30000).toISOString()})});assert(calls.some(c=>c[0]==='sign'&&c[3]===30));checks++;
console.log(`NAL digital download handler: ${checks} HTTP/auth/expiry/privacy/failure checks passed (mocked Auth and Storage).`);
