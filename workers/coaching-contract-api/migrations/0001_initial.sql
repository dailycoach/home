PRAGMA foreign_keys = ON;

CREATE TABLE contracts (
  id TEXT PRIMARY KEY,
  contract_number TEXT NOT NULL UNIQUE,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('life', 'business', 'career')),
  template_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'draft', 'ready', 'issued', 'viewed', 'partially_signed',
    'fully_signed', 'expired', 'cancelled', 'superseded', 'terminated'
  )),
  title TEXT NOT NULL,
  coach_party_id TEXT NOT NULL,
  client_party_id TEXT NOT NULL,
  sponsor_party_id TEXT,
  goal_summary_ciphertext TEXT NOT NULL,
  session_count INTEGER NOT NULL CHECK (session_count BETWEEN 1 AND 1000),
  session_minutes INTEGER NOT NULL CHECK (session_minutes BETWEEN 15 AND 480),
  delivery_method TEXT NOT NULL,
  start_date TEXT NOT NULL,
  expected_end_date TEXT NOT NULL,
  fee_amount INTEGER NOT NULL CHECK (fee_amount >= 0),
  fee_currency TEXT NOT NULL,
  payment_terms TEXT NOT NULL,
  cancellation_terms TEXT NOT NULL,
  refund_terms TEXT NOT NULL,
  confidentiality_scope TEXT NOT NULL,
  reporting_scope TEXT NOT NULL,
  technology_terms TEXT NOT NULL,
  governing_law TEXT NOT NULL,
  legal_review_status TEXT NOT NULL CHECK (legal_review_status IN ('LEGAL_REVIEW_REQUIRED', 'APPROVED')),
  legal_review_reference TEXT,
  adult_client_confirmed INTEGER NOT NULL CHECK (adult_client_confirmed IN (0, 1)),
  draft_document_ciphertext TEXT NOT NULL,
  draft_revision INTEGER NOT NULL DEFAULT 1 CHECK (draft_revision > 0),
  encryption_key_version TEXT NOT NULL,
  issued_at TEXT,
  expires_at TEXT,
  fully_signed_at TEXT,
  cancelled_at TEXT,
  terminated_at TEXT,
  superseded_by TEXT REFERENCES contracts(id),
  supersedes_contract_id TEXT REFERENCES contracts(id),
  snapshot_hash TEXT,
  final_document_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX contracts_status_idx ON contracts(status, updated_at DESC);
CREATE INDEX contracts_type_idx ON contracts(contract_type, created_at DESC);
CREATE INDEX contracts_supersedes_idx ON contracts(supersedes_contract_id);

CREATE TABLE contract_parties (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('coach', 'client', 'sponsor', 'organization_contact')),
  display_name_ciphertext TEXT NOT NULL,
  email_ciphertext TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  phone_ciphertext TEXT,
  organization_ciphertext TEXT,
  required_signer INTEGER NOT NULL CHECK (required_signer IN (0, 1)),
  verification_method TEXT NOT NULL CHECK (verification_method = 'invite_pin'),
  signed_name_ciphertext TEXT,
  signature_event_id TEXT UNIQUE,
  signed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (contract_id, role),
  UNIQUE (contract_id, email_hash, role)
);

CREATE INDEX contract_parties_contract_idx ON contract_parties(contract_id, role);
CREATE INDEX contract_parties_email_hash_idx ON contract_parties(email_hash);

CREATE TABLE contract_versions (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  template_version TEXT NOT NULL,
  canonical_snapshot_ciphertext TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  encryption_key_version TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (contract_id, version_number),
  UNIQUE (contract_id, snapshot_hash)
);

CREATE INDEX contract_versions_contract_idx ON contract_versions(contract_id, version_number DESC);

CREATE TABLE contract_consents (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  party_id TEXT NOT NULL REFERENCES contract_parties(id) ON DELETE RESTRICT,
  consent_key TEXT NOT NULL CHECK (consent_key IN (
    'session_recording', 'ai_assisted_summary',
    'anonymized_case_use', 'marketing_testimonial'
  )),
  required INTEGER NOT NULL DEFAULT 0 CHECK (required = 0),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  accepted INTEGER NOT NULL DEFAULT 0 CHECK (accepted IN (0, 1)),
  consent_text_version TEXT NOT NULL,
  consent_text_hash TEXT NOT NULL,
  selection_details_ciphertext TEXT,
  selected_at TEXT,
  accepted_at TEXT,
  withdrawn_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (contract_id, party_id, consent_key)
);

CREATE INDEX contract_consents_party_idx ON contract_consents(contract_id, party_id);

