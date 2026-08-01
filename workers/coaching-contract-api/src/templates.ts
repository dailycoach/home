import commonTemplate from '../../../coaching/contracts/templates/common.v1.json';
import lifeTemplate from '../../../coaching/contracts/templates/life.v1.json';
import businessTemplate from '../../../coaching/contracts/templates/business.v1.json';
import careerTemplate from '../../../coaching/contracts/templates/career.v1.json';
import { sha256Hex, stableStringify } from './crypto';
import type { ContractType, Env } from './types';
import { HttpError } from './validation';

interface RawClause {
  order: number;
  id: string;
  title: string;
  summary?: string;
  body: unknown;
  reviewStatus: string;
  required: boolean;
  variables: string[];
}

export interface RawConsent {
  key: string;
  title?: string;
  required: boolean;
  defaultAccepted: boolean;
  enabled: boolean;
  consentTextVersion: string;
  consentText: string;
  [key: string]: unknown;
}

interface RawVariant {
  templateId: string;
  templateVersion: string;
  contractType: ContractType;
  clauses: RawClause[];
  consentOverrides?: RawConsent[] | Record<string, Partial<RawConsent>>;
  legalReviewItems?: unknown[];
}

export interface ServerTemplateBundle {
  templateId: string;
  templateVersion: string;
  contractType: ContractType;
  locale: 'ko-KR';
  title: string;
  clauses: RawClause[];
  optionalConsents: RawConsent[];
  legalReviewItems: unknown[];
}

const variants: Record<ContractType, RawVariant> = {
  life: lifeTemplate as RawVariant,
  business: businessTemplate as RawVariant,
  career: careerTemplate as RawVariant,
};

function normalizeOverrides(value: RawVariant['consentOverrides']): RawConsent[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).map(([key, override]) => ({ key, ...override } as RawConsent));
}

export function getServerTemplate(contractType: ContractType): ServerTemplateBundle {
  const common = commonTemplate as unknown as {
    templateId: string;
    templateVersion: string;
    locale: 'ko-KR';
    title: string;
    clauses: RawClause[];
    optionalConsents: RawConsent[];
    legalReviewItems?: unknown[];
  };
  const variant = variants[contractType];
  const overrides = new Map(normalizeOverrides(variant.consentOverrides).map((item) => [item.key, item]));
  const optionalConsents = common.optionalConsents.map((definition) => ({
    ...definition,
    ...(overrides.get(definition.key) ?? {}),
    key: definition.key,
    required: false,
    defaultAccepted: false,
  }));
  return {
    templateId: `${common.templateId}+${variant.templateId}`,
    templateVersion: variant.templateVersion,
    contractType,
    locale: common.locale,
    title: variant.templateId,
    clauses: [...common.clauses, ...variant.clauses].sort((left, right) => left.order - right.order),
    optionalConsents,
    legalReviewItems: [...(common.legalReviewItems ?? []), ...(variant.legalReviewItems ?? [])],
  };
}

export async function serverTemplateManifestHash(contractType: ContractType): Promise<string> {
  return sha256Hex(stableStringify(getServerTemplate(contractType)));
}

export async function assertApprovedServerTemplate(
  env: Env,
  contractType: ContractType,
  requestedVersion: string,
): Promise<void> {
  const template = getServerTemplate(contractType);
  if (template.templateVersion !== requestedVersion) {
    throw new HttpError(422, 'TEMPLATE_VERSION_MISMATCH', 'Requested template version is not available on the server');
  }
  let approved: Record<string, unknown>;
  try {
    approved = JSON.parse(env.APPROVED_TEMPLATE_MANIFESTS) as Record<string, unknown>;
  } catch {
    throw new HttpError(422, 'TEMPLATE_APPROVAL_REQUIRED', 'Approved server template manifests are not configured');
  }
  const key = `${contractType}:${requestedVersion}`;
  const expectedHash = approved[key];
  const actualHash = await serverTemplateManifestHash(contractType);
  if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/u.test(expectedHash) || expectedHash !== actualHash) {
    throw new HttpError(422, 'TEMPLATE_APPROVAL_REQUIRED', 'Server template does not match an approved manifest');
  }
  if (template.clauses.some((clause) => clause.reviewStatus !== 'CONTENT_READY')
    || template.optionalConsents.some((consent) => consent.required !== false || consent.defaultAccepted !== false)) {
    throw new HttpError(422, 'TEMPLATE_LEGAL_REVIEW_REQUIRED', 'Server template still contains unapproved legal-review content');
  }
}

export function approvedPolicyVariables(env: Env): Record<string, unknown> {
  let policy: Record<string, unknown>;
  try {
    policy = JSON.parse(env.APPROVED_CONTRACT_POLICY_JSON) as Record<string, unknown>;
  } catch {
    throw new HttpError(422, 'LEGAL_POLICY_CONFIGURATION_REQUIRED', 'Approved contract policy variables are not configured');
  }
  if (!policy || Array.isArray(policy) || Object.keys(policy).length === 0
    || /LEGAL_REVIEW_REQUIRED|\{\{[^{}]+\}\}/u.test(stableStringify(policy))) {
    throw new HttpError(422, 'LEGAL_POLICY_CONFIGURATION_REQUIRED', 'Approved contract policy variables are incomplete');
  }
  return policy;
}
