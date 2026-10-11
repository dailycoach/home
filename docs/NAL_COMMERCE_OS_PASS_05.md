# NAL COMMERCE OS P7-E — Attendee Pass Confirmation & Buyer-Proof Resend

Date: 2026-10-11 KST. SOURCE ONLY + ISOLATED POSTGRES VERIFICATION. Draft, no production merge or deployment.

NAL keeps an independent single-seller business model. The prior P7-B order ledger, P7-C guest purchase proof, and P7-D program pass digest functions remain the source of truth. This stage adds the buyer-facing reading/class pass confirmation screen and strictly bounded resend request path.

## 1. Customer flow: simple but safe

The proposed future email contains a same-origin URL to /nal/commerce/pass/#order=...&token=.... The 256-bit token is in the fragment, not the query string, so the server/CDN does not receive it on the initial page GET. The browser immediately strips the fragment from navigation history; the token remains only in page-memory until the user explicitly confirms.

- Display status and a single "참가권 확인하기" action (no live data while OFF).
- When explicitly clicked and approved in the future, a POST verify request atomically reserves the hashed pass token in P7-D SQL, with a maximum 2-minute reservation.
- The source-only server independently revalidates payment at the PG on every verify/confirm; a customer redirect or stored claim alone is never financial truth.
- If verified and paid, the view displays ONLY pass kind, program title, Korea-local start date and confirmed state. It never shows buyer email, phone, payment card, merchant token, Zoom meeting URL or raw event access secret.
- "확인 완료" explicitly consumes the pass token. One-time links cannot be reused. The underlying attendee entitlement still remains in P7-B until refund/withdrawal; the email link is not the right itself.
- A link that is missing, expired, refunded or previously consumed returns a generic refusal. There is no fake ticket, user enrollment or successful payment page.

The browser script and CSS are new staged files in the Draft branch. The source release manifest has all approvals FALSE. No deployed backend or outgoing real mail is implied.

## 2. Resending: no email-address enumeration

The extra resend action is enabled ONLY if the purchaser already has the ORIGINAL same-browser guest proof from the checkout session. The server hashes that 256-bit proof and compares it with the immutable private order claim. Order ID, email address or URL parameters by themselves never authorize another email.

The server always replies to a syntactically valid resend attempt with the same generic HTTP 202 accepted response, regardless of purchase record existence, refund or proof mismatch. It does not reveal buyer contact, outstanding charge, attendee status or whether a message will actually be sent.

The private SQL queue serializes requests under the order row lock and enforces one job per request UUID, no duplicate pending job, a 15-minute cooldown and a maximum 3 requests in a rolling 24-hour period. Invalid proof or refunded/expired program slots cannot queue any mail.

Separately, a source-only delivery worker leases at most one resend job with a short expiry, prepares a new one-time hashed program token, rechecks paid/active entitlement immediately before mail dispatch, and asks a future SMTP/API adapter to send to the ORIGINAL stored buyer address. It never permits a buyer to specify another email recipient.

A refund cancels queued/leased resend jobs as part of the same provider-ledger transaction. An old lease cannot subsequently be marked sent. Delivery remains AT-LEAST-ONCE; production mail sender must accept a stable request-level idempotency key, because the worker may crash after a provider accepts the email but before its local ACK. Any late-delivered link must still fail redemption after a refund.

## 3. Exact code changes

- New customer staging assets: nal/commerce/pass/index.html; nal/assets/css/nal-commerce-pass.css; nal/assets/js/nal-commerce-pass.js; nal/data/commerce-pass.release.json.
- Private source-only HTTP: integration/nal-commerce-os/server/pass-claim-handler.mjs. Actions verify, confirm, resend. Defaults HTTP 503.
- Private source-only mail resend worker: integration/nal-commerce-os/server/pass-resend-worker.mjs. Defaults disabled.
- PROPOSAL_ONLY_pass_resend.sql: one private table, four private SQL functions, one refund trigger, no public grants or security definer.
- Test-only PostgreSQL fixtures, concurrency/rate-cap assertions, source lock, negative mutations, browser VM and server mock tests.
- Update P3 protected NAL snapshot to whitelist only the four new staged assets, leaving READ 88, storefront 130, Commerce Lite 6 and Admin 4 unchanged by SHA.
- Update P7-D delivery manifest from no-page to staged-no-server without enabling its email worker.

## 4. Isolation and security

All SQL is stored in the integration folder and refuses to execute except in explicitly approved disposable database nal_ci_ledger. No live Supabase migration, Edge entrypoint, storage file, owner membership or email connector is changed. All new tables use RLS and revoke anon/authenticated access, and SQL functions are SECURITY INVOKER and service-role-only.

Customers never see raw order/email information until a private token is validated. Even then only the minimal program summary is returned. The program seller and payment source remain server-verified. Neither the user metadata nor a static frontend release flag grants access.

The purchase confirmation workflow for paid reading/class still does not have a public program checkout UI or PG; program order preparation exists only on the backend source. P7-E confirms already-issued one-use links once full commerce service is approved in future.

## 5. Test scope and remaining blockers

The disposable postgres:16-alpine CI checks valid buyer hash, wrong-claim rejection, SQL idempotency, cooldown and day cap, retries, class refund cancelling a live resend lease, and 8-way parallel request and lease races. A separate mocked browser/HTTP test validates fragment wiping, off-mode no network, safe summary and generic resend. Actual provider/email delivery and actual buyer interface are intentionally NOT exercised.

Remaining: actual PG merchant account and payment server readback; P4-B2 real owner authentication; approved schema migration; reviewed secure customer pass Edge route; stable email provider idempotency; legal/privacy/refund disclosure; approved PDF editions and storage signer; finished program checkout UX; authorized pre-sale real checkout/refund/device QA.

The current verdict is SOURCE BUILD / ISOLATED VERIFICATION ONLY, not a live deployed program ticket service. Keep all real payments, email sends, reservations, owner grants and READ release OFF.
