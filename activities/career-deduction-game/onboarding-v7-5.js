(() => {
  'use strict';

  const RELEASE = 'v7.5';

  const turnSteps = [
    {
      kicker: 'STEP 1 · TARGET',
      title: '상대 카드 한 장을 고른다',
      icon: '🎯',
      copy: '이번 턴에 추리할 상대 팀원을 선택합니다. 카드마다 질문 기록과 보너스 힌트가 따로 쌓입니다.',
      example: '예: 오렌지 2번 카드 선택'
    },
    {
      kicker: 'STEP 2 · ASK',
      title: '답이 갈리는 질문을 던진다',
      icon: '❓',
      copy: '추천 질문 중 하나를 고르거나 직접 질문합니다. 예·아니오·상황에 따라 달라요로 답할 수 있어야 합니다.',
      example: '“주로 야외나 현장에서 일하나요?”'
    },
    {
      kicker: 'STEP 3 · ANSWER',
      title: '상대 팀은 직업 기준에 맞춰 답한다',
      icon: '○',
      copy: '직업명을 말하지 않고 ○ 예, × 아니오, △ 상황에 따라 달라요 중 하나를 고릅니다. 짧은 설명도 붙일 수 있습니다.',
      example: '답변 예: ○ 예 · “현장 이동이 많아요”'
    },
    {
      kicker: 'STEP 4 · NARROW',
      title: '후보 수와 유력 분야가 좁혀진다',
      icon: '⚡',
      copy: '답변이 카드에 저장되고 80개 직업 후보가 자동으로 줄어듭니다. 다음에는 후보를 더 잘 나누는 질문이 추천됩니다.',
      example: '예시: 80개 → 24개 → 9개'
    },
    {
      kicker: 'STEP 5 · GUESS',
      title: '확신이 생기면 정답을 찍는다',
      icon: '🏁',
      copy: '정답이면 상대 카드가 공개됩니다. 틀리면 바로 상대 팀 턴으로 넘어가므로 너무 빠른 추측은 위험합니다.',
      example: '정답: 카드 공개 · 오답: 턴 종료'
    }
  ];

  function briefingHtml() {
    return `
      <section class="jb75-briefing" id="jb75Briefing" aria-labelledby="jb75BriefingTitle">
        <div class="jb75-command-head">
          <div>
            <span class="jb75-kicker">MISSION BRIEFING · ${RELEASE}</span>
            <h2 id="jb75BriefingTitle">상대 팀의 <em>비밀 직업</em>을 먼저 밝혀라!</h2>
            <p>우리 팀의 직업은 끝까지 지키고, 질문과 보너스 힌트로 상대 카드의 정체를 좁혀가는 팀 추리 배틀입니다.</p>
          </div>
          <div class="jb75-command-stamp" aria-hidden="true"><b>80</b><span>SECRET<br>JOBS</span></div>
        </div>

        <div class="jb75-mission-grid">
          <article>
            <span>01</span><div><b>비밀카드 확인</b><p>각 팀원은 직업 하나를 받습니다. 상대 팀이 볼 때는 반드시 화면을 가립니다.</p></div>
          </article>
          <article>
            <span>02</span><div><b>한 턴에 한 행동</b><p>제한시간 안에 질문·단서·정답·팀 찬스 중 하나만 선택합니다.</p></div>
          </article>
          <article>
            <span>03</span><div><b>먼저 목표 달성</b><p>선택한 경기 방식의 목표를 먼저 채우는 팀이 승리합니다.</p></div>
          </article>
        </div>

        <div class="jb75-live-rule">
          <div class="jb75-live-title">
            <div><span>LIVE TURN DEMO</span><h3>실제 한 턴은 이렇게 진행됩니다</h3></div>
            <small>번호를 눌러 작전 흐름을 확인하세요.</small>
          </div>
          <div class="jb75-step-tabs" role="tablist" aria-label="한 턴 진행 단계">
            ${turnSteps.map((step, index) => `
              <button type="button" role="tab" aria-selected="${index === 0}" class="${index === 0 ? 'active' : ''}" data-jb75-step="${index}">
                <span>${index + 1}</span><b>${['선택','질문','답변','축소','추측'][index]}</b>
              </button>
            `).join('')}
          </div>
          <div class="jb75-step-stage" id="jb75StepStage" role="tabpanel"></div>
        </div>

        <div class="jb75-action-section">
          <div class="jb75-section-label"><span>CHOOSE ONE ACTION</span><h3>내 턴에 쓸 수 있는 4가지 행동</h3></div>
          <div class="jb75-action-grid">
            <article class="question">
              <span>❓</span><div><b>질문하기</b><strong>가장 안전한 기본 행동</strong><p>예·아니오형 질문을 던져 후보를 줄입니다. 질문과 답변은 카드에 누적됩니다.</p></div>
            </article>
            <article class="clue">
              <span>🔍</span><div><b>단서 받기</b><strong>상대의 설명을 듣는 행동</strong><p>도구·장소·만나는 사람·필요한 힘 중 하나를 상대가 짧게 설명합니다.</p></div>
            </article>
            <article class="guess">
              <span>🎯</span><div><b>정답 찍기</b><strong>성공하면 카드 공개</strong><p>확신이 들 때만 사용합니다. 틀리는 순간 내 턴이 바로 끝납니다.</p></div>
            </article>
            <article class="chance">
              <span>⚡</span><div><b>팀 찬스</b><strong>팀당 단 한 번</strong><p>선택한 상대 카드의 핵심 키워드 2개를 공개합니다. 가장 중요한 순간에 사용하세요.</p></div>
            </article>
          </div>
        </div>

        <div class="jb75-bonus-versus">
          <section>
            <span class="jb75-mini-label">SUDDEN BONUS</span>
            <h3>갑자기 울리는 15초 보너스!</h3>
            <p>초성, OX, 다른 직업 찾기 등 8종 미니게임이 등장합니다. 먼저 맞힌 팀은 상대 카드 하나를 골라 강력한 힌트 카드를 얻습니다.</p>
            <div class="jb75-hint-row">
              <span>직종</span><span>첫 글자</span><span>글자 수</span><span>하는 일</span><span>키워드</span>
            </div>
          </section>
          <div class="jb75-bonus-burst" aria-hidden="true"><small>BONUS</small><b>15</b><span>SEC</span></div>
        </div>

        <div class="jb75-win-section">
          <div class="jb75-section-label"><span>HOW TO WIN</span><h3>게임 시작 전에 승리 방식을 고릅니다</h3></div>
          <div class="jb75-win-grid">
            <article><span>⚡</span><b>스피드전</b><p>상대 직업을 먼저 최대 3개 맞힌 팀 승리. 짧고 강하게 진행할 때 추천!</p></article>
            <article class="recommended"><em>추천</em><span>🏆</span><b>기본전</b><p>상대 팀의 모든 비밀 직업을 먼저 밝히면 승리. 추리와 팀 토론을 충분히 즐깁니다.</p></article>
            <article><span>⏱</span><b>시간전</b><p>5·8·10분 동안 더 많이 맞힌 팀 승리. 동점이면 다음 정답이 결승점입니다.</p></article>
          </div>
        </div>

        <details class="jb75-detail-rules">
          <summary><span>📘 상세 규칙과 주의사항</span><b>펼쳐보기</b></summary>
          <div class="jb75-detail-grid">
            <section>
              <h4>질문 규칙</h4>
              <p>직업명을 직접 묻거나 정답을 말하게 하는 질문은 금지합니다. 한 번에 특징 하나만 묻고 답변도 한 문장으로 짧게 합니다.</p>
            </section>
            <section>
              <h4>팀 토론</h4>
              <p>질문을 고르기 전과 정답을 찍기 전에는 팀원끼리 상의할 수 있습니다. 다만 제한시간은 계속 흐릅니다.</p>
            </section>
            <section>
              <h4>답변 기준</h4>
              <p>상대 팀은 비밀카드의 답변 가이드를 참고합니다. 실제 직업 현장에 따라 달라지는 경우에는 △를 선택합니다.</p>
            </section>
            <section>
              <h4>오입력 복구</h4>
              <p>잘못 누른 답변은 상대 카드의 질문 기록 관리에서 수정·삭제할 수 있습니다. 진행자는 제어판에서 턴과 타이머를 조정합니다.</p>
            </section>
            <section>
              <h4>보너스 보상</h4>
              <p>보너스 승자는 상대 팀원 한 명과 힌트 카드 한 장을 선택합니다. 받은 힌트는 해당 카드에 끝까지 남습니다.</p>
            </section>
            <section>
              <h4>가장 중요한 전략</h4>
              <p>처음에는 사람·장소·도구처럼 넓게 나누는 질문을 하고, 후보가 줄면 자격·역량·업무 질문으로 좁혀가세요.</p>
            </section>
          </div>
        </details>

        <div class="jb75-ready-strip">
          <div><span>READY CHECK</span><b>화면 가리기 · 질문은 짧게 · 추측은 신중하게!</b></div>
          <button type="button" id="jb75GoSetup">팀과 경기 방식 설정하기 ↓</button>
        </div>
      </section>
    `;
  }

  function renderStep(index) {
    const stage = document.querySelector('#jb75StepStage');
    const step = turnSteps[index];
    if (!stage || !step) return;
    stage.innerHTML = `
      <div class="jb75-step-icon">${step.icon}</div>
      <div>
        <span>${step.kicker}</span>
        <h4>${step.title}</h4>
        <p>${step.copy}</p>
        <strong>${step.example}</strong>
      </div>
    `;
    document.querySelectorAll('[data-jb75-step]').forEach((button, buttonIndex) => {
      const active = buttonIndex === index;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function init() {
    const setupArena = document.querySelector('#setupScreen .setup-arena');
    if (!setupArena || document.querySelector('#jb75Briefing')) return;
    setupArena.insertAdjacentHTML('beforebegin', briefingHtml());
    renderStep(0);

    document.querySelector('#jb75Briefing')?.addEventListener('click', event => {
      const stepButton = event.target.closest('[data-jb75-step]');
      if (stepButton) renderStep(Number(stepButton.dataset.jb75Step));
    });

    document.querySelector('#jb75GoSetup')?.addEventListener('click', () => {
      setupArena.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const firstInput = document.querySelector('#teamNameA');
      setTimeout(() => firstInput?.focus({ preventScroll: true }), 650);
    });

    const heroCopy = document.querySelector('#setupScreen .hero-copy');
    if (heroCopy) {
      heroCopy.textContent = '질문으로 후보를 줄이고, 보너스 힌트를 빼앗아 상대 팀의 비밀 직업을 먼저 밝혀내세요.';
    }

    const heroRule = document.querySelector('#setupScreen .hero-rule');
    if (heroRule) {
      heroRule.innerHTML = '<b>핵심 전략</b><span>넓게 질문 → 후보 축소 → 결정적 힌트 → 정답 공격!</span>';
    }
  }

  init();
})();