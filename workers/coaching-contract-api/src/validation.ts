import { sha256Hex, stableStringify } from './crypto';
import type {
  CanonicalDocumentInput,
  ClauseInput,
  ConsentDefinition,
  ConsentKey,
  ContractCreateInput,
  ContractStatus,
  ContractType,
  Env,
  PartyInput,
  PartyRole,
} from './types';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export const CONSENT_KEYS: readonly ConsentKey[] = [
  'session_recording',
  'ai_assisted_summary',
  'anonymized_case_use',
  'marketing_testimonial',
] as const;

export const REQUIRED_COMMON_CLAUSES = [
  'common.parties',
  'common.definition_and_purpose',
  'common.scope',
  'common.coach_responsibilities',
  'common.client_responsibilities',
  'common.sponsor_and_third_party',
  'common.goals',
  'common.sessions',
  'common.term',
  'common.fees_and_payment',
  'common.reschedule_lateness_no_show',
  'common.cancellation_and_refund',
  'common.confidentiality',
  'common.confidentiality_exceptions',
  'common.records',
  'common.online_technology',
  'common.recording',
  'common.ai_tools',
  'common.conflicts_and_multiple_roles',
  'common.no_guarantee',
  'common.amendments',
  'common.termination_and_withdrawal',
  'common.electronic_documents',
  'common.disputes',
  'common.privacy',
  'common.optional_consents',
  'common.electronic_signature',
] as const;

export const TYPE_CLAUSES: Readonly<Record<ContractType, readonly string[]>> = {
  life: [
    'life.focus_and_purpose',
    'life.self_determination',
    'life.mental_health_boundary',
    'life.professional_advice_boundary',
    'life.no_guaranteed_change',
  ],
  business: [
    'business.party_structure',
    'business.shared_goals',
    'business.reporting_and_confidentiality',
    'business.sponsor_rights_and_limits',
    'business.conflicts',
    'business.no_performance_guarantee',
    'business.termination',
  ],
  career: [
    'career.focus_and_purpose',
    'career.no_employment_guarantee',
    'career.not_recruitment_agency',
    'career.assessment_use',
    'career.market_information',
    'career.application_materials',
    'career.client_decision',
  ],
};

const ALLOWED_TRANSITIONS: Readonly<Record<ContractStatus, readonly ContractStatus[]>> = {
  draft: ['ready'],
  ready: ['issued'],
  issued: ['viewed', 'expired', 'cancelled', 'superseded'],
  viewed: ['partially_signed'],
  partially_signed: ['fully_signed'],
  fully_signed: ['terminated'],
  expired: [],
  cancelled: [],
  superseded: [],
  terminated: [],
};

export function assertStatusTransition(from: ContractStatus, to: ContractStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new HttpError(409, 'INVALID_STATUS_TRANSITION', `Contract cannot transition from ${from} to ${to}`);
  }
}

export function isSignableStatus(status: ContractStatus): boolean {
  return ['issued', 'viewed', 'partially_signed'].includes(status);
}

export function shouldExpireIssuedContract(
  status: ContractStatus,
  expiresAt: string | null,
  now = Date.now(),
): boolean {
  return status === 'issued' && Boolean(expiresAt) && Date.parse(expiresAt!) <= now;
}

export function canRecoverFinalization(
  status: ContractStatus,
  requiredSignerCount: number,
  signedCount: number,
): boolean {
  return status === 'partially_signed'
    && requiredSignerCount > 0
    && signedCount === requiredSignerCount;
}

function asRecord(value: unknown, field = 'body'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'INVALID_INPUT', `${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringField(
  record: Record<string, unknown>,
  key: string,
  minLength: number,
  maxLength: number,
  options: { pattern?: RegExp; allowPlaceholder?: boolean } = {},
): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new HttpError(400, 'INVALID_INPUT', `${key} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    throw new HttpError(400, 'INVALID_INPUT', `${key} must contain ${minLength}-${maxLength} characters`);
  }
  if (!options.allowPlaceholder && trimmed === 'LEGAL_REVIEW_REQUIRED') {
    throw new HttpError(400, 'INVALID_INPUT', `${key} cannot use a legal-review placeholder`);
  }
  if (options.pattern && !options.pattern.test(trimmed)) {
    throw new HttpError(400, 'INVALID_INPUT', `${key} has an invalid format`);
  }
  return trimmed;
}

function optionalStringField(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new HttpError(400, 'INVALID_INPUT', `${key} must be a string no longer than ${maxLength} characters`);
  }
  return value.trim();
}

