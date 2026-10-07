# NAL BUILD19 — pinned integration manifest and offline package generator

## Delivered source, not a generated or deployed package
Parent app snapshot: 0e2e8652212748278067c2981502174a6c109c18, tree a8c07c6d0b63f5b3cdeafdd85370edd388b1da79, feat/nal-read-v1 / Draft PR160.
BUILD19 adds six files only: manifest, runtime plan, target-evidence template, Korean handoff README, Python packaging source and this note. Existing application/SQL/function/STORE/workflow files are not edited.
The generator was authored but NOT run in this session. There is no fabricated archive path, generated checksum, packaged-file total or successful-generator claim. Git source commits are the actual delivery. No tests, linter, browser QA, hosted DB request, actual Auth/payment/support action, deployment, role/flag/key/price/schedule change or paid resource was performed. Use [skip ci]; existing owner BUILD FIRST policy remains.

## Why this is a bounded integration step
Prior builds repeatedly depended on the complete FIX03/BUILD04+ chain. This build makes that dependency a machine-readable ordered manifest and defines an offline source capsule instead of creating another app subsystem.
The manifest pins immutable source commit AND tree, not a moving branch label. The generator reads selected Git blobs from that snapshot. Its own six tool/config/doc inputs come from a recorded HEAD commit that contains the source snapshot, and it records that packaging commit separately. Uncommitted application edits are ignored; a differently edited generator is rejected, with checkout newline normalization allowed. Missing local objects are errors rather than a request to clone/fetch the repository.

## Database source order and duplicate exclusion
19 explicit increment sources are ordered:
04 workspace; 05 editorial/report; 06 join/account; 07 payments/reconciliation/integration; 09 cohorts/cohort-admin/admission-bridges; 10 guide/studio/arrival-bridge; 12 support; 14 home; 15 pathway; 17 operations; 18 context.
The manifest conservatively linearizes the documented dependency chain. Ordered IDs/required file existence are packaging-input checks, not SQL compilation, a runtime test or proof that all historical wrappers work.
Twelve existing migration paths are reference-only baseline artifacts, not a queue to apply again. The recorded FIX02 migration embeds corrected FIX01 and the guard; scheduling the old FIX01 component again is wrong. Recorded FIX03 and docs/NAL_READ_FIX03_PATCH.sql have the same Git blob identity; only the recorded migration is used as baseline reference. Wave0/Wave1 drafts and FIX01/FIX02/FIX03 component copies are named in doNotSchedule, not silently added as independent migrations.
No SQL transaction stripping, whitespace rewrite, concatenation, automated history repair or destructive down migration is produced. Each of the 19 original SQL files is copied unchanged with an ordered archive path and checksum. Schema names/function signatures are not changed by the packager.
The only described profile is an independently reviewed FIX03 baseline with no BUILD04+ increments already applied. The actual target is UNKNOWN; the generator never connects to it or concludes which sources remain unapplied. Fresh databases, partly upgraded targets and manually altered deployments require their own later reconciliation and forward migration design. No new dated migration filename is invented in this task.

## Capsule contents and provenance
The written generator is designed to produce one ZIP, a ZIP SHA-256 file and a SUMMARY.json in a newly created directory outside the repository. Existing output paths are rejected; partial writes retain INCOMPLETE.txt. ZIP entries use stable sorting, timestamps, modes and ZIP_STORED bytes for reproducibility without depending on a compression-library version. This behavior has not been executed/tested yet.
Inside: package metadata; file-level repository path/commit/Git blob/size/SHA-256; database order and baseline separation; runtime plan; source groups; the six packaging source files; blank disabled backend and target-observation templates. Checksum metadata explicitly excludes its own circular checksum entry. Byte identity is not application correctness or security assurance.
Five scoped source groups cover READ/MY NAL/operator frontend, unchanged shared CSS/theme references, eleven Edge function directories plus shared modules, manuscript input, and the existing PDF webhook handler boundary. Required sources, text-only extensions, size limits and no-symlink/no-submodule/no-LFS-pointer rules prevent silently substituting an incomplete or differently shaped object. These checks are not an automatic dependency-closure or security scanner.
Existing backend.json/staging connection files, .env, credentials/key files, gateway config, workflows, tests, fixtures, binaries, images, fonts and PDFs are not copied by the broad source selectors. No user files, private accounts or environment values are exported. The explicit groups are not a full storefront or dependency closure; the existing host keeps the shared STORE/catalog/asset dependencies.
The source capsule must not be published wholesale as a website because it also contains server/SQL code. It is not a ready-to-upload hosting directory and it contains no public URL of a newly deployed service.

