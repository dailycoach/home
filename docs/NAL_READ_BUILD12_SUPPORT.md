# NAL BUILD12 — support inquiry and operator reply source

## Status: source implemented, account wiring NOT complete
This build writes a support schema, endpoint, customer/operator UI and public help page on the existing development branch. It does NOT mean inquiries can currently be sent from NAL.

An attempted combined modification of `account-session.js`, `account-layout.js` and `read-shell.js` was blocked by the connector safety gate. That write was not applied and was not retried through another write method. Those three files remain unchanged in this build. The support UI explicitly detects the absent `NalAccount.support` method and displays a connection-preparation message rather than pretending that submission works. Menu entry integration remains unimplemented for the same reason.

The existing request-scoped server Auth helper only gains the two approved support RPC names in its allowlist. No second browser Auth client, credential workaround, direct unauthenticated database request or adapter fallback was created to work around the blocked common-file change.

Owner direction remains BUILD FIRST: no tests, browser QA, workflow polling, hosted SQL queries/writes, migrations, deployed Edge functions, live login/payment, customer messages or new paid resources were run in this task. Commit uses [skip ci]. Source-level changes are not a PASS or sale-ready claim.

## Authored surfaces
- `/nal/help/`: static help with eight common situations. It works without login and has no Supabase dependency. Guidance covers login links, existing orders, locked questions, unsaved text, LIVE entry, cancellation inquiries, disclosure scope and where to read replies. No fictitious phone/email/contact channel or response-time guarantee is provided.
- `/nal/my/help/`: account inquiry list; `?tab=new` for a new draft and `?id=<uuid>` for a conversation. Optional season/order context is accepted only after the server confirms ownership. Requires the missing account transport attachment described above.
- `/nal/read/admin/support/`: owner queue and assigned-operator conversation view. Requires the same missing transport attachment. New pages use the existing account layout/login and do not replace it.

## Participant experience written into the UI
Select a category (account, READ/cohort, order/payment, LIVE, screen/save problem or other), optionally select an owned season/order, write a subject and message, and explicitly confirm sending the selected information to support.
The context selectors show up to the latest 100 owned entries, with the limit disclosed. A member can submit a general inquiry without a linked entry; an absent selector item is not interpreted as nonexistent ownership. The backend still validates any provided order/season and their mutual product binding.
Conversation states: open (staff answer awaited), answered (staff reply posted), resolved. The member can reply, mark resolved and explicitly reopen. Neither resolving nor replying grants a participant entitlement, finishes a DAY or cancels/refunds a payment.
Messages are plain text rendered with textContent, not HTML or active Markdown. They are paginated by monotonically increasing per-thread sequence. The member read receipt advances only to the messages loaded by this UI; unseen later replies remain unread. The UI does not poll or claim real-time notifications.
Identical retry commands reuse a request identity and compare their payload fingerprint. Different content using the same request ID is rejected. Optimistic revision checks reject replies/state changes based on an outdated conversation; the typed draft stays in tab memory for deliberate refresh instead of silent overwrite.
Support drafts are NOT server-autosaved and are NOT placed in localStorage/sessionStorage. They can be lost on page reload or tab closure. Unsaved-navigation warnings are written into the UI; identity change clears the in-memory draft map. Do not describe this as guaranteed recovery from browser crashes.

## Staff scope and privacy
Existing owner role sees all support threads. Existing operator role sees only threads explicitly assigned to that account by an owner. Merely being an editor of course content does not grant access to every inquiry. Assignment changes are revisioned and checked on every RPC, including replay; clearing an assignee does not leave the previous operator authorized.
The owner can choose only existing owner/operator accounts. This is a thread assignment, not a new admin membership, role grant or invitation email.
Staff replies are visible to the member. There is no private-internal-note channel to confuse with a public reply, and a staff reply requires an explicit visibility confirmation. Labels shown to the member identify the author as support or member, not staff email, tokens or private operator IDs.
Support requests may include the user's deliberately typed explanation and a minimal owned-context snapshot: season title/slug/cohort label and/or order ID/title/status at creation. This is not a live refund status projection. Operator labels use the existing optional display name; there is no auth.users SELECT grant and no participant-email scraping.
No code reads or attaches coaching answers, drafts, reports, experiment reflections, private LIVE notes, screenshots, session tokens, complete URLs/query strings, browsing history, user agents, passwords or payment-card details. No attachments or automated PII detector are claimed. User-entered text can still include sensitive content, so both entry and reply screens warn against copying it.

