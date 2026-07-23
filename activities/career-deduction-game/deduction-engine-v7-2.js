(() => {
  'use strict';

  const RELEASE = 'v7.2';
  const originalRenderTargetBoardV72 = renderTargetBoard;
  const originalActionPromptV72 = actionPrompt;
  const originalShowTeamSecretV72 = showTeamSecret;

  const YES = 'yes';
  const NO = 'no';
  const MAYBE = 'maybe';
  const STARTER_IDS = ['people_many', 'place_indoor', 'tool_computer', 'work_safety', 'work_create', 'prepare_license'];

  function textOf(job) {
    const profile = typeof getJobProfile === 'function' ? getJobProfile(job) : null;
    return [
      job.name,
      job.desc,
      ...(job.tags || []),
      CATEGORIES[job.cat]?.name || '',
      ...(profile?.tools || []),
      ...(profile?.places || []),
      ...(profile?.people || []),
      ...(profile?.strengths || []),
      ...(profile?.subjects || []),
      profile?.path || ''
    ].join(' ').toLowerCase();
  }

  function containsAny(text, terms) {
    return terms.some(term => text.includes(term.toLowerCase()));
  }

  function predictAnswer(job, questionId) {
    const text = textOf(job);
    const name = job.name;
    const cat = job.cat;
    const is = pattern => pattern.test(name);
    const has = (...terms) => containsAny(text, terms);

    switch (questionId) {
      case 'people_many':
        if (['C', 'D', 'H'].includes(cat) || is(/마케터|인사담당자|기업가|변호사|외교관|경찰관|기자|여행|호텔|항공/)) return YES;
        if (['A', 'B'].includes(cat) && !is(/UX|게임 기획자|환경 컨설턴트|동물행동/)) return MAYBE;
        return MAYBE;
      case 'people_child':
        if (is(/교사|유치원|청소년|진로코치|사서|교육콘텐츠|상담교사/)) return YES;
        if (cat === 'D') return MAYBE;
        return NO;
      case 'people_patient':
        if (cat === 'C' || is(/응급구조|임상심리|상담/)) return YES;
        return NO;
      case 'people_customer':
        if (cat === 'H' || is(/마케터|세무사|관세사|변호사|감정평가사|기업가|상품기획자|약사|영양사/)) return YES;
        if (['D', 'F'].includes(cat)) return MAYBE;
        return NO;
      case 'place_indoor':
        if (is(/소방관|경찰관|군인|재난안전|드론|지질|해양|기후|환경 컨설턴트|기자|여행|항공|동물행동/)) return MAYBE;
        if (['A', 'C', 'D', 'F'].includes(cat)) return YES;
        return MAYBE;
      case 'place_outdoor':
        if (is(/소방관|경찰관|군인|재난안전|드론|지질|해양|환경 컨설턴트|기자|여행|항공|동물행동/)) return YES;
        if (['A', 'C', 'D', 'F'].includes(cat)) return NO;
        return MAYBE;
      case 'place_move':
        if (is(/응급구조|소방관|경찰관|군인|외교관|드론|지질|해양|기자|여행|항공|무역|환경 컨설턴트|감정평가사/)) return YES;
        if (['E', 'H'].includes(cat)) return MAYBE;
        return NO;
      case 'place_special':
        if (['B', 'C'].includes(cat) || is(/로봇|반도체|드론|3D 프린팅|영상|방송|공연|셰프|제과|미용|항공/)) return YES;
        if (['A', 'G', 'H'].includes(cat)) return MAYBE;
        return NO;
      case 'tool_computer':
        if (['A', 'F'].includes(cat) || is(/기자|영상|작가|교육콘텐츠|행정공무원|외교관|게임|디자이너/)) return YES;
        if (['B', 'D', 'E', 'G'].includes(cat)) return MAYBE;
        return NO;
      case 'tool_machine':
        if (is(/로봇|반도체|드론|3D 프린팅|의사|간호사|응급구조|치과|소방관|군인|영상|셰프|제과|항공|정비|운전|미용/)) return YES;
        if (['A', 'B', 'C', 'H'].includes(cat)) return MAYBE;
        return NO;
      case 'tool_hand':
        if (cat === 'C' || is(/셰프|제과|미용|디자이너|작가|영상|3D 프린팅|로봇|드론|치과|물리치료|작업치료/)) return YES;
        if (['G', 'H'].includes(cat)) return MAYBE;
        return NO;
      case 'tool_document':
        if (['D', 'E', 'F'].includes(cat) || is(/기자|작가|데이터 분석가|환경 컨설턴트|연구원|과학자/)) return YES;
        if (['A', 'B', 'C', 'G'].includes(cat)) return MAYBE;
        return NO;
      case 'work_safety':
        if (['C', 'E'].includes(cat) || is(/정보보안|식품연구원|신재생에너지|환경 컨설턴트/)) return YES;
        return NO;
      case 'work_create':
        if (['A', 'G'].includes(cat) || is(/상품기획자|마케터|기업가|셰프|제과|교육콘텐츠|게임 기획자|3D 프린팅/)) return YES;
        if (['B', 'H'].includes(cat)) return MAYBE;
        return NO;
      case 'work_analyze':
        if (['A', 'B', 'F'].includes(cat) || is(/판사|검사|변호사|의사|약사|재난안전|행정공무원/)) return YES;
        if (['C', 'E'].includes(cat)) return MAYBE;
        return NO;
      case 'work_teach':
        if (cat === 'D' || is(/교사|교수|지도사|교육사|진로코치|교육콘텐츠/)) return YES;
        if (is(/임상심리사|영양사|약사|인사담당자/)) return MAYBE;
        return NO;
      case 'work_solve':
        if (['A', 'B', 'E', 'F'].includes(cat) || is(/의사|응급구조|임상심리|상담|치료사/)) return YES;
        if (['C', 'D'].includes(cat)) return MAYBE;
        return NO;
      case 'work_visible':
        if (['A', 'G', 'H'].includes(cat) || is(/셰프|제과|3D 프린팅|로봇|반도체|상품기획자|건축|디자이너/)) return YES;
        if (['B', 'C'].includes(cat)) return MAYBE;
        return NO;
      case 'skill_talk':
        if (['D', 'F', 'H'].includes(cat) || is(/변호사|판사|검사|외교관|경찰관|기자|간호사|의사/)) return YES;
        if (['C', 'E', 'G'].includes(cat)) return MAYBE;
        return NO;
      case 'skill_focus':
        if (['A', 'B', 'C', 'F'].includes(cat) || is(/판사|검사|변호사|정보보안|영상|작가|기자/)) return YES;
        return MAYBE;
      case 'skill_team':
        if (is(/작가|감정평가사|세무사|회계사|천문학자|사서/)) return MAYBE;
        if (['C', 'D', 'E', 'G', 'H'].includes(cat)) return YES;
        return MAYBE;
      case 'skill_creative':
        if (cat === 'G' || is(/UX|게임 기획자|상품기획자|마케터|기업가|교육콘텐츠|셰프|제과|3D 프린팅/)) return YES;
        if (['A', 'H'].includes(cat)) return MAYBE;
        return NO;
      case 'prepare_license':
        if (cat === 'C' || is(/교사|상담교사|판사|검사|변호사|관세사|회계사|세무사|감정평가사|소방관|경찰관|군인|공무원|항공|영양사|사서/)) return YES;
        if (['D', 'E', 'F'].includes(cat)) return MAYBE;
        return NO;
      case 'prepare_major':
        if (['A', 'B', 'C', 'D'].includes(cat) || is(/판사|검사|변호사|회계사|세무사|관세사|감정평가사|교수/)) return YES;
        if (['E', 'F', 'G'].includes(cat)) return MAYBE;
        return NO;
      case 'condition_uniform':
        if (cat === 'C' || is(/소방관|경찰관|군인|응급구조|항공|셰프|제과|호텔|치과|간호사/)) return YES;
        if (['E', 'H'].includes(cat)) return MAYBE;
        return NO;
      case 'condition_emergency':
        if (is(/응급구조|소방관|경찰관|군인|재난안전|의사|간호사|수의사|정보보안/)) return YES;
        if (['C', 'E'].includes(cat)) return MAYBE;
        return NO;
      case 'condition_schedule':
        if (is(/응급구조|소방관|경찰관|군인|의사|간호사|기자|영상|공연|호텔|항공|여행|셰프|수의사/)) return YES;
        if (['C', 'E', 'G', 'H'].includes(cat)) return MAYBE;
        return NO;
      case 'nature_animal':
        if (cat === 'B' || is(/수의사|동물행동|해양|환경|기후|지질|신재생에너지/)) return YES;
        return NO;
      default:
        return has('현장', '상담', '고객') ? MAYBE : NO;
    }
  }

  function scoreCandidate(job, qa) {
    return (qa || []).reduce((score, item) => {
      const predicted = predictAnswer(job, item.id);
      const actual = item.answer;
      if (predicted === actual) return score + 3;
      if (predicted === MAYBE || actual === MAYBE) return score + 1;
      return score - 3;
    }, 0);
  }

  function candidateState(entry) {
    const qa = Array.isArray(entry?.qa) ? entry.qa : [];
    if (!qa.length) return { ranked: JOBS.map(job => ({ job, score: 0 })), plausible: [...JOBS], max: 0 };
    const ranked = JOBS.map(job => ({ job, score: scoreCandidate(job, qa) }))
      .sort((a, b) => b.score - a.score || a.job.name.localeCompare(b.job.name, 'ko'));
    const max = ranked[0]?.score || 0;
    const margin = Math.max(2, Math.ceil(qa.length * 0.7));
    let plausible = ranked.filter(item => item.score >= max - margin).map(item => item.job);
    if (plausible.length < 5) plausible = ranked.slice(0, 5).map(item => item.job);
    if (plausible.length > 30) plausible = ranked.slice(0, 30).map(item => item.job);
    return { ranked, plausible, max };
  }

  function categorySummary(jobs) {
    const counts = jobs.reduce((map, job) => {
      map[job.cat] = (map[job.cat] || 0) + 1;
      return map;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, count]) => `${CATEGORIES[cat].name} ${count}`)
      .join(' · ');
  }

  function entropy(counts, total) {
    return Object.values(counts).reduce((sum, count) => {
      if (!count) return sum;
      const p = count / total;
      return sum - p * Math.log2(p);
    }, 0);
  }

  function informationScore(question, candidates) {
    if (!candidates.length) return 0;
    const counts = { yes: 0, no: 0, maybe: 0 };
    candidates.forEach(job => { counts[predictAnswer(job, question.id)] += 1; });
    const raw = entropy(counts, candidates.length);
    const maxEntropy = Math.log2(3);
    return Math.round((raw / maxEntropy) * 100);
  }

  function rankedQuestions(entry) {
    const asked = new Set((entry.qa || []).map(item => item.id));
    const candidates = candidateState(entry).plausible;
    return QUESTION_CARDS
      .filter(question => !asked.has(question.id))
      .map(question => ({ question, info: informationScore(question, candidates) }))
      .sort((a, b) => b.info - a.info || Number(STARTER_IDS.includes(b.question.id)) - Number(STARTER_IDS.includes(a.question.id)))
      .slice(0, 6);
  }

  function entryForCurrentTarget(index) {
    return state.rosters[opponent(state.turn)]?.[Number(index)] || null;
  }

  function renderSmartQuestions(targetIndex, preferredId = null) {
    const entry = entryForCurrentTarget(targetIndex);
    const box = document.querySelector('#jb7QuestionChoices');
    if (!entry || !box) return;
    let ranked = rankedQuestions(entry);
    if (preferredId) {
      const preferred = QUESTION_CARDS.find(question => question.id === preferredId);
      if (preferred && !(entry.qa || []).some(item => item.id === preferred.id)) {
        ranked = [{ question: preferred, info: informationScore(preferred, candidateState(entry).plausible) }, ...ranked.filter(item => item.question.id !== preferred.id)].slice(0, 6);
      }
    }
    box.innerHTML = ranked.map((item, index) => `
      <label class="jb7-question-card jb72-smart-question">
        <input type="radio" name="jb7Question" value="${item.question.id}" ${index === 0 ? 'checked' : ''}>
        <span class="jb7-question-category">${escapeHtml(item.question.category)}</span>
        <b>${escapeHtml(item.question.text)}</b>
        <small>후보 분리력 ${item.info}%</small>
      </label>
    `).join('') || '<p class="jb7-empty-history">모든 기본 질문을 사용했습니다. 직접 질문을 만들어보세요.</p>';
  }

  actionPrompt = function smartActionPromptV72(type) {
    originalActionPromptV72(type);
    if (type !== 'question') return;
    setTimeout(() => {
      const target = document.querySelector('#actionTarget');
      if (!target) return;
      const selectedId = document.querySelector('input[name="jb7Question"]:checked')?.value || null;
      renderSmartQuestions(target.value, selectedId);
      target.addEventListener('change', () => setTimeout(() => renderSmartQuestions(target.value), 0));
    }, 0);
  };

  function answerLabel(answer) {
    return QUESTION_ANSWER_META[answer] || QUESTION_ANSWER_META.maybe;
  }

  function decorateAnswerGuide() {
    const stage = document.querySelector('#actionContent .jb7-answer-stage');
    if (!stage || stage.querySelector('.jb72-answer-guide')) return;
    const questionText = stage.querySelector('h3')?.textContent.trim();
    const playerText = stage.querySelector('.jb7-answer-target')?.textContent.replace(/의 직업$/, '').trim();
    const question = QUESTION_CARDS.find(item => item.text === questionText);
    const entry = state.rosters[opponent(state.turn)]?.find(item => item.player === playerText);
    if (!question || !entry) return;
    const predicted = predictAnswer(entry.job, question.id);
    const meta = answerLabel(predicted);
    const guide = document.createElement('div');
    guide.className = `jb72-answer-guide ${meta.className}`;
    guide.innerHTML = `<span>기준 답안</span><b>${meta.icon} ${meta.label}</b><small>직업의 일반적인 업무 기준입니다. 실제 현장에 따라 달라질 수 있어요.</small>`;
    stage.insertBefore(guide, stage.querySelector('.jb7-answer-grid'));
    const answerButton = stage.querySelector(`[data-jb7-answer="${predicted}"]`);
    if (answerButton) answerButton.classList.add('jb72-guide-answer');
  }

  function candidateCardHtml(entry, index) {
    const stateInfo = candidateState(entry);
    const count = entry.qa?.length ? stateInfo.plausible.length : 80;
    const summary = entry.qa?.length ? categorySummary(stateInfo.plausible) : '질문을 시작하면 자동으로 좁혀져요';
    return `
      <div class="jb72-candidate-panel">
        <div><small>추리 후보</small><b>${count}개</b></div>
        <span>${escapeHtml(summary)}</span>
        <button type="button" data-jb72-candidates="${index}" ${entry.qa?.length ? '' : 'disabled'}>${entry.qa?.length ? '후보 보기' : '질문 필요'}</button>
      </div>
    `;
  }

  function decorateCandidates() {
    const enemySide = opponent(state.turn);
    const entries = state.rosters[enemySide] || [];
    [...document.querySelectorAll('#targetBoard .target-card')].forEach((card, index) => {
      const entry = entries[index];
      if (!entry || entry.revealed || card.querySelector('.jb72-candidate-panel')) return;
      card.insertAdjacentHTML('beforeend', candidateCardHtml(entry, index));
    });
  }

  renderTargetBoard = function deductionRenderTargetBoardV72() {
    originalRenderTargetBoardV72();
    decorateCandidates();
  };

  function createCandidateModal() {
    if (document.querySelector('#jb72CandidateModal')) return;
    const modal = document.createElement('div');
    modal.id = 'jb72CandidateModal';
    modal.className = 'modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-card light jb72-candidate-modal">
        <div class="modal-head"><div><span class="eyebrow">DEDUCTION BOARD</span><h2 id="jb72CandidateTitle">유력 후보</h2></div><button class="close jb72-candidate-close" type="button">×</button></div>
        <div id="jb72CandidateContent"></div>
        <button class="primary jb72-candidate-close" type="button">추리 계속하기 →</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.jb72-candidate-close')) closeModal('jb72CandidateModal');
    });
  }

  function openCandidateModal(index) {
    const entry = entryForCurrentTarget(index);
    if (!entry) return;
    const info = candidateState(entry);
    const top = info.ranked.slice(0, Math.min(10, info.plausible.length));
    document.querySelector('#jb72CandidateTitle').textContent = `${entry.player}의 유력 후보`;
    document.querySelector('#jb72CandidateContent').innerHTML = `
      <div class="jb72-candidate-overview"><b>${info.plausible.length}개 후보</b><span>${escapeHtml(categorySummary(info.plausible))}</span><p>질문 답변과 직업 기준표를 비교한 추리 보조 결과입니다. 정답을 보장하지 않습니다.</p></div>
      <div class="jb72-candidate-list">
        ${top.map((item, rank) => `<article><span>${rank + 1}</span><div><b>${escapeHtml(item.job.name)}</b><small>${escapeHtml(CATEGORIES[item.job.cat].name)} · ${item.job.tags.map(tag => `#${escapeHtml(tag)}`).join(' ')}</small></div></article>`).join('')}
      </div>
    `;
    openModal('jb72CandidateModal');
  }

  function secretGuideRows(job) {
    return STARTER_IDS.map(id => {
      const question = QUESTION_CARDS.find(item => item.id === id);
      const meta = answerLabel(predictAnswer(job, id));
      return `<div class="jb72-secret-row"><span>${escapeHtml(question.text)}</span><b class="${meta.className}">${meta.icon} ${meta.label}</b></div>`;
    }).join('');
  }

  function decorateSecretCards(side) {
    const entries = state.rosters[side] || [];
    [...document.querySelectorAll('#secretContent .secret-card')].forEach((card, index) => {
      const entry = entries[index];
      if (!entry || card.querySelector('.jb72-secret-guide')) return;
      card.insertAdjacentHTML('beforeend', `<details class="jb72-secret-guide"><summary>질문 답변 가이드 <span>6개</span></summary>${secretGuideRows(entry.job)}<small>일반적인 직업 기준이며 실제 업무 환경에 따라 달라질 수 있어요.</small></details>`);
    });
  }

  showTeamSecret = function guidedShowTeamSecretV72(side) {
    originalShowTeamSecretV72(side);
    setTimeout(() => decorateSecretCards(side), 0);
  };

  function addReleaseBadge() {
    const brand = document.querySelector('.brand > span:last-child');
    if (!brand || brand.querySelector('.jb72-release-badge')) return;
    const badge = document.createElement('span');
    badge.className = 'jb72-release-badge';
    badge.textContent = RELEASE;
    brand.appendChild(badge);
  }

  function bindEvents() {
    const actionContent = document.querySelector('#actionContent');
    if (actionContent) new MutationObserver(decorateAnswerGuide).observe(actionContent, { childList: true, subtree: true });
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-jb72-candidates]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      openCandidateModal(button.dataset.jb72Candidates);
    });
  }

  function init() {
    createCandidateModal();
    bindEvents();
    addReleaseBadge();
    if (state.phase === 'play') decorateCandidates();
  }

  init();
})();
