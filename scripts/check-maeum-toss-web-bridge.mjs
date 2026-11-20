#!/usr/bin/env node
/**
 * Read-only Maeum Library API smoke test.
 * Never prints record contents, identifiers, cookies, or authentication secrets.
 * No POST/PATCH/DELETE. Run from an authorized network with Node.js >= 18.
 *
 * MAEUM_API_BASE=https://maeum-api.daily-coach-ing.com
 * MAEUM_WEB_ORIGIN=https://daily-coach-ing.com
 * node scripts/check-maeum-toss-web-bridge.mjs
 */
const BASE = (process.env.MAEUM_API_BASE || 'https://maeum-api.daily-coach-ing.com').replace(/\/$/, '');
const ORIGIN = process.env.MAEUM_WEB_ORIGIN || 'https://daily-coach-ing.com';
const SENSITIVE = /^(email|phone|phoneNumber|memberEmail|member_email|userId|user_id|participantId|participant_id|ownerId|owner_id|deviceToken|device_token|tossToken|toss_token|sessionToken|session_token|csrf|password|secret|accessToken|refreshToken|reflection|chosenStep|operatorNotes|internalNotes)$/i;

const tests = [];
function result(name, ok, detail) {
  tests.push({ name, ok });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}\n`);
}
async function get(path, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    return await fetch(BASE + path, {
      method: 'GET',
      headers: { Origin: ORIGIN, Accept: 'application/json', ...extraHeaders },
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
async function check(name, path, allowedStatuses, validate) {
  try {
    const response = await get(path);
    const statusOk = allowedStatuses.includes(response.status);
    if (!statusOk) {
      result(name, false, `HTTP ${response.status} (expected ${allowedStatuses.join('/')})`);
      return;
    }
    if (validate) {
      const verdict = await validate(response);
      result(name, verdict.ok, `HTTP ${response.status}; ${verdict.message}`);
    } else {
      result(name, true, `HTTP ${response.status}`);
    }
  } catch (error) {
    // Do not output request bodies, user data, or a token-containing URL.
    result(name, false, `network/runtime error (${error?.name || 'unknown'})`);
  }
}
await check('public entries', '/api/entries?limit=3', [200], async (response) => {
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return { ok: false, message: 'not JSON' };
  let body;
  try { body = await response.json(); } catch { return { ok: false, message: 'invalid JSON' }; }
  if (body?.ok !== true || !Array.isArray(body?.entries)) {
    return { ok: false, message: 'expected {ok:true,entries:[]}' };
  }
  const cors = response.headers.get('access-control-allow-origin');
  const credentials = response.headers.get('access-control-allow-credentials');
  const corsOk = cors === ORIGIN || (cors === '*' && credentials !== 'true');
  let leak = false;
  let hidden = false;
  let withoutConsent = false;
  for (const entry of body.entries) {
    for (const key of Object.keys(entry)) if (SENSITIVE.test(key)) leak = true;
    if (entry.moderationStatus === 'hidden') hidden = true;
    if ('shareConsent' in entry && entry.shareConsent !== true && entry.shareConsent !== 1) withoutConsent = true;
    if ('status' in entry && entry.status !== 'published') withoutConsent = true;
  }
  const ok = corsOk && !leak && !hidden && !withoutConsent;
  return { ok, message: `count=${body.entries.length}; CORS=${corsOk ? 'ok' : 'missing/wrong'}; sensitive_fields=${leak ? 'found' : 'none'}; moderation=${hidden ? 'hidden-leak' : 'ok'}; public_status=${withoutConsent ? 'unexpected' : 'ok'}` };
});
await check('no-auth personal records', '/api/participant/me', [401]);
await check('no-auth Sheets snapshot', '/api/sheets/snapshot', [401, 403]);

const failed = tests.filter((t) => !t.ok).length;
process.stdout.write(`Result: ${tests.length - failed}/${tests.length} checks passed.\n`);
if (failed) process.exitCode = 1;
