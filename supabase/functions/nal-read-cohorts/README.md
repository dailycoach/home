# nal-read-cohorts — BUILD09, source only

Default-off endpoint. Not deployed, not integrated/tested for customer use in this build.

## Configuration at later integration
Existing SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and exact NAL_ALLOWED_ORIGINS. Add NAL_COHORTS_ENABLED only when deliberately enabling this endpoint. Do not set it during the source-authoring phase.
This endpoint intentionally combines public-safe GET with individually authenticated POST. At deployment preparation review the custom-auth setup and gateway verify_jwt=false for THIS endpoint; do not alter the existing private READ functions' gateway settings. No configuration was changed here.

GET `?program=<optional program_key>&season=<optional season_slug>` calls only the public projection nal_read_cohorts_public, never manuscript or private waitlist records.
POST `{action,payload}` verifies the current user through the existing request-scoped Auth boundary:
- status, mine, wait, withdraw -> nal_read_cohort_user
- admin-list, admin-save, admin-roster, admin-offer-next, admin-offer-cancel, admin-attendance -> nal_read_cohort_admin, which additionally requires existing owner permission.

Request body cap: 16KiB. User ID is bound on the server. Admin target IDs identify records; they do not determine acting authorization. Unknown actions/invalid primitive IDs/offsets are rejected. No browser-provided Auth claims or user_metadata are trusted.

SQL load sequence and exact product limitations are documented in docs/NAL_READ_BUILD09_COHORTS.md. No cron, mail provider, Auth grant, payment, refund, live fixture or new cloud resource is part of this feature build.
