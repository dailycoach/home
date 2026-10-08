begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- NAL READ BUILD33: privacy journal erasure review + disabled execution gate.
-- This migration installs code/metadata only; it does NOT call an erasure.
-- No account, financial, entitlement, complaint, storage or backup deletion is implemented.
do $guard$
begin
 perform pg_advisory_xact_lock(hashtextextended('nal-read:integration:build22',22));
 lock table nal_private.read_release_control in share row exclusive mode;
 if (select count(*) from nal_private.read_release_control) <> 1
 or exists(select 1 from nal_private.read_release_control where mode is distinct from 'off')
 then raise exception 'READ OFF required';end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='20261008035821' and name='nal_read_build32_privacy_request_boundary')
 or to_regprocedure('public.nal_read_privacy(uuid,text,jsonb)') is null
 or to_regclass('nal_private.read_privacy_requests') is null
 or to_regclass('nal_private.admins') is null
 then raise exception 'BUILD32 intake and owner baseline required';end if;
 if to_regclass('nal_private.read_privacy_journal_reviews') is not null
 or to_regclass('nal_private.read_privacy_execution_control') is not null
 or to_regclass('nal_private.read_privacy_journal_receipts') is not null
 or to_regprocedure('public.nal_read_privacy_admin(uuid,text,jsonb)') is not null
 or to_regprocedure('nal_private.read_privacy_journal_erase(uuid,uuid,uuid,text)') is not null
 then raise exception 'Privacy erasure review already exists; do not replay';end if;
 if exists(select 1 from nal_private.read_privacy_requests)
 or exists(select 1 from public.nal_read_enrollments)
 or exists(select 1 from public.nal_orders)
 then raise exception 'Live case data present; require reviewed forward integration';end if;
end $guard$;

create table nal_private.read_privacy_execution_control(
 singleton boolean primary key default true check(singleton),
 journal_erasure_enabled boolean not null default false,
 approved_policy_version text,
 enabled_at timestamptz,
 enabled_by uuid references auth.users(id),
 check (approved_policy_version is null or approved_policy_version ~ '^[a-z0-9-]{1,80}$'),
 check(not journal_erasure_enabled or
   (approved_policy_version is not null and enabled_at is not null and enabled_by is not null))
);
insert into nal_private.read_privacy_execution_control(singleton,journal_erasure_enabled)
values(true,false);
alter table nal_private.read_privacy_execution_control enable row level security;
revoke all on nal_private.read_privacy_execution_control from public,anon,authenticated,service_role;
grant select on nal_private.read_privacy_execution_control to service_role;

create table nal_private.read_privacy_journal_reviews(
 request_id uuid primary key references nal_private.read_privacy_requests(id) on delete restrict,
 reviewer_id uuid not null references auth.users(id) on delete restrict,
 state text not null default 'reviewing' check(state in ('reviewing','approved','executed','withdrawn')),
 approved_fingerprint text check(approved_fingerprint is null or approved_fingerprint ~ '^[a-f0-9]{64}$'),
 approved_counts jsonb check(approved_counts is null or jsonb_typeof(approved_counts)='object'),
 execution_nonce uuid,
 started_at timestamptz not null default now(),
 approved_at timestamptz,
 executed_at timestamptz,
 updated_at timestamptz not null default now(),
 check((state='executed')=(executed_at is not null)),
 check(state not in ('approved','executed') or
   (approved_fingerprint is not null and approved_counts is not null and
    execution_nonce is not null and approved_at is not null))
);
create index read_privacy_reviews_reviewer on nal_private.read_privacy_journal_reviews(reviewer_id,updated_at desc);
alter table nal_private.read_privacy_journal_reviews enable row level security;
revoke all on nal_private.read_privacy_journal_reviews from public,anon,authenticated,service_role;
grant select,insert,update on nal_private.read_privacy_journal_reviews to service_role;