function booleanField(record: Record<string, unknown>, key: string): boolean {
  if (typeof record[key] !== 'boolean') {
    throw new HttpError(400, 'INVALID_INPUT', `${key} must be true or false`);
  }
  return record[key];
}

function integerField(record: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new HttpError(400, 'INVALID_INPUT', `${key} must be an integer between ${min} and ${max}`);
  }
  return value as number;
}

function enumField<T extends string>(record: Record<string, unknown>, key: string, values: readonly T[]): T {
  const value = record[key];
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new HttpError(400, 'INVALID_INPUT', `${key} must be one of: ${values.join(', ')}`);
  }
  return value as T;
}

function parseDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new HttpError(400, 'INVALID_INPUT', `${field} must use YYYY-MM-DD`);
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'INVALID_INPUT', `${field} is not a valid date`);
  }
  return value;
}

function parseTimestamp(value: string, field: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new HttpError(400, 'INVALID_INPUT', `${field} must be a valid ISO-8601 timestamp`);
  }
  return new Date(timestamp).toISOString();
}

function parseParty(value: unknown, index: number): PartyInput {
  const record = asRecord(value, `parties[${index}]`);
  const role = enumField<PartyRole>(record, 'role', ['coach', 'client', 'sponsor', 'organization_contact']);
  const email = stringField(record, 'email', 3, 254, {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/u,
  });
  return {
    role,
    displayName: stringField(record, 'displayName', 1, 100),
    email,
    ...(optionalStringField(record, 'phone', 40) ? { phone: optionalStringField(record, 'phone', 40) } : {}),
    ...(optionalStringField(record, 'organization', 160)
      ? { organization: optionalStringField(record, 'organization', 160) }
      : {}),
    requiredSigner: booleanField(record, 'requiredSigner'),
    verificationMethod: record.verificationMethod === undefined
      ? 'invite_pin'
      : enumField(record, 'verificationMethod', ['invite_pin'] as const),
  };
}

function parseClause(value: unknown, index: number): ClauseInput {
  const record = asRecord(value, `clauses[${index}]`);
  const body = record.body;
  if (body === undefined || body === null || encoderLength(stableStringify(body)) > 20_000) {
    throw new HttpError(400, 'INVALID_INPUT', `clauses[${index}].body is missing or too large`);
  }
  const variables = record.variables;
  if (!Array.isArray(variables) || variables.length > 100
    || variables.some((variable) => typeof variable !== 'string' || variable.length > 160)) {
    throw new HttpError(400, 'INVALID_INPUT', `clauses[${index}].variables is invalid`);
  }
  return {
    id: stringField(record, 'id', 2, 100, { pattern: /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/u }),
    order: integerField(record, 'order', 1, 10_000),
    title: stringField(record, 'title', 1, 160),
    ...(optionalStringField(record, 'summary', 2_000) ? { summary: optionalStringField(record, 'summary', 2_000) } : {}),
    body,
    reviewStatus: enumField(record, 'reviewStatus', ['CONTENT_READY', 'LEGAL_REVIEW_REQUIRED'] as const),
    required: booleanField(record, 'required'),
    variables: variables as string[],
  };
}

function parseStringArray(record: Record<string, unknown>, key: string, maxItems: number): string[] | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new HttpError(400, 'INVALID_INPUT', `${key} must be an array with at most ${maxItems} items`);
  }
  return value.map((item, index) => {
    if (typeof item !== 'string' || item.trim().length < 1 || item.trim().length > 160) {
      throw new HttpError(400, 'INVALID_INPUT', `${key}[${index}] is invalid`);
    }
    return item.trim();
  });
}

