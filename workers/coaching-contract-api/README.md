# DAILYCOACHING coaching contract API

Cloudflare Worker + D1 backend for the adult-only life, business, and career coaching contract flow. The Worker owns the issued wording, encrypts personal/free-text fields with AES-256-GCM, stores only HMACs of invite/PIN/session tokens, freezes each issued snapshot, records append-only audit events, and creates a canonical final manifest after every required party signs.

## Deployment status

**Not deployed. External Cloudflare credentials, a D1 production database, Cloudflare Access, an approved legal configuration, and an approved delivery channel are not available in this workspace.**

The checked-in templates still contain `LEGAL_REVIEW_REQUIRED` clauses. Consequently `/v1/health` reports `contract_service_ready: false`, `/v1/admin/session` reports `legal_review_ready: false`, and issue requests fail closed. Draft creation/preview remains possible in a correctly authenticated local/test environment; production issue is intentionally impossible until the checklist below is completed.

The OTP + typed name + explicit checks + timestamps + document hash evidence model is itself `LEGAL_REVIEW_REQUIRED`. No claim is made here that it is sufficient for a particular dispute, transaction, or retention duty.

## Architecture

- Static frontend: `https://daily-coach-ing.com/coaching/contracts/`
- API target: `https://api.daily-coach-ing.com`
- Administrator gate: Cloudflare Access on both `/v1/admin/*` and the static coach screen
- Database: D1, migration `migrations/0001_initial.sql`
- Optional archive: encrypted final manifest/HTML in R2; D1 remains authoritative
- Server wording source: the repository JSON templates imported at Worker build time
- Client `canonical_document`: draft preview only; never trusted as issued wording
- Issued document hash: SHA-256 of stable canonical issued JSON
- Final document hash: SHA-256 of the stable final manifest JSON (not of the rendered HTML bytes)

## Security properties

- Cloudflare Access JWT validation is performed inside the Worker: fixed team issuer, `alg=RS256`, `kid` from the fixed team JWKS URL, signature, audience, `exp`, `nbf`, and `iat`.
- CORS reflects only the single exact HTTPS `ALLOWED_ORIGIN`; CORS is not used as authentication.
- JSON, final HTML, and errors use `no-store`, `no-referrer`, `nosniff`, `frame-ancestors 'none'`, and restrictive permissions policy headers.
- Worker observability is disabled by default because request paths must not retain raw tokens. Zone/Access logging must also be configured to redact sensitive headers and bodies before activation.
- Raw invite/final tokens are exchanged in a POST body. Legacy path-token endpoints return `410 TOKEN_IN_URL_DISABLED` and do not process the token.
- Raw invite, PIN, exchange session, verified session, and final-access tokens are never stored. D1 stores purpose-separated HMAC-SHA-256 values.
- OTP attempts are counted and locked; D1 fixed-window rate limits also protect public/admin routes.
- Personal party data, signatures, goals, contract terms, draft preview, snapshots, consent details, and final documents are AES-GCM envelopes with field/record-specific associated data.
- `draft` is the only editable state. Database triggers protect issued core/party identity, versions and audit events are immutable, and replay nonces protect create/sign/withdrawal requests.
- Required contract-processing data is not represented as consent. Only the four optional consent keys appear in `contract_consents`, always `required=0`, initially unselected/false.
- A client decides optional consents; a sponsor cannot decide them on the client's behalf.
- A business contract requires coach, client, and sponsor as required signers. `fully_signed` is impossible until every required signer has a signature event.

## State machine

Allowed transitions are:

```text
draft -> ready -> issued -> viewed -> partially_signed -> fully_signed -> terminated
                   ├-> expired
                   ├-> cancelled
                   └-> superseded
```

The issue endpoint performs the `draft -> ready -> issued` sequence and writes both audit events in one D1 batch. Even when only the client remains after the coach signs at issue time, customer signing records `partially_signed` before finalization.

An expired `issued` contract is lazily transitioned to `expired` on invite/customer access, with active invites revoked and `contract_expired` audited. Contracts already in a later state remain inaccessible after their deadline without inventing a transition outside the state table.

If encrypted final-document generation fails after the last signature was durably accepted, the sign response remains `partially_signed` with `final_access_state: finalization_pending` and returns the one-time final-access token. Exchanging that token retries finalization before consuming it. An Access-authenticated administrator can also call the idempotent recovery endpoint and then issue a replacement final-access token; no signature is collected twice.

## API

Administrator routes require a valid `Cf-Access-Jwt-Assertion`:

- `GET /v1/admin/session`
- `POST /v1/admin/contracts`
- `PATCH /v1/admin/contracts/:id`
- `POST /v1/admin/contracts/:id/issue`
- `POST /v1/admin/contracts/:id/cancel`
- `POST /v1/admin/contracts/:id/reissue`
- `POST /v1/admin/contracts/:id/terminate`
- `POST /v1/admin/contracts/:id/finalize` — idempotent recovery after every required signature exists
- `GET /v1/admin/contracts`
- `GET /v1/admin/contracts/:id`
- `GET /v1/admin/contracts/:id/final-document`
- `POST /v1/admin/contracts/:id/final-access` — issue a one-time final-copy token to one signed required party

Customer flow uses in-memory `Authorization: Bearer <session>` tokens:

