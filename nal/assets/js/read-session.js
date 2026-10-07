(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s);
 const slug=document.body.dataset.season||'trend-2027';
 if(!/^[a-z0-9-]{1,120}$/.test(slug))return;
 let session=null,client=null,config=null,epoch=0,started=false;
 const controllers=new Set(),dirty=new Set(),drafts=new Set();
 const prefix='nal:read:tab-draft:';
 const root='/nal/read/'+slug+'/';
 function status(text,state=''){const el=$('[data-daily-status]');if(el){el.textContent=text||'';el.hidden=!text;el.dataset.state=state;}}
 function node(tag,text='',cls=''){const n=document.createElement(tag);if(text!==null)n.textContent=String(text);if(cls)n.className=cls;return n;}
 function link(href,text,cls='read-button secondary'){const a=node('a',text,cls);a.href=href;return a;}
 function dropTabDrafts(id){try{for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith(prefix+id+':'))sessionStorage.removeItem(k);}}catch{}}
 function clearPrivate(){
  controllers.forEach(c=>c.abort());controllers.clear();drafts.forEach(d=>d.dispose());drafts.clear();dirty.clear();
  document.querySelectorAll('[data-private-root]').forEach(el=>{el.replaceChildren();el.hidden=true;});
  document.querySelectorAll('[data-private-input]').forEach(el=>{el.value='';});
 }
 function renderAuth(){
  const login=$('[data-daily-auth]'),account=$('[data-daily-account]'),email=$('[data-daily-email]');
  if(login)login.hidden=!!session;if(account)account.hidden=!session;if(email)email.textContent=session?.user?.email||'';
 }
 function adopt(next){
  const old=session?.user?.id,newId=next?.user?.id;
  session=next;
  if(old!==newId){epoch++;if(old)dropTabDrafts(old);clearPrivate();}
  renderAuth();
  // A token refresh for the same owner must not rebuild the editing DOM.
  if(started&&old!==newId)setTimeout(()=>window.dispatchEvent(new Event('nal:session')),0);
 }
 async function json(url,options={}){
  const res=await fetch(url,{cache:'no-store',...options});const data=await res.json().catch(()=>({}));
  if(!res.ok){const e=new Error(data.error||'연결하지 못했습니다.');e.status=res.status;throw e;}return data;
 }
 async function api(kind,action,payload={}){
  if(!session?.access_token)throw Object.assign(new Error('로그인이 필요합니다.'),{status:401});
  const version=epoch,controller=new AbortController();controllers.add(controller);
  const timeout=setTimeout(()=>controller.abort(),20000);
  try{
   const body=kind==='workspace'?{action,seasonSlug:slug,payload}:{action,seasonSlug:slug,...payload};
   const data=await json(config.url+'/functions/v1/nal-read-'+kind,{method:'POST',signal:controller.signal,
    headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(version!==epoch)throw new DOMException('Session changed','AbortError');return data;
  }finally{clearTimeout(timeout);controllers.delete(controller);}
 }
 function nav(){
  const el=$('[data-read-nav]');if(!el)return;
  const current=document.body.dataset.readDailyPage||document.body.dataset.readWorkspacePage;
  for(const [key,label] of [['today','TODAY'],['journey','JOURNEY'],['try','TRY'],['live','LIVE'],['my','MY NAL']]){
   const a=link(root+key+'/',label,'read-nav-link');
   if(key===current||(key==='today'&&['day','before'].includes(current)))a.setAttribute('aria-current','page');el.append(a);
  }
 }
 function createDraft(day,step,record,onState){
  const owner=session?.user?.id,version=epoch,key=prefix+owner+':'+slug+':'+day+':'+step;
  let revision=record?.revision||0,value=record?.payload||null,saved=JSON.stringify(value),timer=null,inflight=null,closed=false;
  let localEnabled=false;const marker={};
  function localWrite(){if(!localEnabled)return;try{sessionStorage.setItem(key,JSON.stringify({value,revision,at:Date.now()}));}catch{onState('이 기기에 보관하지 못했습니다. 서버 저장을 확인해 주세요.','error');}}
  const d={
   get value(){return value;},get revision(){return revision;},get dirty(){return dirty.has(marker);},
   setLocal(enabled){localEnabled=enabled;if(enabled)localWrite();else try{sessionStorage.removeItem(key);}catch{}},
   localCandidate(){try{const raw=JSON.parse(sessionStorage.getItem(key)||'null');
    if(raw&&Date.now()-raw.at<86400000&&raw.value&&typeof raw.value==='object')return raw.value;
    if(raw)sessionStorage.removeItem(key);
   }catch{}return null;},
   set(next){if(closed)return;value=next;clearTimeout(timer);
    if(JSON.stringify(next)!==saved){dirty.add(marker);onState('작성 중 · 잠시 멈추면 저장합니다.','');localWrite();timer=setTimeout(()=>d.flush().catch(()=>{}),1100);}
    else dirty.delete(marker);
   },
   async flush(){
    clearTimeout(timer);if(closed||version!==epoch)throw new DOMException('Session changed','AbortError');
    if(inflight){await inflight;return d.flush();}
    if(!d.dirty)return;
    const snapshot=JSON.stringify(value);onState('초안을 저장하고 있습니다.','');
    inflight=api('workspace','draft-save',{dayNumber:day,stepOrder:step,revision,value:JSON.parse(snapshot)}).then(r=>{
     revision=r.revision;saved=snapshot;
     if(JSON.stringify(value)===saved){dirty.delete(marker);try{sessionStorage.removeItem(key);}catch{}onState('초안이 서버에 저장되었습니다.','ok');}
    }).catch(e=>{if(e.name!=='AbortError'){onState(e.message||'연결이 끊겼습니다. 이 화면을 닫지 말고 다시 저장해 주세요.','error');localWrite();}throw e;}).finally(()=>{inflight=null;});
    await inflight;if(d.dirty)return d.flush();
   },
   async commit(){await d.flush();if(revision===0)throw new Error('한 문장 또는 선택을 남겨주세요.');
    const r=await api('workspace','draft-commit',{dayNumber:day,stepOrder:step,revision});revision=r.revision;onState('오늘의 기록이 남았습니다.','ok');return r;
   },
   dispose(){closed=true;clearTimeout(timer);dirty.delete(marker);}
  };
  drafts.add(d);return d;
 }
 function error(e){if(e?.name==='AbortError')return;status(e.message||'연결을 다시 확인해 주세요.','error');}
 const ready=(async()=>{
  nav();
  try{
   const host=location.hostname.toLowerCase();
   config=await json(['daily-coach-ing.com','www.daily-coach-ing.com'].includes(host)?'/nal/data/backend.json':'/nal/data/read-backend.staging.json');
   if(config?.enabled!==true||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url||'')||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey||''))throw new Error('READ 개발 연결은 아직 열리지 않았습니다.');
   if(!window.supabase?.createClient)throw new Error('로그인 모듈을 불러오지 못했습니다.');
   client=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
   const current=await client.auth.getSession();adopt(current.data?.session||null);
   client.auth.onAuthStateChange((_event,next)=>adopt(next));
   $('[data-daily-auth-form]')?.addEventListener('submit',async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
    try{const email=$('[data-daily-login-email]').value.trim();const callback=new URL('/nal/read/auth/callback/',location.origin);
     callback.searchParams.set('next',location.pathname+location.search);
     const {error:e}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:callback.href,shouldCreateUser:true}});
     if(e)throw e;status('로그인 링크를 이메일로 보냈습니다. 같은 브라우저에서 열어주세요.','ok');
    }catch(e){error(e);}finally{button.disabled=false;}
   });
   $('[data-daily-signout]')?.addEventListener('click',async()=>{
    if(dirty.size&&!confirm('서버에 저장되지 않은 내용이 있습니다. 내용을 따로 보관한 뒤 로그아웃할까요?'))return;
    const old=session?.user?.id;if(old)dropTabDrafts(old);adopt(null);
    try{const {error:e}=await client.auth.signOut();if(e)throw e;location.assign('/nal/read/');}catch(e){error(e);}
   });
   started=true;if(!session)status('로그인하면 내 기록을 이어갈 수 있습니다.');return true;
  }catch(e){error(e);return false;}
 })();
 window.addEventListener('beforeunload',e=>{if(dirty.size){e.preventDefault();e.returnValue='';}});
 document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(a&&a.target!=='_blank'&&dirty.size&&!confirm('아직 저장하지 못한 내용이 있습니다. 이 화면을 떠날까요?'))e.preventDefault();});
 window.addEventListener('online',()=>{drafts.forEach(d=>{if(d.dirty)d.flush().catch(()=>{});});});
 window.NalRead={ready,root,slug,node,link,status,error,createDraft,api,
  daily:(action,payload)=>api('daily',action,payload),work:(action,payload={})=>api('workspace',action,payload),
  get user(){return session?.user||null;},get epoch(){return epoch;},
  setDirty(key,yes){if(yes)dirty.add(key);else dirty.delete(key);},
  clear:clearPrivate,
  dayHref:n=>root+(n===0?'before/':'day/?day='+n),
  date:value=>value?new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(value)):'미정'
 };
})();