create table nal_private.read_privacy_journal_receipts(
 request_id uuid primary key references nal_private.read_privacy_requests(id) on delete restrict,
 target_user_id uuid not null references auth.users(id) on delete restrict,
 reviewer_id uuid not null references auth.users(id) on delete restrict,
 reviewed_fingerprint text not null check(reviewed_fingerprint ~ '^[a-f0-9]{64}$'),
 before_counts jsonb not null check(jsonb_typeof(before_counts)='object'),
 deleted_counts jsonb not null check(jsonb_typeof(deleted_counts)='object'),
 remaining_counts jsonb not null check(jsonb_typeof(remaining_counts)='object'),
 receipt_hash text not null check(receipt_hash ~ '^[a-f0-9]{64}$'),
 completed_at timestamptz not null default now()
);
create index read_privacy_receipts_target on nal_private.read_privacy_journal_receipts(target_user_id,completed_at);
alter table nal_private.read_privacy_journal_receipts enable row level security;
revoke all on nal_private.read_privacy_journal_receipts from public,anon,authenticated,service_role;
grant select on nal_private.read_privacy_journal_receipts to service_role;

-- Summary never returns the subject's answers, reflections or report text.
-- Fingerprint includes row identities and modification revisions/timestamps, not contents.
create function nal_private.read_privacy_journal_plan(p_user_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $plan$
declare v_counts jsonb;v_digest text;v_derived jsonb;v_excluded jsonb;
begin
 if p_user_id is null then raise exception 'Target required' using errcode='22023';end if;
 v_counts:=jsonb_build_object(
 'answers',(select count(*) from public.nal_read_answers where user_id=p_user_id),
 'dayProgress',(select count(*) from public.nal_read_day_progress where user_id=p_user_id),
 'drafts',(select count(*) from nal_private.read_drafts where user_id=p_user_id),
 'experiments',(select count(*) from nal_private.read_experiments where user_id=p_user_id),
 'importantMarks',(select count(*) from nal_private.read_answer_marks where user_id=p_user_id),
 'reports',(select count(*) from nal_private.read_report_editions where user_id=p_user_id),
 'preparationChecks',(select count(*) from nal_private.read_preparation_checks where user_id=p_user_id),
 'liveNotes',(select count(*) from nal_private.read_live_notes where user_id=p_user_id));
 v_derived:=jsonb_build_object(
 'experimentSourceSnapshots',(select count(*) from nal_private.read_experiments where user_id=p_user_id and source_snapshot is not null),
 'reportSnapshots',(select count(*) from nal_private.read_report_editions where user_id=p_user_id and snapshot is not null),
 'reportRequestBodies',(select count(*) from nal_private.read_report_editions where user_id=p_user_id and request_body is not null));
 v_excluded:=jsonb_build_object(
 'orders',(select count(*) from public.nal_orders where user_id=p_user_id),
 'supportThreads',(select count(*) from nal_private.support_threads where user_id=p_user_id),
 'enrollments',(select count(*) from public.nal_read_enrollments where user_id=p_user_id));
 select encode(extensions.digest(convert_to(
 p_user_id::text||':'||
 coalesce((select string_agg(s.id::text||':'||md5(to_jsonb(s)::text),';' order by s.id) from public.nal_read_answers s where s.user_id=p_user_id),'')||'|'||
 coalesce((select string_agg(s.id::text||':'||md5(to_jsonb(s)::text),';' order by s.id) from public.nal_read_day_progress s where s.user_id=p_user_id),'')||'|'||
 coalesce((select string_agg(s.enrollment_id::text||':'||md5(to_jsonb(s)::text),';' order by s.enrollment_id,s.step_id) from nal_private.read_drafts s where s.user_id=p_user_id),'')||'|'||
 coalesce((select string_agg(s.id::text||':'||md5(to_jsonb(s)::text),';' order by s.id) from nal_private.read_experiments s where s.user_id=p_user_id),'')||'|'||
 coalesce((select string_agg(s.answer_id::text||':'||md5(to_jsonb(s)::text),';' order by s.answer_id) from nal_private.read_answer_marks s where s.user_id=p_user_id),'')||'|'||
 coalesce((select string_agg(s.id::text||':'||md5(to_jsonb(s)::text),';' order by s.id) from nal_private.read_report_editions s where s.user_id=p_user_id),'')||'|'||
 coalesce((select string_agg(s.enrollment_id::text||':'||md5(to_jsonb(s)::text),';' order by s.enrollment_id) from nal_private.read_preparation_checks s where s.user_id=p_user_id),'')||'|'||
 coalesce((select string_agg(s.enrollment_id::text||':'||md5(to_jsonb(s)::text),';' order by s.enrollment_id,s.session_id) from nal_private.read_live_notes s where s.user_id=p_user_id),'')
 ,'UTF8'),'sha256'),'hex') into v_digest;
 return jsonb_build_object('version',33,'scope','read-journal','counts',v_counts,
 'derivedCopyRows',v_derived,'separateForRetentionReview',v_excluded,
 'fingerprint',v_digest,'noPersonalTextIncluded',true,
 'notIncluded',jsonb_build_array('Auth','Storage','browserCache','serverLogs','backups','orderAndDisputeRetention'),
 'erasurePerformed',false);
end $plan$;
revoke all on function nal_private.read_privacy_journal_plan(uuid) from public,anon,authenticated;
grant execute on function nal_private.read_privacy_journal_plan(uuid) to service_role;

-- The only delete implementation lives in a non-exposed schema. No SQL migration invokes it.
-- It is permanently inert until a separate privileged policy approval turns control ON.
create function nal_private.read_privacy_journal_erase(
 p_request_id uuid,p_actor_id uuid,p_nonce uuid,p_fingerprint text)
returns jsonb language plpgsql volatile security definer set search_path='' as $erase$
declare
 v_req nal_private.read_privacy_requests%rowtype;
 v_review nal_private.read_privacy_journal_reviews%rowtype;
 v_control nal_private.read_privacy_execution_control%rowtype;
 v_before jsonb;v_after jsonb;v_deleted jsonb:='{}';v_receipt text;v_n integer;
begin
 if p_request_id is null or p_actor_id is null or p_nonce is null then
  raise exception 'Request, reviewer and nonce required' using errcode='22023';end if;
 select * into strict v_control from nal_private.read_privacy_execution_control where singleton for share;
 if v_control.journal_erasure_enabled is not true or v_control.approved_policy_version is null
 then raise exception 'Journal erasure is disabled pending policy approval' using errcode='42501';end if;
 if not exists(select 1 from nal_private.read_release_control where singleton and mode='off')
 then raise exception 'Maintenance requires READ OFF' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('nal-read:journal-erasure:'||p_request_id::text,333));
 -- Table-level maintenance locks prevent concurrent changes between review comparison and deletion.
 lock table public.nal_read_answers,public.nal_read_day_progress,nal_private.read_drafts,
   nal_private.read_experiments,nal_private.read_answer_marks,nal_private.read_report_editions,
   nal_private.read_preparation_checks,nal_private.read_live_notes in share row exclusive mode;
 select * into strict v_req from nal_private.read_privacy_requests where id=p_request_id for update;
 select * into strict v_review from nal_private.read_privacy_journal_reviews where request_id=p_request_id for update;
 if v_req.scope<>'read-journal' or v_req.state<>'under-review'
 or v_review.state<>'approved' or v_review.reviewer_id is distinct from p_actor_id
 or v_review.execution_nonce is distinct from p_nonce or p_nonce is null
 or v_review.approved_fingerprint is distinct from p_fingerprint
 or v_req.acknowledged_version is distinct from v_control.approved_policy_version
 or v_review.approved_at is null or v_review.approved_at<now()-interval '24 hours'
 or not exists(select 1 from nal_private.admins where user_id=p_actor_id and role='owner')
 then raise exception 'No current owner-approved, matching journal request' using errcode='42501';end if;
 v_before:=nal_private.read_privacy_journal_plan(v_req.user_id);
 if v_before->>'fingerprint' is distinct from v_review.approved_fingerprint
 or v_before->'counts' is distinct from v_review.approved_counts
 then raise exception 'Journal changed after approval; request a new review' using errcode='40001';end if;
 -- Only participant-authored journal storage, including derived reflection copies, is removed.
 delete from nal_private.read_answer_marks where user_id=v_req.user_id;
 get diagnostics v_n=row_count;v_deleted:=v_deleted||jsonb_build_object('importantMarks',v_n);
 delete from nal_private.read_report_editions where user_id=v_req.user_id;
 get diagnostics v_n=row_count;v_deleted:=v_deleted||jsonb_build_object('reports',v_n);
 delete from nal_private.read_experiments where user_id=v_req.user_id;
 get diagnostics v_n=row_count;v_deleted:=v_deleted||jsonb_build_object('experiments',v_n);
 delete from nal_private.read_live_notes where user_id=v_req.user_id;
 get diagnostics v_n=row_count;v_deleted:=v_deleted||jsonb_build_object('liveNotes',v_n);
 delete from nal_private.read_preparation_checks where user_id=v_req.user_id;
 get diagnostics v_n=row_count;v_deleted:=v_deleted||jsonb_build_object('preparationChecks',v_n);
 delete from nal_private.read_drafts where user_id=v_req.user_id;
 get diagnostics v_n=row_count;v_deleted:=v_deleted||jsonb_build_object('drafts',v_n);
 delete from public.nal_read_day_progress where user_id=v_req.user_id;
 get diagnostics v_n=row_count;v_deleted:=v_deleted||jsonb_build_object('dayProgress',v_n);
 delete from public.nal_read_answers where user_id=v_req.user_id;
 get diagnostics v_n=row_count;v_deleted:=v_deleted||jsonb_build_object('answers',v_n);
 if v_deleted is distinct from v_before->'counts' then
  raise exception 'Deletion count does not match approved scope; rolled back' using errcode='40001';end if;
 v_after:=nal_private.read_privacy_journal_plan(v_req.user_id);
 if exists(select 1 from jsonb_each_text(v_after->'counts') x where x.value::bigint<>0)
 then raise exception 'Journal records remain; rolled back' using errcode='40001';end if;
 v_receipt:=encode(extensions.digest(convert_to(
 p_request_id::text||':'||v_review.approved_fingerprint||':'||v_deleted::text||':'||
 v_after->>'fingerprint'||':'||statement_timestamp()::text,'UTF8'),'sha256'),'hex');
 insert into nal_private.read_privacy_journal_receipts(
  request_id,target_user_id,reviewer_id,reviewed_fingerprint,
  before_counts,deleted_counts,remaining_counts,receipt_hash)
 values(p_request_id,v_req.user_id,p_actor_id,v_review.approved_fingerprint,
 v_before->'counts',v_deleted,v_after->'counts',v_receipt);
 update nal_private.read_privacy_journal_reviews set state='executed',executed_at=now(),updated_at=now()
 where request_id=p_request_id;
 update nal_private.read_privacy_requests set state='fulfilled',resolved_at=now(),updated_at=now()
 where id=p_request_id;
 return jsonb_build_object('scope','read-journal','journalRowsErased',true,
  'counts',v_deleted,'receiptHash',v_receipt,
  'otherRecordsRetainedForSeparateReview',v_after->'separateForRetentionReview',
  'storageLogsBackupsAccountUntouched',true);
