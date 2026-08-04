import fs from 'node:fs/promises';

const COURSE_ID = 'lmc-lifetime-management-counselor';
const DEFAULT_WORKER_URL = 'https://lmc-r2-video-gateway.ros2468.workers.dev';
const DEFAULT_ORIGIN = 'https://daily-coach-ing.com';
const AUTHORIZE_CONCURRENCY = 3;
const REQUEST_TIMEOUT_MS = 35000;

const workerUrl = new URL(process.env.LMC_WORKER_URL || DEFAULT_WORKER_URL);
const origin = String(process.env.LMC_ALLOWED_ORIGIN || DEFAULT_ORIGIN);
const email = String(process.env.LMC_E2E_EMAIL || '').trim().toLowerCase();
const code = String(process.env.LMC_E2E_CODE || '').trim().toUpperCase();

if (workerUrl.protocol !== 'https:') throw new Error('LMC_WORKER_URL must use HTTPS');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('LMC_E2E_EMAIL must be a valid test-student email');
}
if (!/^[A-Z0-9]{8}$/.test(code)) {
  throw new Error('LMC_E2E_CODE must be the 8-character test entry code');
}

const catalogUrl = new URL('../../data/media-catalog.json', import.meta.url);
const catalog = JSON.parse(await fs.readFile(catalogUrl, 'utf8'));
const media = catalog.courses?.[COURSE_ID]?.media;

if (!Array.isArray(media) || media.length !== 77) {
  throw new Error(`Expected exactly 77 media rows, got ${media?.length ?? 0}`);
}
if (media.some((item) => item.status !== 'published')) {
  throw new Error('All 77 media rows must be published before E2E verification');
}

let sessionToken = '';
let loginResult;
try {
  loginResult = await accessRequest({ action: 'login', email, code });
  sessionToken = String(loginResult.token || '');
  if (sessionToken.length < 32 || loginResult.courseId !== COURSE_ID) {
    throw new Error('Worker login returned an invalid session');
  }

  console.log(
    JSON.stringify({
      login: true,
      studentId: String(loginResult.studentId || ''),
      courseId: loginResult.courseId,
      expiresAt: loginResult.expiresAt
    })
  );

  const failures = [];
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: AUTHORIZE_CONCURRENCY }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= media.length) return;
        const item = media[index];

        try {
          const result = await verifyMedia(item, sessionToken);
          console.log(
            `${item.mediaId} | authorize 200 | HEAD 200 | Range 206 | ${result.size} bytes | video/mp4`
          );
        } catch (error) {
          failures.push(`${item.mediaId}: ${publicError(error)}`);
        }
      }
    })
  );

  if (failures.length) {
    throw new Error(`E2E playback verification failed:\n${failures.join('\n')}`);
  }

  await accessRequest({ action: 'logout', token: sessionToken });
  sessionToken = '';

  console.log(
    JSON.stringify({
      ok: true,
      courseId: COURSE_ID,
      mediaCount: media.length,
      authorized200: media.length,
      head200: media.length,
      range206: media.length,
      loggedOut: true
    })
  );
} finally {
  if (sessionToken) {
    await accessRequest({ action: 'logout', token: sessionToken }).catch((error) => {
      console.error(`E2E logout warning: ${publicError(error)}`);
    });
  }
  sessionToken = '';
  loginResult = null;
}

async function verifyMedia(item, token) {
  const authorization = await authorizeWithRetry(item, token);
  const playbackUrl = validatePlaybackUrl(authorization, item);

  const head = await fetchWithTimeout(playbackUrl, {
    method: 'HEAD',
    headers: { Origin: origin, 'Cache-Control': 'no-store' }
  });
  const size = Number(head.headers.get('Content-Length'));
  assertResponse(head.status === 200, `HEAD returned ${head.status}`);
  assertResponse(Number.isSafeInteger(size) && size > 0, 'invalid HEAD Content-Length');
  assertResponse(head.headers.get('Content-Type') === 'video/mp4', 'invalid HEAD Content-Type');
  assertResponse(head.headers.get('Accept-Ranges') === 'bytes', 'missing Accept-Ranges');
  assertResponse(
    head.headers.get('Access-Control-Allow-Origin') === origin,
    'invalid HEAD CORS origin'
  );

  const range = await fetchWithTimeout(playbackUrl, {
    headers: {
      Origin: origin,
      Range: 'bytes=0-0',
      'Cache-Control': 'no-store'
    }
  });
  const rangeBody = new Uint8Array(await range.arrayBuffer());
  assertResponse(range.status === 206, `Range returned ${range.status}`);
  assertResponse(rangeBody.byteLength === 1, `Range returned ${rangeBody.byteLength} bytes`);
  assertResponse(range.headers.get('Content-Length') === '1', 'invalid Range Content-Length');
  assertResponse(
    range.headers.get('Content-Range') === `bytes 0-0/${size}`,
    `invalid Content-Range ${range.headers.get('Content-Range')}`
  );
  assertResponse(range.headers.get('Content-Type') === 'video/mp4', 'invalid Range Content-Type');
  assertResponse(
    range.headers.get('Access-Control-Allow-Origin') === origin,
    'invalid Range CORS origin'
  );

  return { size };
}

async function authorizeWithRetry(item, token) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(new URL('/authorize', workerUrl), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json; charset=utf-8',
          Origin: origin
        },
        body: JSON.stringify({
          token,
          courseId: COURSE_ID,
          week: item.week,
          part: item.part
        })
      });
      const value = await response.json().catch(() => null);
      if (!response.ok || value?.ok !== true) {
        throw new Error(`authorize returned ${response.status}`);
      }
      return value;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 1500);
    }
  }
  throw lastError;
}

async function accessRequest(payload) {
  const response = await fetchWithTimeout(new URL('/access', workerUrl), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      Origin: origin
    },
    body: JSON.stringify({ courseId: COURSE_ID, ...payload })
  });
  const value = await response.json().catch(() => null);
  if (!response.ok || value?.ok !== true) {
    throw new Error(`Worker access request returned ${response.status}`);
  }
  return value;
}

function validatePlaybackUrl(value, item) {
  const url = new URL(String(value.url || ''));
  if (
    url.protocol !== 'https:'
    || url.origin !== workerUrl.origin
    || url.pathname !== `/media/${COURSE_ID}/${item.week}/${item.part}`
    || value.mediaId !== item.mediaId
  ) {
    throw new Error('authorize returned an invalid playback URL');
  }
  return url;
}

function fetchWithTimeout(url, init) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

function assertResponse(condition, message) {
  if (!condition) throw new Error(message);
}

function publicError(error) {
  return error instanceof Error ? error.message : String(error);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
