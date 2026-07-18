(() => {
  const content = document.querySelector('#coachContent');
  const tabs = document.querySelector('#coachTabs');
  const openButton = document.querySelector('#coachViewBtn');
  const headerIntro = document.querySelector('.coach-sheet-intro');

  if (!content || !tabs || !openButton) return;

  const CLEAN_INTRO = '핵심 상태와 이번 회기 질문을 빠르게 확인합니다.';
  let scheduled = false;

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
      '.coach-synthesis-action',
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
      <summary>상세 해석과 추가 질문</summary>
      <div class="coach-clean-details-body"></div>
    `;
    const body = details.querySelector('.coach-clean-details-body');
    nodes.forEach((node) => body.appendChild(node));
    content.appendChild(details);
  }

  function cleanCopy() {
    if (headerIntro && headerIntro.textContent !== CLEAN_INTRO) headerIntro.textContent = CLEAN_INTRO;

    setText('.coach-synthesis-head h3', '5영역 브리핑');
    setText('.coach-synthesis-card.is-combo b', '우선 조합');
    setText('.coach-synthesis-card.is-resource b', '활용 자원');
    setText('.coach-session-plan-head b', '이번 회기 질문');
    setText('.coach-score-kicker b', '현재 영역 해석');
    setText('.coach-state-analysis-head h4', '3관점 상태분석');
    setText('.coach-current-title', '영역별 추가 질문');
    setText('.coach-pattern-title', '저점·고점 추가 질문');

    const synthesisType = content.querySelector('.coach-synthesis-type');
    if (synthesisType?.textContent.includes('\uBCD1\uBAA9')) {
      synthesisType.textContent = synthesisType.textContent.replace('\uBCD1\uBAA9', '조율');
    }

    replaceProhibitedWord(content);
    delete content.dataset.flourishAwareness;
  }

  function enhance() {
    scheduled = false;
    if (!content.querySelector('.coach-synthesis') || !content.querySelector('.coach-score-profile')) return;
    content.querySelector('.coach-flourish-flow')?.remove();
    cleanCopy();
    addPerspectiveExpanders();
    createAdvancedDetails();
    content.dataset.coachGuideReady = 'true';
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