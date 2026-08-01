import {
  decryptText,
  encryptText,
  hashEmail,
  hmacHex,
  randomId,
  randomPin,
  randomToken,
  sha256Hex,
  stableStringify,
  timingSafeEqual,
} from './crypto';
import {
  createAuditStatement,
  createConsentWithdrawalAuditStatement,
  createContractExpiryAuditStatement,
  recordAuditEvent,
} from './audit';
import {
  authenticateFinalDocumentSession,
  authenticateInviteExchange,
  authenticateInviteSession,
} from './auth';
import {
  buildCanonicalIssuedSnapshot,
  buildFinalManifest,
  hashCanonicalSnapshot,
  renderFinalHtml,
} from './documents';
import type {
  CanonicalIssuedSnapshot,
  FinalManifest,
  PlainConsent,
  PlainParty,
} from './documents';
import { assertApprovedServerTemplate } from './templates';
import type {
  AccessIdentity,
  ContractCreateInput,
  ContractRow,
  ContractStatus,
  Env,
  FinalAccessRow,
  FinalDocumentSessionRow,
  InviteRow,
  PartyInput,
  PartyRole,
  PartyRow,
} from './types';
import {
  CONSENT_KEYS,
  HttpError,
  assertStatusTransition,
  canRecoverFinalization,
  isSignableStatus,
  parseConsentSelections,
  parseContractCreateInput,
  parseListQuery,
  parseOpaqueTokenBody,
  parsePositiveInt,
  parseSignatureBody,
  parseVerificationBody,
  shouldExpireIssuedContract,
  validateIssueReadiness,
} from './validation';

export interface ServiceResult {
  status?: number;
  body?: unknown;
  html?: string;
}

interface ConsentRow {
  id: string;
  contract_id: string;
  party_id: string;
  consent_key: string;
  required: number;
  enabled: number;
  accepted: number;
  consent_text_version: string;
  consent_text_hash: string;
  selection_details_ciphertext: string | null;
  selected_at: string | null;
  accepted_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
}

interface VersionRow {
  id: string;
  contract_id: string;
  version_number: number;
  template_version: string;
  canonical_snapshot_ciphertext: string;
  snapshot_hash: string;
  encryption_key_version: string;
  created_by: string;
  created_at: string;
}

interface FinalDocumentRow {
  id: string;
  contract_id: string;
  final_snapshot_ciphertext: string;
  html_ciphertext: string;
  document_hash: string;
  encryption_key_version: string;
  r2_object_key: string | null;
  created_at: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function addSeconds(timestamp: string, seconds: number): string {
  return new Date(Date.parse(timestamp) + seconds * 1000).toISOString();
}

function contractAad(contractId: string, field: string): string {
  return `dailycoaching:contract:${contractId}:${field}`;
}

function partyAad(contractId: string, partyId: string, field: string): string {
  return `dailycoaching:contract:${contractId}:party:${partyId}:${field}`;
}

function asBodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'INVALID_INPUT', 'Request body must be an object');
  }
  return value as Record<string, unknown>;
}

function snakeOrCamel(record: Record<string, unknown>, camel: string, snake: string): unknown {
  return record[camel] ?? record[snake];
}

function generatedContractNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `DC-${date}-${randomToken(32).slice(0, 10).toUpperCase()}`;
}

function adminRequestId(value: unknown): string {
  const body = asBodyRecord(value);
  const candidate = snakeOrCamel(body, 'requestId', 'request_id');
  if (typeof candidate !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/u.test(candidate)) {
    throw new HttpError(400, 'REQUEST_ID_REQUIRED', 'A random request_id is required for replay protection');
  }
  return candidate;
}

function withDraftDefaults(value: unknown, env: Env, contractNumber?: string): Record<string, unknown> {
  const input = { ...asBodyRecord(value) };
  if (snakeOrCamel(input, 'contractNumber', 'contract_number') === undefined) {
    input.contract_number = contractNumber ?? generatedContractNumber();
  }
  if (snakeOrCamel(input, 'legalReviewStatus', 'legal_review_status') === undefined) {
    input.legal_review_status = env.LEGAL_REVIEW_STATUS === 'APPROVED' ? 'APPROVED' : 'LEGAL_REVIEW_REQUIRED';
  }
  if (snakeOrCamel(input, 'legalReviewReference', 'legal_review_reference') === undefined
    && env.LEGAL_REVIEW_STATUS === 'APPROVED') {
    input.legal_review_reference = env.LEGAL_REVIEW_REFERENCE;
  }
  if (snakeOrCamel(input, 'governingLaw', 'governing_law') === undefined) {
    input.governing_law = 'LEGAL_REVIEW_REQUIRED';
  }
  return input;
}

async function getContract(env: Env, id: string): Promise<ContractRow> {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) {
    throw new HttpError(404, 'CONTRACT_NOT_FOUND', 'Contract was not found');
  }
  const contract = await env.DB.prepare('SELECT * FROM contracts WHERE id = ? LIMIT 1').bind(id).first<ContractRow>();
  if (!contract) throw new HttpError(404, 'CONTRACT_NOT_FOUND', 'Contract was not found');
  return contract;
}

async function getParties(env: Env, contractId: string): Promise<PartyRow[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM contract_parties WHERE contract_id = ? ORDER BY created_at, id',
  ).bind(contractId).all<PartyRow>();
  return result.results;
}

async function decryptParty(env: Env, row: PartyRow): Promise<PlainParty> {
  const [displayName, email, phone, organization, signedName] = await Promise.all([
    decryptText(
      row.display_name_ciphertext,
      env.DATA_ENCRYPTION_KEY,
      env.DATA_ENCRYPTION_KEY_VERSION,
      partyAad(row.contract_id, row.id, 'display-name'),
    ),
    decryptText(
      row.email_ciphertext,
      env.DATA_ENCRYPTION_KEY,
      env.DATA_ENCRYPTION_KEY_VERSION,
      partyAad(row.contract_id, row.id, 'email'),
    ),
    row.phone_ciphertext
      ? decryptText(
        row.phone_ciphertext,
        env.DATA_ENCRYPTION_KEY,
        env.DATA_ENCRYPTION_KEY_VERSION,
        partyAad(row.contract_id, row.id, 'phone'),
      )
      : Promise.resolve(undefined),
    row.organization_ciphertext
      ? decryptText(
        row.organization_ciphertext,
        env.DATA_ENCRYPTION_KEY,
        env.DATA_ENCRYPTION_KEY_VERSION,
        partyAad(row.contract_id, row.id, 'organization'),
      )
      : Promise.resolve(undefined),
    row.signed_name_ciphertext
      ? decryptText(
        row.signed_name_ciphertext,
        env.DATA_ENCRYPTION_KEY,
        env.DATA_ENCRYPTION_KEY_VERSION,
        partyAad(row.contract_id, row.id, 'signed-name'),
      )
      : Promise.resolve(undefined),
  ]);
  return {
    id: row.id,
    role: row.role,
    displayName,
    email,
    ...(phone ? { phone } : {}),
    ...(organization ? { organization } : {}),
    requiredSigner: row.required_signer === 1,
    ...(signedName ? { signedName } : {}),
    ...(row.signed_at ? { signedAt: row.signed_at } : {}),
    ...(row.signature_event_id ? { signatureEventId: row.signature_event_id } : {}),
  };
}

async function decryptParties(env: Env, contractId: string): Promise<PlainParty[]> {
  return Promise.all((await getParties(env, contractId)).map((party) => decryptParty(env, party)));
}

async function encryptPartyFields(
  env: Env,
  contractId: string,
  partyId: string,
  party: PartyInput,
): Promise<{
  displayName: string;
  email: string;
  emailHash: string;
  phone: string | null;
  organization: string | null;
}> {
  const [displayName, email, emailHash, phone, organization] = await Promise.all([
    encryptText(
      party.displayName,
      env.DATA_ENCRYPTION_KEY,
      env.DATA_ENCRYPTION_KEY_VERSION,
      partyAad(contractId, partyId, 'display-name'),
    ),
    encryptText(
      party.email,
      env.DATA_ENCRYPTION_KEY,
      env.DATA_ENCRYPTION_KEY_VERSION,
      partyAad(contractId, partyId, 'email'),
    ),
    hashEmail(env.TOKEN_HASH_SECRET, party.email),
    party.phone
      ? encryptText(
        party.phone,
        env.DATA_ENCRYPTION_KEY,
        env.DATA_ENCRYPTION_KEY_VERSION,
        partyAad(contractId, partyId, 'phone'),
      )
      : Promise.resolve(null),
    party.organization
      ? encryptText(
        party.organization,
        env.DATA_ENCRYPTION_KEY,
        env.DATA_ENCRYPTION_KEY_VERSION,
        partyAad(contractId, partyId, 'organization'),
      )
      : Promise.resolve(null),
  ]);
  return { displayName, email, emailHash, phone, organization };
}

async function encryptContractFields(env: Env, id: string, input: ContractCreateInput): Promise<Record<string, string>> {
  const entries: Array<[string, string]> = [
    ['goal-summary', input.goalSummary],
    ['payment-terms', input.paymentTerms],
    ['cancellation-terms', input.cancellationTerms],
    ['refund-terms', input.refundTerms],
    ['confidentiality-scope', input.confidentialityScope],
    ['reporting-scope', input.reportingScope],
    ['technology-terms', input.technologyTerms],
    ['governing-law', input.governingLaw],
    ['draft-document', stableStringify(input)],
  ];
  const encrypted = await Promise.all(entries.map(async ([field, plaintext]) => [
    field,
    await encryptText(
      plaintext,
      env.DATA_ENCRYPTION_KEY,
      env.DATA_ENCRYPTION_KEY_VERSION,
      contractAad(id, field),
    ),
  ] as const));
  return Object.fromEntries(encrypted);
}

async function readDraftInput(env: Env, contract: ContractRow): Promise<ContractCreateInput> {
  const plaintext = await decryptText(
    contract.draft_document_ciphertext,
    env.DATA_ENCRYPTION_KEY,
    contract.encryption_key_version,
    contractAad(contract.id, 'draft-document'),
  );
  try {
    return JSON.parse(plaintext) as ContractCreateInput;
  } catch {
    throw new HttpError(500, 'DRAFT_INTEGRITY_FAILURE', 'Stored draft cannot be read');
  }
}

