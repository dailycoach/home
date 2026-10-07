/* BUILD18 — retain selected cohort across navigation; original explicit operations remain. */
(() => {
 'use strict';const A=window.NalAccount,C=window.NalAdminContext;if(!A)return;
 const el=A.node,root=document.querySelector('[data-account-private]');let run=0,selected=null,dispose=()=>{};
 const stateLabel={draft:'초안',recruiting:'모집 중',paused:'모집 일시정지',closed:'모집 마감',cancelled:'운영 취소'};
 const attendanceLabel={unknown:'미기록',present:'참석 확인',absent:'불참',excused:'사전 사유 확인'};
 const personStates={active:'참여 중',pending:'참가 대기',paused:'일시정지',completed:'완료',revoked:'철회',refunded:'환불',waiting:'대기 중',offered:'참여 기회 열림',expired:'기한 종료'};
 function button(text,fn){const b=el('button',text,'nal-account-button');b.type='button';b.addEventListener('click',async()=>{const epoch=A.epoch;b.disabled=true;try{await fn();}catch(e){if(epoch===A.epoch&&e.name!=='AbortError')A.status(e.message,'error');}finally{if(b.isConnected)b.disabled=false;}});return b;}
 function field(label,value='',type='text'){const wrap=el('label',label),input=el('input');input.type=type;input.value=value??'';wrap.append(input);return{wrap,input};}
 function select(label,options,value){const wrap=el('label',label),input=el('select');for(const[v,t]of options){const o=el('option',t);o.value=v;input.append(o);}input.value=value;wrap.append(input);return{wrap,input};}
 function local(v){return v?new Date(Date.parse(v)+9*3600000).toISOString().slice(0,16):'';}
 function iso(v){return new Date(v+':00+09:00').toISOString();}
 function saveCSV(rows,label){
  const clean=v=>{let s=String(v??'').replace(/\u0000/g,'');if(/^[\s]*[=+\-@]/.test(s)||/^[\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const text='\ufeff'+[['참가번호','표시이름','참가상태','남긴 DAY'],...rows.map(p=>[p.id,p.display_name,personStates[p.status]||p.status,p.recorded_days])].map(row=>row.map(clean).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='NAL-'+label.replace(/[^a-z0-9_-]/gi,'_')+'-loaded-roster.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
 }
 function configEditor(item){
  const c=item.cohort||{},form=el('form','','nal-account-form nal-cohort-editor');let revision=c.revision||0;
  const program=field('프로그램 묶음 키 (영문·숫자·하이픈)',c.program_key||''),number=field('기수 번호',c.cohort_number||'','number'),label=field('기수 이름',c.label||'');
  const starts=field('운영 시작 (한국 시간)',local(c.course_starts_at),'datetime-local'),ends=field('운영 종료 (한국 시간)',local(c.course_ends_at),'datetime-local');
  const capacity=field('참가 정원',c.capacity||'','number'),hours=field('대기자 참여 기회 유지시간',c.wait_offer_hours||24,'number');
  number.input.min='1';number.input.max='9999';capacity.input.min='1';capacity.input.max='5000';hours.input.min='1';hours.input.max='168';label.input.maxLength=100;program.input.maxLength=100;program.input.pattern='[a-z0-9-]+';
  const state=select('모집 상태',Object.entries(stateLabel),c.state||'draft');
  const wait=select('대기 신청',[['false','사용하지 않음'],['true','정원 마감 시 받기']],String(c.waitlist_enabled||false));
  const reason=field('변경 이유 (운영 기록)','');reason.input.maxLength=500;
  for(const x of [program,number,label,starts,ends,capacity,hours,state,wait,reason]){x.input.required=true;form.append(x.wrap);}
  form.append(el('p','모집 시작·마감일은 참가상품 설정에서 정합니다. 신청자가 생긴 기수의 이름·운영 일정은 그대로 보존하며, 다른 일정은 새 기수로 구성합니다.','nal-account-note'));
  const check=el('input');check.type='checkbox';check.required=true;const agreement=el('label','','nal-account-check');agreement.append(check,document.createTextNode('일정·정원·모집 상태 변경을 확인했습니다. 취소 상태로 바꿔도 결제 환불은 자동 실행되지 않습니다.'));form.append(agreement);
  const submit=el('button','기수 설정 저장','nal-account-button');submit.type='submit';form.append(submit);const edit=C.track(form);dispose=edit.dispose;
  form.addEventListener('submit',async e=>{e.preventDefault();const epoch=A.epoch,ticket=run;
   try{const payload={seasonSlug:item.seasonSlug,revision,programKey:program.input.value.trim(),cohortNumber:Number(number.input.value),label:label.input.value.trim(),
    courseStartsAt:iso(starts.input.value),courseEndsAt:iso(ends.input.value),capacity:Number(capacity.input.value),state:state.input.value,
    waitlistEnabled:wait.input.value==='true',waitOfferHours:Number(hours.input.value),reason:reason.input.value.trim(),confirmed:check.checked};
    await edit.run(async()=>{await A.cohort('admin-save',payload);if(epoch===A.epoch&&ticket===run){edit.saved();A.status('기수 설정을 저장했습니다. 공개·결제 활성화는 별도입니다.','ok');}});
    if(epoch===A.epoch&&ticket===run)await render();
   }catch(error){if(epoch===A.epoch&&ticket===run)A.status(error.message,'error');}
  });return form;
 }
 async function roster(item,container,ticket){
  const data=await A.cohort('admin-roster',{seasonSlug:item.seasonSlug,offset:0});if(ticket!==run)return;
  container.replaceChildren();const summary=data.summary;
  container.append(el('p',`정원 ${summary.capacity} · 참가 ${summary.enrolled} · 사용/예약 ${summary.occupied} · 남은 자리 ${summary.remaining} · 대기 ${summary.waiting}`,'nal-cohort-status'));
  container.append(el('p','결제 결과가 불명확한 주문은 자리 계산에서 바로 제외하지 않습니다. 먼저 결제사 상태를 확인해 주세요.','nal-account-note'));
  const waiting=el('section','','nal-cohort-roster'),people=el('section','','nal-cohort-roster');waiting.append(el('h3','대기 신청'));people.append(el('h3','참가자'));
  const participantRows=[],waitRows=[];let participantOffset=0,waitOffset=0;
  function drawWait(rows){
   waitRows.push(...rows);for(const w of rows){const box=el('article','','nal-account-record');box.append(el('h4',w.display_name),el('p',personStates[w.state]||w.state),el('p','신청 '+A.date(w.joined_at),'nal-account-meta'));
    if(w.offer_until)box.append(el('p','기회 기한 '+A.date(w.offer_until),'nal-account-meta'));
    if(w.state==='waiting')box.append(button('앞 순서 확인 후 참여 기회 열기',async()=>{
     if(!confirm(w.display_name+' 님에게 기한이 있는 자리를 제안할까요? 자동 메시지나 결제는 실행되지 않습니다.'))return;
     const result=await A.cohort('admin-offer-next',{seasonSlug:item.seasonSlug,userId:w.user_id,revision:w.revision,confirmed:true});
     if(ticket===run){A.status('참여 기회를 열었습니다. 기한: '+A.date(result.offerUntil)+' · 자동 알림은 보내지 않았습니다.','ok');await roster(item,container,ticket);}
    }));
    if(w.state==='offered')box.append(button('이 참여 기회 닫기',async()=>{
     const reason=prompt('닫는 이유를 남겨주세요. 진행 중인 결제가 있으면 닫을 수 없습니다.');if(!reason?.trim())return;
     await A.cohort('admin-offer-cancel',{seasonSlug:item.seasonSlug,userId:w.user_id,revision:w.revision,confirmed:true,reason:reason.trim()});if(ticket===run)await roster(item,container,ticket);
    }));waiting.append(box);
   }
  }
  function drawPeople(rows){participantRows.push(...rows);
   for(const p of rows){const box=el('article','','nal-account-record');box.append(el('h4',p.display_name),el('p',(personStates[p.status]||p.status)+' · 남긴 DAY '+p.recorded_days),el('p','참가번호 '+p.id,'nal-account-meta'));
    const details=el('details','','nal-order-details');details.append(el('summary','LIVE 출석 입력 (운영자 확인)'));
    for(const s of data.sessions||[]){
     const existing=(p.attendance||[]).find(a=>a.sessionId===s.id),form=el('form','','nal-attendance-row');
     const pick=select(s.title+' · '+A.date(s.startsAt),Object.entries(attendanceLabel),existing?.status||'unknown');
     let revision=existing?.revision||0;const save=el('button','출석 기록','nal-account-link');save.type='submit';
     save.disabled=s.status!=='published'||Date.parse(s.startsAt)>Date.now();form.append(pick.wrap,save);
     form.addEventListener('submit',async e=>{e.preventDefault();const epoch=A.epoch;save.disabled=true;
      try{if(!confirm(`${p.display_name} / ${s.title}\n${attendanceLabel[pick.input.value]}로 기록할까요?`))return;
       await A.cohort('admin-attendance',{seasonSlug:item.seasonSlug,enrollmentId:p.id,sessionId:s.id,status:pick.input.value,revision,confirmed:true});
       if(epoch===A.epoch&&ticket===run){A.status('운영자 확인 출석을 기록했습니다. Zoom 접속 클릭과 별개입니다.','ok');await roster(item,container,ticket);}
      }catch(error){if(epoch===A.epoch)A.status(error.message,'error');}finally{if(save.isConnected)save.disabled=false;}
     });details.append(form);
    }
    if(!data.sessions?.length)details.append(el('p','설정된 LIVE 일정이 없습니다.','nal-account-note'));box.append(details);people.append(box);
   }
  }
  const initialPeople=(data.participants||[]).slice(0,50),initialWait=(data.waiters||[]).slice(0,100);
  drawPeople(initialPeople);participantOffset=initialPeople.length;drawWait(initialWait);waitOffset=initialWait.length;
  if(!initialPeople.length)people.append(el('p','등록된 참가자가 없습니다.','nal-account-empty'));
  if(!initialWait.length)waiting.append(el('p','대기 신청이 없습니다.','nal-account-empty'));
  const exportButton=button('불러온 참가자 명단 CSV 저장',()=>{
   if(!confirm('이름·참가번호·참가 상태·기록한 DAY 수를 파일로 저장합니다. 안전한 기기에 보관할까요?'))return;saveCSV(participantRows,item.seasonSlug);
  });exportButton.disabled=!participantRows.length;people.prepend(exportButton);
  if((data.participants||[]).length>50){const b=button('참가자 더 보기',async()=>{const more=await A.cohort('admin-roster',{seasonSlug:item.seasonSlug,offset:participantOffset});if(ticket!==run)return;
   const rows=(more.participants||[]).slice(0,50);drawPeople(rows);participantOffset+=rows.length;if((more.participants||[]).length<=50)b.remove();});people.append(b);}
  if((data.waiters||[]).length>100){const b=button('대기자 더 보기',async()=>{const more=await A.cohort('admin-roster',{seasonSlug:item.seasonSlug,offset:waitOffset});if(ticket!==run)return;
   const rows=(more.waiters||[]).slice(0,100);drawWait(rows);waitOffset+=rows.length;if((more.waiters||[]).length<=100)b.remove();});waiting.append(b);}
  container.append(waiting,people,el('p','명단에는 개인 질문 답변·성찰 내용·심리점수를 포함하지 않습니다.','nal-account-note'));
  const log=el('details','','nal-order-details');log.append(el('summary','최근 운영 변경 기록'));
  for(const event of data.events||[])log.append(el('p',A.date(event.created_at)+' · '+event.action+(event.detail?.reason?' · '+event.detail.reason:''),'nal-account-meta'));container.append(log);
 }
 async function render(){const ticket=++run;dispose();dispose=()=>{};root.replaceChildren();if(!A.user){root.hidden=true;return;}root.hidden=false;
  try{
   if(!C)throw new Error('운영 화면 연결 파일을 다시 불러와 주세요.');selected=C.read().seasonSlug;
   const data=await A.cohort('admin-list');if(ticket!==run)return;
   if(!Array.isArray(data.seasons))throw new Error('기수 목록을 확인하지 못했습니다. 빈 설정으로 대신 표시하지 않습니다.');
   root.append(el('h2','기수별로 모집과 참여를 관리합니다.'),el('p','선택한 시즌의 일정·정원·명단을 바로 엽니다. 결제·개인 기록·출석은 각각 구분합니다.','nal-account-note'));
   const picker=select('운영할 시즌',[['','시즌을 선택하세요'],...data.seasons.map(x=>[x.seasonSlug,x.title+(x.cohort?' · '+x.cohort.label:' · 기수 미설정')])],selected||'');
   picker.wrap.classList.add('nal-admin-season-select');root.append(picker.wrap);const content=el('div');root.append(content);
   picker.input.addEventListener('change',()=>{if(!C.mayLeave()){picker.input.value=selected||'';return;}C.set(picker.input.value||null);render();});
   const item=data.seasons.find(x=>x.seasonSlug===selected);
   if(selected&&!item){content.append(el('p','선택한 시즌을 현재 목록에서 찾지 못했습니다. 다른 기수를 대신 열지 않습니다.','nal-account-empty'));return;}
   if(item){
    C.info(item.title+(item.cohort?' · '+item.cohort.label:''));
    const settings=el('details','','nal-order-details');settings.open=!item.cohort;settings.append(el('summary','일정·정원·모집 설정'),configEditor(item));content.append(settings);
    if(item.cohort){const list=el('div');content.append(list);await roster(item,list,ticket);if(ticket!==run)return;}
   }
   root.append(A.link(C.href('/nal/read/admin/'),'시즌 콘텐츠 편집'),A.link(C.href('/nal/read/admin/offers/'),'상품·모집 기간 설정'),A.link(C.href('/nal/read/admin/payments/'),'결제·참가권 상태 확인'));
   if(!data.seasons.length)content.append(el('p','먼저 콘텐츠 편집에서 시즌을 만들어주세요.','nal-account-empty'));
  }catch(e){if(ticket===run&&e.name!=='AbortError')A.status(e.message,'error');}
 }
 A.ready.then(ok=>{if(ok)render();});A.onChange(render);window.addEventListener('popstate',render);
})();
