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
    try {
      const url = new URL(request.url);
      const origin = resolveAllowedOrigin(request, env);

      if (request.method === 'OPTIONS') return corsPreflight(origin);
      if (url.pathname === '/health') return json({ ok: true, service: 'lmc-r2-video-gateway' }, 200, origin);
      if (url.pathname === '/authorize' && request.method === 'POST') return authorize(request, env, origin);
      if (url.pathname.startsWith('/media/')) return serveMedia(request, env, origin, url);
      return json({ ok: false, message: 'Not found' }, 404, origin);
    } catch (error) {
      console.error('[LMC R2 Worker]', error);
      return json({ ok: false, message: '요청을 처리하지 못했습니다.' }, 500, null);
    }
  }
};

async function authorize(request, env, origin) {
  if (!origin) return json({ ok: false, message: '허용되지 않은 사이트입니다.' }, 403, null);
  if (!env.ACCESS_API_URL || !env.PLAYBACK_SECRET) {
    return json({ ok: false, message: '재생 게이트 설정이 완료되지 않았습니다.' }, 503, origin);
  }

  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '').trim();
  const courseId = String(body.courseId || env.COURSE_ID || '').trim();
  const week = Number(body.week);
  if (token.length < 32 || courseId !== env.COURSE_ID || !LESSON_OBJECTS[week]) {
    return json({ ok: false, message: '수강정보 또는 차시정보가 올바르지 않습니다.' }, 400, origin);
  }

  const validationUrl = new URL(env.ACCESS_API_URL);
  validationUrl.searchParams.set('action', 'validate');
  validationUrl.searchParams.set('token', token);
  validationUrl.searchParams.set('courseId', courseId);
  validationUrl.searchParams.set('ua', String(body.userAgent || '').slice(0, 240));
  validationUrl.searchParams.set('_', String(Date.now()));

  const validationResponse = await fetch(validationUrl, { headers: { Accept: 'application/json' } });
  const validation = await validationResponse.json().catch(() => ({}));
  if (!validationResponse.ok || !validation?.ok) {
    return json({ ok: false, message: validation?.message || '수강권한을 확인하지 못했습니다.' }, 401, origin);
  }

  const ttl = clamp(Number(env.PLAYBACK_TTL_SECONDS || 14400), 900, 21600);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const signature = await sign(env.PLAYBACK_SECRET, signaturePayload(courseId, week, expiresAt));
  const playbackUrl = new URL(request.url);
  playbackUrl.pathname = `/media/${encodeURIComponent(courseId)}/${week}`;
  playbackUrl.search = '';
  playbackUrl.searchParams.set('exp', String(expiresAt));
  playbackUrl.searchParams.set('sig', signature);

  return json({
    ok: true,
    url: playbackUrl.toString(),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    week
  }, 200, origin, { 'Cache-Control': 'no-store' });
}

async function serveMedia(request, env, origin, url) {
  if (!origin) return new Response('Forbidden', { status: 403 });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD, OPTIONS' } });
  }

  const match = /^\/media\/([^/]+)\/(\d+)$/.exec(url.pathname);
  if (!match) return new Response('Not Found', { status: 404 });
  const courseId = decodeURIComponent(match[1]);
  const week = Number(match[2]);
  const objectKey = LESSON_OBJECTS[week];
  const expiresAt = Number(url.searchParams.get('exp'));
  const suppliedSignature = String(url.searchParams.get('sig') || '');
  if (courseId !== env.COURSE_ID || !objectKey || !Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return new Response('Playback URL expired', { status: 401, headers: corsHeaders(origin) });
  }

  const expectedSignature = await sign(env.PLAYBACK_SECRET, signaturePayload(courseId, week, expiresAt));
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) {
    return new Response('Invalid signature', { status: 401, headers: corsHeaders(origin) });
  }

  if (request.method === 'HEAD') {
    const head = await env.VIDEOS.head(objectKey);
    if (!head) return new Response('Object Not Found', { status: 404, headers: corsHeaders(origin) });
    const headers = mediaHeaders(head, origin);
    headers.set('Content-Length', String(head.size));
    return new Response(null, { status: 200, headers });
  }

  const object = await env.VIDEOS.get(objectKey, {
    onlyIf: request.headers,
    range: request.headers
  });
  if (!object) return new Response('Object Not Found', { status: 404, headers: corsHeaders(origin) });
  if (!('body' in object)) return new Response(null, { status: 412, headers: corsHeaders(origin) });

  const headers = mediaHeaders(object, origin);
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

function mediaHeaders(object, origin) {
  const headers = corsHeaders(origin);
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', object.httpMetadata?.contentType || 'video/mp4');
  headers.set('Content-Disposition', 'inline');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'private, max-age=300');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return headers;
}

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || 'https://daily-coach-ing.com')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean));
}

function resolveAllowedOrigin(request, env) {
  const allowed = allowedOrigins(env);
  const origin = request.headers.get('Origin');
  if (origin && allowed.has(origin)) return origin;
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowed.has(refererOrigin)) return refererOrigin;
    } catch { /* invalid referrer */ }
  }
  return null;
}

function corsPreflight(origin) {
  if (!origin) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      ...Object.fromEntries(corsHeaders(origin)),
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range, If-None-Match, If-Modified-Since',
      'Access-Control-Max-Age': '86400'
    }
  });
}

function corsHeaders(origin) {
  const headers = new Headers();
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, ETag');
  headers.set('Vary', 'Origin');
  return headers;
}

function json(payload, status = 200, origin = null, extras = {}) {
  const headers = corsHeaders(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  Object.entries(extras).forEach(([key, value]) => headers.set(key, value));
  return new Response(JSON.stringify(payload), { status, headers });
}

function signaturePayload(courseId, week, expiresAt) {
  return `${courseId}|${week}|${expiresAt}`;
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
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (a.charCodeAt(index % Math.max(a.length, 1)) || 0) ^ (b.charCodeAt(index % Math.max(b.length, 1)) || 0);
  }
  return diff === 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
