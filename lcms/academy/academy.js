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
    if (videos.length) return `${videos.length}개 강의 공개`;
    if (course.status === 'published') return '공개 준비 완료';
    return '강의 업로드 준비 중';
  }

  function buildCourseCard(course, cache, progress) {
    const videos = videosFor(cache, course.id);
    const summary = courseProgress(progress, course.id, videos);
    const lessonCount = videos.length || course.estimatedLessons || course.modules?.length || 0;
    const status = videos.length ? `${summary.percent}% 학습` : '커리큘럼 공개';

    return `
      <article class="course-card" data-accent="${escapeHtml(course.accent || 'blue')}">
        <div class="course-cover">
          <span class="course-label">${escapeHtml(course.coverLabel || 'RS EDU ACADEMY')}</span>
          <div class="course-cover-title">${escapeHtml(course.title)}</div>
        </div>
        <div class="course-card-body">
          <div class="course-meta">
            <span>${escapeHtml(course.category)}</span>
            <span>${escapeHtml(course.level)}</span>
            <span>${status}</span>
          </div>
          <h3>${escapeHtml(course.title)}</h3>
          <p>${escapeHtml(course.subtitle)}</p>
          <div class="course-card-footer">
            <span class="course-count">${lessonCount}차시 · ${durationLabel(course.estimatedMinutes)}</span>
            <a class="course-link" href="./course.html?course=${encodeURIComponent(course.id)}">과정 보기 →</a>
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
      : '<div class="empty-state"><strong>등록된 과정이 없습니다.</strong><span>courses.json에 첫 과정을 등록해 주세요.</span></div>';

    if (statusPanel) {
      const publishedVideos = courses.reduce((sum, course) => sum + videosFor(cache, course.id).length, 0);
      const completedLessons = Object.values(progress.completed || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
      statusPanel.innerHTML = `
        <article class="status-card"><span>Course Catalog</span><strong>${courses.length}개 과정</strong><p>현재 설계된 RS에듀 교육과정</p></article>
        <article class="status-card"><span>Published Lessons</span><strong>${publishedVideos}개 강의</strong><p>유튜브 재생목록에서 동기화된 차시</p></article>
        <article class="status-card"><span>My Learning</span><strong>${completedLessons}개 완료</strong><p>이 브라우저에 저장된 학습기록</p></article>`;
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
            <span class="curriculum-number">${String(index + 1).padStart(2, '0')}</span>
            <span><strong>${escapeHtml(video.title)}</strong><small>${escapeHtml(video.publishedAt ? video.publishedAt.slice(0, 10) : 'YouTube lesson')}</small></span>
            <span class="lesson-status">${isComplete ? '완료' : '학습하기'}</span>
          </a>`;
      }).join('');
    }

    const modules = Array.isArray(course.modules) ? course.modules : [];
    return modules.map((module, index) => `
      <div class="curriculum-item">
        <span class="curriculum-number">${String(index + 1).padStart(2, '0')}</span>
        <span><strong>${escapeHtml(module)}</strong><small>영상 업로드 후 자동 연결</small></span>
        <span class="lesson-status">예정</span>
      </div>`).join('');
  }

  function renderCourse(catalog, cache, progress) {
    const app = document.querySelector('#courseApp');
    if (!app) return;

    const courseId = params.get('course') || catalog.courses?.[0]?.id;
    const course = catalog.courses?.find((item) => item.id === courseId);
    if (!course) {
      app.innerHTML = '<div class="empty-state"><strong>과정을 찾을 수 없습니다.</strong><a class="secondary-action" href="./index.html">과정목록으로 돌아가기</a></div>';
      return;
    }

    const videos = videosFor(cache, course.id);
    const progressSummary = courseProgress(progress, course.id, videos);
    const firstLessonUrl = videos.length
      ? `./lesson.html?course=${encodeURIComponent(course.id)}&video=${encodeURIComponent(videos[0].videoId)}`
      : `./lesson.html?course=${encodeURIComponent(course.id)}`;

    app.innerHTML = `
      <div class="cip-breadcrumb academy-breadcrumb"><a href="./index.html">Academy</a><span>/</span><strong>${escapeHtml(course.title)}</strong></div>
      <section class="course-detail-hero">
        <article class="course-detail-copy">
          <span class="cip-kicker">${escapeHtml(course.coverLabel || 'Course')}</span>
          <h1>${escapeHtml(course.title)}</h1>
          <div class="subtitle">${escapeHtml(course.subtitle)}</div>
          <p>${escapeHtml(course.description)}</p>
          <div class="course-meta" style="margin-top:22px">
            ${(course.audience || []).map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
          </div>
          <div class="course-actions">
            <a class="primary-action" href="${firstLessonUrl}">${videos.length ? '첫 강의 시작 →' : '강의실 미리보기 →'}</a>
            <a class="secondary-action" href="./index.html">과정목록</a>
          </div>
        </article>

        <aside class="course-summary-card">
          <div class="summary-cap"><span>COURSE PROFILE</span><span>${escapeHtml(course.level)}</span></div>
          <div class="summary-body">
            <div class="summary-row"><span>분야</span><strong>${escapeHtml(course.category)}</strong></div>
            <div class="summary-row"><span>강사·운영</span><strong>${escapeHtml(course.instructor)}</strong></div>
            <div class="summary-row"><span>차시</span><strong>${videos.length || course.estimatedLessons || course.modules?.length || 0}개</strong></div>
            <div class="summary-row"><span>예상 학습시간</span><strong>${durationLabel(course.estimatedMinutes)}</strong></div>
            <div class="summary-row"><span>상태</span><strong>${statusLabel(course, videos)}</strong></div>
            <div class="summary-row"><span>내 진도</span><strong>${progressSummary.completed}/${progressSummary.total || videos.length || 0}</strong></div>
            <div style="margin-top:18px">
              <div class="progress-track"><div class="progress-fill" style="width:${progressSummary.percent}%"></div></div>
              <div class="progress-copy"><span>진행률</span><span>${progressSummary.percent}%</span></div>
            </div>
          </div>
        </aside>
      </section>

      <section class="course-detail-grid">
        <article class="curriculum-card">
          <h2 class="card-title">전체 커리큘럼</h2>
          <div class="curriculum-list">${curriculumItems(course, videos, progress)}</div>
        </article>
        <div class="side-stack">
          <article class="learning-card">
            <h2 class="card-title">학습 목표</h2>
            <ul class="learning-list">${(course.learningGoals || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </article>
          <article class="reflection-card">
            <h2 class="card-title">과정 성찰 질문</h2>
            <ul class="reflection-list">${(course.reflectionQuestions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </article>
        </div>
      </section>`;
  }

  function lessonItems(course, videos, progress, activeVideoId) {
    const completed = completedSet(progress, course.id);
    if (videos.length) {
      return videos.map((video, index) => {
        const id = video.videoId;
        const classes = ['lesson-list-item'];
        if (id === activeVideoId) classes.push('is-active');
        if (completed.has(id)) classes.push('is-complete');
        return `
          <a class="${classes.join(' ')}" href="./lesson.html?course=${encodeURIComponent(course.id)}&video=${encodeURIComponent(id)}">
            <span class="lesson-number">${completed.has(id) ? '✓' : String(index + 1).padStart(2, '0')}</span>
            <span><strong>${escapeHtml(video.title)}</strong><small>${completed.has(id) ? '학습 완료' : '강의 보기'}</small></span>
          </a>`;
      }).join('');
    }

    return (course.modules || []).map((module, index) => `
      <div class="lesson-list-item${index === 0 ? ' is-active' : ''}">
        <span class="lesson-number">${String(index + 1).padStart(2, '0')}</span>
        <span><strong>${escapeHtml(module)}</strong><small>영상 준비 중</small></span>
      </div>`).join('');
  }

  function renderLesson(catalog, cache, progress) {
    const app = document.querySelector('#lessonApp');
    if (!app) return;

    const courseId = params.get('course') || catalog.courses?.[0]?.id;
    const course = catalog.courses?.find((item) => item.id === courseId);
    if (!course) {
      app.innerHTML = '<div class="empty-state"><strong>과정을 찾을 수 없습니다.</strong><a class="secondary-action" href="./index.html">Academy로 돌아가기</a></div>';
      return;
    }

    const videos = videosFor(cache, course.id);
    const requestedVideoId = params.get('video');
    const activeVideo = videos.find((video) => video.videoId === requestedVideoId) || videos[0] || null;
    const activeVideoId = activeVideo?.videoId || 'planned-01';
    const noteKey = `${course.id}:${activeVideoId}`;
    const savedNote = progress.notes?.[noteKey] || '';
    const progressSummary = courseProgress(progress, course.id, videos);
    const lessonTitle = activeVideo?.title || course.modules?.[0] || `${course.title} 강의실`;
    const lessonDescription = activeVideo?.description || '유튜브 재생목록이 연결되면 영상과 차시 정보가 이 화면에 자동으로 표시됩니다.';

    progress.lastViewed[course.id] = activeVideoId;
    saveProgress(progress);

    app.innerHTML = `
      <div class="cip-breadcrumb academy-breadcrumb"><a href="./index.html">Academy</a><span>/</span><a href="./course.html?course=${encodeURIComponent(course.id)}">${escapeHtml(course.title)}</a><span>/</span><strong>강의실</strong></div>
      <section class="lesson-layout">
        <div>
          <div class="video-stage">
            <div class="video-ratio" id="videoRatio">
              ${activeVideo ? '<div id="youtubePlayer" style="position:absolute;inset:0"></div>' : `
                <div class="video-placeholder">
                  <div><strong>강의영상 업로드 준비 중</strong><p>과정별 YouTube 재생목록 ID를 등록하면 영상·제목·순서·썸네일이 자동으로 연결됩니다.</p></div>
                </div>`}
            </div>
          </div>
          <div class="lesson-title-row">
            <span class="cip-kicker">${activeVideo ? 'Video Lesson' : 'Course Preview'}</span>
            <h1>${escapeHtml(lessonTitle)}</h1>
            <p>${escapeHtml(lessonDescription)}</p>
          </div>

          <div class="lesson-content-grid">
            <article class="lesson-content-card">
              <h2 class="card-title">오늘의 성찰 질문</h2>
              <ul class="reflection-list">${(course.reflectionQuestions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
            </article>
            <article class="lesson-content-card">
              <h2 class="card-title">나의 한 문장</h2>
              <textarea class="note-field" id="lessonNote" placeholder="오늘 강의에서 남기고 싶은 한 문장을 기록하세요.">${escapeHtml(savedNote)}</textarea>
              <div class="course-actions">
                <button class="secondary-action" type="button" id="saveNote">기록 저장</button>
                <button class="primary-action" type="button" id="completeLesson">${completedSet(progress, course.id).has(activeVideoId) ? '완료 취소' : '학습 완료'}</button>
              </div>
            </article>
          </div>
        </div>

        <aside class="lesson-sidebar">
          <h2>전체 차시</h2>
          <div class="progress-track"><div class="progress-fill" id="lessonProgressFill" style="width:${progressSummary.percent}%"></div></div>
          <div class="progress-copy"><span>${progressSummary.completed}개 완료</span><span>${progressSummary.percent}%</span></div>
          <div class="lesson-list" style="margin-top:16px">${lessonItems(course, videos, progress, activeVideo?.videoId)}</div>
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
      if (completed.has(activeVideoId)) completed.delete(activeVideoId);
      else completed.add(activeVideoId);
      progress.completed[course.id] = [...completed];
      saveProgress(progress);
      renderLesson(catalog, cache, progress);
      showStatus(completed.has(activeVideoId) ? '학습 완료로 기록했습니다.' : '완료 기록을 취소했습니다.');
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
        boxShadow: '0 14px 36px rgba(7,28,67,.28)', fontSize: '12px', fontWeight: '800'
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
