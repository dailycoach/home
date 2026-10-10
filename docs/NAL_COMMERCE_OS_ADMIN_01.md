# NAL COMMERCE OS / P7-A — ORDER ENGINE + UNIFIED COMMERCE ADMIN

2026-10-10 KST · Development code only · Draft PR · No main merge or production deployment.

NAL follows a single-merchant sales model. PDF books, self-coaching reading circles, and classes use one order philosophy. Third-party host commissions or seller payouts remain OUT OF SCOPE.

## 1. Three common purchase kinds

| Order kind | Required publication / status | After verified provider DONE |
| --- | --- | --- |
| pdf | approved published paid private PDF and license | revocable private_pdf entitlement |
| reading_circle | published future reviewed host session, active deadline, available seat | one reading_pass |
| class_session | same seat and date gates | one class_pass |

The executable pure policy resides in integration/nal-commerce-os/order-engine.mjs. It checks server-authored price and PG minimum, immutable currency KRW, title/version/license, session deadline/capacity, approved host and published sale status. No client discount, quantity, price or role overrides. For paid programs, a quote alone never reserves seats: an independent future transactional database must lock the slot and confirm inventory before provider DONE can create a pass.

Verified provider settlement requires authoritative server lookup with exact order/provider order/merchant/amount/currency/payment key. DONE after refund or cancellation MUST NOT recreate downloads or attendance rights. Partial refunds suspend rights until resolved. Expired unpaid reservations may be released; all actual DB operations are deferred.

## 2. NAL COMMERCE ADMIN · six screens

New files in this PR:
- nal/commerce/admin/index.html
- nal/assets/js/nal-commerce-admin.js
- nal/assets/css/nal-commerce-admin.css
- nal/data/commerce-admin.release.json

Six menus: (1) 운영현황, (2) 마음도구, (3) 모임·클래스, (4) 참가·예약, (5) 주문·결제, (6) 파일 전달.

The typographic interface is premium editorial (deep navy + ivory), responsive to mobile. It does not show simulated revenue, sales, member totals, private file links or made-up orders. Every private panel starts HIDDEN and the admin release manifest stays OFF. The public route is noindex,nofollow,noarchive, no-referrer.

If approved in the future, the UI will read independently authenticated server projections. Catalog/session changes are limited to unpublished drafts with expected revision. Order detail shows masked customer email. No button permits actual payment capture, refund execution, owner grant, publication, provider payout or signing paid PDFs.

## 3. Independent secure server contract

integration/nal-commerce-os/admin-handler.mjs is an offline SOURCE-ONLY HTTP handler, not a deployed Edge function. It defaults OFF and needs all these server gates:
- enabled, ownerAuthReviewed, serverGateConfigured
- privacyNoticeApproved, writePermissionsReviewed
- deployed, productionApproved

Each request must be authenticated by server-only Supabase Auth, with fresh account status and existing owner role verified in the private database PER REQUEST. User metadata, email, CORS and a frontend release JSON are not acceptable authorization. All actions have strict allowlists, bounded JSON, exact draft payload fields and rate-limiting contract. Results are explicitly projected to avoid provider secret keys and unmasked email.

The NALCommerceAdminBridge requested by the browser is deliberately NOT installed. Owner Auth P4-B2 remains pending; this project does not change shared READ Auth code, add owners or introduce privileged database APIs. The backend is not deployed.

## 4. Persistent order/session ledger: next blocked milestone

Existing guest PDF order proposal references only product catalog rows. Do NOT make session bookings by pretending a session is a PDF product. The next independently reviewed implementation requires:
- immutable unified order line with one of pdf / reading_circle / class_session
- separately versioned, unpublished admin draft catalog
- private session slots, held/confirmed seat reservations with unique order+slot
- row-level atomic capacity hold, expiry, provider settlement, release and refund
- one seat per order in V1, idempotent event reconciliation
- owner audit trail and optimistic revision; no public table grants or browser service keys
- approved provider, seller/legal details and disclosure settings

No migration or public purchase switch is included in P7-A.

## 5. Checks and release conditions

Source guard: scripts/check-nal-commerce-os-admin.mjs.
Offline tests: scripts/test-nal-commerce-os-order.mjs; scripts/test-nal-commerce-admin-api.mjs; scripts/test-nal-commerce-admin-ui.mjs; scripts/test-nal-commerce-os-negative.mjs.
Existing P1 to P5 and Commerce Lite tests continue. P3 source manifest is extended for ONLY the four new Admin assets, while preserving SHA-verification of READ 88, storefront protected 130, previous Commerce Lite 6.

P7-A PASS is a statement of **source-only/synthetic test quality**, NOT live server authorization, real inventory, real bookings or merchant acceptance.

Before release: P4-B2 owner Auth approval, atomic DB/Edge integration, product/host/session review, final paid PDF version, provider agreement, email sender, legal notice, independent security review, and customer pre-sales real payment/refund/browser QA.

Until then NAL keeps the three free public PDF books and Commerce Lite purchase/PG/READ remains OFF. Draft branch cannot change main or production without explicit approval.
