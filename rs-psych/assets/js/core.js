(function () {
  'use strict';

  const DATA_ROOT = '/rs-psych/data/';
  const cache = new Map();
  const DOMAIN_META = {
    self: { label: '자기이해', micro: 'SELF UNDERSTANDING', className: 'domain-self' },
    strength: { label: '강점·가능성', micro: 'STRENGTH & POSSIBILITY', className: 'domain-strength' },
    interest: { label: '직업흥미', micro: 'CAREER INTEREST', className: 'domain-interest' },
    'career-design': { label: '진로설계', micro: 'CAREER DESIGN', className: 'domain-career-design' },
    journey: { label: '성장여정', micro: 'GROWTH JOURNEY', className: 'domain-journey' },
  };

  const STATUS_META = {
    preview: { label: 'DEMO / PREVIEW', className: 'preview' },
    demo: { label: 'DEMO', className: 'demo' },
    'demo-only': { label: 'DEMO ONLY', className: 'demo' },
    'public-source-verified': { label: 'SOURCE VERIFIED', className: 'source' },
    'source-backed-framework': { label: 'SOURCE-BACKED FRAMEWORK', className: 'source' },
    'operation-unverified': { label: 'OPERATION PENDING', className: 'pending' },
    placeholder: { label: 'PLACEHOLDER', className: 'pending' },
  };

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function loadJSON(fileName) {
    if (!/^[a-z0-9._-]+\.json$/i.test(fileName)) {
      throw new Error('허용되지 않은 데이터 파일명입니다.');
    }
    if (cache.has(fileName)) return cache.get(fileName);

    const promise = fetch(DATA_ROOT + fileName, { credentials: 'same-origin' }).then((response) => {
      if (!response.ok) {
        throw new Error(`${fileName}을 불러오지 못했습니다. (${response.status})`);
      }
      return response.json();
    });

    cache.set(fileName, promise);
    return promise;
  }

  function getEnumParam(name, allowed, fallback = null) {
    const raw = new URLSearchParams(window.location.search).get(name);
    return raw && allowed.includes(raw) ? raw : fallback;
  }

  function safeSourceParam() {
    const allowed = ['home', 'rs01', 'rs03', 'rs05', 'rs08', 'rs11', 'rs13', 'tests', 'badges', 'passport', 'trust'];
    return getEnumParam('source', allowed, 'home');
  }

  function domainMeta(domainId) {
    return DOMAIN_META[domainId] || DOMAIN_META.self;
  }

  function statusMeta(status) {
    return STATUS_META[status] || { label: String(status || 'STATUS UNKNOWN').toUpperCase(), className: 'pending' };
  }

  function track(eventName, properties = {}) {
    const safe = {};
    const blocked = /(name|contact|score|type|free_text|mental|counsel|guardian|credential_eligibility)/i;
    Object.entries(properties).forEach(([key, value]) => {
      if (!blocked.test(key) && ['string', 'number', 'boolean'].includes(typeof value)) {
        safe[key] = value;
      }
    });

    window.dispatchEvent(new CustomEvent('rspsych:analytics', {
      detail: { event: eventName, properties: safe },
    }));

    if (new URLSearchParams(window.location.search).get('debug') === 'events') {
      console.info('[RS PSYCH event]', eventName, safe);
    }
  }

  function credentialSealMarkup(credential, options = {}) {
    const meta = domainMeta(credential.domain);
    const button = options.button !== false;
    const caption = options.caption !== false;
    const compact = options.compact === true;
    const seal = `
      <span class="credential-seal" aria-hidden="true">
        <span class="seal-core">
          <span class="seal-micro">${escapeHTML(compact ? 'RS PSYCH' : credential.title)}</span>
          <strong>${escapeHTML(credential.koTitle)}</strong>
          <small>${escapeHTML(compact ? 'GROWTH CREDENTIAL' : 'EVIDENCE · MEANING · APPLICATION')}</small>
        </span>
      </span>`;

    const control = button
      ? `<button class="seal-button ${meta.className}" type="button" data-credential-id="${escapeHTML(credential.id)}" aria-label="${escapeHTML(credential.koTitle)} Credential 상세 보기">${seal}</button>`
      : `<span class="seal-button ${meta.className}">${seal}</span>`;

    return `${control}${caption ? `<div class="credential-caption"><strong>${escapeHTML(credential.koTitle)}</strong><span>${escapeHTML(credential.title)}</span></div>` : ''}`;
  }

  function statusChipMarkup(status, customLabel) {
    const meta = statusMeta(status);
    return `<span class="status-chip ${meta.className}">${escapeHTML(customLabel || meta.label)}</span>`;
  }

  let activeDialog = null;
  let dialogReturnFocus = null;

  function getFocusable(container) {
    return [...container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((element) => !element.hidden && element.offsetParent !== null);
  }

  function openDialog(dialog, trigger = document.activeElement) {
    if (!dialog) return;
    if (activeDialog && activeDialog !== dialog) closeDialog(activeDialog, false);
    dialogReturnFocus = trigger instanceof HTMLElement ? trigger : null;
    activeDialog = dialog;
    dialog.hidden = false;
    document.body.classList.add('dialog-open');
    const panel = dialog.querySelector('[role="dialog"]') || dialog.querySelector('.dialog-panel');
    requestAnimationFrame(() => {
      const focusables = getFocusable(panel || dialog);
      (focusables[0] || panel || dialog).focus();
    });
  }

  function closeDialog(dialog = activeDialog, restoreFocus = true) {
    if (!dialog) return;
    dialog.hidden = true;
    document.body.classList.remove('dialog-open');
    activeDialog = null;
    if (restoreFocus && dialogReturnFocus) dialogReturnFocus.focus();
    dialogReturnFocus = null;
  }

  function initDialogs() {
    document.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-dialog-open]');
      if (opener) {
        const target = document.getElementById(opener.dataset.dialogOpen);
        if (target) {
          event.preventDefault();
          openDialog(target, opener);
        }
        return;
      }

      if (event.target.closest('[data-dialog-close]')) {
        event.preventDefault();
        closeDialog(event.target.closest('[data-dialog]'));
        return;
      }

      const backdrop = event.target.closest('[data-dialog]');
      if (backdrop && event.target === backdrop) closeDialog(backdrop);
    });

    document.addEventListener('keydown', (event) => {
      if (!activeDialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog(activeDialog);
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = activeDialog.querySelector('[role="dialog"]') || activeDialog;
      const focusables = getFocusable(panel);
      if (!focusables.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function initHeader() {
    const header = document.querySelector('.site-header');
    const button = document.querySelector('[data-menu-button]');
    const panel = document.querySelector('[data-mobile-panel]');

    const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 12);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });

    if (!button || !panel) return;

    const setMenu = (open) => {
      button.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      panel.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      if (open) panel.querySelector('a, button')?.focus();
    };

    button.addEventListener('click', () => setMenu(button.getAttribute('aria-expanded') !== 'true'));
    panel.addEventListener('click', (event) => {
      if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        button.focus();
      }
    });
    window.matchMedia('(min-width: 861px)').addEventListener('change', (event) => {
      if (event.matches) setMenu(false);
    });
  }

  function initCurrentNavigation() {
    const path = window.location.pathname.replace(/index\.html$/, '');
    document.querySelectorAll('[data-nav-path]').forEach((link) => {
      const navPath = link.dataset.navPath;
      const isHome = navPath === '/rs-psych/';
      const current = isHome ? path === navPath : path.startsWith(navPath);
      if (current) link.setAttribute('aria-current', 'page');
    });
  }

  function initReveal() {
    const items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    items.forEach((item) => observer.observe(item));
  }

  function initTracking() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-track]');
      if (!target) return;
      const properties = {};
      Object.entries(target.dataset).forEach(([key, value]) => {
        if (key !== 'track' && key.startsWith('track')) {
          const normalized = key.slice(5);
          if (normalized) properties[normalized.charAt(0).toLowerCase() + normalized.slice(1)] = value;
        }
      });
      track(target.dataset.track, properties);
    });
  }

  function showDataError(container, message) {
    if (!container) return;
    container.innerHTML = `<div class="boundary-box"><strong>데이터를 불러오지 못했습니다.</strong><p>${escapeHTML(message || '잠시 후 다시 확인해 주세요.')}</p></div>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initDialogs();
    initCurrentNavigation();
    initReveal();
    initTracking();
    document.querySelectorAll('[data-current-year]').forEach((node) => {
      node.textContent = new Date().getFullYear();
    });
  });

  window.RSPsych = Object.freeze({
    DATA_ROOT,
    DOMAIN_META,
    escapeHTML,
    loadJSON,
    getEnumParam,
    safeSourceParam,
    domainMeta,
    statusMeta,
    statusChipMarkup,
    credentialSealMarkup,
    track,
    openDialog,
    closeDialog,
    showDataError,
  });
})();
