# NAL COMMERCE OS P7-D — Unified Fulfillment and Delivery

2026-10-11 KST — SOURCE / DISPOSABLE POSTGRES / DRAFT ONLY

This stage connects the P7-B provider-neutral order/entitlement ledger to a common notification workflow for paid PDF tools, reading circles and classes. P7-D does not activate a payment provider, an email service, an operator role, a public program ticket page or any live booking.

## Business flow

Buyer purchases one NAL item, provider payment is independently verified, P7-B marks the immutable order paid and inserts an active fulfillment in the same database transaction. P7-D observes that fulfillment and queues ONE grant notification. A worker may lease the job, independently recheck that the order is still paid and unrevoked, prepare a one-time buyer token and ask an approved email provider to send confirmation. The email worker and provider are not connected.

If the order is later refunded or partly refunded, P7-B revokes the entitlement and frees program seating. P7-D atomically cancels undelivered grant messages, revokes outstanding pass claims and creates a refund-status notice. Its email does not claim that bank settlement or refund transfer completed.

| Kind | Rights recorded by P7-B | Proposed customer fulfillment |
| --- | --- | --- |
| private_pdf | private PDF entitlement for the purchased edition | Existing P7-C receipt token and short-lived signed Storage link |
| reading_pass | one confirmed seat | P7-D program claim token and private attendance view |
| class_pass | one confirmed seat | P7-D program claim token and private class booking view |

The actual consumer reading/class ticket page is NOT implemented in this PR. The program claim route is a future protocol only. Consequently the email and claim release gates remain OFF.

## Source files

- integration/nal-commerce-os/PROPOSAL_ONLY_delivery_engine.sql
  Two private tables: delivery_jobs and pass_claims; six private service-only functions and one fulfillment trigger. Unique order+event delivery jobs, two-minute row-locked leases, bounded retries, refund cancellation and hashed one-time program-pass tokens. The SQL checks database name nal_ci_ledger and requires session marker nal.commerce_os_ci_approval=isolated, which the source does not set.
- integration/nal-commerce-os/server/unified-delivery-worker.mjs
  Offline dependency-injected dispatcher. Defaults OFF and needs separately approved owner/security, email sender, domain authentication, buyer privacy, PDF receipt and program pass page. Rechecks the entitlement after preparing a link and before sending, and uses a stable idempotency key.
- integration/nal-commerce-os/server/delivery-links.mjs
  Random 256-bit email bearer tokens in URL fragments; only SHA-256 digest stored by the private SQL port. Supports existing private PDF claim and planned class/reading claim path. No real token email is sent.
- integration/nal-commerce-os/tests/05_delivery_assertions.sql, tests/06_delivery_race_fixtures.sql and scripts/test-nal-commerce-os-delivery-races.mjs
  Disposable PostgreSQL integration and concurrency tests. No connection to production Supabase.
- scripts/test-nal-commerce-os-delivery-worker.mjs and scripts/check-nal-commerce-os-delivery.mjs
  Synthetic email/worker and source locks that disallow accidental release.

## Important guarantees and limitations

1. P7-B settlement creates/revokes the entitlement. Email is merely a notification, not a financial authorization or attendance grant.
2. Exactly one pending delivery job is created per order and event kind, but external email is inherently AT-LEAST-ONCE. A provider can accept a message before a worker crashes, so an eventual real email provider MUST honor a stable idempotency key or duplicates remain possible.
3. Orders are locked before notification job rows, preventing duplicate leases and following settlement lock order. A lease cannot be marked sent after the order is refunded. An external refund may still race the actual send; the claim endpoint must recheck entitlement at redemption.
4. Previously issued PDF signed URLs cannot be recalled before their expiry; P7-C caps new links to 300 seconds, and a refund prevents new URLs.
5. Program pass tokens contain no meeting URL or exposed attendee PII. Token-only redemption is planned for a future verified customer route, and requires active paid status and valid session.
6. The earlier P7-C PDF receipt outbox remains stored for compatibility and must NOT have its mail worker running at the same time as the P7-D unified notification worker. Both are OFF here.
7. Source SQL is not an approved live migration. The current connected Supabase project, READ, stored files, legal notices, provider configuration and all active NAL sales flags remain untouched.

## Isolated verification

The GitHub Actions postgres:16-alpine job installs the new private objects AFTER P7-B/P7-C synthetic verification, then runs actual Postgres tests: PDF delivery retry and send-once, reading pass claim single use, class refund during an in-flight notice, post-refund invalidation, eight simultaneous worker leases and eight simultaneous pass claims.

The existing Node CI also exercises all three kinds and fail-closed release flags without sending any real email.

## Remaining production gates

Choose and approve PG contract; finish P4-B2 owner Auth; review and apply a real, versioned DB migration; implement a verified private PDF signer and correct PDF version mapping; choose mail provider and verify sending-domain idempotency; implement actual consumer program claim UI/API; approve privacy/refund/operator disclosures; run test card purchases and refunds immediately before sales.

Verdict: P7-D is isolated architecture and safety verification ONLY. No real money, email, private file, class pass or operator permission can be issued from this Draft branch.
