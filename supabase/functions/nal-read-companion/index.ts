import {createReadAuthBoundary} from '../_shared/nal-read-auth.mjs';
import {createCompanionHandler} from './handler.mjs';
const base=Deno.env.get('SUPABASE_URL')||'',publicKey=Deno.env.get('SUPABASE_ANON_KEY')||'',serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const enabled=Deno.env.get('NAL_READ_COMPANION_ENABLED')==='true'&&/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(base)&&Boolean(publicKey&&serviceKey);
const origins=(Deno.env.get('NAL_ALLOWED_ORIGINS')||'https://daily-coach-ing.com').split(',').map(v=>v.trim()).filter(Boolean);
Deno.serve((req:Request)=>{
 const auth=createReadAuthBoundary({base,publicKey,serviceKey});
 return createCompanionHandler({enabled,origins,authenticate:(token:string)=>auth.authenticate(token),
  publicDetail:async(slug:string)=>{
   // Explicit public-safe projection only; no dynamic RPC name or forwarded browser headers.
   const r=await fetch(base+'/rest/v1/rpc/nal_read_program_detail',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_season_slug:slug})});
   if(!r.ok)throw new Error('Program detail unavailable');return r.json();
  },
  member:(id:string,slug:string,action:string,payload:unknown)=>auth.rpc(id,'nal_read_companion',{p_season_slug:slug,p_action:action,p_payload:payload}),
  studio:(id:string,slug:string|null,action:string,payload:unknown)=>auth.rpc(id,'nal_read_studio',{p_season_slug:slug,p_action:action,p_payload:payload})
 })(req);
});
