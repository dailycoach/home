import {Editor, clone, clamp, angle, scaledDimensions, newProject, importAsNew, parseImport, validateProject, backgroundKey} from './domain.js';
import {openRepository, SaveQueue} from './persistence.js';
import {Materials, renderSVG, exportPNG, exportCardPNG, download, assetURL} from './rendering.js';

const $ = (s, root = document) => root.querySelector(s);
const main = $('#main'), modal = $('#modal'), body = $('#modal-body');
let story, manifest, schema, empty, materials, repository = null;
let editor = null, queue = null, persistent = true, readOnly = false, releaseLock = null;
let panel = 'palette', palette = 'A', zoom = 1, paused = false, currentView = 'home', status = 'memory';
let activeGesture = null, dialogReturn = null, statusDetail = '', available = false, hasStored = false, documentInvalid = false;
let opening = false, viewScene = 'arrival', controlTab = 'move', leadExpanded = true;
let projectListEpoch=0; // Ignore asynchronous results from obsolete/double navigation.
const primaryFields = {arrival:'currentWord',vessel:'firstMind',nacre:'selectedLightNote',arrange:'importantToMe',reframe:'observed',name:'title',return:'noticed'};

function el(tag, text, attrs = {}) {
  const n = document.createElement(tag); if (text !== null && text !== undefined) n.textContent = text;
  for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, v); return n;
}
function button(text, action, attrs = {}) { return el('button', text, {'data-action': action, type:'button', ...attrs}); }
function notice(message) {
  const n=$('#notice');
  const inline=matchMedia('(max-width:767px)').matches ? $('#controls-panel.mobile-active .control-inline-status') : null;
  if(inline){
    inline.textContent=message;
    clearTimeout(notice.timer);
    n.classList.remove('visible');
    return;
  }
  n.textContent=message;
  n.classList.add('visible');
  clearTimeout(notice.timer);
  notice.timer=setTimeout(()=>n.classList.remove('visible'),5000);
}
function openDialog(title, content) {
  dialogReturn = document.activeElement; $('#modal-title').textContent = title; body.replaceChildren(content); modal.showModal();
}
function closeDialog() { modal.close(); if (dialogReturn?.isConnected) dialogReturn.focus(); }
$('#modal-close').onclick = closeDialog;
modal.addEventListener('click', e => { if (e.target === modal) closeDialog(); });
modal.addEventListener('close', () => { if (dialogReturn?.isConnected) dialogReturn.focus(); });
function confirmAction(title, message, proceed, label = '확인') {
  const block = el('div'); block.append(el('p', message));
  const row = el('div', null, {class:'button-row'}), yes = button(label, 'confirmed', {class:'primary'}), no = button('취소', 'cancel');
  yes.onclick = async () => { closeDialog(); await safely(proceed); }; no.onclick = closeDialog; row.append(no, yes); block.append(row); openDialog(title, block);
}
async function safely(fn) { try { await fn(); } catch (e) { notice(e.message || '작업을 마치지 못했어요. 편집 파일로 보관해 주세요.'); } }
function editable() { if(paused){notice('꾸미기로 돌아가면 다시 조절할 수 있어요.');return false;} if (readOnly) { notice('다른 탭에서 편집 중이거나 저장 충돌이 있어요. 현재 내용을 새 작업으로 보관할 수 있습니다.'); return false; } return true; }

