# NAL-STABILIZATION-05 — TOSS PAYMENT & DIGITAL DELIVERY READINESS

2026-10-10 KST | P5 audit and synthetic tests only | PRODUCTION UNCHANGED

Repository dailycoach/home; stacked after P4-B1 Draft PR #171. The main website and actual Supabase merchant/payment settings are unchanged.

## Architecture

FREE STARTER 01/02/03: 0 KRW → public final v7 PDF; no login and no checkout.

Paid AWARENESS (currently comingSoon): catalog → verified buyer → server-created order → Toss widget → server confirm API → verified payment and order reconciliation → private entitlement → signed private PDF URL (maximum 600 seconds).

PAYMENT_STATUS_CHANGED: webhook input is treated as a hint, not proof; the product webhook re-fetches current Toss Payment with a server-side merchant key and reconciles it in the order/payment ledger.

NAL READ payments are separate. The READ provider order uses a distinct identifier, separate feature flags, and a merchant-console refund flow. READ remains OFF.

## Read-only production inventory

| Concern | Verified state |
| --- | --- |
| Free STARTER | 3 public final v7 PDF editions, price zero |
| Paid AWARENESS | 100 / 1,000 / 10,000 KRW, comingSoon, purchaseUrl NULL |
| Private Storage | nal-products-private, private PDF-only bucket, 100 MiB max |
| Private file objects | 3 active mappings, all PDF objects present |
| Actual active original versions | v4.2 / v4.2 / v4.2, not proposed v7 |
| Orders / payment records / paid entitlements / download events | 0 / 0 / 0 / 0 |
| READ checkout orders / refunds | 0 / 0 |
| Site storePurchase / checkout / secureDownload / account | all false |
| Toss checkout Edge / webhook Edge / paid download Edge | deployed, version 1; not evidence of actual merchant readiness |
| Merchant keys and webhook registration | NOT independently verified |
| Approved operator details and digital refund policy | incomplete |

The audit does not read or reveal merchant secrets or private file object paths and does not trigger a financial action.

## P5-01: critical settlement consistency blocker

Current installed public.nal_reconcile_toss_payment has a DONE branch that updates the order back to paid and upserts an entitlement with revoked_at = null. It does not reject DONE when the same order is already refunded, refund_requested, cancelled, or has a revoked entitlement.

A stale/out-of-order provider status observation could therefore restore an entitlement after an earlier cancellation. Locking the order row serializes writes but does not itself prohibit a logically invalid transition. The webhook's server-side Toss lookup makes forged statuses harder, but cannot substitute for monotonic local transitions.

The proposed future fix lives ONLY in integration/nal-stabilization-05/PROPOSAL_ONLY_reconcile_terminal_guard.sql, outside active migrations. It adds a terminal/revoked order guard before DONE writes. It requires all of:
- explicit session-local review approval not set in the file;
- exact audited definition MD5 3b6b1771d9fc356bf424456d47a8f6cf;
- zero existing production orders/payments/entitlements;
- checkout OFF and no live data to migrate.

IT HAS NOT BEEN EXECUTED, MIGRATED, REVIEWED FOR PRODUCTION OR TESTED ON POSTGRESQL. JS transition simulations are not a substitute for DB concurrency/integration tests.

## Remaining blockers

P5-02: Original edition and catalog consistency. The active private files are v4.2. The proposed AWARENESS v7 publishing system is a separate unmerged PR #162. Before sale, approve the final originals, actual page counts, covers, copyright/licensing, file hashes and updated private Storage mapping. Do not replace v4.2 blindly.

P5-03: Merchant readiness. Validate Toss test/live mode, client and server keys, merchant registration, settlement and receipts, success/fail callback, PAYMENT_STATUS_CHANGED webhook registration, provider API errors, retries and real end-to-end TEST-mode payment and cancellation immediately before sale. These checks have NOT occurred here.

P5-04: Webhook authenticity, rate limits, idempotency and event races. Toss documentation limits the tosspayments-webhook-signature header to payout.changed/seller.changed; PAYMENT_STATUS_CHANGED does not advertise this signature. The product webhook must keep re-fetching authoritative provider payment, and independently review request quotas, payment-key reuse, out-of-order cancellation events and duplicate entitlement issuance. Do NOT invent a nonexistent payment-webhook HMAC contract.

P5-05: Already issued signed links can remain usable until they expire, even after refund. Existing server limits signature lifetime to 600 seconds and denies new downloads on revoked/failed access, but this does not instantly invalidate a previously signed URL. Refund disclosures and support procedures must account for it.

P5-06: The installed reconciliation function verifies the CURRENT catalog product price, not solely an immutable captured order/product version. Price or publication changes between payment authorization and fulfillment can cause a charged order to remain without an entitlement. Review immutable snapshots and a support recovery path.

## Tests in this draft PR

- scripts/check-nal-payment-release-lock.mjs: paid/READ gates remain OFF; free versions preserved; private download and webhook require server enablement; open blockers remain visible.
- scripts/test-nal-payment-release-negative.mjs: 17 injected bad changes must trigger CI failure, then files are restored.
- integration/nal-stabilization-05/payment-transition-model.mjs and scripts/test-nal-payment-transition.mjs: pure offline state and refund-replay model.
- integration/nal-stabilization-05/audit-readonly.sql: SELECT-only inventory; no payment RPC calls or secrets.
- integration/nal-stabilization-05/PROPOSAL_ONLY_reconcile_terminal_guard.sql: review proposal only, never run by CI.

Existing main payment/auth/SQL/Storage files and production data are unchanged by this work.

## Approval sequence

P5-A synthetic and static checks → P5-B independent payment-security/SQL review and isolated PostgreSQL tests → P5-C final edition and merchant key setup, approved legal disclosures and authorized real test-mode checkout/refund/download near the customer launch.

Do not merge P5/READ Draft PRs to main or enable checkout while P4-B2 and P5-B/C are unresolved.

Official references:
- https://docs.tosspayments.com/guides/v2/get-started/payment-flow
- https://docs.tosspayments.com/guides/v2/webhook
- https://docs.tosspayments.com/reference/using-api/webhook-events
- https://supabase.com/docs/guides/storage/serving/downloads