function parseConsent(value: unknown, index: number): ConsentDefinition {
  const record = asRecord(value, `consentDefinitions[${index}]`);
  const key = enumField<ConsentKey>(record, 'key', CONSENT_KEYS);
  return {
    key,
    enabled: booleanField(record, 'enabled'),
    version: stringField(record, record.consentTextVersion === undefined ? 'version' : 'consentTextVersion', 1, 80),
    text: stringField(record, record.consentText === undefined ? 'text' : 'consentText', 1, 8_000, { allowPlaceholder: true }),
    purpose: stringField(record, 'purpose', 1, 1_000, { allowPlaceholder: true }),
    scope: stringField(record, 'scope', 1, 2_000, { allowPlaceholder: true }),
    retention: stringField(record, record.retentionPeriod === undefined ? 'retention' : 'retentionPeriod', 1, 1_000, { allowPlaceholder: true }),
    withdrawal: stringField(record, record.withdrawalMethod === undefined ? 'withdrawal' : 'withdrawalMethod', 1, 1_000, { allowPlaceholder: true }),
    ...(optionalStringField(record, record.serviceName === undefined ? 'provider' : 'serviceName', 200)
      ? { provider: optionalStringField(record, record.serviceName === undefined ? 'provider' : 'serviceName', 200) }
      : {}),
    ...(optionalStringField(record, record.sessionUsageScope === undefined ? 'sessionExtent' : 'sessionUsageScope', 500)
      ? { sessionExtent: optionalStringField(record, record.sessionUsageScope === undefined ? 'sessionExtent' : 'sessionUsageScope', 500) }
      : {}),
    ...(optionalStringField(record, 'humanReview', 500)
      ? { humanReview: optionalStringField(record, 'humanReview', 500) }
      : {}),
    ...(optionalStringField(record, record.externalProviderTerms === undefined ? 'externalTransfer' : 'externalProviderTerms', 500)
      ? { externalTransfer: optionalStringField(record, record.externalProviderTerms === undefined ? 'externalTransfer' : 'externalProviderTerms', 500) }
      : {}),
    ...(optionalStringField(record, record.crossBorderProcessing === undefined ? 'overseasProcessing' : 'crossBorderProcessing', 500)
      ? { overseasProcessing: optionalStringField(record, record.crossBorderProcessing === undefined ? 'overseasProcessing' : 'crossBorderProcessing', 500) }
      : {}),
    ...(optionalStringField(record, 'errorNotice', 500)
      ? { errorNotice: optionalStringField(record, 'errorNotice', 500) }
      : {}),
    ...(optionalStringField(record, 'media', 500) ? { media: optionalStringField(record, 'media', 500) } : {}),
    ...(optionalStringField(record, record.identifiersRemoved === undefined ? 'deIdentification' : 'identifiersRemoved', 1_000)
      ? { deIdentification: optionalStringField(record, record.identifiersRemoved === undefined ? 'deIdentification' : 'identifiersRemoved', 1_000) }
      : {}),
    ...(optionalStringField(record, record.reidentificationRisk === undefined ? 'reIdentificationRisk' : 'reidentificationRisk', 1_000)
      ? { reIdentificationRisk: optionalStringField(record, record.reidentificationRisk === undefined ? 'reIdentificationRisk' : 'reidentificationRisk', 1_000) }
      : {}),
    ...(optionalStringField(record, 'usePeriod', 500)
      ? { usePeriod: optionalStringField(record, 'usePeriod', 500) }
      : {}),
    ...(optionalStringField(record, 'withdrawalDeadline', 500)
      ? { withdrawalDeadline: optionalStringField(record, 'withdrawalDeadline', 500) }
      : {}),
    ...(parseStringArray(record, 'publicChannels', 20)
      ? { publicChannels: parseStringArray(record, 'publicChannels', 20) }
      : {}),
    ...(optionalStringField(record, 'publicPeriod', 500)
      ? { publicPeriod: optionalStringField(record, 'publicPeriod', 500) }
      : {}),
  };
}

function parseNotices(value: unknown): NonNullable<CanonicalDocumentInput['notices']> {
  const record = asRecord(value, 'notices');
  return {
    electronicDocument: stringField(record, 'electronicDocument', 1, 2_000, { allowPlaceholder: true }),
    copyDelivery: stringField(record, 'copyDelivery', 1, 2_000, { allowPlaceholder: true }),
    accessPeriod: stringField(record, 'accessPeriod', 1, 2_000, { allowPlaceholder: true }),
    saveMethod: stringField(record, 'saveMethod', 1, 2_000, { allowPlaceholder: true }),
    changeTerminationRequest: stringField(record, 'changeTerminationRequest', 1, 2_000, {
      allowPlaceholder: true,
    }),
    verificationRequest: stringField(record, 'verificationRequest', 1, 2_000, { allowPlaceholder: true }),
  };
}

