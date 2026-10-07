# NAL BUILD17 — one operator starting point

## Actual delivery
Parent: 91e4bcc15a6d74cb9c1c6d94b6c0e613cb16b9af, feat/nal-read-v1 / Draft PR160.
Source authoring only, under the owner's instruction to focus on product completeness and defer tests until pre-sale. No SQL was executed, no DB or participant records read through Supabase, no test/lint/type/browser run, no actual login, no message, no financial transaction and no deployment occurred. Commit uses [skip ci]. No plan upgrade, subscription, cloud project, dependency or paid API was added. No claim of production health or sales readiness.

## Working entry
New `/nal/read/admin/home/` is an operator landing page. Existing `/nal/read/admin/` remains the original manuscript editor; it is not replaced, redirected or reduced to a landing page.
The hub is linked from the common account footer. The manuscript editor has a direct return link. Studio/cohort/offer/payment/support entry pages load the updated layout, which adds an operator-home return link. Existing menu URLs are navigation only and do not grant an operator role.
The studio receives the selected season and week in its existing query parameters. Its return link retains those validated location parameters. The existing manuscript library, cohort picker and offer/payment lists still require choosing the season within those screens. The UI explicitly says this; this build does not pretend every legacy screen supports automatic context selection. No localStorage profile or a second Auth client is used to remember an operator's role or selection.

## What appears
1. Search the existing season titles/slugs and page through them in batches of 50. Choose a season, or clear the selection to see the accessible all-season/general support queue. A selected season outside the current library page is retained in the selector, not silently substituted by another row.
2. Original manuscript editing state, revision, approved/published revision, published DAY count and missing DAY numbers, with BEFORE separate. This is stored metadata, not a quality score, current participant access or a completed test.
3. Arrival-guide editable and published revision, distinguishing a draft from the public copy. No guide body is transmitted to the hub.
4. Four weekly runbook states, selected-week link, planned minutes and actual connected LIVE timing/state. A changed/deleted/mismatched selection is not shown as a confirmed meeting. A nearest upcoming published LIVE is selected from this cohort's actual stored sessions. No Zoom join URL is returned.
5. For existing owners only: cohort dates, recruitment/offer states and existing inventory counts; separately the count of locally recorded unresolved/undelivered READ orders. No participant roster or payment detail is included. The inventory is read, never reserved or mutated.
6. Open support threads, at most five oldest waiting subjects/timestamps. Existing owners see their authorized queue; existing operators see only threads explicitly assigned to them. A selected season narrows this to linked inquiries, excluding general/unlinked inquiries; the UI explains how to clear that filter. No messages or read receipts are fetched or changed.
7. Suggested next navigation based on those stored states (e.g. prepare a missing runbook or review an unpublished guide). These are not saved tasks, automated operating decisions or completion gates. No overall completion percentage or release PASS is manufactured.
8. A static six-part operator work guide: manuscript -> terms -> cohort -> arrival guide -> LIVE runbooks -> participant support. It creates no checklist answers or operating records.

## Permissions
The new action uses the existing nal-account endpoint and the existing verified-subject boundary. Server SQL checks nal_private.admins for owner/operator on each call before any protected source data. No role claim is taken from the browser or user_metadata. Existing global operator editorial scope is reused; this is not a newly introduced per-cohort delegation system.
Cohort capacity/inventory and unresolved-order count are owner-only. Source manuscript/guide/runbook metadata is available only under the respective server editor feature flag. Support is constrained by current thread assignment even though an operator has global editorial scope. Loss of role/401/403 clears any retained privileged snapshot in the new client; stale success is never retained through an authorization error.
The service-only SECURITY INVOKER helper and account wrapper are not granted to anon/authenticated. No table/view/RLS policy, secret, Auth RPC allowlist or membership changes are made. This file is a source description, not proof that the functions are already installed.

## Read-only and cost boundary
The hub sends `account/operator-home` with only seasonSlug, search and offset. The Edge attaches fixed booleans from the existing EDITORIAL/COMPANION/COHORTS/SUPPORT/PAYMENTS configuration. Browser flags, role fields and extra properties are rejected. No new switch is created and no existing switch is changed.
The helper issues SELECTs and calls the existing read-only inventory helper. It never calls get-day, enrollment claim, publication, support read/reply, wait-offer/accept, provider refresh/confirm/cancel, report-save or a test fixture function. Merely opening this screen creates no operational record.
The client has explicit refresh only. Returning from an editor displays a reminder rather than polling or silently rereading. Responses are bounded and render with textContent; the payload excludes personal answers, journal/reflection text, report bodies, staff notes, full manuscripts, payment credentials and Zoom URLs. No AI summary is involved.
No new infrastructure purchase or live transaction occurs in this build. This does not promise that future use or merchant transactions are without all possible fees.

## Failure and scope presentation
Each section separately labels disabled, unavailable, not-selected and ready-to-display states. `state=ready` means that a metadata query returned, not that the platform/meeting is ready. Expected missing table/column/function/permission errors do not become zero counts. Unexpected failure is a failed request, with an older same-scope snapshot explicitly labelled if it is safe to retain.
If a requested season cannot be resolved, the request does not fall back to all-season customer inquiries. Queries requiring that scope stop. A missing source does not authorize writes, create placeholder data or mark work complete. No draft content bundle is counted as saved on the hosted server merely because it exists in Git.

## Source integration
New files:
- docs/NAL_READ_BUILD17_OPERATIONS.sql
- docs/NAL_READ_BUILD17_OPERATIONS.md
- docs/NAL_READ_OPERATOR_SOURCE_MAP.md
- nal/assets/js/read-operations.js
- nal/assets/css/nal-operations.css
- nal/read/admin/home/index.html
Modified files:
- supabase/functions/nal-account/handler.mjs and index.ts
- nal/assets/js/account-layout.js
- nal/my/index.html
- nal/read/admin/index.html
- nal/read/admin/studio/index.html
- nal/read/admin/cohorts/index.html
- nal/read/admin/offers/index.html
- nal/read/admin/payments/index.html
- nal/read/admin/support/index.html
No existing editor modules or mutation APIs are rewritten. Child pages retain their existing feature scripts; only layout/common-account asset references are aligned. The manuscript editor retains its old participant adapter/cache label; this change adds only its return link and does not resolve the broader legacy-asset integration debt.

The SQL source extends the existing account RPC after BUILD14_HOME. It renames the prior wrapper into private scope and forwards every older action unchanged. Apply the full prior schema chain first during the separately authorized integration phase, then this source, then deploy matching nal-account and frontend assets. No migration version/file is invented. This source file is not an applied migration and is not idempotent to reapply indiscriminately.

## Not done
No cumulative source deploy, runtime connection, approval of program text, real first-cohort date/capacity, member creation, support reply, publication, actual attendance or sale is implied. Historical pre-sale QA remains outstanding. Auth, payment/general-card/provider-console refund flow, support operations, DAY/TRY/LIVE/REPORT modules, original PDF assets, prices and manuscripts are unchanged.
The new operator starting point is source-complete for this bounded view; actual backend integration, role/scoping/runtime/mobile/accessibility behavior remains untested. The remaining cross-screen context gap is explicitly noted rather than hidden.

## Current documentation consulted
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/database/postgres/row-level-security
The required changelog.md request returned unsupported text/markdown through the web reader. No SDK/API/CLI version change was inferred or introduced. Documentation lookup was not runtime verification.
