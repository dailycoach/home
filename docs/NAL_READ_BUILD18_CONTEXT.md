# NAL BUILD18 — keep the selected cohort across existing management screens

## Delivery boundary
Parent 01abc3fb50c12932dfa7096a5d1a74122502d2b8; existing feat/nal-read-v1 / Draft PR160. Source implementation only. Owner defers combined tests to immediately before customer sales. No test runner, lint/type run, browser QA, hosted SQL/read/write, migration, Edge deployment, real authentication/payment/inquiry, role change, feature activation or main merge is performed. Commit uses [skip ci]. No paid resource, provider subscription, new SDK or dependency is introduced.

## Operator flow
Select a season/cohort in the operating home, then open that same season's manuscript, participant offer, cohort/roster, order list or inquiry list without choosing it again. Studio retains its existing season/week selection. Return links and the visible scope bar carry the current season/week back to the home. Direct-entry pages still work without a selection: manuscript shows its library, offers/cohorts ask for a season, and authorized order/support lists retain their all-season behavior.

The selection is a request, not proof of ownership, role, existing data or an instruction to create a record. New scoped readers and original editors use existing server authorization. An unknown requested season is not substituted with the first row, a new empty source, or a broad all-season result. The manuscript auto-open first matches the existing authorized library. New offers/cohort selection matches the actual returned season list. The studio's own existing selector logic remains unchanged; this build adds its navigation bar and contextual links, not a new studio editor.

## Shared context adapter
`read-admin-context.js` is a small navigation helper, not another authentication client. It reads strict single `season` and optional `week` values from the current URL, rejecting malformed/duplicate location values. It keeps no role or selection in localStorage/sessionStorage. The visible bar shows the requested season address, or a title supplied after the screen's authorized read, and an explicit scope-clear link. Even malformed inbound context leaves that clear-selection route and unrelated public/account/help links available.

Only seven fixed same-origin admin paths receive derived context links. Existing explicit cross-season links keep their destination; contextual return-home links follow the current selection. A bounded-purpose DOM observer updates newly rendered anchors; it does not click buttons, submit forms, change auth, fetch data, or observe/serialize user input. Link values contain location identifiers, never manuscript text, private answers, full current-page queries, tokens or payment details. Native new-tab/modifier behavior is retained. No arbitrary return URL is accepted.

Offers and cohort configuration forms track unsaved edits and in-flight saves. A deliberate change of season checks whether the operator wants to leave, and save controls lock while the captured payload is submitted. Requests retain the season from the form being saved rather than taking a new mutable selection after a response. This is an in-page/navigation warning, not crash-proof draft recovery or an account-wide auto-save system. Other existing editor dirty/revision checks remain.

## Individual screens
- Manuscript: authorized list match -> existing get -> exact source. No auto-save, approval or publication. Normal saved/draft operations remain. Opening/importing/cloning another source updates the location; an unsaved clone is still an unsaved editor document, not a newly stored cohort. Explicit library action clears selection instead of reopening the same source in a loop.
- Offer: replace the wall of all-season forms with one season selector and the selected form. Preserve existing catalog price source, participation types/notices, registration dates and access-days fields. No catalog price update or permission change is added.
- Cohort: read the incoming season into the existing picker and open its existing configuration/roster directly. Preserve FIFO offers, attendance, CSV and explicit settings saves. After the operator changes season, cross-screen links and refresh use that selection.
- Payments: selected-season pagination uses a server-side season predicate before LIMIT/OFFSET. Unselected all-season listing and explicit provider reconciliation still use the original payment endpoint. No financial mutation was added to the navigation or scoped list action.
- Support: selected-season list and individual conversation reads preserve the same scope across pagination, opening a reply thread and returning to the list. General/unlinked inquiries require explicitly clearing the season. The current owner/assigned-operator check remains. Member messaging and staff reply/resolve/assignment mutations stay on the original support endpoint with their existing explicit controls.
- Operating home: existing metadata projection remains version 17/read-only; all work links now carry the chosen season and applicable week, and copy no longer instructs the operator to reselect it in every old list screen.
- Studio: existing season/week editor and content import are reused; only its HTML loads the shared navigation helper. No runbook/guide source or meeting duration is changed.

## Read-only server scope
Add `account/operator-context` to the existing `nal-account` endpoint, not a new service. Browser payload has a fixed kind (`orders`, `support`, `support-thread`), a required seasonSlug and only that kind's paging/filter identifiers. The Edge supplies the existing server runtime flags; browser role, user ID, runtime or generic RPC overrides are rejected.

`docs/NAL_READ_BUILD18_CONTEXT.sql` is UNAPPLIED source. It creates a service-only SECURITY INVOKER read helper and wraps the existing `nal_account` signature after BUILD17; all older actions forward to the previous wrapper. It creates no table, RLS policy, membership, feature flag or browser table grant.

The helper verifies the existing request-bound identity and owner/operator membership. Order reads are owner-only and use the original projected checkout view. Inquiry rows are narrowed by selected season and current operator assignment before pagination. Conversation reads first require that the ID belongs to the selected season and authorized assignment, then reuse the original staff get operation, which rechecks assignment. They do not send replies or member read receipts. A missing/disabled scoped backend is an error, never a fallback to unfiltered rows. The frontend requires an explicit scopeVersion=18 and matching returned season before rendering a scoped response.

The account runtime flags govern these read views; they are not a live merchant-configuration health certification. Provider lookup, reconciliation, cancellation and settlement remain in their existing dedicated paths. Support reply/assignment and financial mutations were not reimplemented by this query helper.

## Integration later
Complete existing FIX03/BUILD04-17 SQL chain -> BUILD18_CONTEXT.sql -> matching nal-account handler/index -> matched context/feature scripts and the seven management entry HTML files. The original manuscript loader now loads BUILD18 editor code after the common context helper and uses the already-authored BUILD16 shared session asset. Other shared account/Auth modules, studio modules and first-season content are unchanged.

No deployment or cache purge occurred. The active branch source is not evidence that any new route is live. Member help still uses its prior cache label; its unscoped member behavior is compatible, but coordinated release should align static caches along with the rest of the recorded integration backlog. Historical BUILD17 notes describing re-selection are superseded by this note for the updated source.

## Unchanged
No actual price, participant, inquiry, payment/refund, program schedule, LIVE link, capacity, role, credential or feature switch is changed. No sample rows or automatic messages. Original free PDFs, PDF storefront/payment/download handlers, participant DAY/TRY/LIVE/report implementation and content package are untouched. Existing cumulative integration, retention and pre-sale QA remain outstanding; no PASS/sales-ready claim.

## Primary documentation consulted
- https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState
- https://supabase.com/docs/guides/database/postgres/row-level-security
The changelog.md fetch returned unsupported markdown content type. No SDK/CLI version behavior was inferred or changed. Documentation reading and Git write confirmation are not runtime testing.
