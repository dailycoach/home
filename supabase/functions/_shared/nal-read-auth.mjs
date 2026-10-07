/** Create a fresh boundary for EACH HTTP request. No token is logged or stored. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RPCS=new Set(['nal_get_read_access','nal_issue_read_enrollment','nal_read_bootstrap','nal_get_read_day','nal_save_read_answer','nal_complete_read_day','nal_read_workspace','nal_read_editorial','nal_read_report']);
const INVALID=()=>new Error('Invalid session');
const validDate=v=>typeof v==='string'&&v.length<50&&Number.isFinite(Date.parse(v));
function eligible(user,now){
 if(!user||typeof user!=='object'||!UUID.test(user.id||'')||user.role!=='authenticated'
  ||user.is_anonymous!==false||typeof user.email!=='string'||!user.email.includes('@')
  ||!validDate(user.email_confirmed_at)||Date.parse(user.email_confirmed_at)>now||user.deleted_at!=null)return false;
 return user.banned_until==null||(validDate(user.banned_until)&&Date.parse(user.banned_until)<=now);
}
export function createReadAuthBoundary({base,publicKey,serviceKey,fetcher=fetch,clock=Date.now}){
 let verified=null;
 async function authJson(url,headers){
  const result=await fetcher(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers});
  if(!result.ok)throw INVALID();return result.json();
 }
 return {
  async authenticate(token){
   verified=null;
   if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(base)||!publicKey||!serviceKey)throw new Error('READ server configuration unavailable');
   if(typeof token!=='string'||!token||token.length>8192)throw INVALID();
   const live=await authJson(`${base}/auth/v1/user`,{apikey:publicKey,Authorization:`Bearer ${token}`});
   if(!eligible(live,clock()))throw INVALID();
   const account=await authJson(`${base}/auth/v1/admin/users/${live.id}`,{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`});
   if(account.id!==live.id||!eligible(account,clock()))throw INVALID();
   verified=Object.freeze({user_id:account.id.toLowerCase(),email_confirmed_at:account.email_confirmed_at,
    is_anonymous:false,deleted_at:null,banned_until:account.banned_until??null,verified_at:new Date(clock()).toISOString()});
   return {id:verified.user_id};
  },
  async rpc(userId,name,args={}){
   if(!verified||userId!==verified.user_id||clock()-Date.parse(verified.verified_at)>30000
    ||clock()<Date.parse(verified.verified_at)-5000)throw INVALID();
   if(!RPCS.has(name)||!args||typeof args!=='object'||Array.isArray(args)
    ||(Object.hasOwn(args,'p_user_id')&&args.p_user_id!==userId))throw new Error('Invalid READ operation');
   const result=await fetcher(`${base}/rest/v1/rpc/${name}`,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json',
     'x-nal-read-verified':JSON.stringify(verified)},body:JSON.stringify({...args,p_user_id:verified.user_id})
   });
   const body=await result.json().catch(()=>null);
   if(!result.ok){const error=new Error(body?.message||'Read operation unavailable');error.code=body?.code;throw error;}
   return body;
  }
 };
}
