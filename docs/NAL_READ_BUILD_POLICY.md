# NAL READ — BUILD FIRST

Owner instruction: focus on product completeness now. Run tests, regression, browser QA, real Auth/payment checks and release gates immediately before customer sales, not after each build wave.

- Continue implementation on feat/nal-read-v1 / Draft PR #160.
- Use [skip ci] for development commits in this phase. Keep existing test sources; do not rewrite failing checks as passed.
- Reports describe implemented screens, connected code and remaining functions. No PASS claims or invented completion percentages.
- No new paid projects, branches, servers, subscriptions or AI API usage.
- Preserve existing Auth verification, user/season scope and private-record access controls while building.
- Do not merge main, enable sales, activate READ or deploy untested new SQL/Edge changes during this build phase.
- SQL under docs/NAL_READ_BUILD04_WORKSPACE.sql is implementation source, not an applied migration. Generate its migration file at integration/release preparation.

## BUILD04 delivered code scope
Participant workspace: server drafts with optimistic revisions, DAY re-entry, reusable five-tab navigation, TRY plan/start/pause/complete/reflection, LIVE schedule/RSVP/private pre/post notes/calendar/join window, MY NAL answer search/star/revisit and JSON export of loaded records.

## Next feature waves (not gated by current QA debt)
1. End-to-end content authoring/import + all 28 DAY source text. Preserve source attribution and approval status; do not invent book claims.
2. MY 2027 report and before/after comparison, personal sentence selection.
3. Operator content CMS and real LIVE schedule provisioning.
4. STORE -> program enrollment integration and common MY NAL.
5. Pre-sale comprehensive QA and release preparation, including prior audit backlog.
