# NAL-STABILIZATION-04B — Owner Auth / RPC Binding Review Contract

**2026-10-10 KST · DESIGN + SYNTHETIC VERIFICATION ONLY · NOT A RELEASE APPROVAL**

Review base: `dailycoach/home` P4-A Draft PR #170, `d3a28d1b6924996dee74ece58988d32edc330759`.

## 1. Reviewed facts from live Supabase `nal-platform`

| Evidence | Observed condition |
| --- | --- |
| `nal_private.read_release_control.mode` | `off` |
| `nal_private.read_privacy_execution_control.journal_erasure_enabled` | `false` |
| `approved_policy_version` | `null` |
| Existing `owner` memberships | 0 |
| Privacy requests / READ cohorts / orders / payments | all 0 |
| `nal-read-privacy-admin` Edge | **not deployed** |
| `nal_read_privacy_admin(uuid,text,jsonb)` | `p_owner_id,p_action,p_payload`; SECURITY INVOKER; `service_role` EXECUTE only |
| `nal_private.read_verified_subject(uuid)` | validates verified identity header + freshness, expects `p_owner_id` user ID |
| Existing shared RPC helper | always injects `p_user_id`; deliberately no owner RPC allowlist |

The **DB administrative function supports five actions**: `queue`, `preview`, `start-review`, `approve-journal`, `execute-journal`. Only the **first three non-destructive review actions** are eligible for a future owner API. A future endpoint must not pass the last two, even if DB itself recognizes them.

## 2. Trust boundary

```text
Browser (untrusted)
   |
   | POST JSON { action, payload }, authenticated user JWT
   v
Separate Owner Edge API  [CURRENTLY ABSENT / DEFAULT OFF]
   |- strict origin/method/content-type/body/actions check (Origin is NOT auth)
   |- fresh Supabase Auth getUser(jwt) verification
   |- current server-side Auth Admin user status + matching user ID
   |- current nal_private.admins owner membership check
   |- derive p_owner_id ONLY from verified Auth user ID
   |- create verified PostgREST request context on server
   |- fixed RPC = nal_read_privacy_admin
   |      allowed action = queue|preview|start-review
   |      denied action = approve-journal|execute-journal|anything else
   v
DB RPC service_role auth + read_verified_subject(p_owner_id)
   |- check owner membership a second time
   |- expose only counts/metadata (no journal prose)
   v
Filtered response to same authenticated owner
```

**Key conditions:** Never trust a browser-supplied `ownerId`, `p_user_id`, `p_owner_id`, role, `user_metadata`, a raw JWT `sub` without signature verification, or only `verify_jwt` / CORS / a static JSON release flag. Never forward the user's incoming headers to the privileged DB request. A server-owned verified header must match `read_verified_subject` expectations and be constructed for **each request**. No browser service key. Enforce timeout, request size and rate limits. Prevent debug logs of JWTs, full response or private journal text.

Current Supabase official guidance distinguishes signed-in JWTs from `apikey` keys, and specifically warns that platform `verify_jwt` alone does not prove business permissions:
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/functions/auth-headers
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/guides/getting-started/api-keys

## 3. Current scope of executable prototype

`integration/nal-stabilization-04b/owner-review-protocol.mjs` is **Node-only, pure, deliberately not deployable**; it has no real Auth, network, DB, payment, Edge, service key or write capability.

Given trusted injected identity and membership check callbacks (both synthetic in CI), it only prepares **internal-only** `{rpcName, rpcArgs}`. Its default release is OFF. A release-positive test is hypothetical, not evidence of approved privacy notice or available privileged endpoint.

Schema contract:

| action | required payload | forbidden |
| --- | --- | --- |
| `queue` | `{}` | extra fields |
| `preview` | exactly `requestId: UUIDv4` | owner ID, deletion terms, extra fields |
| `start-review` | exactly `requestId: UUIDv4, confirmed:true` | false/string confirmations, nonce, fingerprint, extra fields |
| all else | reject | `approve-journal`, `execute-journal`, grant role, erasure activation |

**Do not ship or import the prototype under `supabase/functions/`**. The prototype only enforces the request/identity/membership contract in isolation. A deployed service needs an independently approved implementation of Auth verification, DB membership lookup, verified header construction, HTTP response handling and CORS preflight.

## 4. P4-B1 validation criteria

- [ ] Synthetic approved owner can bind `p_owner_id` from fresh verified Auth; no client-provided ID accepted.
- [ ] Missing or malformed owner role, expired/banned/anonymous user, missing policy, unavailable DB ⇒ fail closed.
- [ ] No owner RPC called, no service-role key used, no real user data or network in synthetic tests.
- [ ] Disabled release performs zero identity or owner checks.
- [ ] Source code remains unchanged under `supabase/functions/`, and no new DB migration, grants, owner membership, domain rollout or billable resource created.
- [ ] P1/P2/P3/P4-A checks still PASS; all PRs remain Draft.

## 5. P4-B2 security review blockers (not completed here)

1. **Independent code review:** specific owner-only server adapter, config default-OFF, admin membership checked with service-only permissions, safe `p_owner_id` injection, exact verified PostgREST context, no inherited generic `p_user_id` mutation. The previous BUILD34 privileged shared Auth change remains blocked; no workaround.
2. **Real Auth negative tests in an authorized isolated environment:** missing/expired/forged JWT, user revoked during request, replay, Auth Admin current status, unassigned account, non-owner, off policy, cross-account requests, unauthorized CORS origin. No customer data and no new owner role without authorization.
3. **Privacy administration/business approval:** controller identity, current privacy policy, data retention and backups/logs/Storage boundaries, user intake/withdrawal and how requests are fulfilled, owner assignment procedure.
4. **Safety operations:** logging redaction, request quotas, HTTPS-only, recovery procedures, documented rollback, independent review of the existing DB's approval/erasure code path even though the new API must not expose it.
5. **Deployment gate:** only after explicit release authorization; do not merge to `main`, deploy `nal-read-privacy-admin`, set feature flags, create owner accounts or execute privacy journal deletion in this work.

**Decision:** P4-B1 executable contract can pass; P4-B2 actual owner authorization stays **BLOCKED**. Never use the P4-B1 test result as a production compliance or authentication PASS.
