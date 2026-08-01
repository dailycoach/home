import { sha256Hex, stableStringify } from './crypto';
import type {
  ConsentDefinition,
  ContractCreateInput,
  ContractType,
  Env,
  PartyRole,
} from './types';
import { HttpError } from './validation';
import { approvedPolicyVariables, getServerTemplate } from './templates';
import type { RawConsent } from './templates';

export interface PlainParty {
  id: string;
  role: PartyRole;
  displayName: string;
  email: string;
  phone?: string;
  organization?: string;
  requiredSigner: boolean;
  signedName?: string;
  signedAt?: string;
  signatureEventId?: string;
}

export interface PlainConsent {
  key: string;
  enabled: boolean;
  accepted: boolean;
  version: string;
  textHash: string;
  selectedAt?: string;
  acceptedAt?: string;
  withdrawnAt?: string;
  details?: Record<string, unknown>;
}

export interface CanonicalIssuedSnapshot {
  schema_version: 'dailycoaching.contract.snapshot.v1';
  contract_id: string;
  contract_number: string;
  contract_type: ContractType;
  template_version: string;
  version_number: number;
  title: string;
  status_at_issue: 'issued';
  issued_at: string;
  legal_review_status: 'APPROVED';
  legal_review_reference: string;
  adult_only_confirmed: true;
  parties: Array<{
    id: string;
    role: PartyRole;
    display_name: string;
    email: string;
    phone?: string;
    organization?: string;
    required_signer: boolean;
  }>;
  goal_summary: string;
  session_count: number;
  session_minutes: number;
  delivery_method: string;
  start_date: string;
  expected_end_date: string;
  fee_amount: number;
  fee_currency: string;
  payment_terms: string;
  cancellation_terms: string;
  refund_terms: string;
  confidentiality_scope: string;
  reporting_scope: string;
  technology_terms: string;
  governing_law: string;
  termination_terms: string;
  clauses: Array<Record<string, unknown>>;
  optional_consents: ConsentDefinition[];
  notices?: Record<string, string>;
}

export interface FinalManifest {
  schema_version: 'dailycoaching.contract.final.v1';
  contract_id: string;
  snapshot_hash: string;
  canonical_snapshot: CanonicalIssuedSnapshot;
  signatures: Array<{
    party_id: string;
    role: PartyRole;
    signed_name: string;
    signed_at: string;
    signature_event_id: string;
  }>;
  optional_consents: Array<PlainConsent & { party_id: string }>;
  audit_summary: Array<{ event_type: string; event_at: string; document_hash?: string }>;
  fully_signed_at: string;
}

const TYPE_LABELS: Record<ContractType, string> = {
  life: '라이프 코칭',
  business: '비즈니스 코칭',
  career: '커리어 코칭',
};

function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/gu, (character) => `_${character.toLowerCase()}`);
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/gu, (_match, character: string) => character.toUpperCase());
}

function scalarString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(scalarString).filter(Boolean).join(', ') || undefined;
  return undefined;
}

function addRecordAliases(target: Record<string, string>, record: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(record)) {
    const scalar = scalarString(value);
    if (scalar !== undefined) {
      target[key] = scalar;
      target[camelToSnake(key)] = scalar;
    }
  }
}

function buildTemplateContext(input: ContractCreateInput, parties: PlainParty[], env: Env): Record<string, string> {
  const variables: Record<string, string> = {};
  addRecordAliases(variables, input.templateVariables);
  addRecordAliases(variables, input.recordManagement);
  if (input.sponsorTerms) addRecordAliases(variables, input.sponsorTerms);
  addRecordAliases(variables, approvedPolicyVariables(env));

  const coach = parties.find((party) => party.role === 'coach');
  const client = parties.find((party) => party.role === 'client');
  const sponsor = parties.find((party) => party.role === 'sponsor');
  const organizationContact = parties.find((party) => party.role === 'organization_contact');
  Object.assign(variables, {
    coach_name: coach?.displayName ?? '',
    client_name: client?.displayName ?? '',
    sponsor_name: sponsor?.displayName ?? '해당 없음',
    organization_contact_name: organizationContact?.displayName ?? '해당 없음',
    contract_type: input.contractType,
    contract_type_label: TYPE_LABELS[input.contractType],
    goal_summary: input.goalSummary,
    session_count: String(input.sessionCount),
    session_minutes: String(input.sessionMinutes),
    delivery_method: input.deliveryMethod,
    start_date: input.startDate,
    expected_end_date: input.expectedEndDate,
    fee_amount: String(input.feeAmount),
    fee_currency: input.feeCurrency,
    payment_terms: input.paymentTerms,
    cancellation_terms: input.cancellationTerms,
    refund_terms: input.refundTerms,
    confidentiality_scope: input.confidentialityScope,
    reporting_scope: input.reportingScope,
    technology_terms: input.technologyTerms,
    governing_law: input.governingLaw,
    termination_terms: input.terminationTerms,
  });
  return variables;
}

