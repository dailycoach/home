# BUILD11 — first-season manuscript and deliberate studio import

## Scope and state
Source implementation on feat/nal-read-v1, Draft PR160. The owner requested BUILD FIRST, postponing tests and combined runtime validation until immediately before customer sales. This build adds authored participant/facilitator content and its editing workflow. It does not run tests, migrations, queries against hosted Supabase, browser checks, CI polling, deployment, email, payments, real session creation, public approval or paid-resource provisioning. Commit uses [skip ci]. No runtime PASS or sales-readiness claim.

## Actual content supplied
- One NAL READ 01 participant guide: hook/introduction, intended audience, personal outputs, reading method, pre-start guidance, bibliographic fields, six preparation items and ten FAQs.
- Four different 90-minute facilitator manuscripts, not four labels around the same generic agenda. Each of 32 sections includes a displayed question, spoken facilitator guidance, operational notes and relevant DAY/source references.
- First-season structure retained: SIGNAL / ACTION / WORK / EDGE. Eight stages retained: ARRIVE / READ / NOTICE / QUESTION / MIRROR TALK / CHOOSE / TRY / RECORD. Minutes: 5/10/10/10/25/10/15/5.
- Weekly experiments: REMOVE ONE (7 days), 72H HAVE-A-GO, AI/ME/TOGETHER and a small safe tool-or-paper experiment, MY NEXT MOVE + selected MY 2027 sentences.
- Experiments are not assumed complete by LIVE time. Unused tools, skipped sessions, missing DAYs and unavailable final questions are not fabricated as done.
- All new runbook debriefs are empty: there are no invented session observations, participant answers, results or completion claims.
- Shared 2–3 person conversation procedure and facilitator care notes. No public sharing/coaching-record extraction or outbound messages.

## Source boundaries
Original manuscript is unchanged: content/nal-read/trend-2027.editorial.json @ blob 749fd994e7c53017ea6f19aaaae2bf8503ad96c6, base commit 162ffbd2d9c6c3102e166d7b34c4d96f34e2477f.
The user-selected book title is retained, with bibliography checked against the Korean Labor Institute library record and published table of contents. Page counts differ between catalogs and were deliberately NOT used. No invented page range, book excerpt, chapter definition or book statistics is supplied. Chapter labels are navigation anchors; their mapping to NAL weeks is an editorial choice. NAL does not claim author/publisher endorsement.
The 90-minute plan follows the earlier NAL READ design; actual cohort/LIVE timestamps, contract terms, book-inclusion policy, price and access duration remain in their existing settings. The older general 60-minute example remains under a separate collapsed label, not the READ 01 default.

## Implementation
Server manuscript modules:
- supabase/functions/nal-read-companion/presets/trend-2027-guide.mjs
- supabase/functions/nal-read-companion/presets/trend-2027-weeks.mjs
- supabase/functions/nal-read-companion/presets/index.mjs

A new POST action `studio-preset` accepts only the finite preset ID `nal-read-01-trend-2027-v1` and an integer week 1..4. The existing verified Auth boundary runs first. The Edge code then invokes existing `nal_read_studio` get for the selected known season/week so SQL checks the established owner/operator role before returning the bundled manuscript. The user-facing public GET and participant arrival actions do not return the preset. No new database RPC, table, privilege, role, SQL source or migration is introduced.

Do not assume a private API makes repository source files confidential. At eventual static packaging, keep server/source directories outside the public web asset output according to the deployment policy. This build changes no hosting rules and makes no repository-secrecy claim. The draft content contains no participant data or secrets.

## Studio authoring sequence
1. Choose existing season and week in /nal/read/admin/studio/.
2. Explicitly open READ 01 guide/current-week preview.
3. Read participant copy, runbook timeline, shared conversation rules and original DAY anchors.
4. Import the guide or selected week's plan into the current editor only.
5. Edit and use the existing save action. Guide publication still requires a separate existing-owner approval.

Fetching/previewing the preset does not save anything. Importing is local, explicit and confirms replacement of that editor's current content. It does not replace the other editor, bind another LIVE, increment DB revisions, publish or activate the program. The target season/week is visible. Applying this preset to a different season warns the editor to adapt its book/week references.

The guide importer retains the current fetched save revision and published-version state; old published text stays live until approved through the established path. The plan importer preserves the actual debrief and selected LIVE, sets plan state to draft and retains optimistic save revision. Agenda/LIVE duration mismatch is displayed instead of silently changing the real meeting.

Preview text output includes only the new preset's author-written guide and selected-week notes; it does not export current facilitator debriefs or participant records. Existing presentation output remains question-only and excludes internal notes. Failed fetches and identity/season changes do not apply old responses to a new editor.

## Integration boundary
Apply no new SQL for BUILD11. At later integration, package these relative server modules with the existing BUILD10 companion function and pair them with the studio HTML/library/client scripts. All prerequisites from earlier builds still need their own combined integration and pre-sale validation. This turn does not do that work.
Existing payment/general-card/merchant-refund code, free PDFs, program/DAY manuscript, account Auth helper, pricing/terms, schedule rows, actual participant records and hosted release flags are untouched.

## References
- https://dl.kli.re.kr/library/10150/contents/7823436 — selected book bibliography.
- https://www.yes24.com/Product/Goods/195842609?ReviewYn=Y — published table-of-contents labels only.
- https://supabase.com/docs/guides/functions/auth — authentication is distinct from role authorization; this build retains the existing explicit boundary rather than adopting a new SDK.
- https://supabase.com/changelog.md fetch was attempted and returned unsupported text/markdown. No version-specific API change is inferred; no new library dependency introduced.

Human-readable manuscript overview: docs/NAL_READ_BUILD11_FIRST_SEASON.md.

## Next bounded product work
Participant help/inquiry with optional season/order context and a small operator reply queue. It must not expose coaching answers, widen payment execution, or automatically send external messages. Keep actual runtime tests and publication at the owner-directed pre-sale phase.
