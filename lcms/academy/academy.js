(() => {
  'use strict';

  const DATA_PATH = './data/courses.json';
  const MEDIA_PATH = './data/media-catalog.json';
  const STORAGE_KEY = 'rsedu-academy-progress:v1';
  const params = new URLSearchParams(window.location.search);
  const pad = (value) => String(value).padStart(2, '0');

  const PHASES = [
    { id: 'foundation', label: 'PART 1', title: '인간이해의 기초', range: '1–4주', summary: '심리학·적성·성격·의사소통의 기본 틀', from: 1, to: 4 },
    { id: 'adaptation', label: 'PART 2', title: '심리측정과 적응', range: '5–8주', summary: '스트레스·학습유형·정서·우울 관련 이해', from: 5, to: 8 },
    { id: 'integration', label: 'PART 3', title: '관계·발달·통합', range: '9–12주', summary: '심리건강·관계·발달·수료시험', from: 9, to: 12 }
  ];

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  async function fetchJson(path, fallback) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('[RS Academy] JSON load failed:', error);
      return fallback;
    }
  }

  async function loadData() {
    const [catalog, mediaCatalog] = await Promise.all([
      fetchJson(DATA_PATH, { courses: [] }),
      fetchJson(MEDIA_PATH, { courses: {}, updatedAt: null })
    ]);
    return { catalog, mediaCatalog };
  }

  function getProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  function normalizeProvider(value = '') {
    const provider = String(value).trim().toUpperCase();
    if (provider === 'VIMEO') return 'vimeo';
    if (provider === 'YOUTUBE_PUBLIC') return 'youtube_public';
    return 'none';
  }

  function mediaFor(mediaCatalog, courseId) {
    const entry = mediaCatalog?.courses?.[courseId];
    const media = Array.isArray(entry?.media) ? entry.media : [];
    return media.map((asset) => ({
      ...asset,
      week: Number(asset.week),
      provider: normalizeProvider(asset.provider),
      status: String(asset.status || '').toLowerCase()
    }));
  }

  function isPlayableMedia(value) {
    if (!value || value.status !== 'published') return false;
    if (value.provider === 'vimeo') return Boolean(value.vimeoVideoId || value.videoId);
    if (value.provider === 'youtube_public') return Boolean(value.youtubeVideoId || value.videoId);
    return false;
  }

  function availableMedia(mediaCatalog, courseId) {
    return mediaFor(mediaCatalog, courseId).filter(isPlayableMedia);
  }

  function phaseForWeek(week = 1) {
    return PHASES.find((phase) => week >= phase.from && week <= phase.to) || PHASES[0];
  }

  function plannedLessons(course) {
    const modules = Array.isArray(course.modules) ? course.modules : [];
    return modules.map((module, index) => {
      const week = typeof module === 'string' ? index + 1 : (module.week || index + 1);
      const phase = phaseForWeek(week);
      if (typeof module === 'string') {
        return {
          id: `module-${pad(week)}`,
          moduleId: `module-${pad(week)}`,
          moduleIndex: index,
          source: 'planned',
          provider: 'none',
          mediaStatus: 'planned',
          week,
          phase,
          title: module,
          theory: module,
          practice: '영상 업로드 후 실습 안내가 연결됩니다.',
          recommendedFor: ''
        };
      }
      const moduleId = module.id || `module-${pad(week)}`;
      return {
        id: moduleId,
        moduleId,
        moduleIndex: index,
        source: 'planned',
        provider: 'none',
        mediaStatus: 'planned',
        week,
        phase,
        title: module.title || `제 ${week}차시`,
        theory: module.theory || '',
        practice: module.practice || '',
        recommendedFor: module.recommendedFor || ''
      };
    });
  }

  function lessonsFor(course, mediaCatalog) {
    const assets = mediaFor(mediaCatalog, course.id);
    return plannedLessons(course).map((module) => {
      const asset = assets.find((item) => item.week === module.week);
      if (!asset) return module;

      const provider = asset.provider;
      const enriched = {
        ...module,
        source: provider,
        provider,
        mediaStatus: asset.status,
        accessPolicy: asset.accessPolicy || '',
        vimeoVideoId: String(asset.vimeoVideoId || asset.videoId || '').trim(),
        vimeoPrivacyHash: String(asset.privacyHash || asset.vimeoPrivacyHash || '').trim(),
        youtubeVideoId: String(asset.youtubeVideoId || (provider === 'youtube_public' ? asset.videoId : '') || '').trim(),
        mediaTitle: asset.title || '',
        description: asset.description || module.theory
      };
      if (asset.title) enriched.title = asset.title;
      return enriched;
    });
  }

  function completedSet(progress, courseId) {
    return new Set(Array.isArray(progress.completed?.[courseId]) ? progress.completed[courseId] : []);
  }

  function isLessonComplete(completed, lesson) {
    return completed.has(lesson.id) || Boolean(lesson.moduleId && completed.has(lesson.moduleId));
  }

  function courseProgress(progress, courseId, lessons) {
    if (!lessons.length) return { completed: 0, total: 0, percent: 0 };
    const completed = completedSet(progress, courseId);
    const count = lessons.filter((lesson) => isLessonComplete(completed, lesson)).length;
    return { completed: count, total: lessons.length, percent: Math.round((count / lessons.length) * 100) };
  }

  function lessonUrl(course, lesson) {
    if (!lesson) return `./course.html?course=${encodeURIComponent(course.id)}`;
    return `./lesson.html?course=${encodeURIComponent(course.id)}&module=${lesson.moduleIndex}`;
  }

  function resumeLesson(course, lessons, progress) {
    const last = progress.lastViewed?.[course.id];
    const completed = completedSet(progress, course.id);
    const viewed = lessons.find((lesson) => lesson.id === last || lesson.moduleId === last);
    if (viewed) return viewed;
    return lessons.find((lesson) => !isLessonComplete(completed, lesson)) || lessons[0] || null;
  }

  function durationLabel(minutes = 0) {
    if (!minutes) return '시간 추후 공개';
    const hours = Math.floor(minutes / 60);
    const remain = minutes % 60;
    if (!hours) return `약 ${remain}분`;
    return remain ? `약 ${hours}시간 ${remain}분` : `약 ${hours}시간`;
  }

  function statusLabel(course, assets) {
    if (assets.length) return `${assets.length}개 Vimeo 영상강의 연결`;
    if (course.status === 'published') return '온라인 과정 공개';
    return `${course.estimatedLessons || course.modules?.length || 0}주 커리큘럼 준비 완료`;
  }

  function progressMarkup(summary) {
    return `<div class="progress-track"><div class="progress-fill" style="width:${summary.percent}%"></div></div>`;
  }

  function buildCourseCard(course, mediaCatalog, progress) {
    const assets = availableMedia(mediaCatalog, course.id);
    const lessons = lessonsFor(course, mediaCatalog);
    const summary = courseProgress(progress, course.id, lessons);
    const resume = resumeLesson(course, lessons, progress);
    const actionLabel = summary.completed > 0 ? '인증 후 학습 이어가기 →' : '수강생 입장 →';
    const actionUrl = summary.completed > 0 ? lessonUrl(course, resume) : './enter.html';

    return `
      <article class="course-card" data-accent="${escapeHtml(course.accent || 'green')}" data-course="lmc">
        <div class="course-cover">
          <span class="course-label">${escapeHtml(course.coverLabel || 'LMC PROFESSIONAL')}</span>
          <div><div class="course-cover-title">${escapeHtml(course.title)}</div><div class="course-cover-subtitle">${escapeHtml(course.englishTitle || '')}</div></div>
        </div>
        <div class="course-card-body">
          <div class="course-meta"><span>${escapeHtml(course.category)}</span><span>${escapeHtml(course.level)}</span><span>${assets.length ? `${assets.length}개 영상 연결` : '12주 커리큘럼'}</span></div>
          <h3>${escapeHtml(course.title)}</h3>
          <p>${escapeHtml(course.subtitle)}</p>
          <div class="lmc-card-credential">${escapeHtml(course.qualificationNumber || '')} · ${escapeHtml(course.qualificationName || '')}</div>
          <div class="lmc-card-facts">
            <div class="lmc-card-fact"><span>Duration</span><strong>${escapeHtml(course.scheduleSummary || '')}</strong></div>
            <div class="lmc-card-fact"><span>Learning</span><strong>${durationLabel(course.estimatedMinutes)}</strong></div>
            <div class="lmc-card-fact"><span>Credential</span><strong>수료시험·발급요건</strong></div>
          </div>
          <div class="lmc-card-progress"><div class="lmc-card-progress-head"><span>이 기기의 학습진도</span><strong>${summary.completed}/${summary.total} · ${summary.percent}%</strong></div>${progressMarkup(summary)}</div>
          <div class="course-card-footer"><span class="course-count">${lessons.length}차시 · ${escapeHtml(statusLabel(course, assets))}</span><a class="course-link" href="${actionUrl}">${actionLabel}</a></div>
        </div>
      </article>`;
  }

  function renderIndex(catalog, mediaCatalog, progress) {
    const courseGrid = document.querySelector('#courseGrid');
    const statusPanel = document.querySelector('#academyStatus');
    const courses = Array.isArray(catalog.courses) ? catalog.courses : [];
    const course = courses[0];
    if (!courseGrid) return;

    courseGrid.innerHTML = courses.length
      ? courses.map((item) => buildCourseCard(item, mediaCatalog, progress)).join('')
      : '<div class="empty-state"><strong>등록된 LMC 과정이 없습니다.</strong><span>과정 데이터를 확인해 주세요.</span></div>';

    if (!course) return;
    const lessons = lessonsFor(course, mediaCatalog);
    const assets = availableMedia(mediaCatalog, course.id);
    const summary = courseProgress(progress, course.id, lessons);
    const resume = resumeLesson(course, lessons, progress);
    const resumeCta = document.querySelector('#academyResumeCta');
    const heroProgress = document.querySelector('#academyHeroProgress');

    if (resumeCta && summary.completed > 0 && resume) {
      resumeCta.hidden = false;
      resumeCta.href = './enter.html';
      resumeCta.textContent = `${resume.week || resume.moduleIndex + 1}주차 인증 후 이어가기`;
    }
    if (heroProgress) {
      heroProgress.classList.add('is-visible');
      heroProgress.textContent = summary.completed > 0
        ? `${summary.completed}개 차시 완료 · 이 기기 진행률 ${summary.percent}%`
        : `${assets.length}개 Vimeo 영상 연결 · 입장코드 인증 후 학습`;
    }

    if (statusPanel) {
      statusPanel.innerHTML = `
        <article class="status-card"><span>LMC Curriculum</span><strong>${lessons.length}개 차시</strong><p>심리학 이론·심리측정 실습·수료시험</p></article>
        <article class="status-card"><span>Protected Media</span><strong>${assets.length}개 연결</strong><p>Vimeo 도메인 제한 재생</p></article>
        <article class="status-card"><span>My Learning</span><strong>${summary.completed}개 완료</strong><p>이 기기 진행률 ${summary.percent}% · 입장 인증 별도</p></article>`;
    }
  }

  function curriculumRow(course, lesson, progress) {
    const completed = completedSet(progress, course.id);
    const done = isLessonComplete(completed, lesson);
    const playable = isPlayableMedia({
      provider: lesson.provider,
      status: lesson.mediaStatus,
      vimeoVideoId: lesson.vimeoVideoId,
      youtubeVideoId: lesson.youtubeVideoId
    });
    const state = done ? '완료' : (playable ? '영상 학습' : '내용 보기');
    return `
      <a class="curriculum-item lmc-curriculum-item${done ? ' is-complete' : ''}" href="${lessonUrl(course, lesson)}">
        <span class="curriculum-number">${done ? '✓' : pad(lesson.week)}</span>
        <span class="lmc-curriculum-main"><strong>${escapeHtml(lesson.title)}</strong><small>${escapeHtml(lesson.theory)}</small></span>
        <span class="lmc-curriculum-practice"><em>${playable ? 'Vimeo Video' : 'Practice'}</em><small>${escapeHtml(lesson.practice)}</small></span>
        <span class="lesson-status">${state}</span>
      </a>`;
  }

  function groupedCurriculum(course, lessons, progress, resume) {
    return `<div class="lmc-phase-list">${PHASES.map((phase, index) => {
      const phaseLessons = lessons.filter((lesson) => lesson.week >= phase.from && lesson.week <= phase.to);
      const open = resume?.phase?.id === phase.id || (!resume && index === 0) ? ' open' : '';
      return `<details class="lmc-phase-card"${open}><summary><span class="lmc-phase-index">${pad(index + 1)}</span><span class="lmc-phase-title"><strong>${escapeHtml(phase.title)}</strong><small>${escapeHtml(phase.range)} · ${escapeHtml(phase.summary)}</small></span></summary><div class="lmc-phase-body">${phaseLessons.map((lesson) => curriculumRow(course, lesson, progress)).join('')}</div></details>`;
    }).join('')}</div>`;
  }

  function renderCourse(catalog, mediaCatalog, progress) {
    const app = document.querySelector('#courseApp');
    if (!app) return;
    const courseId = params.get('course') || catalog.courses?.[0]?.id;
    const course = catalog.courses?.find((item) => item.id === courseId);
    if (!course) {
      app.innerHTML = '<div class="empty-state"><strong>LMC 과정을 찾을 수 없습니다.</strong><a class="secondary-action" href="./index.html">Academy로 돌아가기</a></div>';
      return;
    }

    const assets = availableMedia(mediaCatalog, course.id);
    const lessons = lessonsFor(course, mediaCatalog);
    const summary = courseProgress(progress, course.id, lessons);
    const resume = resumeLesson(course, lessons, progress);
    const delivery = (course.deliveryOptions || []).join(' · ');
    const resumeLabel = summary.completed ? `${resume?.week || 1}주차 학습 이어가기` : '1주차 학습 시작';

    app.innerHTML = `
      <div class="cip-breadcrumb academy-breadcrumb"><a href="./index.html">LMC Academy</a><span>/</span><strong>${escapeHtml(course.title)}</strong></div>
      <nav class="course-quicknav" aria-label="과정 상세 빠른 이동"><a href="#course-overview">과정 개요</a><a href="#curriculum">12주 커리큘럼</a><a href="#benefits">교육 특전</a><a href="#faculty">강사진</a><a href="#qualification">자격 안내</a></nav>
      <section class="course-detail-hero" id="course-overview">
        <article class="course-detail-copy">
          <span class="cip-kicker">${escapeHtml(course.coverLabel || 'LMC Course')}</span>
          <h1>${escapeHtml(course.title)}</h1><div class="subtitle">${escapeHtml(course.englishTitle || '')}</div><p>${escapeHtml(course.description)}</p>
          <div class="course-meta" style="margin-top:22px">${(course.audience || []).map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>
          <div class="lmc-qualification-strip">
            <div class="lmc-qualification-item"><span>Qualification</span><strong>${escapeHtml(course.qualificationNumber)}</strong></div>
            <div class="lmc-qualification-item"><span>Program</span><strong>${escapeHtml(course.scheduleSummary)}</strong></div>
            <div class="lmc-qualification-item"><span>Protected Media</span><strong>${assets.length}개 Vimeo 영상</strong></div>
          </div>
          <div class="lmc-resume-panel"><div><span>Next Learning</span><strong>${escapeHtml(resume?.title || '1주차부터 시작합니다')}</strong></div><a class="primary-action" href="${lessonUrl(course, resume)}">${resumeLabel} →</a></div>
          <div class="course-actions"><a class="secondary-action" href="#curriculum">커리큘럼 먼저 보기</a><a class="secondary-action" href="./index.html">LMC Academy</a></div>
        </article>
        <aside class="course-summary-card"><div class="summary-cap"><span>LMC COURSE PROFILE</span><span>${escapeHtml(course.level)}</span></div><div class="summary-body">
          <div class="summary-row"><span>부여 자격</span><strong>${escapeHtml(course.qualificationName)}</strong></div>
          <div class="summary-row"><span>등록번호</span><strong>${escapeHtml(course.qualificationNumber)}</strong></div>
          <div class="summary-row"><span>강사·운영</span><strong>${escapeHtml(course.instructor)}</strong></div>
          <div class="summary-row"><span>차시</span><strong>${lessons.length}개</strong></div>
          <div class="summary-row"><span>학습시간</span><strong>${durationLabel(course.estimatedMinutes)}</strong></div>
          <div class="summary-row"><span>제공방식</span><strong>${escapeHtml(delivery)}</strong></div>
          <div class="summary-row"><span>영상 상태</span><strong>${escapeHtml(statusLabel(course, assets))}</strong></div>
          <div class="summary-row"><span>내 진도</span><strong>${summary.completed}/${summary.total}</strong></div>
          <div style="margin-top:18px">${progressMarkup(summary)}<div class="progress-copy"><span>진행률</span><span>${summary.percent}%</span></div></div>
        </div></aside>
      </section>
      <section class="course-detail-grid">
        <article class="curriculum-card" id="curriculum"><h2 class="card-title">12주 이론·실습 커리큘럼</h2>${groupedCurriculum(course, lessons, progress, resume)}</article>
        <div class="side-stack">
          <article class="learning-card"><h2 class="card-title">학습 목표</h2><ul class="learning-list">${(course.learningGoals || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article>
          <article class="lmc-side-card" id="benefits"><h2 class="card-title">교육 특전</h2><div class="lmc-benefit-list">${(course.benefits || []).map((item) => `<div class="lmc-benefit-item">${escapeHtml(item)}</div>`).join('')}</div></article>
          <article class="lmc-side-card" id="faculty"><h2 class="card-title">주 강사진</h2><div class="lmc-instructor-list">${(course.instructors || []).map((person) => `<div class="lmc-instructor-item"><div><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.role)}</span><small>${escapeHtml(person.note)}</small></div></div>`).join('')}</div></article>
          <article class="reflection-card"><h2 class="card-title">과정 성찰 질문</h2><ul class="reflection-list">${(course.reflectionQuestions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article>
        </div>
      </section>
      <article class="lmc-full-card" id="qualification"><h2 class="card-title">자격 및 운영 안내</h2><p class="lmc-lesson-copy">${escapeHtml(course.credentialNotice || '')}</p><p class="lmc-lesson-copy" style="margin-top:8px">${escapeHtml(course.cohortNotice || '')}</p><div class="lmc-ethics-note">${escapeHtml(course.ethicsNotice || '')}</div></article>`;
  }

  function lessonListMarkup(course, lessons, progress, activeId) {
    const completed = completedSet(progress, course.id);
    return lessons.map((lesson) => {
      const done = isLessonComplete(completed, lesson);
      const classes = ['lesson-list-item'];
      if (lesson.id === activeId) classes.push('is-active');
      if (done) classes.push('is-complete');
      const playable = isPlayableMedia({ provider: lesson.provider, status: lesson.mediaStatus, vimeoVideoId: lesson.vimeoVideoId, youtubeVideoId: lesson.youtubeVideoId });
      const mediaCopy = playable ? ' · 영상 공개' : '';
      return `<a class="${classes.join(' ')}" href="${lessonUrl(course, lesson)}"><span class="lesson-number">${done ? '✓' : pad(lesson.week)}</span><span><strong>${escapeHtml(lesson.title)}</strong><small>${done ? '학습 완료' : `${lesson.phase.label} · ${lesson.phase.title}${mediaCopy}`}</small></span></a>`;
    }).join('');
  }

  function showStatus(message) {
    let toast = document.querySelector('.academy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'academy-toast';
      Object.assign(toast.style, { position: 'fixed', left: '50%', bottom: '24px', zIndex: '500', transform: 'translateX(-50%)', padding: '11px 15px', borderRadius: '999px', color: '#fff', background: 'rgba(7,28,67,.94)', boxShadow: '0 14px 36px rgba(7,28,67,.28)', fontSize: '12px', fontWeight: '800', transition: 'opacity .2s ease' });
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(showStatus.timer);
    showStatus.timer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
  }

  function vimeoEmbedUrl(active) {
    const id = encodeURIComponent(active.vimeoVideoId);
    const query = new URLSearchParams({ dnt: '1', title: '0', byline: '0', portrait: '0', playsinline: '1', autopause: '1' });
    if (active.vimeoPrivacyHash) query.set('h', active.vimeoPrivacyHash);
    return `https://player.vimeo.com/video/${id}?${query.toString()}`;
  }

  function mediaMarkup(active) {
    const media = {
      provider: active.provider,
      status: active.mediaStatus,
      vimeoVideoId: active.vimeoVideoId,
      youtubeVideoId: active.youtubeVideoId
    };
    if (!isPlayableMedia(media)) {
      return `<div class="video-placeholder"><div class="video-placeholder-card"><span class="video-week-mark">LMC WEEK ${pad(active.week)}</span><strong>${escapeHtml(active.title)}</strong><p>${escapeHtml(active.theory)}</p><span class="video-placeholder-hint">영상 연결 전에도 이론·실습·학습기록을 사용할 수 있습니다.</span></div></div>`;
    }

    if (active.provider === 'vimeo') {
      const title = escapeHtml(`${active.week}주차 ${active.title}`);
      return `<iframe id="vimeoPlayerFrame" class="vimeo-video-frame" src="${escapeHtml(vimeoEmbedUrl(active))}" title="${title}" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    }

    return '<div id="youtubePlayer" style="position:absolute;inset:0"></div>';
  }

  function sourceKicker(active) {
    if (active.provider === 'vimeo' && active.mediaStatus === 'published') return 'LMC Protected Vimeo Lesson';
    if (active.provider === 'youtube_public' && active.mediaStatus === 'published') return 'LMC Public Video Lesson';
    return `LMC Week ${pad(active.week)}`;
  }

  function markLessonComplete(progress, course, active, mediaCatalog, catalog) {
    const set = completedSet(progress, course.id);
    if (isLessonComplete(set, active)) return;
    set.add(active.id);
    progress.completed[course.id] = [...set];
    delete progress.playback[`${course.id}:${active.id}`];
    saveProgress(progress);
    renderLesson(catalog, mediaCatalog, progress);
    showStatus('영상 시청을 완료했습니다.');
  }

  function renderLesson(catalog, mediaCatalog, progress) {
    const app = document.querySelector('#lessonApp');
    if (!app) return;
    const courseId = params.get('course') || catalog.courses?.[0]?.id;
    const course = catalog.courses?.find((item) => item.id === courseId);
    if (!course) {
      app.innerHTML = '<div class="empty-state"><strong>LMC 과정을 찾을 수 없습니다.</strong><a class="secondary-action" href="./index.html">Academy로 돌아가기</a></div>';
      return;
    }

    const lessons = lessonsFor(course, mediaCatalog);
    const requestedVideo = params.get('video');
    const requestedModule = params.has('module') ? Number(params.get('module')) : NaN;
    let activeIndex = requestedVideo
      ? lessons.findIndex((lesson) => lesson.vimeoVideoId === requestedVideo || lesson.youtubeVideoId === requestedVideo || lesson.id === requestedVideo)
      : (Number.isFinite(requestedModule) ? requestedModule : -1);
    if (activeIndex < 0 || activeIndex >= lessons.length) {
      const resume = resumeLesson(course, lessons, progress);
      activeIndex = Math.max(0, lessons.findIndex((lesson) => lesson.id === resume?.id));
    }

    const active = lessons[activeIndex] || lessons[0];
    const previous = lessons[activeIndex - 1] || null;
    const next = lessons[activeIndex + 1] || null;
    const activeId = active.id;
    const noteKey = `${course.id}:${activeId}`;
    const playbackKey = `${course.id}:${activeId}`;
    const savedNote = progress.notes?.[noteKey] || '';
    const summary = courseProgress(progress, course.id, lessons);
    const completed = completedSet(progress, course.id);
    const done = isLessonComplete(completed, active);
    const description = active.description || active.theory || 'LMC 차시 정보를 불러오고 있습니다.';
    const playable = isPlayableMedia({ provider: active.provider, status: active.mediaStatus, vimeoVideoId: active.vimeoVideoId, youtubeVideoId: active.youtubeVideoId });

    progress.lastViewed[course.id] = activeId;
    saveProgress(progress);

    const prevClass = previous ? '' : ' is-disabled';
    const nextClass = next ? '' : ' is-disabled';
    const prevHref = previous ? lessonUrl(course, previous) : '#';
    const nextHref = next ? lessonUrl(course, next) : '#';
    const mediaMeta = active.provider === 'vimeo' ? '<span>Vimeo 도메인 보호 재생</span>' : '';

    app.innerHTML = `
      <div class="cip-breadcrumb academy-breadcrumb"><a href="./index.html">LMC Academy</a><span>/</span><a href="./course.html?course=${encodeURIComponent(course.id)}">${escapeHtml(course.title)}</a><span>/</span><strong>${active.week}주차</strong></div>
      <section class="lesson-layout"><div>
        <div class="lesson-workspace-head"><div class="lesson-context"><span>${active.phase.label}</span><span>${escapeHtml(active.phase.title)}</span><span>${active.week}주차</span></div><div class="lesson-step-count">${activeIndex + 1} / ${lessons.length}</div></div>
        <div class="video-stage${playable ? '' : ' no-video'}"><div class="video-ratio" id="videoRatio">${mediaMarkup(active)}</div></div>
        <div class="lesson-title-row"><span class="cip-kicker">${sourceKicker(active)}</span><h1>${escapeHtml(active.title)}</h1><p>${escapeHtml(description)}</p><div class="course-meta" style="margin-top:16px"><span>${escapeHtml(active.recommendedFor || 'LMC 과정 참여자')}</span>${mediaMeta}</div></div>
        <div class="lesson-content-grid">
          <article class="lesson-content-card lmc-lesson-theory" data-card-index="01"><h2 class="card-title">이론 핵심</h2><p class="lmc-lesson-copy">${escapeHtml(active.theory || description)}</p></article>
          <article class="lesson-content-card lmc-lesson-practice" data-card-index="02"><h2 class="card-title">심리측정 실습</h2><p class="lmc-lesson-copy">${escapeHtml(active.practice || '영상강의의 안내에 따라 실습합니다.')}</p></article>
          <article class="lesson-content-card" data-card-index="03"><h2 class="card-title">오늘의 성찰 질문</h2><ul class="reflection-list">${(course.reflectionQuestions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article>
          <article class="lesson-content-card" data-card-index="04"><h2 class="card-title">나의 한 문장</h2><textarea class="note-field" id="lessonNote" placeholder="오늘 배운 개념이나 상담 장면에 적용할 한 문장을 기록하세요.">${escapeHtml(savedNote)}</textarea><div class="note-save-line"><span>입력 내용은 이 브라우저에 자동 저장됩니다.</span><span class="note-save-status" id="noteSaveStatus">${savedNote ? '저장된 기록' : '기록 전'}</span></div></article>
        </div>
        <div class="lmc-ethics-note">${escapeHtml(course.ethicsNotice || '')}</div>
        <div class="lesson-navigation"><a class="lesson-nav-link prev${prevClass}" href="${prevHref}">← 이전 차시</a><button class="lesson-complete-button${done ? ' is-complete' : ''}" type="button" data-action="toggle-complete">${done ? '✓ 학습 완료됨' : '학습 완료'}</button><a class="lesson-nav-link next${nextClass}" href="${nextHref}">${next ? '다음 차시 →' : '과정 완료'}</a></div>
      </div>
      <aside class="lesson-sidebar" id="lessonSidebar"><div class="lesson-sidebar-head"><h2>12주 전체 차시</h2><button class="lesson-sidebar-toggle" type="button" id="lessonSidebarToggle" aria-expanded="true" aria-controls="lessonList">⌃</button></div><div class="lesson-sidebar-progress">${progressMarkup(summary)}<div class="progress-copy"><span>${summary.completed}개 완료</span><span>${summary.percent}%</span></div></div><div class="lesson-list" id="lessonList">${lessonListMarkup(course, lessons, progress, activeId)}</div><div class="course-actions" style="margin:0 18px 18px"><a class="secondary-action" href="./course.html?course=${encodeURIComponent(course.id)}">과정정보</a></div></aside>
      </section>
      <div class="mobile-learning-bar" aria-label="모바일 학습 이동"><a class="${prevClass}" href="${prevHref}" aria-label="이전 차시">←</a><button class="mobile-complete${done ? ' is-complete' : ''}" type="button" data-action="toggle-complete">${done ? '✓ 완료' : '학습 완료'}</button><a class="${nextClass}" href="${nextHref}" aria-label="다음 차시">→</a></div>`;

    let noteTimer;
    const noteField = document.querySelector('#lessonNote');
    const noteStatus = document.querySelector('#noteSaveStatus');
    const persistNote = () => {
      progress.notes[noteKey] = (noteField?.value || '').trim();
      saveProgress(progress);
      if (noteStatus) { noteStatus.textContent = '자동 저장됨'; noteStatus.classList.add('is-saved'); }
    };
    noteField?.addEventListener('input', () => {
      if (noteStatus) { noteStatus.textContent = '저장 중…'; noteStatus.classList.remove('is-saved'); }
      clearTimeout(noteTimer);
      noteTimer = setTimeout(persistNote, 500);
    });
    noteField?.addEventListener('blur', persistNote);

    document.querySelectorAll('[data-action="toggle-complete"]').forEach((button) => button.addEventListener('click', () => {
      const set = completedSet(progress, course.id);
      if (isLessonComplete(set, active)) {
        set.delete(active.id);
        if (active.moduleId) set.delete(active.moduleId);
      } else {
        set.add(active.id);
      }
      progress.completed[course.id] = [...set];
      saveProgress(progress);
      renderLesson(catalog, mediaCatalog, progress);
      showStatus(isLessonComplete(set, active) ? '학습 완료로 기록했습니다.' : '완료 기록을 취소했습니다.');
    }));

    document.querySelector('#lessonSidebarToggle')?.addEventListener('click', (event) => {
      const sidebar = document.querySelector('#lessonSidebar');
      const collapsed = sidebar?.classList.toggle('is-collapsed');
      event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
      event.currentTarget.textContent = collapsed ? '⌄' : '⌃';
    });

    if (active.provider === 'vimeo' && active.vimeoVideoId && active.mediaStatus === 'published') {
      createVimeoPlayer({
        frameId: 'vimeoPlayerFrame',
        startAt: Number(progress.playback?.[playbackKey] || 0),
        onTime(seconds) {
          progress.playback[playbackKey] = Math.max(0, Math.floor(seconds));
          saveProgress(progress);
        },
        onEnded() { markLessonComplete(progress, course, active, mediaCatalog, catalog); },
        onError() { showStatus('Vimeo 영상 재생 설정을 확인해 주세요.'); }
      });
    } else if (active.provider === 'youtube_public' && active.youtubeVideoId && active.mediaStatus === 'published') {
      createYouTubePlayer(active.youtubeVideoId, () => markLessonComplete(progress, course, active, mediaCatalog, catalog));
    }
  }

  function loadVimeoSdk() {
    if (window.Vimeo?.Player) return Promise.resolve(window.Vimeo);
    if (loadVimeoSdk.promise) return loadVimeoSdk.promise;
    loadVimeoSdk.promise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-vimeo-player-api]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.Vimeo), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://player.vimeo.com/api/player.js';
      script.async = true;
      script.dataset.vimeoPlayerApi = 'true';
      script.addEventListener('load', () => resolve(window.Vimeo), { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });
    return loadVimeoSdk.promise;
  }

  async function createVimeoPlayer({ frameId, startAt, onTime, onEnded, onError }) {
    const frame = document.getElementById(frameId);
    if (!frame) return;
    try {
      await loadVimeoSdk();
      if (!window.Vimeo?.Player || !document.getElementById(frameId)) return;
      const player = new window.Vimeo.Player(frame);
      let lastSavedSecond = -1;
      player.on('timeupdate', (data) => {
        const second = Math.floor(Number(data?.seconds || 0));
        if (second >= 0 && Math.abs(second - lastSavedSecond) >= 5) {
          lastSavedSecond = second;
          onTime?.(second);
        }
      });
      player.on('ended', () => onEnded?.());
      player.on('error', (error) => {
        console.warn('[LMC Academy] Vimeo player error:', error);
        onError?.(error);
      });
      await player.ready();
      if (Number.isFinite(startAt) && startAt > 5) {
        const duration = await player.getDuration().catch(() => 0);
        if (!duration || startAt < duration - 10) await player.setCurrentTime(startAt).catch(() => {});
      }
    } catch (error) {
      console.warn('[LMC Academy] Vimeo SDK load failed:', error);
      onError?.(error);
    }
  }

  function createYouTubePlayer(videoId, onEnded) {
    const container = document.querySelector('#youtubePlayer');
    if (!container || !videoId) return;
    const mount = () => {
      if (!window.YT?.Player || !document.querySelector('#youtubePlayer')) return;
      new window.YT.Player('youtubePlayer', {
        host: 'https://www.youtube-nocookie.com', videoId, width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, enablejsapi: 1, origin: window.location.origin },
        events: { onStateChange(event) { if (event.data === window.YT.PlayerState.ENDED) onEnded?.(); } }
      });
    };
    if (window.YT?.Player) { mount(); return; }
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previousReady?.(); mount(); };
    if (!document.querySelector('script[data-youtube-iframe-api]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.youtubeIframeApi = 'true';
      document.head.appendChild(script);
    }
  }

  function renderAccessFailure(page, message) {
    const target = document.querySelector(page === 'course' ? '#courseApp' : '#lessonApp');
    if (!target) return;
    target.innerHTML = `<section class="access-setup-state"><span>ACADEMY ACCESS</span><strong>강의실 인증을 시작하지 못했습니다.</strong><p>${escapeHtml(message || '입장 페이지에서 다시 로그인해 주세요.')}</p><a href="./enter.html">수강생 입장으로 이동 →</a></section>`;
  }

  async function init() {
    const page = document.body.dataset.academyPage;
    if (page === 'course' || page === 'lesson') {
      if (!window.RSEduAcademyAccess) {
        renderAccessFailure(page, '인증 스크립트가 로드되지 않았습니다.');
        return;
      }
      try {
        const session = await window.RSEduAcademyAccess.guard({ target: document.querySelector(page === 'course' ? '#courseApp' : '#lessonApp') });
        if (!session) return;
      } catch (error) {
        renderAccessFailure(page, error.message);
        return;
      }
    }

    const { catalog, mediaCatalog } = await loadData();
    const progress = getProgress();
    if (page === 'index') renderIndex(catalog, mediaCatalog, progress);
    if (page === 'course') renderCourse(catalog, mediaCatalog, progress);
    if (page === 'lesson') renderLesson(catalog, mediaCatalog, progress);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
