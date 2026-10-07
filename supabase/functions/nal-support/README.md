# nal-support — BUILD13 account wiring, not deployed

## Current source status
BUILD12 introduced the support schema/API/UI but left the common browser account adapter and menus unwritten after a blocked connector operation. BUILD13 completes those same common-file changes through a successful normal GitHub tree write. The current account-session source now exposes `NalAccount.support(action,payload)` using the existing authenticated request closure. Customer and operator support entrypoints load that account bundle, and shared account/READ menus link to the support screens.

No separate browser Auth client, alternative credential flow or relaxed permission check was added. The server endpoint, SQL and Auth verification helper are unchanged in this follow-up. Historical BUILD12 notes describe the prior missing adapter; current source scope is documented in docs/NAL_READ_BUILD13_SUPPORT_CONNECTION.md.

## Runtime boundary
This is source integration only: no migration, Edge deployment, feature activation, live login, inquiry, reply or runtime test has been performed by BUILD13. `NAL_SUPPORT_ENABLED` is still false/unset unless separately configured outside this build. A successful Git write is not a successful live message send.

## Runtime contract after later integration
Use the existing SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and exact NAL_ALLOWED_ORIGINS. No configuration was changed. Support does not require an active READ entitlement; verified former participants may access their own support history when the support feature is enabled. Existing account eligibility rules remain.
Authenticated POST only, plus CORS OPTIONS. Public help is static. Retain server-side Auth /user and bound current-account verification through the existing helper. Review gateway compatibility with actual project signing configuration during the later deployment stage; no gateway settings are changed now.

POST `{action,payload}`. Acting user identity comes only from server verification.
Member: contexts, list, get, create, reply, resolve, reopen, read.
Staff: admin-list, admin-get, admin-staff, admin-reply, admin-resolve, admin-reopen, admin-assign.
The SQL wrappers enforce owner/operator role and per-thread assignment. Owners see the full queue; operators only assigned threads. Navigation links or client action names never grant staff permission. No support operation creates an admin role or alters payments, refunds, entitlements or DAY completion.

Title <=120 characters, message <=4,000, strict field allowlist, 24KiB request cap, request identity/fingerprint replay handling, optimistic thread revisions and sequential message pagination. Read receipts cover the owner's loaded messages. No HTML message rendering, upload, diagnostics, complete URL, card-field or coaching-answer collection.

## Later integration dependencies
Recorded FIX03 verified identity + BUILD06 account/order/enrollment source + BUILD07 checkout context + BUILD09 cohort/waitlist source, then docs/NAL_READ_BUILD12_SUPPORT.sql. That file remains unapplied source, not a recorded hosted migration. Package with the matching full application source chain; the account wrapper alone does not deploy the platform.

BUILD13 has no tests, actual messages, hosted SQL, paid helpdesk, AI service, scheduler or new cloud resource. Existing refund-console flow, free PDFs, content, prices and schedules are untouched. Pre-sale integration/validation and retention/account-deletion decisions remain separate work.
