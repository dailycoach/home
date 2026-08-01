const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

interface CipherEnvelope {
  v: 1;
  kid: string;
  iv: string;
  ct: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    const slice = bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function toBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error('Invalid base64url value');
  }
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return base64ToBytes(padded);
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomId(): string {
  return crypto.randomUUID();
}

export function randomToken(byteLength = 32): string {
  if (byteLength < 32 || byteLength > 64) {
    throw new Error('Opaque tokens must contain between 32 and 64 random bytes');
  }
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function randomPin(): string {
  const rejectionLimit = 0x1_0000_0000 - (0x1_0000_0000 % 1_000_000);
  const sample = new Uint32Array(1);
  do {
    crypto.getRandomValues(sample);
  } while ((sample[0] ?? rejectionLimit) >= rejectionLimit);
  return String((sample[0] ?? 0) % 1_000_000).padStart(6, '0');
}

function parseAesKey(secret: string): Uint8Array {
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(secret.trim());
  } catch {
    throw new Error('DATA_ENCRYPTION_KEY must be valid base64');
  }
  if (keyBytes.byteLength !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
  return keyBytes;
}

async function importAesKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', toArrayBuffer(parseAesKey(secret)), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptText(
  plaintext: string,
  secret: string,
  keyVersion: string,
  associatedData: string,
): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await importAesKey(secret);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: toArrayBuffer(encoder.encode(associatedData)),
      tagLength: 128,
    },
    key,
    toArrayBuffer(encoder.encode(plaintext)),
  );
  const envelope: CipherEnvelope = {
    v: 1,
    kid: keyVersion,
    iv: toBase64Url(iv),
    ct: toBase64Url(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(envelope);
}

export async function decryptText(
  serializedEnvelope: string,
  secret: string,
  expectedKeyVersion: string,
  associatedData: string,
): Promise<string> {
  let envelope: CipherEnvelope;
  try {
    envelope = JSON.parse(serializedEnvelope) as CipherEnvelope;
  } catch {
    throw new Error('Encrypted field envelope is malformed');
  }
  if (
    envelope.v !== 1
    || envelope.kid !== expectedKeyVersion
    || typeof envelope.iv !== 'string'
    || typeof envelope.ct !== 'string'
  ) {
    throw new Error('Encrypted field uses an unsupported key version or format');
  }
  const key = await importAesKey(secret);
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(fromBase64Url(envelope.iv)),
        additionalData: toArrayBuffer(encoder.encode(associatedData)),
        tagLength: 128,
      },
      key,
      toArrayBuffer(fromBase64Url(envelope.ct)),
    );
    return decoder.decode(plaintext);
  } catch {
    throw new Error('Encrypted field authentication failed');
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  if (encoder.encode(secret).byteLength < 32) {
    throw new Error('HMAC secrets must contain at least 32 bytes');
  }
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(encoder.encode(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function hmacHex(secret: string, purpose: string, value: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(encoder.encode(`${purpose}\u0000${value}`)));
  return bytesToHex(new Uint8Array(signature));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(encoder.encode(value)));
  return bytesToHex(new Uint8Array(digest));
}

export function timingSafeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

export async function hashEmail(secret: string, email: string): Promise<string> {
  return hmacHex(secret, 'party-email-v1', normalizeEmail(email));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}
