const META = window.KOUM_META;
const SESSIONS = window.KOUM_SESSIONS;
const $ = id => document.getElementById(id);
const root = document.documentElement;
const body = document.body;
const card = $("card");
const progress = $("progress");
const total = $("total");
const cardProgressText = $("cardProgressText");
const badge = $("badge");
const badgeText = $("badgeText");
const welcome = $("welcome");
const questionView = $("questionView");
const questionText = $("questionText");
const metaView = $("metaView");
const metaKicker = $("metaKicker");
const metaTitle = $("metaTitle");
const metaBody = $("metaBody");
const errorBox = $("errorBox");
const errorText = $("errorText");
const btnStart = $("btnStart");
const btnNext = $("btnNext");
const btnSkip = $("btnSkip");
const btnDone = $("btnDone");
const guideOverlay = $("guideOverlay");
const guideBadgeText = $("guideBadgeText");
const guideTitle = $("guideTitle");
const guideSub = $("guideSub");
const guideBody = $("guideBody");
const btnGuideAction = $("btnGuideAction");
const moveOverlay = $("moveOverlay");
const moveText = $("moveText");
const btnCancelMove = $("btnCancelMove");
const btnConfirmMove = $("btnConfirmMove");
let running = false;
let sessionIndex = 0;
let deck = [];
let pointer = 0;
let shownCount = 0;
let phase = "WELCOME";
let moveOpen = false;
let guideOpen = false;
let skippedAny = false;
let navLocked = false;
let guideTimerIds = [];
let guideAction = null;
function applyTheme(meta) {
  root.style.setProperty("--bgA", meta.bgA);
  root.style.setProperty("--bgB", meta.bgB);
  root.style.setProperty("--bgC", meta.bgC);
  root.style.setProperty("--accent", meta.accent);
  root.style.setProperty("--accentRgb", meta.accentRgb);
}
function currentSession() { return SESSIONS[sessionIndex] || null; }
function shuffle(list) {
  const a = list.slice();
  for(let i=a.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function validOrder(items,lastDepth,lastDomain) {
  if(!items.length) return true;
  if(lastDepth>=3 && items[0].depth>=3) return false;
  if(lastDomain && items[0].domain===lastDomain) return false;
  for(let i=1;i<items.length;i++) {
    if(items[i-1].depth>=3 && items[i].depth>=3) return false;
  }
  return true;
}
function arrangeRound(items,lastDepth,lastDomain) {
  let candidate=items.slice();
  for(let attempt=0;attempt<120;attempt++) {
    candidate=shuffle(items);
    if(validOrder(candidate,lastDepth,lastDomain)) return candidate;
  }
  return candidate.sort((a,b)=>a.depth-b.depth);
}
function buildBalancedDeck(session) {
  const groups={};
  session.questions.forEach(item=>{
    if(!groups[item.domain]) groups[item.domain]=[];
    groups[item.domain].push(item);
  });
  const domains=session.domains.slice();
  domains.forEach(d=>groups[d]=shuffle(groups[d]||[]));
  const rounds=Math.max(...domains.map(d=>groups[d].length));
  const result=[];
  let lastDepth=0,lastDomain="";
  for(let r=0;r<rounds;r++) {
    const batch=domains.map(d=>groups[d][r]).filter(Boolean);
    const ordered=arrangeRound(batch,lastDepth,lastDomain);
    result.push(...ordered);
    if(ordered.length) {
      lastDepth=ordered[ordered.length-1].depth;
      lastDomain=ordered[ordered.length-1].domain;
    }
  }
  const easyIndex=result.findIndex(item=>item.depth===1);
  if(easyIndex>0) {
    const [easyFirst]=result.splice(easyIndex,1);
    result.unshift(easyFirst);
  }
  return result;
}
function validateData() {
  const problems=[];
  const dependentStarts=["그 일","그 말씀","그 감정","그 관계"];
  if(!Array.isArray(SESSIONS)||SESSIONS.length!==4) problems.push("세션 수가 4개가 아닙니다.");
  let totalQuestions=0;
  const texts=[];
  SESSIONS.forEach(session=>{
    if(!META[session.key]) problems.push(`${session.key}: 테마 정보가 없습니다.`);
    if(!Array.isArray(session.domains)||session.domains.length!==6) problems.push(`${session.key}: 내부 영역이 6개가 아닙니다.`);
    if(!Array.isArray(session.questions)||session.questions.length!==30) problems.push(`${session.key}: 질문이 30개가 아닙니다.`);
    const domainCount={};
    (session.questions||[]).forEach(item=>{
      domainCount[item.domain]=(domainCount[item.domain]||0)+1;
      totalQuestions++;
      texts.push(item.text);
      if(!String(item.text||"").trim().endsWith("?")) problems.push(`${item.id}: 질문 문장 끝에 물음표가 없습니다.`);
      if(dependentStarts.some(prefix=>String(item.text||"").trim().startsWith(prefix))) problems.push(`${item.id}: 앞 카드의 맥락이 필요한 문장입니다.`);
    });
    (session.domains||[]).forEach(d=>{ if(domainCount[d]!==5) problems.push(`${session.key}/${d}: 질문 수가 5개가 아닙니다.`); });
  });
  const duplicate=texts.filter((t,i)=>texts.indexOf(t)!==i);
  if(duplicate.length) problems.push(`완전 중복 질문 ${new Set(duplicate).size}개가 있습니다.`);
  if(totalQuestions!==120) problems.push(`전체 질문 수가 ${totalQuestions}개입니다.`);
  return problems;
}
function showOnly(target) { [welcome,questionView,metaView,errorBox].forEach(el=>el.style.display="none"); target.style.display="block"; }
function updateProgress() {
  progress.textContent=String(shownCount);
  cardProgressText.textContent=`${shownCount} / ${total.textContent}`;
}
function renderBadge(meta) { badgeText.textContent = meta.badge; }
function setFlowMode(on) { body.classList.toggle('is-flow', !!on); }
function renderQuestion(item) {
  const session=currentSession();
  const meta=META[session.key];
  applyTheme(meta);
  renderBadge(meta);
  questionText.textContent=item.text;
  showOnly(questionView);
  updateProgress();
  updateControls();
  focusCard();
}
function renderFinished() {
  phase="FINISHED";
  running=true;
  setFlowMode(true);
  applyTheme(META.DONE);
  badgeText.textContent = "KOUM · CLOSING";
  metaKicker.textContent = "Conversation Closed";
  metaTitle.textContent = shownCount===120 && !skippedAny ? "120개의 질문을 모두 나누었습니다" : "선택한 질문으로 대화를 마쳤습니다";
  metaBody.textContent = "말로 나눈 이야기와 아직 말하지 못한 마음까지\n주님의 손에 조용히 맡깁니다.";
  showOnly(metaView);
  updateProgress();
  updateControls();
  focusCard();
}
function focusCard() { try{card.focus({preventScroll:true});}catch(e){card.focus();} }
function clearGuideTimers() { guideTimerIds.forEach(id=>clearTimeout(id)); guideTimerIds=[]; }
function closeGuide() { clearGuideTimers(); guideOverlay.classList.remove('show'); guideOpen=false; btnGuideAction.disabled=true; }
function openGuide({badgeText:textBadge,title,sub,lines,buttonLabel,onAction}) {
  closeGuide();
  guideBadgeText.textContent = textBadge || 'GUIDE';
  guideTitle.textContent = title || '안내';
  guideSub.textContent = sub || '';
  guideBody.innerHTML = '';
  btnGuideAction.textContent = buttonLabel || '계속';
  btnGuideAction.disabled = true;
  guideAction = onAction || null;
  guideOverlay.classList.add('show');
  guideOpen = true;
  const baseDelay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450;
  (lines||[]).forEach((line, idx) => {
    const p = document.createElement('p');
    p.className = 'guideLine';
    p.textContent = line;
    guideBody.appendChild(p);
    const id = setTimeout(() => { p.classList.add('show'); }, baseDelay * idx + 80);
    guideTimerIds.push(id);
  });
  const unlockId = setTimeout(() => { btnGuideAction.disabled = false; btnGuideAction.focus(); }, baseDelay * ((lines||[]).length || 1) + 250);
  guideTimerIds.push(unlockId);
  updateControls();
}
function parseLines(text) { return String(text||'').split(/\n+/).map(s=>s.trim()).filter(Boolean); }
function beginSessionGuide() {
  const session=currentSession();
  if(!session){ renderFinished(); return; }
  deck = buildBalancedDeck(session);
  pointer = 0;
  setFlowMode(true);
  const meta = META[session.key];
  applyTheme(meta);
  renderBadge(meta);
  updateProgress();
  openGuide({
    badgeText: meta.badge,
    title: session.meaningCard.title,
    sub: meta.title,
    lines: parseLines(session.meaningCard.body),
    buttonLabel: '질문 보기',
    onAction: () => {
      closeGuide();
      phase = 'QUESTIONS';
      showNextQuestion();
    }
  });
}
function showNextQuestion() {
  if(pointer < deck.length) {
    const item = deck[pointer++];
    shownCount++;
    renderQuestion(item);
    return;
  }
  sessionIndex++;
  if(sessionIndex >= SESSIONS.length) { renderFinished(); return; }
  beginSessionGuide();
}
function nextCard() {
  if(!running || moveOpen || guideOpen || navLocked || phase==='FINISHED') return;
  navLocked=true; window.setTimeout(()=>navLocked=false,260);
  if(phase==='QUESTIONS') showNextQuestion();
}
function updateControls() {
  const active = running && phase !== 'WELCOME';
  btnNext.disabled = !active || phase==='FINISHED' || guideOpen;
  btnDone.disabled = !active || moveOpen || guideOpen;
  btnSkip.disabled = !active || phase==='FINISHED' || guideOpen || moveOpen;
  btnSkip.textContent = sessionIndex >= SESSIONS.length - 1 ? '마무리로' : '세션 이동';
}
function openMove() {
  if(btnSkip.disabled || moveOpen) return;
  const current=currentSession();
  const next=SESSIONS[sessionIndex+1];
  if(next) moveText.textContent=`${META[current.key].badge}의 남은 질문을 건너뛰고 ${META[next.key].badge}로 이동합니다.`;
  else moveText.textContent=`${META[current.key].badge}의 남은 질문을 건너뛰고 대화를 마무리합니다.`;
  moveOverlay.classList.add('show'); moveOpen=true; updateControls(); setTimeout(()=>btnCancelMove.focus(),0);
}
function closeMove() { moveOverlay.classList.remove('show'); moveOpen=false; updateControls(); }
function confirmMove() {
  closeMove();
  skippedAny = true;
  sessionIndex++;
  if(sessionIndex >= SESSIONS.length) { renderFinished(); return; }
  beginSessionGuide();
}
function showStartupGuide() {
  setFlowMode(false);
  openGuide({
    badgeText: 'KOUM · OPENING',
    title: '대화를 시작하기 전에',
    sub: '천천히, 진실하게, 질문 하나에 머물면 충분합니다.',
    lines: [
      '모든 것을 정리해 오지 않으셔도 괜찮습니다.',
      '이 카드는 정답을 묻기보다 마음의 문을 부드럽게 엽니다.',
      '편한 만큼 말씀하시고, 어려우면 조용히 지나가셔도 됩니다.'
    ],
    buttonLabel: '시작하기',
    onAction: () => {
      closeGuide();
      running = true;
      sessionIndex = 0;
      deck = [];
      pointer = 0;
      shownCount = 0;
      skippedAny = false;
      beginSessionGuide();
    }
  });
}
function reset() {
  running=false; sessionIndex=0; deck=[]; pointer=0; shownCount=0; phase='WELCOME'; moveOpen=false; guideOpen=false; skippedAny=false; navLocked=false;
  closeMove(); closeGuide(); applyTheme(META.K); setFlowMode(false); badgeText.textContent='K · KEPT'; updateProgress(); showOnly(welcome); updateControls();
}
function start() {
  const problems = validateData();
  if(problems.length) { errorText.textContent = problems.join(' '); showOnly(errorBox); return; }
  showStartupGuide();
}
btnStart.addEventListener('click', start);
btnNext.addEventListener('click', nextCard);
btnSkip.addEventListener('click', openMove);
btnDone.addEventListener('click', reset);
btnCancelMove.addEventListener('click', closeMove);
btnConfirmMove.addEventListener('click', confirmMove);
btnGuideAction.addEventListener('click', ()=>{ if(btnGuideAction.disabled) return; if(typeof guideAction === 'function') guideAction(); });
moveOverlay.addEventListener('click', e=>{ if(e.target===moveOverlay) closeMove(); });
document.addEventListener('keydown', e=>{
  if(guideOpen) { if(e.key==='Enter' && !btnGuideAction.disabled){ e.preventDefault(); btnGuideAction.click(); } return; }
  if(moveOpen) { if(e.key==='Escape'){e.preventDefault(); closeMove();} else if(e.key==='Enter'){e.preventDefault(); confirmMove();} return; }
  if(!running) return;
  if(e.key==='Escape') reset();
  else if(e.key==='s'||e.key==='S') openMove();
  else if(e.key===' '||e.key==='Enter'){ e.preventDefault(); nextCard(); }
});
total.textContent = String(SESSIONS.reduce((sum,s)=>sum+s.questions.length,0));
reset();
