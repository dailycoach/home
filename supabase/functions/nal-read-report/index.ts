import {createReadAuthBoundary} from '../_shared/nal-read-auth.mjs';
import {createDocumentHandler} from '../_shared/nal-read-document-http.mjs';
const base=Deno.env.get('SUPABASE_URL')||'';
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const origins=(Deno.env.get('NAL_ALLOWED_ORIGINS')||'https://daily-coach-ing.com').split(',').map(v=>v.trim()).filter(Boolean);
const enabled=Deno.env.get('NAL_READ_ENABLED')==='true'&&Boolean(base&&publicKey&&serviceKey);
Deno.serve((request:Request)=>{
 const auth=createReadAuthBoundary({base,publicKey,serviceKey});
 return createDocumentHandler({kind:'report',enabled,origins,authenticate:(token:string)=>auth.authenticate(token),
  operate:(id:string,slug:string,action:string,payload:Record<string,unknown>)=>
   auth.rpc(id,'nal_read_report',{p_season_slug:slug,p_action:action,p_payload:payload})})(request);
});
