const API_BASE = 'https://maeum-api.daily-coach-ing.com';
const TOSS_URL = '/maeum-library/toss/';
const requests = new WeakMap();

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

function api(path, options = {}) {
  return fetch(`${API_BASE}${path}`, { credentials: 'include', cache: 'no-store', ...options });
}

function publicApi(path, options = {}) {
  return fetch(`${API_BASE}${path}`, { credentials: 'omit', cache: 'no-store', ...options });
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

function formatDate(value, detailed = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', detailed ? { year: 'numeric', month: 'long', day: 'numeric' } : { month: 'long', day: 'numeric' }).format(date);
}

function setStatus(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle('error', isError);
}

function loadingState(text = '내용을 불러오고 있습니다.') {
  const wrap = node('div', 'loading-state skeleton', text);
  wrap.setAttribute('role', 'status');
  return wrap;
}

function errorState(title, description, retry) {
  const wrap = node('div', 'error-state');
  wrap.setAttribute('role', 'alert');
  wrap.append(node('b', '', title), node('p', '', description));
  if (retry) {
    const button = node('button', 'button ghost', '다시 불러오기');
    button.type = 'button';
    button.addEventListener('click', retry);
    wrap.append(button);
  }
  return wrap;
}

function initMenu() {
  const button = $('[data-menu-button]');
  const menu = $('[data-mobile-menu]');
  if (!button || !menu) return;
  const close = (restore = false) => {
    button.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    if (restore) button.focus();
  };
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    if (open) $('a', menu)?.focus();
  });
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) close(true);
  });
}

function entryCard(entry, { mine = false } = {}) {
  const article = node('article', 'entry-card');
  const meta = node('div', 'entry-meta');
  meta.append(node('span', '', entry.theme || '마음 서가'));
  const book = node('div', 'entry-book');
  book.append(node('b', '', entry.bookTitle || '책 제목 없음'));
  if (entry.bookAuthor) book.append(node('small', '', entry.bookAuthor));
  const quote = node('blockquote', '', `“${entry.quotedLine || ''}”`);
  article.append(meta, book, quote);
  if (entry.reflection) {
    const scene = node('div', 'entry-scene');
    scene.append(node('span', '', '삶의 장면'), node('p', '', entry.reflection));
    article.append(scene);
  }
  if (entry.chosenStep) {
    const step = node('p', 'entry-step');
    step.append(node('span', '', '다음 한 걸음'), document.createTextNode(entry.chosenStep));
    article.append(step);
  }
  const footer = document.createElement('footer');
  const time = node('time', '', formatDate(entry.createdAt));
  const createdAt = new Date(entry.createdAt);
  if (Number.isFinite(createdAt.getTime())) time.dateTime = createdAt.toISOString();
  footer.append(node('span', '', mine ? '내 기록' : entry.displayName || '익명의 마음'), time);
  article.append(footer);
  return article;
}

function publicEntryEmpty(filtered = false) {
  const wrap = node('div', 'empty-state');
  if (filtered) {
    wrap.append(node('b', '', '이 조건에 맞는 문장은 아직 없습니다.'), node('p', '', '검색어나 서가 필터를 바꿔보세요.'));
  } else {
    wrap.append(node('b', '', '이번 주 마음이 멈춘 문장은 무엇인가요?'), node('p', '', '첫 번째 문장이 이 서가에 꽂히기를 기다리고 있습니다.'));
    const link = node('a', 'button accent', '토스에서 첫 문장 남기기');
    link.href = TOSS_URL;
    wrap.append(link);
  }
  return wrap;
}

async function loadEntries(target, params, retry, filtered = false) {
  requests.get(target)?.abort();
  const controller = new AbortController();
  requests.set(target, controller);
  target.setAttribute('aria-busy', 'true');
  target.replaceChildren(loadingState('서가에서 문장을 꺼내고 있습니다.'));
  try {
    const response = await publicApi(`/api/entries?${params.toString()}`, { signal: controller.signal });
    const data = await json(response);
    if (!response.ok || !data.ok || !Array.isArray(data.entries)) throw new Error('entries');
    target.replaceChildren();
    if (!data.entries.length) target.append(publicEntryEmpty(filtered));
    else data.entries.forEach((entry) => target.append(entryCard(entry)));
  } catch (error) {
    if (error?.name !== 'AbortError') target.replaceChildren(errorState('문장을 불러오지 못했습니다.', '잠시 후 다시 시도해 주세요.', retry));
  } finally {
    if (requests.get(target) === controller) {
      requests.delete(target);
      target.setAttribute('aria-busy', 'false');
    }
  }
}

