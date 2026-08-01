import { beforeAll, describe, expect, it, vi } from 'vitest';
import { verifyAdminRequest } from '../src/auth';
import { toArrayBuffer, toBase64Url } from '../src/crypto';
import type { Env } from '../src/types';

const encoder = new TextEncoder();
let privateKey: CryptoKey;
let publicJwk: JsonWebKey & { kid: string; alg: string; use: string };

function segment(value: unknown): string {
  return toBase64Url(encoder.encode(JSON.stringify(value)));
}

async function jwt(payloadOverrides: Record<string, unknown> = {}, headerOverrides: Record<string, unknown> = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = segment({ alg: 'RS256', typ: 'JWT', kid: 'test-key', ...headerOverrides });
  const payload = segment({
    iss: 'https://dailycoaching.cloudflareaccess.com/',
    aud: ['test-audience'],
    sub: 'access-subject-1',
    iat: now - 10,
    nbf: now - 10,
    exp: now + 300,
    ...payloadOverrides,
  });
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    toArrayBuffer(encoder.encode(`${header}.${payload}`)),
  );
  return `${header}.${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

const env = {
  CF_ACCESS_TEAM_DOMAIN: 'dailycoaching.cloudflareaccess.com',
  ADMIN_ACCESS_AUDIENCE: 'test-audience',
} as Env;

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  privateKey = pair.privateKey;
  publicJwk = {
    ...await crypto.subtle.exportKey('jwk', pair.publicKey),
    kid: 'test-key',
    alg: 'RS256',
    use: 'sig',
  };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    expect(String(input)).toBe('https://dailycoaching.cloudflareaccess.com/cdn-cgi/access/certs');
    return new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }));
});

describe('Cloudflare Access JWT verification', () => {
  it('verifies RS256, kid, signature, fixed issuer, audience, and time claims', async () => {
    const request = new Request('https://api.example.test/v1/admin/session', {
      headers: { 'Cf-Access-Jwt-Assertion': await jwt() },
    });
    await expect(verifyAdminRequest(request, env)).resolves.toMatchObject({ subject: 'access-subject-1' });
  });

  it('rejects algorithm confusion before key verification', async () => {
    const request = new Request('https://api.example.test/v1/admin/session', {
      headers: { 'Cf-Access-Jwt-Assertion': await jwt({}, { alg: 'none' }) },
    });
    await expect(verifyAdminRequest(request, env)).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN' });
  });

  it('rejects an unconfigured issuer even with a valid signature', async () => {
    const request = new Request('https://api.example.test/v1/admin/session', {
      headers: { 'Cf-Access-Jwt-Assertion': await jwt({ iss: 'https://attacker.example' }) },
    });
    await expect(verifyAdminRequest(request, env)).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN' });
  });

  it('rejects wrong audience and expired claims', async () => {
    const wrongAudience = new Request('https://api.example.test/v1/admin/session', {
      headers: { 'Cf-Access-Jwt-Assertion': await jwt({ aud: ['wrong-audience'] }) },
    });
    await expect(verifyAdminRequest(wrongAudience, env)).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN' });

    const expired = new Request('https://api.example.test/v1/admin/session', {
      headers: { 'Cf-Access-Jwt-Assertion': await jwt({ exp: Math.floor(Date.now() / 1000) - 60 }) },
    });
    await expect(verifyAdminRequest(expired, env)).rejects.toMatchObject({ code: 'INVALID_ACCESS_TOKEN' });
  });
});
