# nal-support — BUILD12 source, not deployed

## Current blocker
The common browser account adapter/menu write was blocked by the connector safety gate and was left unapplied. `NalAccount.support` does not exist in the current account-session source. The new inquiry UI detects this absence, displays a preparation message and does not submit. Do not report a usable connected feature until that separate write is resolved through authorized tooling.

## Runtime scope after later integration
Existing SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and exact NAL_ALLOWED_ORIGINS. Additional `NAL_SUPPORT_ENABLED=false` by default. No settings are changed by this build. Support does not require an active READ entitlement: verified former participants can access their own support history.
The endpoint accepts authenticated POST only, plus CORS OPTIONS. Public help is a static page. Retain server-side Auth /user and bound current-account verification via the existing shared helper. Configure the gateway deliberately for the project's real token/signing configuration at integration; no gateway changes are made now.

POST `{action,payload}`. User ID comes only from server verification.
Member actions: contexts, list, get, create, reply, resolve, reopen, read.
Admin prefix selects a fixed staff RPC: admin-list, admin-get, admin-staff, admin-reply, admin-resolve, admin-reopen, admin-assign.
The SQL wrapper, not the requested action name alone, verifies owner/operator role and per-thread assignment. Owners see the full queue, operators only explicitly assigned threads. No support endpoint grants admin membership or performs a payment/refund/entitlement operation.

Data contract: title <=120 characters; body <=4,000; strict allowed fields; 24KiB request cap; same payload/request ID is idempotent; modified conversation revisions reject a stale mutation; messages use sequential pagination. Read receipts apply only to the owner's loaded message sequence. No HTML messages, file upload, auto-attachment, diagnostics, token, card field, personal coaching-answer lookup or auto-reply.

Source dependency: recorded FIX03 verified identity + BUILD06 account preference/order/enrollment data + BUILD07 checkout context + BUILD09 cohort/waitlist tables, then docs/NAL_READ_BUILD12_SUPPORT.sql. It is an unapplied source, not a migration record. The overall app still needs prior BUILD04-11 sources integrated; do not deploy the support code alone and claim the platform complete.

No tests, actual messages, hosted SQL, Edge deployment, paid helpdesk, AI use, scheduler or new cloud resource was executed in this build. Tests remain deferred to the owner's pre-sale phase. See docs/NAL_READ_BUILD12_SUPPORT.md for the exact implemented and missing parts.
