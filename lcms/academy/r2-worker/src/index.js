const COURSE_ID = 'lmc-lifetime-management-counselor';
const ALLOWED_ORIGINS = new Set([
  'https://daily-coach-ing.com',
  'https://www.daily-coach-ing.com'
]);
const DEFAULT_PLAYBACK_TTL_SECONDS = 14400;
const MIN_PLAYBACK_TTL_SECONDS = 900;
const MAX_PLAYBACK_TTL_SECONDS = 14400;
const EXPIRY_CLOCK_SKEW_SECONDS = 30;
const MAX_AUTHORIZE_BODY_CHARS = 8192;
const MAX_SESSION_TOKEN_CHARS = 512;
const MAX_USER_AGENT_CHARS = 500;
const MAX_EMAIL_CHARS = 254;
const ACCESS_API_TIMEOUT_MS = 10000;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const BROWSER_ACCESS_ACTIONS = new Set(['login', 'validate', 'logout']);

const LESSON_OBJECTS = Object.freeze({
  1: 'lmc/week-01.mp4',
  2: 'lmc/week-02.mp4',
  3: 'lmc/week-03.mp4',
  4: 'lmc/week-04.mp4',
  5: 'lmc/week-05.mp4',
  6: 'lmc/week-06.mp4',
  7: 'lmc/week-07.mp4',
  8: 'lmc/week-08.mp4',
  9: 'lmc/week-09.mp4',
  10: 'lmc/week-10.mp4',
  11: 'lmc/week-11.mp4'
});

const encoder = new TextEncoder();

export default {
  async fetch(request, env) {
    const origin = resolveAllowedOrigin(request);

    try {
      const url = new URL(request.url);

      if (request.method === 'OPTIONS') return corsPreflight(origin);

      if (url.pathname === '/health') {
        if (request.method !== 'GET') return methodNotAllowed('GET, OPTIONS', origin);
        return json(
          { ok: true, service: 'lmc-r2-video-gateway' },
          200,
          origin,
          { 'Cache-Control': 'no-store' }
        );
      }

      if (url.pathname === '/authorize') {
        if (request.method !== 'POST') return methodNotAllowed('POST, OPTIONS', origin);
        return authorize(request, env, origin);
      }

      if (url.pathname === '/access') {
        if (request.method !== 'POST') return methodNotAllowed('POST, OPTIONS', origin);
        return browserAccess(request, env, origin);
      }

      if (url.pathname.startsWith('/media/')) {
        return serveMedia(request, env, origin, url);
      }

      return text('Not Found', 404, origin);
    } catch (error) {
      console.error('[LMC R2 Worker] Unhandled request error', safeErrorName(error));
      return json(
        { ok: false, message: '요청을 처리하지 못했습니다.' },
        500,
        origin,
        { 'Cache-Control': 'no-store' }
      );
    }
  }
};

