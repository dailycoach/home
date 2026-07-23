function beginMatch() {
  state.phase = 'play';
  renderPlay();
  showScreen('playScreen');
  startTurnTimer();
  save();
}

function discovered(side) {
  return state.rosters[opponent(side)].filter(entry => entry.revealed).length;
}

function remaining(side) {
  return state.rosters[opponent(side)].filter(entry => !entry.revealed).length;
}

function unresolvedTargets(side) {
  return state.rosters[opponent(side)]
    .map((entry, index) => ({ ...entry, index }))
    .filter(entry => !entry.revealed);
}

function renderPlay() {
  renderScoreboard();
  renderTurn();
  renderTargetBoard();
  renderBonusStatus();
  renderQuestions();
  renderLog();
}

function renderScoreboard() {
  $('#scoreNameA').textContent = teamLabel('A');
  $('#scoreNameB').textContent = teamLabel('B');
  $('#scoreA').textContent = `${discovered('A')} / ${state.teamSizes.B}`;
  $('#scoreB').textContent = `${discovered('B')} / ${state.teamSizes.A}`;
  $('#scoreCardA').classList.toggle('active', state.turn === 'A');
  $('#scoreCardB').classList.toggle('active', state.turn === 'B');
}

function hintChipHtml(hint) {
  return `<span class="hint-chip"><b>${escapeHtml(hint.label)}</b>${escapeHtml(hint.value)}</span>`;
}

function targetCardHtml(entry, index) {
  if (entry.revealed) {
    return `
      <article class="target-card revealed">
        <span class="target-number">${index + 1}</span>
        <small>${escapeHtml(entry.player)}</small>
        <strong>${escapeHtml(entry.job.name)}</strong>
        <em>${CATEGORIES[entry.job.cat].name}</em>
      </article>
    `;
  }
  return `
    <article class="target-card ${entry.hints.length ? 'has-hints' : ''}">
      <span class="target-number">${index + 1}</span>
      <small>${escapeHtml(entry.player)}</small>
      <strong>SECRET JOB</strong>
      <p>${entry.hints.length ? '획득한 힌트' : '질문과 보너스로 단서를 모아!'}</p>
      <div class="hint-list">${entry.hints.map(hintChipHtml).join('')}</div>
    </article>
  `;
}

function renderTargetBoard() {
  const enemySide = opponent(state.turn);
  $('#activeTeamName').textContent = teamLabel(state.turn);
  $('#enemyTeamName').textContent = teamLabel(enemySide);
  $('#targetTitle').textContent = `${teamLabel(enemySide)}의 비밀 직업을 밝혀라!`;
  $('#remainingCount').textContent = `${remaining(state.turn)}개 남음`;
  $('#targetBoard').innerHTML = state.rosters[enemySide].map(targetCardHtml).join('');
  $('#targetPanel').classList.toggle('orange-view', state.turn === 'B');
}

function renderBonusStatus() {
  $('#bonusStatus').innerHTML = state.bonusTurns.map((turn, index) => `
    <span class="bonus-dot ${state.bonusDone.includes(turn) ? 'done' : ''}">
      ${state.bonusDone.includes(turn) ? '✓' : index + 1}
    </span>
  `).join('');
}

function renderQuestions() {
  const questions = shuffle(QUESTIONS).slice(0, 6);
  $('#questionBank').innerHTML = questions.map(question => `
    <button class="question-chip" type="button">${escapeHtml(question)}</button>
  `).join('');
  $$('.question-chip').forEach(button => button.addEventListener('click', () => {
    navigator.clipboard?.writeText(button.textContent);
    button.textContent = '복사됨 ✓';
    setTimeout(renderQuestions, 700);
  }));
}

function renderLog() {
  $('#gameLog').innerHTML = state.log.length
    ? state.log.slice().reverse().map(item => `<div class="log-item">${item}</div>`).join('')
    : `<div class="log-item">${escapeHtml(teamLabel('A'))}부터 배틀 시작!</div>`;
}

function log(message) {
  state.log.push(message);
  renderLog();
  save();
}

function renderTurn() {
  const currentName = teamLabel(state.turn);
  $('#turnSideText').textContent = `${currentName} TURN`;
  $('#turnGuide').textContent = `상대 직업 ${remaining(state.turn)}개가 남았습니다. 행동 하나를 선택하세요.`;
  $('#turnSpotlight').classList.toggle('orange-turn', state.turn === 'B');
  $('#turnTimer').textContent = state.timeLeft || state.timerSeconds;
  const chanceButton = $('[data-action="chance"]');
  chanceButton.disabled = state.chanceUsed[state.turn];
  chanceButton.querySelector('small').textContent = state.chanceUsed[state.turn] ? '이번 게임에서 사용 완료' : '게임당 한 번 · 키워드 2개';
}

