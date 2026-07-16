(() => {
  'use strict';
  const data = window.DISC16_YOUTH_DATA;
  if (!data) return;

  const order = [0, 8, 9, 1, 2, 10, 3, 11, 12, 4, 13, 5, 6, 14, 15, 7];
  data.QUESTIONS = order.map(index => data.QUESTIONS[index]);
  data.DISPLAY = order.map(index => data.DISPLAY[index]);

  if (data.PROFILES?.I) data.PROFILES.I.name = '사교형';

  const actionCopy = {
    '조건 협상':'내가 지킬 수 있는 조건을 다시 말한다',
    '대화 설득':'내 마음을 설명하며 생각을 바꿔보려 한다',
    '일단 따르기':'갈등을 키우지 않고 우선 따른다',
    '이유 확인':'왜 그런 규칙이 필요한지 먼저 묻는다',
    '내 계획 주장':'내가 생각한 계획을 분명하게 말한다',
    '마음 표현':'내가 원하는 것과 서운한 마음을 설명한다',
    '기대 맞추기':'가족의 기대에 맞추려고 노력한다',
    '현실 비교':'서로의 계획과 현실 조건을 비교한다',
    '바로 선 긋기':'불편하다고 바로 말하고 경계를 세운다',
    '분위기 풀기':'농담이나 대화로 어색함을 먼저 푼다',
    '이번엔 양보':'이번에는 넘어가고 상황을 지켜본다',
    '규칙 정하기':'다음부터 지킬 기준을 함께 정한다',
    '새 계획 주도':'바뀐 상황에 맞춰 새 계획을 먼저 세운다',
    '재미 찾기':'바뀐 일정에서 즐길 것을 찾아본다',
    '적응 기다리기':'마음이 적응할 때까지 조금 기다린다',
    '변경 확인':'무엇이 왜 바뀌었는지 정확히 확인한다',
    '내 입장 설명':'내가 그렇게 한 이유부터 설명한다',
    '마음 털어놓기':'속상했던 감정을 솔직하게 말한다',
    '조용히 듣기':'반박하지 않고 우선 끝까지 듣는다',
    '내용 점검':'지적받은 내용이 맞는지 차분히 살핀다',
    '도움 요청':'필요한 도움을 구체적으로 요청한다',
    '먼저 털어놓기':'믿을 만한 사람에게 먼저 이야기한다',
    '믿을 사람 찾기':'편하게 말할 수 있는 사람부터 찾는다',
    '상황 정리':'무슨 일이 있었는지 먼저 정리한다',
    '역할 재협상':'각자 맡을 일을 다시 나누자고 말한다',
    '함께 하자 제안':'혼자보다 함께 하자고 분위기를 만든다',
    '내가 더 하기':'갈등보다 일을 끝내기 위해 내가 더 한다',
    '분담 확인':'누가 무엇을 맡았는지 다시 확인한다',
    '경계 분명히':'내 사생활의 범위를 분명하게 말한다',
    '감정 솔직히':'부담스럽고 불편한 마음을 솔직히 말한다',
    '갈등 피하기':'크게 다투지 않도록 일단 말을 줄인다',
    '기준 합의':'서로 확인할 수 있는 범위를 합의한다',
    '역할 잡기':'내가 할 수 있는 역할부터 찾아 나선다',
    '먼저 말 걸기':'가까운 사람에게 먼저 말을 건다',
    '천천히 섞이기':'분위기를 보며 자연스럽게 어울린다',
    '분위기 관찰':'누가 어떤 관계인지 먼저 살펴본다',
    '결론 내기':'시간 안에 결론을 내자고 방향을 잡는다',
    '의견 연결':'서로 다른 의견의 공통점을 찾아 연결한다',
    '중간 조율':'각자의 말을 듣고 갈등을 줄인다',
    '근거 비교':'어떤 의견이 더 타당한지 근거를 비교한다',
    '해결책 제안':'문제를 해결할 방법부터 제안한다',
    '용기 주기':'친구가 힘을 낼 수 있게 격려한다',
    '오래 들어주기':'판단하지 않고 충분히 들어준다',
    '직접 묻기':'무슨 일이 있었는지 직접 물어본다',
    '다른 대화 열기':'새로운 이야기로 다시 분위기를 연다',
    '조금 기다리기':'바로 반응하지 않고 상황을 지켜본다',
    '사실 확인':'추측하지 않고 실제 상황을 확인한다',
    '바로 해명':'오해가 커지기 전에 내 입장을 바로 말한다',
    '대화로 풀기':'관련된 친구와 직접 이야기해 풀어간다',
    '관계 지키기':'감정이 가라앉을 때까지 관계를 지킨다',
    '경위 확인':'소문이 어떻게 시작됐는지 먼저 확인한다',
    '거절 선언':'불편한 일은 하지 않겠다고 분명히 말한다',
    '분위기 바꾸기':'다른 활동을 제안해 분위기를 바꾼다',
    '조용히 빠지기':'갈등 없이 자연스럽게 그 자리에서 빠진다',
    '위험 판단':'문제가 될 요소를 먼저 따져본다',
    '책임 요구':'약속을 지켜달라고 분명히 요구한다',
    '속마음 말하기':'반복되어 힘들었던 마음을 솔직히 말한다',
    '사정 이해':'친구의 이유를 듣고 한 번 더 이해한다',
    '약속 점검':'언제 무엇을 할지 다시 구체적으로 정한다',
    '핵심 문제 말하기':'서운했던 핵심을 먼저 꺼내 말한다',
    '다시 연결하기':'어색해도 먼저 연락해 관계를 다시 연다',
    '감정 기다리기':'서로 마음이 가라앉을 때까지 기다린다',
    '사실 구분':'느낌과 실제 있었던 일을 나누어 본다'
  };

  data.QUESTIONS.forEach(question => {
    question.choices = question.choices.map(([type, label]) => [type, actionCopy[label] || label]);
  });

  const test = document.querySelector('#test');
  const options = document.querySelector('#options');
  if (test && options && !document.querySelector('#rankProgress')) {
    const guide = document.createElement('div');
    guide.id = 'rankProgress';
    guide.className = 'rank-progress';
    guide.setAttribute('aria-live', 'polite');
    options.insertAdjacentElement('afterend', guide);

    const updateRankProgress = () => {
      const selected = options.querySelectorAll('.option.selected').length;
      const next = Math.min(selected + 1, 4);
      guide.innerHTML = selected === 4
        ? '<strong>선택 완료</strong><span>잠시 후 다음 장면으로 이동합니다.</span>'
        : `<strong>${selected} / 4 선택</strong><span>${next}순위로 고를 행동을 선택하세요.</span>`;
    };

    new MutationObserver(updateRankProgress).observe(options, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    updateRankProgress();
  }

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
