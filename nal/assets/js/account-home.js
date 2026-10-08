/* BUILD14 — add a home overview; preserve existing account lists and explicit actions. */
(() => {
 'use strict';
 const A=window.NalAccount;if(!A)return;
 const root=document.querySelector('[data-account-private]');if(!root)return;const el=A.node;
 const tabs=[['home','홈'],['programs','내 READ'],['files','구매 자료'],['registrations','모임·클래스'],['reports','내 리포트'],['orders','주문 내역'],['profile','내 이름']];
 const states={pending:'결제 대기',paid:'결제 확인',cancelled:'취소',refunded:'환불',refund_requested:'환불 확인 중',active:'참여 중',paused:'잠시 멈춤',completed:'마친 기록',revoked:'이용 제한',pending_payment:'결제 대기',confirmed:'참가 확정',waitlisted:'대기',cancellation_requested:'취소 요청',expired:'만료'};
 const reasons={read_release_off:'프로그램 공개 준비 중',read_test_scope_required:'현재 공개 대상이 아닙니다.',verified_identity_required:'로그인을 다시 확인해 주세요.',entitlement_inactive:'이용권 상태를 확인해 주세요.',entitlement_expired:'이용 기간이 끝났습니다.',enrollment_inactive:'참가권 상태를 확인해 주세요.',order_inactive:'결제·환불 상태를 확인해 주세요.',season_unavailable:'시즌을 준비하고 있습니다.'};
 let ticket=0,disposeOverview=()=>{},profileDirty=false,profileBusy=false;
 const active=c=>c.ticket===ticket&&c.epoch===A.epoch&&!!A.user;
 const context=()=>({ticket,epoch:A.epoch});
 const simpleClick=e=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
 function btn(text,fn){const b=el('button',text,'nal-account-button');b.type='button';b.addEventListener('click',async()=>{const c=context();b.disabled=true;try{await fn(c);}catch(e){if(active(c)&&e.name!=='AbortError')A.status(e.message,'error');}finally{if(b.isConnected)b.disabled=false;}});return b;}
 function line(title,meta=''){const s=el('article','','nal-account-record');s.append(el('h2',title));if(meta)s.append(el('p',meta,'nal-account-meta'));return s;}
 const row=()=>el('div','','nal-account-actions');
 function mayLeave(){if(profileBusy){A.status('이름 저장 결과를 확인한 뒤 이동해 주세요.');return false;}return !profileDirty||confirm('저장하지 않은 이름 변경을 버리고 이동할까요?');}
 function titleCard(item,kind){
  if(kind==='programs'){
   const s=line(item.title,states[item.status]||item.status);s.append(el('p',item.allowed?'이어갈 위치와 기록은 아래에서 확인할 수 있습니다.':(reasons[item.reason]||'현재는 열 수 없습니다.')));
   if(item.allowed){const actions=row();actions.append(A.link(A.read(item.slug,'today'),'이어가기 →'),A.link('/nal/read/start/?season='+encodeURIComponent(item.slug),'시작 안내'),A.link(A.read(item.slug,'my'),'내 문장'),A.link(A.read(item.slug,'report'),'내 리포트'));s.append(actions);}return s;
  }
  if(kind==='files'){
   const s=line(item.title,A.date(item.created_at));s.append(el('p',[item.license_type==='personal-use'?'개인사용권':item.license_type,item.printing_allowed?'인쇄 허용':'인쇄 범위 확인',item.expires_at?'이용 기한 '+A.date(item.expires_at):'별도 만료일 없음'].join(' · '),'nal-account-meta'));
   if(item.download_limit)s.append(el('p',`다운로드 ${item.download_count}/${item.download_limit}회`,'nal-account-meta'));
   if(item.downloadable)s.append(btn('구매 자료 열기',async c=>{const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
    try{const url=await A.download(item.id);if(!active(c)){popup?.close();return;}if(popup)popup.location.replace(url);else{const a=A.link(url,'파일 새 창에서 열기');a.target='_blank';a.rel='noopener noreferrer';s.append(a);}}
    catch(e){popup?.close();throw e;}
   }));else s.append(el('p',({revoked:'이용권이 철회되었습니다.',expired:'이용 기간이 끝났습니다.',limit:'다운로드 횟수를 모두 사용했습니다.',order_inactive:'결제·환불 상태를 확인해 주세요.',preparing:'파일을 준비하고 있습니다.'})[item.reason]||'다운로드 준비 중','nal-account-note'));return s;
  }
  if(kind==='orders'){
   const s=line(A.money(item.amount_won),[states[item.status]||item.status,A.date(item.created_at)].join(' · '));
   for(const i of item.items||[]){s.append(el('p',`${i.title} × ${i.quantity}`));
    if(i.readSeason&&item.status==='paid')s.append(A.link('/nal/read/join/?season='+encodeURIComponent(i.readSeason)+'&order='+item.id,'이 주문의 READ 참가권 확인'));}
   const detail=el('details','','nal-order-reference');detail.append(el('summary','문의용 주문 번호'),el('code',item.id));s.append(detail);return s;
  }
  if(kind==='registrations'){
   const s=line(item.title,states[item.status]||item.status);s.append(el('p',A.date(item.starts_at)+' ~ '+A.date(item.ends_at)));
   if(item.location)s.append(el('p',item.location));s.append(el('p',A.money(item.price_won),'nal-account-meta'));return s;
  }
  const s=line(item.title||'내 리포트',[item.season_title,A.date(item.created_at),item.stage==='complete'?'마친 기록':'중간 기록'].join(' · '));
  if(item.allowed)s.append(A.link(A.read(item.slug,'report'),'이 시즌의 리포트 보관함 열기'));else s.append(el('p','프로그램 접근 상태를 확인해 주세요.','nal-account-note'));return s;
 }
 async function render(focus=false){
  ++ticket;disposeOverview();disposeOverview=()=>{};profileDirty=false;profileBusy=false;
  if(!A.user){root.replaceChildren();root.hidden=true;document.body.dataset.myView='guest';return;}
  const wanted=new URLSearchParams(location.search).get('tab'),view=tabs.some(t=>t[0]===wanted)?wanted:'home';
  document.body.dataset.myView=view;root.replaceChildren();root.hidden=false;
  const c=context(),nav=el('nav','','nal-account-tabs');nav.setAttribute('aria-label','내 공간 메뉴');
  for(const[key,label]of tabs){const a=A.link(key==='home'?'/nal/my/':'/nal/my/?tab='+key,label);if(key===view)a.setAttribute('aria-current','page');nav.append(a);}root.append(nav);
  const content=el('section','','nal-account-list');content.tabIndex=-1;content.setAttribute('aria-label',tabs.find(x=>x[0]===view)[1]);root.append(content);
  if(focus)content.focus({preventScroll:true});
  if(view==='home'){
   if(window.NalAccountOverview)disposeOverview=window.NalAccountOverview.mount(content,{isCurrent:()=>active(c)});
   else content.append(el('p','홈 구성 파일을 불러오지 못했습니다. 다른 메뉴는 그대로 이용할 수 있습니다.','nal-account-note'));
   return;
  }
  let offset=0,loading=false;const seen=new Set();
  async function load(){
   if(loading||!active(c))return;loading=true;content.setAttribute('aria-busy','true');
   try{
    const data=await A.call('account',view,{offset});if(!active(c))return;content.querySelector('[data-retry]')?.remove();
    if(view==='profile'){
     const form=el('form','','nal-account-form'),label=el('label','화면에서 사용할 이름'),input=el('input');input.value=data.displayName||'';input.maxLength=80;input.autocomplete='nickname';label.append(input);form.append(label);
     let revision=data.revision,saved=input.value;const save=el('button','이름 저장','nal-account-button');save.type='submit';form.append(save);
     input.addEventListener('input',()=>profileDirty=input.value!==saved);
     form.addEventListener('submit',async e=>{
      e.preventDefault();if(profileBusy)return;profileBusy=true;save.disabled=true;input.disabled=true;
      try{const r=await A.call('account','profile-save',{displayName:input.value,revision});if(active(c)){revision=r.revision;saved=r.displayName;input.value=saved;profileDirty=false;A.status('이름을 저장했습니다.','ok');}}
      catch(e){if(active(c))A.status(e.message,'error');}
      finally{if(active(c)){profileBusy=false;save.disabled=false;input.disabled=false;}}
     });
     content.append(form,el('p','리포트 표지의 이름은 리포트를 만들 때 별도로 정할 수 있습니다.','nal-account-note'),A.link('/nal/my/','홈으로 돌아가기'));return;
    }
    if(!Array.isArray(data[view]))throw new Error('목록 응답을 확인하지 못했습니다. 기록이 없는 것으로 처리하지 않습니다.');
    const batch=data[view].slice(0,50),more=data[view].length>50;offset+=batch.length;
    content.querySelector('[data-more]')?.remove();
    if(!offset)content.append(el('p',({programs:'아직 참여한 READ가 없습니다. 프로그램을 둘러보거나 참가권을 연결해 주세요.',files:'이 계정에 연결된 구매 자료가 없습니다. 무료 스타터 PDF는 스토어에서 받을 수 있습니다.',orders:'아직 확인할 주문이 없습니다.',registrations:'아직 연결된 모임·클래스 신청이 없습니다.',reports:'아직 보관한 리포트가 없습니다. READ의 내 리포트에서 기록을 모아보세요.'})[view],'nal-account-empty'));
    for(const item of batch){if(seen.has(item.id))continue;seen.add(item.id);content.append(titleCard(item,view));}
    if(more){const b=btn('더 보기',load);b.dataset.more='';content.append(b);}
   }catch(e){if(active(c)&&e.name!=='AbortError'){A.status(e.message,'error');if(!content.querySelector('[data-retry]')){const b=btn('다시 불러오기',load);b.dataset.retry='';content.append(b);}}}
   finally{loading=false;if(active(c))content.setAttribute('aria-busy','false');}
  }
  await load();
 }
 // Native modifier-click/new-tab behavior remains available. Only local account tabs are routed in place.
 root.addEventListener('click',e=>{
  const a=e.target.closest('a[href]');if(!a||!simpleClick(e)||a.target==='_blank')return;
  const url=new URL(a.href,location.origin);if(url.origin!==location.origin||url.pathname!=='/nal/my/')return;
  if([...url.searchParams.keys()].some(k=>k!=='tab'))return;
  e.preventDefault();history.pushState({},'',url.pathname+url.search);render(true);
 });
 document.addEventListener('click',e=>{
  const target=e.target.closest('a[href],[data-account-signout]');if(!target||target.target==='_blank'||!simpleClick(e))return;
  if(!mayLeave()){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 window.addEventListener('beforeunload',e=>{if(profileDirty||profileBusy){e.preventDefault();e.returnValue='';}});
 window.addEventListener('popstate',()=>{if(profileDirty)A.status('저장하지 않은 이름 변경은 반영되지 않았습니다.');render();});
 A.ready.then(ok=>{if(ok)render();});A.onChange(()=>render());
})();