function pauseTurnTimer() {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}

function startTurnTimer(reset = true) {
  pauseTurnTimer();
  state.timeLeft = reset ? state.timerSeconds : Math.max(1, state.timeLeft || state.timerSeconds);
  updateTurnTimer();
  state.timer = setInterval(() => {
    state.timeLeft -= 1;
    updateTurnTimer();
    if (state.timeLeft <= 0) {
      pauseTurnTimer();
      log(`<b>${escapeHtml(teamLabel(state.turn))}</b> 시간 종료`);
      advanceTurn();
    }
  }, 1000);
}

function updateTurnTimer() {
  const timer = $('#turnTimer');
  timer.textContent = state.timeLeft;
  timer.classList.toggle('urgent', state.timeLeft <= 5);
}

function targetOptions(side) {
  return unresolvedTargets(side).map(entry => `
    <option value="${entry.index}">${escapeHtml(entry.player)} · 힌트 ${entry.hints.length}개</option>
  `).join('');
}

function actionPrompt(type) {
  if (type === 'chance' && state.chanceUsed[state.turn]) return;
  pauseTurnTimer();
  state.pendingAction = type;
  const actionMap = {
    clue: {
      title: '🔍 단서 받기',
      description: '선택한 상대 팀원이 도구·장소·대상·필요 역량 중 하나만 짧게 말합니다.'
    },
    question: {
      title: '❓ 질문하기',
      description: '선택한 상대 팀원에게 예·아니오로 답할 수 있는 질문 하나만 합니다.'
    },
    chance: {
      title: '⚡ 팀 찬스',
      description: '게임당 한 번! 선택한 상대 팀원의 핵심 키워드 2개가 카드에 저장됩니다.'
    }
  };
  const action = actionMap[type];
  $('#actionTitle').textContent = action.title;
  $('#actionContent').innerHTML = `
    <div class="field">
      <label for="actionTarget">상대 팀원 선택</label>
      <select id="actionTarget">${targetOptions(state.turn)}</select>
    </div>
    <div class="action-rule">
      <b>${action.description}</b>
      <p>${type === 'chance' ? '보너스 힌트와 별개로 팀당 1회만 사용할 수 있습니다.' : '질문과 대답은 한 문장으로 짧게!'}</p>
    </div>
  `;
  openModal('actionModal');
}

function resolveAction() {
  const targetIndex = Number($('#actionTarget')?.value);
  const target = state.rosters[opponent(state.turn)][targetIndex];
  const type = state.pendingAction;
  closeModal('actionModal');
  if (!target || target.revealed) {
    startTurnTimer(false);
    return;
  }
  if (type === 'chance') {
    state.chanceUsed[state.turn] = true;
    const hint = {
      type: 'chance',
      label: '팀 찬스',
      value: target.job.tags.slice(0, 2).map(tag => `#${tag}`).join(' · ')
    };
    target.hints.push(hint);
    log(`<b>${escapeHtml(teamLabel(state.turn))}</b> 팀 찬스 → ${escapeHtml(target.player)} 키워드 공개`);
  } else {
    log(`<b>${escapeHtml(teamLabel(state.turn))}</b> ${type === 'clue' ? '단서 요청' : '질문'} → ${escapeHtml(target.player)}`);
  }
  renderTargetBoard();
  advanceTurn();
}

function openGuess() {
  pauseTurnTimer();
  $('#guessTarget').innerHTML = targetOptions(state.turn);
  $('#guessJob').innerHTML = JOBS.map(job => `<option value="${job.id}">${job.id} · ${escapeHtml(job.name)}</option>`).join('');
  openModal('guessModal');
}

function submitGuess() {
  const side = state.turn;
  const targetIndex = Number($('#guessTarget').value);
  const target = state.rosters[opponent(side)][targetIndex];
  const guessedId = $('#guessJob').value;
  const guessed = JOBS.find(job => job.id === guessedId);
  closeModal('guessModal');
  if (!target || target.revealed) {
    startTurnTimer(false);
    return;
  }
  if (target.job.id === guessedId) {
    openFeedback(
      'correct',
      '정답!',
      `“${target.player}”의 직업은 ${target.job.name}! 상대 직업 카드 1장을 공개합니다.`,
      '카드 공개 →',
      () => {
        target.revealed = true;
        log(`<b>${escapeHtml(teamLabel(side))}</b> 정답! ${escapeHtml(target.player)} = ${escapeHtml(target.job.name)}`);
        renderScoreboard();
        renderTargetBoard();
        if (remaining(side) === 0) finishMatch(side);
        else advanceTurn();
      }
    );
  } else {
    openFeedback(
      'wrong',
      '아깝다!',
      `“${guessed?.name || guessedId}”은(는) ${target.player}의 직업이 아닙니다. 턴이 상대 팀으로 넘어갑니다.`,
      '턴 넘기기 →',
      () => {
        log(`<b>${escapeHtml(teamLabel(side))}</b> 오답 · ${escapeHtml(target.player)} ≠ ${escapeHtml(guessed?.name || guessedId)}`);
        advanceTurn();
      }
    );
  }
}

