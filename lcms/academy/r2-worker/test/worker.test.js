import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import worker from '../src/index.js';
import { MEDIA_CATALOG } from '../src/media-catalog.js';

const COURSE_ID = 'lmc-lifetime-management-counselor';
const ALLOWED_ORIGIN = 'https://daily-coach-ing.com';
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const media of MEDIA_CATALOG.values()) media.status = 'pending_upload';
});

test('worker media allowlist contains exactly 77 unique week/part entries and no week 12', () => {
  const media = [...MEDIA_CATALOG.values()];
  assert.equal(media.length, 77);
  assert.equal(new Set(media.map((item) => item.mediaId)).size, 77);
  assert.equal(new Set(media.map((item) => item.objectKey)).size, 77);
  assert.equal(media.some((item) => item.week === 12), false);
  assert.equal(media.every((item) => /^lmc\/v2\/week-\d{2}\/part-\d{2}\.mp4$/.test(item.objectKey)), true);
});

test('GET /health is public, but other methods are rejected', async () => {
  const health = await worker.fetch(new Request('https://worker.example/health'), baseEnv());
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    ok: true,
    service: 'lmc-r2-video-gateway'
  });
  assert.equal(health.headers.get('Cache-Control'), 'no-store');

  const post = await worker.fetch(
    new Request('https://worker.example/health', { method: 'POST' }),
    baseEnv()
  );
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('Allow'), 'GET, OPTIONS');
});

test('CORS preflight permits the two academy origins and required media headers', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/authorize', {
      method: 'OPTIONS',
      headers: { Origin: 'https://www.daily-coach-ing.com' }
    }),
    baseEnv()
  );

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get('Access-Control-Allow-Origin'),
    'https://www.daily-coach-ing.com'
  );
  assert.match(response.headers.get('Access-Control-Allow-Methods'), /POST/);
  assert.match(response.headers.get('Access-Control-Allow-Headers'), /Range/);
  assert.match(response.headers.get('Access-Control-Allow-Headers'), /If-Range/);
});

