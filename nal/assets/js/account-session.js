(() => {
 'use strict';
 const $=s=>document.querySelector(s),node=(tag,text='',cls='')=>{const n=document.createElement(tag);if(text!==null)n.textContent=String(text);if(cls)n.className=cls;return n;};
 const callbacks=new Set(),controllers=new Set();let client=null,session=null,config=null,epoch=0;
 const status=(text,kind='')=>{const n=$('[data-account-status]');if(n){n.textContent=text||'';n.dataset.state=kind;n.hidden=!text;}};
 function clear(){controllers.forEach(x=>x.abort());controllers.clear();document.querySelectorAll('[data-account-private]').forEach(n=>{n.replaceChildren();n.hidden=true;});}
 function adopt(next){const prev=session?.user?.id;session=next;const changed=prev!==session?.user?.id;
  if(changed){epoch++;clear();}
  const auth=$('[data-account-auth]'),box=$('[data-account-user]'),email=$('[data-account-email]');
  if(auth)auth.hidden=!!session;if(box)box.hidden=!session;if(email)email.textContent=session?.user?.email||'';
  if(changed)queueMicrotask(()=>callbacks.forEach(fn=>fn()));
 }
 function safeNext(raw){try{const u=new URL(raw||'/nal/my/',location.origin);
  if(u.origin!==location.origin||!/^\/nal\/(?:my(?:\/|$)|shop\/read(?:\/|$)|read(?:\/|$))/.test(u.pathname))return '/nal/my/';
  for(const key of [...u.searchParams.keys()])if(!['season','program','week','view','day','step','order','product','tab','id'].includes(key))u.searchParams.delete(key);
  return u.pathname+u.search;
 }catch{return '/nal/my/';}}
 async function request(endpoint,body,timeout=20000){
  if(!session?.access_token)throw Object.assign(new Error('로그인이 필요합니다.'),{status:401});
  const owner=epoch,c=new AbortController();controllers.add(c);const timer=setTimeout(()=>c.abort(),timeout);
  try{const res=await fetch(config.url+'/functions/v1/'+endpoint,{method:'POST',cache:'no-store',signal:c.signal,
   headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await res.json().catch(()=>({}));if(owner!==epoch)throw new DOMException('Session changed','AbortError');
   if(!res.ok){if(res.status===401)adopt(null);throw Object.assign(new Error(data.error||'연결하지 못했습니다.'),{status:res.status,recoverable:data.recoverable});}return data;
  }finally{clearTimeout(timer);controllers.delete(c);}
 }
 const call=(area,action,payload={},seasonSlug)=>request('nal-account',{area,action,payload,seasonSlug});
 const pay=(action,payload={})=>request('nal-read-payments',{action,payload},60000);
 const cohort=(action,payload={})=>request('nal-read-cohorts',{action,payload});
 const companion=(action,seasonSlug,payload={})=>request('nal-read-companion',{action,seasonSlug,payload});
 // BUILD13: reuse the authenticated request path; no new Auth client or credential access.
 const support=(action,payload={})=>request('nal-support',{action,payload});
 // BUILD35: client transport only; the owner-review Edge endpoint is not deployed.
 // Never transport approve-journal, execute-journal or any erasure-switch action.
 const privacyReview=(action,payload={})=>{
  if(!['queue','preview','start-review'].includes(action))
   return Promise.reject(new Error('이 화면에서는 요청 확인과 검토 시작만 가능합니다.'));
  return request('nal-read-privacy-admin',{action,payload});
 };
 async function publicGet(endpoint,params={}){
  await ready;if(!config)throw new Error('계정 연결 설정을 준비하고 있습니다.');
  const u=new URL(config.url+'/functions/v1/'+endpoint);for(const [k,v]of Object.entries(params))if(v!=null)u.searchParams.set(k,v);
  const r=await fetch(u,{cache:'no-store',headers:{apikey:config.publishableKey},signal:AbortSignal.timeout(15000)});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'목록을 불러오지 못했습니다.');return data;
 }
 const offers=slug=>publicGet('nal-account',{action:'offers',season:slug});
 const payConfig=()=>publicGet('nal-read-payments');
 const cohortCatalog=(program=null,season=null)=>publicGet('nal-read-cohorts',{program,season});
 const programDetail=season=>publicGet('nal-read-companion',{season});
 const ready=(async()=>{
  try{const production=['daily-coach-ing.com','www.daily-coach-ing.com'].includes(location.hostname.toLowerCase());
   const r=await fetch(production?'/nal/data/backend.json':'/nal/data/read-backend.staging.json',{cache:'no-store'});
   if(!r.ok)throw new Error('계정 연결 설정을 불러오지 못했습니다.');config=await r.json();
   if(config.enabled!==true||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url||'')||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey||''))throw new Error('MY NAL 계정 기능은 서버 연결 준비 중입니다.');
   if(!window.supabase?.createClient)throw new Error('로그인 모듈을 불러오지 못했습니다.');
   client=supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
   const {data,error}=await client.auth.getSession();if(error)throw error;adopt(data.session||null);
   client.auth.onAuthStateChange((_event,next)=>adopt(next));
   $('[data-account-login]')?.addEventListener('submit',async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;
    try{const cb=new URL('/nal/auth/callback/',location.origin);cb.searchParams.set('next',safeNext(location.pathname+location.search));
     const {error}=await client.auth.signInWithOtp({email:$('[data-account-login-email]').value.trim(),options:{emailRedirectTo:cb.href,shouldCreateUser:true}});
     if(error)throw error;status('로그인 링크를 이메일로 보냈습니다. 같은 브라우저에서 열어주세요.','ok');
    }catch(error){status(error.message,'error');}finally{b.disabled=false;}
   });
   $('[data-account-signout]')?.addEventListener('click',async()=>{adopt(null);
    try{const {error}=await client.auth.signOut();if(error)throw error;status('로그아웃했습니다.');}catch(error){status(error.message,'error');}
   });
   if(document.body.dataset.accountPage==='callback'){
    if(!session)throw new Error('로그인을 확인하지 못했습니다. MY NAL에서 다시 로그인해 주세요.');
    location.replace(safeNext(new URLSearchParams(location.search).get('next')));
   }
   return true;
  }catch(error){status(error.message,'error');return false;}
 })();
 async function download(entitlementId){
  if(!session)throw new Error('로그인이 필요합니다.');const owner=epoch;
  const res=await fetch(config.url+'/functions/v1/nal-digital-download',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({entitlementId,requestId:crypto.randomUUID()})});
  const data=await res.json().catch(()=>({}));if(owner!==epoch)throw new DOMException('Session changed','AbortError');
  if(!res.ok)throw new Error(data.error||'파일 전달을 준비하고 있습니다.');
  const u=new URL(data.downloadUrl);if(u.origin!==new URL(config.url).origin||!u.pathname.startsWith('/storage/v1/object/sign/'))throw new Error('파일 주소를 확인하지 못했습니다.');return u.href;
 }
 window.NalAccount={ready,call,offers,download,pay,payConfig,cohort,cohortCatalog,companion,programDetail,support,privacyReview,node,status,safeNext,
  get user(){return session?.user||null;},get epoch(){return epoch;},
  onChange(fn){callbacks.add(fn);return ()=>callbacks.delete(fn);},
  link(href,text,cls='nal-account-link'){const a=node('a',text,cls);a.href=href;return a;},
  date:v=>v?new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(v)):'미정',
  money:v=>v!=null&&v!==''&&Number.isFinite(Number(v))?new Intl.NumberFormat('ko-KR').format(Number(v))+'원':'가격 준비 중',
  read(slug,view='today',extra={}){const u=new URL('/nal/read/open/',location.origin);u.searchParams.set('season',slug);u.searchParams.set('view',view);for(const[k,v]of Object.entries(extra))u.searchParams.set(k,String(v));return u.pathname+u.search;}
 };
})();
