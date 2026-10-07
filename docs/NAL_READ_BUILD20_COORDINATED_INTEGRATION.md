# BUILD20 — guarded forward assembly and one participant renderer

## Actual work
Parent 3825e1582cb3a636f233eb6d4d46102759485ef5 on feat/nal-read-v1 / Draft PR160. Added a coordinated assembler, observed baseline metadata, a guard template and real frontend route changes. No tests, hosted schema/data writes, migrations, API deployment, participant/Auth/payment exercises, new resource, role/feature change or main merge.
The full assembler was NOT run: the local runtime could not resolve GitHub for a checkout, and the download facility could not retrieve the source archive. No alternate credential extraction, remote code-execution workflow or main-branch modification was used to obtain it. There is no generated ZIP, combined SQL result, generated file-count result or invented checksum in this delivery.

## Read-only baseline observations
Connected Supabase nal-platform was read using list_projects, list_migrations, list_tables(public,nal_private) and one SELECT of seven named functions' signatures/definition hashes/prosecdef plus server major and release mode. No application function was invoked as a test, and no personal answer/message/payment contents or credentials were selected.
On 2026-10-07 the recorded READ migration history reached FIX03; listed tables did not include the checked BUILD04+ additions; server major was 17 and release control reported only off. Seven relevant baseline definitions were SECURITY INVOKER. These observations are narrower than full schema equivalence or functional verification.
The actual digital-store foundation history uses 20261004002631, whereas BUILD19's repository reference points to 20261003124325. This discrepancy is recorded, not automatically repaired, replayed or declared equivalent. BUILD20 does not replay baseline references at all.

## Real participant code changes
Eight legacy trend-2027 participant views (before/today/journey/day/try/live/my/report) now contain a lightweight entry and redirect to the generic /nal/read/open/ renderer. They no longer create their own Supabase client or directly load old BUILD04/05 edit modules. The generic entry, route parser and loader are aligned to BUILD20 labels.
New read-routes.js supplies one location-only contract for the legacy adapter and generic entry. It validates an exact allowed view, non-reserved season slug, DAY/STEP/week ranges and experiment/session identifiers. It rejects duplicate/mismatched selection and credential/payment-return parameters; only permitted location fields are copied. Legacy URL fragments other than the local skip anchor stop automatic redirection rather than forwarding unknown tokens.
The adapter uses location.replace to avoid adding a duplicate history stop. No current editor exists on that lightweight entry, so it does not discard an actively edited form during its automatic redirect. Invalid input leaves account/help exits; no other season is silently substituted. Existing Auth/payment callbacks, public product/welcome pages and original server access/DAY gates are unchanged.
Old already-cached HTML can still reference old assets until the actual coordinated host release/cache policy takes effect. A successful source edit is not a cache purge or browser verification.

## Coordinated assembler
scripts/assemble-nal-read-build20.py uses only Python standard library and fixed read-only local Git commands. It requires an exact source commit descending from BUILD19 and the committed matching assembler. The BUILD19 layer manifest must match its recorded Git blob identity. Working-tree app changes, missing remote objects, symlinks/submodules/LFS pointers and oversized input are not silently substituted.
It reads nineteen ordered source layers, retains original bytes and hashes separately, lexes their outer statement boundaries and removes exactly the first BEGIN and final COMMIT. Comments, escaped/quoted values and dollar-quoted function bodies are skipped by the boundary lexer. Unsupported outer transaction/control forms fail closed. This is not a PostgreSQL parser or runtime validation.
The generated forward candidate consists of one outer transaction, an explicit baseline guard, the source bodies in dependency order and a private integration-version function. No apply runner or Supabase migration-history repair is emitted. This is an initial FIX03-before-BUILD04 profile, not a generic replay or partial-upgrade recovery script.
The precondition template requires separate operator profile/source acknowledgement, PostgreSQL major 17, the five recorded READ migrations, matching seven baseline function hashes, a single OFF release row, no named BUILD-layer additions and no enrollments/account wrapper/integration marker. It locks release control for the transaction and uses an integration advisory lock. These are accident/drift guards, not proof of target environment identity or permission to mutate production. Exact definitions and metadata still need fresh review before actual use.
The resulting file is a candidate under private/database, not a fabricated timestamped Supabase migration. CLI-created migration registration and any actual application remain a separate authorized stage. No supabase CLI was invoked or installed here.

## Versioned public overlay and private sources
The assembler obtains public frontend and eleven existing Edge-function source groups from the same exact commit. It rewrites included first-party CSS/JS references, relative module references and the current literal dynamic-loader suffixes to a commit-derived bundle token in output only. Original repository files and original/transformed hashes are distinguished. No browser fetch interception or new Auth mechanism.
Output separates public-overlay/nal from private/edge, private/database, editorial input and reference materials. Existing STORE/PDF assets, fonts/images, runtime backend JSON and gateway/secrets are neither copied into public output nor deleted. Shared CSS/theme and PDF webhook boundaries remain reference-only. Do not deploy the package root or apply deletion-mirroring to the existing site.
The BUILD19 runtime map is copied as a reference; a new runtime-version record supplies the actual assembly commit/bundle. A minimal public read-release.json provides non-secret version metadata only. It does not report feature health or enable a flag. The code writes a new output directory and ZIP only when explicitly run; partial output retains an INCOMPLETE marker.

## Files and unchanged scope
New: read-routes.js, read-legacy-route.js, the BUILD20 assembly/baseline/guard/README files, assemble-nal-read-build20.py and this note.
Modified: read-open-context.js, read-open-loader.js, common participant entry and eight legacy entry pages.
Existing incremental SQL sources, all server endpoint implementations, shared Auth/ownership checks, payment/refund/PDF handlers, manuscripts, real dates/prices/roles/capacities and operational settings remain unchanged.
No new paid service, scheduler, AI call or background task. No actual inquiry, experiment, report, entitlement or participant created. The earlier source-to-hosted gap and deferred pre-sale QA remain; no PASS/sale-ready claim.

## Technical references
- https://www.postgresql.org/docs/17/sql-begin.html — transaction boundaries; generated assembly is deliberately a derivative, not a raw concatenation of independently committing files.
- https://supabase.com/docs/guides/deployment/database-migrations — repository sources and database migration history are distinct; the observed mismatch is not repaired automatically.
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching — commit-specific resource URLs are used in generated output, with actual host/cache release still separate.
The mandatory Supabase changelog.md fetch returned unsupported content type. No dependency version was changed or undocumented API/CLI behavior inferred. Documentation review and metadata reads are not application tests.
