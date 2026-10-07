# nal-read-companion — BUILD10/11 source only

Not deployed or runtime-tested in the BUILD FIRST phase. All combined integration and tests remain deferred to pre-sale.

## Existing configuration
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, exact NAL_ALLOWED_ORIGINS. NAL_READ_COMPANION_ENABLED remains default-off; this build sets no environment value.
At eventual deployment, review custom-auth gateway configuration for this mixed public GET / authenticated POST endpoint. This source change does not change any other function's JWT settings or existing Auth implementation.

## Public GET
GET ?season=<slug> uses only nal_read_program_detail: configured offer, owner-published guide and published weekly/LIVE metadata. It does not include the authoring library, staff notes, participant answers, drafts or Zoom join links.

## Authenticated POST
JSON {action,seasonSlug,payload}.
Member actions: arrival, check-save -> nal_read_companion with existing participant checks.
Studio actions: studio-seasons, studio-get, studio-guide-save, studio-guide-publish, studio-plan-save -> nal_read_studio with the existing owner/operator roles. Only owner publishes a guide.
BUILD11 adds studio-preset with payload {presetId:'nal-read-01-trend-2027-v1',weekNumber:1..4}. Before returning the bundled draft, it calls the existing studio get RPC for the known target season/week to obtain the SQL role authorization. No new grants/RPCs are needed. Arbitrary file paths, remote imports or preset IDs are not accepted.

## First-season library
Bundle ./presets/index.mjs, ./presets/trend-2027-guide.mjs and ./presets/trend-2027-weeks.mjs with the Edge source. They supply the authored guide, 6 preparation items, 10 FAQs and four distinct 90-minute runbooks. Book chapter names are reading anchors; scripts are original NAL drafts. Debrief fields start empty.
The studio preview action returns a clone for the selected week. Import changes editor memory only; the existing save/publication flows remain explicit. It preserves actual facilitator debrief and LIVE selection and sets a replaced plan back to draft. No participant data or runtime observations are embedded in the template.

This is an API authorization boundary, not a claim that repository source is secret. Static deployment packaging should exclude server source directories; this build does not change publishing rules.

## Unchanged deployment boundary
Database prerequisite order remains full BUILD09 chain -> BUILD10_GUIDE -> BUILD10_STUDIO -> BUILD10_ARRIVAL_BRIDGE. BUILD11 introduces no SQL/migration or new package dependency. The cumulative SQL/client/Edge code is not applied in this turn. No actual approval, public content change, login, email, payment, test run, paid service or feature activation occurs.

Details: docs/NAL_READ_BUILD11_CONTENT_LIBRARY.md
Manuscript overview: docs/NAL_READ_BUILD11_FIRST_SEASON.md
