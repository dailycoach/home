# NAL READ operator source map — through BUILD17

## What this map means
A repository navigation and dependency guide, not a live service inventory, a release audit or a report of passed tests. Current branch source still needs cumulative DB/API/frontend integration. Do not turn the rows below into an operational-health dashboard or infer that a page is already publicly usable.

## Entry and responsibility
| Work | Existing route / source | Authoritative stored source | Mutation boundary |
| --- | --- | --- | --- |
| Start work | /nal/read/admin/home/ ; read-operations.js | BUILD17 read_operations_home projection through nal-account | No writes; navigate to the actual editor |
| Season / DAY manuscript | /nal/read/admin/ ; read-editorial.js | read_editorial_documents; published read_weeks/read_days/read_day_steps | Existing save/review/approve/publish controls |
| Participant offer | /nal/read/admin/offers/ ; read-offers-admin.js | read_offers + existing nal_catalog | Existing owner editor; no price update in hub |
| Operational cohort | /nal/read/admin/cohorts/ ; read-cohorts-admin.js | read_cohorts, read_waitlist, existing enrollments | Existing owner-controlled settings/offers/attendance |
| Public introduction / arrival | /nal/read/admin/studio/ ; read-studio.js | read_arrival_guides editable/published snapshots | Draft save and owner public approval are separate |
| Weekly facilitation | /nal/read/admin/studio/?season=<slug>&week=<n> | read_facilitator_plans + read_live_sessions | Save runbook; explicitly bind actual matching-week LIVE |
| First-season copy library | read-studio-library.js | BUILD11 repository content package; imported into editor draft | Import is not DB save or public approval |
| Participant help | /nal/read/admin/support/ ; read-support.js | support_threads/support_messages; current assignment | Explicit visible staff reply; owner assignment |
| READ orders | /nal/read/admin/payments/ ; read-payments-admin.js | read_checkout_orders and verified provider ledger state | Existing explicit reconcile; actual refund in merchant console |
| Member perspective | /nal/my/ ; account-home.js/account-overview.js | account/home read-only projection | Does not mark DAYs/messages/payment state on home load |

## Data flow added by BUILD17
Browser (existing account session)
  -> nal-account: area=account, action=operator-home, payload={seasonSlug,search,offset}
  -> Edge supplies existing runtime switches, never trusts a browser role
  -> existing Auth boundary binds p_user_id
  -> nal_account wrapper
  -> read_operations_home checks existing owner/operator membership
  -> minimal section metadata, owner-only cohort/order summaries, assigned-only operator inquiries
  -> display current source state and explicit navigation links

No write route branches out from this overview action. All current edit/reply/finance actions remain in their original modules and recheck authority there.

## Applying the new source later
Prerequisites remain the recorded FIX03 foundation and complete BUILD04-16 SQL chain already described in their source notes. In particular, account_before_operations wraps BUILD14's nal_account; editorial metadata comes from BUILD05, offer/account from BUILD06, checkout from BUILD07, cohort from BUILD09, arrival/runbooks from BUILD10, and support from BUILD12. BUILD13 supplies the common support adapter. BUILD15/16 remain participant pathway/feedback source.

After those prerequisites, the newly added source order is:
1. docs/NAL_READ_BUILD17_OPERATIONS.sql (not executed in this task).
2. Matching nal-account handler/index (no new Edge service).
3. Operator-home assets and updated shared layout/entry HTML together.

Do not execute only the latest SQL and assume earlier wrappers/tables exist. Do not insert these docs SQL files into migration history as though they were previously applied. Resolve and package the cumulative source chain in the explicit integration/release preparation stage. This map does not change gateway JWT configuration, project keys, feature flags or existing table grants.

## Remaining boundaries visible to the operator
- A saved manuscript is not public participant content; published content is not an activated service.
- A guide can have an older public revision while a newer draft is edited.
- A marked-ready runbook is not evidence that a LIVE occurred or matched the time allocation.
- Enrollment, reserved capacity and waiting applicants are distinct records.
- An unanswered support conversation is not a financial refund workflow.
- Stored order state is not a fresh payment-provider lookup.
- Missing/disabled connections are not empty data and never PASS.
- Studio carries current season/week. Legacy library/list editors still require reselecting that season; this is an explicit remaining navigation improvement.

No runtime testing, deployment, migrations, notifications or payments were performed to produce this map.
