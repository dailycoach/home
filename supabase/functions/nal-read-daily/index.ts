import { createReadDailyHandler } from "./handler.mjs";
import { createReadAuthBoundary } from "../_shared/nal-read-auth.mjs";

const base=Deno.env.get("SUPABASE_URL")||"";
const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const origins=(Deno.env.get("NAL_ALLOWED_ORIGINS")||"https://daily-coach-ing.com").split(",").map(v=>v.trim()).filter(Boolean);
const enabled=Deno.env.get("NAL_READ_ENABLED")==="true" && Boolean(base&&publicKey&&serviceKey);

Deno.serve((request:Request)=>{
  // Request-scoped closure; another user's concurrent call cannot reuse this identity.
  const auth=createReadAuthBoundary({base,publicKey,serviceKey});
  return createReadDailyHandler({
    enabled,origins,authenticate:(token:string)=>auth.authenticate(token),
    bootstrap:(userId:string,seasonSlug:string)=>auth.rpc(userId,"nal_read_bootstrap",{p_season_slug:seasonSlug}),
    getDay:(userId:string,seasonSlug:string,dayNumber:number)=>
      auth.rpc(userId,"nal_get_read_day",{p_season_slug:seasonSlug,p_day_number:dayNumber}),
    saveAnswer:(userId:string,seasonSlug:string,dayNumber:number,stepOrder:number,answerText:string|null,answerJson:unknown)=>
      auth.rpc(userId,"nal_save_read_answer",{p_season_slug:seasonSlug,p_day_number:dayNumber,p_step_order:stepOrder,p_answer_text:answerText,p_answer_json:answerJson}),
    completeDay:(userId:string,seasonSlug:string,dayNumber:number)=>
      auth.rpc(userId,"nal_complete_read_day",{p_season_slug:seasonSlug,p_day_number:dayNumber})
  })(request);
});
