# NAL Toss Payments V1

## Scope

Provider-specific payment adapter for paid NAL PDF products.

The storefront/catalog work is intentionally separated in PR #156. This branch
contains only payment, reconciliation and private digital-delivery foundations.

## Runtime flow

1. Verified user requests a product order.
2. Server reads the published catalog price; client price is never trusted.
3. Order + one order item are created idempotently from a UUID request ID.
4. Toss Payments SDK authenticates the payment in the browser.
5. `nal-toss-checkout` validates the stored order amount and calls
   `POST /v1/payments/confirm` with the Toss secret key.
6. Only a verified `DONE` Payment object is reconciled as paid.
7. A matching active private product file is required before checkout and again
   before entitlement creation.
8. Paid order + payment ledger + entitlement are reconciled server-side.
9. `nal-digital-download` issues a short-lived signed URL after ownership,
   paid status, entitlement, file, expiry and download-limit checks.
10. `nal-toss-webhook` never trusts webhook status directly. It re-fetches the
    Payment object from Toss Payments using the secret key, then reconciles.

## Security

- Paid PDF originals are not committed to GitHub.
- Bucket: `nal-products-private`, private, PDF only, max 100 MiB.
- Public/anon/authenticated cannot execute product-order or reconciliation RPCs.
- Checkout request ledger is private-schema/service-role only.
- Toss secret key remains Edge Function server environment only.
- Checkout Edge Function requires Supabase JWT.
- Webhook has `verify_jwt=false` only because Toss cannot send a Supabase JWT;
  it is POST-only and validates state by server-to-server Toss API lookup.
- `NAL_TOSS_PAYMENTS_ENABLED=true` plus valid client/secret keys are required
  before either payment function becomes operational.

## Hosted state

Applied migrations:
- `20261004002631_nal_digital_store_foundation`
- `20261004002706_nal_digital_store_index_hardening`
- `20261004003752_nal_toss_payment_foundation`
- `20261004003859_nal_toss_payment_index_hardening`

Deployed Edge Functions:
- `nal-digital-download` · JWT required
- `nal-toss-checkout` · JWT required
- `nal-toss-webhook` · custom Toss server verification

The payment feature has not been enabled and no merchant key was added by this
run.

## Required before sales open

- Toss Payments merchant/test client key and matching secret key.
- Register `PAYMENT_STATUS_CHANGED` webhook URL in Toss Developer Center.
- Configure allowed production origin and success/fail URLs.
- Upload each paid v4.1 original to `nal-products-private` through Storage API
  or Supabase Dashboard.
- Register active file rows only after the objects physically exist.
- Merge/deploy PR #156 and synchronize the three products to the public catalog.
- Set paid products to `available` and a checkout purchase URL only after end-
  to-end test payment succeeds.
- Enable `NAL_TOSS_PAYMENTS_ENABLED=true` last.

## QA

`node scripts/test-nal-toss-payments.mjs` validates:
- disabled feature gate
- origin rejection
- verified-login requirement
- server-created order amount
- client amount tampering rejection
- verified Toss confirmation
- payment object mismatch rejection
- webhook event re-fetch
- cancellation reconciliation

GitHub Actions workflow: `NAL Toss payments CI`.
