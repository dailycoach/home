(() => {
 'use strict';const A=window.NalAccount;if(!A)return;
 const el=A.node,root=document.querySelector('[data-account-private]');
 const slug=new URLSearchParams(location.search).get('season');let generation=0,dirty=false;
 function context(){return {generation,epoch:A.epoch};}
 const current=c=>c.generation===generation&&c.epoch===A.epoch&&!!A.user;
 function button(text,fn){const b=el('button',text,'nal-account-button');b.type='button';b.addEventListener('click',async()=>{const c=context();b.disabled=true;try{await fn(c);}catch(e){if(current(c)&&e.name!=='AbortError')A.status(e.message,'error');}finally{if(b.isConnected)b.disabled=false;}});return b;}
 function leaving(){return !dirty||confirm('저장하지 않은 준비 체크가 있습니다. 이 화면을 떠날까요?');}
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 document.addEventListener('click',e=>{const target=e.target.closest('a[href],[data-account-signout]');if(target&&target.target!=='_blank'&&!leaving()){e.preventDefault();e.stopImmediatePropagation();}},true);
 async function render(){const ticket=++generation;dirty=false;if(!A.user){root.replaceChildren();root.hidden=true;return;}
  const c=context();try{
   if(!/^[a-z0-9-]{1,120}$/.test(slug||''))throw new Error('MY NAL에서 참여한 시즌을 선택해 주세요.');
   const data=await A.companion('arrival',slug);if(!current(c)||ticket!==generation)return;
   root.replaceChildren();root.hidden=false;
   if(!data.allowed){root.append(el('h2','참가권 상태를 먼저 확인해 주세요.'),el('p','시작 안내는 연결된 참가 계정에서 볼 수 있습니다. 결제를 반복하지 말고 MY NAL의 주문과 참가권을 확인하세요.','nal-account-note'),A.link('/nal/my/','MY NAL로'));return;}
   const headings={prestart:'시작 전, 나의 자리를 준비합니다.',active:'오늘 이어갈 자리가 준비되어 있습니다.',ended:'함께한 시간이 지나도, 내 기록은 남습니다.',cancelled:'운영 일정이 취소되었습니다.',unscheduled:'시작 일정을 준비하고 있습니다.'};
   root.append(el('p',data.label||'NAL READ','nal-account-kicker'),el('h1',headings[data.phase]||'나의 시작 안내','nal-arrival-heading'));
   if(data.startsAt)root.append(el('p','운영 시작 '+A.date(data.startsAt)+' (한국 시간)','nal-cohort-status'));
   if(data.endsAt)root.append(el('p','운영 종료 '+A.date(data.endsAt),'nal-account-meta'));
   const row=el('div','','nal-account-actions');
   if(data.phase==='prestart')root.append(el('p','첫 질문은 시작일에 열립니다. 아래 준비는 내 속도대로 확인하면 됩니다.','nal-program-copy'));
   else if(data.phase==='active')row.append(A.link(A.read(slug,'today'),'오늘의 질문으로 →','nal-account-button'));
   else if(data.phase==='ended')row.append(A.link(A.read(slug,'my'),'내 문장 다시 읽기','nal-account-button'),A.link(A.read(slug,'report'),'내 리포트'));
   else if(data.phase==='cancelled')root.append(el('p','이 안내가 결제 취소나 환불 완료를 뜻하지는 않습니다. 주문 상태와 운영 안내를 확인해 주세요.','nal-account-note'));
   row.append(A.link('/nal/my/','전체 MY NAL'),A.link('/nal/my/payments/','내 주문'));root.append(row);
   const guide=data.guide;
   if(guide){
    window.NalProgramSections?.section(root,'시작 전에 읽어주세요',guide.beforeStart);
    window.NalProgramSections?.book(root,guide.book);
    window.NalProgramSections?.section(root,'책을 읽는 방법',guide.readingNote);
   }
   if(guide?.prepare?.length&&data.phase!=='cancelled'){
    const form=el('form','','nal-preparation-form'),state=el('p','','nal-account-note');state.setAttribute('role','status');
    form.append(el('h2','내 준비 체크'),el('p','확인은 나를 위한 표시입니다. 모두 체크해야 질문이 열리거나 출석으로 인정되는 것은 아닙니다.','nal-account-note'));
    let revision=data.revision;const checks={};
    if(data.guideChanged)form.append(el('p','준비 안내가 바뀌었습니다. 현재 안내를 읽고 다시 체크해 주세요.','nal-account-note'));
    for(const item of guide.prepare){const label=el('label','','nal-preparation-item'),check=el('input');check.type='checkbox';check.checked=data.checks?.[item.id]===true;checks[item.id]=check;
     const text=el('span');text.append(el('strong',item.title));if(item.detail)text.append(el('span',item.detail,'nal-account-note'));label.append(check,text);form.append(label);}
    const submit=el('button','내 준비 상태 저장','nal-account-button');submit.type='submit';form.append(submit,state);
    form.addEventListener('change',()=>{dirty=true;state.textContent='아직 저장하지 않았습니다.';});
    form.addEventListener('submit',async e=>{e.preventDefault();const ctx=context();const snapshot=Object.fromEntries(Object.entries(checks).map(([key,input])=>[key,input.checked]));
     const controls=[...form.querySelectorAll('input,button')];controls.forEach(x=>x.disabled=true);
     try{const result=await A.companion('check-save',slug,{revision,guideRevision:data.guideRevision,checks:snapshot});
      if(current(ctx)){revision=result.revision;dirty=false;state.textContent='내 준비 상태를 저장했습니다.';}
     }catch(error){if(current(ctx))state.textContent=error.message;}
     finally{if(form.isConnected)controls.forEach(x=>x.disabled=false);}
    });root.append(form);
   }else if(!guide)root.append(el('p','준비 안내는 확정된 내용이 등록되면 표시됩니다.','nal-account-empty'));
   const sessions=(data.liveSessions||[]).filter(x=>x.status==='published'&&Date.parse(x.endsAt)>=Date.parse(data.serverTime));
   const liveSection=el('section','','nal-program-section');liveSection.append(el('h2','다음에 함께 만나는 시간'));
   if(sessions.length){const first=sessions[0];liveSection.append(el('h3',first.title),el('p',A.date(first.startsAt)+' — '+A.date(first.endsAt)+' (한국 시간)','nal-program-copy'));
    if(data.phase!=='cancelled')liveSection.append(A.link(A.read(slug,'live'),'내 LIVE 일정 열기','nal-account-button'));
    liveSection.append(el('p','접속 주소는 LIVE 화면의 입장 가능 시간에 확인합니다.','nal-account-note'));
   }else liveSection.append(el('p','앞으로의 LIVE 일정이 아직 등록되지 않았거나 모두 종료되었습니다.','nal-account-note'));
   root.append(liveSection,button('안내 새로 불러오기',async()=>{if(leaving())await render();}));
  }catch(e){if(current(c)&&e.name!=='AbortError')A.status(e.message,'error');}
 }
 A.ready.then(ok=>{if(ok)render();});A.onChange(render);
})();
