# BUILD16 — participant save, navigation and recovery language

## Scope and delivery boundary
Continue feat/nal-read-v1 / Draft PR160 from 1a0a19de1192e9dee859e90eb293e00b59e471d6.
This is source implementation, not a deployed service or a completed validation phase. The owner requested product work now and tests immediately before customer sales. No test suite, lint/type run, browser session, live account/payment, hosted SQL, migration, deployment, flags, secrets, roles, price or participant records were modified or exercised. Use [skip ci]; no PASS/sale-ready claim. No paid resource, external service, new dependency, API provider or recurring task is added.

## Shared participant feedback
The existing READ shell now has one bounded, sticky feedback region near the visible page, separate from the account form at the bottom. It shows request activity, unknown/unsaved work, connection hints and operation errors. It does not copy answer contents into the notice, telemetry, a URL or a third-party service.
Existing TODAY/JOURNEY/TRY/LIVE/MY labels remain, with short Korean captions and accessible names. The current view is named in the header; a report is associated with the personal-record area while its own header link remains current.
Each editable view explains its actual saving model: DAY automatic draft + explicit answer/DAY finish, TRY manual plan/reflection saves, LIVE private manual note saves, REPORT preview/file output vs explicit stored edition. This is explanation of the existing model, not automatic saving added to TRY/LIVE/REPORT.
The feedback region uses textContent and polite atomic status messages. It does not force-focus the editor away from a participant on every background draft update. DAY validation attaches the error to the field and returns focus after the temporarily disabled controls are restored. Question/end transitions move focus to the new heading/next-action area with reduced-motion preference respected.

## Transport errors are not silent or fake empty states
The existing authenticated request function keeps the same configured Supabase host, public client key, user bearer header, request shapes, owner epoch and single Auth client. No server authorization/grants are changed.
A timeout is now a visible TimeoutError instead of an intentionally ignored navigation/session AbortError. Owner-change aborts remain silent so an old request cannot flash the previous owner's data or errors. Network/protocol failures distinguish an unreadable response from an empty record list. A write timeout explicitly means its server outcome may be unknown; it is NOT represented as proof that no write happened.
HTTP 409 asks the participant to preserve text and load the current version; it never adopts a new revision to force an old form over someone else's save. HTTP 401 offers the existing login form without immediately throwing away the local editor. HTTP 403 remains a rights/publication-state problem rather than an instruction to repeat a purchase. Limits/server failure have their own explanations. No failure is converted to a successful saved indicator.
Pending requests have explicit read/write classification. Bootstrap, workspace list reads and report source/list/open do not block navigation as mutations. Existing DAY opening is classified as a mutation because its existing server action marks progress started; this build does not change that action. While a mutation is in flight, same-tab link navigation and sign-out are held for the request result. The UI is not a database rollback/cancellation guarantee.
Native new-tab/modifier links and explicit file downloads do not discard the current editor and are left available. Hash-only moves within the current document are left alone. Browser back, app termination and browser unload prompts retain platform limitations; no crash-proof persistence is promised. beforeunload is attached only while needed, not permanently.

## DAY saving and re-entry
Current question STEP is kept in the same page address with replaceState, alongside existing season/DAY parameters. This does not add browsing-history entries or serialize answer text. A reload/revisit can therefore select the actual question rather than always returning to the start. Source DAY and step availability still come from the server; the URL never grants access.
DAY now shows the difference between a saved draft, a recorded answer, and the final '오늘 기록 마치기' action. The previous draft commit message could say today's record was finished too early; the new message explicitly reserves DAY completion for its existing final API action.
Two explicit controls are added to the existing question area: retry a failed draft save, and save the current draft then return to TODAY. Saving a draft to leave does not commit the answer, create an experiment or finish the DAY. Other unsaved work is still considered before navigation.
The local optional tab copy remains opt-in, scoped to owner/season/DAY/STEP and expiring; it is not enabled for everyone or moved to persistent localStorage. The checkbox reflects its current state after re-render. Retrieved draft state is displayed on re-entry, rather than leaving a blank save indicator.
The draft controller retains failed/ambiguous writes as work needing attention. It does not repeatedly auto-submit a held/conflicting draft on an online event. An explicit retry uses the known revision; if the earlier attempt actually saved, a conflict must be resolved rather than quietly overriding a newer record. HTTP 409 is not made retryable by choosing a fresh revision. A network-restored event is only a browser hint, not proof of server health, saved content or authentication.
A failed background experiment-list read no longer prevents an otherwise successful question/draft load. It is labelled separately as unavailable, not interpreted as no existing experiments. Authorization failures still stop that view. Source-linked creation retains BUILD15's server idempotency and is not reimplemented on the client.

## Existing flows retained
DAY -> source-linked TRY -> explicit append to private LIVE note -> immutable report editions remain unchanged on the server. The TRY/LIVE/report module files are unchanged in BUILD16; they use the revised shared request/error/dirty feedback through their existing calls. Their original explicit saving controls and data boundaries remain.
No new persistence layer, source answer copy, progress rule, LIVE join rule, attendee action, report serializer, payment/refund mechanism or support workflow is added. Account-home and common account-session code are unchanged; changes to read-session are limited to the participant presentation, feedback and existing transport.

## Asset integration
The generic /nal/read/open/ entry loads matching BUILD16 shell/session/loader and feedback CSS. Its dynamic loader detects missing new feedback methods in an old/mixed bundle and refuses to render the new module against that incompatible adapter. It keeps the existing canonical route rewrite for same-season navigation and never sends private values in links.
The shared shell can attach the feedback CSS for a legacy page when this new shell is loaded. Old direct-entry HTML cache labels are not rewritten or purged by this source task. Align/purge those assets in the coordinated pre-sale deployment; do not assume an old cached direct-entry bundle has already updated.

## Change inventory
Modified: nal/assets/js/read-session.js, nal/assets/js/read-shell.js, nal/assets/js/read-daily.js, nal/assets/js/read-open-loader.js, nal/read/open/index.html.
Added: nal/assets/css/nal-read-feedback.css and this implementation note.
No SQL, table, endpoint, Auth RPC allowlist or dependency changed. Unchanged: payment/card/provider-console refund logic, support, account home, free PDF/store, manuscripts, real schedules, capacity, prices, all hosted data, main branch.
The whole prior source-to-hosted gap remains. No validation findings are marked resolved merely by writing these files. Runtime, mobile, Auth-expiry, concurrency, mixed-cache, lost-response and accessibility checks remain at pre-sale as requested.

## Primary documentation consulted
- https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort
- https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
- https://supabase.com/docs/reference/javascript/auth-signinwithotp
The Supabase changelog.md request returned an unsupported markdown content type through the web reader. No SDK upgrade or undocumented Auth behavior was inferred. Documentation lookup is not runtime testing.

## Next bounded direction
Move away from adding isolated modules: consolidate the authored screens/content into an owner-facing start point and an explicit source integration map. Keep actual deployment, live records and the owner's deferred pre-sale validation separate rather than describing the platform as already released.