function partyIdsForInput(input: ContractCreateInput, existing?: PartyRow[]): Record<PartyRole, string | null> {
  const roleMap = new Map(existing?.map((party) => [party.role, party.id]));
  const ids: Record<PartyRole, string | null> = {
    coach: null,
    client: null,
    sponsor: null,
    organization_contact: null,
  };
  for (const party of input.parties) ids[party.role] = roleMap.get(party.role) ?? randomId();
  return ids;
}

async function partyStatements(
  env: Env,
  contractId: string,
  input: ContractCreateInput,
  ids: Record<PartyRole, string | null>,
  timestamp: string,
  existing?: PartyRow[],
): Promise<D1PreparedStatement[]> {
  const statements: D1PreparedStatement[] = [];
  const existingRoles = new Set(existing?.map((party) => party.role) ?? []);
  for (const party of input.parties) {
    const partyId = ids[party.role];
    if (!partyId) throw new Error(`Missing party ID for ${party.role}`);
    const encrypted = await encryptPartyFields(env, contractId, partyId, party);
    if (existingRoles.has(party.role)) {
      statements.push(env.DB.prepare(
        `UPDATE contract_parties SET
           display_name_ciphertext = ?, email_ciphertext = ?, email_hash = ?,
           phone_ciphertext = ?, organization_ciphertext = ?, required_signer = ?, verification_method = ?
         WHERE contract_id = ? AND role = ?`,
      ).bind(
        encrypted.displayName,
        encrypted.email,
        encrypted.emailHash,
        encrypted.phone,
        encrypted.organization,
        party.requiredSigner ? 1 : 0,
        party.verificationMethod,
        contractId,
        party.role,
      ));
    } else {
      statements.push(env.DB.prepare(
        `INSERT INTO contract_parties (
           id, contract_id, role, display_name_ciphertext, email_ciphertext, email_hash,
           phone_ciphertext, organization_ciphertext, required_signer, verification_method, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        partyId,
        contractId,
        party.role,
        encrypted.displayName,
        encrypted.email,
        encrypted.emailHash,
        encrypted.phone,
        encrypted.organization,
        party.requiredSigner ? 1 : 0,
        party.verificationMethod,
        timestamp,
      ));
    }
  }
  if (existing && existing.length > 0) {
    const activeRoles = input.parties.map((party) => party.role);
    const placeholders = activeRoles.map(() => '?').join(', ');
    statements.push(env.DB.prepare(
      `DELETE FROM contract_parties WHERE contract_id = ? AND role NOT IN (${placeholders})`,
    ).bind(contractId, ...activeRoles));
  }
  return statements;
}

async function createContractInternal(
  request: Request,
  env: Env,
  identity: AccessIdentity,
  value: unknown,
  supersedesContractId?: string,
): Promise<ServiceResult> {
  const timestamp = nowIso();
  const requestNonce = adminRequestId(value);
  const input = parseContractCreateInput(withDraftDefaults(value, env));
  const id = randomId();
  const ids = partyIdsForInput(input);
  const coachPartyId = ids.coach;
  const clientPartyId = ids.client;
  if (!coachPartyId || !clientPartyId) throw new Error('Validated contract is missing required party IDs');
  const encrypted = await encryptContractFields(env, id, input);
  const actorHash = await hmacHex(env.TOKEN_HASH_SECRET, 'admin-subject-v1', identity.subject);
  const requestNonceHash = await hmacHex(env.TOKEN_HASH_SECRET, `admin-create-v1:${actorHash}`, requestNonce);
  const existingRequest = await env.DB.prepare(
    `SELECT resource_id FROM admin_request_nonces
      WHERE actor_hash = ? AND action = 'contract_create' AND request_nonce_hash = ? LIMIT 1`,
  ).bind(actorHash, requestNonceHash).first<{ resource_id: string }>();
  if (existingRequest) {
    const existing = await getContract(env, existingRequest.resource_id);
    return {
      body: {
        id: existing.id,
        contract_number: existing.contract_number,
        contract_type: existing.contract_type,
        status: existing.status,
        version_number: existing.draft_revision,
        idempotent_replay: true,
      },
    };
  }
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO admin_request_nonces (
         id, actor_hash, action, request_nonce_hash, resource_id, created_at
       ) VALUES (?, ?, 'contract_create', ?, ?, ?)`,
    ).bind(randomId(), actorHash, requestNonceHash, id, timestamp),
    env.DB.prepare(
    `INSERT INTO contracts (
       id, contract_number, contract_type, template_version, status, title,
       coach_party_id, client_party_id, sponsor_party_id,
       goal_summary_ciphertext, session_count, session_minutes, delivery_method,
       start_date, expected_end_date, fee_amount, fee_currency,
       payment_terms, cancellation_terms, refund_terms,
       confidentiality_scope, reporting_scope, technology_terms, governing_law,
       legal_review_status, legal_review_reference, adult_client_confirmed,
       draft_document_ciphertext, draft_revision, encryption_key_version,
       supersedes_contract_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?, ?, ?)`,
  ).bind(
    id,
    input.contractNumber,
    input.contractType,
    input.templateVersion,
    input.title,
    coachPartyId,
    clientPartyId,
    ids.sponsor,
    encrypted['goal-summary'],
    input.sessionCount,
    input.sessionMinutes,
    input.deliveryMethod,
    input.startDate,
    input.expectedEndDate,
    input.feeAmount,
    input.feeCurrency,
    encrypted['payment-terms'],
    encrypted['cancellation-terms'],
    encrypted['refund-terms'],
    encrypted['confidentiality-scope'],
    encrypted['reporting-scope'],
    encrypted['technology-terms'],
    encrypted['governing-law'],
    input.legalReviewStatus,
    input.legalReviewReference ?? null,
    encrypted['draft-document'],
    env.DATA_ENCRYPTION_KEY_VERSION,
    supersedesContractId ?? null,
    timestamp,
    timestamp,
  )];
  statements.push(...await partyStatements(env, id, input, ids, timestamp));
  statements.push(await createAuditStatement(request, env, {
    contractId: id,
    eventType: 'contract_created',
    metadata: { actor_ref: actorHash.slice(0, 24), replacement: Boolean(supersedesContractId) },
  }));
  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (String(error).toLowerCase().includes('unique')) {
      const replay = await env.DB.prepare(
        `SELECT resource_id FROM admin_request_nonces
          WHERE actor_hash = ? AND action = 'contract_create' AND request_nonce_hash = ? LIMIT 1`,
      ).bind(actorHash, requestNonceHash).first<{ resource_id: string }>();
      if (replay) {
        const existing = await getContract(env, replay.resource_id);
        return {
          body: {
            id: existing.id,
            contract_number: existing.contract_number,
            contract_type: existing.contract_type,
            status: existing.status,
            version_number: existing.draft_revision,
            idempotent_replay: true,
          },
        };
      }
      throw new HttpError(409, 'CONTRACT_CONFLICT', 'Contract number or party data conflicts with an existing draft');
    }
    throw error;
  }
  return {
    status: 201,
    body: {
      id,
      contract_number: input.contractNumber,
      contract_type: input.contractType,
      status: 'draft',
      version_number: 1,
      legal_review_status: input.legalReviewStatus,
      supersedes_contract_id: supersedesContractId ?? null,
      created_at: timestamp,
    },
  };
}

export async function createAdminContract(
  request: Request,
  env: Env,
  identity: AccessIdentity,
  value: unknown,
): Promise<ServiceResult> {
  return createContractInternal(request, env, identity, value);
}

export async function updateAdminContract(
  request: Request,
  env: Env,
  identity: AccessIdentity,
  contractId: string,
  value: unknown,
): Promise<ServiceResult> {
  const contract = await getContract(env, contractId);
  if (contract.status !== 'draft') {
    throw new HttpError(409, 'ISSUED_CONTRACT_IMMUTABLE', 'Only draft contracts can be updated');
  }
  const body = asBodyRecord(value);
  const expectedRevision = Number(snakeOrCamel(body, 'expectedVersion', 'expected_version'));
  if (!Number.isInteger(expectedRevision) || expectedRevision !== contract.draft_revision) {
    throw new HttpError(409, 'DRAFT_VERSION_CONFLICT', 'Draft was changed by another request');
  }
  const input = parseContractCreateInput(withDraftDefaults(body, env, contract.contract_number));
  if (input.contractNumber !== contract.contract_number) {
    throw new HttpError(400, 'CONTRACT_NUMBER_IMMUTABLE', 'Contract number cannot be changed');
  }
  const timestamp = nowIso();
  const existingParties = await getParties(env, contractId);
  const ids = partyIdsForInput(input, existingParties);
  if (!ids.coach || !ids.client) throw new Error('Validated contract is missing required party IDs');
  const encrypted = await encryptContractFields(env, contractId, input);
  const actorHash = await hmacHex(env.TOKEN_HASH_SECRET, 'admin-subject-v1', identity.subject);
  const updateStatement = env.DB.prepare(
    `UPDATE contracts SET
       contract_type = ?, template_version = ?, title = ?,
       coach_party_id = ?, client_party_id = ?, sponsor_party_id = ?,
       goal_summary_ciphertext = ?, session_count = ?, session_minutes = ?, delivery_method = ?,
       start_date = ?, expected_end_date = ?, fee_amount = ?, fee_currency = ?,
       payment_terms = ?, cancellation_terms = ?, refund_terms = ?,
       confidentiality_scope = ?, reporting_scope = ?, technology_terms = ?, governing_law = ?,
       legal_review_status = ?, legal_review_reference = ?, adult_client_confirmed = 1,
       draft_document_ciphertext = ?, draft_revision = draft_revision + 1,
       encryption_key_version = ?, updated_at = ?
     WHERE id = ? AND status = 'draft' AND draft_revision = ?`,
  ).bind(
    input.contractType,
    input.templateVersion,
    input.title,
    ids.coach,
    ids.client,
    ids.sponsor,
    encrypted['goal-summary'],
    input.sessionCount,
    input.sessionMinutes,
    input.deliveryMethod,
    input.startDate,
    input.expectedEndDate,
    input.feeAmount,
    input.feeCurrency,
    encrypted['payment-terms'],
    encrypted['cancellation-terms'],
    encrypted['refund-terms'],
    encrypted['confidentiality-scope'],
    encrypted['reporting-scope'],
    encrypted['technology-terms'],
    encrypted['governing-law'],
    input.legalReviewStatus,
    input.legalReviewReference ?? null,
    encrypted['draft-document'],
    env.DATA_ENCRYPTION_KEY_VERSION,
    timestamp,
    contractId,
    expectedRevision,
  );
  const statements = [
    updateStatement,
    ...await partyStatements(env, contractId, input, ids, timestamp, existingParties),
    await createAuditStatement(request, env, {
      contractId,
      eventType: 'contract_updated',
      metadata: { actor_ref: actorHash.slice(0, 24), revision: expectedRevision + 1 },
    }),
  ];
  const results = await env.DB.batch(statements);
  if ((results[0]?.meta.changes ?? 0) !== 1) {
    throw new HttpError(409, 'DRAFT_VERSION_CONFLICT', 'Draft was changed by another request');
  }
  return {
    body: {
      id: contractId,
      contract_number: contract.contract_number,
      status: 'draft',
      version_number: expectedRevision + 1,
      legal_review_status: input.legalReviewStatus,
      updated_at: timestamp,
    },
  };
}

function parseIssueRequest(value: unknown, expectedRevision: number): { signedName: string; revision: number } {
  const body = asBodyRecord(value);
  const revision = Number(snakeOrCamel(body, 'expectedVersion', 'expected_version'));
  if (!Number.isInteger(revision) || revision !== expectedRevision) {
    throw new HttpError(409, 'DRAFT_VERSION_CONFLICT', 'Draft was changed by another request');
  }
  const signatureValue = snakeOrCamel(body, 'coachSignature', 'coach_signature');
  const signature = asBodyRecord(signatureValue);
  const signedName = snakeOrCamel(signature, 'signedName', 'signed_name');
  const intent = snakeOrCamel(signature, 'intentConfirmed', 'intent_confirmed');
  if (typeof signedName !== 'string' || signedName.trim().length < 1 || signedName.trim().length > 100 || intent !== true) {
    throw new HttpError(400, 'COACH_SIGNATURE_REQUIRED', 'Coach signature name and explicit intent are required');
  }
  return { signedName: signedName.trim(), revision };
}

interface PendingInvite {
  id: string;
  partyId: string;
  role: PartyRole;
  token: string;
  tokenHash: string;
  pin: string;
  pinHash: string;
  expiresAt: string;
}

async function pendingInvite(
  env: Env,
  party: PlainParty,
  expiresAt: string,
): Promise<PendingInvite> {
  const id = randomId();
  const token = randomToken(32);
  const pin = randomPin();
  const [tokenHash, pinHash] = await Promise.all([
    hmacHex(env.TOKEN_HASH_SECRET, 'invite-token-v1', token),
    hmacHex(env.OTP_HASH_SECRET, `invite-pin-v1:${id}`, pin),
  ]);
  return { id, partyId: party.id, role: party.role, token, tokenHash, pin, pinHash, expiresAt };
}

export async function issueAdminContract(
  request: Request,
  env: Env,
  identity: AccessIdentity,
  contractId: string,
  value: unknown,
): Promise<ServiceResult> {
  const contract = await getContract(env, contractId);
  if (contract.status !== 'draft') {
    throw new HttpError(409, 'CONTRACT_NOT_DRAFT', 'Only a draft can be issued');
  }
  const issueRequest = parseIssueRequest(value, contract.draft_revision);
  const input = await readDraftInput(env, contract);
  await validateIssueReadiness(input, env);
  await assertApprovedServerTemplate(env, input.contractType, input.templateVersion);
  const parties = await decryptParties(env, contractId);
  const coach = parties.find((party) => party.role === 'coach');
  const client = parties.find((party) => party.role === 'client');
  if (!coach || !client || !coach.requiredSigner || !client.requiredSigner) {
    throw new HttpError(422, 'INVALID_PARTY_STRUCTURE', 'Coach and client must be required signers');
  }
  if (input.contractType === 'business' && input.parties.some((party) => party.role === 'sponsor' && party.requiredSigner)) {
    const sponsor = parties.find((party) => party.role === 'sponsor');
    if (!sponsor?.requiredSigner) {
      throw new HttpError(422, 'INVALID_PARTY_STRUCTURE', 'Required business sponsor is missing');
    }
  }
  const timestamp = nowIso();
  const inviteTtl = parsePositiveInt(env.INVITE_TTL_SECONDS, 604_800, 300, 2_592_000);
  const expiresAt = input.expiresAt ?? addSeconds(timestamp, inviteTtl);
  if (Date.parse(expiresAt) <= Date.parse(timestamp) + 5 * 60 * 1000) {
    throw new HttpError(422, 'INVALID_EXPIRY', 'Contract invitation expiry must be at least five minutes in the future');
  }
  const snapshot = buildCanonicalIssuedSnapshot(contractId, input, parties, env, timestamp, 1);
  await Promise.all(snapshot.optional_consents.map(async (definition) => {
    definition.consentTextVersion = definition.version;
    definition.consentText = definition.text;
    definition.consentTextHash = await sha256Hex(definition.text);
  }));
  const snapshotHash = await hashCanonicalSnapshot(snapshot);
  const snapshotCiphertext = await encryptText(
    stableStringify(snapshot),
    env.DATA_ENCRYPTION_KEY,
    env.DATA_ENCRYPTION_KEY_VERSION,
    contractAad(contractId, 'version:1:snapshot'),
  );
  const coachSignatureEventId = randomId();
  const coachSignedNameCiphertext = await encryptText(
    issueRequest.signedName,
    env.DATA_ENCRYPTION_KEY,
    env.DATA_ENCRYPTION_KEY_VERSION,
    partyAad(contractId, coach.id, 'signed-name'),
  );
  const invitations = await Promise.all(
    parties.filter((party) => party.requiredSigner && party.role !== 'coach')
      .map((party) => pendingInvite(env, party, expiresAt)),
  );
  const actorHash = await hmacHex(env.TOKEN_HASH_SECRET, 'admin-subject-v1', identity.subject);
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `UPDATE contracts SET status = 'ready', updated_at = ?
       WHERE id = ? AND status = 'draft' AND draft_revision = ?`,
    ).bind(timestamp, contractId, issueRequest.revision),
    await createAuditStatement(request, env, {
      contractId,
      eventType: 'contract_ready',
      metadata: { revision: issueRequest.revision },
    }),
    env.DB.prepare(
      `INSERT INTO contract_versions (
         id, contract_id, version_number, template_version, canonical_snapshot_ciphertext,
         snapshot_hash, encryption_key_version, created_by, created_at
       ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      randomId(),
      contractId,
      input.templateVersion,
      snapshotCiphertext,
      snapshotHash,
      env.DATA_ENCRYPTION_KEY_VERSION,
      actorHash,
      timestamp,
    ),
    env.DB.prepare(
      `UPDATE contract_parties SET signed_name_ciphertext = ?, signature_event_id = ?, signed_at = ?
       WHERE id = ? AND contract_id = ? AND role = 'coach' AND signature_event_id IS NULL`,
    ).bind(coachSignedNameCiphertext, coachSignatureEventId, timestamp, coach.id, contractId),
    await createAuditStatement(request, env, {
      contractId,
      partyId: coach.id,
      eventType: 'signature_submitted',
      documentHash: snapshotHash,
      metadata: { role: 'coach', method: 'access_authenticated_name_and_intent' },
    }),
    env.DB.prepare(
      `UPDATE contracts SET status = 'issued', issued_at = ?, expires_at = ?, snapshot_hash = ?, updated_at = ?
       WHERE id = ? AND status = 'ready'`,
    ).bind(timestamp, expiresAt, snapshotHash, timestamp, contractId),
    await createAuditStatement(request, env, {
      contractId,
      eventType: 'contract_issued',
      documentHash: snapshotHash,
      metadata: { template_version: input.templateVersion, version_number: 1 },
    }),
  ];

  for (const definition of snapshot.optional_consents) {
    const textHash = definition.consentTextHash;
    if (!textHash) throw new Error('Server consent text hash was not created');
    statements.push(env.DB.prepare(
      `INSERT INTO contract_consents (
         id, contract_id, party_id, consent_key, required, enabled, accepted,
         consent_text_version, consent_text_hash, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 0, ?, 0, ?, ?, ?, ?)`,
    ).bind(
      randomId(),
      contractId,
      client.id,
      definition.key,
      definition.enabled ? 1 : 0,
      definition.version,
      textHash,
      timestamp,
      timestamp,
    ));
  }

  for (const invitation of invitations) {
    statements.push(env.DB.prepare(
      `INSERT INTO contract_invites (
         id, contract_id, party_id, token_hash, pin_hash, expires_at, attempt_count, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    ).bind(
      invitation.id,
      contractId,
      invitation.partyId,
      invitation.tokenHash,
      invitation.pinHash,
      invitation.expiresAt,
      timestamp,
    ));
    statements.push(await createAuditStatement(request, env, {
      contractId,
      partyId: invitation.partyId,
      eventType: 'invite_created',
      metadata: { role: invitation.role, expires_at: invitation.expiresAt },
    }));
  }

  if (contract.supersedes_contract_id) {
    const previous = await getContract(env, contract.supersedes_contract_id);
    if (previous.status !== 'issued') {
      throw new HttpError(409, 'SUPERSEDE_NOT_ALLOWED', 'Previous contract cannot be superseded from its current state');
    }
    assertStatusTransition(previous.status, 'superseded');
    statements.push(env.DB.prepare(
      `UPDATE contracts SET status = 'superseded', superseded_by = ?, updated_at = ?
       WHERE id = ? AND status = ?`,
    ).bind(contractId, timestamp, previous.id, previous.status));
    statements.push(env.DB.prepare(
      `UPDATE contract_invites SET revoked_at = ? WHERE contract_id = ? AND revoked_at IS NULL`,
    ).bind(timestamp, previous.id));
    statements.push(env.DB.prepare(
      `UPDATE contract_invite_sessions SET consumed_at = ? WHERE contract_id = ? AND consumed_at IS NULL`,
    ).bind(timestamp, previous.id));
    statements.push(await createAuditStatement(request, env, {
      contractId: previous.id,
      eventType: 'contract_superseded',
      documentHash: previous.snapshot_hash ?? undefined,
      metadata: { replacement_created: true },
    }));
  }

  const results = await env.DB.batch(statements);
  if ((results[0]?.meta.changes ?? 0) !== 1) {
    throw new HttpError(409, 'DRAFT_VERSION_CONFLICT', 'Draft changed before issue');
  }
  return {
    body: {
      id: contractId,
      contract_number: contract.contract_number,
      contract_type: input.contractType,
      status: 'issued',
      version_number: 1,
      template_version: input.templateVersion,
      issued_at: timestamp,
      expires_at: expiresAt,
      snapshot_hash: snapshotHash,
      invitations: invitations.map((invitation) => ({
        party_id: invitation.partyId,
        role: invitation.role,
        invite_token: invitation.token,
        verification_code: invitation.pin,
        expires_at: invitation.expiresAt,
        delivery: 'manual_secure_transfer_required',
      })),
      sensitive_response_notice: 'Invitation tokens and verification codes are returned once and are never stored in plaintext.',
    },
  };
}

