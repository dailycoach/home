(() => {
  'use strict';

  const RELEASE = 'v7.7';
  const SESSION_KEY = 'job-battle-v7-7-tutorial-shown';
  const OLD_SESSION_KEY = 'job-battle-v7-6-tutorial-shown';

  const tutorial = {
    scene: 0,
    whyCorrect: false,
    selectedProblem: null,
    selectedTarget: null,
    goodQuestion: false,
    answerOpened: false,
    narrowedTwice: false,
    wrongGuessSeen: false,
    correctGuess: false,
    bonusSolved: false,
    hintSelected: false,
    quiz: [null, null, null],
    mode: 'tutorial',
    pausedByTutorial: false,
    previousFocus: null
  };

  const scenes = [
    { id: 'why', label: 'WHY' },
    { id: 'problem', label: '나의 단서' },
    { id: 'target', label: '대상 선택' },
    { id: 'question', label: '좋은 질문' },
    { id: 'narrow', label: '후보 줄이기' },
    { id: 'guess', label: '정답 공격' },
    { id: 'bonus', label: '보너스' },
    { id: 'quiz', label: '확인' },
    { id: 'complete', label: '완료' }
  ];

  function removeLegacyTutorial() {
    sessionStorage.setItem(OLD_SESSION_KEY, '1');
    document.querySelector('#jb76HowToModal')?.remove();
    document.querySelector('#jb76HowToReplay')?.remove();
    document.querySelector('#jb75Briefing')?.remove();
    document.body.classList.remove('jb76-tutorial-open');
  }

  function createShell() {
    if (document.querySelector('#jb77TutorialModal')) return;

    const replay = document.createElement('button');
    replay.id = 'jb77HelpButton';
    replay.className = 'jb77-help-button';
    replay.type = 'button';
    replay.setAttribute('aria-haspopup', 'dialog');
    replay.setAttribute('aria-controls', 'jb77TutorialModal');
    replay.innerHTML = '<span aria-hidden="true">?</span><b>사용법</b>';
    document.body.appendChild(replay);

    const modal = document.createElement('div');
    modal.id = 'jb77TutorialModal';
    modal.className = 'modal hidden jb77-tutorial-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'jb77TutorialTitle');
    modal.innerHTML = `
      <div class="jb77-tutorial-card">
        <header class="jb77-tutorial-head">
          <div>
            <span id="jb77TutorialKicker">CAREER MISSION · ${RELEASE}</span>
            <h2 id="jb77TutorialTitle">90초 작전 훈련</h2>
          </div>
          <button type="button" class="jb77-close" aria-label="사용법 닫기">×</button>
        </header>
        <div class="jb77-progress" id="jb77Progress" aria-label="튜토리얼 진행률"></div>
        <main class="jb77-stage" id="jb77Stage"></main>
        <footer class="jb77-footer">
          <button type="button" class="jb77-back" id="jb77Back">← 이전</button>
          <div class="jb77-footer-note" id="jb77FooterNote">화면의 선택을 완료하면 다음으로 넘어갈 수 있어요.</div>
          <button type="button" class="jb77-next" id="jb77Next" disabled>다음 →</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function pauseGameForHelp() {
    tutorial.pausedByTutorial = false;
    if (typeof state === 'undefined' || state.phase !== 'play' || state.hostPaused) return;
    const pause = document.querySelector('[data-host-action="pause"]');
    if (pause) {
      pause.click();
      tutorial.pausedByTutorial = true;
    } else if (typeof pauseTurnTimer === 'function') {
      pauseTurnTimer();
      tutorial.pausedByTutorial = true;
    }
  }

  function resumeGameAfterHelp() {
    if (!tutorial.pausedByTutorial || typeof state === 'undefined' || state.phase !== 'play') {
      tutorial.pausedByTutorial = false;
      return;
    }
    const resume = document.querySelector('[data-host-action="resume"]');
    if (resume) resume.click();
    else if (typeof startTurnTimer === 'function') startTurnTimer(false);
    tutorial.pausedByTutorial = false;
  }

  function openModalShell() {
    const modal = document.querySelector('#jb77TutorialModal');
    if (!modal || !modal.classList.contains('hidden')) return;
    tutorial.previousFocus = document.activeElement;
    pauseGameForHelp();
    if (typeof openModal === 'function') openModal('jb77TutorialModal');
    else modal.classList.remove('hidden');
    document.body.classList.add('jb77-open');
    setTimeout(() => document.querySelector('.jb77-close')?.focus(), 60);
  }

  function closeModalShell() {
    const modal = document.querySelector('#jb77TutorialModal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (typeof closeModal === 'function') closeModal('jb77TutorialModal');
    else modal.classList.add('hidden');
    document.body.classList.remove('jb77-open');
    resumeGameAfterHelp();
    tutorial.previousFocus?.focus?.();
  }

  function resetTutorial() {
    Object.assign(tutorial, {
      scene: 0,
      whyCorrect: false,
      selectedProblem: null,
      selectedTarget: null,
      goodQuestion: false,
      answerOpened: false,
      narrowedTwice: false,
      wrongGuessSeen: false,
      correctGuess: false,
      bonusSolved: false,
      hintSelected: false,
      quiz: [null, null, null],
      mode: 'tutorial'
    });
  }

  function openTutorial({ automatic = false } = {}) {
    resetTutorial();
    openModalShell();
    render();
    if (automatic) sessionStorage.setItem(SESSION_KEY, '1');
  }

  function openHelpMenu() {
    tutorial.mode = 'menu';
    openModalShell();
    render();
  }

  function setFeedback(message, tone = 'neutral') {
    const box = document.querySelector('#jb77InlineFeedback');
    if (!box) return;
    box.className = `jb77-inline-feedback ${tone}`;
    box.textContent = message;
  }

  function progressHtml() {
    if (tutorial.mode !== 'tutorial') return '';
    return scenes.map((scene, index) => `
      <span class="${index < tutorial.scene ? 'done' : ''} ${index === tutorial.scene ? 'active' : ''}" title="${scene.label}">
        ${index < tutorial.scene ? '✓' : index + 1}
      </span>
    `).join('');
  }

  function footerState() {
    const back = document.querySelector('#jb77Back');
    const next = document.querySelector('#jb77Next');
    const note = document.querySelector('#jb77FooterNote');
    if (!back || !next || !note) return;

    if (tutorial.mode !== 'tutorial') {
      back.classList.add('hidden');
      next.classList.add('hidden');
      note.textContent = '';
      return;
    }

    back.classList.toggle('hidden', tutorial.scene === 0 || tutorial.scene === scenes.length - 1);
    next.classList.remove('hidden');

    const ready = sceneReady(tutorial.scene);
    next.disabled = !ready;
    next.textContent = tutorial.scene === scenes.length - 2 ? '작전 확인 →' : tutorial.scene === scenes.length - 1 ? '게임 준비 시작 →' : '다음 →';

    const notes = [
      '직업을 알아야 하는 이유를 골라보세요.',
      '마음이 움직이는 문제 장면을 하나 고르세요.',
      '상대 카드 한 장을 직접 선택하세요.',
      '직업을 많이 걸러낼 수 있는 질문을 고르세요.',
      '답변을 확인하고 질문을 한 번 더 해보세요.',
      '오답 결과를 확인한 뒤 정답을 맞혀보세요.',
      '보너스 정답과 받을 힌트를 선택하세요.',
      '세 문제를 모두 맞혀야 완료됩니다.',
      '이제 실제 팀 배틀을 시작할 준비가 됐어요.'
    ];
    note.textContent = notes[tutorial.scene] || '';
  }

  function sceneReady(index) {
    return [
      tutorial.whyCorrect,
      Boolean(tutorial.selectedProblem),
      tutorial.selectedTarget !== null,
      tutorial.goodQuestion,
      tutorial.answerOpened && tutorial.narrowedTwice,
      tutorial.wrongGuessSeen && tutorial.correctGuess,
      tutorial.bonusSolved && tutorial.hintSelected,
      tutorial.quiz.every(Boolean),
      true
    ][index];
  }

  function render() {
    const progress = document.querySelector('#jb77Progress');
    const stage = document.querySelector('#jb77Stage');
    const title = document.querySelector('#jb77TutorialTitle');
    const kicker = document.querySelector('#jb77TutorialKicker');
    if (!progress || !stage || !title || !kicker) return;

    progress.innerHTML = progressHtml();

    if (tutorial.mode === 'menu') {
      title.textContent = '어떤 도움이 필요하나요?';
      kicker.textContent = `HELP CENTER · ${RELEASE}`;
      stage.innerHTML = helpMenuHtml();
      bindStageEvents();
      footerState();
      return;
    }

    if (tutorial.mode === 'turnHelp') {
      title.textContent = '지금 무엇을 해야 할까?';
      kicker.textContent = 'LIVE HELP';
      stage.innerHTML = liveHelpHtml();
      bindStageEvents();
      footerState();
      return;
    }

    if (tutorial.mode === 'rules') {
      title.textContent = '전체 규칙';
      kicker.textContent = 'RULE BOOK';
      stage.innerHTML = rulesHtml();
      bindStageEvents();
      footerState();
      return;
    }

    title.textContent = scenes[tutorial.scene].label;
    kicker.textContent = `90초 작전 훈련 · ${tutorial.scene + 1} / ${scenes.length}`;
    stage.innerHTML = sceneHtml(tutorial.scene);
    bindStageEvents();
    footerState();
  }

  function whyHtml() {
    return `
      <section class="jb77-scene jb77-why">
        <div class="jb77-hook">
          <span>먼저 하나만 생각해보자.</span>
          <h3>직업을 왜 알아야 할까?</h3>
          <p><b>꿈이 없어도 괜찮아.</b> 하지만 모르는 길은 선택할 수 없어.</p>
        </div>
        <div class="jb77-choice-list">
          <button data-why="fast">꿈을 빨리 하나로 정하기 위해서</button>
          <button data-why="money">돈을 많이 버는 직업만 찾기 위해서</button>
          <button data-why="world">세상이 어떻게 움직이고, 내가 어떤 방식으로 참여할지 알기 위해서</button>
        </div>
        <div class="jb77-inline-feedback" id="jb77InlineFeedback">정답이라고 생각하는 문장을 눌러보세요.</div>
        ${tutorial.whyCorrect ? `
          <div class="jb77-core-message">
            <b>직업은 미래에 붙일 이름이 아니야.</b>
            <strong>세상의 문제를 해결하는 여러 가지 방식이야.</strong>
            <p>이 게임에서는 직업 이름보다 먼저 <em>누구를 돕고, 무엇을 해결하며, 어떤 힘을 쓰는지</em> 찾아낼 거야.</p>
          </div>
        ` : ''}
      </section>
    `;
  }

  function problemHtml() {
    const options = [
      ['rescue', '🚨', '위험에 빠진 사람을 돕는 장면', '생명·안전'],
      ['analyze', '🧠', '복잡한 문제의 원인을 찾는 장면', '분석·탐구'],
      ['create', '🎨', '전에 없던 것을 만들어내는 장면', '창작·기술'],
      ['grow', '🌱', '누군가 배우고 성장하도록 돕는 장면', '교육·상담'],
      ['connect', '🎬', '사람들에게 이야기와 즐거움을 전하는 장면', '문화·콘텐츠'],
      ['convenience', '🛠', '생활의 불편함을 더 편리하게 바꾸는 장면', '서비스·설계']
    ];
    return `
      <section class="jb77-scene">
        <div class="jb77-scene-title">
          <span>직업은 해결해야 할 장면에서 시작해.</span>
          <h3>너라면 어떤 문제에 먼저 뛰어들고 싶어?</h3>
          <p>지금 선택이 네 직업을 정하는 건 아니야. 마음이 움직이는 방향을 찾는 첫 단서야.</p>
        </div>
        <div class="jb77-problem-grid">
          ${options.map(([id, icon, text, tag]) => `
            <button data-problem="${id}" class="${tutorial.selectedProblem === id ? 'selected' : ''}">
              <span>${icon}</span><b>${text}</b><small>${tag}</small>
            </button>
          `).join('')}
        </div>
        ${tutorial.selectedProblem ? '<div class="jb77-success-line">좋아! 너는 이미 관심이 가는 문제의 단서를 하나 찾았어.</div>' : ''}
      </section>
    `;
  }

  function targetHtml() {
    return `
      <section class="jb77-scene">
        <div class="jb77-scene-title"><span>연습 라운드 시작</span><h3>누구의 직업을 추리할지 골라라</h3><p>상대 팀원마다 비밀 직업이 하나씩 있어. 질문과 힌트는 선택한 카드에 따로 쌓여.</p></div>
        <div class="jb77-practice-score"><b>TEAM BLUE</b><span>VS</span><b>TEAM ORANGE</b></div>
        <div class="jb77-target-grid">
          ${[0,1,2].map(index => `
            <button data-target="${index}" class="jb77-target-card ${tutorial.selectedTarget === index ? 'selected' : ''}">
              <span>${index + 1}</span><small>오렌지 ${index + 1}번</small><strong>SECRET JOB</strong><em>${tutorial.selectedTarget === index ? '이번 추리 대상' : '카드를 눌러 선택'}</em>
            </button>
          `).join('')}
        </div>
        ${tutorial.selectedTarget !== null ? `<div class="jb77-success-line">목표 선택 완료! 오렌지 ${tutorial.selectedTarget + 1}번의 직업을 찾아내자.</div>` : ''}
      </section>
    `;
  }

  function questionHtml() {
    return `
      <section class="jb77-scene">
        <div class="jb77-scene-title"><span>직업명을 바로 묻지 마!</span><h3>직업을 많이 걸러낼 질문은 무엇일까?</h3><p>좋은 질문은 사람·장소·도구·하는 일처럼 확인 가능한 특징 하나를 묻는다.</p></div>
        <div class="jb77-question-options">
          <button data-question="vague">이 직업은 멋진 직업인가요?<small>사람마다 생각이 달라요</small></button>
          <button data-question="good" class="${tutorial.goodQuestion ? 'correct' : ''}">야외나 현장에서 일하는 시간이 많나요?<small>답에 따라 직업을 크게 나눌 수 있어요</small></button>
          <button data-question="direct">이 직업은 소방관인가요?<small>직업명을 바로 묻는 질문</small></button>
        </div>
        <div class="jb77-inline-feedback" id="jb77InlineFeedback">가장 좋은 질문을 골라보세요.</div>
        ${tutorial.goodQuestion ? '<div class="jb77-success-line">좋은 질문! 직업 이름이 아니라 일하는 장면을 물었어.</div>' : ''}
      </section>
    `;
  }

  function narrowHtml() {
    const count = tutorial.narrowedTwice ? 9 : tutorial.answerOpened ? 24 : 80;
    return `
      <section class="jb77-scene">
        <div class="jb77-scene-title"><span>상대 팀이 답할 차례</span><h3>답을 들으면 가능한 직업이 줄어든다</h3><p>연습 직업은 비밀이지만, 상대 팀은 자기 카드의 기준을 보고 답해.</p></div>
        <div class="jb77-dialogue">
          <div class="ask"><small>우리 팀 질문</small><b>야외나 현장에서 일하는 시간이 많나요?</b></div>
          <button data-answer-open ${tutorial.answerOpened ? 'disabled' : ''}><span>○</span><b>${tutorial.answerOpened ? '예 · 현장 출동이 많아요' : '상대 답변 확인'}</b></button>
        </div>
        <div class="jb77-candidate-drop">
          <small>가능한 직업</small>
          <strong>${count}<em>개</em></strong>
          <div class="bar"><i style="width:${count === 80 ? 100 : count === 24 ? 45 : 20}%"></i></div>
          <p>${count === 80 ? '아직 질문 전' : count === 24 ? '질문 한 번으로 56개 직업을 걸러냈다!' : '두 번째 질문으로 유력 후보가 9개까지 줄었다!'}</p>
        </div>
        ${tutorial.answerOpened && !tutorial.narrowedTwice ? `<button class="jb77-second-question" data-second-question>질문 한 번 더: 안전이나 생명과 관련 있나요? →</button>` : ''}
        ${tutorial.narrowedTwice ? '<div class="jb77-answer-chip">○ 예 · 사람의 안전과 생명에 직접 관련돼요</div>' : ''}
      </section>
    `;
  }

  function guessHtml() {
    return `
      <section class="jb77-scene">
        <div class="jb77-scene-title"><span>지금 공격할까, 더 물어볼까?</span><h3>정답 공격은 확신이 생겼을 때!</h3><p>틀리면 실제 게임에서는 바로 상대 팀 턴으로 넘어가.</p></div>
        <div class="jb77-clue-board">
          <b>오렌지 ${(tutorial.selectedTarget ?? 1) + 1}번</b>
          <span>○ 현장 출동이 많다</span><span>○ 안전과 생명에 관련된다</span><span>△ 보호 장비를 착용한다</span>
        </div>
        <div class="jb77-guess-options">
          <button data-guess="wrong" class="${tutorial.wrongGuessSeen ? 'wrong-seen' : ''}">경찰관<small>오답 상황 체험</small></button>
          <button data-guess="correct" ${tutorial.wrongGuessSeen ? '' : 'disabled'} class="${tutorial.correctGuess ? 'correct' : ''}">소방관<small>${tutorial.wrongGuessSeen ? '정답 공격' : '먼저 오답 결과를 확인하세요'}</small></button>
          <button data-guess="other" disabled>응급구조사<small>연습에서는 선택하지 않아요</small></button>
        </div>
        <div class="jb77-inline-feedback ${tutorial.correctGuess ? 'success' : tutorial.wrongGuessSeen ? 'warning' : ''}" id="jb77InlineFeedback">
          ${tutorial.correctGuess ? '정답! 카드가 공개됐다. 실제 게임에서는 직업 설명도 함께 확인할 수 있어.' : tutorial.wrongGuessSeen ? '공격 실패! 실제 게임에서는 내 턴이 여기서 끝난다. 연습이니 다시 공격해보자.' : '먼저 경찰관을 눌러 오답일 때 어떤 일이 생기는지 확인하세요.'}
        </div>
        ${tutorial.correctGuess ? '<div class="jb77-reveal-card"><span>🔥</span><small>오렌지 카드 공개</small><strong>소방관</strong><p>화재와 재난으로 위험에 빠진 사람을 구조하는 문제 해결자</p></div>' : ''}
      </section>
    `;
  }

  function bonusHtml() {
    return `
      <section class="jb77-scene jb77-bonus-scene">
        <div class="jb77-bonus-alert"><span>★ SUDDEN BONUS ★</span><b>15초 안에 먼저 맞혀라!</b></div>
        <div class="jb77-bonus-question"><strong>ㅅㅂㄱ</strong><p>공공·안전 분야 · 화재와 구조</p></div>
        <div class="jb77-bonus-options">
          <button data-bonus="correct" class="${tutorial.bonusSolved ? 'correct' : ''}">소방관</button>
          <button data-bonus="wrong">수의사</button>
          <button data-bonus="wrong">세무사</button>
        </div>
        <div class="jb77-inline-feedback" id="jb77InlineFeedback">보너스 정답을 골라보세요.</div>
        ${tutorial.bonusSolved ? `
          <div class="jb77-hint-pick">
            <b>BONUS WIN! 받을 힌트를 하나 선택하세요.</b>
            <div>
              <button data-hint="first" class="${tutorial.hintSelected === 'first' ? 'selected' : ''}">첫 글자</button>
              <button data-hint="category" class="${tutorial.hintSelected === 'category' ? 'selected' : ''}">직업 분야</button>
              <button data-hint="work" class="${tutorial.hintSelected === 'work' ? 'selected' : ''}">하는 일 조각</button>
            </div>
            ${tutorial.hintSelected ? `<p>힌트 획득 완료! 이 힌트는 선택한 상대 카드에 끝까지 저장돼.</p>` : ''}
          </div>
        ` : ''}
      </section>
    `;
  }

  function quizHtml() {
    const questions = [
      ['한 턴에 선택할 수 있는 행동은?', ['1개', '2개', '마음대로'], 0],
      ['정답을 틀리면?', ['다시 고른다', '내 턴이 끝난다', '힌트를 받는다'], 1],
      ['가장 좋은 질문은?', ['이 직업은 소방관인가요?', '이 직업은 멋진가요?', '안전이나 생명과 관련된 일을 하나요?'], 2]
    ];
    return `
      <section class="jb77-scene">
        <div class="jb77-scene-title"><span>마지막 작전 확인</span><h3>세 문제를 모두 맞혀라</h3><p>틀려도 괜찮아. 바로 다시 고를 수 있어.</p></div>
        <div class="jb77-quiz-list">
          ${questions.map(([question, options], qIndex) => `
            <article class="${tutorial.quiz[qIndex] ? 'passed' : ''}">
              <b>${qIndex + 1}. ${question}</b>
              <div>${options.map((option, optionIndex) => `<button data-quiz="${qIndex}" data-option="${optionIndex}">${option}</button>`).join('')}</div>
              <small>${tutorial.quiz[qIndex] ? '✓ 정답' : '정답을 선택하세요'}</small>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function completeHtml() {
    return `
      <section class="jb77-scene jb77-complete">
        <div class="jb77-complete-mark">✓</div>
        <span>MISSION READY</span>
        <h3>작전 이해 완료!</h3>
        <p>직업 이름만 맞히는 것이 아니라, 그 직업이 세상을 움직이는 방식을 해독할 준비가 됐어.</p>
        <div class="jb77-complete-grid">
          <span>✓ 상대 카드 선택</span><span>✓ 좋은 질문</span><span>✓ 후보 줄이기</span><span>✓ 정답 공격</span><span>✓ 보너스 힌트</span>
        </div>
        <blockquote>직업 이름을 맞히지 말고,<br><b>그 직업이 해결하는 문제를 추리하라.</b></blockquote>
      </section>
    `;
  }

  function sceneHtml(index) {
    return [whyHtml, problemHtml, targetHtml, questionHtml, narrowHtml, guessHtml, bonusHtml, quizHtml, completeHtml][index]();
  }

  function helpMenuHtml() {
    return `
      <section class="jb77-help-menu">
        <button data-help-mode="tutorial"><span>🎮</span><div><b>90초 연습 다시하기</b><p>가짜 라운드를 직접 눌러보며 처음부터 익힙니다.</p></div></button>
        <button data-help-mode="turnHelp"><span>👉</span><div><b>지금 내 턴에 뭘 해야 하지?</b><p>현재 게임 화면에서 다음 행동만 짧게 알려줍니다.</p></div></button>
        <button data-help-mode="rules"><span>📘</span><div><b>전체 규칙 보기</b><p>질문·보너스·승리 조건을 탭으로 확인합니다.</p></div></button>
        <button data-help-close><span>×</span><div><b>닫고 게임 계속</b><p>도움말을 닫고 이전 화면으로 돌아갑니다.</p></div></button>
      </section>
    `;
  }

  function liveHelpHtml() {
    let title = '게임 준비 단계입니다.';
    let steps = ['팀 이름과 인원을 정하세요.', '턴 시간과 보너스 횟수를 고르세요.', '승리 방식을 선택하고 시작하세요.'];

    if (typeof state !== 'undefined') {
      const bonusOpen = !document.querySelector('#bonusModal')?.classList.contains('hidden') || !document.querySelector('#hintModal')?.classList.contains('hidden');
      const answerOpen = !document.querySelector('#actionModal')?.classList.contains('hidden') && document.querySelector('.jb7-answer-stage');
      const guessOpen = !document.querySelector('#guessModal')?.classList.contains('hidden');
      if (bonusOpen) {
        title = '지금은 보너스 라운드!';
        steps = ['두 팀이 문제를 함께 봅니다.', '먼저 정답을 외칩니다.', '진행자가 승리 팀과 힌트를 선택합니다.'];
      } else if (answerOpen) {
        title = '상대 팀이 답할 차례입니다.';
        steps = ['자기 팀의 비밀카드를 확인합니다.', '○ 예 / × 아니오 / △ 상황에 따라 중 하나를 고릅니다.', '직업명은 말하지 않습니다.'];
      } else if (guessOpen) {
        title = '정답 공격 중입니다.';
        steps = ['누구의 직업인지 확인합니다.', '후보 직업을 하나 고릅니다.', '틀리면 턴이 넘어가니 신중하게 제출합니다.'];
      } else if (state.phase === 'play') {
        title = `지금은 ${typeof teamLabel === 'function' ? teamLabel(state.turn) : '현재 팀'}의 턴!`;
        steps = ['상대 카드 한 장을 고릅니다.', '질문·단서·정답·팀 찬스 중 하나만 선택합니다.', '제한시간 안에 행동을 완료합니다.'];
      } else if (state.phase === 'deal') {
        title = '비밀 직업 확인 단계입니다.';
        steps = ['상대 팀이 보지 않게 화면을 가립니다.', '자기 팀 직업과 답변 가이드를 확인합니다.', '두 팀이 모두 확인하면 배틀을 시작합니다.'];
      } else if (state.phase === 'gameEnd') {
        title = '게임이 끝났습니다.';
        steps = ['공개된 직업들의 해결 문제를 확인합니다.', '마음이 움직인 직업을 하나 골라봅니다.', '같은 팀 또는 새 팀으로 다시 시작할 수 있습니다.'];
      }
    }

    return `
      <section class="jb77-live-help">
        <span>LIVE GUIDE</span><h3>${title}</h3>
        <ol>${steps.map(step => `<li>${step}</li>`).join('')}</ol>
        <button data-help-menu>도움말 메뉴로 돌아가기</button>
      </section>
    `;
  }

  function rulesHtml() {
    return `
      <section class="jb77-rules">
        <div class="jb77-rule-tabs">
          ${['목표','내 턴','좋은 질문','보너스','승리'].map((label,index) => `<button data-rule-tab="${index}" class="${index === 0 ? 'active' : ''}">${label}</button>`).join('')}
        </div>
        <div class="jb77-rule-panel" id="jb77RulePanel"></div>
        <button data-help-menu>도움말 메뉴로 돌아가기</button>
      </section>
    `;
  }

  const rulePanels = [
    '<h3>상대 팀의 비밀 직업을 밝혀라</h3><p>상대 팀원마다 직업 하나가 숨겨져 있습니다. 질문과 힌트로 그 직업이 누구를 돕고 어떤 문제를 해결하는지 추리합니다.</p>',
    '<h3>한 턴에는 행동 하나</h3><p>질문하기, 단서 받기, 정답 찍기, 팀 찬스 중 하나만 선택합니다. 행동이 끝나면 상대 팀으로 턴이 넘어갑니다.</p>',
    '<h3>특징 하나만 물어보기</h3><p>사람·장소·도구·하는 일을 묻는 질문이 좋습니다. 직업명을 바로 묻거나 “멋진가요?”처럼 사람마다 다른 질문은 피합니다.</p>',
    '<h3>15초 보너스에서 힌트를 빼앗아라</h3><p>먼저 정답을 맞힌 팀은 상대 카드 하나를 고르고 직종·첫 글자·하는 일·키워드 같은 힌트 하나를 받습니다.</p>',
    '<h3>경기 방식에 따라 목표가 달라집니다</h3><p>스피드전은 최대 3개, 기본전은 상대 전원, 시간전은 제한시간 동안 더 많은 직업을 맞히는 팀이 승리합니다.</p>'
  ];

  function renderRulePanel(index) {
    const panel = document.querySelector('#jb77RulePanel');
    if (panel) panel.innerHTML = rulePanels[index] || rulePanels[0];
    document.querySelectorAll('[data-rule-tab]').forEach(button => button.classList.toggle('active', Number(button.dataset.ruleTab) === index));
  }

  function bindStageEvents() {
    const stage = document.querySelector('#jb77Stage');
    if (!stage) return;
    stage.onclick = handleStageClick;
    if (tutorial.mode === 'rules') renderRulePanel(0);
  }

  function handleStageClick(event) {
    const why = event.target.closest('[data-why]');
    if (why) {
      const value = why.dataset.why;
      if (value === 'world') {
        tutorial.whyCorrect = true;
        render();
      } else {
        setFeedback(value === 'fast' ? '중학생 때 꿈이 선명하지 않아도 괜찮아. 먼저 여러 길을 아는 것이 중요해.' : '돈도 중요하지만 직업은 세상에 참여하고 문제를 해결하는 방식이기도 해.', 'warning');
      }
      return;
    }

    const problem = event.target.closest('[data-problem]');
    if (problem) { tutorial.selectedProblem = problem.dataset.problem; render(); return; }
    const target = event.target.closest('[data-target]');
    if (target) { tutorial.selectedTarget = Number(target.dataset.target); render(); return; }

    const question = event.target.closest('[data-question]');
    if (question) {
      if (question.dataset.question === 'good') { tutorial.goodQuestion = true; render(); }
      else {
        setFeedback(question.dataset.question === 'vague' ? '“멋진가요?”는 사람마다 답이 달라서 직업을 줄이기 어려워.' : '직업명을 바로 묻는 건 금지! 특징을 모은 뒤 정답 공격에서 맞혀야 해.', 'warning');
      }
      return;
    }

    if (event.target.closest('[data-answer-open]')) { tutorial.answerOpened = true; render(); return; }
    if (event.target.closest('[data-second-question]')) { tutorial.narrowedTwice = true; render(); return; }

    const guess = event.target.closest('[data-guess]');
    if (guess) {
      if (guess.dataset.guess === 'wrong') tutorial.wrongGuessSeen = true;
      if (guess.dataset.guess === 'correct' && tutorial.wrongGuessSeen) tutorial.correctGuess = true;
      render(); return;
    }

    const bonus = event.target.closest('[data-bonus]');
    if (bonus) {
      if (bonus.dataset.bonus === 'correct') { tutorial.bonusSolved = true; render(); }
      else { setFeedback('아쉽다! 초성과 힌트를 다시 연결해보자.', 'warning'); }
      return;
    }

    const hint = event.target.closest('[data-hint]');
    if (hint) { tutorial.hintSelected = hint.dataset.hint; render(); return; }

    const quiz = event.target.closest('[data-quiz]');
    if (quiz) {
      const q = Number(quiz.dataset.quiz);
      const option = Number(quiz.dataset.option);
      const correct = [0,1,2][q];
      tutorial.quiz[q] = option === correct;
      render(); return;
    }

    const helpMode = event.target.closest('[data-help-mode]');
    if (helpMode) {
      if (helpMode.dataset.helpMode === 'tutorial') { resetTutorial(); render(); }
      else { tutorial.mode = helpMode.dataset.helpMode; render(); }
      return;
    }
    if (event.target.closest('[data-help-menu]')) { tutorial.mode = 'menu'; render(); return; }
    if (event.target.closest('[data-help-close]')) { closeModalShell(); return; }

    const ruleTab = event.target.closest('[data-rule-tab]');
    if (ruleTab) renderRulePanel(Number(ruleTab.dataset.ruleTab));
  }

  function nextScene() {
    if (!sceneReady(tutorial.scene)) return;
    if (tutorial.scene === scenes.length - 1) {
      closeModalShell();
      if (typeof state === 'undefined' || state.phase === 'setup') {
        document.querySelector('#setupScreen .setup-arena')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    tutorial.scene += 1;
    render();
  }

  function previousScene() {
    if (tutorial.scene <= 0) return;
    tutorial.scene -= 1;
    render();
  }

  function syncHelpVisibility() {
    const button = document.querySelector('#jb77HelpButton');
    if (!button) return;
    const ownOpen = !document.querySelector('#jb77TutorialModal')?.classList.contains('hidden');
    const otherOpen = [...document.querySelectorAll('.modal:not(.hidden)')].some(modal => modal.id !== 'jb77TutorialModal');
    button.classList.toggle('is-hidden', ownOpen || otherOpen);
  }

  function bindShellEvents() {
    document.querySelector('#jb77HelpButton')?.addEventListener('click', openHelpMenu);
    document.querySelector('.jb77-close')?.addEventListener('click', closeModalShell);
    document.querySelector('#jb77Next')?.addEventListener('click', nextScene);
    document.querySelector('#jb77Back')?.addEventListener('click', previousScene);
    document.querySelector('#jb77TutorialModal')?.addEventListener('click', event => {
      if (event.target.id === 'jb77TutorialModal') closeModalShell();
    });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !document.querySelector('#jb77TutorialModal')?.classList.contains('hidden')) closeModalShell();
    });
    new MutationObserver(syncHelpVisibility).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    syncHelpVisibility();
  }

  function init() {
    removeLegacyTutorial();
    createShell();
    bindShellEvents();
    const shown = sessionStorage.getItem(SESSION_KEY) === '1';
    if (!shown && typeof state !== 'undefined' && state.phase === 'setup') setTimeout(() => openTutorial({ automatic: true }), 120);
  }

  init();
})();
