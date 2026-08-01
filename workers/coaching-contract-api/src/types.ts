export type ContractType = 'life' | 'business' | 'career';

export type ContractStatus =
  | 'draft'
  | 'ready'
  | 'issued'
  | 'viewed'
  | 'partially_signed'
  | 'fully_signed'
  | 'expired'
  | 'cancelled'
  | 'superseded'
  | 'terminated';

export type PartyRole = 'coach' | 'client' | 'sponsor' | 'organization_contact';

export type ConsentKey =
  | 'session_recording'
  | 'ai_assisted_summary'
  | 'anonymized_case_use'
  | 'marketing_testimonial';

export interface Env {
  DB: D1Database;
  DOCUMENTS?: R2Bucket;
  DATA_ENCRYPTION_KEY: string;
  DATA_ENCRYPTION_KEY_VERSION: string;
  TOKEN_HASH_SECRET: string;
  OTP_HASH_SECRET: string;
  AUDIT_HASH_SECRET: string;
  CF_ACCESS_TEAM_DOMAIN: string;
  ADMIN_ACCESS_AUDIENCE: string;
  ALLOWED_ORIGIN: string;
  LEGAL_REVIEW_STATUS: string;
  LEGAL_REVIEW_REFERENCE: string;
  CONTRACT_RETENTION_POLICY: string;
  PROCESSOR_AND_TRANSFER_POLICY: string;
  DISPUTE_AND_REFUND_POLICY: string;
  APPROVED_TEMPLATE_MANIFESTS: string;
  APPROVED_CONTRACT_POLICY_JSON: string;
  INVITE_TTL_SECONDS?: string;
  INVITE_SESSION_TTL_SECONDS?: string;
  FINAL_ACCESS_TTL_SECONDS?: string;
  FINAL_DOCUMENT_SESSION_TTL_SECONDS?: string;
  OTP_MAX_ATTEMPTS?: string;
  MAIL_API_KEY?: string;
  MAIL_FROM?: string;
}

export interface AccessIdentity {
  subject: string;
  email?: string;
  issuedAt: number;
}

export interface PartyInput {
  role: PartyRole;
  displayName: string;
  email: string;
  phone?: string;
  organization?: string;
  requiredSigner: boolean;
  verificationMethod: 'invite_pin';
}

export interface ClauseInput {
  id: string;
  order: number;
  title: string;
  summary?: string;
  body: unknown;
  reviewStatus: 'CONTENT_READY' | 'LEGAL_REVIEW_REQUIRED';
  required: boolean;
  variables: string[];
}

export interface ConsentDefinition {
  key: ConsentKey;
  enabled: boolean;
  version: string;
  text: string;
  consentTextVersion?: string;
  consentText?: string;
  consentTextHash?: string;
  purpose: string;
  scope: string;
  retention: string;
  withdrawal: string;
  storageLocation?: string;
  authorizedAccess?: string;
  deletionTiming?: string;
  afterWithdrawal?: string;
  provider?: string;
  sessionExtent?: string;
  humanReview?: string;
  externalTransfer?: string;
  overseasProcessing?: string;
  errorNotice?: string;
  media?: string;
  deIdentification?: string;
  reIdentificationRisk?: string;
  usePeriod?: string;
  withdrawalDeadline?: string;
  publicChannels?: string[];
  publicPeriod?: string;
  subSelections?: unknown[];
}

export interface CanonicalDocumentInput {
  language: 'ko-KR';
  title: string;
  clauses: ClauseInput[];
  consentDefinitions: ConsentDefinition[];
  legalReviewItems: unknown[];
  notices?: {
    electronicDocument: string;
    copyDelivery: string;
    accessPeriod: string;
    saveMethod: string;
    changeTerminationRequest: string;
    verificationRequest: string;
  };
}

export interface ContractCreateInput {
  contractNumber: string;
  contractType: ContractType;
  templateVersion: string;
  title: string;
  parties: PartyInput[];
  goalSummary: string;
  sessionCount: number;
  sessionMinutes: number;
  deliveryMethod: string;
  startDate: string;
  expectedEndDate: string;
  feeAmount: number;
  feeCurrency: string;
  paymentTerms: string;
  cancellationTerms: string;
  refundTerms: string;
  confidentialityScope: string;
  reportingScope: string;
  technologyTerms: string;
  technologyConfiguration: Record<string, unknown>;
  recordManagement: Record<string, unknown>;
  sponsorTerms: Record<string, unknown> | null;
  terminationTerms: string;
  templateVariables: Record<string, unknown>;
  governingLaw: string;
  expiresAt?: string;
  legalReviewStatus: 'LEGAL_REVIEW_REQUIRED' | 'APPROVED';
  legalReviewReference?: string;
  adultClientConfirmed: boolean;
  canonicalDocument: Record<string, unknown> | null;
}

export interface ContractRow {
  id: string;
  contract_number: string;
  contract_type: ContractType;
  template_version: string;
  status: ContractStatus;
  title: string;
  coach_party_id: string;
  client_party_id: string;
  sponsor_party_id: string | null;
  goal_summary_ciphertext: string;
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
  legal_review_status: 'LEGAL_REVIEW_REQUIRED' | 'APPROVED';
  legal_review_reference: string | null;
  adult_client_confirmed: number;
  draft_document_ciphertext: string;
  draft_revision: number;
  encryption_key_version: string;
  issued_at: string | null;
  expires_at: string | null;
  fully_signed_at: string | null;
  cancelled_at: string | null;
  terminated_at: string | null;
  superseded_by: string | null;
  supersedes_contract_id: string | null;
  snapshot_hash: string | null;
  final_document_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartyRow {
  id: string;
  contract_id: string;
  role: PartyRole;
  display_name_ciphertext: string;
  email_ciphertext: string;
  email_hash: string;
  phone_ciphertext: string | null;
  organization_ciphertext: string | null;
  required_signer: number;
  verification_method: string;
  signed_name_ciphertext: string | null;
  signature_event_id: string | null;
  signed_at: string | null;
  created_at: string;
}

export interface InviteRow {
  id: string;
  contract_id: string;
  party_id: string;
  token_hash: string;
  pin_hash: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  locked_at: string | null;
  attempt_count: number;
  created_at: string;
}

export interface InviteSessionRow {
  id: string;
  invite_id: string;
  contract_id: string;
  party_id: string;
  session_hash: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface InviteExchangeRow {
  id: string;
  invite_id: string;
  exchange_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface FinalAccessRow {
  id: string;
  contract_id: string;
  party_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface FinalDocumentSessionRow {
  id: string;
  contract_id: string;
  party_id: string;
  session_hash: string;
  expires_at: string;
  created_at: string;
}

export interface AuditInput {
  contractId: string;
  partyId?: string;
  eventType: string;
  documentHash?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}
