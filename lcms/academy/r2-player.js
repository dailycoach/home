(() => {
  'use strict';

  const COURSE_ID = 'lmc-lifetime-management-counselor';
  const MEDIA_PATH = './data/media-catalog.json';
  const PROGRESS_KEY = 'rsedu-academy-progress:v1';
  const PAGE = document.body?.dataset?.academyPage || '';
  let catalogPromise = null;
  let syncTimer = null;
  let mountedKey = '';
  let activeVideo = null;

  const pad = (value) => String(value).padStart(2, '0');
  const setText = (node, value) => {
    if (node && node.textContent !== value) node.textContent = value;
  };

  function config() {
    return window.RSEDU_ACADEMY_ACCESS || {};
  }

  function playbackWorkerUrl() {
    return String(config().playbackWorkerUrl || '').trim().replace(/\/+$/, '');
  }

  function workerConfigured() {
    return /^https:\/\/[A-Za-z0-9.-]+(?:\.workers\.dev|\/)/.test(playbackWorkerUrl());
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
    return Array.isArray(catalog?.courses?.[COURSE_ID]?.media)
      ? catalog.courses[COURSE_ID].media
          .filter((item) => String(item.provider || '').toUpperCase() === 'R2')
          .map((item) => ({ ...item, week: Number(item.week), status: String(item.status || '').toLowerCase() }))
      : [];
  }

  function loadProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      return {
        completed: parsed.completed || {},
        notes: parsed.notes || {},
        lastViewed: parsed.lastViewed || {},
        playback: parsed.playback || {},
        updatedAt: parsed.updatedAt || null
      };
    } catch {
      return { completed: {}, notes: {}, lastViewed: {}, playback: {}, updatedAt: null };
    }
  }

  function saveProgress(progress) {
    progress.updatedAt = new Date().toISOString();
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  function statusCopy(published, total) {
    return published === total ? `${published}개 R2 영상 연결` : `${published}/${total}개 R2 영상 연결`;
  }

  function patchOverview(media) {
    const published = media.filter((item) => item.status === 'published' && item.objectKey).length;
    const total = media.length;
    const copy = statusCopy(published, total);

    if (PAGE === 'index') {
      const progress = loadProgress();
      const completed = Array.isArray(progress.completed?.[COURSE_ID]) ? progress.completed[COURSE_ID].length : 0;
      const hero = document.querySelector('#academyHeroProgress');
      if (hero) {
        hero.classList.add('is-visible');
        setText(hero, completed
          ? `${completed}개 차시 완료 · 이 기기 진행률 ${Math.round((completed / 12) * 100)}% · ${copy}`
          : `${copy} · 입장코드 인증 후 학습`);
      }

      setText(document.querySelector('.course-card .course-meta span:last-child'), copy);
      setText(document.querySelector('.course-card .course-count'), `12차시 · ${copy}`);

      const protectedCard = [...document.querySelectorAll('#academyStatus .status-card')]
        .find((card) => /Protected Media|Video|Vimeo|Drive/i.test(card.textContent || ''));
      if (protectedCard) {
        setText(protectedCard.querySelector('strong'), copy);
        setText(protectedCard.querySelector('p'), '비공개 R2 · 인증된 강의실에서만 재생');
      }
    }

    if (PAGE === 'course') {
      const qualification = [...document.querySelectorAll('.lmc-qualification-item')]
        .find((item) => /Protected Media/i.test(item.textContent || ''));
      setText(qualification?.querySelector('strong'), copy);

      [...document.querySelectorAll('.summary-row')].forEach((row) => {
        if (/영상 상태/.test(row.querySelector('span')?.textContent || '')) setText(row.querySelector('strong'), copy);
      });

      [...document.querySelectorAll('.lmc-curriculum-item')].forEach((item, index) => {
        const asset = media.find((entry) => entry.week === index + 1);
        if (!asset) return;
        setText(item.querySelector('.lmc-curriculum-practice em'), asset.status === 'published' ? 'R2 Video' : 'Upload Ready');
        if (!item.classList.contains('is-complete')) {
          setText(item.querySelector('.lesson-status'), asset.status === 'published' ? '영상 학습' : '업로드 준비');
        }
      });
    }
  }

  function activeWeek() {
    const params = new URLSearchParams(location.search);
    if (params.has('module')) {
      const moduleIndex = Number(params.get('module'));
      if (Number.isFinite(moduleIndex) && moduleIndex >= 0) return moduleIndex + 1;
    }
    const context = [...document.querySelectorAll('.lesson-context span')]
      .map((node) => node.textContent || '')
      .find((text) => /\d+주차/.test(text));
    const match = /(\d+)주차/.exec(context || '');
    return match ? Number(match[1]) : 0;
  }

  function renderPlayerState(message, type = '') {
    const ratio = document.querySelector('#videoRatio');
    if (!ratio) return;
    const signature = `${type}:${message}`;
    if (ratio.dataset.r2State === signature) return;
    ratio.dataset.r2State = signature;
    ratio.innerHTML = `<div class="r2-player-state${type ? ` is-${type}` : ''}"><strong>${message}</strong><span>${type === 'error' ? '강의실을 새로고침하거나 운영자에게 문의해 주세요.' : '수강권한과 영상 재생주소를 확인하고 있습니다.'}</span></div>`;
  }

  async function authorizePlayback(asset) {
    const session = window.RSEduAcademyAccess?.loadSession?.();
    if (!session?.token) throw new Error('강의실 로그인 정보가 없습니다.');
    const base = playbackWorkerUrl();
    if (!workerConfigured()) throw new Error('R2 재생 게이트가 아직 연결되지 않았습니다.');

    const response = await fetch(`${base}/authorize`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: session.token,
        courseId: session.courseId || COURSE_ID,
        week: asset.week,
        userAgent: navigator.userAgent.slice(0, 240)
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.ok || !result?.url) throw new Error(result?.message || '영상 재생주소를 발급하지 못했습니다.');
    return result;
  }

  function mountVideo(asset, authorization) {
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
    video.src = authorization.url;
    ratio.replaceChildren(video);
    activeVideo = video;

    setText(document.querySelector('.lesson-title-row .cip-kicker'), 'LMC Protected R2 Lesson');
    const meta = document.querySelector('.lesson-title-row .course-meta');
    if (meta && !/R2 비공개/.test(meta.textContent || '')) {
      const chip = document.createElement('span');
      chip.textContent = 'R2 비공개 스트리밍';
      meta.appendChild(chip);
    }

    const progress = loadProgress();
    const playbackKey = `${COURSE_ID}:module-${pad(asset.week)}`;
    const resumeAt = Number(progress.playback?.[playbackKey] || 0);
    let lastSavedSecond = -1;

    video.addEventListener('loadedmetadata', () => {
      if (resumeAt > 5 && Number.isFinite(video.duration) && resumeAt < video.duration - 10) {
        try { video.currentTime = resumeAt; } catch { /* browser can reject early seeks */ }
      }
    }, { once: true });

    video.addEventListener('timeupdate', () => {
      const second = Math.floor(video.currentTime || 0);
      if (second >= 0 && Math.abs(second - lastSavedSecond) >= 5) {
        lastSavedSecond = second;
        const current = loadProgress();
        current.playback[playbackKey] = second;
        saveProgress(current);
      }
    });

    video.addEventListener('ended', () => {
      const current = loadProgress();
      delete current.playback[playbackKey];
      saveProgress(current);
      const button = document.querySelector('[data-action="toggle-complete"]');
      if (button && !button.classList.contains('is-complete')) button.click();
    });

    video.addEventListener('error', () => renderPlayerState('영상을 재생하지 못했습니다.', 'error'));
  }

  async function patchLesson(media) {
    if (PAGE !== 'lesson') return;
    const week = activeWeek();
    const asset = media.find((item) => item.week === week);
    if (!asset || asset.status !== 'published' || !asset.objectKey) return;

    const ratio = document.querySelector('#videoRatio');
    if (!ratio) return;
    const mountKey = `${week}:${asset.objectKey}`;
    if (mountedKey === mountKey && document.querySelector('#r2VideoPlayer')) return;
    mountedKey = mountKey;
    activeVideo?.pause?.();
    activeVideo = null;
    renderPlayerState('비공개 강의 영상을 불러오는 중입니다.');

    try {
      const authorization = await authorizePlayback(asset);
      if (mountedKey !== mountKey) return;
      mountVideo(asset, authorization);
    } catch (error) {
      console.warn('[LMC Academy] R2 authorization failed:', error);
      renderPlayerState(error.message || '영상 재생주소를 발급하지 못했습니다.', 'error');
    }
  }

  async function syncPage() {
    try {
      const catalog = await loadCatalog();
      const media = courseMedia(catalog);
      patchOverview(media);
      await patchLesson(media);
    } catch (error) {
      console.warn('[LMC Academy] R2 adapter sync failed:', error);
    }
  }

  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncPage, 40);
  }

  document.addEventListener('DOMContentLoaded', () => {
    scheduleSync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