async function authorize(request, env, origin) {
  if (!origin) {
    return json(
      { ok: false, message: '허용되지 않은 사이트입니다.' },
      403,
      null,
      { 'Cache-Control': 'no-store' }
    );
  }

  const configurationError = validateConfiguration(env, {
    requireAccessApi: true,
    requireBucket: false
  });
  if (configurationError) {
    console.error('[LMC R2 Worker] Configuration error', configurationError);
    return json(
      { ok: false, message: '재생 게이트 설정이 완료되지 않았습니다.' },
      503,
      origin,
      { 'Cache-Control': 'no-store' }
    );
  }

  const parsedBody = await readAuthorizeBody(request);
  if (!parsedBody.ok) {
    return json(
      { ok: false, message: parsedBody.message },
      parsedBody.status,
      origin,
      { 'Cache-Control': 'no-store' }
    );
  }

  const token = String(parsedBody.value.token || '').trim();
  const courseId = String(parsedBody.value.courseId || '').trim();
  const week = Number(parsedBody.value.week);

  if (
    token.length < 32
    || token.length > MAX_SESSION_TOKEN_CHARS
    || courseId !== COURSE_ID
    || !Number.isInteger(week)
    || !LESSON_OBJECTS[week]
  ) {
    return json(
      { ok: false, message: '수강정보 또는 차시정보가 올바르지 않습니다.' },
      400,
      origin,
      { 'Cache-Control': 'no-store' }
    );
  }

  const userAgent = String(
    request.headers.get('User-Agent') || parsedBody.value.userAgent || ''
  ).slice(0, MAX_USER_AGENT_CHARS);

  const validationResult = await validateAccessWithAppsScript(env, {
    token,
    courseId,
    userAgent
  });

  if (!validationResult.ok) {
    const status = validationResult.unavailable ? 502 : 401;
    const message = validationResult.unavailable
      ? '수강권한 확인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      : '현재 수강권한으로 영상을 재생할 수 없습니다.';
    return json(
      { ok: false, message },
      status,
      origin,
      { 'Cache-Control': 'no-store' }
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const sessionExpiresAt = parseFutureEpochSeconds(validationResult.value.expiresAt);
  if (!sessionExpiresAt || sessionExpiresAt <= nowSeconds + EXPIRY_CLOCK_SKEW_SECONDS) {
    return json(
      { ok: false, message: '로그인 세션이 만료되었습니다. 다시 입장해 주세요.' },
      401,
      origin,
      { 'Cache-Control': 'no-store' }
    );
  }

  const ttl = playbackTtlSeconds(env);
  const expiresAt = Math.min(nowSeconds + ttl, sessionExpiresAt);
  const objectKey = LESSON_OBJECTS[week];
  const signature = await sign(
    env.PLAYBACK_SECRET,
    signaturePayload(courseId, week, objectKey, expiresAt)
  );
  const playbackUrl = new URL(request.url);
  playbackUrl.pathname = `/media/${encodeURIComponent(courseId)}/${week}`;
  playbackUrl.search = '';
  playbackUrl.searchParams.set('exp', String(expiresAt));
  playbackUrl.searchParams.set('sig', signature);

  return json(
    {
      ok: true,
      url: playbackUrl.toString(),
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      week
    },
    200,
    origin,
    { 'Cache-Control': 'no-store' }
  );
}

async function browserAccess(request, env, origin) {
  if (!origin) {
    return json(
      { ok: false, message: '허용되지 않은 사이트입니다.' },
      403,
      null,
      { 'Cache-Control': 'no-store' }
    );
  }

  const configurationError = validateConfiguration(env, {
    requireAccessApi: true,
    requireBucket: false
  });
  if (configurationError) {
    console.error('[LMC R2 Worker] Configuration error', configurationError);
    return json(
      { ok: false, message: '강의실 인증 게이트 설정이 완료되지 않았습니다.' },
      503,
      origin,
      { 'Cache-Control': 'no-store' }
    );
  }

  const parsedBody = await readAuthorizeBody(request);
  if (!parsedBody.ok) {
    return json(
      { ok: false, message: parsedBody.message },
      parsedBody.status,
      origin,
      { 'Cache-Control': 'no-store' }
    );
  }

  const action = String(parsedBody.value.action || '').trim().toLowerCase();
  const courseId = String(parsedBody.value.courseId || COURSE_ID).trim();
  if (!BROWSER_ACCESS_ACTIONS.has(action) || courseId !== COURSE_ID) {
    return json(
      { ok: false, message: '인증 요청이 올바르지 않습니다.' },
      400,
      origin,
      { 'Cache-Control': 'no-store' }
    );
  }

  const upstreamPayload = {
    action,
    courseId,
    workerSecret: env.ACCESS_API_SECRET,
    ua: String(
      request.headers.get('User-Agent') || parsedBody.value.ua || ''
    ).slice(0, MAX_USER_AGENT_CHARS)
  };

  if (action === 'login') {
    const email = String(parsedBody.value.email || '').trim().toLowerCase();
    const code = String(parsedBody.value.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (
      !email
      || email.length > MAX_EMAIL_CHARS
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || code.length !== 8
    ) {
      return json(
        { ok: false, message: '이메일 또는 입장코드 형식을 확인해 주세요.' },
        400,
        origin,
        { 'Cache-Control': 'no-store' }
      );
    }
    upstreamPayload.email = email;
    upstreamPayload.code = code;
  } else {
    const token = String(parsedBody.value.token || '').trim();
    if (token.length < 32 || token.length > MAX_SESSION_TOKEN_CHARS) {
      return json(
        { ok: false, message: '로그인 시간이 만료되었습니다. 다시 입장해 주세요.' },
        401,
        origin,
        { 'Cache-Control': 'no-store' }
      );
    }
    upstreamPayload.token = token;
  }

  const upstream = await postToAccessApi(env, upstreamPayload);
  if (!upstream.ok) {
    return json(
      { ok: false, message: '수강권한 확인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      502,
      origin,
      { 'Cache-Control': 'no-store' }
    );
  }

  const value = upstream.value;
  if (value.ok !== true) {
    return json(
      {
        ok: false,
        message: String(value.message || '입장 정보를 확인하지 못했습니다.').slice(0, 240)
      },
      action === 'logout' ? 400 : 401,
      origin,
      { 'Cache-Control': 'no-store' }
    );
  }

  if (action === 'logout') {
    return json(
      { ok: true, loggedOut: value.loggedOut === true },
      200,
      origin,
      { 'Cache-Control': 'no-store' }
    );
  }

  const expiresAt = parseFutureEpochSeconds(value.expiresAt);
  const studentId = String(value.studentId || '').trim();
  if (
    !expiresAt
    || !studentId
    || studentId.length > 128
    || value.courseId !== COURSE_ID
    || (action === 'login'
      && (typeof value.token !== 'string'
        || value.token.length < 32
        || value.token.length > MAX_SESSION_TOKEN_CHARS))
  ) {
    return json(
      { ok: false, message: '인증 서버 응답이 올바르지 않습니다.' },
      502,
      origin,
      { 'Cache-Control': 'no-store' }
    );
  }

  const result = {
    ok: true,
    studentId,
    studentName: String(value.studentName || '').slice(0, 120),
    courseId: COURSE_ID,
    expiresAt: value.expiresAt
  };
  if (action === 'login') result.token = value.token;
  return json(result, 200, origin, { 'Cache-Control': 'no-store' });
}

async function validateAccessWithAppsScript(env, payload) {
  const upstream = await postToAccessApi(env, {
    action: 'workerValidate',
    token: payload.token,
    courseId: payload.courseId,
    workerSecret: env.ACCESS_API_SECRET,
    userAgent: payload.userAgent
  });
  if (!upstream.ok) return { ok: false, unavailable: true };
  const value = upstream.value;

  if (
    value.ok !== true
    || value.valid !== true
    || value.courseId !== payload.courseId
    || !parseFutureEpochSeconds(value.expiresAt)
  ) {
    return { ok: false, unavailable: false };
  }

  return { ok: true, value };
}

async function postToAccessApi(env, payload) {
  let endpoint;
  try {
    endpoint = new URL(env.ACCESS_API_URL);
    if (endpoint.protocol !== 'https:') return { ok: false };
  } catch {
    return { ok: false };
  }

  let response;
  try {
    response = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: AbortSignal.timeout(ACCESS_API_TIMEOUT_MS)
    });
  } catch (error) {
    console.error('[LMC R2 Worker] Access validation request failed', safeErrorName(error));
    return { ok: false };
  }

  const value = await response.json().catch(() => null);
  if (!response.ok || !value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false };
  }
  return { ok: true, value };
}

async function serveMedia(request, env, origin, url) {
  if (!origin) return text('Forbidden', 403, null);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return methodNotAllowed('GET, HEAD, OPTIONS', origin);
  }

  const configurationError = validateConfiguration(env, {
    requireAccessApi: false,
    requireBucket: true
  });
  if (configurationError) {
    console.error('[LMC R2 Worker] Configuration error', configurationError);
    return text('Service Unavailable', 503, origin);
  }

  const match = /^\/media\/([^/]+)\/(\d+)$/.exec(url.pathname);
  if (!match) return text('Not Found', 404, origin);

  let courseId;
  try {
    courseId = decodeURIComponent(match[1]);
  } catch {
    return text('Not Found', 404, origin);
  }

  const week = Number(match[2]);
  const objectKey = LESSON_OBJECTS[week];
  const expiresAt = parseInteger(url.searchParams.get('exp'));
  const suppliedSignature = String(url.searchParams.get('sig') || '');
  const nowSeconds = Math.floor(Date.now() / 1000);
  const latestAllowedExpiry = nowSeconds
    + playbackTtlSeconds(env)
    + EXPIRY_CLOCK_SKEW_SECONDS;

  if (
    courseId !== COURSE_ID
    || !Number.isInteger(week)
    || !objectKey
    || !expiresAt
    || expiresAt <= nowSeconds
    || expiresAt > latestAllowedExpiry
  ) {
    return text('Playback URL expired or invalid', 401, origin);
  }

  if (!SIGNATURE_PATTERN.test(suppliedSignature)) {
    return text('Invalid signature', 401, origin);
  }

  const expectedSignature = await sign(
    env.PLAYBACK_SECRET,
    signaturePayload(courseId, week, objectKey, expiresAt)
  );
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) {
    return text('Invalid signature', 401, origin);
  }

  const rangeHeader = request.headers.get('Range');
  if (rangeHeader && !isValidSingleRange(rangeHeader)) {
    const headers = corsHeaders(origin);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'no-store');
    return new Response('Range Not Satisfiable', { status: 416, headers });
  }

  if (request.method === 'HEAD') {
    const head = await env.VIDEOS.head(objectKey);
    if (!head) return text('Object Not Found', 404, origin);
    const headers = mediaHeaders(head, origin);
    headers.set('Content-Length', String(head.size));
    return new Response(null, { status: 200, headers });
  }

  const object = await env.VIDEOS.get(objectKey, {
    onlyIf: request.headers,
    range: request.headers
  });
  if (!object) return text('Object Not Found', 404, origin);

  const headers = mediaHeaders(object, origin);
  if (!('body' in object) || object.body == null) {
    headers.set('Cache-Control', 'private, no-cache');
    return new Response(null, {
      status: failedPreconditionStatus(request),
      headers
    });
  }

  let status = 200;
  if (object.range && Number.isFinite(object.range.offset) && Number.isFinite(object.range.length)) {
    const start = object.range.offset;
    const end = start + object.range.length - 1;
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
    headers.set('Content-Length', String(object.range.length));
    status = 206;
  } else {
    headers.set('Content-Length', String(object.size));
  }
  return new Response(object.body, { status, headers });
}