export async function listAdminContracts(env: Env, url: URL): Promise<ServiceResult> {
  const query = parseListQuery(url);
  const where: string[] = [];
  const bindings: unknown[] = [];
  if (query.status) {
    where.push('status = ?');
    bindings.push(query.status);
  }
  if (query.cursor) {
    where.push('updated_at < ?');
    bindings.push(query.cursor);
  }
  const sql = `SELECT id, contract_number, contract_type, template_version, status, title,
                      legal_review_status, draft_revision, issued_at, expires_at,
                      fully_signed_at, snapshot_hash, final_document_hash, created_at, updated_at
                 FROM contracts ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                ORDER BY updated_at DESC, id DESC LIMIT ?`;
  bindings.push(query.limit + 1);
  const result = await env.DB.prepare(sql).bind(...bindings).all<Record<string, unknown>>();
  const hasMore = result.results.length > query.limit;
  const contracts = result.results.slice(0, query.limit);
  const last = contracts.at(-1);
  return {
    body: {
      contracts,
      next_cursor: hasMore && typeof last?.updated_at === 'string' ? last.updated_at : null,
    },
  };
}

async function getLatestVersion(env: Env, contractId: string): Promise<VersionRow> {
  const version = await env.DB.prepare(
    'SELECT * FROM contract_versions WHERE contract_id = ? ORDER BY version_number DESC LIMIT 1',
  ).bind(contractId).first<VersionRow>();
  if (!version) throw new HttpError(409, 'SNAPSHOT_NOT_AVAILABLE', 'Issued contract snapshot is unavailable');
  return version;
}

