# READ payments — BUILD08 simplified scope, source only

This version supersedes BUILD07's in-NAL refund approval/execution UI. It has NOT been deployed or tested for sale.

## Customer flow
One NAL price/participation-notice agreement -> create/reuse held order -> standard card/easy-pay selector -> verified paid + ready enrollment -> direct shared TODAY entry. Existing NAL email authentication remains separate from any payment-provider account. No Toss registration/install prerequisite is added.
Launch uses method CARD, card.flowMode DEFAULT and card.useAppCardOnly false. It does not restrict cardCompany or select an easyPay provider. Enabled merchant methods appear in the provider UI; do not market a named wallet as already contracted.
The launch POST requires accepted=true, expectedAmount, policyVersion and notice. A reused order must match the agreed snapshot. Interrupted or mismatched older orders require explicit review; no automatic charge is started during a page view or a new login.

## Public GET
Returns enabled, checkoutEnabled, mode, methods, selection=DEFAULT and refundManagement=merchant-console. No private order data or credentials.

## Authenticated POST
User actions: create, get, list, launch, confirm, confirm-recover, refresh, refund-request (inquiry only), refund-withdraw.
Owner actions: admin-list and admin-refresh only.
refund-approve / refund-reject / refund-execute are rejected by the public action whitelist. Runtime hard-disables API cancellation, including reconciliation from webhook callbacks, regardless of a stale NAL_READ_REFUNDS_ENABLED value.
Actual cancellations and settlement are handled in https://app.tosspayments.com/ by the merchant. NAL keeps inquiries, verified provider-state reconciliation and related entitlement updates. A customer inquiry is not an approved or completed refund.

## Security and deployment boundary
Existing request-scoped Auth verification and DB ownership, product, amount, order, expiration, release and non-reactivation rules remain.
The privileged processor is still not a user-facing RPC action. Both read payment code paths pass refundsEnabled:false to the retained BUILD07 processor. Unused advanced SQL is retained for history, not activated or exposed.
Use the documented custom-auth setup for the mixed public GET/authenticated POST endpoint at eventual deployment. Do not change other functions' JWT settings. No gateway setting, key, merchant contract, callback, webhook registration, price or live feature flag is changed in this source task.
The new frontend and launch handler must be deployed together later; old launch requests without the agreed snapshot fields fail closed.

Detailed source scope and pre-sale limitations: docs/NAL_READ_BUILD08_SIMPLE_CHECKOUT.md
All tests, actual Auth/payment/refund exercises and UI verification remain deferred to pre-sale. No PASS claim, paid resource, actual transaction or hosted SQL change in BUILD08.
