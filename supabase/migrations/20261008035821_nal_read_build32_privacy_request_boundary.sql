begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- BUILD32: privacy request intake and personal-record inventory only.
-- No personal records are erased, anonymized, exported, or modified by this migration.
do $guard$
begin
 perform pg_advisory_xact_lock(hashtextextended('nal-read:integration:build22',22));
 lock table nal_private.read_release_control in share row exclusive mode;
 if (select count(*) from nal_private.read_release_control)<>1
  or exists(select 1 from nal_private.read_release_control where mode is distinct from 'off')
 then raise exception 'READ must remain OFF during privacy intake installation';end if;
 if not exists(select 1 from supabase_migrations.schema_migrations
      where version='20261007215922' and name='nal_read_build27_pathway_operations_context')
  or to_regprocedure('nal_private.read_verified_subject(uuid)') is null
  or to_regclass('nal_private.read_report_editions') is null
  or to_regclass('nal_private.read_experiments') is null
  or to_regclass('nal_private.support_threads') is null
 then raise exception 'Reviewed 19-layer READ baseline is required';end if;
 if to_regclass('nal_private.read_privacy_requests') is not null
  or to_regprocedure('public.nal_read_privacy(uuid,text,jsonb)') is not null
 then raise exception 'Privacy intake already exists; reconcile instead of replay';end if;
end $guard$;

create table nal_private.read_privacy_requests (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 user_id uuid not null references auth.users(id) on delete restrict,
 scope text not null check(scope in ('read-journal','account-closure-review')),
 state text not null default 'requested' check(state in ('requested','withdrawn','under-review','awaiting-retention','fulfilled','declined')),
 acknowledged_version text not null check(length(acknowledged_version) between 1 and 80),
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 resolved_at timestamptz,
 check((state in ('fulfilled','declined','withdrawn'))=(resolved_at is not null))
);
create unique index read_privacy_one_pending_scope
 on nal_private.read_privacy_requests(user_id,scope) where state='requested';
create index read_privacy_requests_user
 on nal_private.read_privacy_requests(user_id,requested_at desc);
create index read_privacy_requests_queue
 on nal_private.read_privacy_requests(state,requested_at,id);
alter table nal_private.read_privacy_requests enable row level security;
revoke all on nal_private.read_privacy_requests from public,anon,authenticated,service_role;
grant select,insert,update on nal_private.read_privacy_requests to service_role;

