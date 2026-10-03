# NAL Supabase bootstrap

Target: **new, dedicated** `nal-platform` project, organization
`udzaugmtleotbeomjvar`, Seoul (`ap-northeast-2`), standard PostgreSQL.
Never apply this migration to `rs-career-erp-dev`.

The remote project has **not been created**. Supabase MCP project listing works,
but `get_cost` returns `UNAVAILABLE` (not returned by tools/list). No price or
successful creation is inferred from the existing ERP connection.

## Provisioning order

1. Create the dedicated project after checking the actual plan/cost.
2. Record its real project ref; verify name, organization and Seoul region.
3. Apply `migrations/*_nal_platform_foundation.sql` to that project.
4. Generate catalog seed with `node scripts/prepare-nal-supabase-seed.mjs`
   and execute the resulting SQL with a trusted database connection / MCP.
   Repeating the default seed preserves existing database records.
5. Run security/performance advisors and remote RLS/reservation tests.
6. Grant the verified operator's `auth.users.id` membership in
   `nal_private.admins` using a trusted connection. Never infer admin rights from
   user-editable metadata or email submitted by a browser.
7. Configure Auth site URL, allowed redirects, email delivery, Storage policies,
   and the frontend's **publishable** key only after the real ref exists.

No service-role key, database password, access token, applicant, order or payment
payload belongs in this public repository or its public JSON snapshots.

## Implemented foundation

- Public catalog/settings; drafts remain hidden by RLS.
- Auth-linked profiles, wishlist and host follows with ownership policies.
- Program sessions, row-locking reservation/cancellation RPCs, waitlisting,
  idempotency, 15-minute paid reservation holds and expiration on reservation.
- Protected registration/order/payment ledgers and consent records.
- Private operator memberships and audit records. Catalog history stores before/
  after values; personal transaction audit stores identifiers only.
- Existing JSON import preserving ids, URLs, images and unpublished status.

RPC contracts:

```text
nal_register(p_session_id uuid, p_request_id uuid) -> registration uuid
nal_cancel_registration(p_registration_id uuid) -> registration uuid
```

Both require a signed-in, email-confirmed account. Participants cannot directly
write registrations, orders or payments. `nal_register` snapshots session price
from the database, serializes on the session row, and returns the same result for
the same request id. Reusing a request id for another session fails. Paid confirmed
registrations request cancellation and keep their seat pending operator review;
no payment or refund is fabricated.

## Still pending

Remote provisioning/migration/advisors, live frontend connection, login/MY NAL,
public availability API, Storage provisioning, payment-provider checkout and
verified webhooks, order creation, mail/notification delivery, CRM screens and
site deployment. The public site continues to use its current JSON source.
These SQL ledgers do not implement a payment gateway or stock management.

Tests use real PostgreSQL semantics through a disposable PGlite database with
stubbed Supabase Auth roles. This verifies SQL/RLS and sequential reservation
behavior; hosted Auth, actual concurrent requests, Storage and remote advisors
must still be checked on the dedicated project.

```bash
npm install --prefix /tmp/nal-db-test --save-exact @electric-sql/pglite@0.5.8
NAL_PGLITE_MODULE=/tmp/nal-db-test/node_modules/@electric-sql/pglite/dist/index.js \
  node scripts/test-nal-supabase.mjs
node scripts/check-nal-platform.mjs
```