function advanceTurn() {
  clearTimers();
  state.turnCount += 1;
  const gate = state.bonusTurns.find(turn => state.turnCount >= turn && !state.bonusDone.includes(turn));
  if (gate) {
    state.bonusDone.push(gate);
    renderBonusStatus();
    setTimeout(() => launchBonus(gate), 250);
    return;
  }
  toggleTurn();
}

function toggleTurn() {
  state.turn = opponent(state.turn);
  renderScoreboard();
  renderTurn();
  renderTargetBoard();
  startTurnTimer();
  save();
}

function launchBonus(gate) {
  clearTimers();
  state.bonusQuestion = makeBonusQuestion();
  $('#bonusRoundLabel').textContent = `BONUS ${state.bonusDone.indexOf(gate) + 1} / ${state.bonusTurns.length}`;
  $('#bonusType').textContent = state.bonusQuestion.type;
  $('#bonusQuestion').innerHTML = state.bonusQuestion.question;
  $('#bonusOptions').innerHTML = (state.bonusQuestion.options || []).map((option, index) => `
    <div class="bonus-option"><b>${String.fromCharCode(65 + index)}</b>${escapeHtml(option)}</div>
  `).join('');
  $('#bonusAnswer').textContent = `정답: ${state.bonusQuestion.answer}`;
  $('#bonusAnswer').classList.add('hidden');
  $('#bonusAward').classList.add('hidden');
  $('#revealBonus').classList.remove('hidden');
  $('#bonusTeamA').textContent = `${teamLabel('A')} 승리`;
  $('#bonusTeamB').textContent = `${teamLabel('B')} 승리`;
  state.bonusTimeLeft = 15;
  $('#bonusTimer').textContent = '15';
  openModal('bonusModal');
  state.bonusTimer = setInterval(() => {
    state.bonusTimeLeft -= 1;
    $('#bonusTimer').textContent = Math.max(0, state.bonusTimeLeft);
    if (state.bonusTimeLeft <= 0) {
      clearInterval(state.bonusTimer);
      state.bonusTimer = null;
      revealBonus();
    }
  }, 1000);
  log(`<b>BONUS ${state.bonusDone.indexOf(gate) + 1}</b> 오픈!`);
}

function makeBonusQuestion() {
  const job = pick(JOBS);
  const type = pick([0, 1, 2, 3, 4, 5, 6, 7].filter(value => value !== state.lastBonusType));
  state.lastBonusType = type;

  if (type === 0) {
    return {
      type: '초성 스피드',
      question: `<span class="bonus-big">${chosung(job.name)}</span><small>${CATEGORIES[job.cat].name}</small>`,
      answer: job.name
    };
  }
  if (type === 1) {
    return {
      type: '해시태그 3',
      question: `<span class="bonus-tags">${job.tags.map(tag => `#${escapeHtml(tag)}`).join(' · ')}</span>`,
      answer: job.name
    };
  }
  if (type === 2) {
    const distractors = shuffle(JOBS.filter(item => item.cat === job.cat && item.id !== job.id)).slice(0, 3);
    const options = shuffle([job, ...distractors]);
    return {
      type: '한 줄 설명',
      question: escapeHtml(job.desc),
      options: options.map(item => item.name),
      answer: job.name
    };
  }
  if (type === 3) {
    const wrongCategory = pick(Object.keys(CATEGORIES).filter(category => category !== job.cat));
    const isTrue = Math.random() > 0.5;
    const shownCategory = isTrue ? job.cat : wrongCategory;
    return {
      type: '직종 OX',
      question: `“${escapeHtml(job.name)}”은(는)<br><span class="bonus-highlight">${CATEGORIES[shownCategory].name}</span> 직종이다.`,
      options: ['O', 'X'],
      answer: isTrue ? 'O' : 'X'
    };
  }
  if (type === 4) {
    const categories = shuffle(Object.keys(CATEGORIES).filter(category => category !== job.cat)).slice(0, 3);
    const options = shuffle([job.cat, ...categories]);
    return {
      type: '직종 매치',
      question: `<span class="bonus-big">${escapeHtml(job.name)}</span>`,
      options: options.map(category => CATEGORIES[category].name),
      answer: CATEGORIES[job.cat].name
    };
  }
  if (type === 5) {
    const sameCategory = shuffle(JOBS.filter(item => item.cat === job.cat && item.id !== job.id)).slice(0, 3);
    const odd = pick(JOBS.filter(item => item.cat !== job.cat));
    const options = shuffle([...sameCategory, odd]);
    return {
      type: '다른 직업 찾기',
      question: `<span class="bonus-prompt">같은 직종이 아닌 하나는?</span>`,
      options: options.map(item => item.name),
      answer: odd.name
    };
  }
  if (type === 6) {
    return {
      type: '연결고리',
      question: `<span class="bonus-highlight">${CATEGORIES[job.cat].name}</span><br><span class="bonus-tags">#${escapeHtml(job.tags[0])}</span>`,
      answer: job.name
    };
  }
  return {
    type: '글자 수 힌트',
    question: `<span class="bonus-highlight">${CATEGORIES[job.cat].name}</span><br><span class="bonus-prompt">${job.name.replace(/\s/g, '').length}글자 · #${escapeHtml(job.tags[0])}</span>`,
    answer: job.name
  };
}