async function decryptVersion(env: Env, version: VersionRow): Promise<CanonicalIssuedSnapshot> {
  const plaintext = await decryptText(
    version.canonical_snapshot_ciphertext,
    env.DATA_ENCRYPTION_KEY,
    version.encryption_key_version,
    contractAad(version.contract_id, `version:${version.version_number}:snapshot`),
  );
  if (await sha256Hex(plaintext) !== version.snapshot_hash) {
    throw new HttpError(500, 'SNAPSHOT_HASH_MISMATCH', 'Stored contract snapshot failed integrity verification');
  }
  try {
    return JSON.parse(plaintext) as CanonicalIssuedSnapshot;
  } catch {
    throw new HttpError(500, 'SNAPSHOT_INTEGRITY_FAILURE', 'Stored contract snapshot cannot be read');
  }
}

export async function getAdminContract(env: Env, contractId: string): Promise<ServiceResult> {
  const contract = await getContract(env, contractId);
  const parties = await decryptParties(env, contractId);
  const base = {
    id: contract.id,
    contract_number: contract.contract_number,
    contract_type: contract.contract_type,
    template_version: contract.template_version,
    status: contract.status,
    title: contract.title,
    legal_review_status: contract.legal_review_status,
    legal_review_reference: contract.legal_review_reference,
    version_number: contract.draft_revision,
    issued_at: contract.issued_at,
    expires_at: contract.expires_at,
    fully_signed_at: contract.fully_signed_at,
    snapshot_hash: contract.snapshot_hash,
    final_document_hash: contract.final_document_hash,
    parties: parties.map((party) => ({
      id: party.id,
      role: party.role,
      display_name: party.displayName,
      email: party.email,
      phone: party.phone ?? null,
      organization: party.organization ?? null,
      required_signer: party.requiredSigner,
      signed_at: party.signedAt ?? null,
    })),
  };
  if (contract.status === 'draft' || contract.status === 'ready') {
    return { body: { ...base, draft: await readDraftInput(env, contract) } };
  }
  const version = await getLatestVersion(env, contractId);
  return { body: { ...base, canonical_snapshot: await decryptVersion(env, version) } };
}

export async function cancelAdminContract(
  request: Request,
  env: Env,
  contractId: string,
): Promise<ServiceResult> {
  const contract = await getContract(env, contractId);
  if (contract.status !== 'issued') {
    throw new HttpError(409, 'CANCEL_NOT_ALLOWED', 'Contract cannot be cancelled from its current state');
  }
  assertStatusTransition(contract.status, 'cancelled');
  const timestamp = nowIso();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE contracts SET status = 'cancelled', cancelled_at = ?, updated_at = ? WHERE id = ? AND status = ?`,
    ).bind(timestamp, timestamp, contractId, contract.status),
    env.DB.prepare('UPDATE contract_invites SET revoked_at = ? WHERE contract_id = ? AND revoked_at IS NULL')
      .bind(timestamp, contractId),
    env.DB.prepare('UPDATE contract_invite_sessions SET consumed_at = ? WHERE contract_id = ? AND consumed_at IS NULL')
      .bind(timestamp, contractId),
    env.DB.prepare('UPDATE contract_final_access_tokens SET revoked_at = ? WHERE contract_id = ? AND revoked_at IS NULL')
      .bind(timestamp, contractId),
    await createAuditStatement(request, env, {
      contractId,
      eventType: 'contract_cancelled',
      documentHash: contract.snapshot_hash ?? undefined,
    }),
  ]);
  return { body: { id: contractId, status: 'cancelled', cancelled_at: timestamp } };
}

export async function terminateAdminContract(
  request: Request,
  env: Env,
  contractId: string,
): Promise<ServiceResult> {
  const contract = await getContract(env, contractId);
  assertStatusTransition(contract.status, 'terminated');
  const timestamp = nowIso();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE contracts SET status = 'terminated', terminated_at = ?, updated_at = ?
       WHERE id = ? AND status = 'fully_signed'`,
    ).bind(timestamp, timestamp, contractId),
    await createAuditStatement(request, env, {
      contractId,
      eventType: 'contract_terminated',
      documentHash: contract.final_document_hash ?? undefined,
    }),
  ]);
  return { body: { id: contractId, status: 'terminated', terminated_at: timestamp } };
}

export async function reissueAdminContract(
  request: Request,
  env: Env,
  identity: AccessIdentity,
  contractId: string,
  value: unknown,
): Promise<ServiceResult> {
  const previous = await getContract(env, contractId);
  if (previous.status !== 'issued') {
    throw new HttpError(409, 'REISSUE_NOT_ALLOWED', 'Only an active issued contract can start a replacement draft');
  }
  const body = asBodyRecord(value);
  const replacement = body.replacement ?? body.contract ?? value;
  const replacementRecord = { ...asBodyRecord(replacement) };
  if (snakeOrCamel(replacementRecord, 'requestId', 'request_id') === undefined) {
    replacementRecord.request_id = snakeOrCamel(body, 'requestId', 'request_id');
  }
  return createContractInternal(request, env, identity, replacementRecord, contractId);
}

async function getInviteByTokenHash(env: Env, tokenHash: string): Promise<InviteRow> {
  const invite = await env.DB.prepare('SELECT * FROM contract_invites WHERE token_hash = ? LIMIT 1')
    .bind(tokenHash).first<InviteRow>();
  if (!invite) throw new HttpError(404, 'INVITE_NOT_FOUND', 'Invitation is invalid');
  return invite;
}

async function getInviteById(env: Env, inviteId: string): Promise<InviteRow> {
  const invite = await env.DB.prepare('SELECT * FROM contract_invites WHERE id = ? LIMIT 1')
    .bind(inviteId).first<InviteRow>();
  if (!invite) throw new HttpError(404, 'INVITE_NOT_FOUND', 'Invitation is invalid');
  return invite;
}

async function expireIssuedContractIfNeeded(request: Request, env: Env, contract: ContractRow): Promise<void> {
  if (!shouldExpireIssuedContract(contract.status, contract.expires_at)) return;
  const timestamp = nowIso();
  await env.DB.batch([
    await createContractExpiryAuditStatement(request, env, {
      contractId: contract.id,
      eventAt: timestamp,
      documentHash: contract.snapshot_hash ?? undefined,
    }),
    env.DB.prepare(
      `UPDATE contracts SET status = 'expired', updated_at = ?
        WHERE id = ? AND status = 'issued' AND expires_at IS NOT NULL AND expires_at <= ?`,
    ).bind(timestamp, contract.id, timestamp),
    env.DB.prepare(
      `UPDATE contract_invites SET revoked_at = ?
        WHERE contract_id = ? AND used_at IS NULL AND revoked_at IS NULL`,
    ).bind(timestamp, contract.id),
  ]);
  throw new HttpError(410, 'CONTRACT_EXPIRED', 'Contract invitation period has ended');
}

function assertInviteUsable(invite: InviteRow, contract: ContractRow): void {
  if (invite.revoked_at || invite.used_at || invite.locked_at) {
    throw new HttpError(410, 'INVITE_UNAVAILABLE', 'Invitation is expired, used, revoked, or locked');
  }
  if (Date.parse(invite.expires_at) <= Date.now()) {
    throw new HttpError(410, 'INVITE_EXPIRED', 'Invitation has expired');
  }
  if (!isSignableStatus(contract.status)) {
    throw new HttpError(409, 'CONTRACT_NOT_SIGNABLE', 'Contract is not available for signing');
  }
  if (contract.expires_at && Date.parse(contract.expires_at) <= Date.now()) {
    throw new HttpError(410, 'CONTRACT_EXPIRED', 'Contract invitation period has ended');
  }
}

