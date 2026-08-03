(() => {
  'use strict';

  const DATA_PATH = './data/courses.json';
  const MEDIA_PATH = './data/media-catalog.json';
  const LEGACY_PROGRESS_KEY = 'rsedu-academy-progress:v1';
  const PROGRESS_KEY_PREFIX = 'rsedu-academy-progress:v2';
  const PROGRESS_MIGRATION_KEY = 'rsedu-academy-progress:v2:migration';
  const COURSE_ID = 'lmc-lifetime-management-counselor';
  const params = new URLSearchParams(window.location.search);
  const pad = (value) => String(value).padStart(2, '0');
  let authenticatedStudentId = '';

  const PHASES = [
    { id: 'foundation', label: 'PART 1', title: '인간이해의 기초', range: '1–4주', summary: '자기·적성·성격·의사소통', from: 1, to: 4 },
    { id: 'adaptation', label: 'PART 2', title: '심리측정과 적응', range: '5–8주', summary: '스트레스·학습·정서·행복지수', from: 5, to: 8 },
    { id: 'integration', label: 'PART 3', title: '관계·발달·통합', range: '9–12주', summary: '심리건강·관계·발달·수료', from: 9, to: 12 }
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
    return { completed: {}, notes: {}, lastViewed: {}, playback: {}, finalWeeks: {}, updatedAt: null };
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
      finalWeeks: parsed.finalWeeks && typeof parsed.finalWeeks === 'object' && !Array.isArray(parsed.finalWeeks) ? parsed.finalWeeks : {},
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null
    };
  }

  function migrateLegacyProgress(studentId) {
    const targetKey = progressStorageKey(studentId);
    if (!targetKey) return;
    try {
      if (localStorage.getItem(PROGRESS_MIGRATION_KEY)) {
        localStorage.removeItem(LEGACY_PROGRESS_KEY);
        return;
      }
      const legacy = localStorage.getItem(LEGACY_PROGRESS_KEY);
      const normalizedLegacy = legacy === null ? null : normalizeProgress(JSON.parse(legacy || '{}'));
      localStorage.setItem(PROGRESS_MIGRATION_KEY, JSON.stringify({ version: 2, studentId: normalizeStudentId(studentId), migratedAt: new Date().toISOString() }));
      if (normalizedLegacy && localStorage.getItem(targetKey) === null) localStorage.setItem(targetKey, JSON.stringify(normalizedLegacy));
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
    try { return normalizeProgress(JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch { return emptyProgress(); }
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

  function phaseForWeek(week = 1) {
    return PHASES.find((phase) => week >= phase.from && week <= phase.to) || PHASES[0];
  }

  function mediaFor(mediaCatalog, courseId) {
    const media = mediaCatalog?.courses?.[courseId]?.media;
    if (!Array.isArray(media)) return [];
    return media.map((asset) => ({
      ...asset,
      week: Number(asset.week),
      part: Number(asset.part),
      provider: String(asset.provider || '').trim().toLowerCase(),
      status: String(asset.status || '').trim().toLowerCase(),
      objectKey: String(asset.objectKey || '').trim()
    }));
  }

  function courseWeeks(course, mediaCatalog) {
    const media = mediaFor(mediaCatalog, course.id);
    const weeks = Array.isArray(course.weeks) ? course.weeks : [];
    return weeks.map((week) => ({
      ...week,
      week: Number(week.week),
      phase: phaseForWeek(Number(week.week)),
      parts: (Array.isArray(week.parts) ? week.parts : []).map((part) => {
        const asset = media.find((item) => item.mediaId === part.mediaId || item.partId === part.id);
        return {
          ...part,
          ...(asset || {}),
          week: Number(week.week),
          part: Number(part.part),
          phase: phaseForWeek(Number(week.week)),
          weekId: week.id,
          weekTitle: week.title,
          theory: week.theory || '',
          practice: week.practice || '',
          recommendedFor: week.recommendedFor || '',
          safetyNotice: Boolean(week.safetyNotice)
        };
      })
    }));
  }

  function allVideoParts(weeks) {
    return weeks.filter((week) => week.week <= 11).flatMap((week) => week.parts);
  }

  function isPlayableMedia(part) {
    return Boolean(part && part.provider === 'r2' && part.status === 'published' && part.objectKey && part.week >= 1 && part.week <= 11 && part.part >= 1);
  }

  function completedSet(progress, courseId) {
    return new Set(Array.isArray(progress.completed?.[courseId]) ? progress.completed[courseId] : []);
  }

  function isPartComplete(completed, part) {
    return Boolean(part?.id && completed.has(part.id));
  }

  function progressSummary(progress, courseId, parts) {
    const completed = completedSet(progress, courseId);
    const count = parts.filter((part) => isPartComplete(completed, part)).length;
    const total = parts.length;
    return { completed: count, total, percent: total ? Math.round((count / total) * 100) : 0 };
  }

  function weekSummary(progress, courseId, week) {
    return progressSummary(progress, courseId, week.parts || []);
  }

  function durationLabel(totalSeconds = 0, approximate = false) {
    const seconds = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remain = seconds % 60;
    const prefix = approximate ? '약 ' : '';
    if (hours) return `${prefix}${hours}시간${minutes ? ` ${minutes}분` : ''}`;
    if (minutes) return `${prefix}${minutes}분${remain ? ` ${remain}초` : ''}`;
    return `${remain}초`;
  }

  function resumePosition(progress, part) {
    return Math.max(0, Number(progress.playback?.[`${COURSE_ID}:${part.id}`] || 0));
  }

  function partUrl(course, part) {
    if (!part) return `./course.html?course=${encodeURIComponent(course.id)}`;
    if (part.week === 12) return `./lesson.html?course=${encodeURIComponent(course.id)}&week=12`;
    return `./lesson.html?course=${encodeURIComponent(course.id)}&week=${part.week}&part=${part.part}`;
  }

  function releaseState(course, week, progress, weeks) {
    if (week.week === 12) return { allowed: true, label: '수료 진행' };
    const mode = course.releasePolicy?.mode || 'all_open';
    if (mode === 'all_open') return { allowed: true, label: '학습 가능' };
    if (mode === 'sequential' && week.week > 1) {
      const previous = weeks.find((item) => item.week === week.week - 1);
      const previousSummary = previous ? weekSummary(progress, course.id, previous) : { percent: 0 };
      return previousSummary.percent === 100 ? { allowed: true, label: '학습 가능' } : { allowed: false, label: '접근 제한' };
    }
    if (mode === 'scheduled') {
      const date = course.releasePolicy?.scheduledDates?.[week.id];
      if (!date) return { allowed: false, label: '공개 준비 중' };
      return Date.now() >= new Date(date).getTime() ? { allowed: true, label: '학습 가능' } : { allowed: false, label: '공개 준비 중' };
    }
    return { allowed: true, label: '학습 가능' };
  }

  function resumePart(course, weeks, progress) {
    const parts = allVideoParts(weeks);
    const last = progress.lastViewed?.[course.id];
    const viewed = parts.find((part) => part.id === last);
    if (viewed) return viewed;
    const completed = completedSet(progress, course.id);
    return parts.find((part) => !isPartComplete(completed, part)) || parts[0] || { week: 12, id: 'week-12' };
  }

  function mediaCounts(mediaCatalog, courseId) {
    const media = mediaFor(mediaCatalog, courseId).filter((asset) => asset.week >= 1 && asset.week <= 11);
    return { published: media.filter(isPlayableMedia).length, total: media.length };
  }

  function progressMarkup(summary, label = '학습 진행률') {
    return `<div class="progress-track" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${summary.percent}"><div class="progress-fill" style="width:${summary.percent}%"></div></div>`;
  }

  function buildCourseCard(course, mediaCatalog, progress, hasStudentSession) {
    const weeks = courseWeeks(course, mediaCatalog);
    const parts = allVideoParts(weeks);
    const summary = progressSummary(progress, course.id, parts);
    const media = mediaCounts(mediaCatalog, course.id);
    const resume = resumePart(course, weeks, progress);
    const actionUrl = hasStudentSession ? partUrl(course, resume) : './enter.html';
    const progressPanel = hasStudentSession
      ? `<div class="lmc-card-progress"><div class="lmc-card-progress-head"><span>내 영상진도</span><strong>${summary.completed}/${summary.total} · ${summary.percent}%</strong></div>${progressMarkup(summary)}</div>`
      : '<div class="lmc-card-progress"><div class="lmc-card-progress-head"><span>내 영상진도</span><strong>로그인 후 표시</strong></div></div>';
    return `<article class="course-card" data-accent="${escapeHtml(course.accent || 'green')}" data-course="lmc">
      <div class="course-cover"><span class="course-label">${escapeHtml(course.coverLabel || 'LMC PROFESSIONAL')}</span><div><div class="course-cover-title">${escapeHtml(course.title)}</div><div class="course-cover-subtitle">${escapeHtml(course.englishTitle || '')}</div></div></div>
      <div class="course-card-body"><div class="course-meta"><span>12주</span><span>77개 파트</span><span>${media.published}/${media.total}개 공개</span></div><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.subtitle)}</p>
      <div class="lmc-card-credential">${escapeHtml(course.qualificationNumber || '')} · ${escapeHtml(course.qualificationName || '')}</div>
      <div class="lmc-card-facts"><div class="lmc-card-fact"><span>Official</span><strong>총 24시간</strong></div><div class="lmc-card-fact"><span>Video</span><strong>${durationLabel(course.videoDurationSeconds, true)}</strong></div><div class="lmc-card-fact"><span>Includes</span><strong>실습·성찰·수료시험</strong></div></div>
      ${progressPanel}<div class="course-card-footer"><span class="course-count">77개 파트 · 업로드 대기 ${media.total - media.published}개</span><a class="course-link" href="${actionUrl}">${hasStudentSession ? '학습 이어가기 →' : '수강생 입장 →'}</a></div></div></article>`;
  }

  function renderIndex(catalog, mediaCatalog, progress, hasStudentSession) {
    const courseGrid = document.querySelector('#courseGrid');
    const statusPanel = document.querySelector('#academyStatus');
    const course = catalog.courses?.[0];
    if (!courseGrid) return;
    courseGrid.innerHTML = course ? buildCourseCard(course, mediaCatalog, progress, hasStudentSession) : '<div class="empty-state"><strong>등록된 LMC 과정이 없습니다.</strong></div>';
    if (!course) return;
    const weeks = courseWeeks(course, mediaCatalog);
    const parts = allVideoParts(weeks);
    const media = mediaCounts(mediaCatalog, course.id);
    const summary = progressSummary(progress, course.id, parts);
    const resume = resumePart(course, weeks, progress);
    const resumeCta = document.querySelector('#academyResumeCta');
    const heroProgress = document.querySelector('#academyHeroProgress');
    if (resumeCta && hasStudentSession) {
      resumeCta.hidden = false;
      resumeCta.href = partUrl(course, resume);
      resumeCta.textContent = `${resume.week}주차 ${resume.part || ''}파트 이어가기`.replace('  ', ' ');
    }
    if (heroProgress) {
      heroProgress.classList.add('is-visible');
      heroProgress.textContent = hasStudentSession ? `${summary.completed}/77개 파트 완료 · ${summary.percent}%` : '입장코드 인증 후 수강생별 진도 표시';
    }
    if (statusPanel) statusPanel.innerHTML = `
      <article class="status-card"><span>Official Curriculum</span><strong>12주 · 총 24시간</strong><p>영상·실습·성찰·수료시험 포함</p></article>
      <article class="status-card"><span>Segmented Learning</span><strong>77개 · ${durationLabel(course.videoDurationSeconds, true)}</strong><p>10~26분 파트형 온라인 학습</p></article>
      <article class="status-card"><span>Protected Media</span><strong>${media.published}/${media.total}개 공개</strong><p>비공개 R2 · 인증된 강의실에서만 재생</p></article>`;
  }

  function partRow(course, part, progress, active = false) {
    const completed = completedSet(progress, course.id);
    const done = isPartComplete(completed, part);
    const position = resumePosition(progress, part);
    const status = done ? '완료' : (isPlayableMedia(part) ? '학습하기' : '업로드 준비');
    const resume = !done && position > 0 ? `<small>${durationLabel(position)}부터 이어보기</small>` : '';
    return `<a class="lmc-part-row${active ? ' is-active' : ''}${done ? ' is-complete' : ''}" href="${partUrl(course, part)}"${active ? ' aria-current="page"' : ''}>
      <span class="lmc-part-number">${done ? '✓' : `P${pad(part.part)}`}</span><span class="lmc-part-copy"><strong>${escapeHtml(part.title)}</strong><small>${durationLabel(part.durationSeconds)}</small>${resume}</span><span class="lesson-status">${status}</span></a>`;
  }

  function weekCard(course, week, progress, weeks, resume) {
    const summary = weekSummary(progress, course.id, week);
    const release = releaseState(course, week, progress, weeks);
    const isFinal = week.week === 12;
    const open = resume?.week === week.week || week.week === 1 ? ' open' : '';
    const state = isFinal ? '수료 진행' : (summary.percent === 100 ? '완료' : (summary.completed ? '학습 중' : release.label));
    const body = isFinal
      ? `<a class="lmc-final-week-link" href="${partUrl(course, { week: 12 })}"><span>LMC FINAL WEEK</span><strong>수료시험·과정 통합·학기말 수료식</strong><small>영상 없음 · 운영 안내 후 진행</small></a>`
      : week.parts.map((part) => partRow(course, part, progress)).join('');
    return `<details class="lmc-week-card"${open}><summary><span class="lmc-week-index">WEEK ${pad(week.week)}</span><span class="lmc-week-title"><strong>${escapeHtml(week.title)}</strong><small>${isFinal ? '영상 없음' : `${week.parts.length}개 파트 · ${durationLabel(week.videoSeconds)}`}</small></span><span class="lmc-week-state"><strong>${state}</strong><small>${isFinal ? '운영자 확인' : `완료 ${summary.completed}/${summary.total} · ${summary.percent}%`}</small></span></summary><div class="lmc-week-progress">${isFinal ? '' : progressMarkup(summary, `${week.week}주차 진행률`)}</div><div class="lmc-week-body">${body}</div></details>`;
  }

  function groupedCurriculum(course, weeks, progress, resume) {
    return `<div class="lmc-phase-list">${PHASES.map((phase, index) => {
      const phaseWeeks = weeks.filter((week) => week.week >= phase.from && week.week <= phase.to);
      const open = resume?.phase?.id === phase.id || (!resume && index === 0) ? ' open' : '';
      return `<details class="lmc-phase-card"${open}><summary><span class="lmc-phase-index">${pad(index + 1)}</span><span class="lmc-phase-title"><strong>${escapeHtml(phase.title)}</strong><small>${escapeHtml(phase.range)} · ${escapeHtml(phase.summary)}</small></span></summary><div class="lmc-phase-body lmc-week-list">${phaseWeeks.map((week) => weekCard(course, week, progress, weeks, resume)).join('')}</div></details>`;
    }).join('')}</div>`;
  }

  function renderCourse(catalog, mediaCatalog, progress) {
    const app = document.querySelector('#courseApp');
    if (!app) return;
    const course = catalog.courses?.find((item) => item.id === (params.get('course') || COURSE_ID));
    if (!course) { app.innerHTML = '<div class="empty-state"><strong>LMC 과정을 찾을 수 없습니다.</strong></div>'; return; }
    const weeks = courseWeeks(course, mediaCatalog);
    const parts = allVideoParts(weeks);
    const summary = progressSummary(progress, course.id, parts);
    const media = mediaCounts(mediaCatalog, course.id);
    const resume = resumePart(course, weeks, progress);
    app.innerHTML = `<div class="cip-breadcrumb academy-breadcrumb"><a href="./index.html">LMC Academy</a><span>/</span><strong>${escapeHtml(course.title)}</strong></div>
      <nav class="course-quicknav" aria-label="과정 상세 빠른 이동"><a href="#course-overview">과정 개요</a><a href="#curriculum">12주 커리큘럼</a><a href="#benefits">교육 특전</a><a href="#faculty">강사진</a><a href="#qualification">자격 안내</a></nav>
      <section class="course-detail-hero" id="course-overview"><article class="course-detail-copy"><span class="cip-kicker">LMC · 77 PARTS</span><h1>${escapeHtml(course.title)}</h1><div class="subtitle">${escapeHtml(course.englishTitle || '')}</div><p>${escapeHtml(course.description)}</p>
      <div class="lmc-qualification-strip"><div class="lmc-qualification-item"><span>Official</span><strong>12주 · 총 24시간</strong></div><div class="lmc-qualification-item"><span>Video</span><strong>77개 · ${durationLabel(course.videoDurationSeconds, true)}</strong></div><div class="lmc-qualification-item"><span>Media</span><strong>${media.published}/${media.total}개 공개</strong></div></div>
      <div class="lmc-resume-panel"><div><span>Next Learning</span><strong>WEEK ${pad(resume.week)} · ${escapeHtml(resume.title || '수료 주차')}</strong></div><a class="primary-action" href="${partUrl(course, resume)}">학습 이어가기 →</a></div></article>
      <aside class="course-summary-card"><div class="summary-cap"><span>LMC COURSE PROFILE</span><span>${escapeHtml(course.level)}</span></div><div class="summary-body"><div class="summary-row"><span>부여 자격</span><strong>${escapeHtml(course.qualificationName)}</strong></div><div class="summary-row"><span>등록번호</span><strong>${escapeHtml(course.qualificationNumber)}</strong></div><div class="summary-row"><span>영상 파트</span><strong>77개</strong></div><div class="summary-row"><span>실제 영상시간</span><strong>${durationLabel(course.videoDurationSeconds, true)}</strong></div><div class="summary-row"><span>내 영상진도</span><strong>${summary.completed}/${summary.total}</strong></div><div style="margin-top:18px">${progressMarkup(summary)}<div class="progress-copy"><span>진행률</span><span>${summary.percent}%</span></div></div></div></aside></section>
      <section class="course-detail-grid"><article class="curriculum-card" id="curriculum"><h2 class="card-title">12주 · 77파트 커리큘럼</h2><p class="lmc-curriculum-intro">주차를 펼치면 10~26분 단위 파트와 이어보기 위치를 확인할 수 있습니다.</p>${groupedCurriculum(course, weeks, progress, resume)}</article><div class="side-stack"><article class="learning-card"><h2 class="card-title">학습 목표</h2><ul class="learning-list">${(course.learningGoals || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article><article class="lmc-side-card" id="benefits"><h2 class="card-title">교육 특전</h2><div class="lmc-benefit-list">${(course.benefits || []).map((item) => `<div class="lmc-benefit-item">${escapeHtml(item)}</div>`).join('')}</div></article><article class="lmc-side-card" id="faculty"><h2 class="card-title">주 강사진</h2><div class="lmc-instructor-list">${(course.instructors || []).map((person) => `<div class="lmc-instructor-item"><div><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.role)}</span><small>${escapeHtml(person.note)}</small></div></div>`).join('')}</div></article></div></section>
      <article class="lmc-full-card" id="qualification"><h2 class="card-title">자격 및 운영 안내</h2><p class="lmc-lesson-copy">${escapeHtml(course.credentialNotice || '')}</p><p class="lmc-lesson-copy">브라우저 진도는 학습 편의를 위한 기록이며 공식 출결·자격증 발급 증거로 단독 사용하지 않습니다.</p><div class="lmc-ethics-note">${escapeHtml(course.ethicsNotice || '')}</div></article>`;
  }

  function completionAction(url, readyLabel) {
    try {
      const target = new URL(String(url || '').trim());
      if (target.protocol !== 'https:') throw new Error();
      return `<a class="completion-action" href="${escapeHtml(target.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(readyLabel)} →</a>`;
    } catch { return '<span class="completion-action is-disabled" aria-disabled="true">운영 준비 중</span>'; }
  }

  function completionStageMarkup(course) {
    const completion = course.completion || {};
    return `<section class="completion-stage" aria-labelledby="completion-stage-title"><span class="video-week-mark">LMC FINAL WEEK</span><strong id="completion-stage-title">배운 것을 연결하고 전문활용의 기준을 정리합니다.</strong><p>영상 없이 수료시험, 1~11주 과정 통합, 전체 성찰, 만족도 조사, 학기말 수료식과 자격증 발급 절차를 진행합니다.</p><div class="completion-stage-flow"><span>수료시험</span><span>과정 통합</span><span>전체 성찰</span><span>만족도 조사</span><span>학기말 수료식</span><span>자격증 발급</span></div>${completionAction(completion.examUrl, '수료시험 열기')}</section>`;
  }

  function noteCardMarkup(savedNote, index = '03') {
    return `<article class="lesson-content-card" data-card-index="${index}"><h2 class="card-title">나의 한 문장</h2><textarea class="note-field" id="lessonNote" placeholder="오늘 배운 개념이나 상담 장면에 적용할 한 문장을 기록하세요.">${escapeHtml(savedNote)}</textarea><div class="note-save-line"><span>이 수강생의 브라우저에 자동 저장됩니다.</span><span class="note-save-status" id="noteSaveStatus">${savedNote ? '저장된 기록' : '기록 전'}</span></div></article>`;
  }

  function ethicsMarkup(course, active) {
    if (active.week >= 7 && active.week <= 9) return `<div class="lmc-ethics-note is-prominent">본 교육과 검사도구는 자기이해와 상담·코칭 교육을 위한 자료입니다. 의학적 진단이나 치료를 대신하지 않으며, 위기 또는 전문치료가 필요한 경우 관련 전문기관과 의료기관의 도움을 받아야 합니다.</div>`;
    if (/AI/.test(active.title)) return '<div class="lmc-ethics-note is-prominent">AI 해석은 보조자료입니다. 개인정보 입력에 주의하고, 원자료와 맥락을 함께 검토하며, 검사결과를 단정하지 않습니다. 전문가의 판단을 대신하지 않습니다.</div>';
    return `<div class="lmc-ethics-note">${escapeHtml(course.ethicsNotice || '')}</div>`;
  }

  function lessonSidebar(course, week, progress, activeId) {
    const summary = weekSummary(progress, course.id, week);
    return `<aside class="lesson-sidebar" id="lessonSidebar"><div class="lesson-sidebar-head"><div><span>WEEK ${pad(week.week)}</span><h2>${escapeHtml(week.title)}</h2></div><button class="lesson-sidebar-toggle" type="button" id="lessonSidebarToggle" aria-expanded="true" aria-controls="lessonList">⌃</button></div><div class="lesson-sidebar-progress">${progressMarkup(summary, `${week.week}주차 진행률`)}<div class="progress-copy"><span>${summary.completed}/${summary.total} 완료</span><span>${summary.percent}%</span></div></div><div class="lesson-list" id="lessonList">${week.parts.map((part) => partRow(course, part, progress, part.id === activeId)).join('')}</div><div class="course-actions" style="margin:0 18px 18px"><a class="secondary-action" href="./course.html?course=${encodeURIComponent(course.id)}#curriculum">전체 12주</a></div></aside>`;
  }

  function renderLesson(catalog, mediaCatalog, progress) {
    const app = document.querySelector('#lessonApp');
    if (!app) return;
    const course = catalog.courses?.find((item) => item.id === (params.get('course') || COURSE_ID));
    if (!course) { app.innerHTML = '<div class="empty-state"><strong>LMC 과정을 찾을 수 없습니다.</strong></div>'; return; }
    const weeks = courseWeeks(course, mediaCatalog);
    const requestedWeek = Number(params.get('week') || (params.has('module') ? Number(params.get('module')) + 1 : 0));
    const resume = resumePart(course, weeks, progress);
    const weekNumber = requestedWeek >= 1 && requestedWeek <= 12 ? requestedWeek : resume.week;
    const week = weeks.find((item) => item.week === weekNumber) || weeks[0];
    if (week.week === 12) {
      const savedNote = progress.notes?.[`${course.id}:week-12`] || '';
      app.innerHTML = `<div class="cip-breadcrumb academy-breadcrumb"><a href="./index.html">LMC Academy</a><span>/</span><a href="./course.html?course=${encodeURIComponent(course.id)}">${escapeHtml(course.title)}</a><span>/</span><strong>WEEK 12</strong></div>${completionStageMarkup(course)}<div class="lesson-content-grid completion-content-grid"><article class="lesson-content-card completion-card" data-card-index="01"><h2 class="card-title">전체 과정 성찰</h2><ul class="reflection-list">${(course.completion?.reflectionQuestions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article><article class="lesson-content-card completion-card" data-card-index="02"><h2 class="card-title">만족도 조사</h2><p class="lmc-lesson-copy">담당자의 안내 후 이용할 수 있습니다.</p>${completionAction(course.completion?.satisfactionSurveyUrl, '만족도 조사 열기')}</article><article class="lesson-content-card completion-card" data-card-index="03"><h2 class="card-title">수료 및 자격증 발급</h2><p class="lmc-lesson-copy">${escapeHtml(course.completion?.certificateNotice || '')}</p>${completionAction(course.completion?.completionApplicationUrl, '수료 절차 열기')}</article>${noteCardMarkup(savedNote, '04')}</div><div class="lmc-final-confirmation"><strong>최종 완료는 운영자 확인 후 반영됩니다.</strong><span>브라우저의 학습기록만으로 공식 출결·수료·자격증 발급이 확정되지 않습니다.</span></div><div class="lesson-navigation"><a class="lesson-nav-link prev" href="${partUrl(course, weeks.find((item) => item.week === 11)?.parts.at(-1))}">← 11주차 마지막 파트</a><span></span><a class="lesson-nav-link next" href="./course.html?course=${encodeURIComponent(course.id)}#curriculum">과정 전체 보기 →</a></div>`;
      bindNote(course, 'week-12');
      return;
    }
    const release = releaseState(course, week, progress, weeks);
    if (!release.allowed) { app.innerHTML = `<section class="access-setup-state"><span>WEEK ${pad(week.week)}</span><strong>${release.label}</strong><p>현재 공개정책에 따라 이 주차를 이용할 수 없습니다.</p><a href="./course.html?course=${encodeURIComponent(course.id)}#curriculum">커리큘럼으로 이동 →</a></section>`; return; }
    const requestedPart = Number(params.get('part') || 0);
    const active = week.parts.find((part) => part.part === requestedPart) || week.parts.find((part) => part.id === resume.id) || week.parts[0];
    const flat = [...allVideoParts(weeks), { week: 12, id: 'week-12', title: '수료시험 및 과정 통합' }];
    const activeIndex = flat.findIndex((part) => part.id === active.id);
    const previous = flat[activeIndex - 1] || null;
    const next = flat[activeIndex + 1] || null;
    const noteKey = active.id;
    const savedNote = progress.notes?.[`${course.id}:${noteKey}`] || '';
    const courseSummary = progressSummary(progress, course.id, allVideoParts(weeks));
    const done = isPartComplete(completedSet(progress, course.id), active);
    progress.lastViewed[course.id] = active.id;
    saveProgress(progress);
    const playable = isPlayableMedia(active);
    const stage = `<div class="video-stage${playable ? '' : ' no-video'}"><div class="video-ratio" id="videoRatio">${playable ? '<div class="r2-player-state"><strong>비공개 강의 영상을 불러오는 중입니다.</strong><span>수강권한과 단기 재생주소를 확인하고 있습니다.</span></div>' : `<div class="video-placeholder"><div class="video-placeholder-card"><span class="video-week-mark">WEEK ${pad(active.week)} · PART ${pad(active.part)}</span><strong>영상 업로드 준비 중</strong><p>${escapeHtml(active.title)}</p><span class="video-placeholder-hint">검증된 MP4가 R2에 게시되기 전에는 재생주소를 발급하지 않습니다.</span></div></div>`}</div></div>`;
    const prevHref = previous ? partUrl(course, previous) : '#';
    const nextHref = next ? partUrl(course, next) : '#';
    app.innerHTML = `<div class="cip-breadcrumb academy-breadcrumb"><a href="./index.html">LMC Academy</a><span>/</span><a href="./course.html?course=${encodeURIComponent(course.id)}#curriculum">${escapeHtml(course.title)}</a><span>/</span><strong>W${pad(active.week)} P${pad(active.part)}</strong></div><section class="lesson-layout"><div><div class="lesson-workspace-head"><div class="lesson-context"><span>${active.phase.label}</span><span>WEEK ${pad(active.week)}</span><span>PART ${pad(active.part)}</span></div><div class="lesson-step-count">전체 ${activeIndex + 1} / 77</div></div>${stage}<div class="lesson-title-row"><span class="cip-kicker">LMC PROTECTED LESSON</span><h1>${escapeHtml(active.title)}</h1><p>${escapeHtml(active.theory || active.weekTitle)}</p><div class="course-meta"><span>${durationLabel(active.durationSeconds)}</span><span>${playable ? 'R2 비공개 스트리밍' : '업로드 대기'}</span></div></div><div class="lesson-content-grid"><article class="lesson-content-card" data-card-index="01"><h2 class="card-title">이번 파트의 맥락</h2><p class="lmc-lesson-copy">${escapeHtml(active.practice || '')}</p></article><article class="lesson-content-card" data-card-index="02"><h2 class="card-title">학습 기록</h2><p class="lmc-lesson-copy">90% 이상 시청하면 파트가 자동 완료됩니다. 완료 후에도 다시 학습할 수 있습니다.</p><div class="lesson-part-progress">${progressMarkup(courseSummary, '전체 과정 영상진도')}<span>전체 ${courseSummary.completed}/77 · ${courseSummary.percent}%</span></div></article>${noteCardMarkup(savedNote)}</div>${ethicsMarkup(course, active)}<div class="lesson-navigation"><a class="lesson-nav-link prev${previous ? '' : ' is-disabled'}" href="${prevHref}">← 이전 파트</a><button class="lesson-complete-button${done ? ' is-complete' : ''}" type="button" disabled>${done ? '✓ 파트 완료' : (playable ? '90% 시청 시 자동 완료' : '영상 업로드 대기')}</button><a class="lesson-nav-link next${next ? '' : ' is-disabled'}" href="${nextHref}">다음 파트 →</a></div></div>${lessonSidebar(course, week, progress, active.id)}</section><div class="mobile-learning-bar"><a class="${previous ? '' : 'is-disabled'}" href="${prevHref}" aria-label="이전 파트">←</a><span class="mobile-complete${done ? ' is-complete' : ''}">${done ? '✓ 완료' : `${active.part}/${week.parts.length}`}</span><a class="${next ? '' : 'is-disabled'}" href="${nextHref}" aria-label="다음 파트">→</a></div>`;
    bindNote(course, noteKey);
    bindLessonUi();
  }

  function bindNote(course, noteKey) {
    let noteTimer;
    const noteField = document.querySelector('#lessonNote');
    const noteStatus = document.querySelector('#noteSaveStatus');
    const persist = () => {
      const current = getProgress();
      current.notes[`${course.id}:${noteKey}`] = (noteField?.value || '').trim();
      saveProgress(current);
      if (noteStatus) { noteStatus.textContent = '자동 저장됨'; noteStatus.classList.add('is-saved'); }
    };
    noteField?.addEventListener('input', () => { if (noteStatus) noteStatus.textContent = '저장 중…'; clearTimeout(noteTimer); noteTimer = setTimeout(persist, 500); });
    noteField?.addEventListener('blur', persist);
  }

  function bindLessonUi() {
    document.querySelector('#lessonSidebarToggle')?.addEventListener('click', (event) => {
      const sidebar = document.querySelector('#lessonSidebar');
      const collapsed = sidebar?.classList.toggle('is-collapsed');
      event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
      event.currentTarget.textContent = collapsed ? '⌄' : '⌃';
    });
  }

  function renderAccessFailure(page, message) {
    const target = document.querySelector(page === 'course' ? '#courseApp' : '#lessonApp');
    if (target) target.innerHTML = `<section class="access-setup-state"><span>ACADEMY ACCESS</span><strong>강의실 인증을 시작하지 못했습니다.</strong><p>${escapeHtml(message || '입장 페이지에서 다시 로그인해 주세요.')}</p><a href="./enter.html">수강생 입장으로 이동 →</a></section>`;
  }

  async function init() {
    const page = document.body.dataset.academyPage;
    let session = null;
    setAuthenticatedStudent('');
    if (page === 'course' || page === 'lesson') {
      if (!window.RSEduAcademyAccess) { renderAccessFailure(page, '인증 스크립트가 로드되지 않았습니다.'); return; }
      try { session = await window.RSEduAcademyAccess.guard({ target: document.querySelector(page === 'course' ? '#courseApp' : '#lessonApp') }); if (!session) return; } catch (error) { renderAccessFailure(page, error.message); return; }
    } else if (page === 'index' && window.RSEduAcademyAccess?.isConfigured?.() && window.RSEduAcademyAccess?.loadSession?.()) {
      try { session = await window.RSEduAcademyAccess.guard({ redirect: false }); } catch (error) { console.warn('[RS Academy] public progress session ignored:', error); }
    }
    setAuthenticatedStudent(session?.studentId || '');
    const { catalog, mediaCatalog } = await loadData();
    const progress = getProgress();
    if (page === 'index') renderIndex(catalog, mediaCatalog, progress, Boolean(session?.studentId));
    if (page === 'course') renderCourse(catalog, mediaCatalog, progress);
    if (page === 'lesson') renderLesson(catalog, mediaCatalog, progress);
  }

  document.addEventListener('rsedu-academy:part-completed', (event) => {
    const partId = String(event.detail?.partId || '');
    if (!/^week-\d{2}-part-\d{2}$/.test(partId)) return;
    const progress = getProgress();
    const completed = completedSet(progress, COURSE_ID);
    if (!completed.has(partId)) {
      completed.add(partId);
      progress.completed[COURSE_ID] = [...completed];
      delete progress.playback[`${COURSE_ID}:${partId}`];
      saveProgress(progress);
      const button = document.querySelector('.lesson-complete-button');
      if (button) { button.classList.add('is-complete'); button.textContent = '✓ 파트 완료'; }
      const mobile = document.querySelector('.mobile-complete');
      if (mobile) { mobile.classList.add('is-complete'); mobile.textContent = '✓ 완료'; }
      const activeRow = document.querySelector('.lmc-part-row[aria-current="page"]');
      if (activeRow) {
        activeRow.classList.add('is-complete');
        const number = activeRow.querySelector('.lmc-part-number');
        const state = activeRow.querySelector('.lesson-status');
        if (number) number.textContent = '✓';
        if (state) state.textContent = '완료';
      }
    }
  });

  document.addEventListener('DOMContentLoaded', init);
})();
