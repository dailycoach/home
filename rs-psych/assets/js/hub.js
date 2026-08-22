(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const menuButton = document.querySelector('.menu-toggle');
  const siteNav = document.querySelector('.site-nav');
  let menuReturnFocus = null;

  const closeMenu = ({ restoreFocus = false } = {}) => {
    if (!menuButton || !siteNav) return;
    menuButton.setAttribute('aria-expanded', 'false');
    siteNav.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    if (restoreFocus && menuReturnFocus) menuReturnFocus.focus();
  };

  const openMenu = () => {
    if (!menuButton || !siteNav) return;
    menuReturnFocus = document.activeElement;
    menuButton.setAttribute('aria-expanded', 'true');
    siteNav.classList.add('is-open');
    document.body.classList.add('menu-open');
    siteNav.querySelector('a')?.focus();
  };

  menuButton?.addEventListener('click', () => {
    if (menuButton.getAttribute('aria-expanded') === 'true') closeMenu({ restoreFocus: true });
    else openMenu();
  });

  siteNav?.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
    if (event.key === 'Tab' && menuButton?.getAttribute('aria-expanded') === 'true' && siteNav) {
      const focusable = [menuButton, ...siteNav.querySelectorAll('a')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeMenu();
  }, { passive: true });

  const safeInternalPath = (value) => typeof value === 'string' && value.startsWith('/rs-psych/') ? value : '/rs-psych/guide/';

  const makeList = (items) => {
    const list = document.createElement('ul');
    for (const item of items || []) {
      const li = document.createElement('li');
      li.textContent = item;
      list.append(li);
    }
    return list;
  };

  for (const navigator of document.querySelectorAll('[data-step-navigator]')) {
    const source = navigator.querySelector('#participant-step-data');
    const result = navigator.querySelector('[data-step-result]');
    const select = navigator.querySelector('[data-step-select]');
    const buttons = [...navigator.querySelectorAll('[data-step-button]')];
    if (!source || !result || !select || !buttons.length) continue;

    let steps = [];
    try {
      steps = JSON.parse(source.textContent || '[]');
    } catch {
      continue;
    }
    const stepMap = new Map(steps.map((item) => [item.id, item]));

    const render = (id, { focus = false, updateUrl = true } = {}) => {
      const step = stepMap.get(id) || steps[0];
      if (!step) return;

      buttons.forEach((button) => {
        const selected = button.dataset.stepButton === step.id;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        if (selected) result.setAttribute('aria-labelledby', button.id);
      });
      select.value = step.id;

      result.replaceChildren();
      const eyebrow = document.createElement('p');
      eyebrow.className = 'eyebrow';
      eyebrow.textContent = `NOW · ${step.id.toUpperCase()}`;
      const title = document.createElement('h3');
      title.textContent = step.label;
      const action = document.createElement('p');
      action.className = 'step-action';
      action.textContent = step.nowAction;
      const prep = document.createElement('div');
      prep.className = 'step-prep';
      const prepLabel = document.createElement('span');
      prepLabel.textContent = '준비할 것';
      prep.append(prepLabel, makeList(step.preparation));
      const link = document.createElement('a');
      link.className = 'button button--signal';
      link.href = safeInternalPath(step.destination || step.fallback);
      link.append(document.createTextNode('이 단계 자세히 보기 '));
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      link.append(arrow);
      result.append(eyebrow, title, action, prep, link);

      if (focus) result.focus({ preventScroll: true });
      if (updateUrl && window.history?.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set('step', step.id);
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
    };

    buttons.forEach((button, index) => {
      button.addEventListener('click', () => render(button.dataset.stepButton));
      button.addEventListener('keydown', (event) => {
        let nextIndex = index;
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % buttons.length;
        else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = buttons.length - 1;
        else return;
        event.preventDefault();
        buttons[nextIndex].focus();
        render(buttons[nextIndex].dataset.stepButton, { updateUrl: true });
      });
    });

    select.addEventListener('change', () => render(select.value, { focus: true }));
    const requested = new URLSearchParams(window.location.search).get('step');
    render(stepMap.has(requested) ? requested : steps[0]?.id, { updateUrl: false });
  }

  const reveals = [...document.querySelectorAll('.reveal')];
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    reveals.forEach((item) => item.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.05 });
    reveals.forEach((item) => observer.observe(item));
  }
})();
