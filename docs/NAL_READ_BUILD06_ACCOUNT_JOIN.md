# NAL BUILD06 — common MY NAL and READ participation connection

## Status
Implementation source only. Owner directed build-first; tests, browser QA and deployment checks are deferred to the pre-sale phase. No PASS claim. No hosted DB write, Edge deployment, release activation, actual email/payment or new paid resource in this build. Commit with [skip ci].

## Participant surfaces
- `/nal/my/`: account-owned READ programs, purchased file entitlements, existing GATHER/CLASS registrations, saved report edition metadata, order history, display-name preference.
- `/nal/my/local/`: exact preserved previous MY NAL source, keeping existing origin-local wishlist/recent storage separate from account-owned records. This is not automatic account synchronization.
- `/nal/shop/read/?season=<slug>`: configured public-safe offer summary; omit season for listing. No approved offer is invented/seeded. Existing PDF product JSON is unchanged.
- `/nal/read/join/?season=<slug>`: verify participation options, choose a matching paid order or a configured free/pregranted invitation path, explicitly accept versioned participation terms, bind enrollment, show welcome and resume TODAY.
- `/nal/read/open/?season=<slug>&view=<view>`: reusable participant entry for before/today/journey/day/try/live/my/report. Day and step query parameters are retained. Reuses BUILD04/05 engines rather than duplicating a full set of per-season HTML files.
- `/nal/auth/callback/`: common-account callback with restricted same-origin return paths. Existing READ callback remains unchanged.
- `/nal/read/admin/offers/`: owner-only offer editor, using existing catalog products/prices and existing READ seasons. Links, participation mode, notice/version, registration window and access duration; revision conflicts stop overwriting.

## Exact fulfillment scope
### Implemented now
- Paid: connect an ALREADY VERIFIED owned order with a paid ledger entry and the configured READ catalog product to the existing enrollment core. Retains refusal to revive revoked/expired/paused access.
- Free: only a configured accepting free offer and an authoritative catalog price of zero can grant a promotional entitlement. No fake paid order is created.
- Invitation: uses a pregranted, active manual/promotion entitlement for the verified account and exact season. No public unlock code, no grant from email spelling.
- Terms: explicit acceptance, exact policy version and text snapshot, request identity and receipt.
- Onboarding: idempotent welcome acknowledgement, then the shared participant engine.
- No registration/grant side effect during account page reads.

### Intentionally not implemented in this build
New paid READ order creation, a dedicated Toss checkout/confirmation UI, webhook/refund reconciliation for those new READ payments, capacity reservation, coupons and member-account synchronization of local wishlist.
Do NOT send READ purchasers to the current PDF-only checkout: its private-file eligibility and file fulfillment are not READ fulfillment. UI explicitly says new paid READ checkout is still being built; it does not promise a working pay button.
Existing purchased PDF downloads call the existing authenticated, signed-link delivery endpoint on explicit user action only. Free starter files remain at their original public STORE paths.

## Backend source
`docs/NAL_READ_BUILD06_JOIN.sql`
- Adds private `read_offers`, `read_join_receipts`, `read_onboarding`.
- Public-safe catalog projection RPC `nal_read_offers` is service-only; the account Edge exposes only its constrained result via GET.
- `nal_read_join` retains verified identity + existing release/user/season/time-bound test gate.
- `nal_read_offer_admin` requires verified existing owner role and READ OFF for editing. Does not change catalog prices, payment settings or release switches. Terms/product changes on enrolled cohorts require a new cohort.

`docs/NAL_READ_BUILD06_ACCOUNT.sql`
- Adds private `account_preferences`.
- `nal_account` returns only authenticated caller-owned records. Private answers are not included in order/file/report metadata lists.
- READ record actions remain behind the original program access gate. Account file/order history is not incorrectly blocked merely because READ is OFF.

`supabase/functions/nal-account/`
- A separate default-off `NAL_ACCOUNT_ENABLED` switch.
- GET only exposes validated offers; every POST verifies the actual Auth user using the existing request-scoped boundary before it invokes an allowlisted RPC.
- Existing shared Auth helper adds only three RPC names: nal_account, nal_read_join, nal_read_offer_admin.
- Rate/body limits and safe errors; no secret keys in browser files; no READ activation or new rights from client-provided identity.

## Dependency / release preparation order (not executed now)
1. Existing recorded FIX03 chain.
2. BUILD04_WORKSPACE source.
3. BUILD05_EDITORIAL then BUILD05_REPORT sources.
4. BUILD06_JOIN then BUILD06_ACCOUNT sources.
5. Package and deploy matching workspace/report/editorial/account source and shared Auth helper at release preparation, not now.
6. Configure callback allowlist and account feature flag deliberately; configure offers from actual catalog and approved notices. Do not infer free-tier billing availability or create resources.
7. Preserve READ OFF and empty permits unless explicitly entering a scoped release exercise.

## Changes outside new files
- `nal/my/index.html` becomes the shared account hub; its exact old source is preserved at `/nal/my/local/`.
- `nal/assets/js/read-shell.js` adds the common MY NAL return link.
- `_shared/nal-read-auth.mjs` adds the account/join/offer-admin RPC allowlist entries.
No existing STORE catalog, PDF download, checkout handler, payment reconciliation, public product or free-PDF file is changed.

## Build continuation
BUILD07: dedicated paid READ checkout and durable payment/refund fulfillment, with explicit order/product/season bindings. Continue product development; consolidate actual Auth/payment/mobile/accessibility/security regressions only at pre-sale.