test('/authorize requires an exact Origin and does not trust Referer fallback', async () => {
  let validationCalls = 0;
  globalThis.fetch = async () => {
    validationCalls += 1;
    throw new Error('must not be called');
  };

  const response = await worker.fetch(
    authorizeRequest({
      origin: null,
      headers: { Referer: `${ALLOWED_ORIGIN}/lcms/academy/lesson.html` }
    }),
    baseEnv()
  );

  assert.equal(response.status, 403);
  assert.equal(validationCalls, 0);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

test('/authorize rejects week 12 and unknown parts before calling Apps Script', async () => {
  let validationCalls = 0;
  globalThis.fetch = async () => {
    validationCalls += 1;
    throw new Error('must not be called');
  };

  const response = await worker.fetch(authorizeRequest({ week: 12 }), baseEnv());
  assert.equal(response.status, 400);
  const unknownPart = await worker.fetch(authorizeRequest({ week: 1, part: 99 }), baseEnv());
  assert.equal(unknownPart.status, 400);
  assert.equal(validationCalls, 0);
});

test('/authorize blocks catalog entries until the verified media status is published', async () => {
  let validationCalls = 0;
  globalThis.fetch = async () => { validationCalls += 1; throw new Error('must not be called'); };
  const response = await worker.fetch(authorizeRequest({ week: 1, part: 1 }), baseEnv());
  assert.equal(response.status, 403);
  assert.equal(validationCalls, 0);
});

test('/authorize fails closed when a required secret is missing', async () => {
  const env = baseEnv();
  delete env.ACCESS_API_SECRET;
  let validationCalls = 0;
  globalThis.fetch = async () => {
    validationCalls += 1;
    throw new Error('must not be called');
  };

  const response = await worker.fetch(authorizeRequest(), env);
  assert.equal(response.status, 503);
  assert.equal(validationCalls, 0);
});

test('/authorize uses workerValidate POST contract and caps playback at session expiry', async () => {
  setPublished(1, 1);
  const sessionExpiry = new Date(Date.now() + 20 * 60 * 1000);
  let capturedUrl;
  let capturedOptions;
  globalThis.fetch = async (url, options) => {
    capturedUrl = String(url);
    capturedOptions = options;
    return Response.json({
      ok: true,
      valid: true,
      studentId: 'STU_TEST',
      studentName: '테스트',
      courseId: COURSE_ID,
      expiresAt: sessionExpiry.toISOString()
    });
  };

  const response = await worker.fetch(
    authorizeRequest({
      headers: { 'User-Agent': 'Browser-UA/1.0' },
      bodyUserAgent: 'spoofed-body-UA'
    }),
    baseEnv()
  );
  assert.equal(response.status, 200);

  const upstreamUrl = new URL(capturedUrl);
  assert.equal(upstreamUrl.protocol, 'https:');
  assert.equal(upstreamUrl.search, '');
  assert.equal(capturedOptions.method, 'POST');
  const upstreamBody = JSON.parse(capturedOptions.body);
  assert.deepEqual(upstreamBody, {
    action: 'workerValidate',
    token: 't'.repeat(48),
    courseId: COURSE_ID,
    workerSecret: 'a'.repeat(48),
    userAgent: 'Browser-UA/1.0'
  });

  const result = await response.json();
  const playbackUrl = new URL(result.url);
  const issuedExpiry = Number(playbackUrl.searchParams.get('exp'));
  assert.equal(playbackUrl.pathname, `/media/${COURSE_ID}/1/1`);
  assert.equal(result.week, 1);
  assert.equal(result.part, 1);
  assert.equal(result.mediaId, 'lmc-w01-p01');
  assert.equal(playbackUrl.searchParams.has('token'), false);
  assert.match(playbackUrl.searchParams.get('sig'), /^[A-Za-z0-9_-]{43}$/);
  assert.ok(issuedExpiry <= Math.floor(sessionExpiry.getTime() / 1000));
  assert.ok(issuedExpiry > Math.floor(Date.now() / 1000));
});

test('/authorize fails closed on valid:false and malformed upstream success', async () => {
  setPublished(1, 1);
  for (const upstreamPayload of [
    { ok: true, valid: false },
    {
      ok: true,
      valid: true,
      courseId: 'wrong-course',
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    }
  ]) {
    globalThis.fetch = async () => Response.json(upstreamPayload);
    const response = await worker.fetch(authorizeRequest(), baseEnv());
    assert.equal(response.status, 401);
  }
});

test('/access proxies login in a POST body without exposing the Apps Script URL or shared secret', async () => {
  let capturedUrl;
  let capturedOptions;
  globalThis.fetch = async (url, options) => {
    capturedUrl = String(url);
    capturedOptions = options;
    return Response.json({
      ok: true,
      token: 's'.repeat(48),
      studentId: 'REG-TEST',
      studentName: '테스트 수강생',
      courseId: COURSE_ID,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    });
  };

  const response = await worker.fetch(
    accessRequest({
      action: 'login',
      email: 'Student@Example.com',
      code: 'ABCD 1234',
      headers: { 'User-Agent': 'Browser-UA/2.0' }
    }),
    baseEnv()
  );
  assert.equal(response.status, 200);
  assert.equal(new URL(capturedUrl).search, '');
  assert.equal(capturedOptions.method, 'POST');
  const upstreamBody = JSON.parse(capturedOptions.body);
  assert.deepEqual(upstreamBody, {
    action: 'login',
    courseId: COURSE_ID,
    workerSecret: 'a'.repeat(48),
    ua: 'Browser-UA/2.0',
    email: 'student@example.com',
    code: 'ABCD1234'
  });

  const result = await response.json();
  assert.equal(result.studentId, 'REG-TEST');
  assert.equal(result.token, 's'.repeat(48));
  assert.equal(JSON.stringify(result).includes('script.google.com'), false);
  assert.equal(JSON.stringify(result).includes('a'.repeat(48)), false);
});

test('/access rejects disallowed origins and unsupported actions before Apps Script', async () => {
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    throw new Error('must not be called');
  };

  const badOrigin = await worker.fetch(
    accessRequest({ origin: 'https://evil.example', action: 'login' }),
    baseEnv()
  );
  assert.equal(badOrigin.status, 403);

  const badAction = await worker.fetch(
    accessRequest({ action: 'confirmPayment' }),
    baseEnv()
  );
  assert.equal(badAction.status, 400);
  assert.equal(upstreamCalls, 0);
});

test('/access validates upstream session shape and forwards only safe denial messages', async () => {
  globalThis.fetch = async () => Response.json({
    ok: false,
    message: '로그인 시간이 만료되었습니다. 다시 입장해 주세요.'
  });
  const denied = await worker.fetch(
    accessRequest({ action: 'validate', token: 't'.repeat(48) }),
    baseEnv()
  );
  assert.equal(denied.status, 401);
  assert.deepEqual(await denied.json(), {
    ok: false,
    message: '로그인 시간이 만료되었습니다. 다시 입장해 주세요.'
  });

  globalThis.fetch = async () => Response.json({
    ok: true,
    studentName: '학생',
    courseId: COURSE_ID,
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  });
  const malformed = await worker.fetch(
    accessRequest({ action: 'validate', token: 't'.repeat(48) }),
    baseEnv()
  );
  assert.equal(malformed.status, 502);
});

test('signed /media Range request reads only the fixed R2 key and returns 206', async () => {
  const env = baseEnv();
  let getKey;
  let getOptions;
  env.VIDEOS.get = async (key, options) => {
    getKey = key;
    getOptions = options;
    return r2Object({
      body: new Uint8Array([1, 2, 3]),
      range: { offset: 100, length: 100 }
    });
  };
  const playbackUrl = await issuePlaybackUrl(env, 1, 1);

  const response = await worker.fetch(
    new Request(playbackUrl, {
      headers: {
        Origin: ALLOWED_ORIGIN,
        Range: 'bytes=100-199'
      }
    }),
    env
  );

  assert.equal(response.status, 206);
  assert.equal(getKey, 'lmc/v2/week-01/part-01.mp4');
  assert.equal(getOptions.range.get('Range'), 'bytes=100-199');
  assert.equal(response.headers.get('Content-Range'), 'bytes 100-199/1000');
  assert.equal(response.headers.get('Content-Length'), '100');
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(response.headers.get('Content-Type'), 'video/mp4');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), ALLOWED_ORIGIN);
});