create function public.nal_read_privacy(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $body$
declare
  v_scope text;v_request uuid;v_row nal_private.read_privacy_requests%rowtype;
  v_total integer;v_items jsonb;v_fields text[];
begin
 if current_user<>'service_role'
  or not nal_private.read_verified_subject(p_user_id)
 then raise exception 'Verified member required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object'
   or octet_length(p_payload::text)>1800
 then raise exception 'Invalid privacy request' using errcode='22023';end if;
 if p_action='inventory' then
  if p_payload<>'{}'::jsonb then raise exception 'Unexpected inventory fields' using errcode='22023';end if;
  return jsonb_build_object(
   'schemaVersion',1,
   'scope','read-journal',
   'noTextIncluded',true,
   'privateRecords',jsonb_build_object(
    'answers',(select count(*) from public.nal_read_answers where user_id=p_user_id),
    'dayProgress',(select count(*) from public.nal_read_day_progress where user_id=p_user_id),
    'drafts',(select count(*) from nal_private.read_drafts where user_id=p_user_id),
    'experiments',(select count(*) from nal_private.read_experiments where user_id=p_user_id),
    'reports',(select count(*) from nal_private.read_report_editions where user_id=p_user_id),
    'importantMarks',(select count(*) from nal_private.read_answer_marks where user_id=p_user_id),
    'preparationChecks',(select count(*) from nal_private.read_preparation_checks where user_id=p_user_id),
    'liveNotes',(select count(*) from nal_private.read_live_notes where user_id=p_user_id)),
   'separatelyHandled',jsonb_build_object(
    'orders',(select count(*) from public.nal_orders where user_id=p_user_id),
    'supportThreads',(select count(*) from nal_private.support_threads where user_id=p_user_id),
    'enrollments',(select count(*) from public.nal_read_enrollments where user_id=p_user_id)),
   'deletionPerformed',false,
   'notice','요약 건수만 보여줍니다. 기록 삭제·탈퇴는 이 조회로 실행되지 않습니다. 결제·문의·인증 정보는 별도 보존 판단이 필요합니다.');
 end if;
 if p_action='status' then
  if p_payload<>'{}'::jsonb then raise exception 'Unexpected status fields' using errcode='22023';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
   'id',x.id,'scope',x.scope,'state',x.state,
   'requestedAt',x.requested_at,'updatedAt',x.updated_at,'resolvedAt',x.resolved_at)
   order by x.requested_at desc,x.id),'[]') into v_items
   from (select id,scope,state,requested_at,updated_at,resolved_at
    from nal_private.read_privacy_requests where user_id=p_user_id
    order by requested_at desc,id limit 30) x;
  return jsonb_build_object('requests',v_items,'deletionPerformed',false);
 end if;
 if p_action='request' then
  if p_payload-ARRAY['requestId','scope','acknowledged','version']<>'{}'::jsonb
    or p_payload->'acknowledged' is distinct from 'true'::jsonb
  then raise exception 'Explicit review-only acknowledgement required' using errcode='22023';end if;
  v_request:=(p_payload->>'requestId')::uuid;
  v_scope:=p_payload->>'scope';
  if v_request is null or v_scope not in ('read-journal','account-closure-review')
   or coalesce(p_payload->>'version','')!~'^[a-z0-9-]{1,80}$'
  then raise exception 'Unknown review request' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':privacy-request',203));
  select * into v_row from nal_private.read_privacy_requests where request_id=v_request;
  if found then
   if v_row.user_id is distinct from p_user_id or v_row.scope is distinct from v_scope
   then raise exception 'Privacy request identity reused' using errcode='23505';end if;
   return jsonb_build_object('id',v_row.id,'scope',v_row.scope,'state',v_row.state,
    'replayed',true,'deletionPerformed',false);
  end if;
  select * into v_row from nal_private.read_privacy_requests
   where user_id=p_user_id and scope=v_scope and state='requested' order by requested_at,id limit 1;
  if found then
   return jsonb_build_object('id',v_row.id,'scope',v_row.scope,'state',v_row.state,
     'alreadyPending',true,'deletionPerformed',false);
  end if;
  insert into nal_private.read_privacy_requests(request_id,user_id,scope,acknowledged_version)
   values(v_request,p_user_id,v_scope,p_payload->>'version') returning * into v_row;
  return jsonb_build_object('id',v_row.id,'scope',v_row.scope,'state',v_row.state,
   'deletionPerformed',false,
   'next','담당자가 요청 범위와 법정 보존 기록을 검토합니다. 접수는 파기 완료가 아닙니다.');
 end if;
 if p_action='withdraw' then
  if p_payload-ARRAY['id','confirmed']<>'{}'::jsonb
    or p_payload->'confirmed' is distinct from 'true'::jsonb
  then raise exception 'Explicit withdrawal confirmation required' using errcode='22023';end if;
  v_request:=(p_payload->>'id')::uuid;
  if v_request is null then raise exception 'Request identifier required' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':privacy-request',203));
  update nal_private.read_privacy_requests
   set state='withdrawn',updated_at=now(),resolved_at=now()
   where id=v_request and user_id=p_user_id and state='requested'
   returning * into v_row;
  if not found then raise exception 'Only an unreviewed request can be withdrawn' using errcode='40001';end if;
  return jsonb_build_object('id',v_row.id,'state',v_row.state,'deletionPerformed',false);
 end if;
 raise exception 'Unknown privacy action' using errcode='22023';
end $body$;
revoke all on function public.nal_read_privacy(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_privacy(uuid,text,jsonb) to service_role;
comment on function public.nal_read_privacy(uuid,text,jsonb) is
 'Intake/record count only. Does not erase user journal, linked snapshots, financial records, support tickets, Auth or backups.';
commit;