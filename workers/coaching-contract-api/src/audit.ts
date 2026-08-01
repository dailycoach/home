import { hmacHex, randomId } from './crypto';
import { getClientIp } from './auth';
import type { AuditInput, Env } from './types';

const AUDIT_EVENT_TYPES = new Set([
  'contract_created',
  'contract_updated',
  'contract_ready',
  'contract_issued',
  'invite_created',
  'invite_viewed',
  'identity_verified',
  'contract_viewed',
  'consent_selected',
  'consent_withdrawn',
  'signature_submitted',
  'contract_partially_signed',
  'contract_fully_signed',
  'final_access_created',
  'final_access_exchanged',
  'document_downloaded',
  'contract_cancelled',
  'contract_expired',
  'contract_superseded',
  'contract_terminated',
]);

const FORBIDDEN_METADATA_KEYS = /(?:contract|document|snapshot|clause|email|phone|name|token|pin|otp|signature|ip|user.?agent|authorization|cookie|secret|content|text)/iu;

function sanitizeMetadataValue(value: unknown, depth: number): unknown {
  if (depth > 3) return '[depth-limited]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.length <= 120 ? value : `${value.slice(0, 117)}...`;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadataValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_METADATA_KEYS.test(key) || Object.keys(sanitized).length >= 30) continue;
      sanitized[key] = sanitizeMetadataValue(child, depth + 1);
    }
    return sanitized;
  }
  return String(value).slice(0, 120);
}

export function sanitizeAuditMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  return (sanitizeMetadataValue(metadata ?? {}, 0) ?? {}) as Record<string, unknown>;
}

export function summarizeUserAgent(request: Request): string | undefined {
  const userAgent = request.headers.get('User-Agent');
  if (!userAgent) return undefined;
  const browser = userAgent.match(/(?:SamsungBrowser|Edg|Chrome|Firefox|Version)\/(\d+)/u);
  let platform = 'Other';
  if (/Android/u.test(userAgent)) platform = 'Android';
  else if (/(?:iPhone|iPad)/u.test(userAgent)) platform = 'iOS';
  else if (/Windows/u.test(userAgent)) platform = 'Windows';
  else if (/Macintosh/u.test(userAgent)) platform = 'macOS';
  else if (/Linux/u.test(userAgent)) platform = 'Linux';
  const familyMatch = browser?.[0]?.match(/^([A-Za-z]+)/u);
  const family = familyMatch?.[1] === 'Version' && /Safari/u.test(userAgent) ? 'Safari' : familyMatch?.[1] ?? 'Other';
  const major = browser?.[1] ?? '0';
  const mobile = /Mobile/u.test(userAgent) ? 'mobile' : 'desktop';
  return `${family}/${major} ${platform} ${mobile}`.slice(0, 80);
}

export async function createAuditStatement(
  request: Request,
  env: Env,
  input: AuditInput,
): Promise<D1PreparedStatement> {
  if (!AUDIT_EVENT_TYPES.has(input.eventType)) {
    throw new Error(`Unsupported audit event: ${input.eventType}`);
  }
  const ip = getClientIp(request);
  const ipEvidenceHash = ip
    ? await hmacHex(env.AUDIT_HASH_SECRET, `audit-ip:${input.contractId}`, ip)
    : null;
  return env.DB.prepare(
    `INSERT INTO contract_audit_events (
       id, contract_id, party_id, event_type, event_at,
       ip_evidence_hash, user_agent_summary, document_hash, metadata_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    randomId(),
    input.contractId,
    input.partyId ?? null,
    input.eventType,
    new Date().toISOString(),
    ipEvidenceHash,
    summarizeUserAgent(request) ?? null,
    input.documentHash ?? null,
    JSON.stringify(sanitizeAuditMetadata(input.metadata)),
  );
}

export async function createConsentWithdrawalAuditStatement(
  request: Request,
  env: Env,
  input: { contractId: string; partyId: string; consentKey: string; eventAt: string },
): Promise<D1PreparedStatement> {
  const ip = getClientIp(request);
  const ipEvidenceHash = ip
    ? await hmacHex(env.AUDIT_HASH_SECRET, `audit-ip:${input.contractId}`, ip)
    : null;
  return env.DB.prepare(
    `INSERT INTO contract_audit_events (
       id, contract_id, party_id, event_type, event_at,
       ip_evidence_hash, user_agent_summary, document_hash, metadata_json
     )
     SELECT ?, ?, ?, 'consent_withdrawn', ?, ?, ?, NULL, ?
      WHERE EXISTS (
        SELECT 1 FROM contract_consents
         WHERE contract_id = ? AND party_id = ? AND consent_key = ? AND accepted = 1
      )`,
  ).bind(
    randomId(),
    input.contractId,
    input.partyId,
    input.eventAt,
    ipEvidenceHash,
    summarizeUserAgent(request) ?? null,
    JSON.stringify(sanitizeAuditMetadata({ consent_key: input.consentKey })),
    input.contractId,
    input.partyId,
    input.consentKey,
  );
}

export async function createContractExpiryAuditStatement(
  request: Request,
  env: Env,
  input: { contractId: string; eventAt: string; documentHash?: string },
): Promise<D1PreparedStatement> {
  const ip = getClientIp(request);
  const ipEvidenceHash = ip
    ? await hmacHex(env.AUDIT_HASH_SECRET, `audit-ip:${input.contractId}`, ip)
    : null;
  return env.DB.prepare(
    `INSERT INTO contract_audit_events (
       id, contract_id, party_id, event_type, event_at,
       ip_evidence_hash, user_agent_summary, document_hash, metadata_json
     )
     SELECT ?, ?, NULL, 'contract_expired', ?, ?, ?, ?, '{}'
      WHERE EXISTS (
        SELECT 1 FROM contracts
         WHERE id = ? AND status = 'issued' AND expires_at IS NOT NULL AND expires_at <= ?
      )`,
  ).bind(
    randomId(),
    input.contractId,
    input.eventAt,
    ipEvidenceHash,
    summarizeUserAgent(request) ?? null,
    input.documentHash ?? null,
    input.contractId,
    input.eventAt,
  );
}

export async function recordAuditEvent(request: Request, env: Env, input: AuditInput): Promise<void> {
  await (await createAuditStatement(request, env, input)).run();
}
