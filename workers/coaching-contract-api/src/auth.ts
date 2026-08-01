import { fromBase64Url, hmacHex, randomId, toArrayBuffer } from './crypto';
import type {
  AccessIdentity,
  Env,
  FinalDocumentSessionRow,
  InviteExchangeRow,
  InviteSessionRow,
} from './types';
import { HttpError } from './validation';

interface AccessJwtHeader {
  alg?: unknown;
  kid?: unknown;
  typ?: unknown;
}

interface AccessJwtPayload {
  aud?: unknown;
  email?: unknown;
  exp?: unknown;
  iat?: unknown;
  iss?: unknown;
  nbf?: unknown;
  sub?: unknown;
}

interface JwksResponse {
  keys?: AccessJwk[];
}

interface AccessJwk extends JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

interface CachedJwks {
  issuer: string;
  expiresAt: number;
  keys: AccessJwk[];
}

let jwksCache: CachedJwks | undefined;

function decodeJsonSegment<T>(segment: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(segment))) as T;
  } catch {
    throw new HttpError(401, 'INVALID_ACCESS_TOKEN', 'Cloudflare Access token is malformed');
  }
}

function fixedIssuer(teamDomain: string): string {
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/iu.test(teamDomain)) {
    throw new Error('CF_ACCESS_TEAM_DOMAIN is invalid');
  }
  return `https://${teamDomain}`;
}

async function fetchJwks(teamDomain: string): Promise<AccessJwk[]> {
  const issuer = fixedIssuer(teamDomain);
  const now = Date.now();
  if (jwksCache?.issuer === issuer && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'error',
  });
  if (!response.ok) {
    throw new HttpError(503, 'ACCESS_KEY_UNAVAILABLE', 'Administrator authentication is temporarily unavailable');
  }
  const body = await response.json<JwksResponse>();
  const keys = body.keys?.filter(
    (key) => key.kty === 'RSA' && typeof key.kid === 'string' && key.use === 'sig' && key.alg === 'RS256',
  ) ?? [];
  if (keys.length === 0) {
    throw new HttpError(503, 'ACCESS_KEY_UNAVAILABLE', 'Administrator authentication keys are unavailable');
  }
  jwksCache = { issuer, keys, expiresAt: now + 5 * 60 * 1000 };
  return keys;
}

function audienceMatches(audience: unknown, expected: string): boolean {
  if (typeof audience === 'string') return audience === expected;
  return Array.isArray(audience) && audience.some((entry) => entry === expected);
}

export async function verifyAdminRequest(request: Request, env: Env): Promise<AccessIdentity> {
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!assertion || assertion.length > 16_384) {
    throw new HttpError(401, 'ADMIN_AUTH_REQUIRED', 'Cloudflare Access authentication is required');
  }
  const parts = assertion.split('.');
  if (parts.length !== 3) {
    throw new HttpError(401, 'INVALID_ACCESS_TOKEN', 'Cloudflare Access token is malformed');
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
  const header = decodeJsonSegment<AccessJwtHeader>(encodedHeader);
  const payload = decodeJsonSegment<AccessJwtPayload>(encodedPayload);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new HttpError(401, 'INVALID_ACCESS_TOKEN', 'Cloudflare Access token algorithm is not accepted');
  }
  const issuer = fixedIssuer(env.CF_ACCESS_TEAM_DOMAIN);
  const normalizedClaimIssuer = typeof payload.iss === 'string' ? payload.iss.replace(/\/$/u, '') : payload.iss;
  if (normalizedClaimIssuer !== issuer || !audienceMatches(payload.aud, env.ADMIN_ACCESS_AUDIENCE)) {
    throw new HttpError(401, 'INVALID_ACCESS_TOKEN', 'Cloudflare Access token issuer or audience is invalid');
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now - 30
    || typeof payload.nbf === 'number' && payload.nbf > now + 30
    || typeof payload.iat !== 'number' || payload.iat > now + 30
    || typeof payload.sub !== 'string' || payload.sub.length < 1 || payload.sub.length > 256) {
    throw new HttpError(401, 'INVALID_ACCESS_TOKEN', 'Cloudflare Access token time or subject claims are invalid');
  }
  const keys = await fetchJwks(env.CF_ACCESS_TEAM_DOMAIN);
  const jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) {
    jwksCache = undefined;
    throw new HttpError(401, 'INVALID_ACCESS_TOKEN', 'Cloudflare Access signing key is unknown');
  }
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    toArrayBuffer(fromBase64Url(encodedSignature)),
    toArrayBuffer(new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)),
  );
  if (!verified) {
    throw new HttpError(401, 'INVALID_ACCESS_TOKEN', 'Cloudflare Access token signature is invalid');
  }
  return {
    subject: payload.sub,
    issuedAt: payload.iat,
    ...(typeof payload.email === 'string' && payload.email.length <= 254 ? { email: payload.email } : {}),
  };
}

