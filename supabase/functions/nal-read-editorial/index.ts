import {createReadAuthBoundary} from '../_shared/nal-read-auth.mjs';
import {createDocumentHandler} from '../_shared/nal-read-document-http.mjs';
const base=Deno.env.get('SUPABASE_URL')||'';
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const origins=(Deno.env.get('NAL_ALLOWED_ORIGINS')||'https://daily-coach-ing.com').split(',').map(v=>v.trim()).filter(Boolean);
// Editorial can be enabled separately from participant release. SQL still requires existing owner/operator membership.
const enabled=Deno.env.get('NAL_READ_EDITORIAL_ENABLED')==='true'&&Boolean(base&&publicKey&&serviceKey);
Deno.serve((request:Request)=>{
 const auth=createReadAuthBoundary({base,publicKey,serviceKey});
 return createDocumentHandler({kind:'editorial',enabled,origins,authenticate:(token:string)=>auth.authenticate(token),
  operate:(id:string,slug:string,action:string,payload:Record<string,unknown>)=>
   auth.rpc(id,'nal_read_editorial',{p_season_slug:slug,p_action:action,p_payload:payload})})(request);
});
