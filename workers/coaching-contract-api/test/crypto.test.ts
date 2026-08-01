import { describe, expect, it } from 'vitest';
import {
  decryptText,
  encryptText,
  hmacHex,
  randomPin,
  randomToken,
  stableStringify,
} from '../src/crypto';

const encryptionKey = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

describe('cryptographic primitives', () => {
  it('round-trips AES-256-GCM only with matching associated data', async () => {
    const envelope = await encryptText('민감한 계약 내용', encryptionKey, 'v1', 'contract:1:field');
    await expect(decryptText(envelope, encryptionKey, 'v1', 'contract:1:field'))
      .resolves.toBe('민감한 계약 내용');
    await expect(decryptText(envelope, encryptionKey, 'v1', 'contract:2:field'))
      .rejects.toThrow('authentication failed');
  });

  it('separates HMAC purposes and produces deterministic digests', async () => {
    const secret = 'a'.repeat(32);
    const first = await hmacHex(secret, 'invite-token-v1', 'opaque-token');
    expect(first).toHaveLength(64);
    await expect(hmacHex(secret, 'invite-token-v1', 'opaque-token')).resolves.toBe(first);
    await expect(hmacHex(secret, 'final-access-v1', 'opaque-token')).resolves.not.toBe(first);
  });

  it('generates URL-safe 32-byte tokens and six-digit PINs', () => {
    expect(randomToken(32)).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(randomPin()).toMatch(/^\d{6}$/u);
  });

  it('uses stable recursive key ordering for document hashing', () => {
    expect(stableStringify({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(stableStringify({ a: { c: 3, d: 4 }, b: 2 }));
  });
});