export function parseCanonicalDocument(value: unknown, contractType: ContractType): CanonicalDocumentInput {
  const record = asRecord(value, 'canonicalDocument');
  if (!Array.isArray(record.clauses) || record.clauses.length > 80) {
    throw new HttpError(400, 'INVALID_INPUT', 'canonicalDocument.clauses must contain at most 80 clauses');
  }
  const clauses = record.clauses.map(parseClause);
  const clauseIds = clauses.map((clause) => clause.id);
  if (new Set(clauseIds).size !== clauseIds.length) {
    throw new HttpError(400, 'INVALID_INPUT', 'Clause IDs must be unique');
  }
  const missingClauses = [...REQUIRED_COMMON_CLAUSES, ...TYPE_CLAUSES[contractType]].filter(
    (clauseId) => !clauseIds.includes(clauseId),
  );
  if (missingClauses.length > 0) {
    throw new HttpError(400, 'MISSING_CONTRACT_CLAUSES', 'Required contract clauses are missing', {
      missingClauseIds: missingClauses,
    });
  }
  const consentSource = record.consentDefinitions ?? record.optionalConsents;
  if (!Array.isArray(consentSource) || consentSource.length !== CONSENT_KEYS.length) {
    throw new HttpError(400, 'INVALID_INPUT', 'Exactly four optional consent definitions are required');
  }
  const consentDefinitions = consentSource.map(parseConsent);
  const consentKeys = consentDefinitions.map((consent) => consent.key);
  if (new Set(consentKeys).size !== CONSENT_KEYS.length || CONSENT_KEYS.some((key) => !consentKeys.includes(key))) {
    throw new HttpError(400, 'INVALID_INPUT', 'Each optional consent key must appear exactly once');
  }
  if (encoderLength(stableStringify(record)) > 300_000) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Canonical contract document exceeds 300 KB');
  }
  return {
    language: record.language === undefined
      ? enumField(record, 'locale', ['ko-KR'] as const)
      : enumField(record, 'language', ['ko-KR'] as const),
    title: stringField(record, 'title', 1, 200),
    clauses,
    consentDefinitions,
    legalReviewItems: Array.isArray(record.legalReviewItems) ? record.legalReviewItems : [],
    ...(record.notices === undefined ? {} : { notices: parseNotices(record.notices) }),
  };
}

function parsePreviewDocument(value: unknown): Record<string, unknown> {
  const record = asRecord(value, 'canonicalDocument');
  if (encoderLength(stableStringify(record)) > 350_000) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Draft preview document exceeds 350 KB');
  }
  return record;
}

function encoderLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function parseContractCreateInput(
  value: unknown,
  defaults?: { contractNumber?: string; legalReviewStatus?: 'LEGAL_REVIEW_REQUIRED' | 'APPROVED' },
): ContractCreateInput {
  const record = asRecord(normalizeApiKeys(value));
  if (record.contractNumber === undefined && defaults?.contractNumber) record.contractNumber = defaults.contractNumber;
  if (record.legalReviewStatus === undefined && defaults?.legalReviewStatus) record.legalReviewStatus = defaults.legalReviewStatus;
  if (record.adultClientConfirmed === undefined && record.adultOnlyConfirmed !== undefined) {
    record.adultClientConfirmed = record.adultOnlyConfirmed;
  }
  const contractType = enumField<ContractType>(record, 'contractType', ['life', 'business', 'career']);
  if (!Array.isArray(record.parties) || record.parties.length < 2 || record.parties.length > 4) {
    throw new HttpError(400, 'INVALID_INPUT', 'parties must contain 2-4 parties');
  }
  const parties = record.parties.map(parseParty);
  const roles = parties.map((party) => party.role);
  if (new Set(roles).size !== roles.length || roles.filter((role) => role === 'coach').length !== 1
    || roles.filter((role) => role === 'client').length !== 1) {
    throw new HttpError(400, 'INVALID_PARTY_STRUCTURE', 'Exactly one coach and one client are required; roles must be unique');
  }
  const coach = parties.find((party) => party.role === 'coach');
  const client = parties.find((party) => party.role === 'client');
  if (!coach?.requiredSigner || !client?.requiredSigner) {
    throw new HttpError(400, 'INVALID_PARTY_STRUCTURE', 'Coach and client must be required signers');
  }
  if (contractType === 'business') {
    const sponsor = parties.find((party) => party.role === 'sponsor');
    if (!sponsor || !sponsor.requiredSigner) {
      throw new HttpError(400, 'INVALID_PARTY_STRUCTURE', 'Business contracts require a sponsor who is a required signer');
    }
    const reportingScope = stringField(record, 'reportingScope', 1, 4_000, { allowPlaceholder: true });
    if (reportingScope !== 'none' && !parties.some((party) => ['sponsor', 'organization_contact'].includes(party.role))) {
      throw new HttpError(400, 'INVALID_PARTY_STRUCTURE', 'A reporting recipient party is required when reportingScope is not none');
    }
  }
  if (!booleanField(record, 'adultClientConfirmed')) {
    throw new HttpError(422, 'MINOR_CLIENT_NOT_SUPPORTED', 'v1 supports adult clients only');
  }
  const startDate = parseDate(stringField(record, 'startDate', 10, 10), 'startDate');
  const expectedEndDate = parseDate(stringField(record, 'expectedEndDate', 10, 10), 'expectedEndDate');
  if (expectedEndDate < startDate) {
    throw new HttpError(400, 'INVALID_INPUT', 'expectedEndDate cannot be earlier than startDate');
  }
  const legalReviewStatus = enumField(record, 'legalReviewStatus', ['LEGAL_REVIEW_REQUIRED', 'APPROVED'] as const);
  const legalReviewReference = optionalStringField(record, 'legalReviewReference', 240);
  if (legalReviewStatus === 'APPROVED' && !legalReviewReference) {
    throw new HttpError(400, 'LEGAL_REVIEW_REFERENCE_REQUIRED', 'Approved legal text requires a review reference');
  }
  const expiresAtRaw = optionalStringField(record, 'expiresAt', 40);
  return {
    contractNumber: stringField(record, 'contractNumber', 4, 64, { pattern: /^[A-Za-z0-9][A-Za-z0-9._-]*$/u }),
    contractType,
    templateVersion: stringField(record, 'templateVersion', 1, 40),
    title: stringField(record, 'title', 1, 200),
    parties,
    goalSummary: stringField(record, 'goalSummary', 1, 8_000),
    sessionCount: integerField(record, 'sessionCount', 1, 1000),
    sessionMinutes: integerField(record, 'sessionMinutes', 15, 480),
    deliveryMethod: stringField(record, 'deliveryMethod', 1, 500),
    startDate,
    expectedEndDate,
    feeAmount: integerField(record, 'feeAmount', 0, Number.MAX_SAFE_INTEGER),
    feeCurrency: stringField(record, 'feeCurrency', 3, 3, { pattern: /^[A-Z]{3}$/u }),
    paymentTerms: stringField(record, 'paymentTerms', 1, 4_000, { allowPlaceholder: true }),
    cancellationTerms: stringField(record, 'cancellationTerms', 1, 4_000, { allowPlaceholder: true }),
    refundTerms: stringField(record, 'refundTerms', 1, 4_000, { allowPlaceholder: true }),
    confidentialityScope: stringField(record, 'confidentialityScope', 1, 4_000, { allowPlaceholder: true }),
    reportingScope: stringField(record, 'reportingScope', 1, 4_000, { allowPlaceholder: true }),
    technologyTerms: typeof record.technologyTerms === 'string'
      ? stringField(record, 'technologyTerms', 1, 20_000, { allowPlaceholder: true })
      : stableStringify(asRecord(record.technologyTerms, 'technologyTerms')),
    technologyConfiguration: typeof record.technologyTerms === 'object'
      ? asRecord(record.technologyTerms, 'technologyTerms')
      : {},
    recordManagement: asRecord(record.recordManagement, 'recordManagement'),
    sponsorTerms: record.sponsorTerms === null || record.sponsorTerms === undefined
      ? null
      : asRecord(record.sponsorTerms, 'sponsorTerms'),
    terminationTerms: stringField(record, 'terminationTerms', 1, 4_000, { allowPlaceholder: true }),
    templateVariables: record.templateVariables === undefined
      ? {}
      : asRecord(record.templateVariables, 'templateVariables'),
    governingLaw: stringField(record, 'governingLaw', 1, 1_000, { allowPlaceholder: true }),
    ...(expiresAtRaw ? { expiresAt: parseTimestamp(expiresAtRaw, 'expiresAt') } : {}),
    legalReviewStatus,
    ...(legalReviewReference ? { legalReviewReference } : {}),
    adultClientConfirmed: true,
    canonicalDocument: record.canonicalDocument === undefined
      ? null
      : parsePreviewDocument(record.canonicalDocument),
  };
}

function normalizeApiKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeApiKeys);
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [sourceKey, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = sourceKey.replace(/_([a-z])/gu, (_match, character: string) => character.toUpperCase());
    const normalizedValue = normalizeApiKeys(child);
    if (normalizedKey in result && stableStringify(result[normalizedKey]) !== stableStringify(normalizedValue)) {
      throw new HttpError(400, 'AMBIGUOUS_INPUT', `Conflicting values were provided for ${normalizedKey}`);
    }
    result[normalizedKey] = normalizedValue;
  }
  return result;
}

