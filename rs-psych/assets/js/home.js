(function () {
  'use strict';

  const featuredIds = [
    'result-no-next',
    'strength-vs-interest',
    'too-many-options',
    'parent-help',
    'student-counseling',
    'privacy-concern',
  ];

  async function initHome() {
    const sceneRail = document.querySelector('[data-scene-rail]');
    const sceneResult = document.querySelector('[data-scene-result]');
    const allSceneList = document.querySelector('[data-all-scene-list]');
    const domainGrid = document.querySelector('[data-domain-grid]');
    const collection = document.querySelector('[data-home-credential-collection]');
    const featuredCredential = document.querySelector('[data-home-featured-credential]');
    const trustGrid = document.querySelector('[data-trust-principles]');

    if (!sceneRail) return;

    try {
      const [scenes, domains, credentials, trust] = await Promise.all([
        RSPsych.loadJSON('problem-scenes.json'),
        RSPsych.loadJSON('domains.json'),
        RSPsych.loadJSON('credentials.json'),
        RSPsych.loadJSON('trust-principles.json'),
      ]);

      const featured = featuredIds.map((id) => scenes.find((item) => item.id === id)).filter(Boolean);
      const allowedScenes = scenes.map((item) => item.id);
      const requested = RSPsych.getEnumParam('scene', allowedScenes, featured[0]?.id);
      const domainById = Object.fromEntries(domains.map((item) => [item.id, item]));

      sceneRail.innerHTML = featured.map((scene, index) => sceneButton(scene, index)).join('');
      if (allSceneList) allSceneList.innerHTML = scenes.map((scene) => allSceneButton(scene, domainById)).join('');
      if (domainGrid) domainGrid.innerHTML = domains.map(domainTile).join('');

      if (featuredCredential) {
        const journey = credentials.find((item) => item.id === 'growth-journey') || credentials[0];
        featuredCredential.innerHTML = RSPsych.credentialSealMarkup(journey, { caption: false });
      }
      if (collection) {
        collection.innerHTML = credentials.filter((item) => item.id !== 'growth-journey').map((item) => `
          <div>${RSPsych.credentialSealMarkup(item)}</div>`).join('');
      }
      if (trustGrid) {
        trustGrid.innerHTML = trust.principles.map((item) => `
          <article class="trust-principle">
            <p class="micro">${RSPsych.escapeHTML(item.micro)}</p>
            <h3>${RSPsych.escapeHTML(item.title)}</h3>
            <p>${RSPsych.escapeHTML(item.body)}</p>
          </article>`).join('');
      }

      const selectScene = (sceneId, focusResult = false) => {
        const scene = scenes.find((item) => item.id === sceneId) || scenes[0];
        if (!scene) return;
        sceneRail.querySelectorAll('[data-scene-id]').forEach((button) => {
          button.setAttribute('aria-pressed', String(button.dataset.sceneId === scene.id));
        });
        renderResult(sceneResult, scene, domainById[scene.primaryDomain]);
        if (focusResult) sceneResult.focus({ preventScroll: false });
        RSPsych.track('rspsych_select_problem_scene', {
          scene_id: scene.id,
          persona_group: scene.personas.join('-'),
          source: RSPsych.safeSourceParam(),
        });
        RSPsych.track('rspsych_view_mapped_path', { scene_id: scene.id, primary_domain: scene.primaryDomain });
      };

      sceneRail.addEventListener('click', (event) => {
        const button = event.target.closest('[data-scene-id]');
        if (button) selectScene(button.dataset.sceneId);
      });

      allSceneList?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-scene-id]');
        if (!button) return;
        RSPsych.closeDialog(button.closest('[data-dialog]'));
        const selectedFeatured = featured.some((item) => item.id === button.dataset.sceneId);
        if (selectedFeatured) {
          selectScene(button.dataset.sceneId, true);
          document.getElementById('problem-scenes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.location.href = `/rs-psych/pathway/?scene=${encodeURIComponent(button.dataset.sceneId)}&source=home`;
        }
      });

      selectScene(requested || featured[0]?.id || scenes[0]?.id);
      RSPsych.track('rspsych_view_problem_router', {});
    } catch (error) {
      RSPsych.showDataError(sceneRail, error.message);
      RSPsych.showDataError(sceneResult, error.message);
    }
  }

  function sceneButton(scene, index) {
    return `<button class="scene-option" type="button" data-scene-id="${RSPsych.escapeHTML(scene.id)}" aria-pressed="false">
      <span class="scene-index">${String(index + 1).padStart(2, '0')}</span>
      <strong>${RSPsych.escapeHTML(scene.label)}</strong>
      <span class="scene-arrow" aria-hidden="true">→</span>
    </button>`;
  }

  function allSceneButton(scene, domainById) {
    const domain = domainById[scene.primaryDomain] || RSPsych.domainMeta(scene.primaryDomain);
    return `<button class="dialog-scene-option" type="button" data-scene-id="${RSPsych.escapeHTML(scene.id)}">
      <strong>${RSPsych.escapeHTML(scene.label)}</strong>
      <span>${RSPsych.escapeHTML(domain.label)} · ${RSPsych.escapeHTML(scene.personaLabels.join(' · '))}</span>
    </button>`;
  }

  function renderResult(host, scene, domain) {
    if (!host) return;
    const source = RSPsych.safeSourceParam();
    const href = `${scene.primaryRoute}${scene.primaryRoute.includes('?') ? '&' : '?'}source=${encodeURIComponent(source)}`;
    host.innerHTML = `
      <span class="result-label">YOUR STARTING SCENE</span>
      <blockquote>${RSPsych.escapeHTML(scene.label)}</blockquote>
      <div class="result-domain">
        <span class="domain-signal" aria-hidden="true"></span>
        <span><small>PRIMARY PATH</small><strong>${RSPsych.escapeHTML(domain?.label || RSPsych.domainMeta(scene.primaryDomain).label)}</strong></span>
      </div>
      <p class="result-rationale">${RSPsych.escapeHTML(scene.rationale)}</p>
      <div class="result-meta">
        ${RSPsych.statusChipMarkup(scene.evidenceStatus)}
        ${RSPsych.statusChipMarkup(scene.operationalStatus)}
      </div>
      <a class="btn btn-primary" href="${RSPsych.escapeHTML(href)}" data-track="rspsych_click_pathway_next" data-track-scene_id="${RSPsych.escapeHTML(scene.id)}" data-track-destination="pathway">
        ${RSPsych.escapeHTML(scene.suggestedCta)}
      </a>`;
  }

  function domainTile(domain) {
    const motif = domain.id === 'career-design' ? 'career' : domain.id;
    return `<a class="domain-tile" href="/rs-psych/tests/?domain=${encodeURIComponent(domain.id)}">
      <span class="tile-micro">${RSPsych.escapeHTML(domain.micro)}</span>
      <span class="tile-arrow" aria-hidden="true">↗</span>
      <span class="domain-motif motif-${RSPsych.escapeHTML(motif)}" aria-hidden="true"></span>
      <h3>${RSPsych.escapeHTML(domain.label)}</h3>
      <span class="keywords">${RSPsych.escapeHTML(domain.keywords.join(' · '))}</span>
    </a>`;
  }

  document.addEventListener('DOMContentLoaded', initHome);
})();
