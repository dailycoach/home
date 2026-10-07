# nal-read-companion — BUILD10 source only

Not deployed, not runtime-validated. All tests and combined integration are deferred by the owner to pre-sale.

## Configuration later
Existing SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and exact NAL_ALLOWED_ORIGINS.
New NAL_READ_COMPANION_ENABLED defaults false/unset. No environment value is set by this build.
This endpoint combines public-safe GET with individually authenticated POST. At deployment preparation review gateway verify_jwt=false for THIS endpoint's custom-auth arrangement; do not change private READ functions' JWT settings. No gateway setting is changed now.

GET ?season=<slug>: fixed nal_read_program_detail projection. Only configured public offer, owner-published guide and published weekly/schedule metadata. No draft content, private record, staff note or Zoom join URL.

POST {action,seasonSlug,payload}:
- arrival, check-save: verified member access via nal_read_companion.
- studio-seasons, studio-get, studio-guide-save, studio-guide-publish, studio-plan-save: nal_read_studio, using existing owner/operator roles. Only owner may publish guide.

The server binds acting user id from the existing request-scoped Auth boundary, never user_metadata or client-supplied identity. Unknown actions are rejected. Private tables and functions are not granted to browser roles. Checklist values are booleans, not arbitrary participant journals. The studio reads course prompts, never participant answers; operator-authored notes must still be handled responsibly.

Source dependency order: full BUILD09 chain -> BUILD10_GUIDE -> BUILD10_STUDIO -> BUILD10_ARRIVAL_BRIDGE. Package matching client and shared Auth helper together at eventual integration. No actual approval, publication, migration, login, email, payment, test run or paid infrastructure is part of this source-writing task.
