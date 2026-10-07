(() => {
 'use strict';
 const A=window.NalAccount;if(!A)return;
 const root=document.querySelector('[data-account-private]'),el=A.node;
 const tabs=[['programs','내 READ'],['files','구매 자료'],['registrations','모임·클래스'],['reports','내 리포트'],['orders','주문 내역'],['profile','내 이름']];
 const states={pending:'결제 대기',paid:'결제 확인',cancelled:'취소',refunded:'환불',refund_requested:'환불 확인 중',active:'참여 중',paused:'잠시 멈춤',completed:'마친 기록',revoked:'이용 제한',pending_payment:'결제 대기',confirmed:'참가 확정',waitlisted:'대기',cancellation_requested:'취소 요청',expired:'만료'};
 const reasons={read_release_off:'프로그램 공개 준비 중',read_test_scope_required:'현재 공개 대상이 아닙니다.',verified_identity_required:'로그인을 다시 확인해 주세요.',entitlement_inactive:'이용권 상태를 확인해 주세요.',entitlement_expired:'이용 기간이 끝났습니다.',enrollment_inactive:'참가권 상태를 확인해 주세요.',order_inactive:'결제·환불 상태를 확인해 주세요.',season_unavailable:'시즌을 준비하고 있습니다.'};
 let ticket=0,active='programs';
 function btn(text,fn){const b=el('button',text,'nal-account-button');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){if(e.name!=='AbortError')A.status(e.message,'error');}finally{b.disabled=false;}});return b;}
 function line(title,meta=''){const s=el('article','','nal-account-record');s.append(el('h2',title));if(meta)s.append(el('p',meta,'nal-account-meta'));return s;}
 function row(){return el('div','','nal-account-actions');}
 function titleCard(item,kind){
  if(kind==='programs'){
   const s=line(item.title,states[item.status]||item.status);s.append(el('p',item.allowed?(item.recordedDays?`남긴 DAY ${item.recordedDays}개`:'첫 질문을 기다리고 있어요.'):(reasons[item.reason]||'현재는 열 수 없습니다.')));
   if(item.allowed){const actions=row();
    if(!item.welcomed)actions.append(A.link('/nal/read/join/?season='+encodeURIComponent(item.slug),'참여 안내부터'));
    actions.append(A.link(A.read(item.slug,'today'),'이어가기 →'),A.link(A.read(item.slug,'my'),'내 문장'),A.link(A.read(item.slug,'report'),'내 리포트'));s.append(actions);
   }return s;
  }
  if(kind==='files'){
   const s=line(item.title,A.date(item.created_at));s.append(el('p',[item.license_type==='personal-use'?'개인사용권':item.license_type,item.printing_allowed?'인쇄 허용':'인쇄 범위 확인',item.expires_at?'이용 기한 '+A.date(item.expires_at):'별도 만료일 없음'].join(' · '),'nal-account-meta'));
   if(item.download_limit)s.append(el('p',`다운로드 ${item.download_count}/${item.download_limit}회`,'nal-account-meta'));
   if(item.downloadable)s.append(btn('구매 자료 열기',async()=>{const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
    try{const url=await A.download(item.id);if(popup)popup.location.replace(url);else{const a=A.link(url,'파일 새 창에서 열기');a.target='_blank';a.rel='noopener noreferrer';s.append(a);}}
    catch(e){popup?.close();throw e;}
   }));else s.append(el('p',({revoked:'이용권이 철회되었습니다.',expired:'이용 기간이 끝났습니다.',limit:'다운로드 횟수를 모두 사용했습니다.',order_inactive:'결제·환불 상태를 확인해 주세요.',preparing:'파일을 준비하고 있습니다.'})[item.reason]||'다운로드 준비 중','nal-account-note'));return s;
  }
  if(kind==='orders'){
   const s=line(A.money(item.amount_won),[states[item.status]||item.status,A.date(item.created_at)].join(' · '));
   for(const i of item.items||[]){s.append(el('p',`${i.title} × ${i.quantity}`));
    if(i.readSeason&&item.status==='paid')s.append(A.link('/nal/read/join/?season='+encodeURIComponent(i.readSeason)+'&order='+item.id,'이 주문의 READ 참가권 연결'));}
   s.append(el('details','','nal-order-reference'));const detail=s.lastChild;detail.append(el('summary','문의용 주문 번호'),el('code',item.id));return s;
  }
  if(kind==='registrations'){
   const s=line(item.title,states[item.status]||item.status);s.append(el('p',A.date(item.starts_at)+' ~ '+A.date(item.ends_at)));
   if(item.location)s.append(el('p',item.location));s.append(el('p',A.money(item.price_won),'nal-account-meta'));return s;
  }
  const s=line(item.title||'내 리포트',[item.season_title,A.date(item.created_at),item.stage==='complete'?'마친 기록':'중간 기록'].join(' · '));
  if(item.allowed)s.append(A.link(A.read(item.slug,'report'),'이 시즌의 리포트 보관함 열기'));else s.append(el('p','프로그램 접근 상태를 확인해 주세요.','nal-account-note'));return s;
 }
 async function render(){
  const id=++ticket;if(!A.user){root.replaceChildren();root.hidden=true;return;}
  const wanted=new URLSearchParams(location.search).get('tab');active=tabs.some(t=>t[0]===wanted)?wanted:'programs';
  root.replaceChildren();root.hidden=false;const nav=el('nav','','nal-account-tabs');nav.setAttribute('aria-label','내 공간 메뉴');
  for(const [key,label] of tabs){const a=A.link('/nal/my/?tab='+key,label);if(key===active)a.setAttribute('aria-current','page');a.addEventListener('click',e=>{e.preventDefault();history.pushState({},'',a.href);render();});nav.append(a);}root.append(nav);
  const content=el('section','','nal-account-list');root.append(content);content.setAttribute('aria-busy','true');
  let offset=0;
  async function load(){
   try{const data=await A.call('account',active,{offset});if(id!==ticket)return;
    if(active==='profile'){
     const form=el('form','','nal-account-form'),label=el('label','화면에서 사용할 이름'),input=el('input');input.value=data.displayName;input.maxLength=80;input.autocomplete='nickname';label.append(input);form.append(label);
     let revision=data.revision;const save=el('button','이름 저장','nal-account-button');save.type='submit';form.append(save);
     form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{const r=await A.call('account','profile-save',{displayName:input.value,revision});revision=r.revision;A.status('이름을 저장했습니다.','ok');}catch(e){A.status(e.message,'error');}finally{save.disabled=false;}});
     content.append(form,el('p','리포트 표지의 이름은 리포트를 만들 때 별도로 정할 수 있습니다.','nal-account-note'),A.link('/nal/read/admin/','운영자 콘텐츠 편집'),A.link('/nal/read/admin/offers/','운영자 참가상품 연결'));return;
    }
    const batch=(data[active]||[]).slice(0,50);const more=(data[active]||[]).length>50;offset+=batch.length;
    content.querySelector('[data-more]')?.remove();
    if(!offset)content.append(el('p',({programs:'아직 참여한 READ가 없습니다. 프로그램을 둘러보거나 참가권을 연결해 주세요.',files:'이 계정에 연결된 구매 자료가 없습니다. 무료 스타터 PDF는 로그인 없이 스토어에서 받을 수 있습니다.',orders:'아직 확인할 주문이 없습니다.',registrations:'아직 연결된 모임·클래스 신청이 없습니다.',reports:'아직 보관한 리포트가 없습니다. READ의 내 리포트에서 기록을 모아보세요.'})[active],'nal-account-empty'));
    batch.forEach(item=>content.append(titleCard(item,active)));
    if(more){const b=btn('더 보기',load);b.dataset.more='';content.append(b);}
   }catch(e){if(e.name!=='AbortError'&&id===ticket){A.status(e.message,'error');content.append(btn('다시 불러오기',load));}}
   finally{content.setAttribute('aria-busy','false');}
  }
  await load();
 }
 A.ready.then(ok=>{if(ok)render();});A.onChange(render);window.addEventListener('popstate',render);
})();
