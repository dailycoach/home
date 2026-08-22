(function () {
  'use strict';

  async function initTests() {
    const filter = document.querySelector('[data-test-filters]');
    const featured = document.querySelector('[data-test-featured]');
    const grid = document.querySelector('[data-test-grid]');
    if (!filter || !featured || !grid) return;

    try {
      const [assessments, domains] = await Promise.all([
        RSPsych.loadJSON('assessments.json'),
        RSPsych.loadJSON('domains.json'),
      ]);
      const allowed = ['all', ...domains.map((item) => item.id)];
      let current = RSPsych.getEnumParam('domain', allowed, 'all');

      filter.innerHTML = [{ id: 'all', label: '전체' }, ...domains].map((item) => `
        <button class="filter-chip" type="button" data-domain-filter="${RSPsych.escapeHTML(item.id)}" aria-pressed="${item.id === current}">
          ${RSPsych.escapeHTML(item.label)}
        </button>`).join('');

      const render = () => {
        const visible = current === 'all' ? assessments : assessments.filter((item) => item.domain === current);
        const primary = visible[0] || assessments[0];
        featured.innerHTML = primary ? featuredMarkup(primary) : '<p>표시할 검사가 없습니다.</p>';
        grid.innerHTML = visible.slice(1).map(cardMarkup).join('') || `<article class="catalog-card"><p>이 영역의 추가 공개 확인 자산은 운영 검증 후 확장됩니다.</p></article>`;
        filter.querySelectorAll('[data-domain-filter]').forEach((button) => {
          button.setAttribute('aria-pressed', String(button.dataset.domainFilter === current));
        });
      };

      filter.addEventListener('click', (event) => {
        const button = event.target.closest('[data-domain-filter]');
        if (!button) return;
        current = allowed.includes(button.dataset.domainFilter) ? button.dataset.domainFilter : 'all';
        render();
        history.replaceState(null, '', current === 'all' ? '/rs-psych/tests/' : `/rs-psych/tests/?domain=${encodeURIComponent(current)}`);
      });

      render();
    } catch (error) {
      RSPsych.showDataError(featured, error.message);
    }
  }

  function statusMarkup(item) {
    return `${RSPsych.statusChipMarkup(item.sourceStatus)} ${RSPsych.statusChipMarkup(item.operationalStatus)}`;
  }

  function featuredMarkup(item) {
    const meta = RSPsych.domainMeta(item.domain);
    return `<div class="catalog-symbol ${meta.className}" aria-hidden="true"></div>
      <div class="catalog-copy">
        <p class="micro">${RSPsych.escapeHTML(meta.micro)}</p>
        <h3>${RSPsych.escapeHTML(item.title)}</h3>
        <p>${RSPsych.escapeHTML(item.summary)}</p>
        <div class="catalog-meta">${statusMarkup(item)}</div>
        <div class="boundary-box"><strong>현재 공개 상태</strong><p>검사 자산의 공개 출처는 확인됐지만, 온라인 시행 URL·대상·시간·운영 조건은 확인 전입니다. 임의의 검사 시작 버튼을 제공하지 않습니다.</p></div>
        <a class="text-link" href="/rs-psych/trust/#status">근거와 운영상태 읽기</a>
      </div>`;
  }

  function cardMarkup(item) {
    const meta = RSPsych.domainMeta(item.domain);
    return `<article class="catalog-card">
      <span class="kicker">${RSPsych.escapeHTML(meta.label)}</span>
      <h3>${RSPsych.escapeHTML(item.title)}</h3>
      <p>${RSPsych.escapeHTML(item.summary)}</p>
      <div class="catalog-meta">${statusMarkup(item)}</div>
      <p><strong>경계:</strong> ${RSPsych.escapeHTML(item.boundary)}</p>
      <a class="text-link" href="/rs-psych/pathway/?scene=result-no-next&source=tests">검사 이후 성장경로 보기</a>
    </article>`;
  }

  document.addEventListener('DOMContentLoaded', initTests);
})();
