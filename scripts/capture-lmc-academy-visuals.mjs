import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = 'http://127.0.0.1:4173';
const COURSE_ID = 'lmc-lifetime-management-counselor';
const SESSION_KEY = 'rsedu-academy-access:v1';
const STUDENT_ID = 'REG-20260725000000-VISUAL01';
const PROGRESS_KEY = `rsedu-academy-progress:v2:${encodeURIComponent(STUDENT_ID)}`;
const OUTPUT_DIR = path.resolve('artifacts/lmc-academy-visual-audit');
const WORKER_ORIGIN = 'https://lmc-visual.workers.dev';

// One-frame H.264 MP4 fixture with the moov atom before mdat.
// It exists only to render the native video element during local visual QA.
const VIDEO_FIXTURE = Buffer.from(
  'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMPbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAACgAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAjl0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAACgAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAAoAAAAAAABAAAAAAGxbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAAAgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABXG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAARxzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAK/+EAFmdCwArZHsBEAAADAAQAAAMAyDxImSABAAVoy4PLIAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAf1gAAH9YAAAABhzdHRzAAAAAAAAAAEAAAABAAACAAAAABxzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAUc3RzegAAAAAAAAKMAAAAAQAAABRzdGNvAAAAAAAAAAEAAAM/AAAAYnVkdGEAAABabWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWpdG9vAAAAHWRhdGEAAAABAAAAAExhdmY2MC4xNi4xMDAAAAAIZnJlZQAAApRtZGF0AAACcQYF//9t3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEwOCAzMWUxOWY5IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyMyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTAgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MToweDExMSBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0wIHdlaWdodHA9MCBrZXlpbnQ9MjUwIGtleWludF9taW49MjUgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAATZYiECvEYoAAn7xwABBqjgACBjg==',
  'base64'
);

const targets = [
  { name: 'index', url: '/lcms/academy/index.html', waitFor: '.course-card' },
  { name: 'enter', url: '/lcms/academy/enter.html', waitFor: '#academyEntryForm' },
  {
    name: 'course',
    url: `/lcms/academy/course.html?course=${COURSE_ID}`,
    waitFor: '.course-detail-hero',
    authenticated: true
  },
  {
    name: 'lesson-week-01',
    url: `/lcms/academy/lesson.html?course=${COURSE_ID}&module=0`,
    waitFor: '#r2VideoPlayer',
    authenticated: true,
    expectVideo: true
  },
  {
    name: 'lesson-week-01-lifecycle',
    url: `/lcms/academy/lesson.html?course=${COURSE_ID}&module=0`,
    waitFor: '#r2VideoPlayer',
    authenticated: true,
    expectVideo: true,
    exercisePlayback: true
  },
  {
    name: 'lesson-week-01-pending',
    url: `/lcms/academy/lesson.html?course=${COURSE_ID}&module=0`,
    waitFor: '.video-placeholder',
    authenticated: true,
    pendingWeek: 1,
    expectPending: true
  },
  {
    name: 'lesson-week-01-error',
    url: `/lcms/academy/lesson.html?course=${COURSE_ID}&module=0`,
    waitFor: '.r2-player-state.is-error',
    authenticated: true,
    expectMediaError: true
  },
  {
    name: 'lesson-authorization-error',
    url: `/lcms/academy/lesson.html?course=${COURSE_ID}&module=0`,
    waitFor: '#academyEntryForm',
    authenticated: true,
    authorizationFailure: true,
    expectEntryRedirect: true
  },
  {
    name: 'lesson-unauthenticated',
    url: `/lcms/academy/lesson.html?course=${COURSE_ID}&module=0`,
    waitFor: '#academyEntryForm',
    expectEntryRedirect: true
  },
  {
    name: 'lesson-expired-session',
    url: `/lcms/academy/lesson.html?course=${COURSE_ID}&module=0`,
    waitFor: '#academyEntryForm',
    authenticated: true,
    expiredSession: true,
    expectEntryRedirect: true
  },
  {
    name: 'lesson-week-11',
    url: `/lcms/academy/lesson.html?course=${COURSE_ID}&module=10`,
    waitFor: '#r2VideoPlayer',
    authenticated: true,
    expectVideo: true
  },
  {
    name: 'lesson-week-12',
    url: `/lcms/academy/lesson.html?course=${COURSE_ID}&module=11`,
    waitFor: '.completion-stage',
    authenticated: true,
    expectCompletion: true
  }
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

const mediaCatalog = JSON.parse(await fs.readFile('lcms/academy/data/media-catalog.json', 'utf8'));
mediaCatalog.courses[COURSE_ID].media.forEach((item) => {
  item.status = 'published';
});

function corsHeaders(origin = ROOT) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, ETag',
    Vary: 'Origin'
  };
}

