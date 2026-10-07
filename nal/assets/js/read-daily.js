(() => {
 'use strict';
 const N=window.NalRead;if(!N)return;
 const page=document.body.dataset.readDailyPage;
 const root=document.querySelector('[data-private-root]');
 const el=N.node;let day=null,index=0,drafts=new Map(),run=0;
 const inputTypes=new Set(['QUESTION','SCALE','MULTI_SELECT','TRY']);
 function acceptedInput(s){return inputTypes.has(s.type)||(s.type==='RECORD'&&s.required);}
 function actions(){return el('div','','read-actions');}
 function button(text,fn,secondary=false){const b=el('button',text,'read-button'+(secondary?' secondary':''));b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){N.error(e);}finally{b.disabled=false;}});return b;}
 function reveal(){root.hidden=false;}
 function renderStep(){
  if(!day||!N.user)return;root.replaceChildren();reveal();
  const s=day.steps[index];if(!s){renderEnd();return;}
  const section=el('section','','read-step');
  section.append(el('p',`DAY ${String(day.dayNumber).padStart(2,'0')} · ${index+1} / ${day.steps.length}`,'read-eyebrow'));
  const heading=el('h1',s.type==='HOOK'?(s.content||day.title):(s.prompt||s.content||day.title),s.type==='HOOK'?'read-question':'read-step-prompt');
  heading.tabIndex=-1;section.append(heading);
  if(s.content&&s.type!=='HOOK'&&s.prompt)section.append(el('p',s.content,'read-step-copy'));
  let control=null,draft=drafts.get(s.order);
  if(acceptedInput(s)){
   const value=draft?.value||{answerText:s.answerText??null,answerJson:s.answerJson??null};
   const state=el('p','','read-save-state');state.setAttribute('role','status');state.setAttribute('aria-live','polite');
   if(!draft){draft=N.createDraft(day.dayNumber,s.order,null,(text,kind)=>{state.textContent=text;state.dataset.state=kind;});drafts.set(s.order,draft);}
   draft.showState=(text,kind)=>{state.textContent=text;state.dataset.state=kind;};
   if(['QUESTION','TRY','RECORD'].includes(s.type)){
    control=el('textarea','','read-answer');control.rows=5;control.maxLength=5000;
    control.placeholder=s.placeholder||'한 문장이어도 충분합니다.';control.value=value.answerText||'';
    control.setAttribute('aria-label',s.prompt||'내 기록');
   }else{
    control=el('fieldset','','read-choice-group');const legend=el('legend',s.type==='SCALE'?'지금의 나와 가까운 값':'가까운 항목을 골라주세요.','read-field-label');control.append(legend);
    const options=s.type==='SCALE'?[1,2,3,4,5]:(s.options||[]);
    for(const option of options){
     const v=String(typeof option==='object'?(option.value??option.label):option),labelText=typeof option==='object'?(option.label??v):String(option);
     const label=el('label','','read-choice'),input=el('input');input.type=s.type==='SCALE'?'radio':'checkbox';input.name='answer-'+s.order;input.value=v;
     input.checked=s.type==='SCALE'?Number(value.answerJson?.value)===Number(v):(value.answerJson?.values||[]).includes(v);
     label.append(input,document.createTextNode(labelText));control.append(label);
    }
   }
   const readValue=()=>{
    if(['QUESTION','TRY','RECORD'].includes(s.type))return {answerText:control.value,answerJson:null};
    if(s.type==='SCALE'){const picked=control.querySelector('input:checked');return {answerText:null,answerJson:picked?{value:Number(picked.value)}:null};}
    return {answerText:null,answerJson:{values:[...control.querySelectorAll('input:checked')].map(n=>n.value)}};
   };
   const track=()=>{draft.set(readValue());};control.addEventListener('input',track);control.addEventListener('change',track);
   section.append(control,state);
   const local=el('label','','read-local-option'),check=el('input');check.type='checkbox';check.addEventListener('change',()=>draft.setLocal(check.checked));
   local.append(check,document.createTextNode('이 탭에 미저장 초안 보관 (공용 기기에서는 선택하지 마세요)'));section.append(local);
   const candidate=draft.localCandidate();if(candidate)section.append(button('이 탭의 미저장 초안 복원',()=>{draft.set(candidate);renderStep();},true));
   const row=actions();
   if(index>0)row.append(button('이전',async()=>{track();await draft.flush();index--;renderStep();},true));
   row.append(button('기록하고 계속',async()=>{
    const value=readValue();
    if(s.required&&(['QUESTION','TRY','RECORD'].includes(s.type)?!value.answerText.trim():s.type==='SCALE'?!value.answerJson:!value.answerJson.values.length))throw new Error('지금의 답을 하나 남겨주세요.');
    track();await draft.commit();s.answerText=value.answerText;s.answerJson=value.answerJson;index++;renderStep();
   }));
   if(s.type==='TRY'){
    let created=null;const experimentId=crypto.randomUUID();
    row.append(button('실험으로 옮기기',async()=>{
     const value=readValue();if(!value.answerText?.trim())throw new Error('해볼 일을 한 문장으로 남겨주세요.');track();await draft.commit();
     if(!created){const r=await N.work('experiment-save',{id:experimentId,revision:0,weekNumber:Math.max(1,Math.ceil(day.dayNumber/7)),title:value.answerText.trim().slice(0,200),intention:value.answerText.slice(0,2000),reflection:'',durationHours:72,status:'planned'});created=r.experiment;}
     N.status('TRY에 계획을 남겼습니다. 시작 시각은 TRY에서 직접 정합니다.','ok');
     if(!row.querySelector('[data-open-try]')){const a=N.link(N.root+'try/','내 실험 열기');a.dataset.openTry='';row.append(a);}
    },true));
   }
   section.append(row);
  }else{
   if(s.type==='RECORD'){
    const answers=day.steps.slice(0,index).filter(x=>x.answerText?.trim());section.append(el('p','방금 남긴 내 문장을 그대로 다시 읽습니다.','read-step-copy'));
    for(const answer of answers.slice(-3))section.append(el('blockquote',answer.answerText,'read-own-sentence'));
    if(!answers.length)section.append(el('p','앞선 질문에서 기록을 남기면 이곳에서 다시 읽을 수 있습니다.','read-empty'));
   }
   if(s.type==='LIVE')section.append(N.link(N.root+'live/','LIVE 일정과 내 대화 기록 열기'));
   const row=actions();if(index>0)row.append(button('이전',()=>{index--;renderStep();},true));row.append(button('계속',()=>{index++;renderStep();}));section.append(row);
  }
  root.append(section);heading.focus({preventScroll:true});
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)window.scrollTo({top:0,behavior:'smooth'});else window.scrollTo(0,0);
 }
 function renderEnd(){
  const section=el('section','','read-step');section.append(el('p','MY WORDS','read-eyebrow'),el('h1','오늘은 여기까지.','read-question'),el('p','남긴 기록은 MY NAL에서 다시 읽을 수 있습니다.','read-step-copy'));
  const row=actions();row.append(button('마지막 질문 다시 보기',()=>{index=Math.max(0,day.steps.length-1);renderStep();},true));
  const done=button('오늘 기록 마치기',async()=>{await N.daily('complete-day',{dayNumber:day.dayNumber});done.remove();section.querySelector('h1').textContent='오늘의 기록이 남았습니다.';row.append(N.link(N.root+'today/','TODAY로'),N.link(N.root+'my/','내 기록 읽기'));});
  row.append(done);section.append(row);root.replaceChildren(section);reveal();
 }
 function today(data){
  const arrival=data.arrival,section=el('section','','read-hero'),start='/nal/read/start/?season='+encodeURIComponent(N.slug);
  if(arrival?.allowed&&['prestart','unscheduled','cancelled'].includes(arrival.phase)){
   section.append(el('p',arrival.label||'NAL READ','read-eyebrow'),el('h1',arrival.phase==='prestart'?'시작 전, 내 자리를 준비합니다.':arrival.phase==='cancelled'?'운영 일정 안내를 확인해 주세요.':'시작 일정을 준비하고 있습니다.','read-question'));
   if(arrival.startsAt)section.append(el('p','운영 시작 '+N.date(arrival.startsAt)+' (한국 시간)','read-meta'));
   if(arrival.phase==='prestart')section.append(el('p',arrival.guide?.beforeStart||'첫 질문은 시작일에 열립니다. 그 전에 책과 준비 안내를 확인해 보세요.','read-step-copy'));
   else if(arrival.phase==='cancelled')section.append(el('p','일정 취소와 실제 결제·환불 상태는 별도로 확인합니다.','read-step-copy'));
   section.append(N.link(start,'나의 시작 안내 열기','read-button'),N.link('/nal/my/','전체 MY NAL'));
   const first=(arrival.liveSessions||[]).find(x=>x.status==='published'&&Date.parse(x.endsAt)>=Date.parse(arrival.serverTime));
   if(first&&arrival.phase!=='cancelled')section.append(el('p','다음 LIVE · '+first.title+' / '+N.date(first.startsAt),'read-meta'));
   root.append(section);return;
  }
  const current=data.currentDay==null?null:Number(data.currentDay),item=(data.journey||[]).find(x=>Number(x.dayNumber)===current&&x.unlocked);
  section.append(el('p','TODAY','read-eyebrow'),el('h1',item?.title||'질문이 열릴 자리를 준비하고 있습니다.','read-question'));
  if(item)section.append(el('p',`DAY ${String(current).padStart(2,'0')} · ${item.estimatedMinutes} MIN`,'read-meta'),N.link(N.dayHref(current),item.progress==='completed'?'내 답 다시 읽기':'오늘의 질문 열기','read-button'));
  else section.append(el('p','공개된 질문이 생기면 이곳에서 이어갈 수 있습니다.','read-empty'));
  if(arrival?.phase==='ended')section.append(el('p','운영 기간은 끝났습니다. 이용권 범위 안에서 내 답과 리포트를 다시 읽을 수 있습니다.','read-meta'),N.link(N.root+'report/','내 리포트'));
  section.append(N.link(N.root+'my/','내가 남긴 기록'),N.link(N.root+'try/','내 작은 실험'),N.link(start,'시작·준비 안내'));root.append(section);
 }
 async function render(){
  const ticket=++run;if(!N.user){root.replaceChildren();root.hidden=true;return;}
  try{
   if(page==='today'||page==='journey'){
    const data=await N.daily('bootstrap');if(ticket!==run)return;root.replaceChildren();reveal();
    if(page==='today')today(data);
    else{
     root.append(el('p','JOURNEY','read-eyebrow'),el('h1','다시 돌아와도 괜찮습니다.','read-step-prompt'));
     const list=el('ol','','read-journey');
     for(const item of data.journey||[]){const li=el('li'),num=el('span',item.dayNumber===0?'BEFORE':String(item.dayNumber).padStart(2,'0'),'read-meta');li.append(num,el('span',item.title));
      if(item.unlocked)li.append(N.link(N.dayHref(Number(item.dayNumber)),item.progress==='completed'?'내 답 다시 읽기 →':'열기 →','read-inline-link'));else li.append(el('span','아직 열리지 않았어요.','read-lock'));list.append(li);}
     if(!list.children.length)root.append(el('p','아직 공개된 질문이 없습니다.','read-empty'));root.append(list);
    }
   }else{
    const raw=new URLSearchParams(location.search).get('day'),n=page==='before'?0:(raw!==null&&/^\d{1,3}$/.test(raw)?Number(raw):null);
    if(n===null||n>366)throw new Error('DAY 주소를 확인해 주세요.');
    const [content,saved]=await Promise.all([N.daily('day',{dayNumber:n}),N.work('drafts',{dayNumber:n})]);
    if(ticket!==run)return;drafts.forEach(d=>d.dispose());drafts.clear();day=content;index=0;
    const records=new Map((saved.drafts||[]).map(d=>[d.order,d]));
    for(const s of day.steps||[]){if(!acceptedInput(s))continue;const record=records.get(s.order);const d=N.createDraft(n,s.order,record,(text,kind)=>d.showState?.(text,kind));drafts.set(s.order,d);
     if(record&&!record.committed){s.answerText=record.payload.answerText;s.answerJson=record.payload.answerJson;}}
    const at=Number(new URLSearchParams(location.search).get('step')),requested=day.steps.findIndex(s=>s.order===at);
    if(requested>=0)index=requested;else{const recent=(saved.drafts||[]).filter(x=>!x.committed).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0];if(recent)index=Math.max(0,day.steps.findIndex(s=>s.order===recent.order));}
    if(!day.steps?.length){root.replaceChildren(el('p','이 DAY의 질문을 준비하고 있습니다.','read-empty'));reveal();return;}renderStep();
   }
   N.status('');
  }catch(e){N.error(e);}
 }
 N.ready.then(ok=>{if(ok)render();});window.addEventListener('nal:session',render);
})();
