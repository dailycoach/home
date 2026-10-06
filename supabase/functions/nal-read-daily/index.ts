import { createReadDailyHandler } from "./handler.mjs";

const base=Deno.env.get("SUPABASE_URL")||"";
const publicKey=Deno.env.get("SUPABASE_ANON_KEY")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const origins=(Deno.env.get("NAL_ALLOWED_ORIGINS")||"https://daily-coach-ing.com")
  .split(",").map(v=>v.trim()).filter(Boolean);
const enabled=Deno.env.get("NAL_READ_ENABLED")==="true"
  && /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(base)
  && Boolean(publicKey&&serviceKey);

async function rpc(name:string,args:Record<string,unknown>){
  const result=await fetch(`${base}/rest/v1/rpc/${name}`,{
    method:"POST",signal:AbortSignal.timeout(10000),
    headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json"},
    body:JSON.stringify(args)
  });
  const body=await result.json().catch(()=>null);
  if(!result.ok)throw new Error(body?.message||body?.error||"Database operation unavailable");
  return body;
}

Deno.serve(createReadDailyHandler({
  enabled,
  origins,
  authenticate:async(token:string)=>{
    const result=await fetch(`${base}/auth/v1/user`,{
      signal:AbortSignal.timeout(10000),
      headers:{apikey:publicKey,Authorization:`Bearer ${token}`}
    });
    if(!result.ok)throw new Error("Invalid session");
    return result.json();
  },
  bootstrap:(userId:string,seasonSlug:string)=>
    rpc("nal_read_bootstrap",{p_user_id:userId,p_season_slug:seasonSlug}),
  getDay:(userId:string,seasonSlug:string,dayNumber:number)=>
    rpc("nal_get_read_day",{p_user_id:userId,p_season_slug:seasonSlug,p_day_number:dayNumber}),
  saveAnswer:(userId:string,seasonSlug:string,dayNumber:number,stepOrder:number,answerText:string|null,answerJson:unknown)=>
    rpc("nal_save_read_answer",{p_user_id:userId,p_season_slug:seasonSlug,p_day_number:dayNumber,p_step_order:stepOrder,p_answer_text:answerText,p_answer_json:answerJson}),
  completeDay:(userId:string,seasonSlug:string,dayNumber:number)=>
    rpc("nal_complete_read_day",{p_user_id:userId,p_season_slug:seasonSlug,p_day_number:dayNumber})
}));
