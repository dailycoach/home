(() => {
  'use strict';

  const RELEASE = 'v7.3';
  const profiles = window.JOB_PROFILES_V73 || {};
  const fallbackGetJobProfile = getJobProfile;
  const originalShowTeamSecretV73 = showTeamSecret;

  getJobProfile = function individualizedJobProfileV73(job) {
    const fallback = fallbackGetJobProfile(job);
    const exact = profiles[job.name];
    if (!exact) return fallback;
    return {
      ...fallback,
      ...exact,
      intro: job.desc,
      work: exact.work || job.desc,
      tools: exact.tools || fallback.tools,
      places: exact.places || fallback.places,
      people: exact.people || fallback.people,
      strengths: exact.strengths || fallback.strengths,
      subjects: exact.subjects || fallback.subjects,
      path: exact.path || fallback.path,
      similar: exact.similar || fallback.similar,
      contribution: exact.contribution || '',
      tryNow: exact.tryNow || ''
    };
  };

  function profileForJobName(name) {
    const job = JOBS.find(item => item.name === name);
    return job ? getJobProfile(job) : null;
  }

  function detailExtraHtml(profile) {
    if (!profile) return '';
    return `
      <div class="jb73-extra-grid">
        <section class="jb73-contribution"><small>이 직업이 사회에 더하는 것</small><p>${escapeHtml(profile.contribution || '사람과 사회의 문제를 해결하는 데 기여해요.')}</p></section>
        <section class="jb73-try-now"><small>중학생이 지금 해볼 일</small><p>${escapeHtml(profile.tryNow || '관련 직업인의 인터뷰와 체험 활동을 찾아보세요.')}</p></section>
      </div>
    `;
  }

  function decorateJobDetail() {
    const content = document.querySelector('#jb7JobContent');
    const title = document.querySelector('#jb7JobTitle')?.textContent.trim();
    if (!content || !title || content.querySelector('.jb73-extra-grid')) return;
    const profile = profileForJobName(title);
    if (!profile) return;
    const note = content.querySelector('.jb7-profile-note');
    if (note) note.insertAdjacentHTML('beforebegin', detailExtraHtml(profile));
    else content.insertAdjacentHTML('beforeend', detailExtraHtml(profile));
  }

  function secretSummaryHtml(profile) {
    return `
      <div class="jb73-secret-summary">
        <div><small>주요 도구</small><span>${profile.tools.slice(0, 2).map(escapeHtml).join(' · ')}</span></div>
        <div><small>일하는 곳</small><span>${profile.places.slice(0, 2).map(escapeHtml).join(' · ')}</span></div>
        <div><small>필요한 힘</small><span>${profile.strengths.slice(0, 3).map(escapeHtml).join(' · ')}</span></div>
      </div>
    `;
  }

  function decorateSecretCards(side) {
    const entries = state.rosters[side] || [];
    [...document.querySelectorAll('#secretContent .secret-card')].forEach((card, index) => {
      const entry = entries[index];
      if (!entry || card.querySelector('.jb73-secret-summary')) return;
      const profile = getJobProfile(entry.job);
      const tags = card.querySelector('.tags');
      if (tags) tags.insertAdjacentHTML('afterend', secretSummaryHtml(profile));
      else card.insertAdjacentHTML('beforeend', secretSummaryHtml(profile));
    });
  }

  showTeamSecret = function individualizedShowTeamSecretV73(side) {
    originalShowTeamSecretV73(side);
    setTimeout(() => decorateSecretCards(side), 0);
  };

  function addReleaseBadge() {
    const brand = document.querySelector('.brand > span:last-child');
    if (!brand || brand.querySelector('.jb73-release-badge')) return;
    const badge = document.createElement('span');
    badge.className = 'jb73-release-badge';
    badge.textContent = RELEASE;
    brand.appendChild(badge);
  }

  function auditProfiles() {
    const jobNames = new Set(JOBS.map(job => job.name));
    const profileNames = Object.keys(profiles);
    const missing = [...jobNames].filter(name => !profiles[name]);
    const unknown = profileNames.filter(name => !jobNames.has(name));
    const incomplete = profileNames.filter(name => {
      const profile = profiles[name];
      return !profile.work || !profile.path || !profile.tryNow || !Array.isArray(profile.tools) || profile.tools.length < 2 || !Array.isArray(profile.similar) || profile.similar.length < 2;
    });
    window.JOB_PROFILE_AUDIT_V73 = {
      totalJobs: jobNames.size,
      totalProfiles: profileNames.length,
      missing,
      unknown,
      incomplete,
      passed: missing.length === 0 && unknown.length === 0 && incomplete.length === 0
    };
    if (!window.JOB_PROFILE_AUDIT_V73.passed) console.warn('JOB BATTLE v7.3 직업 프로필 검수 필요', window.JOB_PROFILE_AUDIT_V73);
  }

  function observeJobDetail() {
    const observer = new MutationObserver(() => decorateJobDetail());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    auditProfiles();
    addReleaseBadge();
    observeJobDetail();
  }

  init();
})();
