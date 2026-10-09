# NAL-STABILIZATION-04 — PRIVACY / OWNER AUTH SECURITY GATE

**As-of:** 2026-10-10 (Asia/Seoul)  
**Project:** NAL · 날빛, Supabase `nal-platform`  
**Development chain:** PR #167 → #168 → #169 → P4 Draft. No production writes.

## P4 scope

Prior BUILD34's privileged shared Auth/RPC modification was **blocked by a security review**. This stabilization task does not bypass that block, does not patch the shared authenticated-user helper, does not create an owner-scoped Edge route and does not grant new owner permissions.

P4 is split deliberately:
- **P4-A, completed:** audit present DB/function permissions; add executable static fail-closed privacy UI tests and source-reconciliation checks; preserve OFF status.
- **P4-B, blocked:** independently reviewed server authorization architecture, safe binding of verified user identity to `p_owner_id`, approved legal notices, non-destructive owner API and production approval.

## Evidence from live read-only inspection

- `nal_private.read_release_control.mode = off`.
- `nal_private.read_privacy_execution_control.journal_erasure_enabled = false`.
- `approved_policy_version = null`; current owner rows, requests and review rows = 0.
- `public.nal_read_privacy(uuid,text,jsonb)` and `public.nal_read_privacy_admin(uuid,text,jsonb)` are SECURITY INVOKER, executable by `service_role` only; `anon` and `authenticated` have no execute grants.
- `nal_private.read_privacy_journal_erase` is private SECURITY DEFINER; executable by service only. The execution-control table has no service-role UPDATE grant.
- `nal-read-privacy-admin` is **not** deployed.
- `nal-account` deployed version 2 has `verify_jwt=false` and performs its **own** user-token/GoTrue and current-account verification in handler/Auth helper. This flag alone is **not** an authentication guarantee. All future privileged routes must verify actual user identity independently and not trust browser role claims.
- Deployed `nal-account` Auth helper matches development source, while some earlier deployments contain the previous RPC allowlist (without member privacy RPC). This is version drift; it is **not** proof of an authorization bypass.
- Unpublished site account/checkout/sales flag remains false.

These are point-in-time findings, not an ongoing compliance certification. Re-query live server before considering launch. The query is bundled in `integration/nal-stabilization-04/audit-readonly.sql`.

## Critical interface mismatch

Current **deployed and source** shared helper `createReadAuthBoundary().rpc()` always appends `p_user_id` to RPC payloads and allowlists `nal_read_privacy` for the member. The owner DB RPC instead expects `p_owner_id` and independently checks `nal_private.read_verified_subject(p_owner_id)` **and** current owner membership.

Therefore it is **incorrect** to route `nal_read_privacy_admin` through that generic helper or to copy `p_user_id` into `p_owner_id` from browser input. An independent, reviewed, per-request identity mapping is required; this task **does not implement or bypass it**.

## Rules for eventual owner API review

1. Separate owner-only `nal-read-privacy-admin` entrypoint, absent/deployment OFF until approved. A separate `NAL_PRIVACY_ADMIN_ENABLED` default-OFF server flag.
2. Validate user JWT against Supabase Auth **on each request**; check current account restrictions and existing owner role *server-side*. Never trust `user_metadata`, client `ownerId`, or mere CORS/`verify_jwt` flags.
3. `p_owner_id` must be derived **only** from verified server identity and must match DB membership; never forward the user-controlled field. Cross-user/read errors must fail closed.
4. Allow only non-destructive `queue`, `preview`, `start-review` after explicit approval. Exclude `approve-journal`, `execute-journal`, delete/switch commands. `start-review` is not a deletion operation.
5. Keep paid & READ modes OFF until separately approved; no service key in browser; no user contents in logs, timestamps or responses beyond minimal counts; no background polling.
6. Obtain real business identity, approved privacy notice, retention/backup/log/deletion scope and owner authorization. Run independent security review + authenticated/unauthenticated/malformed-token tests **without real customer data** before release.
7. Preserve complete denied/error/audit behavior; any integration failure must not say that records are absent or deleted.

Supabase platform documentation: `verify_jwt` checks do not by themselves prove an individual user when API keys are accepted; distinguish authenticated identity from authorization.

## Implemented protections in this PR

- `scripts/check-nal-privacy-release-lock.mjs`: checks owner gate OFF, action allowlists, reviewed UI path, staging backend disconnected, no privileged Edge handler, member privacy request disabled in browser, account/paid OFF.
- `scripts/test-nal-privacy-owner-ui.mjs`: synthetic DOM/VM checks: disabled/malformed/rejected gate must **never call owner RPC**; non-owner cannot queue; mock owner only gets queue. **No real credentials/network.**
- `scripts/test-nal-privacy-lock-negative.mjs`: 11 source tampering scenarios must fail closed and then restore the pristine source.
- Existing P1/P2/P3 catalog/integration CI runs unchanged, with P4 checks appended.

### Release decision

**P4-A STATIC + PERMISSION AUDIT PASS is not P4 release PASS.**  
**P4-B = BLOCKED** until user-approved owner server authorization, legal policy, and independent role-boundary verification. Do not merge this PR to `main` or deploy an unreviewed privileged Edge function.

Production DB, Storage, Edge functions, owners, customer data, payment state and site frontend remain unchanged.