function initHomeEntries() {
  const target = $('[data-home-entries]');
  if (!target) return;
  const run = () => loadEntries(target, new URLSearchParams({ limit: '3' }), run);
  run();
}

function initLibrary() {
  const target = $('[data-library-entries]');
  if (!target) return;
  let theme = '';
  let timer;
  const search = $('[data-library-search]');
  const filters = $$('[data-theme]');
  const run = () => {
    const params = new URLSearchParams({ limit: '60' });
    if (theme) params.set('theme', theme);
    if (search?.value.trim()) params.set('q', search.value.trim());
    loadEntries(target, params, run, Boolean(theme || search?.value.trim()));
  };
  filters.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.classList.contains('is-active')));
    button.addEventListener('click', () => {
      theme = button.dataset.theme || '';
      filters.forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      run();
    });
  });
  search?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 280);
  });
  run();
}

const newsImages = {
  '새 책': '/maeum-library/assets/images/news-books.webp',
  '작가': '/maeum-library/assets/images/news-literature.webp',
  '출판': '/maeum-library/assets/images/news-culture.webp',
  '독서문화': '/maeum-library/assets/images/news-culture.webp',
  '서점·공간': '/maeum-library/assets/images/hero-reading-desk.webp',
};

function newsCard(item, featured = false) {
  const article = node('article', `news-card${featured ? ' featured' : ''}`);
  const anchor = String(item.id || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (anchor) article.id = `news-${anchor}`;
  const imageLink = node('a', 'news-image');
  imageLink.href = item.link;
  imageLink.target = '_blank';
  imageLink.rel = 'noopener noreferrer external';
  imageLink.setAttribute('aria-label', `원문 보기: ${item.title}`);
  const image = new Image();
  image.src = newsImages[item.category] || newsImages['독서문화'];
  image.alt = '';
  image.width = featured ? 960 : 640;
  image.height = featured ? 600 : 420;
  image.loading = featured ? 'eager' : 'lazy';
  image.decoding = 'async';
  imageLink.append(image);
  const body = node('div', 'news-card-body');
  const meta = node('div', 'news-meta');
  meta.append(node('span', '', item.category || '도서뉴스'));
  const time = node('time', '', formatDate(item.publishedAt, true));
  time.dateTime = item.publishedAt || '';
  meta.append(time);
  const heading = node(featured ? 'h2' : 'h3');
  const titleLink = node('a', '', item.title || '도서뉴스');
  titleLink.href = item.link;
  titleLink.target = '_blank';
  titleLink.rel = 'noopener noreferrer external';
  heading.append(titleLink);
  const summary = node('p', 'news-summary', item.summary || '');
  const reason = node('aside', 'news-reason');
  reason.append(node('b', '', '마음서재가 고른 이유'), node('p', '', item.editorialNote || ''));
  const source = node('div', 'news-source');
  source.append(node('span', '', item.source || '출처'));
  const original = node('a', '', '원문 보기 ↗');
  original.href = item.link;
  original.target = '_blank';
  original.rel = 'noopener noreferrer external';
  source.append(original);
  body.append(meta, heading, summary, reason, source);
  article.append(imageLink, body);
  return article;
}

async function fetchNews(limit, signal) {
  const response = await publicApi(`/api/book-news?limit=${Math.max(1, Math.min(limit, 60))}`, { signal });
  const data = await json(response);
  if (!response.ok || !data.ok || data.reviewPolicy !== 'human-approved-only' || !Array.isArray(data.items)) throw new Error('book-news');
  return data.items;
}

function initNews() {
  const target = $('[data-book-news]');
  if (!target) return;
  const compact = target.hasAttribute('data-news-compact');
  const search = $('[data-news-search]');
  const filterWrap = $('[data-news-filters]');
  let items = [];
  let category = '전체';
  const render = () => {
    const query = search?.value.trim().toLowerCase() || '';
    const visible = items.filter((item) => (category === '전체' || item.category === category) && (!query || `${item.title} ${item.summary} ${item.source}`.toLowerCase().includes(query)));
    target.replaceChildren();
    if (!visible.length) {
      target.append(publicEntryEmpty(Boolean(query || category !== '전체')));
      return;
    }
    visible.slice(0, compact ? 5 : 60).forEach((item, index) => target.append(newsCard(item, index === 0)));
  };
  const buildFilters = () => {
    if (!filterWrap) return;
    const categories = ['전체', ...new Set(items.map((item) => item.category).filter(Boolean))];
    filterWrap.replaceChildren(...categories.map((label) => {
      const button = node('button', label === category ? 'is-active' : '', label);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(label === category));
      button.addEventListener('click', () => {
        category = label;
        $$('button', filterWrap).forEach((item) => {
          const active = item === button;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', String(active));
        });
        render();
      });
      return button;
    }));
  };
  const run = async () => {
    requests.get(target)?.abort();
    const controller = new AbortController();
    requests.set(target, controller);
    target.replaceChildren(loadingState('도서뉴스를 불러오고 있습니다.'));
    target.setAttribute('aria-busy', 'true');
    try {
      items = await fetchNews(compact ? 5 : 60, controller.signal);
      buildFilters();
      render();
    } catch (error) {
      if (error?.name !== 'AbortError') target.replaceChildren(errorState('도서뉴스를 불러오지 못했습니다.', '잠시 후 다시 시도해 주세요.', run));
    } finally {
      if (requests.get(target) === controller) {
        requests.delete(target);
        target.setAttribute('aria-busy', 'false');
      }
    }
  };
  search?.addEventListener('input', render);
  run();
}

