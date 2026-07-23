(() => {
  const originalActionPrompt = actionPrompt;
  const originalResolveAction = resolveAction;
  const originalRenderTargetBoard = renderTargetBoard;
  const originalRenderQuestions = renderQuestions;
  const originalRenderGameEnd = renderGameEnd;
  let questionDraft = null;

  function normalizeEntry(entry) {
    if (!entry) return entry;
    if (!Array.isArray(entry.hints)) entry.hints = [];
    if (!Array.isArray(entry.qa)) entry.qa = [];
    return entry;
  }

  function normalizeState() {
    ['A', 'B'].forEach(side => (state.rosters[side] || []).forEach(normalizeEntry));
  }

  function answerMeta(answer) {
    return QUESTION_ANSWER_META[answer] || QUESTION_ANSWER_META.maybe;
  }

  function shortText(text, length = 24) {
    return text.length > length ? `${text.slice(0, length)}…` : text;
  }

  function targetEntry(side, rosterIndex) {
    return normalizeEntry(state.rosters[opponent(side)]?.[rosterIndex]);
  }

  function questionTargetOptions(side) {
    return unresolvedTargets(side).map(entry => {
      normalizeEntry(entry);
      return `<option value="${entry.index}">${escapeHtml(entry.player)} · 질문 ${entry.qa.length}개 · 힌트 ${entry.hints.length}개</option>`;
    }).join('');
  }

  function categoryCount(entry) {
    return entry.qa.reduce((counts, item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
      return counts;
    }, {});
  }

  function recommendedQuestions(entry, prefillId = null) {
    normalizeEntry(entry);
    const asked = new Set(entry.qa.map(item => item.id));
    const counts = categoryCount(entry);
    const starterIds = new Set(['people_many', 'place_indoor', 'tool_computer', 'work_safety', 'work_create', 'prepare_license']);
    const scored = QUESTION_CARDS.map(card => {
      let score = asked.has(card.id) ? -100 : 100;
      score -= (counts[card.category] || 0) * 16;
      if (!entry.qa.length && starterIds.has(card.id)) score += 24;
      if (prefillId === card.id) score += 1000;
      return { card, score: score + Math.random() };
    }).sort((a, b) => b.score - a.score);
    return scored.filter(item => item.score > -50).slice(0, 6).map(item => item.card);
  }

  function qaHistoryHtml(entry, limit = 5) {
    normalizeEntry(entry);
    if (!entry.qa.length) return '<p class="jb7-empty-history">아직 기록된 질문이 없습니다.</p>';
    return entry.qa.slice(-limit).reverse().map(item => {
      const meta = answerMeta(item.answer);
      return `<div class="jb7-history-row ${meta.className}"><span>${meta.icon}</span><div><b>${escapeHtml(item.text)}</b><small>${meta.label}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</small></div></div>`;
    }).join('');
  }

  function renderQuestionChoices(rosterIndex, prefillId = null) {
    const entry = targetEntry(state.turn, rosterIndex);
    if (!entry) return;
    const cards = recommendedQuestions(entry, prefillId);
    const box = $('#jb7QuestionChoices');
    const history = $('#jb7QuestionHistory');
    if (history) history.innerHTML = qaHistoryHtml(entry);
    if (!box) return;
    box.innerHTML = cards.map((card, index) => `
      <label class="jb7-question-card">
        <input type="radio" name="jb7Question" value="${card.id}" ${index === 0 ? 'checked' : ''}>
        <span class="jb7-question-category">${escapeHtml(card.category)}</span>
        <b>${escapeHtml(card.text)}</b>
      </label>
    `).join('');
  }

  function resetCompleteButton() {
    const button = $('#completeAction');
    if (!button) return;
    button.classList.remove('hidden');
    button.disabled = false;
    button.textContent = '행동 완료 · 턴 넘기기 →';
  }

  function replaceCompleteActionListener() {
    const oldButton = $('#completeAction');
    if (!oldButton || oldButton.dataset.jb7Dynamic === 'true') return;
    const newButton = oldButton.cloneNode(true);
    newButton.dataset.jb7Dynamic = 'true';
    oldButton.replaceWith(newButton);
    newButton.addEventListener('click', () => resolveAction());
  }

  actionPrompt = function enhancedActionPrompt(type) {
    if (type !== 'question') {
      resetCompleteButton();
      originalActionPrompt(type);
      return;
    }

    normalizeState();
    pauseTurnTimer();
    state.pendingAction = 'question';
    questionDraft = null;
    const prefillId = state.jb7PrefillQuestionId || null;
    state.jb7PrefillQuestionId = null;
    $('#actionTitle').textContent = '❓ 질문으로 좁혀가기';
    $('#actionContent').innerHTML = `
      <div class="jb7-question-flow">
        <div class="field">
          <label for="actionTarget">1. 질문할 상대 카드</label>
          <select id="actionTarget">${questionTargetOptions(state.turn)}</select>
        </div>
        <div class="jb7-question-layout">
          <section>
            <div class="jb7-section-label"><b>2. 다음 질문 추천</b><span>하나 선택</span></div>
            <div class="jb7-question-choice-grid" id="jb7QuestionChoices"></div>
            <label class="jb7-custom-question"><span>직접 질문 만들기</span><input id="jb7CustomQuestion" maxlength="60" placeholder="예·아니오로 답할 수 있는 질문을 입력하세요"></label>
            <p class="jb7-question-error hidden" id="jb7QuestionError">질문을 하나 선택하거나 직접 입력하세요.</p>
          </section>
          <aside>
            <div class="jb7-section-label"><b>이미 물어본 질문</b><span id="jb7HistoryCount"></span></div>
            <div class="jb7-question-history" id="jb7QuestionHistory"></div>
          </aside>
        </div>
      </div>
    `;
    const button = $('#completeAction');
    button.classList.remove('hidden');
    button.textContent = '질문 확정 → 답변 받기';
    openModal('actionModal');

    const targetSelect = $('#actionTarget');
    const update = () => {
      const index = Number(targetSelect.value);
      const entry = targetEntry(state.turn, index);
      $('#jb7HistoryCount').textContent = `총 ${entry?.qa?.length || 0}개`;
      renderQuestionChoices(index, prefillId);
    };
    targetSelect.addEventListener('change', update);
    setTimeout(update, 0);
  };

  function showAnswerStage(draft) {
    const target = targetEntry(state.turn, draft.targetIndex);
    $('#actionTitle').textContent = '상대 팀이 답해주세요';
    $('#actionContent').innerHTML = `
      <div class="jb7-answer-stage">
        <span class="jb7-answer-target">${escapeHtml(target.player)}의 직업</span>
        <h3>${escapeHtml(draft.text)}</h3>
        <p>직업명을 말하지 말고 가장 가까운 답을 선택하세요.</p>
        <div class="jb7-answer-grid">
          <button type="button" data-jb7-answer="yes"><span>○</span><b>예</b></button>
          <button type="button" data-jb7-answer="no"><span>×</span><b>아니오</b></button>
          <button type="button" data-jb7-answer="maybe"><span>△</span><b>상황에 따라<br>달라요</b></button>
        </div>
        <label class="jb7-answer-note"><span>짧은 보충 설명 <small>선택</small></span><input id="jb7AnswerNote" maxlength="30" placeholder="예: 가끔 현장에도 나가요"></label>
      </div>
    `;
    $('#completeAction').classList.add('hidden');
  }

  resolveAction = function enhancedResolveAction() {
    if (state.pendingAction !== 'question') {
      originalResolveAction();
      resetCompleteButton();
      return;
    }

    const targetIndex = Number($('#actionTarget')?.value);
    const customText = $('#jb7CustomQuestion')?.value.trim();
    const selectedId = $('input[name="jb7Question"]:checked')?.value;
    const selectedCard = QUESTION_CARDS.find(card => card.id === selectedId);
    const text = customText || selectedCard?.text;
    if (!text) {
      $('#jb7QuestionError')?.classList.remove('hidden');
      return;
    }
    questionDraft = {
      targetIndex,
      id: customText ? `custom-${Date.now()}` : selectedCard.id,
      text,
      category: customText ? '직접 질문' : selectedCard.category
    };
    showAnswerStage(questionDraft);
  };

  function recordQuestionAnswer(answer) {
    if (!questionDraft) return;
    const target = targetEntry(state.turn, questionDraft.targetIndex);
    if (!target || target.revealed) return;
    const note = $('#jb7AnswerNote')?.value.trim() || '';
    target.qa.push({ ...questionDraft, answer, note, at: Date.now() });
    const meta = answerMeta(answer);
    log(`<b>${escapeHtml(teamLabel(state.turn))}</b> 질문 → ${escapeHtml(target.player)} · ${escapeHtml(meta.label)}`);
    closeModal('actionModal');
    state.pendingAction = null;
    questionDraft = null;
    resetCompleteButton();
    renderTargetBoard();
    renderQuestions();
    advanceTurn();
  }

  function qaChipHtml(item) {
    const meta = answerMeta(item.answer);
    return `<span class="jb7-qa-chip ${meta.className}" title="${escapeHtml(item.text)}"><b>${meta.icon}</b>${escapeHtml(shortText(item.text, 20))}</span>`;
  }

  function decorateTargetBoard() {
    normalizeState();
    const enemySide = opponent(state.turn);
    const entries = state.rosters[enemySide] || [];
    [...$('#targetBoard').querySelectorAll('.target-card')].forEach((card, index) => {
      const entry = normalizeEntry(entries[index]);
      if (!entry) return;
      card.dataset.jobId = entry.job.id;
      card.dataset.rosterIndex = String(index);
      if (entry.revealed) {
        const profile = getJobProfile(entry.job);
        card.insertAdjacentHTML('beforeend', `
          <div class="jb7-revealed-summary">
            <p>${escapeHtml(profile.intro)}</p>
            <div>${entry.job.tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>
            <button type="button" data-job-detail="${entry.job.id}">직업 자세히 보기 →</button>
          </div>
        `);
        return;
      }
      const list = document.createElement('div');
      list.className = 'jb7-qa-list';
      if (entry.qa.length) {
        list.innerHTML = `<div class="jb7-qa-head"><b>질문 기록 ${entry.qa.length}</b><span>다음 추천: ${escapeHtml(recommendedQuestions(entry)[0]?.category || '새 질문')}</span></div>${entry.qa.slice(-3).reverse().map(qaChipHtml).join('')}${entry.qa.length > 3 ? `<small>+${entry.qa.length - 3}개 더 있음</small>` : ''}`;
      } else {
        list.innerHTML = '<div class="jb7-qa-head"><b>질문 기록 0</b><span>먼저 넓은 질문부터!</span></div>';
      }
      card.appendChild(list);
    });
  }

  renderTargetBoard = function enhancedRenderTargetBoard() {
    normalizeState();
    originalRenderTargetBoard();
    decorateTargetBoard();
  };

  renderQuestions = function enhancedRenderQuestions() {
    const box = $('#questionBank');
    if (!box) return;
    const starters = ['people_many', 'place_indoor', 'tool_computer', 'work_safety', 'work_create', 'prepare_license']
      .map(id => QUESTION_CARDS.find(card => card.id === id));
    box.innerHTML = starters.map(card => `<button class="question-chip jb7-start-question" type="button" data-question-id="${card.id}"><span>${escapeHtml(card.category)}</span>${escapeHtml(card.text)}</button>`).join('');
  };

  function createJobDetailModal() {
    if ($('#jobDetailModal')) return;
    const modal = document.createElement('div');
    modal.className = 'modal hidden';
    modal.id = 'jobDetailModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<div class="modal-card light jb7-job-modal"><div class="modal-head"><div><span class="eyebrow">JOB DISCOVERY</span><h2 id="jb7JobTitle">직업 알아보기</h2></div><button class="close jb7-job-close" type="button">×</button></div><div id="jb7JobContent"></div><button class="primary jb7-job-close" type="button">확인하고 게임으로 →</button></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.jb7-job-close')) closeModal('jobDetailModal');
    });
  }

  function listHtml(items) {
    return items.map(item => `<span>${escapeHtml(item)}</span>`).join('');
  }

  function openJobDetail(jobId) {
    const job = JOBS.find(item => item.id === jobId);
    if (!job) return;
    const profile = getJobProfile(job);
    $('#jb7JobTitle').textContent = job.name;
    $('#jb7JobContent').innerHTML = `
      <div class="jb7-job-hero"><span>${escapeHtml(CATEGORIES[job.cat].name)}</span><p>${escapeHtml(profile.intro)}</p><div>${job.tags.map(tag => `<b>#${escapeHtml(tag)}</b>`).join('')}</div></div>
      <div class="jb7-job-profile-grid">
        <section><small>하는 일</small><p>${escapeHtml(profile.work)}</p></section>
        <section><small>주요 도구</small><div class="jb7-profile-chips">${listHtml(profile.tools)}</div></section>
        <section><small>일하는 장소</small><div class="jb7-profile-chips">${listHtml(profile.places)}</div></section>
        <section><small>주로 만나는 사람</small><div class="jb7-profile-chips">${listHtml(profile.people)}</div></section>
        <section><small>필요한 힘</small><div class="jb7-profile-chips">${listHtml(profile.strengths)}</div></section>
        <section><small>관련 과목</small><div class="jb7-profile-chips">${listHtml(profile.subjects)}</div></section>
        <section class="wide"><small>준비 방법</small><p>${escapeHtml(profile.path)}</p></section>
        <section class="wide"><small>비슷한 직업</small><div class="jb7-profile-chips">${listHtml(profile.similar)}</div></section>
      </div>
      <p class="jb7-profile-note">직업의 실제 업무와 준비 과정은 기관과 현장에 따라 달라질 수 있어요.</p>
    `;
    openModal('jobDetailModal');
  }

  function decorateFinalCards() {
    ['A', 'B'].forEach(side => {
      const team = $(`.final-team.${side.toLowerCase()}`);
      if (!team) return;
      const entries = state.rosters[side] || [];
      [...team.querySelectorAll('.final-card')].forEach((card, index) => {
        const entry = entries[index];
        if (!entry || card.querySelector('[data-job-detail]')) return;
        card.insertAdjacentHTML('beforeend', `<p>${escapeHtml(entry.job.desc)}</p><div class="jb7-final-tags">${entry.job.tags.map(tag => `<span>#${escapeHtml(tag)}</span>`).join('')}</div><button type="button" data-job-detail="${entry.job.id}">직업 알아보기</button>`);
      });
    });
  }

  renderGameEnd = function enhancedRenderGameEnd() {
    originalRenderGameEnd();
    decorateFinalCards();
  };

  function bindEvents() {
    replaceCompleteActionListener();
    $('#actionContent').addEventListener('click', event => {
      const answerButton = event.target.closest('[data-jb7-answer]');
      if (answerButton) recordQuestionAnswer(answerButton.dataset.jb7Answer);
    });
    document.addEventListener('click', event => {
      const startQuestion = event.target.closest('[data-question-id]');
      if (startQuestion && startQuestion.closest('#questionBank')) {
        state.jb7PrefillQuestionId = startQuestion.dataset.questionId;
        actionPrompt('question');
        return;
      }
      const detailButton = event.target.closest('[data-job-detail]');
      if (detailButton) openJobDetail(detailButton.dataset.jobDetail);
    });
  }

  function init() {
    normalizeState();
    createJobDetailModal();
    bindEvents();
  }

  init();
})();
