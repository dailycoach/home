(() => {
  'use strict';

  const RELEASE = 'v7.8';
  const originalActionPromptV78 = actionPrompt;
  const originalRenderQuestionsV78 = renderQuestions;
  const originalRenderTargetBoardV78 = renderTargetBoard;
  const originalRenderGameEndV78 = renderGameEnd;
  const originalShowTeamSecretV78 = showTeamSecret;
  const originalPrepareMatchV78 = prepareMatch;

  const QUESTION_REFRAMES = {
    people_many: {
      category: '돕는 사람',
      text: '이 직업은 사람을 직접 많이 만나며 도움을 주나요?'
    },
    people_patient: {
      category: '돕는 사람',
      text: '아프거나 도움이 필요한 사람의 문제를 해결하나요?'
    },
    people_customer: {
      category: '생활 변화',
      text: '사람의 생활을 더 편리하고 만족스럽게 만드는 일을 하나요?'
    },
    work_safety: {
      category: '해결하는 문제',
      text: '사람의 생명이나 안전 문제를 해결하나요?'
    },
    work_create: {
      category: '만드는 변화',
      text: '새로운 기술·제품·이야기를 만들어 변화를 일으키나요?'
    },
    work_analyze: {
      category: '해결하는 문제',
      text: '복잡한 정보나 숫자를 분석해 판단을 돕나요?'
    },
    work_teach: {
      category: '성장 지원',
      text: '사람이 배우고 성장하도록 돕는 일이 핵심인가요?'
    },
    work_solve: {
      category: '문제 해결',
      text: '문제를 발견하고 해결책을 만드는 일이 핵심인가요?'
    },
    nature_animal: {
      category: '환경·생명',
      text: '자연·환경·동물의 문제를 해결하나요?'
    },
    skill_creative: {
      category: '사용하는 힘',
      text: '새로운 아이디어로 기존의 불편함을 바꾸는 힘이 중요한가요?'
    }
  };

  const MEANING_STARTERS = [
    'work_safety',
    'work_solve',
    'work_teach',
    'work_create',
    'work_analyze',
    'nature_animal'
  ];

  const REASONS = [
    { id: 'help', label: '사람을 직접 돕는 역할' },
    { id: 'solve', label: '어려운 문제를 풀어내는 역할' },
    { id: 'create', label: '새로운 것을 만드는 역할' },
    { id: 'discover', label: '관찰하고 원리를 알아내는 역할' },
    { id: 'express', label: '이야기와 감정을 표현하는 역할' },
    { id: 'protect', label: '안전과 질서를 지키는 역할' }
  ];

  function applyQuestionReframes() {
    QUESTION_CARDS.forEach(card => {
      const replacement = QUESTION_REFRAMES[card.id];
      if (!replacement) return;
      card.category = replacement.category;
      card.text = replacement.text;
    });
  }

  function normalizeReflection() {
    const current = state.jb78Reflection;
    state.jb78Reflection = {
      jobs: Array.isArray(current?.jobs) ? current.jobs : [],
      reason: typeof current?.reason === 'string' ? current.reason : ''
    };
  }

  function profileOf(job) {
    const profile = getJobProfile(job);
    return {
      ...profile,
      contribution: profile.contribution || profile.work || job.desc,
      people: Array.isArray(profile.people) ? profile.people : [],
      strengths: Array.isArray(profile.strengths) ? profile.strengths : []
    };
  }

  function shortText(value, max = 92) {
    const text = String(value || '');
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function meaningMapHtml(job, compact = false) {
    const profile = profileOf(job);
    const people = profile.people.slice(0, compact ? 2 : 3).map(escapeHtml).join(' · ') || '이 직업의 도움을 필요로 하는 사람';
    const strengths = profile.strengths.slice(0, 3).map(escapeHtml).join(' · ') || '관찰력 · 책임감 · 문제해결';
    return `
      <div class="jb78-meaning-map ${compact ? 'compact' : ''}">
        <div><small>누구를 돕나</small><p>${people}</p></div>
        <div><small>무엇을 해결하나</small><p>${escapeHtml(shortText(profile.contribution, compact ? 78 : 140))}</p></div>
        <div><small>어떤 힘을 쓰나</small><p>${strengths}</p></div>
      </div>
    `;
  }

  actionPrompt = function meaningActionPromptV78(type) {
    originalActionPromptV78(type);
    if (type !== 'question') return;
    setTimeout(() => {
      const flow = document.querySelector('#actionContent .jb7-question-flow');
      if (!flow || flow.querySelector('.jb78-question-guide')) return;
      flow.insertAdjacentHTML('afterbegin', `
        <div class="jb78-question-guide">
          <span>좋은 질문의 방향</span>
          <b>직업 이름보다 누구를 돕고, 어떤 문제를 해결하며, 어떤 힘을 쓰는지 물어보세요.</b>
        </div>
      `);
    }, 0);
  };

  renderQuestions = function meaningRenderQuestionsV78() {
    originalRenderQuestionsV78();
    const box = document.querySelector('#questionBank');
    if (!box) return;
    const cards = MEANING_STARTERS
      .map(id => QUESTION_CARDS.find(card => card.id === id))
      .filter(Boolean);
    box.innerHTML = cards.map(card => `
      <button class="question-chip jb7-start-question jb78-meaning-question" type="button" data-question-id="${card.id}">
        <span>${escapeHtml(card.category)}</span>${escapeHtml(card.text)}
      </button>
    `).join('');
  };

  function decorateSecretMeaning(side) {
    const entries = state.rosters[side] || [];
    [...document.querySelectorAll('#secretContent .secret-card')].forEach((card, index) => {
      const entry = entries[index];
      if (!entry || card.querySelector('.jb78-secret-meaning')) return;
      const profile = profileOf(entry.job);
      card.insertAdjacentHTML('beforeend', `
        <section class="jb78-secret-meaning">
          <small>이 직업의 핵심 역할</small>
          <p>${escapeHtml(shortText(profile.contribution, 110))}</p>
          <div><span>돕는 사람</span><b>${profile.people.slice(0, 2).map(escapeHtml).join(' · ')}</b></div>
        </section>
      `);
    });
  }

  showTeamSecret = function meaningShowTeamSecretV78(side) {
    originalShowTeamSecretV78(side);
    setTimeout(() => decorateSecretMeaning(side), 0);
  };

  function decorateRevealedCards() {
    const enemySide = opponent(state.turn);
    const entries = state.rosters[enemySide] || [];
    [...document.querySelectorAll('#targetBoard .target-card')].forEach((card, index) => {
      const entry = entries[index];
      if (!entry?.revealed || card.querySelector('.jb78-reveal-meaning')) return;
      const summary = card.querySelector('.jb7-revealed-summary');
      const html = `
        <section class="jb78-reveal-meaning">
          <span>이 직업을 세 가지로 해독하기</span>
          ${meaningMapHtml(entry.job, true)}
          <strong>이 역할의 어떤 점이 마음에 드나요?</strong>
        </section>
      `;
      if (summary) summary.insertAdjacentHTML('afterbegin', html);
      else card.insertAdjacentHTML('beforeend', html);
    });
  }

  renderTargetBoard = function meaningRenderTargetBoardV78() {
    originalRenderTargetBoardV78();
    decorateRevealedCards();
  };

  function allMatchJobs() {
    return [...(state.rosters.A || []), ...(state.rosters.B || [])]
      .map(entry => entry.job)
      .filter(Boolean);
  }

  function reflectionJobs() {
    const available = new Set(allMatchJobs().map(job => job.id));
    state.jb78Reflection.jobs = state.jb78Reflection.jobs.filter(id => available.has(id)).slice(0, 3);
    return allMatchJobs();
  }

  function reflectionSummaryHtml() {
    const selected = state.jb78Reflection.jobs
      .map(id => JOBS.find(job => job.id === id))
      .filter(Boolean);
    if (!selected.length) {
      return '<p>직업을 고르면 오늘 발견한 나의 관심 단서를 한 문장으로 정리해 줍니다.</p>';
    }
    const reason = REASONS.find(item => item.id === state.jb78Reflection.reason);
    const names = selected.map(job => job.name).join(' · ');
    if (!reason) {
      return `<p><b>${escapeHtml(names)}</b>에 마음이 갔어요. 이제 그 이유를 하나 골라보세요.</p>`;
    }
    return `<p><span>오늘의 진로 단서</span> 나는 <b>${escapeHtml(names)}</b>처럼 <strong>${escapeHtml(reason.label)}</strong>에 마음이 움직였다.</p>`;
  }

  function renderReflection() {
    normalizeReflection();
    const finalReveal = document.querySelector('#finalReveal');
    if (!finalReveal) return;
    let section = document.querySelector('#jb78Reflection');
    if (!section) {
      section = document.createElement('section');
      section.id = 'jb78Reflection';
      section.className = 'jb78-reflection';
      finalReveal.insertAdjacentElement('afterend', section);
    }

    const jobs = reflectionJobs();
    const selectedIds = new Set(state.jb78Reflection.jobs);
    section.innerHTML = `
      <header>
        <span>MY CAREER CLUE</span>
        <h2>오늘 발견한 직업 중 마음이 가는 직업은?</h2>
        <p>꿈을 지금 정하는 것이 아닙니다. 어떤 문제와 역할에 마음이 움직였는지 최대 3개만 골라보세요.</p>
      </header>
      <div class="jb78-reflection-jobs">
        ${jobs.map(job => {
          const profile = profileOf(job);
          return `
            <button type="button" data-jb78-job="${job.id}" class="${selectedIds.has(job.id) ? 'selected' : ''}" aria-pressed="${selectedIds.has(job.id)}">
              <span>${escapeHtml(CATEGORIES[job.cat].name)}</span>
              <b>${escapeHtml(job.name)}</b>
              <small>${escapeHtml(shortText(profile.contribution, 58))}</small>
            </button>
          `;
        }).join('')}
      </div>
      <p class="jb78-limit-note">${selectedIds.size}/3 선택 · 다시 누르면 선택이 해제됩니다.</p>
      <div class="jb78-reason-panel ${selectedIds.size ? '' : 'hidden'}">
        <b>왜 마음이 갔나요?</b>
        <div>
          ${REASONS.map(reason => `
            <button type="button" data-jb78-reason="${reason.id}" class="${state.jb78Reflection.reason === reason.id ? 'selected' : ''}" aria-pressed="${state.jb78Reflection.reason === reason.id}">
              ${escapeHtml(reason.label)}
            </button>
          `).join('')}
        </div>
      </div>
      <div class="jb78-reflection-summary">${reflectionSummaryHtml()}</div>
    `;
  }

  function decorateFinalCards() {
    ['A', 'B'].forEach(side => {
      const team = document.querySelector(`.final-team.${side.toLowerCase()}`);
      if (!team) return;
      const entries = state.rosters[side] || [];
      [...team.querySelectorAll('.final-card')].forEach((card, index) => {
        const entry = entries[index];
        if (!entry || card.querySelector('.jb78-final-meaning')) return;
        const profile = profileOf(entry.job);
        const detailButton = card.querySelector('[data-job-detail]');
        const html = `<div class="jb78-final-meaning"><small>해결하는 문제</small><p>${escapeHtml(shortText(profile.contribution, 80))}</p></div>`;
        if (detailButton) detailButton.insertAdjacentHTML('beforebegin', html);
        else card.insertAdjacentHTML('beforeend', html);
      });
    });
  }

  renderGameEnd = function meaningRenderGameEndV78() {
    originalRenderGameEndV78();
    normalizeReflection();
    decorateFinalCards();
    renderReflection();
  };

  prepareMatch = function meaningPrepareMatchV78() {
    state.jb78Reflection = { jobs: [], reason: '' };
    return originalPrepareMatchV78();
  };

  function decorateJobDetail() {
    const content = document.querySelector('#jb7JobContent');
    const title = document.querySelector('#jb7JobTitle')?.textContent.trim();
    if (!content || !title || content.querySelector('.jb78-detail-meaning')) return;
    const job = JOBS.find(item => item.name === title);
    if (!job) return;
    const hero = content.querySelector('.jb7-job-hero');
    const html = `
      <section class="jb78-detail-meaning">
        <span>직업 이름 뒤의 진짜 역할</span>
        ${meaningMapHtml(job)}
        <p>이 직업이 해결하는 문제와 사용하는 힘 중, 나와 닮았다고 느끼는 부분은 무엇인가요?</p>
      </section>
    `;
    if (hero) hero.insertAdjacentHTML('afterend', html);
    else content.insertAdjacentHTML('afterbegin', html);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const jobButton = event.target.closest('[data-jb78-job]');
      if (jobButton) {
        normalizeReflection();
        const id = jobButton.dataset.jb78Job;
        const index = state.jb78Reflection.jobs.indexOf(id);
        if (index >= 0) {
          state.jb78Reflection.jobs.splice(index, 1);
        } else if (state.jb78Reflection.jobs.length < 3) {
          state.jb78Reflection.jobs.push(id);
        }
        if (!state.jb78Reflection.jobs.length) state.jb78Reflection.reason = '';
        save();
        renderReflection();
        return;
      }

      const reasonButton = event.target.closest('[data-jb78-reason]');
      if (reasonButton) {
        normalizeReflection();
        state.jb78Reflection.reason = reasonButton.dataset.jb78Reason;
        save();
        renderReflection();
      }
    });

    new MutationObserver(decorateJobDetail)
      .observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    applyQuestionReframes();
    normalizeReflection();
    bindEvents();
    if (state.phase === 'play') {
      renderQuestions();
      decorateRevealedCards();
    }
    if (state.phase === 'gameEnd') {
      decorateFinalCards();
      renderReflection();
    }
    window.JOB_BATTLE_MEANING_RELEASE = RELEASE;
  }

  init();
})();