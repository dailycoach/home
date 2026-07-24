(() => {
  'use strict';

  function stopMatchClock() {
    if (state.matchTimer) clearInterval(state.matchTimer);
    state.matchTimer = null;
  }

  function keepPausedState() {
    if (!state.hostPaused) return;
    pauseTurnTimer();
    stopMatchClock();
    document.body.classList.add('jb74-paused');
    save();
  }

  document.addEventListener('click', event => {
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
})();