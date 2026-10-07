# BUILD08 — simple participation, no Toss-app prerequisite

## Scope
Simplify checkout and operator money management. Continue source development on feat/nal-read-v1 under BUILD FIRST. No test runner, browser QA, hosted SQL, deployment, live provider call, price/terms/config mutation or paid resource creation. Commit with [skip ci]. No sale-ready/PASS claim.

## Customer flow
- Program detail: one primary 참여하기 CTA. Previous-purchase/invitation repair is a secondary expandable path, not part of a normal paid purchase.
- NAL email login remains necessary to own private records; it is not Toss registration.
- Checkout: program, authoritative price and notice, one unchecked NAL agreement, 결제하고 참여하기.
- On submit, create/reuse the order and immediately open the standard provider selector. Do not display the intermediate 내 주문 준비하기 step or demand the same agreement twice.
- Reused older orders with different amount/notice/version are displayed for deliberate re-review rather than silently charged. Reload/interrupted-payment recovery remains available without making a new order.
- The launch server independently compares the displayed amount, notice and notice version to the held order. Consent is not weakened by removing screens.
- Server-confirmed payment plus ready entitlement leads straight to shared TODAY through 첫 질문 시작하기. No manual order or entitlement selection in the normal path.
- Paid but delayed delivery stays paid/pending. Provide state refresh, not another payment button.
- Order details and cancellation inquiry are collapsed until requested. Free/invited participants continue through their existing guarded entitlement flow without a payment page.

## Payment selection and copy
SDK request: method CARD, card.flowMode DEFAULT, card.useAppCardOnly false, windowTarget self. No cardCompany restriction, named easyPay, DIRECT flow or BRANDPAY is forced.
Primary copy: 신용·체크카드로 결제할 수 있습니다. 토스 앱·토스 회원가입은 필요하지 않습니다.
Qualifiers: 간편결제는 결제창에 표시되는 수단 중 선택하세요. 카드사에 따라 앱이나 문자 등 인증 절차가 있을 수 있습니다.
Do not display named wallet buttons as if already contracted. Actual options depend on the merchant/provider configuration. No Toss app does not promise all card issuers authenticate without any app.

Official references consulted for implementation, not live checkout verification:
- https://docs.tosspayments.com/sdk/v2/js (CARD, DEFAULT, DIRECT, useAppCardOnly, redirect/self)
- https://docs.tosspayments.com/resources/glossary/card-payment
- https://docs.tosspayments.com/resources/glossary/dashboard (merchant console: https://app.tosspayments.com/)

## Money management
- Customer: order state and optional inquiry; inquiry is not completed refund.
- Owner: provider-order number, inquiry text, external merchant-console link, verified state re-sync and participant linkage.
- Remove in-NAL amount approval/rejection/execution forms and their Edge action names.
- Payment runtime passes refundsEnabled:false for both customer-triggered and webhook processing. A stale NAL_READ_REFUNDS_ENABLED flag cannot enable API cancellation.
- Actual refunds/cancellations and settlement happen in the merchant console. Keep current-provider verification and webhook/refreshed cancellation-state synchronization into NAL entitlements.
- Full/partial refunds remain distinct; partially refunded access requiring operator review is not silently restored.
- Existing inquiry notes remain history even after an external refund; do not assert that a specific inquiry caused a cancellation unless linked by evidence.

## Retained implementation
BUILD07 work/observation structures and unused advanced refund SQL/provider code are retained in source/history. No destructive migration removes them. They are not exposed through the active payment action whitelist or enabled runtime. This simplifies the customer journey and operator interface; it does not claim every backend table was removed.
Existing paid-order identity checks, non-reactivation, replay handling, server Auth, provider status verification and entitlement restrictions remain.
Existing free PDFs, PDF checkout/download handlers, Auth configuration, product prices and actual participant data are unchanged. No bank-transfer/payment-link alternative, wallet contract or fake paid-order path is introduced.
New frontend and launch server code must be deployed together at pre-sale; stale clients without agreed snapshot fields fail closed.

## Change record
14 existing files updated and this source note added. No SQL source or migration added in BUILD08. No hosted functions applied; no release flags touched. Keep historical tests and the pre-sale backlog; no tests executed.
The development cost restriction is not a claim that future merchant transaction fees are zero.

## Next product scope
Return to READ completeness: cohort dates, capacity/waiting list and participant management. Avoid expanding payment management beyond minimal purchase/entitlement/merchant-reconciliation needs without an actual operational requirement.