function validateConfiguration(env, options) {
  if (String(env.COURSE_ID || '') !== COURSE_ID) return 'COURSE_ID';
  if (!isStrongSecret(env.PLAYBACK_SECRET)) return 'PLAYBACK_SECRET';
  if (options.requireAccessApi && !isStrongSecret(env.ACCESS_API_SECRET)) {
    return 'ACCESS_API_SECRET';
  }
  if (options.requireAccessApi && !isValidHttpsUrl(env.ACCESS_API_URL)) {
    return 'ACCESS_API_URL';
  }
  if (options.requireBucket && (!env.VIDEOS || typeof env.VIDEOS.get !== 'function')) {
    return 'VIDEOS';
  }
  return null;
}

async function readAuthorizeBody(request) {
  const contentType = String(request.headers.get('Content-Type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    return { ok: false, status: 415, message: 'JSON 요청만 허용됩니다.' };
  }

  const raw = await request.text();
  if (!raw || raw.length > MAX_AUTHORIZE_BODY_CHARS) {
    return {
      ok: false,
      status: raw.length > MAX_AUTHORIZE_BODY_CHARS ? 413 : 400,
      message: '요청 본문이 올바르지 않습니다.'
    };
  }

  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
    return { ok: true, value };
  } catch {
    return { ok: false, status: 400, message: '요청 본문이 올바르지 않습니다.' };
  }
}

