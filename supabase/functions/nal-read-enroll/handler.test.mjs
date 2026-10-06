import assert from "node:assert/strict";
import { createReadEnrollmentHandler } from "./handler.mjs";

const user={id:"11111111-1111-4111-8111-111111111111"};
const order="22222222-2222-4222-8222-222222222222";
const requestId="33333333-3333-4333-8333-333333333333";
const origin="https://staging.example.test";
function req(body,{token="ok",requestOrigin=origin,method="POST"}={}){
  return new Request("https://edge.example.test",{method,headers:{origin:requestOrigin,authorization:token?`Bearer ${token}`:"","content-type":"application/json"},body:method==="POST"?JSON.stringify(body):undefined});
}
function handler(overrides={}){
  return createReadEnrollmentHandler({enabled:true,origins:[origin],authenticate:async(token)=>{if(token!=="ok")throw new Error("bad");return user;},access:async(_u,seasonSlug)=>({allowed:true,seasonSlug,enrollmentStatus:"active"}),claim:async(_u,seasonSlug)=>({allowed:true,seasonSlug,enrollmentStatus:"active"}),...overrides});
}
assert.equal((await handler({enabled:false})(req({action:"access",seasonSlug:"trend-2027"}))).status,503);
assert.equal((await handler()(req({action:"access",seasonSlug:"trend-2027"},{token:""}))).status,401);
assert.equal((await handler()(req({action:"access",seasonSlug:"trend-2027"},{requestOrigin:"https://evil.test"}))).status,403);
assert.equal((await handler()(req({action:"access",seasonSlug:"trend-2027"}))).status,200);
assert.equal((await handler({access:async()=>({allowed:false,reason:"not_enrolled"})})(req({action:"access",seasonSlug:"trend-2027"}))).status,404);
assert.equal((await handler()(req({action:"claim",seasonSlug:"trend-2027",orderId:"bad",requestId}))).status,400);
assert.equal((await handler()(req({action:"claim",seasonSlug:"trend-2027",orderId:order,requestId}))).status,200);
assert.equal((await handler()(req({action:"wat",seasonSlug:"trend-2027"}))).status,400);
console.log("NAL READ enrollment handler tests passed");