function maskEmail(value: string): string {
  const [local = '', domain = ''] = value.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(2, Math.min(8, local.length - visible.length)))}@${domain}`;
}

async function invitationSummary(env: Env, invite: InviteRow): Promise<Record<string, unknown>> {
  const contract = await getContract(env, invite.contract_id);
  const partyRows = await getParties(env, invite.contract_id);
  const invitedRow = partyRows.find((party) => party.id === invite.party_id);
  const coachRow = partyRows.find((party) => party.role === 'coach');
  if (!invitedRow || !coachRow) throw new HttpError(409, 'INVALID_PARTY_STRUCTURE', 'Contract parties are incomplete');
  const [invited, coach] = await Promise.all([decryptParty(env, invitedRow), decryptParty(env, coachRow)]);
  return {
    contract_type: contract.contract_type,
    title: contract.title,
    template_version: contract.template_version,
    signer_role: invited.role,
    signer_email_hint: maskEmail(invited.email),
    coach_display_name: coach.displayName,
    expires_at: invite.expires_at,
    verification_required: true,
  };
}

export async function exchangeInviteToken(
  request: Request,
  env: Env,
  value: unknown,
): Promise<ServiceResult> {
  const token = parseOpaqueTokenBody(value);
  const tokenHash = await hmacHex(env.TOKEN_HASH_SECRET, 'invite-token-v1', token);
  const invite = await getInviteByTokenHash(env, tokenHash);
  const contract = await getContract(env, invite.contract_id);
  await expireIssuedContractIfNeeded(request, env, contract);
  assertInviteUsable(invite, contract);
  const exchangeToken = randomToken(32);
  const exchangeHash = await hmacHex(env.TOKEN_HASH_SECRET, 'invite-exchange-v1', exchangeToken);
  const timestamp = nowIso();
  const sessionTtl = parsePositiveInt(env.INVITE_SESSION_TTL_SECONDS, 1_800, 300, 3_600);
  const exchangeExpiresAt = addSeconds(timestamp, Math.min(600, sessionTtl));
  const statements: D1PreparedStatement[] = [env.DB.prepare(
    `INSERT INTO contract_invite_exchanges (id, invite_id, exchange_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(randomId(), invite.id, exchangeHash, exchangeExpiresAt, timestamp)];
  if (contract.status === 'issued') {
    assertStatusTransition('issued', 'viewed');
    statements.push(env.DB.prepare(
      `UPDATE contracts SET status = 'viewed', updated_at = ? WHERE id = ? AND status = 'issued'`,
    ).bind(timestamp, contract.id));
  }
  statements.push(await createAuditStatement(request, env, {
    contractId: contract.id,
    partyId: invite.party_id,
    eventType: 'invite_viewed',
    documentHash: contract.snapshot_hash ?? undefined,
  }));
  await env.DB.batch(statements);
  return {
    body: {
      session_token: exchangeToken,
      session_type: 'invite_exchange',
      expires_at: exchangeExpiresAt,
      summary: await invitationSummary(env, invite),
    },
  };
}

export async function getInviteExchangeSummary(request: Request, env: Env): Promise<ServiceResult> {
  const exchange = await authenticateInviteExchange(request, env);
  const invite = await getInviteById(env, exchange.invite_id);
  const contract = await getContract(env, invite.contract_id);
  await expireIssuedContractIfNeeded(request, env, contract);
  assertInviteUsable(invite, contract);
  return { body: { summary: await invitationSummary(env, invite), verified: false } };
}

export async function verifyInviteIdentity(
  request: Request,
  env: Env,
  value: unknown,
): Promise<ServiceResult> {
  const exchange = await authenticateInviteExchange(request, env);
  const { pin } = parseVerificationBody(value);
  const invite = await getInviteById(env, exchange.invite_id);
  const contract = await getContract(env, invite.contract_id);
  await expireIssuedContractIfNeeded(request, env, contract);
  assertInviteUsable(invite, contract);
  const maxAttempts = parsePositiveInt(env.OTP_MAX_ATTEMPTS, 5, 3, 10);
  if (invite.attempt_count >= maxAttempts) {
    throw new HttpError(429, 'INVITE_LOCKED', 'Verification attempts are locked');
  }
  const suppliedHash = await hmacHex(env.OTP_HASH_SECRET, `invite-pin-v1:${invite.id}`, pin);
  if (!timingSafeEqual(suppliedHash, invite.pin_hash)) {
    const nextAttempt = invite.attempt_count + 1;
    await env.DB.prepare(
      `UPDATE contract_invites
          SET attempt_count = attempt_count + 1,
              locked_at = CASE WHEN attempt_count + 1 >= ? THEN ? ELSE locked_at END
        WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL`,
    ).bind(maxAttempts, nowIso(), invite.id).run();
    if (nextAttempt >= maxAttempts) {
      throw new HttpError(429, 'INVITE_LOCKED', 'Verification attempts are locked');
    }
    throw new HttpError(401, 'VERIFICATION_FAILED', 'Verification code is invalid');
  }
  const sessionToken = randomToken(32);
  const sessionHash = await hmacHex(env.TOKEN_HASH_SECRET, 'invite-session-v1', sessionToken);
  const timestamp = nowIso();
  const ttl = parsePositiveInt(env.INVITE_SESSION_TTL_SECONDS, 1_800, 300, 3_600);
  const expiresAt = addSeconds(timestamp, ttl);
  const sessionId = randomId();
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO contract_invite_sessions (
         id, invite_id, contract_id, party_id, session_hash, expires_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(sessionId, invite.id, contract.id, invite.party_id, sessionHash, expiresAt, timestamp),
    env.DB.prepare(
      `UPDATE contract_invite_exchanges SET used_at = ? WHERE id = ? AND used_at IS NULL`,
    ).bind(timestamp, exchange.id),
    env.DB.prepare(
      `UPDATE contract_invites SET used_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL`,
    ).bind(timestamp, invite.id),
    await createAuditStatement(request, env, {
      contractId: contract.id,
      partyId: invite.party_id,
      eventType: 'identity_verified',
      documentHash: contract.snapshot_hash ?? undefined,
      metadata: { method: 'invite_pin' },
    }),
  ]);
  if ((results[1]?.meta.changes ?? 0) !== 1 || (results[2]?.meta.changes ?? 0) !== 1) {
    throw new HttpError(409, 'INVITE_REPLAY_BLOCKED', 'Invitation was already exchanged');
  }
  return {
    body: {
      session_token: sessionToken,
      session_type: 'verified_invite',
      contract_id: contract.id,
      party_id: invite.party_id,
      expires_at: expiresAt,
    },
  };
}

export async function getCustomerSnapshot(
  request: Request,
  env: Env,
  contractId: string,
): Promise<ServiceResult> {
  const session = await authenticateInviteSession(request, env, contractId);
  const contract = await getContract(env, contractId);
  await expireIssuedContractIfNeeded(request, env, contract);
  if (!isSignableStatus(contract.status)) {
    throw new HttpError(409, 'CONTRACT_NOT_SIGNABLE', 'Contract is not available for signing');
  }
  const version = await getLatestVersion(env, contractId);
  const snapshot = await decryptVersion(env, version);
  const signer = (await getParties(env, contractId)).find((party) => party.id === session.party_id);
  if (!signer) throw new HttpError(404, 'PARTY_NOT_FOUND', 'Contract party was not found');
  await recordAuditEvent(request, env, {
    contractId,
    partyId: session.party_id,
    eventType: 'contract_viewed',
    documentHash: version.snapshot_hash,
  });
  return {
    body: {
      contract_id: contractId,
      version_number: version.version_number,
      template_version: version.template_version,
      signer_role: signer.role,
      snapshot_hash: version.snapshot_hash,
      canonical_snapshot: snapshot,
    },
  };
}

async function getConsentRows(env: Env, contractId: string, partyId: string): Promise<ConsentRow[]> {
  const result = await env.DB.prepare(
    `SELECT * FROM contract_consents WHERE contract_id = ? AND party_id = ? ORDER BY consent_key`,
  ).bind(contractId, partyId).all<ConsentRow>();
  return result.results;
}

export async function saveCustomerConsents(
  request: Request,
  env: Env,
  contractId: string,
  value: unknown,
): Promise<ServiceResult> {
  const session = await authenticateInviteSession(request, env, contractId);
  const contract = await getContract(env, contractId);
  await expireIssuedContractIfNeeded(request, env, contract);
  if (!isSignableStatus(contract.status)) {
    throw new HttpError(409, 'CONTRACT_NOT_SIGNABLE', 'Contract is not available for consent selection');
  }
  const partyRow = (await getParties(env, contractId)).find((party) => party.id === session.party_id);
  if (!partyRow || partyRow.role !== 'client') {
    throw new HttpError(403, 'CLIENT_CONSENT_ONLY', 'Only the coaching client may decide optional consents');
  }
  const selections = parseConsentSelections(value);
  const rows = await getConsentRows(env, contractId, session.party_id);
  if (rows.length !== CONSENT_KEYS.length) {
    throw new HttpError(409, 'CONSENT_CONFIGURATION_MISSING', 'Optional consent configuration is incomplete');
  }
  const rowByKey = new Map(rows.map((row) => [row.consent_key, row]));
  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [];
  for (const selection of selections) {
    const row = rowByKey.get(selection.key);
    if (!row || row.required !== 0) {
      throw new HttpError(409, 'CONSENT_CONFIGURATION_MISSING', 'Optional consent configuration is invalid');
    }
    if (!selection.submittedTextVersion || !selection.submittedTextHash
      || selection.submittedTextVersion !== row.consent_text_version
      || selection.submittedTextHash !== row.consent_text_hash) {
      throw new HttpError(409, 'CONSENT_TEXT_CHANGED', 'Consent wording changed; review the current text before deciding');
    }
    if (selection.accepted && row.enabled !== 1) {
      throw new HttpError(422, 'CONSENT_OPTION_DISABLED', `${selection.key} is not configured and cannot be accepted`);
    }
    const detailsCiphertext = selection.details
      ? await encryptText(
        stableStringify(selection.details),
        env.DATA_ENCRYPTION_KEY,
        env.DATA_ENCRYPTION_KEY_VERSION,
        contractAad(contractId, `consent:${session.party_id}:${selection.key}:details`),
      )
      : null;
    const withdrawnAt = row.selected_at && row.accepted === 1 && !selection.accepted ? timestamp : row.withdrawn_at;
    statements.push(env.DB.prepare(
      `UPDATE contract_consents SET
         accepted = ?, selection_details_ciphertext = ?, selected_at = ?,
         accepted_at = ?, withdrawn_at = ?, updated_at = ?
       WHERE id = ? AND contract_id = ? AND party_id = ?`,
    ).bind(
      selection.accepted ? 1 : 0,
      detailsCiphertext,
      timestamp,
      selection.accepted ? timestamp : null,
      withdrawnAt,
      timestamp,
      row.id,
      contractId,
      session.party_id,
    ));
    statements.push(await createAuditStatement(request, env, {
      contractId,
      partyId: session.party_id,
      eventType: withdrawnAt === timestamp ? 'consent_withdrawn' : 'consent_selected',
      documentHash: contract.snapshot_hash ?? undefined,
      metadata: { consent_key: selection.key, accepted: selection.accepted },
    }));
  }
  await env.DB.batch(statements);
  return {
    body: {
      contract_id: contractId,
      party_id: session.party_id,
      selections: selections.map((selection) => ({ key: selection.key, accepted: selection.accepted })),
      selected_at: timestamp,
    },
  };
}

