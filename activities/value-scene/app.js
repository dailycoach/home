(() => {
  'use strict';

  const STORAGE_KEY = 'dailycoaching_value_scene_v1';
  const LAST_JOURNEY_STEP = 8;
  const data = window.VALUE_SCENE_DATA;
  const app = document.getElementById('app');
  const shellTemplate = document.getElementById('shellTemplate');
  const toast = document.getElementById('toast');
  const resetButton = document.getElementById('resetButton');
  const saveStatus = document.getElementById('saveStatus');

  const freshState = () => ({
    version: 2,
    step: 0,
    mode: 'self',
    context: 'whole',
    positive18: [],
    positive10: [],
    core5: [],
    friction5: [],
    friction2: [],
    directions: {},
    realScene: { title: '', detail: '', direction: '' },
    ratings: {},
    conflict: { a: '', b: '', scene: '' },
    action: { scene: '', behavior: '', obstacle: '', support: '', date: '', firstStep: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: ''
  });

  let state = freshState();
  let savedState = loadSavedState();
  let activeCategory = 'all';
  let showAllValues = false;
  const seed = savedState?.createdAt || new Date().toISOString();
  const shuffledValues = seededShuffle(data.values, seed);
  const shuffledFrictions = seededShuffle(data.frictions, `${seed}-friction`);

  resetButton.addEventListener('click', () => {
    if (!window.confirm('지금까지 편집한 장면을 지우고 완전히 새로 시작할까요?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = freshState();
    savedState = null;
    activeCategory = 'all';
    showAllValues = false;
    render();
    announce('새 장면을 시작할 준비가 됐어요.');
  });

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return migrateState(JSON.parse(raw));
    } catch (error) {
      console.warn('저장된 VALUE SCENE 데이터를 읽지 못했습니다.', error);
      return null;
    }
  }

  function migrateState(parsed) {
    if (!parsed || ![1, 2].includes(parsed.version)) return null;
    const base = freshState();
    const next = {
      ...base,
      ...parsed,
      version: 2,
      realScene: { ...base.realScene, ...(parsed.realScene || {}) },
      conflict: { ...base.conflict, ...(parsed.conflict || {}) },
      action: { ...base.action, ...(parsed.action || {}) }
    };

    const rename = word => word === '책임' ? '책임감' : word;
    ['positive18', 'positive10', 'core5'].forEach(key => {
      next[key] = Array.isArray(next[key]) ? next[key].map(rename) : [];
    });
    next.friction5 = Array.isArray(next.friction5) ? next.friction5 : [];
    next.friction2 = Array.isArray(next.friction2) ? next.friction2 : [];
    next.conflict.a = rename(next.conflict.a);
    next.conflict.b = rename(next.conflict.b);
    next.ratings = Object.entries(parsed.ratings || {}).reduce((acc, [word, rating]) => {
      acc[rename(word)] = rating;
      return acc;
    }, {});
    next.directions = Object.entries(parsed.directions || {}).reduce((acc, [friction, direction]) => {
      acc[friction] = rename(direction);
      return acc;
    }, {});

    if (parsed.version === 1) {
      const stepMap = { 0:0, 1:1, 2:1, 3:2, 4:3, 5:4, 6:5, 7:6, 8:8, 9:9 };
      next.step = stepMap[parsed.step] ?? 0;
      next.realScene = {
        title: parsed.action?.scene || '',
        detail: parsed.conflict?.scene || '',
        direction: parsed.friction2?.[0] ? parsed.directions?.[parsed.friction2[0]] || '' : ''
      };
      if (next.step >= 6 && !isRealSceneComplete(next.realScene)) next.step = 6;
    }

    if (!data.contexts.some(item => item.id === next.context)) next.context = 'whole';
    if (!['self', 'coach'].includes(next.mode)) next.mode = 'self';
    return next;
  }

  function save() {
    try {
      state.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      savedState = migrateState(state);
      saveStatus.textContent = 'SAVED';
      window.clearTimeout(save._timer);
      save._timer = window.setTimeout(() => { saveStatus.textContent = 'LOCAL SAVE'; }, 1200);
    } catch (error) {
      console.warn('VALUE SCENE 기록을 저장하지 못했습니다.', error);
      saveStatus.textContent = 'SAVE OFF';
    }
  }

  function render() {
    const shell = shellTemplate.content.cloneNode(true);
    const progressWrap = shell.querySelector('[data-progress-wrap]');
    const screenRoot = shell.querySelector('[data-screen]');

    if (state.step > 0 && state.step <= LAST_JOURNEY_STEP) {
      progressWrap.hidden = false;
      const percent = Math.round((state.step / LAST_JOURNEY_STEP) * 100);
      shell.querySelector('[data-progress-number]').textContent = String(state.step).padStart(2, '0');
      shell.querySelector('[data-progress-name]').textContent = stepLabel(state.step);
      shell.querySelector('[data-progress-value]').textContent = `${state.step} / ${LAST_JOURNEY_STEP}`;
      shell.querySelector('[data-progress-bar]').style.width = `${percent}%`;
      shell.querySelector('[data-progress-bar]').parentElement.setAttribute('aria-valuenow', String(percent));
    }

    screenRoot.innerHTML = screenMarkup();
    app.replaceChildren(shell);
    bindScreenEvents();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  function screenMarkup() {
    switch (state.step) {
      case 0: return introScreen();
      case 1: return pickScreen();
      case 2: return cutScreen('positive10', state.positive18, 10, 'CUT THE NOISE', '다 좋아 보여도, 이번엔 덜어낼게.', '남길수록 선명해져.', 2);
      case 3: return cutScreen('core5', state.positive10, 5, 'KEEP 5', '끝까지 남길 다섯 단어.', '지금의 너를 움직이는 축이야.', 3);
      case 4: return frictionScreen();
      case 5: return directionScreen();
      case 6: return realSceneScreen();
      case 7: return clashScreen();
      case 8: return actionScreen();
      case 9: return resultScreen();
      default: state.step = 0; return introScreen();
    }
  }

  function introScreen() {
    const resume = savedState && savedState.step > 0 ? `
      <div class="resume-banner">
        <div><span class="micro-label">STILL HERE</span><p><strong>남겨둔 장면이 있어요.</strong><br>${formatDate(savedState.updatedAt)} · ${savedState.step === 9 ? 'MY WORD SCENE 완성' : `${stepLabel(savedState.step)}까지 편집`}</p></div>
        <button type="button" data-action="resume">${savedState.step === 9 ? 'RESULT' : 'CONTINUE'} ↗</button>
      </div>` : '';

    return `${resume}<section class="screen hero">
      <div class="hero-tape" aria-hidden="true">EDIT YOUR NOW · EDIT YOUR NOW · EDIT YOUR NOW ·</div>
      <div class="hero-copy">
        <span class="eyebrow">DAILYCOACHING / VALUE TOOL 02</span>
        <h1><span>WHAT</span><span class="outline-word">STAYS?</span></h1>
        <p class="hero-hook">끝까지 남는 단어는,<br>지금의 너를 말해준다.</p>
        <p class="hero-lead">좋아 보이는 답 말고 먼저 반응한 말. 그 말을 실제 장면과 이번 주의 작은 움직임까지 데려갑니다.</p>
        <div class="hero-word-stack" aria-hidden="true">
          <span>자유</span><span>연결</span><span>성장</span><span>용기</span><span>나답게</span>
        </div>
      </div>
      <aside class="hero-panel" aria-label="시작 설정">
        <div class="cover-control">
          <div class="control-heading"><span>01</span><div><strong>HOW</strong><small>어떻게 해볼래?</small></div></div>
          <div class="cover-choice-grid">
            ${coverChoice('mode', 'self', 'SELF', '혼자 빠르게', state.mode === 'self')}
            ${coverChoice('mode', 'coach', 'COACH', '대화하며 깊게', state.mode === 'coach')}
          </div>
        </div>
        <div class="cover-control">
          <div class="control-heading"><span>02</span><div><strong>WHERE</strong><small>어느 장면을 볼래?</small></div></div>
          <div class="context-pills">
            ${data.contexts.map(item => `<button type="button" data-option-group="context" data-option-value="${item.id}" aria-pressed="${state.context === item.id}"><b>${item.icon}</b><span>${item.title}</span></button>`).join('')}
          </div>
        </div>
        <button class="primary-button cover-start" type="button" data-action="start"><span>START</span><b>→</b></button>
        <p class="hero-notice"><b>10—15 MIN</b> · 입력은 이 기기에만 저장돼요.<br>진단지가 아니라 코칭 대화를 여는 편집 도구입니다.</p>
      </aside>
    </section>`;
  }

  function pickScreen() {
    const selected = state.positive18;
    const visibleValues = activeCategory === 'all'
      ? (showAllValues ? shuffledValues : shuffledValues.slice(0, 24))
      : data.values.filter(item => item.category === activeCategory);

    return `<section class="screen"><div class="screen-inner">
      ${screenHead('01 / PICK', 'PICK YOUR WORDS', '지금 눈에 먼저 들어오는 걸 골라봐.', '정답 말고, 반응 먼저.', `${selected.length} / 18`)}
      <div class="category-bar" role="group" aria-label="단어 묶음 필터">
        <button type="button" data-value-filter="all" aria-pressed="${activeCategory === 'all'}">FIRST 24</button>
        ${data.categories.map(item => `<button type="button" data-value-filter="${item.id}" aria-pressed="${activeCategory === item.id}">${item.label} <span>${item.title}</span></button>`).join('')}
      </div>
      ${selectedShelf(selected, 18)}
      <div class="word-toolbar"><p class="hint">단어의 뜻을 분석하기 전에, 시선이 멈춘 카드부터 눌러봐.</p>${activeCategory === 'all' ? `<button class="text-button" type="button" data-action="toggle-all-values">${showAllValues ? 'FIRST 24' : 'SHOW ALL 96'} ↗</button>` : '<span class="micro-label">24 WORDS</span>'}</div>
      <div class="word-grid word-grid--editorial" role="group" aria-label="가치 단어 선택">
        ${visibleValues.map((item, index) => wordCard(item, selected.includes(item.name), 'positive18', index, 'pick')).join('')}
      </div>
      ${coachPanel(1)}
      ${navRow(true, selected.length === 18, '18개가 차면 다음 편집으로 넘어갈 수 있어요.', 'NEXT / CUT')}
    </div></section>`;
  }

  function cutScreen(key, words, limit, title, description, subcopy, coachIndex) {
    const selected = state[key];
    const metas = words.map(getValueMeta).filter(Boolean);
    return `<section class="screen"><div class="screen-inner">
      ${screenHead(`${String(state.step).padStart(2, '0')} / ${state.step === 2 ? 'CUT' : 'KEEP'}`, title, description, subcopy, `${selected.length} / ${limit}`)}
      ${selectedShelf(selected, limit)}
      <div class="word-toolbar"><p class="hint">남길 카드는 선명하게, 덜어낸 카드는 뒤로 물러나요. 다시 누르면 되돌릴 수 있어요.</p><button class="text-button" type="button" data-action="restore-selection">RESTORE ALL</button></div>
      <div class="word-grid word-grid--cut" role="group" aria-label="${escapeAttr(title)} 단어 편집">
        ${metas.map((item, index) => wordCard(item, selected.includes(item.name), key, index, 'cut')).join('')}
      </div>
      ${coachPanel(coachIndex)}
      ${navRow(true, selected.length === limit, `${limit}개가 남으면 다음으로 갈 수 있어요.`, state.step === 2 ? 'NEXT / KEEP 5' : 'NEXT / NOT THIS')}
    </div></section>`;
  }

  function frictionScreen() {
    return `<section class="screen"><div class="screen-inner">
      ${screenHead('04 / NOT THIS', 'NOT THIS', '요즘 자꾸 걸리는 것.', '에너지를 잡아먹는 쪽을 골라봐.', `${state.friction5.length} / 5`)}
      <div class="friction-pick-grid" role="group" aria-label="요즘 걸리는 경험 선택">
        ${shuffledFrictions.map((item, index) => frictionButton(item, state.friction5.includes(item.name), index)).join('')}
      </div>
      ${coachPanel(4)}
      ${navRow(true, state.friction5.length === 5, '최근 2—4주에 자주 나타난 장면을 기준으로 골라봐.', 'NEXT / BUT THIS')}
    </div></section>`;
  }

  function directionScreen() {
    const selectedComplete = state.friction2.length === 2 && state.friction2.every(name => state.directions[name]);
    const cards = state.friction5.map((name, index) => {
      const item = getFrictionMeta(name);
      const active = state.friction2.includes(name);
      return `<article class="direction-card ${active ? 'is-active' : ''}" style="--i:${index}">
        <div class="direction-card-head">
          <div><span class="micro-label">NOT THIS</span><h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.note)}</p></div>
          <button class="focus-toggle" type="button" data-friction-focus="${escapeAttr(name)}" aria-pressed="${active}">${active ? 'FOCUS ✓' : 'FOCUS'}</button>
        </div>
        ${active ? `<div class="direction-choice" role="group" aria-label="${escapeAttr(item.label)}의 반대편 방향">
          <span class="micro-label">BUT THIS →</span>
          ${item.directions.map(direction => `<button type="button" data-direction-friction="${escapeAttr(name)}" data-direction="${escapeAttr(direction)}" aria-pressed="${state.directions[name] === direction}">${escapeHtml(direction)}</button>`).join('')}
        </div>` : ''}
      </article>`;
    }).join('');

    return `<section class="screen"><div class="screen-inner">
      ${screenHead('05 / BUT THIS', 'BUT THIS', '근데 사실 네가 원하는 건 이쪽일 수도 있어.', '피하고 싶은 것 말고, 향하고 싶은 것.', `${state.friction2.length} / 2`)}
      <div class="direction-list">${cards}</div>
      ${coachPanel(5)}
      ${navRow(true, selectedComplete, '두 장면을 FOCUS하고, 각각 향하고 싶은 말을 하나씩 골라봐.', 'NEXT / REAL SCENE')}
    </div></section>`;
  }

  function realSceneScreen() {
    const directionChoices = [...new Set([
      ...state.friction2.map(name => state.directions[name]).filter(Boolean),
      ...state.core5
    ])];
    const scene = state.realScene;
    const complete = isRealSceneComplete(scene);

    return `<section class="screen"><div class="screen-inner">
      ${screenHead('06 / REAL SCENE', 'REAL SCENE', '실제로 어디서 부딪혀?', '사람, 일, 관계, 선택의 순간을 카메라처럼 떠올려봐.')}
      <div class="scene-editor">
        <div class="scene-editor-index" aria-hidden="true">SCENE<br>06</div>
        <div class="scene-editor-fields">
          ${field('realScene.title', '장면에 짧은 제목 붙이기', '언제·어디서인지 한눈에 보이게 적어봐.', scene.title, '예: 월요일 팀 회의 / 엄마와 통화한 밤')}
          ${field('realScene.detail', '그때 실제로 무슨 일이 있었어?', '해석보다 보이는 사실과 오간 말을 적어봐.', scene.detail, '예: 아이디어가 있었지만 분위기를 살피다가 끝까지 말하지 못했다.', 'textarea', true)}
          <div class="field full"><span class="field-label">이 장면에서 더 살리고 싶은 말</span><small>다섯 단어와 방금 찾은 방향 중 하나를 골라봐.</small><div class="scene-direction-pills" role="group" aria-label="장면에서 살리고 싶은 말">
            ${directionChoices.map(word => `<button type="button" data-real-direction="${escapeAttr(word)}" aria-pressed="${scene.direction === word}">${escapeHtml(word)}</button>`).join('')}
          </div></div>
        </div>
      </div>
      ${coachPanel(6)}
      ${navRow(true, complete, '장면이 구체적일수록 다음 선택이 쉬워져요.', 'NEXT / CLASH')}
    </div></section>`;
  }

  function clashScreen() {
    const completeRatings = state.core5.every(word => state.ratings[word] && Number.isFinite(state.ratings[word].importance) && Number.isFinite(state.ratings[word].fulfillment));
    const validConflict = state.conflict.a && state.conflict.b && state.conflict.a !== state.conflict.b && state.conflict.scene.trim().length >= 10;
    return `<section class="screen"><div class="screen-inner">
      ${screenHead('07 / CLASH', 'CLASH', '둘 다 중요한데 같이 지키기 어려웠던 순간.', '버릴 말이 아니라, 조율이 필요한 말.')}
      <section class="word-pulse"><div class="section-label"><span>WORD PULSE</span><p>다섯 말이 요즘 삶에서 어떤 온도인지 빠르게 표시해봐.</p></div><div class="pulse-list">
        ${state.core5.map(word => ratingCard(word)).join('')}
      </div></section>
      <section class="clash-editor">
        <div class="clash-sign" aria-hidden="true">A<br><span>×</span><br>B</div>
        <div>
          <p class="clash-reference"><span>REAL SCENE</span>${escapeHtml(state.realScene.title)} · ${escapeHtml(state.realScene.direction)}</p>
          <div class="conflict-grid">
            <div class="conflict-column"><h3>A · 먼저 지키려던 말</h3>${radioList('conflict-a', state.conflict.a)}</div>
            <div class="conflict-column"><h3>B · 함께 지키기 어려웠던 말</h3>${radioList('conflict-b', state.conflict.b)}</div>
          </div>
          <div class="field full clash-scene"><label for="conflictScene">둘이 부딪힌 순간</label><small>언제, 누구와, 어떤 선택 앞에서 두 말이 갈라졌어?</small><textarea id="conflictScene" data-field="conflict.scene" placeholder="예: 새로운 일을 맡고 싶었지만, 이미 약속한 가족 시간을 지키고 싶어 망설였다.">${escapeHtml(state.conflict.scene)}</textarea></div>
        </div>
      </section>
      ${coachPanel(7)}
      ${navRow(true, completeRatings && validConflict, '서로 다른 두 말을 고르고 장면을 10자 이상 적어줘.', 'NEXT / THIS WEEK')}
    </div></section>`;
  }

  function actionScreen() {
    const a = state.action;
    const complete = isActionComplete(a);
    return `<section class="screen"><div class="screen-inner">
      ${screenHead('08 / THIS WEEK', 'THIS WEEK', '이번 주에 진짜 해볼 한 가지.', '작게, 근데 실제로.')}
      <div class="action-editor">
        <div class="action-sticker" aria-hidden="true"><span>5%</span>IS<br>ENOUGH</div>
        <div class="form-grid">
          ${field('action.scene', '어디서 할 거야?', '실행 장면을 한 줄로 고정해봐.', a.scene, '예: 월요일 오전 팀 회의에서')}
          ${field('action.date', '언제 할 거야?', '오늘부터 7일 안의 날짜를 골라봐.', a.date, '', 'date')}
          ${field('action.behavior', '진짜로 보일 행동', '누가 봐도 했는지 알 수 있게 써봐.', a.behavior, '예: 회의가 끝나기 전에 내 의견을 한 문장으로 말한다.', 'textarea', true)}
          ${field('action.firstStep', '첫 5분', '시작을 쉽게 만드는 가장 작은 준비는?', a.firstStep, '예: 일요일 저녁, 말할 한 문장을 메모한다.', 'textarea', true)}
          ${field('action.obstacle', '걸릴 것 같은 순간', '또 멈추게 만들 수 있는 건 뭐야?', a.obstacle, '예: 괜히 튀어 보일까 걱정하는 마음', 'textarea')}
          ${field('action.support', '나를 밀어줄 장치', '사람, 알림, 환경, 문장 중 하나를 붙여봐.', a.support, '예: 회의 10분 전 휴대폰 알림', 'textarea')}
        </div>
      </div>
      ${coachPanel(8)}
      ${navRow(true, complete, '모든 칸이 채워지면 한 장의 WORD SCENE이 완성돼요.', 'MAKE MY POSTER')}
    </div></section>`;
  }

  function resultScreen() {
    const context = data.contexts.find(item => item.id === state.context)?.title || '삶 전체';
    const sorted = state.core5.map(word => ({ word, ...safeRating(word), gap: safeRating(word).importance - safeRating(word).fulfillment })).sort((a, b) => b.gap - a.gap);
    const focus = sorted[0];
    const alive = [...sorted].sort((a, b) => b.fulfillment - a.fulfillment)[0];
    const directions = state.friction2.map(name => ({ from: getFrictionMeta(name).label, to: state.directions[name] }));
    const questions = [
      `‘${focus.word}’이 지금보다 조금 더 보인다면 ${context}의 어떤 장면이 달라질까요?`,
      `‘${state.conflict.a}’와 ‘${state.conflict.b}’를 둘 다 존중하는 제3의 선택은 무엇일까요?`,
      `이번 행동 뒤에 어떤 흔적이 남으면 “내 단어대로 움직였다”고 말할 수 있을까요?`
    ];
    state.completedAt = state.completedAt || new Date().toISOString();
    save();

    return `<section class="screen result-screen">
      <div class="result-intro"><span class="eyebrow">SCREENSHOT ZONE ↓</span><h1>MY WORD<br>SCENE</h1><p>지금의 나를 움직이는 다섯 말과 다음 움직임.</p></div>
      <div class="result-wrap">
        <article class="result-poster" id="resultPoster" aria-label="나의 VALUE SCENE 결과 포스터">
          <header class="poster-top"><span>DAILYCOACHING®</span><span>${escapeHtml(context)} / ${state.mode === 'coach' ? 'COACH' : 'SELF'}</span><span>${formatDateOnly(state.completedAt.slice(0, 10))}</span></header>
          <div class="poster-title"><span>MY</span><h2>WORD<br>SCENE</h2><b>01—05</b></div>
          <div class="poster-words">
            ${state.core5.map((word, index) => { const meta = getValueMeta(word); return `<div class="poster-word poster-word--${index + 1}"><span>0${index + 1}</span><strong>${escapeHtml(word)}</strong><small>${escapeHtml(meta?.note || '')}</small></div>`; }).join('')}
          </div>
          <div class="poster-mid-grid">
            <section class="poster-block right-now"><span class="poster-label">RIGHT NOW</span><h3>향하고 싶은 쪽</h3>${directions.map(item => `<p><s>${escapeHtml(item.from)}</s><b>→ ${escapeHtml(item.to)}</b></p>`).join('')}</section>
            <section class="poster-block real-scene"><span class="poster-label">REAL SCENE</span><h3>${escapeHtml(state.realScene.title)}</h3><p>${escapeHtml(state.realScene.detail)}</p><b>#${escapeHtml(state.realScene.direction)}</b></section>
          </div>
          <section class="poster-clash"><span class="poster-label">REAL CLASH</span><div><strong>${escapeHtml(state.conflict.a)}</strong><b>×</b><strong>${escapeHtml(state.conflict.b)}</strong></div><p>${escapeHtml(state.conflict.scene)}</p></section>
          <section class="poster-next"><div><span class="poster-label">THIS WEEK I WILL</span><h3>${nl2br(state.action.behavior)}</h3></div><aside><b>${escapeHtml(formatDateOnly(state.action.date))}</b><p>${escapeHtml(state.action.scene)}</p><small>FIRST 5 MIN<br>${escapeHtml(state.action.firstStep)}</small></aside></section>
          <footer class="poster-footer"><span>PROBLEM보다 SCENE</span><span>CHANGE보다 NEXT MOVE</span><b>AND NEXT MOVE →</b></footer>
        </article>

        <div class="result-support">
          <section class="result-card result-card--pulse"><div><span class="micro-label">WORD PULSE</span><h2>지금 읽어볼 두 단어</h2></div><div class="pulse-summary"><article><span>ALIVE</span><strong>${escapeHtml(alive.word)}</strong><p>요즘 삶에서 가장 자주 보이는 말</p></article><article><span>NEEDS SPACE</span><strong>${escapeHtml(focus.word)}</strong><p>조금 더 자리를 내주고 싶은 말</p></article></div></section>
          <section class="result-card"><span class="micro-label">COACHING QUESTIONS</span><h2>포스터를 보며 묻기</h2><ol class="question-list">${questions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ol></section>
          <section class="result-card result-card--action"><div><span class="micro-label">TAKE IT WITH YOU</span><h2>저장하고, 다시 움직이기</h2></div><div class="result-actions"><button class="copy-button" type="button" data-action="copy-result">COPY TEXT</button><button class="print-button" type="button" data-action="print">PRINT / PDF</button><button class="restart-button" type="button" data-action="edit-action">EDIT NEXT MOVE</button></div></section>
        </div>
      </div>
    </section>`;
  }

  function bindScreenEvents() {
    app.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', handleAction));
    app.querySelectorAll('[data-option-group]').forEach(button => button.addEventListener('click', handleOption));
    app.querySelectorAll('[data-value-filter]').forEach(button => button.addEventListener('click', handleValueFilter));
    app.querySelectorAll('[data-word-key]').forEach(button => button.addEventListener('click', handleWord));
    app.querySelectorAll('[data-friction-focus]').forEach(button => button.addEventListener('click', handleFrictionFocus));
    app.querySelectorAll('[data-direction-friction]').forEach(button => button.addEventListener('click', handleDirection));
    app.querySelectorAll('[data-real-direction]').forEach(button => button.addEventListener('click', handleRealDirection));
    app.querySelectorAll('[data-rating-word]').forEach(input => input.addEventListener('input', handleRating));
    app.querySelectorAll('input[name="conflict-a"],input[name="conflict-b"]').forEach(input => input.addEventListener('change', handleConflict));
    app.querySelectorAll('[data-field]').forEach(fieldElement => fieldElement.addEventListener('input', handleField));
  }

  function handleAction(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'start') {
      const mode = state.mode || 'self';
      const context = state.context || 'whole';
      state = freshState();
      state.mode = mode;
      state.context = context;
      state.step = 1;
      save();
      render();
    }
    if (action === 'resume') { state = migrateState(savedState); render(); }
    if (action === 'next') { normalizeBeforeNext(); state.step += 1; save(); render(); }
    if (action === 'back') { state.step = Math.max(0, state.step - 1); save(); render(); }
    if (action === 'toggle-all-values') { showAllValues = !showAllValues; render(); }
    if (action === 'restore-selection') {
      if (state.step === 2) state.positive10 = [...state.positive18];
      if (state.step === 3) state.core5 = [...state.positive10];
      save(); render();
    }
    if (action === 'copy-result') copyResult();
    if (action === 'print') window.print();
    if (action === 'edit-action') { state.step = 8; render(); }
  }

  function handleOption(event) {
    const button = event.currentTarget;
    state[button.dataset.optionGroup] = button.dataset.optionValue;
    save();
    render();
  }

  function handleValueFilter(event) {
    activeCategory = event.currentTarget.dataset.valueFilter;
    showAllValues = activeCategory !== 'all';
    render();
  }

  function handleWord(event) {
    const button = event.currentTarget;
    const key = button.dataset.wordKey;
    const word = button.dataset.word;
    const limit = { positive18:18, positive10:18, core5:10, friction5:5 }[key];
    toggleLimited(state[key], word, limit);
    if (key === 'friction5') {
      state.friction2 = state.friction2.filter(item => state.friction5.includes(item));
      Object.keys(state.directions).forEach(item => { if (!state.friction5.includes(item)) delete state.directions[item]; });
    }
    save();
    render();
  }

  function handleFrictionFocus(event) {
    const name = event.currentTarget.dataset.frictionFocus;
    toggleLimited(state.friction2, name, 2);
    Object.keys(state.directions).forEach(item => { if (!state.friction2.includes(item)) delete state.directions[item]; });
    save();
    render();
  }

  function handleDirection(event) {
    state.directions[event.currentTarget.dataset.directionFriction] = event.currentTarget.dataset.direction;
    save();
    render();
  }

  function handleRealDirection(event) {
    state.realScene.direction = event.currentTarget.dataset.realDirection;
    save();
    render();
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
    save();
    updateNextState();
  }

  function handleField(event) {
    setNested(state, event.currentTarget.dataset.field, event.currentTarget.value);
    save();
    updateNextState();
  }

  function updateNextState() {
    const next = app.querySelector('[data-action="next"]');
    if (next) next.disabled = !isCurrentStepComplete();
  }

  function normalizeBeforeNext() {
    if (state.step === 1) state.positive10 = [...state.positive18];
    if (state.step === 2) state.core5 = [...state.positive10];
    if (state.step === 3) {
      const nextRatings = {};
      state.core5.forEach(word => { nextRatings[word] = state.ratings[word] || { importance:8, fulfillment:5 }; });
      state.ratings = nextRatings;
    }
    if (state.step === 4) {
      state.friction2 = state.friction2.filter(item => state.friction5.includes(item));
      Object.keys(state.directions).forEach(item => { if (!state.friction2.includes(item)) delete state.directions[item]; });
    }
    if (state.step === 5 && !state.realScene.direction) {
      state.realScene.direction = state.friction2.map(name => state.directions[name]).find(Boolean) || state.core5[0] || '';
    }
    if (state.step === 7 && !state.action.scene) state.action.scene = state.realScene.title;
  }

  function isCurrentStepComplete() {
    if (state.step === 6) return isRealSceneComplete(state.realScene);
    if (state.step === 7) {
      const ratings = state.core5.every(word => state.ratings[word]);
      return Boolean(ratings && state.conflict.a && state.conflict.b && state.conflict.a !== state.conflict.b && state.conflict.scene.trim().length >= 10);
    }
    if (state.step === 8) return isActionComplete(state.action);
    return true;
  }

  function isRealSceneComplete(scene) {
    return Boolean(scene?.title?.trim() && scene?.detail?.trim().length >= 10 && scene?.direction?.trim());
  }

  function isActionComplete(action) {
    return ['scene', 'behavior', 'obstacle', 'support', 'date', 'firstStep'].every(key => String(action?.[key] || '').trim().length > 0);
  }

  function copyResult() {
    const text = resultText();
    navigator.clipboard.writeText(text).then(() => announce('MY WORD SCENE을 복사했어요.')).catch(() => {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      announce('MY WORD SCENE을 복사했어요.');
    });
  }

  function resultText() {
    const context = data.contexts.find(item => item.id === state.context)?.title || '';
    return [
      '[DAILYCOACHING · MY WORD SCENE]',
      `장면: ${context}`,
      `끝까지 남긴 말: ${state.core5.join(' / ')}`,
      `지금 향하는 쪽: ${state.friction2.map(name => `${getFrictionMeta(name).label} → ${state.directions[name]}`).join(' · ')}`,
      `REAL SCENE: ${state.realScene.title} / ${state.realScene.detail} / #${state.realScene.direction}`,
      `REAL CLASH: ${state.conflict.a} × ${state.conflict.b}`,
      `부딪힌 순간: ${state.conflict.scene}`,
      `THIS WEEK I WILL: ${state.action.behavior}`,
      `언제·어디서: ${state.action.date} / ${state.action.scene}`,
      `첫 5분: ${state.action.firstStep}`,
      `걸릴 순간: ${state.action.obstacle}`,
      `밀어줄 장치: ${state.action.support}`,
      '',
      '단어 → 반응 → 장면 → 충돌 → 선택 → 작은 행동',
      '※ 진단 결과가 아닌 자기이해와 코칭 대화를 위한 기록입니다.'
    ].join('\n');
  }

  function screenHead(kicker, title, description, subcopy, count = '') {
    return `<div class="screen-head"><div class="screen-head-copy"><span class="step-badge">${kicker}</span><h1 class="screen-title">${title}</h1><p class="screen-description">${description}<br><b>${subcopy}</b></p></div>${count ? `<div class="selection-count"><strong>${count}</strong><span>STAYING</span></div>` : ''}</div>`;
  }

  function coverChoice(group, value, label, description, active) {
    return `<button type="button" data-option-group="${group}" data-option-value="${value}" aria-pressed="${active}"><span>${label}</span><small>${description}</small><b>${active ? '●' : '○'}</b></button>`;
  }

  function selectedShelf(words, limit) {
    return `<div class="selected-shelf" aria-label="현재 남긴 단어"><span class="micro-label">STAYING ${words.length}/${limit}</span><div>${words.length ? words.map(word => `<b>${escapeHtml(word)}</b>`).join('') : '<em>먼저 반응한 말을 눌러봐.</em>'}</div></div>`;
  }

  function wordCard(item, active, key, index, variant) {
    return `<button class="word-card word-card--${variant} ${active ? 'is-selected' : 'is-cut'}" type="button" data-word-key="${key}" data-word="${escapeAttr(item.name)}" aria-pressed="${active}" style="--i:${index}">
      <span class="word-card-no">${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.note)}</small><span class="word-card-state">${variant === 'cut' ? (active ? 'KEEP' : 'CUT') : (active ? 'STAY ✓' : 'PICK')}</span>
    </button>`;
  }

  function frictionButton(item, active, index) {
    return `<button class="friction-pick ${active ? 'is-selected' : ''}" type="button" data-word-key="friction5" data-word="${escapeAttr(item.name)}" aria-pressed="${active}" style="--i:${index}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.note)}</small><b>${active ? 'NOT THIS ✓' : 'PICK'}</b></button>`;
  }

  function coachPanel(index) {
    if (state.mode !== 'coach') return '';
    return `<aside class="coach-panel"><span>COACH LENS ${String(index).padStart(2, '0')}</span><div><strong>질문보다 먼저, 장면을 기다려 주세요.</strong><p>${escapeHtml(data.coachPrompts[index] || '')}</p></div></aside>`;
  }

  function navRow(showBack, canNext, note, nextLabel = 'NEXT') {
    return `<div class="nav-row">${showBack ? '<button class="back-button" type="button" data-action="back">← BACK</button>' : '<span></span>'}<p class="nav-note">${note}</p><button class="next-button" type="button" data-action="next" ${canNext ? '' : 'disabled'}>${nextLabel} <b>→</b></button></div>`;
  }

  function ratingCard(word) {
    const rating = safeRating(word);
    state.ratings[word] = rating;
    return `<article class="rating-card"><div class="rating-word"><span>WORD</span><strong>${escapeHtml(word)}</strong></div>
      <div class="range-wrap"><label>내게 크게 남은 정도 <output>${rating.importance}</output></label><input type="range" min="0" max="10" step="1" value="${rating.importance}" data-rating-word="${escapeAttr(word)}" data-rating-type="importance" aria-label="${escapeAttr(word)}이 내게 크게 남은 정도"></div>
      <div class="range-wrap"><label>요즘 삶에 보이는 정도 <output>${rating.fulfillment}</output></label><input type="range" min="0" max="10" step="1" value="${rating.fulfillment}" data-rating-word="${escapeAttr(word)}" data-rating-type="fulfillment" aria-label="${escapeAttr(word)}이 요즘 삶에 보이는 정도"></div>
    </article>`;
  }

  function radioList(name, selected) {
    return `<div class="radio-list">${state.core5.map(word => `<label class="radio-option"><input type="radio" name="${name}" value="${escapeAttr(word)}" ${selected === word ? 'checked' : ''}><span>${escapeHtml(word)}</span><b>●</b></label>`).join('')}</div>`;
  }

  function field(path, label, help, value, placeholder, type = 'text', full = false) {
    const id = path.replace('.', '-');
    const className = full ? 'field full' : 'field';
    if (type === 'textarea') return `<div class="${className}"><label for="${id}">${label}</label><small>${help}</small><textarea id="${id}" data-field="${path}" placeholder="${escapeAttr(placeholder)}">${escapeHtml(value)}</textarea></div>`;
    const dateLimits = type === 'date' ? ` min="${todayIso()}" max="${addDaysIso(7)}"` : '';
    return `<div class="${className}"><label for="${id}">${label}</label><small>${help}</small><input id="${id}" type="${type}" data-field="${path}" value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}"${dateLimits}></div>`;
  }

  function getValueMeta(word) {
    return data.values.find(item => item.name === word) || { name: word, note: '지금의 나에게 남은 말', category: 'self' };
  }

  function getFrictionMeta(name) {
    return data.frictions.find(item => item.name === name) || { name, label: name, note: '요즘 자꾸 걸리는 장면', directions: [] };
  }

  function safeRating(word) {
    const current = state.ratings[word] || {};
    return {
      importance: Number.isFinite(current.importance) ? current.importance : 8,
      fulfillment: Number.isFinite(current.fulfillment) ? current.fulfillment : 5
    };
  }

  function toggleLimited(list, value, limit) {
    const index = list.indexOf(value);
    if (index >= 0) { list.splice(index, 1); return; }
    if (list.length >= limit) { announce(`${limit}개까지 남길 수 있어요.`); return; }
    list.push(value);
  }

  function setNested(target, path, value) {
    const parts = path.split('.');
    let cursor = target;
    parts.slice(0, -1).forEach(part => { cursor[part] = cursor[part] || {}; cursor = cursor[part]; });
    cursor[parts.at(-1)] = value;
  }

  function stepLabel(step) {
    return ['COVER', 'PICK', 'CUT', 'KEEP 5', 'NOT THIS', 'BUT THIS', 'REAL SCENE', 'CLASH', 'THIS WEEK', 'RESULT'][step] || 'COVER';
  }

  function announce(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(announce._timer);
    announce._timer = window.setTimeout(() => toast.classList.remove('is-visible'), 1800);
  }

  function seededShuffle(array, seedText) {
    const result = [...array];
    let value = Array.from(String(seedText)).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 2166136261);
    const random = () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    for (let index = result.length - 1; index > 0; index--) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function todayIso() {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  function addDaysIso(days) {
    const date = new Date(`${todayIso()}T00:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function formatDate(iso) {
    try { return new Intl.DateTimeFormat('ko-KR', { dateStyle:'medium', timeStyle:'short' }).format(new Date(iso)); }
    catch { return ''; }
  }

  function formatDateOnly(value) {
    if (!value) return '';
    try { return new Intl.DateTimeFormat('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'short' }).format(new Date(`${value}T00:00:00`)); }
    catch { return value; }
  }

  function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }

  function escapeAttr(value = '') { return escapeHtml(value); }
  function nl2br(value = '') { return escapeHtml(value).replace(/\n/g, '<br>'); }

  render();
})();
