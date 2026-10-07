# NAL BUILD13 — finish the common-account support connection

## Current scope
This is a bounded source-integration follow-up to BUILD12, not a new helpdesk or payment system. Parent source is 02d47b3bd8997990f4cc0e07f2b4f9bfa68807ac on feat/nal-read-v1 / Draft PR160.

The previous BUILD12 attempt recorded a blocked combined write to account-session.js, account-layout.js and read-shell.js. Those files were read again at the current branch head. This follow-up used the same authorized GitHub create_tree action for the explicit common-file changes; that call succeeded. No alternate writer, second Auth client, credential workaround, permission change or relaxed server check was used. The historical BUILD12 note remains an accurate record of that earlier attempt, not the current source-wiring status.

## Implemented source connection
1. account-session.js adds `support(action,payload={})` targeting the fixed `nal-support` endpoint via the existing private `request` closure, and exposes it as `NalAccount.support`.
2. The existing request implementation is otherwise untouched, including its session requirement, Authorization/public-key headers, exact configured Supabase URL, timeout cleanup, abort handling, session-epoch ownership check, response handling and 401 behavior. Login/logout, callback return restrictions, payments, downloads and other wrappers remain unchanged.
3. account-layout.js adds the customer `내 문의` navigation entry, static `이용 도움말` link and `운영자 문의함` entry. A menu URL does not authorize staff; existing server role/assignment checks still decide access.
4. read-shell.js adds `문의하기` with only an explicit season hint (`tab=new&season=<slug>`). It does not pass the whole page URL, answer content, credentials or browser diagnostics. The existing inquiry form matches that hint against the server-returned owned seasons before selecting it, and the server rechecks ownership on send.
5. The member support page, operator support page and common MY NAL load the BUILD13 account assets. The generic READ entry loads the BUILD13 participant shell. The existing support renderer and all server functions/schema are reused.

## What the connection enables after deployment
MY NAL -> 내 문의 -> new conversation / existing replies.
READ -> 문의하기 -> current owned season as an optional context.
Existing owner/assigned operator -> 운영자 문의함 -> existing conversation/reply operations.
This is code wiring, not evidence that a live conversation was created or delivered. Member send, visible staff reply, assignment and resolve/reopen still require the existing explicit controls in BUILD12. No automatic message is sent by this build.

## Actual environment boundary
- No hosted DB or SQL query/write, migration, Edge deployment, live Auth/login, actual inquiry/reply, external message or test fixture.
- No READ/support/payment feature flag, key, role, table privilege, catalog/price, schedule, participant entitlement or production main change.
- No new dependency, external helpdesk, paid resource, subscription, AI call or recurring task.
- No test runner, browser QA, CI polling/rerun or sales activation. The source commit uses [skip ci] under the owner's build-first direction. Tests and combined integration remain deferred to pre-sale; no PASS claim.
- Historical SQL/QA debt is not cleared by adding the browser wrapper. The full source chain and matching server deployment still need the later integration stage.

## Remaining boundaries
Support is still not deployed or activated by BUILD13. The endpoint's NAL_SUPPORT_ENABLED check stays default-off and its owner/member/assigned-operator rules remain unchanged.
The existing renderer retains its missing-adapter fallback for mixed or stale asset loads. The BUILD12 wording in that fallback describes an old/missing adapter bundle; it should not be taken as current status when the new wrapper is present.
Support drafts remain tab-memory only and can be lost on reload or tab closure. Anonymous account recovery, external notifications, attachments, automated replies, personal-coaching-record collection and legal retention/deletion policy are outside this follow-up. Existing payment inquiries are not migrated into support threads.
No claim is made that code inspection or a successful Git write establishes runtime correctness. The meaningful completion here is removing the known missing account adapter and menu wiring from branch source.

## Reference
https://supabase.com/docs/guides/functions/auth — authenticated user calls retain their user session Authorization header and server verification. No new SDK pattern/version was introduced. The changelog.md request returned unsupported content type, so no version-specific behavior was inferred.

## Next bounded product direction
Consolidate the participant's common MY NAL starting point and operating entry navigation around the existing program, order, preparation and inquiry flows instead of adding another independent subsystem. Keep incomplete server integration distinct from source implementation.