function parseAuthorization(request: Request, schemes: readonly string[]): string {
  const value = request.headers.get('Authorization');
  if (!value) {
    throw new HttpError(401, 'SESSION_REQUIRED', 'A secure session is required');
  }
  const separator = value.indexOf(' ');
  if (separator < 1 || !schemes.includes(value.slice(0, separator))) {
    throw new HttpError(401, 'SESSION_REQUIRED', `Authorization must use an accepted session scheme`);
  }
  const token = value.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]{43,128}$/u.test(token)) {
    throw new HttpError(401, 'INVALID_SESSION', 'Session token is invalid');
  }
  return token;
}

export async function authenticateInviteSession(
  request: Request,
  env: Env,
  expectedContractId?: string,
): Promise<InviteSessionRow> {
  const token = parseAuthorization(request, ['Bearer', 'InviteSession']);
  const sessionHash = await hmacHex(env.TOKEN_HASH_SECRET, 'invite-session-v1', token);
  const session = await env.DB.prepare(
    `SELECT id, invite_id, contract_id, party_id, session_hash, expires_at, consumed_at, created_at
       FROM contract_invite_sessions WHERE session_hash = ? LIMIT 1`,
  ).bind(sessionHash).first<InviteSessionRow>();
  if (!session || session.consumed_at || Date.parse(session.expires_at) <= Date.now()
    || expectedContractId && session.contract_id !== expectedContractId) {
    throw new HttpError(401, 'INVALID_SESSION', 'Invite session is invalid or expired');
  }
  return session;
}

export async function authenticateInviteExchange(request: Request, env: Env): Promise<InviteExchangeRow> {
  const token = parseAuthorization(request, ['Bearer', 'InviteExchange']);
  const exchangeHash = await hmacHex(env.TOKEN_HASH_SECRET, 'invite-exchange-v1', token);
  const exchange = await env.DB.prepare(
    `SELECT id, invite_id, exchange_hash, expires_at, used_at, created_at
       FROM contract_invite_exchanges WHERE exchange_hash = ? LIMIT 1`,
  ).bind(exchangeHash).first<InviteExchangeRow>();
  if (!exchange || exchange.used_at || Date.parse(exchange.expires_at) <= Date.now()) {
    throw new HttpError(401, 'INVALID_SESSION', 'Invitation exchange session is invalid or expired');
  }
  return exchange;
}

export async function authenticateFinalDocumentSession(
  request: Request,
  env: Env,
  expectedContractId: string,
): Promise<FinalDocumentSessionRow> {
  const token = parseAuthorization(request, ['Bearer', 'FinalDocument']);
  const sessionHash = await hmacHex(env.TOKEN_HASH_SECRET, 'final-document-session-v1', token);
  const session = await env.DB.prepare(
    `SELECT id, contract_id, party_id, session_hash, expires_at, created_at
       FROM contract_final_document_sessions WHERE session_hash = ? LIMIT 1`,
  ).bind(sessionHash).first<FinalDocumentSessionRow>();
  if (!session || session.contract_id !== expectedContractId || Date.parse(session.expires_at) <= Date.now()) {
    throw new HttpError(401, 'INVALID_SESSION', 'Final-document session is invalid or expired');
  }
  return session;
}

export function getClientIp(request: Request): string | undefined {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || ip.length > 64 || !/^[0-9a-f:.]+$/iu.test(ip)) return undefined;
  return ip;
}

export async function enforceRateLimit(
  request: Request,
  env: Env,
  scope: string,
  limit: number,
  windowSeconds: number,
  identity?: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / windowSeconds);
  const evidence = identity ?? getClientIp(request) ?? 'unknown';
  const bucketKey = await hmacHex(env.AUDIT_HASH_SECRET, `rate:${scope}:${window}`, evidence);
  const expiresAt = new Date((window + 2) * windowSeconds * 1000).toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO api_rate_limits (bucket_key, request_count, expires_at)
     VALUES (?, 1, ?)
     ON CONFLICT(bucket_key) DO UPDATE SET request_count = request_count + 1
     RETURNING request_count`,
  ).bind(bucketKey, expiresAt).first<{ request_count: number }>();
  if (!result || result.request_count > limit) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many requests; try again later');
  }
}

export function requestId(request: Request): string {
  const provided = request.headers.get('CF-Ray');
  return provided && /^[A-Za-z0-9-]{1,80}$/u.test(provided) ? provided : randomId();
}
