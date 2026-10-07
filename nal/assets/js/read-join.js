(() => {
 'use strict';const A=window.NalAccount;if(!A)return;const el=A.node;
 const publicRoot=document.querySelector('[data-offer-public]'),privateRoot=document.querySelector('[data-account-private]');
 const params=new URLSearchParams(location.search),slug=params.get('season');let generation=0,offer=null,request=null;
 const valid=/^[a-z0-9-]{1,120}$/;
 function btn(text,fn){const b=el('button',text,'nal-account-button');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){if(e.name!=='AbortError')A.status(e.message,'error');}finally{b.disabled=false;}});return b;}
 async function loadPublic(){
  try{if(slug&&!valid.test(slug))throw new Error('프로그램 주소를 확인해 주세요.');const data=await A.offers(slug);publicRoot.replaceChildren();
   if(!slug){publicRoot.append(el('h1','책에서 시작해, 내 삶으로.'));
    for(const x of data.offers||[]){const s=el('article','','nal-account-record');s.append(el('p','NAL READ','nal-account-kicker'),el('h2',x.title),el('p',x.summary),A.link('/nal/shop/read/?season='+encodeURIComponent(x.seasonSlug),'이 프로그램 보기 →'));publicRoot.append(s);}
    if(!data.offers?.length)publicRoot.append(el('p','공개된 READ 프로그램을 준비하고 있습니다.','nal-account-empty'));return;
   }
   offer=data.offers?.find(x=>x.seasonSlug===slug);
   if(!offer)throw new Error('이 프로그램은 아직 소개를 준비하고 있습니다.');
   publicRoot.append(el('p','NAL READ · SELF-COACHING','nal-account-kicker'),el('h1',offer.title),el('p',offer.summary,'nal-account-lead'));
   const mode={free:'무료 참여',paid:A.money(offer.price),invitation:'초대 참가권'}[offer.mode];
   publicRoot.append(el('p',[mode,offer.dayCount?offer.dayCount+' DAY':'콘텐츠 준비 중',offer.accessDays?'이용 '+offer.accessDays+'일':'이용 안내 확인'].join(' · '),'nal-account-meta'));
   if(offer.startsAt)publicRoot.append(el('p','등록 시작 '+A.date(offer.startsAt),'nal-account-meta'));
   if(offer.endsAt)publicRoot.append(el('p','등록 마감 '+A.date(offer.endsAt),'nal-account-meta'));
   const details=el('details','','nal-account-notice');details.append(el('summary','참여·이용 안내'),el('p',offer.notice));publicRoot.append(details);
   if(document.body.dataset.accountPage==='offer')publicRoot.append(A.link('/nal/read/join/?season='+encodeURIComponent(slug),'내 참가권 확인 / 연결 →','nal-account-button'));
  }catch(e){publicRoot.replaceChildren(el('h1','나의 다음을 읽는 시간.'),el('p',e.message,'nal-account-empty'));}
 }
 async function render(){
  const ticket=++generation;if(!A.user||!slug||!valid.test(slug)||document.body.dataset.accountPage!=='join'){privateRoot.replaceChildren();privateRoot.hidden=true;return;}
  if(!offer)return;
  try{const data=await A.call('join','options',{},slug);if(ticket!==generation)return;privateRoot.replaceChildren();privateRoot.hidden=false;
   if(data.access?.allowed){
    privateRoot.append(el('h2','내 READ에 연결되었습니다.'),el('p','오늘의 질문에 답하고, 일주일에 하나를 해보고, 마지막에는 내가 남긴 문장을 다시 읽습니다.','nal-account-lead'));
    const steps=el('ol','','nal-welcome-steps');for(const t of ['한 문장이어도 충분합니다.','나누고 싶지 않은 답은 나의 기록으로 남겨둡니다.','실험은 작게, 내 사정에 맞게 정합니다.'])steps.append(el('li',t));privateRoot.append(steps);
    privateRoot.append(btn('내 기록 시작 / 이어가기',async()=>{await A.call('join','welcome',{},slug);location.assign(A.read(slug,'today'));}),A.link('/nal/my/','공통 MY NAL로'));return;
   }
   if(data.existingEnrollment){privateRoot.append(el('h2','기존 참가권 상태를 확인해 주세요.'),el('p','일시정지·철회·만료된 참가권은 다시 신청해도 자동 복구되지 않습니다.','nal-account-note'),A.link('/nal/my/?tab=programs','내 참가권 보기'));return;}
   if(!data.release?.allowed){privateRoot.append(el('h2','프로그램 공개를 준비하고 있습니다.'),el('p','상품 안내와 실제 프로그램 접근은 별도입니다. 지금은 참가권 연결을 열지 않았습니다.','nal-account-empty'));return;}
   if(offer.status!=='accepting'){privateRoot.append(el('p','현재는 참가 등록 기간이 아닙니다.','nal-account-empty'));return;}
   const form=el('form','','nal-account-form');const source=el('select');source.setAttribute('aria-label','연결 방법');
   const choices=[];if(offer.mode==='free')choices.push(['free:','무료 참가권']);
   if(data.hasInvitation)choices.push(['invitation:','내 계정에 발급된 초대 참가권']);
   if(offer.mode==='paid')for(const o of data.orders||[])choices.push(['paid:'+o.id,`${A.date(o.createdAt)} · ${A.money(o.amount)} 결제 확인 주문`]);
   if(!choices.length){privateRoot.append(el('h2','연결 가능한 참가권이 아직 없습니다.'),el('p',offer.mode==='paid'?'확인된 주문이 있으면 이곳에서 연결할 수 있습니다. 새 유료 READ 결제창은 별도 개발 중이며 기존 PDF 결제창을 대신 열지 않습니다.':'초대 계정 또는 무료 참여 조건을 확인해 주세요.','nal-account-empty'),A.link('/nal/my/?tab=orders','내 주문 보기'));return;}
   for(const [v,t]of choices){const o=el('option',t);o.value=v;source.append(o);}const hint=params.get('order');if(hint&&choices.some(x=>x[0]==='paid:'+hint))source.value='paid:'+hint;
   const label=el('label','참가권 연결 방법');label.append(source);form.append(label);
   const notice=el('p',offer.notice,'nal-account-notice');form.append(notice);
   const agree=el('label','','nal-account-check'),checkbox=el('input');checkbox.type='checkbox';checkbox.required=true;agree.append(checkbox,document.createTextNode('참여·이용 안내를 확인했습니다.'));form.append(agree);
   const submit=el('button','내 READ에 연결하기','nal-account-button');submit.type='submit';form.append(submit);
   const reset=()=>{request=null;};source.addEventListener('change',reset);checkbox.addEventListener('change',reset);
   form.addEventListener('submit',async event=>{event.preventDefault();if(!checkbox.checked)return;submit.disabled=true;
    const [kind,orderId]=source.value.split(':');request??=crypto.randomUUID();
    try{const result=await A.call('join','claim',{requestId:request,source:kind,orderId:orderId||null,accepted:true,policyVersion:offer.policyVersion},slug);
     if(!result.allowed)throw new Error('참가권이 열리지 않았습니다. 기존 이용 상태를 확인해 주세요.');A.status('참가권을 연결했습니다.','ok');await render();
    }catch(e){A.status(e.message,'error');}finally{submit.disabled=false;}
   });privateRoot.append(form);
  }catch(e){if(e.name!=='AbortError')A.status(e.message,'error');}
 }
 A.ready.then(async()=>{await loadPublic();await render();});A.onChange(render);
})();
