/* BUILD17: read-only operator starting point. No mutations, polling, approvals or private answer reads. */
(() => {
 'use strict';
 const A=window.NalAccount,root=document.querySelector('[data-account-private]');if(!A||!root)return;
 const el=A.node,SLUG=/^[a-z0-9-]{1,120}$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const routes={home:'/nal/read/admin/home/',editor:'/nal/read/admin/',studio:'/nal/read/admin/studio/',
  cohorts:'/nal/read/admin/cohorts/',offers:'/nal/read/admin/offers/',payments:'/nal/read/admin/payments/',support:'/nal/read/admin/support/'};
 const stateLabels={draft:'초안',review:'편집 검토 중',approved:'승인됨',published:'콘텐츠 반영됨',ready:'진행안 작성 완료',
  recruiting:'모집 중',paused:'모집 일시정지',closed:'모집 마감',cancelled:'운영 취소',listed:'소개 공개',accepting:'신청 허용',archived:'보관'};
 const query=new URLSearchParams(location.search);
 let season=query.get('season')||'',week=/^[1-4]$/.test(query.get('week')||'')?Number(query.get('week')):1;
 let search='',offset=0,generation=0,disposed=()=>{};
 const count=v=>Number.isInteger(v)&&v>=0?String(v):'확인 필요';
 const text=(v,fallback='')=>typeof v==='string'?v:fallback;
 const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?A.date(v):'미정';
 const row=()=>el('div','','nal-account-actions');
 function note(parent,message){parent.append(el('p',message,'nal-ops-note'));}
 function block(title){const s=el('section','','nal-ops-block');s.append(el('h2',title));return s;}
 function link(kind,label,params={},primary=false){
  const u=new URL(routes[kind],location.origin);
  for(const [key,value]of Object.entries(params))if(value!==null&&value!==undefined&&value!=='')u.searchParams.set(key,String(value));
  return A.link(u.pathname+u.search,label,primary?'nal-account-button':'nal-account-link');
 }
 function studio(label,n=week,primary=false){return link('studio',label,{season,week:n},primary);}
 function current(ctx){return ctx.generation===generation&&ctx.epoch===A.epoch&&ctx.userId===A.user?.id;}
 function address(){const u=new URL(routes.home,location.origin);if(season)u.searchParams.set('season',season);u.searchParams.set('week',String(week));history.replaceState({},'',u.pathname+u.search);}
 function availability(parent,data){
  const descriptions={not_selected:'기수를 선택하면 이 영역을 볼 수 있습니다.',disabled:'이 기능의 연결은 아직 열리지 않았습니다.',
   restricted:'이 영역은 소유자 권한으로 확인합니다.',unavailable:'정보를 불러오지 못했습니다. 작성된 기록이 없다는 뜻은 아닙니다.'};
  if(data?.state==='ready')return true;
  note(parent,descriptions[data?.state]||descriptions.unavailable);return false;
 }
 function stat(parent,label,value){const line=el('p','','nal-ops-fact');line.append(el('span',label),el('strong',String(value)));parent.append(line);}
 function directory(role){
  const s=block('작업 공간');const links=row();
  links.append(link('editor','시즌·DAY 원고'),studio('주차별 진행안·안내문'),link('support',role==='owner'?'전체 문의함':'배정된 문의함'));
  if(role==='owner')links.append(link('cohorts','기수·참가자'),link('offers','상품·참여 조건'),link('payments','주문·참가권'));
  s.append(links);note(s,'진행자 스튜디오는 선택한 시즌·주차로 열립니다. 원고·기수·상품 목록에서는 화면 안에서 해당 시즌을 선택하세요.');return s;
 }
 function workOrder(){
  const d=el('details','','nal-ops-guide');d.append(el('summary','첫 기수 작업 순서'));
  const list=el('ol');
  for(const [title,copy,kind]of [
   ['원고','시즌·DAY 질문을 작성하고 편집 검토와 공개 상태를 구분합니다.','editor'],
   ['참여 조건','카탈로그 상품과 참여 안내, 모집 기간을 연결합니다.','offers'],
   ['기수','운영 일정과 정원을 확인합니다. 모집 취소는 결제 환불과 다릅니다.','cohorts'],
   ['시작 안내','소개·읽기·준비 안내를 초안으로 작성한 뒤 별도로 공개 승인합니다.','studio'],
   ['주차별 LIVE','실제 LIVE 일정과 진행안을 연결합니다. 작성 완료는 개최나 출석 확인이 아닙니다.','studio'],
   ['참여 지원','문의에 답하고 참가권 상태를 확인합니다. 결제 실행은 기존 결제사 경로에서 처리합니다.','support']]){
    const li=el('li');li.append(el('h3',title),el('p',copy));list.append(li);
   }
  d.append(list);note(d,'이 순서는 작업 길잡이입니다. 홈 조회로 어떤 항목도 저장·승인·공개하지 않습니다. 테스트 통과나 판매 준비 완료 점수로 표시하지 않습니다.');return d;
 }
 function content(data){
  const s=block('시즌 원고');
  if(availability(s,data)){
   stat(s,'편집 원고',data.documentExists?(stateLabels[data.editorialState]||'상태 확인'):'아직 저장하지 않음');
   if(data.documentExists)stat(s,'버전','편집 v'+count(data.revision)+' / 반영 '+(Number.isInteger(data.publishedRevision)?'v'+data.publishedRevision:'없음'));
   stat(s,'참가자용 DAY',count(data.publishedDays)+' / '+count(data.expectedDays)+'개');
   stat(s,'BEFORE',data.beforePublished===true?'콘텐츠 반영됨':'아직 반영되지 않음');
   if(Array.isArray(data.missingDays)&&data.missingDays.length){const detail=el('details');detail.append(el('summary','아직 반영되지 않은 DAY'),el('p',data.missingDays.map(n=>'DAY '+String(n).padStart(2,'0')).join(' · ')));s.append(detail);}
   note(s,'콘텐츠 상태만 표시합니다. 실제 참가자 접근이나 질문의 품질을 검증한 결과가 아닙니다.');
  }
  s.append(link('editor','원고 목록에서 이어 쓰기'));return s;
 }
 function guide(data){
  const s=block('소개·시작 안내');
  if(availability(s,data)){
   stat(s,'편집본',data.exists?'v'+count(data.revision):'아직 저장하지 않음');
   stat(s,'공개본',Number.isInteger(data.publishedRevision)?'v'+data.publishedRevision:'아직 없음');
   if(data.hasUnpublishedChanges)note(s,'현재 편집본과 공개본이 다릅니다. 미공개 수정 내용을 스튜디오에서 확인하세요.');
   note(s,'저장과 공개는 별도입니다. 기존 공개본은 다음 공개 승인을 하기 전까지 유지됩니다.');
  }
  s.append(studio('안내문 편집으로'));return s;
 }
 function cohort(data){
  const s=block('기수·모집');if(!availability(s,data))return s;
  if(!data.configured)note(s,'기수 일정과 정원이 아직 설정되지 않았습니다.');
  else{
   s.append(el('h3',text(data.label,'선택 기수')));stat(s,'운영 시작',date(data.startsAt));stat(s,'운영 종료',date(data.endsAt));
   stat(s,'모집 상태',stateLabels[data.recruitmentState]||'상태 확인');stat(s,'상품 신청 상태',stateLabels[data.offerState]||'설정 확인');
   stat(s,'모집 마감',data.registrationEndsAt?date(data.registrationEndsAt):'별도 마감일 미설정');
   stat(s,'정원 / 사용·예약',count(data.capacity)+'명 / '+count(data.occupied)+'명');
   stat(s,'등록 / 대기',count(data.enrolled)+'명 / '+count(data.waiting)+'명');
   note(s,'등록·예약·대기는 다릅니다. 홈에서 자리를 제안하거나 참가자를 추가하지 않습니다.');
  }
  const links=row();links.append(link('cohorts','기수·참가자 관리'),link('offers','상품·모집 기간 확인'));s.append(links);return s;
 }
 function plans(data,serverTime){
  const s=block('4주 진행 준비');if(!availability(s,data))return s;
  if(!Array.isArray(data.weeks)||data.weeks.length!==4){note(s,'주차별 응답을 확인하지 못했습니다. 빈 진행안으로 간주하지 않습니다.');return s;}
  const selector=el('nav','','nal-ops-weeks');selector.setAttribute('aria-label','준비할 주차');
  for(let n=1;n<=4;n++){
   const b=el('button','WEEK '+n,'nal-account-link');b.type='button';if(n===week)b.setAttribute('aria-current','page');
   b.addEventListener('click',()=>{week=n;address();render();});selector.append(b);
  }s.append(selector);
  const active=data.weeks.find(w=>w.weekNumber===week);
  const selected=el('article','','nal-ops-current');selected.append(el('p','선택한 주차 · WEEK '+week,'nal-account-kicker'));
  if(active){
   selected.append(el('h3',active.exists?(stateLabels[active.planState]||'작성 상태 확인'):'진행안 작성 전'));
   if(active.exists)stat(selected,'진행안 버전','v'+count(active.revision));
   if(active.agendaMinutes!==null)stat(selected,'계획한 시간',count(active.agendaMinutes)+'분');
   if(active.sessionId){
    const matches=active.selectedMatchesWeek===true;
    note(selected,matches?'연결된 LIVE: '+date(active.selectedStartsAt)+' · '+(stateLabels[active.selectedSessionState]||'일정 확인'):'연결된 LIVE와 기수가 맞지 않습니다. 스튜디오에서 다시 확인하세요.');
    const scheduled=(Date.parse(active.selectedEndsAt)-Date.parse(active.selectedStartsAt))/60000;
    if(matches&&Number.isFinite(scheduled)&&Number.isFinite(active.agendaMinutes)&&scheduled!==active.agendaMinutes)note(selected,'진행안 '+active.agendaMinutes+'분과 실제 LIVE '+scheduled+'분이 다릅니다.');
   }else note(selected,'진행안과 실제 LIVE가 아직 연결되지 않았습니다.');
  }
  selected.append(studio('WEEK '+week+' 진행안 열기',week,true));s.append(selected);
  const schedule=[];
  for(const w of data.weeks){const r=el('article','','nal-ops-week-line');r.append(el('h3','WEEK '+w.weekNumber),el('p',w.exists?(stateLabels[w.planState]||'확인 필요'):'작성 전'),studio('이 주차 준비',w.weekNumber));s.append(r);
   for(const session of Array.isArray(w.sessions)?w.sessions:[])if(session.state==='published'&&Date.parse(session.endsAt)>Date.parse(serverTime))schedule.push({...session,weekNumber:w.weekNumber});
  }
  schedule.sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
  const next=schedule[0];if(next){const meeting=block('가장 가까운 공개 LIVE');meeting.append(el('h3',text(next.title,'LIVE')),el('p',date(next.startsAt)+' — '+date(next.endsAt)+' (한국 시간)'),studio('이 대화 준비하기',next.weekNumber));s.append(meeting);}
  else note(s,'선택 기수에 앞으로의 공개 LIVE가 없습니다. 초안 일정은 스튜디오·원고 편집에서 확인하세요.');
  note(s,'작성 완료는 진행자의 표시이며 실제 개최·출석·검증 완료와 다릅니다. 홈에는 질문 본문·내부 메모·Zoom 주소를 가져오지 않습니다.');return s;
 }
 function support(data){const s=block('답변이 필요한 문의');
  if(availability(s,data)){
   stat(s,'답변 대기',count(data.openCount)+'건');
   note(s,data.scope==='selected_season_only'?'선택한 기수에 연결된 문의입니다. 기수를 해제하면 일반 문의도 함께 확인합니다.':'기수 미선택: 접근 가능한 전체 기수·일반 문의를 표시합니다.');
   if(data.permissionScope==='assigned_only')note(s,'현재 운영자에게 배정된 문의만 포함합니다.');
   for(const t of Array.isArray(data.items)?data.items:[]){if(!UUID.test(t.id||''))continue;const r=el('article','','nal-ops-message');r.append(link('support',text(t.subject,'문의'),{id:t.id}),el('p',date(t.updatedAt),'nal-ops-note'));s.append(r);}
   if(Number.isInteger(data.openCount)&&data.openCount>5)note(s,'오래 기다린 문의부터 5건입니다. 전체 목록은 문의함에서 확인하세요.');
  }
  s.append(link('support','문의함 열기'));return s;
 }
 function orders(data){const s=block('확인이 필요한 READ 주문');if(availability(s,data)){
  stat(s,'기록된 확인 대상',count(data.attentionCount)+'건');note(s,'선택 기수의 마지막 저장 상태입니다. 결제사를 조회하거나 환불·참가권 재처리를 실행하지 않습니다.');
 }s.append(link('payments','주문·참가권 화면 열기'));return s;}
 function nextWork(data){
  const tasks=[],c=data.content,g=data.guide,co=data.cohort,p=data.plans;
  if(data.role==='owner'&&co?.state==='ready'&&!co.configured)tasks.push(['기수 일정·정원을 정해주세요.',link('cohorts','기수 설정으로')]);
  if(c?.state==='ready'&&(!c.documentExists||c.editorialState!=='published'||c.missingDays?.length||!c.beforePublished))tasks.push(['원고 편집·반영 상태를 확인해주세요.',link('editor','원고 편집으로')]);
  if(g?.state==='ready'&&(!g.exists||!g.publishedRevision||g.hasUnpublishedChanges))tasks.push(['시작 안내의 편집본·공개본을 확인해주세요.',studio('안내문 편집으로')]);
  if(p?.state==='ready'){
   const w=p.weeks?.find(x=>x.weekNumber===week);
   if(w&&(!w.exists||w.planState!=='ready'||!w.sessionId||!w.selectedMatchesWeek||w.selectedSessionState!=='published'))tasks.push(['WEEK '+week+' 진행안과 LIVE를 연결해주세요.',studio('선택 주차 준비')]);
  }
  if(data.support?.state==='ready'&&data.support.openCount>0)tasks.push(['운영자 답변을 기다리는 문의가 있습니다.',link('support','문의 답변하기')]);
  if(data.role==='owner'&&data.orders?.state==='ready'&&data.orders.attentionCount>0)tasks.push(['확인이 필요한 주문 기록이 있습니다.',link('payments','주문 상태 확인')]);
  const box=block('여기서 이어갈 작업');
  if(!tasks.length)note(box,'현재 조회 범위에서 우선 안내할 항목이 없습니다. 누락된 연결과 실제 운영 준비를 모두 확인했다는 뜻은 아닙니다.');
  for(const [message,a]of tasks){const r=el('article','','nal-ops-next');r.append(el('p',message),a);box.append(r);}return box;
 }
 function renderData(container,data,ctx){
  container.replaceChildren();const top=block('운영할 시즌·기수');
  const form=el('form','','nal-ops-search'),label=el('label','시즌 제목·주소 찾기'),input=el('input');input.type='search';input.maxLength=120;input.value=search;label.append(input);
  const submit=el('button','찾기','nal-account-button');submit.type='submit';form.append(label,submit);form.addEventListener('submit',e=>{e.preventDefault();search=input.value.trim();offset=0;render();});top.append(form);
  if(data.library?.state==='ready'&&Array.isArray(data.library.items)){
   const picker=el('select'),wrap=el('label','작업할 시즌');picker.setAttribute('aria-label','작업할 시즌');const empty=el('option','기수 미선택 · 문의 전체 보기');empty.value='';picker.append(empty);
   const list=data.library.items.slice(0,50);
   if(data.selected&&!list.some(s=>s.slug===data.selected.slug))list.unshift(data.selected);
   for(const item of list){if(!SLUG.test(item.slug||''))continue;const o=el('option',text(item.title,item.slug)+' · '+item.slug);o.value=item.slug;picker.append(o);}
   picker.value=season;picker.addEventListener('change',()=>{season=picker.value;address();render();});wrap.append(picker);top.append(wrap);
   const pagination=row();if(offset>0){const prev=el('button','이전 50개','nal-account-link');prev.type='button';prev.addEventListener('click',()=>{offset=Math.max(0,offset-50);render();});pagination.append(prev);}
   if(data.library.items.length>50){const next=el('button','다음 50개','nal-account-link');next.type='button';next.addEventListener('click',()=>{offset+=50;render();});pagination.append(next);}
   top.append(pagination);note(top,'검색 조건에 맞는 시즌 '+count(data.library.total)+'개 · 목록은 50개씩 표시합니다.');
   if(!data.library.items.length)note(top,'이 검색 조건에 맞는 시즌이 없습니다. 새 시즌 작성은 기존 원고 편집에서 진행합니다.');
  }else availability(top,data.library);
  container.append(top);
  if(data.selected){const h=el('h1',text(data.selected.title,'선택한 시즌'),'nal-ops-heading');container.append(h,el('p',text(data.selected.slug),'nal-account-kicker'),nextWork(data));
   const grid=el('div','','nal-ops-grid');grid.append(content(data.content),guide(data.guide));if(data.role==='owner')grid.append(cohort(data.cohort));container.append(grid,plans(data.plans,data.serverTime));
  }else note(container,'시즌을 선택하면 원고·시작 안내·4주 진행안의 상태를 한곳에서 확인할 수 있습니다.');
  container.append(support(data.support));if(data.role==='owner'&&data.selected)container.append(orders(data.orders));
  container.append(directory(data.role),workOrder());
 }
 async function render(){
  ++generation;disposed();disposed=()=>{};
  root.replaceChildren();if(!A.user){root.hidden=true;return;}root.hidden=false;
  const ctx={generation,epoch:A.epoch,userId:A.user.id};
  const feedback=el('p','','nal-ops-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  const toolbar=row(),refresh=el('button','운영 상태 다시 불러오기','nal-account-link'),stamp=el('p','','nal-ops-note'),contentRoot=el('div');refresh.type='button';toolbar.append(refresh,stamp);root.append(toolbar,feedback,contentRoot);
  let loading=false,snapshot=false;
  async function load(){
   if(loading||!current(ctx))return;loading=true;refresh.disabled=true;contentRoot.inert=true;root.setAttribute('aria-busy','true');feedback.textContent='기록된 운영 정보를 불러오고 있습니다.';
   try{
    if(season&&!SLUG.test(season))throw new Error('시즌 주소를 확인해 주세요.');
    const data=await A.call('account','operator-home',{seasonSlug:season||null,search,offset});if(!current(ctx))return;
    if(data?.version!==17||!['owner','operator'].includes(data.role)||!data.library||!data.support)throw new Error('운영 홈 화면과 서버 연결 버전을 맞추고 있습니다.');
    renderData(contentRoot,data,ctx);snapshot=true;feedback.textContent='';stamp.textContent='조회 '+date(data.serverTime)+' · 자동 갱신하지 않습니다.';
   }catch(error){
    if(!current(ctx))return;
    // Do not retain privileged snapshots after lost membership/assignment authorization.
    if(error.status===401||error.status===403){contentRoot.replaceChildren();snapshot=false;stamp.textContent='';}
    feedback.textContent=(snapshot?'이전 조회 결과입니다. 현재 상태는 다시 확인해야 합니다. ':'')+(error.name==='AbortError'?'응답을 받지 못했습니다. 기록이 없는 것으로 판단하지 않습니다.':error.message);
    if(!snapshot){contentRoot.replaceChildren();const recovery=row();recovery.append(A.link('/nal/my/','내 계정으로'),A.link('/nal/help/','이용 도움말'));contentRoot.append(recovery);}
   }finally{loading=false;if(current(ctx)){contentRoot.inert=false;root.setAttribute('aria-busy','false');refresh.disabled=false;}}
  }
  refresh.addEventListener('click',load);
  function visible(){if(current(ctx)&&snapshot&&!loading&&document.visibilityState==='visible')feedback.textContent='다른 작업에서 돌아왔습니다. 변경한 내용은 다시 불러오기로 확인하세요.';}
  document.addEventListener('visibilitychange',visible);disposed=()=>document.removeEventListener('visibilitychange',visible);
  await load();
 }
 A.ready.then(ok=>{if(ok)render();});A.onChange(render);
 window.addEventListener('popstate',()=>{const q=new URLSearchParams(location.search);season=q.get('season')||'';week=/^[1-4]$/.test(q.get('week')||'')?Number(q.get('week')):1;render();});
})();
