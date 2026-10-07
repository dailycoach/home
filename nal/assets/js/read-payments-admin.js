(() => {
 'use strict';const A=window.NalAccount;if(!A)return;
 const el=A.node,root=document.querySelector('[data-account-private]');let run=0;
 const state={pending:'결제 확인 전',paid:'결제 완료',failed:'미완료',partially_refunded:'일부 환불',refunded:'환불 완료',manual_review:'확인 필요'};
 const delivery={not_paid:'결제 전',pending:'참가권 연결 대기',ready:'참여 가능',blocked:'이용권 확인 필요',manual_review:'참가권 확인 필요',refunded:'이용 종료'};
 function button(text,fn){const b=el('button',text,'nal-account-link');b.type='button';b.addEventListener('click',async()=>{const owner=A.epoch;b.disabled=true;try{await fn();}catch(e){if(owner===A.epoch&&e.name!=='AbortError')A.status(e.message,'error');}finally{if(b.isConnected)b.disabled=false;}});return b;}
 function merchant(){const a=A.link('https://app.tosspayments.com/','토스 상점관리자 열기 ↗','nal-account-button');a.target='_blank';a.rel='noopener noreferrer';return a;}
 async function render(){const ticket=++run;if(!A.user){root.replaceChildren();root.hidden=true;return;}
  try{
   const data=await A.pay('admin-list',{filter:'all',offset:0});if(ticket!==run)return;
   root.replaceChildren();root.hidden=false;
   root.append(el('h2','돈 관리는 결제사에서, 참여 관리는 날에서.'),
    el('p','실제 취소·환불과 정산은 토스 상점관리자에서 처리하세요. 처리 후에는 날의 주문 상태와 참가권 연결만 다시 확인합니다.','nal-account-note'),merchant());
   const contents=el('div');root.append(contents);let offset=0;
   async function append(batchData){if(ticket!==run)return;const batch=(batchData.orders||[]).slice(0,50);offset+=batch.length;
    for(const q of batch){const s=el('article','','nal-account-record');
     s.append(el('h3',q.title),el('p',A.money(q.amount)+' · '+(state[q.state]||'확인 필요')),
      el('p',delivery[q.fulfillment]||'참가권 확인 필요','nal-account-note'));
     if(q.refundedAmount)s.append(el('p','반영된 환불액 '+A.money(q.refundedAmount),'nal-account-meta'));
     s.append(el('p','결제사에서 찾을 주문 번호','nal-account-meta'),el('code',q.providerOrderId));
     s.append(button('결제사 주문 번호 복사',async()=>{
      if(!navigator.clipboard?.writeText)throw new Error('표시된 주문 번호를 직접 복사해 주세요.');
      await navigator.clipboard.writeText(q.providerOrderId);A.status('주문 번호를 복사했습니다. 토스 상점관리자에서 검색해 주세요.','ok');
     }),button('결제사 상태 반영·참가권 연결',async()=>{await A.pay('admin-refresh',{orderId:q.orderId});if(ticket===run)await render();}));
     const requests=(q.refunds||[]).filter(r=>r.state!=='withdrawn');
     if(requests.length){const d=el('details','','nal-order-details');d.append(el('summary','참가자가 남긴 문의 '+requests.length+'건'));
      for(const r of requests)d.append(el('p',r.reason),el('p',A.date(r.createdAt),'nal-account-meta'));
      d.append(el('p',q.state==='refunded'?'이 주문은 환불 결과가 반영된 상태입니다. 문의 원문은 기록으로 남습니다.':'문의 접수만으로 취소·환불이 실행되지는 않습니다.','nal-account-note'));s.append(d);
     }
     if(q.state==='partially_refunded')s.append(el('p','일부 환불로 참가권이 일시정지된 경우 운영자가 이용 범위를 확인해야 합니다. 이 화면은 권한을 자동 복구하지 않습니다.','nal-account-note'));
     const detail=el('details','','nal-order-details');detail.append(el('summary','내부 주문 정보'),el('code',q.orderId),el('p',q.notice||'','nal-account-notice'));
     if(q.fulfillmentReason)detail.append(el('p',q.fulfillmentReason,'nal-account-meta'));if(q.workError)detail.append(el('p',q.workError,'nal-account-meta'));s.append(detail);contents.append(s);
    }
    contents.querySelector('[data-more]')?.remove();
    if((batchData.orders||[]).length>50){const b=button('다음 주문 보기',async()=>{const next=await A.pay('admin-list',{filter:'all',offset});await append(next);});b.dataset.more='';contents.append(b);}
   }
   await append(data);if(!offset)contents.append(el('p','아직 READ 결제 기록이 없습니다.','nal-account-empty'));
   root.append(A.link('/nal/read/admin/offers/','참가상품 설정'),A.link('/nal/read/admin/','콘텐츠 편집'));
  }catch(e){if(ticket===run&&e.name!=='AbortError')A.status(e.message,'error');}
 }
 A.ready.then(ok=>{if(ok)render();});A.onChange(render);
})();
