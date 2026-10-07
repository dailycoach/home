# NAL BUILD15 — one participant path: DAY -> TRY -> LIVE -> MY REPORT

## Scope and source boundary
Parent: e9c55e5461efa1dcc54f10df788df1fbebcc025c, feat/nal-read-v1 / Draft PR160.
This is source implementation. Tests and combined runtime verification remain deferred to the owner's pre-sale phase. No test runner, browser QA, hosted SQL, login, actual message/payment, cloud resource, deployment, feature activation or main merge is performed. Use [skip ci]. Successful Git writes do not establish runtime correctness.

## Source-linked experiments
The previous DAY action generated an experiment UUID each time the step was rebuilt and did not persist which answer originated the experiment. BUILD15 changes the DAY action to commit the answer and call `experiment-from-answer` on the EXISTING workspace endpoint. The browser supplies only the saved answer ID, DAY/STEP and resulting draft revision, never owner/source text/prompt/week/price.
The server validates the existing identity, enrollment, DAY gate, published TRY step and owned answer. A new source-linked experiment must match the just-committed draft and current answer. Source week comes from the actual read_days -> read_weeks relationship, not a client-side guess.
Two nullable fields are added to the existing private read_experiments table: source_answer_id and source_snapshot. A partial unique index on enrollment/source answer plus a source-specific transaction lock makes repeated creation return the same linked experiment. The source snapshot contains the original prompt, the user's text, DAY/STEP/week and capture time. It is made only on an explicit user action, not when the DAY is opened.
Reopening a completed, paused or cancelled linked experiment does not restart it, overwrite its edited plan/reflection, or create a new copy. A distinct new experiment remains available through TRY's explicit new-plan action. Earlier manual/unlinked records are preserved and are not retroactively paired by text similarity. No existing data is backfilled.
DAY re-entry reads the caller's existing experiment metadata to show a direct link to a previously connected experiment. Connected metadata carries the source week; when no authoritative connected week is present, generic next-action links leave week unset rather than guessing a group from the DAY number. The usual existing DAY read still has its documented start-progress behavior; the added experiment read itself creates no record.

## Completion is a choice point, not an automatic pipeline
After explicit DAY completion, the screen offers next question, small experiment, LIVE preparation and personal report entries. Following a link does not create a new experiment, confirm attendance, or save a report. It does not make TRY/LIVE participation another mandatory DAY-completion requirement. Existing source answer validation and release/unlock rules remain.
Existing prestart/active/ended TODAY behavior and published journey remain. The new participant route links use the common season viewer and carry only IDs/week/DAY/STEP, never personal text.

## TRY and LIVE context
TRY and LIVE can be viewed by week or across all weeks. Explicit experiment/session links focus the matching owned item; an unmatched item produces a visible notice rather than opening another person's record or substituting a lookalike. The account/season scope is still enforced by the original workspace RPC.
TRY displays its stored origin under an expandable source-question section, alongside the current plan and reflection. Its execution week may be edited independently; the original source week and original sentence are not rewritten. Plan controls lock during a save to avoid discarding typing that arrived after the request snapshot. Paused experiments can save a reflection without resuming.
LIVE shows the user's experiments from the same execution week and their source/reflective context. Two explicit controls can append a plan or reflection to the user's existing pre-LIVE note. They never replace an existing note, save it automatically, send it to a facilitator, share it with other participants or infer attendance. Text exceeding 5,000 characters is rejected rather than silently truncated. Saving remains an explicit action. The plain-text copy is not a new persistent relational link between an experiment and a meeting; later experiment edits do not silently edit a past LIVE memo.
Links from the LIVE note back to that week's experiment and forward to MY REPORT keep the flow navigable. Calendar downloads remain local ICS generation and Zoom join remains time/access checked, without new paid APIs.

## LIVE revision handoff
The new wrapper serializes live-join with the existing note-save lock. New clients include their known note revision; the response returns the post-click revision within the same transaction. The client no longer fetches every LIVE afterwards and blindly adopts a possibly newer note revision that another tab saved. This avoids using a newer version number with stale local text. A conflict asks the participant to retain their draft and reload deliberately. Join is not attendance and does not clear the local dirty-note marker. Existing old clients without a revision remain accepted by the server wrapper for compatibility, but matching new clients are required at integration.

## Report continuity
The existing report source/save serializer already uses to_jsonb for experiments, so its current snapshots automatically include source_snapshot after the new columns exist. The renderer shows origin prompt/original sentence, current planned action, status and reflection together. It labels planned/started/paused/completed/cancelled states instead of describing every plan as completed action.
Report section 03 is now '생각하고, 해보고, 돌아본 것'. Personal LIVE notes retain week labels and an explicit distinction from confirmed attendance. Existing reports with no origin snapshot still render without a fabricated one. Stored editions are never updated in place. New saves collect the current source; old opens use the stored snapshot only. Browser print, HTML and JSON exports all use the same chosen snapshot and omit interactive return controls. No AI evaluation, psychological inference, or new document-generation service is added.
Report header links lead back to answers, experiments and LIVE notes. These are navigation, not automatic edits. Existing cover/selection/edition controls remain and retain their request IDs for retry. Late responses after a session/view change are ignored in the rewritten participant handlers.

## Backend and deployment preparation later
New source: docs/NAL_READ_BUILD15_PATHWAY.sql. It is not an applied migration.
Load after the complete prior BUILD04-14 source chain. It adds two columns/index to the existing experiments table and wraps the existing public nal_read_workspace signature. Older actions forward to the original implementation; the new action and live-join behavior use the existing service-only, SECURITY INVOKER boundary. No new table, Edge service, global feature flag or Auth client. No anon/authenticated table privileges are added, and the shared Auth RPC allowlist remains unchanged.
Update the existing nal-read-workspace handler and matching participant JS together at later integration. The generic season viewer and dynamic loader use the BUILD15 assets. Shared legacy participant routes still use the same source modules; their older cache query labels must be considered in the existing release asset/cache review. No hosting cache is purged in this task.
Original rows have nullable source fields. An explicitly removed source answer can clear the FK while its creation snapshot remains in the experiment, so eventual personal-data erasure must account for both copies. No retention/deletion policy is invented or activated here; account-erasure work remains separate from this additive source link.

## Not changed
No hosted schema/data or real customer record. No schedule, book manuscript, prices, payment/card/refund-console flow, support behavior, owner roles, existing account authentication or free/PDF store assets changed. No automatic notifications, telemetry, AI APIs, tests or paid resources introduced.
There is still a cumulative source-to-hosted deployment gap. This code is not claimed live, validated, release-ready or fully integrated. Historical QA debt remains deferred, not cleared.

## Primary technical documentation consulted
- https://www.postgresql.org/docs/17/sql-insert.html (conflict handling / unique enforcement)
- https://supabase.com/docs/guides/database/postgres/row-level-security (explicit ownership and private grants)
The changelog.md retrieval returned unsupported text/markdown through the web reader; no SDK version or undocumented feature was inferred. No dependency version was changed.

## Next bounded product direction
Consolidate remaining participant navigation and loading/error copy, then bring the complete authored source into one integration plan when requested. Do not keep expanding unrelated administration or payments to substitute for the participant experience. Pre-sale testing remains a separate explicit stage.