## Backend source
`docs/NAL_READ_BUILD12_SUPPORT.sql` is an UNAPPLIED source specification, not a dated/applied migration.
Three private tables:
1. support_threads: owner, minimal immutable context, category, state, assignee, revision and read position.
2. support_messages: append-only conversation messages and sequence numbers.
3. support_commands: retry identity/fingerprint and actor/action/time history; message text is not duplicated here.
All have RLS, private schema and no anon/authenticated privileges. The service role receives only required operations; no delete action is exposed. All new SQL functions use SECURITY INVOKER. Two service-only public RPC wrappers select member/staff mode server-side; the client cannot turn a member call into a staff one by supplying a boolean.
The new schema intentionally does not gate support access on an active READ entitlement or READ release flag. A verified account with an expired/revoked/refunded participation can still inquire about its own records once the support feature itself is enabled. Existing Auth account eligibility checks remain; this is not anonymous support or account recovery.
The whole core uses the existing verified-subject boundary. Limits are explicit: subject 120 chars, body 4,000 chars, 10 unresolved inquiries/account, up to 3 newly created inquiries/minute and 10 messages/minute per actor, up to 1,000 messages/thread. These limits are implementation choices, not proof of production abuse resistance.
No automatic record deletion or legal retention duration is invented. The new restrict FKs deliberately require an account-deletion/retention policy to be reviewed during pre-sale integration; this build does not implement self-service erasure or export of support history.

## Endpoint contract
`supabase/functions/nal-support/` is source only. `NAL_SUPPORT_ENABLED` defaults false/unset and is independent of new READ admissions/payments. No environment was changed.
POST `{action,payload}` with a verified user bearer token. Public help is static rather than a public customer-data API. OPTIONS is limited to existing exact allowed origins. Body cap 24KiB; the handler rejects extra payload keys instead of accepting arbitrary diagnostics/context.
Member actions: contexts, list, get, create, reply, resolve, reopen, read.
Staff actions: admin-list, admin-get, admin-staff, admin-reply, admin-resolve, admin-reopen, admin-assign.
Unknown actions, invalid identifiers or stale revisions fail without executing payments or granting roles. Server RPC names are fixed; support_core is not a client-selected generic database proxy.

## Missing connection to finish before calling this usable
The existing common account request wrapper would need a narrowly scoped `support(action,payload)` method targeting nal-support, exposed as `NalAccount.support`, plus agreed menu links. The attempted change was blocked and is not part of the current tree. Do not infer it exists from the endpoint or from this note. No alternate transport was introduced to bypass that outcome.
The current source UI handles this absence visibly and sends no messages. Authorized tooling resolution of the blocked connection is required before that code path can run. Afterwards the cumulative schema/API/client deployment and pre-sale tests remain separately required; neither is performed now.

## Other known boundaries
- Old BUILD07/08 refund-inquiry records are not migrated into support threads. The static help routes actual transaction inquiry to the existing order page; the new help conversation is not a second payment engine.
- No outbound email, SMS, app push, scheduled report, auto-reply, AI service or paid helpdesk is installed.
- No actual customer inquiry/reply was sent or seeded. No SLA is promised.
- Existing BUILD11 first-season copy and weekly manuscripts, payment selector/refund-console flow, PDF assets, pricing, live schedules, participants and production main are unchanged.
- Later integration must review cumulative SQL/role/idempotency/concurrency/pagination/session/UI behavior, the undeployed source chain and historical platform QA debt. No tests were run or represented as passing now.

## Reference used for source design
https://supabase.com/docs/guides/database/postgres/row-level-security — private-schema/RLS/explicit-grant boundary.
The required changelog.md fetch returned unsupported content type; no version-specific Auth/CLI behavior was inferred. This documentation lookup was not runtime testing.
