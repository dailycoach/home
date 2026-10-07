# NAL BUILD07 — dedicated READ checkout and payment recovery

## Delivery boundary
Implementation source on feat/nal-read-v1 only. Owner-directed BUILD FIRST remains active: no test runner, browser QA, real Auth/payment call, webhook registration, hosted SQL execution, secret change, deployment or main merge in this build. Use [skip ci]. Do not call source-complete features sale-ready or tested.

## Participant flow implemented
1. /nal/shop/read/?season=<slug> shows a dedicated payment entry only when the configured paid offer is accepting and the payment service advertises checkoutEnabled.
2. /nal/read/checkout/?season=<slug> loads authoritative offer and notice, requires agreement, requests a server-created order, then shows the held price/notice snapshot before opening the Toss CARD/간편결제 SDK.
3. The server creates nal_orders + nal_order_items with a separate READ checkout binding. Prices, title, season, product and participation notice are snapshotted. User input is an expected-price check, never the price authority. An unresolved order for the same user/season is reused; already enrolled users are not sold another copy.
4. The gateway order namespace is nr_<random32>. The local order remains UUID for MY NAL. The browser return page is not a payment receipt.
5. /nal/read/checkout/success/ captures the provider return in memory and strips paymentKey/amount from the address before remote SDK loading. Server-side binding checks and a fresh provider lookup precede/confirm approval. Missing session can recover from the original order after login; never place paymentKey in a magic-link return URL.
6. /nal/read/checkout/fail/ does not mark the order refunded or failed based on a URL message. It shows the owned order and offers status refresh.
7. A verified DONE payment updates the ledger and independently attempts participant entitlement delivery. A delivery problem remains paid + delivery pending; no duplicate payment is requested. Paid terms/access duration come from the original order snapshot, not later catalog edits.
8. /nal/my/payments/ lists owned READ orders, payment state, delivery state, partial/full refunded amount, request history and safe follow-up actions. Common MY NAL navigation links here.
9. An explicit recovery action can continue an already authenticated IN_PROGRESS payment only after the original owned order, amount and current verified provider record are loaded. Ordinary refresh alone does not authorize a new charge.

## Refund UI and authorization
- A participant submits a reason; request creation is NOT refund completion and does not automatically change paid access.
- The existing verified owner reviews amount and explanation. Approval records a decision but does not call the payment provider.
- A separate amount-confirmed owner execution queues the same approved refund request with a stable provider idempotency key.
- /nal/read/admin/payments/ shows attention items, participant delivery retry, refund approval/rejection and separate execution.
- Provider cancellation is reconciled to the original order/key/MID/currency/amount. A refund is attributed to its request only when the corresponding verified cancellation transaction key and amount are present.
- Full refunds block the related entitlement and mark the enrollment refunded. Partial refunds show the real refunded amount and pause delivery for owner review, not an invented full refund.
- Ambiguous older attempts or externally changed cancellation totals go to manual review instead of risking an additional cancellation. No unreviewed automatic access restoration.
- No legal refund percentage, deadline or forfeiture rule has been invented. Actual notice/version must be entered by the operator before sale.

## Durable reconciliation, without a new service subscription
Five private tables are added in source: read_checkout_orders, read_payment_work, read_payment_observations, read_payment_refunds and read_payment_decisions.
- One coalesced work record per order; leased work prevents simultaneous processing.
- Database locking follows user/season -> order ordering, consistent with enrollment creation.
- Provider event payloads are treated only as refresh signals for server-created READ orders.
- The dedicated webhook retrieves the current payment from the fixed official provider endpoint; it never accepts hinted status/amount as financial authority.
- A database failure leaves pending work; a payment recorded successfully but with failed entitlement delivery remains recoverable.
- Refund totals never move backwards and an older pending status cannot replace a settled/refunded order.
- Retry is driven by the provider's webhook resend or explicit customer/owner refresh. NO cron, background task or paid worker is created. This source does not claim an always-running worker exists.
- Payment observations store a small financial projection, not card numbers, account details, customer identity, coaching answers or complete webhook payloads.

