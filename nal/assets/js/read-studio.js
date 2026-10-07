(() => {
 'use strict';const A=window.NalAccount;if(!A)return;
 const el=A.node,root=document.querySelector('[data-account-private]');
 const query=new URLSearchParams(location.search);let slug=query.get('season')||'',week=Number(query.get('week'))||1;
 let generation=0,dirty={guide:false,plan:false},closePresentation=()=>{};
 let importGuide=null,importPlan=null;
 const blankGuide=()=>({headline:'',introduction:'',forWhom:'',takeAway:'',readingNote:'',beforeStart:'',book:{title:'',author:'',editionNote:''},prepare:[],faq:[]});
 const blankPlan=()=>({aim:'',opening:'',closing:'',followUp:'',agenda:[],debrief:{observed:'',adjust:'',next:''}});
 const hasDirty=()=>dirty.guide||dirty.plan;
 function leave(){return !hasDirty()||confirm('저장하지 않은 안내 또는 진행안이 있습니다. 내용을 버리고 이동할까요?');}
 function current(c){return c.generation===generation&&c.epoch===A.epoch&&!!A.user;}
 const context=()=>({generation,epoch:A.epoch});
 function button(text,fn,secondary=false){const b=el('button',text,secondary?'nal-account-link':'nal-account-button');b.type='button';
  b.addEventListener('click',async()=>{const c=context();b.disabled=true;try{await fn(c);}catch(e){if(current(c)&&e.name!=='AbortError')A.status(e.message,'error');}finally{if(b.isConnected)b.disabled=false;}});return b;}
 function field(label,value,change,{multi=false,max=2000,type='text'}={}){
  const wrap=el('label','','nal-studio-field'),input=el(multi?'textarea':'input');if(!multi)input.type=type;else input.rows=3;
  input.value=value??'';input.maxLength=max;input.addEventListener('input',()=>change(input.value));wrap.append(el('span',label),input);return {wrap,input};
 }
 function select(label,options,value,change){const wrap=el('label','','nal-studio-field'),input=el('select');
  for(const [v,t]of options){const item=el('option',t);item.value=String(v);input.append(item);}input.value=String(value??'');input.addEventListener('change',()=>change(input.value));wrap.append(el('span',label),input);return{wrap,input};}
 function block(title){const s=el('section','','nal-studio-block');s.append(el('h2',title));return s;}
 function lock(container){const states=[...container.querySelectorAll('input,textarea,select,button')].map(n=>[n,n.disabled]);states.forEach(([n])=>n.disabled=true);return()=>states.forEach(([n,value])=>{if(n.isConnected)n.disabled=value;});}
 function move(array,index,offset){const to=index+offset;if(to<0||to>=array.length)return;[array[index],array[to]]=[array[to],array[index]];}
 function textDownload(name,text){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 function timeText(minutes){return Number.isFinite(minutes)?Math.round(minutes)+'분':'미정';}
 function presentation(plan,session,heading){
  closePresentation();if(!plan.agenda.length)throw new Error('진행 순서를 먼저 작성해 주세요.');
  const snapshot=structuredClone(plan),dialog=el('dialog','','nal-run-presenter');
  const toolbar=el('div','','nal-presenter-toolbar'),title=el('p',heading,'nal-account-kicker'),step=el('p','','nal-presenter-step'),prompt=el('h1','','nal-presenter-question'),clock=el('output','','nal-presenter-clock');
  let at=0,elapsed=0,started=null,interval=null;
  const nowElapsed=()=>elapsed+(started===null?0:(performance.now()-started)/1000);
  const paintClock=()=>{const left=Math.ceil(snapshot.agenda[at].minutes*60-nowElapsed());const n=Math.abs(left);clock.textContent=(left<0?'정한 시간 +':'남은 시간 ')+String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
  const pause=()=>{if(started!==null){elapsed=nowElapsed();started=null;}toggle.textContent='타이머 시작';};
  const paint=()=>{pause();elapsed=0;step.textContent=`${at+1} / ${snapshot.agenda.length} · ${snapshot.agenda[at].title}`;prompt.textContent=snapshot.agenda[at].prompt||snapshot.agenda[at].title;paintClock();};
  const toggle=button('타이머 시작',()=>{if(started===null){started=performance.now();toggle.textContent='잠시 멈추기';}else pause();},true);
  toolbar.append(button('닫기',()=>dialog.close(),true),button('발표 화면 인쇄',()=>window.print(),true));
  const actions=el('div','','nal-presenter-toolbar');actions.append(button('이전',()=>{if(at>0){at--;paint();}},true),toggle,button('다음',()=>{if(at<snapshot.agenda.length-1){at++;paint();}},true));
  dialog.append(toolbar,title,step,prompt,clock,actions,el('p','현재 기기의 진행 타이머입니다. 출석이나 참여 완료를 기록하지 않습니다.','nal-account-note'));
  document.body.append(dialog);paint();interval=setInterval(paintClock,500);
  closePresentation=()=>{clearInterval(interval);dialog.remove();};dialog.addEventListener('close',()=>closePresentation(),{once:true});dialog.showModal();
 }
 function guideEditor(data){
  const area=block('프로그램 소개·시작 전 안내'),meta=el('p','','nal-account-meta');
  let source=structuredClone(data.guide.source||blankGuide()),revision=data.guide.revision,published=data.guide.publishedRevision,busy=false;
  const form=el('form','','nal-studio-form');form.addEventListener('submit',e=>e.preventDefault());
  const publish=button('현재 저장본 공개 승인',async c=>{
   if(busy)return;if(dirty.guide)throw new Error('수정한 내용을 초안으로 먼저 저장해 주세요.');
   if(!revision)throw new Error('안내를 먼저 작성하고 저장해 주세요.');
   if(!confirm('저장한 안내 v'+revision+'을 상품 상세와 시작 전 화면에 공개할까요? 가격·모집 상태·READ 공개 스위치는 바뀌지 않습니다.'))return;
   busy=true;const unlock=lock(area);
   try{const result=await A.companion('studio-guide-publish',slug,{revision,confirmed:true});if(current(c)){published=result.publishedRevision;paintMeta();A.status('현재 안내 문구의 공개본을 승인했습니다.','ok');}}
   finally{busy=false;unlock();publish.disabled=data.role!=='owner'||dirty.guide;}
  });
  const paintMeta=()=>{meta.textContent='편집본 v'+revision+' · 공개본 '+(published?'v'+published:'없음')+(published&&published!==revision?' · 이전 공개본은 그대로 유지됩니다.':'')+(dirty.guide?' · 편집창 미저장 변경 있음':'');publish.disabled=data.role!=='owner'||dirty.guide;};
  function changed(){dirty.guide=true;paintMeta();}
  for(const [key,label,max] of [['headline','소개 제목',120],['introduction','프로그램 소개',2000],['forWhom','어떤 분과 함께하나요?',2000],['takeAway','참여하며 무엇을 남기나요?',2000],['readingNote','책 읽기 안내',2000],['beforeStart','시작 전 안내',2000]]){
   form.append(field(label,source[key],v=>{source[key]=v;changed();},{multi:key!=='headline',max}).wrap);
  }
  const book=block('함께 읽을 책');for(const [key,label]of [['title','확정된 책 제목'],['author','저자'],['editionNote','판본·준비 방법 안내']])book.append(field(label,source.book[key],v=>{source.book[key]=v;changed();},{max:600,multi:key==='editionNote'}).wrap);
  book.append(el('p','확정되지 않은 책 정보는 빈칸으로 둡니다. 상품의 가격·포함 내역은 참가상품 안내에서 별도로 관리합니다.','nal-account-note'));form.append(book);
  const prep=block('준비 체크 항목'),prepList=el('div');prep.append(prepList);
  function paintPrep(){prepList.replaceChildren();source.prepare.forEach((item,index)=>{
   const card=el('section','','nal-studio-card');card.append(field('항목 제목',item.title,v=>{item.title=v;changed();},{max:160}).wrap,
    field('준비 방법',item.detail,v=>{item.detail=v;changed();},{multi:true,max:1000}).wrap);
   const actions=el('div','','nal-account-actions');actions.append(button('위로',()=>{move(source.prepare,index,-1);changed();paintPrep();},true),button('아래로',()=>{move(source.prepare,index,1);changed();paintPrep();},true),
    button('항목 삭제',()=>{if(!confirm('이 준비 항목을 편집본에서 삭제할까요?'))return;source.prepare.splice(index,1);changed();paintPrep();},true));card.append(actions);prepList.append(card);
  });}
  prep.append(button('준비 항목 추가',()=>{if(source.prepare.length>=12)throw new Error('준비 항목은 최대 12개입니다.');source.prepare.push({id:'prep-'+crypto.randomUUID().slice(0,8),title:'',detail:''});changed();paintPrep();},true));paintPrep();form.append(prep);
  const faq=block('자주 묻는 질문'),faqList=el('div');faq.append(faqList);
  function paintFaq(){faqList.replaceChildren();source.faq.forEach((item,index)=>{const card=el('section','','nal-studio-card');card.append(field('질문',item.question,v=>{item.question=v;changed();},{max:200}).wrap,
   field('답변',item.answer,v=>{item.answer=v;changed();},{multi:true,max:1500}).wrap,button('질문 삭제',()=>{if(confirm('이 질문을 편집본에서 삭제할까요?')){source.faq.splice(index,1);changed();paintFaq();}},true));faqList.append(card);});}
  faq.append(button('질문 추가',()=>{if(source.faq.length>=12)throw new Error('질문은 최대 12개입니다.');source.faq.push({question:'',answer:''});changed();paintFaq();},true));paintFaq();form.append(faq);
  const actions=el('div','','nal-account-actions');actions.append(button('초안 저장',async c=>{
   if(busy)return;busy=true;const unlock=lock(area),snapshot=structuredClone(source);
   try{const result=await A.companion('studio-guide-save',slug,{revision,source:snapshot});if(current(c)){revision=result.revision;published=result.publishedRevision;dirty.guide=false;paintMeta();A.status('안내 초안을 저장했습니다. 공개본은 별도 승인합니다.','ok');}}
   finally{busy=false;unlock();publish.disabled=data.role!=='owner'||dirty.guide;}
  }),publish,A.link('/nal/shop/read/?season='+encodeURIComponent(slug),'현재 공개 상세 보기'));
  // Import affects only this editor, retaining the currently fetched save revision.
  // No network save/publish call is issued here and no other editor is rebuilt.
  importGuide=incoming=>{
   if(busy||!area.isConnected)throw new Error('안내 저장이 진행 중입니다. 완료 후 원고를 가져와 주세요.');
   dirty.guide=true;
   const next=guideEditor({...data,guide:{...data.guide,source:structuredClone(incoming),revision,publishedRevision:published}});
   area.replaceWith(next);const details=next.closest('details');if(details)details.open=true;
   next.scrollIntoView({block:'start',behavior:'auto'});
  };
  area.append(meta,form,actions);paintMeta();return area;
 }
 function planEditor(data){
  const area=block('이번 주 진행안'),editor=el('div');
  let plan=structuredClone(data.runbook.source||blankPlan()),revision=data.runbook.revision,state=data.runbook.state,
   sessionId=data.runbook.sessionId||'',busy=false;const heading='WEEK '+week+' · '+slug;
  let paintAgenda=()=>{},paintTiming=()=>{};const meta=el('p','','nal-account-meta');
  const mark=()=>{dirty.plan=true;meta.textContent='저장본 v'+revision+' · 현재 화면에 미저장 변경이 있습니다.';};
  function example(){
   if(plan.agenda.length&&!confirm('현재 진행안을 별도 편집용 60분 예시로 바꿀까요? READ 01의 90분 원고와 다른 예시입니다. 저장하기 전까지 서버 원본은 바뀌지 않습니다.'))return;
   const lines=[['자리에 도착하기',5,'오늘 이 자리에서 함께 살펴보고 싶은 것은 무엇인가요?'],['내 삶의 장면',10,'읽다가 멈춘 문장은 내 삶의 어떤 경험과 연결되나요?'],
    ['해본 일 돌아보기',15,'직접 해보니 무엇이 예상과 달랐나요?'],['질문으로 더 살펴보기',15,'지금 새롭게 묻게 된 질문은 무엇인가요?'],['작은 선택',10,'다음 주에 작게 해볼 한 가지는 무엇인가요?'],['한 문장 남기기',5,'오늘의 나에게 남길 문장은 무엇인가요?']];
   const previousDebrief=structuredClone(plan.debrief);
   plan={...blankPlan(),aim:'읽고 적은 내용에서 한 가지 알아차림과 작은 실험을 정합니다.',opening:lines[0][2],closing:lines[5][2],
    followUp:'참가자가 선택한 작은 실험과 마지막 한 문장을 각자의 기록에 남기도록 안내합니다.',
    agenda:lines.map(([title,minutes,prompt])=>({id:'part-'+crypto.randomUUID().slice(0,8),title,minutes,prompt,notes:'공유는 선택입니다. 말하지 않고 머무를 시간도 허용합니다.'})),debrief:previousDebrief};
   state='draft';mark();paint();
  }
  function paint(){
   editor.replaceChildren();const form=el('form','','nal-studio-form');form.addEventListener('submit',e=>e.preventDefault());
   const options=[['','LIVE 미연결 · 진행안만 작성'],...(data.liveSessions||[]).map(s=>[s.id,s.title+' · '+A.date(s.startsAt)+' · '+({published:'공개',draft:'초안',cancelled:'취소',archived:'보관'}[s.status]||s.status)])];
   const selection=select('이 진행안을 사용할 LIVE',options,sessionId,v=>{sessionId=v;mark();paintTiming();});form.append(selection.wrap);
   for(const [key,label]of [['aim','이번 주 대화의 목적'],['opening','시작 질문'],['closing','마치는 질문'],['followUp','대화 후 안내할 작은 실행']])form.append(field(label,plan[key],v=>{plan[key]=v;mark();},{multi:true}).wrap);
   const schedule=el('p','','nal-runbook-timing');schedule.setAttribute('aria-live','polite');
   paintTiming=()=>{const total=plan.agenda.reduce((sum,x)=>sum+(Number.isFinite(x.minutes)?x.minutes:0),0),session=data.liveSessions?.find(x=>x.id===sessionId);
    const actual=session?(Date.parse(session.endsAt)-Date.parse(session.startsAt))/60000:null;
    schedule.textContent='진행안 합계 '+timeText(total)+(session?' / 연결 LIVE '+timeText(actual)+' · 시작 '+A.date(session.startsAt):' · 실제 일정은 아직 연결하지 않았습니다.')+
     (actual!==null&&actual!==total?' · 진행안과 LIVE 길이가 다릅니다. 일정이나 원고를 별도로 조정해 주세요.':'');};
   const agenda=block('시간과 질문 순서'),list=el('div');agenda.append(schedule,list);
   paintAgenda=()=>{list.replaceChildren();plan.agenda.forEach((item,index)=>{
    const card=el('section','','nal-studio-card');card.append(el('p','순서 '+(index+1),'nal-account-kicker'));
    card.append(field('구간 이름',item.title,v=>{item.title=v;mark();},{max:120}).wrap);
    const min=field('진행 시간 (분)',item.minutes,v=>{item.minutes=Number(v);mark();paintTiming();},{type:'number'});min.input.min='1';min.input.max='120';min.input.step='1';card.append(min.wrap);
    card.append(field('화면에 보여줄 질문',item.prompt,v=>{item.prompt=v;mark();},{multi:true,max:1500}).wrap,
     field('진행자에게만 보이는 메모',item.notes,v=>{item.notes=v;mark();},{multi:true,max:2000}).wrap);
    const actions=el('div','','nal-account-actions');actions.append(button('위로',()=>{move(plan.agenda,index,-1);mark();paintAgenda();},true),button('아래로',()=>{move(plan.agenda,index,1);mark();paintAgenda();},true),
     button('구간 삭제',()=>{if(confirm('이 진행 구간을 삭제할까요?')){plan.agenda.splice(index,1);mark();paintAgenda();}},true));card.append(actions);list.append(card);
   });paintTiming();};paintAgenda();
   agenda.append(button('진행 구간 추가',()=>{if(plan.agenda.length>=20)throw new Error('진행 구간은 최대 20개입니다.');plan.agenda.push({id:'part-'+crypto.randomUUID().slice(0,8),title:'새 구간',minutes:5,prompt:'',notes:''});mark();paintAgenda();},true));form.append(agenda);
   const review=block('진행 뒤 운영 회고');review.append(el('p','운영 방식과 진행 흐름만 기록합니다. 참가자 이름·개인 답변·민감한 경험은 옮겨 적지 않습니다.','nal-account-note'));
   for(const [key,label]of [['observed','실제로 관찰한 진행 장면'],['adjust','다음에 바꿔볼 운영 방식'],['next','다음 주 준비할 일']])review.append(field(label,plan.debrief[key],v=>{plan.debrief[key]=v;mark();},{multi:true,max:3000}).wrap);
   form.append(review);
   const readiness=select('진행안 작성 상태',[['draft','작성 중'],['ready','진행안 작성 완료']],state,v=>{state=v;mark();});form.append(readiness.wrap);
   form.append(el('p','작성 완료 표시는 운영자의 준비 표시입니다. LIVE가 개최됐거나 검증을 통과했다는 뜻이 아닙니다.','nal-account-note'));
   const actions=el('div','','nal-account-actions');actions.append(button('진행안 저장',async c=>{
    if(busy)return;busy=true;const unlock=lock(area),snapshot=structuredClone(plan);
    try{const result=await A.companion('studio-plan-save',slug,{weekNumber:week,revision,sessionId:sessionId||null,state,source:snapshot});
     if(current(c)){revision=result.revision;state=result.state;dirty.plan=false;meta.textContent='저장본 v'+revision+' · '+(state==='ready'?'진행안 작성 완료':'작성 중');A.status('이번 주 진행안과 운영 회고를 저장했습니다.','ok');}}
    finally{busy=false;unlock();}
   }),button('질문만 발표용 보기',()=>presentation(plan,data.liveSessions?.find(s=>s.id===sessionId),heading),true),button('질문·시간표 텍스트 저장',()=>{
    const text=[heading,plan.aim,...plan.agenda.map((x,i)=>`${i+1}. ${x.title} (${x.minutes}분)\n${x.prompt}`),'마치는 질문',plan.closing,'다음 작은 실행',plan.followUp].join('\n\n');
    textDownload('NAL-'+slug+'-week-'+week+'-questions.txt',text);
   },true));form.append(actions);editor.append(form);
  }
  const generic=el('details','','nal-order-details');generic.append(el('summary','별도 편집용 60분 예시'),button('60분 예시 불러오기',example,true),el('p','READ 01은 위 원고 라이브러리의 90분 진행안을 사용합니다. 이 예시는 다른 구성으로 편집할 때 선택합니다. 실제 일정은 자동 변경하지 않습니다.','nal-account-note'));
  area.append(meta,generic,editor);
  meta.textContent='저장본 v'+revision+' · '+(state==='ready'?'진행안 작성 완료':'작성 중');paint();
  importPlan=incoming=>{
   if(busy||!area.isConnected)throw new Error('진행안 저장이 진행 중입니다. 완료 후 원고를 가져와 주세요.');
   // Never replace a facilitator's actual debrief with invented empty observations.
   const previousDebrief=structuredClone(plan.debrief);
   plan={...structuredClone(incoming),debrief:previousDebrief};state='draft';mark();paint();
   // sessionId and revision remain from this exact editor; schedule changes are not imported.
   area.scrollIntoView({block:'start',behavior:'auto'});
  };
  const material=block('이번 주 공개된 원고');material.append(el('p','참가자가 남긴 답이 아니라, 공개된 DAY 문장과 질문 원문입니다. 편집 중인 원고는 콘텐츠 편집 화면에서 확인합니다.','nal-account-note'));
  for(const day of data.days||[]){const details=el('details','','nal-order-details');details.append(el('summary','DAY '+String(day.dayNumber).padStart(2,'0')+' · '+day.title));
   for(const step of day.steps||[]){const block=el('section','','nal-studio-material');block.append(el('p',step.type+' · STEP '+step.order,'nal-account-kicker'));
    if(step.content)block.append(el('p',step.content,'nal-program-copy'));if(step.prompt)block.append(el('blockquote',step.prompt,'nal-program-copy'));
    if(step.prompt)block.append(button('이 질문을 진행안에 가져오기',()=>{if(plan.agenda.length>=20)throw new Error('진행 구간은 최대 20개입니다.');
     plan.agenda.push({id:'part-'+crypto.randomUUID().slice(0,8),title:'DAY '+day.dayNumber+' 질문',minutes:5,prompt:step.prompt,notes:'원고 출처: DAY '+day.dayNumber+' / STEP '+step.order});mark();paintAgenda();
    },true));details.append(block);
   }material.append(details);
  }
  if(!data.days?.length)material.append(el('p','이번 주 공개 원고가 아직 없습니다. 콘텐츠 편집 원고와 원고 라이브러리를 구분해서 사용하세요.','nal-account-empty'));
  area.append(material);return area;
 }
 async function render(){const ticket=++generation,c=context();closePresentation();dirty={guide:false,plan:false};importGuide=null;importPlan=null;
  if(!A.user){root.replaceChildren();root.hidden=true;return;}
  try{const index=await A.companion('studio-seasons',null);if(!current(c))return;
   root.replaceChildren();root.hidden=false;root.append(el('h2','이번 주 대화를 준비합니다.'),el('p','원고·진행안·운영 회고를 한곳에서 엽니다. 개인 답변을 분석하는 화면은 아닙니다.','nal-account-note'));
   if(!index.seasons.some(s=>s.slug===slug))slug='';if(!Number.isInteger(week)||week<1||week>4)week=1;
   const picker=select('시즌·기수',[['','시즌을 선택하세요'],...index.seasons.map(s=>[s.slug,s.title+(s.cohortLabel?' · '+s.cohortLabel:'')])],slug,value=>{
    if(!leave()){picker.input.value=slug;return;}slug=value;const u=new URL(location.href);u.search='';if(slug)u.searchParams.set('season',slug);u.searchParams.set('week',String(week));history.replaceState({},'',u.pathname+u.search);render();
   });
   const weeks=select('준비할 주차',[1,2,3,4].map(n=>[String(n),'WEEK '+n]),String(week),value=>{
    if(!leave()){weeks.input.value=String(week);return;}week=Number(value);const u=new URL(location.href);u.searchParams.set('week',String(week));history.replaceState({},'',u.pathname+u.search);render();
   });root.append(picker.wrap,weeks.wrap);
   const links=el('div','','nal-account-actions');links.append(A.link('/nal/read/admin/','콘텐츠 편집'),A.link('/nal/read/admin/cohorts/','기수·참가자 관리'));root.append(links);
   if(!slug){root.append(el('p','시즌을 선택하면 해당 주차의 공개 원고와 저장한 진행안을 불러옵니다.','nal-account-empty'));return;}
   const data=await A.companion('studio-get',slug,{weekNumber:week});if(ticket!==generation||!current(c))return;
   const info=(data.weeks||[]).find(w=>w.number===week);if(info)root.append(el('h2',info.title),el('p',info.subtitle||'','nal-account-note'));
   const library=el('section');root.append(library);
   const guide=el('details','','nal-order-details');guide.append(el('summary','프로그램 소개·시작 전 안내 편집'),guideEditor(data));root.append(guide,planEditor(data));
   window.NalReadStudioLibrary?.mount({root:library,seasonSlug:slug,weekNumber:week,
    isCurrent:()=>current(c)&&library.isConnected,
    applyGuide:value=>{if(!current(c)||!importGuide)throw new Error('시즌을 다시 열어주세요.');importGuide(value);guide.open=true;},
    applyPlan:value=>{if(!current(c)||!importPlan)throw new Error('주차를 다시 열어주세요.');importPlan(value);}
   });
   const history=el('details','','nal-order-details');history.append(el('summary','최근 저장·공개 기록'));
   for(const h of data.history||[])history.append(el('p',A.date(h.created_at)+' · '+(h.kind==='guide'?'시작 안내':'WEEK '+h.week_number+' 진행안')+' v'+h.revision+' · '+(h.event==='published'?'공개 승인':'저장'),'nal-account-meta'));root.append(history);
  }catch(e){if(current(c)&&e.name!=='AbortError')A.status(e.message,'error');}
 }
 window.addEventListener('beforeunload',e=>{if(hasDirty()){e.preventDefault();e.returnValue='';}});
 document.addEventListener('click',e=>{const target=e.target.closest('a[href],[data-account-signout]');if(target&&target.target!=='_blank'&&!leave()){e.preventDefault();e.stopImmediatePropagation();}},true);
 A.ready.then(ok=>{if(ok)render();});A.onChange(render);
})();
