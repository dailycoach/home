(() => {
  'use strict';

  const COURSE_ID = 'lmc-lifetime-management-counselor';
  const MEDIA_PATH = './data/media-catalog.json';
  const PROGRESS_KEY_PREFIX = 'rsedu-academy-progress:v2';
  const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000;
  const CACHE_EXPIRY_SKEW_MS = 60 * 1000;
  const PAGE = document.body?.dataset?.academyPage || '';

  let catalogPromise = null;
  let syncTimer = null;
  let mountedKey = '';
  let inFlightKey = '';
  let failedKey = '';
  let activeVideo = null;
  let activeAsset = null;
  const authorizationCache = new Map();

  function config() { return window.RSEDU_ACADEMY_ACCESS || {}; }
  function playbackWorkerUrl() { return String(config().playbackWorkerUrl || '').trim().replace(/\/+$/, ''); }

  function workerConfigured() {
    try {
      const url = new URL(playbackWorkerUrl());
      return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
    } catch { return false; }
  }

  function loadCatalog() {
    if (!catalogPromise) catalogPromise = fetch(MEDIA_PATH, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error(`R2 media catalog: ${response.status}`);
      return response.json();
    });
    return catalogPromise;
  }

  function courseMedia(catalog) {
    const media = catalog?.courses?.[COURSE_ID]?.media;
    if (!Array.isArray(media)) return [];
    return media.filter((item) => String(item.provider || '').toUpperCase() === 'R2').map((item) => ({
      ...item,
      week: Number(item.week),
      part: Number(item.part),
      status: String(item.status || '').toLowerCase(),
      objectKey: String(item.objectKey || '').trim(),
      partId: String(item.partId || '').trim(),
      mediaId: String(item.mediaId || '').trim()
    })).filter((item) => item.week >= 1 && item.week <= 11 && item.part >= 1 && item.partId);
  }

  function emptyProgress() { return { completed: {}, notes: {}, lastViewed: {}, playback: {}, finalWeeks: {}, updatedAt: null }; }

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
        finalWeeks: parsed.finalWeeks && typeof parsed.finalWeeks === 'object' ? parsed.finalWeeks : {},
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null
      };
    } catch { return emptyProgress(); }
  }

  function saveProgress(progress) {
    const storageKey = progressStorageKey();
    if (!storageKey) return false;
    progress.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey, JSON.stringify(progress));
    return true;
  }

  function clearAuthorizationCache(asset) {
    if (!asset) authorizationCache.clear();
    else authorizationCache.delete(`${asset.mediaId}:${asset.week}:${asset.part}`);
  }

  async function sessionFingerprint(token) {
    const value = String(token || '');
    if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
      return [...new Uint8Array(digest)].slice(0, 12).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return `f${(hash >>> 0).toString(16)}`;
  }

  function cacheEntryIsUsable(entry, fingerprint, session) {
    const usableUntil = Number(entry?.usableUntil || 0);
    const sessionExpiry = new Date(session?.expiresAt || 0).getTime();
    return Boolean(entry?.url && entry.sessionFingerprint === fingerprint && usableUntil > Date.now() + CACHE_EXPIRY_SKEW_MS && sessionExpiry > Date.now());
  }

  function renderPlayerState(message, type = '') {
    const ratio = document.querySelector('#videoRatio');
    if (!ratio) return;
    const signature = `${type}:${message}`;
    if (ratio.dataset.r2State === signature) return;
    ratio.dataset.r2State = signature;
    const guidance = type === 'error' ? '강의실을 새로고침한 뒤에도 계속되면 운영자에게 문의해 주세요.' : '수강권한과 단기 재생주소를 확인하고 있습니다.';
    ratio.innerHTML = `<div class="r2-player-state${type ? ` is-${type}` : ''}" role="status" aria-live="polite"><strong>${message}</strong><span>${guidance}</span></div>`;
  }

  function redirectToEntry() {
    clearAuthorizationCache();
    window.RSEduAcademyAccess?.clearSession?.();
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(window.RSEduAcademyAccess?.entryUrl?.(next) || './enter.html');
  }

  async function authorizePlayback(asset, options = {}) {
    const session = window.RSEduAcademyAccess?.loadSession?.();
    if (!session?.token) { const error = new Error('강의실 로그인 정보가 만료되었습니다.'); error.code = 'SESSION_INVALID'; throw error; }
    if (!workerConfigured()) throw new Error('R2 재생 게이트가 아직 연결되지 않았습니다.');
    const fingerprint = await sessionFingerprint(session.token);
    const cacheKey = `${asset.mediaId}:${asset.week}:${asset.part}`;
    const cached = authorizationCache.get(cacheKey);
    if (!options.forceRefresh && cacheEntryIsUsable(cached, fingerprint, session)) return { ...cached, fromCache: true };
    authorizationCache.delete(cacheKey);

    const response = await fetch(`${playbackWorkerUrl()}/authorize`, {
      method: 'POST', mode: 'cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: session.token, courseId: session.courseId || COURSE_ID, week: asset.week, part: asset.part, userAgent: navigator.userAgent.slice(0, 240) })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.ok || !result?.url) {
      const error = new Error(result?.message || '영상 재생주소를 발급하지 못했습니다.');
      error.status = response.status;
      if (response.status === 401 || response.status === 403) error.code = 'SESSION_INVALID';
      throw error;
    }
    if (Number(result.week) !== asset.week || Number(result.part) !== asset.part || String(result.mediaId || '') !== asset.mediaId) throw new Error('발급된 영상정보가 요청한 파트와 일치하지 않습니다.');
    const playbackUrl = new URL(String(result.url));
    const workerUrl = new URL(playbackWorkerUrl());
    const expectedPath = `/media/${encodeURIComponent(COURSE_ID)}/${asset.week}/${asset.part}`;
    if (playbackUrl.origin !== workerUrl.origin || playbackUrl.pathname !== expectedPath) throw new Error('발급된 영상 재생주소의 경로가 올바르지 않습니다.');
    const issuedAt = Date.now();
    const playbackExpiry = new Date(result.expiresAt || 0).getTime();
    const sessionExpiry = new Date(session.expiresAt || 0).getTime();
    const usableUntil = Math.min(playbackExpiry, sessionExpiry, issuedAt + CACHE_MAX_AGE_MS);
    if (!Number.isFinite(usableUntil) || usableUntil <= issuedAt + CACHE_EXPIRY_SKEW_MS) throw new Error('발급된 영상 재생주소의 유효시간이 너무 짧습니다.');
    const authorization = { url: playbackUrl.href, expiresAt: result.expiresAt, usableUntil, issuedAt, sessionFingerprint: fingerprint };
    authorizationCache.set(cacheKey, authorization);
    return authorization;
  }

  function playbackKey(asset) { return `${COURSE_ID}:${asset.partId}`; }

  function persistPlaybackPosition(video, asset) {
    if (!video || !asset || video.ended) return;
    const progress = loadProgress();
    progress.playback[playbackKey(asset)] = Math.max(0, Math.floor(video.currentTime || 0));
    saveProgress(progress);
  }

  function completePart(asset) {
    document.dispatchEvent(new CustomEvent('rsedu-academy:part-completed', { detail: { partId: asset.partId, mediaId: asset.mediaId } }));
  }

  function handleVideoError(video, asset, authorization, media, forceRefresh) {
    if (video !== activeVideo) return;
    persistPlaybackPosition(video, asset);
    if (!window.RSEduAcademyAccess?.loadSession?.()) { redirectToEntry(); return; }
    const signedUrlExpired = new Date(authorization.expiresAt || 0).getTime() <= Date.now() + 5000;
    if (signedUrlExpired && !forceRefresh) {
      clearAuthorizationCache(asset); mountedKey = ''; failedKey = ''; activeVideo = null; activeAsset = null;
      patchLesson(media, { forceRefresh: true });
      return;
    }
    failedKey = `${asset.mediaId}:${asset.objectKey}`;
    mountedKey = failedKey;
    activeVideo = null;
    activeAsset = null;
    renderPlayerState('영상을 재생하지 못했습니다.', 'error');
  }

  function mountVideo(asset, authorization, media, options = {}) {
    const ratio = document.querySelector('#videoRatio');
    if (!ratio) return;
    ratio.dataset.r2State = '';
    ratio.closest('.video-stage')?.classList.remove('no-video');
    const video = document.createElement('video');
    video.id = 'r2VideoPlayer'; video.className = 'r2-video-player'; video.controls = true; video.playsInline = true; video.preload = 'metadata';
    video.crossOrigin = 'anonymous'; video.controlsList = 'nodownload'; video.referrerPolicy = 'no-referrer';
    video.setAttribute('playsinline', ''); video.setAttribute('controlslist', 'nodownload'); video.src = authorization.url;
    ratio.replaceChildren(video);
    activeVideo = video;
    activeAsset = asset;
    const progress = loadProgress();
    const key = playbackKey(asset);
    const resumeAt = Number(progress.playback?.[key] || 0);
    let lastSavedSecond = -1;
    let completionSent = false;

    video.addEventListener('loadedmetadata', () => {
      if (resumeAt > 0 && Number.isFinite(video.duration) && resumeAt < video.duration - 10) {
        try { video.currentTime = resumeAt; } catch { /* Seek may wait for a playable range. */ }
      }
    }, { once: true });
    video.addEventListener('timeupdate', () => {
      const second = Math.floor(video.currentTime || 0);
      if (second >= 0 && Math.abs(second - lastSavedSecond) >= 5) { lastSavedSecond = second; persistPlaybackPosition(video, asset); }
      if (!completionSent && Number.isFinite(video.duration) && video.duration > 0 && video.currentTime / video.duration >= 0.9) { completionSent = true; completePart(asset); }
    });
    video.addEventListener('pause', () => persistPlaybackPosition(video, asset));
    video.addEventListener('ended', () => { const current = loadProgress(); delete current.playback[key]; saveProgress(current); if (!completionSent) completePart(asset); });
    video.addEventListener('error', () => handleVideoError(video, asset, authorization, media, Boolean(options.forceRefresh)), { once: true });
  }

  function activeSelection() {
    const query = new URLSearchParams(location.search);
    return { week: Number(query.get('week')), part: Number(query.get('part')) };
  }

  async function patchLesson(media, options = {}) {
    if (PAGE !== 'lesson') return;
    const { week, part } = activeSelection();
    if (week < 1 || week > 11 || part < 1 || !document.querySelector('#videoRatio')) return;
    const asset = media.find((item) => item.week === week && item.part === part);
    if (!asset || asset.status !== 'published' || !asset.objectKey) return;
    const mountKey = `${asset.mediaId}:${asset.objectKey}`;
    if (!options.forceRefresh && mountedKey === mountKey && document.querySelector('#r2VideoPlayer')) return;
    if (!options.forceRefresh && (inFlightKey === mountKey || failedKey === mountKey)) return;
    mountedKey = mountKey; inFlightKey = mountKey; failedKey = '';
    activeVideo?.pause?.(); activeVideo = null; activeAsset = null;
    renderPlayerState('비공개 강의 영상을 불러오는 중입니다.');
    try {
      const authorization = await authorizePlayback(asset, options);
      const selected = activeSelection();
      if (mountedKey !== mountKey || selected.week !== week || selected.part !== part || !document.querySelector('#videoRatio')) return;
      mountVideo(asset, authorization, media, options);
    } catch (error) {
      failedKey = mountKey;
      if (error.code === 'SESSION_INVALID') { redirectToEntry(); return; }
      renderPlayerState(error.message || '영상 재생주소를 발급하지 못했습니다.', 'error');
    } finally { if (inFlightKey === mountKey) inFlightKey = ''; }
  }

  async function syncPage() {
    if (PAGE !== 'lesson') return;
    try { await patchLesson(courseMedia(await loadCatalog())); }
    catch { renderPlayerState('영상정보를 불러오지 못했습니다.', 'error'); }
  }

  function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(syncPage, 40); }
  function resetPlayerState() { clearAuthorizationCache(); mountedKey = ''; inFlightKey = ''; failedKey = ''; activeVideo?.pause?.(); activeVideo = null; activeAsset = null; }

  document.addEventListener('DOMContentLoaded', () => {
    if (PAGE !== 'lesson') return;
    scheduleSync();
    new MutationObserver(scheduleSync).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => { if (activeVideo && activeAsset) persistPlaybackPosition(activeVideo, activeAsset); });
  });
  window.addEventListener('rsedu-academy:session-cleared', resetPlayerState);
  window.addEventListener('rsedu-academy:session-changed', () => { resetPlayerState(); scheduleSync(); });
})();