function mediaHeaders(object, origin) {
  const headers = corsHeaders(origin);
  if (typeof object.writeHttpMetadata === 'function') object.writeHttpMetadata(headers);
  headers.set('Content-Type', object.httpMetadata?.contentType || 'video/mp4');
  headers.set('Content-Disposition', 'inline');
  headers.set('Accept-Ranges', 'bytes');
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'private, max-age=300');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return headers;
}

function resolveAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
}

function corsPreflight(origin) {
  if (!origin) return text('Forbidden', 403, null);
  const headers = corsHeaders(origin);
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Range, If-Range, If-Match, If-None-Match, If-Modified-Since, If-Unmodified-Since'
  );
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Cache-Control', 'no-store');
  return new Response(null, { status: 204, headers });
}

function corsHeaders(origin) {
  const headers = new Headers();
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  headers.set(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Range, Accept-Ranges, ETag'
  );
  headers.set('Vary', 'Origin');
  return headers;
}

function methodNotAllowed(allow, origin) {
  const headers = corsHeaders(origin);
  headers.set('Allow', allow);
  headers.set('Cache-Control', 'no-store');
  return new Response('Method Not Allowed', { status: 405, headers });
}

function text(payload, status, origin) {
  const headers = corsHeaders(origin);
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(payload, { status, headers });
}

