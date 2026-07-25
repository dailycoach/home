(() => {
  'use strict';

  const config = window.RSEDU_ACADEMY_ACCESS || {};
  const STORAGE_KEY = config.storageKey || 'rsedu-academy-access:v1';
  const ENTRY_PATH = config.entryPath || './enter.html';
  const DEFAULT_NEXT = config.defaultNext || './course.html?course=lmc-lifetime-management-counselor';
  const CALLBACK_PREFIX = '__rseduAcademyJsonp';

  const safeText = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
  const normalizeCode = (value = '') => String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');

  function isConfigured() {
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(String(config.apiUrl || '').trim());
  }

  function loadSession() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!value || !value.token || !value.expiresAt) return null;
      if (new Date(value.expiresAt).getTime() <= Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return value;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function safeNext(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return DEFAULT_NEXT;
    try {
      const url = new URL(raw, window.location.href);
      if (url.origin !== window.location.origin) return DEFAULT_NEXT;
      if (!url.pathname.includes('/lcms/academy/')) return DEFAULT_NEXT;
      if (url.pathname.endsWith('/enter.html')) return DEFAULT_NEXT;
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return DEFAULT_NEXT;
    }
  }

  function currentNext() {
    return safeNext(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  }

  function entryUrl(next = currentNext()) {
    const url = new URL(ENTRY_PATH, window.location.href);
    url.searchParams.set('next', safeNext(next));
    return url.href;
  }

  function apiCall(action, payload = {}) {
    if (!isConfigured()) {
      return Promise.reject(new Error('강의실 인증 서버가 아직 연결되지 않았습니다.'));
    }

    return new Promise((resolve, reject) => {
      const id = `${CALLBACK_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timeoutMs = Number(config.requestTimeoutMs) || 12000;
      let finished = false;

      const cleanup = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        script.remove();
        try { delete window[id]; } catch { window[id] = undefined; }
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('인증 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'));
      }, timeoutMs);

      window[id] = (result) => {
        cleanup();
        if (result?.ok) resolve(result);
        else reject(new Error(result?.message || '입장 정보를 확인하지 못했습니다.'));
      };

      const url = new URL(config.apiUrl);
      url.searchParams.set('action', action);
      url.searchParams.set('callback', id);
      url.searchParams.set('_', String(Date.now()));
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') url.searchParams.set(key, String(value));
      });

      script.src = url.href;
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.onerror = () => {
        cleanup();
        reject(new Error('인증 서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.'));
      };
      document.head.appendChild(script);
    });
  }

  async function login(email, code) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = normalizeCode(code);
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('신청서에 입력한 Google 계정 이메일을 확인해 주세요.');
    if (normalizedCode.length !== 8) throw new Error('메일로 받은 8자리 입장코드를 입력해 주세요.');

    const result = await apiCall('login', {
      email: normalizedEmail,
      code: normalizedCode,
      courseId: config.courseId || 'lmc-lifetime-management-counselor',
      ua: navigator.userAgent.slice(0, 240)
    });

    const session = {
      token: result.token,
      email: normalizedEmail,
      studentName: result.studentName || '',
      courseId: result.courseId || config.courseId,
      expiresAt: result.expiresAt
    };
    saveSession(session);
    return session;
  }

  async function validate() {
    const session = loadSession();
    if (!session) return null;
    try {
      const result = await apiCall('validate', {
        token: session.token,
        courseId: session.courseId || config.courseId,
        ua: navigator.userAgent.slice(0, 240)
      });
      const refreshed = {
        ...session,
        studentName: result.studentName || session.studentName || '',
        expiresAt: result.expiresAt || session.expiresAt
      };
      saveSession(refreshed);
      return refreshed;
    } catch (error) {
      clearSession();
      throw error;
    }
  }

  async function logout() {
    const session = loadSession();
    clearSession();
    if (!session || !isConfigured()) return;
    try { await apiCall('logout', { token: session.token }); } catch { /* local logout already completed */ }
  }

  function renderSetupRequired(target) {
    const mount = target || document.querySelector('#courseApp, #lessonApp, #enterStatus');
    if (!mount) return;
    mount.innerHTML = `
      <section class="access-setup-state" role="status">
        <span>ACADEMY ACCESS</span>
        <strong>입장 인증 연결 준비 중입니다.</strong>
        <p>Google Apps Script 웹앱 배포 후 <code>access-config.js</code>의 <code>apiUrl</code>을 입력하면 수강생 로그인이 활성화됩니다.</p>
        <a href="./index.html">LMC 과정 안내로 돌아가기 →</a>
      </section>`;
  }

  function injectMemberBar(session) {
    if (!session || document.querySelector('.academy-member-bar')) return;
    const header = document.querySelector('.cip-header-inner');
    if (!header) return;
    const bar = document.createElement('div');
    bar.className = 'academy-member-bar';
    bar.innerHTML = `<span><strong>${safeText(session.studentName || '수강생')}</strong>님 학습 중</span><button type="button">로그아웃</button>`;
    bar.querySelector('button')?.addEventListener('click', async () => {
      await logout();
      window.location.replace(entryUrl(DEFAULT_NEXT));
    });
    header.appendChild(bar);
  }

  async function guard(options = {}) {
    const redirect = options.redirect !== false;
    if (!isConfigured()) {
      renderSetupRequired(options.target);
      return null;
    }

    try {
      const session = await validate();
      if (session) {
        injectMemberBar(session);
        return session;
      }
    } catch (error) {
      console.warn('[RS Academy] session validation failed:', error);
    }

    if (redirect) window.location.replace(entryUrl());
    return null;
  }

  function setFormState(form, message, type = '') {
    const status = document.querySelector('#enterStatus');
    if (status) {
      status.textContent = message;
      status.className = `enter-status${type ? ` is-${type}` : ''}`;
    }
    const button = form?.querySelector('button[type="submit"]');
    if (button) button.disabled = type === 'loading';
  }

  async function initEntryPage() {
    const form = document.querySelector('#academyEntryForm');
    if (!form) return;

    const next = safeNext(new URLSearchParams(window.location.search).get('next'));
    const existing = loadSession();
    if (existing && isConfigured()) {
      try {
        const valid = await validate();
        if (valid) {
          setFormState(form, `${valid.studentName || '수강생'}님, 기존 로그인 정보가 확인되었습니다.`, 'success');
          const resume = document.querySelector('#entryResume');
          if (resume) {
            resume.hidden = false;
            resume.href = next;
          }
        }
      } catch { /* login form remains available */ }
    }

    if (!isConfigured()) {
      setFormState(form, '인증 서버 배포 전입니다. 운영자 설정이 완료되면 입장할 수 있습니다.', 'warning');
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = form.elements.email?.value || '';
      const code = form.elements.code?.value || '';
      setFormState(form, '입장 정보를 확인하고 있습니다…', 'loading');
      try {
        const session = await login(email, code);
        setFormState(form, `${session.studentName || '수강생'}님, 강의실로 이동합니다.`, 'success');
        window.location.replace(next);
      } catch (error) {
        setFormState(form, error.message, 'error');
      }
    });

    form.querySelector('[name="code"]')?.addEventListener('input', (event) => {
      const normalized = normalizeCode(event.currentTarget.value).slice(0, 8);
      event.currentTarget.value = normalized.replace(/(.{4})(?=.)/, '$1 ');
    });
  }

  window.RSEduAcademyAccess = Object.freeze({
    apiCall,
    clearSession,
    entryUrl,
    guard,
    isConfigured,
    loadSession,
    login,
    logout,
    safeNext,
    validate
  });

  document.addEventListener('DOMContentLoaded', initEntryPage);
})();
