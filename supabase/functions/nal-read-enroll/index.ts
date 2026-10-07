import { createReadEnrollmentHandler } from "./handler.mjs";
import { createReadAuthBoundary } from "../_shared/nal-read-auth.mjs";

const base=Deno.env.get("SUPABASE_URL")||"";
const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const origins=(Deno.env.get("NAL_ALLOWED_ORIGINS")||"https://daily-coach-ing.com").split(",").map(v=>v.trim()).filter(Boolean);
const enabled=Deno.env.get("NAL_READ_ENABLED")==="true" && Boolean(base&&publicKey&&serviceKey);

Deno.serve((request:Request)=>{
  // Request-scoped closure; another user's concurrent call cannot reuse this identity.
  const auth=createReadAuthBoundary({base,publicKey,serviceKey});
  return createReadEnrollmentHandler({
    enabled,origins,authenticate:(token:string)=>auth.authenticate(token),
    access:(userId:string,seasonSlug:string)=>auth.rpc(userId,"nal_get_read_access",{p_season_slug:seasonSlug}),
    claim:(userId:string,seasonSlug:string,orderId:string,requestId:string)=>
      auth.rpc(userId,"nal_issue_read_enrollment",{p_season_slug:seasonSlug,p_order_id:orderId,p_request_id:requestId})
  })(request);
});
