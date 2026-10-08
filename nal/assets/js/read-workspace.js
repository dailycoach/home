/* BUILD15 — source question -> experiment -> optional personal LIVE note -> report. */
(() => {
 'use strict';
 const N=window.NalRead;if(!N)return;
 const page=document.body.dataset.readWorkspacePage,root=document.querySelector('[data-private-root]'),el=N.node;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const labels={planned:'생각해둔 일',started:'해보는 중',paused:'잠시 멈춤',completed:'해봤어요',cancelled:'다르게 선택했어요'};
 const markers=new Set();let generation=0;
 const context=()=>({generation,epoch:N.epoch});
 const current=c=>c.generation===generation&&c.epoch===N.epoch&&!!N.user;
 const route=(view,params={})=>{const q=new URLSearchParams({season:N.slug,view});for(const[k,v]of Object.entries(params))if(v!=null)q.set(k,String(v));return '/nal/read/open/?'+q;};
 const row=()=>el('div','','read-actions');
 function button(text,fn,secondary=false){const b=el('button',text,'read-button'+(secondary?' secondary':''));b.type='button';
  b.addEventListener('click',async()=>{const c=context();b.disabled=true;try{await fn(c);}catch(e){if(current(c))N.error(e);}finally{if(b.isConnected)b.disabled=false;}});return b;}
 function field(label,value='',textarea=false,max=5000){const wrap=el('label','','read-field'),input=el(textarea?'textarea':'input',null,textarea?'read-answer':'read-input');
  if(textarea)input.rows=4;input.value=value;input.maxLength=max;wrap.append(el('span',label),input);return {wrap,input};}
 function select(label,options,value){const wrap=el('label','','read-field'),input=el('select');for(const[v,t]of options){const o=el('option',t);o.value=String(v);input.append(o);}input.value=String(value);wrap.append(el('span',label),input);return {wrap,input};}
 function tracked(){const marker={};markers.add(marker);return{changed:()=>N.setDirty(marker,true),clear:()=>{N.setDirty(marker,false);}};}
 function lock(form){const states=[...form.querySelectorAll('input,textarea,select,button')].map(n=>[n,n.disabled]);states.forEach(([n])=>n.disabled=true);return()=>states.forEach(([n,v])=>{if(n.isConnected)n.disabled=v;});}
 function heading(eyebrow,title){root.append(el('p',eyebrow,'read-eyebrow'),el('h1',title,'read-step-prompt'));}
 function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 function weekFilter(){const raw=new URLSearchParams(location.search).get('week');if(raw===null)return null;
  if(!/^[1-9]\d?$/.test(raw)||Number(raw)>52)throw new Error('주차 주소를 확인해 주세요.');return Number(raw);}
 function weekMenu(weeks,selected){const nav=el('nav','','read-flow-weeks');nav.setAttribute('aria-label','기록 주차');
  for(const w of [null,...new Set([1,2,3,4,...weeks].filter(n=>Number.isInteger(n)&&n>0&&n<=52))]){
   const a=N.link(route(page,w?{week:w}:{}),w?'WEEK '+w:'전체','read-inline-link');if(w===selected)a.setAttribute('aria-current','page');nav.append(a);}
  root.append(nav);
 }
 function sourceBlock(ex){const src=ex.source_snapshot;if(!src||src.version!==1)return null;
  const d=el('details','','read-origin');d.append(el('summary','이 실험이 시작된 질문 · DAY '+src.dayNumber));
  if(src.prompt)d.append(el('p',src.prompt,'read-step-copy'));if(src.text)d.append(el('blockquote',src.text,'read-own-sentence'));
  d.append(el('p','실험을 만들 때 남긴 문장입니다. 원래 답을 나중에 바꿔도 이 문장은 그대로 남습니다.','read-meta'));
  if(Number.isInteger(src.dayNumber)&&Number.isInteger(src.stepOrder))d.append(N.link(route('day',{day:src.dayNumber,step:src.stepOrder}),'출발한 질문 다시 열기'));
  return d;
 }
 function remaining(ex){if(!ex.due_at||ex.status!=='started')return '';const hours=Math.ceil((Date.parse(ex.due_at)-Date.now())/3600000);
  return hours>0?`${hours}시간 남음`:'정했던 시간이 지났습니다. 해본 만큼 돌아보세요.';}
 function experimentEditor(ex,defaultWeek,reload){
  const form=el('form','','read-editor'),tracker=tracked(),id=ex.id||crypto.randomUUID();let revision=ex.revision||0,busy=false;
  form.nalDirty=false;form.nalBusy=()=>busy;form.nalDiscard=()=>{tracker.clear();form.nalDirty=false;};
  const name=field('무엇을 해볼까요?',ex.title||'',false,200),intent=field('이 실험으로 무엇을 알아보고 싶나요?',ex.intention||'',true,2000);
  const options=[...new Set([1,2,3,4,defaultWeek,ex.week_number].filter(Number.isInteger))].sort((a,b)=>a-b);
  const week=select('해볼 주차',options.map(n=>[n,'WEEK '+n]),ex.week_number||defaultWeek||1);
  const duration=select('해볼 기간',[[24,'24시간'],[72,'72시간'],[168,'7일']],ex.duration_hours||72);
  if(!duration.input.value){const o=el('option',ex.duration_hours+'시간');o.value=String(ex.duration_hours);duration.input.append(o);duration.input.value=o.value;}
  const reflection=field('해보고 나니 무엇을 알게 되었나요?',ex.reflection||'',true);name.input.required=true;
  form.append(el('h2',ex.id?'내 실험 다듬기':'이번 주, 하나만 해봅니다.'),name.wrap,intent.wrap,week.wrap,duration.wrap);
  const origin=sourceBlock(ex);if(origin)form.append(origin);if(ex.id)form.append(reflection.wrap);
  const changed=()=>{form.nalDirty=true;tracker.changed();};form.addEventListener('input',changed);form.addEventListener('change',changed);
  form.addEventListener('submit',e=>e.preventDefault());
  async function save(status,c){
   if(busy)return;if(!name.input.value.trim())throw new Error('해볼 일을 한 문장으로 남겨주세요.');
   const payload={id,revision,title:name.input.value.trim(),intention:intent.input.value,reflection:reflection.input.value,weekNumber:Number(week.input.value),durationHours:Number(duration.input.value),status};
   busy=true;const unlock=lock(form);
   try{const r=await N.work('experiment-save',payload);if(!current(c))return;revision=r.experiment.revision;form.nalDiscard();
    N.status('실험 기록을 남겼습니다. LIVE 준비나 리포트로 이어갈 수 있습니다.','ok');await reload();}
   finally{busy=false;unlock();}
  }
  const buttons=row();
  if(!ex.id||ex.status==='planned')buttons.append(button('계획 남기기',c=>save('planned',c),true),button('지금 시작하기',c=>save('started',c)));
  else if(ex.status==='started')buttons.append(button('기록 저장',c=>save('started',c),true),button('잠시 멈추기',c=>save('paused',c),true),button('해봤다',c=>save('completed',c)));
  else if(ex.status==='paused')buttons.append(button('기록 저장',c=>save('paused',c),true),button('다시 시작하기',c=>save('started',c)),button('해본 만큼 마치기',c=>save('completed',c),true));
  else buttons.append(button('돌아보기 저장',c=>save(ex.status,c)));
  if(ex.id&&!['completed','cancelled'].includes(ex.status))buttons.append(button('이 실험은 여기까지',c=>save('cancelled',c),true));
  form.append(buttons);return form;
 }
 async function renderTry(c){
  const data=await N.work('experiments');if(!current(c))return;const selected=weekFilter(),all=data.experiments||[];
  root.replaceChildren();root.hidden=false;heading('TRY','생각에서, 한 걸음 밖으로.');weekMenu(all.map(x=>x.week_number),selected);
  const edit=el('div','','read-editor-slot');root.append(edit);
  function open(ex){const previous=edit.querySelector('form');if(previous?.nalBusy?.())throw new Error('현재 실험을 저장한 뒤 다른 실험을 열어주세요.');
   if(previous?.nalDirty&&!confirm('저장하지 않은 실험 내용을 버리고 다른 실험을 열까요?'))return;
   previous?.nalDiscard?.();edit.replaceChildren(experimentEditor(ex,selected||1,()=>render()));edit.querySelector('input')?.focus();}
  root.append(button('새로운 작은 실험',()=>open({})));
  const list=el('div','','read-record-list'),visible=all.filter(x=>selected===null||x.week_number===selected);
  for(const ex of visible){const section=el('section','','read-record');section.dataset.experiment=ex.id;
   section.append(el('p',`WEEK ${ex.week_number} · ${labels[ex.status]}`,'read-eyebrow'),el('h2',ex.title));
   if(ex.intention)section.append(el('p',ex.intention,'read-step-copy'));
   if(ex.started_at)section.append(el('p',`시작 ${N.date(ex.started_at)}${ex.due_at?' · 목표 '+N.date(ex.due_at):''}`,'read-meta'));
   if(remaining(ex))section.append(el('p',remaining(ex),'read-meta'));
   if(ex.reflection)section.append(el('blockquote',ex.reflection,'read-own-sentence'));
   const origin=sourceBlock(ex);if(origin)section.append(origin);
   const actions=row();actions.append(button(ex.status==='completed'?'돌아보기 읽고 다듬기':'이 실험 열기',()=>open(ex),true),N.link(route('live',{week:ex.week_number}),'이 주차의 대화 준비'),N.link(route('report'),'내 리포트에서 읽기'));section.append(actions);list.append(section);
  }
  if(!visible.length)list.append(el('p',selected?'이 주차에 저장한 실험이 아직 없습니다.':'아직 실험이 없습니다. 작게 해볼 일을 하나 남겨보세요.','read-empty'));root.append(list);
  const target=new URLSearchParams(location.search).get('experiment');
  if(target){const ex=UUID.test(target)?visible.find(x=>x.id===target):null;
   if(ex)open(ex);else root.prepend(el('p','선택한 실험을 현재 계정·주차에서 찾지 못했습니다. 전체 주차를 확인해 주세요.','read-meta'));}
 }
 function calendar(s){
  const esc=v=>String(v).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const dt=v=>new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NAL//READ//KO','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+s.id+'@nal-read','DTSTAMP:'+dt(Date.now()),'DTSTART:'+dt(s.startsAt),'DTEND:'+dt(s.endsAt),'SUMMARY:'+esc(s.title),'DESCRIPTION:'+esc('NAL READ · 접속 주소는 참가자 LIVE 화면에서 확인합니다.'),'END:VEVENT','END:VCALENDAR'];
  const enc=new TextEncoder(),fold=line=>{let out='',part='',size=0;for(const char of line){const n=enc.encode(char).length;if(size+n>75){out+=part+'\r\n';part=' ';size=1;}part+=char;size+=n;}return out+part;};
  download('NAL-LIVE-W'+s.weekNumber+'.ics',lines.map(fold).join('\r\n')+'\r\n','text/calendar;charset=utf-8');
 }
 async function renderLive(c){
  const [data,tries]=await Promise.all([N.work('live'),N.work('experiments')]);if(!current(c))return;const selected=weekFilter();
  root.replaceChildren();root.hidden=false;heading('LIVE','쓴 것을, 말해보는 시간.');weekMenu((data.sessions||[]).map(s=>s.weekNumber),selected);
  root.append(N.link(route('live',selected?{week:selected}:{}),'일정 새로 불러오기','read-inline-link'));
  const sessions=(data.sessions||[]).filter(s=>selected===null||s.weekNumber===selected);
  if(!sessions.length){root.append(el('p','이 범위에 확정된 LIVE 일정이 없습니다. 일정이 등록되면 여기에서 확인할 수 있습니다.','read-empty'),N.link(route('try',selected?{week:selected}:{}),'내 실험 돌아보기'),N.link(route('report'),'내 리포트'));return;}
  for(const s of sessions){
   const section=el('section','','read-record'),tracker=tracked();section.dataset.session=s.id;let revision=s.note?.revision||0,busy=false;
   section.append(el('p',`WEEK ${s.weekNumber} · ${s.status==='cancelled'?'취소된 일정':'LIVE'}`,'read-eyebrow'),el('h2',s.title),el('p',N.date(s.startsAt)+' ~ '+N.date(s.endsAt)+' (한국 시간)','read-meta'));
   if(s.question)section.append(el('blockquote',s.question,'read-own-sentence'));if(s.status==='cancelled'){root.append(section);continue;}
   const rsvp=select('참여 예정',[['undecided','아직 미정'],['yes','참여해요'],['maybe','일정을 확인할게요'],['no','이번에는 어려워요']],s.note?.rsvp||'undecided');
   const before=field('대화 전에 꺼내보고 싶은 내 이야기',s.note?.before_note||'',true),after=field('대화 뒤, 가지고 가고 싶은 한 문장',s.note?.after_note||'',true);
   const state=el('p','','read-save-state');state.setAttribute('role','status');
   const prep=el('details','','read-live-prep');prep.append(el('summary','내 실험에서 대화 준비하기'));
   const related=(tries.experiments||[]).filter(x=>x.week_number===s.weekNumber);
   function appendNote(text){if(busy)return;const candidate=before.input.value.trim()?before.input.value+'\n\n'+text:text;
    if(candidate.length>5000)throw new Error('메모가 5,000자를 넘습니다. 남길 문장을 직접 골라 적어주세요.');
    before.input.value=candidate;tracker.changed();state.textContent='개인 메모에 담았습니다. 내 메모 저장을 누르면 기록됩니다.';before.input.focus();}
   for(const ex of related){const item=el('section','','read-live-prep-item');item.append(el('h3',ex.title),el('p',labels[ex.status],'read-meta'));
    if(ex.reflection)item.append(el('blockquote',ex.reflection,'read-own-sentence'));const origin=sourceBlock(ex);if(origin)item.append(origin);
    const actions=row();actions.append(button('계획을 개인 메모에 담기',()=>appendNote('내 실험: '+ex.title+(ex.intention?'\n'+ex.intention:'')),true));
    if(ex.reflection)actions.append(button('돌아보기를 개인 메모에 담기',()=>appendNote('해보고 알게 된 것: '+ex.reflection),true));
    actions.append(N.link(route('try',{week:ex.week_number,experiment:ex.id}),'이 실험으로 돌아가기'));item.append(actions);prep.append(item);
   }
   if(!related.length)prep.append(el('p','이번 주 실험 기록이 아직 없습니다. 기록을 만들지 않고도 대화 메모를 남길 수 있습니다.','read-meta'));
   prep.append(el('p','담기를 눌러도 다른 참가자나 진행자에게 전송하지 않습니다. 기존 개인 메모 뒤에 추가하며, 저장은 직접 선택합니다.','read-meta'));section.append(prep);
   for(const f of [rsvp,before,after]){f.input.addEventListener('input',tracker.changed);f.input.addEventListener('change',tracker.changed);section.append(f.wrap);}
   section.append(el('p','대화 전후 메모는 나의 기록입니다. 출석이나 타인에게 공유한 내용으로 처리하지 않습니다.','read-meta'));
   const actions=row();actions.append(button('내 메모 저장',async ctx=>{
    if(busy)return;busy=true;const unlock=lock(section),payload={id:s.id,revision,rsvp:rsvp.input.value,beforeNote:before.input.value,afterNote:after.input.value};
    try{const result=await N.work('live-save',payload);if(current(ctx)){revision=result.revision;tracker.clear();state.textContent='대화 기록이 남았습니다. 내 리포트에서 함께 읽을 수 있습니다.';}}
    finally{busy=false;unlock();}
   }),button('내 캘린더에 담기',()=>calendar(s),true));
   const join=button('Zoom 참여하기',async ctx=>{
    if(busy)return;busy=true;const unlock=lock(section),popup=window.open('about:blank','_blank');let navigated=false;if(popup)popup.opener=null;
    try{const result=await N.work('live-join',{id:s.id,revision});if(!current(ctx)){popup?.close();return;}
     if(!Number.isInteger(result.revision))throw new Error('입장 연결과 메모 버전을 다시 확인해 주세요. 저장하지 않은 메모는 화면에 남아 있습니다.');
     revision=result.revision;const url=new URL(result.joinUrl);if(url.protocol!=='https:'||!/(^|\.)zoom\.us$/.test(url.hostname))throw new Error('접속 주소를 확인할 수 없습니다.');
     if(popup){popup.location.replace(url.href);navigated=true;}else{const a=N.link(url.href,'Zoom 새 창으로 열기');a.target='_blank';a.rel='noopener noreferrer';actions.append(a);}
    }catch(e){if(!navigated)popup?.close();throw e;}finally{busy=false;unlock();}
   },true);join.disabled=!s.canJoin;actions.append(join);section.append(actions,state);
   const next=row();next.append(N.link(route('try',{week:s.weekNumber}),'대화 뒤 작은 실험으로'),N.link(route('report'),'내 메모와 실험을 한 권으로'));section.append(next);
   if(!s.canJoin)section.append(el('p','입장은 시작 15분 전부터 종료 후 30분까지 열립니다. 시간이 지난 화면은 일정을 새로 불러와 주세요.','read-meta'));root.append(section);
  }
  const target=new URLSearchParams(location.search).get('session');if(target){const n=UUID.test(target)?[...root.querySelectorAll('[data-session]')].find(n=>n.dataset.session===target):null;
   if(n){n.tabIndex=-1;n.focus({preventScroll:true});n.scrollIntoView({block:'start'});}else root.prepend(el('p','요청한 LIVE를 현재 주차에서 찾지 못했습니다.','read-meta'));}
 }
 async function renderMy(c){
  root.replaceChildren();root.hidden=false;heading('MY NAL','내가 남긴 문장으로, 나를 읽습니다.');root.append(N.link(route('report'),'내 답·실험·대화를 한 권으로','read-button'));
  const search=field('내 답과 질문에서 찾기','',false,120),star=el('label','','read-local-option'),toggle=el('input');toggle.type='checkbox';star.append(toggle,document.createTextNode('중요하게 남긴 답만'));
  const form=el('form','','read-archive-search'),list=el('div','','read-record-list'),buttons=row(),submit=el('button','찾기','read-button secondary');submit.type='submit';form.append(search.wrap,star,submit);root.append(form,list,buttons);
  let offset=0,items=[],busy=false,queryId=0;
  async function load(reset){
   if(busy&&!reset)return;const q=++queryId;busy=true;submit.disabled=true;if(reset){offset=0;items=[];list.replaceChildren();}
   try{const data=await N.work('archive',{offset,search:search.input.value,starred:toggle.checked});if(!current(c)||q!==queryId)return;
    const batch=(data.answers||[]).slice(0,50);offset+=batch.length;items.push(...batch);
    for(const a of batch){const record=el('article','','read-record');record.append(el('p',`DAY ${String(a.day_number).padStart(2,'0')} · ${N.date(a.updated_at)}`,'read-eyebrow'),el('h2',a.prompt||a.day_title));
     const answer=a.answer_text??(a.answer_json?.values?.join(', ')??(a.answer_json?.value!=null?String(a.answer_json.value):''));record.append(el('blockquote',answer||'선택하지 않고 남긴 기록','read-own-sentence'));
     const actions=row(),mark=button(a.starred?'★ 중요하게 남김':'☆ 중요하게 남기기',async ctx=>{await N.work('mark',{id:a.id,starred:!a.starred});if(!current(ctx))return;a.starred=!a.starred;mark.textContent=a.starred?'★ 중요하게 남김':'☆ 중요하게 남기기';mark.setAttribute('aria-pressed',String(a.starred));},true);
     mark.setAttribute('aria-pressed',String(a.starred));actions.append(mark,N.link(route(a.day_number===0?'before':'day',{...(a.day_number?{day:a.day_number}:{}),step:a.step_order}),'이 질문 다시 열기'));record.append(actions);list.append(record);
    }
    if(!items.length)list.append(el('p','아직 남긴 답이 없거나 이 조건에 맞는 기록이 없습니다.','read-empty'));
    buttons.replaceChildren();if((data.answers||[]).length>50)buttons.append(button('기록 더 읽기',()=>load(false),true));
    if(items.length)buttons.append(button('현재 '+items.length+'개 기록 파일로 저장',()=>download('NAL-'+N.slug+'-my-records.json',JSON.stringify({season:N.slug,exportedAt:new Date().toISOString(),scope:'currently loaded filtered records',records:items},null,2),'application/json;charset=utf-8'),true));
   }catch(e){if(current(c))N.error(e);}finally{if(q===queryId){busy=false;if(submit.isConnected)submit.disabled=false;}}
  }
  form.addEventListener('submit',e=>{e.preventDefault();load(true);});await load(true);if(!current(c))return;
  root.append(el('p','저장 파일에는 개인 기록이 포함됩니다. 공용 기기에 남기지 마세요.','read-meta'));
  const [tries,live]=await Promise.all([N.work('experiments'),N.work('live')]);if(!current(c))return;
  const reflection=el('section','','read-panel');reflection.append(el('h2','해본 것과, 대화에서 남은 것'));
  for(const ex of (tries.experiments||[]).filter(x=>x.reflection))reflection.append(el('h3',ex.title),el('blockquote',ex.reflection,'read-own-sentence'),N.link(route('try',{week:ex.week_number,experiment:ex.id}),'해당 실험 열기'));
  for(const s of (live.sessions||[]).filter(x=>x.note?.after_note))reflection.append(el('h3',s.title),el('blockquote',s.note.after_note,'read-own-sentence'),N.link(route('live',{week:s.weekNumber,session:s.id}),'해당 대화 열기'));
  reflection.append(N.link(route('try'),'내 실험으로'),N.link(route('live'),'대화 기록으로'));root.append(reflection);
 }
 async function render(){++generation;markers.forEach(m=>N.setDirty(m,false));markers.clear();if(!N.user){root.replaceChildren();root.hidden=true;return;}
  const c=context();try{if(page==='try')await renderTry(c);else if(page==='live')await renderLive(c);else if(page==='my')await renderMy(c);}catch(e){if(current(c))N.error(e);}}
 N.ready.then(ok=>{if(ok)render();});window.addEventListener('nal:session',render);
})();
