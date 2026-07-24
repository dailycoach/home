(() => {
  'use strict';

  function stopMatchClock() {
    if (state.matchTimer) clearInterval(state.matchTimer);
    state.matchTimer = null;
  }

  function isOpen(id) {
    const modal = document.querySelector(`#${id}`);
    return Boolean(modal && !modal.classList.contains('hidden'));
  }

  function keepPausedState() {
    if (!state.hostPaused) return;
    pauseTurnTimer();
    stopMatchClock();
    document.body.classList.add('jb74-paused');
    save();
  }

  function resumeBonusTimer() {
    if (!state.jb74PausedBonus || !isOpen('bonusModal')) return false;
    state.jb74PausedBonus = false;
    state.hostPaused = false;
    document.body.classList.remove('jb74-paused');
    closeModal('jb74HostModal');
    state.bonusTimer = setInterval(() => {
      state.bonusTimeLeft -= 1;
      const timer = document.querySelector('#bonusTimer');
      if (timer) timer.textContent = Math.max(0, state.bonusTimeLeft);
      if (state.bonusTimeLeft <= 0) {
        clearInterval(state.bonusTimer);
        state.bonusTimer = null;
        revealBonus();
      }
    }, 1000);
    save();
    return true;
  }

  function resumeModalFlow() {
    const waitingModal = ['hintModal', 'actionModal', 'guessModal', 'jb71HistoryModal', 'jb72CandidateModal'].some(isOpen);
    if (!waitingModal) return false;
    state.hostPaused = false;
    document.body.classList.remove('jb74-paused');
    closeModal('jb74HostModal');
    save();
    return true;
  }

  document.addEventListener('click', event => {
    const hostAction = event.target.closest('[data-host-action]')?.dataset.hostAction;

    if (hostAction === 'pause' && isOpen('bonusModal') && state.bonusTimer) {
      clearInterval(state.bonusTimer);
      state.bonusTimer = null;
      state.jb74PausedBonus = true;
    }

    if (hostAction === 'resume') {
      if (isOpen('secretModal')) closeModal('secretModal');
      if (resumeBonusTimer() || resumeModalFlow()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }

    if (hostAction === 'next' && state.hostPaused) {
      setTimeout(() => {
        pauseTurnTimer();
        stopMatchClock();
        document.body.classList.add('jb74-paused');
      }, 0);
    }

    const secretButton = event.target.closest('[data-host-secret]');
    if (secretButton) {
      pauseTurnTimer();
      stopMatchClock();
      state.hostPaused = true;
      document.body.classList.add('jb74-paused');
      save();
    }

    const scoreFinish = event.target.closest('[data-host-finish="score"]');
    if (scoreFinish && discovered('A') === discovered('B')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert('현재 점수가 동점입니다. 연장전을 진행하거나 A팀·B팀 승리 처리 버튼을 선택하세요.');
    }
  }, true);

  document.querySelector('#resumeBtn')?.addEventListener('click', () => setTimeout(keepPausedState, 0));

  document.querySelector('#jb74HostOpen')?.addEventListener('click', () => {
    const a = document.querySelector('[data-host-secret="A"]');
    const b = document.querySelector('[data-host-secret="B"]');
    if (a) a.textContent = `🔵 ${teamLabel('A')}`;
    if (b) b.textContent = `🟠 ${teamLabel('B')}`;
  });

  const speedCopy = document.querySelector('input[name="jb74MatchMode"][value="speed"]+span small');
  if (speedCopy) speedCopy.textContent = '먼저 3개 · 상대가 2명이면 전원 맞히기';
  const spotlight = document.querySelector('#turnSpotlight');
  if (spotlight) spotlight.style.position = 'relative';

  const feedbackTitle = document.querySelector('#feedbackTitle');
  if (feedbackTitle) {
    new MutationObserver(() => {
      if (feedbackTitle.textContent.trim() !== '동점! 연장전') return;
      ['actionModal', 'guessModal', 'bonusModal', 'hintModal', 'jb71HistoryModal', 'jb72CandidateModal'].forEach(id => {
        if (isOpen(id)) closeModal(id);
      });
    }).observe(feedbackTitle, { childList: true, characterData: true, subtree: true });
  }
})();