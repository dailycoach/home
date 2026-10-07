# BUILD14 — MY NAL home: resume, LIVE, replies and next actions

## Source boundary
Parent caf6db7fc17a53eb21d40feb3d95dc783d37d01c, feat/nal-read-v1 / Draft PR160.
Implementation only under the owner's build-first direction. No tests, browser QA, hosted SQL, actual Auth/payment/support calls, production deployment, new tables, feature activation or paid resources are performed. Commit uses [skip ci]. The source is not reported sale-ready or tested.

## What changes for the participant
`/nal/my/` now defaults to a HOME tab rather than a raw program list. Explicit existing `?tab=programs|files|registrations|reports|orders|profile` links remain supported.
The home foregrounds one accessible, unfinished DAY; if none, a future cohort's preparation entry; otherwise an accessible archive or appropriate existing program entry. It respects the original bootstrap's unlocked states and existing access check; the home does not invent a new DAY-unlock calculation. Ending a cohort is not treated as graduation. Completed DAY count excludes BEFORE and is not displayed as a psychometric score or completion percentage.
An expandable area shows other loaded cohorts, not an endless wall of thumbnail cards. The bound is 20 cohorts, ordered by active/future status and last recorded progress activity. The response and UI disclose that limit and link to the full program list. The highlighted recommendation is within that bounded selection, not a claim to have examined arbitrarily many enrollments.
Future preparation leads to the existing start guide if enabled; active questions lead to the exact BEFORE/DAY; archive leads to personal records. No mandatory post-payment re-selection or extra welcome gate is reintroduced. Existing profiles, PDF access, registrations, orders and saved report lists remain available separately.

## Upcoming LIVE
Show up to five chronologically near published LIVE sessions from accessible loaded cohorts; no meetings from cancelled or unscheduled cohorts. Metadata only: title, week, start/end, cohort and a snapshot-time stage label. No Zoom join URL is loaded by the home. Clicking opens the existing LIVE screen, where access and join-window checks run again.
This is not an always-current sports-style feed: show the exact fetched server time, explicit refresh button and a stale-view reminder after returning to the tab. No polling, timer, webhook listener or recurring automation was added. Remaining unavailable/restricted cohorts are outside the LIVE display's scope, not evidence that they have no scheduled sessions.

## Things to check
- Support: exact count of the caller's threads with unread staff replies and at most five latest thread subjects/timestamps. No message bodies or caller answers are returned, and the home does not advance member_read_seq. Reading the actual conversation remains the place for read receipts.
- Waiting list: own waiting count and up to five currently unexpired offers, ordered by deadline. A displayed offer is an invitation to check details, not permission to charge or a promise of enrollment. Click through to the existing waitlist status page.
- Orders: at most three locally recorded unresolved/pending-delivery READ orders plus exact attention count. It does not query the provider, confirm an IN_PROGRESS payment, launch checkout, grant rights or retry delivery. Existing order detail performs any explicit follow-up. Last provider-check timestamp is shown where present; a snapshot is not a financial verification performed by home load.
- Operator navigation: existing owner/operator role is read for the current account. The home can expose appropriate existing operation links (studio, content, assigned support; owner adds cohort/offer/payment). Links confer no authorization. No other participant's operational records are queried for this member home.

## No hidden side effects
Do NOT call nal_get_read_day from the home: its existing implementation marks progress started. This home instead calls the read-only bootstrap and selects an already-unlocked day. No order/payment refresh, no support read receipt, no waitlist acceptance, no publication, no visit analytics event and no session logging is invoked by this action.
No coaching answers, private notes, experiments or report bodies are sent to the new client. Completed progress metadata is queried only for the owner/enrollment. Existing authentication remains the sole account-session path.

## Existing endpoint, no new subsystem
Add `account/home` to the existing nal-account endpoint and keep all previous account actions delegated to their original implementation. There is no new Edge service, database table, support dispatcher, AI summarizer or dashboard KPI subsystem.
The browser sends an empty payload. The Edge replaces it with fixed booleans read from existing READ/COMPANION/COHORTS/SUPPORT/PAYMENTS flags. A browser request cannot turn on disabled sections. The helper is service-only, SECURITY INVOKER, and checks the existing verified subject. The original nal_account public signature is retained as a wrapper; no new browser-role table grants or service key exposure.
Home section states distinguish ready / disabled / unavailable / partial. A missing table/function/column or permission does not get converted to a zero count. Section-local expected source/dependency failures preserve unrelated sections; unexpected errors fail the request and the UI labels any retained old snapshot as stale. This is failure presentation, not a runtime health certification.

## Router and UI
Use existing warm NAL tokens, typography, text links and open space. Desktop LIVE/news areas can sit side by side; narrow screens stack in reading order. No new logo, imagery, font, tracking library or external widget. A heading/overview script is added before the existing account router in the main MY NAL page.
Each view owns a disposal function; tab switches/session changes invalidate late results. Manual refresh preserves the last known snapshot but explicitly labels it when loading fails. Names and message subjects render through textContent. Native modifier-click/new-tab behavior remains for the menu. Profile edits warn before navigation and lock controls while saving; saved-name changes still use the existing revisioned API.
The legacy account lists retain their original 50-row paging. They are not rebuilt as an extra data model. The home retrieves no signed PDF links; download remains an explicit click using the existing endpoint.

## Files and later integration
Four new files: docs/NAL_READ_BUILD14_HOME.sql, docs/NAL_READ_BUILD14_HOME.md, nal/assets/js/account-overview.js, nal/assets/css/nal-account-home.css.
Four modified files: nal/assets/js/account-home.js, nal/my/index.html, supabase/functions/nal-account/handler.mjs, supabase/functions/nal-account/index.ts.
SQL is an unapplied implementation source under docs/, not a dated migration or deployment record. Apply only during the separately authorized complete integration stage after the prior BUILD04-13 sources. Deploy the matching nal-account code and new MY NAL frontend together then. Feature flags remain untouched in this build.
Unchanged: account-session Auth, shared verified Auth boundary, support API, payment/card/refund-console logic, PDF commerce/assets, content manuscripts, LIVE dates, prices, capacities, roles and all actual records.
Historical pre-sale QA and the cumulative source deployment gap remain outstanding. No runtime test is run or claimed passed here.

## Technical source
Supabase official row-level-security guidance: https://supabase.com/docs/guides/database/postgres/row-level-security . Used to retain explicit ownership/service-only execution boundaries, not to add blanket grants. The required changelog.md request was attempted and returned unsupported content type; no library version change was inferred or introduced.

## Next bounded work
Polish the existing DAY/TRY/LIVE/REPORT path as one coherent participant experience rather than adding a new platform subsystem. Keep payment and external messaging small, and continue to distinguish source implementation from deployment and pre-sale validation.
