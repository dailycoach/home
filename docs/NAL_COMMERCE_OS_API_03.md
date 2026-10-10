# NAL COMMERCE OS P7-C · Guest HTTP API → Unified Private Ledger

Date: 2026-10-11 KST. SOURCE + DISPOSABLE POSTGRES TESTS ONLY. NO MERGE OR PRODUCTION DEPLOYMENT.

P7-C connects the earlier P6 guest PDF purchase HTTP handler to the P7-B provider-neutral Postgres order/seat ledger. PG selection remains open. Customer-facing paid features remain off.

## 1. Implemented source

- The earlier Commerce Lite HTTP handler now accepts an optional server-only buyer proof issuer without altering its default offline behavior.
- Server order issuer: HMAC-SHA256, 256-bit secret, separate domains for buyer claim and provider order ID. Identical request UUID, verified email, product/session and merchant produce identical buyer proof to make request retries safe. The secret never reaches browser code or logs.
- Unified guest bridge: maps catalog and order methods to private Postgres procedures; checks immutable provider/product/amount/edition snapshots, verified server-side payment event IDs, refund state and signed PDF authorization. Future reading-circle/class server-only order preparation shares the same ledger and atomic seat reservation.
- Composition root: default 503 with no database interaction until all required security and commerce flags are explicitly approved. There is no deployed Edge function.
- Additional private SQL proposal adds two tables (receipt outbox, one-time email claim digests) and six private functions: read order by claim, enqueue email, mint receipt digest, reserve/redeem, validate one-time receipt download.
- Existing purchase confirmation / private PDF file URL requires current paid entitlement and refund recheck after signing; signed URL TTL capped at 300 seconds, actual Storage signer remains unconnected.

## 2. Intended future customer flow

PDF selection → email and approved policy acknowledgement → server-HMAC idempotent claim → private Postgres order with frozen price/version → PG-hosted checkout → server provider lookup → private Postgres settlement and receipt outbox → 300-second signed PDF.

Paid confirmation could additionally email a one-time link: the secret token lives in the URL fragment and is removed from browser history, only SHA-256 stored in the private ledger; an atomic reservation allows one redemption. The transactional email sender is NOT wired.

A browser success redirect is NOT payment proof. A boolean server_verified marker inside SQL is NOT cryptographic proof. A separately audited PG server adapter must retrieve and validate live provider data before recording a payment; no such provider is selected or connected.

## 3. Isolation and actual tests

All new SQL remains under integration/nal-commerce-os, outside deployable Supabase migrations and functions. It executes only on a disposable PostgreSQL 16 CI service whose DB is specifically named nal_ci_ledger, with an independently set isolated approval marker. No production SQL or server write requests are used.

Test plan covers P7-B existing seat/price/refund races, new private buyer proof lookup, outbox and one-time email reservations, eight simultaneous receipt claims and an actual Commerce Lite HTTP handler wired through a parameterized psql **test-only** adapter to the isolated database with fake PG and fake signed Storage URLs.

Mock PG success and mock Storage links are not real card settlement or file delivery. A real private database driver, persistent email sender, audited Storage signer, owner Auth P4-B2, legal disclosures, final paid edition mapping and live test sale/refund/browser QA remain blocked.

The receipt outbox has no deployed mail sender and no live cron. Program customer-facing checkout remains disconnected; only private server preparation is implemented. Real website sales, READ enrollment and Admin owner role remain OFF.

## 4. Compatibility and next gate

Preserve all three free v7 starter PDFs, protected READ files and NAL assets, earlier Draft PRs, actual Supabase rows and published main. New guest API sources are not imported by any deployed Edge entrypoint.

P7-C is SOURCE + ISOLATED DB INTEGRATION, not a fully functioning production checkout. The next work is a provider-neutral production-readiness review (security, approved data retention, server PG lookup, file signer, email provider, operational rollback), with real provider connection deferred until selected and explicitly authorized.
