(() => {
  'use strict';

  const STORAGE_KEY = 'dailycoaching_value_scene_v1';
  const TOTAL_STEPS = 9;
  const data = window.VALUE_SCENE_DATA;
  const app = document.getElementById('app');
  const shellTemplate = document.getElementById('shellTemplate');
  const toast = document.getElementById('toast');
  const resetButton = document.getElementById('resetButton');
  const saveStatus = document.getElementById('saveStatus');

  const freshState = () => ({
    version: 1,
    step: 0,
    mode: '',
    context: '',
    positive18: [],
    positive10: [],
    core5: [],
    friction5: [],
    friction2: [],
    directions: {},
    ratings: {},
    conflict: { a: '', b: '', scene: '' },
    action: { scene: '', behavior: '', obstacle: '', support: '', date: '', firstStep: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: ''
  });

  let state = freshState();
  let savedState = loadSavedState();
  const shuffledValues = seededShuffle(data.values, savedState?.createdAt || new Date().toISOString());
  const shuffledFrictions = seededShuffle(data.frictions, `${savedState?.createdAt || Date.now()}-friction`);

  resetButton.addEventListener('click', () => {
    if (!window.confirm('현재까지의 선택과 기록을 모두 지우고 처음부터 시작할까요?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = freshState();
    savedState = null;
    render();
    announce('기록을 지우고 처음 화면으로 돌아왔습니다.');
  });

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.version === 1 ? parsed : null;
    } catch (error) {
      console.warn('저장된 VALUE SCENE 데이터를 읽지 못했습니다.', error);
      return null;
    }
  }

  function save() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStatus.textContent = '저장됨';
    window.clearTimeout(save._timer);
    save._timer = window.setTimeout(() => { saveStatus.textContent = '자동 저장'; }, 1200);
  }

  function render() {
    const shell = shellTemplate.content.cloneNode(true);
    const progressWrap = shell.querySelector('[data-progress-wrap]');
    const screenRoot = shell.querySelector('[data-screen]');

    if (state.step > 0 && state.step < TOTAL_STEPS) {
      progressWrap.hidden = false;
      const percent = Math.round((state.step / (TOTAL_STEPS - 1)) * 100);
      shell.querySelector('[data-progress-value]').textContent = `${percent}%`;
      shell.querySelector('[data-progress-bar]').style.width = `${percent}%`;
      shell.querySelector('[data-progress-label]').textContent = `STEP ${state.step} · ${stepLabel(state.step)}`;
    }

    screenRoot.innerHTML = screenMarkup();
    app.replaceChildren(shell);
    bindScreenEvents();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function screenMarkup() {
    switch (state.step) {
      case 0: return introScreen();
      case 1: return setupScreen();
      case 2: return valueSelectionScreen('positive18', shuffledValues, 18, '끌리는 가치 18개', '설명보다 먼저, 지금 마음이 반응하는 단어를 골라보세요.', 1);
      case 3: return valueSelectionScreen('positive10', state.positive18, 10, '지금 더 놓치고 싶지 않은 10개', '모두 중요할 수 있습니다. 그래도 지금 이 시기에 우선하고 싶은 가치를 남겨보세요.', 2);
      case 4: return valueSelectionScreen('core5', state.positive10, 5, '나의 핵심가치 5개', '다른 가치를 부정하는 선택이 아닙니다. 현재의 삶을 설명하는 중심 기준 5개를 남깁니다.', 3);
      case 5: return frictionScreen();
      case 6: return directionScreen();
      case 7: return ratingConflictScreen();
      case 8: return actionScreen();
      case 9: return resultScreen();
      default: state.step = 0; return introScreen();
    }
  }

  function introScreen() {
    const resume = savedState && savedState.step > 0 && savedState.step < 9 ? `
      <div class="resume-banner">
        <p><strong>이어갈 수 있는 기록이 있습니다.</strong><br>${formatDate(savedState.updatedAt)}에 STEP ${savedState.step}까지 진행했습니다.</p>
        <button type="button" data-action="resume">이어서 하기</button>
      </div>` : '';
    return `${resume}<section class="screen hero">
      <div class="hero-copy">
        <span class="eyebrow">DAILYCOACHING · COACHING TOOL</span>
        <h1>VALUE <span>SCENE</span></h1>
        <p class="hero-lead">가치를 고르는 데서 끝내지 않습니다. 나를 어렵게 하는 경험, 서로 충돌하는 기준, 실제 삶의 장면을 지나 7일 안에 실행할 작은 행동까지 연결합니다.</p>
        <div class="hero-actions">
          <button class="primary-button" type="button" data-action="start">가치 여정 시작하기</button>
          <a class="secondary-button" href="/">데일리코칭 홈</a>
        </div>
      </div>
      <aside class="hero-panel" aria-label="여정 안내">
        <div class="journey-card">
          <h2>이 여정에서 하는 일</h2>
          <ol class="journey-list">
            <li><b>1</b><span>지금 나를 움직이는 가치에서 핵심 5개를 발견합니다.</span></li>
            <li><b>2</b><span>불편한 경험이 알려주는 원하는 방향을 찾습니다.</span></li>
            <li><b>3</b><span>중요도와 충족도, 가치 간 충돌을 살펴봅니다.</span></li>
            <li><b>4</b><span>실제 장면을 7일 안의 5% 행동으로 바꿉니다.</span></li>
          </ol>
        </div>
        <p class="hero-notice">약 12~18분 · 진단이나 치료 목적이 아닌 자기성찰·코칭 대화 도구입니다. 입력 내용은 서버로 전송하지 않고 현재 브라우저에만 저장됩니다.</p>
      </aside>
    </section>`;
  }

  function setupScreen() {
    return `<section class="screen"><div class="screen-inner">
      ${screenHead('STEP 1', '어떤 방식과 장면으로 탐색할까요?', '혼자 천천히 진행하거나, 코치와 함께 질문을 나누며 사용할 수 있습니다.')}
      <h2 class="subhead">진행 방식</h2>
      <div class="mode-grid">
        ${optionCard('mode', 'self', 'SELF', '혼자 탐색', '화면의 안내를 따라 자신의 속도로 기록합니다.', state.mode === 'self')}
        ${optionCard('mode', 'coach', 'COACH', '코치와 함께', '각 단계의 코치 질문과 진행 포인트를 함께 봅니다.', state.mode === 'coach')}
      </div>
      <h2 class="subhead spaced">지금 살펴볼 장면</h2>
      <div class="context-grid">
        ${data.contexts.map(item => optionCard('context', item.id, item.icon, item.title, item.description, state.context === item.id)).join('')}
      </div>
      ${coachPanel(1)}
      ${navRow(false, Boolean(state.mode && state.context), '선택한 맥락은 결과 해석과 행동 설계에 반영됩니다.')}
    </div></section>`;
  }

  function valueSelectionScreen(key, words, limit, title, description, coachIndex) {
    const selected = state[key];
    return `<section class="screen"><div class="screen-inner">
      ${screenHead(`STEP ${state.step}`, title, description, `${selected.length} / ${limit}`)}
      <div class="word-toolbar"><p class="hint">단어의 사전적 정의보다, 지금의 나에게 먼저 닿는 의미를 기준으로 선택하세요.</p><button class="back-button compact" type="button" data-action="clear-selection">선택 지우기</button></div>
      <div class="word-grid" role="group" aria-label="가치 단어 선택">
        ${words.map(word => wordButton(word, selected.includes(word), key)).join('')}
      </div>
      ${coachPanel(coachIndex)}
      ${navRow(true, selected.length === limit, `${limit}개를 모두 선택하면 다음 단계로 이동할 수 있습니다.`)}
    </div></section>`;
  }

  function frictionScreen() {
    return `<section class="screen"><div class="screen-inner">
      ${screenHead('STEP 5', '요즘 나를 어렵게 하는 경험 5개', '없애야 할 나쁜 감정을 고르는 단계가 아닙니다. 최근 나의 에너지를 많이 쓰게 한 경험을 선택합니다.', `${state.friction5.length} / 5`)}
      <div class="word-grid" role="group" aria-label="어려운 경험 선택">
        ${shuffledFrictions.map(item => wordButton(item.name, state.friction5.includes(item.name), 'friction5')).join('')}
      </div>
      ${coachPanel(4)}
      ${navRow(true, state.friction5.length === 5, '최근 2~4주 안에 자주 나타난 경험을 기준으로 선택하세요.')}
    </div></section>`;
  }

  function directionScreen() {
    const selectedComplete = state.friction2.length === 2 && state.friction2.every(name => state.directions[name]);
    const cards = state.friction5.map(name => {
      const item = data.frictions.find(x => x.name === name);
      const active = state.friction2.includes(name);
      return `<article class="friction-card">
        <div class="friction-card-head">
          <div><h3>${escapeHtml(name)}</h3><p class="hint">지금 더 깊게 살펴볼 경험으로 선택</p></div>
          <button class="word-chip" type="button" data-friction-focus="${escapeAttr(name)}" aria-pressed="${active}">${active ? '선택됨' : '선택'}</button>
        </div>
        ${active ? `<div class="direction-grid" role="group" aria-label="${escapeAttr(name)}에서 원하는 방향">
          ${item.directions.map(direction => `<button class="direction-button" type="button" data-direction-friction="${escapeAttr(name)}" data-direction="${escapeAttr(direction)}" aria-pressed="${state.directions[name] === direction}">${escapeHtml(direction)}</button>`).join('')}
        </div>` : ''}
      </article>`;
    }).join('');
    return `<section class="screen"><div class="screen-inner">
      ${screenHead('STEP 6', '두 경험이 알려주는 원하는 방향', '선택한 5개 중 지금 가장 에너지를 많이 쓰게 하는 2개를 고르고, 그 경험 속에서도 선택하고 싶은 방향을 정합니다.', `${state.friction2.length} / 2`)}
      <div class="friction-list">${cards}</div>
      ${coachPanel(5)}
      ${navRow(true, selectedComplete, '경험마다 원하는 방향을 하나씩 선택하세요.')}
    </div></section>`;
  }

  function ratingConflictScreen() {
    const completeRatings = state.core5.every(word => state.ratings[word] && Number.isFinite(state.ratings[word].importance) && Number.isFinite(state.ratings[word].fulfillment));
    const validConflict = state.conflict.a && state.conflict.b && state.conflict.a !== state.conflict.b && state.conflict.scene.trim().length >= 10;
    return `<section class="screen"><div class="screen-inner">
      ${screenHead('STEP 7', '가치의 현재 상태와 충돌 장면', '각 가치가 얼마나 중요한지, 지금 삶에서 얼마나 살아 있는지 살펴본 뒤 서로 부딪히는 두 가치를 선택합니다.')}
      <div class="rating-list">
        ${state.core5.map(word => ratingCard(word)).join('')}
      </div>
      <div class="coach-panel"><strong>가치 충돌 찾기</strong><p>예: 안정과 도전, 성취와 관계, 자유와 책임처럼 둘 다 중요하지만 같은 순간에 함께 지키기 어려웠던 장면을 떠올려 보세요.</p></div>
      <div class="conflict-grid">
        <div class="conflict-column"><h3>먼저 지키고 싶었던 가치</h3>${radioList('conflict-a', state.conflict.a)}</div>
        <div class="conflict-column"><h3>함께 지키기 어려웠던 가치</h3>${radioList('conflict-b', state.conflict.b)}</div>
      </div>
      <div class="field full" style="margin-top:16px"><label for="conflictScene">실제 충돌 장면</label><small>언제, 누구와, 어떤 선택 앞에서 두 가치가 부딪혔나요?</small><textarea id="conflictScene" data-field="conflict.scene" placeholder="예: 새로운 프로젝트를 맡고 싶었지만, 가족과 보내기로 한 시간을 지키고 싶어 망설였다.">${escapeHtml(state.conflict.scene)}</textarea></div>
      ${coachPanel(7)}
      ${navRow(true, completeRatings && validConflict, '충돌 장면은 10자 이상 기록해 주세요.')}
    </div></section>`;
  }

  function actionScreen() {
    const a = state.action;
    const complete = [a.scene, a.behavior, a.obstacle, a.support, a.date, a.firstStep].every(value => String(value).trim().length > 0);
    const contextTitle = data.contexts.find(item => item.id === state.context)?.title || '삶';
    return `<section class="screen"><div class="screen-inner">
      ${screenHead('STEP 8', '가치를 7일 안의 5% 행동으로', `선택한 가치를 ${contextTitle}의 실제 장면에서 확인할 수 있는 작은 행동으로 바꿉니다.`)}
      <div class="form-grid">
        ${field('action.scene','행동을 적용할 장면','어디서, 누구와, 어떤 상황에서 실행할까요?',a.scene,'예: 월요일 팀 회의에서')}
        ${field('action.date','실행 날짜','7일 안의 구체적인 날짜를 정하세요.',a.date,'', 'date')}
        ${field('action.behavior','눈에 보이는 행동','누가 보아도 실행 여부를 알 수 있게 적어보세요.',a.behavior,'예: 회의 시작 전 내 의견을 한 문장으로 먼저 말한다.', 'textarea', true)}
        ${field('action.firstStep','첫 5분 행동','실행을 시작하기 위해 가장 먼저 할 일은 무엇인가요?',a.firstStep,'예: 일요일 저녁에 말할 한 문장을 메모한다.', 'textarea', true)}
        ${field('action.obstacle','예상되는 방해','실행을 막을 가능성이 가장 높은 것은 무엇인가요?',a.obstacle,'예: 괜히 튀어 보일까 걱정되어 말을 미루는 것', 'textarea')}
        ${field('action.support','나를 도울 장치','사람, 환경, 문장, 알림 중 무엇을 활용할까요?',a.support,'예: 회의 10분 전 휴대폰 알림과 메모 카드', 'textarea')}
      </div>
      ${coachPanel(8)}
      ${navRow(true, complete, '모든 칸을 채우면 나의 VALUE SCENE 결과가 완성됩니다.', '결과 만들기')}
    </div></section>`;
  }

  function resultScreen() {
    const context = data.contexts.find(item => item.id === state.context)?.title || '삶 전체';
    const directions = state.friction2.map(name => `${name} → ${state.directions[name]}`);
    const sorted = state.core5.map(word => ({ word, ...state.ratings[word], gap: state.ratings[word].importance - state.ratings[word].fulfillment })).sort((a,b) => b.gap - a.gap);
    const focus = sorted[0];
    const alive = [...sorted].sort((a,b) => b.fulfillment - a.fulfillment)[0];
    const questions = [
      `‘${focus.word}’이 지금보다 1점 더 살아난다면 ${context}의 어떤 장면이 달라질까요?`,
      `‘${state.conflict.a}’와 ‘${state.conflict.b}’를 둘 다 존중할 수 있는 제3의 선택은 무엇일까요?`,
      `이번 행동을 실행한 뒤, 나에게 어떤 증거가 남으면 “가치대로 움직였다”고 말할 수 있을까요?`
    ];
    state.completedAt = state.completedAt || new Date().toISOString();
    save();
    return `<section class="screen">
      <div class="result-hero">
        <span class="eyebrow">MY VALUE SCENE</span>
        <h1>가치는 생각이 아니라<br>삶의 장면에서 드러납니다.</h1>
        <p>${escapeHtml(context)}을 중심으로 발견한 핵심가치와 원하는 방향, 충돌 장면, 다음 행동을 한 장에 정리했습니다.</p>
      </div>
      <div class="result-content">
        <section class="result-section"><h2>나의 핵심가치 5</h2><div class="value-result-grid">
          ${sorted.map(item => `<div class="value-result ${item.gap >= 4 ? 'gap-high' : ''}"><strong>${escapeHtml(item.word)}</strong><span>중요 ${item.importance} · 현재 ${item.fulfillment}</span></div>`).join('')}
        </div></section>
        <section class="result-section"><h2>지금 읽어볼 흐름</h2><div class="result-columns">
          <div class="result-box"><h3>가장 살아 있는 가치</h3><p><strong>${escapeHtml(alive.word)}</strong>이 현재 삶에서 비교적 잘 표현되고 있습니다. 이 가치가 살아나는 조건을 다른 장면에도 옮겨볼 수 있습니다.</p></div>
          <div class="result-box"><h3>대화가 필요한 가치</h3><p><strong>${escapeHtml(focus.word)}</strong>은 중요도와 현재 충족도의 차이가 가장 큽니다. 부족함의 판정이 아니라 다음 코칭 대화의 우선 지점입니다.</p></div>
        </div></section>
        <section class="result-section"><h2>어려운 경험이 가리킨 방향</h2><div class="result-columns">
          ${directions.map(text => `<div class="result-box"><h3>${escapeHtml(text.split(' → ')[0])}</h3><p>이 경험을 없애기보다, 그 안에서 <strong>${escapeHtml(text.split(' → ')[1])}</strong>을 선택하는 방향을 발견했습니다.</p></div>`).join('')}
        </div></section>
        <section class="result-section"><h2>가치 충돌 장면</h2><div class="result-box"><h3>${escapeHtml(state.conflict.a)} × ${escapeHtml(state.conflict.b)}</h3><p>${nl2br(state.conflict.scene)}</p></div></section>
        <section class="result-section"><h2>7일 VALUE ACTION</h2><div class="action-statement"><strong>${escapeHtml(formatDateOnly(state.action.date))}</strong>, ${escapeHtml(state.action.scene)}에서<br>${nl2br(state.action.behavior)}<br><br><small>첫 5분 행동: ${escapeHtml(state.action.firstStep)}<br>예상 방해: ${escapeHtml(state.action.obstacle)}<br>지원 장치: ${escapeHtml(state.action.support)}</small></div></section>
        <section class="result-section"><h2>다음 코칭 질문</h2><ol class="question-list">${questions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ol></section>
        <section class="result-section"><h2>결과 활용</h2><div class="result-actions"><button class="copy-button" type="button" data-action="copy-result">텍스트 복사</button><button class="print-button" type="button" data-action="print">인쇄 · PDF 저장</button><button class="restart-button" type="button" data-action="edit-action">행동 다시 설계</button></div></section>
      </div>
    </section>`;
  }

  function bindScreenEvents() {
    app.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', handleAction));
    app.querySelectorAll('[data-option-group]').forEach(button => button.addEventListener('click', handleOption));
    app.querySelectorAll('[data-word-key]').forEach(button => button.addEventListener('click', handleWord));
    app.querySelectorAll('[data-friction-focus]').forEach(button => button.addEventListener('click', handleFrictionFocus));
    app.querySelectorAll('[data-direction-friction]').forEach(button => button.addEventListener('click', handleDirection));
    app.querySelectorAll('[data-rating-word]').forEach(input => input.addEventListener('input', handleRating));
    app.querySelectorAll('input[name="conflict-a"],input[name="conflict-b"]').forEach(input => input.addEventListener('change', handleConflict));
    app.querySelectorAll('[data-field]').forEach(field => field.addEventListener('input', handleField));
  }

  function handleAction(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'start') { state = freshState(); state.step = 1; save(); render(); }
    if (action === 'resume') { state = savedState; render(); }
    if (action === 'next') { normalizeBeforeNext(); state.step += 1; save(); render(); }
    if (action === 'back') { state.step = Math.max(0, state.step - 1); save(); render(); }
    if (action === 'clear-selection') { clearCurrentSelection(); save(); render(); }
    if (action === 'copy-result') copyResult();
    if (action === 'print') window.print();
    if (action === 'edit-action') { state.step = 8; render(); }
  }

  function handleOption(event) {
    const button = event.currentTarget;
    state[button.dataset.optionGroup] = button.dataset.optionValue;
    save(); render();
  }

  function handleWord(event) {
    const button = event.currentTarget;
    const key = button.dataset.wordKey;
    const word = button.dataset.word;
    const limit = { positive18:18, positive10:10, core5:5, friction5:5 }[key];
    toggleLimited(state[key], word, limit);
    if (key === 'friction5') {
      state.friction2 = state.friction2.filter(item => state.friction5.includes(item));
      Object.keys(state.directions).forEach(item => { if (!state.friction5.includes(item)) delete state.directions[item]; });
    }
    save(); render();
  }

  function handleFrictionFocus(event) {
    const name = event.currentTarget.dataset.frictionFocus;
    toggleLimited(state.friction2, name, 2);
    Object.keys(state.directions).forEach(item => { if (!state.friction2.includes(item)) delete state.directions[item]; });
    save(); render();
  }

  function handleDirection(event) {
    state.directions[event.currentTarget.dataset.directionFriction] = event.currentTarget.dataset.direction;
    save(); render();
  }

  function handleRating(event) {
    const input = event.currentTarget;
    const word = input.dataset.ratingWord;
    const type = input.dataset.ratingType;
    state.ratings[word] = state.ratings[word] || { importance:8, fulfillment:5 };
    state.ratings[word][type] = Number(input.value);
    const output = input.parentElement.querySelector('output');
    if (output) output.textContent = input.value;
    save();
  }

  function handleConflict(event) {
    const input = event.currentTarget;
    if (input.name === 'conflict-a') state.conflict.a = input.value;
    if (input.name === 'conflict-b') state.conflict.b = input.value;
    save(); render();
  }

  function handleField(event) {
    setNested(state, event.currentTarget.dataset.field, event.currentTarget.value);
    save();
    const next = app.querySelector('[data-action="next"]');
    if (next) next.disabled = !isCurrentStepComplete();
  }

  function normalizeBeforeNext() {
    if (state.step === 2) state.positive10 = state.positive10.filter(word => state.positive18.includes(word));
    if (state.step === 3) state.core5 = state.core5.filter(word => state.positive10.includes(word));
    if (state.step === 4) {
      const nextRatings = {};
      state.core5.forEach(word => { nextRatings[word] = state.ratings[word] || { importance:8, fulfillment:5 }; });
      state.ratings = nextRatings;
    }
  }

  function clearCurrentSelection() {
    const key = {2:'positive18',3:'positive10',4:'core5'}[state.step];
    if (key) state[key] = [];
  }

  function isCurrentStepComplete() {
    if (state.step === 7) {
      const ratings = state.core5.every(word => state.ratings[word]);
      return ratings && state.conflict.a && state.conflict.b && state.conflict.a !== state.conflict.b && state.conflict.scene.trim().length >= 10;
    }
    if (state.step === 8) return Object.values(state.action).every(value => String(value).trim());
    return true;
  }

  function copyResult() {
    const text = resultText();
    navigator.clipboard.writeText(text).then(() => announce('결과를 복사했습니다.')).catch(() => {
      const area = document.createElement('textarea'); area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); announce('결과를 복사했습니다.');
    });
  }

  function resultText() {
    const sorted = state.core5.map(word => ({ word, ...state.ratings[word], gap: state.ratings[word].importance - state.ratings[word].fulfillment })).sort((a,b)=>b.gap-a.gap);
    return [
      '[DAILYCOACHING VALUE SCENE]',
      `맥락: ${data.contexts.find(item => item.id === state.context)?.title || ''}`,
      `핵심가치: ${state.core5.join(', ')}`,
      `가치 상태: ${sorted.map(item => `${item.word}(중요 ${item.importance}/현재 ${item.fulfillment})`).join(' · ')}`,
      `원하는 방향: ${state.friction2.map(name => `${name} → ${state.directions[name]}`).join(' · ')}`,
      `가치 충돌: ${state.conflict.a} × ${state.conflict.b}`,
      `충돌 장면: ${state.conflict.scene}`,
      `7일 행동: ${state.action.date} / ${state.action.scene} / ${state.action.behavior}`,
      `첫 5분 행동: ${state.action.firstStep}`,
      `예상 방해: ${state.action.obstacle}`,
      `지원 장치: ${state.action.support}`,
      '',
      '※ 본 결과는 진단이 아닌 자기성찰과 코칭 대화를 위한 자료입니다.'
    ].join('\n');
  }

  function screenHead(badge, title, description, count='') {
    return `<div class="screen-head"><div><span class="step-badge">${badge}</span><h1 class="screen-title">${title}</h1><p class="screen-description">${description}</p></div>${count ? `<div class="selection-count"><strong>${count}</strong><span>선택 현황</span></div>` : ''}</div>`;
  }

  function optionCard(group, value, icon, title, description, active) {
    return `<button class="option-card" type="button" data-option-group="${group}" data-option-value="${value}" aria-pressed="${active}"><span class="check">✓</span><span class="icon">${icon}</span><h3>${title}</h3><p>${description}</p></button>`;
  }

  function wordButton(word, active, key) {
    return `<button class="word-chip" type="button" data-word-key="${key}" data-word="${escapeAttr(word)}" aria-pressed="${active}">${escapeHtml(word)}</button>`;
  }

  function coachPanel(index) {
    if (state.mode !== 'coach') return '';
    return `<aside class="coach-panel"><strong>코치 진행 포인트</strong><p>${data.coachPrompts[index] || ''}</p></aside>`;
  }

  function navRow(showBack, canNext, note, nextLabel='다음 단계') {
    return `<div class="nav-row">${showBack ? '<button class="back-button" type="button" data-action="back">이전</button>' : '<span></span>'}<p class="nav-note">${note}</p><button class="next-button" type="button" data-action="next" ${canNext ? '' : 'disabled'}>${nextLabel}</button></div>`;
  }

  function ratingCard(word) {
    const rating = state.ratings[word] || { importance:8, fulfillment:5 };
    state.ratings[word] = rating;
    return `<article class="rating-card"><div class="rating-word">${escapeHtml(word)}</div>
      <div class="range-wrap"><label>중요도 <output>${rating.importance}</output></label><input type="range" min="0" max="10" step="1" value="${rating.importance}" data-rating-word="${escapeAttr(word)}" data-rating-type="importance" aria-label="${escapeAttr(word)} 중요도"></div>
      <div class="range-wrap"><label>현재 충족도 <output>${rating.fulfillment}</output></label><input type="range" min="0" max="10" step="1" value="${rating.fulfillment}" data-rating-word="${escapeAttr(word)}" data-rating-type="fulfillment" aria-label="${escapeAttr(word)} 현재 충족도"></div>
    </article>`;
  }

  function radioList(name, selected) {
    return `<div class="radio-list">${state.core5.map(word => `<label class="radio-option"><input type="radio" name="${name}" value="${escapeAttr(word)}" ${selected === word ? 'checked' : ''}><span>${escapeHtml(word)}</span></label>`).join('')}</div>`;
  }

  function field(path, label, help, value, placeholder, type='text', full=false) {
    const id = path.replace('.', '-');
    const className = full ? 'field full' : 'field';
    if (type === 'textarea') return `<div class="${className}"><label for="${id}">${label}</label><small>${help}</small><textarea id="${id}" data-field="${path}" placeholder="${escapeAttr(placeholder)}">${escapeHtml(value)}</textarea></div>`;
    return `<div class="${className}"><label for="${id}">${label}</label><small>${help}</small><input id="${id}" type="${type}" data-field="${path}" value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}"></div>`;
  }

  function toggleLimited(list, value, limit) {
    const index = list.indexOf(value);
    if (index >= 0) { list.splice(index, 1); return; }
    if (list.length >= limit) { announce(`${limit}개까지 선택할 수 있습니다.`); return; }
    list.push(value);
  }

  function setNested(target, path, value) {
    const parts = path.split('.');
    let cursor = target;
    parts.slice(0,-1).forEach(part => { cursor[part] = cursor[part] || {}; cursor = cursor[part]; });
    cursor[parts.at(-1)] = value;
  }

  function stepLabel(step) {
    return ['시작','방식과 맥락','가치 18','가치 10','핵심 5','어려운 경험','원하는 방향','가치 상태와 충돌','5% 행동'][step] || '결과';
  }

  function announce(message) {
    toast.textContent = message; toast.classList.add('is-visible'); window.clearTimeout(announce._timer); announce._timer = window.setTimeout(() => toast.classList.remove('is-visible'), 1800);
  }

  function seededShuffle(array, seedText) {
    const result = [...array];
    let seed = Array.from(String(seedText)).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
    const random = () => { seed += 0x6D2B79F5; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }

  function formatDate(iso) { try { return new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)); } catch { return ''; } }
  function formatDateOnly(value) { if (!value) return ''; try { return new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date(`${value}T00:00:00`)); } catch { return value; } }
  function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
  function escapeAttr(value='') { return escapeHtml(value); }
  function nl2br(value='') { return escapeHtml(value).replace(/\n/g,'<br>'); }

  render();
})();
