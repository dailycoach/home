(() => {
  'use strict';

  const RELEASE = 'v7.1';
  const originalSaveV71 = save;
  const originalLoadV71 = load;
  const originalRenderTargetBoardV71 = renderTargetBoard;
  const originalResolveActionV71 = resolveAction;
  let historyContext = null;

  function normalizeQuestionText(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[?.!。！？]+$/g, '')
      .toLowerCase();
  }

  function normalizeStateV71() {
    if (!state.teamSizes || typeof state.teamSizes !== 'object') state.teamSizes = { A: 5, B: 5 };
    if (!state.teamNames || typeof state.teamNames !== 'object') state.teamNames = { A: 'TEAM BLUE', B: 'TEAM ORANGE' };
    if (!state.players || typeof state.players !== 'object') state.players = { A: [], B: [] };
    if (!state.rosters || typeof state.rosters !== 'object') state.rosters = { A: [], B: [] };
    if (!state.chanceUsed || typeof state.chanceUsed !== 'object') state.chanceUsed = { A: false, B: false };
    if (!Array.isArray(state.log)) state.log = [];
    if (!Array.isArray(state.bonusDone)) state.bonusDone = [];
    if (!Array.isArray(state.bonusTurns)) state.bonusTurns = [];

    ['A', 'B'].forEach(side => {
      if (!Array.isArray(state.players[side])) state.players[side] = [];
      if (!Array.isArray(state.rosters[side])) state.rosters[side] = [];
      state.rosters[side].forEach(entry => {
        if (!entry || typeof entry !== 'object') return;
        if (!Array.isArray(entry.hints)) entry.hints = [];
        if (!Array.isArray(entry.qa)) entry.qa = [];
        entry.qa = entry.qa
          .filter(item => item && typeof item.text === 'string')
          .map((item, index) => ({
            id: item.id || `recovered-${Date.now()}-${index}`,
            text: item.text.trim(),
            category: item.category || '질문',
            answer: ['yes', 'no', 'maybe'].includes(item.answer) ? item.answer : 'maybe',
            note: typeof item.note === 'string' ? item.note.slice(0, 30) : '',
            at: Number.isFinite(item.at) ? item.at : Date.now()
          }));
      });
      state.teamSizes[side] = Math.max(2, Math.min(6, Number(state.teamSizes[side]) || state.players[side].length || 5));
      state.chanceUsed[side] = Boolean(state.chanceUsed[side]);
    });
  }

  save = function stableSaveV71() {
    normalizeStateV71();
    try {
      originalSaveV71();
      return true;
    } catch (error) {
      console.error('JOB BATTLE 저장 실패', error);
      return false;
    }
  };

  load = function stableLoadV71() {
    let loaded = false;
    try {
      loaded = originalLoadV71();
    } catch (error) {
      console.error('JOB BATTLE 저장 복구 실패', error);
      return false;
    }
    if (loaded) {
      normalizeStateV71();
      originalSaveV71();
    }
    return loaded;
  };

  function createHistoryModal() {
    if (document.querySelector('#jb71HistoryModal')) return;
    const modal = document.createElement('div');
    modal.id = 'jb71HistoryModal';
    modal.className = 'modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-card light jb71-history-modal">
        <div class="modal-head">
          <div><span class="eyebrow">QUESTION LOG</span><h2 id="jb71HistoryTitle">질문 기록 관리</h2></div>
          <button class="close jb71-history-close" type="button" aria-label="닫기">×</button>
        </div>
        <div class="jb71-history-summary" id="jb71HistorySummary"></div>
        <div class="jb71-history-list" id="jb71HistoryList"></div>
        <div class="jb71-history-actions">
          <button class="jb71-undo-last" id="jb71UndoLast" type="button">마지막 질문 취소</button>
          <button class="primary jb71-history-close" type="button">수정 완료</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.jb71-history-close')) closeHistoryModal();
    });
  }

  function historyEntry() {
    if (!historyContext) return null;
    return state.rosters[historyContext.enemySide]?.[historyContext.index] || null;
  }

  function renderHistoryModal() {
    const entry = historyEntry();
    if (!entry) {
      closeHistoryModal();
      return;
    }
    const qa = entry.qa || [];
    document.querySelector('#jb71HistoryTitle').textContent = `${entry.player} 질문 기록`;
    document.querySelector('#jb71HistorySummary').innerHTML = `<b>총 ${qa.length}개 질문</b><span>답변을 수정하거나 잘못 기록한 질문을 삭제할 수 있어요.</span>`;
    document.querySelector('#jb71UndoLast').disabled = qa.length === 0;
    document.querySelector('#jb71HistoryList').innerHTML = qa.length ? qa.map((item, index) => {
      const meta = QUESTION_ANSWER_META[item.answer] || QUESTION_ANSWER_META.maybe;
      return `
        <article class="jb71-history-item" data-qa-index="${index}">
          <header>
            <div><small>${escapeHtml(item.category || '질문')}</small><b>${escapeHtml(item.text)}</b></div>
            <button class="jb71-delete-question" type="button" data-delete-qa="${index}" aria-label="질문 삭제">삭제</button>
          </header>
          <div class="jb71-answer-edit">
            ${['yes', 'no', 'maybe'].map(answer => {
              const answerMeta = QUESTION_ANSWER_META[answer];
              return `<button type="button" class="${item.answer === answer ? `active ${answerMeta.className}` : ''}" data-edit-answer="${answer}" data-qa-index="${index}">${answerMeta.icon} ${answerMeta.label}</button>`;
            }).join('')}
          </div>
          <label class="jb71-note-edit"><span>보충 설명</span><input maxlength="30" value="${escapeHtml(item.note || '')}" data-edit-note="${index}" placeholder="짧은 보충 설명"></label>
        </article>
      `;
    }).join('') : '<p class="jb7-empty-history">아직 기록된 질문이 없습니다.</p>';
  }

  function openHistoryModal(index) {
    normalizeStateV71();
    pauseTurnTimer();
    historyContext = { side: state.turn, enemySide: opponent(state.turn), index: Number(index) };
    renderHistoryModal();
    openModal('jb71HistoryModal');
  }

  function closeHistoryModal() {
    const modal = document.querySelector('#jb71HistoryModal');
    if (modal) closeModal('jb71HistoryModal');
    historyContext = null;
    if (state.phase === 'play' && !state.timer && document.querySelector('#actionModal')?.classList.contains('hidden')) startTurnTimer(false);
  }

  function commitHistoryChange() {
    save();
    renderTargetBoard();
    renderQuestions();
    renderHistoryModal();
  }

  function decorateHistoryButtons() {
    normalizeStateV71();
    const enemySide = opponent(state.turn);
    const cards = [...document.querySelectorAll('#targetBoard .target-card')];
    cards.forEach((card, index) => {
      const entry = state.rosters[enemySide]?.[index];
      if (!entry || entry.revealed || !entry.qa?.length || card.querySelector('.jb71-history-button')) return;
      card.insertAdjacentHTML('beforeend', `<button class="jb71-history-button" type="button" data-jb71-history="${index}">질문 기록 ${entry.qa.length}개 관리</button>`);
    });
  }

  renderTargetBoard = function stableRenderTargetBoardV71() {
    normalizeStateV71();
    originalRenderTargetBoardV71();
    decorateHistoryButtons();
  };

  resolveAction = function stableResolveActionV71() {
    if (state.pendingAction === 'question') {
      const targetIndex = Number(document.querySelector('#actionTarget')?.value);
      const entry = state.rosters[opponent(state.turn)]?.[targetIndex];
      const customText = document.querySelector('#jb7CustomQuestion')?.value.trim();
      const selectedId = document.querySelector('input[name="jb7Question"]:checked')?.value;
      const selectedCard = QUESTION_CARDS.find(card => card.id === selectedId);
      const candidateText = customText || selectedCard?.text || '';
      const normalizedCandidate = normalizeQuestionText(candidateText);
      const duplicated = entry?.qa?.some(item => normalizeQuestionText(item.text) === normalizedCandidate);
      if (normalizedCandidate && duplicated) {
        const error = document.querySelector('#jb7QuestionError');
        if (error) {
          error.textContent = '이미 물어본 질문입니다. 다른 질문을 골라주세요.';
          error.classList.remove('hidden');
          error.classList.add('jb71-duplicate-warning');
        }
        return;
      }
    }
    originalResolveActionV71();
  };

  function addAnswerStageBackButton() {
    const stage = document.querySelector('#actionContent .jb7-answer-stage');
    if (!stage || stage.querySelector('.jb71-back-question')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'jb71-back-question';
    button.textContent = '← 질문 다시 선택';
    button.addEventListener('click', () => actionPrompt('question'));
    stage.appendChild(button);
  }

  function addReleaseBadge() {
    const brand = document.querySelector('.brand > span:last-child');
    if (!brand || brand.querySelector('.jb71-release-badge')) return;
    const badge = document.createElement('span');
    badge.className = 'jb71-release-badge';
    badge.textContent = RELEASE;
    brand.appendChild(badge);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const historyButton = event.target.closest('[data-jb71-history]');
      if (historyButton) {
        event.preventDefault();
        event.stopPropagation();
        openHistoryModal(historyButton.dataset.jb71History);
        return;
      }

      const answerButton = event.target.closest('[data-edit-answer]');
      if (answerButton && historyContext) {
        const entry = historyEntry();
        const index = Number(answerButton.dataset.qaIndex);
        if (entry?.qa?.[index]) {
          entry.qa[index].answer = answerButton.dataset.editAnswer;
          commitHistoryChange();
        }
        return;
      }

      const deleteButton = event.target.closest('[data-delete-qa]');
      if (deleteButton && historyContext) {
        const entry = historyEntry();
        const index = Number(deleteButton.dataset.deleteQa);
        if (entry?.qa?.[index] && confirm('이 질문 기록을 삭제할까요?')) {
          entry.qa.splice(index, 1);
          commitHistoryChange();
        }
      }
    });

    document.addEventListener('change', event => {
      const input = event.target.closest('[data-edit-note]');
      if (!input || !historyContext) return;
      const entry = historyEntry();
      const index = Number(input.dataset.editNote);
      if (entry?.qa?.[index]) {
        entry.qa[index].note = input.value.trim().slice(0, 30);
        save();
        renderTargetBoard();
      }
    });

    document.querySelector('#jb71UndoLast')?.addEventListener('click', () => {
      const entry = historyEntry();
      if (!entry?.qa?.length) return;
      if (confirm('마지막 질문과 답변을 취소할까요?')) {
        entry.qa.pop();
        commitHistoryChange();
      }
    });

    const actionContent = document.querySelector('#actionContent');
    if (actionContent) new MutationObserver(addAnswerStageBackButton).observe(actionContent, { childList: true, subtree: true });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && state.phase !== 'setup') save();
    });
    window.addEventListener('pagehide', () => save());
  }

  function init() {
    normalizeStateV71();
    createHistoryModal();
    bindEvents();
    addReleaseBadge();
    if (state.phase === 'play') decorateHistoryButtons();
    setInterval(() => {
      if (state.phase === 'play') save();
    }, 15000);
  }

  init();
})();