## Existing PDF commerce boundary
PDF checkout, free starter PDF assets, file entitlement delivery, catalog JSON and product prices remain unchanged.
One existing file, supabase/functions/nal-toss-webhook/handler.mjs, gets a narrow guard AFTER its existing provider verification: ignore the verified nr_ READ order namespace. This prevents READ payment identifiers reaching the old UUID/PDF reconciliation path. All existing PDF logic remains below that guard.
Both webhook routes must be configured deliberately at pre-sale. Do not remove the existing PDF webhook when adding the READ receiver.

## Source and runtime components
- SQL source order: NAL_READ_BUILD07_PAYMENTS.sql -> NAL_READ_BUILD07_RECONCILIATION.sql -> NAL_READ_BUILD07_INTEGRATION.sql.
- Existing prerequisites: recorded FIX03 chain, BUILD04_WORKSPACE, BUILD05_EDITORIAL/REPORT, BUILD06_JOIN/ACCOUNT.
- nal-read-payments: authenticated user/owner actions and public safe configuration GET; custom POST Auth verification required. At eventual deployment use the documented custom-auth gateway mode for this endpoint; do not blindly copy other functions' verify_jwt setting.
- nal-read-payments-webhook: external provider receiver, no user JWT expected. All financially meaningful state comes from a new authenticated provider lookup, never event assertions.
- Existing FIX03 Auth boundary allowlist adds only nal_read_payment_user and nal_read_payment_admin. The privileged processor RPC is deliberately NOT added to the user-facing allowlist.
- Processor RPC and private tables are not granted to anon/authenticated browser roles.
- No automatic main merge or feature switch activation. READ's existing OFF/test-only scope remains; normal customer sales still require the explicit final rollout work.

## Default-off environment configuration (not set during this build)
NAL_READ_PAYMENTS_ENABLED=false
NAL_READ_CHECKOUT_ENABLED=false
NAL_READ_REFUNDS_ENABLED=false
NAL_READ_WEBHOOK_ENABLED=false
NAL_READ_TOSS_MODE=test
NAL_READ_TOSS_CLIENT_KEY=<operator-provided API individual-integration client key>
NAL_READ_TOSS_SECRET_KEY=<server-only matching secret key>
NAL_READ_TOSS_MID=<matching merchant identifier>
NAL_READ_ENABLED=<existing guarded program flag, unchanged>
NAL_ALLOWED_ORIGINS=<existing exact origin list, unchanged>

Do not put the secret key in frontend backend.json. A client key is returned only for an owned, launchable order. Test/live prefixes must match. No keys, merchant IDs or passwords are fabricated in source. No billable provider calls were made. Commercial provider fees are not represented as zero; this build only avoids new infrastructure purchases and live transactions.

## API references used for implementation
- https://docs.tosspayments.com/reference : payment confirm, order lookup, cancellation, balance and transaction identity.
- https://docs.tosspayments.com/sdk/v2/js : individual-integration payment().requestPayment(), CARD redirect flow and random customerKey.
- https://docs.tosspayments.com/reference/using-api/authorization : stable Idempotency-Key and its retention window. Source limits uncertain retries to 14 days.
- https://docs.tosspayments.com/reference/using-api/webhook-events : PAYMENT_STATUS_CHANGED refresh signals; do not assume the payout-only webhook signature applies to domestic payment events.
- https://supabase.com/docs/guides/functions/auth : custom function authentication and service-role boundary.
References guide code design; no live tests were run.

## Deliberately outside BUILD07
Virtual accounts, bank-transfer refund-account collection, international/asynchronous payment methods, recurring billing, coupons, capacity reservation, automated customer emails and normal-customer release activation. Initial dedicated checkout exposes CARD/간편결제 only. Partial-refund entitlement policy is conservative manual review, not automatic reinstatement.

## Next product implementation
Cohort dates, capacity and waiting list, registration closure and operator participant view; then polish first-season sales content and operational copy. Continue building rather than rerunning the historical QA backlog after every commit. Before first customer sale, validate the combined auth, payment, approval, webhook/retry, refund, account and mobile flows and reconcile historical platform findings.
