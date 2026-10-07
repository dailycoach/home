(() => {
 'use strict';const A=window.NalAccount;if(!A)return;
 const el=A.node,root=document.querySelector('[data-account-private]'),page=document.body.dataset.accountPage;
 const query=new URLSearchParams(location.search),initialOrder=query.get('order');
 let generation=0,returned=window.NalPaymentReturn,confirming=false,config=null,createKey=crypto.randomUUID(),sdkPromise=null;
 const statusLabel={pending:'결제 대기',paid:'결제 완료',failed:'결제 미완료',partially_refunded:'일부 환불',refunded:'환불 완료',manual_review:'확인 필요'};
 const fulfillmentLabel={not_paid:'결제 후 연결',pending:'참가권 연결 중',ready:'참가권 연결됨',blocked:'참가권 상태 확인',manual_review:'운영자 확인 중',refunded:'환불로 이용 종료'};
 const refundLabel={requested:'요청 접수',approved:'승인·실행 대기',processing:'환불 확인 중',completed:'환불 처리됨',rejected:'검토 완료',withdrawn:'요청 철회',manual_review:'거래 확인 필요'};
 function button(text,fn){const b=el('button',text,'nal-account-button');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){showError(e);}finally{b.disabled=false;}});return b;}
 function showError(e){if(e.name==='AbortError'){A.status('응답을 받지 못했습니다. 다시 결제하지 말고 주문 상태를 새로 확인해 주세요.','error');return;}A.status(e.message,'error');}
 function actions(){return el('div','','nal-account-actions');}
 function openSDK(){if(window.TossPayments)return Promise.resolve();if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://js.tosspayments.com/v2/standard';script.async=true;
   script.onload=()=>window.TossPayments?resolve():reject(new Error('결제창을 불러오지 못했습니다.'));script.onerror=()=>{sdkPromise=null;reject(new Error('결제창을 불러오지 못했습니다.'));};document.head.append(script);});return sdkPromise;
 }
 function historyOrder(id){const u=new URL(location.href);u.search='?order='+encodeURIComponent(id);history.replaceState({},'',u.pathname+u.search);}
 async function refresh(id){const r=await A.pay('refresh',{orderId:id});await showOrder(r);}
 async function showOrder(q){
  if(!q||!A.user)return;root.replaceChildren();root.hidden=false;historyOrder(q.orderId);
  root.append(el('p','NAL READ · MY ORDER','nal-account-kicker'),el('h2',q.title),el('p',A.money(q.amount),'nal-checkout-price'));
  const states=el('dl','','nal-checkout-state');
  for(const [label,value]of [['결제',statusLabel[q.state]||q.state],['참가권',fulfillmentLabel[q.fulfillment]||q.fulfillment],['주문일',A.date(q.createdAt)],['환불 반영액',A.money(q.refundedAmount)]]){states.append(el('dt',label),el('dd',value));}root.append(states);
  const notice=el('details','','nal-account-notice');notice.append(el('summary','주문 당시 참여·이용 안내'),el('p',q.notice||''));root.append(notice);
  const row=actions();
  if(q.fulfillment==='ready'&&q.state==='paid')row.append(A.link('/nal/read/join/?season='+encodeURIComponent(q.seasonSlug),'내 READ 시작하기 →','nal-account-button'));
  if(q.state==='paid'&&q.fulfillment!=='ready')root.append(el('p','결제는 확인됐습니다. 참가권 연결을 기다리는 동안 다시 결제하지 마세요. 아래 버튼으로 연결 상태를 다시 확인할 수 있습니다.','nal-checkout-message'));
  if(q.state==='partially_refunded')root.append(el('p','일부 금액의 환불이 반영됐습니다. 남은 참가 권한은 운영자가 확인하며, 전액 환불로 표시하지 않습니다.','nal-checkout-message'));
  row.append(button('결제·참가권 상태 새로 확인',()=>refresh(q.orderId)),A.link('/nal/my/','공통 MY NAL'),A.link('/nal/my/payments/','READ 결제 내역'));
  root.append(row);
  if(q.canResume&&config?.checkoutEnabled){
   const form=el('form','','nal-account-form'),label=el('label','','nal-account-check'),check=el('input');check.type='checkbox';check.required=true;
   label.append(check,document.createTextNode('위 금액과 주문 당시 참여 안내를 확인했습니다.'));form.append(label);
   const pay=el('button',A.money(q.amount)+' 결제하기','nal-account-button');pay.type='submit';form.append(pay);
   form.addEventListener('submit',async e=>{e.preventDefault();if(!check.checked)return;pay.disabled=true;
    try{const owner=A.epoch;await openSDK();const launch=await A.pay('launch',{orderId:q.orderId});if(owner!==A.epoch)return;
     A.status('토스페이먼츠 결제창으로 연결합니다.');
     await window.TossPayments(launch.clientKey).payment({customerKey:launch.customerKey}).requestPayment(launch.payment);
    }catch(error){showError(error);}finally{pay.disabled=false;}
   });root.append(form);
  }
  if(q.state==='pending'&&!q.canResume)root.append(el('p','이미 승인 요청이 시작됐거나 주문 시간이 지났습니다. 결제창을 새로 열지 않고 기존 거래부터 확인합니다.','nal-account-note'));
  if(q.state==='pending'&&q.providerStatus==='IN_PROGRESS'){
   root.append(button('인증한 결제 승인 이어가기',async()=>{
    if(!confirm(A.money(q.amount)+'의 기존 결제 인증을 승인할까요? 새 주문이나 추가 결제를 만들지 않습니다.'))return;
    const r=await A.pay('confirm-recover',{orderId:q.orderId,amount:q.amount,accepted:true});await showOrder(r);
   }));
  }
  if(q.state==='failed')root.append(el('p','이 주문으로 완료된 결제를 확인하지 못했습니다. 카드사 승인 내역이 있다면 운영자에게 주문 번호로 문의해 주세요.','nal-account-note'));
  if(['paid','partially_refunded'].includes(q.state)&&q.refundedAmount<q.amount){
   const open=(q.refunds||[]).some(r=>['requested','approved','processing','manual_review'].includes(r.state));
   if(!open){const form=el('form','','nal-account-form'),label=el('label','취소·환불 요청 사유'),input=el('textarea');input.rows=3;input.maxLength=1000;input.required=true;label.append(input);form.append(label);
    const submit=el('button','취소·환불 검토 요청','nal-account-button');submit.type='submit';form.append(submit);
    form.append(el('p','요청 접수는 환불 완료가 아닙니다. 적용되는 참여 안내에 따라 운영자가 금액과 사유를 검토합니다.','nal-account-note'));
    const requestId=crypto.randomUUID();form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;
     try{const result=await A.pay('refund-request',{orderId:q.orderId,requestId,reason:input.value.trim()});await showOrder(result);A.status('환불 검토 요청을 남겼습니다.','ok');}
     catch(error){showError(error);}finally{submit.disabled=false;}
    });root.append(form);
   }
  }
  for(const refund of q.refunds||[]){const item=el('section','','nal-account-record');item.append(el('h3',refundLabel[refund.state]||refund.state),el('p',refund.reason));
   if(refund.amount!=null)item.append(el('p','검토·처리 금액 '+A.money(refund.amount)));
   if(refund.decisionNote)item.append(el('p',refund.decisionNote,'nal-account-note'));
   if(refund.completedAt)item.append(el('p','처리 확인 '+A.date(refund.completedAt),'nal-account-meta'));
   if(refund.state==='requested')item.append(button('이 요청 철회',async()=>{if(confirm('아직 검토 전인 환불 요청을 철회할까요?'))await showOrder(await A.pay('refund-withdraw',{orderId:q.orderId,refundId:refund.id}));}));root.append(item);
  }
  const reference=el('details','','nal-order-reference');reference.append(el('summary','문의용 주문 번호'),el('code',q.orderId));root.append(reference);
 }
 async function quote(slug,ticket){
  if(!/^[a-z0-9-]{1,120}$/.test(slug||''))throw new Error('프로그램을 선택해 주세요.');
  const data=await A.offers(slug);if(ticket!==generation)return;const offer=data.offers?.find(x=>x.seasonSlug===slug);
  if(!offer)throw new Error('프로그램 소개를 준비하고 있습니다.');root.replaceChildren();root.hidden=false;
  root.append(el('h2',offer.title),el('p',offer.summary,'nal-account-lead'));
  if(offer.mode!=='paid'){root.append(A.link('/nal/read/join/?season='+encodeURIComponent(slug),'무료·초대 참가권 연결'));return;}
  root.append(el('p',A.money(offer.price),'nal-checkout-price'),el('p','카드·간편결제 · 책은 별도 준비','nal-account-meta'));
  root.append(el('p',offer.notice,'nal-account-notice'));
  if(!config.checkoutEnabled||offer.status!=='accepting'){root.append(el('p','현재는 새 결제를 받지 않습니다. 프로그램 안내를 확인하고 다시 방문해 주세요.','nal-account-empty'));return;}
  const form=el('form','','nal-account-form'),label=el('label','','nal-account-check'),check=el('input');check.type='checkbox';check.required=true;label.append(check,document.createTextNode('참여·이용 안내와 결제 금액을 확인했습니다.'));form.append(label);
  const submit=el('button','내 주문 준비하기','nal-account-button');submit.type='submit';form.append(submit);
  form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;
   try{const q=await A.pay('create',{seasonSlug:slug,requestId:createKey,expectedAmount:offer.price,policyVersion:offer.policyVersion,accepted:check.checked});await showOrder(q);}
   catch(error){showError(error);}finally{submit.disabled=false;}
  });root.append(form);
 }
 async function list(ticket){
  root.replaceChildren();root.hidden=false;root.append(el('h2','내 READ 결제와 환불'));
  const content=el('div');root.append(content);let offset=0,loading=false;
  async function more(){if(loading)return;loading=true;
   try{const data=await A.pay('list',{offset});if(ticket!==generation)return;content.querySelector('[data-more]')?.remove();
    const rows=(data.orders||[]).slice(0,50);offset+=rows.length;
    for(const q of rows){const s=el('section','','nal-account-record');s.append(el('h3',q.title),el('p',A.money(q.amount)+' · '+statusLabel[q.state]),el('p',A.date(q.createdAt),'nal-account-meta'),A.link('/nal/my/payments/?order='+q.orderId,'주문·참가권·환불 보기 →'));content.append(s);}
    if(!offset)content.append(el('p','아직 READ 전용 결제 내역이 없습니다. 무료·초대 프로그램은 내 READ에서 확인할 수 있습니다.','nal-account-empty'));
    if((data.orders||[]).length>50){const b=button('내역 더 보기',more);b.dataset.more='';content.append(b);}
   }finally{loading=false;}
  }await more();root.append(A.link('/nal/shop/read/','READ 프로그램 보기'),A.link('/nal/my/','전체 MY NAL'));
 }
 async function render(){const ticket=++generation;if(!A.user){root.replaceChildren();root.hidden=true;return;}
  try{config=await A.payConfig();if(ticket!==generation)return;
   if(!config.enabled){root.replaceChildren(el('p','READ 결제 기능은 연결 준비 중입니다. 기존 무료 자료는 스토어에서 그대로 이용할 수 있습니다.','nal-account-empty'));root.hidden=false;return;}
   if(config.mode==='test')A.status('테스트 결제 설정입니다. 판매 운영 환경은 아직 활성화하지 않았습니다.');
   const id=new URLSearchParams(location.search).get('order')||initialOrder;
   if(id){
    if(returned&&!confirming){confirming=true;const payload=returned;returned=null;window.NalPaymentReturn=null;
     try{await A.pay('confirm',payload);}catch(e){showError(e);}finally{confirming=false;}
    }
    const q=await A.pay('get',{orderId:id});if(ticket===generation)await showOrder(q);
    if(page==='payment-fail')A.status('결제창에서 완료되지 않았습니다. 실패 화면만으로 결제나 환불 상태를 단정하지 않고 기존 주문부터 확인합니다.');
   }else if(page==='payments')await list(ticket);
   else await quote(new URLSearchParams(location.search).get('season'),ticket);
  }catch(e){showError(e);}
 }
 A.ready.then(ok=>{if(ok)render();});A.onChange(render);
})();