function statusChanged(value, error) {
  if(documentInvalid && ['saved','saving','dirty'].includes(value)) return;
  status = value; statusDetail = error?.message || '';
  if (value === 'conflict') {readOnly = true;document.querySelectorAll('[data-field],[data-coordinate]').forEach(n=>n.disabled=true);}
  renderStatus();
}
function renderStatus() {
  const target = $('#save-state');
  const messages = {dirty:'변경 사항 대기 중', saving:'저장 중', saved:'이 기기에 저장됨', memory:'화면에만 유지 중', readonly:'다른 탭에서 편집 중 · 읽기 전용', error:'저장하지 못했어요', conflict:'저장 충돌 · 덮어쓰지 않았어요'};
  if(target){target.textContent = messages[status] || messages.memory;
    target.className = ['error','conflict'].includes(status) ? 'save-state error' : 'save-state';}
  const warning = $('#storage-warning'); if (!warning) return;
  warning.replaceChildren();
  if (['error','conflict','readonly'].includes(status)) {
    warning.hidden = false;
    warning.append(el('p', statusDetail || messages[status]), button('편집 파일로 보관', 'export-json'), button('현재 내용을 새 작업으로 보관', 'fork'));
    if(documentInvalid)warning.append(button('전체 글 텍스트 보관','export-text'));
    if (status === 'error') warning.append(button('저장 재시도', 'retry-save'));
    if (status === 'conflict' || status === 'readonly') warning.append(button('다른 탭의 변경 확인', 'reload-project'));
  } else warning.hidden = true;
}
async function dispose() {
  await queue?.stop(); queue = null;
  if (releaseLock) { releaseLock(); releaseLock = null; }
}
async function acquireLock(id) {
  if (!navigator.locks) return true; // Transaction revision checks still apply.
  return new Promise(resolve => {
    navigator.locks.request(`moonjar-edit-${id}`, {mode:'exclusive', ifAvailable:true}, async lock => {
      if (!lock) { resolve(false); return; }
      resolve(true); await new Promise(done => { releaseLock = done; });
    }).catch(() => resolve(true));
  });
}
async function openProject(doc, saveHere, expected = null, targetView = null) {
  if(opening){notice('작업을 여는 중이에요. 잠시 후 다시 선택해 주세요.');return false;}
  opening=true;main.inert=true;main.setAttribute('aria-busy','true');
  try {
  const errors = validateProject(doc, schema, manifest); if (errors.length) throw new Error(errors.join('\n'));
  if(editor && doc.projectId!==editor.doc.projectId && editor.doc.revision>0 && (!persistent||['error','conflict'].includes(status)) && !confirm('현재 작업에서 아직 보관하지 않은 내용이 있을 수 있어요. 이 작업을 떠나 다른 작업을 열까요?'))return;
  await queue?.flush();
  if(queue?.failed && !confirm('현재 작업의 자동 저장을 마치지 못했어요. 편집 파일로 보관하지 않았다면 내용이 사라질 수 있습니다. 그래도 다른 작업을 열까요?'))return;
  await dispose(); persistent = saveHere && !!repository;
  readOnly = persistent ? !(await acquireLock(doc.projectId)) : false;
  editor = new Editor(doc, manifest, d => {
    if (persistent && !readOnly) {
      const errors = validateProject(d, schema, manifest);
      if (errors.length) { documentInvalid=true; if(queue){queue.pending=null;clearTimeout(queue.timer);} statusChanged('error',new Error('글자 수 또는 문서 제한을 확인해 주세요. 입력한 글은 화면에 유지되며 전체 글을 텍스트로 보관할 수 있어요.')); return; }
      documentInvalid=false;
      queue?.schedule(d);
    }
  });
  statusDetail='';status = readOnly ? 'readonly' : persistent ? expected === null ? 'dirty' : 'saved' : 'memory';
  if (persistent && !readOnly) { queue = new SaveQueue(repository, expected, statusChanged); if (expected === null) queue.schedule(editor.doc); }
  documentInvalid=false; zoom = 1; paused = false; leadExpanded = true; panel = doc.mode==='guided'?'story':'palette';
  viewScene=doc.currentScene==='ending'?'arrange':doc.currentScene;
  currentView = targetView || (editor.doc.currentScene === 'ending' ? 'result' : 'studio');
  location.hash = `/${currentView}/${doc.projectId}`; render();
  return true;
  } finally {opening=false;main.inert=false;main.removeAttribute('aria-busy');}
}
async function start(mode) {
  if (editor && currentView === 'home') {
    confirmAction('새 작업 시작', '현재 열어 둔 작업을 파일로 보관했는지 확인해 주세요. 저장 모드의 기존 작업은 내 작업에서 다시 열 수 있습니다.', () => begin(mode), '새 작업 시작');
  } else await begin(mode);
}
async function begin(mode) {
  const saveHere = $('#storage-personal')?.checked ?? available;
  await openProject(newProject(empty, mode), saveHere);
}
function header(title, subtitle) {
  const h = el('div', null, {class:'page-heading'}); h.append(el('p', 'DAILYCOACHING · 알아차림 아트코칭', {class:'eyebrow'}), el('h1', title)); if (subtitle) h.append(el('p', subtitle, {class:'muted'})); return h;
}
function home() {
  currentView = 'home'; main.className = 'home'; main.replaceChildren();
  const section = el('section', null, {class:'hero'}), copy = el('div', null, {class:'hero-copy'});
  copy.append(el('p', '나를 담고, 다시 보다', {class:'eyebrow'}), el('h1', '빛을 담는\n달항아리'));
  copy.append(el('p', '자개를 고르고 놓으며,\n지금의 나를 조금 더 알아봅니다.', {class:'hero-lead'}));
  copy.append(el('p', story.opening.paragraphs[2], {class:'hero-note'}));
  const options = el('fieldset', null, {class:'storage-choice'}); options.append(el('legend','기록을 어떻게 남길까요?'));
  for (const [id, text, checked] of [['storage-personal','이 기기에 저장하며 시작', available],['storage-memory','기록을 남기지 않고 시작',!available]]) {
    const label = el('label'), input = el('input',null,{type:'radio',name:'storage',id}); input.checked = checked;
    if (id === 'storage-personal' && !available) input.disabled = true; label.append(input,document.createTextNode(text)); options.append(label);
  }
  const startArea=el('div',null,{class:'hero-start'});startArea.append(options);
  const actions = el('div',null,{class:'hero-actions'}); actions.append(button(story.ui.startGuided,'start-guided',{class:'primary'}), button(story.ui.startFree,'start-free'));
  if (editor || hasStored) actions.append(button('이어서 하기','resume',{class:'text-button'}));
  actions.append(button('편집 파일 열기','import',{class:'text-button'}));
  startArea.append(actions,el('p','로그인 없이 · 기록은 선택 · 자유롭게 배치',{class:'micro'}));
  if (!available) startArea.append(el('p','이 환경에서는 자동 저장을 사용할 수 없어요. 작업 중 편집 파일로 보관해 주세요.',{class:'error'}));
  if(globalThis.__MOONJAR_BUNDLE__)startArea.append(el('p','단일 파일 검토본입니다. 브라우저에 따라 자동 저장이 제한될 수 있으니 중요한 작업은 편집 파일로 보관해 주세요.',{class:'micro'}));
  const artwork=manifest.heroArtwork;
  const figure = el('figure',null,{class:'hero-figure'}),caption=el('figcaption');
  caption.append(el('span',artwork.title),el('br'),el('small',artwork.credit,{class:'artwork-credit'}));
  figure.append(el('img',null,{src:assetURL(artwork.src),alt:artwork.description,width:'780',height:'920',decoding:'async'}),caption);
  section.append(copy,figure,startArea); main.append(section);
  const intro = el('section',null,{class:'intro-line'}); intro.append(el('h2',story.opening.title),el('p',story.opening.paragraphs[0]),el('p',story.opening.paragraphs[1]),el('p','내가 선택한 조각과 말은 내게 남습니다. 중요한 작업은 편집 파일로 따로 보관해 주세요.',{class:'muted'})); main.append(intro);
}
function navigation() {
  const nav = el('nav',null,{class:'scene-nav','aria-label':'이야기 장면'});
  for (const s of story.scenes) nav.append(button(`${String(s.order).padStart(2,'0')} ${s.name}`,`scene:${s.id}`,{'aria-current':viewScene === s.id ? 'step' : 'false'}));
  return nav;
}
function studio() {
  currentView = 'studio'; main.className = `studio ${editor.doc.mode==='guided' ? 'mode-guided' : ''} ${paused ? 'paused' : ''}`; main.replaceChildren();
  const bar = el('div',null,{class:'studio-bar'}), left = el('div'); left.append(el('span','',{id:'save-state',class:'save-state',role:'status','aria-live':'polite'}));
  left.append(el('span',persistent ? '이 기기 · 이 브라우저' : '공용 기기용 · 자동 복원 없음',{class:'micro storage-context'}));
  const actions = el('div',null,{class:'button-row'}); actions.append(button(editor.doc.mode === 'free' ? '이야기와 함께' : '자유롭게 꾸미기','toggle-mode'),button('마무리','finish',{class:'primary'})); bar.append(left,actions);
  main.append(bar,navigation(),el('div',null,{id:'storage-warning',class:'storage-warning',hidden:''}));
  const workspace = el('div',null,{class:'workspace'});
  const rail = el('aside',null,{id:'palette-panel',class:'palette-panel','aria-label':'자개 재료'});
  const stage = el('section',null,{class:'stage-area','aria-label':'작품 편집 영역'});
  const sceneLead = el('section',null,{id:'scene-lead',class:'scene-lead','aria-label':'현재 장면의 이야기'});
  const viewtools = el('div',null,{class:'view-toolbar'});
  viewtools.append(button('−','zoom-out',{'aria-label':'작품 보기 축소'}),button('전체 보기','fit'),button('+','zoom-in',{'aria-label':'작품 보기 확대'}),button('나의 바탕','compare'),button(paused ? '꾸미기로 돌아가기' : '잠시 바라보기','pause',{class:'pause-button'}));
  const lookPrompt = el('aside',null,{id:'look-prompt',class:'look-prompt','aria-label':'잠시 바라보기 질문'});
  const shell = el('div',null,{class:'stage-shell',id:'stage-shell',tabindex:'-1','aria-label':'달항아리 작품 영역'}), paper = el('div',null,{class:'paper',id:'paper'});
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.id = 'art'; svg.classList.add('art'); svg.setAttribute('viewBox','0 0 1600 1800'); svg.setAttribute('role','img'); svg.setAttribute('aria-label','달항아리 작품. 조각 선택과 조절은 자개 목록과 조절 버튼으로도 할 수 있습니다.');
  paper.append(svg); shell.append(paper); stage.append(sceneLead,viewtools,lookPrompt,shell,el('p',story.ui.freePlacementHint,{class:'canvas-hint'}));
  const edittools = el('div',null,{class:'art-toolbar'}); edittools.append(button('↶ 취소','undo',{id:'undo','aria-label':'작품 실행 취소'}),button('↷ 다시','redo',{id:'redo','aria-label':'작품 다시 실행'}),button('배치 남기기','snapshot'),button('저장·보관','save-options')); stage.append(edittools);
  const firstHint=el('p','자개를 한 번 누르면 종이 위에 놓입니다. 끌지 않고도 큰 조절 버튼으로 움직일 수 있어요.',{id:'first-piece-hint',class:'first-piece-hint'});stage.append(firstHint);
  const controls = el('section',null,{id:'controls-panel',class:'controls-panel','aria-label':'선택 조각 조절'}); stage.append(controls);
  const record = el('aside',null,{id:'story-panel',class:'story-panel','aria-label':'이야기와 선택 기록'});
  workspace.append(rail,stage,record); main.append(workspace);
  const mobile = el('nav',null,{class:'mobile-tabs','aria-label':'작업 도구'}); for (const [id,label] of [['palette','자개'],['controls','조절'],['story','기록'],['look','바라보기']]) mobile.append(button(label,`panel:${id}`,{'aria-pressed':String(panel===id)})); main.append(mobile);
  renderPalette(); renderStory(); renderSceneLead(); renderLookPrompt(); renderCanvas(); renderControls(); renderStatus(); setPanel(panel); attachCanvas(svg);
}
function renderSceneLead() {
  const target = $('#scene-lead');
  if (!target) return;
  target.hidden = editor.doc.mode !== 'guided';
  target.classList.toggle('is-collapsed',!leadExpanded);
  target.replaceChildren();
  if (target.hidden) return;
  const s = story.scenes.find(s => s.id === viewScene) || story.scenes[0];
  const body=el('div',null,{id:'scene-lead-content',class:'scene-lead-body'});
  body.hidden=!leadExpanded;
  body.append(
    el('p', s.shortEssay, {class:'lead-essay'}),
    el('p', s.focusQuestion, {class:'lead-question'}),
    button('이 장면의 마음 기록하기', 'panel:story', {class:'text-button'}),
    el('p', '기록은 선택입니다. 바로 자개를 고르고 놓아도 괜찮습니다.', {class:'micro'})
  );
  target.append(
    el('p', `${String(s.order).padStart(2, '0')} / 07 · ${s.name}`, {class:'eyebrow'}),
    el('h2', s.title),
    body,
    button(leadExpanded ? '이야기 접고 작품에 집중' : '이야기 다시 보기', 'toggle-lead', {
      class:'lead-toggle', 'aria-expanded':String(leadExpanded), 'aria-controls':'scene-lead-content'
    })
  );
}
function renderLookPrompt() {
  const target = $('#look-prompt');
  if (!target) return;
  const s = story.scenes.find(s => s.id === viewScene) || story.scenes[3];
  // Pause questions follow the *actual making activity*, never an inferred
  // psychological trait. Someone who adds a piece in the first scene is
  // already making choices, even if they haven't navigated to scene four.
  const choosing = editor?.doc.scene.nodes.length>0 && ['arrival','vessel','nacre'].includes(viewScene);
  const focus = choosing ? (story.scenes.find(item=>item.id==='arrange')||s) : s;
  target.replaceChildren(
    el('p', `${focus.name} · 잠시 바라보기`, {class:'eyebrow'}),
    el('h2', focus.focusQuestion),
    el('p', choosing
      ? '자개를 고르고 놓는 동안 무엇이 중요해졌나요? 특별한 이유가 없어도 괜찮습니다. 지금의 모습을 살펴봅니다.'
      : '답을 정하지 않아도 좋습니다. 지금 눈에 들어오는 것과 마음에서 일어나는 것을 잠시 바라봅니다.', {class:'micro'}),
    button('내 말로 기록해 보기', 'panel:story', {class:'text-button'})
  );
}
function renderPalette() {
  const target = $('#palette-panel'); if (!target) return; target.replaceChildren();
  const top = el('div',null,{class:'panel-heading'}); top.append(el('h2','빛 고르기'),el('span','8가지 빛 · 96조각',{class:'micro'})); target.append(top,el('p',story.ui.addPieceHint,{class:'panel-intro'}));
  const colors = el('div',null,{class:'palette-tabs','aria-label':'색상군'});
  const swatches = ['#d0b995','#b4d1bf','#b8cede','#d8b5c2','#d8d5c9','#607c9f','#d99b8a','#c5b3cf'];
  manifest.palettes.forEach((p,i) => { const b = button(p.name,`palette:${p.id}`,{'aria-pressed':String(p.id===palette)}); const dot = el('span',null,{class:'swatch','aria-hidden':'true'});dot.style.background = swatches[i];b.prepend(dot);colors.append(b); }); target.append(colors);
  const pieces = el('div',null,{class:'piece-grid'});
  for (const a of manifest.pieces.filter(a => a.paletteId===palette)) {
    const b = button('',`add:${a.id}`,{'aria-label':`${a.label} 추가`,class:'piece-choice'}), image = el('img',null,{src:assetURL(`assets/thumbs/${palette}/${a.id}.webp`),alt:'',loading:'lazy',width:'144',height:'144'}), label = el('span',a.id);
    image.onerror = () => { label.textContent = `${a.id} 미리보기 재시도`; image.hidden=true; b.dataset.previewFailed='true'; };
    b.append(image,label); b.disabled = readOnly; pieces.append(b);
  }
  target.append(pieces,el('p',story.ui.staticMaterial,{class:'micro'}));
  const details = el('details',null,{class:'layer-list'}); details.append(el('summary',`놓인 조각 ${editor.doc.scene.nodes.length}개 · 목록으로 선택`));
  const list = el('ol'); for (const n of [...editor.doc.scene.nodes].reverse()) {
    const li = el('li'), b = button(`${n.assetId} ${editor.doc.pieceNotes[n.instanceId]?.label || ''}${n.locked ? ' · 잠김':''}`,`select:${n.instanceId}`,{'aria-pressed':String(n.instanceId===editor.selected)}); li.append(b); list.append(li);
  } details.append(list); target.append(details,button('작품 비우기','clear',{class:'text-button danger'}));
}
function renderCanvas(preview = null) {
  const svg = $('#art'); if (!svg) return;
  renderSVG(svg,editor.doc.scene,materials,paused ? null:editor.selected,preview);
  const paper = $('#paper'),shell=$('#stage-shell');
  const availableHeight=parseFloat(getComputedStyle(shell).maxHeight)||window.innerHeight*0.72;
  const fit=Math.max(120,Math.min(640,shell.clientWidth-18,(availableHeight-28)*8/9));
  paper.style.width=`${fit*zoom}px`;paper.style.maxWidth='none';
  if ($('#first-piece-hint')) $('#first-piece-hint').hidden=editor.doc.scene.nodes.length>0||paused;
  if ($('#undo')) $('#undo').disabled = !editor.past.length || readOnly || paused;
  if ($('#redo')) $('#redo').disabled = !editor.future.length || readOnly || paused;
}
function renderControls() {
  const target = $('#controls-panel'); if (!target) return;
  const advancedOpen=$('details',target)?.open||false;target.replaceChildren();
  const n = editor.node; if (!n) {target.append(el('p','조각을 누르거나 자개 목록에서 선택하면 조절할 수 있어요.',{class:'muted'}));return;}
  const drawerTop=el('div',null,{class:'control-drawer-top'});
  drawerTop.append(el('p','작품을 보며 조절하기',{class:'control-drawer-label'}),button('조절 닫기 ×','panel:canvas',{class:'control-drawer-close','aria-label':'조절 패널 닫고 달항아리 보기'}));
  target.append(drawerTop,el('p','',{class:'control-inline-status',role:'status','aria-live':'polite'}));
  const h = el('div',null,{class:'panel-heading'}); h.append(el('h2',`${n.assetId} 조각`),el('span',`${Math.round(n.rotation)}° · ${Math.round(n.width)} × ${Math.round(n.height)}`,{class:'micro'}));target.append(h);
  const tabs=el('div',null,{class:'control-tabs','aria-label':'조절 종류'});
  for(const [id,label] of [['move','이동'],['rotate','회전'],['size','크기']])tabs.append(button(label,`control:${id}`,{'aria-pressed':String(controlTab===id)}));target.append(tabs);
  const groups={move:[['←','move:-24:0','왼쪽으로 이동'],['↑','move:0:-24','위로 이동'],['↓','move:0:24','아래로 이동'],['→','move:24:0','오른쪽으로 이동']],rotate:[['↶ 15°','rotate:-15','왼쪽으로 15도 회전'],['↷ 15°','rotate:15','오른쪽으로 15도 회전']],size:[['− 작게','size:0.9','비율 유지하며 작게'],['+ 크게','size:1.1','비율 유지하며 크게']]};
  function tools(items){const row=el('div',null,{class:'controls-grid'});for(const [label,action,name] of items){const b=button(label,action,{'aria-label':name});b.disabled=readOnly||paused||(n.locked&&!['lock','duplicate'].includes(action));row.append(b);}return row;}
  target.append(tools(groups[controlTab]));
  const note=button('이 조각에 말 남기기','piece-note',{class:'piece-note-button'});note.disabled=readOnly||paused;target.append(note);
  if(n.locked)target.append(el('p','잠긴 조각입니다. 더 조절하기에서 잠금을 풀 수 있어요.',{class:'micro'}));
  const geometry = el('details');geometry.open=advancedOpen;geometry.append(el('summary','더 조절하기 · 순서, 복제, 잠금, 수치'));
  geometry.append(tools([['중앙','center','종이 중앙으로 이동'],['앞으로','forward','겹침 순서 앞으로'],['뒤로','backward','겹침 순서 뒤로'],['복제','duplicate','선택 조각 복제'],[n.locked?'잠금 해제':'잠금','lock','선택 조각 잠금 전환'],['삭제','delete','선택 조각 삭제']]));
  const coords=el('div',null,{class:'coordinates'});for(const axis of ['x','y']) { const label=el('label',axis==='x'?'가로 위치':'세로 위치');const input=el('input',null,{type:'number',min:0,max:axis==='x'?1600:1800,value:n[axis],'data-coordinate':axis,'aria-label':axis==='x'?'조각 가로 좌표':'조각 세로 좌표'});input.disabled=n.locked||readOnly||paused;label.append(input);coords.append(label); }geometry.append(coords);target.append(geometry);
}
function pieceNote(){
  if(!editable()||!editor.node)return;
  const root=el('div');root.append(el('p','이 조각에 떠오르는 이름이나 말을 남길 수 있어요. 비워두어도 됩니다.'));
  for(const f of story.scenes.find(s=>s.id==='nacre').instanceFields)root.append(inputField('piece',f,editor.doc.pieceNotes[editor.selected]?.[f.id]||''));
  const done=button('작품으로 돌아가기','close-note',{class:'primary'});done.onclick=closeDialog;root.append(done);openDialog(`${editor.node.assetId} · 조각의 이야기`,root);
}
function saveOptions(){
  const root=el('div',null,{class:'save-options'});
  for(const [label,action,detail] of [['작품 이미지 저장','export-png','작품만 PNG로 남깁니다.'],['작품 카드 만들기','card-options','넣고 싶은 제목·한 문장만 직접 선택해 담습니다.'],['편집 파일로 보관','export-json','작품과 기록을 다음에 다시 열 수 있습니다.'],['기록지 인쇄·PDF 저장','print-options','인쇄에 넣을 기록을 직접 고릅니다.']]){
    const row=el('div'),b=button(label,action);b.onclick=()=>{closeDialog();};row.append(b,el('p',detail,{class:'micro'}));root.append(row);
  }openDialog('작품과 기록 남기기',root);
}
function inputField(section, field, value) {
  const wrap = el('label',null,{class:'record-field'});wrap.append(el('span',field.label));
  const input=el(field.maxLength<=200?'input':'textarea',null,{'data-section':section,'data-field':field.id,'data-limit':field.maxLength,maxlength:field.maxLength,rows:3});input.value=value;input.disabled=readOnly||paused;
  if(field.hint) input.placeholder=field.hint;
  const count=el('small',`${[...value].length} / ${field.maxLength}`,{class:'length-count'});wrap.append(input,count);return wrap;
}
function renderStory() {
  const target = $('#story-panel'); if (!target) return; target.replaceChildren();
  const s=story.scenes.find(s=>s.id===viewScene)||story.scenes[3];
  target.append(el('p','이 장면의 기록',{class:'mobile-record-title'}));
  target.append(el('p',`${String(s.order).padStart(2,'0')} / 07 · ${s.name}`,{class:'eyebrow'}),el('h2',s.title),el('p',s.shortEssay,{class:'short-essay'}));
  const details=el('details',null,{class:'essay'});details.append(el('summary',story.ui.openEssay));for(const p of s.essay) details.append(el('p',p));
  const daily=el('details',null,{class:'daily-note'});daily.append(el('summary','이 장면의 알아차림'));for(const key of s.daily) {const d=story.daily.find(d=>d.key===key);daily.append(el('p',`${d.en} · ${d.ko}`));}
  target.append(el('h3',s.focusQuestion,{class:'focus-question'}),el('p',story.ui.recordHint,{class:'micro'}));
  const fields=[...(s.titleField?[{section:'title',field:s.titleField,value:editor.doc.title}]:[]),...s.fields.map(f=>({section:s.id,field:f,value:editor.doc.reflections[s.id][f.id]}))];
  const more=el('details',null,{class:'more-records'});more.append(el('summary','조금 더 살펴보기 · 선택 기록'));
  for(const item of fields){const field=inputField(item.section,item.field,item.value);(item.field.id===primaryFields[s.id]?target:more).append(field);}
  if(more.children.length>1)target.append(more);
  target.append(details,daily);
  if(s.id==='reframe') target.append(button('남긴 배치와 바탕 보기','compare'));
  target.append(el('p',s.nextCopy,{class:'next-copy'}));
  const nav=el('div',null,{class:'scene-actions'});if(s.order>1)nav.append(button('이전',`scene:${story.scenes[s.order-2].id}`));nav.append(button(s.order===7?'마무리':'다음 장면',s.order===7?'finish':`scene:${story.scenes[s.order].id}`,{class:'primary'}));target.append(nav);
  target.append(button('지금은 건너뛰기',s.order===7?'finish':`scene:${story.scenes[s.order].id}`,{class:'text-button'}));
}
function setPanel(id, reveal = false) {
  panel=id;
  const previousControls=main.classList.contains('controls-active');
  main.classList.toggle('controls-active',id==='controls');
  if(previousControls!==(id==='controls') && !paused)renderCanvas();
  if(id==='look') { paused=true; main.classList.add('paused');renderLookPrompt();renderCanvas();renderControls(); }
  else if(paused) { paused=false;main.classList.remove('paused');renderCanvas();renderControls(); }
  for(const p of ['palette','controls','story']) $(`#${p}-panel`)?.classList.toggle('mobile-active',id===p);
  document.querySelectorAll('.mobile-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action===`panel:${id}`)));
  const pauseButton=$('[data-action="pause"]');if(pauseButton)pauseButton.textContent=paused?'꾸미기로 돌아가기':'잠시 바라보기';
  if(id==='canvas')$('#stage-shell')?.focus?.({preventScroll:true});
  if(reveal && id!=='look' && matchMedia('(max-width:767px)').matches){
    // The compact editor floats below the *actual canvas*. Never scroll down to
    // the controls as that would hide the artwork the participant is changing.
    const revealTarget=id==='controls'||id==='canvas'?$('#stage-shell'):$(`#${id}-panel`);
    // For the editor, scroll immediately so the selected fragment is not
    // briefly hidden behind a floating tray while the page is still moving.
    const immediate=id==='controls'||id==='canvas'||matchMedia('(prefers-reduced-motion:reduce)').matches;
    revealTarget?.scrollIntoView({block:'start',behavior:immediate?'instant':'smooth'});
  }
}

function canvasPoint(svg, event) {
  const point = svg.createSVGPoint(); point.x=event.clientX;point.y=event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}
function attachCanvas(svg) {
  svg.addEventListener('pointerdown',event=>{
    if(paused||readOnly||event.button!==0)return;
    const id=event.target.closest('[data-id]')?.dataset.id;
    if(!id){editor.selected=null;renderCanvas();renderControls();return;}
    editor.selected=id;const node=editor.node;renderControls();renderCanvas();
    if(node.locked)return;
    const p=canvasPoint(svg,event), mode=event.target.dataset.handle||'move';
    activeGesture={pointerId:event.pointerId,id,mode,start:p,node:clone(node)};svg.setPointerCapture(event.pointerId);event.preventDefault();
  });
  svg.addEventListener('pointermove',event=>{
    const g=activeGesture;if(!g||g.pointerId!==event.pointerId)return;
    const p=canvasPoint(svg,event),n=clone(g.node);
    if(g.mode==='move'){n.x=clamp(g.node.x+p.x-g.start.x,0,1600);n.y=clamp(g.node.y+p.y-g.start.y,0,1800);}
    if(g.mode==='rotate')n.rotation=angle(g.node.rotation+(Math.atan2(p.y-n.y,p.x-n.x)-Math.atan2(g.start.y-n.y,g.start.x-n.x))*180/Math.PI);
    if(g.mode==='resize'){
      const f=Math.hypot(p.x-n.x,p.y-n.y)/Math.max(1,Math.hypot(g.start.x-n.x,g.start.y-n.y));Object.assign(n,scaledDimensions(n.width,n.height,f));
    }
    g.preview=n;renderCanvas(n);
  });
  function end(event){
    const g=activeGesture;if(!g||g.pointerId!==event.pointerId)return;activeGesture=null;
    if(event.type!=='pointercancel'&&g.preview&&!paused&&!readOnly)editor.commit(d=>Object.assign(d.scene.nodes.find(n=>n.instanceId===g.id),g.preview));
    renderCanvas();renderControls();
  }
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
  svg.addEventListener('lostpointercapture',event=>{if(activeGesture?.pointerId===event.pointerId){activeGesture=null;renderCanvas();}});
}
function changed(){
  const action=document.activeElement?.dataset.action;
  renderCanvas();renderControls();renderPalette();
  if(action)[...document.querySelectorAll('[data-action]')].find(b=>b.dataset.action===action)?.focus({preventScroll:true});
}
async function addPiece(id, source){
  if(!editable())return;
  if(source?.dataset.previewFailed){const img=$('img',source);img.hidden=false;img.src=assetURL(`assets/thumbs/${id[0]}/${id}.webp`);source.dataset.previewFailed='';$('span',source).textContent=id;}
  source?.setAttribute('aria-busy','true');if(source)source.disabled=true;
  const targetEditor=editor;
  try{await materials.load(id);if(editor!==targetEditor||!editable())return;editor.add(id);changed();if(matchMedia('(max-width:767px)').matches)setPanel('controls',true);notice(`${id} 조각을 놓았어요. 이동·회전·크기 버튼으로 조절할 수 있습니다.`);}
  finally{source?.removeAttribute('aria-busy');if(source)source.disabled=false;}
}
function snapshot(){
  if(!editable())return;
  if(editor.doc.snapshots.length<3){editor.snapshot();notice('지금의 배치를 남겼어요.');return;}
  const list=el('div');list.append(el('p','세 개가 보관되어 있어요. 교체할 배치를 직접 고르거나 취소할 수 있습니다.'));
  editor.doc.snapshots.forEach((s,i)=>{const b=button(`${s.label} 교체`,'replace');b.onclick=()=>{if(!editable())return;editor.snapshot(i);closeDialog();notice('선택한 배치를 교체했어요.');};list.append(b);});openDialog('남길 배치 선택',list);
}
function scenePreview(scene,label){
  const figure=el('figure',null,{class:'comparison-scene'}),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 1600 1800');svg.setAttribute('role','img');svg.setAttribute('aria-label',label);renderSVG(svg,scene,materials);figure.append(svg,el('figcaption',label));return figure;
}
function compare(){
  const root=el('div',null,{class:'background-picker'});
  root.append(el('p',paused
    ? '지금은 바라보기입니다. 배경을 비교한 다음 꾸미기로 돌아가 선택하세요.'
    : '마음에 드는 바탕을 선택할 수 있습니다. 자개의 위치와 크기는 바뀌지 않습니다.',{class:'muted'}));
  const current=editor.doc.scene.canvasVariant||'legacy-outline-v3';
  const variants=[
    {id:'porcelain-v2',label:'오리지널 백자',note:'새로운 유백색 백자. 햇살 낮과 달빛 밤.'},
    {id:'legacy-outline-v3',label:'기존 도안',note:'이전에 만든 작품의 선화 도안을 그대로 유지합니다.'}
  ];
  for(const variant of variants){
    const group=el('section',null,{class:'background-option'});
    group.append(el('h3',variant.label),el('p',variant.note,{class:'micro'}));
    const previews=el('div',null,{class:'comparison-grid'});
    for(const theme of ['light','dark']){
      const previewScene=clone(editor.doc.scene);
      previewScene.canvasVariant=variant.id;
      previewScene.theme=theme;
      const figure=scenePreview(previewScene,theme==='light'?'햇살 낮':'달빛 밤');
      const active=current===variant.id&&editor.doc.scene.theme===theme;
      const b=button(active?'현재 사용 중':'이 바탕 적용하기',`apply-canvas:${variant.id}:${theme}`,{'aria-pressed':String(active)});
      b.disabled=readOnly||paused||active;
      b.onclick=()=>{
        if(!editable())return;
        const activeEditor=editor;
        const apply=async()=>{
          // Confirm all required pixels are available before changing saved art.
          await materials.load(backgroundKey(previewScene));
          if(editor!==activeEditor||!editable())return;
          editor.setCanvas(variant.id,theme);
          if(modal.open)closeDialog();
          renderCanvas();renderControls();changed();
          notice(`${variant.label} · ${theme==='light'?'햇살 낮':'달빛 밤'}으로 바꿨어요. 자개는 같은 자리에 있습니다.`);
        };
        if(current==='legacy-outline-v3'&&variant.id==='porcelain-v2'){
          confirmAction('기존 작품의 배경을 바꿀까요?',
            '오래전에 만든 작품의 자개 위치와 기록은 그대로 남지만, 달항아리 모양이 새로운 백자로 달라집니다. 원래 바탕으로 다시 바꾸거나 실행 취소할 수도 있어요.',
            apply,'확인하고 바꾸기');
        } else safely(apply);
      };
      figure.append(b);previews.append(figure);
    }
    group.append(previews);root.append(group);
  }
  root.append(el('h3','남겨둔 배치와 지금'));
  if(!editor.doc.snapshots.length)root.append(el('p','아직 남긴 배치가 없습니다. 원할 때 「배치 남기기」를 누르세요.'));
  else {const grid=el('div',null,{class:'comparison-grid'});
    for(const shot of editor.doc.snapshots)grid.append(scenePreview(shot.scene,shot.label));
    grid.append(scenePreview(editor.doc.scene,'지금의 배치'));root.append(grid);}
  root.append(el('p',story.scenes[4].truthNote,{class:'micro'}));
  openDialog('나의 달항아리 바탕',root);
}
function backup(){
  const root=el('div');root.append(el('p','편집 파일에는 성찰 기록과 조각 메모가 함께 들어갑니다. 암호화되지 않은 개인 백업이므로 공유 전에 내용을 확인해 주세요.'));
  const b=button('개인 편집 파일 내려받기','download-json',{class:'primary'});b.onclick=()=>{
    const errors=validateProject(editor.doc,schema,manifest);if(errors.length){notice('문서 제한을 확인해 주세요. 긴 글은 전체 글 텍스트 보관으로 먼저 보관할 수 있어요.');return;}
    download(new Blob([JSON.stringify(editor.doc,null,2)],{type:'application/json'}),filename('moonjar.json'));closeDialog();notice('편집 파일 내려받기를 요청했어요. 다운로드 목록을 확인해 주세요.');
  };root.append(b);openDialog('편집 파일로 보관',root);
}
function filename(ext){return `moonjar-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${editor.doc.projectId.slice(0,8)}.${ext}`;}
async function imageExport(scale=1){
  const doc=clone(editor.doc);
  notice('작품 이미지를 준비하고 있어요.');
  try{
    const blob=await exportPNG(doc.scene,materials,scale);download(blob,filename('png'));notice(`${1600*scale} × ${1800*scale} 작품 이미지 내려받기를 요청했어요.`);
  }catch(error){
    const root=el('div');root.append(el('p',error.message),el('p','이미지를 빠뜨린 파일은 저장하지 않았습니다. 재시도하거나 작은 이미지로 만들어볼 수 있어요.'));
    const retry=button('다시 시도','retry-png'),small=button('800 × 900으로 시도','small-png');retry.onclick=()=>{closeDialog();safely(()=>imageExport(scale));};small.onclick=()=>{closeDialog();safely(()=>imageExport(0.5));};root.append(retry,small);openDialog('이미지를 만들지 못했어요',root);
  }
}
// Card export never reads hidden journal fields unless the user has checked
// the precise text they want in the finished image.
function cardOptions() {
  if (!editor) return;
  const scene = clone(editor.doc.scene);
  const root = el('div',null,{class:'card-modal'});
  root.append(el('p','작품만 담긴 카드에서 시작합니다. 제목과 한 문장은 직접 선택했을 때에만 이미지에 들어갑니다.',{class:'card-privacy'}));
  const grid = el('div',null,{class:'card-modal-grid'}),form=el('section',null,{class:'card-form'}),figure=el('figure',null,{class:'card-preview'});
  const image=el('img',null,{alt:'작품 카드 미리보기',width:'320',height:'480'}),previewState=el('p','미리보기를 준비하고 있어요.',{class:'micro',role:'status','aria-live':'polite'});
  figure.append(image,el('figcaption','작품 카드 · 1600 × 2400 PNG'),previewState);
  const titleOption=el('label',null,{class:'check-row'}),titleCheck=el('input',null,{type:'checkbox'});
  titleOption.append(titleCheck,document.createTextNode('작품 제목 함께 담기'));
  const titleField=el('label',null,{class:'card-field'}),titleText=el('span','카드에 넣을 제목');
  const titleInput=el('input',null,{type:'text',maxlength:'50',placeholder:'예: 지금의 나에게 남겨둔 자리'});
  titleInput.value=editor.doc.title||'';
  titleInput.setAttribute('aria-describedby','card-copy-limit');

  titleField.append(titleText,titleInput);titleField.hidden=true;
  const sentenceOption=el('label',null,{class:'check-row'}),sentenceCheck=el('input',null,{type:'checkbox'});
  sentenceOption.append(sentenceCheck,document.createTextNode('나에게 남는 한 문장 함께 담기'));
  const sentenceField=el('label',null,{class:'card-field'}),sentenceText=el('span','카드에 넣을 한 문장');
  const sentenceInput=el('textarea',null,{maxlength:'100',rows:3,placeholder:'직접 고른 한 문장만 담아요.'});
  sentenceInput.value=editor.doc.reflections.name.keySentence||'';
  sentenceInput.setAttribute('aria-describedby','card-copy-limit');
  sentenceField.append(sentenceText,sentenceInput);sentenceField.hidden=true;

  const controls=el('div',null,{class:'card-controls'});
  const save=button('이 모습으로 카드 저장','download-card',{class:'primary'}),status=el('p','성찰 기록과 조각 메모는 카드에 포함되지 않습니다.',{class:'micro'});
  save.disabled=true;
  controls.append(save,status);
  const cardLimit=el('p','원본 기록은 수정하지 않습니다. 카드용 제목 50자, 한 문장 100자까지 사용할 수 있으며, 글이 넘치면 생략하지 않고 수정하도록 안내합니다.',{id:'card-copy-limit',class:'card-copy-limit'});
  form.append(titleOption,titleField,sentenceOption,sentenceField,cardLimit);
  grid.append(figure,form);
  // Read the preview before the final download button, especially on phones.
  root.append(grid,controls);

  let url=null, timer=null, generation=0, disposed=false;
  const selectedCopy=()=>({
    title:titleCheck.checked?titleInput.value:'',
    sentence:sentenceCheck.checked?sentenceInput.value:''
  });
  const updateFields=()=>{
    titleField.hidden=!titleCheck.checked;
    sentenceField.hidden=!sentenceCheck.checked;
  };
  function updatePreview() {
    const id=++generation;
    clearTimeout(timer);
    save.disabled=true;
    previewState.textContent='선택한 문구로 미리보기를 만드는 중이에요.';
    timer=setTimeout(async()=>{
      try {
        await document.fonts.ready;
        const blob=await exportCardPNG(scene,materials,selectedCopy(),0.4);
        if(disposed||id!==generation||!modal.open||!root.isConnected)return;
        const nextURL=URL.createObjectURL(blob),oldURL=url;
        image.src=nextURL;
        url=nextURL;
        if(oldURL)URL.revokeObjectURL(oldURL);
        image.style.opacity='1';
        previewState.textContent='미리보기와 같은 구성으로 저장됩니다.';
        save.disabled=false;
      } catch(error) {
        if(disposed||id!==generation)return;
        image.style.opacity='.35';
        previewState.textContent=error.message||'미리보기를 만들지 못했어요. 카드 문구를 다듬어 다시 시도해 주세요.';
      }
    },180);
  }
  titleCheck.addEventListener('change',()=>{updateFields();updatePreview();});
  sentenceCheck.addEventListener('change',()=>{updateFields();updatePreview();});
  titleInput.addEventListener('input',updatePreview);
  sentenceInput.addEventListener('input',updatePreview);
  save.onclick=()=>safely(async()=>{
    const copy=selectedCopy();
    save.disabled=true;
    try {
      const blob=await exportCardPNG(scene,materials,copy);
      download(blob,filename('card.png'));
      notice('선택한 문구만 담은 작품 카드 내려받기를 요청했어요.');
    } finally {
      if(!disposed)save.disabled=false;
    }
  });
  modal.addEventListener('close',()=>{
    disposed=true;generation++;
    clearTimeout(timer);
    if(url)URL.revokeObjectURL(url);
  },{once:true});
  openDialog('내 작품 카드 만들기',root);
  updatePreview();
}
async function finish(){
  if(editable()){editor.navigate('ending');await queue?.flush();}
  // Avoid keeping an editor-operation toast over the newly opened art gallery.
  const toast=$('#notice');
  toast?.classList.remove('visible');
  clearTimeout(notice.timer);
  location.hash=`/result/${editor.doc.projectId}`;
  result();
}
function result(){
  currentView='result';
  main.className='result-page';
  main.replaceChildren(header(story.ending.title),el('p','',{id:'save-state',class:'save-state',role:'status','aria-live':'polite'}));

  const layout=el('div',null,{class:'result-layout'});
  const art=scenePreview(editor.doc.scene,editor.doc.title||'나의 달항아리');
  const copy=el('section',null,{class:'result-copy'});
  copy.append(
    el('p',editor.doc.title||'이름 없이 남긴 작품',{class:'eyebrow'}),
    el('h2',story.ending.anchor),
    el('p','이 작품을 만드는 동안 내가 고르고, 머뭇거리고, 그대로 두었던 순간도 작품의 일부입니다. 나만의 모습으로 간직해 보세요.',{class:'result-overview'})
  );
  // The result is an artwork first. Journal reflections are not exposed on
  // the page by default, and the image/card never includes them automatically.
  const actions=el('div',null,{class:'result-actions'});
  actions.append(
    button('작품 카드 만들기','card-options',{class:'primary'}),
    button('작품 이미지만 저장','export-png'),
    button('다시 꾸미기','continue'),
    button('편집 파일로 보관','export-json'),
    button('기록지 인쇄·PDF 저장','print-options')
  );
  copy.append(actions,el('p',story.ui.privacyImage,{class:'micro'}));

  const recap=el('details',null,{class:'reflection-recap'});
  recap.append(el('summary','나의 말과 선택 다시 보기 · 나만 확인'));
  const words=el('div',null,{class:'starting-words'});
  words.append(el('h3','처음의 말'),el('p',editor.doc.reflections.arrival.currentWord||'남기지 않음'));
  recap.append(words);
  const returnFields=story.scenes.find(s=>s.id==='return').fields.filter(f=>
    ['noticed','situation','action','support'].includes(f.id)
    && editor.doc.reflections.return[f.id].trim()
  );
  if(returnFields.length){
    const dailyReturn=el('section',null,{class:'daily-return'});
    dailyReturn.append(el('h3','내가 알아차리고 선택한 것'));
    for(const f of returnFields){
      dailyReturn.append(el('h4',f.label),el('p',editor.doc.reflections.return[f.id]));
    }
    recap.append(dailyReturn);
  }
  recap.append(inputField('ending',{
    id:'presentWord',label:'지금 내 마음에 머무는 말',maxLength:2000
  },editor.doc.reflections.ending.presentWord));
  copy.append(recap);

  const essay=el('details',null,{class:'result-essay'});
  essay.append(el('summary','마무리 이야기 천천히 읽기'));
  for(const p of story.ending.paragraphs)essay.append(el('p',p));
  copy.append(
    essay,
    el('p',story.ending.lastLine,{class:'result-epilogue'}),
    el('p',story.ui.localNotice,{class:'micro'})
  );
  layout.append(art,copy);
  main.append(layout,el('div',null,{id:'storage-warning',class:'storage-warning',hidden:''}));
  renderStatus();
}
async function projects(){
  const epoch=++projectListEpoch;
  await queue?.flush();
  if(epoch!==projectListEpoch)return;
  currentView='projects';main.className='projects-page';main.replaceChildren(header('이 기기의 작업','이 브라우저에 보관한 작업입니다. 자동으로 다른 기기와 동기화되지 않습니다.'));
  const actions=el('div',null,{class:'button-row'});actions.append(button('편집 파일 열기','import'),button('새 작업 시작','home'));main.append(actions);
  if(!repository){main.append(el('p','이 환경에서는 자동 저장을 사용할 수 없어요. 편집 파일을 열거나 화면에만 유지하며 시작할 수 있습니다.'));return;}
  const stored=await repository.list();
  if(epoch!==projectListEpoch||currentView!=='projects')return;
  const list=stored.filter(d=>!validateProject(d,schema,manifest).length).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  hasStored=stored.length>0;
  if(stored.length!==list.length)main.append(el('p','읽을 수 없는 저장 항목이 있어 목록에서 열지 않았습니다. 원본 항목은 삭제하지 않았습니다. 보관한 편집 파일을 열어 주세요.',{class:'error'}));
  if(!list.length)main.append(el('p','이 기기에 보관된 작업이 없습니다. 편집 파일이 있다면 열어 주세요.',{class:'empty-state'}));
  const cards=el('div',null,{class:'project-list'});
  for(const d of list){
    const card=el('article',null,{class:'project-card'});card.append(scenePreview(d.scene,d.title||'이름 없이 남긴 작품'));card.append(el('h2',d.title||story.ui.noTitle),el('p',`${new Date(d.updatedAt).toLocaleString('ko-KR')} · ${d.scene.nodes.length}조각`,{class:'micro'}));
    card.append(button('이어서 하기',`open:${d.projectId}`,{class:'primary'}),button('제목 변경',`rename:${d.projectId}`),button('삭제',`delete-project:${d.projectId}`,{class:'danger'}));cards.append(card);
  }main.append(cards,el('p','같은 브라우저를 쓰는 사람도 이 목록을 열 수 있습니다. 공용 기기에서는 기록을 남기지 않는 모드를 선택하세요.',{class:'micro'}));
}
async function renameProject(id){
  const doc=await repository.get(id);if(!doc)return;
  if(editor?.doc.projectId===id){notice('열려 있는 작품의 제목은 「이름」 장면에서 바꿀 수 있어요.');location.hash=`/studio/${id}`;viewScene='name';if(!readOnly)editor.navigate('name');studio();setPanel('story');return;}
  const name=prompt('작품 이름을 입력해 주세요. 비워두어도 됩니다.',doc.title);if(name===null)return;if([...name].length>80)throw new Error('제목은 80자까지 입력해 주세요.');
  const expected=doc.revision;doc.title=name;doc.revision++;doc.updatedAt=new Date().toISOString();await repository.save(doc,expected);await projects();
}
async function deleteProject(id){
  if(editor?.doc.projectId===id)await queue?.flush();
  const doc=await repository.get(id);if(!doc)return;
  confirmAction('작품과 기록 삭제','이 기기에서 해당 작품과 기록을 삭제합니다. 내려받은 파일은 지워지지 않습니다.',async()=>{
    if(editor?.doc.projectId===id)await dispose();
    await repository.delete(id,doc.revision);
    if(editor?.doc.projectId===id)editor=null;
    await projects();notice('이 기기의 해당 작품과 기록을 삭제했어요.');
  },'삭제');
}
function guide(){
  currentView='guide';main.className='reading-page';main.replaceChildren(header('함께 머무는 60분','진행자를 위한 안내 · 참여자의 기록을 조회하거나 수집하지 않습니다.'));
  main.append(el('p','모든 질문과 공유는 선택입니다. 말하고 싶지 않은 이야기는 요청하지 않습니다. 빈 항아리로 마무리할 수 있습니다.'));
  const table=el('table'),thead=el('thead'),tr=el('tr');for(const h of ['장면','시간','중심 질문'])tr.append(el('th',h));thead.append(tr);table.append(thead);const tbody=el('tbody');
  for(const t of story.facilitator.timing){const s=story.scenes.find(s=>s.id===t.scene),r=el('tr');r.append(el('td',s.name),el('td',`${t.minutes}분`),el('td',s.focusQuestion));tbody.append(r);}table.append(tbody);main.append(table);
  for(const d of story.daily)main.append(el('h2',`${d.key} · ${d.en}`),el('p',`${d.ko} — ${d.question}`));
  main.append(el('p','작품의 색과 위치에 의미를 부여하지 않습니다. 참여자가 자신의 의미를 찾도록 기다립니다. 불편하면 멈추거나 건너뛰도록 안내합니다.'));
}
function about(){
  currentView='materials';main.className='reading-page';main.replaceChildren(header('재료와 개인 저장 안내'));
  for(const [h,t] of [
    ['자개의 빛','제공된 자개 PNG 96개와 1600 × 1800 달항아리 도안 두 종을 사용합니다. 화면 속 자개는 정적인 2D 이미지이며 회전으로 실제 자개의 광학 반사를 재현하지 않습니다.'],
    ['자유로운 배치','항아리 안이나 밖, 종이 영역 안에 조각을 놓을 수 있습니다. 조각 수와 배치에 정답은 없습니다.'],
    ['저장은 이 브라우저에','작품과 기록은 이 기기·이 브라우저·현재 출처의 IndexedDB에 저장합니다. 영구 보존이나 기기 간 동기화를 보장하지 않습니다. 시크릿 모드, 브라우저 데이터 삭제, 앱 내 브라우저에서 보관 내용이 사라질 수 있습니다. 중요한 작업은 편집 파일로 보관하세요.'],
    ['기록을 남기지 않는 모드','프로젝트·기록·썸네일을 저장소에 쓰지 않고 메모리에만 유지합니다. 탭을 닫거나 새로고침하면 잃을 수 있습니다. 직접 내려받은 파일은 기기에 남습니다.'],
    ['개인 기록의 경계','성찰 기록·작품·키 입력을 원격 API나 분석 서비스로 보내지 않습니다. 로그인으로 보호되는 보관함은 아니므로 같은 브라우저를 쓰는 사람이 작업을 볼 수 있습니다. 정적 파일을 제공하는 환경의 접속 로그와는 별개입니다.'],
    ['편집 파일과 작품 이미지','PNG에는 작품만 넣습니다. 편집 파일은 성찰 기록과 조각 메모를 포함하는 비암호화 개인 백업입니다. 가져오기는 항상 새 작업으로 열며 기존 파일을 덮어쓰지 않습니다.'],
    ['다시 실행과 되돌리기','작품의 실행 취소는 현재 세션의 최대 100회 조작을 보관합니다. 새로고침 뒤에는 최신 작품·기록·남긴 배치를 복원하며 실행 취소 이력은 복원하지 않습니다.'],
    ['오프라인과 인쇄','완전한 오프라인 앱은 아닙니다. 첫 실행과 아직 읽지 않은 재료에는 파일을 제공하는 환경이 필요합니다. 기록지의 PDF 저장은 브라우저 인쇄 대화상자를 사용하며, 브라우저마다 UI가 다릅니다.'],
    ['디자인과 이미지','첫 화면은 DAILYCOACHING의 오리지널 벡터 달항아리 그림입니다. 자개 도안 8종과 파생 조각 96개는 운영자가 직접 디자인한 자료입니다. 달항아리 배경 도안 두 종의 자산 출처는 별도 관리합니다.']
  ])main.append(el('h2',h),el('p',t));
  main.append(el('p',manifest.heroArtwork.credit,{class:'micro'}));
  main.append(el('h2','원문과 참고 자료'),el('p','본 콘텐츠는 제공된 PDF V3와 웹 전환 콘텐츠에 근거합니다. DAILY는 Detect / Acknowledge / Inquire / Link / Your Action을 따릅니다.'));
  for(const s of story.materialSources){const p=el('p',s.citation);if(s.url){const a=el('a',' 자료 보기',{href:s.url,target:'_blank',rel:'noreferrer noopener'});p.append(a);}main.append(p);}
}

function printOptions(){
  const root=el('div');root.append(el('p','종이에 남길 항목을 직접 고르세요. 선택한 내용만 브라우저 인쇄 화면에 나타납니다.'));
  const fields=[['title','작품 제목'],['art','작품 이미지'],['reflections','성찰 기록'],['notes','조각 이름과 메모']];
  for(const [id,text] of fields){const label=el('label',null,{class:'check-row'});label.append(el('input',null,{type:'checkbox','data-print':id}),document.createTextNode(text));root.append(label);}
  const b=button('선택한 내용 인쇄·PDF 저장','print',{class:'primary'});b.onclick=()=>safely(async()=>{
    const selected=[...root.querySelectorAll('input:checked')].map(n=>n.dataset.print);
    if(!selected.length){notice('인쇄할 항목을 하나 이상 선택해 주세요.');return;}
    const doc=clone(editor.doc),sheet=el('article',null,{id:'print-root'});
    sheet.append(el('p','빛을 담는 달항아리 · DAILYCOACHING',{class:'micro'}));
    if(selected.includes('title')&&doc.title)sheet.append(el('h1',doc.title));
    let url=null;
    if(selected.includes('art')){const blob=await exportPNG(doc.scene,materials);url=URL.createObjectURL(blob);const img=el('img',null,{src:url,alt:'달항아리 작품',class:'print-art'});sheet.append(img);await img.decode();}
    if(selected.includes('reflections')){
      for(const s of story.scenes){const present=s.fields.filter(f=>doc.reflections[s.id][f.id]);if(!present.length)continue;sheet.append(el('h2',s.name));for(const f of present)sheet.append(el('h3',f.label),el('p',doc.reflections[s.id][f.id]));}
      if(doc.reflections.ending.presentWord)sheet.append(el('h2','지금 마음에 머무는 말'),el('p',doc.reflections.ending.presentWord));
    }
    if(selected.includes('notes'))for(const n of doc.scene.nodes){const note=doc.pieceNotes[n.instanceId];if(note?.label||note?.memory)sheet.append(el('h2',note.label||n.assetId),el('p',note.memory));}
    closeDialog();$('#print-root')?.remove();document.body.append(sheet);await document.fonts.ready;document.body.classList.add('printing');
    const cleanup=()=>{document.body.classList.remove('printing');sheet.remove();if(url)URL.revokeObjectURL(url);window.removeEventListener('afterprint',cleanup);};
    window.addEventListener('afterprint',cleanup,{once:true});window.print();
  });root.append(b,el('p','PDF 저장은 브라우저 인쇄 대화상자에서 선택합니다. 별도 PDF 파일을 자동 생성하는 기능은 아닙니다.',{class:'micro'}));openDialog('기록지 인쇄·PDF 저장',root);
}

$('#import-file').addEventListener('change',event=>safely(async()=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  if(file.size>5*1024*1024)throw new Error('편집 파일은 5MiB 이하만 열 수 있어요.');
  const doc=parseImport(await file.text(),schema,manifest),root=el('div');
  root.append(el('p',`검증한 편집 파일입니다. 조각 ${doc.scene.nodes.length}개 · 남긴 배치 ${doc.snapshots.length}개. 새 작업으로 열며 기존 작업을 덮어쓰지 않습니다.`));
  const label=el('label',null,{class:'check-row'}),checkbox=el('input',null,{type:'checkbox'});checkbox.checked=available&&(editor?persistent:true);checkbox.disabled=!available;label.append(checkbox,document.createTextNode('이 기기에 저장하며 열기'));root.append(label);
  const b=button('새 작업으로 열기','import-confirm',{class:'primary'});b.onclick=()=>safely(async()=>{
    closeDialog();if(await openProject(importAsNew(doc),checkbox.checked))notice('편집 파일을 새 작업으로 열었어요.');
  });root.append(b);openDialog('편집 파일 확인',root);
}));

