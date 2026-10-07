# NAL READ · BUILD05 — Contents / My Report / Editorial CMS

Owner direction: prioritize completeness; run product QA immediately before sales. This change is implementation source, not a release or a QA pass.

## Functional additions
- `content/nal-read/trend-2027.editorial.json`: four weeks, DAY 0 + DAY 1–28, original conversation questions edited into schema v2. Before/after uses the same seven self-report prompts and stable measure keys. Four TRY days and four LIVE touchpoints. No invented schedules, purchase prices, participant records or book quotations.
- `nal/read/admin/`: season list/new/clone, JSON import/export, day/step form editing, step reordering, choice editing, manuscript preview, revision history/restore as a new draft, owner-only approval/publication, and LIVE schedule authoring.
- `nal/read/trend-2027/report/`: self-authored records, before/after without imputation, TRY reflections, AI/ME/TOGETHER, selected sentences, LIVE notes, next move, final reflection; title/name/note customization; immutable editions and native print/PDF, HTML and JSON exports.
- Participant shell links to MY REPORT without adding a sixth bottom-navigation tab.
- New service-only APIs `nal-read-editorial` and `nal-read-report` reuse the verified Auth boundary. The editorial RPC requires existing DB owner/operator membership, not a browser claim. Owners approve/publish/schedule. No new admin member is automatically created.

## Source and content approval
The supplied manifest remains an editorial DRAFT. It is not represented as approved copy or an officially sourced summary of the book. The source provenance records that bibliographic attribution and chapter associations need editorial confirmation. Existing conversation hooks were adapted in places to avoid compulsory disclosure, diagnosis, exaggerated AI claims and unsafe AI uploads. Those are manuscript edits, not silently attributed quotations.
The editor never fetches the full seed from a participant public URL. The operator imports the JSON file. `content/` is repository source, NOT a secrecy boundary; omit source manifests and SQL/docs from static release output if paid editorial content must remain private. No repository-visibility or hosting change is made here.

## Editorial flow implemented
JSON import -> local unsaved editor -> server DRAFT -> REVIEW -> explicit owner APPROVAL -> explicit content publication.
Editing creates a new revision and invalidates approval. History imports become a new draft. Publishing checks the exact approved revision, release OFF and no enrollment in the season. Running seasons are frozen; clone for a new cohort. Old source snapshots are retained. No answer or participant data is exposed in the editor.
Content publication does NOT enable READ, set up checkout, grant enrollment or start sales. Those controls remain separate.

## Report semantics
A snapshot is assembled server-side from the verified participant's stored records. Selected answer IDs must belong to the same enrollment. No AI API or generative analysis is used. Missing values stay missing. Scale comparison requires matching key, version and prompt. The report is marked in-progress until 28 actual DAY completion records exist. LIVE join clicks are not attendance claims. Print/PDF is the browser's built-in print dialog, not an already generated server PDF. Local HTML/JSON exports contain private records; the UI warns against leaving them on shared devices.
Saved report editions are append-only and idempotent by request ID; a changed payload cannot reuse an existing ID. Edition count and payload sizes are bounded to avoid accidental unbounded storage use.

## Integration sources — NOT applied
Apply in this dependency order only at integration/release preparation:
1. Existing recorded FIX03 schema.
2. `docs/NAL_READ_BUILD04_WORKSPACE.sql`.
3. `docs/NAL_READ_BUILD05_EDITORIAL.sql`.
4. `docs/NAL_READ_BUILD05_REPORT.sql`.
Then package both new Edge functions with their relative `_shared` imports and update workspace/shared Auth source as a matching release. Editor uses `NAL_READ_EDITORIAL_ENABLED`; participant report uses `NAL_READ_ENABLED`. Both are disabled unless deliberately enabled. Existing owner/operator membership must be supplied through the proper administration path, not auto-provisioned by these functions.
Import the JSON through the editor; do not run it as an automatic public seed. Existing page asset versions should be cache-busted together at front-end integration.

## Work deliberately deferred
No tests, workflows, browser QA, database execution, actual login/email, payment, schema deployment, Edge deployment, front-end publish or paid-resource creation were performed for BUILD05. The prior QA backlog is unchanged, not reclassified as passed.
Remaining product work: shared MY NAL at the platform level; STORE-to-program entitlement fulfillment; first-season onboarding and pricing/schedule decisions; release-integrated content publishing. Whole-platform, role/API, concurrency, accessibility, offline/draft and print layout checks remain in the pre-sale gate.