end $erase$;
revoke all on function nal_private.read_privacy_journal_erase(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function nal_private.read_privacy_journal_erase(uuid,uuid,uuid,text) to service_role;

create function public.nal_read_privacy_admin(p_owner_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $admin$
declare v_req nal_private.read_privacy_requests%rowtype;v_review nal_private.read_privacy_journal_reviews%rowtype;
 v_plan jsonb;v_control nal_private.read_privacy_execution_control%rowtype;v_id uuid;v_items jsonb;v_nonce uuid;
begin
 if current_user<>'service_role' or not nal_private.read_verified_subject(p_owner_id)
  or not exists(select 1 from nal_private.admins where user_id=p_owner_id and role='owner')
 then raise exception 'Verified owner required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>3000
 then raise exception 'Invalid review request' using errcode='22023';end if;
 if p_action='queue' then
  if p_payload<>'{}'::jsonb then raise exception 'Unexpected queue fields' using errcode='22023';end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.requested_at,x.id),'[]') into v_items from
   (select id,scope,state,requested_at,updated_at from nal_private.read_privacy_requests
    where state in ('requested','under-review','awaiting-retention')
    order by requested_at,id limit 50) x;
  return jsonb_build_object('requests',v_items,'limit',50,'noJournalTextIncluded',true);
 end if;
 if p_payload ? 'requestId' then v_id:=(p_payload->>'requestId')::uuid;end if;
 if v_id is null then raise exception 'Request ID required' using errcode='22023';end if;
 select * into v_req from nal_private.read_privacy_requests where id=v_id for update;
 if not found then raise exception 'Request not found' using errcode='22023';end if;
 if p_action='preview' then
  v_plan:=nal_private.read_privacy_journal_plan(v_req.user_id);
  select * into v_review from nal_private.read_privacy_journal_reviews where request_id=v_req.id;
  return jsonb_build_object('id',v_req.id,'scope',v_req.scope,'state',v_req.state,
    'plan',v_plan,'reviewState',v_review.state,'deletionPerformed',v_review.state='executed');
 end if;
 if p_action='start-review' then
  if p_payload-ARRAY['requestId','confirmed']<>'{}'::jsonb
   or p_payload->'confirmed' is distinct from 'true'::jsonb
   or v_req.scope<>'read-journal' then raise exception 'Explicit journal review required' using errcode='22023';end if;
  if v_req.state not in ('requested','under-review') then raise exception 'Request cannot be reviewed' using errcode='40001';end if;
  select * into v_review from nal_private.read_privacy_journal_reviews where request_id=v_req.id for update;
  if v_review.request_id is not null and (v_review.reviewer_id is distinct from p_owner_id
    or v_review.state not in ('reviewing','approved')) then
    raise exception 'Existing review must be handled by its owner' using errcode='42501';end if;
  if v_review.request_id is null then
    insert into nal_private.read_privacy_journal_reviews(request_id,reviewer_id)
    values(v_req.id,p_owner_id);
  end if;
  -- Keep the request withdrawable while an owner is still reviewing; mark under-review only at approval.
  return jsonb_build_object('id',v_req.id,'state','requested','reviewState','reviewing','deletionPerformed',false);
 end if;
 if p_action='approve-journal' then
  if p_payload-ARRAY['requestId','confirmed','reviewFingerprint','policyVersion']<>'{}'::jsonb
   or p_payload->'confirmed' is distinct from 'true'::jsonb then
    raise exception 'Explicit scoped approval required' using errcode='22023';end if;
  select * into v_control from nal_private.read_privacy_execution_control where singleton;
  if v_control.approved_policy_version is null or
     v_control.approved_policy_version is distinct from p_payload->>'policyVersion' or
     v_control.approved_policy_version is distinct from v_req.acknowledged_version
  then raise exception 'Approved privacy notice version missing' using errcode='42501';end if;
  select * into v_review from nal_private.read_privacy_journal_reviews where request_id=v_req.id for update;
  if v_req.scope<>'read-journal' or v_req.state<>'requested' or v_review.state<>'reviewing'
   or v_review.reviewer_id is distinct from p_owner_id
  then raise exception 'Review not ready' using errcode='40001';end if;
  v_plan:=nal_private.read_privacy_journal_plan(v_req.user_id);
  if v_plan->>'fingerprint' is distinct from p_payload->>'reviewFingerprint'
  then raise exception 'Journal changed; review again' using errcode='40001';end if;
  v_nonce:=gen_random_uuid();
  update nal_private.read_privacy_requests set state='under-review',updated_at=now() where id=v_req.id;
  update nal_private.read_privacy_journal_reviews set state='approved',
   approved_fingerprint=v_plan->>'fingerprint',approved_counts=v_plan->'counts',
   execution_nonce=v_nonce,approved_at=now(),updated_at=now() where request_id=v_req.id;
  return jsonb_build_object('id',v_req.id,'state','approved-for-maintenance',
   'nonce',v_nonce,'fingerprint',v_plan->>'fingerprint',
   'erasureEnabled',v_control.journal_erasure_enabled,'deletionPerformed',false);
 end if;
 if p_action='execute-journal' then
  if p_payload-ARRAY['requestId','confirmed','nonce','reviewFingerprint','phrase']<>'{}'::jsonb
   or p_payload->'confirmed' is distinct from 'true'::jsonb
   or p_payload->>'phrase' is distinct from 'DELETE_READ_JOURNAL'
  then raise exception 'Explicit irreversible journal approval required' using errcode='22023';end if;
  return nal_private.read_privacy_journal_erase(v_req.id,p_owner_id,
   (p_payload->>'nonce')::uuid,p_payload->>'reviewFingerprint');
 end if;
 raise exception 'Unknown privacy admin action' using errcode='22023';
end $admin$;
revoke all on function public.nal_read_privacy_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_privacy_admin(uuid,text,jsonb) to service_role;
comment on function public.nal_read_privacy_admin(uuid,text,jsonb) is
 'Owner-only planning and review for READ personal journal. Erasure separately hard-disabled by DB control. No account, payment, complaint, Storage or backup deletion. No live API route installed.';
comment on function nal_private.read_privacy_journal_erase(uuid,uuid,uuid,text) is
 'SECURITY DEFINER for scoped eight-table personal journal maintenance only. Disabled by default; requires original user request, owner-reviewed fingerprint, recent nonce, approved policy version and READ OFF.';
commit;