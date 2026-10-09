(() => {
 'use strict';const A=window.NalAccount;if(!A)return;
 const el=A.node,page=document.body.dataset.cohortPage;
 const publicRoot=document.querySelector('[data-offer-public]'),privateRoot=document.querySelector('[data-account-private]');
 const params=new URLSearchParams(location.search),slug=params.get('season'),program=params.get('program');let run=0;
 const labels={open:'모집 중',reserved:'내 참여 가능 여부 확인',full:'정원 마감',waitlist_priority:'대기자 우선 안내 중',closed:'모집 마감',paused:'모집 잠시 멈춤',cancelled:'운영 취소',not_yet:'모집 예정',not_open:'참여 준비 중',unpublished:'준비 중',unconfigured:'일정 준비 중',capacity_review:'정원 확인 중'};
 const waitLabels={waiting:'대기 중',offered:'참여 기회가 열렸어요',expired:'참여 기회 기한 종료',withdrawn:'대기 신청 철회',joined:'참가권 연결됨'};
 function button(text,fn){const b=el('button',text,'nal-account-button');b.type='button';b.addEventListener('click',async()=>{const epoch=A.epoch;b.disabled=true;try{await fn();}catch(e){if(epoch===A.epoch&&e.name!=='AbortError')A.status(e.message,'error');}finally{if(b.isConnected)b.disabled=false;}});return b;}
 const waitHref=s=>'/nal/my/waitlist/?season='+encodeURIComponent(s);
 function details(cohort){
  const box=el('div','','nal-cohort-facts');box.append(el('p',`${A.date(cohort.courseStartsAt)} — ${A.date(cohort.courseEndsAt)} (한국 시간)`));
  if(cohort.registrationStartsAt||cohort.registrationEndsAt)box.append(el('p',`모집 ${cohort.registrationStartsAt?A.date(cohort.registrationStartsAt):'시작일 별도 안내'} — ${cohort.registrationEndsAt?A.date(cohort.registrationEndsAt):'기수 시작 전까지'}`,'nal-account-meta'));
  box.append(el('p',`정원 ${cohort.capacity}명 · 참여 확정 ${cohort.enrolled}명 · 현재 남은 자리 ${cohort.remaining}명`,'nal-account-meta'),
   el('p','남은 자리에는 결제 진행과 대기자에게 제안한 자리가 반영됩니다. 참가 확정 인원과는 다를 수 있습니다.','nal-account-note'));
  return box;
 }
 async function catalog(ticket){
  const data=await A.cohortCatalog(program,slug);if(ticket!==run)return;publicRoot.replaceChildren();
  publicRoot.append(el('p','NAL READ · COHORTS','nal-account-kicker'),el('h1','나에게 맞는 기수로 시작합니다.'),el('p','일정과 참여 가능한 자리를 확인하세요.','nal-account-lead'));
  const list=el('div','','nal-cohort-list');
  for(const item of data.cohorts||[]){const c=item.cohort,s=el('article','','nal-cohort-card');
   s.append(el('p',`${c.cohortNumber}기 · ${labels[c.reason]||'상태 확인'}`,'nal-account-kicker'),el('h2',c.label),el('h3',item.title));
   if(item.summary)s.append(el('p',item.summary,'nal-account-lead'));s.append(details(c));
   const row=el('div','','nal-account-actions');
   if(c.canEnroll)row.append(A.link('/nal/shop/read/?season='+encodeURIComponent(item.seasonSlug),'프로그램 보고 참여하기 →','nal-account-button'));
   else if(c.canWait)row.append(A.link(waitHref(item.seasonSlug),'대기 신청하기','nal-account-button'));
   else row.append(el('span',labels[c.reason]||'상태 확인','nal-account-note'));
   row.append(A.link('/nal/shop/read/?season='+encodeURIComponent(item.seasonSlug),'참여 안내'),A.link(waitHref(item.seasonSlug),'내 대기·참여 기회 확인'));s.append(row);list.append(s);
  }
  if(!list.children.length)list.append(el('p','공개된 기수 일정이 아직 없습니다. 실제 일정이 확정되면 표시됩니다.','nal-account-empty'));
  publicRoot.append(list,el('p',`현재 목록은 최대 ${data.limit||100}개 기수입니다.`,'nal-account-meta'),A.link('/nal/my/waitlist/','내 대기 신청 모아보기'));
 }
 async function myList(ticket){
  const data=await A.cohort('mine');if(ticket!==run)return;privateRoot.replaceChildren();privateRoot.hidden=false;
  privateRoot.append(el('h2','내 대기 신청'),el('p','대기는 결제나 참가 확정이 아닙니다. 참여 기회가 열리면 여기에서 직접 확인하고 진행할 수 있습니다.','nal-account-note'));
  for(const item of data.applications||[]){const s=el('article','','nal-cohort-card');s.append(el('p',waitLabels[item.state]||item.state,'nal-account-kicker'),el('h3',item.label),el('p',item.title),el('p','기수 시작 '+A.date(item.courseStartsAt),'nal-account-meta'));
   if(item.state==='offered')s.append(el('p','기회 확인 기한 '+A.date(item.offerUntil),'nal-cohort-deadline'));
   s.append(A.link(waitHref(item.seasonSlug),'신청 상태 열기 →'));privateRoot.append(s);
  }
  if(!data.applications?.length)privateRoot.append(el('p','아직 대기 신청이 없습니다.','nal-account-empty'));
  privateRoot.append(A.link('/nal/read/cohorts/','모집 기수 보기'));
 }
 async function myDetail(ticket){
  const [data,offerData]=await Promise.all([A.cohort('status',{seasonSlug:slug}),A.offers(slug)]);if(ticket!==run)return;
  const offer=offerData.offers?.find(x=>x.seasonSlug===slug),c=data.cohort,w=data.application;
  privateRoot.replaceChildren();privateRoot.hidden=false;
  privateRoot.append(el('h2',c.label||offer?.title||'내 신청'),details(c));
  if(w){privateRoot.append(el('p',waitLabels[w.state]||w.state,'nal-cohort-status'));
   if(w.position)privateRoot.append(el('p',`현재 대기 ${w.position}번째입니다. (대기 중인 신청 기준)`, 'nal-account-meta'));
   if(w.state==='offered')privateRoot.append(el('p','참여 기회는 '+A.date(w.offerUntil)+'까지 열려 있습니다.','nal-cohort-deadline'));
   if(w.state==='joined')privateRoot.append(A.link(A.read(slug,'today'),'내 READ로 가기','nal-account-button'));
  }
  if(c.canEnroll&&offer){
   const target=offer.mode==='paid'?'/nal/read/checkout/?season=':'/nal/read/join/?season=';
   privateRoot.append(el('p','참여 안내를 다시 확인한 뒤 진행하세요. 유료 기수는 결제 확인 후 참가가 확정됩니다.','nal-account-note'),A.link(target+encodeURIComponent(slug),w?.state==='offered'?'이 기수에 참여하기':'참여 안내 확인하고 시작하기','nal-account-button'));
  }
  if(w&&['waiting','offered','expired'].includes(w.state))privateRoot.append(button('대기 신청 철회',async()=>{
   if(!confirm('대기 신청을 철회할까요? 다시 신청하면 새 신청 순서가 적용됩니다. 결제 취소나 환불은 실행되지 않습니다.'))return;
   await A.cohort('withdraw',{seasonSlug:slug,revision:w.revision});await render();
  }));
  if(c.canWait&&(!w||['withdrawn','expired'].includes(w.state))&&offer){
   const form=el('form','','nal-account-form');form.append(el('p','대기 신청에는 결제가 없습니다. 빈자리가 생겨도 자동 결제나 자동 참가권 발급을 하지 않습니다.','nal-account-note'));
   const notice=el('details','','nal-order-details');notice.append(el('summary','현재 참여 안내'),el('p',offer.notice,'nal-account-notice'));form.append(notice);
   const label=el('label','','nal-account-check'),check=el('input');check.type='checkbox';check.required=true;label.append(check,document.createTextNode('참여 안내를 읽었으며, 대기 신청은 참가 확정이 아님을 확인했습니다.'));
   const submit=el('button',w?'새 순서로 다시 대기 신청':'대기 신청 남기기','nal-account-button');submit.type='submit';form.append(label,submit);
   form.addEventListener('submit',async e=>{e.preventDefault();if(!check.checked)return;const epoch=A.epoch;submit.disabled=true;
    try{await A.cohort('wait',{seasonSlug:slug,accepted:true,policyVersion:offer.policyVersion});if(epoch===A.epoch)await render();}
    catch(error){if(epoch===A.epoch)A.status(error.message,'error');}finally{if(submit.isConnected)submit.disabled=false;}
   });privateRoot.append(form);
  }
  privateRoot.append(el('p','이 단계에서는 자동 문자·이메일을 보내지 않습니다. 내 대기 신청 화면에서 상태를 확인해 주세요.','nal-account-note'),A.link('/nal/my/waitlist/','전체 대기 신청'),A.link('/nal/my/payments/','이미 결제한 주문 확인'));
 }
 async function render(){const ticket=++run;try{
  if(page==='catalog'){await catalog(ticket);return;}
  if(!A.user){privateRoot.replaceChildren();privateRoot.hidden=true;return;}
  if(slug)await myDetail(ticket);else await myList(ticket);
 }catch(e){if(ticket===run&&e.name!=='AbortError')A.status(e.message,'error');}}
 A.ready.then(()=>render());A.onChange(render);
})();