function initApplication() {
  const form = $('[data-application-form]');
  if (!form) return;
  const status = $('[data-application-status]');
  const submit = $('button[type="submit"]', form);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity() || submit.disabled) return;
    submit.disabled = true;
    submit.textContent = '신청을 접수하고 있습니다…';
    setStatus(status, '');
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await publicApi('/api/applications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await json(response);
      if (!response.ok || !data.ok) throw new Error(data.message || '신청을 접수하지 못했습니다.');
      form.reset();
      form.hidden = true;
      setStatus(status, `마음서재 참여 신청이 접수되었습니다. 내용을 확인한 뒤 참여 안내를 드립니다. 접수번호 ${data.receipt || ''}`);
      status?.focus();
    } catch (error) {
      setStatus(status, error.message || '잠시 후 다시 시도해 주세요.', true);
    } finally {
      submit.disabled = false;
      submit.textContent = '참여 신청하기';
    }
  });
}

async function exchangeTossSession() {
  const status = $('[data-connect-status]');
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const exchangeToken = hash.get('exchange') || '';
  if (!exchangeToken) return;
  history.replaceState(null, '', location.pathname);
  setStatus(status, '토스 연결을 확인하고 있습니다.');
  try {
    const response = await api('/api/participant/toss-exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ exchangeToken }),
    });
    const data = await json(response);
    if (!response.ok || !data.ok) throw new Error(data.message || '토스 연결을 확인하지 못했습니다.');
    location.replace('/maeum-library/me/');
  } catch (error) {
    setStatus(status, error.message || '연결 정보를 다시 확인해 주세요.', true);
  }
}

function visibilityLabel(entry) {
  if (entry.moderationStatus === 'hidden') return '공개 제한';
  return entry.shareConsent === true || entry.shareConsent === 1 || entry.status === 'published' ? '익명 공개' : '비공개';
}

