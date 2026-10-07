# NAL BUILD09 — cohorts, capacity, waitlist, participant roster

## Source-only delivery
Continue on feat/nal-read-v1 / Draft PR160. Owner requested feature completion now and combined tests immediately before customer sales. No test runner, browser/Auth/payment exercise, CI polling/rerun, hosted SQL, Edge deployment, plan upgrade, provider request, message sending or sales activation is part of BUILD09. Commit with [skip ci]. Prior QA debt is not declared fixed. This implementation has not been integration-tested.

## Cohort model
One existing `nal_read_seasons` row is one operational cohort. `program_key` groups multiple cohort seasons. The existing CMS can copy a manuscript to a new season; this build does not move participants or personal answers between seasons and does not introduce a second, ambiguous enrollment key.
`read_cohorts` stores cohort number/label, actual course start/end, Korea time, capacity, recruitment state and wait-offer duration. Registration open/close remains in the existing `read_offers` table; avoid conflicting duplicate registration schedules. Owner must explicitly enter actual dates and capacities. No example cohort, LIVE URL, date, participant or capacity was seeded.
Saving cohort dates aligns the existing season dates for the day engine. Actual program dates cannot silently change after any applicant, order or enrollment exists. Use a new cohort or separately authorized schedule-change work. Course dates must encompass already published LIVE sessions. Editing later LIVE schedules still uses the existing editorial workflow and needs the combined pre-sale date-alignment review.
Recruitment states: draft / recruiting / paused / closed / cancelled. These are admission states, not assertions of payment refund, customer communication or learning completion. Closing/cancelling does not silently delete records, issue refunds, or revoke every existing participant's private record access.

## Customer routes
- `/nal/read/cohorts/` (optional ?program=<group>): public-safe list of configured cohorts with course dates, registration dates, capacity and availability.
- Existing `/nal/shop/read/?season=<slug>` includes the cohort name and dates; entry switches between participation, waitlist and closed/preparing state. A verified existing participant can continue directly.
- `/nal/my/waitlist/`: current account's applications only. Optional ?season=<slug> opens position, offer deadline, current participation opportunity and withdrawal.
- Common account navigation links to cohort browsing, own waitlist and owner cohort management. Owner-only routes still require server-side owner authorization.

The ordinary available-seat checkout remains the BUILD08 simple card flow. No Toss-only wallet, extra payment page, or automatic payment for a waitlisted user is introduced. Admission is enforced server-side even for a bookmarked old checkout or direct API request; UI availability is informational, not a reservation guarantee.

## Capacity calculation
Count DISTINCT account owners across:
1. Enrollments in pending / active / paused / completed state. Completed and paused participants still used a place in that cohort; do not resell that place silently.
2. Checkout orders in paid / partially_refunded / manual_review state; pending orders until their reservation expiry; pending orders with confirmation started remain committed until financial reconciliation resolves them.
3. Active time-bound waitlist offers.

One account never counts twice merely because it has an order, invitation and enrollment.
Ordinary never-confirmed expired payment reservations stop counting by timestamp; they are not assumed refunded. An uncertain confirmation or paid order does NOT release its place just because a timer elapsed. Resolve payment state using the existing merchant-console reconciliation before releasing capacity.

A cohort advisory transaction lock is obtained BEFORE existing user/request/order locks on public mutation paths. SQL inventory helpers intentionally use VOLATILE/fresh snapshots. Enrollment and checkout insertion also have admission trigger backstops. The old order/refund/expiry and non-reactivation logic is retained, not replaced.

Late paid results remain recorded as PAID. If no safe place can be delivered or the cohort is cancelled, fulfillment becomes manual_review / cohort_admission_review rather than over-enrolling, losing the payment, or charging again. Already-reserved payments can settle after registration closes; opening a new payment selector still requires the current recruitment window. New admissions require a configured cohort; unconfigured seasons fail closed.