document.addEventListener('input',event=>{
  const input=event.target;if(!editor||!input.dataset.field||readOnly||paused)return;
  editor.text(input.dataset.section,input.dataset.field,input.value);
  const limit=Number(input.dataset.limit),count=input.nextElementSibling,used=[...input.value].length;
  count.textContent=`${used} / ${limit}${used>limit?' · 제한을 넘었어요. 전체 글 텍스트 보관 후 줄여 주세요.':''}`;count.classList.toggle('error',used>limit);count.classList.toggle('near-limit',used>=limit*0.85);
  if(used>limit&&!input.parentElement.querySelector('button'))input.parentElement.append(button('전체 글 텍스트 보관','export-text'));
});
document.addEventListener('change',event=>{
  const input=event.target;
  if(!editor||!input.dataset.coordinate||!editable())return;
  if(!Number.isFinite(input.valueAsNumber))return;
  // Do NOT replace the controls DOM in a native change/blur event.
  // Rebuilding it synchronously unmounts the focused field, re-enters
  // change/focus handlers and can throw replaceChildren NotFoundError.
  // A position edit only needs an art redraw and the numeric summary updated.
  editor.transform({[input.dataset.coordinate]:input.valueAsNumber});
  renderCanvas();
  const current=editor.node;
  const summary=$('#controls-panel .panel-heading .micro');
  if(current&&summary)summary.textContent=`${Math.round(current.rotation)}° · ${Math.round(current.width)} × ${Math.round(current.height)}`;
});
document.addEventListener('focusout',event=>{if(event.target.dataset.field&&!event.target.isComposing)queue?.flush();});

