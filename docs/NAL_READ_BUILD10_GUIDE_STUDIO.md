# NAL BUILD10 — program detail, participant arrival and facilitator studio

## Delivery boundary
Continue the existing feat/nal-read-v1 Draft PR160. Owner requested feature completion, deferring tests/validation until immediately before customer sales. BUILD10 is implementation source only. No test runner, SQL invocation, browser rendering/QA, CI polling, hosted migration, Edge deployment, actual login/payment, mail, role assignment, feature activation or paid resource was performed. Use [skip ci]. Do not describe it as tested, hosted, sale-ready or PASS.

## Customer-facing changes
### Program detail
Existing /nal/shop/read/?season=<slug> now composes a single constrained public projection:
- Existing offer data remains the authority for price, terms and cohort metadata.
- Owner-published introduction, who the program is for, what to leave with, reading guidance, exact book fields and FAQ.
- Weekly outline from published read_weeks/read_days metadata only. No draft or full paid DAY prompt is exposed publicly.
- Actual registered LIVE titles/times/status, never public Zoom access URLs.
- Keep BUILD08 simple participation/card flow and BUILD09 available/wait/closed states. Add no payment screens.
Guide fields are empty until authored and deliberately approved. No book title/author/edition, reading assignment, date, price or marketing claim was fabricated/seeded. The new generic 60-minute facilitator template is explicitly an editable original example, not an actual meeting schedule or recovered manuscript.

### Participant arrival
New /nal/read/start/?season=<slug> shows a verified participant's course start/end, published preparation guidance/book information, next LIVE summary and own preparation checkboxes.
- Member checks store booleans against the current published guide revision and own enrollment; they do not store coaching answers.
- Checklist completion is optional and does not unlock DAYs, mark attendance, finish a season or alter any access/payment state.
- A newly published guide revision asks participants to review the current list rather than claiming an earlier check covered changed instructions.
- Stale saves fail with a revision conflict; unsaved changes trigger a navigation warning. No automatic email or notification is created.
- Arrival phases distinguish prestart / active / ended / cancelled / unscheduled. Ended is a calendar period, not proof of completion. Cancelled is an operating state, not proof of refund.
- Future/prestart TODAY now displays the course start and a preparation entry, instead of only an empty-question message. Existing DAY gate remains unchanged. After start, the existing daily engine resumes; ended access remains governed by its entitlement.
- Common participant header links back to the preparation screen. Reusable season entry loads the current BUILD10 daily engine.

## Facilitator studio
New /nal/read/admin/studio/?season=<slug>&week=<1..4> uses existing owner/operator editorial roles. No membership/role was created. Global operator remains the already-configured editor role; this build does not introduce per-cohort facilitator delegation.

### Weekly source material and preparation
Select a cohort season and week; read its published DAY text/questions alongside registered LIVE candidates. Only official published course source is fetched here; no joins to participant answers, personal drafts, experiment reflections, private LIVE notes or psychological scores. Existing roster/attendance stays on the cohort-management screen.
Select the matching week's actual LIVE explicitly, or leave the runbook unbound while drafting. UI compares planned agenda minutes with actual selected LIVE duration without overwriting the schedule. A plan being marked ready is an editor readiness label, not completed QA or a held meeting.

### Runbook authoring
Purpose, opening question, closing question, follow-up experiment guidance; add/reorder/remove time-boxed agenda sections, each with its own displayed prompt and staff-only note. A published DAY question can be explicitly imported into the draft agenda with DAY/STEP source reference in its internal note.
An optional 60-minute original template offers six sections: arrival, a personal-life scene, an experiment reflection, deeper questions, one small choice and a closing sentence. Loading it changes only the current editor draft until saved. It is not automatically chosen as the actual LIVE duration.
Runbooks save by season/week with optimistic revisions and a history record. Concurrent changes are not overwritten silently. Operational reflections separate observed facilitation, adjustments and next preparation; UI explicitly asks staff not to copy names or sensitive participant disclosures into those fields. This is a usage boundary, not an automated PII detector.

### Presentation view
The opaque full-viewport native dialog displays agenda title/question and a local pause/resume/next timer. It omits internal notes and operating reflections. It does not query participants or write attendance/completion. Timer state is local and ephemeral, not a background automation or persisted meeting log. A question-only text export excludes internal notes; print uses the active presentation question rather than the editing form.

### Program guide editor
In the same studio, edit program introduction, book metadata, preparation items and FAQ. Owner/operator may save drafts. Only an existing owner can explicitly approve the current stored version for public use.
Draft editing does not overwrite the previous published snapshot; the UI shows separate draft and public revision labels. Price, participant terms, dates, capacity and enrollment switches remain in their existing authoritative settings. Guide publication does not open READ, activate payments, grant seats or send messages.

## Backend source
Four new private tables: read_arrival_guides, read_preparation_checks, read_companion_history, read_facilitator_plans. RLS and no anon/authenticated table grants. All RPCs are service-only and use existing verified-subject checks for member/editor work. No SECURITY DEFINER shortcut or auth.users grant.
New nal-read-companion endpoint exposes only public program projection by GET and verified member/studio actions by POST. Body cap 64KiB; action/identifier/revision validation is written into the endpoint, not an executed test. The user-auth helper allowlist adds nal_read_companion and nal_read_studio only; the public projection is a fixed server call, not a client-chosen RPC name.
SQL source load order after BUILD09:
1. NAL_READ_BUILD10_GUIDE.sql
2. NAL_READ_BUILD10_STUDIO.sql
3. NAL_READ_BUILD10_ARRIVAL_BRIDGE.sql
The last wrapper augments existing bootstrap output; it does not replace the original role/release/DAY checks. Do not apply the cumulative chain partially; integrate matching endpoint/client sources in the later pre-sale phase.

## Deliberately not changed
Existing payment endpoints, general-card/default-selector checkout, merchant-console refund model, free PDFs, PDF commerce, source manuscript, editorial publishing of DAYs, cohort pricing/dates/capacity, actual user data, production main and hosted feature flags.
No new paid projects/services, scheduler, analytics routine, AI calls or invented data. The prior platform QA backlog remains deferred, not cleared. No live service link is claimed for these branch-only screens.

## Remaining product work
The new fields need actual approved program/book/preparation copy and matching LIVE assignment; this build supplies the editor and user experience, not fabricated operational records. The next bounded feature scope is a participant help/request space with a season/order context and an operator response queue, keeping financial execution in the provider console and avoiding automatic outbound messages.

## Technical reference
https://supabase.com/docs/guides/database/postgres/row-level-security informed private-schema/explicit-grant boundaries. The mandated changelog.md fetch was attempted and returned an unsupported content-type; no version-specific API/CLI update was inferred from it. Documentation review is not runtime testing.