## Runtime coordination without execution
runtime-plan.json maps seven functional groups to eleven existing function entrypoints and their corresponding SQL/client modules. It records known ownership/Auth boundaries and external dependencies, not deployed-health checks.
The file lists configuration NAMES without values. Proposed initial false switches and test payment mode are planning placeholders only; do not overwrite an existing live project with them. The actual project/origin/keys/callback list/gateway policy/merchant state remain unobserved. Public-safe GET, verified-user POST and payment-provider webhook need different reviewed gateway/auth handling; no blanket verify_jwt=false is introduced.
First-season manuscript, participant guide and four runbook presets remain separate editorial inputs. Importing/packaging does not save, approve, publish or schedule them. Existing READ release control still has OFF/test_only semantics in the source guard; normal customer sales require a deliberate later activation design, not just flipping an undocumented flag.
Existing PDF commerce remains separate. The READ nr_ namespace exclusion in the old PDF webhook is reference-only, not authority to deploy a lone handler or remove the PDF receiver. Matching existing provider/webhook settings must be coordinated later.
Asset cache labels are preserved, not silently normalized in source or output. Generic and legacy entrypoint alignment remains a concrete later integration requirement, along with historical QA/retention/erasure work. Packaging is not a substitute for that work.

## Generator boundaries
The Python source uses the standard library and local read-only Git commands. No DB drivers, Supabase CLI, HTTP client, package installer, frontend module import/execution, test suite, CI dispatch or deploy command. Existing local objects are required. The output directory is the only filesystem mutation intended by the generator. It does not write to the repository, apply SQL, modify environment files or assign roles.
The target-evidence template uses null/unknown, not an empty list standing in for verified zero records. It is not consumed by the tool as an executable plan. Filling a form is not permission to perform a migration, transaction or deployment.

## Files
- integration/nal-read/build19/manifest.json
- integration/nal-read/build19/runtime-plan.json
- integration/nal-read/build19/target-evidence.template.json
- integration/nal-read/build19/README.md
- scripts/package-nal-read-build19.py
- docs/NAL_READ_BUILD19_INTEGRATION.md

## Sources consulted
Repository sources: BUILD_POLICY; BUILD04_WORKSPACE header; BUILD06_ACCOUNT_JOIN dependency order; BUILD07_COMMERCE SQL/endpoint order; recorded FIX02/FIX03 migrations; current BUILD18 PR and changed-file inventory. These are source evidence, not new deployment observations.
Official references: https://supabase.com/docs/guides/deployment/database-migrations (Git source and actual DB migration history are different); https://git-scm.com/docs/git-config (read configuration and transport controls); https://docs.python.org/3/library/zipfile.html (ZIP metadata/source writing). The Supabase changelog.md request returned unsupported text/markdown in the web reader; no dependency update or version-specific Supabase feature was inferred.

## Next bounded implementation
Prepare a deliberate coordinated integration using this fixed source set: actual baseline evidence, forward-only schema delta, matched endpoint/client assets, and explicit first-cohort editorial inputs. Do not claim a host is ready merely because its source was packaged. Customer-sales QA remains deferred as requested; automatic deployment and live data writes are not part of BUILD19.
