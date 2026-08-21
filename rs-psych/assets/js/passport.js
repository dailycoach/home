(function () {
  'use strict';

  async function initPassport() {
    const hosts = document.querySelectorAll('[data-passport-demo]');
    if (!hosts.length) return;

    try {
      const [passport, scenes, maps, credentials, practices] = await Promise.all([
        RSPsych.loadJSON('passport.demo.json'),
        RSPsych.loadJSON('problem-scenes.json'),
        RSPsych.loadJSON('pathway-map.json'),
        RSPsych.loadJSON('credentials.json'),
        RSPsych.loadJSON('practice-7.demo.json'),
      ]);
      const allowed = scenes.map((item) => item.id);
      const sceneId = RSPsych.getEnumParam('scene', allowed, 'result-no-next');
      const scene = scenes.find((item) => item.id === sceneId) || scenes[0];
      const map = maps.find((item) => item.sceneId === scene.id) || maps[0];
      const practice = practices.find((item) => item.id === map.practiceId) || practices[0];
      const selectedCredentials = map.credentialIds.map((id) => credentials.find((item) => item.id === id)).filter(Boolean);

      hosts.forEach((host) => {
        host.innerHTML = passportMarkup(passport, scene, map, practice, selectedCredentials);
      });
      RSPsych.track('rspsych_view_passport_preview', { scene_id: scene.id });
    } catch (error) {
      hosts.forEach((host) => RSPsych.showDataError(host, error.message));
    }
  }

  function passportMarkup(passport, scene, map, practice, credentials) {
    return `<div class="passport-frame">
      <aside class="passport-rail">
        <div class="passport-id" aria-hidden="true">RS</div>
        <h3>${RSPsych.escapeHTML(passport.label)}</h3>
        <p>${RSPsych.escapeHTML(passport.identity.detail)}</p>
        <div class="passport-nav" aria-label="Passport 모듈">
          <span>Current Scene</span><span>Assessments</span><span>Practice 7</span><span>Evidence</span><span>Credentials</span><span>Next Path</span>
        </div>
        <p class="passport-disclosure">${RSPsych.escapeHTML(passport.disclosure)}</p>
      </aside>
      <div class="passport-main">
        <div class="passport-topline"><strong>${RSPsych.escapeHTML(passport.identity.display)}</strong>${RSPsych.statusChipMarkup(passport.status)}</div>
        <div class="passport-grid">
          <section class="passport-module current"><h4>Growth Journey</h4><p>검사 결과를 끝점이 아니라 해석·코칭·실천·기록으로 이어지는 여정으로 봅니다.</p><div class="mini-journey">${passport.journey.map((item, index) => `<span class="${index <= 3 ? 'current' : ''}">${RSPsych.escapeHTML(item)}</span>`).join('')}</div></section>
          <section class="passport-module scene"><h4>Current Scene</h4><p>${RSPsych.escapeHTML(scene.label)}</p><span class="status-chip demo">고정 예시 장면</span></section>
          <section class="passport-module assessments"><h4>Assessment</h4><div class="module-list"><div class="module-row"><span>공개 확인 자산</span><strong>SOURCE VERIFIED</strong></div><div class="module-row"><span>온라인 운영</span><strong>PENDING</strong></div></div></section>
          <section class="passport-module practice"><h4>Practice 7</h4><p>${RSPsych.escapeHTML(practice.title)}</p><div class="module-row"><span>상태</span><strong>DEMO</strong></div></section>
          <section class="passport-module evidence"><h4>Evidence</h4><div class="module-list">${map.evidenceTypes.slice(0, 3).map((item) => `<div class="module-row"><span>${RSPsych.escapeHTML(item.replace(/-/g, ' '))}</span><strong>EXAMPLE</strong></div>`).join('')}</div></section>
          <section class="passport-module credentials"><h4>Credential Preview</h4><div class="mini-seals">${credentials.map((item) => `<button class="mini-seal" type="button" data-credential-id="${RSPsych.escapeHTML(item.id)}">${RSPsych.escapeHTML(item.koTitle)}</button>`).join('') || '<span>연결된 Preview 없음</span>'}</div><p>심리점수·유형이 아니라 확인 가능한 성장경험의 기준을 보여줍니다.</p></section>
          <section class="passport-module next"><h4>Next Path</h4><p>다음 행동을 선택하고 Trust Center에서 기록·공개 경계를 확인합니다.</p><a class="text-link" href="/rs-psych/trust/">Trust Center</a></section>
        </div>
      </div>
    </div>`;
  }

  document.addEventListener('DOMContentLoaded', initPassport);
})();
