(() => {
  'use strict';

  const DATA_PATH = './data/courses.json';
  const CACHE_PATH = './data/youtube-cache.json';
  const STORAGE_KEY = 'rsedu-academy-progress:v1';

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const params = new URLSearchParams(window.location.search);
  const pad = (value) => String(value).padStart(2, '0');

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
    const [catalog, cache] = await Promise.all([
      fetchJson(DATA_PATH, { courses: [] }),
      fetchJson(CACHE_PATH, { courses: {}, syncedAt: null })
    ]);
    return { catalog, cache };
  }

  function getProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        completed: parsed.completed || {},
        notes: parsed.notes || {},
        lastViewed: parsed.lastViewed || {},
        updatedAt: parsed.updatedAt || null
      };
    } catch {
      return { completed: {}, notes: {}, lastViewed: {}, updatedAt: null };
    }
  }

  function saveProgress(progress) {
    progress.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  function videosFor(cache, courseId) {
    const entry = cache?.courses?.[courseId];
    return Array.isArray(entry?.videos) ? entry.videos : [];
  }

  function plannedLessons(course) {
    const modules = Array.isArray(course.modules) ? course.modules : [];
    return modules.map((module, index) => {
      if (typeof module === 'string') {
        return {
          id: `module-${pad(index + 1)}`,
          week: index + 1,
          title: module,
          theory: module,
          practice: '영상 업로드 후 실습 안내가 연결됩니다.',
          recommendedFor: ''
        };
      }
      return {
        id: module.id || `module-${pad(module.week || index + 1)}`,
        week: module.week || index + 1,
        title: module.title || `제 ${index + 1}차시`,
        theory: module.theory || '',
        practice: module.practice || '',
        recommendedFor: module.recommendedFor || ''
      };
    });
  }

  function lessonsFor(course, cache) {
    const videos = videosFor(cache, course.id);
    if (videos.length) return videos.map((video) => ({ ...video, id: video.videoId }));
    return plannedLessons(course);
  }

  function completedSet(progress, courseId) {
    return new Set(Array.isArray(progress.completed?.[courseId]) ? progress.completed[courseId] : []);
  }

  function courseProgress(progress, courseId, lessons) {
    if (!lessons.length) return { completed: 0, total: 0, percent: 0 };
    const completed = completedSet(progress, courseId);
    const count = lessons.filter((lesson) => completed.has(lesson.videoId || lesson.id)).length;
    return { completed: count, total: lessons.length, percent: Math.round((count / lessons.length) * 100) };
  }

  function durationLabel(minutes = 0) {
    if (!minutes) return '시간 추후 공개';
    const hours = Math.floor(minutes / 60);
    const remain = minutes % 60;
    if (!hours) return `약 ${remain}분`;
    return remain ? `약 ${hours}시간 ${remain}분` : `약 ${hours}시간`;
  }

  function statusLabel(course, videos) {
    if (videos.length) return `${videos.length}개 영상강의 공개`;
    if (course.status === 'published') return '온라인 과정 공개';
    return `${course.estimatedLessons || course.modules?.length || 0}주 커리큘럼 준비 완료`;
  }

  function buildCourseCard(course, cache, progress) {
    const videos = videosFor(cache, course.id);
    const lessons = lessonsFor(course, cache);
    const summary = courseProgress(progress, course.id, lessons);
    const status = videos.length ? `${summary.percent}% 학습` : '12주 커리큘럼 공개';

    return `
      <article class="course-card" data-accent="${escapeHtml(course.accent || 'green')}" data-course="lmc">
        <div class="course-cover">
          <span class="course-label">${escapeHtml(course.coverLabel || 'LMC PROFESSIONAL')}</span>
          <div class="course-cover-title">${escapeHtml(course.title)}</div>
          <div class="course-cover-subtitle">${escapeHtml(course.englishTitle || '')}</div>
        </div>
        <div class="course-card-body">
          <div class="course-meta">
            <span>${escapeHtml(course.category)}</span>
            <span>${escapeHtml(course.level)}</span>
            <span>${status}</span>
          </div>
          <h3>${escapeHtml(course.title)}</h3>
          <p>${escapeHtml(course.subtitle)}</p>
          <div class="lmc-card-credential">${escapeHtml(course.qualificationNumber || '')} · ${escapeHtml(course.qualificationName || '')}</div>
          <div class="lmc-card-facts">
            <div class="lmc-card-fact"><span>Duration</span><strong>${escapeHtml(course.scheduleSummary || '')}</strong></div>
            <div class="lmc-card-fact"><span>Learning</span><strong>${durationLabel(course.estimatedMinutes)}</strong></div>
            <div class="lmc-card-fact"><span>Credential</span><strong>수료시험·발급요건</strong></div>
          </div>
          <div class="course-card-footer">
            <span class="course-count">${lessons.length}차시 · ${escapeHtml(statusLabel(course, videos))}</span>
            <a class="course-link" href="./course.html?course=${encodeURIComponent(course.id)}">LMC 과정 보기 →</a>
          </div>
        </div>
      </article>`;
  }

  function renderIndex(catalog, cache, progress) {
    const courseGrid = document.querySelector('#courseGrid');
    const statusPanel = document.querySelector('#academyStatus');
    if (!courseGrid) return;

    const courses = Array.isArray(catalog.courses) ? catalog.courses : [];
    courseGrid.innerHTML = courses.length
      ? courses.map((course) => buildCourseCard(course, cache, progress)).join('')
      : '<div class="empty-state"><strong>등록된 LMC 과정이 없습니다.</strong><span>과정 데이터를 확인해 주세요.</span></div>';

    if (statusPanel) {
      const course = courses[0];
      const lessons = course ? lessonsFor(course, cache) : [];
      const summary = course ? courseProgress(progress, course.id, lessons) : { completed: 0, percent: 0 };
      statusPanel.innerHTML = `
        <article class="status-card"><span>LMC Curriculum</span><strong>${lessons.length}개 차시</strong><p>심리학 이론·심리측정 실습·수료시험</p></article>
        <article class="status-card"><span>Qualification</span><strong>${escapeHtml(course?.qualificationNumber || 'LMC')}</strong><p>${escapeHtml(course?.qualificationName || '평생진로상담사')}</p></article>
        <article class="status-card"><span>My Learning</span><strong>${summary.completed}개 완료</strong><p>현재 진행률 ${summary.percent}% · 이 브라우저에 저장</p></article>`;
    }
  }

  function curriculumItems(course, videos, progress) {
    if (videos.length) {
      const completed = completedSet(progress, course.id);
      return videos.map((video, index) => {
        const id = video.videoId;
        const isComplete = completed.has(id);
        return `
          <a class="curriculum-item" href="./lesson.html?course=${encodeURIComponent(course.id)}&video=${encodeURIComponent(id)}">
            <span class="curriculum-number">${pad(index + 1)}</span>
            <span><strong>${escapeHtml(video.title)}</strong><small>${escapeHtml(video.publishedAt ? video.publishedAt.slice(0, 10) : 'YouTube lesson')}</small></span>
            <span class="lesson-status">${isComplete ? '완료' : '학습하기'}</span>
          </a>`;
      }).join('');
    }

    return plannedLessons(course).map((module, index) => `
      <a class="curriculum-item lmc-curriculum-item" href="./lesson.html?course=${encodeURIComponent(course.id)}&module=${index}">
        <span class="curriculum-number">${pad(module.week)}</span>
        <span class="lmc-curriculum-main"><strong>${escapeHtml(module.title)}</strong><small>${escapeHtml(module.theory)}</small></span>
        <span class="lmc-curriculum-practice"><em>Practice</em><small>${escapeHtml(module.practice)}</small></span>
        <span class="lesson-status">미리보기</span>
      </a>`).join('');
  }

  function renderCourse(catalog, cache, progress) {
    const app = document.querySelector('#courseApp');
    if (!app) return;

    const courseId = params.get('course') || catalog.courses?.[0]?.id;
    const course = catalog.courses?.find((item) => item.id === courseId);
    if (!course) {
      app.innerHTML = '<div class="empty-state"><strong>LMC 과정을 찾을 수 없습니다.</strong><a class="secondary-action" href="./index.html">Academy로 돌아가기</a></div>';
      return;
    }

    const videos = videosFor(cache, course.id);
    const lessons = lessonsFor(course, cache);
    const progressSummary = courseProgress(progress, course.id, lessons);
    const firstLessonUrl = videos.length
      ? `./lesson.html?course=${encodeURIComponent(course.id)}&video=${encodeURIComponent(videos[0].videoId)}`
      : `./lesson.html?course=${encodeURIComponent(course.id)}&module=0`;

    const delivery = (course.deliveryOptions || []).join(' · ');

    app.innerHTML = `
      <div class="cip-breadcrumb academy-breadcrumb"><a href="./index.html">LMC Academy</a><span>/</span><strong>${escapeHtml(course.title)}</strong></div>
      <section class="course-detail-hero">
        <article class="course-detail-copy">
          <span class="cip-kicker">${escapeHtml(course.coverLabel || 'LMC Course')}</span>
          <h1>${escapeHtml(course.title)}</h1>
          <div class="subtitle">${escapeHtml(course.englishTitle || '')}</div>
          <p>${escapeHtml(course.description)}</p>
          <div class="course-meta" style="margin-top:22px">
            ${(course.audience || []).map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
          </div>
          <div class="lmc-qualification-strip">
            <div class="lmc-qualification-item"><span>Qualification</span><strong>${escapeHtml(course.qualificationNumber)}</strong></div>
            <div class="lmc-qualification-item"><span>Program</span><strong>${escapeHtml(course.scheduleSummary)}</strong></div>
            <div class="lmc-qualification-item"><span>Delivery</span><strong>${escapeHtml(delivery)}</strong></div>
          </div>
          <div class="course-actions">
            <a class="primary-action" href="${firstLessonUrl}">${videos.length ? '첫 영상강의 시작 →' : '1주차 강의실 열기 →'}</a>
            <a class="secondary-action" href="./index.html">LMC Academy</a>
          </div>
        </article>

        <aside class="course-summary-card">
          <div class="summary-cap"><span>LMC COURSE PROFILE</span><span>${escapeHtml(course.level)}</span></div>
          <div class="summary-body">
            <div class="summary-row"><span>부여 자격</span><strong>${escapeHtml(course.qualificationName)}</strong></div>
            <div class="summary-row"><span>등록번호</span><strong>${escapeHtml(course.qualificationNumber)}</strong></div>
            <div class="summary-row"><span>강사·운영</span><strong>${escapeHtml(course.instructor)}</strong></div>
            <div class="summary-row"><span>차시</span><strong>${lessons.length}개</strong></div>
            <div class="summary-row"><span>학습시간</span><strong>${durationLabel(course.estimatedMinutes)}</strong></div>
            <div class="summary-row"><span>상태</span><strong>${escapeHtml(statusLabel(course, videos))}</strong></div>
            <div class="summary-row"><span>내 진도</span><strong>${progressSummary.completed}/${progressSummary.total}</strong></div>
            <div style="margin-top:18px">
              <div class="progress-track"><div class="progress-fill" style="width:${progressSummary.percent}%"></div></div>
              <div class="progress-copy"><span>진행률</span><span>${progressSummary.percent}%</span></div>
            </div>
          </div>
        </aside>
      </section>

      <section class="course-detail-grid">
        <article class="curriculum-card">
          <h2 class="card-title">12주 이론·실습 커리큘럼</h2>
          <div class="curriculum-list">${curriculumItems(course, videos, progress)}</div>
        </article>
        <div class="side-stack">
          <article class="learning-card">
            <h2 class="card-title">학습 목표</h2>
            <ul class="learning-list">${(course.learningGoals || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </article>
          <article class="lmc-side-card">
            <h2 class="card-title">교육 특전</h2>
            <div class="lmc-benefit-list">${(course.benefits || []).map((item) => `<div class="lmc-benefit-item">${escapeHtml(item)}</div>`).join('')}</div>
          </article>
          <article class="lmc-side-card">
            <h2 class="card-title">주 강사진</h2>
            <div class="lmc-instructor-list">${(course.instructors || []).map((person) => `<div class="lmc-instructor-item"><div><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.role)}</span><small>${escapeHtml(person.note)}</small></div></div>`).join('')}</div>
          </article>
          <article class="reflection-card">
            <h2 class="card-title">과정 성찰 질문</h2>
            <ul class="reflection-list">${(course.reflectionQuestions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </article>
        </div>
      </section>

      <article class="lmc-full-card">
        <h2 class="card-title">자격 및 운영 안내</h2>
        <p class="lmc-lesson-copy">${escapeHtml(course.credentialNotice || '')}</p>
        <p class="lmc-lesson-copy" style="margin-top:8px">${escapeHtml(course.cohortNotice || '')}</p>
        <div class="lmc-ethics-note">${escapeHtml(course.ethicsNotice || '')}</div>
      </article>`;
  }

  function lessonItems(course, videos, progress, activeId) {
    const completed = completedSet(progress, course.id);
    if (videos.length) {
      return videos.map((video, index) => {
        const id = video.videoId;
        const classes = ['lesson-list-item'];
        if (id === activeId) classes.push('is-active');
        if (completed.has(id)) classes.push('is-complete');
        return `
          <a class="${classes.join(' ')}" href="./lesson.html?course=${encodeURIComponent(course.id)}&video=${encodeURIComponent(id)}">
            <span class="lesson-number">${completed.has(id) ? '✓' : pad(index + 1)}</span>
            <span><strong>${escapeHtml(video.title)}</strong><small>${completed.has(id) ? '학습 완료' : '영상강의 보기'}</small></span>
          </a>`;
      }).join('');
    }

    return plannedLessons(course).map((module, index) => {
      const classes = ['lesson-list-item'];
      if (module.id === activeId) classes.push('is-active');
      if (completed.has(module.id)) classes.push('is-complete');
      return `
        <a class="${classes.join(' ')}" href="./lesson.html?course=${encodeURIComponent(course.id)}&module=${index}">
          <span class="lesson-number">${completed.has(module.id) ? '✓' : pad(module.week)}</span>
          <span><strong>${escapeHtml(module.title)}</strong><small>${completed.has(module.id) ? '학습 완료' : '이론·실습 미리보기'}</small></span>
        </a>`;
    }).join('');
  }

  function renderLesson(catalog, cache, progress) {
    const app = document.querySelector('#lessonApp');
    if (!app) return;

    const courseId = params.get('course') || catalog.courses?.[0]?.id;
    const course = catalog.courses?.find((item) => item.id === courseId);
    if (!course) {
      app.innerHTML = '<div class="empty-state"><strong>LMC 과정을 찾을 수 없습니다.</strong><a class="secondary-action" href="./index.html">Academy로 돌아가기</a></div>';
      return;
    }

    const videos = videosFor(cache, course.id);
    const modules = plannedLessons(course);
    const requestedVideoId = params.get('video');
    const requestedModule = Math.max(0, Math.min(modules.length - 1, Number(params.get('module') || 0)));
    const activeVideo = videos.find((video) => video.videoId === requestedVideoId) || videos[0] || null;
    const activeModule = activeVideo ? null : (modules[requestedModule] || modules[0]);
    const activeId = activeVideo?.videoId || activeModule?.id || 'module-01';
    const noteKey = `${course.id}:${activeId}`;
    const savedNote = progress.notes?.[noteKey] || '';
    const lessons = lessonsFor(course, cache);
    const progressSummary = courseProgress(progress, course.id, lessons);
    const lessonTitle = activeVideo?.title || activeModule?.title || `${course.title} 강의실`;
    const lessonDescription = activeVideo?.description || activeModule?.theory || 'LMC 차시 정보를 불러오고 있습니다.';
    const practiceCopy = activeModule?.practice || '영상강의에서 안내되는 검사실습과 적용활동을 따라 진행합니다.';
    const recommendedFor = activeModule?.recommendedFor || 'LMC 과정 참여자';

    progress.lastViewed[course.id] = activeId;
    saveProgress(progress);

    app.innerHTML = `
      <div class="cip-breadcrumb academy-breadcrumb"><a href="./index.html">LMC Academy</a><span>/</span><a href="./course.html?course=${encodeURIComponent(course.id)}">${escapeHtml(course.title)}</a><span>/</span><strong>${activeModule ? `${activeModule.week}주차` : '영상강의'}</strong></div>
      <section class="lesson-layout">
        <div>
          <div class="video-stage">
            <div class="video-ratio" id="videoRatio">
              ${activeVideo ? '<div id="youtubePlayer" style="position:absolute;inset:0"></div>' : `
                <div class="video-placeholder">
                  <div><strong>${escapeHtml(activeModule ? `${activeModule.week}주차 영상 업로드 준비 중` : '강의영상 업로드 준비 중')}</strong><p>유튜브 재생목록이 연결되기 전에도 이론·실습 내용과 학습기록을 사용할 수 있습니다.</p></div>
                </div>`}
            </div>
          </div>
          <div class="lesson-title-row">
            <span class="cip-kicker">${activeVideo ? 'LMC Video Lesson' : `LMC Week ${pad(activeModule?.week || 1)}`}</span>
            <h1>${escapeHtml(lessonTitle)}</h1>
            <p>${escapeHtml(lessonDescription)}</p>
            ${activeModule ? `<div class="course-meta" style="margin-top:16px"><span>${escapeHtml(recommendedFor)}</span></div>` : ''}
          </div>

          <div class="lesson-content-grid">
            <article class="lesson-content-card lmc-lesson-theory">
              <h2 class="card-title">이론 핵심</h2>
              <p class="lmc-lesson-copy">${escapeHtml(lessonDescription)}</p>
            </article>
            <article class="lesson-content-card lmc-lesson-practice">
              <h2 class="card-title">심리측정 실습</h2>
              <p class="lmc-lesson-copy">${escapeHtml(practiceCopy)}</p>
            </article>
            <article class="lesson-content-card">
              <h2 class="card-title">오늘의 성찰 질문</h2>
              <ul class="reflection-list">${(course.reflectionQuestions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            </article>
            <article class="lesson-content-card">
              <h2 class="card-title">나의 한 문장</h2>
              <textarea class="note-field" id="lessonNote" placeholder="오늘 배운 개념이나 상담 장면에 적용할 한 문장을 기록하세요.">${escapeHtml(savedNote)}</textarea>
              <div class="course-actions">
                <button class="secondary-action" type="button" id="saveNote">기록 저장</button>
                <button class="primary-action" type="button" id="completeLesson">${completedSet(progress, course.id).has(activeId) ? '완료 취소' : '학습 완료'}</button>
              </div>
            </article>
          </div>
          <div class="lmc-ethics-note">${escapeHtml(course.ethicsNotice || '')}</div>
        </div>

        <aside class="lesson-sidebar">
          <h2>12주 전체 차시</h2>
          <div class="progress-track"><div class="progress-fill" style="width:${progressSummary.percent}%"></div></div>
          <div class="progress-copy"><span>${progressSummary.completed}개 완료</span><span>${progressSummary.percent}%</span></div>
          <div class="lesson-list" style="margin-top:16px">${lessonItems(course, videos, progress, activeId)}</div>
          <div class="course-actions" style="margin-top:18px">
            <a class="secondary-action" href="./course.html?course=${encodeURIComponent(course.id)}">과정정보</a>
          </div>
        </aside>
      </section>`;

    document.querySelector('#saveNote')?.addEventListener('click', () => {
      const value = document.querySelector('#lessonNote')?.value || '';
      progress.notes[noteKey] = value.trim();
      saveProgress(progress);
      showStatus('한 문장을 저장했습니다.');
    });

    document.querySelector('#completeLesson')?.addEventListener('click', () => {
      const completed = completedSet(progress, course.id);
      if (completed.has(activeId)) completed.delete(activeId);
      else completed.add(activeId);
      progress.completed[course.id] = [...completed];
      saveProgress(progress);
      renderLesson(catalog, cache, progress);
      showStatus(completed.has(activeId) ? '학습 완료로 기록했습니다.' : '완료 기록을 취소했습니다.');
    });

    if (activeVideo) createYouTubePlayer(activeVideo.videoId, () => {
      const completed = completedSet(progress, course.id);
      if (!completed.has(activeVideo.videoId)) {
        completed.add(activeVideo.videoId);
        progress.completed[course.id] = [...completed];
        saveProgress(progress);
        renderLesson(catalog, cache, progress);
        showStatus('영상 시청을 완료했습니다.');
      }
    });
  }

  function showStatus(message) {
    let toast = document.querySelector('.academy-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'academy-toast';
      Object.assign(toast.style, {
        position: 'fixed', left: '50%', bottom: '24px', zIndex: '500', transform: 'translateX(-50%)',
        padding: '11px 15px', borderRadius: '999px', color: '#fff', background: 'rgba(7,28,67,.94)',
        boxShadow: '0 14px 36px rgba(7,28,67,.28)', fontSize: '12px', fontWeight: '800', transition: 'opacity .2s ease'
      });
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(showStatus.timer);
    showStatus.timer = setTimeout(() => { toast.style.opacity = '0'; }, 1800);
  }

  function createYouTubePlayer(videoId, onEnded) {
    const container = document.querySelector('#youtubePlayer');
    if (!container || !videoId) return;

    const mount = () => {
      if (!window.YT?.Player || !document.querySelector('#youtubePlayer')) return;
      new window.YT.Player('youtubePlayer', {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin
        },
        events: {
          onStateChange(event) {
            if (event.data === window.YT.PlayerState.ENDED) onEnded?.();
          }
        }
      });
    };

    if (window.YT?.Player) {
      mount();
      return;
    }

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      mount();
    };

    if (!document.querySelector('script[data-youtube-iframe-api]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.youtubeIframeApi = 'true';
      document.head.appendChild(script);
    }
  }

  async function init() {
    const page = document.body.dataset.academyPage;
    const { catalog, cache } = await loadData();
    const progress = getProgress();

    if (page === 'index') renderIndex(catalog, cache, progress);
    if (page === 'course') renderCourse(catalog, cache, progress);
    if (page === 'lesson') renderLesson(catalog, cache, progress);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