async function assertContractViewed(env: Env, contractId: string, partyId: string): Promise<void> {
  const event = await env.DB.prepare(
    `SELECT id FROM contract_audit_events
      WHERE contract_id = ? AND party_id = ? AND event_type = 'contract_viewed' LIMIT 1`,
  ).bind(contractId, partyId).first<{ id: string }>();
  if (!event) throw new HttpError(409, 'CONTRACT_REVIEW_REQUIRED', 'Contract must be viewed before signing');
}

async function assertClientConsentsDecided(env: Env, contractId: string, party: PartyRow): Promise<void> {
  if (party.role !== 'client') return;
  const rows = await getConsentRows(env, contractId, party.id);
  if (rows.length !== CONSENT_KEYS.length || rows.some((row) => !row.selected_at)) {
    throw new HttpError(409, 'CONSENT_SELECTION_REQUIRED', 'Every optional consent requires an explicit decision');
  }
}

async function decodePlainConsents(env: Env, contractId: string): Promise<Array<PlainConsent & { partyId: string }>> {
  const result = await env.DB.prepare(
    'SELECT * FROM contract_consents WHERE contract_id = ? ORDER BY party_id, consent_key',
  ).bind(contractId).all<ConsentRow>();
  return Promise.all(result.results.map(async (row) => {
    let details: Record<string, unknown> | undefined;
    if (row.selection_details_ciphertext) {
      const plaintext = await decryptText(
        row.selection_details_ciphertext,
        env.DATA_ENCRYPTION_KEY,
        env.DATA_ENCRYPTION_KEY_VERSION,
        contractAad(contractId, `consent:${row.party_id}:${row.consent_key}:details`),
      );
      details = JSON.parse(plaintext) as Record<string, unknown>;
    }
    return {
      partyId: row.party_id,
      key: row.consent_key,
      enabled: row.enabled === 1,
      accepted: row.accepted === 1,
      version: row.consent_text_version,
      textHash: row.consent_text_hash,
      ...(row.selected_at ? { selectedAt: row.selected_at } : {}),
      ...(row.accepted_at ? { acceptedAt: row.accepted_at } : {}),
      ...(row.withdrawn_at ? { withdrawnAt: row.withdrawn_at } : {}),
      ...(details ? { details } : {}),
    };
  }));
}

async function finalizeContract(
  request: Request,
  env: Env,
  contractId: string,
): Promise<{ documentHash: string; r2Archived: boolean }> {
  const contract = await getContract(env, contractId);
  if (contract.status === 'fully_signed' && contract.final_document_hash) {
    const existing = await getFinalDocumentRow(env, contractId);
    if (existing.document_hash !== contract.final_document_hash) {
      throw new HttpError(500, 'FINAL_DOCUMENT_HASH_MISMATCH', 'Final document failed integrity verification');
    }
    return { documentHash: existing.document_hash, r2Archived: Boolean(existing.r2_object_key) };
  }
  if (contract.status !== 'partially_signed') {
    throw new HttpError(409, 'FINALIZATION_STATE_INVALID', 'Contract is not ready for finalization');
  }
  const version = await getLatestVersion(env, contractId);
  const snapshot = await decryptVersion(env, version);
  const parties = await decryptParties(env, contractId);
  if (parties.some((party) => party.requiredSigner && !party.signatureEventId)) {
    throw new HttpError(409, 'MISSING_REQUIRED_SIGNATURE', 'All required parties must sign before completion');
  }
  const consents = await decodePlainConsents(env, contractId);
  const audit = await env.DB.prepare(
    `SELECT event_type, event_at, document_hash
       FROM contract_audit_events WHERE contract_id = ? ORDER BY event_at, id`,
  ).bind(contractId).all<{ event_type: string; event_at: string; document_hash: string | null }>();
  const timestamp = nowIso();
  const manifest = buildFinalManifest(snapshot, version.snapshot_hash, parties, consents, audit.results, timestamp);
  const manifestJson = stableStringify(manifest);
  const documentHash = await sha256Hex(manifestJson);
  const html = renderFinalHtml(manifest, documentHash);
  const [manifestCiphertext, htmlCiphertext] = await Promise.all([
    encryptText(
      manifestJson,
      env.DATA_ENCRYPTION_KEY,
      env.DATA_ENCRYPTION_KEY_VERSION,
      contractAad(contractId, 'final:manifest'),
    ),
    encryptText(
      html,
      env.DATA_ENCRYPTION_KEY,
      env.DATA_ENCRYPTION_KEY_VERSION,
      contractAad(contractId, 'final:html'),
    ),
  ]);
  const finalDocumentId = randomId();
  const statements = [
    env.DB.prepare(
      `INSERT INTO contract_final_documents (
         id, contract_id, final_snapshot_ciphertext, html_ciphertext,
         document_hash, encryption_key_version, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      finalDocumentId,
      contractId,
      manifestCiphertext,
      htmlCiphertext,
      documentHash,
      env.DATA_ENCRYPTION_KEY_VERSION,
      timestamp,
    ),
    env.DB.prepare(
      `UPDATE contracts SET status = 'fully_signed', fully_signed_at = ?, final_document_hash = ?, updated_at = ?
       WHERE id = ? AND status = 'partially_signed'`,
    ).bind(timestamp, documentHash, timestamp, contractId),
    await createAuditStatement(request, env, {
      contractId,
      eventType: 'contract_fully_signed',
      documentHash,
      metadata: { required_signers_complete: true },
    }),
  ];
  const results = await env.DB.batch(statements);
  if ((results[1]?.meta.changes ?? 0) !== 1) {
    throw new HttpError(409, 'FINALIZATION_RACE', 'Contract finalization was already processed');
  }
  let r2Archived = false;
  if (env.DOCUMENTS) {
    const objectKey = `contracts/${contractId}/${documentHash}.encrypted.json`;
    try {
      await env.DOCUMENTS.put(objectKey, stableStringify({
        v: 1,
        kid: env.DATA_ENCRYPTION_KEY_VERSION,
        document_hash: documentHash,
        manifest_ciphertext: manifestCiphertext,
        html_ciphertext: htmlCiphertext,
      }), {
        httpMetadata: { contentType: 'application/json', cacheControl: 'private, no-store' },
        customMetadata: { documentHash, encryptionKeyVersion: env.DATA_ENCRYPTION_KEY_VERSION },
      });
      await env.DB.prepare('UPDATE contract_final_documents SET r2_object_key = ? WHERE id = ?')
        .bind(objectKey, finalDocumentId).run();
      r2Archived = true;
    } catch {
      // D1 remains the authoritative encrypted final document. R2 is optional.
    }
  }
  return { documentHash, r2Archived };
}

export async function signCustomerContract(
  request: Request,
  env: Env,
  contractId: string,
  value: unknown,
): Promise<ServiceResult> {
  const session = await authenticateInviteSession(request, env, contractId);
  const contract = await getContract(env, contractId);
  await expireIssuedContractIfNeeded(request, env, contract);
  if (!['viewed', 'partially_signed'].includes(contract.status)) {
    throw new HttpError(409, 'CONTRACT_NOT_SIGNABLE', 'Contract is not available for signing');
  }
  if (contract.expires_at && Date.parse(contract.expires_at) <= Date.now()) {
    throw new HttpError(410, 'CONTRACT_EXPIRED', 'Contract signing period has ended');
  }
  const party = (await getParties(env, contractId)).find((item) => item.id === session.party_id);
  if (!party || party.required_signer !== 1) {
    throw new HttpError(403, 'SIGNER_NOT_REQUIRED', 'This party is not an authorized required signer');
  }
  if (party.signature_event_id) throw new HttpError(409, 'DUPLICATE_SIGNATURE', 'Party already signed this contract');
  await assertContractViewed(env, contractId, party.id);
  await assertClientConsentsDecided(env, contractId, party);
  const signature = parseSignatureBody(value);
  if (!signature.submittedDocumentHash || signature.submittedDocumentHash !== contract.snapshot_hash) {
    throw new HttpError(409, 'DOCUMENT_HASH_MISMATCH', 'Displayed contract is not the current issued snapshot');
  }
  const requestNonceHash = await hmacHex(
    env.TOKEN_HASH_SECRET,
    `signature-request-v1:${contractId}:${party.id}`,
    signature.requestId,
  );
  const signedAt = nowIso();
  const signatureEventId = randomId();
  const signedNameCiphertext = await encryptText(
    signature.signedName,
    env.DATA_ENCRYPTION_KEY,
    env.DATA_ENCRYPTION_KEY_VERSION,
    partyAad(contractId, party.id, 'signed-name'),
  );
  const finalAccessToken = randomToken(32);
  const finalAccessHash = await hmacHex(env.TOKEN_HASH_SECRET, 'final-access-v1', finalAccessToken);
  const finalAccessExpiresAt = addSeconds(
    signedAt,
    parsePositiveInt(env.FINAL_ACCESS_TTL_SECONDS, 604_800, 300, 2_592_000),
  );
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO contract_request_nonces (
         id, contract_id, party_id, session_id, request_nonce_hash, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(randomId(), contractId, party.id, session.id, requestNonceHash, signedAt),
    env.DB.prepare(
      `UPDATE contract_parties SET signed_name_ciphertext = ?, signature_event_id = ?, signed_at = ?
       WHERE id = ? AND contract_id = ? AND signature_event_id IS NULL`,
    ).bind(signedNameCiphertext, signatureEventId, signedAt, party.id, contractId),
    env.DB.prepare(
      `UPDATE contract_invite_sessions SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`,
    ).bind(signedAt, session.id),
    env.DB.prepare(
      `INSERT INTO contract_final_access_tokens (
         id, contract_id, party_id, token_hash, expires_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(randomId(), contractId, party.id, finalAccessHash, finalAccessExpiresAt, signedAt),
    await createAuditStatement(request, env, {
      contractId,
      partyId: party.id,
      eventType: 'signature_submitted',
      documentHash: contract.snapshot_hash ?? undefined,
      metadata: { role: party.role, method: 'invite_pin_name_and_intent' },
    }),
    await createAuditStatement(request, env, {
      contractId,
      partyId: party.id,
      eventType: 'final_access_created',
      documentHash: contract.snapshot_hash ?? undefined,
      metadata: { expires_at: finalAccessExpiresAt },
    }),
  ];
  try {
    const results = await env.DB.batch(statements);
    if ((results[1]?.meta.changes ?? 0) !== 1 || (results[2]?.meta.changes ?? 0) !== 1) {
      throw new HttpError(409, 'SIGNATURE_REPLAY_BLOCKED', 'Signature request was already processed');
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (String(error).toLowerCase().includes('unique')) {
      throw new HttpError(409, 'SIGNATURE_REPLAY_BLOCKED', 'Duplicate or replayed signature request was blocked');
    }
    throw error;
  }

  const counts = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN required_signer = 1 THEN 1 ELSE 0 END) AS required_count,
       SUM(CASE WHEN required_signer = 1 AND signature_event_id IS NOT NULL THEN 1 ELSE 0 END) AS signed_count
     FROM contract_parties WHERE contract_id = ?`,
  ).bind(contractId).first<{ required_count: number; signed_count: number }>();
  if (!counts || counts.required_count < 2 || counts.signed_count < 2) {
    throw new HttpError(500, 'SIGNATURE_COUNT_FAILURE', 'Required signature state could not be verified');
  }
  let currentStatus = contract.status;
  if (contract.status === 'viewed') {
    assertStatusTransition('viewed', 'partially_signed');
    const transitionTime = nowIso();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE contracts SET status = 'partially_signed', updated_at = ? WHERE id = ? AND status = 'viewed'`,
      ).bind(transitionTime, contractId),
      await createAuditStatement(request, env, {
        contractId,
        eventType: 'contract_partially_signed',
        documentHash: contract.snapshot_hash ?? undefined,
        metadata: { signed_count: counts.signed_count, required_count: counts.required_count },
      }),
    ]);
    currentStatus = 'partially_signed';
  }
  let finalization: { documentHash: string; r2Archived: boolean } | undefined;
  let finalizationPending = false;
  if (counts.signed_count === counts.required_count) {
    assertStatusTransition(currentStatus as ContractStatus, 'fully_signed');
    try {
      finalization = await finalizeContract(request, env, contractId);
      currentStatus = 'fully_signed';
    } catch {
      const refreshed = await getContract(env, contractId);
      if (refreshed.status === 'fully_signed' && refreshed.final_document_hash) {
        const existing = await getFinalDocumentRow(env, contractId);
        finalization = {
          documentHash: existing.document_hash,
          r2Archived: Boolean(existing.r2_object_key),
        };
        currentStatus = 'fully_signed';
      } else {
        finalizationPending = true;
      }
    }
  }
  return {
    status: currentStatus === 'fully_signed' ? 200 : 202,
    body: {
      contract_id: contractId,
      status: currentStatus,
      signed_at: signedAt,
      signed_count: counts.signed_count,
      required_signer_count: counts.required_count,
      snapshot_hash: contract.snapshot_hash,
      final_document_hash: finalization?.documentHash ?? null,
      final_access_token: finalAccessToken,
      final_access_expires_at: finalAccessExpiresAt,
      final_access_state: currentStatus === 'fully_signed'
        ? 'ready'
        : finalizationPending ? 'finalization_pending' : 'pending_required_signatures',
      r2_archived: finalization?.r2Archived ?? false,
    },
  };
}