export async function validateIssueReadiness(input: ContractCreateInput, env: Env): Promise<void> {
  if (env.LEGAL_REVIEW_STATUS !== 'APPROVED'
    || input.legalReviewStatus !== 'APPROVED'
    || !env.LEGAL_REVIEW_REFERENCE
    || env.LEGAL_REVIEW_REFERENCE === 'LEGAL_REVIEW_REQUIRED'
    || input.legalReviewReference !== env.LEGAL_REVIEW_REFERENCE) {
    throw new HttpError(422, 'LEGAL_REVIEW_REQUIRED', 'A reviewed contract and non-empty legal review reference are required before issue');
  }
  const policies = [
    env.CONTRACT_RETENTION_POLICY,
    env.PROCESSOR_AND_TRANSFER_POLICY,
    env.DISPUTE_AND_REFUND_POLICY,
  ];
  if (policies.some((policy) => !policy || policy === 'LEGAL_REVIEW_REQUIRED')) {
    throw new HttpError(422, 'LEGAL_POLICY_CONFIGURATION_REQUIRED', 'Approved retention, processor/transfer, and dispute/refund policies are required');
  }
  const aiValue = input.technologyConfiguration.aiAssistedSummary
    ?? input.technologyConfiguration.ai_assisted_summary;
  const enabledAi = aiValue && typeof aiValue === 'object' && !Array.isArray(aiValue)
    ? aiValue as Record<string, unknown>
    : undefined;
  if (enabledAi?.enabled === true) {
    const requiredAiFields = [
      enabledAi.service,
      enabledAi.inputScope ?? enabledAi.input_scope,
      enabledAi.coverage,
      enabledAi.humanReview ?? enabledAi.human_review,
      enabledAi.externalProvider ?? enabledAi.external_provider,
      enabledAi.crossBorder ?? enabledAi.cross_border,
      enabledAi.retention,
      enabledAi.withdrawal,
    ];
    if (requiredAiFields.some((field) => typeof field !== 'string' || !field || field.includes('LEGAL_REVIEW_REQUIRED'))
      || env.PROCESSOR_AND_TRANSFER_POLICY === 'LEGAL_REVIEW_REQUIRED') {
      throw new HttpError(422, 'AI_CONSENT_NOT_CONFIGURED', 'AI consent cannot be enabled before processor and transfer details are approved');
    }
  }
  const recordingValue = input.technologyConfiguration.sessionRecording
    ?? input.technologyConfiguration.session_recording;
  const recording = recordingValue && typeof recordingValue === 'object' && !Array.isArray(recordingValue)
    ? recordingValue as Record<string, unknown>
    : undefined;
  if (recording?.enabled === true) {
    const fields = ['purpose', 'scope', 'storage', 'access', 'retention', 'deletion', 'withdrawal'];
    if (fields.some((field) => typeof recording[field] !== 'string'
      || !(recording[field] as string).trim()
      || (recording[field] as string).includes('LEGAL_REVIEW_REQUIRED'))) {
      throw new HttpError(422, 'RECORDING_CONSENT_NOT_CONFIGURED', 'Recording consent details are incomplete');
    }
  }
  const snapshotHash = await sha256Hex(stableStringify({
    contractType: input.contractType,
    templateVersion: input.templateVersion,
    legalReviewReference: input.legalReviewReference,
  }));
  if (!/^[a-f0-9]{64}$/u.test(snapshotHash)) {
    throw new HttpError(500, 'HASH_FAILURE', 'Unable to validate contract document');
  }
}

export async function readJsonBody(request: Request, maxBytes = 350_000): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    throw new HttpError(415, 'JSON_REQUIRED', 'Content-Type must be application/json');
  }
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > maxBytes) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds ${maxBytes} bytes`);
  }
  const text = await request.text();
  if (encoderLength(text) > maxBytes) {
    throw new HttpError(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds ${maxBytes} bytes`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Request body contains invalid JSON');
  }
}

export function parseOpaqueTokenBody(value: unknown): string {
  const record = asRecord(normalizeApiKeys(value));
  const key = record.token !== undefined
    ? 'token'
    : record.inviteToken !== undefined
      ? 'inviteToken'
      : 'finalAccessToken';
  return stringField(record, key, 43, 128, { pattern: /^[A-Za-z0-9_-]+$/u });
}

export function parseVerificationBody(value: unknown): { pin: string } {
  const record = asRecord(normalizeApiKeys(value));
  return {
    pin: stringField(record, record.pin === undefined ? 'verificationCode' : 'pin', 6, 6, { pattern: /^\d{6}$/u }),
  };
}

