(() => {
 'use strict';
 const A=window.NalAccount;if(!A)return;
 const el=A.node,root=document.querySelector('[data-account-private]');if(!root)return;
 const page=document.body.dataset.accountPage;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 let generation=0,config=null,sdkPromise=null,paying=false,confirmation=null;
 let returned=window.NalPaymentReturn,returnOwner=null,knownOwner=null,createKey=crypto.randomUUID();
 let activeOrder=new URLSearchParams(location.search).get('order');
 const stateNames={pending:'결제 확인 전',paid:'결제 완료',failed:'결제 미완료',partially_refunded:'일부 환불',refunded:'환불 완료',manual_review:'확인 중'};
 const deliveryNames={not_paid:'결제 확인 전',pending:'참가권 연결 중',ready:'참여 가능',blocked:'이용 상태 확인 필요',manual_review:'운영자 확인 중',refunded:'환불로 종료'};
 function context(){return {generation,epoch:A.epoch,id:A.user?.id};}
 function current(c){return c.generation===generation&&c.epoch===A.epoch&&!!c.id&&c.id===A.user?.id;}
 function fail(e,c){if(c&&!current(c))return;A.status(e.name==='AbortError'?'응답을 받지 못했습니다. 다시 결제하지 말고 기존 주문 상태를 확인해 주세요.':e.message,'error');}
 function row(){return el('div','','nal-account-actions');}
 function button(text,fn,secondary=false){const b=el('button',text,secondary?'nal-account-link':'nal-account-button');b.type='button';
  b.addEventListener('click',async()=>{const c=context();b.disabled=true;try{await fn(c);}catch(e){fail(e,c);}finally{if(b.isConnected)b.disabled=false;}});return b;}
 function help(){const block=el('section','','nal-payment-help');block.setAttribute('aria-label','결제 방법 안내');
  block.append(el('p','신용·체크카드로 결제할 수 있습니다.','nal-payment-help-title'),
   el('p','토스 앱·토스 회원가입은 필요하지 않습니다.','nal-account-note'),
   el('p','간편결제는 결제창에 표시되는 수단 중 선택하세요. 카드사에 따라 앱이나 문자 등 인증 절차가 있을 수 있습니다.','nal-account-note'));
  return block;
 }
 function rememberOrder(id){if(!UUID.test(id||''))throw new Error('주문 번호를 확인해 주세요.');activeOrder=id;
  history.replaceState({},'',location.pathname+'?order='+encodeURIComponent(id));}
 function sameTerms(q,t){return q.seasonSlug===t.seasonSlug&&q.amount===t.amount&&q.policyVersion===t.policyVersion&&q.notice===t.notice;}
 function termsOf(q){return {seasonSlug:q.seasonSlug,amount:q.amount,policyVersion:q.policyVersion,notice:q.notice};}
 function loadSDK(){
  if(window.TossPayments)return Promise.resolve();if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://js.tosspayments.com/v2/standard';script.async=true;script.referrerPolicy='no-referrer';
   const timeout=setTimeout(()=>{script.remove();sdkPromise=null;reject(new Error('결제창을 불러오지 못했습니다. 다시 시도해 주세요.'));},15000);
   script.onload=()=>{clearTimeout(timeout);if(window.TossPayments)resolve();else{sdkPromise=null;reject(new Error('결제창 연결을 확인해 주세요.'));}};
   script.onerror=()=>{clearTimeout(timeout);script.remove();sdkPromise=null;reject(new Error('결제창을 불러오지 못했습니다.'));};document.head.append(script);
  });return sdkPromise;
 }
 async function launch(q,accepted,c){
  if(!current(c))return;
  const data=await A.pay('launch',{orderId:q.orderId,accepted:true,expectedAmount:accepted.amount,policyVersion:accepted.policyVersion,notice:accepted.notice});
  if(!current(c))return;
  if(data.order?.orderId!==q.orderId||!sameTerms(data.order,accepted)||data.payment?.method!=='CARD'
   ||data.payment.amount?.currency!=='KRW'||data.payment.amount.value!==accepted.amount)throw new Error('주문 조건이 바뀌었습니다. 내용을 다시 확인해 주세요.');
  for(const [name,path] of [['successUrl','/nal/read/checkout/success/'],['failUrl','/nal/read/checkout/fail/']]){
   const url=new URL(data.payment[name]);if(url.origin!==location.origin||url.pathname!==path||url.searchParams.get('order')!==q.orderId)throw new Error('결제 복귀 주소를 확인하지 못했습니다.');
  }
  A.status('결제수단을 선택해 주세요.');
  // DEFAULT leaves general cards and merchant-enabled easy pays visible. Never select a specific wallet/app.
  await window.TossPayments(data.clientKey).payment({customerKey:data.customerKey}).requestPayment({
   method:'CARD',card:{flowMode:'DEFAULT',useAppCardOnly:false},windowTarget:'self',
   amount:data.payment.amount,orderId:data.payment.orderId,orderName:data.payment.orderName,
   successUrl:data.payment.successUrl,failUrl:data.payment.failUrl
  });
 }
 function consent(label,onPay){
  const form=el('form','','nal-account-form nal-simple-pay-form'),check=el('input');check.type='checkbox';check.required=true;
  const agreement=el('label','','nal-account-check');agreement.append(check,document.createTextNode('참여·이용 안내와 결제 금액을 확인했습니다.'));
  const submit=el('button',label,'nal-account-button');submit.type='submit';form.append(agreement,submit);
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(paying||!check.checked)return;const c=context();paying=true;submit.disabled=true;root.setAttribute('aria-busy','true');
   try{await loadSDK();if(current(c))await onPay(c);}catch(error){fail(error,c);}
   finally{paying=false;if(submit.isConnected)submit.disabled=false;if(current(c))root.removeAttribute('aria-busy');}
  });return form;
 }
 function receipt(q){
  const details=el('details','','nal-order-details');details.append(el('summary','주문 상세·참여 안내'));
  const facts=el('dl','','nal-checkout-state');for(const [name,value]of [['결제',stateNames[q.state]||'상태 확인 필요'],['참가권',deliveryNames[q.fulfillment]||'상태 확인 필요'],['주문일',A.date(q.createdAt)],['환불 반영액',A.money(q.refundedAmount)]])facts.append(el('dt',name),el('dd',value));
  details.append(facts,el('p',q.notice||'','nal-account-notice'),el('p','문의용 주문 번호','nal-account-meta'),el('code',q.orderId));
  if(q.lastCheckedAt)details.append(el('p','마지막 결제 조회 '+A.date(q.lastCheckedAt),'nal-account-meta'));return details;
 }
 function inquiry(q){
  const details=el('details','','nal-order-details');details.append(el('summary','취소·환불 문의'));
  details.append(el('p','아래 문의는 날 운영자에게 남겨집니다. 실제 취소·환불 처리 후 주문 상태에 반영됩니다.','nal-account-note'));
  const open=(q.refunds||[]).find(r=>['requested','approved','processing','manual_review'].includes(r.state));
  if(['paid','partially_refunded'].includes(q.state)&&q.refundedAmount<q.amount&&!open){
   const form=el('form','','nal-account-form'),label=el('label','문의 내용'),input=el('textarea');input.required=true;input.maxLength=1000;input.rows=3;label.append(input);
   const submit=el('button','문의 남기기','nal-account-button');submit.type='submit';form.append(label,submit);
   const requestId=crypto.randomUUID();form.addEventListener('submit',async e=>{e.preventDefault();if(!input.value.trim())return;const c=context();submit.disabled=true;
    try{const updated=await A.pay('refund-request',{orderId:q.orderId,requestId,reason:input.value.trim()});if(current(c)){showOrder(updated,c);A.status('운영자에게 문의를 남겼습니다. 아직 환불 완료 상태는 아닙니다.','ok');}}
    catch(error){fail(error,c);}finally{if(submit.isConnected)submit.disabled=false;}
   });details.append(form);
  }else if(open&&q.state!=='refunded')details.append(el('p','남긴 문의가 있습니다. 처리 여부는 이 주문의 결제 상태에서 확인해 주세요.','nal-account-note'));
  if(q.state==='refunded')details.append(el('p','결제사에서 확인한 환불 결과가 반영되었습니다.','nal-account-note'));
  for(const request of q.refunds||[]){const item=el('section','','nal-account-record');item.append(el('p',request.reason),el('p','남긴 날짜 '+A.date(request.createdAt),'nal-account-meta'));
   if(request.state==='withdrawn')item.append(el('p','철회한 문의','nal-account-meta'));
   if(request.decisionNote)item.append(el('p',request.decisionNote,'nal-account-note'));
   if(request.state==='requested'&&q.state!=='refunded')item.append(button('이 문의 철회',async c=>{if(!confirm('남긴 취소·환불 문의를 철회할까요?'))return;const updated=await A.pay('refund-withdraw',{orderId:q.orderId,refundId:request.id});if(current(c))showOrder(updated,c);},true));details.append(item);
  }return details;
 }
 async function refresh(id,c){const result=await A.pay('refresh',{orderId:id});if(current(c))showOrder(result,c);}
 function showOrder(q,c=context()){
  if(!current(c)||!q||!UUID.test(q.orderId||''))return;rememberOrder(q.orderId);root.replaceChildren();root.hidden=false;
  const ready=q.state==='paid'&&q.fulfillment==='ready';
  const title=ready?'참여가 완료되었습니다.':q.state==='paid'?'내 READ를 연결하고 있습니다.':q.state==='refunded'?'환불 결과가 반영되었습니다.':q.state==='partially_refunded'?'일부 환불 결과가 반영되었습니다.':q.canResume?'내가 선택한 프로그램':q.state==='failed'?'결제가 완료되지 않았습니다.':'기존 주문을 확인하고 있습니다.';
  root.append(el('p','NAL READ','nal-account-kicker'),el('h1',title,'nal-payment-heading'),el('h2',q.title),el('p',A.money(q.amount),'nal-checkout-price'));
  const buttons=row();
  if(ready){
   root.append(el('p','주문을 다시 고르거나 참가권을 연결할 필요 없이 시작하세요.','nal-account-lead'));
   buttons.append(A.link(A.read(q.seasonSlug,'today'),page==='payment-success'?'첫 질문 시작하기':'내 READ 이어가기','nal-account-button'),A.link('/nal/my/','MY NAL'));
  }else if(q.state==='paid'){
   root.append(el('p','결제는 확인됐습니다. 참가권 연결이 늦어져도 다시 결제하지 마세요.','nal-checkout-message'));
   buttons.append(button('연결 상태 확인',c=>refresh(q.orderId,c)),A.link('/nal/my/','MY NAL'));
  }else{
   buttons.append(button('기존 주문 상태 확인',c=>refresh(q.orderId,c),true),A.link('/nal/my/payments/','내 주문 목록'));
  }
  if(q.canResume&&config?.checkoutEnabled){
   root.append(help(),el('p',q.notice||'','nal-account-notice'));
   root.append(consent(A.money(q.amount)+' 결제하고 참여하기',ctx=>launch(q,termsOf(q),ctx)));
  }else if(!ready&&q.state==='pending')root.append(el('p','진행 중인 결제가 있는지 확인합니다. 결과가 불명확하면 새로 결제하지 마세요.','nal-account-note'));
  if(q.state==='pending'&&q.providerStatus==='IN_PROGRESS'&&config?.checkoutEnabled){
   buttons.append(button('기존 결제 승인 이어가기',async ctx=>{
    if(!confirm(A.money(q.amount)+'의 기존 결제 인증을 승인할까요? 추가 주문을 만들지 않습니다.'))return;
    const updated=await A.pay('confirm-recover',{orderId:q.orderId,amount:q.amount,accepted:true});if(current(ctx))showOrder(updated,ctx);
   },true));
  }
  if(q.state==='partially_refunded')root.append(el('p','반영된 환불액은 '+A.money(q.refundedAmount)+'입니다. 남은 참가 권한은 운영자가 확인합니다.','nal-account-note'));
  root.append(buttons,receipt(q));
  if(['paid','partially_refunded','refunded'].includes(q.state)||(q.refunds||[]).length)root.append(inquiry(q));
 }
 async function quote(slug,c){
  if(!/^[a-z0-9-]{1,120}$/.test(slug||''))throw new Error('참여할 프로그램을 선택해 주세요.');
  const data=await A.offers(slug);if(!current(c))return;const offer=data.offers?.find(x=>x.seasonSlug===slug);
  if(!offer)throw new Error('이 프로그램은 소개를 준비하고 있습니다.');
  root.replaceChildren();root.hidden=false;root.append(el('h2',offer.title),el('p',offer.summary||'','nal-account-lead'));
  if(offer.mode!=='paid'){root.append(A.link('/nal/read/join/?season='+encodeURIComponent(slug),'무료·초대 참가로 시작하기','nal-account-button'));return;}
  root.append(el('p',A.money(offer.price),'nal-checkout-price'),help(),el('p',offer.notice||'','nal-account-notice'));
  if(!config.checkoutEnabled||offer.status!=='accepting'){root.append(el('p','지금은 새 결제를 받지 않습니다. 기존 주문은 MY NAL에서 확인해 주세요.','nal-account-empty'));return;}
  const displayed={seasonSlug:slug,amount:offer.price,policyVersion:offer.policyVersion,notice:offer.notice};
  root.append(consent(A.money(offer.price)+' 결제하고 참여하기',async ctx=>{
   const q=await A.pay('create',{seasonSlug:slug,requestId:createKey,expectedAmount:offer.price,policyVersion:offer.policyVersion,accepted:true});
   if(!current(ctx))return;rememberOrder(q.orderId);
   // Normal path: one NAL agreement, then directly into the general payment selector.
   // Reused older orders are NOT charged silently under different terms.
   if(!q.canResume||!sameTerms(q,displayed)){showOrder(q,ctx);if(q.canResume)A.status('기존 주문의 조건이 현재 안내와 다릅니다. 표시된 주문을 확인한 뒤 진행해 주세요.');return;}
   await launch(q,displayed,ctx);
  }));
 }
 async function list(c){
  if(!current(c))return;root.replaceChildren();root.hidden=false;root.append(el('h2','내 주문'));
  const contents=el('div');root.append(contents);let offset=0,loading=false;
  async function more(){if(loading)return;loading=true;
   try{const data=await A.pay('list',{offset});if(!current(c))return;contents.querySelector('[data-more]')?.remove();const batch=(data.orders||[]).slice(0,50);offset+=batch.length;
    for(const q of batch){const item=el('article','','nal-account-record');item.append(el('h3',q.title),el('p',A.money(q.amount)+' · '+(stateNames[q.state]||'확인 필요')),el('p',A.date(q.createdAt),'nal-account-meta'),A.link('/nal/my/payments/?order='+q.orderId,'주문 보기 →'));contents.append(item);}
    if(!offset)contents.append(el('p','아직 READ 결제 내역이 없습니다. 무료·초대 프로그램은 MY NAL에서 확인할 수 있습니다.','nal-account-empty'));
    if((data.orders||[]).length>50){const b=button('더 보기',more,true);b.dataset.more='';contents.append(b);}
   }finally{loading=false;}
  }await more();if(current(c))root.append(A.link('/nal/shop/read/','프로그램 보기'),A.link('/nal/my/','MY NAL'));
 }
 async function render(){
  ++generation;const owner=A.user?.id;
  if(knownOwner&&knownOwner!==owner){returned=null;window.NalPaymentReturn=null;createKey=crypto.randomUUID();}
  knownOwner=owner||null;
  if(!owner){root.replaceChildren();root.hidden=true;return;}
  const c=context();
  try{
   config=await A.payConfig();if(!current(c))return;
   if(!config.enabled){root.replaceChildren(el('p','READ 결제를 준비하고 있습니다. 기존 무료 자료는 스토어에서 이용할 수 있습니다.','nal-account-empty'));root.hidden=false;return;}
   if(config.mode==='test')A.status('개발용 결제 설정입니다. 실제 판매는 아직 시작하지 않았습니다.');
   const id=new URLSearchParams(location.search).get('order')||activeOrder;
   if(id){
    if(!UUID.test(id))throw new Error('주문 주소를 확인해 주세요.');
    if(returned&&returned.orderId===id){
     returnOwner??=owner;
     if(returnOwner!==owner){returned=null;window.NalPaymentReturn=null;}
     else if(!confirmation){const payload=returned;returned=null;window.NalPaymentReturn=null;
      confirmation=A.pay('confirm',payload).catch(e=>fail(e,c)).finally(()=>{confirmation=null;});}
    }
    if(confirmation)await confirmation;if(!current(c))return;
    const q=await A.pay('get',{orderId:id});if(current(c))showOrder(q,c);
   }else if(page==='payments')await list(c);
   else await quote(new URLSearchParams(location.search).get('season'),c);
  }catch(e){fail(e,c);}
 }
 A.ready.then(ok=>{if(ok)render();});A.onChange(render);
})();