CREATE TABLE contract_invites (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  party_id TEXT NOT NULL REFERENCES contract_parties(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  locked_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TEXT NOT NULL
);

CREATE INDEX contract_invites_contract_idx ON contract_invites(contract_id, party_id, created_at DESC);

CREATE TABLE contract_invite_exchanges (
  id TEXT PRIMARY KEY,
  invite_id TEXT NOT NULL REFERENCES contract_invites(id) ON DELETE RESTRICT,
  exchange_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX contract_invite_exchanges_invite_idx
  ON contract_invite_exchanges(invite_id, expires_at);

CREATE TABLE contract_invite_sessions (
  id TEXT PRIMARY KEY,
  invite_id TEXT NOT NULL REFERENCES contract_invites(id) ON DELETE RESTRICT,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  party_id TEXT NOT NULL REFERENCES contract_parties(id) ON DELETE RESTRICT,
  session_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX contract_invite_sessions_contract_idx
  ON contract_invite_sessions(contract_id, party_id, expires_at);

CREATE TABLE contract_request_nonces (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  party_id TEXT NOT NULL REFERENCES contract_parties(id) ON DELETE RESTRICT,
  session_id TEXT NOT NULL,
  request_nonce_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (contract_id, party_id, request_nonce_hash)
);

CREATE TABLE contract_final_documents (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL UNIQUE REFERENCES contracts(id) ON DELETE RESTRICT,
  final_snapshot_ciphertext TEXT NOT NULL,
  html_ciphertext TEXT NOT NULL,
  document_hash TEXT NOT NULL UNIQUE,
  encryption_key_version TEXT NOT NULL,
  r2_object_key TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE contract_final_access_tokens (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  party_id TEXT NOT NULL REFERENCES contract_parties(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX contract_final_access_idx
  ON contract_final_access_tokens(contract_id, party_id, expires_at);

CREATE TABLE contract_final_document_sessions (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  party_id TEXT NOT NULL REFERENCES contract_parties(id) ON DELETE RESTRICT,
  session_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  created_at TEXT NOT NULL
);

CREATE INDEX contract_final_document_sessions_idx
  ON contract_final_document_sessions(contract_id, party_id, expires_at);

CREATE TABLE contract_audit_events (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  party_id TEXT REFERENCES contract_parties(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  event_at TEXT NOT NULL,
  ip_evidence_hash TEXT,
  user_agent_summary TEXT,
  document_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX contract_audit_events_contract_idx
  ON contract_audit_events(contract_id, event_at, id);

CREATE TABLE api_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  expires_at TEXT NOT NULL
);

CREATE INDEX api_rate_limits_expiry_idx ON api_rate_limits(expires_at);

CREATE TABLE admin_request_nonces (
  id TEXT PRIMARY KEY,
  actor_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  request_nonce_hash TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (actor_hash, action, request_nonce_hash)
);

CREATE INDEX admin_request_nonces_resource_idx ON admin_request_nonces(resource_id);

CREATE TRIGGER contract_versions_immutable_update
BEFORE UPDATE ON contract_versions
BEGIN
  SELECT RAISE(ABORT, 'contract versions are immutable');
END;

CREATE TRIGGER contract_versions_immutable_delete
BEFORE DELETE ON contract_versions
BEGIN
  SELECT RAISE(ABORT, 'contract versions are immutable');
END;

CREATE TRIGGER contract_audit_events_immutable_update
BEFORE UPDATE ON contract_audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;

CREATE TRIGGER contract_audit_events_immutable_delete
BEFORE DELETE ON contract_audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;

CREATE TRIGGER protect_issued_contract_core
BEFORE UPDATE OF
  contract_number, contract_type, template_version, title,
  coach_party_id, client_party_id, sponsor_party_id,
  goal_summary_ciphertext, session_count, session_minutes, delivery_method,
  start_date, expected_end_date, fee_amount, fee_currency,
  payment_terms, cancellation_terms, refund_terms,
  confidentiality_scope, reporting_scope, technology_terms, governing_law,
  legal_review_status, legal_review_reference, adult_client_confirmed,
  draft_document_ciphertext
ON contracts
WHEN OLD.status <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'issued contract core is immutable');
END;

CREATE TRIGGER protect_issued_party_identity
BEFORE UPDATE OF
  role, display_name_ciphertext, email_ciphertext, email_hash,
  phone_ciphertext, organization_ciphertext, required_signer, verification_method
ON contract_parties
WHEN (SELECT status FROM contracts WHERE id = OLD.contract_id) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'issued contract party identity is immutable');
END;

CREATE TRIGGER protect_signed_party_signature
BEFORE UPDATE OF signed_name_ciphertext, signature_event_id, signed_at
ON contract_parties
WHEN OLD.signature_event_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'signature is immutable');
END;