async function configureRoutes(context, stats, options = {}) {
  await context.route('**/lcms/academy/access-config.js', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript; charset=utf-8',
      body: `window.RSEDU_ACADEMY_ACCESS=Object.freeze({
        playbackWorkerUrl:'${WORKER_ORIGIN}',
        courseId:'${COURSE_ID}',
        entryPath:'./enter.html',
        defaultNext:'./course.html?course=${COURSE_ID}',
        storageKey:'${SESSION_KEY}',
        requestTimeoutMs:12000,
        sessionHours:12
      });`
    });
  });

  await context.route('**/lcms/academy/data/media-catalog.json', async (route) => {
    const catalog = JSON.parse(JSON.stringify(mediaCatalog));
    if (options.pendingWeek) {
      const item = catalog.courses[COURSE_ID].media.find((entry) => entry.week === options.pendingWeek);
      if (item) item.status = 'pending_upload';
    }
    await route.fulfill({
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(catalog)
    });
  });

  await context.route(`${WORKER_ORIGIN}/access`, async (route) => {
    stats.accessCalls += 1;
    const request = route.request();
    const origin = request.headers().origin || ROOT;
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(origin) });
      return;
    }
    const payload = request.postDataJSON();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const response = {
      ok: true,
      studentId: STUDENT_ID,
      studentName: '시각검수 수강생',
      courseId: COURSE_ID,
      expiresAt
    };
    if (payload.action === 'login') response.token = 'visual-session-token-000000000000000000000000000000000000';
    if (payload.action === 'logout') response.loggedOut = true;
    await route.fulfill({
      status: 200,
      headers: {
        ...corsHeaders(origin),
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(response)
    });
  });

  await context.route(`${WORKER_ORIGIN}/authorize`, async (route) => {
    const origin = route.request().headers().origin || ROOT;
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(origin) });
      return;
    }
    stats.authorizeCalls += 1;
    if (options.authorizationFailure) {
      await route.fulfill({
        status: 401,
        headers: {
          ...corsHeaders(origin),
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({ ok: false, message: '로그인 세션이 만료되었습니다. 다시 입장해 주세요.' })
      });
      return;
    }
    const requestBody = route.request().postDataJSON();
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + 14400;
    await route.fulfill({
      status: 200,
      headers: {
        ...corsHeaders(origin),
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        ok: true,
        url: `${WORKER_ORIGIN}/media/${COURSE_ID}/${requestBody.week}?exp=${expiresAtSeconds}&sig=visual-fixture`,
        expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
        week: requestBody.week
      })
    });
  });

  await context.route(`${WORKER_ORIGIN}/media/**`, async (route) => {
    stats.mediaCalls += 1;
    const request = route.request();
    const origin = request.headers().origin || ROOT;
    if (options.mediaFailure) {
      await route.fulfill({
        status: 404,
        headers: {
          ...corsHeaders(origin),
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8'
        },
        body: 'missing visual fixture'
      });
      return;
    }
    const headers = {
      ...corsHeaders(origin),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': 'inline',
      'Content-Type': 'video/mp4',
      ETag: '"lmc-visual-fixture"'
    };

    if (request.method() === 'HEAD') {
      await route.fulfill({
        status: 200,
        headers: { ...headers, 'Content-Length': String(VIDEO_FIXTURE.length) }
      });
      return;
    }

    const range = request.headers().range;
    if (!range) {
      await route.fulfill({
        status: 200,
        headers: { ...headers, 'Content-Length': String(VIDEO_FIXTURE.length) },
        body: VIDEO_FIXTURE
      });
      return;
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), VIDEO_FIXTURE.length - 1) : VIDEO_FIXTURE.length - 1;
    if (!match || start < 0 || start >= VIDEO_FIXTURE.length || end < start) {
      await route.fulfill({
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${VIDEO_FIXTURE.length}` }
      });
      return;
    }

    const body = VIDEO_FIXTURE.subarray(start, end + 1);
    await route.fulfill({
      status: 206,
      headers: {
        ...headers,
        'Content-Length': String(body.length),
        'Content-Range': `bytes ${start}-${end}/${VIDEO_FIXTURE.length}`
      },
      body
    });
  });
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];

for (const viewport of viewports) {
  for (const target of targets) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce'
    });
    const stats = { accessCalls: 0, authorizeCalls: 0, mediaCalls: 0 };
    await configureRoutes(context, stats, {
      authorizationFailure: Boolean(target.authorizationFailure),
      mediaFailure: Boolean(target.expectMediaError),
      pendingWeek: target.pendingWeek || 0
    });
    await context.addInitScript(({
      authenticated,
      courseId,
      exercisePlayback,
      expiredSession,
      progressKey,
      sessionKey,
      studentId
    }) => {
      if (location.hostname !== '127.0.0.1') return;
      const marker = '__lmc_visual_initialized';
      if (sessionStorage.getItem(marker) !== '1') {
        localStorage.removeItem(sessionKey);
        localStorage.removeItem(progressKey);
        sessionStorage.clear();
        sessionStorage.setItem(marker, '1');
        if (authenticated) {
          localStorage.setItem(sessionKey, JSON.stringify({
            token: 'visual-session-token-000000000000000000000000000000000000',
            studentId,
            email: 'visual@example.com',
            studentName: '시각검수 수강생',
            courseId,
            expiresAt: new Date(Date.now() + (expiredSession ? -60_000 : 12 * 60 * 60 * 1000)).toISOString()
          }));
        }
        if (exercisePlayback) {
          localStorage.setItem(progressKey, JSON.stringify({
            completed: {},
            notes: {},
            lastViewed: { [courseId]: 'module-01' },
            playback: { [`${courseId}:module-01`]: 15 },
            updatedAt: new Date().toISOString()
          }));
        }
      }
      if (exercisePlayback) {
        const mediaTimes = new WeakMap();
        try {
          Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
            configurable: true,
            get() { return 120; }
          });
          Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
            configurable: true,
            get() { return mediaTimes.get(this) || 0; },
            set(value) { mediaTimes.set(this, Number(value) || 0); }
          });
        } catch {
          /* CI will report the resume assertion if this browser cannot install the deterministic media clock. */
        }
      }
    }, {
      authenticated: Boolean(target.authenticated),
      courseId: COURSE_ID,
      exercisePlayback: Boolean(target.exercisePlayback),
      expiredSession: Boolean(target.expiredSession),
      progressKey: PROGRESS_KEY,
      sessionKey: SESSION_KEY,
      studentId: STUDENT_ID
    });

    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    const url = `${ROOT}${target.url}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector(target.waitFor, { state: 'visible', timeout: 30000 });
    if (target.expectVideo) {
      // Playwright's bundled Chromium can omit patented H.264 decoding even
      // though production Chrome/Safari can play the required MP4 profile.
      // Range delivery is covered by Worker tests; visual QA deterministically
      // emits metadata so the client-side resume listener is still exercised.
      await page.evaluate(() => {
        document.querySelector('#r2VideoPlayer')?.dispatchEvent(new Event('loadedmetadata'));
      });
    }
    let playbackLifecycle = null;
    if (target.exercisePlayback) {
      playbackLifecycle = await page.evaluate(({ courseId, progressKey }) => {
        const firstVideo = document.querySelector('#r2VideoPlayer');
        const resumedAt = Number(firstVideo?.currentTime || 0);
        firstVideo.currentTime = 25;
        firstVideo.dispatchEvent(new Event('timeupdate'));
        const savedBeforeRefresh = JSON.parse(localStorage.getItem(progressKey) || '{}')
          .playback?.[`${courseId}:module-01`];
        return { resumedAt, savedBeforeRefresh };
      }, { courseId: COURSE_ID, progressKey: PROGRESS_KEY });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#r2VideoPlayer', { state: 'visible', timeout: 10000 });
      await page.evaluate(() => {
        document.querySelector('#r2VideoPlayer')?.dispatchEvent(new Event('loadedmetadata'));
      });
      await page.waitForTimeout(250);
      const afterRefresh = await page.evaluate(({ courseId, progressKey }) => {
        const video = document.querySelector('#r2VideoPlayer');
        const resumedAfterRefresh = Number(video?.currentTime || 0);
        video.dispatchEvent(new Event('ended'));
        const progress = JSON.parse(localStorage.getItem(progressKey) || '{}');
        return {
          resumedAfterRefresh,
          playbackCleared: !Object.prototype.hasOwnProperty.call(
            progress.playback || {},
            `${courseId}:module-01`
          ),
          autoCompleted: Array.isArray(progress.completed?.[courseId])
            && progress.completed[courseId].includes('module-01'),
          completeButton: Boolean(document.querySelector('[data-action="toggle-complete"].is-complete'))
        };
      }, { courseId: COURSE_ID, progressKey: PROGRESS_KEY });
      playbackLifecycle = { ...playbackLifecycle, ...afterRefresh };
    }
    let mediaCallsStable = true;
    if (target.expectMediaError) {
      const callsAfterError = stats.mediaCalls;
      await page.waitForTimeout(750);
      mediaCallsStable = stats.mediaCalls === callsAfterError;
    }
    await page.waitForTimeout(500);

    const prefix = `${target.name}-${viewport.name}`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${prefix}-viewport.png`), fullPage: false });
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${prefix}-full.png`), fullPage: true });

    const metrics = await page.evaluate(({
      expectCompletion,
      expectEntryRedirect,
      expectMediaError,
      expectPending,
      expectVideo
    }) => {
      const doc = document.documentElement;
      const bodyText = document.body.innerText || '';
      const video = document.querySelector('#r2VideoPlayer');
      const completion = document.querySelector('.completion-stage');
      const inspected = [
        '.cip-header-inner',
        '.academy-hero',
        '.entry-layout',
        '.course-detail-hero',
        '.lesson-layout',
        '.video-stage',
        '.completion-stage',
        '.lesson-sidebar',
        '.mobile-learning-bar'
      ].flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          selector,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          clippedLeft: rect.left < -1,
          clippedRight: rect.right > doc.clientWidth + 1
        };
      }));

      return {
        title: document.title,
        documentWidth: doc.scrollWidth,
        viewportWidth: doc.clientWidth,
        horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
        clippedElements: inspected.filter((item) => item.clippedLeft || item.clippedRight),
        legacyCopy: /vimeo|google\s*drive|drive-video/i.test(bodyText),
        expectVideo,
        expectCompletion,
        expectEntryRedirect,
        expectMediaError,
        expectPending,
        hasVideo: Boolean(video),
        hasCompletion: Boolean(completion),
        hasPendingState: Boolean(document.querySelector('.video-placeholder')),
        hasStableMediaError: Boolean(document.querySelector('.r2-player-state.is-error')),
        currentPath: location.pathname,
        videoAttributes: video ? {
          controls: video.controls,
          playsInline: video.playsInline,
          preload: video.preload,
          controlsList: video.controlsList.value,
          disablePictureInPicture: video.disablePictureInPicture,
          disableRemotePlayback: video.disableRemotePlayback
        } : null
      };
    }, {
      expectVideo: Boolean(target.expectVideo),
      expectCompletion: Boolean(target.expectCompletion),
      expectEntryRedirect: Boolean(target.expectEntryRedirect),
      expectMediaError: Boolean(target.expectMediaError),
      expectPending: Boolean(target.expectPending)
    });

    const failures = [];
    const unexpectedConsoleErrors = target.expectMediaError
      ? consoleErrors.filter((message) => !/Failed to load resource/i.test(message))
      : consoleErrors;
    if (unexpectedConsoleErrors.length) failures.push(`console: ${unexpectedConsoleErrors.join(' | ')}`);
    if (metrics.horizontalOverflow) failures.push(`horizontal overflow ${metrics.documentWidth}/${metrics.viewportWidth}`);
    if (metrics.clippedElements.length) failures.push(`clipped elements: ${metrics.clippedElements.length}`);
    if (metrics.legacyCopy) failures.push('legacy Vimeo/Drive copy');
    if (metrics.expectVideo && !metrics.hasVideo) failures.push('R2 video element missing');
    if (metrics.expectCompletion && (!metrics.hasCompletion || metrics.hasVideo)) failures.push('week 12 video/completion branch mismatch');
    if (metrics.expectPending && (!metrics.hasPendingState || metrics.hasVideo)) failures.push('pending-upload state mismatch');
    if (metrics.expectEntryRedirect && !metrics.currentPath.endsWith('/enter.html')) failures.push('protected lesson did not redirect to entry');
    if (
      metrics.expectMediaError
      && (!metrics.hasStableMediaError || metrics.hasVideo || !mediaCallsStable || stats.authorizeCalls !== 1)
    ) failures.push('persistent media error triggered a playback remount loop');
    if (target.expectCompletion && (stats.authorizeCalls !== 0 || stats.mediaCalls !== 0)) {
      failures.push('week 12 requested a playback URL or media object');
    }
    if (target.expectPending && (stats.authorizeCalls !== 0 || stats.mediaCalls !== 0)) {
      failures.push('pending lesson requested a playback URL or media object');
    }
    if (target.authorizationFailure && (stats.authorizeCalls !== 1 || stats.mediaCalls !== 0)) {
      failures.push('authorization denial did not stop before media access');
    }
    if (target.exercisePlayback && (
      playbackLifecycle?.resumedAt !== 15
      || playbackLifecycle?.savedBeforeRefresh !== 25
      || playbackLifecycle?.resumedAfterRefresh !== 25
      || !playbackLifecycle?.playbackCleared
      || !playbackLifecycle?.autoCompleted
      || !playbackLifecycle?.completeButton
    )) failures.push('resume, five-second persistence, or ended auto-completion failed');
    if (metrics.videoAttributes && (
      !metrics.videoAttributes.controls
      || !metrics.videoAttributes.playsInline
      || metrics.videoAttributes.preload !== 'metadata'
      || !metrics.videoAttributes.controlsList.includes('nodownload')
      || !metrics.videoAttributes.controlsList.includes('noremoteplayback')
      || !metrics.videoAttributes.disablePictureInPicture
      || !metrics.videoAttributes.disableRemotePlayback
    )) failures.push('native video security attributes mismatch');

    report.push({
      page: target.name,
      url: target.url,
      viewport: viewport.name,
      captureViewport: { width: viewport.width, height: viewport.height },
      consoleErrors,
      accessCalls: stats.accessCalls,
      authorizeCalls: stats.authorizeCalls,
      mediaCalls: stats.mediaCalls,
      playbackLifecycle,
      failures,
      ...metrics
    });

    await context.close();
  }
}

await browser.close();
await fs.writeFile(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

console.table(report.map((item) => ({
  page: item.page,
  viewport: item.viewport,
  overflow: item.horizontalOverflow,
  video: item.hasVideo,
  completion: item.hasCompletion,
  authorize: item.authorizeCalls,
  failures: item.failures.length
})));

const failed = report.filter((item) => item.failures.length);
if (failed.length) {
  console.error(JSON.stringify(failed.map((item) => ({
    page: item.page,
    viewport: item.viewport,
    failures: item.failures
  })), null, 2));
  process.exitCode = 1;
}
