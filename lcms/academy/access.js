(() => {
  'use strict';

  const config = window.RSEDU_ACADEMY_ACCESS || {};
  const STORAGE_KEY = config.storageKey || 'rsedu-academy-access:v1';
  const ENTRY_PATH = config.entryPath || './enter.html';
  const DEFAULT_NEXT = config.defaultNext || './course.html?course=lmc-lifetime-management-counselor';

  const safeText = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
  const normalizeCode = (value = '') => String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalizeStudentId = (value = '') => {
    const studentId = String(value).trim();
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/.test(studentId) ? studentId : '';
  };

  function isConfigured() {
    try {
      const url = new URL(String(config.playbackWorkerUrl || '').trim());
      return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
    } catch {
      return false;
    }
  }

  function loadSession() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!value || !value.token || !value.expiresAt) return null;
      if (new Date(value.expiresAt).getTime() <= Date.now()) {
        clearSession();
        return null;
      }
      return value;
    } catch {
      clearSession();
      return null;
    }
  }

  function saveSession(session) {
    let previous = null;
    try {
      previous = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch { /* Invalid prior data is replaced below. */ }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    if (previous?.token !== session?.token || previous?.studentId !== session?.studentId) {
      window.dispatchEvent(new CustomEvent('rsedu-academy:session-changed'));
    }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('rsedu-academy:session-cleared'));
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
    if (!isConfigured()) return Promise.reject(new Error('강의실 인증 서버가 아직 연결되지 않았습니다.'));

    const controller = new AbortController();
    const timeoutMs = Number(config.requestTimeoutMs) || 12000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const gateway = new URL('/access', String(config.playbackWorkerUrl).trim()).href;
    const body = { action };
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') body[key] = value;
    });

    return fetch(gateway, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || '입장 정보를 확인하지 못했습니다.');
      }
      return result;
    }).catch((error) => {
      if (error?.name === 'AbortError') {
        throw new Error('인증 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.');
      }
      if (error instanceof TypeError) {
        throw new Error('인증 서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.');
      }
      throw error;
    }).finally(() => clearTimeout(timer));
  }

  async function login(email, code) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = normalizeCode(code);
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('수강생 신청서에 입력한 이메일을 확인해 주세요.');
    if (normalizedCode.length !== 8) throw new Error('메일로 받은 8자리 입장코드를 입력해 주세요.');

    const result = await apiCall('login', {
      email: normalizedEmail,
      code: normalizedCode,
      courseId: config.courseId || 'lmc-lifetime-management-counselor',
      ua: navigator.userAgent.slice(0, 240)
    });
    const studentId = normalizeStudentId(result.studentId);
    if (!studentId) throw new Error('수강생 식별정보를 확인하지 못했습니다. 운영자에게 문의해 주세요.');

    const session = {
      token: result.token,
      studentId,
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
      const studentId = normalizeStudentId(result.studentId);
      if (!studentId || (session.studentId && studentId !== session.studentId)) {
        throw new Error('수강생 식별정보가 일치하지 않습니다. 다시 로그인해 주세요.');
      }
      const refreshed = {
        ...session,
        studentId,
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
        <p>Cloudflare Worker 배포 후 <code>access-config.js</code>의 <code>playbackWorkerUrl</code>을 입력하면 수강생 로그인이 활성화됩니다.</p>
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

    if (!isConfigured()) setFormState(form, '인증 서버 배포 전입니다. 운영자 설정이 완료되면 입장할 수 있습니다.', 'warning');

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
