(() => {
 'use strict';
 const N=window.NalRead;if(!N)return;
 const page=document.body.dataset.readWorkspacePage,root=document.querySelector('[data-private-root]'),el=N.node;
 let generation=0;
 const labels={planned:'생각해둔 일',started:'해보는 중',paused:'잠시 멈춤',completed:'해봤어요',cancelled:'다르게 선택했어요'};
 function button(text,fn,secondary=false){const b=el('button',text,'read-button'+(secondary?' secondary':''));b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){N.error(e);}finally{b.disabled=false;}});return b;}
 function field(label,value='',textarea=false,max=5000){const wrap=el('label','','read-field'),input=el(textarea?'textarea':'input',null,textarea?'read-answer':'read-input');
  if(textarea)input.rows=4;input.value=value;input.maxLength=max;wrap.append(el('span',label),input);return {wrap,input};}
 function select(label,options,value){const wrap=el('label','','read-field'),input=el('select');
  for(const [v,t] of options){const o=el('option',t);o.value=v;input.append(o);}input.value=String(value);wrap.append(el('span',label),input);return {wrap,input};}
 function row(){return el('div','','read-actions');}
 function title(eyebrow,heading){root.append(el('p',eyebrow,'read-eyebrow'),el('h1',heading,'read-step-prompt'));}
 function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 function remaining(ex){if(!ex.due_at||ex.status!=='started')return '';const hours=Math.ceil((Date.parse(ex.due_at)-Date.now())/3600000);
  return hours>0?`${hours}시간 남음`:'정했던 시간이 지났습니다. 해본 만큼 돌아보세요.';}
 function experimentEditor(ex={},listReload){
  const form=el('form','','read-editor'),marker={},id=ex.id||crypto.randomUUID();let revision=ex.revision||0;
  form.nalDirty=false;form.nalDiscard=()=>{N.setDirty(marker,false);form.nalDirty=false;};
  const name=field('무엇을 해볼까요?',ex.title||'',false,200),intent=field('이 실험으로 무엇을 알아보고 싶나요?',ex.intention||'',true,2000);
  const week=select('주차',[1,2,3,4].map(n=>[String(n),`WEEK ${n}`]),ex.week_number||1);
  const duration=select('해볼 기간',[['24','24시간'],['72','72시간'],['168','7일']],ex.duration_hours||72);
  if(!duration.input.value){const o=el('option',`${ex.duration_hours}시간`);o.value=String(ex.duration_hours);duration.input.append(o);duration.input.value=o.value;}
  const reflection=field('해보고 나니 무엇을 알게 되었나요?',ex.reflection||'',true);
  name.input.required=true;form.append(el('h2',ex.id?'내 실험 다듬기':'이번 주, 하나만 해봅니다.'),name.wrap,intent.wrap,week.wrap,duration.wrap);
  if(ex.id)form.append(reflection.wrap);
  const changed=()=>{form.nalDirty=true;N.setDirty(marker,true);};form.addEventListener('input',changed);form.addEventListener('change',changed);
  const save=async status=>{
   if(!name.input.value.trim()){name.input.reportValidity();throw new Error('해볼 일을 한 문장으로 남겨주세요.');}
   const r=await N.work('experiment-save',{id,revision,title:name.input.value.trim(),intention:intent.input.value,
    reflection:reflection.input.value,weekNumber:Number(week.input.value),durationHours:Number(duration.input.value),status});
   revision=r.experiment.revision;form.nalDiscard();N.status('실험 기록을 남겼습니다.','ok');await listReload();
  };
  form.addEventListener('submit',e=>e.preventDefault());const buttons=row();
  if(!ex.id||ex.status==='planned')buttons.append(button('계획 남기기',()=>save('planned'),true),button('지금 시작하기',()=>save('started')));
  else if(ex.status==='started')buttons.append(button('기록 저장',()=>save('started'),true),button('잠시 멈추기',()=>save('paused'),true),button('해봤다',()=>save('completed')));
  else if(ex.status==='paused')buttons.append(button('다시 시작하기',()=>save('started')),button('해본 만큼 마치기',()=>save('completed'),true));
  else buttons.append(button('돌아보기 저장',()=>save(ex.status)));
  if(ex.id&&!['completed','cancelled'].includes(ex.status))buttons.append(button('이 실험은 여기까지',()=>save('cancelled'),true));
  form.append(buttons);return form;
 }
 async function renderTry(ticket){
  const data=await N.work('experiments');if(ticket!==generation)return;
  root.replaceChildren();root.hidden=false;title('TRY','생각에서, 한 걸음 밖으로.');
  const edit=el('div','','read-editor-slot');root.append(edit);
  const open=ex=>{const previous=edit.querySelector('form');
   if(previous?.nalDirty&&!confirm('저장하지 않은 실험 내용이 있습니다. 내용을 버리고 다른 실험을 열까요?'))return;
   previous?.nalDiscard?.();edit.replaceChildren(experimentEditor(ex,()=>render()));edit.querySelector('input')?.focus();};
  root.append(button('새로운 작은 실험',()=>open({})));
  const list=el('div','','read-record-list');
  for(const ex of data.experiments||[]){const section=el('section','','read-record');
   section.append(el('p',`WEEK ${ex.week_number} · ${labels[ex.status]}`,'read-eyebrow'),el('h2',ex.title));
   if(ex.intention)section.append(el('p',ex.intention,'read-step-copy'));
   if(ex.started_at)section.append(el('p',`시작 ${N.date(ex.started_at)}${ex.due_at?' · 목표 '+N.date(ex.due_at):''}`,'read-meta'));
   if(remaining(ex))section.append(el('p',remaining(ex),'read-meta'));
   if(ex.reflection)section.append(el('blockquote',ex.reflection,'read-own-sentence'));
   section.append(button(ex.status==='completed'?'돌아보기 읽고 다듬기':'이 실험 열기',()=>open(ex),true));list.append(section);
  }
  if(!list.children.length)list.append(el('p','아직 실험이 없습니다. 작게 해보고 싶은 일을 하나 남겨보세요.','read-empty'));root.append(list);
 }
 function calendar(s){
  const esc=v=>String(v).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const dt=v=>new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NAL//READ//KO','CALSCALE:GREGORIAN','BEGIN:VEVENT',
   'UID:'+s.id+'@nal-read','DTSTAMP:'+dt(Date.now()),'DTSTART:'+dt(s.startsAt),'DTEND:'+dt(s.endsAt),
   'SUMMARY:'+esc(s.title),'DESCRIPTION:'+esc('NAL READ · Zoom 링크는 참가자 LIVE 화면에서 확인합니다.'),'END:VEVENT','END:VCALENDAR'];
  // Fold UTF-8 at 75 octets without splitting a Korean character.
  const encoder=new TextEncoder(),fold=line=>{let out='',part='',size=0;
   for(const char of line){const len=encoder.encode(char).length;if(size+len>75){out+=part+'\r\n';part=' ';size=1;}part+=char;size+=len;}return out+part;};
  download(`NAL-LIVE-W${s.weekNumber}.ics`,lines.map(fold).join('\r\n')+'\r\n','text/calendar;charset=utf-8');
 }
 async function renderLive(ticket){
  const [data,tries]=await Promise.all([N.work('live'),N.work('experiments')]);if(ticket!==generation)return;
  root.replaceChildren();root.hidden=false;title('LIVE','쓴 것을, 말해보는 시간.');
  root.append(N.link(N.root+'live/','일정 새로 불러오기','read-inline-link'));
  if(!data.sessions?.length){root.append(el('p','확정된 LIVE 일정이 아직 없습니다. 일정과 접속 링크는 확정 후 이곳에 표시됩니다.','read-empty'));return;}
  for(const s of data.sessions){
   const section=el('section','','read-record'),marker={};let revision=s.note?.revision||0,processing=false;
   section.append(el('p',`WEEK ${s.weekNumber} · ${s.status==='cancelled'?'취소된 일정':'LIVE'}`,'read-eyebrow'),el('h2',s.title),el('p',N.date(s.startsAt)+' ~ '+N.date(s.endsAt)+' (한국 시간)','read-meta'));
   if(s.question)section.append(el('blockquote',s.question,'read-own-sentence'));
   const related=(tries.experiments||[]).filter(ex=>ex.week_number===s.weekNumber);
   if(related.length)section.append(el('p','이번 주 내 실험: '+related.map(x=>x.title).join(' / '),'read-step-copy'));
   if(s.status==='cancelled'){root.append(section);continue;}
   const rsvp=select('참여 예정',['undecided','yes','maybe','no'].map((v,i)=>[v,['아직 미정','참여해요','일정을 확인할게요','이번에는 어려워요'][i]]),s.note?.rsvp||'undecided');
   const before=field('대화 전에 꺼내보고 싶은 내 이야기',s.note?.before_note||'',true),after=field('대화 뒤, 가지고 가고 싶은 한 문장',s.note?.after_note||'',true);
   const saveState=el('p','','read-save-state');saveState.setAttribute('role','status');
   for(const f of [rsvp,before,after]){f.input.addEventListener('input',()=>N.setDirty(marker,true));f.input.addEventListener('change',()=>N.setDirty(marker,true));section.append(f.wrap);}
   section.append(el('p','이 메모는 나의 기록입니다. 다른 참가자에게 공유하지 않습니다.','read-meta'));
   const buttons=row();buttons.append(button('내 메모 저장',async()=>{
    if(processing)return;processing=true;
    try{const r=await N.work('live-save',{id:s.id,revision,rsvp:rsvp.input.value,beforeNote:before.input.value,afterNote:after.input.value});
     revision=r.revision;N.setDirty(marker,false);saveState.textContent='대화 기록이 남았습니다.';
    }finally{processing=false;}
   }),button('내 캘린더에 담기',()=>calendar(s),true));
   const join=button('Zoom 참여하기',async()=>{
    if(processing)return;processing=true;
    const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;
    try{const r=await N.work('live-join',{id:s.id});const url=new URL(r.joinUrl);
     if(url.protocol!=='https:'||!/(^|\.)zoom\.us$/.test(url.hostname))throw new Error('접속 주소를 확인할 수 없습니다.');
     if(popup)popup.location.replace(url.href);else{const a=N.link(url.href,'Zoom 새 창으로 열기');a.target='_blank';a.rel='noopener noreferrer';buttons.append(a);}
     const latest=await N.work('live');revision=latest.sessions.find(x=>x.id===s.id)?.note?.revision||revision;
    }catch(e){popup?.close();throw e;}finally{processing=false;}
   },true);
   join.disabled=!s.canJoin;buttons.append(join);section.append(buttons,saveState);
   if(!s.canJoin)section.append(el('p','Zoom 입장은 시작 15분 전부터 종료 후 30분까지 열립니다.','read-meta'));root.append(section);
  }
 }
 async function renderMy(ticket){
  root.replaceChildren();root.hidden=false;title('MY NAL','내가 남긴 문장으로, 나를 읽습니다.');
  const search=field('내 답과 질문에서 찾기','',false,120),star=el('label','','read-local-option'),toggle=el('input');toggle.type='checkbox';star.append(toggle,document.createTextNode('중요하게 남긴 답만'));
  const form=el('form','','read-archive-search'),list=el('div','','read-record-list'),buttons=row(),submit=el('button','찾기','read-button secondary');submit.type='submit';form.append(search.wrap,star,submit);root.append(form,list,buttons);
  let offset=0,items=[],more=true,busy=false,queryId=0;
  const load=async reset=>{
   if(busy&&!reset)return;const q=++queryId;busy=true;submit.disabled=true;
   if(reset){offset=0;items=[];list.replaceChildren();}
   try{
    const data=await N.work('archive',{offset,search:search.input.value,starred:toggle.checked});if(ticket!==generation||q!==queryId)return;
    const batch=(data.answers||[]).slice(0,50);more=(data.answers||[]).length>50;offset+=batch.length;items.push(...batch);
    for(const a of batch){const record=el('article','','read-record');record.append(el('p',`DAY ${String(a.day_number).padStart(2,'0')} · ${N.date(a.updated_at)}`,'read-eyebrow'),el('h2',a.prompt||a.day_title));
     const answer=a.answer_text??(a.answer_json?.values?.join(', ')??(a.answer_json?.value!=null?String(a.answer_json.value):''));
     record.append(el('blockquote',answer||'선택하지 않고 남긴 기록','read-own-sentence'));
     const actions=row(),mark=button(a.starred?'★ 중요하게 남김':'☆ 중요하게 남기기',async()=>{
      await N.work('mark',{id:a.id,starred:!a.starred});a.starred=!a.starred;mark.textContent=a.starred?'★ 중요하게 남김':'☆ 중요하게 남기기';mark.setAttribute('aria-pressed',String(a.starred));
     },true);mark.setAttribute('aria-pressed',String(a.starred));actions.append(mark,N.link(N.dayHref(a.day_number)+(a.day_number===0?'?':'&')+'step='+a.step_order,'이 질문 다시 열기'));record.append(actions);list.append(record);
    }
    if(!items.length)list.append(el('p','아직 남긴 답이 없거나, 이 조건에 맞는 기록이 없습니다.','read-empty'));
    buttons.replaceChildren();if(more)buttons.append(button('기록 더 읽기',()=>load(false),true));
    if(items.length)buttons.append(button(`현재 ${items.length}개 기록 파일로 저장`,()=>download('NAL-'+N.slug+'-my-records.json',JSON.stringify({season:N.slug,exportedAt:new Date().toISOString(),scope:'currently loaded filtered records',records:items},null,2),'application/json;charset=utf-8'),true));
   }catch(e){N.error(e);}finally{if(q===queryId){busy=false;submit.disabled=false;}}
  };
  form.addEventListener('submit',e=>{e.preventDefault();load(true);});await load(true);if(ticket!==generation)return;
  root.append(el('p','저장 파일에는 개인 기록이 포함됩니다. 공용 기기에 남기지 마세요.','read-meta'));
  const [tries,live]=await Promise.all([N.work('experiments'),N.work('live')]);if(ticket!==generation)return;
  const reflection=el('section','','read-panel');reflection.append(el('h2','해본 것과, 대화에서 남은 것'));
  for(const ex of (tries.experiments||[]).filter(x=>x.reflection))reflection.append(el('h3',ex.title),el('blockquote',ex.reflection,'read-own-sentence'));
  for(const s of (live.sessions||[]).filter(x=>x.note?.after_note))reflection.append(el('h3',s.title),el('blockquote',s.note.after_note,'read-own-sentence'));
  reflection.append(N.link(N.root+'try/','내 실험으로'),N.link(N.root+'live/','대화 기록으로'));root.append(reflection);
 }
 async function render(){const ticket=++generation;if(!N.user){root.replaceChildren();root.hidden=true;return;}
  try{if(page==='try')await renderTry(ticket);else if(page==='live')await renderLive(ticket);else if(page==='my')await renderMy(ticket);}catch(e){N.error(e);}}
 N.ready.then(ok=>{if(ok)render();});window.addEventListener('nal:session',render);
})();
