# READ payments — source only, NOT deployed

## Event ownership
- Browser identity: verified by the existing request-scoped Auth boundary.
- Amount/product/season/notice: server catalog and immutable READ checkout snapshot.
- Payment/refund state: server lookup using matching Toss secret/MID/mode.
- Financial mutation: new checkout requires explicit participant agreement; refund execution requires an existing owner-approved, amount-confirmed request.

## Public GET
Returns only enabled, checkoutEnabled, mode and methods. No order, token, secret or participant data.

## Authenticated POST
JSON `{ action, payload }`.
User: create, get, list, launch, confirm, confirm-recover, refresh, refund-request, refund-withdraw.
Owner: admin-list, admin-refresh, refund-approve, refund-reject, refund-execute.
Unknown actions are rejected. User ids, prices, MID/mode or approval identities from the browser are not trusted.

## Deployment preparation later
This mixed public GET / custom-auth POST endpoint needs gateway `verify_jwt=false` only after reviewing its existing custom POST authentication path. The webhook endpoint also has no user JWT; it uses a fixed upstream provider lookup and local order binding. Do not change original READ/private function authentication settings.

Load BUILD07 SQL sources after BUILD04/05/06 in documented order and package all relative shared dependencies. Everything remains default-off. Do not use `supabase db push` or enable payment flags as part of this feature-writing task.

Provider retries and explicit user/owner requests process durable pending order work. There is no scheduler, task or paid queue service created by this implementation. Failed or unknown states remain visible rather than marked successful.

All functional, financial, auth and UI validation is deferred to the owner-requested pre-sale phase. No tests were run and no PASS claim is made.
