/* BUILD16 — participant feedback, explicit recovery and existing authenticated transport. */
(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s);
 const slug=document.body.dataset.season||'trend-2027';
 if(!/^[a-z0-9-]{1,120}$/.test(slug))return;
 let session=null,client=null,config=null,epoch=0,started=false,needsLogin=false,unloadBound=false;
 const controllers=new Set(),dirty=new Set(),drafts=new Set(),requests=new Map();
 const prefix='nal:read:tab-draft:',root='/nal/read/'+slug+'/';
 const reads={daily:new Set(['bootstrap']),workspace:new Set(['drafts','experiments','live','archive']),report:new Set(['source','list','open'])};
 const writes={'draft-save':'초안을 저장하고 있습니다.','draft-commit':'답변을 기록하고 있습니다.','complete-day':'오늘 기록을 마치고 있습니다.',
  'experiment-save':'실험 기록을 저장하고 있습니다.','experiment-from-answer':'내 답과 실험을 연결하고 있습니다.',
  'live-save':'개인 대화 메모를 저장하고 있습니다.','live-join':'입장 정보와 메모 버전을 확인하고 있습니다.',
  mark:'중요한 문장 표시를 저장하고 있습니다.',save:'이 시점의 리포트를 보관하고 있습니다.',day:'질문을 열고 이어갈 위치를 확인하고 있습니다.'};
 const hasWrites=()=>[...requests.values()].some(r=>r.write);
 function node(tag,text='',cls=''){const n=document.createElement(tag);if(text!==null)n.textContent=String(text);if(cls)n.className=cls;return n;}
 function link(href,text,cls='read-button secondary'){const a=node('a',text,cls);a.href=href;return a;}
 function status(text,state=''){
  const n=$('[data-daily-status]');if(n){n.textContent=text||'';n.hidden=!text;n.dataset.state=state;}
  const recovery=$('[data-read-recovery]');if(recovery)recovery.hidden=!(text&&state==='error');
 }
 function beforeUnload(e){if(dirty.size||hasWrites()){e.preventDefault();e.returnValue='';}}
 function activity(){
  const list=[...requests.values()],mutation=list.find(r=>r.write),n=$('[data-read-activity]');
  if(n){n.textContent=mutation?mutation.label:list.length?'내 기록을 불러오고 있습니다.':'';n.hidden=!list.length;}
  const unsaved=$('[data-read-unsaved]');
  if(unsaved){unsaved.textContent=dirty.size?'아직 저장하지 않았거나 저장 결과를 확인할 내용이 있습니다. 이 화면을 닫기 전에 확인해 주세요.':'';unsaved.hidden=!dirty.size;}
  const guarded=!!dirty.size||hasWrites();
  if(guarded!==unloadBound){window[guarded?'addEventListener':'removeEventListener']('beforeunload',beforeUnload);unloadBound=guarded;}
  const shell=$('[data-read-shell]');if(shell)shell.dataset.readBusy=hasWrites()?'true':'false';
 }
 function setDirty(key,yes){if(yes)dirty.add(key);else dirty.delete(key);activity();}
 function errorText(e){
  if(e?.status===409)return '다른 탭에서 기록이 바뀌었습니다. 이 화면의 내용을 따로 보관한 뒤 최신 기록을 다시 열어주세요. 자동으로 덮어쓰지 않습니다.';
  if(e?.status===401)return '로그인을 다시 확인해 주세요. 현재 작성 중인 내용은 먼저 따로 보관해 주세요.';
  if(e?.status===403)return '현재 참가권이나 질문 공개 상태로 이 작업을 할 수 없습니다. MY NAL에서 확인해 주세요. 다시 결제할 필요는 없습니다.';
  if(e?.status===429)return '요청이 잠시 몰렸습니다. 작성한 내용을 유지한 채 잠시 후 같은 작업을 다시 시도해 주세요.';
  if(e?.name==='TimeoutError'||e?.code==='NETWORK'||e?.code==='INVALID_RESPONSE')return e.write?
   '저장 응답을 확인하지 못했습니다. 서버에 반영됐을 수도 있습니다. 내용을 보관하고 같은 기록의 상태를 확인해 주세요.':
   '기록을 불러오지 못했습니다. 기록이 없다는 뜻은 아닙니다. 연결을 확인한 뒤 다시 불러와 주세요.';
  if(e?.status>=500)return '서버 응답을 확인하지 못했습니다. 작성 중인 내용은 보관해 두고, 연결을 확인한 뒤 다시 시도해 주세요.';
  return e?.message||'작업 결과를 확인하지 못했습니다. 작성한 내용을 보관한 뒤 다시 확인해 주세요.';
 }
 function error(e){if(e?.name==='AbortError')return;status(errorText(e),'error');}
 function dropTabDrafts(id){try{for(let i=sessionStorage.length-1;i>=0;i--){const k=sessionStorage.key(i);if(k?.startsWith(prefix+id+':'))sessionStorage.removeItem(k);}}catch{}}
 function clearPrivate(){
  controllers.forEach(c=>c.abort());controllers.clear();requests.clear();drafts.forEach(d=>d.dispose());drafts.clear();dirty.clear();
  document.querySelectorAll('[data-private-root]').forEach(n=>{n.replaceChildren();n.hidden=true;});
  document.querySelectorAll('[data-private-input]').forEach(n=>{n.value='';});status('');activity();
 }
 function renderAuth(){
  const login=$('[data-daily-auth]'),account=$('[data-daily-account]'),email=$('[data-daily-email]');
  if(login)login.hidden=!!session&&!needsLogin;if(account)account.hidden=!session;if(email)email.textContent=session?.user?.email||'';
 }
 function adopt(next){
  const old=session?.user?.id,newId=next?.user?.id;session=next;needsLogin=false;
  if(old!==newId){epoch++;if(old)dropTabDrafts(old);clearPrivate();}
  renderAuth();
  // Refreshing this owner's token must not replace the editing DOM.
  if(started&&old!==newId)setTimeout(()=>window.dispatchEvent(new Event('nal:session')),0);
 }
 async function json(url,options={}){
  const res=await fetch(url,{cache:'no-store',...options});let data;
  try{data=await res.json();}catch{
   if(options.signal?.aborted)throw options.signal.reason||new DOMException('Aborted','AbortError');
   throw Object.assign(new Error('Invalid response'),{code:'INVALID_RESPONSE',status:res.ok?undefined:res.status});
  }
  if(!res.ok){const e=new Error(typeof data?.error==='string'?data.error:'연결하지 못했습니다.');e.status=res.status;throw e;}
  if(data===null||typeof data!=='object')throw Object.assign(new Error('Invalid response'),{code:'INVALID_RESPONSE'});
  return data;
 }
 async function api(kind,action,payload={}){
  if(!session?.access_token)throw Object.assign(new Error('로그인이 필요합니다.'),{status:401});
  const version=epoch,controller=new AbortController(),token={},write=!reads[kind]?.has(action);let timedOut=false;
  controllers.add(controller);requests.set(token,{write,label:writes[action]||'요청을 처리하고 있습니다.'});activity();
  const timeout=setTimeout(()=>{timedOut=true;controller.abort();},20000);
  try{
   const body=kind==='workspace'?{action,seasonSlug:slug,payload}:{action,seasonSlug:slug,...payload};
   const data=await json(config.url+'/functions/v1/nal-read-'+kind,{method:'POST',signal:controller.signal,
    headers:{apikey:config.publishableKey,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(version!==epoch)throw new DOMException('Session changed','AbortError');return data;
  }catch(e){
   if(version!==epoch)throw new DOMException('Session changed','AbortError');
   if(timedOut)throw Object.assign(new Error('Response timeout'),{name:'TimeoutError',write});
   if(e?.status===401){needsLogin=true;renderAuth();}
   if(e?.name==='TypeError')throw Object.assign(new Error('Network response unavailable'),{code:'NETWORK',write});
   if(e&&typeof e==='object')e.write=write;throw e;
  }finally{clearTimeout(timeout);controllers.delete(controller);requests.delete(token);activity();}
 }
 function nav(){
  const target=$('[data-read-nav]');if(!target)return;target.replaceChildren();
  const current=document.body.dataset.readDailyPage||document.body.dataset.readWorkspacePage;
  for(const [key,title,label] of [['today','TODAY','오늘'],['journey','JOURNEY','질문 여정'],['try','TRY','작은 실험'],['live','LIVE','함께 대화'],['my','MY NAL','내 문장']]){
   const a=link(root+key+'/',title,'read-nav-link');a.setAttribute('aria-label',title+' · '+label);a.append(node('span',label,'read-nav-caption'));
   if(key===current||(key==='today'&&['day','before'].includes(current))||(key==='my'&&current==='report'))a.setAttribute('aria-current','page');target.append(a);
  }
 }
 function mayLeave(){
  if(hasWrites()){status('저장·처리 결과를 확인 중입니다. 결과가 표시된 뒤 이동해 주세요.','error');return false;}
  return !dirty.size||confirm('아직 저장하지 않았거나 저장 결과를 확인할 내용이 있습니다. 필요한 문장을 따로 보관한 뒤 이 화면을 떠날까요?');
 }
 function focus(target,scroll=false){if(!target)return;target.tabIndex=-1;target.focus({preventScroll:true});if(scroll)target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
 function createDraft(day,step,record,onState){
  const owner=session?.user?.id,version=epoch,key=prefix+owner+':'+slug+':'+day+':'+step;
  let revision=record?.revision||0,value=record?.payload||null,saved=JSON.stringify(value),timer=null,inflight=null,closed=false;
  let localEnabled=false,held=null,committed=record?.committed===true;
  let lastState={text:revision?committed?'이 답변은 기록되어 있습니다. 오늘 기록 마치기는 별도입니다.':'초안이 저장되어 있습니다. 기록하고 계속을 누르면 답변으로 남습니다.':'작성하면 초안으로 저장합니다.',state:revision?'ok':''};
  const marker={};
  function emit(text,state=''){if(closed||version!==epoch)return;lastState={text,state};onState(text,state);}
  function localWrite(){if(!localEnabled)return;try{sessionStorage.setItem(key,JSON.stringify({value,revision,at:Date.now()}));}
   catch{emit('이 탭에 보관하지 못했습니다. 공용 기기를 피하고 서버 저장 상태를 확인해 주세요.','error');}}
  function hold(e){if(closed||version!==epoch||e?.name==='AbortError')return;held=e;setDirty(marker,true);localWrite();emit(errorText(e),'error');error(e);}
  const d={
   get value(){return value;},get revision(){return revision;},get dirty(){return dirty.has(marker);},
   get state(){return lastState;},get localEnabled(){return localEnabled;},
   get conflicted(){return held?.status===409;},get retryable(){return !closed&&!!held&&held.status!==409;},
   setLocal(enabled){localEnabled=enabled;if(enabled)localWrite();else try{sessionStorage.removeItem(key);}catch{}},
   localCandidate(){try{const raw=JSON.parse(sessionStorage.getItem(key)||'null');
    if(raw&&Number.isFinite(raw.at)&&Date.now()>=raw.at&&Date.now()-raw.at<86400000&&raw.value&&typeof raw.value==='object'&&!Array.isArray(raw.value))return raw.value;
    if(raw)sessionStorage.removeItem(key);
   }catch{}return null;},
   set(next){
    if(closed)return;value=next;clearTimeout(timer);
    if(held){setDirty(marker,true);localWrite();emit(errorText(held),'error');return;}
    if(JSON.stringify(next)!==saved||inflight){setDirty(marker,true);committed=false;emit('작성 중입니다. 잠시 멈추면 초안을 저장합니다.');localWrite();timer=setTimeout(()=>d.flush().catch(()=>{}),1100);}
    else{setDirty(marker,false);emit(committed?'이 답변은 기록되어 있습니다.':'현재 초안이 저장되어 있습니다.',revision?'ok':'');}
   },
   async flush(){
    clearTimeout(timer);if(closed||version!==epoch)throw new DOMException('Session changed','AbortError');
    if(inflight){await inflight;return d.flush();}if(held)throw held;if(!d.dirty)return;
    const snapshot=JSON.stringify(value);emit('초안을 저장하고 있습니다.');
    inflight=api('workspace','draft-save',{dayNumber:day,stepOrder:step,revision,value:JSON.parse(snapshot)}).then(r=>{
     if(closed||version!==epoch)throw new DOMException('Session changed','AbortError');
     if(!Number.isInteger(r.revision)||r.revision<1)throw Object.assign(new Error('Invalid save response'),{code:'INVALID_RESPONSE',write:true});
     revision=r.revision;saved=snapshot;committed=false;const changed=JSON.stringify(value)!==saved;setDirty(marker,changed);
     if(!changed){try{sessionStorage.removeItem(key);}catch{}emit('초안이 저장되었습니다. 기록하고 계속을 누르면 답변으로 남습니다.','ok');}
    }).catch(e=>{hold(e);throw e;}).finally(()=>{inflight=null;});
    await inflight;if(d.dirty)return d.flush();
   },
   async retry(){if(held?.status===409)throw held;held=null;return d.flush();},
   async commit(){
    await d.flush();if(revision===0)throw new Error('한 문장 또는 선택을 남겨주세요.');
    emit('답변으로 기록하고 있습니다.');
    try{const r=await api('workspace','draft-commit',{dayNumber:day,stepOrder:step,revision});
     if(closed||version!==epoch)throw new DOMException('Session changed','AbortError');
     if(!Number.isInteger(r.revision)||r.revision<1)throw Object.assign(new Error('Invalid record response'),{code:'INVALID_RESPONSE',write:true});
     revision=r.revision;committed=true;setDirty(marker,false);emit('답변이 기록되었습니다. 오늘 기록 마치기는 마지막 화면에서 선택합니다.','ok');return r;
    }catch(e){hold(e);throw e;}
   },
   dispose(){closed=true;clearTimeout(timer);dirty.delete(marker);drafts.delete(d);activity();}
  };
  drafts.add(d);return d;
 }
 const ready=(async()=>{
  nav();
  $('[data-read-reload]')?.addEventListener('click',()=>{if(mayLeave())location.reload();});
  $('[data-read-login-focus]')?.addEventListener('click',()=>{needsLogin=true;renderAuth();const input=$('[data-daily-login-email]');if(input){input.focus();input.scrollIntoView({block:'center'});}});
  try{
   const host=location.hostname.toLowerCase();
   config=await json(['daily-coach-ing.com','www.daily-coach-ing.com'].includes(host)?'/nal/data/backend.json':'/nal/data/read-backend.staging.json');
   if(config?.enabled!==true||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url||'')||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey||''))throw new Error('READ 연결은 아직 준비 중입니다.');
   if(!window.supabase?.createClient)throw new Error('로그인 모듈을 불러오지 못했습니다.');
   client=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
   const current=await client.auth.getSession();if(current.error)throw current.error;adopt(current.data?.session||null);
   client.auth.onAuthStateChange((_event,next)=>adopt(next));
   $('[data-daily-auth-form]')?.addEventListener('submit',async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
    try{const email=$('[data-daily-login-email]').value.trim(),callback=new URL('/nal/read/auth/callback/',location.origin);
     callback.searchParams.set('next',location.pathname+location.search);
     const {error:e}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:callback.href,shouldCreateUser:true}});
     if(e)throw e;status('로그인 링크를 이메일로 보냈습니다. 같은 브라우저에서 열어주세요.','ok');
    }catch(e){error(e);}finally{button.disabled=false;}
   });
   $('[data-daily-signout]')?.addEventListener('click',async()=>{
    if(!mayLeave())return;const old=session?.user?.id;if(old)dropTabDrafts(old);adopt(null);
    try{const {error:e}=await client.auth.signOut();if(e)throw e;location.assign('/nal/read/');}catch(e){error(e);}
   });
   started=true;if(!session)status('로그인하면 내 기록을 이어갈 수 있습니다.');return true;
  }catch(e){error(e);return false;}
 })();
 document.addEventListener('click',e=>{
  const a=e.target instanceof Element?e.target.closest('a[href]'):null;
  if(!a||e.defaultPrevented||a.target==='_blank'||a.hasAttribute('download')||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const destination=new URL(a.href,location.origin);if(destination.origin===location.origin&&destination.pathname===location.pathname&&destination.search===location.search&&destination.hash)return;
  if(!mayLeave()){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 function networkHint(){
  const hint=$('[data-read-network]');if(hint){hint.hidden=navigator.onLine!==false;hint.textContent='기기가 네트워크 끊김을 알렸습니다. 작성한 내용을 유지하고 연결 상태를 확인해 주세요.';}
 }
 window.addEventListener('offline',networkHint);
 window.addEventListener('online',()=>{networkHint();if(dirty.size)status('기기가 연결 복구를 알렸습니다. 저장 실패가 있었다면 내용을 확인하고 직접 다시 저장해 주세요.');});
 networkHint();activity();
 window.NalRead={ready,root,slug,node,link,status,error,errorText,createDraft,api,focus,mayLeave,
  daily:(action,payload)=>api('daily',action,payload),work:(action,payload={})=>api('workspace',action,payload),
  get user(){return session?.user||null;},get epoch(){return epoch;},get pendingWrite(){return hasWrites();},
  setDirty,clear:clearPrivate,dayHref:n=>root+(n===0?'before/':'day/?day='+n),
  date:value=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(value)):'미정'
 };
})();