async function getFinalAccessByHash(env: Env, tokenHash: string): Promise<FinalAccessRow> {
  const token = await env.DB.prepare(
    `SELECT id, contract_id, party_id, token_hash, expires_at, used_at, revoked_at, created_at
       FROM contract_final_access_tokens WHERE token_hash = ? LIMIT 1`,
  ).bind(tokenHash).first<FinalAccessRow>();
  if (!token) throw new HttpError(404, 'FINAL_ACCESS_NOT_FOUND', 'Final access link is invalid');
  return token;
}

async function getFinalDocumentRow(env: Env, contractId: string): Promise<FinalDocumentRow> {
  const document = await env.DB.prepare(
    'SELECT * FROM contract_final_documents WHERE contract_id = ? LIMIT 1',
  ).bind(contractId).first<FinalDocumentRow>();
  if (!document) throw new HttpError(409, 'FINAL_DOCUMENT_NOT_READY', 'Final contract document is not available');
  return document;
}

async function finalAccessSummary(env: Env, contractId: string, partyId: string): Promise<Record<string, unknown>> {
  const contract = await getContract(env, contractId);
  const parties = await decryptParties(env, contractId);
  const party = parties.find((item) => item.id === partyId);
  if (!party) throw new HttpError(404, 'PARTY_NOT_FOUND', 'Contract party was not found');
  const currentOptionalConsents = party.role === 'client'
    ? (await env.DB.prepare(
      `SELECT consent_key, accepted, withdrawn_at
         FROM contract_consents
        WHERE contract_id = ? AND party_id = ?
        ORDER BY CASE consent_key
          WHEN 'session_recording' THEN 1
          WHEN 'ai_assisted_summary' THEN 2
          WHEN 'anonymized_case_use' THEN 3
          WHEN 'marketing_testimonial' THEN 4
          ELSE 5 END`,
    ).bind(contractId, partyId).all<{ consent_key: string; accepted: number; withdrawn_at: string | null }>()).results.map(
      (consent) => ({
        consent_key: consent.consent_key,
        accepted: consent.accepted === 1,
        withdrawn_at: consent.withdrawn_at,
      }),
    )
    : undefined;
  return {
    contract_id: contract.id,
    contract_number: contract.contract_number,
    contract_type: contract.contract_type,
    template_version: contract.template_version,
    status: contract.status,
    fully_signed_at: contract.fully_signed_at,
    signer_role: party.role,
    parties: parties.map((item) => ({
      role: item.role,
      display_name: item.displayName,
      required_signer: item.requiredSigner,
      signed_at: item.signedAt ?? null,
    })),
    snapshot_hash_prefix: contract.snapshot_hash?.slice(0, 16) ?? null,
    final_document_hash_prefix: contract.final_document_hash?.slice(0, 16) ?? null,
    ...(currentOptionalConsents ? { current_optional_consents: currentOptionalConsents } : {}),
  };
}

export async function exchangeFinalAccessToken(
  request: Request,
  env: Env,
  value: unknown,
): Promise<ServiceResult> {
  const rawToken = parseOpaqueTokenBody(value);
  const tokenHash = await hmacHex(env.TOKEN_HASH_SECRET, 'final-access-v1', rawToken);
  const token = await getFinalAccessByHash(env, tokenHash);
  if (token.revoked_at || token.used_at || Date.parse(token.expires_at) <= Date.now()) {
    throw new HttpError(410, 'FINAL_ACCESS_UNAVAILABLE', 'Final access link is expired, used, or revoked');
  }
  let contract = await getContract(env, token.contract_id);
  if (contract.status === 'partially_signed') {
    const counts = await env.DB.prepare(
      `SELECT
         SUM(CASE WHEN required_signer = 1 THEN 1 ELSE 0 END) AS required_count,
         SUM(CASE WHEN required_signer = 1 AND signature_event_id IS NOT NULL THEN 1 ELSE 0 END) AS signed_count
       FROM contract_parties WHERE contract_id = ?`,
    ).bind(contract.id).first<{ required_count: number; signed_count: number }>();
    if (counts && canRecoverFinalization(contract.status, counts.required_count, counts.signed_count)) {
      try {
        await finalizeContract(request, env, contract.id);
      } catch {
        throw new HttpError(503, 'FINALIZATION_PENDING', 'Final document generation is pending; retry this link later');
      }
      contract = await getContract(env, contract.id);
    }
  }
  if (contract.status !== 'fully_signed' && contract.status !== 'terminated') {
    throw new HttpError(409, 'SIGNATURES_PENDING', 'Final document is pending other required signatures');
  }
  await getFinalDocumentRow(env, contract.id);
  const sessionToken = randomToken(32);
  const sessionHash = await hmacHex(env.TOKEN_HASH_SECRET, 'final-document-session-v1', sessionToken);
  const timestamp = nowIso();
  const expiresAt = addSeconds(
    timestamp,
    parsePositiveInt(env.FINAL_DOCUMENT_SESSION_TTL_SECONDS, 900, 60, 3_600),
  );
  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO contract_final_document_sessions (
         id, contract_id, party_id, session_hash, expires_at, download_count, created_at
       ) VALUES (?, ?, ?, ?, ?, 0, ?)`,
    ).bind(randomId(), contract.id, token.party_id, sessionHash, expiresAt, timestamp),
    env.DB.prepare(
      `UPDATE contract_final_access_tokens SET used_at = ?
       WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
    ).bind(timestamp, token.id, timestamp),
    await createAuditStatement(request, env, {
      contractId: contract.id,
      partyId: token.party_id,
      eventType: 'final_access_exchanged',
      documentHash: contract.final_document_hash ?? undefined,
    }),
  ]);
  if ((results[1]?.meta.changes ?? 0) !== 1) {
    throw new HttpError(409, 'FINAL_ACCESS_REPLAY_BLOCKED', 'Final access link was already exchanged');
  }
  return {
    body: {
      session_token: sessionToken,
      session_type: 'final_document',
      expires_at: expiresAt,
      summary: await finalAccessSummary(env, contract.id, token.party_id),
    },
  };
}

