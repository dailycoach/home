# NAL READ 01 · WAVE 0 FOUNDATION STATUS

Updated: 2026-10-06

## Scope

NAL READ is being added as an isolated product layer under `/nal/read/`.
Existing NAL STORE, checkout, Toss, and PDF delivery files are not modified by WAVE 0.

## Cost policy

- Supabase paid development branches: not used
- Vercel paid/staging resources: not used
- Additional paid server: not used
- GitHub Actions + PostgreSQL 17 CI: used for zero-cost verification
- Existing `nal-platform` project: reused without creating READ user data

## Git

- Branch: `feat/nal-read-v1`
- Draft PR: #160
- Base: `main`
- Production deployment: unchanged

## Supabase

Project: `nal-platform`  
PostgreSQL: 17.11

Applied migrations:

- `20261006095820_nal_read_wave0_foundation`
- `20261006095938_nal_read_wave0_index_hardening`

Added database objects:

- `public.nal_read_seasons`
- `public.nal_product_entitlements`
- `public.nal_read_enrollments`
- `nal_private.read_enrollment_requests`
- `public.nal_get_read_access(...)`
- `public.nal_issue_read_enrollment(...)`

All READ tables currently contain **0 rows**.

Existing observed counts after migration:

- `nal_catalog`: 31
- `nal_settings`: 2
- `nal_orders`: 0
- `nal_order_items`: 0
- `nal_digital_entitlements`: 0

## Edge Function

`nal-read-enroll`

- deployed version: 1
- `verify_jwt`: true
- source requires `NAL_READ_ENABLED === "true"`
- no READ season is published
- browser staging backend config defaults to disabled

## Database verification

### GitHub Actions PostgreSQL 17

Verified:

- DDL application
- enrollment issue
- idempotent repeat issue
- refund access blocking
- entitlement revoke blocking
- audit trigger integration

### nal-platform rollback E2E

A synthetic test transaction was executed and rolled back.

Verified against the real PostgreSQL 17.11 database:

- issue enrollment
- duplicate request does not duplicate enrollment/entitlement
- owner RLS sees own READ records
- different user RLS sees 0 READ records
- refunded order returns `order_inactive`
- revoked entitlement returns `entitlement_inactive`

Post-test rows:

- seasons: 0
- product entitlements: 0
- enrollments: 0
- enrollment requests: 0

## Advisors

New READ foreign-key index findings were fixed by index hardening migration.

Remaining READ-related findings:

- unused index INFO while READ tables have 0 rows
- private request table has RLS enabled/no policy INFO; public/anon/authenticated privileges are revoked and service-role-only access follows the existing NAL private-table pattern

Existing NAL warnings outside READ are not changed in this WAVE.

## WAVE 0 gate

PASS:

- isolated READ code
- DB schema on PostgreSQL 17
- real nal-platform DDL
- RLS owner isolation
- enrollment RPC
- duplicate prevention
- refund/revoke blocking
- Edge Function deployment
- GitHub CI
- STORE code isolation

Pending:

- zero-cost Chromium viewport browser QA
- interactive real email magic-link round trip
- production release remains blocked

WAVE 1 must not be merged to production solely from this document. The PR remains draft until the final W0 gate is recorded.
