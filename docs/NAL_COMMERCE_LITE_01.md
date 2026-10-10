# NAL COMMERCE LITE · Own the Store, Swap the PG

**2026-10-10 / WAVE C1 · Source construction in Draft branch only**

## Product decision

NAL controls products, presentation, customer experience, order/entitlement data and download delivery. A licensed payment service handles actual card/quickpay authorization and merchant settlement. Future PGs are replaceable adapters. No proprietary payment processing or direct handling of card numbers.

NAL user flow:
1. Select a paid digital product in NAL.
2. Enter email and confirm approved digital license/privacy/refund disclosures (no login).
3. Pay through a selected external PG/hosted checkout.
4. Only server-side verified provider payment plus an atomic paid guest ledger allows immediate signed download in the same browser.
5. Buyer receives a **one-time receipt link** by email (link token in URL fragment, not query), usable for a retry or a different device.

The customer sees an editorial three-step UI, not backend CRM/ERP terminology.

## Files created

| Scope | Source |
| --- | --- |
| Checkout page | nal/commerce/index.html |
| Verified payment landing | nal/commerce/complete/index.html |
| Email receipt redemption | nal/commerce/claim/index.html |
| New customer UI | nal/assets/js/nal-commerce-lite.js |
| Editorial CSS | nal/assets/css/nal-commerce-lite.css |
| Hard-OFF client release | nal/data/commerce-lite.release.json |
| Server-side API contract | integration/nal-commerce-lite/server/commerce-handler.mjs |
| One-time receipt generator | integration/nal-commerce-lite/server/receipt-link.mjs |
| Receipt queue worker contract | integration/nal-commerce-lite/server/receipt-outbox.mjs |
| Private PG-neutral guest ledger PROPOSAL | integration/nal-commerce-lite/PROPOSAL_ONLY_guest_ledger.sql |
| Review manifest | integration/nal-commerce-lite/release-review.json |
| Unit / guard sources | scripts/check-nal-commerce-lite.mjs and scripts/test-nal-commerce-lite-*.mjs |

**No file has been created under active supabase/functions for this new guest API.** The frontend is on a Draft-only GitHub branch and its release JSON defaults OFF. Even opening the draft checkout page must not create an order, collect/send email, start a payment or sign a file while OFF.

## Backend and security contracts

The API is a source-only injected handler with 4 POST actions: create, status, download, redeem.

- create: exact fields (action, productId, email, accepted:true, requestId:UUIDv4). The server checks a **published, active, digital, price+edition+policy reviewed** product through the private catalog port, snapshots the server-side price and edition and creates an opaque 256-bit checkout proof. No client amount, owner ID, role, bucket path or payment keys are accepted. Hosted checkout URLs must match the server's approved HTTPS payment-origin list.
- status: order UUID + same-tab claim proof. Look up order by SHA-256 digest. Server fetches authoritative payment from the selected provider, checks merchant/order/amount/currency/payment-key binding, then applies a transactionally checked state. A redirect is never proof of payment.
- download: same proof, payment must still be DONE with paid ledger; private delivery port rechecks revocation/paid status inside its signing transaction. Signed Storage link capped at 300 seconds, never exposing the private source path as raw file URL.
- redeem: one-time email URL fragment proof, hash and TTL checked atomically. Reservation/finalization guards multiple requests. The raw token is removed from browser history and never stored in a query, DB token column or log.
- outbox: only a server-confirmed paid order queues an email. Worker gets a fresh paid/nonrefunded order, mints a new one-time email link, stores only its digest and calls a separately provided email sender. Failure is retryable; no actual mail provider connected.

All source-only positive tests use fake adapters and fake orders; they do NOT imply an independently reviewed PG, email delivery service or deployment.

## Proposed private ledger (NOT applied)

The design-only SQL includes private guest orders, immutable price/version snapshots, authoritative provider events, receipt outbox, single-use receipt digests, signed download audit events and a refund-to-paid block. Access via service role only, RLS enabled, anon/authenticated direct grants revoked. The SQL deliberately raises before creating anything unless a separately approved session setting is present; the file **does not set that setting**.

Business decisions still needed: approved privacy policy and email retention, exact provider callback model, product edition/hash, data deletion schedule, approved refunds, idempotency/error recovery, exposed endpoint rate limits, email sender (free-tier feasibility), logged-in READ isolation, and payment commission.

## What we deliberately did not change

- No new custom PG merchant contract, no real payment, no fake completed payment.
- No Supabase migration, owner role grant, Edge deploy, Storage upload or service secrets.
- Existing free STARTER 3: 0 KRW direct final v7 PDF, no login.
- Existing paid AWARENESS 3: comingSoon, purchaseUrl NULL, no sales.
- READ and account/privacy operator code stays isolated and blocked for launch.
- Existing Toss-specific files remain disabled as archived implementation assets; no destructive rewrite.
- Pages production main unchanged. New checkout URLs are not linked to public product buttons.

## Next gates after selecting a PG

C2: Provider adapter implementation + provider-mode/merchant verification + payment callbacks; async verified webhook hints (no browser trust). Postgres atomic guest ledger/receipt/outbox in reviewed environment. No unauthorized SQL deployment.

C3: Email service with authenticated domain and anti-spam controls; actual private paid v7 files approved; return/download flow, cancellation and recovery. Paid-use legal disclosures and business details.

C4: **Sales immediately before launch:** authorized test payment, refund/cancellation, stale webhook replay, signed link revocation limit, real device/browser QA, then explicit release approval.

Until then, label **SOURCE READY / FINANCIAL RELEASE BLOCKED**. Do not mark real PG settlement, DB permissions, real Auth, email delivery or customer checkout as PASS.