test('/media rejects disallowed origins and tampered signatures before R2 access', async () => {
  const env = baseEnv();
  let reads = 0;
  env.VIDEOS.get = async () => {
    reads += 1;
    throw new Error('must not be called');
  };
  const playbackUrl = await issuePlaybackUrl(env, 2, 3);

  const badOrigin = await worker.fetch(
    new Request(playbackUrl, { headers: { Origin: 'https://evil.example' } }),
    env
  );
  assert.equal(badOrigin.status, 403);

  const tamperedUrl = new URL(playbackUrl);
  const signature = tamperedUrl.searchParams.get('sig');
  const replacement = signature.endsWith('A') ? 'B' : 'A';
  tamperedUrl.searchParams.set('sig', `${signature.slice(0, -1)}${replacement}`);
  const tampered = await worker.fetch(
    new Request(tamperedUrl, { headers: { Origin: ALLOWED_ORIGIN } }),
    env
  );
  assert.equal(tampered.status, 401);
  assert.equal(reads, 0);
});

test('/media rejects week 12 and invalid or multi-part Range requests', async () => {
  const env = baseEnv();
  let reads = 0;
  env.VIDEOS.get = async () => {
    reads += 1;
    throw new Error('must not be called');
  };
  const playbackUrl = await issuePlaybackUrl(env, 1, 1);

  const weekTwelveUrl = new URL(playbackUrl);
  weekTwelveUrl.pathname = `/media/${COURSE_ID}/12/1`;
  const weekTwelve = await worker.fetch(
    new Request(weekTwelveUrl, { headers: { Origin: ALLOWED_ORIGIN } }),
    env
  );
  assert.equal(weekTwelve.status, 401);

  const invalidRange = await worker.fetch(
    new Request(playbackUrl, {
      headers: {
        Origin: ALLOWED_ORIGIN,
        Range: 'bytes=0-99,200-299'
      }
    }),
    env
  );
  assert.equal(invalidRange.status, 416);
  assert.equal(reads, 0);
});

