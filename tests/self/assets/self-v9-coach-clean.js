(() => {
  const ORDER = ['SR', 'ST', 'BD', 'CS', 'RS'];
  const content = document.querySelector('#coachContent');
  const tabs = document.querySelector('#coachTabs');
  const openButton = document.querySelector('#coachViewBtn');
  const headerIntro = document.querySelector('.coach-sheet-intro');
  const headerEyebrow = document.querySelector('.coach-sheet-head .eyebrow');
  const domainData = window.SELF_INC_DATA?.DOMAINS || {};

  if (!content || !tabs || !openButton) return;

  const CLEAN_INTRO = '장면을 읽고, 알아차릴 신호와 작은 선택으로 연결합니다.';
  const DOMAIN_AWARENESS = {
    SR: '실수 뒤 자기비난이 커지거나, 쉬는 순간에도 죄책감이 따라오는지 살펴봅니다.',
    ST: '확신이 생길 때까지 시작을 미루거나, 타인의 승인에 판단을 맡기는지 살펴봅니다.',
    BD: '불편함을 늦게 말하고 감당 범위를 넘긴 뒤 피로와 불만이 올라오는지 살펴봅니다.',
    CS: '비교·평가 장면에서 내 기준보다 외부 속도와 시선이 앞서기 시작하는지 살펴봅니다.',
    RS: '피로 신호를 지나친 뒤 생활 리듬과 감정 회복이 함께 흔들리는지 살펴봅니다.'
  };

  let scheduled = false;

  function readScores() {
    const nodes = [...document.querySelectorAll('#domainList .domain-score')];
    return ORDER.reduce((result, key, index) => {
      const value = Number.parseInt(nodes[index]?.textContent || '', 10);
      result[key] = Number.isFinite(value) ? value : null;
      return result;
    }, {});
  }

  function getOverall(scores) {
    const rendered = Number.parseInt(document.querySelector('#totalScore')?.textContent || '', 10);
    if (Number.isFinite(rendered)) return rendered;
    const values = ORDER.map((key) => scores[key]).filter(Number.isFinite);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  }

  function getProfile(scores) {
    const entries = ORDER
      .map((key) => ({ key, name: domainData[key]?.name || key, score: scores[key] }))
      .filter((entry) => Number.isFinite(entry.score));
    const ascending = [...entries].sort((a, b) => a.score - b.score);
    const descending = [...ascending].reverse();
    return {
      entries,
      low1: ascending[0],
      low2: ascending[1] || ascending[0],
      high1: descending[0]
    };
  }

  function replaceProhibitedWord(root) {
    const blocked = '\uBCD1\uBAA9';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.nodeValue?.includes(blocked)) {
        node.nodeValue = node.nodeValue.replaceAll(blocked, '우선성장 지점');
      }
    });
  }

  function setText(selector, value) {
    const element = content.querySelector(selector);
    if (element && element.textContent !== value) element.textContent = value;
  }

  function addPerspectiveExpanders() {
    content.querySelectorAll('.coach-state-card').forEach((card) => {
      const paragraph = card.querySelector('p');
      if (!paragraph || card.querySelector('.coach-card-expand')) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'coach-card-expand';
      button.textContent = '더보기';
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', () => {
        const expanded = card.classList.toggle('is-expanded');
        button.textContent = expanded ? '접기' : '더보기';
        button.setAttribute('aria-expanded', String(expanded));
      });
      card.appendChild(button);
    });
  }

  function sortInDocumentOrder(nodes) {
    return nodes.sort((a, b) => {
      if (a === b) return 0;
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  function collectAdvancedNodes() {
    const selectors = [
      '.coach-synthesis-caution',
      '.coach-mid-note',
      '.coach-state-toggle',
      '.coach-summary',
      '.coach-lens-title',
      '.coach-lenses',
      '.coach-practice-title',
      '.coach-practice',
      '.coach-current-title',
      '.coach-current-note',
      '.coach-current-kingdom',
      '.coach-pattern-title',
      '.coach-pattern-title + .kingdom-list',
      '.coach-kingdom-title',
      '.coach-kingdom-title + .kingdom-list',
      '.coach-footer-note'
    ];

    const unique = new Set();
    selectors.forEach((selector) => {
      content.querySelectorAll(selector).forEach((node) => {
        if (!node.closest('.coach-clean-details')) unique.add(node);
      });
    });
    return sortInDocumentOrder([...unique]);
  }

  function createAdvancedDetails() {
    if (content.querySelector('.coach-clean-details')) return;
    const nodes = collectAdvancedNodes();
    if (!nodes.length) return;

    const details = document.createElement('details');
    details.className = 'coach-clean-details';
    details.innerHTML = `
      <summary>상세 해석 자료</summary>
      <div class="coach-clean-details-body"></div>
    `;
    const body = details.querySelector('.coach-clean-details-body');
    nodes.forEach((node) => body.appendChild(node));
    content.appendChild(details);
  }

  function createFlourishFlow() {
    const synthesis = content.querySelector('.coach-synthesis');
    if (!synthesis) return;

    const scores = readScores();
    const overall = getOverall(scores);
    const profile = getProfile(scores);
    if (!Number.isFinite(overall) || !profile.low1 || !profile.low2 || !profile.high1) return;

    const signature = `${overall}-${profile.entries.map((entry) => entry.score).join('-')}`;
    const existing = synthesis.querySelector('.coach-flourish-flow');
    if (existing?.dataset.signature === signature) return;
    existing?.remove();

    const pairText = synthesis.querySelector('.coach-synthesis-card.is-combo p')?.textContent?.trim()
      || `${profile.low1.name}과 ${profile.low2.name}이 함께 흔들리는 실제 장면을 좁혀봅니다.`;
    const resourceText = synthesis.querySelector('.coach-synthesis-card.is-resource p')?.textContent?.trim()
      || `${profile.high1.name}이 잘 작동했던 조건을 낮은 영역에 연결합니다.`;
    const signalText = [DOMAIN_AWARENESS[profile.low1.key], DOMAIN_AWARENESS[profile.low2.key]]
      .filter(Boolean)
      .join(' ');
    const experiment = domainData[profile.low1.key]?.action
      || '이번 주 한 장면에서 확인할 작은 행동 하나를 정합니다.';

    const section = document.createElement('section');
    section.className = 'coach-flourish-flow';
    section.dataset.signature = signature;
    section.setAttribute('aria-label', '플로리싱 알아차림 코칭 흐름');
    section.innerHTML = `
      <div class="coach-flourish-flow-head">
        <span>FLOURISHING × AWARENESS</span>
        <h4>장면에서 성장실험까지</h4>
      </div>
      <div class="coach-flourish-grid" role="list">
        <article class="coach-flourish-step is-scene" role="listitem">
          <span class="coach-flourish-number">01</span>
          <div><b>생활 장면</b><p>${pairText}</p></div>
        </article>
        <article class="coach-flourish-step is-signal" role="listitem">
          <span class="coach-flourish-number">02</span>
          <div><b>알아차릴 신호</b><p>${signalText}</p></div>
        </article>
        <article class="coach-flourish-step is-choice" role="listitem">
          <span class="coach-flourish-number">03</span>
          <div><b>작은 선택</b><small>${profile.high1.name} ${profile.high1.score}점 활용</small><p>${resourceText}</p></div>
        </article>
        <article class="coach-flourish-step is-experiment" role="listitem">
          <span class="coach-flourish-number">04</span>
          <div><b>7일 성장실험</b><p>${experiment}</p></div>
        </article>
      </div>
    `;

    const sessionPlan = synthesis.querySelector('.coach-session-plan');
    if (sessionPlan) synthesis.insertBefore(section, sessionPlan);
    else synthesis.appendChild(section);
  }

  function cleanCopy() {
    if (headerEyebrow && headerEyebrow.textContent !== 'FLOURISHING × AWARENESS') {
      headerEyebrow.textContent = 'FLOURISHING × AWARENESS';
    }
    if (headerIntro && headerIntro.textContent !== CLEAN_INTRO) headerIntro.textContent = CLEAN_INTRO;

    setText('.coach-synthesis-head h3', '지금의 성장흐름');
    setText('.coach-session-plan-head b', '회기 질문');
    setText('.coach-score-kicker b', '선택 영역');
    setText('.coach-state-analysis-head h4', '세 가지 렌즈');
    setText('.coach-current-title', '영역별 추가 질문');
    setText('.coach-pattern-title', '저점·고점 추가 질문');

    content.querySelector('.coach-synthesis-action')?.remove();
    replaceProhibitedWord(content);
  }

  function enhance() {
    scheduled = false;
    if (!content.querySelector('.coach-synthesis') || !content.querySelector('.coach-score-profile')) return;
    cleanCopy();
    createFlourishFlow();
    addPerspectiveExpanders();
    createAdvancedDetails();
    content.dataset.flourishAwareness = 'ready';
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
  tabs.addEventListener('click', schedule);
  openButton.addEventListener('click', () => setTimeout(schedule, 0));
  schedule();
})();