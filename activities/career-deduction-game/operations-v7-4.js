(() => {
  'use strict';

  const RELEASE = 'v7.4';
  const MODE_LABELS = {
    full: '기본전 · 상대 전원 맞히기',
    speed: '스피드전 · 먼저 3개 맞히기',
    time: '시간전 · 제한시간 점수 승부'
  };

  const originalSaveV74 = save;
  const originalLoadV74 = load;
  const originalPrepareMatchV74 = prepareMatch;
  const originalRenderScoreboardV74 = renderScoreboard;
  const originalRenderTurnV74 = renderTurn;
  const originalAdvanceTurnV74 = advanceTurn;
  const originalToggleTurnV74 = toggleTurn;
  const originalLaunchBonusV74 = launchBonus;
  const originalFinishMatchV74 = finishMatch;
  const originalRenderGameEndV74 = renderGameEnd;

  function normalizeOperationsState() {
    if (!['full', 'speed', 'time'].includes(state.matchMode)) state.matchMode = 'full';
    state.matchDurationSeconds = [300, 480, 600].includes(Number(state.matchDurationSeconds)) ? Number(state.matchDurationSeconds) : 480;
    state.matchTimeLeft = Number.isFinite(Number(state.matchTimeLeft)) ? Math.max(0, Number(state.matchTimeLeft)) : state.matchDurationSeconds;
    state.matchTimer = null;
    state.hostPaused = Boolean(state.hostPaused);
    state.matchOvertime = Boolean(state.matchOvertime);
    state.matchEndReason ||= '';
    state.matchStartedAt ||= null;
    state.matchClockPausedForBonus = Boolean(state.matchClockPausedForBonus);
  }

  save = function operationsSaveV74() {
    normalizeOperationsState();
    const timer = state.matchTimer;
    state.matchTimer = null;
    const result = originalSaveV74();
    state.matchTimer = timer;
    return result;
  };

  load = function operationsLoadV74() {
    const loaded = originalLoadV74();
    if (!loaded) return false;
    normalizeOperationsState();
    state.matchTimer = null;
    return true;
  };

  function speedTarget(side) {
    return Math.min(3, state.teamSizes[opponent(side)] || 3);
  }

  function scoreTarget(side) {
    if (state.matchMode === 'speed') return speedTarget(side);
    return state.teamSizes[opponent(side)] || 0;
  }

  function formatClock(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60);
    const rest = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }

  function createSetupModeSelector() {
    const settings = document.querySelector('.battle-settings');
    const startButton = document.querySelector('#startSetup');
    if (!settings || !startButton || document.querySelector('#jb74ModeSetup')) return;
    const section = document.createElement('section');
    section.id = 'jb74ModeSetup';
    section.className = 'jb74-mode-setup';
    section.innerHTML = `
      <div class="jb74-mode-head">
        <div><span class="step-label">WIN CONDITION</span><h2>어떻게 이길지 정해요</h2></div>
        <span class="mini-sticker">3 MODES</span>
      </div>
      <div class="jb74-mode-grid">
        <label><input type="radio" name="jb74MatchMode" value="speed"><span><b>⚡ 스피드전</b><small>상대 직업을 먼저 3개 맞히면 승리</small></span></label>
        <label><input type="radio" name="jb74MatchMode" value="full" checked><span><b>🏁 기본전</b><small>상대 팀의 모든 직업을 맞히면 승리</small></span></label>
        <label><input type="radio" name="jb74MatchMode" value="time"><span><b>⏱ 시간전</b><small>시간이 끝났을 때 더 많이 맞힌 팀 승리</small></span></label>
      </div>
      <div class="jb74-time-options hidden" id="jb74TimeOptions">
        <b>시간전 경기 시간</b>
        <div>
          <label><input type="radio" name="jb74MatchDuration" value="300"><span>5분</span></label>
          <label><input type="radio" name="jb74MatchDuration" value="480" checked><span>8분 · 추천</span></label>
          <label><input type="radio" name="jb74MatchDuration" value="600"><span>10분</span></label>
        </div>
      </div>
      <p class="jb74-mode-note" id="jb74ModeNote">기본전 · 상대 팀 전원의 직업을 먼저 밝혀라!</p>
    `;
    settings.insertBefore(section, startButton);

    section.addEventListener('change', event => {
      const mode = event.target.closest('input[name="jb74MatchMode"]');
      const duration = event.target.closest('input[name="jb74MatchDuration"]');
      if (mode) {
        state.matchMode = mode.value;
        document.querySelector('#jb74TimeOptions')?.classList.toggle('hidden', state.matchMode !== 'time');
        document.querySelector('#jb74ModeNote').textContent = MODE_LABELS[state.matchMode];
      }
      if (duration) state.matchDurationSeconds = Number(duration.value);
      state.matchTimeLeft = state.matchDurationSeconds;
      save();
    });
  }

  function syncSetupControls() {
    const mode = document.querySelector(`input[name="jb74MatchMode"][value="${state.matchMode}"]`);
    const duration = document.querySelector(`input[name="jb74MatchDuration"][value="${state.matchDurationSeconds}"]`);
    if (mode) mode.checked = true;
    if (duration) duration.checked = true;
    document.querySelector('#jb74TimeOptions')?.classList.toggle('hidden', state.matchMode !== 'time');
    const note = document.querySelector('#jb74ModeNote');
    if (note) note.textContent = MODE_LABELS[state.matchMode];
  }

  function createMatchStatusBar() {
    const play = document.querySelector('#playScreen');
    const header = document.querySelector('#playScreen .battle-header');
    if (!play || !header || document.querySelector('#jb74MatchBar')) return;
    const bar = document.createElement('section');
    bar.id = 'jb74MatchBar';
    bar.className = 'jb74-match-bar';
    bar.innerHTML = `
      <div><small>MATCH MODE</small><b id="jb74ModeLabel">${MODE_LABELS.full}</b></div>
      <div class="jb74-match-clock" id="jb74MatchClockWrap"><small>MATCH TIME</small><strong id="jb74MatchClock">08:00</strong></div>
      <button type="button" id="jb74HostOpen">🎛 진행자 제어판</button>
    `;
    header.insertAdjacentElement('afterend', bar);
  }

  function createHostPanel() {
    if (document.querySelector('#jb74HostModal')) return;
    const modal = document.createElement('div');
    modal.id = 'jb74HostModal';
    modal.className = 'modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-card light jb74-host-card">
        <div class="modal-head"><div><span class="eyebrow">HOST CONTROL</span><h2>진행자 제어판</h2></div><button class="close jb74-host-close" type="button">×</button></div>
        <div class="jb74-host-summary">
          <div><small>게임 방식</small><b id="jb74HostMode"></b></div>
          <div><small>현재 차례</small><b id="jb74HostTurn"></b></div>
          <div><small>점수</small><b id="jb74HostScore"></b></div>
          <div><small>경기 시간</small><b id="jb74HostTime"></b></div>
        </div>
        <section class="jb74-host-section">
          <h3>흐름 제어</h3>
          <div class="jb74-host-actions">
            <button type="button" data-host-action="pause">⏸ 전체 일시정지</button>
            <button type="button" data-host-action="resume">▶ 게임 재개</button>
            <button type="button" data-host-action="next">⏭ 강제 턴 넘기기</button>
          </div>
        </section>
        <section class="jb74-host-section">
          <h3>보너스 제어</h3>
          <div class="jb74-host-actions">
            <button type="button" data-host-action="bonus">★ 보너스 즉시 실행</button>
            <button type="button" data-host-action="skip-bonus">보너스 건너뛰기</button>
          </div>
        </section>
        <section class="jb74-host-section">
          <h3>비밀카드 다시 확인</h3>
          <div class="jb74-host-actions">
            <button type="button" data-host-secret="A">🔵 ${escapeHtml(teamLabel('A'))}</button>
            <button type="button" data-host-secret="B">🟠 ${escapeHtml(teamLabel('B'))}</button>
          </div>
        </section>
        <section class="jb74-host-section danger">
          <h3>게임 종료</h3>
          <div class="jb74-host-actions">
            <button type="button" data-host-finish="score">현재 점수로 종료</button>
            <button type="button" data-host-finish="A">A팀 승리 처리</button>
            <button type="button" data-host-finish="B">B팀 승리 처리</button>
          </div>
        </section>
        <p class="jb74-host-note">진행자 제어는 수업 흐름 복구용입니다. 학생이 실수로 누르지 않도록 화면을 가까이에서 조작하세요.</p>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.jb74-host-close')) closeModal('jb74HostModal');
    });
  }

  function renderMatchStatus() {
    const label = document.querySelector('#jb74ModeLabel');
    const clockWrap = document.querySelector('#jb74MatchClockWrap');
    const clock = document.querySelector('#jb74MatchClock');
    if (label) label.textContent = MODE_LABELS[state.matchMode];
    if (clockWrap) clockWrap.classList.toggle('hidden', state.matchMode !== 'time');
    if (clock) {
      clock.textContent = state.matchOvertime ? '연장전' : formatClock(state.matchTimeLeft);
      clock.classList.toggle('urgent', state.matchMode === 'time' && !state.matchOvertime && state.matchTimeLeft <= 60);
    }
  }

  function renderHostSummary() {
    const mode = document.querySelector('#jb74HostMode');
    const turn = document.querySelector('#jb74HostTurn');
    const score = document.querySelector('#jb74HostScore');
    const time = document.querySelector('#jb74HostTime');
    if (mode) mode.textContent = MODE_LABELS[state.matchMode];
    if (turn) turn.textContent = teamLabel(state.turn);
    if (score) score.textContent = `${teamLabel('A')} ${discovered('A')} : ${discovered('B')} ${teamLabel('B')}`;
    if (time) time.textContent = state.matchMode === 'time' ? (state.matchOvertime ? '연장전' : formatClock(state.matchTimeLeft)) : '사용 안 함';
    const pause = document.querySelector('[data-host-action="pause"]');
    const resume = document.querySelector('[data-host-action="resume"]');
    if (pause) pause.disabled = state.hostPaused;
    if (resume) resume.disabled = !state.hostPaused;
  }

  function clearMatchTimer() {
    if (state.matchTimer) clearInterval(state.matchTimer);
    state.matchTimer = null;
  }

  function pauseMatchTimer() {
    clearMatchTimer();
  }

  function closeOperationalModals() {
    ['actionModal', 'guessModal', 'feedbackModal', 'bonusModal', 'hintModal', 'jb71HistoryModal', 'jb72CandidateModal'].forEach(id => {
      const modal = document.querySelector(`#${id}`);
      if (modal && !modal.classList.contains('hidden')) closeModal(id);
    });
    if (typeof feedbackCallback !== 'undefined') feedbackCallback = null;
    state.pendingAction = null;
    state.bonusWinner = null;
  }

  function timeWinner() {
    const a = discovered('A');
    const b = discovered('B');
    if (a > b) return 'A';
    if (b > a) return 'B';
    return null;
  }

  function finishByTime() {
    clearMatchTimer();
    const winner = timeWinner();
    if (winner) {
      state.matchEndReason = `제한시간 종료 · ${discovered(winner)}개 발견`;
      closeOperationalModals();
      finishMatch(winner);
      return;
    }
    state.matchOvertime = true;
    state.matchEndReason = '제한시간 동점 · 다음 정답 승리';
    renderMatchStatus();
    renderHostSummary();
    openFeedback('wrong', '동점! 연장전', '제한시간이 끝났지만 점수가 같습니다. 다음 직업을 먼저 맞히는 팀이 승리합니다.', '연장전 시작 →', () => {
      if (!state.hostPaused) startTurnTimer(false);
      save();
    });
  }

  function startMatchTimer(reset = false) {
    clearMatchTimer();
    if (state.matchMode !== 'time' || state.matchOvertime || state.hostPaused || state.phase !== 'play') return;
    if (reset || !Number.isFinite(state.matchTimeLeft) || state.matchTimeLeft <= 0) state.matchTimeLeft = state.matchDurationSeconds;
    renderMatchStatus();
    state.matchTimer = setInterval(() => {
      state.matchTimeLeft -= 1;
      renderMatchStatus();
      if (state.matchTimeLeft <= 0) finishByTime();
    }, 1000);
  }

  function resetOperationsForMatch() {
    clearMatchTimer();
    state.matchTimeLeft = state.matchDurationSeconds;
    state.hostPaused = false;
    state.matchOvertime = false;
    state.matchEndReason = '';
    state.matchStartedAt = null;
    state.matchClockPausedForBonus = false;
  }

  prepareMatch = function operationsPrepareMatchV74() {
    resetOperationsForMatch();
    return originalPrepareMatchV74();
  };

  function startOperationsAfterBegin() {
    if (state.phase !== 'play') return;
    state.matchStartedAt ||= Date.now();
    renderMatchStatus();
    if (state.matchMode === 'time') startMatchTimer(state.matchTimeLeft === state.matchDurationSeconds);
    save();
  }

  renderScoreboard = function operationsScoreboardV74() {
    originalRenderScoreboardV74();
    const a = document.querySelector('#scoreA');
    const b = document.querySelector('#scoreB');
    if (a) a.textContent = `${discovered('A')} / ${scoreTarget('A')}`;
    if (b) b.textContent = `${discovered('B')} / ${scoreTarget('B')}`;
    renderMatchStatus();
  };

  renderTurn = function operationsTurnV74() {
    originalRenderTurnV74();
    const guide = document.querySelector('#turnGuide');
    if (!guide) return;
    if (state.matchMode === 'speed') guide.textContent = `${scoreTarget(state.turn)}개 중 ${discovered(state.turn)}개 발견 · 행동 하나를 선택하세요.`;
    if (state.matchMode === 'time') guide.textContent = state.matchOvertime ? '연장전 · 다음 정답이 승부를 결정합니다.' : `${formatClock(state.matchTimeLeft)} 안에 더 많은 직업을 맞히세요.`;
  };

  function shouldFinishBeforeNextTurn() {
    if (state.matchMode === 'speed' && discovered(state.turn) >= speedTarget(state.turn)) {
      state.matchEndReason = `스피드전 목표 ${speedTarget(state.turn)}개 달성`;
      return state.turn;
    }
    if (state.matchMode === 'time' && state.matchOvertime) {
      const winner = timeWinner();
      if (winner) {
        state.matchEndReason = '연장전 첫 정답';
        return winner;
      }
    }
    return null;
  }

  advanceTurn = function operationsAdvanceTurnV74() {
    const winner = shouldFinishBeforeNextTurn();
    if (winner) {
      finishMatch(winner);
      return;
    }
    return originalAdvanceTurnV74();
  };

  toggleTurn = function operationsToggleTurnV74() {
    const result = originalToggleTurnV74();
    if (state.matchClockPausedForBonus) state.matchClockPausedForBonus = false;
    if (state.matchMode === 'time' && !state.matchOvertime && !state.hostPaused && !state.matchTimer) startMatchTimer(false);
    renderHostSummary();
    return result;
  };

  launchBonus = function operationsLaunchBonusV74(gate) {
    if (state.matchMode === 'time' && state.matchTimer) {
      state.matchClockPausedForBonus = true;
      pauseMatchTimer();
    }
    return originalLaunchBonusV74(gate);
  };

  finishMatch = function operationsFinishMatchV74(winner) {
    clearMatchTimer();
    state.hostPaused = false;
    if (!state.matchEndReason) {
      state.matchEndReason = state.matchMode === 'full' ? '상대 팀 전원 직업 발견' : MODE_LABELS[state.matchMode];
    }
    return originalFinishMatchV74(winner);
  };

  renderGameEnd = function operationsGameEndV74() {
    originalRenderGameEndV74();
    const copy = document.querySelector('#gameEndCopy');
    if (!copy) return;
    const winner = state.winner || 'A';
    copy.textContent = `${state.matchEndReason || MODE_LABELS[state.matchMode]} · 최종 점수 ${discovered(winner)} : ${discovered(opponent(winner))}`;
  };

  function forceNextTurn() {
    if (state.phase !== 'play') return;
    closeOperationalModals();
    clearTimers();
    log(`<b>진행자</b> 강제 턴 전환`);
    originalToggleTurnV74();
    if (state.matchMode === 'time' && !state.matchOvertime && !state.hostPaused) startMatchTimer(false);
    renderHostSummary();
  }

  function launchHostBonus() {
    if (state.phase !== 'play') return;
    closeModal('jb74HostModal');
    closeOperationalModals();
    const gate = `HOST-${Date.now()}`;
    state.bonusDone.push(gate);
    launchBonus(gate);
    const round = document.querySelector('#bonusRoundLabel');
    if (round) round.textContent = 'HOST BONUS';
    log('<b>진행자</b> 보너스 즉시 실행');
  }

  function skipBonus() {
    const bonusOpen = !document.querySelector('#bonusModal')?.classList.contains('hidden');
    const hintOpen = !document.querySelector('#hintModal')?.classList.contains('hidden');
    if (!bonusOpen && !hintOpen) return;
    if (bonusOpen) closeModal('bonusModal');
    if (hintOpen) closeModal('hintModal');
    if (state.bonusTimer) clearInterval(state.bonusTimer);
    state.bonusTimer = null;
    state.bonusWinner = null;
    log('<b>진행자</b> 보너스 건너뛰기');
    originalToggleTurnV74();
    if (state.matchMode === 'time' && !state.matchOvertime && !state.hostPaused) startMatchTimer(false);
  }

  function pauseAll() {
    if (state.phase !== 'play') return;
    pauseTurnTimer();
    pauseMatchTimer();
    state.hostPaused = true;
    document.body.classList.add('jb74-paused');
    renderHostSummary();
    renderMatchStatus();
    save();
  }

  function resumeAll() {
    if (state.phase !== 'play') return;
    state.hostPaused = false;
    document.body.classList.remove('jb74-paused');
    startTurnTimer(false);
    if (state.matchMode === 'time' && !state.matchOvertime) startMatchTimer(false);
    renderHostSummary();
    renderMatchStatus();
    save();
  }

  function finishFromHost(choice) {
    if (state.phase !== 'play') return;
    let winner = choice;
    if (choice === 'score') winner = timeWinner() || state.turn;
    if (!['A', 'B'].includes(winner)) return;
    if (!confirm(`${teamLabel(winner)} 승리로 게임을 종료할까요?`)) return;
    closeOperationalModals();
    closeModal('jb74HostModal');
    state.matchEndReason = choice === 'score' ? '진행자 현재 점수 종료' : '진행자 승리 처리';
    finishMatch(winner);
  }

  function bindHostEvents() {
    document.querySelector('#jb74HostOpen')?.addEventListener('click', () => {
      renderHostSummary();
      openModal('jb74HostModal');
    });
    document.addEventListener('click', event => {
      const action = event.target.closest('[data-host-action]')?.dataset.hostAction;
      if (action === 'pause') pauseAll();
      if (action === 'resume') resumeAll();
      if (action === 'next') forceNextTurn();
      if (action === 'bonus') launchHostBonus();
      if (action === 'skip-bonus') skipBonus();

      const secret = event.target.closest('[data-host-secret]')?.dataset.hostSecret;
      if (secret) {
        closeModal('jb74HostModal');
        showTeamSecret(secret);
      }

      const finish = event.target.closest('[data-host-finish]')?.dataset.hostFinish;
      if (finish) finishFromHost(finish);
    });

    document.querySelector('#beginMatch')?.addEventListener('click', () => setTimeout(startOperationsAfterBegin, 0));
    document.querySelector('#resumeBtn')?.addEventListener('click', () => setTimeout(() => {
      normalizeOperationsState();
      renderMatchStatus();
      if (state.phase === 'play' && state.matchMode === 'time' && !state.hostPaused && !state.matchOvertime) startMatchTimer(false);
    }, 0));
    document.querySelector('#restartSame')?.addEventListener('click', () => setTimeout(() => {
      resetOperationsForMatch();
      save();
    }, 0));
  }

  function addReleaseBadge() {
    const brand = document.querySelector('.brand > span:last-child');
    if (!brand || brand.querySelector('.jb74-release-badge')) return;
    const badge = document.createElement('span');
    badge.className = 'jb74-release-badge';
    badge.textContent = RELEASE;
    brand.appendChild(badge);
  }

  function init() {
    normalizeOperationsState();
    createSetupModeSelector();
    createMatchStatusBar();
    createHostPanel();
    syncSetupControls();
    bindHostEvents();
    addReleaseBadge();
    renderMatchStatus();
  }

  init();
})();