- `POST /v1/invites/exchange` with `{ "token": "..." }`
- `GET /v1/invites/summary` with invite-exchange Bearer token
- `POST /v1/invites/verify` with invite-exchange Bearer token and `{ "pin": "123456" }`
- `GET /v1/contracts/:id/snapshot` with verified-invite Bearer token
- `POST /v1/contracts/:id/consents`
- `POST /v1/contracts/:id/sign`
- `GET /v1/contracts/:id/final-document` with final-document Bearer token
- `POST /v1/contracts/:id/consents/withdraw` with final-document Bearer token
- `POST /v1/final-access/exchange` with `{ "token": "..." }`
- `GET /v1/final-access`
- `GET /v1/final-access/document`

Snapshot responses include `snapshot_hash`, `signer_role`, and immutable optional-consent `consentTextVersion`, `consentText`, and `consentTextHash` values. Consent submissions must echo the displayed version/hash; the server compares them to D1 and never accepts client-supplied wording.

For a client final-document session, final-access summaries also include `current_optional_consents` with the current `accepted` and `withdrawn_at` values. This current-state view is separate from the immutable signed manifest. Withdrawal responses and audit events include only consent keys that actually changed from accepted to withdrawn.

### Frontend payload contract

All mutating requests include a cryptographically random `request_id` of 16–128 URL-safe characters.

```json
{
  "request_id": "random-idempotency-value",
  "consents": [
    {
      "consent_key": "session_recording",
      "required": false,
      "accepted": false,
      "consent_text_version": "session-recording-ko-v1.0.0",
      "consent_text_hash": "64-lowercase-hex",
      "options": {}
    }
  ]
}
```

All four consent records are mandatory in one decision request. Marketing acceptance additionally requires the four independent booleans plus `publication_channels` and `publication_period`.

```json
{
  "request_id": "random-signature-nonce",
  "signed_name": "서명자 직접 입력",
  "electronic_signature_intent": true,
  "confirmations": {
    "contract_read": true,
    "important_terms": true,
    "electronic_document": true
  },
  "document_hash": "64-lowercase-hex",
  "expected_version": 1
}
```

## Legal/configuration gate

Production issue requires every condition below. Missing or placeholder values keep the service fail-closed.

1. A legal reviewer updates all server templates so no clause has `reviewStatus: LEGAL_REVIEW_REQUIRED` and no unresolved variable remains.
2. Run `npm run template:hashes`; independently approve the exact output and set it as `APPROVED_TEMPLATE_MANIFESTS`.
3. Set `LEGAL_REVIEW_STATUS=APPROVED` and a traceable, non-placeholder `LEGAL_REVIEW_REFERENCE`.
4. Set approved `CONTRACT_RETENTION_POLICY`, `PROCESSOR_AND_TRANSFER_POLICY`, and `DISPUTE_AND_REFUND_POLICY` references.
5. Set `APPROVED_CONTRACT_POLICY_JSON` with every approved policy/template variable used by server wording. It must contain no unresolved tokens.
6. Confirm cancellation/refund, governing law/disputes, confidentiality exceptions, privacy legal basis/retention, processor/cross-border details, electronic evidence/retention, and minor exclusion with qualified reviewers.
7. Configure a final-copy delivery process. v1 implements one-time Access-admin token issuance for secure manual delivery. Automatic email is not implemented because no provider or processing terms were approved.

## Cloudflare setup

```bash
npm ci
wrangler d1 create coaching-contracts
wrangler d1 migrations apply coaching-contracts --remote
wrangler secret put DATA_ENCRYPTION_KEY
wrangler secret put TOKEN_HASH_SECRET
wrangler secret put OTP_HASH_SECRET
wrangler secret put AUDIT_HASH_SECRET
wrangler secret put ADMIN_ACCESS_AUDIENCE
wrangler deploy
```

Before those commands:

- replace the placeholder D1 ID in `wrangler.toml`;
- create the custom API DNS/route;
- set `CF_ACCESS_TEAM_DOMAIN` to the fixed team domain;
- use independent 32-byte-or-stronger HMAC secrets and an independent base64 32-byte AES key for each environment;
- protect admin API/static paths with Cloudflare Access;
- set CSP/`frame-ancestors` as Worker/zone response headers (not only an HTML meta tag);
- decide whether to enable the optional R2 binding only after retention/deletion approval;
- keep Worker/Access/zone request logging and body capture disabled or redacted for token-bearing endpoints;
- validate custom-domain certificates, CORS, rate limits, Access JWT audience, key rotation, backup/restore, and deletion procedures.

`wrangler deploy` above is a deployment instruction only; it was not executed in this workspace.

## Local verification

```bash
npm ci
npm run check
npm test
XDG_CONFIG_HOME=/tmp/wrangler-config \
  wrangler d1 migrations apply coaching-contracts --local \
  --persist-to /tmp/coaching-contract-d1
```

Current automated coverage checks crypto/AAD failure, purpose-separated HMACs, Cloudflare Access RS256/issuer/audience/time validation, frontend snake_case payload normalization, optional-consent separation, required business sponsor signing, the allowed/forbidden state machine, server-owned template integrity, and fail-closed legal template approval.

Browser/device QA and a full issued-contract E2E test remain blocked until approved legal templates/policies and an actual Cloudflare preview environment exist.
