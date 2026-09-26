import { createRemoteJWKSet, jwtVerify } from 'jose';

export class IntegrationError extends Error {
  constructor(code, retryable = false, status = 400) {
    super(code); this.code = code; this.retryable = retryable; this.status = status;
  }
}
export const fail = (code, retryable = false, status = 400) => { throw new IntegrationError(code, retryable, status); };
export const enabled = value => value === true || value === 'true';
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');
const encode = value => new TextEncoder().encode(value);
const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
export const digest = async value => base64url(await crypto.subtle.digest('SHA-256', encode(value)));
export async function hmac(value, secret) {
  if (typeof secret !== 'string' || secret.length < 32) fail('SECRET_MISCONFIGURED', false, 503);
  const key = await crypto.subtle.importKey('raw', encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(await crypto.subtle.sign('HMAC', key, encode(value)));
}
export function equal(a, b) {
  a = String(a); b = String(b);
  let n = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) n |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return n === 0;
}
export async function readJson(request, max = 8192) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail('CONTENT_TYPE', false, 415);
  if (Number(request.headers.get('content-length')) > max) fail('BODY_LIMIT', false, 413);
  if (!request.body) fail('INVALID_BODY');
  const reader = request.body.getReader(); let size = 0; const chunks = [];
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > max) { await reader.cancel(); fail('BODY_LIMIT', false, 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const value = JSON.parse(new TextDecoder().decode(bytes)); if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_BODY'); return value; }
  catch { fail('INVALID_BODY'); }
}
const jwksByTeam = new Map();
export async function requireAdmin(request, env, testJwks) {
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN || '') || !env.ACCESS_AUD) fail('ADMIN_NOT_CONFIGURED', false, 503);
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) fail('ADMIN_UNAUTHORIZED', false, 401);
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  if (!jwksByTeam.has(issuer)) jwksByTeam.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
  try {
    const { payload } = await jwtVerify(token, testJwks || jwksByTeam.get(issuer), {
      issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['sub', 'iat', 'exp']
    });
    if (!payload.email) fail('ADMIN_UNAUTHORIZED', false, 401);
    return await digest(String(payload.sub));
  } catch { fail('ADMIN_UNAUTHORIZED', false, 401); }
}
