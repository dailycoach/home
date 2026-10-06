import assert from 'node:assert/strict';
import { createReadDailyHandler } from '../supabase/functions/nal-read-daily/handler.mjs';
const origin='https://qa.example.test';
const user={id:'11111111-1111-4111-8111-111111111111'};
let calls=[];
const deps={enabled:true,origins:[origin],authenticate:async()=>user,
 bootstrap:async(...a)=>{calls.push(a);return {journey:[]};},
 getDay:async(...a)=>{calls.push(a);return {steps:[]};},
 saveAnswer:async(...a)=>{calls.push(a);return {saved:true};},
 completeDay:async(...a)=>{calls.push(a);return {completed:true};}};
const make=(override={})=>createReadDailyHandler({...deps,...override});
const request=(body,method='POST')=>new Request('https://qa.example.test/api',{method,
 headers:{origin,authorization:'Bearer synthetic-token','content-type':'application/json'},
 ...(method==='POST'?{body:JSON.stringify(body)}:{})});
const payload={action:'save-answer',seasonSlug:'trend-2027',dayNumber:0,stepOrder:1,answerText:'sample'};
let checks=0;
async function status(body,want,override={}){calls=[];const r=await make(override)(request(body));assert.equal(r.status,want);checks++;return r;}
await status(payload,200);
for(const dayNumber of [null,'0',true,{},-1,367,1.5]){
 await status({...payload,dayNumber},400);assert.equal(calls.length,0);checks++;
}
for(const stepOrder of [null,'1',true,0,101])await status({...payload,stepOrder},400);
for(const answerText of [123,{},[],true,'x'.repeat(5001)])await status({...payload,answerText},400);
for(const answerJson of [123,[],true,'text'])await status({...payload,answerJson},400);
for(const body of [null,[],1,'text'])await status(body,400);
await status({...payload,userId:'22222222-2222-4222-8222-222222222222'},200);
assert.equal(calls[0][0],user.id);checks++;
await status(payload,400,{saveAnswer:async()=>{throw new Error('Invalid answer');}});
await status({action:'complete-day',seasonSlug:'trend-2027',dayNumber:1},403,{completeDay:async()=>{throw new Error('Read day locked');}});
await status(payload,500,{saveAnswer:async()=>{throw new Error('secret internal detail');}});
const r=await status(payload,400,{saveAnswer:async()=>{const e=new Error('private DB detail');e.code='22023';throw e;}});
assert.equal((await r.text()).includes('private DB'),false);checks++;
assert.equal(r.headers.get('cache-control'),'no-store');checks++;
const large=await make()(request({...payload,extra:'x'.repeat(33000)}));assert.equal(large.status,413);checks++;
const preflight=await make()(request(null,'OPTIONS'));assert.equal(preflight.status,204);assert.equal(await preflight.text(),'');checks+=2;
console.log(`NAL-FIX-01 handler: ${checks} assertions PASS; no external API called`);