function json(payload, status = 200, origin = null, extras = {}) {
  const headers = corsHeaders(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  Object.entries(extras).forEach(([key, value]) => headers.set(key, value));
  return new Response(JSON.stringify(payload), { status, headers });
}

function signaturePayload(courseId, week, objectKey, expiresAt) {
  return `${courseId}|${week}|${objectKey}|${expiresAt}`;
}

async function sign(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return base64Url(bytes);
}

function base64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function constantTimeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function isStrongSecret(value) {
  return typeof value === 'string' && value.length >= 32;
}

function isValidHttpsUrl(value) {
  try {
    return new URL(String(value || '')).protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidSingleRange(value) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(value).trim());
  if (!match || (!match[1] && !match[2])) return false;
  const start = match[1] ? Number(match[1]) : null;
  const end = match[2] ? Number(match[2]) : null;
  if (start !== null && !Number.isSafeInteger(start)) return false;
  if (end !== null && !Number.isSafeInteger(end)) return false;
  if (start !== null && end !== null && end < start) return false;
  return true;
}

function failedPreconditionStatus(request) {
  return request.headers.has('If-Match') || request.headers.has('If-Unmodified-Since')
    ? 412
    : 304;
}

function parseInteger(value) {
  if (!/^\d+$/.test(String(value || ''))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseFutureEpochSeconds(value) {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return null;
  return Math.floor(timestamp / 1000);
}

function playbackTtlSeconds(env) {
  const configured = Number(env.PLAYBACK_TTL_SECONDS);
  const value = Number.isFinite(configured) ? Math.floor(configured) : DEFAULT_PLAYBACK_TTL_SECONDS;
  return Math.min(MAX_PLAYBACK_TTL_SECONDS, Math.max(MIN_PLAYBACK_TTL_SECONDS, value));
}

function safeErrorName(error) {
  return error && typeof error === 'object' && typeof error.name === 'string'
    ? error.name
    : 'UnknownError';
}
