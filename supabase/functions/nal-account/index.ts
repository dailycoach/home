import { createReadAuthBoundary } from '../_shared/nal-read-auth.mjs';
import { createAccountHandler } from './handler.mjs';
const base=Deno.env.get('SUPABASE_URL')||'';
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const enabled=Deno.env.get('NAL_ACCOUNT_ENABLED')==='true'&&Boolean(base&&publicKey&&serviceKey);
const origins=(Deno.env.get('NAL_ALLOWED_ORIGINS')||'https://daily-coach-ing.com').split(',').map(x=>x.trim()).filter(Boolean);
const homeRuntime={read:Deno.env.get('NAL_READ_ENABLED')==='true',companion:Deno.env.get('NAL_READ_COMPANION_ENABLED')==='true',
 cohorts:Deno.env.get('NAL_COHORTS_ENABLED')==='true',support:Deno.env.get('NAL_SUPPORT_ENABLED')==='true',
 payments:Deno.env.get('NAL_READ_PAYMENTS_ENABLED')==='true'};
// Existing editor switches only. Do not read feature/role/identity overrides from the browser.
const operationsRuntime={editorial:Deno.env.get('NAL_READ_EDITORIAL_ENABLED')==='true',companion:homeRuntime.companion,
 cohorts:homeRuntime.cohorts,support:homeRuntime.support,payments:homeRuntime.payments};
Deno.serve((req:Request)=>{
 const auth=createReadAuthBoundary({base,publicKey,serviceKey});
 return createAccountHandler({enabled,origins,authenticate:(t:string)=>auth.authenticate(t),
  catalog:async(slug:string|null)=>{
   const r=await fetch(base+'/rest/v1/rpc/nal_read_offers',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_slug:slug})});
   if(!r.ok)throw new Error('Catalog unavailable');return r.json();
  },
  operate:(id:string,area:string,action:string,slug:string,payload:Record<string,unknown>)=>{
   const name=area==='account'?'nal_account':area==='join'?'nal_read_join':'nal_read_offer_admin';
   let data:Record<string,unknown>=payload;
   if(area==='account'&&action==='home')data=homeRuntime;
   if(area==='account'&&action==='operator-home')data={query:payload,runtime:operationsRuntime};
   return auth.rpc(id,name,{p_action:action,p_payload:data,...(area==='join'?{p_season_slug:slug}:{})});
  }
 })(req);
});