test('HEAD /media returns metadata without reading the object body', async () => {
  const env = baseEnv();
  let headKey;
  let bodyReads = 0;
  env.VIDEOS.head = async (key) => {
    headKey = key;
    return r2Object({ body: undefined });
  };
  env.VIDEOS.get = async () => {
    bodyReads += 1;
    throw new Error('must not be called');
  };
  const playbackUrl = await issuePlaybackUrl(env, 11, 7);

  const response = await worker.fetch(
    new Request(playbackUrl, {
      method: 'HEAD',
      headers: { Origin: 'https://www.daily-coach-ing.com' }
    }),
    env
  );

  assert.equal(response.status, 200);
  assert.equal(headKey, 'lmc/v2/week-11/part-07.mp4');
  assert.equal(bodyReads, 0);
  assert.equal(response.headers.get('Content-Length'), '1000');
});

test('an already signed /media URL keeps streaming during an Apps Script outage', async () => {
  const env = baseEnv();
  const playbackUrl = await issuePlaybackUrl(env, 3, 4);
  delete env.ACCESS_API_URL;
  delete env.ACCESS_API_SECRET;

  const response = await worker.fetch(
    new Request(playbackUrl, { headers: { Origin: ALLOWED_ORIGIN } }),
    env
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'video/mp4');
});

function baseEnv() {
  return {
    COURSE_ID,
    PLAYBACK_TTL_SECONDS: '14400',
    ACCESS_API_URL: 'https://script.google.com/macros/s/test-deployment/exec',
    PLAYBACK_SECRET: 'p'.repeat(48),
    ACCESS_API_SECRET: 'a'.repeat(48),
    VIDEOS: {
      async head() {
        return r2Object({ body: undefined });
      },
      async get() {
        return r2Object({ body: new Uint8Array([1, 2, 3]) });
      }
    }
  };
}

function authorizeRequest({
  week = 1,
  part = 1,
  origin = ALLOWED_ORIGIN,
  headers = {},
  bodyUserAgent = 'body-UA'
} = {}) {
  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    ...headers
  });
  if (origin) requestHeaders.set('Origin', origin);

  return new Request('https://worker.example/authorize', {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({
      token: 't'.repeat(48),
      courseId: COURSE_ID,
      week,
      part,
      userAgent: bodyUserAgent
    })
  });
}

function accessRequest({
  action = 'login',
  origin = ALLOWED_ORIGIN,
  email = 'student@example.com',
  code = 'ABCD1234',
  token,
  headers = {}
} = {}) {
  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    ...headers
  });
  if (origin) requestHeaders.set('Origin', origin);
  return new Request('https://worker.example/access', {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({
      action,
      courseId: COURSE_ID,
      email,
      code,
      token,
      ua: 'body-UA',
      workerSecret: 'attacker-controlled'
    })
  });
}

async function issuePlaybackUrl(env, week, part = 1) {
  setPublished(week, part);
  globalThis.fetch = async () => Response.json({
    ok: true,
    valid: true,
    studentId: 'STU_TEST',
    studentName: '테스트',
    courseId: COURSE_ID,
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
  });
  const response = await worker.fetch(authorizeRequest({ week, part }), env);
  assert.equal(response.status, 200);
  return (await response.json()).url;
}

function setPublished(week, part) {
  const media = MEDIA_CATALOG.get(`${week}:${part}`);
  assert.ok(media, `catalog entry ${week}:${part}`);
  media.status = 'published';
  return media;
}

function r2Object({ body, range } = {}) {
  const object = {
    size: 1000,
    range,
    httpMetadata: { contentType: 'video/mp4' },
    httpEtag: '"test-etag"',
    writeHttpMetadata(headers) {
      headers.set('Content-Type', 'video/mp4');
    }
  };
  if (body !== undefined) object.body = body;
  return object;
}
