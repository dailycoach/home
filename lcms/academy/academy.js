(() => {
  'use strict';

  const DATA_PATH = './data/courses.json';
  const MEDIA_PATH = './data/media-catalog.json';
  const LEGACY_PROGRESS_KEY = 'rsedu-academy-progress:v1';
  const PROGRESS_KEY_PREFIX = 'rsedu-academy-progress:v2';
  const PROGRESS_MIGRATION_KEY = 'rsedu-academy-progress:v2:migration';
  const params = new URLSearchParams(window.location.search);
  const pad = (value) => String(value).padStart(2, '0');
  let authenticatedStudentId = '';

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

  function emptyProgress() {
    return { completed: {}, notes: {}, lastViewed: {}, playback: {}, updatedAt: null };
  }

  function normalizeStudentId(value = '') {
    const studentId = String(value).trim();
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/.test(studentId) ? studentId : '';
  }

  function progressStorageKey(studentId = authenticatedStudentId) {
    const normalized = normalizeStudentId(studentId);
    return normalized ? `${PROGRESS_KEY_PREFIX}:${encodeURIComponent(normalized)}` : '';
  }

  function normalizeProgress(value) {
    const parsed = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
      completed: parsed.completed && typeof parsed.completed === 'object' && !Array.isArray(parsed.completed) ? parsed.completed : {},
      notes: parsed.notes && typeof parsed.notes === 'object' && !Array.isArray(parsed.notes) ? parsed.notes : {},
      lastViewed: parsed.lastViewed && typeof parsed.lastViewed === 'object' && !Array.isArray(parsed.lastViewed) ? parsed.lastViewed : {},
      playback: parsed.playback && typeof parsed.playback === 'object' && !Array.isArray(parsed.playback) ? parsed.playback : {},
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null
    };
  }

  function migrateLegacyProgress(studentId) {
    const targetKey = progressStorageKey(studentId);
    if (!targetKey) return;
    try {
      const migration = localStorage.getItem(PROGRESS_MIGRATION_KEY);
      if (migration) {
        localStorage.removeItem(LEGACY_PROGRESS_KEY);
        return;
      }

      const legacy = localStorage.getItem(LEGACY_PROGRESS_KEY);
      let normalizedLegacy = null;
      if (legacy !== null) {
        try {
          normalizedLegacy = normalizeProgress(JSON.parse(legacy));
        } catch {
          normalizedLegacy = emptyProgress();
        }
      }
      // Claim the one-time migration before copying. If storage fills between
      // these writes, losing the legacy copy is safer than assigning it to a
      // different learner on their next login.
      localStorage.setItem(PROGRESS_MIGRATION_KEY, JSON.stringify({
        version: 2,
        studentId: normalizeStudentId(studentId),
        migratedAt: new Date().toISOString()
      }));
      if (legacy !== null && localStorage.getItem(targetKey) === null) {
        localStorage.setItem(targetKey, JSON.stringify(normalizedLegacy));
      }
      localStorage.removeItem(LEGACY_PROGRESS_KEY);
    } catch (error) {
      console.warn('[RS Academy] legacy progress migration skipped:', error);
    }
  }

  function setAuthenticatedStudent(studentId) {
    authenticatedStudentId = normalizeStudentId(studentId);
    if (authenticatedStudentId) migrateLegacyProgress(authenticatedStudentId);
    return authenticatedStudentId;
  }

  function getProgress() {
    const storageKey = progressStorageKey();
    if (!storageKey) return emptyProgress();
    try {
      return normalizeProgress(JSON.parse(localStorage.getItem(storageKey) || '{}'));
    } catch {
      return emptyProgress();
    }
  }

  function saveProgress(progress) {
    const storageKey = progressStorageKey();
    if (!storageKey) return false;
    progress.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey, JSON.stringify(normalizeProgress(progress)));
    return true;
  }

  window.RSEduAcademyProgress = Object.freeze({
    getStudentId: () => authenticatedStudentId,
    load: getProgress,
    save: saveProgress,
    setAuthenticatedStudent,
    storageKey: progressStorageKey
  });

  function normalizeProvider(value = '') {
    const provider = String(value).trim().toUpperCase();
    if (provider === 'R2') return 'r2';
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
    return Boolean(
      value
      && value.provider === 'r2'
      && value.status === 'published'
      && value.objectKey
      && Number(value.week) >= 1
      && Number(value.week) <= 11
    );
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
        status: asset.status,
        mediaStatus: asset.status,
        accessPolicy: asset.accessPolicy || '',
        objectKey: String(asset.objectKey || '').trim(),
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

  function mediaCounts(mediaCatalog, courseId) {
    const slots = mediaFor(mediaCatalog, courseId).filter((asset) => asset.provider === 'r2' && asset.week >= 1 && asset.week <= 11);
    const published = slots.filter(isPlayableMedia).length;
    return { published, total: slots.length };
  }

  function statusLabel(mediaCatalog, courseId) {
    const { published, total } = mediaCounts(mediaCatalog, courseId);
    if (!total) return 'R2 영상 등록 준비';
    return published === total
      ? `${published}개 R2 영상 연결`
      : `${published}/${total}개 R2 영상 연결`;
  }

  function progressMarkup(summary) {
    return `<div class="progress-track"><div class="progress-fill" style="width:${summary.percent}%"></div></div>`;
  }

  function buildCourseCard(course, mediaCatalog, progress, hasStudentSession) {
    const { published, total } = mediaCounts(mediaCatalog, course.id);
    const lessons = lessonsFor(course, mediaCatalog);
    const summary = courseProgress(progress, course.id, lessons);
    const resume = resumeLesson(course, lessons, progress);
    const actionLabel = hasStudentSession && summary.completed > 0 ? '학습 이어가기 →' : '수강생 입장 →';
    const actionUrl = hasStudentSession && summary.completed > 0 ? lessonUrl(course, resume) : './enter.html';
    const progressPanel = hasStudentSession
      ? `<div class="lmc-card-progress"><div class="lmc-card-progress-head"><span>내 학습진도</span><strong>${summary.completed}/${summary.total} · ${summary.percent}%</strong></div>${progressMarkup(summary)}</div>`
      : '<div class="lmc-card-progress"><div class="lmc-card-progress-head"><span>내 학습진도</span><strong>로그인 후 표시</strong></div></div>';

    return `
      <article class="course-card" data-accent="${escapeHtml(course.accent || 'green')}" data-course="lmc">
        <div class="course-cover">
          <span class="course-label">${escapeHtml(course.coverLabel || 'LMC PROFESSIONAL')}</span>
          <div><div class="course-cover-title">${escapeHtml(course.title)}</div><div class="course-cover-subtitle">${escapeHtml(course.englishTitle || '')}</div></div>
        </div>
        <div class="course-card-body">
          <div class="course-meta"><span>${escapeHtml(course.category)}</span><span>${escapeHtml(course.level)}</span><span>${published}/${total || 11}개 R2 영상 연결</span></div>
          <h3>${escapeHtml(course.title)}</h3>
          <p>${escapeHtml(course.subtitle)}</p>
          <div class="lmc-card-credential">${escapeHtml(course.qualificationNumber || '')} · ${escapeHtml(course.qualificationName || '')}</div>
          <div class="lmc-card-facts">
            <div class="lmc-card-fact"><span>Duration</span><strong>${escapeHtml(course.scheduleSummary || '')}</strong></div>
            <div class="lmc-card-fact"><span>Learning</span><strong>${durationLabel(course.estimatedMinutes)}</strong></div>
            <div class="lmc-card-fact"><span>Credential</span><strong>수료시험·발급요건</strong></div>
          </div>
          ${progressPanel}
          <div class="course-card-footer"><span class="course-count">${lessons.length}차시 · ${escapeHtml(statusLabel(mediaCatalog, course.id))}</span><a class="course-link" href="${actionUrl}">${actionLabel}</a></div>
        </div>
      </article>`;
  }

  function renderIndex(catalog, mediaCatalog, progress, hasStudentSession) {
    const courseGrid = document.querySelector('#courseGrid');
    const statusPanel = document.querySelector('#academyStatus');
    const courses = Array.isArray(catalog.courses) ? catalog.courses : [];
    const course = courses[0];
    if (!courseGrid) return;

    courseGrid.innerHTML = courses.length
      ? courses.map((item) => buildCourseCard(item, mediaCatalog, progress, hasStudentSession)).join('')
      : '<div class="empty-state"><strong>등록된 LMC 과정이 없습니다.</strong><span>과정 데이터를 확인해 주세요.</span></div>';

    if (!course) return;
    const lessons = lessonsFor(course, mediaCatalog);
    const media = mediaCounts(mediaCatalog, course.id);
    const summary = courseProgress(progress, course.id, lessons);
    const resume = resumeLesson(course, lessons, progress);
    const resumeCta = document.querySelector('#academyResumeCta');
    const heroProgress = document.querySelector('#academyHeroProgress');

    if (resumeCta && hasStudentSession && summary.completed > 0 && resume) {
      resumeCta.hidden = false;
      resumeCta.href = lessonUrl(course, resume);
      resumeCta.textContent = `${resume.week || resume.moduleIndex + 1}주차 학습 이어가기`;
    }
    if (heroProgress) {
      heroProgress.classList.add('is-visible');
      heroProgress.textContent = hasStudentSession && summary.completed > 0
        ? `${summary.completed}개 차시 완료 · 내 진행률 ${summary.percent}%`
        : `${media.published}/${media.total || 11}개 R2 영상 연결 · 입장코드 인증 후 학습`;
    }

    if (statusPanel) {
      statusPanel.innerHTML = `
        <article class="status-card"><span>LMC Curriculum</span><strong>${lessons.length}개 차시</strong><p>심리학 이론·심리측정 실습·수료시험</p></article>
        <article class="status-card"><span>Protected Media</span><strong>${media.published}/${media.total || 11}개 연결</strong><p>비공개 R2 · 인증된 강의실에서만 재생</p></article>
        <article class="status-card"><span>My Learning</span><strong>${hasStudentSession ? `${summary.completed}개 완료` : '로그인 후 표시'}</strong><p>${hasStudentSession ? `내 진행률 ${summary.percent}% · 수강생별 브라우저 저장` : '현재 수강생 세션이 있을 때만 진도 표시'}</p></article>`;
    }
  }

  function curriculumRow(course, lesson, progress) {
    const completed = completedSet(progress, course.id);
    const done = isLessonComplete(completed, lesson);
    const playable = isPlayableMedia(lesson);
    const isCompletionWeek = lesson.week === 12;
    const state = done ? '완료' : (isCompletionWeek ? '수료 진행' : (playable ? '영상 학습' : '업로드 준비'));
    const typeLabel = isCompletionWeek ? 'Exam · Ceremony' : (playable ? 'R2 Video' : 'Upload Ready');
    return `
      <a class="curriculum-item lmc-curriculum-item${done ? ' is-complete' : ''}" href="${lessonUrl(course, lesson)}">
        <span class="curriculum-number">${done ? '✓' : pad(lesson.week)}</span>
        <span class="lmc-curriculum-main"><strong>${escapeHtml(lesson.title)}</strong><small>${escapeHtml(lesson.theory)}</small></span>
        <span class="lmc-curriculum-practice"><em>${typeLabel}</em><small>${escapeHtml(lesson.practice)}</small></span>
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

    const media = mediaCounts(mediaCatalog, course.id);
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
            <div class="lmc-qualification-item"><span>Protected Media</span><strong>${media.published}/${media.total || 11}개 R2 영상</strong></div>
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
          <div class="summary-row"><span>영상 상태</span><strong>${escapeHtml(statusLabel(mediaCatalog, course.id))}</strong></div>
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
      const playable = isPlayableMedia(lesson);
      const mediaCopy = lesson.week === 12 ? ' · 수료 단계' : (playable ? ' · R2 영상 공개' : ' · 업로드 준비');
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

  function mediaMarkup(active) {
    if (!isPlayableMedia(active)) {
      return `<div class="video-placeholder"><div class="video-placeholder-card"><span class="video-week-mark">LMC WEEK ${pad(active.week)}</span><strong>영상 업로드 준비 중</strong><p>${escapeHtml(active.title)}</p><span class="video-placeholder-hint">R2 업로드와 게시 확인이 완료되면 이 강의실에서 재생됩니다.</span></div></div>`;
    }

    return '<div class="r2-player-state"><strong>비공개 강의 영상을 불러오는 중입니다.</strong><span>수강권한과 단기 재생주소를 확인하고 있습니다.</span></div>';
  }

  function sourceKicker(active) {
    if (active.week === 12) return 'LMC Completion Week';
    if (isPlayableMedia(active)) return 'LMC Protected R2 Lesson';
    return `LMC Week ${pad(active.week)}`;
  }

  function completionAction(url, readyLabel, pendingLabel) {
    try {
      const target = new URL(String(url || '').trim());
      if (target.protocol !== 'https:') throw new Error('Only HTTPS links are allowed');
      return `<a class="completion-action" href="${escapeHtml(target.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(readyLabel)} →</a>`;
    } catch {
      return `<span class="completion-action is-disabled" aria-disabled="true">${escapeHtml(pendingLabel)}</span>`;
    }
  }

  function completionStageMarkup(course, active) {
    const completion = course.completion || {};
    return `
      <section class="completion-stage" aria-labelledby="completion-stage-title">
        <span class="video-week-mark">LMC WEEK ${pad(active.week)}</span>
        <strong id="completion-stage-title">${escapeHtml(active.title)}</strong>
        <p>영상 없이 수료시험, 학기말 수료식, 과정 성찰과 수료 절차를 진행하는 마지막 주차입니다.</p>
        <div class="completion-stage-flow" aria-label="12주차 진행 순서"><span>수료시험</span><span>학기말 수료식</span><span>과정 성찰</span><span>최종 완료</span></div>
        ${completionAction(completion.examUrl, '수료시험 열기', '수료시험 링크 준비 중')}
      </section>`;
  }

  function noteCardMarkup(savedNote, index = '04') {
    return `<article class="lesson-content-card" data-card-index="${index}"><h2 class="card-title">나의 한 문장</h2><textarea class="note-field" id="lessonNote" placeholder="오늘 배운 개념이나 상담 장면에 적용할 한 문장을 기록하세요.">${escapeHtml(savedNote)}</textarea><div class="note-save-line"><span>입력 내용은 이 브라우저에 자동 저장됩니다.</span><span class="note-save-status" id="noteSaveStatus">${savedNote ? '저장된 기록' : '기록 전'}</span></div></article>`;
  }

  function standardLessonCardsMarkup(course, active, description, savedNote) {
    return `
      <article class="lesson-content-card lmc-lesson-theory" data-card-index="01"><h2 class="card-title">이론 핵심</h2><p class="lmc-lesson-copy">${escapeHtml(active.theory || description)}</p></article>
      <article class="lesson-content-card lmc-lesson-practice" data-card-index="02"><h2 class="card-title">심리측정 실습</h2><p class="lmc-lesson-copy">${escapeHtml(active.practice || '영상강의의 안내에 따라 실습합니다.')}</p></article>
      <article class="lesson-content-card" data-card-index="03"><h2 class="card-title">오늘의 성찰 질문</h2><ul class="reflection-list">${(course.reflectionQuestions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article>
      ${noteCardMarkup(savedNote)}`;
  }

  function completionLessonCardsMarkup(course, savedNote) {
    const completion = course.completion || {};
    const questions = Array.isArray(completion.reflectionQuestions) ? completion.reflectionQuestions : [];
    return `
      <article class="lesson-content-card completion-card" data-card-index="01"><span class="completion-card-kicker">Final Exam</span><h2 class="card-title">수료시험 안내</h2><p class="lmc-lesson-copy">${escapeHtml(completion.examNotice || '수료시험 방식과 응시기간은 기수별 운영 공지에서 안내합니다.')}</p>${completionAction(completion.examUrl, '시험 또는 설문 열기', '시험 또는 설문 링크 준비 중')}</article>
      <article class="lesson-content-card completion-card" data-card-index="02"><span class="completion-card-kicker">Ceremony</span><h2 class="card-title">학기말 수료식 안내</h2><p class="lmc-lesson-copy">${escapeHtml(completion.ceremonyNotice || '수료식 일정과 참여방법은 기수별 공지에서 안내합니다.')}</p></article>
      <article class="lesson-content-card completion-card completion-reflection-card" data-card-index="03"><span class="completion-card-kicker">Reflection</span><h2 class="card-title">전체 과정 성찰 질문</h2><ul class="reflection-list">${questions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article>
      <article class="lesson-content-card completion-card" data-card-index="04"><span class="completion-card-kicker">Course Survey</span><h2 class="card-title">과정 만족도 조사</h2><p class="lmc-lesson-copy">12주 과정의 학습경험과 향후 개선을 위한 의견을 남겨 주세요.</p>${completionAction(completion.satisfactionSurveyUrl, '만족도 조사 열기', '만족도 조사 링크 준비 중')}</article>
      <article class="lesson-content-card completion-card" data-card-index="05"><span class="completion-card-kicker">Certificate</span><h2 class="card-title">수료·자격증 발급 안내</h2><p class="lmc-lesson-copy">${escapeHtml(completion.certificateNotice || course.credentialNotice || '')}</p>${completionAction(completion.completionApplicationUrl, '수료 신청 열기', '수료 신청 링크 준비 중')}</article>
      ${noteCardMarkup(savedNote, '06')}`;
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
    const requestedModule = params.has('module') ? Number(params.get('module')) : NaN;
    let activeIndex = Number.isFinite(requestedModule) ? requestedModule : -1;
    if (activeIndex < 0 || activeIndex >= lessons.length) {
      const resume = resumeLesson(course, lessons, progress);
      activeIndex = Math.max(0, lessons.findIndex((lesson) => lesson.id === resume?.id));
    }

    const active = lessons[activeIndex] || lessons[0];
    const previous = lessons[activeIndex - 1] || null;
    const next = lessons[activeIndex + 1] || null;
    const activeId = active.id;
    const noteKey = `${course.id}:${activeId}`;
    const savedNote = progress.notes?.[noteKey] || '';
    const summary = courseProgress(progress, course.id, lessons);
    const completed = completedSet(progress, course.id);
    const done = isLessonComplete(completed, active);
    const description = active.description || active.theory || 'LMC 차시 정보를 불러오고 있습니다.';
    const playable = isPlayableMedia(active);
    const isCompletionWeek = active.week === 12;

    progress.lastViewed[course.id] = activeId;
    saveProgress(progress);

    const prevClass = previous ? '' : ' is-disabled';
    const nextClass = next ? '' : ' is-disabled';
    const prevHref = previous ? lessonUrl(course, previous) : '#';
    const nextHref = next ? lessonUrl(course, next) : '#';
    const mediaMeta = isCompletionWeek
      ? '<span>비영상 수료 주차</span>'
      : `<span>${playable ? 'R2 비공개 스트리밍' : 'R2 영상 업로드 준비'}</span>`;
    const stageMarkup = isCompletionWeek
      ? completionStageMarkup(course, active)
      : `<div class="video-stage${playable ? '' : ' no-video'}"><div class="video-ratio" id="videoRatio">${mediaMarkup(active)}</div></div>`;
    const lessonCards = isCompletionWeek
      ? completionLessonCardsMarkup(course, savedNote)
      : standardLessonCardsMarkup(course, active, description, savedNote);
    const completeLabel = done
      ? (isCompletionWeek ? '✓ 최종 학습 완료됨' : '✓ 학습 완료됨')
      : (isCompletionWeek ? '최종 학습 완료' : '학습 완료');
    const mobileCompleteLabel = done
      ? (isCompletionWeek ? '✓ 최종 완료' : '✓ 완료')
      : (isCompletionWeek ? '최종 학습 완료' : '학습 완료');

    app.innerHTML = `
      <div class="cip-breadcrumb academy-breadcrumb"><a href="./index.html">LMC Academy</a><span>/</span><a href="./course.html?course=${encodeURIComponent(course.id)}">${escapeHtml(course.title)}</a><span>/</span><strong>${active.week}주차</strong></div>
      <section class="lesson-layout"><div>
        <div class="lesson-workspace-head"><div class="lesson-context"><span>${active.phase.label}</span><span>${escapeHtml(active.phase.title)}</span><span>${active.week}주차</span></div><div class="lesson-step-count">${activeIndex + 1} / ${lessons.length}</div></div>
        ${stageMarkup}
        <div class="lesson-title-row"><span class="cip-kicker">${sourceKicker(active)}</span><h1>${escapeHtml(active.title)}</h1><p>${escapeHtml(description)}</p><div class="course-meta" style="margin-top:16px"><span>${escapeHtml(active.recommendedFor || 'LMC 과정 참여자')}</span>${mediaMeta}</div></div>
        <div class="lesson-content-grid${isCompletionWeek ? ' completion-content-grid' : ''}">${lessonCards}</div>
        <div class="lmc-ethics-note">${escapeHtml(course.ethicsNotice || '')}</div>
        <div class="lesson-navigation"><a class="lesson-nav-link prev${prevClass}" href="${prevHref}">← 이전 차시</a><button class="lesson-complete-button${done ? ' is-complete' : ''}" type="button" data-action="toggle-complete">${completeLabel}</button><a class="lesson-nav-link next${nextClass}" href="${nextHref}">${next ? '다음 차시 →' : '과정 완료'}</a></div>
      </div>
      <aside class="lesson-sidebar" id="lessonSidebar"><div class="lesson-sidebar-head"><h2>12주 전체 차시</h2><button class="lesson-sidebar-toggle" type="button" id="lessonSidebarToggle" aria-expanded="true" aria-controls="lessonList">⌃</button></div><div class="lesson-sidebar-progress">${progressMarkup(summary)}<div class="progress-copy"><span>${summary.completed}개 완료</span><span>${summary.percent}%</span></div></div><div class="lesson-list" id="lessonList">${lessonListMarkup(course, lessons, progress, activeId)}</div><div class="course-actions" style="margin:0 18px 18px"><a class="secondary-action" href="./course.html?course=${encodeURIComponent(course.id)}">과정정보</a></div></aside>
      </section>
      <div class="mobile-learning-bar" aria-label="모바일 학습 이동"><a class="${prevClass}" href="${prevHref}" aria-label="이전 차시">←</a><button class="mobile-complete${done ? ' is-complete' : ''}" type="button" data-action="toggle-complete">${mobileCompleteLabel}</button><a class="${nextClass}" href="${nextHref}" aria-label="다음 차시">→</a></div>`;

    let noteTimer;
    const noteField = document.querySelector('#lessonNote');
    const noteStatus = document.querySelector('#noteSaveStatus');
    const persistNote = () => {
      const currentProgress = getProgress();
      currentProgress.notes[noteKey] = (noteField?.value || '').trim();
      saveProgress(currentProgress);
      if (noteStatus) { noteStatus.textContent = '자동 저장됨'; noteStatus.classList.add('is-saved'); }
    };
    noteField?.addEventListener('input', () => {
      if (noteStatus) { noteStatus.textContent = '저장 중…'; noteStatus.classList.remove('is-saved'); }
      clearTimeout(noteTimer);
      noteTimer = setTimeout(persistNote, 500);
    });
    noteField?.addEventListener('blur', persistNote);

    document.querySelectorAll('[data-action="toggle-complete"]').forEach((button) => button.addEventListener('click', () => {
      clearTimeout(noteTimer);
      if (noteField) persistNote();
      const currentProgress = getProgress();
      const set = completedSet(currentProgress, course.id);
      if (isLessonComplete(set, active)) {
        set.delete(active.id);
        if (active.moduleId) set.delete(active.moduleId);
      } else {
        set.add(active.id);
      }
      currentProgress.completed[course.id] = [...set];
      saveProgress(currentProgress);
      renderLesson(catalog, mediaCatalog, currentProgress);
      showStatus(isLessonComplete(set, active) ? '학습 완료로 기록했습니다.' : '완료 기록을 취소했습니다.');
    }));

    document.querySelector('#lessonSidebarToggle')?.addEventListener('click', (event) => {
      const sidebar = document.querySelector('#lessonSidebar');
      const collapsed = sidebar?.classList.toggle('is-collapsed');
      event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
      event.currentTarget.textContent = collapsed ? '⌄' : '⌃';
    });
  }

  function renderAccessFailure(page, message) {
    const target = document.querySelector(page === 'course' ? '#courseApp' : '#lessonApp');
    if (!target) return;
    target.innerHTML = `<section class="access-setup-state"><span>ACADEMY ACCESS</span><strong>강의실 인증을 시작하지 못했습니다.</strong><p>${escapeHtml(message || '입장 페이지에서 다시 로그인해 주세요.')}</p><a href="./enter.html">수강생 입장으로 이동 →</a></section>`;
  }

  async function init() {
    const page = document.body.dataset.academyPage;
    let session = null;
    setAuthenticatedStudent('');
    if (page === 'course' || page === 'lesson') {
      if (!window.RSEduAcademyAccess) {
        renderAccessFailure(page, '인증 스크립트가 로드되지 않았습니다.');
        return;
      }
      try {
        session = await window.RSEduAcademyAccess.guard({ target: document.querySelector(page === 'course' ? '#courseApp' : '#lessonApp') });
        if (!session) return;
      } catch (error) {
        renderAccessFailure(page, error.message);
        return;
      }
    } else if (
      page === 'index'
      && window.RSEduAcademyAccess?.isConfigured?.()
      && window.RSEduAcademyAccess?.loadSession?.()
    ) {
      try {
        session = await window.RSEduAcademyAccess.guard({ redirect: false });
      } catch (error) {
        console.warn('[RS Academy] public progress session ignored:', error);
      }
    }
    setAuthenticatedStudent(session?.studentId || '');

    const { catalog, mediaCatalog } = await loadData();
    const progress = getProgress();
    if (page === 'index') renderIndex(catalog, mediaCatalog, progress, Boolean(session?.studentId));
    if (page === 'course') renderCourse(catalog, mediaCatalog, progress);
    if (page === 'lesson') renderLesson(catalog, mediaCatalog, progress);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
