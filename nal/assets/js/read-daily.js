/* BUILD16 — precise draft/answer/DAY states, local recovery controls and current-question routes. */
(() => {
 'use strict';
 const N=window.NalRead;if(!N)return;
 const page=document.body.dataset.readDailyPage,root=document.querySelector('[data-private-root]'),el=N.node;
 let day=null,index=0,drafts=new Map(),run=0,working=false,links=new Map();
 const inputTypes=new Set(['QUESTION','SCALE','MULTI_SELECT','TRY']);
 const accepts=s=>inputTypes.has(s.type)||(s.type==='RECORD'&&s.required);
 const route=(view,params={})=>{const q=new URLSearchParams({season:N.slug,view});for(const[k,v]of Object.entries(params))if(v!=null)q.set(k,String(v));return '/nal/read/open/?'+q;};
 const actions=()=>el('div','','read-actions'),context=()=>({run,epoch:N.epoch});
 const current=c=>c.run===run&&c.epoch===N.epoch&&!!N.user;
 function button(text,fn,secondary=false){const b=el('button',text,'read-button'+(secondary?' secondary':''));b.type='button';
  b.addEventListener('click',async()=>{
   if(working)return;working=true;const c=context(),states=[...root.querySelectorAll('input,textarea,select,button')].map(n=>[n,n.disabled]);states.forEach(([n])=>n.disabled=true);
   try{await fn(c);}catch(e){if(current(c))N.error(e);}finally{working=false;states.forEach(([n,v])=>{if(n.isConnected)n.disabled=v;});}
  });return b;
 }
 function reveal(){root.hidden=false;}
 function weekParams(){return Number.isInteger(day?.weekNumber)?{week:day.weekNumber}:{};}
 function rememberStep(step){
  if(!Number.isInteger(step)||step<1||step>100)return;
  const url=new URL(location.href);url.searchParams.set('step',String(step));
  // Only the public question index is retained. Never serialize a draft into the address.
  history.replaceState({},'',url.pathname+url.search);
 }
 function renderStep(){
  if(!day||!N.user)return;root.replaceChildren();reveal();
  const s=day.steps[index];if(!s){renderEnd();return;}rememberStep(s.order);
  const section=el('section','','read-step'),locationRow=el('div','','read-step-location');
  locationRow.append(el('p',`${day.dayNumber===0?'BEFORE':'DAY '+String(day.dayNumber).padStart(2,'0')} · ${index+1} / ${day.steps.length}`,'read-eyebrow'),N.link(route('journey'),'질문 여정 보기','read-inline-link'));section.append(locationRow);
  const heading=el('h1',s.type==='HOOK'?(s.content||day.title):(s.prompt||s.content||day.title),s.type==='HOOK'?'read-question':'read-step-prompt');heading.tabIndex=-1;section.append(heading);
  if(s.content&&s.type!=='HOOK'&&s.prompt)section.append(el('p',s.content,'read-step-copy'));
  if(accepts(s)){
   const draft=drafts.get(s.order),value=draft.value||{answerText:s.answerText??null,answerJson:s.answerJson??null};
   const state=el('p','','read-save-state');state.id='read-save-'+s.order;state.setAttribute('role','status');state.setAttribute('aria-live','polite');state.setAttribute('aria-atomic','true');
   let control,composing=false;
   if(['QUESTION','TRY','RECORD'].includes(s.type)){
    control=el('textarea','','read-answer');control.rows=5;control.maxLength=5000;control.placeholder=s.placeholder||'한 문장이어도 충분합니다.';control.value=value.answerText||'';control.setAttribute('aria-label',s.prompt||'내 기록');
   }else{
    control=el('fieldset','','read-choice-group');control.append(el('legend',s.type==='SCALE'?'지금의 나와 가까운 값':'가까운 항목을 골라주세요.','read-field-label'));
    for(const option of s.type==='SCALE'?[1,2,3,4,5]:(s.options||[])){
     const v=String(typeof option==='object'?(option.value??option.label):option),label=el('label','','read-choice'),input=el('input');
     input.type=s.type==='SCALE'?'radio':'checkbox';input.name='answer-'+s.order;input.value=v;
     input.checked=s.type==='SCALE'?Number(value.answerJson?.value)===Number(v):(value.answerJson?.values||[]).includes(v);
     label.append(input,document.createTextNode(typeof option==='object'?(option.label??v):String(option)));control.append(label);
    }
   }
   control.setAttribute('aria-describedby',state.id);
   const readValue=()=>{
    if(['QUESTION','TRY','RECORD'].includes(s.type))return {answerText:control.value,answerJson:null};
    if(s.type==='SCALE'){const picked=control.querySelector('input:checked');return {answerText:null,answerJson:picked?{value:Number(picked.value)}:null};}
    return {answerText:null,answerJson:{values:[...control.querySelectorAll('input:checked')].map(n=>n.value)}};
   };
   const track=()=>{control.removeAttribute('aria-invalid');draft.set(readValue());};
   control.addEventListener('input',()=>{if(!composing)track();});control.addEventListener('change',()=>{if(!composing)track();});
   control.addEventListener('compositionstart',()=>{composing=true;});control.addEventListener('compositionend',()=>{composing=false;track();});
   section.append(control,state);
   const tools=el('div','','read-draft-tools');
   const retry=button('초안 저장 다시 시도',async()=>{track();await draft.retry();},true);
   const reload=N.link(location.pathname+location.search,'내용 보관 후 최신 질문 열기');
   reload.addEventListener('click',e=>{if(!e.defaultPrevented&&e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();if(N.mayLeave())location.reload();}});
   tools.append(retry,reload);section.append(tools);
   draft.showState=(text,kind)=>{
    if(!state.isConnected)return;state.textContent=text;state.dataset.state=kind;retry.hidden=!draft.retryable;reload.hidden=!draft.conflicted;
   };
   const local=el('label','','read-local-option'),check=el('input');check.type='checkbox';check.checked=draft.localEnabled;
   check.addEventListener('change',()=>draft.setLocal(check.checked));local.append(check,document.createTextNode('이 탭에 미저장 초안 보관 (공용 기기에서는 선택하지 마세요)'));section.append(local);
   if(draft.localCandidate())section.append(button('이 탭의 미저장 초안 복원',()=>{const recovered=draft.localCandidate();if(recovered){draft.set(recovered);renderStep();}},true));
   function invalid(message){state.textContent=message;state.dataset.state='error';control.setAttribute('aria-invalid','true');
    const target=control.tagName==='FIELDSET'?control.querySelector('input'):control;
    // Focus after the operation wrapper restores the input's disabled state.
    setTimeout(()=>{if(target?.isConnected)target.focus();},0);throw new Error(message);
   }
   async function commit(c){
    const v=readValue();
    if(s.required&&(['QUESTION','TRY','RECORD'].includes(s.type)?!v.answerText.trim():s.type==='SCALE'?!v.answerJson:!v.answerJson.values.length))invalid('지금의 답을 하나 남겨주세요.');
    track();const result=await draft.commit();if(!current(c))return null;s.answerText=v.answerText;s.answerJson=v.answerJson;return result;
   }
   const row=actions();
   if(index>0)row.append(button('이전 질문',async c=>{track();await draft.flush();if(current(c)){index--;renderStep();}},true));
   row.append(button('기록하고 계속',async c=>{if(await commit(c)){index++;renderStep();}}));
   row.append(button('초안 저장하고 TODAY로',async c=>{
    track();await draft.flush();if(current(c)&&N.mayLeave())location.assign(route('today'));
   },true));
   if(s.type==='TRY'){
    const connected=links.get(s.order);
    if(connected)row.append(N.link(route('try',{week:connected.weekNumber,experiment:connected.id}),'연결한 실험 이어가기'));
    else row.append(button('이 답으로 작은 실험 만들기',async c=>{
     if(!readValue().answerText?.trim())invalid('해볼 일을 한 문장으로 남겨주세요.');
     const saved=await commit(c);if(!saved)return;
     const result=await N.work('experiment-from-answer',{dayNumber:day.dayNumber,stepOrder:s.order,revision:saved.revision,answerId:saved.answerId});
     if(!current(c))return;const ex=result.experiment;links.set(s.order,{id:ex.id,weekNumber:ex.week_number});
     N.status(result.created?'내 답에서 실험 하나를 만들었습니다. 시작 시각은 TRY에서 직접 정하세요.':'이 답에 연결된 실험이 있습니다. 기존 계획과 돌아보기는 그대로 유지합니다.','ok');renderStep();
    },true));
    section.append(el('p','한 답에서 이어가는 실험은 하나입니다. 답을 고쳐도 기존 실험의 계획·돌아보기를 덮어쓰지 않습니다.','read-meta'));
   }
   section.append(row,el('p','초안은 이어 쓰기 위한 저장입니다. 오늘의 기록을 마치는 선택은 마지막 화면에 있습니다.','read-step-caption'));
   root.append(section);draft.showState(draft.state.text,draft.state.state);
  }else{
   if(s.type==='RECORD'){
    const answers=day.steps.slice(0,index).filter(x=>x.answerText?.trim());section.append(el('p','방금 남긴 내 문장을 그대로 다시 읽습니다.','read-step-copy'));
    answers.slice(-3).forEach(a=>section.append(el('blockquote',a.answerText,'read-own-sentence')));
    if(!answers.length)section.append(el('p','앞선 질문에서 남긴 문장을 이곳에서 다시 읽을 수 있습니다.','read-empty'));
   }
   if(s.type==='LIVE')section.append(N.link(route('live',weekParams()),'이번 주 대화 준비하기'));
   const row=actions();if(index>0)row.append(button('이전',()=>{index--;renderStep();},true));row.append(button('계속',()=>{index++;renderStep();}));section.append(row);root.append(section);
  }
  heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 }
 function renderEnd(){
  const section=el('section','','read-step'),heading=el('h1','오늘은 여기까지.','read-question');
  section.append(el('p','MY WORDS','read-eyebrow'),heading,el('p','답변 저장과 오늘 기록 완료는 다릅니다. 마치기를 누른 뒤 어디로 이어갈지 선택하세요.','read-step-copy'));
  const row=actions();row.append(button('마지막 질문 다시 보기',()=>{index=Math.max(0,day.steps.length-1);renderStep();},true));
  const done=button('오늘 기록 마치기',async c=>{
   await N.daily('complete-day',{dayNumber:day.dayNumber});if(!current(c))return;done.remove();heading.textContent='오늘의 기록을 마쳤습니다.';
   const next=el('section','','read-pathway-next');next.append(el('h2','여기에서 이어갈 수 있어요.'));
   const destinations=actions();destinations.append(N.link(route('today'),'다음 질문 확인'),N.link(route('try',weekParams()),'작은 실험 이어가기'),N.link(route('live',weekParams()),'LIVE 대화 준비'),N.link(route('report'),'내 기록 한 권으로 읽기'));
   next.append(destinations,el('p','링크를 여는 것만으로 실험·출석·리포트가 완료되거나 저장되지는 않습니다.','read-meta'));section.append(next);N.status('오늘 기록 완료를 확인했습니다.','ok');N.focus(next,true);
  });row.append(done);section.append(row);root.replaceChildren(section);reveal();N.focus(heading,true);
 }
 function today(data){
  const arrival=data.arrival,section=el('section','','read-hero'),start='/nal/read/start/?season='+encodeURIComponent(N.slug);
  if(arrival?.allowed&&['prestart','unscheduled','cancelled'].includes(arrival.phase)){
   section.append(el('p',arrival.label||'NAL READ','read-eyebrow'),el('h1',arrival.phase==='prestart'?'시작 전, 내 자리를 준비합니다.':arrival.phase==='cancelled'?'운영 일정 안내를 확인해 주세요.':'시작 일정을 준비하고 있습니다.','read-question'));
   if(arrival.startsAt)section.append(el('p','운영 시작 '+N.date(arrival.startsAt)+' (한국 시간)','read-meta'));
   if(arrival.phase==='prestart')section.append(el('p',arrival.guide?.beforeStart||'첫 질문은 시작일에 열립니다. 그 전에 책과 준비 안내를 확인해 보세요.','read-step-copy'));
   else if(arrival.phase==='cancelled')section.append(el('p','일정 취소와 실제 결제·환불 상태는 별도로 확인합니다.','read-step-copy'));
   section.append(N.link(start,'나의 시작 안내 열기','read-button'),N.link('/nal/my/','전체 MY NAL'));
   const first=(arrival.liveSessions||[]).find(x=>x.status==='published'&&Date.parse(x.endsAt)>=Date.parse(arrival.serverTime));if(first&&arrival.phase!=='cancelled')section.append(el('p','다음 LIVE · '+first.title+' / '+N.date(first.startsAt),'read-meta'));
   root.append(section);return;
  }
  const currentDay=data.currentDay==null?null:Number(data.currentDay),item=(data.journey||[]).find(x=>Number(x.dayNumber)===currentDay&&x.unlocked);
  section.append(el('p','TODAY','read-eyebrow'),el('h1',item?.title||'질문이 열릴 자리를 준비하고 있습니다.','read-question'));
  if(item)section.append(el('p',`${currentDay===0?'BEFORE':'DAY '+String(currentDay).padStart(2,'0')} · 예상 ${item.estimatedMinutes}분`,'read-meta'),N.link(N.dayHref(currentDay),item.progress==='completed'?'내 답 다시 읽기':'오늘의 질문 열기','read-button'));
  else section.append(el('p','아직 공개된 다음 질문이 없습니다. 시작 안내와 질문 여정에서 현재 상태를 확인해 주세요.','read-empty'),N.link(route('journey'),'질문 여정 확인'));
  if(arrival?.phase==='ended')section.append(el('p','운영 기간은 끝났습니다. 이용권 범위 안에서 내 답과 리포트를 다시 읽을 수 있습니다.','read-meta'),N.link(route('report'),'내 리포트'));
  section.append(N.link(route('my'),'내가 남긴 기록'),N.link(route('try'),'내 작은 실험'),N.link(start,'시작·준비 안내'));root.append(section);
 }
 async function render(){
  const ticket=++run;links=new Map();if(!N.user){root.replaceChildren();root.hidden=true;return;}
  try{
   if(page==='today'||page==='journey'){
    const data=await N.daily('bootstrap');if(ticket!==run)return;
    if(!Array.isArray(data.journey))throw new Error('질문 목록 응답을 확인하지 못했습니다. 기록이 없는 것으로 처리하지 않습니다.');
    root.replaceChildren();reveal();
    if(page==='today')today(data);else{
     root.append(el('p','JOURNEY','read-eyebrow'),el('h1','다시 돌아와도 괜찮습니다.','read-step-prompt'));const list=el('ol','','read-journey');
     for(const item of data.journey){const li=el('li');li.append(el('span',item.dayNumber===0?'BEFORE':String(item.dayNumber).padStart(2,'0'),'read-meta'),el('span',item.title));
      li.append(item.unlocked?N.link(N.dayHref(Number(item.dayNumber)),item.progress==='completed'?'내 답 다시 읽기 →':'열기 →','read-inline-link'):el('span','아직 열리지 않았어요.','read-lock'));list.append(li);}
     if(!list.children.length)root.append(el('p','아직 공개된 질문이 없습니다.','read-empty'));root.append(list,N.link('/nal/read/start/?season='+encodeURIComponent(N.slug),'시작·공개 안내 확인'));
    }
    N.status('');
   }else{
    const raw=new URLSearchParams(location.search).get('day'),n=page==='before'?0:(raw!==null&&/^\d{1,3}$/.test(raw)?Number(raw):null);if(n===null||n>366)throw new Error('DAY 주소를 확인해 주세요.');
    const [content,saved,related]=await Promise.all([N.daily('day',{dayNumber:n}),N.work('drafts',{dayNumber:n}),N.work('experiments').then(data=>({data}),error=>({error}))]);
    if(ticket!==run)return;
    if(!Array.isArray(content.steps)||!Array.isArray(saved.drafts))throw new Error('질문 또는 초안 응답을 확인하지 못했습니다. 빈 기록으로 덮어쓰지 않습니다.');
    if([401,403].includes(related.error?.status))throw related.error;
    const incomplete=!!related.error||!Array.isArray(related.data?.experiments);
    drafts.forEach(d=>d.dispose());drafts.clear();day=content;index=0;
    for(const ex of incomplete?[]:related.data.experiments){if(ex.source_snapshot?.dayNumber===n&&Number.isInteger(ex.source_snapshot.stepOrder)){
     links.set(ex.source_snapshot.stepOrder,{id:ex.id,weekNumber:ex.week_number});day.weekNumber=ex.source_snapshot.weekNumber;
    }}
    const records=new Map(saved.drafts.map(d=>[d.order,d]));
    for(const s of day.steps){if(!accepts(s))continue;const record=records.get(s.order),d=N.createDraft(n,s.order,record,(text,kind)=>d.showState?.(text,kind));drafts.set(s.order,d);
     if(record&&!record.committed){s.answerText=record.payload.answerText;s.answerJson=record.payload.answerJson;}}
    const at=Number(new URLSearchParams(location.search).get('step')),requested=day.steps.findIndex(s=>s.order===at);
    if(requested>=0)index=requested;else{const recent=saved.drafts.filter(x=>!x.committed).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))[0];if(recent)index=Math.max(0,day.steps.findIndex(s=>s.order===recent.order));}
    if(!day.steps.length){root.replaceChildren(el('p','이 DAY의 질문을 준비하고 있습니다.','read-empty'),N.link(route('journey'),'질문 여정으로'));reveal();return;}
    renderStep();N.status(incomplete?'질문과 초안은 불러왔지만 실험 연결 목록은 확인하지 못했습니다. 기존 실험이 없는 것으로 처리하지 않습니다.':'');
   }
  }catch(e){if(ticket===run)N.error(e);}
 }
 N.ready.then(ok=>{if(ok)render();});window.addEventListener('nal:session',render);
})();
