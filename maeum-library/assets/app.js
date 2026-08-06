const API_BASE = 'https://maeum-api.daily-coach-ing.com';
const LEGACY_PUBLIC_API_BASE = 'https://maeum-library-talk.dailycoaching.chatgpt.site';
const TOSS_URL = 'https://minion.toss.im/NRHKhVoA';
const entryRequests = new WeakMap();

const $ = (selector, scope = document) => scope.querySelector(selector);

function api(path, options = {}) {
  return fetch(`${API_BASE}${path}`, { credentials: 'include', cache: 'no-store', ...options });
}

async function publicApi(path, options = {}) {
  const requestOptions = { credentials: 'omit', cache: 'no-store', ...options };
  try {
    const response = await fetch(`${API_BASE}${path}`, requestOptions);
    if (response.status < 500) return response;
  } catch (error) {
    if (error?.name === 'AbortError' || requestOptions.signal?.aborted) throw error;
  }
  return fetch(`${LEGACY_PUBLIC_API_BASE}${path}`, requestOptions);
}

async function json(response) {
  try { return await response.json(); } catch { return {}; }
}

function csrfToken() {
  return document.cookie.split(';').map((item) => item.trim()).find((item) => item.startsWith('maeum_csrf='))?.slice('maeum_csrf='.length) || '';
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = String(text);
  return element;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(date) : '';
}

function entryCard(entry) {
  const article = node('article', 'entry-card');
  const meta = node('div', 'entry-meta');
  meta.append(node('span', '', entry.theme || '마음 서가'));
  const book = node('div', 'entry-book');
  book.append(node('b', '', entry.bookTitle || '책 제목 없음'));
  if (entry.bookAuthor) book.append(node('small', '', entry.bookAuthor));
  const quote = node('blockquote', '', `“${entry.quotedLine || ''}”`);
  const reflection = node('p', '', entry.reflection || '');
  article.append(meta, book, quote, reflection);
  if (entry.chosenStep) {
    const step = node('p', 'entry-step');
    step.append(node('span', '', '다음 한 걸음'), document.createTextNode(entry.chosenStep));
    article.append(step);
  }
  const footer = document.createElement('footer');
  const time = node('time', '', formatDate(entry.createdAt));
  const createdAt = new Date(entry.createdAt);
  if (Number.isFinite(createdAt.getTime())) time.dateTime = createdAt.toISOString();
  footer.append(node('span', '', entry.displayName || '익명의 마음'), time);
  article.append(footer);
  return article;
}

function loadingState() {
  const wrap = node('div', 'loading-state skeleton');
  wrap.setAttribute('role', 'status');
  wrap.textContent = '서가에서 문장을 꺼내고 있습니다.';
  return wrap;
}

function emptyState() {
  const wrap = node('div', 'empty-state');
  wrap.append(node('b', '', '이번 주 마음이 멈춘 문장은 무엇인가요?'), node('p', '', '첫 번째 문장이 이 서가에 꽂히기를 기다리고 있습니다.'));
  const actions = node('div', 'hero-actions');
  const toss = node('a', 'button accent', '토스에서 한 문장 남기기');
  toss.href = TOSS_URL;
  const guide = node('a', 'button ghost', '마음서재 이용 방법 보기');
  guide.href = '/maeum-library/#how';
  actions.append(toss, guide); wrap.append(actions);
  return wrap;
}

function filteredEmptyState() {
  const wrap = node('div', 'empty-state');
  wrap.append(
    node('b', '', '이 조건에 맞는 문장은 아직 없습니다.'),
    node('p', '', '다른 단어나 서가를 선택해보세요.'),
  );
  return wrap;
}

function errorState(retry) {
  const wrap = node('div', 'error-state');
  wrap.setAttribute('role', 'alert');
  wrap.append(node('b', '', '문장을 불러오지 못했습니다.'), node('p', '', '잠시 후 다시 시도해 주세요.'));
  const button = node('button', 'button ghost', '다시 불러오기');
  button.type = 'button'; button.addEventListener('click', retry); wrap.append(button);
  return wrap;
}