export async function finalizeAdminContract(
  request: Request,
  env: Env,
  contractId: string,
): Promise<ServiceResult> {
  const contract = await getContract(env, contractId);
  if (!['partially_signed', 'fully_signed'].includes(contract.status)) {
    throw new HttpError(409, 'FINALIZATION_STATE_INVALID', 'Contract is not ready for finalization');
  }
  const counts = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN required_signer = 1 THEN 1 ELSE 0 END) AS required_count,
       SUM(CASE WHEN required_signer = 1 AND signature_event_id IS NOT NULL THEN 1 ELSE 0 END) AS signed_count
     FROM contract_parties WHERE contract_id = ?`,
  ).bind(contractId).first<{ required_count: number; signed_count: number }>();
  if (!counts || counts.required_count < 1 || counts.signed_count !== counts.required_count) {
    throw new HttpError(409, 'MISSING_REQUIRED_SIGNATURE', 'All required parties must sign before completion');
  }
  const result = await finalizeContract(request, env, contractId);
  return {
    body: {
      contract_id: contractId,
      status: 'fully_signed',
      final_document_hash: result.documentHash,
      r2_archived: result.r2Archived,
      recovery_idempotent: true,
    },
  };
}

export async function issueAdminFinalAccess(
  request: Request,
  env: Env,
  contractId: string,
  value: unknown,
): Promise<ServiceResult> {
  const contract = await getContract(env, contractId);
  if (!['fully_signed', 'terminated'].includes(contract.status)) {
    throw new HttpError(409, 'FINAL_DOCUMENT_NOT_READY', 'Final access can be issued only after every required signature');
  }
  await getFinalDocumentRow(env, contractId);
  const body = asBodyRecord(value);
  const partyId = snakeOrCamel(body, 'partyId', 'party_id');
  if (typeof partyId !== 'string' || !/^[0-9a-f-]{36}$/iu.test(partyId)) {
    throw new HttpError(400, 'INVALID_INPUT', 'party_id is required');
  }
  const party = (await getParties(env, contractId)).find((item) => item.id === partyId);
  if (!party || party.required_signer !== 1 || !party.signature_event_id) {
    throw new HttpError(422, 'PARTY_NOT_ELIGIBLE', 'Final access is available only to a signed required party');
  }
  const rawToken = randomToken(32);
  const tokenHash = await hmacHex(env.TOKEN_HASH_SECRET, 'final-access-v1', rawToken);
  const timestamp = nowIso();
  const expiresAt = addSeconds(
    timestamp,
    parsePositiveInt(env.FINAL_ACCESS_TTL_SECONDS, 604_800, 300, 2_592_000),
  );
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE contract_final_access_tokens SET revoked_at = ?
        WHERE contract_id = ? AND party_id = ? AND used_at IS NULL AND revoked_at IS NULL`,
    ).bind(timestamp, contractId, partyId),
    env.DB.prepare(
      `INSERT INTO contract_final_access_tokens (
         id, contract_id, party_id, token_hash, expires_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(randomId(), contractId, partyId, tokenHash, expiresAt, timestamp),
    await createAuditStatement(request, env, {
      contractId,
      partyId,
      eventType: 'final_access_created',
      documentHash: contract.final_document_hash ?? undefined,
      metadata: { admin_reissued: true, expires_at: expiresAt },
    }),
  ]);
  return {
    body: {
      contract_id: contractId,
      party_id: partyId,
      role: party.role,
      final_access_token: rawToken,
      expires_at: expiresAt,
      delivery: 'manual_secure_transfer_required',
      sensitive_response_notice: 'This one-time token is never stored in plaintext and is returned only in this response.',
    },
  };
}

function parseFinalAccessAuthorization(request: Request): string {
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    throw new HttpError(401, 'SESSION_REQUIRED', 'Final-document session is required');
  }
  const match = /^Bearer ([A-Za-z0-9_-]{43,128})$/u.exec(authorization);
  if (!match) {
    throw new HttpError(401, 'INVALID_SESSION', 'Authorization must use a valid Bearer session');
  }
  return match[1]!;
}

export async function getFinalAccessSessionSummary(request: Request, env: Env): Promise<ServiceResult> {
  const raw = parseFinalAccessAuthorization(request);
  const sessionHash = await hmacHex(env.TOKEN_HASH_SECRET, 'final-document-session-v1', raw);
  const session = await env.DB.prepare(
    `SELECT id, contract_id, party_id, session_hash, expires_at, created_at
       FROM contract_final_document_sessions WHERE session_hash = ? LIMIT 1`,
  ).bind(sessionHash).first<FinalDocumentSessionRow>();
  if (!session || Date.parse(session.expires_at) <= Date.now()) {
    throw new HttpError(401, 'INVALID_SESSION', 'Final-document session is invalid or expired');
  }
  return { body: { summary: await finalAccessSummary(env, session.contract_id, session.party_id) } };
}

async function decryptFinalDocument(
  env: Env,
  document: FinalDocumentRow,
): Promise<{ manifest: FinalManifest; html: string }> {
  const [manifestJson, html] = await Promise.all([
    decryptText(
      document.final_snapshot_ciphertext,
      env.DATA_ENCRYPTION_KEY,
      document.encryption_key_version,
      contractAad(document.contract_id, 'final:manifest'),
    ),
    decryptText(
      document.html_ciphertext,
      env.DATA_ENCRYPTION_KEY,
      document.encryption_key_version,
      contractAad(document.contract_id, 'final:html'),
    ),
  ]);
  if (await sha256Hex(manifestJson) !== document.document_hash) {
    throw new HttpError(500, 'FINAL_DOCUMENT_HASH_MISMATCH', 'Final document failed integrity verification');
  }
  try {
    return { manifest: JSON.parse(manifestJson) as FinalManifest, html };
  } catch {
    throw new HttpError(500, 'FINAL_DOCUMENT_INTEGRITY_FAILURE', 'Final document cannot be read');
  }
}

async function finalDocumentResponse(
  request: Request,
  env: Env,
  session: FinalDocumentSessionRow,
  preferHtml: boolean,
): Promise<ServiceResult> {
  const contract = await getContract(env, session.contract_id);
  if (!['fully_signed', 'terminated'].includes(contract.status)) {
    throw new HttpError(409, 'FINAL_DOCUMENT_NOT_READY', 'Final document is not available');
  }
  const row = await getFinalDocumentRow(env, session.contract_id);
  const document = await decryptFinalDocument(env, row);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE contract_final_document_sessions SET download_count = download_count + 1 WHERE id = ?`,
    ).bind(session.id),
    await createAuditStatement(request, env, {
      contractId: session.contract_id,
      partyId: session.party_id,
      eventType: 'document_downloaded',
      documentHash: row.document_hash,
      metadata: { format: preferHtml ? 'html' : 'json' },
    }),
  ]);
  if (preferHtml) return { html: document.html };
  return {
    body: {
      contract_id: session.contract_id,
      final_document_hash: row.document_hash,
      canonical_document: document.manifest,
      printable_html: document.html,
    },
  };
}

export async function getFinalAccessDocument(request: Request, env: Env): Promise<ServiceResult> {
  const raw = parseFinalAccessAuthorization(request);
  const hash = await hmacHex(env.TOKEN_HASH_SECRET, 'final-document-session-v1', raw);
  const session = await env.DB.prepare(
    `SELECT id, contract_id, party_id, session_hash, expires_at, created_at
       FROM contract_final_document_sessions WHERE session_hash = ? LIMIT 1`,
  ).bind(hash).first<FinalDocumentSessionRow>();
  if (!session || Date.parse(session.expires_at) <= Date.now()) {
    throw new HttpError(401, 'INVALID_SESSION', 'Final-document session is invalid or expired');
  }
  return finalDocumentResponse(request, env, session, false);
}

export async function getContractFinalDocument(
  request: Request,
  env: Env,
  contractId: string,
): Promise<ServiceResult> {
  const session = await authenticateFinalDocumentSession(request, env, contractId);
  const preferHtml = request.headers.get('Accept')?.includes('text/html') === true;
  return finalDocumentResponse(request, env, session, preferHtml);
}

export async function getAdminFinalDocument(
  request: Request,
  env: Env,
  contractId: string,
): Promise<ServiceResult> {
  const contract = await getContract(env, contractId);
  if (!['fully_signed', 'terminated'].includes(contract.status)) {
    throw new HttpError(409, 'FINAL_DOCUMENT_NOT_READY', 'Final document is not available');
  }
  const row = await getFinalDocumentRow(env, contractId);
  const document = await decryptFinalDocument(env, row);
  await recordAuditEvent(request, env, {
    contractId,
    eventType: 'document_downloaded',
    documentHash: row.document_hash,
    metadata: { format: 'admin_json' },
  });
  return {
    body: {
      contract_id: contractId,
      final_document_hash: row.document_hash,
      canonical_document: document.manifest,
      printable_html: document.html,
    },
  };
}

export async function withdrawFinalConsents(
  request: Request,
  env: Env,
  contractId: string,
  value: unknown,
): Promise<ServiceResult> {
  const session = await authenticateFinalDocumentSession(request, env, contractId);
  const party = (await getParties(env, contractId)).find((item) => item.id === session.party_id);
  if (!party || party.role !== 'client') {
    throw new HttpError(403, 'CLIENT_CONSENT_ONLY', 'Only the coaching client may withdraw optional consents');
  }
  const body = asBodyRecord(value);
  const rawKeys = snakeOrCamel(body, 'consentKeys', 'consent_keys');
  const requestId = snakeOrCamel(body, 'requestId', 'request_id');
  if (!Array.isArray(rawKeys) || rawKeys.length < 1
    || rawKeys.some((key) => typeof key !== 'string' || !CONSENT_KEYS.includes(key as typeof CONSENT_KEYS[number]))) {
    throw new HttpError(400, 'INVALID_INPUT', 'consent_keys must contain supported optional consent keys');
  }
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/u.test(requestId)) {
    throw new HttpError(400, 'INVALID_INPUT', 'request_id is required');
  }
  const nonceHash = await hmacHex(
    env.TOKEN_HASH_SECRET,
    `consent-withdrawal-v1:${contractId}:${party.id}`,
    requestId,
  );
  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [env.DB.prepare(
    `INSERT INTO contract_request_nonces (
       id, contract_id, party_id, session_id, request_nonce_hash, created_at
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(randomId(), contractId, party.id, session.id, nonceHash, timestamp)];
  const statementIndexes: Array<{ key: string; updateIndex: number }> = [];
  for (const key of new Set(rawKeys as string[])) {
    statements.push(await createConsentWithdrawalAuditStatement(request, env, {
      contractId,
      partyId: party.id,
      consentKey: key,
      eventAt: timestamp,
    }));
    statements.push(env.DB.prepare(
      `UPDATE contract_consents SET accepted = 0, withdrawn_at = ?, updated_at = ?
       WHERE contract_id = ? AND party_id = ? AND consent_key = ? AND accepted = 1`,
    ).bind(timestamp, timestamp, contractId, party.id, key));
    statementIndexes.push({ key, updateIndex: statements.length - 1 });
  }
  let results: D1Result[];
  try {
    results = await env.DB.batch(statements);
  } catch (error) {
    if (String(error).toLowerCase().includes('unique')) {
      throw new HttpError(409, 'REQUEST_REPLAY_BLOCKED', 'Consent withdrawal request was already processed');
    }
    throw error;
  }
  const withdrawnKeys = statementIndexes
    .filter(({ updateIndex }) => (results[updateIndex]?.meta.changes ?? 0) === 1)
    .map(({ key }) => key);
  return { body: { contract_id: contractId, withdrawn_consent_keys: withdrawnKeys, withdrawn_at: timestamp } };
}
