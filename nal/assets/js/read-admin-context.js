/* BUILD18: same-tab navigation context, not a role, entitlement or mutable record.
 * No storage, SDK, credentials, page diagnostics or automatic mutation. */
(() => {
 'use strict';
 const paths=new Set(['/nal/read/admin/','/nal/read/admin/home/','/nal/read/admin/studio/','/nal/read/admin/cohorts/','/nal/read/admin/offers/','/nal/read/admin/payments/','/nal/read/admin/support/']);
 if(!paths.has(location.pathname))return;
 const SLUG=/^[a-z0-9-]{1,120}$/;
 const edits=new Set(),managed=new WeakMap();let scheduled=false,bar=null,label=null,known=null,bound=false;
 function read(){
  const q=new URLSearchParams(location.search),seasons=q.getAll('season'),weeks=q.getAll('week');
  if(seasons.length>1||weeks.length>1||(seasons.length&&!SLUG.test(seasons[0]))||(weeks.length&&!/^[1-4]$/.test(weeks[0])))throw new Error('선택한 시즌·주차 주소를 확인해 주세요. 다른 기수로 자동 전환하지 않습니다.');
  return {seasonSlug:seasons[0]||null,week:weeks.length?Number(weeks[0]):null};
 }
 function href(path,params={}){
  const u=new URL(path,location.origin);if(u.origin!==location.origin||!paths.has(u.pathname))throw new Error('지원하지 않는 운영 경로입니다.');
  const ctx=read();if(ctx.seasonSlug&&!u.searchParams.has('season'))u.searchParams.set('season',ctx.seasonSlug);
  if(ctx.week&&!u.searchParams.has('week'))u.searchParams.set('week',String(ctx.week));
  for(const[k,v]of Object.entries(params)){if(!['season','week','id','tab'].includes(k))throw new Error('운영 경로의 위치 정보만 지정할 수 있습니다.');if(v==null||v==='')u.searchParams.delete(k);else u.searchParams.set(k,String(v));}
  return u.pathname+u.search;
 }
 function set(seasonSlug,title){
  if(seasonSlug!=null&&!SLUG.test(seasonSlug))throw new Error('시즌 주소를 확인해 주세요.');
  const q=new URL(location.href),previous=q.searchParams.get('season');
  if(seasonSlug)q.searchParams.set('season',seasonSlug);else q.searchParams.delete('season');
  if(previous!==seasonSlug){q.searchParams.delete('id');q.searchParams.delete('order');q.searchParams.delete('tab');}
  known=seasonSlug&&typeof title==='string'?{slug:seasonSlug,title}:null;
  history.replaceState({},'',q.pathname+q.search);refresh();
 }
 function info(title){const ctx=read();if(ctx.seasonSlug&&typeof title==='string')known={slug:ctx.seasonSlug,title};refresh();}
 function unload(e){if([...edits].some(x=>x.dirty||x.pending)){e.preventDefault();e.returnValue='';}}
 function syncGuard(){const need=[...edits].some(x=>x.dirty||x.pending);if(need!==bound){window[need?'addEventListener':'removeEventListener']('beforeunload',unload);bound=need;}}
 function mayLeave(){
  if([...edits].some(x=>x.pending)){(window.NalAccount||window.NalRead)?.status('저장 결과를 확인 중입니다. 결과가 표시된 뒤 다른 기수로 이동해 주세요.','error');return false;}
  return ![...edits].some(x=>x.dirty)||confirm('저장하지 않은 설정이 있습니다. 내용을 보관한 뒤 다른 기수나 화면으로 이동할까요?');
 }
 function track(form){
  const state={dirty:false,pending:false};edits.add(state);
  const change=()=>{state.dirty=true;syncGuard();};form.addEventListener('input',change);form.addEventListener('change',change);
  return {
   saved(){state.dirty=false;syncGuard();},
   dispose(){edits.delete(state);form.removeEventListener('input',change);form.removeEventListener('change',change);syncGuard();},
   async run(fn){if(state.pending)throw new Error('현재 설정을 저장하고 있습니다.');state.pending=true;syncGuard();
    const controls=[...form.querySelectorAll('input,select,textarea,button')].map(n=>[n,n.disabled]);controls.forEach(([n])=>n.disabled=true);
    try{return await fn();}finally{state.pending=false;controls.forEach(([n,v])=>{if(n.isConnected)n.disabled=v;});syncGuard();}
   }
  };
 }
 function resetEdits(){edits.clear();syncGuard();}
 async function query(kind,payload,fallback){
  const ctx=read();if(!ctx.seasonSlug)return fallback();
  const A=window.NalAccount;if(!A)throw new Error('공통 계정 연결을 확인해 주세요.');
  const data=await A.call('account','operator-context',{...payload,kind,seasonSlug:ctx.seasonSlug});
  if(read().seasonSlug!==ctx.seasonSlug)throw new DOMException('Season changed','AbortError');
  if(data?.scopeVersion!==18||data.seasonSlug!==ctx.seasonSlug)throw new Error('기수별 조회 연결을 확인하지 못했습니다. 전체 기록으로 대신 표시하지 않습니다.');
  info(data.seasonTitle);return data;
 }
 function decorate(a,ctx){
  if(a.dataset.adminContext==='clear')return;
  const raw=a.getAttribute('href');if(!raw)return;let base=raw;const prev=managed.get(a);if(prev&&raw===prev.last)base=prev.base;
  let u;try{u=new URL(base,location.origin);}catch{return;}
  if(u.origin!==location.origin||!paths.has(u.pathname))return;
  if(u.pathname==='/nal/read/admin/home/'||!u.searchParams.has('season')){if(ctx.seasonSlug)u.searchParams.set('season',ctx.seasonSlug);else u.searchParams.delete('season');}
  if(u.pathname==='/nal/read/admin/home/'||!u.searchParams.has('week')){if(ctx.week)u.searchParams.set('week',String(ctx.week));else u.searchParams.delete('week');}
  const out=u.pathname+u.search+u.hash;managed.set(a,{base,last:out});if(raw!==out)a.setAttribute('href',out);
 }
 function refresh(){
  scheduled=false;
  // Keep an explicit escape route even when the incoming selection is malformed.
  if(!bar){const header=document.querySelector('.nal-account-header,.read-topbar');if(header){
   bar=document.createElement('nav');bar.className='nal-admin-context-bar';bar.setAttribute('aria-label','현재 운영 범위');
   label=document.createElement('p');const home=document.createElement('a');home.href='/nal/read/admin/home/';home.textContent='운영 홈';
   const clear=document.createElement('a');clear.href=location.pathname;clear.dataset.adminContext='clear';clear.textContent='이 화면의 기수 선택 해제';bar.append(label,home,clear);header.after(bar);
  }}
  let ctx;try{ctx=read();}catch(error){if(label&&label.textContent!==error.message)label.textContent=error.message;return;}
  if(label){const text=ctx.seasonSlug?(known?.slug===ctx.seasonSlug?known.title:ctx.seasonSlug)+(ctx.week?' · WEEK '+ctx.week:''):'기수 미선택 · 전체 목록 또는 선택 화면';if(label.textContent!==text)label.textContent=text;}
  document.querySelectorAll('a[href]').forEach(a=>decorate(a,ctx));
 }
 function schedule(){if(!scheduled){scheduled=true;queueMicrotask(refresh);}}
 document.addEventListener('click',e=>{
  const a=e.target instanceof Element?e.target.closest('a[href]'):null;
  if(a&&a.dataset.adminContext!=='clear'){
   const u=new URL(a.href,location.origin);
   if(u.origin===location.origin&&paths.has(u.pathname))try{decorate(a,read());}catch(error){e.preventDefault();(window.NalAccount||window.NalRead)?.status(error.message,'error');return;}
  }
  const leaving=a||((e.target instanceof Element)&&e.target.closest('[data-account-signout]'));
  if(leaving&&e.button===0&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey&&a?.target!=='_blank'&&!mayLeave()){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
 window.addEventListener('popstate',schedule);window.addEventListener('nal:session',()=>{known=null;resetEdits();schedule();});
 window.NalAccount?.onChange(()=>{known=null;resetEdits();schedule();});
 window.NalAdminContext={read,href,set,info,query,track,resetEdits,mayLeave,refresh};refresh();
})();
