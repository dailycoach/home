/* BUILD14. Read-only home projection. No polling, provider calls, read receipts or DAY starts. */
(() => {
 'use strict';
 const A=window.NalAccount;if(!A)return;const el=A.node;
 const SLUG=/^[a-z0-9-]{1,120}$/;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const sectionStates=new Set(['ready','disabled','unavailable','partial']);
 const phaseNames={prestart:'시작 전',active:'함께하는 중',ended:'운영 기간 종료',cancelled:'일정 취소',unscheduled:'일정 준비 중'};
 const reasons={read_release_off:'프로그램을 아직 열지 않았습니다.',read_test_scope_required:'현재 공개 대상이 아닙니다.',
  verified_identity_required:'로그인을 다시 확인해 주세요.',entitlement_inactive:'이용권 상태를 확인해 주세요.',
  entitlement_expired:'이용 기간이 끝났습니다.',enrollment_inactive:'참가권 상태를 확인해 주세요.',
  order_inactive:'주문 상태를 확인해 주세요.',season_unavailable:'시즌을 준비하고 있습니다.'};
 const text=(value,fallback='')=>typeof value==='string'?value:fallback;
 const count=value=>Number.isInteger(value)&&value>=0?value:null;
 const date=value=>Number.isFinite(Date.parse(value))?A.date(value):'일정 확인 필요';
 const rows=section=>Array.isArray(section?.items)?section.items:[];
 const good=s=>s&&sectionStates.has(s.state);
 const row=()=>el('div','','nal-account-actions');
 function block(title){const s=el('section','','nal-home-section');s.append(el('h2',title));return s;}
 function note(s,message){s.append(el('p',message,'nal-home-note'));}
 function status(s,data,empty){
  if(!good(data)||data.state==='unavailable'){note(s,'정보를 불러오지 못했습니다. 기록이 없다는 뜻은 아닙니다.');return false;}
  if(data.state==='disabled'){note(s,'이 기능은 연결 준비 중입니다.');return false;}
  if(data.state==='partial')note(s,'일부 프로그램의 정보는 불러오지 못했습니다. 표시된 일정만 먼저 확인해 주세요.');
  if(!rows(data).length){note(s,empty);return false;}return true;
 }
 function readLink(slug,view,label,extra={},primary=false){
  return SLUG.test(slug||'')?A.link(A.read(slug,view,extra),label,primary?'nal-account-button':'nal-account-link'):el('span','프로그램 주소 확인 필요','nal-home-note');
 }
 function nextLink(p,primary=true){
  if(!SLUG.test(p?.slug||''))return null;
  const next=p.next||{},cls=primary?'nal-account-button':'nal-account-link';
  if(p.state!=='ready'||p.allowed!==true)return A.link('/nal/my/?tab=programs','내 참가권 상태 확인',cls);
  if(next.kind==='prepare')return A.link('/nal/read/start/?season='+encodeURIComponent(p.slug),'시작 안내 확인하기',cls);
  if(next.kind==='day'&&Number.isInteger(next.dayNumber)&&next.dayNumber>=0&&next.dayNumber<=366){
   return readLink(p.slug,next.dayNumber===0?'before':'day',next.dayNumber===0?'지금의 나부터 남기기':'이어서 한 문장 남기기',next.dayNumber===0?{}:{day:next.dayNumber},primary);
  }
  if(next.kind==='archive')return readLink(p.slug,'my','내가 남긴 문장 읽기',{},primary);
  return readLink(p.slug,next.kind==='journey'?'journey':'today',next.kind==='journey'?'질문 여정 확인하기':'내 READ 열기',{},primary);
 }
 function program(p,hero=false){
  const s=el('article','',hero?'nal-home-current':'nal-home-program');
  s.append(el('p',text(p.label,text(p.title,'내 READ')),'nal-home-kicker'));
  if(p.state==='unavailable'){
   s.append(el(hero?'h1':'h3',text(p.title,'내 READ')));note(s,'이 프로그램의 이어갈 위치를 불러오지 못했습니다.');
  }else if(p.state==='restricted'){
   s.append(el(hero?'h1':'h3',text(p.title,'내 READ')));note(s,reasons[p.reason]||'참가권과 공개 상태를 확인해 주세요.');
  }else{
   let heading=p.next?.kind==='day'?text(p.next.title,'오늘의 질문'):p.phase==='prestart'?'시작 전, 내 자리를 준비합니다.':p.phase==='cancelled'?'운영 안내를 확인해 주세요.':p.next?.kind==='archive'?'남긴 문장을 다시 읽습니다.':text(p.title,'내 READ');
   s.append(el(hero?'h1':'h3',heading,hero?'nal-home-question':''));
   const meta=[];
   if(p.next?.kind==='day')meta.push(p.next.dayNumber===0?'BEFORE':'DAY '+String(p.next.dayNumber).padStart(2,'0'));
   else if(phaseNames[p.phase])meta.push(phaseNames[p.phase]);
   if(Number.isInteger(p.next?.minutes)&&p.next.minutes>0)meta.push('예상 '+p.next.minutes+'분');
   if(count(p.recordedDays)!==null)meta.push('기록한 DAY '+p.recordedDays+'개');
   if(meta.length)s.append(el('p',meta.join(' · '),'nal-home-meta'));
   if(p.phase==='prestart')note(s,'시작 '+date(p.startsAt)+' (한국 시간). 시작 전에는 준비 안내를 확인하세요.');
   if(p.phase==='ended')note(s,'운영 기간 종료와 완주는 다릅니다. 현재 이용권 범위에서 기록을 읽을 수 있습니다.');
   if(p.phase==='cancelled')note(s,'일정 취소는 결제 취소·환불 완료를 뜻하지 않습니다.');
  }
  const actions=row(),next=nextLink(p,hero);if(next)actions.append(next);
  if(p.allowed===true&&p.state==='ready')actions.append(readLink(p.slug,'my','내 문장'),readLink(p.slug,'report','내 리포트'));
  s.append(actions);return s;
 }
 function programs(section,displayName){
  const root=block('오늘, 이어갈 자리');
  if(!good(section)||section.state!=='ready'){
   const heading=el('h1',displayName?displayName+'님, 다시 만나 반갑습니다.':'다시 만나 반갑습니다.','nal-home-question');root.append(heading);
   status(root,section,'아직 참여한 READ가 없습니다.');root.append(A.link('/nal/my/?tab=programs','내 READ 목록'));return root;
  }
  const items=rows(section);
  if(!items.length){root.append(el('h1','한 문장부터 시작해볼까요?','nal-home-question'));
   note(root,'아직 이 계정에 연결된 READ가 없습니다. 프로그램을 살펴보거나 이미 구매한 내역을 확인하세요.');
   const actions=row();actions.append(A.link('/nal/read/cohorts/','참여할 기수 보기','nal-account-button'),A.link('/nal/my/?tab=files','구매한 자료'),A.link('/nal/my/?tab=orders','기존 주문 확인'));root.append(actions);return root;
  }
  const selected=items.find(p=>p.allowed===true&&p.state==='ready'&&p.next?.kind==='day')
   ||items.find(p=>p.allowed===true&&p.state==='ready'&&p.phase==='prestart')
   ||items.find(p=>p.allowed===true&&p.state==='ready')||items[0];
  root.append(program(selected,true));
  const others=items.filter(p=>p.enrollmentId!==selected.enrollmentId);
  if(others.length){const d=el('details','','nal-home-other-programs');d.append(el('summary','다른 READ '+others.length+'개 펼치기'));for(const p of others)d.append(program(p));root.append(d);}
  if(section.limited)note(root,'우선순위에 따라 최대 '+section.limit+'개 기수만 불러왔습니다. 전체 참여 내역은 내 READ 목록에서 확인하세요.');
  root.append(A.link('/nal/my/?tab=programs','전체 내 READ'));return root;
 }
 function live(section){const s=block('다가오는 LIVE');
  if(status(s,section,section?.state==='partial'?'확인된 범위에 예정된 LIVE가 없습니다.':'불러온 READ 중 앞으로의 LIVE 일정이 없습니다.')){
   for(const item of rows(section)){const a=el('article','','nal-home-line');
    a.append(el('p',text(item.cohortLabel,text(item.programTitle,'내 READ')),'nal-home-kicker'),el('h3',text(item.title,'LIVE')),
     el('p',date(item.startsAt)+' — '+date(item.endsAt)+' (한국 시간)','nal-home-meta'));
    if(item.stage==='in_progress')note(a,'조회한 시각에는 진행 중인 일정입니다.');
    if(item.stage==='opening')note(a,'조회한 시각에는 입장 안내를 확인할 수 있는 시간입니다.');
    a.append(readLink(item.slug,'live','LIVE 일정·입장 확인'));s.append(a);
   }
  }
  if(section?.limited)note(s,'홈에 불러온 기수 중 가까운 일정 최대 5개입니다. 각 READ의 LIVE에서 전체 일정을 확인하세요.');
  note(s,'홈에서는 접속 주소를 가져오지 않습니다. LIVE 화면에서 현재 접근 권한과 입장 시간을 확인합니다.');return s;
 }
 function inbox(data){const s=block('확인할 소식');
  const support=block('운영자가 남긴 답변'),d=data.support;
  if(good(d)&&d.state==='ready'&&count(d.unreadThreads)!==null)note(s,'읽지 않은 답변이 있는 문의 '+d.unreadThreads+'건');
  if(status(support,d,'읽지 않은 운영자 답변이 없습니다.'))for(const item of rows(d)){
   if(!UUID.test(item.id||''))continue;const line=el('article','','nal-home-line');line.append(A.link('/nal/my/help/?id='+item.id,text(item.subject,'내 문의')),el('p',date(item.updatedAt),'nal-home-meta'));support.append(line);
  }
  if(d?.limited)note(support,'최근 답변 5건을 표시합니다. 나머지는 내 문의에서 확인하세요.');
  support.append(A.link('/nal/my/help/','내 문의 전체 보기'));s.append(support);
  const waiting=block('대기 중 열리는 참여 기회'),w=data.waitlist;
  if(good(w)&&w.state==='ready'&&count(w.waitingCount)!==null)note(waiting,'대기 중 '+w.waitingCount+'건 · 확인 가능한 제안 '+w.offeredCount+'건');
  if(status(waiting,w,'현재 기한이 남은 참여 제안이 없습니다.'))for(const item of rows(w)){
   if(!SLUG.test(item.slug||''))continue;const line=el('article','','nal-home-line');line.append(el('h3',text(item.label,text(item.title,'내 대기 신청'))),el('p','확인 기한 '+date(item.offerUntil),'nal-home-meta'),A.link('/nal/my/waitlist/?season='+encodeURIComponent(item.slug),'참여 기회 확인'));waiting.append(line);
  }
  note(waiting,'제안 확인은 참가 확정이나 자동 결제가 아닙니다.');waiting.append(A.link('/nal/my/waitlist/','내 대기 신청'));s.append(waiting);
  const orders=block('먼저 확인할 주문'),o=data.orders;
  if(status(orders,o,'현재 기록된 상태에서 확인이 필요한 READ 주문이 없습니다.'))for(const item of rows(o)){
   if(!UUID.test(item.id||''))continue;const line=el('article','','nal-home-line');
   const label=item.state==='paid'?'결제 확인 · 참가권 연결 상태 확인':item.state==='pending'?'결제 상태 확인 필요':item.state==='partially_refunded'?'부분 환불 · 이용 범위 확인':'운영자 확인 필요';
   line.append(el('h3',text(item.title,'내 주문')),el('p',label,'nal-home-meta'),A.link('/nal/my/payments/?order='+item.id,'기존 주문 확인'));
   note(line,item.lastCheckedAt?'마지막 결제 조회 '+date(item.lastCheckedAt):'아직 결제사 조회 시각이 없습니다.');orders.append(line);
  }
  note(orders,'기록된 상태만 표시합니다. 홈을 열었다고 결제를 조회·승인하지 않습니다. 불명확하면 다시 결제하지 말고 기존 주문을 확인하세요.');
  orders.append(A.link('/nal/my/payments/','내 READ 주문'));s.append(orders);return s;
 }
 function operator(role){
  if(!['owner','operator'].includes(role))return null;const d=el('details','','nal-home-operator');d.append(el('summary',role==='owner'?'운영자 작업 열기':'배정받은 운영 작업 열기'));
  const actions=row();actions.append(A.link('/nal/read/admin/studio/','주차별 진행 준비'),A.link('/nal/read/admin/','콘텐츠 편집'),A.link('/nal/read/admin/support/','운영자 문의함'));
  if(role==='owner')actions.append(A.link('/nal/read/admin/cohorts/','기수·참가자'),A.link('/nal/read/admin/offers/','참가상품'),A.link('/nal/read/admin/payments/','주문·참가권'));
  d.append(actions,el('p','메뉴는 이동 경로입니다. 실제 작업은 각 화면에서 현재 권한을 다시 확인합니다.','nal-home-note'));return d;
 }
 function mount(container,{isCurrent=()=>true}={}){
  let disposed=false,requestId=0,loading=false,hasSnapshot=false;
  const overview=el('div','','nal-home-overview'),toolbar=row(),stamp=el('p','','nal-home-meta'),feedback=el('p','','nal-home-feedback'),body=el('div');
  feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
  const refresh=el('button','지금 상태 다시 불러오기','nal-account-link');refresh.type='button';toolbar.append(refresh,stamp);overview.append(toolbar,feedback,body);container.append(overview);
  async function load(){
   if(loading||disposed||!isCurrent())return;loading=true;refresh.disabled=true;overview.setAttribute('aria-busy','true');
   const id=++requestId,epoch=A.epoch;feedback.textContent=hasSnapshot?'마지막 화면을 유지하며 새 상태를 불러옵니다.':'내가 이어갈 자리를 불러옵니다.';
   const alive=()=>!disposed&&id===requestId&&epoch===A.epoch&&isCurrent();
   try{
    const data=await A.call('account','home',{});if(!alive())return;
    if(data?.version!==14||!good(data.programs)||!good(data.live)||!good(data.support)||!good(data.waitlist)||!good(data.orders))throw new Error('홈 연결 코드와 서버 정보를 맞추고 있습니다. 아래 기존 메뉴는 따로 열 수 있습니다.');
    body.replaceChildren();const name=data.profile?.state==='ready'?text(data.profile.displayName):'';
    body.append(programs(data.programs,name));
    const grid=el('div','','nal-home-grid');grid.append(live(data.live),inbox(data));body.append(grid);
    const staff=operator(data.profile?.state==='ready'?data.profile.staffRole:null);if(staff)body.append(staff);
    stamp.textContent='불러온 시각 '+date(data.serverTime)+' · 자동 갱신하지 않습니다.';
    hasSnapshot=true;feedback.textContent='';
   }catch(e){if(!alive())return;
    feedback.textContent=(hasSnapshot?'이전 조회 화면입니다. 현재 상태는 다시 확인해야 합니다. ':'')+(e.name==='AbortError'?'응답을 받지 못했습니다. 다시 불러와 주세요.':e.message);
    if(!hasSnapshot){body.replaceChildren();const recovery=row();recovery.append(A.link('/nal/my/?tab=programs','내 READ 목록'),A.link('/nal/my/?tab=files','구매 자료'),A.link('/nal/my/help/','내 문의'),A.link('/nal/help/','이용 도움말'));body.append(recovery);}
   }finally{loading=false;if(alive()){refresh.disabled=false;overview.setAttribute('aria-busy','false');}}
  }
  function visible(){if(document.visibilityState==='visible'&&hasSnapshot&&!loading&&!disposed&&isCurrent())feedback.textContent='다시 돌아왔습니다. 일정이나 답변이 바뀌었을 수 있으니 필요한 경우 새로 불러와 주세요.';}
  refresh.addEventListener('click',load);document.addEventListener('visibilitychange',visible);load();
  return()=>{disposed=true;requestId++;document.removeEventListener('visibilitychange',visible);};
 }
 window.NalAccountOverview={mount};
})();