function interpolateString(value: string, variables: Record<string, string>, location: string): string {
  return value.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/gu, (_match, token: string) => {
    const replacement = variables[token] ?? variables[camelToSnake(token)];
    if (!replacement || replacement === 'LEGAL_REVIEW_REQUIRED') {
      throw new HttpError(422, 'UNRESOLVED_CONTRACT_VARIABLE', `A required contract variable is unresolved at ${location}`, {
        variable: token,
      });
    }
    return replacement;
  });
}

function interpolateValue(value: unknown, variables: Record<string, string>, location: string): unknown {
  if (typeof value === 'string') return interpolateString(value, variables, location);
  if (Array.isArray(value)) return value.map((child, index) => interpolateValue(child, variables, `${location}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        interpolateValue(child, variables, `${location}.${key}`),
      ]),
    );
  }
  return value;
}

function configuredString(configuration: Record<string, unknown>, key: string, fallback: string): string {
  const candidate = scalarString(configuration[key] ?? configuration[snakeToCamel(key)]);
  return candidate ?? fallback;
}

function technologySection(input: ContractCreateInput, key: string): Record<string, unknown> {
  const value = input.technologyConfiguration[key] ?? input.technologyConfiguration[camelToSnake(key)];
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hydrateConsent(input: ContractCreateInput, definition: ConsentDefinition): ConsentDefinition {
  const configuration = technologySection(input, definition.key);
  const enabled = configuration.enabled === true;
  const hydrated: ConsentDefinition = {
    ...definition,
    enabled,
    purpose: configuredString(configuration, 'purpose', definition.purpose),
    scope: configuredString(configuration, 'scope', definition.scope),
    retention: configuredString(configuration, 'retention', definition.retention),
    withdrawal: configuredString(configuration, 'withdrawal', definition.withdrawal),
  };
  if (definition.key === 'session_recording') {
    hydrated.scope = configuredString(configuration, 'scope', hydrated.scope);
    hydrated.storageLocation = configuredString(configuration, 'storage', definition.storageLocation ?? '');
    hydrated.authorizedAccess = configuredString(configuration, 'access', definition.authorizedAccess ?? '');
    hydrated.deletionTiming = configuredString(configuration, 'deletion', definition.deletionTiming ?? '');
    hydrated.afterWithdrawal = configuredString(configuration, 'withdrawal', definition.afterWithdrawal ?? '');
  } else if (definition.key === 'ai_assisted_summary') {
    hydrated.provider = configuredString(configuration, 'service', definition.provider ?? '');
    hydrated.scope = configuredString(configuration, 'input_scope', hydrated.scope);
    hydrated.sessionExtent = configuredString(configuration, 'coverage', definition.sessionExtent ?? '');
    hydrated.humanReview = configuredString(configuration, 'human_review', definition.humanReview ?? '');
    hydrated.externalTransfer = configuredString(configuration, 'external_provider', definition.externalTransfer ?? '');
    hydrated.overseasProcessing = configuredString(configuration, 'cross_border', definition.overseasProcessing ?? '');
  } else if (definition.key === 'anonymized_case_use') {
    hydrated.media = configuredString(configuration, 'media', definition.media ?? '');
    hydrated.deIdentification = configuredString(configuration, 'identifiers_removed', definition.deIdentification ?? '');
    hydrated.reIdentificationRisk = configuredString(
      configuration,
      'reidentification_risk',
      definition.reIdentificationRisk ?? '',
    );
    hydrated.usePeriod = configuredString(configuration, 'duration', definition.usePeriod ?? '');
    hydrated.withdrawalDeadline = configuredString(
      configuration,
      'withdrawal',
      definition.withdrawalDeadline ?? '',
    );
  } else if (definition.key === 'marketing_testimonial') {
    hydrated.publicChannels = scalarString(configuration.channels)?.split(',').map((value) => value.trim()).filter(Boolean)
      ?? definition.publicChannels;
    hydrated.publicPeriod = configuredString(configuration, 'duration', definition.publicPeriod ?? '');
  }
  return hydrated;
}

function requiredTemplateString(consent: RawConsent, key: string): string {
  const value = consent[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(422, 'INVALID_SERVER_TEMPLATE', `Server consent ${consent.key} is missing ${key}`);
  }
  return value;
}

function normalizeServerConsent(consent: RawConsent): ConsentDefinition {
  return {
    key: consent.key as ConsentDefinition['key'],
    enabled: consent.enabled === true,
    version: consent.consentTextVersion,
    text: consent.consentText,
    purpose: requiredTemplateString(consent, 'purpose'),
    scope: requiredTemplateString(consent, 'scope'),
    retention: requiredTemplateString(consent, 'retentionPeriod'),
    withdrawal: requiredTemplateString(consent, 'withdrawalMethod'),
    ...(typeof consent.serviceName === 'string' ? { provider: consent.serviceName } : {}),
    ...(typeof consent.sessionUsageScope === 'string' ? { sessionExtent: consent.sessionUsageScope } : {}),
    ...(typeof consent.humanReview === 'string' ? { humanReview: consent.humanReview } : {}),
    ...(typeof consent.externalProviderTerms === 'string' ? { externalTransfer: consent.externalProviderTerms } : {}),
    ...(typeof consent.crossBorderProcessing === 'string'
      ? { overseasProcessing: consent.crossBorderProcessing }
      : {}),
    ...(typeof consent.errorNotice === 'string' ? { errorNotice: consent.errorNotice } : {}),
    ...(typeof consent.storageLocation === 'string' ? { storageLocation: consent.storageLocation } : {}),
    ...(typeof consent.authorizedAccess === 'string' ? { authorizedAccess: consent.authorizedAccess } : {}),
    ...(typeof consent.deletionTiming === 'string' ? { deletionTiming: consent.deletionTiming } : {}),
    ...(typeof consent.afterWithdrawal === 'string' ? { afterWithdrawal: consent.afterWithdrawal } : {}),
    ...(typeof consent.media === 'string' ? { media: consent.media } : {}),
    ...(typeof consent.identifiersRemoved === 'string' ? { deIdentification: consent.identifiersRemoved } : {}),
    ...(typeof consent.reidentificationRisk === 'string'
      ? { reIdentificationRisk: consent.reidentificationRisk }
      : {}),
    ...(typeof consent.withdrawalDeadline === 'string' ? { withdrawalDeadline: consent.withdrawalDeadline } : {}),
    ...(Array.isArray(consent.subSelections) ? { subSelections: consent.subSelections } : {}),
  };
}

export function buildCanonicalIssuedSnapshot(
  contractId: string,
  input: ContractCreateInput,
  parties: PlainParty[],
  env: Env,
  issuedAt: string,
  versionNumber = 1,
): CanonicalIssuedSnapshot {
  if (input.legalReviewStatus !== 'APPROVED' || !input.legalReviewReference) {
    throw new HttpError(422, 'LEGAL_REVIEW_REQUIRED', 'Approved legal review is required to build an issued snapshot');
  }
  const serverTemplate = getServerTemplate(input.contractType);
  const variables = buildTemplateContext(input, parties, env);
  const clauses = serverTemplate.clauses.map((clause, index) => {
    const resolved = interpolateValue(clause, variables, `clauses[${index}]`) as Record<string, unknown>;
    resolved.variables = [];
    return resolved;
  });
  const optionalConsents = serverTemplate.optionalConsents.map((definition, index) => (
    // The client-provided preview template is never trusted at issue time.
    interpolateValue(hydrateConsent(input, normalizeServerConsent(definition)), variables, `optional_consents[${index}]`) as ConsentDefinition
  ));
  const snapshot: CanonicalIssuedSnapshot = {
    schema_version: 'dailycoaching.contract.snapshot.v1',
    contract_id: contractId,
    contract_number: input.contractNumber,
    contract_type: input.contractType,
    template_version: input.templateVersion,
    version_number: versionNumber,
    title: input.title,
    status_at_issue: 'issued',
    issued_at: issuedAt,
    legal_review_status: 'APPROVED',
    legal_review_reference: input.legalReviewReference,
    adult_only_confirmed: true,
    parties: parties.map((party) => ({
      id: party.id,
      role: party.role,
      display_name: party.displayName,
      email: party.email,
      ...(party.phone ? { phone: party.phone } : {}),
      ...(party.organization ? { organization: party.organization } : {}),
      required_signer: party.requiredSigner,
    })),
    goal_summary: input.goalSummary,
    session_count: input.sessionCount,
    session_minutes: input.sessionMinutes,
    delivery_method: input.deliveryMethod,
    start_date: input.startDate,
    expected_end_date: input.expectedEndDate,
    fee_amount: input.feeAmount,
    fee_currency: input.feeCurrency,
    payment_terms: input.paymentTerms,
    cancellation_terms: input.cancellationTerms,
    refund_terms: input.refundTerms,
    confidentiality_scope: input.confidentialityScope,
    reporting_scope: input.reportingScope,
    technology_terms: input.technologyTerms,
    governing_law: input.governingLaw,
    termination_terms: input.terminationTerms,
    clauses,
    optional_consents: optionalConsents,
  };
  const serialized = stableStringify(snapshot);
  if (/\{\{[^{}]+\}\}|\[[^\[\]]+:\s*미입력\]|LEGAL_REVIEW_REQUIRED/u.test(serialized)) {
    throw new HttpError(422, 'UNRESOLVED_CONTRACT_CONTENT', 'Issued snapshot contains unresolved contract content');
  }
  return snapshot;
}

export async function hashCanonicalSnapshot(snapshot: CanonicalIssuedSnapshot): Promise<string> {
  return sha256Hex(stableStringify(snapshot));
}

export function buildFinalManifest(
  snapshot: CanonicalIssuedSnapshot,
  snapshotHash: string,
  parties: PlainParty[],
  consents: Array<PlainConsent & { partyId: string }>,
  auditSummary: Array<{ event_type: string; event_at: string; document_hash: string | null }>,
  fullySignedAt: string,
): FinalManifest {
  const signatures = parties
    .filter((party) => party.requiredSigner)
    .map((party) => {
      if (!party.signedName || !party.signedAt || !party.signatureEventId) {
        throw new HttpError(409, 'MISSING_REQUIRED_SIGNATURE', 'A required signature is missing');
      }
      return {
        party_id: party.id,
        role: party.role,
        signed_name: party.signedName,
        signed_at: party.signedAt,
        signature_event_id: party.signatureEventId,
      };
    });
  return {
    schema_version: 'dailycoaching.contract.final.v1',
    contract_id: snapshot.contract_id,
    snapshot_hash: snapshotHash,
    canonical_snapshot: snapshot,
    signatures,
    optional_consents: consents.map(({ partyId, ...consent }) => ({ party_id: partyId, ...consent })),
    audit_summary: auditSummary.map((event) => ({
      event_type: event.event_type,
      event_at: event.event_at,
      ...(event.document_hash ? { document_hash: event.document_hash } : {}),
    })),
    fully_signed_at: fullySignedAt,
  };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderBody(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return `<p>${escapeHtml(value)}</p>`;
  if (Array.isArray(value)) return value.map(renderBody).join('');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      const items = record.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      return record.ordered === true ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
    }
    if (record.text !== undefined) return `<p>${escapeHtml(record.text)}</p>`;
  }
  return '';
}

export function renderFinalHtml(manifest: FinalManifest, finalDocumentHash: string): string {
  const snapshot = manifest.canonical_snapshot;
  const partyRows = snapshot.parties.map((party) => (
    `<tr><th>${escapeHtml(party.role)}</th><td>${escapeHtml(party.display_name)}</td><td>${escapeHtml(party.email)}</td></tr>`
  )).join('');
  const clauses = snapshot.clauses.map((clause, index) => (
    `<section class="clause"><h2>${String(index + 1).padStart(2, '0')}. ${escapeHtml(clause.title)}</h2>${renderBody(clause.body)}</section>`
  )).join('');
  const signatures = manifest.signatures.map((signature) => (
    `<tr><th>${escapeHtml(signature.role)}</th><td>${escapeHtml(signature.signed_name)}</td><td>${escapeHtml(signature.signed_at)}</td></tr>`
  )).join('');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(snapshot.title)}</title><style>
:root{color:#061528;background:#fffaf2;font:16px/1.7 system-ui,-apple-system,"Noto Sans KR",sans-serif}
body{margin:0}.document{max-width:900px;margin:auto;padding:48px 28px}h1{font-size:2rem}h2{font-size:1.2rem;margin-top:2rem}
table{border-collapse:collapse;width:100%;margin:1.5rem 0}th,td{border:1px solid #d9ccb8;padding:.7rem;text-align:left;vertical-align:top}
.hash{overflow-wrap:anywhere;font-family:ui-monospace,monospace;font-size:.84rem}.notice{border-left:4px solid #c49a57;padding:1rem;background:#f8f0e4}
@media print{.document{max-width:none;padding:0}.no-print{display:none}@page{size:A4;margin:18mm}}
</style></head><body><main class="document">
<p>DAILYCOACHING · FINAL COACHING AGREEMENT</p><h1>${escapeHtml(snapshot.title)}</h1>
<p class="notice">전자문서로 체결된 최종 계약본입니다. 브라우저 인쇄 기능에서 PDF로 저장할 수 있습니다.</p>
<dl><dt>계약번호</dt><dd>${escapeHtml(snapshot.contract_number)}</dd><dt>계약 유형</dt><dd>${escapeHtml(TYPE_LABELS[snapshot.contract_type])}</dd><dt>완료 시각</dt><dd>${escapeHtml(manifest.fully_signed_at)}</dd></dl>
<table><caption>계약 당사자</caption><tbody>${partyRows}</tbody></table>${clauses}
<section><h2>전자서명</h2><table><tbody>${signatures}</tbody></table></section>
<section><h2>문서 무결성</h2><p>발행 스냅샷 SHA-256</p><p class="hash">${escapeHtml(manifest.snapshot_hash)}</p><p>최종 매니페스트 SHA-256</p><p class="hash">${escapeHtml(finalDocumentHash)}</p></section>
</main></body></html>`;
}
