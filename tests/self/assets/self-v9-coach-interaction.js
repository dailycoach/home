(() => {
  const dialog = document.querySelector('#coachDialog');
  const tabs = document.querySelector('#coachTabs');
  const content = document.querySelector('#coachContent');
  const status = document.querySelector('#coachInteractionStatus');

  if (!dialog || !tabs || !content || !status) return;

  let pendingMessage = '';
  let scheduled = false;
  let lastSignature = '';

  function activeTab() {
    return tabs.querySelector('.coach-tab.is-active');
  }

  function activeStateButton() {
    return content.querySelector('[data-coach-state].is-active');
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function readSelection() {
    const tab = activeTab();
    const stateButton = activeStateButton();
    const domain = cleanText(tab?.childNodes?.[0]?.textContent || tab?.textContent).replace(/선택됨/g, '').trim();
    const score = cleanText(tab?.querySelector('small')?.textContent);
    const state = stateButton?.dataset.coachState === 'high' ? '높을 때의 해석' : '낮을 때의 해석';
    const questionMode = content.querySelector('.coach-current-kingdom')
      ? '현재 점수 기반 질문'
      : '패턴별 질문';
    return { tab, stateButton, domain: domain || '영역', score, state, questionMode };
  }

  function decorateTabs(selection) {
    [...tabs.querySelectorAll('.coach-tab')].forEach((button) => {
      const selected = button === selection.tab;
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-current', selected ? 'true' : 'false');
      button.dataset.interactionReady = 'true';

      const baseName = cleanText(button.childNodes[0]?.textContent || button.textContent).replace(/선택됨/g, '').trim();
      const score = cleanText(button.querySelector('small')?.textContent);
      button.setAttribute(
        'aria-label',
        selected
          ? `${baseName} ${score ? `${score}점 ` : ''}선택됨`
          : `${baseName} ${score ? `${score}점, ` : ''}선택하면 영역 해석과 코칭질문이 변경됩니다.`
      );

      let selectedBadge = button.querySelector('.coach-selected-badge');
      if (selected && !selectedBadge) {
        selectedBadge = document.createElement('span');
        selectedBadge.className = 'coach-selected-badge';
        selectedBadge.textContent = '선택됨';
        button.appendChild(selectedBadge);
      } else if (!selected && selectedBadge) {
        selectedBadge.remove();
      }
    });

    selection.tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function decorateStateButtons(selection) {
    content.querySelectorAll('[data-coach-state]').forEach((button) => {
      const isHigh = button.dataset.coachState === 'high';
      const selected = button === selection.stateButton;
      const label = isHigh ? '높을 때의 해석' : '낮을 때의 해석';

      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', selected ? `${label}, 현재 보기` : `${label}으로 전환`);
      button.innerHTML = `
        <span class="coach-state-check" aria-hidden="true">${selected ? '✓' : '↗'}</span>
        <span class="coach-state-copy"><b>${label}</b><small>${selected ? '현재 보기' : '누르면 해석·질문 변경'}</small></span>
      `;
    });
  }

  function renderStatus(selection) {
    const signature = `${selection.domain}|${selection.score}|${selection.state}|${selection.questionMode}`;
    const changed = signature !== lastSignature;
    lastSignature = signature;

    const scoreText = selection.score ? `${selection.score}점` : '점수 없음';
    const notice = pendingMessage || (changed
      ? `${selection.domain} · ${selection.state} 기준으로 해석, 3관점 상태분석, KINGDOM 질문을 갱신했습니다.`
      : '영역 또는 보기 기준을 선택하면 아래 해석과 질문이 함께 바뀝니다.');

    status.innerHTML = `
      <div class="coach-status-main">
        <span class="coach-status-label">현재 선택</span>
        <strong>${selection.domain}</strong>
        <em>${scoreText}</em>
      </div>
      <div class="coach-status-values" aria-label="현재 상호작용 값">
        <span><small>보기 기준</small><b>${selection.state}</b></span>
        <span><small>질문 묶음</small><b>${selection.questionMode}</b></span>
        <span><small>변경 범위</small><b>해석 · 3관점 · 질문</b></span>
      </div>
      <p class="coach-status-notice">${notice}</p>
    `;

    status.classList.remove('is-updated');
    void status.offsetWidth;
    status.classList.add('is-updated');
    pendingMessage = '';
  }

  function animateContent() {
    content.classList.remove('coach-content-updated');
    void content.offsetWidth;
    content.classList.add('coach-content-updated');
  }

  function enhance() {
    scheduled = false;
    if (dialog.hidden || !tabs.querySelector('.coach-tab')) return;
    const selection = readSelection();
    decorateTabs(selection);
    decorateStateButtons(selection);
    renderStatus(selection);
  }

  function scheduleEnhance(options = {}) {
    if (options.animate) animateContent();
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(enhance);
  }

  dialog.addEventListener('click', (event) => {
    const tabButton = event.target.closest('.coach-tab');
    if (tabButton) {
      const name = cleanText(tabButton.childNodes[0]?.textContent || tabButton.textContent).replace(/선택됨/g, '').trim();
      const score = cleanText(tabButton.querySelector('small')?.textContent);
      pendingMessage = `${name}${score ? ` ${score}점` : ''}으로 변경했습니다. 영역 해석·3관점 상태분석·KINGDOM 질문이 함께 갱신됩니다.`;
      scheduleEnhance({ animate: true });
      return;
    }

    const stateButton = event.target.closest('[data-coach-state]');
    if (stateButton) {
      const label = stateButton.dataset.coachState === 'high' ? '높을 때의 해석' : '낮을 때의 해석';
      pendingMessage = `${label}으로 전환했습니다. 요약·세 관점·실전 메모·KINGDOM 질문이 새 기준으로 바뀝니다.`;
      scheduleEnhance({ animate: true });
    }
  }, true);

  tabs.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...tabs.querySelectorAll('.coach-tab')];
    if (!buttons.length) return;
    const currentIndex = Math.max(0, buttons.indexOf(document.activeElement));
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % buttons.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = buttons.length - 1;
    event.preventDefault();
    buttons[nextIndex].focus();
    buttons[nextIndex].click();
  });

  const observer = new MutationObserver(() => scheduleEnhance());
  observer.observe(tabs, { childList: true, subtree: true });
  observer.observe(content, { childList: true, subtree: true });

  document.querySelector('#coachViewBtn')?.addEventListener('click', () => {
    pendingMessage = '코치용 보기를 열었습니다. 가장 낮은 영역이 기본 선택되며, 버튼 선택에 따라 해석값이 바뀝니다.';
    setTimeout(() => scheduleEnhance({ animate: true }), 0);
  });
})();
