(() => {
  'use strict';

  const RELEASE = 'v7.9';
  const originalActionPromptV79 = actionPrompt;
  const originalResolveActionV79 = resolveAction;
  const originalRenderTargetBoardV79 = renderTargetBoard;
  let clueDraft = null;

  const CLUE_TYPES = [
    {
      id: 'people',
      icon: '👥',
      label: '누구를 돕나',
      level: '넓은 단서',
      help: '이 직업이 주로 만나는 사람을 알려줘요.',
      why: '어떤 사람을 위해 일하는 직업인지 알 수 있어요.'
    },
    {
      id: 'problem',
      icon: '🧩',
      label: '무엇을 해결하나',
      level: '강한 단서',
      help: '이 직업이 해결하는 문제를 알려줘요.',
      why: '이 직업이 세상에서 맡는 핵심 역할을 알 수 있어요.'
    },
    {
      id: 'place',
      icon: '📍',
      label: '어디에서 일하나',
      level: '넓은 단서',
      help: '주로 일하는 장소나 환경을 알려줘요.',
      why: '실내·현장·특수 공간 등 일하는 환경을 좁힐 수 있어요.'
    },
    {
      id: 'tool',
      icon: '🛠',
      label: '어떤 도구를 쓰나',
      level: '집중 단서',
      help: '자주 사용하는 장비나 도구를 알려줘요.',
      why: '일하는 방법과 기술의 특징을 추리할 수 있어요.'
    },
    {
      id: 'strength',
      icon: '⚡',
      label: '어떤 힘이 필요한가',
      level: '집중 단서',
      help: '이 일을 잘하려면 필요한 힘을 알려줘요.',
      why: '이 직업에 필요한 태도와 능력을 알 수 있어요.'
    }
  ];

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function shortText(value, max = 92) {
    const text = String(value || '').trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function safeList(items, count, fallback) {
    const values = Array.isArray(items) ? items.filter(Boolean).slice(0, count) : [];
    return values.length ? values.join(' · ') : fallback;
  }

  function normalizeEntry(entry) {
    if (!entry) return entry;
    if (!Array.isArray(entry.hints)) entry.hints = [];
    return entry;
  }

  function clueType(typeId) {
    return CLUE_TYPES.find(type => type.id === typeId);
  }

  function clueHintType(typeId) {
    return `clue-${typeId}`;
  }

  function usedClueTypes(entry) {
    return new Set((entry?.hints || [])
      .filter(hint => String(hint.type || '').startsWith('clue-'))
      .map(hint => String(hint.type).replace('clue-', '')));
  }

  function targetForClue(rosterIndex) {
    return normalizeEntry(state.rosters[opponent(state.turn)]?.[rosterIndex]);
  }

  function clueTargetOptions() {
    return unresolvedTargets(state.turn).map(entry => {
      const target = normalizeEntry(entry);
      const clueCount = usedClueTypes(target).size;
      return `<option value="${entry.index}">${escapeHtml(entry.player)} · 단서 ${clueCount}/5</option>`;
    }).join('');
  }

  function cleanProblemText(profile, job) {
    const raw = profile.contribution || profile.work || job.desc || '사람과 사회의 문제를 해결하는 역할을 해요.';
    const replaced = String(raw).replace(new RegExp(escapeRegExp(job.name), 'g'), '이 직업');
    return shortText(replaced, 96);
  }

  function buildClue(entry, typeId) {
    const type = clueType(typeId);
    const profile = getJobProfile(entry.job);
    let value = '';

    if (typeId === 'people') {
      value = safeList(profile.people, 2, '이 직업의 도움을 필요로 하는 사람들');
    }
    if (typeId === 'problem') {
      value = cleanProblemText(profile, entry.job);
    }
    if (typeId === 'place') {
      value = safeList(profile.places, 2, '업무에 맞는 현장과 작업 공간');
    }
    if (typeId === 'tool') {
      value = safeList(profile.tools, 2, '전문 장비와 업무 도구');
    }
    if (typeId === 'strength') {
      value = safeList(profile.strengths, 3, '관찰력 · 책임감 · 문제해결력');
    }

    return {
      type: clueHintType(typeId),
      clueType: typeId,
      icon: type.icon,
      label: type.label,
      level: type.level,
      value,
      why: type.why
    };
  }

  function existingCluesHtml(entry) {
    const clues = (entry.hints || []).filter(hint => String(hint.type || '').startsWith('clue-'));
    if (!clues.length) return '<p>아직 받은 단서 카드가 없습니다.</p>';
    return `<div>${clues.map(hint => `<span>${escapeHtml(hint.label)}</span>`).join('')}</div>`;
  }

  function renderClueChoices(rosterIndex) {
    const target = targetForClue(rosterIndex);
    const choiceBox = document.querySelector('#jb79ClueChoices');
    const existing = document.querySelector('#jb79ExistingClues');
    const count = document.querySelector('#jb79ClueCount');
    const error = document.querySelector('#jb79ClueError');
    const complete = document.querySelector('#completeAction');
    if (!target || !choiceBox || !complete) return;

    const used = usedClueTypes(target);
    clueDraft = {
      stage: 'select',
      targetIndex: rosterIndex,
      typeId: null,
      clue: null
    };

    choiceBox.innerHTML = CLUE_TYPES.map(type => {
      const alreadyUsed = used.has(type.id);
      return `
        <button type="button" class="jb79-clue-choice ${alreadyUsed ? 'used' : ''}" data-jb79-clue-type="${type.id}" ${alreadyUsed ? 'disabled' : ''}>
          <span class="jb79-clue-icon">${type.icon}</span>
          <span class="jb79-clue-copy"><b>${type.label}</b><small>${type.help}</small></span>
          <em>${alreadyUsed ? '이미 받음' : type.level}</em>
        </button>
      `;
    }).join('');

    if (existing) existing.innerHTML = existingCluesHtml(target);
    if (count) count.textContent = `남은 단서 ${Math.max(0, CLUE_TYPES.length - used.size)}장`;
    if (error) {
      error.textContent = used.size >= CLUE_TYPES.length
        ? '이 카드의 기본 단서를 모두 받았습니다. 다른 상대 카드를 선택하거나 질문하기를 사용하세요.'
        : '받고 싶은 단서 종류를 한 장 선택하세요.';
      error.classList.toggle('warning', used.size >= CLUE_TYPES.length);
    }

    complete.disabled = true;
    complete.classList.remove('hidden');
    complete.textContent = used.size >= CLUE_TYPES.length ? '선택 가능한 단서가 없습니다' : '단서 종류를 먼저 고르세요';
  }

  function openClueAction() {
    const options = clueTargetOptions();
    if (!options) return;

    pauseTurnTimer();
    state.pendingAction = 'clue';
    clueDraft = null;
    document.querySelector('#actionTitle').textContent = '🔍 단서 카드 받기';
    document.querySelector('#actionContent').innerHTML = `
      <div class="jb79-clue-flow">
        <div class="jb79-action-compare">
          <section><small>질문하기</small><b>우리 팀이 묻고 상대 팀이 ○·×·△로 답해요.</b></section>
          <section class="active"><small>단서 카드 받기</small><b>종류만 고르면 시스템이 사실 하나를 자동 공개해요.</b></section>
        </div>

        <div class="jb79-no-speaking">
          <span>💡</span><div><b>상대 팀원이 설명을 만들 필요가 없습니다.</b><p>비밀 직업카드의 정보에서 시스템이 단서 한 장을 꺼내 줍니다.</p></div>
        </div>

        <div class="field">
          <label for="actionTarget">1. 누구의 직업에서 단서를 받을까요?</label>
          <select id="actionTarget">${options}</select>
        </div>

        <section class="jb79-clue-select-section">
          <div class="jb79-clue-head">
            <div><small>STEP 2</small><h3>알고 싶은 단서 종류를 고르세요</h3></div>
            <span id="jb79ClueCount"></span>
          </div>
          <div class="jb79-clue-choices" id="jb79ClueChoices"></div>
          <p class="jb79-clue-error" id="jb79ClueError"></p>
        </section>

        <aside class="jb79-existing">
          <b>이 카드에서 이미 받은 단서</b>
          <div id="jb79ExistingClues"></div>
        </aside>
      </div>
    `;

    openModal('actionModal');
    const select = document.querySelector('#actionTarget');
    select.addEventListener('change', () => renderClueChoices(Number(select.value)));
    renderClueChoices(Number(select.value));
  }

  function selectClueType(typeId) {
    if (!clueDraft || clueDraft.stage !== 'select') return;
    const target = targetForClue(clueDraft.targetIndex);
    if (!target || usedClueTypes(target).has(typeId)) return;

    clueDraft.typeId = typeId;
    document.querySelectorAll('[data-jb79-clue-type]').forEach(button => {
      button.classList.toggle('selected', button.dataset.jb79ClueType === typeId);
    });
    const type = clueType(typeId);
    const complete = document.querySelector('#completeAction');
    const error = document.querySelector('#jb79ClueError');
    if (complete) {
      complete.disabled = false;
      complete.textContent = `${type.icon} ${type.label} 단서 공개하기 →`;
    }
    if (error) {
      error.textContent = `${type.level}를 선택했습니다. 버튼을 눌러 단서 카드를 확인하세요.`;
      error.classList.remove('warning');
    }
  }

  function renderClueReveal(target, clue) {
    document.querySelector('#actionTitle').textContent = '🔓 단서 카드 공개';
    document.querySelector('#actionContent').innerHTML = `
      <section class="jb79-clue-reveal">
        <span class="jb79-reveal-kicker">CLUE CARD OPEN!</span>
        <h3>${escapeHtml(target.player)}의 비밀 직업 단서</h3>
        <div class="jb79-opened-card">
          <span>${clue.icon}</span>
          <small>${escapeHtml(clue.label)}</small>
          <strong>${escapeHtml(clue.value)}</strong>
          <em>${escapeHtml(clue.level)}</em>
        </div>
        <div class="jb79-clue-meaning">
          <b>이 단서로 알 수 있는 것</b>
          <p>${escapeHtml(clue.why)}</p>
        </div>
        <p class="jb79-turn-note">이 단서는 상대 카드에 저장됩니다. 저장하면 이번 턴이 끝납니다.</p>
      </section>
    `;
    const complete = document.querySelector('#completeAction');
    complete.classList.remove('hidden');
    complete.disabled = false;
    complete.textContent = '단서 저장 · 턴 넘기기 →';
  }

  actionPrompt = function clueCardActionPromptV79(type) {
    if (type !== 'clue') {
      clueDraft = null;
      return originalActionPromptV79(type);
    }
    openClueAction();
  };

  resolveAction = function clueCardResolveActionV79() {
    if (state.pendingAction !== 'clue') return originalResolveActionV79();
    if (!clueDraft) return;

    const target = targetForClue(clueDraft.targetIndex);
    if (!target || target.revealed) {
      closeModal('actionModal');
      state.pendingAction = null;
      clueDraft = null;
      startTurnTimer(false);
      return;
    }

    if (clueDraft.stage === 'select') {
      if (!clueDraft.typeId) {
        const error = document.querySelector('#jb79ClueError');
        if (error) {
          error.textContent = '단서 종류를 먼저 한 장 선택하세요.';
          error.classList.add('warning');
        }
        return;
      }
      clueDraft.clue = buildClue(target, clueDraft.typeId);
      clueDraft.stage = 'reveal';
      renderClueReveal(target, clueDraft.clue);
      return;
    }

    if (clueDraft.stage === 'reveal') {
      const clue = clueDraft.clue;
      if (!target.hints.some(hint => hint.type === clue.type)) {
        target.hints.push({ type: clue.type, label: clue.label, value: clue.value });
      }
      log(`<b>${escapeHtml(teamLabel(state.turn))}</b> 단서 카드 → ${escapeHtml(target.player)} · ${escapeHtml(clue.label)}`);
      closeModal('actionModal');
      state.pendingAction = null;
      clueDraft = null;
      renderTargetBoard();
      advanceTurn();
    }
  };

  function decorateClueProgress() {
    const enemySide = opponent(state.turn);
    const entries = state.rosters[enemySide] || [];
    [...document.querySelectorAll('#targetBoard .target-card')].forEach((card, index) => {
      const entry = normalizeEntry(entries[index]);
      if (!entry || entry.revealed || card.querySelector('.jb79-clue-progress')) return;
      const clues = entry.hints.filter(hint => String(hint.type || '').startsWith('clue-'));
      if (!clues.length) return;
      card.insertAdjacentHTML('beforeend', `
        <div class="jb79-clue-progress">
          <b>단서 카드 ${clues.length}/5</b>
          <span>${clues.map(hint => escapeHtml(hint.label)).join(' · ')}</span>
        </div>
      `);
    });
  }

  renderTargetBoard = function clueCardRenderTargetBoardV79() {
    originalRenderTargetBoardV79();
    decorateClueProgress();
  };

  function updateActionButton() {
    const button = document.querySelector('[data-action="clue"]');
    if (!button) return;
    const title = button.querySelector('b');
    const description = button.querySelector('small');
    if (title) title.textContent = '단서 카드 받기';
    if (description) description.textContent = '종류를 고르면 사실 1개 자동 공개';
  }

  function decorateTutorialClueRule() {
    const panel = document.querySelector('#jb77RulePanel');
    if (!panel || panel.querySelector('.jb79-tutorial-clue-rule')) return;
    panel.insertAdjacentHTML('beforeend', `
      <div class="jb79-tutorial-clue-rule">
        <b>🔍 단서 카드 받기는 이렇게 달라요</b>
        <p>상대 팀이 직접 설명하는 활동이 아닙니다. 우리 팀이 알고 싶은 종류를 고르면 시스템이 사실 하나를 자동으로 공개하고 상대 카드에 저장합니다.</p>
      </div>
    `);
  }

  function bindEvents() {
    document.querySelector('#actionContent')?.addEventListener('click', event => {
      const choice = event.target.closest('[data-jb79-clue-type]');
      if (choice) selectClueType(choice.dataset.jb79ClueType);
    });

    document.querySelector('#actionModal')?.addEventListener('click', event => {
      if (event.target.closest('[data-close="actionModal"], .close')) {
        clueDraft = null;
        if (state.pendingAction === 'clue') state.pendingAction = null;
      }
    }, true);

    document.addEventListener('click', event => {
      const tab = event.target.closest('[data-rule-tab="1"]');
      if (tab) setTimeout(decorateTutorialClueRule, 0);
    });
  }

  function init() {
    updateActionButton();
    bindEvents();
  }

  init();
})();
