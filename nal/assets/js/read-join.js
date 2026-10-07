(() => {
 'use strict';const A=window.NalAccount;if(!A)return;const el=A.node;
 const publicRoot=document.querySelector('[data-offer-public]'),privateRoot=document.querySelector('[data-account-private]');
 const params=new URLSearchParams(location.search),slug=params.get('season');let generation=0,offer=null,request=null,paymentConfig=null;
 const valid=/^[a-z0-9-]{1,120}$/;
 function btn(text,fn){const b=el('button',text,'nal-account-button');b.type='button';b.addEventListener('click',async()=>{const epoch=A.epoch;b.disabled=true;try{await fn();}catch(e){if(epoch===A.epoch&&e.name!=='AbortError')A.status(e.message,'error');}finally{if(b.isConnected)b.disabled=false;}});return b;}
 const purchaseLink=()=>A.link('/nal/read/checkout/?season='+encodeURIComponent(slug),'참여하기 →','nal-account-button');
 async function loadPublic(){
  try{
   if(slug&&!valid.test(slug))throw new Error('프로그램 주소를 확인해 주세요.');
   const [data,pay]=await Promise.all([A.offers(slug),A.payConfig().catch(()=>null)]);paymentConfig=pay;publicRoot.replaceChildren();
   if(!slug){publicRoot.append(el('h1','책에서 시작해, 내 삶으로.'));
    for(const x of data.offers||[]){const s=el('article','','nal-account-record');s.append(el('p','NAL READ','nal-account-kicker'),el('h2',x.title),el('p',x.summary),A.link('/nal/shop/read/?season='+encodeURIComponent(x.seasonSlug),'이 프로그램 보기 →'));publicRoot.append(s);}
    if(!data.offers?.length)publicRoot.append(el('p','공개된 READ 프로그램을 준비하고 있습니다.','nal-account-empty'));return;
   }
   offer=data.offers?.find(x=>x.seasonSlug===slug);if(!offer)throw new Error('이 프로그램은 아직 소개를 준비하고 있습니다.');
   publicRoot.append(el('p','NAL READ · SELF-COACHING','nal-account-kicker'),el('h1',offer.title),el('p',offer.summary,'nal-account-lead'));
   const mode={free:'무료 참여',paid:A.money(offer.price),invitation:'초대 참가권'}[offer.mode];
   publicRoot.append(el('p',[mode,offer.dayCount?offer.dayCount+' DAY':'콘텐츠 준비 중',offer.accessDays?'이용 '+offer.accessDays+'일':'이용 안내 확인'].join(' · '),'nal-account-meta'));
   if(offer.startsAt)publicRoot.append(el('p','등록 시작 '+A.date(offer.startsAt),'nal-account-meta'));
   if(offer.endsAt)publicRoot.append(el('p','등록 마감 '+A.date(offer.endsAt),'nal-account-meta'));
   const details=el('details','','nal-account-notice');details.append(el('summary','참여·이용 안내'),el('p',offer.notice));publicRoot.append(details);
   if(document.body.dataset.accountPage==='offer'){
    if(offer.mode==='paid'){
     if(offer.status==='accepting'&&paymentConfig?.checkoutEnabled)publicRoot.append(purchaseLink());
     else publicRoot.append(el('p','새 참가 신청을 준비하고 있습니다.','nal-account-note'));
     publicRoot.append(el('p','토스 앱 없이 신용·체크카드로 결제할 수 있습니다. 간편결제는 결제창에 표시되는 수단 중에서 선택하세요.','nal-account-note'));
    }else publicRoot.append(A.link('/nal/read/join/?season='+encodeURIComponent(slug),'참여하기 →','nal-account-button'));
    publicRoot.append(A.link('/nal/my/','이미 참여 중이라면 MY NAL'));
    const recovery=el('details','','nal-account-notice');recovery.append(el('summary','이전 구매·초대 참가권을 연결하려면'),A.link('/nal/read/join/?season='+encodeURIComponent(slug),'참가권 연결 화면'));publicRoot.append(recovery);
   }
  }catch(e){publicRoot.replaceChildren(el('h1','나의 다음을 읽는 시간.'),el('p',e.message,'nal-account-empty'));}
 }
 async function render(){
  const ticket=++generation;if(!A.user||!slug||!valid.test(slug)||document.body.dataset.accountPage!=='join'){privateRoot.replaceChildren();privateRoot.hidden=true;return;}
  if(!offer)return;
  try{
   const data=await A.call('join','options',{},slug);if(ticket!==generation)return;privateRoot.replaceChildren();privateRoot.hidden=false;
   if(data.access?.allowed){
    privateRoot.append(el('h2','내 READ가 준비되었습니다.'),el('p','한 문장이어도 충분합니다. 지금의 나를 남겨보세요.','nal-account-lead'),
     A.link(A.read(slug,'today'),'첫 질문 시작 / 이어가기','nal-account-button'),A.link('/nal/my/','MY NAL'));return;
   }
   if(data.existingEnrollment){privateRoot.append(el('h2','기존 참가권 상태를 확인해 주세요.'),el('p','일시정지·철회·만료된 참가권은 다시 신청해도 자동 복구되지 않습니다.','nal-account-note'),A.link('/nal/my/?tab=programs','내 참가권 보기'));return;}
   if(!data.release?.allowed){privateRoot.append(el('h2','프로그램 공개를 준비하고 있습니다.'),el('p','지금은 참가권 연결을 열지 않았습니다.','nal-account-empty'),A.link('/nal/my/payments/','이미 결제한 내역 확인'));return;}
   if(offer.status!=='accepting'){privateRoot.append(el('p','현재는 참가 등록 기간이 아닙니다.','nal-account-empty'));return;}
   const form=el('form','','nal-account-form'),source=el('select');source.setAttribute('aria-label','연결 방법');
   const choices=[];if(offer.mode==='free')choices.push(['free:','무료 참가권']);
   if(data.hasInvitation)choices.push(['invitation:','내 계정의 초대 참가권']);
   if(offer.mode==='paid')for(const o of data.orders||[])choices.push(['paid:'+o.id,`${A.date(o.createdAt)} · ${A.money(o.amount)} 결제 확인 주문`]);
   if(!choices.length){
    privateRoot.append(el('h2','연결 가능한 참가권이 아직 없습니다.'));
    if(offer.mode==='paid'&&paymentConfig?.checkoutEnabled)privateRoot.append(el('p','이미 결제했다면 다시 결제하지 말고 주문 내역부터 확인해 주세요.','nal-account-note'),purchaseLink());
    else privateRoot.append(el('p',offer.mode==='paid'?'새 결제는 아직 준비 중입니다.':'초대 계정 또는 무료 참여 조건을 확인해 주세요.','nal-account-empty'));
    privateRoot.append(A.link('/nal/my/payments/','내 주문 확인'));return;
   }
   for(const [v,t]of choices){const o=el('option',t);o.value=v;source.append(o);}const hint=params.get('order');if(hint&&choices.some(x=>x[0]==='paid:'+hint))source.value='paid:'+hint;
   if(choices.length>1){const label=el('label','연결할 참가권');label.append(source);form.append(label);}else source.hidden=true;
   form.append(el('p',offer.notice,'nal-account-notice'));
   const agree=el('label','','nal-account-check'),checkbox=el('input');checkbox.type='checkbox';checkbox.required=true;agree.append(checkbox,document.createTextNode('참여·이용 안내를 확인했습니다.'));form.append(agree);
   const submit=el('button','참여하고 시작하기','nal-account-button');submit.type='submit';form.append(submit);
   source.addEventListener('change',()=>{request=null;});
   form.addEventListener('submit',async event=>{
    event.preventDefault();if(!checkbox.checked)return;submit.disabled=true;const epoch=A.epoch;
    const [kind,orderId]=source.value.split(':');request??=crypto.randomUUID();
    try{
     const result=await A.call('join','claim',{requestId:request,source:kind,orderId:orderId||null,accepted:true,policyVersion:offer.policyVersion},slug);
     if(epoch!==A.epoch)return;if(!result.allowed)throw new Error('참가권이 열리지 않았습니다. 기존 이용 상태를 확인해 주세요.');
     location.assign(A.read(slug,'today'));
    }catch(e){if(epoch===A.epoch)A.status(e.message,'error');}finally{if(submit.isConnected)submit.disabled=false;}
   });privateRoot.append(form);
  }catch(e){if(ticket===generation&&e.name!=='AbortError')A.status(e.message,'error');}
 }
 A.ready.then(async()=>{await loadPublic();await render();});A.onChange(render);
})();