## Waiting list
- A waitlist application is not payment, enrollment, automatic entitlement, or a delivery promise.
- One row per account/cohort. Retrying an existing waiting application does not change its rank. A withdrawn/expired application that is explicitly submitted again joins at a new time.
- Position uses joined_at and user ID as a deterministic tie-breaker. Only the caller's position is shown publicly.
- While there are waiting applicants, unreserved newcomers cannot take newly available seats ahead of them.
- Owner explicitly offers the first waiting applicant one place. The offer duration is configured by the owner, capped at the recruitment deadline and course start. Retrying the same targeted action cannot advance another person.
- The offered applicant chooses whether to proceed and accepts current participation terms; paid cohorts still require payment.
- Expired opportunities stop reserving a place. The application shows expired; it is not automatically requeued or charged.
- Offer/withdrawal cannot override an unresolved payment or an enrollment. Enrollment creation changes the waiting entry to joined within the same transaction.
- No automatic emails, SMS, push notification or scheduler is created. UI explicitly says to check MY NAL for the opportunity. Operations can communicate separately; this build does not claim it sent a notice.

## Owner participant screen
`/nal/read/admin/cohorts/`
- Existing season selector and first-time cohort setup.
- Dates, capacity, recruitment state, waitlist enable/disable and offer duration, with revision conflict protection and explicit change reason.
- Owner-only participant list, waiting list, FIFO offer/cancel controls and recent operational event history.
- Display name from the user's optional account preference, otherwise a neutral abbreviated participant reference. No Auth table SELECT or guessed email/contact identity.
- Roster includes participation status and count of recorded days, NOT question answers, journal text, LIVE reflection text, psychological scores or inferred emotional state.
- Manual LIVE attendance: unknown / present / absent / excused, tied to the same cohort and existing participant. Only a started published session can be recorded. This is owner-recorded attendance, not a deduction from the join button, and it does not mark DAY completion.
- CSV export is an explicit owner action for currently loaded participants only; UTF-8 BOM and spreadsheet formula escaping included. It does not export private reflection/answer content.

## Backend / dependency order (not executed)
Recorded FIX03 -> BUILD04 workspace -> BUILD05 editorial/report -> BUILD06 join/account -> BUILD07 payments/reconciliation/integration -> BUILD09_COHORTS.sql -> BUILD09_COHORT_ADMIN.sql -> BUILD09_ADMISSION_BRIDGES.sql.
BUILD08 remains the active simplified payment client/runtime; its source introduces no SQL layer.
New private tables: read_cohorts, read_waitlist, read_cohort_attendance, read_cohort_events. RLS + private schema, no anon/authenticated grants. No SECURITY DEFINER workaround.
The source wrappers rename prior service-only functions into private scope and recreate the original public RPC signatures with cohort guards. Existing callers keep their API names. Do not apply this schema chain partially; package it with matching clients/functions during pre-sale integration.

New `nal-read-cohorts` Edge source has a default-off NAL_COHORTS_ENABLED flag. GET exposes only constrained public cohort metadata. POST verifies Auth using the existing request-scoped boundary. The two extra Auth RPC allowlist names are nal_read_cohort_user and nal_read_cohort_admin; the latter checks the existing owner role in SQL. No generic database proxy or owner self-enrollment endpoint.

## Excluded / deferred
No new paid infrastructure or provider contracts. No actual DB records, grants, automatic message jobs, sales enablement or deployment. Capacity reservation is attached to READ checkout/enrollment, not a new standalone paid service. Existing PDF catalog, free downloads and PDF payment handlers are not edited in this build.
No cross-cohort transfer of old answers; no fabricated next-season content; no mass notification. Pre-sale verification remains necessary for the cumulative SQL chain, concurrency/late webhook scenarios, waiting list, actual Auth, date alignment, role/RLS enforcement, screen accessibility and old QA findings. This source-writing phase does not label those verified.

## Next product completion
Unify the program/cohort detail and pre-start participant screen, then finish facilitator-facing weekly content/meeting preparation inside NAL. Keep the payment flow and notifications small, and continue feature implementation rather than per-wave release audits.

## Primary technical references consulted for implementation
- https://www.postgresql.org/docs/17/explicit-locking.html
- https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase changelog.md fetch was attempted but unsupported by the documentation fetch path in this session; no version-specific migration/CLI change was inferred from it.
