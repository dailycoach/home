import {STEP_TYPES,INPUT_TYPES,validateManifest,blankManifest} from './read-editorial-contract.mjs';
const N=window.NalRead,C=window.NalAdminContext;
if(N){
 const root=document.querySelector('[data-private-root]'),el=N.node;
 let source=null,revision=0,state='empty',role=null,dirty=false,scheduleDirty=false,generation=0,active=0,marker={},scheduleMarker={},liveSessions=[];
 const stateNames={empty:'원고 없음',draft:'초안',review:'편집 검토 중',approved:'승인됨',published:'콘텐츠 반영됨','draft-local':'저장하지 않은 수정'};
 const call=(action,payload={},slug=source?.season?.slug||N.slug)=>N.api('editorial',action,{seasonSlug:slug,payload});
 function textInput(label,value,change,{multi=false,max=4000,type='text'}={}){
  const w=el('label','','read-field'),i=el(multi?'textarea':'input');if(!multi)i.type=type;else i.rows=4;i.value=value??'';i.maxLength=max;
  i.addEventListener('input',()=>change(i.value));w.append(el('span',label),i);return w;
 }
 function select(label,options,value,change){const w=el('label','','read-field'),i=el('select');
  for(const[v,t]of options){const o=el('option',t);o.value=v;i.append(o);}i.value=String(value);i.addEventListener('change',()=>change(i.value));w.append(el('span',label),i);return w;}
 function button(label,fn,primary=false){const b=el('button',label,'read-button'+(primary?'':' secondary'));b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){N.error(e);}finally{if(b.isConnected)b.disabled=false;}});return b;}
 function download(){if(!source)return;const url=URL.createObjectURL(new Blob([JSON.stringify(source,null,2)],{type:'application/json;charset=utf-8'})),a=el('a');a.href=url;a.download=source.season.slug+'.editorial.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 function mark(){dirty=true;state='draft-local';N.setDirty(marker,true);const label=root.querySelector('[data-editor-state]');if(label)label.textContent=stateNames[state];}
 function clearDirty(){dirty=false;scheduleDirty=false;N.setDirty(marker,false);N.setDirty(scheduleMarker,false);}
 function leave(){if((dirty||scheduleDirty)&&!confirm('저장하지 않은 내용이 있습니다. 필요한 원고를 JSON으로 보관한 뒤 다른 원고를 열까요?'))return false;clearDirty();return true;}
 function guardManifest(complete=false){const errors=validateManifest(source,{complete});if(errors.length)throw new Error(errors.slice(0,8).join('\n'));}
 async function busy(fn){root.inert=true;root.setAttribute('aria-busy','true');try{return await fn();}finally{root.inert=false;root.removeAttribute('aria-busy');}}
 async function save(){
  if(!source)throw new Error('원고를 먼저 열어주세요.');if(scheduleDirty)throw new Error('작성 중인 LIVE 일정부터 저장해 주세요.');guardManifest();
  return busy(async()=>{const data=await call('save',{revision,source});revision=data.revision;state=data.state;source=data.source;dirty=false;N.setDirty(marker,false);renderEditor();N.status('원고를 초안으로 저장했습니다. 참가자 화면은 바뀌지 않습니다.','ok');});
 }
 async function transition(action){
  if(dirty||scheduleDirty)throw new Error('수정한 내용을 먼저 저장해 주세요.');guardManifest(true);
  const payload={revision};
  if(action==='approve'){
   if(!root.querySelector('[data-source-reviewed]')?.checked)throw new Error('문구와 출처를 확인했다는 항목을 선택해 주세요.');payload.sourceReviewed=true;
  }
  if(action==='publish'){
   const input=prompt('콘텐츠 반영은 판매 시작이 아닙니다. 진행 중인 참가자가 있는 시즌은 바꿀 수 없습니다.\n반영할 시즌 주소를 입력해 주세요.',source.season.slug);
   if(input!==source.season.slug)return;payload.confirmSlug=input;
  }
  await busy(async()=>{const result=await call(action,payload);revision=result.revision;state=result.state;renderEditor();N.status(action==='publish'?'승인 원고를 참가자용 콘텐츠에 반영했습니다. READ 공개·판매는 별도입니다.':'편집 상태를 변경했습니다.','ok');});
 }
 async function open(slug){
  if(!leave())return;const ticket=++generation;
  await busy(async()=>{const data=await call('get',{},slug);if(ticket!==generation)return;
   if(data.source&&data.source.season?.slug!==slug)throw new Error('선택한 시즌과 원고의 주소가 다릅니다. 다른 원고로 대신 열지 않습니다.');
   role=data.role;source=data.source||blankManifest(slug);revision=data.revision;state=data.state;liveSessions=data.liveSessions||[];active=0;renderEditor();
  });
 }
 async function library(){
  if(!N.user){root.replaceChildren();root.hidden=true;return;}
  const ticket=++generation;
  try{
   if(!C)throw new Error('운영 화면 연결 파일을 다시 불러와 주세요.');const requested=C.read().seasonSlug;
   const data=await call('list');if(ticket!==generation)return;
   if(!Array.isArray(data.seasons))throw new Error('원고 목록을 확인하지 못했습니다. 빈 원고를 대신 만들지 않습니다.');
   role=data.role;root.hidden=false;root.replaceChildren();
   // A URL is a selection request, not permission or an instruction to create a season.
   if(requested){
    if(!data.seasons.some(s=>s.slug===requested)){
     const clear=N.link('/nal/read/admin/','기수 선택 해제하고 원고 목록 보기');clear.dataset.adminContext='clear';
     root.append(el('h1','선택한 원고를 찾지 못했습니다.','read-step-prompt'),el('p','현재 운영 계정의 원고 목록에 이 시즌이 없습니다. 다른 시즌이나 새 빈 원고를 대신 열지 않습니다.','read-empty'),clear);return;
    }
    await open(requested);return;
   }
   root.append(el('p','NAL READ · EDITORIAL','read-eyebrow'),el('h1','다음 질문을 만드는 곳.','read-step-prompt'));
   root.append(el('p','원고를 불러와 편집하고, 검토와 승인을 거쳐 참가자용 콘텐츠로 반영합니다. 개인 답변은 이 화면에서 조회하지 않습니다.','read-step-copy'));
   const row=el('div','','read-actions');row.append(button('새 시즌 만들기',()=>{
    if(!leave())return;const slug=prompt('새 시즌 주소 · 영문 소문자, 숫자, 하이픈','read-02');if(!slug||!/^[a-z0-9-]{1,120}$/.test(slug))return;
    source=blankManifest(slug);revision=0;state='draft-local';active=0;liveSessions=[];mark();renderEditor();
   }));
   const file=el('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','원고 JSON 파일 불러오기');
   file.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;
    try{if(f.size>550000)throw new Error('원고 파일은 550KB 이내로 올려주세요.');const doc=JSON.parse(await f.text());const issues=validateManifest(doc);if(issues.length)throw new Error(issues.slice(0,8).join('\n'));
     if(!leave())return;const existing=data.seasons.find(s=>s.slug===doc.season.slug);
     if(existing){const current=await call('get',{},doc.season.slug);revision=current.revision;liveSessions=current.liveSessions||[];}
     else{revision=0;liveSessions=[];}
     source=doc;active=0;mark();renderEditor();N.status('파일을 편집기에 불러왔습니다. 서버 저장이나 공개는 아직 하지 않았습니다.','ok');
    }catch(e){N.error(e);}finally{file.value='';}
   });
   const label=el('label','','read-field');label.append(el('span','기존 원고 JSON 가져오기'),file);row.append(label);root.append(row);
   const list=el('div','','read-record-list');
   for(const s of data.seasons){const item=el('section','','read-record');item.append(el('h2',s.title),el('p',s.slug+' · '+stateNames[s.state]+' · v'+s.revision,'read-meta'),button('원고 열기',()=>open(s.slug)));list.append(item);}
   if(!list.children.length)list.append(el('p','아직 시즌이 없습니다. 새 원고를 만들거나 준비된 JSON을 가져오세요.','read-empty'));root.append(list);N.status('');
  }catch(e){N.error(e);}
 }
 function preview(day){
  const dialog=el('dialog','','read-editor-preview');dialog.setAttribute('aria-label','DAY 미리보기');const close=button('미리보기 닫기',()=>dialog.close());dialog.append(close,el('h2',`DAY ${day.number} · ${day.title}`));
  for(const s of day.steps){const part=el('section','','read-preview-step');part.append(el('p',s.type,'read-eyebrow'));
   if(s.content)part.append(el(s.type==='HOOK'?'h3':'p',s.content,s.type==='HOOK'?'read-step-prompt':'read-step-copy'));
   if(s.prompt)part.append(el('h3',s.prompt));
   if(s.type==='SCALE')part.append(el('p','1　2　3　4　5 · 전혀 그렇지 않다 → 매우 그렇다'));
   if(s.type==='MULTI_SELECT')for(const option of s.options||[])part.append(el('p','□ '+option));
   if(['QUESTION','TRY'].includes(s.type))part.append(el('p',s.placeholder||'한 문장이어도 충분합니다.','read-preview-answer'));
   if(s.type==='RECORD')part.append(el('blockquote','참가자가 앞에서 남긴 답이 이곳에 표시됩니다.','read-own-sentence'));dialog.append(part);
  }
  dialog.addEventListener('close',()=>dialog.remove());root.append(dialog);dialog.showModal();
 }
 function renderEditor(){
  C.set(source.season.slug,source.season.title);root.replaceChildren();root.hidden=false;
  const top=el('div','','read-editor-top');top.append(el('p','EDITORIAL · v'+revision,'read-eyebrow'),el('h1',source.season.title,'read-step-prompt'));
  const status=el('p',stateNames[state]||state,'read-meta');status.dataset.editorState='';top.append(status);
  const actions=el('div','','read-actions');actions.append(button('시즌 목록',async()=>{if(leave()){C.set(null);await library();}}),button('JSON 파일로 보관',download),button('초안 저장',save,true));
  const clone=button('다음 시즌으로 복제',()=>{
   const slug=prompt('복제할 새 시즌 주소','read-02');if(!slug||!/^[a-z0-9-]{1,120}$/.test(slug)||slug===source.season.slug)return;
   source=structuredClone(source);source.season.slug=slug;source.season.title='새 시즌 · '+source.season.title;revision=0;liveSessions=[];mark();renderEditor();
  });actions.append(clone);top.append(actions);root.append(top);
  const metadata=el('details','','read-panel');metadata.append(el('summary','시즌 제목·주차·출처 편집'));
  metadata.append(textInput('시즌 제목',source.season.title,v=>{source.season.title=v;mark();},{max:120}),textInput('부제',source.season.subtitle,v=>{source.season.subtitle=v;mark();},{max:400}));
  source.provenance??={origin:'operator',attributionStatus:'editorial-review-required'};
  metadata.append(textInput('참고 도서 / 자료',source.provenance.bookReference,v=>{source.provenance.bookReference=v;mark();},{max:500}),textInput('편집 메모·출처 확인 사항',source.provenance.note,v=>{source.provenance.note=v;mark();},{multi:true,max:4000}));
  for(const w of source.weeks){metadata.append(textInput(`WEEK ${w.number} 제목`,w.title,v=>{w.title=v;mark();},{max:120}),textInput(`WEEK ${w.number} 부제`,w.subtitle,v=>{w.subtitle=v;mark();},{max:400}));}root.append(metadata);
  const layout=el('div','','read-editor-layout'),toc=el('nav','','read-editor-toc'),content=el('section','','read-editor-day');toc.setAttribute('aria-label','편집할 DAY');
  const days=[...source.days].sort((a,b)=>a.number-b.number);active=Math.max(0,Math.min(active,days.length-1));
  days.forEach((d,idx)=>{const b=button(`${String(d.number).padStart(2,'0')}　${d.title}`,()=>{active=idx;renderEditor();});if(idx===active)b.setAttribute('aria-current','page');toc.append(b);});
  const day=days[active];
  content.append(el('p',day.number===0?'BEFORE':`WEEK ${day.week}`,'read-eyebrow'),textInput('DAY 제목',day.title,v=>{day.title=v;mark();},{max:160}),
   select('DAY 종류',[['before','시작 전'],['daily','질문'],['try','실험'],['live','LIVE'],['final','마지막']],day.type,v=>{day.type=v;mark();}),
   textInput('예상 소요 시간(분)',day.minutes,v=>{day.minutes=Number(v);mark();},{type:'number'}),button('참가자 화면 미리보기',()=>preview(day)));
  for(let idx=0;idx<day.steps.length;idx++){
   const s=day.steps[idx],part=el('section','','read-editor-step'),head=el('div','','read-editor-step-head');head.append(el('h3',`STEP ${idx+1}`));
   const controls=el('div','','read-actions');
   const up=button('위로',()=>{[day.steps[idx-1],day.steps[idx]]=[s,day.steps[idx-1]];mark();renderEditor();});up.disabled=idx===0;
   const down=button('아래로',()=>{[day.steps[idx+1],day.steps[idx]]=[s,day.steps[idx+1]];mark();renderEditor();});down.disabled=idx===day.steps.length-1;
   const remove=button('삭제',()=>{if(day.steps.length<2)throw new Error('DAY에는 하나 이상의 STEP이 필요합니다.');if(confirm('이 STEP을 편집 원고에서 지울까요?')){day.steps.splice(idx,1);mark();renderEditor();}});
   controls.append(up,down,remove);head.append(controls);part.append(head);
   part.append(select('STEP 종류',STEP_TYPES.map(t=>[t,t]),s.type,v=>{s.type=v;if(!INPUT_TYPES.includes(v))s.required=false;if(v==='MULTI_SELECT')s.options??=['선택지 1'];if(v!=='SCALE'){delete s.measureKey;delete s.measureVersion;}mark();renderEditor();}));
   part.append(textInput('고유 키 · 기록 연결용',s.key,v=>{s.key=v;mark();},{max:120}));
   if(['HOOK','IDEA','MIRROR','RECORD','LIVE'].includes(s.type))part.append(textInput('화면 문장',s.content,v=>{s.content=v;mark();},{multi:true,max:4000}));
   if(INPUT_TYPES.includes(s.type)){
    part.append(textInput('질문',s.prompt,v=>{s.prompt=v;mark();},{multi:true,max:1000}),textInput('입력 안내',s.placeholder,v=>{s.placeholder=v;mark();},{max:1000}));
    const label=el('label','','read-local-option'),cb=el('input');cb.type='checkbox';cb.checked=!!s.required;cb.addEventListener('change',()=>{s.required=cb.checked;mark();});label.append(cb,document.createTextNode('이 질문은 답을 남긴 뒤 완료'));part.append(label);
   }
   if(s.type==='MULTI_SELECT')part.append(textInput('선택지 · 한 줄에 하나',(s.options||[]).join('\n'),v=>{s.options=v.split('\n').map(x=>x.trim()).filter(Boolean);mark();},{multi:true,max:5000}));
   if(s.type==='SCALE'){
    part.append(el('p','척도는 1~5 정수입니다. 시작과 마지막에 같은 비교 키·버전·질문을 사용해야 리포트에서 비교합니다.','read-meta'));
    part.append(textInput('비교 키 (DAY 0 / 28)',s.measureKey,v=>{if(v)s.measureKey=v;else delete s.measureKey;mark();},{max:120}),textInput('비교 문항 버전',s.measureVersion,v=>{if(v)s.measureVersion=v;else delete s.measureVersion;mark();},{max:120}));
   }
   part.append(textInput('리포트 연결 키 (선택)',s.reportKey,v=>{if(v)s.reportKey=v;else delete s.reportKey;mark();},{max:120}));content.append(part);
  }
  content.append(button('질문 STEP 추가',()=>{day.steps.push({key:'question-'+crypto.randomUUID().slice(0,8),type:'QUESTION',prompt:'새 질문을 입력해 주세요.',required:false});mark();renderEditor();}));layout.append(toc,content);root.append(layout);
  const workflow=el('section','','read-panel');workflow.append(el('h2','검토 → 승인 → 콘텐츠 반영'),el('p','초안 저장은 참가자 화면을 바꾸지 않습니다. 원고를 다시 수정하면 승인 상태가 해제됩니다.'));
  const steps=el('div','','read-actions');const review=button('편집 검토 요청',()=>transition('review'));review.disabled=dirty||state!=='draft';steps.append(review);
  if(role==='owner'){
   const check=el('label','','read-local-option'),cb=el('input');cb.type='checkbox';cb.dataset.sourceReviewed='';check.append(cb,document.createTextNode('문구·출처·도서 연결을 직접 확인했습니다.'));workflow.append(check);
   const approve=button('이 버전 승인',()=>transition('approve'));approve.disabled=dirty||state!=='review';steps.append(approve);
   const publish=button('승인 콘텐츠 반영',()=>transition('publish'),true);publish.disabled=dirty||state!=='approved';steps.append(publish);
  }
  workflow.append(steps,el('p','참가 등록이 있는 시즌의 기존 질문은 바꾸지 않습니다. 다음 시즌으로 복제하세요. 콘텐츠 반영은 READ 활성화나 판매 시작과 별개입니다.','read-meta'));root.append(workflow);
  renderHistory();if(role==='owner'&&revision>0)renderSchedules();
 }
 function renderHistory(){
  const panel=el('details','','read-panel');panel.append(el('summary','원고 버전 기록'));const list=el('div');
  panel.append(button('버전 불러오기',async()=>{if(!revision)throw new Error('먼저 초안을 저장하세요.');const data=await call('history');list.replaceChildren();
   for(const h of data.history||[]){const item=el('div','','read-record');item.append(el('p',`v${h.revision} · ${h.event} · ${N.date(h.created_at)}`));
    if(h.event!=='schedule-changed')item.append(button('이 원고를 편집기로 가져오기',async()=>{
     if(!leave())return;const loaded=await call('history-open',{id:h.id});source=loaded.source;active=0;mark();renderEditor();N.status('과거 원고를 편집기로 가져왔습니다. 저장하면 새 버전이 되며 곧바로 공개되지 않습니다.','ok');
    }));list.append(item);}
  }),list);root.append(panel);
 }
 function renderSchedules(){
  const panel=el('details','','read-panel');panel.append(el('summary','LIVE 일정 입력·수정 · 한국 시간'));const picker=el('div','','read-actions'),slot=el('div');panel.append(picker,slot);root.append(panel);
  const kst=value=>{if(!value)return '';const p=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));return p.replace(' ','T');};
  const edit=session=>{
   if(scheduleDirty&&!confirm('저장하지 않은 일정 입력을 버릴까요?'))return;scheduleDirty=false;N.setDirty(scheduleMarker,false);
   const value={id:session?.id||crypto.randomUUID(),updatedAt:session?.updated_at||null,weekNumber:session?.week_number||1,title:session?.title||'',question:session?.opening_question||'',starts:kst(session?.starts_at),ends:kst(session?.ends_at),joinUrl:session?.join_url||'',status:session?.status||'draft'};
   const form=el('fieldset','','read-editor-step');form.append(el('legend',session?'LIVE 일정 수정':'새 LIVE 일정'));
   const change=(key,v)=>{value[key]=v;scheduleDirty=true;N.setDirty(scheduleMarker,true);};
   form.append(textInput('제목',value.title,v=>change('title',v),{max:160}),select('주차',[1,2,3,4].map(n=>[String(n),'WEEK '+n]),value.weekNumber,v=>change('weekNumber',Number(v))),
    textInput('시작 (Asia/Seoul)',value.starts,v=>change('starts',v),{type:'datetime-local'}),textInput('종료 (Asia/Seoul)',value.ends,v=>change('ends',v),{type:'datetime-local'}),
    textInput('Zoom 참여 주소',value.joinUrl,v=>change('joinUrl',v),{max:1000}),textInput('함께 나눌 질문',value.question,v=>change('question',v),{multi:true,max:1000}),
    select('일정 상태',[['draft','준비 중'],['published','참가자에게 표시'],['cancelled','취소']],value.status,v=>change('status',v)));
   form.append(button('일정 저장',async()=>{
    if(dirty)throw new Error('수정 중인 원고부터 저장하세요.');if(!value.starts||!value.ends||!value.title.trim())throw new Error('제목과 시작·종료 시간을 입력해 주세요.');
    const url=new URL(value.joinUrl);if(url.protocol!=='https:'||!/^([a-z0-9-]+\.)?zoom\.us$/.test(url.hostname)||!/^\/(j|my)\//.test(url.pathname))throw new Error('Zoom 참여 주소를 확인해 주세요.');
    if(value.status==='published'&&!confirm('이 LIVE 일정을 참가자 화면에 표시할까요?'))return;form.disabled=true;
    try{await call('schedule-save',{...value,startsAt:new Date(value.starts+':00+09:00').toISOString(),endsAt:new Date(value.ends+':00+09:00').toISOString()});scheduleDirty=false;N.setDirty(scheduleMarker,false);
     const current=await call('get');liveSessions=current.liveSessions||[];renderEditor();N.status('LIVE 일정을 저장했습니다.','ok');
    }finally{form.disabled=false;}
   },true));slot.replaceChildren(form);
  };
  picker.append(button('새 일정',()=>edit(null)));for(const s of liveSessions)picker.append(button(`W${s.week_number} · ${N.date(s.starts_at)}`,()=>edit(s)));
 }
 async function onSession(){generation++;source=null;revision=0;state='empty';role=null;liveSessions=[];clearDirty();marker={};scheduleMarker={};root.replaceChildren();root.hidden=true;await library();}
 N.ready.then(ok=>{if(ok)library();});window.addEventListener('nal:session',onSession);
}