export interface ConsentSelectionInput {
  key: ConsentKey;
  accepted: boolean;
  details?: Record<string, boolean | string | string[]>;
  submittedTextVersion?: string;
  submittedTextHash?: string;
}

export function parseConsentSelections(value: unknown): ConsentSelectionInput[] {
  const record = asRecord(normalizeApiKeys(value));
  const source = record.selections ?? record.consents;
  if (!Array.isArray(source) || source.length !== CONSENT_KEYS.length) {
    throw new HttpError(400, 'INVALID_INPUT', 'Every optional consent requires an explicit selection');
  }
  const selections = source.map((selection, index): ConsentSelectionInput => {
    const item = asRecord(selection, `selections[${index}]`);
    const keyField = item.key === undefined ? 'consentKey' : 'key';
    const key = enumField<ConsentKey>(item, keyField, CONSENT_KEYS);
    const accepted = booleanField(item, 'accepted');
    if (item.required !== undefined && item.required !== false) {
      throw new HttpError(400, 'INVALID_INPUT', 'Optional consents cannot be marked required by the client');
    }
    const detailsValue = item.details ?? item.options;
    if (detailsValue !== undefined && (!detailsValue || typeof detailsValue !== 'object' || Array.isArray(detailsValue))) {
      throw new HttpError(400, 'INVALID_INPUT', `selections[${index}].details must be an object`);
    }
    const details = detailsValue as Record<string, unknown> | undefined;
    if (key === 'marketing_testimonial' && accepted) {
      const requiredBooleanKeys = ['discloseName', 'disclosePhoto', 'discloseOrganization', 'discloseTestimonialText'];
      if (!details || requiredBooleanKeys.some((detailKey) => typeof details[detailKey] !== 'boolean')) {
        throw new HttpError(400, 'MARKETING_CONSENT_DETAILS_REQUIRED', 'Marketing consent requires separate publication choices');
      }
      if (!requiredBooleanKeys.some((detailKey) => details[detailKey] === true)) {
        throw new HttpError(400, 'MARKETING_CONSENT_DETAILS_REQUIRED', 'At least one marketing publication element must be selected');
      }
      if (!Array.isArray(details.publicationChannels) || details.publicationChannels.length === 0
        || details.publicationChannels.some((channel) => typeof channel !== 'string')) {
        throw new HttpError(400, 'MARKETING_CONSENT_DETAILS_REQUIRED', 'Marketing consent requires public channels');
      }
      if (typeof details.publicationPeriod !== 'string' || details.publicationPeriod.trim().length === 0) {
        throw new HttpError(400, 'MARKETING_CONSENT_DETAILS_REQUIRED', 'Marketing consent requires a public period');
      }
    }
    const normalizedDetails = key === 'marketing_testimonial' && details
      ? {
        disclose_name: details.discloseName as boolean,
        disclose_photo: details.disclosePhoto as boolean,
        disclose_organization: details.discloseOrganization as boolean,
        disclose_testimonial_text: details.discloseTestimonialText as boolean,
        publication_channels: details.publicationChannels as string[],
        publication_period: details.publicationPeriod as string,
      }
      : details as Record<string, boolean | string | string[]> | undefined;
    return {
      key,
      accepted,
      ...(normalizedDetails ? { details: normalizedDetails } : {}),
      ...(typeof item.consentTextVersion === 'string'
        ? { submittedTextVersion: item.consentTextVersion }
        : {}),
      ...(typeof item.consentTextHash === 'string' ? { submittedTextHash: item.consentTextHash } : {}),
    };
  });
  if (new Set(selections.map((selection) => selection.key)).size !== CONSENT_KEYS.length) {
    throw new HttpError(400, 'INVALID_INPUT', 'Each optional consent must be selected exactly once');
  }
  return selections;
}

export function parseSignatureBody(value: unknown): {
  signedName: string;
  confirmContract: true;
  confirmElectronicSignature: true;
  requestId: string;
  submittedDocumentHash?: string;
} {
  const record = asRecord(normalizeApiKeys(value));
  const confirmations = record.confirmations === undefined
    ? {}
    : asRecord(record.confirmations, 'confirmations');
  const confirmContract = record.confirmContract === true
    || confirmations.contractRead === true
      && confirmations.importantTerms === true
      && confirmations.electronicDocument === true;
  const confirmElectronicSignature = record.confirmElectronicSignature === true
    || record.electronicSignatureIntent === true;
  if (!confirmContract || !confirmElectronicSignature) {
    throw new HttpError(400, 'SIGNATURE_CONFIRMATION_REQUIRED', 'Both contract and electronic-signature confirmations are required');
  }
  return {
    signedName: stringField(record, 'signedName', 1, 100),
    confirmContract: true,
    confirmElectronicSignature: true,
    requestId: stringField(record, 'requestId', 16, 128, { pattern: /^[A-Za-z0-9_-]+$/u }),
    ...(typeof record.documentHash === 'string'
      ? { submittedDocumentHash: stringField(record, 'documentHash', 64, 64, { pattern: /^[a-f0-9]{64}$/u }) }
      : {}),
  };
}

