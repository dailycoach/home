(() => {
 'use strict';const A=window.NalAccount;if(!A)return;
 const el=A.node,publicRoot=document.querySelector('[data-offer-public]'),privateRoot=document.querySelector('[data-account-private]');
 const params=new URLSearchParams(location.search),slug=params.get('season'),page=document.body.dataset.accountPage;
 let run=0,requestId=null;
 const waitHref=s=>'/nal/my/waitlist/?season='+encodeURIComponent(s);
 const startHref=s=>'/nal/read/start/?season='+encodeURIComponent(s);
 const labels={open:'모집 중',reserved:'참여 가능한 자리 있음',full:'정원 마감',waitlist_priority:'대기자 우선 안내',closed:'모집 마감',paused:'모집 잠시 멈춤',cancelled:'운영 취소',not_yet:'모집 예정',unconfigured:'기수 설정 준비 중',not_open:'참여 준비 중',capacity_review:'정원 확인 중'};
 function cohortInfo(c){const box=el('section','','nal-cohort-facts');
  if(!c?.configured){box.append(el('p','운영 기수의 일정과 정원을 준비하고 있습니다.','nal-account-note'));return box;}
  box.append(el('h2',c.label),el('p',`${A.date(c.courseStartsAt)} — ${A.date(c.courseEndsAt)} (한국 시간)`),
   el('p',`${labels[c.reason]||'상태 확인'} · 정원 ${c.capacity}명 · 현재 남은 자리 ${c.remaining}명`,'nal-account-meta'),
   el('p','남은 자리에는 결제 진행 중·대기자 제안 자리가 반영됩니다.','nal-account-note'),
   A.link('/nal/read/cohorts/?program='+encodeURIComponent(c.programKey),'다른 기수 보기'));
  return box;
 }
 function entry(offer,info,pay,serverTime){const row=el('div','','nal-account-actions'),c=info?.cohort||offer.cohort;
  if(info?.access?.allowed){
   const before=Number.isFinite(Date.parse(c?.courseStartsAt))&&Date.parse(c.courseStartsAt)>Date.parse(serverTime);
   if(before||c?.state==='cancelled')row.append(A.link(startHref(slug),'나의 시작 안내 열기 →','nal-account-button'));
   else row.append(A.link(A.read(slug,'today'),'내 READ 이어가기 →','nal-account-button'),A.link(startHref(slug),'준비 안내 다시 보기'));
  }else if(c?.canEnroll&&offer.status==='accepting'){
   if(offer.mode==='paid'&&pay?.checkoutEnabled)row.append(A.link('/nal/read/checkout/?season='+encodeURIComponent(slug),'참여하기 →','nal-account-button'));
   else if(offer.mode!=='paid')row.append(A.link('/nal/read/join/?season='+encodeURIComponent(slug),'참여하기 →','nal-account-button'));
   else row.append(el('p','새 결제는 아직 열리지 않았습니다.','nal-account-note'));
  }else if(c?.canWait)row.append(A.link(waitHref(slug),'대기 신청하기','nal-account-button'));
  else row.append(el('p',labels[c?.reason]||'참여 준비 중','nal-account-note'));
  row.append(A.link('/nal/my/','MY NAL'),A.link(waitHref(slug),'내 대기·참여 기회 확인'));return row;
 }
 async function render(){const ticket=++run,epoch=A.epoch;privateRoot.replaceChildren();privateRoot.hidden=true;
  try{
   if(slug&&!/^[a-z0-9-]{1,120}$/.test(slug))throw new Error('프로그램 주소를 확인해 주세요.');
   if(!slug){const data=await A.offers(null);if(ticket!==run||epoch!==A.epoch)return;
    publicRoot.replaceChildren(el('h1','책에서 시작해, 내 삶으로.'),A.link('/nal/read/cohorts/','일정에 맞는 기수 찾기 →','nal-account-button'));
    for(const offer of data.offers||[]){const s=el('article','','nal-account-record');s.append(el('p','NAL READ','nal-account-kicker'),el('h2',offer.title),el('p',offer.summary),A.link('/nal/shop/read/?season='+encodeURIComponent(offer.seasonSlug),'프로그램 보기'));publicRoot.append(s);}
    if(!data.offers?.length)publicRoot.append(el('p','공개된 READ 프로그램을 준비하고 있습니다.','nal-account-empty'));return;
   }
   // One public projection supplies offer, published introduction, weekly outline and actual LIVE dates.
   const [detail,pay]=await Promise.all([A.programDetail(slug),A.payConfig().catch(()=>null)]);if(ticket!==run||epoch!==A.epoch)return;
   const offer=detail.offer;if(!detail.available||!offer)throw new Error('이 프로그램은 소개를 준비하고 있습니다.');
   let info=null;if(A.user){try{info=await A.call('join','options',{},slug);}catch(e){if(e.status===401)throw e;}}
   if(ticket!==run||epoch!==A.epoch)return;
   const c=info?.cohort||offer.cohort,g=detail.guide;publicRoot.replaceChildren();
   publicRoot.append(el('p','NAL READ · SELF-COACHING','nal-account-kicker'),el('h1',g?.headline||offer.title));
   if(g?.headline&&g.headline!==offer.title)publicRoot.append(el('p',offer.title,'nal-account-meta'));
   publicRoot.append(el('p',g?.introduction||offer.summary,'nal-account-lead'));
   publicRoot.append(el('p',[({free:'무료 참여',paid:A.money(offer.price),invitation:'초대 참가권'})[offer.mode],offer.dayCount?offer.dayCount+' DAY':'콘텐츠 준비 중',offer.accessDays?'이용 '+offer.accessDays+'일':'이용 안내 확인'].join(' · '),'nal-account-meta'),cohortInfo(c));
   if(page==='offer'){
    window.NalProgramSections?.render(publicRoot,detail);
    const notice=el('details','','nal-account-notice');notice.append(el('summary','가격·기수의 참여 및 이용 조건'),el('p',offer.notice));publicRoot.append(notice,entry(offer,info,pay,detail.serverTime));
    if(offer.mode==='paid')publicRoot.append(el('p','토스 앱 없이 신용·체크카드로 결제할 수 있습니다. 간편결제는 결제창에 표시되는 수단 중에서 선택하세요.','nal-account-note'));
    const repair=el('details','','nal-account-notice');repair.append(el('summary','이전 구매·초대 참가권을 연결하려면'),A.link('/nal/read/join/?season='+encodeURIComponent(slug),'참가권 연결 화면'));publicRoot.append(repair);return;
   }
   if(!A.user)return;if(!info)throw new Error('참가권 상태를 확인하지 못했습니다. 다시 열어주세요.');privateRoot.hidden=false;
   if(info.access?.allowed){privateRoot.append(el('h2','내 READ가 준비되었습니다.'),entry(offer,info,pay,detail.serverTime));return;}
   if(info.existingEnrollment){privateRoot.append(el('p','기존 참가권 상태를 확인해 주세요. 다시 신청해도 만료·철회 상태가 자동 복구되지는 않습니다.','nal-account-note'),A.link('/nal/my/','내 참가권 보기'));return;}
   if(!info.release?.allowed){privateRoot.append(el('p','프로그램 공개를 준비하고 있습니다.','nal-account-empty'),A.link('/nal/my/payments/','이미 결제한 주문 확인'));return;}
   if(!c?.canEnroll||offer.status!=='accepting'){privateRoot.append(entry(offer,info,pay,detail.serverTime));return;}
   const choices=[];if(offer.mode==='free')choices.push(['free:','무료 참가']);
   if(info.hasInvitation)choices.push(['invitation:','내 계정의 초대 참가권']);
   if(offer.mode==='paid')for(const o of info.orders||[])choices.push(['paid:'+o.id,`${A.date(o.createdAt)} · ${A.money(o.amount)} 결제 확인 주문`]);
   if(!choices.length){privateRoot.append(entry(offer,info,pay,detail.serverTime),el('p','이미 결제했다면 새로 결제하지 말고 기존 주문을 확인하세요.','nal-account-note'),A.link('/nal/my/payments/','내 주문 확인'));return;}
   const form=el('form','','nal-account-form'),source=el('select');source.setAttribute('aria-label','연결할 참가권');
   for(const [v,t] of choices){const o=el('option',t);o.value=v;source.append(o);}
   if(params.get('order')&&choices.some(x=>x[0]==='paid:'+params.get('order')))source.value='paid:'+params.get('order');
   if(choices.length>1){const label=el('label','연결할 참가권');label.append(source);form.append(label);}
   form.append(el('p',offer.notice,'nal-account-notice'));
   const label=el('label','','nal-account-check'),check=el('input');check.type='checkbox';check.required=true;label.append(check,document.createTextNode('기수 일정과 참여·이용 안내를 확인했습니다.'));
   const submit=el('button','참여하고 시작하기','nal-account-button');submit.type='submit';form.append(label,submit);source.addEventListener('change',()=>{requestId=null;});
   form.addEventListener('submit',async e=>{e.preventDefault();if(!check.checked)return;const owner=A.epoch;submit.disabled=true;requestId??=crypto.randomUUID();
    const [kind,orderId]=source.value.split(':');
    try{const r=await A.call('join','claim',{requestId,source:kind,orderId:orderId||null,accepted:true,policyVersion:offer.policyVersion},slug);
     if(owner!==A.epoch)return;if(!r.allowed)throw new Error('참가권 연결 상태를 다시 확인해 주세요.');location.assign(A.read(slug,'today'));
    }catch(error){if(owner===A.epoch)A.status(error.message,'error');}finally{if(submit.isConnected)submit.disabled=false;}
   });privateRoot.append(form);
  }catch(e){if(ticket===run&&e.name!=='AbortError')A.status(e.message,'error');}
 }
 A.ready.then(()=>render());A.onChange(render);
})();
