# NAL COMMERCE OS / P7-B · Unified Order + Seat Ledger

**Date: 2026-10-11 KST · SOURCE / ISOLATED POSTGRES ONLY**

This PR builds the next layer after COMMERCE LITE and COMMERCE ADMIN: a single-seller order system for PDFs, reading circles and classes. The actual NAL production database, free v7 PDFs, existing READ program, owner memberships and PG credentials are unchanged.

## Order and fulfillment model

| Kind | Price / stock | Server-confirmed payment delivers |
| --- | --- | --- |
| pdf | Approved private edition with frozen price and license | Private PDF entitlement flag |
| reading_circle | Published slot, registration open, 1 atomic seat | One attendee pass |
| class_session | Published slot, registration open, 1 atomic seat | One class booking pass |

Seven private tables: commerce_os_offers, commerce_os_slots, commerce_os_orders, commerce_os_order_lines, commerce_os_seat_reservations, commerce_os_fulfillments and commerce_os_provider_events. They preserve immutable accepted edition, unit price, currency, owner-neutral payment-provider order, idempotent UUID request ID, capacity and revoked status.

The SQL functions:
- commerce_os_begin_order: accepts server-verified offer data; serializes duplicate request IDs using an advisory transaction lock; row-locks the published slot to hold one place without overselling.
- commerce_os_apply_provider: consumes only a separately verified provider API payment projection; checks merchant/order/payment key/currency and immutable amount; atomically confirms a held seat or PDF access after DONE; revokes after CANCELED or PARTIAL_CANCELED; blocks stale DONE after refund. No browser can invoke it.
- commerce_os_expire_order: manually releases expired unpaid seat holds exactly once. No cron is installed.
- commerce_os_can_deliver: read-only service-only predicate, not Storage URL signing.
- commerce_os_protect_order: immutable order snapshot and irreversible refund/revocation trigger.

The future PG adapter must authenticate and normalize the real financial source. A boolean server_verified flag inside SQL is NOT independent proof of financial payment. Do not expose these service_role-only SQL functions to any client. No owner API access is created.

## Strict execution boundary

The proposal is saved ONLY under integration/nal-commerce-os/PROPOSAL_ONLY_unified_order_ledger.sql — not a Supabase migration. It starts a transaction and refuses to execute unless:
1. The database name is exactly nal_ci_ledger.
2. A session setting nal.commerce_os_ci_approval equals isolated, provided by the disposable test bootstrap.

The project Supabase database does not meet this gate. These files cannot be used to switch on payments or operate existing real orders.

## Real isolated PostgreSQL test plan

GitHub Actions job commerce-ledger-postgres creates a disposable postgres:16-alpine service for integration checks. Its tests:
- Install seven private tables and 5 functions in an entirely separate database with synthetic-only roles.
- Assert anonymous/authenticated users cannot directly read the private order ledger.
- Test immutable accepted prices and editions, duplicate order tokens, verified paid PDF fulfillment, full refund, repeated provider events, and blocked stale DONE.
- Test reading circle capacity one and class capacity two, refund seat release, expiry idempotency and late payment needing review.
- Race 12 independent orders for a single seat; exactly one may reserve it. Race 10 identical UUID retries for another seat; all must resolve the same order without duplicate seat holds.

Because this uses GitHub-hosted CI, workflow minutes may count against the repository's existing Actions allowance. No managed database or new paid service is provisioned. Any failed test will be repaired in the Draft branch and rerun.

## Explicit limitations

P7-B isolates new tables instead of changing the existing public.nal_orders, nal_sessions or READ checkout tables. There is no data migration, scheduled expiry service, published booking UI or customer authorization connected yet. Paid original PDF edition mapping, refund/support procedures, receipt email sender, service-role Edge security, verified merchant/webhook, P4-B2 owner Auth and legal disclosures remain unapproved.

A checkout quote alone never reserves real inventory. A reservation can block a seat until the explicit cleanup function runs. A payment arriving after TTL must NOT take a seat; it enters review_required. A refund must revoke both PDF access and participant rights without restoring them through late payment events.

**P7-B isolated DB PASS is not live readiness. No production writes, deploy, PG keys, owner grants or consumer sale have been authorized.**
