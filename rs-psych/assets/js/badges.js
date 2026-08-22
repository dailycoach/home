(function () {
  'use strict';

  async function initBadges() {
    const filter = document.querySelector('[data-badge-filters]');
    const gallery = document.querySelector('[data-badge-gallery]');
    const featuredVisual = document.querySelector('[data-badge-featured-visual]');
    if (!filter || !gallery) return;

    try {
      const [credentials, domains] = await Promise.all([
        RSPsych.loadJSON('credentials.json'),
        RSPsych.loadJSON('domains.json'),
      ]);
      const filters = [{ id: 'all', label: '전체' }, ...domains, { id: 'journey', label: '성장여정' }];
      let current = 'all';
      filter.innerHTML = filters.map((item) => `<button class="filter-chip" type="button" data-badge-filter="${RSPsych.escapeHTML(item.id)}" aria-pressed="${item.id === current}">${RSPsych.escapeHTML(item.label)}</button>`).join('');
      const featured = credentials.find((item) => item.id === 'growth-journey') || credentials[0];
      if (featuredVisual) featuredVisual.innerHTML = RSPsych.credentialSealMarkup(featured, { caption: false });

      const render = () => {
        const visible = current === 'all' ? credentials : credentials.filter((item) => item.domain === current);
        gallery.innerHTML = visible.map((item) => `<article class="badge-card">${RSPsych.credentialSealMarkup(item)}</article>`).join('');
        filter.querySelectorAll('[data-badge-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.badgeFilter === current)));
      };

      filter.addEventListener('click', (event) => {
        const button = event.target.closest('[data-badge-filter]');
        if (!button) return;
        current = filters.some((item) => item.id === button.dataset.badgeFilter) ? button.dataset.badgeFilter : 'all';
        render();
      });
      render();
    } catch (error) {
      RSPsych.showDataError(gallery, error.message);
    }
  }

  document.addEventListener('DOMContentLoaded', initBadges);
})();
