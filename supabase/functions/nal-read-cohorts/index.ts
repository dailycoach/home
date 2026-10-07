import {createReadAuthBoundary} from '../_shared/nal-read-auth.mjs';
import {createCohortHandler} from './handler.mjs';
const base=Deno.env.get('SUPABASE_URL')||'',publicKey=Deno.env.get('SUPABASE_ANON_KEY')||'',serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const enabled=Deno.env.get('NAL_COHORTS_ENABLED')==='true'&&/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(base)&&Boolean(publicKey&&serviceKey);
const origins=(Deno.env.get('NAL_ALLOWED_ORIGINS')||'https://daily-coach-ing.com').split(',').map(v=>v.trim()).filter(Boolean);
Deno.serve((req:Request)=>{
 const auth=createReadAuthBoundary({base,publicKey,serviceKey});
 return createCohortHandler({enabled,origins,authenticate:(token:string)=>auth.authenticate(token),
  list:async(program:string|null,season:string|null)=>{
   const r=await fetch(base+'/rest/v1/rpc/nal_read_cohorts_public',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},
    body:JSON.stringify({p_program_key:program,p_season_slug:season})});
   if(!r.ok)throw new Error('Cohort catalog unavailable');return r.json();
  },
  operate:(id:string,admin:boolean,action:string,payload:unknown)=>auth.rpc(id,admin?'nal_read_cohort_admin':'nal_read_cohort_user',{p_action:action,p_payload:payload})
 })(req);
});
