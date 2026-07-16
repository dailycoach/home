(() => {
  'use strict';
  const data = window.DISC16_YOUTH_DATA;
  if (!data) return;

  const order = [0, 8, 9, 1, 2, 10, 3, 11, 12, 4, 13, 5, 6, 14, 15, 7];
  data.QUESTIONS = order.map(index => data.QUESTIONS[index]);
  data.DISPLAY = order.map(index => data.DISPLAY[index]);

  if (data.PROFILES?.I) data.PROFILES.I.name = '사교형';

  const result = document.querySelector('#result');
  if (!result) return;

  function findSection(title) {
    return [...result.querySelectorAll('.section')].find(section => section.querySelector('h2')?.textContent.trim() === title);
  }

  function createActionCard() {
    if (result.querySelector('.action-focus')) return;
    const growthLabel = [...result.querySelectorAll('.tip strong')].find(node => node.textContent.trim() === '이번에 연습할 행동');
    const growthText = growthLabel?.parentElement?.textContent.replace('이번에 연습할 행동', '').trim();
    if (!growthText) return;

    const card = document.createElement('section');
    card.className = 'action-focus';
    card.innerHTML = `<small>이번 주 관계 실험</small><h2>한 번에 하나만 바꿔봅니다</h2><p>${growthText}</p>`;

    const familyFriendSection = findSection('가족과 친구가 알아두면 좋은 점');
    familyFriendSection?.insertAdjacentElement('afterend', card);
  }

  function collapseTechnicalSection(title, summary) {
    const section = findSection(title);
    if (!section || section.closest('details.result-more')) return;

    const details = document.createElement('details');
    details.className = 'result-more';
    const heading = section.querySelector('h2');
    const body = [...section.childNodes].filter(node => node !== heading);
    details.innerHTML = `<summary><span>${title}</span><small>${summary}</small></summary><div class="result-more-body"></div>`;
    const bodyBox = details.querySelector('.result-more-body');
    body.forEach(node => bodyBox.appendChild(node));
    section.replaceWith(details);
  }

  function enhanceResult() {
    if (!result.querySelector('.result-head') || result.dataset.enhanced === 'true') return;
    result.dataset.enhanced = 'true';
    result.classList.add('result-ready');

    const head = result.querySelector('.result-head');
    head?.insertAdjacentHTML('afterbegin', '<div class="result-kicker">나의 관계반응 요약</div>');

    createActionCard();
    collapseTechnicalSection('행동에너지 분포', '점수와 좌표를 자세히 확인합니다.');
    collapseTechnicalSection('네 성향 자세히 보기', 'D·I·S·C 네 성향을 모두 살펴봅니다.');
  }

  const observer = new MutationObserver(enhanceResult);
  observer.observe(result, { childList: true, subtree: true });
  enhanceResult();
})();