async function loadEntries(target, params, retry, emptyFactory = emptyState) {
  entryRequests.get(target)?.abort();
  const controller = new AbortController();
  entryRequests.set(target, controller);
  target.setAttribute('aria-busy', 'true');
  target.replaceChildren(loadingState());
  try {
    const response = await publicApi(`/api/entries?${params.toString()}`, { signal: controller.signal });
    const data = await json(response);
    if (!response.ok || !data.ok) throw new Error('entries');
    target.replaceChildren();
    if (!Array.isArray(data.entries) || !data.entries.length) target.append(emptyFactory());
    else data.entries.forEach((entry) => target.append(entryCard(entry)));
  } catch (error) {
    if (error?.name !== 'AbortError') target.replaceChildren(errorState(retry));
  } finally {
    if (entryRequests.get(target) === controller) {
      entryRequests.delete(target);
      target.setAttribute('aria-busy', 'false');
    }
  }
}

function initHomeEntries() {
  const target = $('[data-home-entries]');
  if (!target) return;
  const run = () => loadEntries(target, new URLSearchParams({ limit: '6' }), run);
  run();
}

function initLibrary() {
  const target = $('[data-library-entries]');
  if (!target) return;
  let theme = '';
  const search = $('[data-library-search]');
  let timer;
  const run = () => {
    const params = new URLSearchParams({ limit: '60' });
    if (theme) params.set('theme', theme);
    if (search?.value.trim()) params.set('q', search.value.trim());
    const filtered = Boolean(theme || search?.value.trim());
    loadEntries(target, params, run, filtered ? filteredEmptyState : emptyState);
  };
  const filterButtons = [...document.querySelectorAll('[data-theme]')];
  filterButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.classList.contains('is-active')));
    button.addEventListener('click', () => {
      theme = button.dataset.theme || '';
      filterButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      run();
    });
  });
  search?.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 280); });
  run();
}


function bookNewsCard(item) {
  const article = node('article', 'editorial-card');
  const meta = node('span', '', item.category || '도서뉴스');
  const heading = node('h3');
  const link = node('a', '', item.title || '기사 원문 보기');
  link.href = item.link || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  heading.append(link);
  const source = node('p', '', item.source || '출처 확인 중');
  const published = node('time', '', formatDate(item.publishedAt));
  const publishedAt = new Date(item.publishedAt);
  if (Number.isFinite(publishedAt.getTime())) published.dateTime = publishedAt.toISOString();
  article.append(meta, heading, source, published);
  if (item.attribution) {
    if (item.attributionUrl) {
      const attribution = node('a', '', item.attribution);
      attribution.href = item.attributionUrl;
      attribution.target = '_blank';
      attribution.rel = 'noopener noreferrer';
      article.append(attribution);
    } else {
      article.append(node('small', '', item.attribution));
    }
  }
  return article;
}

function bookNewsState(title, description, retry) {
  const wrap = node('div', retry ? 'error-state' : 'empty-state');
  wrap.setAttribute('role', retry ? 'alert' : 'status');
  wrap.append(node('b', '', title), node('p', '', description));
  if (retry) {
    const button = node('button', 'button ghost', '다시 불러오기');
    button.type = 'button';
    button.addEventListener('click', retry);
    wrap.append(button);
  }
  return wrap;
}

function initBookNews() {
  const target = $('[data-book-news]');
  if (!target) return;
  if (target.querySelector('.editorial-card')) {
    target.setAttribute('aria-busy', 'false');
    return;
  }
  const run = async () => {
    target.setAttribute('aria-busy', 'true');
    const loading = bookNewsState('도서·출판 기사를 확인하고 있습니다.', '매체와 발행일을 확인한 뒤 원문 링크를 정리합니다.');
    loading.classList.add('loading-state', 'skeleton');
    target.replaceChildren(loading);
    try {
      const response = await publicApi('/api/book-news?limit=24');
      const data = await json(response);
      if (!response.ok || !data.ok || !Array.isArray(data.items)) throw new Error('book-news');
      target.replaceChildren();
      if (!data.items.length) {
        target.append(bookNewsState('새로 확인된 기사가 없습니다.', '확인된 출처의 새 기사가 생기면 이곳에 표시합니다.'));
      } else {
        data.items.forEach((item) => target.append(bookNewsCard(item)));
      }
    } catch {
      target.replaceChildren(bookNewsState('도서뉴스를 불러오지 못했습니다.', '잠시 후 다시 시도해 주세요.', run));
    } finally {
      target.setAttribute('aria-busy', 'false');
    }
  };
  run();
}

function message(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle('error', isError);
  element.setAttribute('role', isError ? 'alert' : 'status');
  element.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  element.hidden = !text;
}

