(() => {
  'use strict';

  const COURSE_ID = 'lmc-lifetime-management-counselor';
  const MEDIA_PATH = './data/media-catalog.json';
  const PROGRESS_KEY_PREFIX = 'rsedu-academy-progress:v2';
  const AUTH_CACHE_KEY = 'rsedu-academy-r2-playback:v1';
  const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000;
  const CACHE_EXPIRY_SKEW_MS = 60 * 1000;
  const PAGE = document.body?.dataset?.academyPage || '';

  let catalogPromise = null;
  let syncTimer = null;
  let mountedKey = '';
  let inFlightKey = '';
  let failedKey = '';
  let activeVideo = null;

  const pad = (value) => String(value).padStart(2, '0');

  function config() {
    return window.RSEDU_ACADEMY_ACCESS || {};
  }

  function playbackWorkerUrl() {
    return String(config().playbackWorkerUrl || '').trim().replace(/\/+$/, '');
  }

  function workerConfigured() {
    try {
      const url = new URL(playbackWorkerUrl());
      return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
    } catch {
      return false;
    }
  }

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch(MEDIA_PATH, { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error(`R2 media catalog: ${response.status}`);
        return response.json();
      });
    }
    return catalogPromise;
  }

  function courseMedia(catalog) {
    const media = catalog?.courses?.[COURSE_ID]?.media;
    if (!Array.isArray(media)) return [];
    return media
      .filter((item) => String(item.provider || '').toUpperCase() === 'R2')
      .map((item) => ({
        ...item,
        week: Number(item.week),
        status: String(item.status || '').toLowerCase(),
        objectKey: String(item.objectKey || '').trim()
      }))
      .filter((item) => item.week >= 1 && item.week <= 11);
  }

  function emptyProgress() {
    return { completed: {}, notes: {}, lastViewed: {}, playback: {}, updatedAt: null };
  }

  function progressStorageKey() {
    const studentId = String(window.RSEduAcademyAccess?.loadSession?.()?.studentId || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/.test(studentId)) return '';
    return `${PROGRESS_KEY_PREFIX}:${encodeURIComponent(studentId)}`;
  }

  function loadProgress() {
    const storageKey = progressStorageKey();
    if (!storageKey) return emptyProgress();
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return {
        completed: parsed.completed && typeof parsed.completed === 'object' ? parsed.completed : {},
        notes: parsed.notes && typeof parsed.notes === 'object' ? parsed.notes : {},
        lastViewed: parsed.lastViewed && typeof parsed.lastViewed === 'object' ? parsed.lastViewed : {},
        playback: parsed.playback && typeof parsed.playback === 'object' ? parsed.playback : {},
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null
      };
    } catch {
      return emptyProgress();
    }
  }

  function saveProgress(progress) {
    const storageKey = progressStorageKey();
    if (!storageKey) return false;
    progress.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey, JSON.stringify(progress));
    return true;
  }

  function loadAuthorizationCache() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(AUTH_CACHE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      try { sessionStorage.removeItem(AUTH_CACHE_KEY); } catch { /* Storage is unavailable. */ }
      return {};
    }
  }

  function saveAuthorizationCache(cache) {
    try {
      sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cache));
    } catch {
      /* Playback still works when private browsing blocks sessionStorage. */
    }
  }

  function clearAuthorizationCache(week) {
    if (!week) {
      try { sessionStorage.removeItem(AUTH_CACHE_KEY); } catch { /* Storage is unavailable. */ }
      return;
    }
    const cache = loadAuthorizationCache();
    delete cache[`${COURSE_ID}:${week}`];
    saveAuthorizationCache(cache);
  }

  async function sessionFingerprint(token) {
    const value = String(token || '');
    if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      return [...new Uint8Array(digest)].slice(0, 12).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `f${(hash >>> 0).toString(16)}`;
  }

  function cacheEntryIsUsable(entry, fingerprint, session) {
    const usableUntil = Number(entry?.usableUntil || 0);
    const sessionExpiry = new Date(session?.expiresAt || 0).getTime();
    return Boolean(
      entry?.url
      && entry.sessionFingerprint === fingerprint
      && usableUntil > Date.now() + CACHE_EXPIRY_SKEW_MS
      && sessionExpiry > Date.now()
    );
  }

  function renderPlayerState(message, type = '') {
    const ratio = document.querySelector('#videoRatio');
    if (!ratio) return;
    const signature = `${type}:${message}`;
    if (ratio.dataset.r2State === signature) return;
    ratio.dataset.r2State = signature;
    const guidance = type === 'error'
      ? '강의실을 새로고침한 뒤에도 계속되면 운영자에게 문의해 주세요.'
      : '수강권한과 단기 재생주소를 확인하고 있습니다.';
    ratio.innerHTML = `<div class="r2-player-state${type ? ` is-${type}` : ''}"><strong>${message}</strong><span>${guidance}</span></div>`;
  }

  function redirectToEntry() {
    clearAuthorizationCache();
    window.RSEduAcademyAccess?.clearSession?.();
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const entry = window.RSEduAcademyAccess?.entryUrl?.(next) || './enter.html';
    window.location.replace(entry);
  }

  async function authorizePlayback(asset, options = {}) {
    const session = window.RSEduAcademyAccess?.loadSession?.();
    if (!session?.token) {
      const error = new Error('강의실 로그인 정보가 만료되었습니다.');
      error.code = 'SESSION_INVALID';
      throw error;
    }
    if (!workerConfigured()) throw new Error('R2 재생 게이트가 아직 연결되지 않았습니다.');

    const fingerprint = await sessionFingerprint(session.token);
    const cacheKey = `${COURSE_ID}:${asset.week}`;
    const cache = loadAuthorizationCache();
    if (!options.forceRefresh && cacheEntryIsUsable(cache[cacheKey], fingerprint, session)) {
      return { ...cache[cacheKey], fromCache: true };
    }

    delete cache[cacheKey];
    saveAuthorizationCache(cache);

    const response = await fetch(`${playbackWorkerUrl()}/authorize`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: session.token,
        courseId: session.courseId || COURSE_ID,
        week: asset.week,
        userAgent: navigator.userAgent.slice(0, 240)
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.ok || !result?.url) {
      const error = new Error(result?.message || '영상 재생주소를 발급하지 못했습니다.');
      error.status = response.status;
      if (response.status === 401 || response.status === 403) error.code = 'SESSION_INVALID';
      throw error;
    }
    if (Number(result.week) !== asset.week) throw new Error('발급된 영상 차시정보가 올바르지 않습니다.');
    const playbackUrl = new URL(String(result.url));
    const workerUrl = new URL(playbackWorkerUrl());
    const expectedPath = `/media/${encodeURIComponent(COURSE_ID)}/${asset.week}`;
    if (playbackUrl.origin !== workerUrl.origin || playbackUrl.pathname !== expectedPath) {
      throw new Error('발급된 영상 재생주소의 경로가 올바르지 않습니다.');
    }

    const issuedAt = Date.now();
    const playbackExpiry = new Date(result.expiresAt || 0).getTime();
    const sessionExpiry = new Date(session.expiresAt || 0).getTime();
    const usableUntil = Math.min(playbackExpiry, sessionExpiry, issuedAt + CACHE_MAX_AGE_MS);
    if (!Number.isFinite(usableUntil) || usableUntil <= issuedAt + CACHE_EXPIRY_SKEW_MS) {
      throw new Error('발급된 영상 재생주소의 유효시간이 너무 짧습니다.');
    }

    const authorization = {
      url: playbackUrl.href,
      expiresAt: result.expiresAt,
      usableUntil,
      issuedAt,
      sessionFingerprint: fingerprint
    };
    cache[cacheKey] = authorization;
    saveAuthorizationCache(cache);
    return authorization;
  }

  function playbackKey(asset) {
    return `${COURSE_ID}:module-${pad(asset.week)}`;
  }

  function persistPlaybackPosition(video, asset) {
    if (!video || video.ended) return;
    const second = Math.max(0, Math.floor(video.currentTime || 0));
    const progress = loadProgress();
    progress.playback[playbackKey(asset)] = second;
    saveProgress(progress);
  }

  function handleVideoError(video, asset, authorization, media, forceRefresh) {
    if (video !== activeVideo) return;
    const session = window.RSEduAcademyAccess?.loadSession?.();
    if (!session) {
      redirectToEntry();
      return;
    }

    const signedUrlExpired = new Date(authorization.expiresAt || 0).getTime() <= Date.now() + 5000;
    if (signedUrlExpired && !forceRefresh) {
      clearAuthorizationCache(asset.week);
      mountedKey = '';
      failedKey = '';
      activeVideo = null;
      patchLesson(media, { forceRefresh: true });
      return;
    }
    const mountKey = `${asset.week}:${asset.objectKey}`;
    failedKey = mountKey;
    mountedKey = mountKey;
    activeVideo = null;
    renderPlayerState('영상을 재생하지 못했습니다.', 'error');
  }

  function mountVideo(asset, authorization, media, options = {}) {
    const ratio = document.querySelector('#videoRatio');
    if (!ratio) return;
    ratio.dataset.r2State = '';
    ratio.closest('.video-stage')?.classList.remove('no-video');

    const video = document.createElement('video');
    video.id = 'r2VideoPlayer';
    video.className = 'r2-video-player';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.controlsList = 'nodownload noremoteplayback';
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.referrerPolicy = 'no-referrer';
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('controlslist', 'nodownload noremoteplayback');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('disableremoteplayback', '');
    video.src = authorization.url;
    ratio.replaceChildren(video);
    activeVideo = video;

    const progress = loadProgress();
    const key = playbackKey(asset);
    const resumeAt = Number(progress.playback?.[key] || 0);
    let lastSavedSecond = -1;

    video.addEventListener('loadedmetadata', () => {
      if (resumeAt > 0 && Number.isFinite(video.duration) && resumeAt < video.duration - 10) {
        try { video.currentTime = resumeAt; } catch { /* Some browsers reject a seek before ranges are ready. */ }
      }
    }, { once: true });

    video.addEventListener('timeupdate', () => {
      const second = Math.floor(video.currentTime || 0);
      if (second >= 0 && Math.abs(second - lastSavedSecond) >= 5) {
        lastSavedSecond = second;
        persistPlaybackPosition(video, asset);
      }
    });
    video.addEventListener('pause', () => persistPlaybackPosition(video, asset));

    video.addEventListener('ended', () => {
      const current = loadProgress();
      delete current.playback[key];
      saveProgress(current);
      const button = document.querySelector('[data-action="toggle-complete"]');
      if (button && !button.classList.contains('is-complete')) button.click();
    });

    video.addEventListener('error', () => {
      handleVideoError(video, asset, authorization, media, Boolean(options.forceRefresh));
    }, { once: true });
  }

  function activeWeek() {
    const params = new URLSearchParams(location.search);
    if (params.has('module')) {
      const moduleIndex = Number(params.get('module'));
      if (Number.isInteger(moduleIndex) && moduleIndex >= 0 && moduleIndex <= 11) return moduleIndex + 1;
    }
    const context = [...document.querySelectorAll('.lesson-context span')]
      .map((node) => node.textContent || '')
      .find((text) => /\d+주차/.test(text));
    const match = /(\d+)주차/.exec(context || '');
    return match ? Number(match[1]) : 0;
  }

  async function patchLesson(media, options = {}) {
    if (PAGE !== 'lesson') return;
    const week = activeWeek();
    if (week < 1 || week > 11 || !document.querySelector('#videoRatio')) return;

    const asset = media.find((item) => item.week === week);
    if (!asset || asset.status !== 'published' || !asset.objectKey) return;

    const mountKey = `${week}:${asset.objectKey}`;
    if (!options.forceRefresh && mountedKey === mountKey && document.querySelector('#r2VideoPlayer')) return;
    if (!options.forceRefresh && (inFlightKey === mountKey || failedKey === mountKey)) return;

    mountedKey = mountKey;
    inFlightKey = mountKey;
    failedKey = '';
    activeVideo?.pause?.();
    activeVideo = null;
    renderPlayerState('비공개 강의 영상을 불러오는 중입니다.');

    try {
      const authorization = await authorizePlayback(asset, options);
      if (mountedKey !== mountKey || activeWeek() !== week || !document.querySelector('#videoRatio')) return;
      mountVideo(asset, authorization, media, options);
    } catch (error) {
      console.warn('[LMC Academy] R2 authorization failed:', error);
      failedKey = mountKey;
      if (error.code === 'SESSION_INVALID') {
        redirectToEntry();
        return;
      }
      renderPlayerState(error.message || '영상 재생주소를 발급하지 못했습니다.', 'error');
    } finally {
      if (inFlightKey === mountKey) inFlightKey = '';
    }
  }

  async function syncPage() {
    if (PAGE !== 'lesson') return;
    try {
      const catalog = await loadCatalog();
      await patchLesson(courseMedia(catalog));
    } catch (error) {
      console.warn('[LMC Academy] R2 adapter sync failed:', error);
      renderPlayerState('영상정보를 불러오지 못했습니다.', 'error');
    }
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncPage, 40);
  }

  function resetPlayerState() {
    clearAuthorizationCache();
    mountedKey = '';
    inFlightKey = '';
    failedKey = '';
    activeVideo?.pause?.();
    activeVideo = null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (PAGE !== 'lesson') return;
    scheduleSync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => {
      const week = activeWeek();
      const asset = week >= 1 && week <= 11 ? { week } : null;
      if (activeVideo && asset) persistPlaybackPosition(activeVideo, asset);
    });
  });

  window.addEventListener('rsedu-academy:session-cleared', resetPlayerState);
  window.addEventListener('rsedu-academy:session-changed', () => {
    resetPlayerState();
    failedKey = '';
    scheduleSync();
  });
})();
