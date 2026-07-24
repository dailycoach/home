(() => {
  'use strict';

  const SESSION_KEY = 'job-battle-v7-6-tutorial-shown';
  let previousFocus = null;
  let pausedByTutorial = false;

  function createReplayButton() {
    if (document.querySelector('#jb76HowToReplay')) return;
    const button = document.createElement('button');
    button.id = 'jb76HowToReplay';
    button.className = 'jb76-howto-replay';
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', 'jb76HowToModal');
    button.innerHTML = '<span aria-hidden="true">?</span><b>사용법<br>다시보기</b>';
    document.body.appendChild(button);
  }

  function createTutorialModal() {
    const briefing = document.querySelector('#jb75Briefing');
    if (!briefing || document.querySelector('#jb76HowToModal')) return false;

    const modal = document.createElement('div');
    modal.id = 'jb76HowToModal';
    modal.className = 'modal hidden jb76-howto-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'jb76HowToTitle');
    modal.innerHTML = `
      <div class="jb76-howto-card">
        <header class="jb76-howto-head">
          <div>
            <span>GAME MANUAL · JOB BATTLE</span>
            <h2 id="jb76HowToTitle">게임 사용법</h2>
            <p>규칙을 확인하고 팀 추리 배틀을 시작하세요.</p>
          </div>
          <button class="jb76-howto-close" type="button" aria-label="사용법 닫기">×</button>
        </header>
        <div class="jb76-howto-scroll" id="jb76HowToBody"></div>
        <footer class="jb76-howto-footer">
          <p><b>핵심:</b> 한 턴에 행동 하나 · 질문은 짧게 · 정답 공격은 신중하게!</p>
          <button class="jb76-howto-start" type="button">확인 완료 · 게임 준비 시작 →</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);

    briefing.classList.add('jb76-briefing-in-modal');
    document.querySelector('#jb76HowToBody').appendChild(briefing);
    return true;
  }

  function pauseGameForTutorial() {
    pausedByTutorial = false;
    if (typeof state === 'undefined' || state.phase !== 'play' || state.hostPaused) return;

    const pauseButton = document.querySelector('[data-host-action="pause"]');
    if (pauseButton) {
      pauseButton.click();
      pausedByTutorial = true;
      return;
    }

    if (typeof pauseTurnTimer === 'function') {
      pauseTurnTimer();
      pausedByTutorial = true;
    }
  }

  function resumeGameAfterTutorial() {
    if (!pausedByTutorial || typeof state === 'undefined' || state.phase !== 'play') {
      pausedByTutorial = false;
      return;
    }

    const resumeButton = document.querySelector('[data-host-action="resume"]');
    if (resumeButton) resumeButton.click();
    else if (typeof startTurnTimer === 'function') startTurnTimer(false);
    pausedByTutorial = false;
  }

  function resetTutorialView() {
    const scroll = document.querySelector('#jb76HowToBody');
    if (scroll) scroll.scrollTop = 0;
    const firstStep = document.querySelector('[data-jb75-step="0"]');
    if (firstStep && !firstStep.classList.contains('active')) firstStep.click();
    const details = document.querySelector('#jb75Briefing .jb75-detail-rules');
    if (details) details.open = false;
  }

  function openTutorial({ automatic = false } = {}) {
    const modal = document.querySelector('#jb76HowToModal');
    if (!modal || !modal.classList.contains('hidden')) return;

    previousFocus = document.activeElement;
    pauseGameForTutorial();
    resetTutorialView();
    if (typeof openModal === 'function') openModal('jb76HowToModal');
    else modal.classList.remove('hidden');
    document.body.classList.add('jb76-tutorial-open');
    document.querySelector('#jb76HowToReplay')?.setAttribute('aria-expanded', 'true');
    if (automatic) sessionStorage.setItem(SESSION_KEY, '1');
    setTimeout(() => document.querySelector('.jb76-howto-close')?.focus(), 80);
  }

  function closeTutorial({ moveToSetup = false } = {}) {
    const modal = document.querySelector('#jb76HowToModal');
    if (!modal || modal.classList.contains('hidden')) return;

    if (typeof closeModal === 'function') closeModal('jb76HowToModal');
    else modal.classList.add('hidden');
    document.body.classList.remove('jb76-tutorial-open');
    document.querySelector('#jb76HowToReplay')?.setAttribute('aria-expanded', 'false');
    resumeGameAfterTutorial();

    if (moveToSetup) {
      const setup = document.querySelector('#setupScreen .setup-arena');
      setup?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => document.querySelector('#teamNameA')?.focus({ preventScroll: true }), 650);
      return;
    }
    previousFocus?.focus?.();
  }

  function syncReplayVisibility() {
    const button = document.querySelector('#jb76HowToReplay');
    if (!button) return;
    const tutorialOpen = !document.querySelector('#jb76HowToModal')?.classList.contains('hidden');
    const anotherModalOpen = [...document.querySelectorAll('.modal:not(.hidden)')]
      .some(modal => modal.id !== 'jb76HowToModal');
    button.classList.toggle('is-hidden', tutorialOpen || anotherModalOpen);
  }

  function bindEvents() {
    document.querySelector('#jb76HowToReplay')?.addEventListener('click', () => openTutorial());
    document.querySelector('.jb76-howto-close')?.addEventListener('click', () => closeTutorial());
    document.querySelector('.jb76-howto-start')?.addEventListener('click', () => closeTutorial({ moveToSetup: true }));

    const modal = document.querySelector('#jb76HowToModal');
    modal?.addEventListener('click', event => {
      if (event.target === modal) closeTutorial();
    });

    document.querySelector('#jb75GoSetup')?.addEventListener('click', () => closeTutorial({ moveToSetup: true }), true);

    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal?.classList.contains('hidden')) closeTutorial();
    });

    const observer = new MutationObserver(syncReplayVisibility);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    syncReplayVisibility();
  }

  function init() {
    createReplayButton();
    if (!createTutorialModal()) return;
    bindEvents();

    const alreadyShown = sessionStorage.getItem(SESSION_KEY) === '1';
    if (!alreadyShown && typeof state !== 'undefined' && state.phase === 'setup') {
      setTimeout(() => openTutorial({ automatic: true }), 180);
    }
  }

  init();
})();