async function exchangeConnection(path, payload, status, trigger) {
  if (trigger) trigger.disabled = true;
  message(status, '안전하게 연결하고 있습니다.');
  try {
    const response = await api(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await json(response);
    if (!response.ok || !data.ok) { message(status, data.message || '연결하지 못했습니다.', true); return; }
    window.location.replace('/maeum-library/me/');
  } catch { message(status, '인터넷 연결을 확인한 뒤 다시 시도해 주세요.', true); }
  finally { if (trigger) trigger.disabled = false; }
}

function initConnect() {
  const form = $('[data-connect-form]');
  if (!form) return;
  const status = $('[data-form-message]');
  const input = $('#participant-code');
  const exchangeToken = new URLSearchParams(location.hash.replace(/^#/, '')).get('exchange') || '';
  if (exchangeToken) {
    history.replaceState(null, '', location.pathname);
    exchangeConnection('/api/participant/toss-exchange', { exchangeToken }, status);
  }
  input?.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    input.setCustomValidity('');
    input.setAttribute('aria-invalid', 'false');
  });
  input?.addEventListener('invalid', () => {
    input.setCustomValidity('참여 코드는 영문과 숫자 8자리로 입력해 주세요.');
    input.setAttribute('aria-invalid', 'true');
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const valid = /^[A-Z0-9]{8}$/.test(input?.value || '');
    input?.setCustomValidity(valid ? '' : '참여 코드는 영문과 숫자 8자리로 입력해 주세요.');
    input?.setAttribute('aria-invalid', String(!valid));
    if (!valid) { input?.reportValidity(); return; }
    const button = $('button[type=submit]', form);
    exchangeConnection('/api/participant/connect', { code: input.value }, status, button);
  });
}

function initApplication() {
  const form = $('[data-application-form]');
  if (!form) return;
  const status = $('[data-application-message]', form);
  const submit = $('button[type=submit]', form);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    message(status, '신청서를 안전하게 접수하고 있습니다.');
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(`${API_BASE}/api/applications`, {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await json(response);
      if (!response.ok || !data.ok) {
        message(status, data.message || '신청서를 접수하지 못했습니다. 입력 내용을 확인해 주세요.', true);
        return;
      }
      form.reset();
      message(status, `신청이 접수되었습니다. 접수번호는 ${data.receipt}입니다. 운영 확인 후 참여 방법을 안내합니다.`);
      status?.focus({ preventScroll: true });
    } catch {
      message(status, '인터넷 연결을 확인한 뒤 다시 시도해 주세요.', true);
    } finally {
      submit.disabled = false;
      form.setAttribute('aria-busy', 'false');
    }
  });
}

function recordWrap(entry, reload, status) {
  const wrap = node('div', 'record-wrap');
  wrap.append(entryCard(entry));
  const control = node('div', 'record-control');
  const isPublic = entry.shareConsent === true || entry.shareConsent === 1 || entry.status === 'published';
  control.append(node('span', '', entry.moderationStatus === 'hidden' ? '운영 검수로 숨김' : isPublic ? '익명 공개' : '비공개'));
  const button = node('button', '', isPublic ? '비공개로 전환' : '익명으로 공개');
  button.type = 'button'; button.disabled = entry.moderationStatus === 'hidden';
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const response = await api('/api/participant/entries/status', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken() }, body: JSON.stringify({ id: entry.id, shareConsent: !isPublic }) });
      const data = await json(response);
      if (!response.ok || !data.ok) message(status, data.message || '공개 상태를 변경하지 못했습니다.', true);
      else { message(status, isPublic ? '비공개로 전환했습니다.' : '이름 없이 공개했습니다.'); reload(); }
    } catch { message(status, '인터넷 연결을 확인해 주세요.', true); }
    finally { button.disabled = false; }
  });
  control.append(button); wrap.append(control); return wrap;
}