export function parseListQuery(url: URL): { limit: number; cursor?: string; status?: ContractStatus } {
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw === null ? 20 : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new HttpError(400, 'INVALID_INPUT', 'limit must be an integer between 1 and 100');
  }
  const cursor = url.searchParams.get('cursor') ?? undefined;
  if (cursor && (cursor.length > 80 || !/^[A-Za-z0-9:._-]+$/u.test(cursor))) {
    throw new HttpError(400, 'INVALID_INPUT', 'cursor is invalid');
  }
  const statusRaw = url.searchParams.get('status') ?? undefined;
  const statuses: ContractStatus[] = [
    'draft', 'ready', 'issued', 'viewed', 'partially_signed',
    'fully_signed', 'expired', 'cancelled', 'superseded', 'terminated',
  ];
  if (statusRaw && !statuses.includes(statusRaw as ContractStatus)) {
    throw new HttpError(400, 'INVALID_INPUT', 'status is invalid');
  }
  return {
    limit,
    ...(cursor ? { cursor } : {}),
    ...(statusRaw ? { status: statusRaw as ContractStatus } : {}),
  };
}

export function parsePositiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Configuration value must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function validateRuntimeConfiguration(env: Env): void {
  let allowed: URL;
  try {
    allowed = new URL(env.ALLOWED_ORIGIN);
  } catch {
    throw new Error('ALLOWED_ORIGIN must be an absolute URL');
  }
  if (allowed.origin !== env.ALLOWED_ORIGIN || allowed.protocol !== 'https:') {
    throw new Error('ALLOWED_ORIGIN must be one exact HTTPS origin without a path');
  }
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/iu.test(env.CF_ACCESS_TEAM_DOMAIN)) {
    throw new Error('CF_ACCESS_TEAM_DOMAIN must be a fixed Cloudflare Access team domain');
  }
  if (!env.ADMIN_ACCESS_AUDIENCE || env.ADMIN_ACCESS_AUDIENCE.length > 200) {
    throw new Error('ADMIN_ACCESS_AUDIENCE is required');
  }
  let encryptionKeyLength = 0;
  try {
    encryptionKeyLength = atob(env.DATA_ENCRYPTION_KEY.trim()).length;
  } catch {
    throw new Error('DATA_ENCRYPTION_KEY must be valid base64');
  }
  if (encryptionKeyLength !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
  const secretValues = [env.TOKEN_HASH_SECRET, env.OTP_HASH_SECRET, env.AUDIT_HASH_SECRET];
  if (secretValues.some((secret) => new TextEncoder().encode(secret ?? '').byteLength < 32)
    || new Set(secretValues).size !== secretValues.length) {
    throw new Error('HMAC secrets must be distinct and at least 32 bytes each');
  }
  if (!['LEGAL_REVIEW_REQUIRED', 'APPROVED'].includes(env.LEGAL_REVIEW_STATUS)) {
    throw new Error('LEGAL_REVIEW_STATUS must be LEGAL_REVIEW_REQUIRED or APPROVED');
  }
  if (env.LEGAL_REVIEW_STATUS === 'APPROVED'
    && (!env.LEGAL_REVIEW_REFERENCE || env.LEGAL_REVIEW_REFERENCE === 'LEGAL_REVIEW_REQUIRED')) {
    throw new Error('LEGAL_REVIEW_REFERENCE is required for approved operation');
  }
  parsePositiveInt(env.INVITE_TTL_SECONDS, 604_800, 300, 2_592_000);
  parsePositiveInt(env.INVITE_SESSION_TTL_SECONDS, 1_800, 300, 3_600);
  parsePositiveInt(env.FINAL_ACCESS_TTL_SECONDS, 604_800, 300, 2_592_000);
  parsePositiveInt(env.FINAL_DOCUMENT_SESSION_TTL_SECONDS, 900, 60, 3_600);
  parsePositiveInt(env.OTP_MAX_ATTEMPTS, 5, 3, 10);
}
