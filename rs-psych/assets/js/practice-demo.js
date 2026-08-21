(function () {
  'use strict';

  async function initPracticeDemo() {
    const hosts = document.querySelectorAll('[data-practice-demo]');
    if (!hosts.length) return;

    let practices;
    try {
      practices = await RSPsych.loadJSON('practice-7.demo.json');
    } catch (error) {
      hosts.forEach((host) => RSPsych.showDataError(host, error.message));
      return;
    }

    hosts.forEach((host) => {
      const requested = host.dataset.practiceId;
      const practice = practices.find((item) => item.id === requested) || practices[0];
      if (!practice) return;
      render(host, practice);
    });
  }

  function render(host, practice) {
    host.dataset.resolvedPracticeId = practice.id;
    host.innerHTML = `
      <div class="practice-head">
        <div>
          <span class="status-chip demo">DEMO · 저장하지 않음</span>
          <h3>${RSPsych.escapeHTML(practice.title)}</h3>
          <p>${RSPsych.escapeHTML(practice.lead)}</p>
        </div>
      </div>
      <div class="practice-days" role="tablist" aria-label="Practice 7 날짜 선택">
        ${practice.days.map((item, index) => `
          <button class="practice-day" type="button" role="tab" id="practice-${RSPsych.escapeHTML(practice.id)}-tab-${item.day}"
            aria-selected="${index === 0}" aria-controls="practice-${RSPsych.escapeHTML(practice.id)}-panel"
            tabindex="${index === 0 ? '0' : '-1'}" data-day-index="${index}">
            <span>DAY ${item.day}</span><strong>${RSPsych.escapeHTML(item.label)}</strong>
          </button>`).join('')}
      </div>
      <div class="practice-action" id="practice-${RSPsych.escapeHTML(practice.id)}-panel" role="tabpanel"
        aria-labelledby="practice-${RSPsych.escapeHTML(practice.id)}-tab-${practice.days[0].day}" tabindex="0">
        <span class="day-label">DAY ${practice.days[0].day} · ${RSPsych.escapeHTML(practice.days[0].label)}</span>
        <strong>${RSPsych.escapeHTML(practice.days[0].action)}</strong>
      </div>
      <div class="practice-evidence" aria-label="확인 가능한 경험 유형">
        ${practice.evidenceClasses.map((item) => `<span>${RSPsych.escapeHTML(item.replace(/-/g, ' ').toUpperCase())}</span>`).join('')}
      </div>`;

    const tabs = [...host.querySelectorAll('[role="tab"]')];
    const panel = host.querySelector('[role="tabpanel"]');

    const activate = (index, focus = false) => {
      const item = practice.days[index];
      tabs.forEach((tab, tabIndex) => {
        const current = tabIndex === index;
        tab.setAttribute('aria-selected', String(current));
        tab.tabIndex = current ? 0 : -1;
      });
      panel.setAttribute('aria-labelledby', tabs[index].id);
      panel.innerHTML = `<span class="day-label">DAY ${item.day} · ${RSPsych.escapeHTML(item.label)}</span><strong>${RSPsych.escapeHTML(item.action)}</strong>`;
      if (focus) tabs[index].focus();
      RSPsych.track('rspsych_open_practice_day', { practice_id: practice.id, day: item.day });
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(index));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        activate(next, true);
      });
    });

    RSPsych.track('rspsych_view_practice7_demo', { practice_id: practice.id });
  }

  window.RSPsychPractice = Object.freeze({ hydrate: initPracticeDemo });
  document.addEventListener('DOMContentLoaded', initPracticeDemo);
  document.addEventListener('rspsych:hydrate-practice', initPracticeDemo);
})();