function initMe() {
  const root = $('[data-me-root]');
  if (!root) return;
  const status = $('[data-form-message]');
  async function load() {
    root.setAttribute('aria-busy', 'true');
    root.replaceChildren(loadingState());
    try {
      const response = await api('/api/participant/me');
      const data = await json(response);
      if (response.status === 401) {
        const empty = node('div', 'empty-state');
        empty.append(node('b', '', '내 기록을 보려면 연결이 필요합니다.'), node('p', '', 'ChatGPT나 OpenAI 로그인 없이 토스 또는 참여 코드로 연결할 수 있습니다.'));
        const link = node('a', 'button accent', '참여자 연결하기'); link.href = '/maeum-library/connect/'; empty.append(link); root.replaceChildren(empty); return;
      }
      if (!response.ok || !data.ok || !data.member) throw new Error('member');
      const banner = node('section', 'member-banner');
      const intro = document.createElement('div'); intro.append(node('p', 'eyebrow', 'MY READING SHELF'), node('h2', '', `${data.member.displayName}님의 서재`), node('span', '', data.member.cohortName || data.member.cohortId));
      const dl = document.createElement('dl');
      [['이번 주 질문', data.member.weeklyPrompt || '이번 주 마음이 멈춘 문장은 무엇인가요?'], ['쌓인 한 줄', `${data.entries?.length || 0}개`]].forEach(([term, value]) => { const item = document.createElement('div'); item.append(node('dt', '', term), node('dd', '', value)); dl.append(item); });
      banner.append(intro, dl);
      const grid = node('div', 'entry-grid');
      if (data.entries?.length) data.entries.forEach((entry) => grid.append(recordWrap(entry, load, status)));
      else grid.append(emptyState());
      const actions = node('div', 'session-actions');
      const logout = node('button', '', '로그아웃'); const disconnect = node('button', 'danger', '연결 해제');
      async function end(path, trigger) {
        trigger.disabled = true;
        try {
          const response = await api(`/api/participant/${path}`, { method: 'DELETE', headers: { 'x-csrf-token': csrfToken() } });
          if (response.ok) location.replace('/maeum-library/connect/');
          else message(status, '연결 종료를 처리하지 못했습니다.', true);
        } catch {
          message(status, '인터넷 연결을 확인한 뒤 다시 시도해 주세요.', true);
        } finally {
          trigger.disabled = false;
        }
      }
      logout.addEventListener('click', () => end('logout', logout));
      disconnect.addEventListener('click', () => { if (confirm('이 브라우저와 토스 연결을 모두 해제할까요? 기존 공개 기록은 삭제되지 않습니다.')) end('disconnect', disconnect); });
      actions.append(logout, disconnect); root.replaceChildren(banner, grid, actions);
    } catch { root.replaceChildren(errorState(load)); }
    finally { root.setAttribute('aria-busy', 'false'); }
  }
  load();
}

function initWrite() {
  const form = $('[data-write-form]');
  if (!form) return;
  const status = $('[data-form-message]');
  const submit = $('button[type=submit]', form);
  async function checkAccess() {
    form.setAttribute('aria-busy', 'true');
    submit.disabled = true;
    try {
      const response = await api('/api/participant/me');
      if (response.status === 401) {
        const gate = node('div', 'empty-state connection-gate');
        gate.append(
          node('b', '', '기록을 쓰려면 참여자 연결이 필요합니다.'),
          node('p', '', 'ChatGPT 로그인 없이 토스 또는 참여 코드로 내 서재를 연결할 수 있습니다.'),
        );
        const link = node('a', 'button accent', '참여자 연결하기');
        link.href = '/maeum-library/connect/';
        gate.append(link);
        form.hidden = true;
        form.before(gate);
        return;
      }
      if (!response.ok) throw new Error('participant');
    } catch {
      message(status, '연결 상태를 확인하지 못했습니다. 입력한 내용은 전송 전까지 서버에 저장되지 않습니다.', true);
    } finally {
      form.setAttribute('aria-busy', 'false');
      if (!form.hidden) submit.disabled = false;
    }
  }
  checkAccess();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('button[type=submit]', form); button.disabled = true;
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await api('/api/participant/entries', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken() }, body: JSON.stringify({ ...values, shareConsent: values.shareConsent === 'yes' }) });
      const data = await json(response);
      if (!response.ok || !data.ok) message(status, data.message || '기록을 저장하지 못했습니다.', true);
      else { form.reset(); message(status, '기록을 저장했습니다. 내 기록에서 공개 상태를 언제든 바꿀 수 있습니다.'); }
    } catch { message(status, '인터넷 연결을 확인한 뒤 다시 시도해 주세요.', true); }
    finally { button.disabled = false; }
  });
}

function initMenu() {
  const button = $('[data-menu-button]'); const menu = $('[data-mobile-menu]');
  if (!button || !menu) return;
  let previousFocus;
  button.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open); button.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('menu-open', open);
    if (open) { previousFocus = document.activeElement; $('a', menu)?.focus(); }
    else if (previousFocus instanceof HTMLElement) previousFocus.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (!menu.classList.contains('is-open')) return;
    if (event.key === 'Escape') { event.preventDefault(); button.click(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...menu.querySelectorAll('a[href], button:not([disabled])')];
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}

initMenu(); initHomeEntries(); initLibrary(); initBookNews(); initConnect(); initApplication(); initMe(); initWrite();
