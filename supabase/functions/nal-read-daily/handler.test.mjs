import assert from "node:assert/strict";
import { createReadDailyHandler } from "./handler.mjs";
const user={id:"11111111-1111-4111-8111-111111111111"};
const origin="https://staging.example.test";
function req(body,{token="ok",requestOrigin=origin,method="POST"}={}){
  return new Request("https://edge.example.test",{method,headers:{origin:requestOrigin,authorization:token?`Bearer ${token}`:"","content-type":"application/json"},body:method==="POST"?JSON.stringify(body):undefined});
}
function make(overrides={}){
  return createReadDailyHandler({
    enabled:true,origins:[origin],
    authenticate:async t=>{if(t!=="ok")throw new Error("bad");return user;},
    bootstrap:async()=>({currentDay:0,journey:[]}),
    getDay:async(_u,_s,d)=>({dayNumber:d,steps:[]}),
    saveAnswer:async()=>({saved:true}),
    completeDay:async()=>({completed:true}),
    ...overrides
  });
}
assert.equal((await make({enabled:false})(req({action:"bootstrap",seasonSlug:"trend-2027"}))).status,503);
assert.equal((await make()(req({action:"bootstrap",seasonSlug:"trend-2027"},{token:""}))).status,401);
assert.equal((await make()(req({action:"bootstrap",seasonSlug:"bad slug"}))).status,400);
assert.equal((await make()(req({action:"bootstrap",seasonSlug:"trend-2027"}))).status,200);
assert.equal((await make()(req({action:"day",seasonSlug:"trend-2027",dayNumber:1}))).status,200);
assert.equal((await make()(req({action:"day",seasonSlug:"trend-2027",dayNumber:-1}))).status,400);
assert.equal((await make()(req({action:"save-answer",seasonSlug:"trend-2027",dayNumber:1,stepOrder:2,answerText:"hello"}))).status,200);
assert.equal((await make()(req({action:"complete-day",seasonSlug:"trend-2027",dayNumber:1}))).status,200);
assert.equal((await make({getDay:async()=>{throw new Error("Read day locked")}})(req({action:"day",seasonSlug:"trend-2027",dayNumber:2}))).status,403);
console.log("NAL READ daily handler tests passed");
