import {createReadAuthBoundary} from '../_shared/nal-read-auth.mjs';
import {createSupportHandler} from './handler.mjs';
const base=Deno.env.get('SUPABASE_URL')||'';
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const enabled=Deno.env.get('NAL_SUPPORT_ENABLED')==='true'
 &&/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(base)&&Boolean(publicKey&&serviceKey);
const origins=(Deno.env.get('NAL_ALLOWED_ORIGINS')||'https://daily-coach-ing.com').split(',').map(x=>x.trim()).filter(Boolean);
Deno.serve((req:Request)=>{
 const auth=createReadAuthBoundary({base,publicKey,serviceKey});
 return createSupportHandler({enabled,origins,authenticate:(token:string)=>auth.authenticate(token),
  operate:(id:string,staff:boolean,action:string,payload:unknown)=>auth.rpc(id,
   staff?'nal_support_admin':'nal_support_user',{p_action:action,p_payload:payload})
 })(req);
});