function revealBonus() {
  if (state.bonusTimer) clearInterval(state.bonusTimer);
  state.bonusTimer = null;
  $('#bonusAnswer').classList.remove('hidden');
  $('#bonusAward').classList.remove('hidden');
  $('#revealBonus').classList.add('hidden');
}

function awardBonus(winner) {
  closeModal('bonusModal');
  if (winner === 'NONE') {
    log('보너스 승리 팀 없음');
    toggleTurn();
    return;
  }
  state.bonusWinner = winner;
  openHintReward(winner);
}

function hintValue(entry, type) {
  const cleanName = entry.job.name.replace(/\s/g, '');
  const values = {
    category: { label: '직종', value: CATEGORIES[entry.job.cat].name },
    keyword: { label: '키워드', value: `#${pick(entry.job.tags)}` },
    first: { label: '첫 글자', value: cleanName.charAt(0) },
    last: { label: '끝 글자', value: cleanName.charAt(cleanName.length - 1) },
    length: { label: '글자 수', value: `${cleanName.length}글자` },
    work: { label: '하는 일', value: `${entry.job.desc.slice(0, 24)}${entry.job.desc.length > 24 ? '…' : ''}` },
    doubleKeyword: { label: '키워드 2개', value: entry.job.tags.slice(0, 2).map(tag => `#${tag}`).join(' · ') }
  };
  return { type, ...values[type] };
}

function availableHintTypes(entry) {
  const used = new Set(entry.hints.map(hint => hint.type));
  const remainingTypes = HINT_TYPES.filter(type => !used.has(type));
  return shuffle(remainingTypes.length >= 3 ? remainingTypes : HINT_TYPES).slice(0, 3);
}

function openHintReward(side) {
  const targets = unresolvedTargets(side);
  $('#hintWinnerLabel').textContent = `${teamLabel(side)} BONUS REWARD`;
  $('#hintTarget').innerHTML = targets.map(entry => `
    <option value="${entry.index}">${escapeHtml(entry.player)} · 힌트 ${entry.hints.length}개</option>
  `).join('');
  renderHintChoices();
  openModal('hintModal');
}

function renderHintChoices() {
  const targetIndex = Number($('#hintTarget').value);
  const target = state.rosters[opponent(state.bonusWinner)][targetIndex];
  if (!target) return;
  const metadata = {
    category: ['🧭', '직종 공개', '직업 분야를 공개합니다.'],
    keyword: ['🔑', '키워드 1개', '핵심 키워드 하나를 공개합니다.'],
    first: ['🔤', '첫 글자', '직업명의 첫 글자를 공개합니다.'],
    last: ['🏁', '끝 글자', '직업명의 마지막 글자를 공개합니다.'],
    length: ['🔢', '글자 수', '직업명이 몇 글자인지 공개합니다.'],
    work: ['🧩', '하는 일 조각', '직업 설명의 앞부분을 공개합니다.'],
    doubleKeyword: ['🔓', '키워드 2개', '핵심 키워드 두 개를 공개합니다.']
  };
  const choices = availableHintTypes(target);
  $('#hintChoices').innerHTML = choices.map(type => {
    const [icon, title, description] = metadata[type];
    return `
      <button class="hint-choice" type="button" data-hint-type="${type}">
        <span>${icon}</span><b>${title}</b><small>${description}</small>
      </button>
    `;
  }).join('');
}

function applyBonusHint(type) {
  const side = state.bonusWinner;
  const targetIndex = Number($('#hintTarget').value);
  const target = state.rosters[opponent(side)][targetIndex];
  if (!target || target.revealed) return;
  const hint = hintValue(target, type);
  if (!target.hints.some(item => item.type === hint.type)) target.hints.push(hint);
  log(`<b>${escapeHtml(teamLabel(side))}</b> 보너스 힌트 → ${escapeHtml(target.player)} · ${escapeHtml(hint.label)}`);
  closeModal('hintModal');
  state.bonusWinner = null;
  renderTargetBoard();
  toggleTurn();
}