const actions={
  home:()=>{location.hash='/';home();},
  'start-guided':()=>start('guided'),'start-free':()=>start('free'),
  resume:()=>{if(editor){location.hash=`/studio/${editor.doc.projectId}`;studio();}else{location.hash='/projects';return projects();}},
  projects:()=>{location.hash='/projects';return projects();},
  guide:()=>{location.hash='/guide';guide();},materials:()=>{location.hash='/about-materials';about();},
  'toggle-mode':()=>{if(editable()){editor.navigate(editor.doc.currentScene,editor.doc.mode==='free'?'guided':'free');studio();}},
  undo:()=>{if(editable()){editor.undo();changed();}},redo:()=>{if(editable()){editor.redo();changed();}},
  duplicate:()=>{if(editable()){editor.duplicate();changed();}},delete:()=>{if(editable()){editor.remove();changed();}},
  lock:()=>{if(editable()){editor.toggleLock();changed();}},forward:()=>{if(editable()){editor.reorder(1);changed();}},backward:()=>{if(editable()){editor.reorder(-1);changed();}},
  center:()=>{if(editable()){editor.transform({x:800,y:900});changed();}},
  clear:()=>{if(editable())confirmAction('작품 비우기','조각과 조각 메모를 비웁니다. 성찰 글은 유지되며 이 작업은 실행 취소할 수 있습니다.',()=>{editor.clear();changed();},'비우기');},
  'zoom-in':()=>{zoom=clamp(zoom+0.25,0.5,2.5);renderCanvas();},'zoom-out':()=>{zoom=clamp(zoom-0.25,0.5,2.5);renderCanvas();},fit:()=>{zoom=1;renderCanvas();},
  pause:()=>setPanel(paused?(editor.doc.mode==='guided'?'story':'palette'):'look'),
  'toggle-lead':()=>{leadExpanded=!leadExpanded;renderSceneLead();},
  snapshot,compare,finish,'piece-note':pieceNote,'save-options':saveOptions,
  continue:()=>{paused=false;viewScene='arrange';if(!readOnly)editor.navigate('arrange');location.hash=`/studio/${editor.doc.projectId}`;studio();},
  'export-png':()=>imageExport(),'card-options':cardOptions,'export-json':backup,
  'export-text':()=>{download(new Blob([JSON.stringify({title:editor.doc.title,reflections:editor.doc.reflections,pieceNotes:editor.doc.pieceNotes},null,2)],{type:'text/plain;charset=utf-8'}),filename('txt'));notice('입력한 글 전체의 텍스트 내려받기를 요청했어요.');},
  import:()=>$('#import-file').click(),'print-options':printOptions,
  'retry-save':async()=>{if(!validateProject(editor.doc,schema,manifest).length){documentInvalid=false;await queue?.retry(editor.doc);}else notice('글자 수 제한을 먼저 확인해 주세요.');},
  fork:async()=>{const copy=importAsNew(editor.doc);if(await openProject(copy,!!repository))notice('현재 내용을 별도 작업으로 열었어요. 저장 상태를 확인해 주세요.');},
  'reload-project':()=>confirmAction('다른 탭의 변경 확인','현재 화면의 미보관 변경 대신 이 기기에 마지막 저장된 내용을 엽니다. 먼저 편집 파일로 보관할 수 있습니다.',async()=>{const doc=await repository.get(editor.doc.projectId);if(!doc)throw new Error('저장된 작업이 없습니다. 현재 내용을 새 작업으로 보관해 주세요.');await openProject(doc,true,doc.revision);},'저장된 내용 열기')
};
document.addEventListener('click',event=>{
  const b=event.target.closest('[data-action]');if(!b||b.disabled)return;
  if(opening)return;
  const action=b.dataset.action;event.preventDefault();
  safely(async()=>{
    if(actions[action])return actions[action]();
    const [type,a,c]=action.split(':');
    if(type==='palette'){palette=a;renderPalette();$(`[data-action="palette:${a}"]`)?.focus();}
    else if(type==='add')await addPiece(a,b);
    else if(type==='control'){if(['move','rotate','size'].includes(a)){controlTab=a;renderControls();$(`[data-action="control:${a}"]`)?.focus({preventScroll:true});}}
    else if(type==='select'){editor.selected=a;renderCanvas();renderControls();setPanel('controls',true);}
    else if(type==='panel')setPanel(a,true);
    else if(type==='scene'){
      viewScene=a;leadExpanded=true;
      if(!readOnly)editor.navigate(a);
      $('.scene-nav')?.replaceWith(navigation());
      renderStory();renderSceneLead();renderLookPrompt();renderCanvas();
      const showMobileLead=matchMedia('(max-width:767px)').matches && editor.doc.mode==='guided';
      setPanel('story',!showMobileLead);
      if(showMobileLead)$('#scene-lead')?.scrollIntoView({block:'start',behavior:'auto'});
      else {const heading=$('#story-panel h2');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});}
      queue?.flush();
    }
    else if(type==='move'&&editable()){const n=editor.node;if(n){editor.transform({x:n.x+Number(a),y:n.y+Number(c)});changed();}}
    else if(type==='rotate'&&editable()){const n=editor.node;if(n){editor.transform({rotation:n.rotation+Number(a)});changed();}}
    else if(type==='size'&&editable()){editor.transform({factor:Number(a)});changed();}
    else if(type==='open'){const doc=await repository.get(a);if(!doc)throw new Error('이 기기에서 작품을 찾지 못했어요. 편집 파일을 열 수 있습니다.');await openProject(doc,true,doc.revision);}
    else if(type==='rename')await renameProject(a);
    else if(type==='delete-project')await deleteProject(a);
  });
});
document.addEventListener('keydown',event=>{
  if(!editor||currentView!=='studio'||modal.open||readOnly||paused||event.isComposing||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  const key=event.key.toLowerCase();
  if((event.ctrlKey||event.metaKey)&&key==='z'){event.preventDefault();event.shiftKey?editor.redo():editor.undo();changed();return;}
  if(key==='delete'||key==='backspace'){if(editor.node){event.preventDefault();editor.remove();changed();}return;}
  const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(directions[event.key]&&editor.node){event.preventDefault();const [x,y]=directions[event.key],step=event.shiftKey?40:8;editor.transform({x:editor.node.x+x*step,y:editor.node.y+y*step});changed();}
});
window.addEventListener('beforeunload',event=>{
  if(editor&&editor.doc.revision>0&&(!persistent||['dirty','saving','error','conflict'].includes(status))){event.preventDefault();event.returnValue='';}
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')queue?.flush();});
window.addEventListener('hashchange',()=>safely(route));
window.addEventListener('resize',()=>{if(editor&&currentView==='studio')renderCanvas();});
function render(){if(currentView==='result')result();else if(editor)studio();else home();}
async function route(){
  const [view,id]=location.hash.replace(/^#\/?/,'').split('/');
  if(view==='studio'||view==='result'){
    if(editor?.doc.projectId===id){if(currentView!==view){currentView=view;render();}return;}
    const doc=repository&&id?await repository.get(id):null;
    if(doc){await openProject(doc,true,doc.revision,view);return;}
    home();notice('이 브라우저에서 작품을 찾지 못했어요. 내 작업에서 편집 파일을 열거나 새로 시작할 수 있습니다.');return;
  }
  if(view==='projects')return projects();if(view==='guide')return guide();if(view==='about-materials')return about();home();
}
async function init(){
  const bundled=globalThis.__MOONJAR_BUNDLE__?.data;
  [story,manifest,schema,empty]=bundled?['story','manifest','schema','empty'].map(name=>clone(bundled[name])):await Promise.all(['story','manifest','schema','empty'].map(async name=>{const r=await fetch(`data/${name}.json?v=20261016-porcelain-v2`,{cache:'no-cache'});if(!r.ok)throw new Error(`${name} 자료가 없습니다.`);return r.json();}));
  materials=new Materials(manifest);
  try{repository=await openRepository();available=true;hasStored=(await repository.list()).length>0;}catch{available=false;}
  await route();
}
init().catch(()=>{main.className='reading-page';main.replaceChildren(header('작업실을 열지 못했어요'),el('p','주소에서 새로고침해 주세요. 계속 열리지 않으면 잠시 뒤 다시 방문해 주세요.'));});
