# nal-account (BUILD06 source, NOT deployed)

A single default-off endpoint for public offer metadata and verified account actions.

## Runtime setup at release preparation
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: existing server-only environment. Never copy secret/service keys into frontend JSON.
- NAL_ACCOUNT_ENABLED: false/unset by default; separate from NAL_READ_ENABLED.
- NAL_ALLOWED_ORIGINS: exact allowed origins, no wildcard assumption.
- Function uses custom authentication for POST via Auth /user and bound Auth Admin lookup. Because GET is intentionally public-safe, gateway verify_jwt must be configured false for THIS endpoint when deployed, after reviewing the POST authentication path. Other existing functions retain their gateway settings. No deployment/config mutation performed here.

## Public request
GET ?action=offers[&season=<slug>] : configured published offer metadata only, not manuscript or personal records.

## Authenticated request
POST JSON: {area, action, payload, seasonSlug?}
area=account: profile, profile-save, files, orders, programs, registrations, reports.
area=join: options, claim, welcome (exact seasonSlug required).
area=offers-admin: list, save (DB requires existing owner, verified subject, READ OFF for editing).

User identifiers are never accepted from the client as authorization. The server binds them from the fresh verified Auth response. Existing enrollment and read release checks remain inside SQL.

No test runs or paid resources are part of this source build. This endpoint is not a payment provider integration and does not create or confirm paid orders.
