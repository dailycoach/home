(function () {
  'use strict';

  const evidenceLabel = {
    'interpretation-review': ['결과리뷰', '검사 언어와 실제 경험을 대조한 확인'],
    'reflection-choice': ['성찰질문 선택', '사용자가 스스로 탐색할 질문을 선택한 기록'],
    'practice-check': ['작은 실천 확인', '행동을 실제 장면에서 시도한 과정'],
    'practice-reflection': ['실천 회고', '시도 후 반복·변형·중단을 구별한 정리'],
  };

  async function initPathway() {
    const hero = document.querySelector('[data-pathway-hero]');
    const stack = document.querySelector('[data-pathway-stack]');
    if (!hero || !stack) return;

    try {
      const [scenes, maps, domains, assessments, credentials] = await Promise.all([
        RSPsych.loadJSON('problem-scenes.json'),
        RSPsych.loadJSON('pathway-map.json'),
        RSPsych.loadJSON('domains.json'),
        RSPsych.loadJSON('assessments.json'),
        RSPsych.loadJSON('credentials.json'),
      ]);
      const allowed = scenes.map((item) => item.id);
      const requested = RSPsych.getEnumParam('scene', allowed, scenes[0]?.id);
      const scene = scenes.find((item) => item.id === requested) || scenes[0];
      const map = maps.find((item) => item.sceneId === scene.id);
      const domain = domains.find((item) => item.id === scene.primaryDomain) || domains[0];
      const selectedAssessments = map.assessmentIds.map((id) => assessments.find((item) => item.id === id)).filter(Boolean);
      const selectedCredentials = map.credentialIds.map((id) => credentials.find((item) => item.id === id)).filter(Boolean);

      hero.innerHTML = heroMarkup(scene, domain);
      stack.innerHTML = pathwayMarkup(scene, map, domain, selectedAssessments, selectedCredentials);
      document.title = `${scene.label} | RS PSYCH 성장경로`;
      document.dispatchEvent(new CustomEvent('rspsych:hydrate-practice'));
      RSPsych.track('rspsych_view_pathway', { scene_id: scene.id, primary_domain: scene.primaryDomain, source: RSPsych.safeSourceParam() });
    } catch (error) {
      RSPsych.showDataError(stack, error.message);
    }
  }

  function heroMarkup(scene, domain) {
    return `<div class="pathway-hero-scene">
      <p class="micro light">SELECTED STARTING SCENE</p>
      <blockquote>${RSPsych.escapeHTML(scene.label)}</blockquote>
      <div class="pathway-domain">
        <span class="domain-signal" aria-hidden="true"></span>
        <div><small>${RSPsych.escapeHTML(domain.micro)}</small><strong>${RSPsych.escapeHTML(domain.label)}</strong></div>
      </div>
      <div class="result-meta">${RSPsych.statusChipMarkup(scene.evidenceStatus)}${RSPsych.statusChipMarkup(scene.operationalStatus)}</div>
    </div>`;
  }

  function pathwayMarkup(scene, map, domain, assessments, credentials) {
    const stages = [
      stage('01', 'ASSESS', '검사', `현재 장면을 읽는 출발 자료`, assessmentMarkup(assessments, domain)),
      stage('02', 'INTERPRET', '해석', '결과와 실제 경험을 대조합니다.', questionMarkup(map.interpretationPrompts)),
      stage('03', 'COACH', '코칭', '답을 대신 정하지 않고 다음 행동을 선택할 수 있도록 질문과 구조를 제공합니다.', `<div class="stage-card"><p>${RSPsych.escapeHTML(map.coachingRole)}</p><div class="boundary-box"><strong>코칭의 역할</strong><p>검사점수를 확정판정으로 사용하지 않으며, 사용자의 경험·맥락·선택을 중심에 둡니다.</p></div></div>`),
      stage('04', 'PRACTICE', 'Practice 7', '결과를 7일의 작은 행동으로 번역합니다.', `<div class="practice-shell" data-practice-demo data-practice-id="${RSPsych.escapeHTML(map.practiceId)}"></div>`),
      stage('05', 'EVIDENCE', '성장증거', '점수 대신 확인 가능한 참여·성찰·실천을 남깁니다.', evidenceMarkup(map.evidenceTypes)),
      stage('06', 'CREDENTIAL', '성장 Credential', '특성의 우열이 아니라 성장경험의 성취기준을 설명합니다.', credentialMarkup(credentials)),
      stage('07', 'PASSPORT', '다음 경로', '여러 경험을 하나의 성장여정으로 연결합니다.', `<div class="stage-card"><p>선택한 장면, 확인한 자료, Practice 7, 성장증거와 Credential Preview를 Growth Passport 구조에서 함께 봅니다.</p><div class="button-row"><a class="btn btn-dark" href="/rs-psych/passport/?scene=${encodeURIComponent(scene.id)}&source=passport">Passport 구조 보기</a><a class="btn btn-quiet" href="/rs-psych/badges/">Credential 기준 보기</a></div></div>`),
      stage('08', 'TRUST', '경계와 보호', '무엇을 기록하고 무엇을 기록하지 않는지 먼저 설명합니다.', `<div class="boundary-box"><strong>이 경로의 신뢰 경계</strong><p>${RSPsych.escapeHTML(map.trustBoundary)}</p></div><div class="button-row"><a class="btn btn-dark" href="/rs-psych/trust/?source=trust">Trust Center 읽기</a></div>`),
    ];
    return stages.join('');
  }

  function stage(index, micro, title, intro, content) {
    return `<section class="pathway-stage" data-reveal>
      <div class="stage-index"><span>${RSPsych.escapeHTML(index)} · ${RSPsych.escapeHTML(micro)}</span><strong>${RSPsych.escapeHTML(title)}</strong></div>
      <div class="stage-content"><h2>${RSPsych.escapeHTML(title)}</h2><p>${RSPsych.escapeHTML(intro)}</p>${content}</div>
    </section>`;
  }

  function assessmentMarkup(items, domain) {
    if (!items.length) return '<div class="stage-card"><p>연결된 공개 확인 검사 자산이 없습니다.</p></div>';
    return `<div class="stage-card">
      ${items.map((item) => `<article>
        <span class="kicker">${RSPsych.escapeHTML(domain.label)}</span>
        <h3>${RSPsych.escapeHTML(item.title)}</h3>
        <p>${RSPsych.escapeHTML(item.summary)}</p>
        <div class="result-meta">${RSPsych.statusChipMarkup(item.sourceStatus)}${RSPsych.statusChipMarkup(item.operationalStatus)}</div>
        <p><strong>운영 경계:</strong> ${RSPsych.escapeHTML(item.boundary)}</p>
      </article>`).join('')}
      <div class="boundary-box"><strong>검사 시작 버튼이 없는 이유</strong><p>현재 온라인 운영 URL·대상·시행시간을 독립적으로 확인하지 못했습니다. 운영이 확인되기 전에는 실제 검사처럼 연결하지 않습니다.</p></div>
    </div>`;
  }

  function questionMarkup(prompts) {
    return `<ul class="question-list">${prompts.map((item, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><strong>${RSPsych.escapeHTML(item)}</strong></li>`).join('')}</ul>`;
  }

  function evidenceMarkup(types) {
    return `<div class="evidence-grid">${types.map((type) => {
      const [title, body] = evidenceLabel[type] || [type, '확인 가능한 성장경험'];
      return `<article class="evidence-card"><strong>${RSPsych.escapeHTML(title)}</strong><p>${RSPsych.escapeHTML(body)}</p></article>`;
    }).join('')}</div>`;
  }

  function credentialMarkup(items) {
    if (!items.length) return '<p>연결된 Credential Preview가 없습니다.</p>';
    return `<div class="evidence-grid">${items.map((item) => `<article class="evidence-card"><div style="max-width:160px;margin:0 auto 1rem">${RSPsych.credentialSealMarkup(item, { caption: false })}</div><strong>${RSPsych.escapeHTML(item.koTitle)}</strong><p>${RSPsych.escapeHTML(item.subtitle)}</p>${RSPsych.statusChipMarkup(item.status)}</article>`).join('')}</div>`;
  }

  document.addEventListener('DOMContentLoaded', initPathway);
})();
