(() => {
 'use strict';const A=window.NalAccount;if(!A)return;const el=A.node,root=document.querySelector('[data-account-private]');let run=0;
 function button(text,fn){const b=el('button',text,'nal-account-button');b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){if(e.name!=='AbortError')A.status(e.message,'error');}finally{b.disabled=false;}});return b;}
 async function render(){const ticket=++run;if(!A.user){root.replaceChildren();root.hidden=true;return;}
  try{const data=await A.pay('admin-list',{filter:'attention',offset:0});if(ticket!==run)return;root.replaceChildren();root.hidden=false;
   root.append(el('h2','확인이 필요한 결제·참가권·환불'),el('p','승인은 검토 기록입니다. 실제 환불은 별도 실행 버튼에서 금액을 다시 확인합니다.','nal-account-note'));
   let offset=0;
   async function append(data){
    const orders=(data.orders||[]).slice(0,50);offset+=orders.length;
    for(const q of orders){const section=el('section','','nal-account-record');
     section.append(el('h3',q.title),el('p',A.money(q.amount)+' · '+q.state+' / '+q.fulfillment),el('p','반영 환불액 '+A.money(q.refundedAmount)),el('code',q.orderId));
     if(q.fulfillmentReason)section.append(el('p',q.fulfillmentReason,'nal-account-note'));
     if(q.workError)section.append(el('p','재처리 사유: '+q.workError,'nal-account-note'));
     section.append(button('결제 조회·참가권 연결 재처리',async()=>{await A.pay('admin-refresh',{orderId:q.orderId});await render();}));
     for(const r of q.refunds||[]){
      const box=el('div','','nal-refund-review');box.append(el('h4','환불 요청 · '+r.state),el('p',r.reason));
      if(r.amount!=null)box.append(el('p','승인 금액 '+A.money(r.amount)));if(r.decisionNote)box.append(el('p',r.decisionNote,'nal-account-note'));
      if(r.state==='requested'){
       const form=el('form','','nal-account-form'),amount=el('input');amount.type='number';amount.min='1';amount.max=String(q.amount-q.refundedAmount);amount.step='1';amount.value=String(q.amount-q.refundedAmount);amount.required=true;
       const amountLabel=el('label','검토한 환불 금액');amountLabel.append(amount);
       const note=el('textarea');note.required=true;note.maxLength=180;note.rows=3;const noteLabel=el('label','고객에게 표시할 검토 사유');noteLabel.append(note);
       const check=el('input');check.type='checkbox';check.required=true;const agreed=el('label','','nal-account-check');agreed.append(check,document.createTextNode('주문·이용 안내·금액을 확인했습니다.'));
       form.append(amountLabel,noteLabel,agreed);
       const approve=el('button','환불 승인 기록','nal-account-button');approve.type='submit';form.append(approve);
       form.addEventListener('submit',async e=>{e.preventDefault();approve.disabled=true;try{await A.pay('refund-approve',{orderId:q.orderId,refundId:r.id,revision:r.revision,confirmed:check.checked,amount:Number(amount.value),note:note.value});await render();}catch(e){A.status(e.message,'error');}finally{approve.disabled=false;}});
       form.append(button('사유를 남기고 승인하지 않기',async()=>{if(!check.checked||!note.value.trim())throw new Error('확인 표시와 사유를 먼저 남겨주세요.');
        if(!confirm('환불을 승인하지 않는 것으로 검토 결과를 남길까요? 실제 결제에는 변화가 없습니다.'))return;
        await A.pay('refund-reject',{orderId:q.orderId,refundId:r.id,revision:r.revision,confirmed:true,note:note.value});await render();
       }));box.append(form);
      }else if(['approved','processing'].includes(r.state)){
       box.append(button(r.state==='approved'?'승인된 '+A.money(r.amount)+' 환불 실행':'동일 환불 요청 결과 확인·재시도',async()=>{
        if(!confirm(`${q.title}\n${A.money(r.amount)} 환불을 실제 결제사에 요청합니다. 동일한 승인 요청을 사용하며 새 요청으로 중복 취소하지 않습니다. 계속할까요?`))return;
        await A.pay('refund-execute',{orderId:q.orderId,refundId:r.id,revision:r.revision,amount:r.amount,confirmed:true});await render();
       }));
      }else if(r.state==='manual_review')box.append(el('p','외부 취소 또는 응답 누락으로 거래 대조가 필요합니다. 자동으로 추가 환불하거나 참가권을 복구하지 않습니다.','nal-account-note'));
      section.append(box);
     }root.append(section);
    }
    root.querySelector('[data-more]')?.remove();
    if((data.orders||[]).length>50){const next=button('다음 결제 보기',async()=>{const more=await A.pay('admin-list',{filter:'attention',offset});if(ticket===run)await append(more);});next.dataset.more='';root.append(next);}
   }
   await append(data);if(!offset)root.append(el('p','현재 확인이 필요한 결제 기록이 없습니다.','nal-account-empty'));
   root.append(A.link('/nal/read/admin/offers/','참가상품 설정'),A.link('/nal/read/admin/','콘텐츠 편집'));
  }catch(e){if(e.name!=='AbortError')A.status(e.message,'error');}
 }
 A.ready.then(ok=>{if(ok)render();});A.onChange(render);
})();