function initMyRecords() {
  const target = $('[data-my-records]');
  if (!target) return;
  const profile = $('[data-member-profile]');
  const status = $('[data-member-status]');
  const actions = $('[data-session-actions]');
  const run = async () => {
    target.replaceChildren(loadingState('내 기록을 불러오고 있습니다.'));
    try {
      const response = await api('/api/participant/me');
      const data = await json(response);
      if (!response.ok || !data.ok) {
        profile?.setAttribute('hidden', '');
        target.replaceChildren();
        const empty = node('div', 'empty-state');
        empty.append(node('b', '', '토스에서 내 기록을 열어주세요.'), node('p', '', '토스 마음서재의 ‘웹 내 기록 열기’를 누르면 별도 회원가입 없이 연결됩니다.'));
        const link = node('a', 'button accent', '연결 방법 보기');
        link.href = '/maeum-library/connect/';
        empty.append(link);
        target.append(empty);
        return;
      }
      if (profile) {
        profile.hidden = false;
        $('[data-member-name]', profile).textContent = `${data.member?.displayName || '참여자'}님의 서재`;
        $('[data-member-cohort]', profile).textContent = data.member?.cohortName || data.member?.cohortId || '';
        $('[data-member-count]', profile).textContent = `${data.entries?.length || 0}개`;
      }
      target.replaceChildren();
      if (!data.entries?.length) {
        const empty = publicEntryEmpty();
        target.append(empty);
      } else {
        data.entries.forEach((entry) => {
          const wrap = node('div', 'my-entry');
          wrap.append(entryCard(entry, { mine: true }));
          const controls = node('div', 'visibility-controls');
          controls.append(node('span', '', visibilityLabel(entry)));
          const button = node('button', '', visibilityLabel(entry) === '익명 공개' ? '비공개로 전환' : '익명으로 공개');
          button.type = 'button';
          button.disabled = entry.moderationStatus === 'hidden';
          button.addEventListener('click', async () => {
            button.disabled = true;
            const shareConsent = visibilityLabel(entry) !== '익명 공개';
            const response = await api('/api/participant/entries/status', {
              method: 'PATCH',
              headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken() },
              body: JSON.stringify({ id: entry.id, shareConsent }),
            });
            const result = await json(response);
            setStatus(status, result.ok ? (shareConsent ? '이름 없이 공개했습니다.' : '비공개로 전환했습니다.') : result.message || '공개 상태를 변경하지 못했습니다.', !result.ok);
            if (result.ok) run(); else button.disabled = false;
          });
          controls.append(button);
          wrap.append(controls);
          target.append(wrap);
        });
      }
      actions?.removeAttribute('hidden');
    } catch {
      target.replaceChildren(errorState('내 기록을 불러오지 못했습니다.', '인터넷 연결을 확인한 뒤 다시 시도해 주세요.', run));
    }
  };
  $$('[data-session-action]').forEach((button) => button.addEventListener('click', async () => {
    const disconnect = button.dataset.sessionAction === 'disconnect';
    if (disconnect && !confirm('이 브라우저와 토스 연결을 모두 해제할까요? 기존 공개 기록은 삭제되지 않습니다.')) return;
    const response = await api(`/api/participant/${disconnect ? 'disconnect' : 'logout'}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrfToken() },
    });
    if (response.ok) location.replace('/maeum-library/connect/');
    else setStatus(status, '연결 종료를 처리하지 못했습니다.', true);
  }));
  run();
}

function gatheringLabel(value) {
  return { recruiting: '모집 중', planning: '일정 조율 중', active: '운영 중', closed: '모집 종료', preparing: '다음 모임 준비 중' }[value] || '다음 모임 준비 중';
}

async function initGathering() {
  const status = $('[data-gathering-status]');
  const name = $('[data-gathering-name]');
  const schedule = $('[data-gathering-schedule]');
  if (!status) return;
  try {
    const response = await publicApi('/api/gathering');
    const data = await json(response);
    if (!response.ok || !data.ok) throw new Error('gathering');
    status.textContent = gatheringLabel(data.gathering?.status);
    if (name) name.textContent = data.gathering?.name || '다음 마음서재 독서모임';
    if (schedule) schedule.textContent = data.gathering?.zoomSchedule || '준비 중';
  } catch {
    status.textContent = '다음 모임 준비 중';
    if (schedule) schedule.textContent = '준비 중';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initMenu();
  initHomeEntries();
  initLibrary();
  initNews();
  initApplication();
  exchangeTossSession();
  initMyRecords();
  initGathering();
});