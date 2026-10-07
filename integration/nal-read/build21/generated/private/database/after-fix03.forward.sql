-- GENERATED CANDIDATE, NOT APPLIED OR TESTED. Source: 3ccdbe665435734e5eb6f40922b49ddf9d8ff54e
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- BUILD20 forward-candidate preconditions. Expanded by the offline assembler.
-- Not a standalone migration. Operator acknowledgements are accident guards,
-- not proof of environment identity or substitutes for deployment authorization.
DO $nal_build20_preconditions$
DECLARE
  signature_check jsonb;
  target_function regprocedure;
  object_name text;
  version_id text;
BEGIN
  IF current_setting('nal.integration.profile',true) IS DISTINCT FROM 'reviewed-fix03-before-build04'
     OR current_setting('nal.integration.source',true) IS DISTINCT FROM '3ccdbe665435734e5eb6f40922b49ddf9d8ff54e' THEN
    RAISE EXCEPTION 'BUILD20 requires a deliberately reviewed baseline and this exact source commit';
  END IF;
  IF current_setting('server_version_num')::integer / 10000 <> 17 THEN
    RAISE EXCEPTION 'BUILD20 baseline was observed on PostgreSQL 17; reconcile this target separately';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('nal-read:integration:build20',20));
  IF to_regclass('nal_private.read_release_control') IS NULL
     OR to_regclass('supabase_migrations.schema_migrations') IS NULL THEN
    RAISE EXCEPTION 'Recorded FIX03 baseline is missing';
  END IF;
  LOCK TABLE nal_private.read_release_control IN SHARE ROW EXCLUSIVE MODE;
  IF (SELECT count(*) FROM nal_private.read_release_control) <> 1
     OR EXISTS(SELECT 1 FROM nal_private.read_release_control WHERE mode IS DISTINCT FROM 'off') THEN
    RAISE EXCEPTION 'READ must remain OFF throughout this initial integration';
  END IF;
  FOREACH version_id IN ARRAY ARRAY['20261006095820','20261006095938','20261006101420','20261006200849','20261007024130'] LOOP
    IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations m WHERE m.version=version_id) THEN
      RAISE EXCEPTION 'Required recorded READ migration is missing: %',version_id;
    END IF;
  END LOOP;
  FOR signature_check IN SELECT value FROM jsonb_array_elements('[{"signature":"nal_private.read_claim_core(uuid, text, uuid, uuid)","definitionMd5":"34993ef41d3b2285c5a228ed80dd2abe","securityDefiner":false},{"signature":"nal_private.read_day_gate(uuid, text, integer)","definitionMd5":"a95f1a51954ece9568d69ce1a8562521","securityDefiner":false},{"signature":"nal_private.read_verified_subject(uuid)","definitionMd5":"a0848b0f06ed730f729c2ba6851949f6","securityDefiner":false},{"signature":"public.nal_get_read_access(uuid, text)","definitionMd5":"8440bbdc14e99a98c94cd114f68d7a53","securityDefiner":false},{"signature":"public.nal_issue_read_enrollment(uuid, text, uuid, uuid)","definitionMd5":"533ebea38afc8b6bbb8c823c62780f3f","securityDefiner":false},{"signature":"public.nal_read_bootstrap(uuid, text)","definitionMd5":"ba3ca631a4924ffa16aa0abd39210cf8","securityDefiner":false},{"signature":"public.nal_read_release_guard(uuid, text)","definitionMd5":"0342872d1ecaff8ab78eaac624e86321","securityDefiner":false}]'::jsonb) LOOP
    target_function:=to_regprocedure(signature_check->>'signature');
    IF target_function IS NULL THEN
      RAISE EXCEPTION 'Required baseline function is missing: %',signature_check->>'signature';
    END IF;
    IF md5(pg_get_functiondef(target_function)) IS DISTINCT FROM signature_check->>'definitionMd5'
       OR (SELECT p.prosecdef FROM pg_proc p WHERE p.oid=target_function) THEN
      RAISE EXCEPTION 'Baseline function drift; do not force this forward candidate: %',signature_check->>'signature';
    END IF;
  END LOOP;
  -- Any one of these additions means this is not the supported initial profile.
  FOREACH object_name IN ARRAY ARRAY[
    'nal_private.read_drafts','nal_private.read_experiments','nal_private.read_live_sessions',
    'nal_private.read_editorial_documents','nal_private.read_report_editions',
    'nal_private.read_offers','nal_private.account_preferences','nal_private.read_checkout_orders',
    'nal_private.read_cohorts','nal_private.read_waitlist','nal_private.read_arrival_guides',
    'nal_private.read_facilitator_plans','nal_private.support_threads'
  ] LOOP
    IF to_regclass(object_name) IS NOT NULL THEN
      RAISE EXCEPTION 'BUILD layers already present; reconcile a forward delta instead of replaying: %',object_name;
    END IF;
  END LOOP;
  IF to_regprocedure('nal_private.read_build20_integration()') IS NOT NULL
     OR to_regprocedure('public.nal_account(uuid,text,jsonb)') IS NOT NULL
     OR EXISTS(SELECT 1 FROM public.nal_read_enrollments) THEN
    RAISE EXCEPTION 'This candidate is for the unintegrated, not-yet-enrolled baseline only';
  END IF;
END
$nal_build20_preconditions$;

-- LAYER 1: docs/NAL_READ_BUILD04_WORKSPACE.sql
-- Source SHA256 fc8765130a5a5f5f1369b0f1aa278b237bdb417c93a81fd0bd7239693ed90203
-- BUILD04 implementation source. NOT APPLIED. QA and hosted activation deferred to pre-sale.
-- Depends on recorded FIX03 migration. Release gate stays OFF; no live fixtures or grants are seeded.

set local lock_timeout='5s';
set local statement_timeout='30s';

create table nal_private.read_drafts (
 user_id uuid not null references auth.users(id) on delete cascade,
 enrollment_id uuid not null references public.nal_read_enrollments(id) on delete cascade,
 day_id uuid not null references nal_private.read_days(id) on delete cascade,
 step_id uuid not null references nal_private.read_day_steps(id) on delete cascade,
 payload jsonb not null default '{}' check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=24000),
 revision integer not null default 1 check(revision>0),
 committed boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(enrollment_id,step_id)
);
create index read_drafts_owner on nal_private.read_drafts(user_id,enrollment_id,day_id);
create index read_drafts_day on nal_private.read_drafts(day_id);
create index read_drafts_step on nal_private.read_drafts(step_id);

create table nal_private.read_experiments (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 enrollment_id uuid not null references public.nal_read_enrollments(id) on delete cascade,
 week_number integer not null check(week_number between 1 and 52),
 title text not null check(length(btrim(title)) between 1 and 200),
 intention text not null default '' check(length(intention)<=2000),
 reflection text not null default '' check(length(reflection)<=5000),
 duration_hours integer not null default 72 check(duration_hours between 1 and 744),
 status text not null default 'planned' check(status in ('planned','started','paused','completed','cancelled')),
 started_at timestamptz,
 due_at timestamptz,
 completed_at timestamptz,
 revision integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index read_experiments_owner on nal_private.read_experiments(user_id,enrollment_id,updated_at desc);
create index read_experiments_enrollment on nal_private.read_experiments(enrollment_id);

-- Only editors provision schedules. Participant runtime receives read access, never schedule write.
create table nal_private.read_live_sessions (
 id uuid primary key default gen_random_uuid(),
 season_id uuid not null references public.nal_read_seasons(id) on delete cascade,
 week_number integer not null check(week_number between 1 and 52),
 title text not null check(length(title) between 1 and 160),
 opening_question text not null default '',
 starts_at timestamptz not null,ends_at timestamptz not null,
 timezone text not null default 'Asia/Seoul',
 join_url text not null check(join_url ~ '^https://([a-z0-9-]+\.)?zoom\.us/(j|my)/[^[:space:]]+$'),
 status text not null default 'draft' check(status in ('draft','published','cancelled','archived')),
 updated_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '1 day')
);
create index read_live_sessions_season on nal_private.read_live_sessions(season_id,starts_at);
create table nal_private.read_live_notes (
 user_id uuid not null references auth.users(id) on delete cascade,
 enrollment_id uuid not null references public.nal_read_enrollments(id) on delete cascade,
 session_id uuid not null references nal_private.read_live_sessions(id) on delete cascade,
 rsvp text not null default 'undecided' check(rsvp in ('undecided','yes','no','maybe')),
 before_note text not null default '' check(length(before_note)<=5000),
 after_note text not null default '' check(length(after_note)<=5000),
 join_clicked_at timestamptz,
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 primary key(enrollment_id,session_id)
);
create index read_live_notes_user on nal_private.read_live_notes(user_id);
create index read_live_notes_session on nal_private.read_live_notes(session_id);
create table nal_private.read_answer_marks (
 user_id uuid not null references auth.users(id) on delete cascade,
 enrollment_id uuid not null references public.nal_read_enrollments(id) on delete cascade,
 answer_id uuid not null references public.nal_read_answers(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(enrollment_id,answer_id)
);
create index read_answer_marks_user on nal_private.read_answer_marks(user_id);
create index read_answer_marks_answer on nal_private.read_answer_marks(answer_id);

alter table nal_private.read_drafts enable row level security;
alter table nal_private.read_experiments enable row level security;
alter table nal_private.read_live_sessions enable row level security;
alter table nal_private.read_live_notes enable row level security;
alter table nal_private.read_answer_marks enable row level security;
revoke all on nal_private.read_drafts,nal_private.read_experiments,nal_private.read_live_sessions,
 nal_private.read_live_notes,nal_private.read_answer_marks from public,anon,authenticated,service_role;
grant select,insert,update,delete on nal_private.read_drafts,nal_private.read_experiments,
 nal_private.read_live_notes,nal_private.read_answer_marks to service_role;
grant select on nal_private.read_live_sessions to service_role;

create function public.nal_read_workspace(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a jsonb; eid uuid; sid uuid; g record; step nal_private.read_day_steps%rowtype;
 dr nal_private.read_drafts%rowtype; ex nal_private.read_experiments%rowtype;
 ls nal_private.read_live_sessions%rowtype; ln nal_private.read_live_notes%rowtype;
 rid uuid; expected integer; result jsonb; items jsonb; n integer; off integer;
 next_status text; title_value text; hours_value integer; week_value integer;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>30000 then
  raise exception 'Invalid workspace payload' using errcode='22023'; end if;
 a:=public.nal_get_read_access(p_user_id,p_season_slug);
 if coalesce((a->>'allowed')::boolean,false) is not true then
  raise exception 'Read access unavailable' using errcode='42501'; end if;
 eid:=(a->>'enrollmentId')::uuid;
 select season_id into strict sid from public.nal_read_enrollments where id=eid and user_id=p_user_id;

 if p_action in ('drafts','draft-save','draft-commit') then
  select * into strict g from nal_private.read_day_gate(p_user_id,p_season_slug,(p_payload->>'dayNumber')::integer);
  if p_action='drafts' then
   select coalesce(jsonb_agg(jsonb_build_object('order',s.step_order,'payload',d.payload,
    'revision',d.revision,'committed',d.committed,'updatedAt',d.updated_at) order by s.step_order),'[]') into items
   from nal_private.read_drafts d join nal_private.read_day_steps s on s.id=d.step_id and s.day_id=d.day_id
   where d.user_id=p_user_id and d.enrollment_id=eid and d.day_id=g.day_id and s.status='published';
   return jsonb_build_object('drafts',items);
  end if;
  expected:=(p_payload->>'revision')::integer;
  if expected is null or expected<0 then raise exception 'Invalid draft revision' using errcode='22023'; end if;
  select * into step from nal_private.read_day_steps where day_id=g.day_id
   and step_order=(p_payload->>'stepOrder')::integer and status='published' for share;
  if not found or step.step_type not in ('QUESTION','MULTI_SELECT','SCALE','RECORD','TRY') then
   raise exception 'Read step unavailable' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(eid::text||':draft:'||step.id::text,4));
  select * into dr from nal_private.read_drafts where enrollment_id=eid and step_id=step.id for update;
  if coalesce(dr.revision,0)<>expected then raise exception 'Record changed in another tab' using errcode='40001'; end if;
  if p_action='draft-save' then
   if jsonb_typeof(p_payload->'value') is distinct from 'object'
    or (p_payload->'value')-ARRAY['answerText','answerJson']<>'{}'::jsonb
    or (p_payload->'value'->'answerText' is not null and jsonb_typeof(p_payload->'value'->'answerText') not in ('string','null'))
    or length(coalesce(p_payload->'value'->>'answerText',''))>5000 then
    raise exception 'Invalid draft' using errcode='22023'; end if;
   insert into nal_private.read_drafts(user_id,enrollment_id,day_id,step_id,payload)
    values(p_user_id,eid,g.day_id,step.id,p_payload->'value')
    on conflict(enrollment_id,step_id) do update set payload=excluded.payload,
     committed=false,revision=nal_private.read_drafts.revision+1,updated_at=now()
    returning * into dr;
   return jsonb_build_object('saved',true,'revision',dr.revision,'updatedAt',dr.updated_at);
  end if;
  if dr.step_id is null then raise exception 'Draft missing' using errcode='22023'; end if;
  result:=public.nal_save_read_answer(p_user_id,p_season_slug,(p_payload->>'dayNumber')::integer,
   step.step_order,dr.payload->>'answerText',nullif(dr.payload->'answerJson','null'::jsonb));
  update nal_private.read_drafts set committed=true,revision=revision+1,updated_at=now()
   where enrollment_id=eid and step_id=step.id returning * into dr;
  return result||jsonb_build_object('revision',dr.revision);
 end if;

 if p_action='experiments' then
  select coalesce(jsonb_agg(to_jsonb(t)-'user_id'-'enrollment_id' order by t.updated_at desc),'[]') into items
   from nal_private.read_experiments t where t.user_id=p_user_id and t.enrollment_id=eid;
  return jsonb_build_object('experiments',items);
 end if;
 if p_action='experiment-save' then
  rid:=(p_payload->>'id')::uuid;expected:=(p_payload->>'revision')::integer;
  if rid is null or expected is null or expected<0 then raise exception 'Invalid experiment' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(rid::text,5));
  select * into ex from nal_private.read_experiments where id=rid for update;
  if ex.id is not null and (ex.user_id<>p_user_id or ex.enrollment_id<>eid) then raise exception 'Read access unavailable' using errcode='42501'; end if;
  if coalesce(ex.revision,0)<>expected then raise exception 'Record changed in another tab' using errcode='40001'; end if;
  title_value:=btrim(p_payload->>'title');next_status:=p_payload->>'status';
  hours_value:=(p_payload->>'durationHours')::integer;week_value:=(p_payload->>'weekNumber')::integer;
  if title_value is null or length(title_value) not between 1 and 200
   or hours_value is null or hours_value not between 1 and 744 or week_value is null or week_value not between 1 and 52
   or next_status is null or next_status not in ('planned','started','paused','completed','cancelled')
   or length(coalesce(p_payload->>'intention',''))>2000 or length(coalesce(p_payload->>'reflection',''))>5000 then
   raise exception 'Invalid experiment' using errcode='22023'; end if;
  if ex.id is null and next_status not in ('planned','started') then raise exception 'Start with a plan' using errcode='22023'; end if;
  if ex.id is not null and ((ex.status='cancelled' and next_status<>'cancelled')
   or (ex.status='completed' and next_status<>'completed')
   or (ex.status='planned' and next_status='completed')) then raise exception 'Invalid experiment transition' using errcode='22023'; end if;
  if ex.id is null then
   insert into nal_private.read_experiments(id,user_id,enrollment_id,week_number,title,intention,duration_hours,status,started_at,due_at)
    values(rid,p_user_id,eid,week_value,title_value,coalesce(p_payload->>'intention',''),hours_value,next_status,
     case when next_status='started' then now() end,
     case when next_status='started' then now()+make_interval(hours=>hours_value) end) returning * into ex;
  else
   update nal_private.read_experiments set title=title_value,intention=coalesce(p_payload->>'intention',''),
    reflection=coalesce(p_payload->>'reflection',''),week_number=week_value,duration_hours=hours_value,status=next_status,
    started_at=case when next_status='started' then coalesce(started_at,now()) else started_at end,
    due_at=case when next_status='started' and ex.status in ('planned','paused') then now()+make_interval(hours=>hours_value) else due_at end,
    completed_at=case when next_status='completed' then coalesce(completed_at,now()) else completed_at end,
    revision=revision+1,updated_at=now() where id=rid returning * into ex;
  end if;
  return jsonb_build_object('saved',true,'experiment',to_jsonb(ex)-'user_id'-'enrollment_id');
 end if;

 if p_action='live' then
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'weekNumber',s.week_number,'title',s.title,
   'question',s.opening_question,'startsAt',s.starts_at,'endsAt',s.ends_at,'timezone',s.timezone,'status',s.status,
   'canJoin',s.status='published' and now()>=s.starts_at-interval '15 minutes' and now()<=s.ends_at+interval '30 minutes',
   'note',case when n.session_id is not null then to_jsonb(n)-'user_id'-'enrollment_id' else null end) order by s.starts_at),'[]')
   into items from nal_private.read_live_sessions s left join nal_private.read_live_notes n on n.session_id=s.id and n.enrollment_id=eid and n.user_id=p_user_id
   where s.season_id=sid and s.status in ('published','cancelled');
  return jsonb_build_object('sessions',items,'serverTime',now());
 end if;
 if p_action in ('live-save','live-join') then
  rid:=(p_payload->>'id')::uuid;
  select * into ls from nal_private.read_live_sessions where id=rid and season_id=sid and status='published' for share;
  if not found then raise exception 'Live session unavailable' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(eid::text||':live:'||rid::text,6));
  select * into ln from nal_private.read_live_notes where enrollment_id=eid and session_id=rid for update;
  if p_action='live-join' then
   if now()<ls.starts_at-interval '15 minutes' or now()>ls.ends_at+interval '30 minutes' then
    raise exception 'Live join window closed' using errcode='22023'; end if;
   insert into nal_private.read_live_notes(user_id,enrollment_id,session_id,join_clicked_at)
    values(p_user_id,eid,rid,now()) on conflict(enrollment_id,session_id) do update
    set join_clicked_at=coalesce(nal_private.read_live_notes.join_clicked_at,now()),revision=nal_private.read_live_notes.revision+1,updated_at=now();
   return jsonb_build_object('joinUrl',ls.join_url,'note','Join click is not confirmed attendance');
  end if;
  expected:=(p_payload->>'revision')::integer;
  if expected is null or coalesce(ln.revision,0)<>expected then raise exception 'Record changed in another tab' using errcode='40001'; end if;
  if p_payload->>'rsvp' is null or p_payload->>'rsvp' not in ('undecided','yes','no','maybe')
   or length(coalesce(p_payload->>'beforeNote',''))>5000 or length(coalesce(p_payload->>'afterNote',''))>5000 then
   raise exception 'Invalid live note' using errcode='22023'; end if;
  insert into nal_private.read_live_notes(user_id,enrollment_id,session_id,rsvp,before_note,after_note)
   values(p_user_id,eid,rid,p_payload->>'rsvp',coalesce(p_payload->>'beforeNote',''),coalesce(p_payload->>'afterNote',''))
   on conflict(enrollment_id,session_id) do update set rsvp=excluded.rsvp,before_note=excluded.before_note,
    after_note=excluded.after_note,revision=nal_private.read_live_notes.revision+1,updated_at=now() returning * into ln;
  return jsonb_build_object('saved',true,'revision',ln.revision);
 end if;

 if p_action='archive' then
  off:=coalesce((p_payload->>'offset')::integer,0);
  if off<0 or off>10000 or length(coalesce(p_payload->>'search',''))>120 then raise exception 'Invalid archive page' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc,x.id),'[]') into items from (
   select a.id,a.answer_text,a.answer_json,a.updated_at,d.day_number,d.title as day_title,s.prompt,s.step_order,
    (m.answer_id is not null) as starred
   from public.nal_read_answers a join nal_private.read_days d on d.id=a.day_id and d.season_id=sid
   join nal_private.read_day_steps s on s.id=a.step_id and s.day_id=d.id
   left join nal_private.read_answer_marks m on m.answer_id=a.id and m.enrollment_id=eid and m.user_id=p_user_id
   where a.user_id=p_user_id and a.enrollment_id=eid
    and (coalesce(p_payload->>'starred','false')<>'true' or m.answer_id is not null)
    and (coalesce(p_payload->>'search','')='' or strpos(lower(coalesce(a.answer_text,'')||' '||coalesce(s.prompt,'')),lower(p_payload->>'search'))>0)
   order by a.updated_at desc,a.id limit 51 offset off
  ) x;
  return jsonb_build_object('answers',items,'offset',off);
 end if;
 if p_action='mark' then
  rid:=(p_payload->>'id')::uuid;
  if not exists(select 1 from public.nal_read_answers where id=rid and enrollment_id=eid and user_id=p_user_id)
   or jsonb_typeof(p_payload->'starred') is distinct from 'boolean' then raise exception 'Invalid answer mark' using errcode='22023'; end if;
  if (p_payload->>'starred')::boolean then
   insert into nal_private.read_answer_marks(user_id,enrollment_id,answer_id) values(p_user_id,eid,rid) on conflict do nothing;
  else delete from nal_private.read_answer_marks where user_id=p_user_id and enrollment_id=eid and answer_id=rid; end if;
  return jsonb_build_object('saved',true);
 end if;
 raise exception 'Unknown workspace action' using errcode='22023';
end $$;
revoke all on function public.nal_read_workspace(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_workspace(uuid,text,text,jsonb) to service_role;



-- LAYER 2: docs/NAL_READ_BUILD05_EDITORIAL.sql
-- Source SHA256 88632505da60a0575781ea78a8b1835512ea978c5393176736413e4dcdd13ad4
-- BUILD05 implementation source only. NOT APPLIED.
-- Dependencies: recorded FIX03 + docs/NAL_READ_BUILD04_WORKSPACE.sql.
-- No seed, new admin membership, user data or release activation.

set local lock_timeout='5s';set local statement_timeout='30s';
alter table nal_private.read_day_steps add column if not exists content_key text;
alter table nal_private.read_day_steps add column if not exists measure_key text;
alter table nal_private.read_day_steps add column if not exists measure_version text;
alter table nal_private.read_day_steps add column if not exists report_key text;
create table nal_private.read_editorial_documents(
 id uuid primary key default gen_random_uuid(),
 season_id uuid not null unique references public.nal_read_seasons(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 state text not null default 'draft' check(state in ('draft','review','approved','published')),
 source jsonb not null check(jsonb_typeof(source)='object' and octet_length(source::text)<=600000),
 approved_revision integer,approved_by uuid references auth.users(id),approved_at timestamptz,
 published_revision integer,published_at timestamptz,
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
create table nal_private.read_editorial_history(
 id uuid primary key default gen_random_uuid(),document_id uuid not null references nal_private.read_editorial_documents(id) on delete restrict,
 revision integer not null,event text not null,source jsonb not null,actor_id uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index read_editorial_history_document on nal_private.read_editorial_history(document_id,created_at desc);
create index read_editorial_history_actor on nal_private.read_editorial_history(actor_id);
create index read_editorial_documents_actor on nal_private.read_editorial_documents(updated_by);
create index read_editorial_documents_approver on nal_private.read_editorial_documents(approved_by);
alter table nal_private.read_editorial_documents enable row level security;
alter table nal_private.read_editorial_history enable row level security;
revoke all on nal_private.read_editorial_documents,nal_private.read_editorial_history from public,anon,authenticated,service_role;
grant select,insert,update on nal_private.read_editorial_documents to service_role;
grant select,insert on nal_private.read_editorial_history to service_role;
grant select on nal_private.admins to service_role;
grant insert,update on nal_private.read_live_sessions to service_role;

create function nal_private.read_manifest_check(doc jsonb,complete boolean default false)
returns void language plpgsql immutable security invoker set search_path='' as $$
declare day_doc jsonb;step_doc jsonb;week_doc jsonb;n integer;step_keys text[];numbers integer[]:='{}';week_numbers integer[]:='{}';week_slugs text[]:='{}';
begin
 if doc is null or jsonb_typeof(doc)<>'object' or octet_length(doc::text)>550000
  or doc->'schemaVersion' is distinct from '2'::jsonb or doc->'season'->'totalDays' is distinct from '28'::jsonb
  or coalesce(doc->'season'->>'slug','')!~'^[a-z0-9-]{1,120}$'
  or length(btrim(coalesce(doc->'season'->>'title',''))) not between 1 and 120 then
  raise exception 'Manifest requires schema 2 and a 28-day season' using errcode='22023';end if;
 if jsonb_typeof(doc->'weeks') is distinct from 'array' or jsonb_typeof(doc->'days') is distinct from 'array' then
  raise exception 'Weeks and days must be arrays' using errcode='22023';end if;
 if jsonb_array_length(doc->'weeks')<>4 or jsonb_array_length(doc->'days')<>29 then
  raise exception 'Four weeks and DAY 0-28 required' using errcode='22023';end if;
 for week_doc in select j.value from jsonb_array_elements(doc->'weeks') j loop
  if jsonb_typeof(week_doc->'number') is distinct from 'number' then raise exception 'Invalid week' using errcode='22023';end if;
  n:=(week_doc->>'number')::integer;
  if n not between 1 and 4 or n=any(week_numbers) or coalesce(week_doc->>'slug','')!~'^[a-z0-9-]{1,120}$'
   or week_doc->>'slug'=any(week_slugs) or length(btrim(coalesce(week_doc->>'title',''))) not between 1 and 120 then
   raise exception 'Invalid or duplicate week' using errcode='22023';end if;
  week_numbers:=array_append(week_numbers,n);week_slugs:=array_append(week_slugs,week_doc->>'slug');
 end loop;
 for day_doc in select j.value from jsonb_array_elements(doc->'days') j loop
  if jsonb_typeof(day_doc->'number') is distinct from 'number' then raise exception 'Invalid DAY' using errcode='22023';end if;
  n:=(day_doc->>'number')::integer;
  if n not between 0 and 28 or n=any(numbers) or length(btrim(coalesce(day_doc->>'title',''))) not between 1 and 160
   or coalesce(day_doc->>'type','') not in ('before','daily','try','live','final')
   or coalesce((day_doc->>'minutes')::integer,0) not between 1 and 180
   or (n=0 and day_doc->'week' is distinct from 'null'::jsonb)
   or (n>0 and not coalesce((day_doc->>'week')::integer=any(week_numbers),false)) then
   raise exception 'Invalid DAY structure' using errcode='22023';end if;
  if jsonb_typeof(day_doc->'steps') is distinct from 'array' then raise exception 'STEP array required' using errcode='22023';end if;
  if jsonb_array_length(day_doc->'steps') not between 1 and 100 then raise exception 'STEP count outside range' using errcode='22023';end if;
  numbers:=array_append(numbers,n);step_keys:='{}';
  for step_doc in select j.value from jsonb_array_elements(day_doc->'steps') j loop
   if coalesce(step_doc->>'key','')!~'^[a-z0-9-]{1,120}$' or step_doc->>'key'=any(step_keys)
    or coalesce(step_doc->>'type','') not in ('HOOK','IDEA','MIRROR','QUESTION','MULTI_SELECT','SCALE','TRY','RECORD','LIVE')
    or (step_doc ? 'required' and jsonb_typeof(step_doc->'required')<>'boolean')
    or (step_doc ? 'content' and jsonb_typeof(step_doc->'content')<>'string')
    or (step_doc ? 'prompt' and jsonb_typeof(step_doc->'prompt')<>'string')
    or length(coalesce(step_doc->>'content',''))>4000 or length(coalesce(step_doc->>'prompt',''))>1000
    or length(coalesce(step_doc->>'placeholder',''))>1000 then raise exception 'Invalid STEP structure' using errcode='22023';end if;
   step_keys:=array_append(step_keys,step_doc->>'key');
   if step_doc->>'type' in ('QUESTION','SCALE','MULTI_SELECT','TRY') and length(btrim(coalesce(step_doc->>'prompt','')))=0 then
    raise exception 'Question prompt missing' using errcode='22023';end if;
   if step_doc->>'type' not in ('QUESTION','SCALE','MULTI_SELECT','TRY') and coalesce((step_doc->>'required')::boolean,false) then
    raise exception 'Display STEP cannot require an answer' using errcode='22023';end if;
   if step_doc->>'type'='MULTI_SELECT' then
    if jsonb_typeof(step_doc->'options') is distinct from 'array' then raise exception 'Choice array required' using errcode='22023';end if;
    if jsonb_array_length(step_doc->'options') not between 1 and 30 then raise exception 'Choice options missing' using errcode='22023';end if;
    if exists(select 1 from jsonb_array_elements(step_doc->'options') x(choice) where jsonb_typeof(x.choice)<>'string' or length(btrim(x.choice#>>'{}')) not between 1 and 160)
     or (select count(*)<>count(distinct x.value) from jsonb_array_elements(step_doc->'options') x) then raise exception 'Invalid choices' using errcode='22023';end if;
   end if;
   if step_doc ? 'measureKey' and (step_doc->>'type'<>'SCALE' or n not in (0,28) or coalesce(step_doc->>'measureKey','')!~'^[a-z0-9-]{1,120}$'
    or coalesce(step_doc->>'measureVersion','')!~'^[a-z0-9-]{1,120}$') then raise exception 'Invalid comparison key' using errcode='22023';end if;
   if step_doc ? 'reportKey' and coalesce(step_doc->>'reportKey','')!~'^[a-z0-9-]{1,120}$' then raise exception 'Invalid report key' using errcode='22023';end if;
  end loop;
 end loop;
 if complete and exists(
  select 1 from jsonb_array_elements(doc->'days') jd(day_json)
   cross join lateral jsonb_array_elements(jd.day_json->'steps') js(step_json)
  where js.step_json ? 'measureKey' group by js.step_json->>'measureKey',js.step_json->>'measureVersion'
  having count(*)<>2 or count(distinct jd.day_json->>'number')<>2 or count(distinct js.step_json->>'prompt')<>1
 ) then raise exception 'Before/after questions must match exactly' using errcode='22023';end if;
end $$;
revoke all on function nal_private.read_manifest_check(jsonb,boolean) from public,anon,authenticated;
grant execute on function nal_private.read_manifest_check(jsonb,boolean) to service_role;

create function public.nal_read_editorial(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor_role text;season public.nal_read_seasons%rowtype;doc nal_private.read_editorial_documents%rowtype;
 src jsonb;item jsonb;daydoc jsonb;stepdoc jsonb;wid uuid;did uuid;expected integer;i integer;result jsonb;rid uuid;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified editor required' using errcode='42501';end if;
 select a.role into actor_role from nal_private.admins a where a.user_id=p_user_id;
 if actor_role is null or actor_role not in ('owner','operator') then raise exception 'Editor role required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>600000 then raise exception 'Invalid editor request' using errcode='22023';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'title',s.title,'seasonStatus',s.status,'revision',coalesce(d.revision,0),
   'state',coalesce(d.state,'empty'),'updatedAt',d.updated_at) order by s.created_at desc),'[]') into result
   from public.nal_read_seasons s left join nal_private.read_editorial_documents d on d.season_id=s.id;
  return jsonb_build_object('role',actor_role,'seasons',result);
 end if;
 if coalesce(p_season_slug,'')!~'^[a-z0-9-]{1,120}$' then raise exception 'Invalid season' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('read-editorial:'||p_season_slug,9));
 select * into season from public.nal_read_seasons where slug=p_season_slug for update;
 if p_action='save' then
  src:=p_payload->'source';perform nal_private.read_manifest_check(src,false);
  if src->'season'->>'slug' is distinct from p_season_slug then raise exception 'Season mismatch' using errcode='22023';end if;
  expected:=(p_payload->>'revision')::integer;
  if expected is null or expected<0 then raise exception 'Revision required' using errcode='22023';end if;
  if season.id is null then
   if expected<>0 then raise exception 'Document changed' using errcode='40001';end if;
   insert into public.nal_read_seasons(slug,title,subtitle,status) values(p_season_slug,src->'season'->>'title',src->'season'->>'subtitle','draft') returning * into season;
  end if;
  select * into doc from nal_private.read_editorial_documents where season_id=season.id for update;
  if coalesce(doc.revision,0)<>expected then raise exception 'Document changed' using errcode='40001';end if;
  if doc.id is null then
   insert into nal_private.read_editorial_documents(season_id,source,updated_by) values(season.id,src,p_user_id) returning * into doc;
  else
   update nal_private.read_editorial_documents set source=src,revision=revision+1,state='draft',approved_revision=null,
    approved_by=null,approved_at=null,updated_by=p_user_id,updated_at=now() where id=doc.id returning * into doc;
  end if;
  insert into nal_private.read_editorial_history(document_id,revision,event,source,actor_id) values(doc.id,doc.revision,'saved',doc.source,p_user_id);
  return jsonb_build_object('revision',doc.revision,'state',doc.state,'source',doc.source);
 end if;
 if season.id is null then raise exception 'Season missing' using errcode='22023';end if;
 select * into doc from nal_private.read_editorial_documents where season_id=season.id for update;
 if p_action='get' then
  return jsonb_build_object('role',actor_role,'revision',coalesce(doc.revision,0),'state',coalesce(doc.state,'empty'),'source',doc.source,
   'liveSessions',(select coalesce(jsonb_agg(to_jsonb(l) order by l.starts_at),'[]') from nal_private.read_live_sessions l where l.season_id=season.id));
 end if;
 if p_action='history' then
  return jsonb_build_object('history',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') from (
   select id,revision,event,created_at from nal_private.read_editorial_history where document_id=doc.id order by created_at desc limit 100) x));
 end if;
 if p_action='history-open' then
  select h.source into result from nal_private.read_editorial_history h where h.id=(p_payload->>'id')::uuid and h.document_id=doc.id;
  if result is null then raise exception 'History missing' using errcode='22023';end if;
  return jsonb_build_object('source',result);
 end if;
 if p_action='schedule-save' then
  if actor_role<>'owner' then raise exception 'Owner approval required' using errcode='42501';end if;
  rid:=(p_payload->>'id')::uuid;
  if rid is null or coalesce((p_payload->>'weekNumber')::integer,0) not between 1 and 4
   or coalesce(p_payload->>'status','') not in ('draft','published','cancelled')
   or length(btrim(coalesce(p_payload->>'title',''))) not between 1 and 160
   or length(coalesce(p_payload->>'question',''))>4000 or length(coalesce(p_payload->>'joinUrl',''))>1200 then
   raise exception 'Invalid schedule' using errcode='22023';end if;
  if exists(select 1 from nal_private.read_live_sessions l where l.id=rid and l.season_id<>season.id) then raise exception 'Schedule ownership mismatch' using errcode='42501';end if;
  if exists(select 1 from nal_private.read_live_sessions l where l.id=rid and l.updated_at is distinct from (p_payload->>'updatedAt')::timestamptz) then
   raise exception 'Schedule changed' using errcode='40001';end if;
  insert into nal_private.read_live_sessions(id,season_id,week_number,title,opening_question,starts_at,ends_at,join_url,status)
   values(rid,season.id,(p_payload->>'weekNumber')::integer,p_payload->>'title',coalesce(p_payload->>'question',''),
   (p_payload->>'startsAt')::timestamptz,(p_payload->>'endsAt')::timestamptz,p_payload->>'joinUrl',p_payload->>'status')
   on conflict(id) do update set week_number=excluded.week_number,title=excluded.title,opening_question=excluded.opening_question,
    starts_at=excluded.starts_at,ends_at=excluded.ends_at,join_url=excluded.join_url,status=excluded.status,updated_at=now();
  insert into nal_private.read_editorial_history(document_id,revision,event,source,actor_id)
   select doc.id,doc.revision,'schedule-changed',jsonb_build_object('id',rid,'status',p_payload->>'status'),p_user_id where doc.id is not null;
  return jsonb_build_object('saved',true);
 end if;
 if doc.id is null then raise exception 'Save manuscript first' using errcode='22023';end if;
 expected:=(p_payload->>'revision')::integer;
 if expected is null or doc.revision<>expected then raise exception 'Document changed' using errcode='40001';end if;
 if p_action='review' then
  if doc.state<>'draft' then raise exception 'Only drafts can request review' using errcode='22023';end if;
  perform nal_private.read_manifest_check(doc.source,true);
  update nal_private.read_editorial_documents set state='review',updated_by=p_user_id,updated_at=now() where id=doc.id;
 elsif p_action='approve' then
  if actor_role<>'owner' then raise exception 'Owner approval required' using errcode='42501';end if;
  if doc.state<>'review' or p_payload->'sourceReviewed' is distinct from 'true'::jsonb then raise exception 'Content and source review required' using errcode='22023';end if;
  perform nal_private.read_manifest_check(doc.source,true);
  update nal_private.read_editorial_documents set state='approved',approved_revision=revision,approved_by=p_user_id,approved_at=now(),updated_at=now() where id=doc.id;
 elsif p_action='publish' then
  if actor_role<>'owner' then raise exception 'Owner approval required' using errcode='42501';end if;
  if doc.state<>'approved' or doc.approved_revision is distinct from doc.revision or p_payload->>'confirmSlug' is distinct from p_season_slug then
   raise exception 'Explicit approved-version confirmation required' using errcode='22023';end if;
  if (select mode from nal_private.read_release_control) is distinct from 'off' then raise exception 'Turn READ OFF before changing content' using errcode='42501';end if;
  if exists(select 1 from public.nal_read_enrollments e where e.season_id=season.id) then
   raise exception 'Season already enrolled; clone for the next cohort' using errcode='22023';end if;
  perform nal_private.read_manifest_check(doc.source,true);
  update nal_private.read_day_steps set status='archived' where day_id in(select d.id from nal_private.read_days d where d.season_id=season.id);
  update nal_private.read_days set status='archived' where season_id=season.id;
  update nal_private.read_weeks set status='archived' where season_id=season.id;
  for item in select j.value from jsonb_array_elements(doc.source->'weeks') j loop
   insert into nal_private.read_weeks(season_id,week_number,slug,title,subtitle,status)
    values(season.id,(item->>'number')::integer,item->>'slug',item->>'title',item->>'subtitle','published')
    on conflict(season_id,week_number) do update set slug=excluded.slug,title=excluded.title,subtitle=excluded.subtitle,status='published';
  end loop;
  for daydoc in select j.value from jsonb_array_elements(doc.source->'days') j loop
   wid:=null;
   if daydoc->'week'<>'null'::jsonb then select w.id into wid from nal_private.read_weeks w where w.season_id=season.id and w.week_number=(daydoc->>'week')::integer;end if;
   insert into nal_private.read_days(season_id,week_id,day_number,title,day_type,estimated_minutes,status)
    values(season.id,wid,(daydoc->>'number')::integer,daydoc->>'title',daydoc->>'type',(daydoc->>'minutes')::integer,'published')
    on conflict(season_id,day_number) do update set week_id=excluded.week_id,title=excluded.title,day_type=excluded.day_type,estimated_minutes=excluded.estimated_minutes,status='published'
    returning id into did;
   i:=0;
   for stepdoc in select j.value from jsonb_array_elements(daydoc->'steps') j loop
    i:=i+1;
    insert into nal_private.read_day_steps(day_id,step_order,step_type,content,prompt,placeholder,options,required,status,content_key,measure_key,measure_version,report_key)
     values(did,i,stepdoc->>'type',stepdoc->>'content',stepdoc->>'prompt',coalesce(stepdoc->>'placeholder','한 문장이어도 충분합니다.'),
      stepdoc->'options',coalesce((stepdoc->>'required')::boolean,false),'published',stepdoc->>'key',stepdoc->>'measureKey',stepdoc->>'measureVersion',stepdoc->>'reportKey')
     on conflict(day_id,step_order) do update set step_type=excluded.step_type,content=excluded.content,prompt=excluded.prompt,placeholder=excluded.placeholder,
      options=excluded.options,required=excluded.required,status='published',content_key=excluded.content_key,measure_key=excluded.measure_key,measure_version=excluded.measure_version,report_key=excluded.report_key;
   end loop;
  end loop;
  update public.nal_read_seasons set title=doc.source->'season'->>'title',subtitle=doc.source->'season'->>'subtitle' where id=season.id;
  update nal_private.read_editorial_documents set state='published',published_revision=revision,published_at=now(),updated_at=now() where id=doc.id;
 else raise exception 'Unknown editorial action' using errcode='22023';end if;
 insert into nal_private.read_editorial_history(document_id,revision,event,source,actor_id) values(doc.id,doc.revision,p_action,doc.source,p_user_id);
 return jsonb_build_object('revision',doc.revision,'state',(select d.state from nal_private.read_editorial_documents d where d.id=doc.id),
  'readActivated',false,'note','Content publication does not enable enrollment, payments or READ access');
end $$;
revoke all on function public.nal_read_editorial(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_editorial(uuid,text,text,jsonb) to service_role;



-- LAYER 3: docs/NAL_READ_BUILD05_REPORT.sql
-- Source SHA256 a8992b0df6a7f8d91e99da6f2ea5ab836757f52fa5e6dea85da9e9bfee04851a
-- BUILD05 source only. Unapplied. Depends on BUILD04 workspace and BUILD05 editorial columns.

set local lock_timeout='5s';set local statement_timeout='30s';
create table nal_private.read_report_editions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 enrollment_id uuid not null references public.nal_read_enrollments(id) on delete cascade,
 request_id uuid not null,request_body jsonb not null,
 snapshot jsonb not null check(octet_length(snapshot::text)<=2000000),
 created_at timestamptz not null default now(),unique(enrollment_id,request_id)
);
create index read_report_editions_owner on nal_private.read_report_editions(user_id,enrollment_id,created_at desc);
alter table nal_private.read_report_editions enable row level security;
revoke all on nal_private.read_report_editions from public,anon,authenticated,service_role;
grant select,insert on nal_private.read_report_editions to service_role;

create function public.nal_read_report(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a jsonb;eid uuid;sid uuid;answers jsonb;tries jsonb;lives jsonb;progress jsonb;snap jsonb;config jsonb;
 edition nal_private.read_report_editions%rowtype;sel jsonb;completed integer;request uuid;answer_count integer;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>24000 then raise exception 'Invalid report request' using errcode='22023';end if;
 a:=public.nal_get_read_access(p_user_id,p_season_slug);
 if coalesce((a->>'allowed')::boolean,false) is not true then raise exception 'Read access unavailable' using errcode='42501';end if;
 eid:=(a->>'enrollmentId')::uuid;select season_id into strict sid from public.nal_read_enrollments where id=eid and user_id=p_user_id;
 if p_action='list' then
  return jsonb_build_object('editions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') from (
   select id,created_at,snapshot->'cover'->>'title' as title,snapshot->>'stage' as stage
   from nal_private.read_report_editions where user_id=p_user_id and enrollment_id=eid order by created_at desc limit 50) x));
 end if;
 if p_action='open' then
  select * into edition from nal_private.read_report_editions where id=(p_payload->>'id')::uuid and user_id=p_user_id and enrollment_id=eid;
  if not found then raise exception 'Report not found' using errcode='42501';end if;
  return jsonb_build_object('id',edition.id,'snapshot',edition.snapshot);
 end if;
 if p_action not in ('source','save') then raise exception 'Unknown report action' using errcode='22023';end if;
 if p_action='save' then
  request:=(p_payload->>'requestId')::uuid;
  if request is null then raise exception 'Request id required' using errcode='22023';end if;
  config:=p_payload-'requestId';sel:=coalesce(config->'selectedAnswerIds','[]');
  if jsonb_typeof(sel)<>'array' or jsonb_array_length(sel)>12
   or length(btrim(coalesce(config->>'title','')) ) not between 1 and 120
   or length(coalesce(config->>'displayName',''))>80 or length(coalesce(config->>'closingNote',''))>3000 then
   raise exception 'Invalid report cover or selection' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements_text(sel) selected where not exists(
   select 1 from public.nal_read_answers x where x.id=selected::uuid and x.user_id=p_user_id and x.enrollment_id=eid)) then
   raise exception 'Selected answer unavailable' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(eid::text||':report',10));
  select * into edition from nal_private.read_report_editions where enrollment_id=eid and request_id=request;
  if found then
   if edition.request_body<>config then raise exception 'Request id reused' using errcode='23505';end if;
   return jsonb_build_object('id',edition.id,'snapshot',edition.snapshot);
  end if;
  if (select count(*) from nal_private.read_report_editions where enrollment_id=eid)>=30 then
   raise exception 'Report edition limit reached' using errcode='22023';end if;
 end if;
 select count(*) into answer_count from public.nal_read_answers where user_id=p_user_id and enrollment_id=eid;
 if answer_count>1500 then raise exception 'Report too large; contact operator' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'dayNumber',d.day_number,'dayTitle',d.title,'stepOrder',s.step_order,
  'type',s.step_type,'prompt',s.prompt,'text',x.answer_text,'value',x.answer_json,'measureKey',s.measure_key,
  'measureVersion',s.measure_version,'reportKey',s.report_key,'starred',m.answer_id is not null,'updatedAt',x.updated_at)
  order by d.day_number,s.step_order),'[]') into answers
  from public.nal_read_answers x join nal_private.read_days d on d.id=x.day_id and d.season_id=sid
  join nal_private.read_day_steps s on s.id=x.step_id and s.day_id=d.id
  left join nal_private.read_answer_marks m on m.answer_id=x.id and m.enrollment_id=eid and m.user_id=p_user_id
  where x.user_id=p_user_id and x.enrollment_id=eid;
 select coalesce(jsonb_agg(to_jsonb(x)-'user_id'-'enrollment_id' order by x.week_number,x.created_at),'[]') into tries
  from nal_private.read_experiments x where x.user_id=p_user_id and x.enrollment_id=eid;
 select coalesce(jsonb_agg(jsonb_build_object('weekNumber',l.week_number,'title',l.title,'startsAt',l.starts_at,
  'beforeNote',n.before_note,'afterNote',n.after_note,'rsvp',n.rsvp) order by l.starts_at),'[]') into lives
  from nal_private.read_live_notes n join nal_private.read_live_sessions l on l.id=n.session_id and l.season_id=sid
  where n.user_id=p_user_id and n.enrollment_id=eid;
 select coalesce(jsonb_agg(jsonb_build_object('dayNumber',d.day_number,'status',p.status,'completedAt',p.completed_at) order by d.day_number),'[]'),
  count(*) filter(where p.status='completed' and d.day_number between 1 and 28) into progress,completed
  from public.nal_read_day_progress p join nal_private.read_days d on d.id=p.day_id and d.season_id=sid
  where p.user_id=p_user_id and p.enrollment_id=eid;
 snap:=jsonb_build_object('schemaVersion',1,'seasonSlug',p_season_slug,
  'seasonTitle',(select title from public.nal_read_seasons where id=sid),'generatedAt',statement_timestamp(),
  'stage',case when completed=28 then 'complete' else 'in_progress' end,'completedDays',completed,'plannedDays',28,
  'answers',answers,'experiments',tries,'liveNotes',lives,'progress',progress,
  'notice','내가 작성한 기록을 모은 리포트입니다. 심리검사 결과나 프로그램 효과 측정이 아닙니다.');
 if p_action='source' then return jsonb_build_object('snapshot',snap);end if;
 snap:=snap||jsonb_build_object('cover',jsonb_build_object('title',config->>'title','displayName',coalesce(config->>'displayName',''),
  'closingNote',coalesce(config->>'closingNote','')),'selectedAnswerIds',sel);
 insert into nal_private.read_report_editions(user_id,enrollment_id,request_id,request_body,snapshot)
  values(p_user_id,eid,request,config,snap) returning * into edition;
 return jsonb_build_object('id',edition.id,'snapshot',edition.snapshot);
end $$;
revoke all on function public.nal_read_report(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_report(uuid,text,text,jsonb) to service_role;



-- LAYER 4: docs/NAL_READ_BUILD06_JOIN.sql
-- Source SHA256 d227dda9aa95ed89cac3578da0cb77a221b7479cf9d04180b6bbe566be2c4995
-- BUILD06 source only, UNAPPLIED. Requires BUILD04 + BUILD05 sources and FIX03.
-- READ offer metadata never changes PDF delivery, catalog prices, provider keys, or the release switch.

set local lock_timeout='5s';set local statement_timeout='30s';
create table nal_private.read_offers(
 season_id uuid primary key references public.nal_read_seasons(id) on delete cascade,
 catalog_kind text not null default 'products' check(catalog_kind='products'),catalog_id text not null,
 mode text not null check(mode in ('paid','free','invitation')),
 status text not null default 'draft' check(status in ('draft','listed','accepting','closed')),
 summary text not null default '' check(length(summary)<=1200),
 policy_version text not null check(length(policy_version) between 1 and 80),
 participation_notice text not null check(length(btrim(participation_notice)) between 1 and 8000),
 starts_at timestamptz,ends_at timestamptz,
 access_days integer check(access_days between 1 and 3660),
 revision integer not null default 1,updated_at timestamptz not null default now(),
 foreign key(catalog_kind,catalog_id) references public.nal_catalog(kind,id),unique(catalog_kind,catalog_id),
 check(ends_at is null or starts_at is null or ends_at>starts_at)
);
create table nal_private.read_join_receipts(
 request_id uuid primary key,user_id uuid not null references auth.users(id),
 season_id uuid not null references public.nal_read_seasons(id),
 enrollment_id uuid not null references public.nal_read_enrollments(id),
 order_id uuid references public.nal_orders(id),source text not null check(source in ('paid','free','invitation')),
 accepted_policy text not null,notice_snapshot text not null,created_at timestamptz not null default now()
);
create index read_join_receipts_owner on nal_private.read_join_receipts(user_id,season_id);
create index read_join_receipts_enrollment on nal_private.read_join_receipts(enrollment_id);
create index read_join_receipts_order on nal_private.read_join_receipts(order_id);
create table nal_private.read_onboarding(
 enrollment_id uuid primary key references public.nal_read_enrollments(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 completed_at timestamptz not null default now()
);
create index read_onboarding_user on nal_private.read_onboarding(user_id);
alter table nal_private.read_offers enable row level security;
alter table nal_private.read_join_receipts enable row level security;
alter table nal_private.read_onboarding enable row level security;
revoke all on nal_private.read_offers,nal_private.read_join_receipts,nal_private.read_onboarding from public,anon,authenticated,service_role;
grant select,insert,update on nal_private.read_offers to service_role;
grant select,insert on nal_private.read_join_receipts,nal_private.read_onboarding to service_role;

create function public.nal_read_offers(p_slug text default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('offers',coalesce(jsonb_agg(jsonb_build_object('seasonSlug',s.slug,'title',s.title,
  'summary',f.summary,'mode',f.mode,'status',f.status,'productId',f.catalog_id,
  'price',case when jsonb_typeof(c.body->'price')='number' then c.body->'price' else null end,
  'policyVersion',f.policy_version,'notice',f.participation_notice,'startsAt',f.starts_at,'endsAt',f.ends_at,
  'accessDays',f.access_days,'dayCount',(select count(*) from nal_private.read_days d where d.season_id=s.id and d.day_number>0 and d.status='published'))
 order by s.created_at desc),'[]'))
 from nal_private.read_offers f join public.nal_read_seasons s on s.id=f.season_id
 join public.nal_catalog c on c.kind=f.catalog_kind and c.id=f.catalog_id
 where f.status in ('listed','accepting','closed') and c.published and (p_slug is null or s.slug=p_slug)
$$;
revoke all on function public.nal_read_offers(text) from public,anon,authenticated;
grant execute on function public.nal_read_offers(text) to service_role;

create function public.nal_read_join(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.nal_read_seasons%rowtype;f nal_private.read_offers%rowtype;c public.nal_catalog%rowtype;
 e public.nal_read_enrollments%rowtype;pe public.nal_product_entitlements%rowtype;r nal_private.read_join_receipts%rowtype;
 a jsonb;orders jsonb;rid uuid;oid uuid;request_source text;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 then raise exception 'Invalid request' using errcode='22023';end if;
 select * into s from public.nal_read_seasons where slug=p_season_slug;
 if not found then raise exception 'Season unavailable' using errcode='22023';end if;
 select * into f from nal_private.read_offers where season_id=s.id;
 select * into e from public.nal_read_enrollments where user_id=p_user_id and season_id=s.id;
 a:=public.nal_get_read_access(p_user_id,p_season_slug);
 if p_action='options' then
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'amount',o.amount_won,'createdAt',o.created_at) order by o.created_at desc),'[]') into orders
  from public.nal_orders o where o.user_id=p_user_id and o.status='paid'
   and exists(select 1 from public.nal_order_items i where i.order_id=o.id and i.catalog_kind=s.product_kind and i.catalog_id=s.product_id)
   and exists(select 1 from public.nal_payments p where p.order_id=o.id and p.status='paid' and p.amount_won=o.amount_won);
  return jsonb_build_object('access',a,'existingEnrollment',e.id is not null,'orders',orders,
   'hasInvitation',exists(select 1 from public.nal_product_entitlements p where p.user_id=p_user_id
    and p.resource_type='read-season' and p.resource_id=s.slug and p.source_type in ('manual','promotion')
    and p.status='active' and p.revoked_at is null and (p.expires_at is null or p.expires_at>now())),
   'release',public.nal_read_release_guard(p_user_id,p_season_slug));
 end if;
 if p_action='welcome' then
  if coalesce((a->>'allowed')::boolean,false) is not true then raise exception 'Read access unavailable' using errcode='42501';end if;
  insert into nal_private.read_onboarding(enrollment_id,user_id) values(e.id,p_user_id) on conflict do nothing;
  return jsonb_build_object('saved',true,'seasonSlug',s.slug);
 end if;
 if p_action<>'claim' then raise exception 'Unknown join action' using errcode='22023';end if;
 if coalesce((public.nal_read_release_guard(p_user_id,p_season_slug)->>'allowed')::boolean,false) is not true then
  raise exception 'Read access unavailable' using errcode='42501';end if;
 rid:=(p_payload->>'requestId')::uuid;oid:=nullif(p_payload->>'orderId','')::uuid;
 request_source:=p_payload->>'source';
 if rid is null or request_source is null or request_source not in ('paid','free','invitation')
  or p_payload->'accepted' is distinct from 'true'::jsonb or length(coalesce(p_payload->>'policyVersion',''))=0 then
  raise exception 'Participation agreement required' using errcode='22023';end if;
 -- Same namespace and ordering as the existing enrollment core: preserve retry/revocation rules.
 perform pg_advisory_xact_lock(hashtextextended(rid::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||s.slug,1));
 select * into r from nal_private.read_join_receipts where request_id=rid;
 if found then
  if r.user_id<>p_user_id or r.season_id<>s.id or r.order_id is distinct from oid or r.source<>request_source
    or r.accepted_policy<>p_payload->>'policyVersion' then raise exception 'Request id reused' using errcode='23505';end if;
  return public.nal_get_read_access(p_user_id,p_season_slug);
 end if;
 select * into f from nal_private.read_offers where season_id=s.id for share;
 select * into c from public.nal_catalog where kind=f.catalog_kind and id=f.catalog_id for share;
 if f.season_id is null or not coalesce(c.published,false) or f.status<>'accepting' or f.policy_version is distinct from p_payload->>'policyVersion'
  or f.catalog_kind<>s.product_kind or f.catalog_id is distinct from s.product_id
  or f.starts_at>now() or f.ends_at<=now() or s.status not in ('open','closed') then
  raise exception 'Enrollment offer unavailable' using errcode='22023';end if;
 select * into e from public.nal_read_enrollments where user_id=p_user_id and season_id=s.id for update;
 if e.id is not null then return public.nal_get_read_access(p_user_id,p_season_slug);end if;
 if request_source='paid' then
  if f.mode<>'paid' or oid is null or not exists(select 1 from public.nal_orders o where o.id=oid and o.user_id=p_user_id and o.status='paid'
   and exists(select 1 from public.nal_payments p where p.order_id=o.id and p.status='paid' and p.amount_won=o.amount_won)) then
   raise exception 'Verified paid order required' using errcode='42501';end if;
  a:=public.nal_issue_read_enrollment(p_user_id,s.slug,oid,rid);
  if coalesce((a->>'allowed')::boolean,false) is not true then return a;end if;
  select * into e from public.nal_read_enrollments where id=(a->>'enrollmentId')::uuid;
 else
  if oid is not null then raise exception 'Unexpected order id' using errcode='22023';end if;
  select * into pe from public.nal_product_entitlements where user_id=p_user_id and resource_type='read-season' and resource_id=s.slug
   and source_type in ('manual','promotion') order by granted_at,id limit 1 for update;
  -- Never turn a previously revoked/expired free or manual grant into a fresh one.
  if pe.id is not null and (pe.status<>'active' or pe.revoked_at is not null or pe.expires_at<=now()) then
   raise exception 'Entitlement inactive' using errcode='42501';end if;
  if request_source='free' then
   if f.mode<>'free' or jsonb_typeof(c.body->'price') is distinct from 'number' or (c.body->>'price')::numeric<>0 then
    raise exception 'Free participation unavailable' using errcode='22023';end if;
   if pe.id is null then
    insert into public.nal_product_entitlements(user_id,resource_type,resource_id,source_type,expires_at,metadata)
    values(p_user_id,'read-season',s.slug,'promotion',case when f.access_days is not null then now()+make_interval(days=>f.access_days) end,
      jsonb_build_object('grantReason','configured_free_offer')) returning * into pe;
   end if;
  elsif pe.id is null then raise exception 'Invitation unavailable' using errcode='42501';end if;
  insert into public.nal_read_enrollments(user_id,season_id,entitlement_id) values(p_user_id,s.id,pe.id) returning * into e;
 end if;
 insert into nal_private.read_join_receipts(request_id,user_id,season_id,enrollment_id,order_id,source,accepted_policy,notice_snapshot)
  values(rid,p_user_id,s.id,e.id,oid,request_source,f.policy_version,f.participation_notice);
 return public.nal_get_read_access(p_user_id,s.slug);
end $$;
revoke all on function public.nal_read_join(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_join(uuid,text,text,jsonb) to service_role;

create function public.nal_read_offer_admin(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.nal_read_seasons%rowtype;f nal_private.read_offers%rowtype;c public.nal_catalog%rowtype;rev integer;items jsonb;
begin
 if not nal_private.read_verified_subject(p_user_id) or not exists(select 1 from nal_private.admins where user_id=p_user_id and role='owner') then
  raise exception 'Owner permission required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>20000 then raise exception 'Invalid offer' using errcode='22023';end if;
 if p_action='list' then
  return jsonb_build_object('seasons',(select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'title',s.title,'offer',to_jsonb(f)) order by s.created_at desc),'[]')
   from public.nal_read_seasons s left join nal_private.read_offers f on f.season_id=s.id),
   'products',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',body->>'title','published',published,'price',body->'price') order by id),'[]') from public.nal_catalog where kind='products'));
 end if;
 if p_action<>'save' then raise exception 'Unknown offer action' using errcode='22023';end if;
 if (select mode from nal_private.read_release_control) is distinct from 'off' then raise exception 'READ must be OFF to change offers' using errcode='42501';end if;
 select * into s from public.nal_read_seasons where slug=p_payload->>'seasonSlug' for update;
 if not found then raise exception 'Season missing' using errcode='22023';end if;
 select * into f from nal_private.read_offers where season_id=s.id for update;
 rev:=(p_payload->>'revision')::integer;
 if rev is null or rev<0 or coalesce(f.revision,0)<>rev then raise exception 'Offer changed' using errcode='40001';end if;
 select * into c from public.nal_catalog where kind='products' and id=p_payload->>'productId' for share;
 if not found or (p_payload->>'mode'='free' and (jsonb_typeof(c.body->'price') is distinct from 'number' or (c.body->>'price')::numeric<>0))
  or (p_payload->>'mode'='paid' and (jsonb_typeof(c.body->'price') is distinct from 'number' or (c.body->>'price')::numeric<100)) then
  raise exception 'Catalog product and mode mismatch' using errcode='22023';end if;
 if f.season_id is not null and exists(select 1 from public.nal_read_enrollments where season_id=s.id)
  and (f.catalog_id<>c.id or f.mode is distinct from p_payload->>'mode' or f.policy_version is distinct from p_payload->>'policyVersion'
   or f.participation_notice is distinct from p_payload->>'notice') then raise exception 'Use a new cohort for changed participant terms' using errcode='22023';end if;
 if s.product_id is not null and s.product_id<>c.id then raise exception 'Season already bound to another product' using errcode='22023';end if;
 update public.nal_read_seasons set product_id=c.id where id=s.id and product_id is null;
 insert into nal_private.read_offers(season_id,catalog_id,mode,status,summary,policy_version,participation_notice,starts_at,ends_at,access_days)
  values(s.id,c.id,p_payload->>'mode',p_payload->>'status',coalesce(p_payload->>'summary',''),p_payload->>'policyVersion',p_payload->>'notice',
   nullif(p_payload->>'startsAt','')::timestamptz,nullif(p_payload->>'endsAt','')::timestamptz,nullif(p_payload->>'accessDays','')::integer)
  on conflict(season_id) do update set catalog_id=excluded.catalog_id,mode=excluded.mode,status=excluded.status,
   summary=excluded.summary,policy_version=excluded.policy_version,participation_notice=excluded.participation_notice,
   starts_at=excluded.starts_at,ends_at=excluded.ends_at,access_days=excluded.access_days,revision=nal_private.read_offers.revision+1,updated_at=now() returning * into f;
 return jsonb_build_object('saved',true,'revision',f.revision);
end $$;
revoke all on function public.nal_read_offer_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_offer_admin(uuid,text,jsonb) to service_role;



-- LAYER 5: docs/NAL_READ_BUILD06_ACCOUNT.sql
-- Source SHA256 3ad78f06f8228a2d02bee7e1f7a7511f01b7b1754e9b8b4625c431cd7bfc9ff9
-- BUILD06 source only; UNAPPLIED. Depends on BUILD04, BUILD05 and BUILD06_JOIN.sql.
-- Aggregates OWNED records, never creates payment/enrollment from a page visit.

set local lock_timeout='5s';set local statement_timeout='30s';
create table nal_private.account_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=80),
 revision integer not null default 1 check(revision>0),updated_at timestamptz not null default now()
);
alter table nal_private.account_preferences enable row level security;
revoke all on nal_private.account_preferences from public,anon,authenticated,service_role;
grant select,insert,update on nal_private.account_preferences to service_role;

create function public.nal_account(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare items jsonb;off integer;pref nal_private.account_preferences%rowtype;rev integer;
 e record;a jsonb;entries jsonb:='[]';progress jsonb;next_day integer;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 then raise exception 'Invalid request' using errcode='22023';end if;
 off:=coalesce((p_payload->>'offset')::integer,0);
 if off<0 or off>10000 then raise exception 'Invalid page' using errcode='22023';end if;
 if p_action='profile' then
  select * into pref from nal_private.account_preferences where user_id=p_user_id;
  return jsonb_build_object('displayName',coalesce(pref.display_name,''),'revision',coalesce(pref.revision,0));
 end if;
 if p_action='profile-save' then
  rev:=(p_payload->>'revision')::integer;
  if rev is null or rev<0 or jsonb_typeof(p_payload->'displayName') is distinct from 'string' or length(p_payload->>'displayName')>80 then raise exception 'Invalid profile' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':profile',31));
  select * into pref from nal_private.account_preferences where user_id=p_user_id for update;
  if coalesce(pref.revision,0)<>rev then raise exception 'Profile changed' using errcode='40001';end if;
  insert into nal_private.account_preferences(user_id,display_name) values(p_user_id,btrim(p_payload->>'displayName'))
   on conflict(user_id) do update set display_name=excluded.display_name,revision=nal_private.account_preferences.revision+1,updated_at=now() returning * into pref;
  return jsonb_build_object('saved',true,'displayName',pref.display_name,'revision',pref.revision);
 end if;
 if p_action='orders' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into items from (
   select o.id,o.status,o.amount_won,o.created_at,
    (select coalesce(jsonb_agg(jsonb_build_object('title',i.title_snapshot,'productId',i.catalog_id,'kind',i.catalog_kind,
      'quantity',i.quantity,'unitPrice',i.unit_price_won,'readSeason',s.slug) order by i.id),'[]')
     from public.nal_order_items i left join nal_private.read_offers f on f.catalog_kind=i.catalog_kind and f.catalog_id=i.catalog_id
     left join public.nal_read_seasons s on s.id=f.season_id where i.order_id=o.id) as items
   from public.nal_orders o where o.user_id=p_user_id order by o.created_at desc,o.id limit 51 offset off
  ) x;
  return jsonb_build_object('orders',items,'offset',off);
 end if;
 if p_action='files' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into items from (
   select d.id,d.product_id,i.title_snapshot as title,d.created_at,d.license_type,d.printing_allowed,d.download_count,d.download_limit,
    d.expires_at,d.revoked_at,o.status as order_status,
    coalesce(d.revoked_at is null and (d.expires_at is null or d.expires_at>now()) and o.status='paid'
     and (d.download_limit is null or d.download_count<d.download_limit) and f.active,false) as downloadable,
    case when d.revoked_at is not null then 'revoked' when o.status<>'paid' then 'order_inactive'
     when d.expires_at<=now() then 'expired' when d.download_limit is not null and d.download_count>=d.download_limit then 'limit'
     when not coalesce(f.active,false) then 'preparing' else 'available' end as reason
   from public.nal_digital_entitlements d join public.nal_orders o on o.id=d.order_id and o.user_id=p_user_id
   join public.nal_order_items i on i.id=d.order_item_id and i.order_id=o.id
   left join nal_private.product_files f on f.id=d.file_id
   where d.user_id=p_user_id order by d.created_at desc,d.id limit 51 offset off
  ) x;
  return jsonb_build_object('files',items,'offset',off);
 end if;
 if p_action='programs' then
  for e in select en.id,en.status,en.started_at,en.completed_at,en.created_at,s.slug,s.title,
   ob.completed_at as welcomed_at from public.nal_read_enrollments en join public.nal_read_seasons s on s.id=en.season_id
   left join nal_private.read_onboarding ob on ob.enrollment_id=en.id and ob.user_id=p_user_id
   where en.user_id=p_user_id order by en.created_at desc,en.id limit 51 offset off loop
   a:=public.nal_get_read_access(p_user_id,e.slug);progress:=null;next_day:=null;
   if coalesce((a->>'allowed')::boolean,false) then
    progress:=public.nal_read_bootstrap(p_user_id,e.slug);next_day:=(progress->>'currentDay')::integer;
   end if;
   entries:=entries||jsonb_build_array(jsonb_build_object('id',e.id,'slug',e.slug,'title',e.title,'status',e.status,
    'createdAt',e.created_at,'welcomed',e.welcomed_at is not null,'allowed',coalesce((a->>'allowed')::boolean,false),
    'reason',a->>'reason','currentDay',next_day,
    'recordedDays',case when progress is null then null else
      (select count(*) from jsonb_array_elements(progress->'journey') j where j->>'progress'='completed') end));
  end loop;
  return jsonb_build_object('programs',entries,'offset',off);
 end if;
 if p_action='registrations' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into items from (
   select r.id,r.status,r.price_won,r.created_at,s.starts_at,s.ends_at,s.location,s.status as session_status,
     coalesce(c.body->>'title','프로그램') as title
   from public.nal_registrations r join public.nal_sessions s on s.id=r.session_id
   left join public.nal_catalog c on c.kind=s.program_kind and c.id=s.program_id
   where r.user_id=p_user_id order by r.created_at desc,r.id limit 51 offset off
  ) x;
  return jsonb_build_object('registrations',items,'offset',off);
 end if;
 if p_action='reports' then
  -- Metadata only; snapshots and personal answer text remain behind the report RPC.
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into items from (
   select r.id,r.created_at,s.slug,s.title as season_title,
    r.snapshot->'cover'->>'title' as title,r.snapshot->>'stage' as stage,
    coalesce((public.nal_get_read_access(p_user_id,s.slug)->>'allowed')::boolean,false) as allowed
   from nal_private.read_report_editions r join public.nal_read_enrollments en on en.id=r.enrollment_id and en.user_id=p_user_id
   join public.nal_read_seasons s on s.id=en.season_id where r.user_id=p_user_id
   order by r.created_at desc,r.id limit 51 offset off
  ) x;
  return jsonb_build_object('reports',items,'offset',off);
 end if;
 raise exception 'Unknown account action' using errcode='22023';
end $$;
revoke all on function public.nal_account(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_account(uuid,text,jsonb) to service_role;



-- LAYER 6: docs/NAL_READ_BUILD07_PAYMENTS.sql
-- Source SHA256 7ea4be7582f65d5062d227f9a5c44ce115da09a84389d19e73e103f636408107
-- BUILD07 IMPLEMENTATION SOURCE ONLY. Not applied or validated for sale.
-- Load after BUILD06_JOIN and BUILD06_ACCOUNT. Existing PDF commerce is not replaced.

set local lock_timeout='5s';set local statement_timeout='30s';
create table nal_private.read_checkout_orders(
 order_id uuid primary key references public.nal_orders(id),
 order_item_id uuid not null unique references public.nal_order_items(id),
 user_id uuid not null references auth.users(id),season_id uuid not null references public.nal_read_seasons(id),
 create_request_id uuid not null unique,provider_order_id text not null unique check(provider_order_id ~ '^nr_[a-f0-9]{32}$'),
 provider_mode text not null check(provider_mode in ('test','live')),merchant_id text not null,
 customer_key uuid not null default gen_random_uuid(),confirm_key uuid not null default gen_random_uuid(),
 payment_key text unique check(length(payment_key) between 1 and 200),
 amount_won integer not null check(amount_won between 100 and 10000000),currency text not null default 'KRW' check(currency='KRW'),
 title text not null,policy_version text not null,notice_snapshot text not null,access_days integer,
 accepted_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',
 confirm_started_at timestamptz,
 state text not null default 'pending' check(state in ('pending','paid','failed','partially_refunded','refunded','manual_review')),
 provider_status text,refunded_won integer not null default 0 check(refunded_won>=0 and refunded_won<=amount_won),
 fulfillment text not null default 'not_paid' check(fulfillment in ('not_paid','pending','ready','blocked','manual_review','refunded')),
 fulfillment_reason text,enrollment_id uuid references public.nal_read_enrollments(id),
 approved_at timestamptz,last_checked_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index read_checkout_owner on nal_private.read_checkout_orders(user_id,season_id,created_at desc);
create index read_checkout_season on nal_private.read_checkout_orders(season_id);
create index read_checkout_enrollment on nal_private.read_checkout_orders(enrollment_id);
create table nal_private.read_payment_work(
 order_id uuid primary key references nal_private.read_checkout_orders(order_id),
 pending boolean not null default true,signal_number bigint not null default 1,
 lease_token uuid,lease_until timestamptz,leased_signal bigint,
 attempts integer not null default 0,last_error text,next_attempt_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table nal_private.read_payment_observations(
 order_id uuid not null references nal_private.read_checkout_orders(order_id),
 observation_key text not null,provider_status text not null,total_won integer not null,refunded_won integer not null,
 observed_at timestamptz not null default now(),primary key(order_id,observation_key)
);
create table nal_private.read_payment_refunds(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 order_id uuid not null references nal_private.read_checkout_orders(order_id),user_id uuid not null references auth.users(id),
 reason text not null check(length(btrim(reason)) between 1 and 1000),
 state text not null default 'requested' check(state in ('requested','approved','processing','completed','rejected','withdrawn','manual_review')),
 amount_won integer check(amount_won>0),base_refunded_won integer,
 decision_note text,decided_by uuid references auth.users(id),decided_at timestamptz,
 provider_key uuid not null default gen_random_uuid(),provider_transaction_key text,
 attempted_at timestamptz,completed_at timestamptz,
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index read_refund_one_open on nal_private.read_payment_refunds(order_id) where state in ('requested','approved','processing','manual_review');
create index read_refund_owner on nal_private.read_payment_refunds(user_id,created_at desc);
create index read_refund_decider on nal_private.read_payment_refunds(decided_by);
create table nal_private.read_payment_decisions(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references nal_private.read_checkout_orders(order_id),
 refund_id uuid references nal_private.read_payment_refunds(id),actor_id uuid not null references auth.users(id),
 action text not null,note text not null,created_at timestamptz not null default now()
);
create index read_payment_decisions_order on nal_private.read_payment_decisions(order_id,created_at);
create index read_payment_decisions_actor on nal_private.read_payment_decisions(actor_id);
create index read_payment_decisions_refund on nal_private.read_payment_decisions(refund_id);

do $$ declare t text;begin
 foreach t in array array['read_checkout_orders','read_payment_work','read_payment_observations','read_payment_refunds','read_payment_decisions'] loop
  execute format('alter table nal_private.%I enable row level security',t);
  execute format('revoke all on nal_private.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert,update on nal_private.%I to service_role',t);
 end loop;
end $$;

create function nal_private.read_checkout_view(p_order_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('orderId',q.order_id,'providerOrderId',q.provider_order_id,'seasonSlug',s.slug,
  'title',q.title,'amount',q.amount_won,'currency',q.currency,'state',q.state,'providerStatus',q.provider_status,
  'fulfillment',q.fulfillment,'fulfillmentReason',q.fulfillment_reason,'refundedAmount',q.refunded_won,
  'policyVersion',q.policy_version,'notice',q.notice_snapshot,'accessDays',q.access_days,
  'createdAt',q.created_at,'expiresAt',q.expires_at,'approvedAt',q.approved_at,'lastCheckedAt',q.last_checked_at,
  'canResume',q.state='pending' and q.confirm_started_at is null and q.expires_at>now(),
  'refunds',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'state',r.state,'reason',r.reason,
    'amount',r.amount_won,'decisionNote',r.decision_note,'revision',r.revision,'createdAt',r.created_at,'completedAt',r.completed_at) order by r.created_at desc),'[]')
    from nal_private.read_payment_refunds r where r.order_id=q.order_id),
  'workPending',coalesce(w.pending,false),'workError',w.last_error)
 from nal_private.read_checkout_orders q join public.nal_read_seasons s on s.id=q.season_id
 left join nal_private.read_payment_work w on w.order_id=q.order_id where q.order_id=p_order_id
$$;
revoke all on function nal_private.read_checkout_view(uuid) from public,anon,authenticated;
grant execute on function nal_private.read_checkout_view(uuid) to service_role;

-- Called by verified-user Edge only. Service identity comes from the existing FIX03 boundary.
create function public.nal_read_payment_user(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;s public.nal_read_seasons%rowtype;
 f nal_private.read_offers%rowtype;c public.nal_catalog%rowtype;
 o uuid;i uuid;rid uuid;price numeric;list jsonb;r nal_private.read_payment_refunds%rowtype;off integer;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 then raise exception 'Invalid request' using errcode='22023';end if;
 if p_action='list' then
  off:=coalesce((p_payload->>'offset')::integer,0);if off<0 or off>10000 then raise exception 'Invalid page' using errcode='22023';end if;
  select coalesce(jsonb_agg(nal_private.read_checkout_view(x.order_id) order by x.created_at desc,x.order_id),'[]') into list
   from (select order_id,created_at from nal_private.read_checkout_orders where user_id=p_user_id order by created_at desc,order_id limit 51 offset off) x;
  return jsonb_build_object('orders',list);
 end if;
 if p_action='create' then
  rid:=(p_payload->>'requestId')::uuid;
  if rid is null or p_payload->'accepted' is distinct from 'true'::jsonb or p_payload->>'mode' is null
    or p_payload->>'mode' not in ('test','live') or length(coalesce(p_payload->>'merchantId','')) not between 1 and 80 then
   raise exception 'Participation terms required' using errcode='22023';end if;
  select * into s from public.nal_read_seasons where slug=p_payload->>'seasonSlug';
  if not found then raise exception 'Season unavailable' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(rid::text,20));
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||s.slug,1));
  select * into q from nal_private.read_checkout_orders where create_request_id=rid;
  if found then
   if q.user_id<>p_user_id or q.season_id<>s.id or q.provider_mode<>p_payload->>'mode'
    or q.merchant_id<>p_payload->>'merchantId' or q.policy_version<>p_payload->>'policyVersion' then
    raise exception 'Request reused for different purchase' using errcode='23505';end if;
   return nal_private.read_checkout_view(q.order_id);
  end if;
  if coalesce((public.nal_read_release_guard(p_user_id,s.slug)->>'allowed')::boolean,false) is not true then
   raise exception 'READ is not available to this participant' using errcode='42501';end if;
  if exists(select 1 from public.nal_read_enrollments where user_id=p_user_id and season_id=s.id) then
   raise exception 'Existing participation must be resolved before repurchase' using errcode='22023';end if;
  -- Do not sell a second copy while any earlier payment for this cohort is unresolved.
  select * into q from nal_private.read_checkout_orders where user_id=p_user_id and season_id=s.id
    and state not in ('failed','refunded') order by created_at desc limit 1 for update;
  if found then return nal_private.read_checkout_view(q.order_id);end if;
  select * into f from nal_private.read_offers where season_id=s.id for share;
  select * into c from public.nal_catalog where kind=f.catalog_kind and id=f.catalog_id for share;
  if f.season_id is null or f.mode<>'paid' or f.status<>'accepting' or not coalesce(c.published,false)
    or s.status<>'open' or f.catalog_id is distinct from s.product_id or f.catalog_kind<>s.product_kind
    or f.starts_at>now() or f.ends_at<=now() or f.policy_version is distinct from p_payload->>'policyVersion'
    or jsonb_typeof(c.body->'price') is distinct from 'number' then raise exception 'Offer changed or unavailable' using errcode='22023';end if;
  price:=(c.body->>'price')::numeric;
  if price<>trunc(price) or price not between 100 and 10000000 or price is distinct from (p_payload->>'expectedAmount')::numeric then
   raise exception 'Price changed; review before buying' using errcode='22023';end if;
  if not exists(select 1 from nal_private.read_days where season_id=s.id and day_number=0 and status='published')
    or not exists(select 1 from nal_private.read_days where season_id=s.id and day_number=1 and status='published') then
   raise exception 'Program delivery is not prepared' using errcode='22023';end if;
  insert into public.nal_orders(user_id,amount_won,status) values(p_user_id,price::integer,'pending') returning id into o;
  insert into public.nal_order_items(order_id,catalog_kind,catalog_id,title_snapshot,quantity,unit_price_won)
    values(o,'products',c.id,left(coalesce(c.body->>'title',s.title),100),1,price::integer) returning id into i;
  insert into nal_private.read_checkout_orders(order_id,order_item_id,user_id,season_id,create_request_id,provider_order_id,
    provider_mode,merchant_id,amount_won,title,policy_version,notice_snapshot,access_days)
   values(o,i,p_user_id,s.id,rid,'nr_'||replace(gen_random_uuid()::text,'-',''),p_payload->>'mode',p_payload->>'merchantId',
    price::integer,left(coalesce(c.body->>'title',s.title),100),f.policy_version,f.participation_notice,f.access_days);
  return nal_private.read_checkout_view(o);
 end if;
 select * into q from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid and user_id=p_user_id for update;
 if not found then raise exception 'Order unavailable' using errcode='42501';end if;
 if p_action='get' then return nal_private.read_checkout_view(q.order_id);end if;
 if p_action='launch' then
  if q.state<>'pending' or q.confirm_started_at is not null or q.expires_at<=now() then raise exception 'Order must be refreshed, not charged again' using errcode='22023';end if;
  select * into s from public.nal_read_seasons where id=q.season_id;
  if coalesce((public.nal_read_release_guard(p_user_id,s.slug)->>'allowed')::boolean,false) is not true then raise exception 'READ unavailable' using errcode='42501';end if;
  return nal_private.read_checkout_view(q.order_id)||jsonb_build_object('customerKey',q.customer_key,'mode',q.provider_mode);
 end if;
 if p_action='queue-confirm' then
  if p_payload->>'providerOrderId' is distinct from q.provider_order_id or (p_payload->>'amount')::integer is distinct from q.amount_won then raise exception 'Order mismatch' using errcode='22023';end if;
  if q.state<>'pending' then return nal_private.read_checkout_view(q.order_id);end if;
  if length(coalesce(p_payload->>'paymentKey','')) not between 1 and 200 then raise exception 'Invalid payment identity' using errcode='22023';end if;
  if q.payment_key is not null and q.payment_key<>p_payload->>'paymentKey' then raise exception 'Payment key conflict' using errcode='23505';end if;
  update nal_private.read_checkout_orders set payment_key=coalesce(payment_key,p_payload->>'paymentKey'),confirm_started_at=coalesce(confirm_started_at,now()),updated_at=now() where order_id=q.order_id;
 end if;
 if p_action in ('queue-confirm','queue-refresh') then
  insert into nal_private.read_payment_work(order_id) values(q.order_id)
   on conflict(order_id) do update set pending=true,signal_number=nal_private.read_payment_work.signal_number+1,updated_at=now();
  return nal_private.read_checkout_view(q.order_id);
 end if;
 if p_action='refund-request' then
  rid:=(p_payload->>'requestId')::uuid;
  if rid is null or length(btrim(coalesce(p_payload->>'reason',''))) not between 1 and 1000 then raise exception 'Reason required' using errcode='22023';end if;
  select * into r from nal_private.read_payment_refunds where request_id=rid;
  if found then
   if r.order_id<>q.order_id or r.user_id<>p_user_id or r.reason<>btrim(p_payload->>'reason') then raise exception 'Request conflict' using errcode='23505';end if;
   return nal_private.read_checkout_view(q.order_id);
  end if;
  if q.state not in ('paid','partially_refunded') or q.refunded_won>=q.amount_won then raise exception 'No refundable payment' using errcode='22023';end if;
  if exists(select 1 from nal_private.read_payment_refunds where order_id=q.order_id and state in ('requested','approved','processing','manual_review')) then return nal_private.read_checkout_view(q.order_id);end if;
  insert into nal_private.read_payment_refunds(request_id,order_id,user_id,reason) values(rid,q.order_id,p_user_id,btrim(p_payload->>'reason'));
  -- A request is not a processed refund. Payment and access are not silently changed.
  return nal_private.read_checkout_view(q.order_id);
 end if;
 if p_action='refund-withdraw' then
  update nal_private.read_payment_refunds set state='withdrawn',revision=revision+1,updated_at=now()
   where id=(p_payload->>'refundId')::uuid and order_id=q.order_id and user_id=p_user_id and state='requested';
  if not found then raise exception 'Only an unreviewed request can be withdrawn' using errcode='22023';end if;
  return nal_private.read_checkout_view(q.order_id);
 end if;
 raise exception 'Unknown payment action' using errcode='22023';
end $$;
revoke all on function public.nal_read_payment_user(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_payment_user(uuid,text,jsonb) to service_role;



-- LAYER 7: docs/NAL_READ_BUILD07_RECONCILIATION.sql
-- Source SHA256 d238733822eee4f77708788bf4c59244243bfb0bb9266ccc493450851fe40bd4
-- BUILD07 source only, UNAPPLIED. Load after BUILD07_PAYMENTS.sql.
-- Processor RPCs are service-only. Webhook bodies are hints, not payment authority.

set local lock_timeout='5s';set local statement_timeout='30s';

create function nal_private.read_checkout_fulfill(p_order_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;s public.nal_read_seasons%rowtype;
 pe public.nal_product_entitlements%rowtype;e public.nal_read_enrollments%rowtype;
begin
 select * into strict q from nal_private.read_checkout_orders where order_id=p_order_id for update;
 if q.state<>'paid' or q.refunded_won<>0 then return;end if;
 select * into strict s from public.nal_read_seasons where id=q.season_id;
 perform pg_advisory_xact_lock(hashtextextended(q.user_id::text||':'||s.slug,1));
 if not exists(select 1 from public.nal_payments p join public.nal_orders o on o.id=p.order_id
  where p.order_id=q.order_id and p.provider='toss-read' and p.provider_event_id=q.payment_key
   and p.status='paid' and p.amount_won=q.amount_won and o.user_id=q.user_id and o.status='paid') then
  raise exception 'Verified payment ledger required' using errcode='42501';end if;
 -- Delivery may remain pending while READ is OFF; financial truth is still recorded.
 if not exists(select 1 from nal_private.read_release_control where singleton and mode='test_only')
  or not exists(select 1 from nal_private.read_test_allowlist where user_id=q.user_id and season_id=s.id
   and revoked_at is null and granted_at<=now() and expires_at>now()) or s.status not in ('open','closed') then
  update nal_private.read_checkout_orders set fulfillment='pending',fulfillment_reason='release_or_scope_pending' where order_id=q.order_id;return;
 end if;
 if not exists(select 1 from public.nal_order_items where id=q.order_item_id and order_id=q.order_id
  and catalog_kind=s.product_kind and catalog_id=s.product_id and quantity=1 and unit_price_won=q.amount_won) then
  update nal_private.read_checkout_orders set fulfillment='manual_review',fulfillment_reason='catalog_binding_changed' where order_id=q.order_id;return;
 end if;
 select * into e from public.nal_read_enrollments where user_id=q.user_id and season_id=s.id for update;
 if found then
  select * into pe from public.nal_product_entitlements where id=e.entitlement_id for share;
  if pe.order_id is distinct from q.order_id or pe.order_item_id is distinct from q.order_item_id then
   update nal_private.read_checkout_orders set fulfillment='manual_review',fulfillment_reason='existing_participation_other_source' where order_id=q.order_id;return;
  end if;
 else
  insert into public.nal_product_entitlements(user_id,resource_type,resource_id,source_type,order_id,order_item_id,expires_at)
   values(q.user_id,'read-season',s.slug,'order',q.order_id,q.order_item_id,
    case when q.access_days is not null then now()+make_interval(days=>q.access_days) end)
   on conflict(order_item_id,resource_type,resource_id) do nothing;
  select * into pe from public.nal_product_entitlements where order_item_id=q.order_item_id and resource_type='read-season' and resource_id=s.slug for share;
  if pe.user_id<>q.user_id or pe.order_id<>q.order_id then raise exception 'Entitlement ownership mismatch' using errcode='42501';end if;
  if pe.status<>'active' or pe.revoked_at is not null or pe.expires_at<=now() then
   update nal_private.read_checkout_orders set fulfillment='blocked',fulfillment_reason='existing_entitlement_inactive' where order_id=q.order_id;return;
  end if;
  insert into public.nal_read_enrollments(user_id,season_id,entitlement_id) values(q.user_id,s.id,pe.id) returning * into e;
 end if;
 if e.status not in ('active','completed') or pe.status<>'active' or pe.revoked_at is not null or pe.expires_at<=now() then
  update nal_private.read_checkout_orders set fulfillment='blocked',fulfillment_reason='existing_participation_inactive' where order_id=q.order_id;return;
 end if;
 insert into nal_private.read_join_receipts(request_id,user_id,season_id,enrollment_id,order_id,source,accepted_policy,notice_snapshot)
  values(q.create_request_id,q.user_id,s.id,e.id,q.order_id,'paid',q.policy_version,q.notice_snapshot) on conflict(request_id) do nothing;
 update nal_private.read_checkout_orders set fulfillment='ready',fulfillment_reason=null,enrollment_id=e.id,updated_at=now() where order_id=q.order_id;
end $$;
revoke all on function nal_private.read_checkout_fulfill(uuid) from public,anon,authenticated;
grant execute on function nal_private.read_checkout_fulfill(uuid) to service_role;

create function public.nal_read_payment_processor(p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;w nal_private.read_payment_work%rowtype;
 r nal_private.read_payment_refunds%rowtype;payment jsonb;token uuid;oid uuid;normalized text;refunded integer;
 ledger_status text;paid boolean;transaction_key text;refund_key text;lease_refund jsonb;unchanged boolean;
begin
 if current_user<>'service_role' or p_payload is null or jsonb_typeof(p_payload)<>'object'
  or octet_length(p_payload::text)>180000 then raise exception 'Invalid processor context' using errcode='42501';end if;
 if p_action='hint' then
  select * into q from nal_private.read_checkout_orders where provider_order_id=p_payload->>'providerOrderId';
  if not found then return jsonb_build_object('ignored',true);end if;
  insert into nal_private.read_payment_work(order_id) values(q.order_id)
   on conflict(order_id) do update set pending=true,signal_number=nal_private.read_payment_work.signal_number+1,updated_at=now();
  return jsonb_build_object('orderId',q.order_id);
 end if;
 oid:=(p_payload->>'orderId')::uuid;
 select * into q from nal_private.read_checkout_orders where order_id=oid for update;
 if not found then raise exception 'Unknown READ order' using errcode='22023';end if;
 if p_action='lease' then
  insert into nal_private.read_payment_work(order_id) values(oid) on conflict do nothing;
  select * into w from nal_private.read_payment_work where order_id=oid for update;
  if w.lease_until>now() or w.next_attempt_at>now() then return jsonb_build_object('busy',true);end if;
  token:=gen_random_uuid();
  update nal_private.read_payment_work set lease_token=token,lease_until=now()+interval '90 seconds',
   leased_signal=signal_number,pending=true,attempts=attempts+1,updated_at=now() where order_id=oid;
  -- Refunds are queued only after a separate owner execution authorization.
  select * into r from nal_private.read_payment_refunds where order_id=oid and state='processing' order by created_at limit 1;
  if r.id is not null then
   if r.attempted_at<now()-interval '14 days' then
    update nal_private.read_payment_refunds set state='manual_review',decision_note=coalesce(decision_note,'')||E'\nIdempotency window requires manual reconciliation.',updated_at=now(),revision=revision+1 where id=r.id;
   else lease_refund:=jsonb_build_object('id',r.id,'amount',r.amount_won,'baseRefunded',r.base_refunded_won,
     'key',r.provider_key,'reason',left(r.decision_note,180),'attemptedAt',r.attempted_at);end if;
  end if;
  return jsonb_build_object('lease',token,'orderId',q.order_id,'providerOrderId',q.provider_order_id,'paymentKey',q.payment_key,
   'amount',q.amount_won,'currency',q.currency,'merchantId',q.merchant_id,'mode',q.provider_mode,
   'confirmKey',q.confirm_key,'confirmStartedAt',q.confirm_started_at,'state',q.state,'refund',lease_refund);
 end if;
 select * into w from nal_private.read_payment_work where order_id=oid for update;
 token:=(p_payload->>'lease')::uuid;
 if token is null or w.lease_token is distinct from token or w.lease_until<=now() then raise exception 'Stale worker lease' using errcode='40001';end if;
 if p_action='fail' then
  update nal_private.read_payment_work set lease_token=null,lease_until=null,pending=true,
   last_error=left(coalesce(p_payload->>'code','TEMPORARY_FAILURE'),80),next_attempt_at=now()+interval '15 seconds',updated_at=now() where order_id=oid;
  return jsonb_build_object('pending',true);
 end if;
 if p_action='no-payment' then
  -- A verified provider 404 is not authority to grant or refund anything.
  if q.state='pending' and q.confirm_started_at is null and q.expires_at<now() then
   update nal_private.read_checkout_orders set state='failed',provider_status='NOT_FOUND_EXPIRED',updated_at=now() where order_id=oid;
   update public.nal_orders set status='cancelled' where id=oid and status='pending';
  end if;
  update nal_private.read_payment_work set lease_token=null,lease_until=null,pending=true,
   last_error='PAYMENT_NOT_YET_FOUND',next_attempt_at=now()+interval '30 seconds',updated_at=now() where order_id=oid;
  return jsonb_build_object('pending',true);
 end if;
 if p_action<>'apply' then raise exception 'Unknown processor action' using errcode='22023';end if;
 payment:=p_payload->'payment';normalized:=payment->>'status';
 if jsonb_typeof(payment)<>'object' or payment->>'orderId' is distinct from q.provider_order_id
  or payment->>'mId' is distinct from q.merchant_id or payment->>'currency' is distinct from q.currency
  or jsonb_typeof(payment->'totalAmount') is distinct from 'number' or (payment->>'totalAmount')::numeric is distinct from q.amount_won::numeric
  or jsonb_typeof(payment->'balanceAmount') is distinct from 'number'
  or length(coalesce(payment->>'paymentKey','')) not between 1 and 200
  or (q.payment_key is not null and q.payment_key<>payment->>'paymentKey')
  or normalized is null or normalized not in ('READY','IN_PROGRESS','DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED') then
  raise exception 'Verified provider binding mismatch' using errcode='22023';end if;
 if (payment->>'balanceAmount')::numeric<>trunc((payment->>'balanceAmount')::numeric)
  or (payment->>'balanceAmount')::numeric not between 0 and q.amount_won then raise exception 'Invalid payment balance' using errcode='22023';end if;
 paid:=payment->>'approvedAt' is not null;
 refunded:=case when paid then q.amount_won-(payment->>'balanceAmount')::integer else 0 end;
 if normalized='DONE' and (not paid or refunded<>0) then raise exception 'Invalid paid state' using errcode='22023';end if;
 if normalized='PARTIAL_CANCELED' and (not paid or refunded not between 1 and q.amount_won-1) then raise exception 'Invalid partial refund' using errcode='22023';end if;
 if normalized='CANCELED' and paid and refunded<>q.amount_won then raise exception 'Invalid full refund' using errcode='22023';end if;
 transaction_key:=coalesce(payment->>'lastTransactionKey',payment->>'paymentKey');
 insert into nal_private.read_payment_observations(order_id,observation_key,provider_status,total_won,refunded_won)
  values(oid,md5(transaction_key||':'||normalized||':'||refunded::text),normalized,q.amount_won,refunded) on conflict do nothing;
 unchanged:=refunded<q.refunded_won or (q.state in ('paid','partially_refunded','refunded') and normalized in ('READY','IN_PROGRESS','ABORTED','EXPIRED'));
 if not unchanged then
  update nal_private.read_checkout_orders set payment_key=coalesce(payment_key,payment->>'paymentKey'),provider_status=normalized,
   refunded_won=greatest(refunded_won,refunded),approved_at=coalesce(approved_at,(payment->>'approvedAt')::timestamptz),
   state=case when normalized='DONE' then 'paid' when normalized='PARTIAL_CANCELED' then 'partially_refunded'
    when normalized='CANCELED' and paid then 'refunded' when normalized in ('CANCELED','ABORTED','EXPIRED') then 'failed' else state end,
   last_checked_at=now(),updated_at=now() where order_id=oid;
  if normalized in ('DONE','PARTIAL_CANCELED','CANCELED','ABORTED','EXPIRED') then
   ledger_status:=case when normalized='DONE' then 'paid' when normalized='CANCELED' and paid then 'refunded'
    when normalized='PARTIAL_CANCELED' then 'cancelled' else 'failed' end;
   insert into public.nal_payments(order_id,provider,provider_event_id,amount_won,status)
    values(oid,'toss-read',payment->>'paymentKey',q.amount_won,ledger_status)
    on conflict(provider,provider_event_id) do update set status=excluded.status
     where public.nal_payments.order_id=excluded.order_id and public.nal_payments.amount_won=excluded.amount_won;
   if not exists(select 1 from public.nal_payments where order_id=oid and provider='toss-read'
      and provider_event_id=payment->>'paymentKey' and amount_won=q.amount_won and status=ledger_status) then
    raise exception 'Payment identity reused' using errcode='23505';end if;
   update public.nal_orders set status=case when normalized='DONE' then 'paid' when normalized='PARTIAL_CANCELED' then 'refund_requested'
     when normalized='CANCELED' and paid then 'refunded' else 'cancelled' end where id=oid;
  end if;
  if refunded>0 then
   -- Partial refunds pause delivery for owner review; never silently claim a full refund.
   update public.nal_product_entitlements set status=case when refunded=q.amount_won then 'refunded' else 'revoked' end,
    revoked_at=coalesce(revoked_at,now()) where order_id=oid and resource_type='read-season';
   update public.nal_read_enrollments e set status=case when refunded=q.amount_won then 'refunded' else 'paused' end,updated_at=now()
    from public.nal_product_entitlements pe where e.entitlement_id=pe.id and pe.order_id=oid;
   update nal_private.read_checkout_orders set fulfillment=case when refunded=q.amount_won then 'refunded' else 'manual_review' end,
     fulfillment_reason=case when refunded=q.amount_won then 'full_refund_confirmed' else 'partial_refund_access_review' end where order_id=oid;
  elsif normalized='DONE' then
   -- Isolate fulfillment failure: keep the verified payment durable and retry delivery.
   begin perform nal_private.read_checkout_fulfill(oid);
   exception when others then
    update nal_private.read_checkout_orders set fulfillment='pending',fulfillment_reason='delivery_retry_required' where order_id=oid;
   end;
  end if;
 end if;
 -- A specific refund finishes only when its verified provider transaction is present.
 if p_payload->>'refundId' is not null and p_payload->>'refundTransactionKey' is not null then
  select * into r from nal_private.read_payment_refunds where id=(p_payload->>'refundId')::uuid and order_id=oid for update;
  refund_key:=p_payload->>'refundTransactionKey';
  if r.state='processing' and exists(select 1 from jsonb_array_elements(coalesce(payment->'cancels','[]')) x
   where x->>'transactionKey'=refund_key and x->>'cancelStatus'='DONE'
    and (x->>'cancelAmount')::numeric=r.amount_won) then
   update nal_private.read_payment_refunds set state='completed',provider_transaction_key=refund_key,
    completed_at=now(),revision=revision+1,updated_at=now() where id=r.id;
  end if;
 end if;
 update nal_private.read_payment_work set lease_token=null,lease_until=null,
   pending=signal_number>leased_signal or exists(select 1 from nal_private.read_checkout_orders where order_id=oid and fulfillment='pending'),
   last_error=null,next_attempt_at=now()+interval '5 seconds',updated_at=now() where order_id=oid;
 return jsonb_build_object('recorded',true,'ignoredOlderState',unchanged);
end $$;
revoke all on function public.nal_read_payment_processor(text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_payment_processor(text,jsonb) to service_role;

create function public.nal_read_payment_admin(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;r nal_private.read_payment_refunds%rowtype;items jsonb;amount integer;off integer;
begin
 if not nal_private.read_verified_subject(p_user_id) or not exists(select 1 from nal_private.admins where user_id=p_user_id and role='owner') then
  raise exception 'Owner permission required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 then raise exception 'Invalid request' using errcode='22023';end if;
 if p_action='list' then
  off:=coalesce((p_payload->>'offset')::integer,0);if off<0 or off>10000 then raise exception 'Invalid page' using errcode='22023';end if;
  select coalesce(jsonb_agg(nal_private.read_checkout_view(x.order_id) order by x.updated_at desc,x.order_id),'[]') into items from (
   select order_id,updated_at from nal_private.read_checkout_orders where
    coalesce(p_payload->>'filter','all')='all' or
    (p_payload->>'filter'='attention' and (fulfillment in ('pending','blocked','manual_review') or
     exists(select 1 from nal_private.read_payment_refunds r where r.order_id=read_checkout_orders.order_id and r.state in ('requested','approved','processing','manual_review'))))
    order by updated_at desc,order_id limit 51 offset off) x;
  return jsonb_build_object('orders',items);
 end if;
 select * into q from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid for update;
 if not found then raise exception 'Order unavailable' using errcode='22023';end if;
 if p_action='refresh' then
  insert into nal_private.read_payment_work(order_id) values(q.order_id) on conflict(order_id) do update
   set pending=true,signal_number=nal_private.read_payment_work.signal_number+1;
  return jsonb_build_object('orderId',q.order_id);
 end if;
 select * into r from nal_private.read_payment_refunds where id=(p_payload->>'refundId')::uuid and order_id=q.order_id for update;
 if not found or r.revision is distinct from (p_payload->>'revision')::integer then raise exception 'Refund request changed' using errcode='40001';end if;
 if p_action in ('refund-approve','refund-reject') then
  if r.state<>'requested' or p_payload->'confirmed' is distinct from 'true'::jsonb
   or length(btrim(coalesce(p_payload->>'note',''))) not between 1 and 180 then raise exception 'Explicit decision and note required' using errcode='22023';end if;
  if p_action='refund-approve' then
   amount:=(p_payload->>'amount')::integer;
   if amount is null or amount<=0 or amount>q.amount_won-q.refunded_won or q.state not in ('paid','partially_refunded') then raise exception 'Refund amount invalid' using errcode='22023';end if;
   update nal_private.read_payment_refunds set state='approved',amount_won=amount,base_refunded_won=q.refunded_won,
    decision_note=btrim(p_payload->>'note'),decided_by=p_user_id,decided_at=now(),revision=revision+1,updated_at=now() where id=r.id;
  else
   update nal_private.read_payment_refunds set state='rejected',decision_note=btrim(p_payload->>'note'),
    decided_by=p_user_id,decided_at=now(),revision=revision+1,updated_at=now() where id=r.id;
  end if;
 elsif p_action='refund-execute' then
  if p_payload->'confirmed' is distinct from 'true'::jsonb or (p_payload->>'amount')::integer is distinct from r.amount_won
    or r.state not in ('approved','processing') or r.attempted_at<now()-interval '14 days' then raise exception 'Explicit execution confirmation required' using errcode='22023';end if;
  if r.state='approved' and q.refunded_won<>r.base_refunded_won then raise exception 'Payment changed; re-review refund' using errcode='40001';end if;
  update nal_private.read_payment_refunds set state='processing',attempted_at=coalesce(attempted_at,now()),revision=revision+1,updated_at=now() where id=r.id;
  insert into nal_private.read_payment_work(order_id) values(q.order_id) on conflict(order_id) do update
   set pending=true,signal_number=nal_private.read_payment_work.signal_number+1;
 else raise exception 'Unknown decision' using errcode='22023';end if;
 insert into nal_private.read_payment_decisions(order_id,refund_id,actor_id,action,note)
  values(q.order_id,r.id,p_user_id,p_action,coalesce(p_payload->>'note','Previously approved refund execution'));
 return jsonb_build_object('orderId',q.order_id,'saved',true);
end $$;
revoke all on function public.nal_read_payment_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_payment_admin(uuid,text,jsonb) to service_role;



-- LAYER 8: docs/NAL_READ_BUILD07_INTEGRATION.sql
-- Source SHA256 63bbf891e1b1e370dd24d95e305df08b870cbe6b58df53683b074b214276aeea
-- BUILD07 integration source, UNAPPLIED. Load after PAYMENTS and RECONCILIATION.
-- Keep original implementations in private scope; wrappers add consistent lock order and explicit recovery.

set local lock_timeout='5s';set local statement_timeout='30s';
alter function public.nal_read_payment_processor(text,jsonb) set schema nal_private;
alter function nal_private.nal_read_payment_processor(text,jsonb) rename to read_payment_processor_core;
revoke all on function nal_private.read_payment_processor_core(text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_payment_processor_core(text,jsonb) to service_role;
create function public.nal_read_payment_processor(p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;slug text;result jsonb;w nal_private.read_payment_work%rowtype;
begin
 if current_user<>'service_role' or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Processor required' using errcode='42501';end if;
 if p_action<>'hint' then
  select * into q from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid;
  if not found then raise exception 'Unknown READ order' using errcode='22023';end if;
  select s.slug into strict slug from public.nal_read_seasons s where s.id=q.season_id;
  -- Same user/season -> order row order as checkout creation and existing enrollment core.
  perform pg_advisory_xact_lock(hashtextextended(q.user_id::text||':'||slug,1));
 end if;
 if p_action='apply' and p_payload->>'refundReviewId' is not null then
  select * into w from nal_private.read_payment_work where order_id=q.order_id for update;
  if w.lease_token is distinct from (p_payload->>'lease')::uuid or w.lease_until<=now() then raise exception 'Stale lease' using errcode='40001';end if;
  update nal_private.read_payment_refunds set state='manual_review',revision=revision+1,updated_at=now(),
   decision_note=coalesce(decision_note,'')||E'\n외부 취소 또는 이전 요청의 결과 대조가 필요합니다. 추가 취소는 실행하지 않았습니다.'
   where id=(p_payload->>'refundReviewId')::uuid and order_id=q.order_id and state='processing';
 end if;
 result:=nal_private.read_payment_processor_core(p_action,p_payload);
 return result;
end $$;
revoke all on function public.nal_read_payment_processor(text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_payment_processor(text,jsonb) to service_role;

alter function public.nal_read_payment_user(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_read_payment_user(uuid,text,jsonb) rename to read_payment_user_core;
revoke all on function nal_private.read_payment_user_core(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_payment_user_core(uuid,text,jsonb) to service_role;
create function public.nal_read_payment_user(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;
begin
 if p_action<>'queue-confirm-recovery' then return nal_private.read_payment_user_core(p_user_id,p_action,p_payload);end if;
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload->'accepted' is distinct from 'true'::jsonb then
  raise exception 'Explicit approval continuation required' using errcode='22023';end if;
 select * into q from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid and user_id=p_user_id for update;
 if not found then raise exception 'Order unavailable' using errcode='42501';end if;
 if q.state<>'pending' or q.provider_status is distinct from 'IN_PROGRESS' or q.payment_key is null
  or q.expires_at<=now() or q.amount_won is distinct from (p_payload->>'amount')::integer then
  raise exception 'Existing authenticated payment cannot be continued' using errcode='22023';end if;
 update nal_private.read_checkout_orders set confirm_started_at=coalesce(confirm_started_at,now()),updated_at=now() where order_id=q.order_id;
 insert into nal_private.read_payment_work(order_id) values(q.order_id) on conflict(order_id) do update
  set pending=true,signal_number=nal_private.read_payment_work.signal_number+1;
 return nal_private.read_checkout_view(q.order_id);
end $$;
revoke all on function public.nal_read_payment_user(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_payment_user(uuid,text,jsonb) to service_role;

create function nal_private.read_preserve_checkout_offer()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (old.catalog_id is distinct from new.catalog_id or old.catalog_kind is distinct from new.catalog_kind
  or old.mode is distinct from new.mode or old.policy_version is distinct from new.policy_version
  or old.participation_notice is distinct from new.participation_notice or old.access_days is distinct from new.access_days)
  and exists(select 1 from nal_private.read_checkout_orders where season_id=old.season_id and state not in ('failed','refunded')) then
  raise exception 'An existing checkout holds these participant terms; use a new cohort' using errcode='22023';end if;
 return new;
end $$;
revoke all on function nal_private.read_preserve_checkout_offer() from public,anon,authenticated;
create trigger read_checkout_offer_snapshot before update on nal_private.read_offers for each row execute function nal_private.read_preserve_checkout_offer();



-- LAYER 9: docs/NAL_READ_BUILD09_COHORTS.sql
-- Source SHA256 887ae8be3334aa328b738ae162849dec725a535d8be09f3f120b073e46f35454
-- BUILD09 implementation source only. UNAPPLIED. Requires BUILD04-08 sources.
-- One existing read_season is one operational cohort. A program_key groups cohorts.
-- No real dates, capacity, participants, messages or feature switches are seeded.

set local lock_timeout='5s';set local statement_timeout='30s';
create table nal_private.read_cohorts(
 season_id uuid primary key references public.nal_read_seasons(id) on delete restrict,
 program_key text not null check(program_key ~ '^[a-z0-9-]{1,100}$'),
 cohort_number integer not null check(cohort_number between 1 and 9999),
 label text not null check(length(btrim(label)) between 1 and 100),
 course_starts_at timestamptz not null,course_ends_at timestamptz not null,
 timezone text not null default 'Asia/Seoul' check(timezone='Asia/Seoul'),
 capacity integer not null check(capacity between 1 and 5000),
 state text not null default 'draft' check(state in ('draft','recruiting','paused','closed','cancelled')),
 waitlist_enabled boolean not null default false,
 wait_offer_hours integer not null default 24 check(wait_offer_hours between 1 and 168),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),created_at timestamptz not null default now(),
 unique(program_key,cohort_number),
 check(isfinite(course_starts_at) and isfinite(course_ends_at) and course_ends_at>course_starts_at)
);
create table nal_private.read_waitlist(
 season_id uuid not null references nal_private.read_cohorts(season_id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete cascade,
 state text not null check(state in ('waiting','offered','joined','withdrawn','expired')),
 joined_at timestamptz not null default clock_timestamp(),offered_at timestamptz,offer_until timestamptz,
 accepted_notice text not null,policy_version text not null,
 revision integer not null default 1,updated_at timestamptz not null default now(),
 primary key(season_id,user_id),check(state<>'offered' or offer_until is not null)
);
create index read_waitlist_queue on nal_private.read_waitlist(season_id,state,joined_at,user_id);
create index read_waitlist_user on nal_private.read_waitlist(user_id,updated_at desc);
create table nal_private.read_cohort_attendance(
 session_id uuid not null references nal_private.read_live_sessions(id) on delete restrict,
 enrollment_id uuid not null references public.nal_read_enrollments(id) on delete restrict,
 status text not null check(status in ('unknown','present','absent','excused')),
 recorded_by uuid not null references auth.users(id),revision integer not null default 1,
 updated_at timestamptz not null default now(),primary key(session_id,enrollment_id)
);
create index read_cohort_attendance_enrollment on nal_private.read_cohort_attendance(enrollment_id);
create index read_cohort_attendance_actor on nal_private.read_cohort_attendance(recorded_by);
create table nal_private.read_cohort_events(
 id uuid primary key default gen_random_uuid(),season_id uuid not null references public.nal_read_seasons(id),
 actor_id uuid not null references auth.users(id),action text not null,
 detail jsonb not null default '{}' check(jsonb_typeof(detail)='object' and octet_length(detail::text)<=4000),
 created_at timestamptz not null default now()
);
create index read_cohort_events_season on nal_private.read_cohort_events(season_id,created_at desc);
create index read_cohort_events_actor on nal_private.read_cohort_events(actor_id);

do $$declare t text;begin
 foreach t in array array['read_cohorts','read_waitlist','read_cohort_attendance','read_cohort_events'] loop
  execute format('alter table nal_private.%I enable row level security',t);
  execute format('revoke all on nal_private.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert on nal_private.%I to service_role',t);
 end loop;
end $$;
grant update on nal_private.read_cohorts,nal_private.read_waitlist,nal_private.read_cohort_attendance to service_role;

create function nal_private.read_cohort_lock(p_season_id uuid)
returns void language plpgsql volatile security invoker set search_path='' as $$
begin
 if p_season_id is null then raise exception 'Cohort unavailable' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('read-cohort:'||p_season_id::text,91));
end $$;

-- VOLATILE is intentional: after waiting for the cohort lock, use a fresh snapshot.
-- Each user counts at most once across enrollment, checkout and waitlist offer.
create function nal_private.read_cohort_inventory(p_season_id uuid,p_user_id uuid default null)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare used integer;owned boolean;queued integer;confirmed integer;offered integer;
begin
 with occupied as (
  select user_id from public.nal_read_enrollments where season_id=p_season_id and status in ('pending','active','paused','completed')
  union
  select user_id from nal_private.read_checkout_orders where season_id=p_season_id and
   (state in ('paid','partially_refunded','manual_review') or (state='pending' and (expires_at>now() or confirm_started_at is not null)))
  union
  select user_id from nal_private.read_waitlist where season_id=p_season_id and state='offered' and offer_until>now()
 ) select count(*)::integer,coalesce(bool_or(user_id=p_user_id),false) into used,owned from occupied;
 select count(*)::integer into queued from nal_private.read_waitlist where season_id=p_season_id and state='waiting';
 select count(*)::integer into confirmed from public.nal_read_enrollments where season_id=p_season_id and status in ('pending','active','paused','completed');
 select count(*)::integer into offered from nal_private.read_waitlist where season_id=p_season_id and state='offered' and offer_until>now();
 return jsonb_build_object('occupied',used,'ownsPlace',owned,'waiting',queued,'enrolled',confirmed,'offered',offered);
end $$;

create function nal_private.read_cohort_summary(p_season_id uuid,p_user_id uuid default null)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare c nal_private.read_cohorts%rowtype;f nal_private.read_offers%rowtype;
 inv jsonb;available integer;window_open boolean;reason text;own_offer boolean;
begin
 select * into c from nal_private.read_cohorts where season_id=p_season_id;
 if not found then return jsonb_build_object('configured',false,'canEnroll',false,'reason','unconfigured');end if;
 select * into f from nal_private.read_offers where season_id=p_season_id;
 inv:=nal_private.read_cohort_inventory(p_season_id,p_user_id);
 available:=greatest(0,c.capacity-(inv->>'occupied')::integer);
 window_open:=coalesce(c.state='recruiting' and f.status='accepting' and (f.starts_at is null or f.starts_at<=now())
  and (f.ends_at is null or f.ends_at>now()) and now()<c.course_starts_at,false);
 own_offer:=exists(select 1 from nal_private.read_waitlist where season_id=p_season_id and user_id=p_user_id and state='offered' and offer_until>now());
 reason:=case when c.state='draft' then 'unpublished' when c.state='cancelled' then 'cancelled'
  when c.state='paused' then 'paused' when c.state='closed' or now()>=c.course_starts_at or f.ends_at<=now() then 'closed'
  when f.starts_at>now() then 'not_yet' when not window_open then 'not_open'
  when (inv->>'occupied')::integer>c.capacity then 'capacity_review'
  when (inv->>'ownsPlace')::boolean then 'reserved'
  when available=0 then 'full' when (inv->>'waiting')::integer>0 then 'waitlist_priority' else 'open' end;
 return jsonb_build_object('configured',true,'programKey',c.program_key,'cohortNumber',c.cohort_number,'label',c.label,
  'courseStartsAt',c.course_starts_at,'courseEndsAt',c.course_ends_at,'timezone',c.timezone,'state',c.state,
  'capacity',c.capacity,'occupied',(inv->>'occupied')::integer,'remaining',available,'waiting',(inv->>'waiting')::integer,
  'enrolled',(inv->>'enrolled')::integer,'offered',(inv->>'offered')::integer,
  'registrationStartsAt',f.starts_at,'registrationEndsAt',f.ends_at,'revision',c.revision,
  'canEnroll',window_open and reason in ('open','reserved'),
  'canWait',window_open and c.waitlist_enabled and reason in ('full','waitlist_priority'),
  'hasPlace',(inv->>'ownsPlace')::boolean,'hasOffer',own_offer,'reason',reason,
  'waitlistEnabled',c.waitlist_enabled,'waitOfferHours',c.wait_offer_hours);
end $$;

create function nal_private.read_cohort_require_place(p_season_id uuid,p_user_id uuid,p_settlement boolean default false)
returns void language plpgsql volatile security invoker set search_path='' as $$
declare c nal_private.read_cohorts%rowtype;info jsonb;inv jsonb;
begin
 perform nal_private.read_cohort_lock(p_season_id);
 select * into c from nal_private.read_cohorts where season_id=p_season_id;
 if not found or c.state in ('draft','cancelled') then raise exception 'Cohort unavailable' using errcode='22023';end if;
 inv:=nal_private.read_cohort_inventory(p_season_id,p_user_id);
 if (inv->>'occupied')::integer>c.capacity then raise exception 'Cohort capacity requires review' using errcode='22023';end if;
 -- A settled owned order retains its commitment after recruitment closes.
 -- It still cannot create an enrollment if the paid order arrived after capacity was exhausted.
 if p_settlement and (inv->>'ownsPlace')::boolean then return;end if;
 info:=nal_private.read_cohort_summary(p_season_id,p_user_id);
 if coalesce((info->>'canEnroll')::boolean,false) is not true then
  raise exception 'Cohort admission unavailable: %',info->>'reason' using errcode='22023';end if;
end $$;

-- Protect low-level enrollment mutation as well as the public RPC paths.
create function nal_private.read_cohort_enrollment_guard()
returns trigger language plpgsql volatile security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and (old.user_id<>new.user_id or old.season_id<>new.season_id) then
  raise exception 'Use a new enrollment; never move personal records between cohorts' using errcode='22023';end if;
 if new.status in ('pending','active','paused','completed') and
  (tg_op='INSERT' or old.status not in ('pending','active','paused','completed')) then
  perform nal_private.read_cohort_require_place(new.season_id,new.user_id,true);
 end if;
 return new;
end $$;
create trigger nal_read_cohort_enrollment before insert or update on public.nal_read_enrollments
 for each row execute function nal_private.read_cohort_enrollment_guard();
create function nal_private.read_cohort_waitlist_joined()
returns trigger language plpgsql volatile security invoker set search_path='' as $$
begin
 update nal_private.read_waitlist set state='joined',revision=revision+1,updated_at=now()
  where season_id=new.season_id and user_id=new.user_id and state in ('waiting','offered');
 return new;
end $$;
create trigger nal_read_cohort_waitlist_joined after insert on public.nal_read_enrollments
 for each row execute function nal_private.read_cohort_waitlist_joined();

create function public.nal_read_cohorts_public(p_program_key text default null,p_season_slug text default null)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare result jsonb;
begin
 if (p_program_key is not null and p_program_key !~ '^[a-z0-9-]{1,100}$') or
  (p_season_slug is not null and p_season_slug !~ '^[a-z0-9-]{1,120}$') then raise exception 'Invalid cohort filter' using errcode='22023';end if;
 select coalesce(jsonb_agg(x.item order by x.course_starts_at,x.cohort_number),'[]') into result from (
  select c.course_starts_at,c.cohort_number,jsonb_build_object('seasonSlug',s.slug,'title',s.title,'summary',f.summary,
   'mode',f.mode,'price',case when jsonb_typeof(cat.body->'price')='number' then cat.body->'price' else null end,
   'cohort',nal_private.read_cohort_summary(s.id)) as item
  from nal_private.read_cohorts c join public.nal_read_seasons s on s.id=c.season_id
  join nal_private.read_offers f on f.season_id=s.id
  join public.nal_catalog cat on cat.kind=f.catalog_kind and cat.id=f.catalog_id
  where c.state<>'draft' and f.status in ('listed','accepting','closed') and cat.published
   and (p_program_key is null or c.program_key=p_program_key) and (p_season_slug is null or s.slug=p_season_slug)
  order by c.course_starts_at,c.cohort_number limit 100
 ) x;
 return jsonb_build_object('cohorts',result,'limit',100,'serverTime',now());
end $$;

create function public.nal_read_cohort_user(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare s public.nal_read_seasons%rowtype;c nal_private.read_cohorts%rowtype;f nal_private.read_offers%rowtype;
 w nal_private.read_waitlist%rowtype;summary jsonb;items jsonb;position integer;rev integer;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 then raise exception 'Invalid request' using errcode='22023';end if;
 if p_action='mine' then
  select coalesce(jsonb_agg(jsonb_build_object('seasonSlug',s.slug,'title',s.title,'label',c.label,
   'courseStartsAt',c.course_starts_at,'state',case when w.state='offered' and w.offer_until<=now() then 'expired' else w.state end,
   'offerUntil',w.offer_until,'revision',w.revision,'joinedAt',w.joined_at,
   'canAccept',w.state='offered' and w.offer_until>now() and (nal_private.read_cohort_summary(s.id,p_user_id)->>'canEnroll')::boolean)
    order by w.updated_at desc),'[]') into items from nal_private.read_waitlist w
   join public.nal_read_seasons s on s.id=w.season_id join nal_private.read_cohorts c on c.season_id=s.id where w.user_id=p_user_id;
  return jsonb_build_object('applications',items);
 end if;
 select * into s from public.nal_read_seasons where slug=p_payload->>'seasonSlug';
 if not found then raise exception 'Cohort unavailable' using errcode='22023';end if;
 if p_action not in ('status','wait','withdraw') then raise exception 'Unknown cohort action' using errcode='22023';end if;
 perform nal_private.read_cohort_lock(s.id);
 select * into c from nal_private.read_cohorts where season_id=s.id;
 if not found then raise exception 'Cohort is not configured' using errcode='22023';end if;
 select * into f from nal_private.read_offers where season_id=s.id;
 if f.status not in ('listed','accepting','closed') or not exists(select 1 from public.nal_catalog where kind=f.catalog_kind and id=f.catalog_id and published)
  then raise exception 'Cohort is not public' using errcode='22023';end if;
 select * into w from nal_private.read_waitlist where season_id=s.id and user_id=p_user_id for update;
 summary:=nal_private.read_cohort_summary(s.id,p_user_id);
 if p_action='wait' then
  if exists(select 1 from public.nal_read_enrollments where season_id=s.id and user_id=p_user_id) then
   raise exception 'Existing participant cannot join the waitlist' using errcode='22023';end if;
  if w.state='waiting' or (w.state='offered' and w.offer_until>now()) then
   null; -- A retried application keeps the original place; no duplicate or rank reset.
  else
   if not coalesce((summary->>'canWait')::boolean,false) then raise exception 'Waitlist is unavailable' using errcode='22023';end if;
   if p_payload->'accepted' is distinct from 'true'::jsonb or p_payload->>'policyVersion' is distinct from f.policy_version then
    raise exception 'Read the current participation notice first' using errcode='22023';end if;
   if (nal_private.read_cohort_inventory(s.id,p_user_id)->>'ownsPlace')::boolean then raise exception 'Resolve the existing order first' using errcode='22023';end if;
   insert into nal_private.read_waitlist(season_id,user_id,state,accepted_notice,policy_version)
    values(s.id,p_user_id,'waiting',f.participation_notice,f.policy_version)
    on conflict(season_id,user_id) do update set state='waiting',joined_at=clock_timestamp(),offered_at=null,offer_until=null,
     accepted_notice=excluded.accepted_notice,policy_version=excluded.policy_version,revision=nal_private.read_waitlist.revision+1,updated_at=now()
    returning * into w;
   insert into nal_private.read_cohort_events(season_id,actor_id,action) values(s.id,p_user_id,'waitlist.join');
  end if;
 elsif p_action='withdraw' then
  rev:=(p_payload->>'revision')::integer;
  if w.user_id is null or rev is null or rev<>w.revision then raise exception 'Application changed' using errcode='40001';end if;
  if w.state not in ('waiting','offered','expired') then raise exception 'This application cannot be withdrawn' using errcode='22023';end if;
  if exists(select 1 from public.nal_read_enrollments where user_id=p_user_id and season_id=s.id)
   or exists(select 1 from nal_private.read_checkout_orders where user_id=p_user_id and season_id=s.id and state not in ('failed','refunded')) then
   raise exception 'Resolve participation or payment first; withdrawal is not a refund' using errcode='22023';end if;
  update nal_private.read_waitlist set state='withdrawn',revision=revision+1,updated_at=now() where season_id=s.id and user_id=p_user_id returning * into w;
  insert into nal_private.read_cohort_events(season_id,actor_id,action) values(s.id,p_user_id,'waitlist.withdraw');
 end if;
 if w.state='waiting' then
  select count(*)::integer+1 into position from nal_private.read_waitlist x where x.season_id=s.id and x.state='waiting'
   and (x.joined_at,x.user_id)<(w.joined_at,w.user_id);
 end if;
 return jsonb_build_object('seasonSlug',s.slug,'cohort',nal_private.read_cohort_summary(s.id,p_user_id),
  'application',case when w.user_id is null then null else jsonb_build_object('state',case when w.state='offered' and w.offer_until<=now() then 'expired' else w.state end,
   'position',position,'offerUntil',w.offer_until,'revision',w.revision,'joinedAt',w.joined_at) end);
end $$;

revoke all on function nal_private.read_cohort_lock(uuid),nal_private.read_cohort_inventory(uuid,uuid),
 nal_private.read_cohort_summary(uuid,uuid),nal_private.read_cohort_require_place(uuid,uuid,boolean),
 nal_private.read_cohort_enrollment_guard(),nal_private.read_cohort_waitlist_joined(),
 public.nal_read_cohorts_public(text,text),public.nal_read_cohort_user(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_cohort_lock(uuid),nal_private.read_cohort_inventory(uuid,uuid),
 nal_private.read_cohort_summary(uuid,uuid),nal_private.read_cohort_require_place(uuid,uuid,boolean),
 public.nal_read_cohorts_public(text,text),public.nal_read_cohort_user(uuid,text,jsonb) to service_role;



-- LAYER 10: docs/NAL_READ_BUILD09_COHORT_ADMIN.sql
-- Source SHA256 4eee4563f317206d158ff8147b14521c0b531a4745326a96302c34560431ac76
-- BUILD09 source only. Owner-only cohort settings, FIFO invitations and manual attendance.
-- No coaching text, psychological scores, Auth-table queries or message sending.

set local lock_timeout='5s';set local statement_timeout='30s';
create function public.nal_read_cohort_admin(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare s public.nal_read_seasons%rowtype;c nal_private.read_cohorts%rowtype;f nal_private.read_offers%rowtype;
 w nal_private.read_waitlist%rowtype;front nal_private.read_waitlist%rowtype;
 att nal_private.read_cohort_attendance%rowtype;inv jsonb;items jsonb;waiters jsonb;sessions jsonb;logs jsonb;
 off integer;rev integer;start_at timestamptz;end_at timestamptz;until_at timestamptz;cap integer;hours integer;
 target uuid;v_session uuid;frozen boolean;note text;next_state text;
begin
 if not nal_private.read_verified_subject(p_user_id) or not exists(select 1 from nal_private.admins where user_id=p_user_id and role='owner') then
  raise exception 'Owner permission required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>14000 then raise exception 'Invalid admin request' using errcode='22023';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('seasonSlug',rs.slug,'title',rs.title,'contentState',rs.status,
   'cohort',case when rc.season_id is null then null else to_jsonb(rc)||jsonb_build_object('summary',nal_private.read_cohort_summary(rs.id)) end,
   'registration',jsonb_build_object('startsAt',rf.starts_at,'endsAt',rf.ends_at,'status',rf.status)) order by rs.created_at desc),'[]') into items
   from public.nal_read_seasons rs left join nal_private.read_cohorts rc on rc.season_id=rs.id left join nal_private.read_offers rf on rf.season_id=rs.id;
  return jsonb_build_object('seasons',items);
 end if;
 select * into s from public.nal_read_seasons where slug=p_payload->>'seasonSlug';
 if not found then raise exception 'Unknown cohort season' using errcode='22023';end if;
 perform nal_private.read_cohort_lock(s.id);
 select * into c from nal_private.read_cohorts where season_id=s.id for update;
 select * into f from nal_private.read_offers where season_id=s.id;
 inv:=nal_private.read_cohort_inventory(s.id);
 if p_action='save' then
  if (select mode from nal_private.read_release_control) is distinct from 'off' then raise exception 'Edit recruitment settings with READ OFF' using errcode='42501';end if;
  rev:=(p_payload->>'revision')::integer;
  if rev is null or rev<0 or rev<>coalesce(c.revision,0) then raise exception 'Cohort changed' using errcode='40001';end if;
  note:=btrim(p_payload->>'reason');cap:=(p_payload->>'capacity')::integer;hours:=(p_payload->>'waitOfferHours')::integer;
  start_at:=(p_payload->>'courseStartsAt')::timestamptz;end_at:=(p_payload->>'courseEndsAt')::timestamptz;next_state:=p_payload->>'state';
  if p_payload->'confirmed' is distinct from 'true'::jsonb or note is null or length(note) not between 1 and 500
   or cap is null or cap not between 1 and 5000 or hours is null or hours not between 1 and 168
   or start_at is null or end_at is null or not isfinite(start_at) or not isfinite(end_at) or end_at<=start_at
   or next_state is null or next_state not in ('draft','recruiting','paused','closed','cancelled')
   or jsonb_typeof(p_payload->'waitlistEnabled') is distinct from 'boolean' then raise exception 'Invalid cohort configuration' using errcode='22023';end if;
  if cap<(inv->>'occupied')::integer then raise exception 'Capacity cannot be lower than committed places' using errcode='22023';end if;
  if f.ends_at>start_at then raise exception 'Close registration no later than course start' using errcode='22023';end if;
  if next_state='recruiting' and (f.season_id is null or f.status<>'accepting' or start_at<=now()) then raise exception 'Configure an accepting offer and future course first' using errcode='22023';end if;
  frozen:=exists(select 1 from public.nal_read_enrollments where season_id=s.id) or exists(select 1 from nal_private.read_checkout_orders where season_id=s.id) or exists(select 1 from nal_private.read_waitlist where season_id=s.id);
  if c.season_id is not null and frozen and
   (c.program_key is distinct from p_payload->>'programKey' or c.cohort_number is distinct from (p_payload->>'cohortNumber')::integer
    or c.label is distinct from btrim(p_payload->>'label') or c.course_starts_at<>start_at or c.course_ends_at<>end_at) then
   raise exception 'Do not rewrite a cohort with applicants; create a new cohort' using errcode='22023';end if;
  if c.season_id is null and frozen and (s.starts_at is distinct from start_at or s.ends_at is distinct from end_at) then raise exception 'Preserve the dates of an existing cohort' using errcode='22023';end if;
  if exists(select 1 from nal_private.read_live_sessions where season_id=s.id and status='published' and (starts_at<start_at or ends_at>end_at)) then raise exception 'Published LIVE sessions must fit inside course dates' using errcode='22023';end if;
  insert into nal_private.read_cohorts(season_id,program_key,cohort_number,label,course_starts_at,course_ends_at,capacity,state,waitlist_enabled,wait_offer_hours)
   values(s.id,p_payload->>'programKey',(p_payload->>'cohortNumber')::integer,btrim(p_payload->>'label'),start_at,end_at,cap,next_state,(p_payload->>'waitlistEnabled')::boolean,hours)
   on conflict(season_id) do update set program_key=excluded.program_key,cohort_number=excluded.cohort_number,label=excluded.label,
    course_starts_at=excluded.course_starts_at,course_ends_at=excluded.course_ends_at,capacity=excluded.capacity,state=excluded.state,
    waitlist_enabled=excluded.waitlist_enabled,wait_offer_hours=excluded.wait_offer_hours,revision=nal_private.read_cohorts.revision+1,updated_at=now() returning * into c;
  update public.nal_read_seasons set starts_at=start_at,ends_at=end_at,updated_at=now() where id=s.id;
  insert into nal_private.read_cohort_events(season_id,actor_id,action,detail) values(s.id,p_user_id,'cohort.save',jsonb_build_object('revision',c.revision,'capacity',cap,'state',next_state,'reason',note));
  return jsonb_build_object('saved',true,'cohort',to_jsonb(c),'summary',nal_private.read_cohort_summary(s.id));
 end if;
 if c.season_id is null then raise exception 'Configure the cohort first' using errcode='22023';end if;
 if p_action='roster' then
  off:=coalesce((p_payload->>'offset')::integer,0);if off<0 or off>10000 then raise exception 'Invalid page' using errcode='22023';end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]') into items from (
   select e.id,e.status,e.created_at,coalesce(nullif(p.display_name,''),'참가자 '||left(e.id::text,8)) as display_name,
    (select count(*) from public.nal_read_day_progress d where d.enrollment_id=e.id and d.user_id=e.user_id and d.status='completed') as recorded_days,
    (select coalesce(jsonb_agg(jsonb_build_object('sessionId',a.session_id,'status',a.status,'revision',a.revision,'updatedAt',a.updated_at)),'[]') from nal_private.read_cohort_attendance a where a.enrollment_id=e.id) as attendance
   from public.nal_read_enrollments e left join nal_private.account_preferences p on p.user_id=e.user_id
   where e.season_id=s.id order by e.created_at,e.id limit 51 offset off
  ) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.joined_at,x.user_id),'[]') into waiters from (
   select rw.user_id,rw.joined_at,rw.offer_until,rw.revision,case when rw.state='offered' and rw.offer_until<=now() then 'expired' else rw.state end as state,
    coalesce(nullif(p.display_name,''),'대기자 '||left(rw.user_id::text,8)) as display_name
   from nal_private.read_waitlist rw left join nal_private.account_preferences p on p.user_id=rw.user_id
   where rw.season_id=s.id and rw.state not in ('joined','withdrawn') order by rw.joined_at,rw.user_id limit 101 offset off
  ) x;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'startsAt',l.starts_at,'endsAt',l.ends_at,'status',l.status) order by l.starts_at),'[]') into sessions from nal_private.read_live_sessions l where l.season_id=s.id;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into logs from (select action,detail,created_at from nal_private.read_cohort_events where season_id=s.id order by created_at desc limit 20) x;
  return jsonb_build_object('participants',items,'waiters',waiters,'sessions',sessions,'events',logs,'summary',nal_private.read_cohort_summary(s.id),'offset',off);
 end if;
 if p_action in ('offer-next','offer-cancel') then
  target:=(p_payload->>'userId')::uuid;rev:=(p_payload->>'revision')::integer;
  if target is null or rev is null or p_payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Confirm the selected applicant first' using errcode='22023';end if;
  select * into w from nal_private.read_waitlist where season_id=s.id and user_id=target for update;
  if not found then raise exception 'Waitlist application unavailable' using errcode='22023';end if;
  if p_action='offer-next' then
   if w.state='offered' and w.offer_until>now() and w.revision=rev+1 then return jsonb_build_object('offered',true,'offerUntil',w.offer_until,'revision',w.revision);end if;
   if w.revision<>rev then raise exception 'Application changed' using errcode='40001';end if;
   select * into front from nal_private.read_waitlist where season_id=s.id and state='waiting' order by joined_at,user_id limit 1 for update;
   if front.user_id is distinct from target then raise exception 'Offer the first waiting applicant, not a later one' using errcode='22023';end if;
   if (inv->>'occupied')::integer>=c.capacity or c.state<>'recruiting' or f.status<>'accepting' or f.starts_at>now() or f.ends_at<=now() or now()>=c.course_starts_at then raise exception 'No available admission place' using errcode='22023';end if;
   until_at:=least(now()+make_interval(hours=>c.wait_offer_hours),coalesce(f.ends_at,c.course_starts_at),c.course_starts_at);
   update nal_private.read_waitlist set state='offered',offered_at=now(),offer_until=until_at,revision=revision+1,updated_at=now() where season_id=s.id and user_id=target returning * into w;
   insert into nal_private.read_cohort_events(season_id,actor_id,action,detail) values(s.id,p_user_id,'waitlist.offer',jsonb_build_object('userId',target,'offerUntil',until_at));
   return jsonb_build_object('offered',true,'offerUntil',until_at,'revision',w.revision,'notification','not_sent');
  end if;
  note:=btrim(p_payload->>'reason');
  if w.revision<>rev then raise exception 'Application changed' using errcode='40001';end if;
  if w.state<>'offered' or note is null or length(note) not between 1 and 500 then raise exception 'An offered place and a reason are required' using errcode='22023';end if;
  if exists(select 1 from public.nal_read_enrollments where season_id=s.id and user_id=target)
   or exists(select 1 from nal_private.read_checkout_orders where season_id=s.id and user_id=target and state not in ('failed','refunded')) then
   raise exception 'Do not cancel an offer with an unresolved payment or enrollment' using errcode='22023';end if;
  update nal_private.read_waitlist set state='expired',offer_until=least(offer_until,now()),revision=revision+1,updated_at=now() where season_id=s.id and user_id=target;
  insert into nal_private.read_cohort_events(season_id,actor_id,action,detail) values(s.id,p_user_id,'waitlist.offer_cancel',jsonb_build_object('userId',target,'reason',note));
  return jsonb_build_object('saved',true);
 end if;
 if p_action='attendance' then
  target:=(p_payload->>'enrollmentId')::uuid;v_session:=(p_payload->>'sessionId')::uuid;rev:=(p_payload->>'revision')::integer;
  if p_payload->'confirmed' is distinct from 'true'::jsonb or target is null or v_session is null or rev is null or p_payload->>'status' is null
   or p_payload->>'status' not in ('unknown','present','absent','excused') then raise exception 'Confirm attendance status' using errcode='22023';end if;
  if not exists(select 1 from public.nal_read_enrollments where id=target and season_id=s.id)
   or not exists(select 1 from nal_private.read_live_sessions l where l.id=v_session and l.season_id=s.id and l.status='published' and l.starts_at<=now()) then
   raise exception 'Only a started session and its participant may be recorded' using errcode='22023';end if;
  select * into att from nal_private.read_cohort_attendance a where a.session_id=v_session and a.enrollment_id=target for update;
  if coalesce(att.revision,0)<>rev then raise exception 'Attendance changed' using errcode='40001';end if;
  insert into nal_private.read_cohort_attendance(session_id,enrollment_id,status,recorded_by) values(v_session,target,p_payload->>'status',p_user_id)
   on conflict(session_id,enrollment_id) do update set status=excluded.status,recorded_by=p_user_id,revision=nal_private.read_cohort_attendance.revision+1,updated_at=now();
  insert into nal_private.read_cohort_events(season_id,actor_id,action,detail) values(s.id,p_user_id,'attendance.record',jsonb_build_object('enrollmentId',target,'sessionId',v_session,'status',p_payload->>'status'));
  return jsonb_build_object('saved',true,'source','owner_recorded');
 end if;
 raise exception 'Unknown cohort admin action' using errcode='22023';
end $$;
revoke all on function public.nal_read_cohort_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_cohort_admin(uuid,text,jsonb) to service_role;



-- LAYER 11: docs/NAL_READ_BUILD09_ADMISSION_BRIDGES.sql
-- Source SHA256 0cb99ee0155f54f9b5864e1d32766c26efb08bd11818f36b921933d4fa67c48d
-- BUILD09 source only. Load after BUILD09_COHORTS and COHORT_ADMIN.
-- Global mutation lock order: cohort -> existing request/user-season -> order/row.
-- Existing Auth, financial verification, prices, consent and non-reactivation rules remain.

set local lock_timeout='5s';set local statement_timeout='30s';

alter function public.nal_issue_read_enrollment(uuid,text,uuid,uuid) set schema nal_private;
alter function nal_private.nal_issue_read_enrollment(uuid,text,uuid,uuid) rename to read_issue_before_cohorts;
create function public.nal_issue_read_enrollment(p_user_id uuid,p_season_slug text,p_order_id uuid,p_request_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare sid uuid;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 select id into sid from public.nal_read_seasons where slug=p_season_slug;perform nal_private.read_cohort_lock(sid);
 if not exists(select 1 from public.nal_read_enrollments where season_id=sid and user_id=p_user_id) then perform nal_private.read_cohort_require_place(sid,p_user_id,true);end if;
 return nal_private.read_issue_before_cohorts(p_user_id,p_season_slug,p_order_id,p_request_id);
end $$;

alter function public.nal_read_join(uuid,text,text,jsonb) set schema nal_private;
alter function nal_private.nal_read_join(uuid,text,text,jsonb) rename to read_join_before_cohorts;
create function public.nal_read_join(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare sid uuid;result jsonb;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 select id into sid from public.nal_read_seasons where slug=p_season_slug;
 if p_action='claim' then
  perform nal_private.read_cohort_lock(sid);
  if not exists(select 1 from public.nal_read_enrollments where season_id=sid and user_id=p_user_id) then perform nal_private.read_cohort_require_place(sid,p_user_id,true);end if;
 end if;
 result:=nal_private.read_join_before_cohorts(p_user_id,p_season_slug,p_action,p_payload);
 if p_action='options' then result:=result||jsonb_build_object('cohort',nal_private.read_cohort_summary(sid,p_user_id));end if;
 return result;
end $$;

alter function public.nal_read_payment_user(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_read_payment_user(uuid,text,jsonb) rename to read_payment_user_before_cohorts;
create function public.nal_read_payment_user(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare sid uuid;result jsonb;uid uuid;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_action<>'list' then
  if p_action='create' then select id into sid from public.nal_read_seasons where slug=p_payload->>'seasonSlug';
  else select season_id,user_id into sid,uid from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid;
   if uid is distinct from p_user_id then raise exception 'Order unavailable' using errcode='42501';end if;
  end if;
  perform nal_private.read_cohort_lock(sid);
 end if;
 if p_action='create' and not exists(select 1 from nal_private.read_checkout_orders where season_id=sid and user_id=p_user_id and state not in ('failed','refunded')) then
  perform nal_private.read_cohort_require_place(sid,p_user_id,false);
 elsif p_action in ('launch','queue-confirm','queue-confirm-recovery') then
  if exists(select 1 from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid and state='pending') then
   -- Already-started, reserved payments may settle after recruitment closes. Opening
   -- a new payment selector must still satisfy the current recruitment window.
   perform nal_private.read_cohort_require_place(sid,p_user_id,p_action<>'launch');
  end if;
 end if;
 result:=nal_private.read_payment_user_before_cohorts(p_user_id,p_action,p_payload);
 if sid is not null then result:=result||jsonb_build_object('cohort',nal_private.read_cohort_summary(sid,p_user_id));end if;
 return result;
end $$;

alter function public.nal_read_payment_processor(text,jsonb) set schema nal_private;
alter function nal_private.nal_read_payment_processor(text,jsonb) rename to read_payment_processor_before_cohorts;
create function public.nal_read_payment_processor(p_action text,p_payload jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare sid uuid;
begin
 if current_user<>'service_role' then raise exception 'Processor context required' using errcode='42501';end if;
 if p_action='hint' then select season_id into sid from nal_private.read_checkout_orders where provider_order_id=p_payload->>'providerOrderId';
 else select season_id into sid from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid;end if;
 if sid is not null then perform nal_private.read_cohort_lock(sid);end if;
 return nal_private.read_payment_processor_before_cohorts(p_action,p_payload);
end $$;

alter function nal_private.read_checkout_fulfill(uuid) rename to read_checkout_fulfill_before_cohorts;
create function nal_private.read_checkout_fulfill(p_order_id uuid)
returns void language plpgsql volatile security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;
begin
 select * into strict q from nal_private.read_checkout_orders where order_id=p_order_id;
 perform nal_private.read_cohort_lock(q.season_id);
 if q.state<>'paid' or q.refunded_won<>0 then return;end if;
 if not exists(select 1 from public.nal_read_enrollments where season_id=q.season_id and user_id=q.user_id) then
  begin perform nal_private.read_cohort_require_place(q.season_id,q.user_id,true);
  exception when sqlstate '22023' then
   update nal_private.read_checkout_orders set fulfillment='manual_review',fulfillment_reason='cohort_admission_review',updated_at=now() where order_id=p_order_id;
   return;
  end;
 end if;
 perform nal_private.read_checkout_fulfill_before_cohorts(p_order_id);
end $$;

create function nal_private.read_cohort_checkout_guard()
returns trigger language plpgsql volatile security invoker set search_path='' as $$
begin perform nal_private.read_cohort_require_place(new.season_id,new.user_id,false);return new;end $$;
create trigger nal_read_cohort_checkout before insert on nal_private.read_checkout_orders
 for each row execute function nal_private.read_cohort_checkout_guard();

alter function public.nal_read_offers(text) set schema nal_private;
alter function nal_private.nal_read_offers(text) rename to read_offers_before_cohorts;
create function public.nal_read_offers(p_slug text default null)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare original jsonb;out_items jsonb;
begin
 original:=nal_private.read_offers_before_cohorts(p_slug);
 select coalesce(jsonb_agg(o.value||jsonb_build_object('cohort',nal_private.read_cohort_summary(s.id)) order by o.ordinality),'[]') into out_items
  from jsonb_array_elements(original->'offers') with ordinality o(value,ordinality)
  left join public.nal_read_seasons s on s.slug=o.value->>'seasonSlug';
 return jsonb_build_object('offers',out_items);
end $$;

-- Keep offer editing in the same lock order; it cannot extend registration into
-- a cohort that has already started. It still cannot change price or activate READ.
alter function public.nal_read_offer_admin(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_read_offer_admin(uuid,text,jsonb) rename to read_offer_admin_before_cohorts;
create function public.nal_read_offer_admin(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare sid uuid;course_start timestamptz;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_action='save' then
  select id into sid from public.nal_read_seasons where slug=p_payload->>'seasonSlug';perform nal_private.read_cohort_lock(sid);
  select course_starts_at into course_start from nal_private.read_cohorts where season_id=sid;
  if nullif(p_payload->>'endsAt','')::timestamptz>course_start then raise exception 'Registration must close before the cohort starts' using errcode='22023';end if;
 end if;
 return nal_private.read_offer_admin_before_cohorts(p_user_id,p_action,p_payload);
end $$;

revoke all on function nal_private.read_issue_before_cohorts(uuid,text,uuid,uuid),nal_private.read_join_before_cohorts(uuid,text,text,jsonb),
 nal_private.read_payment_user_before_cohorts(uuid,text,jsonb),nal_private.read_payment_processor_before_cohorts(text,jsonb),
 nal_private.read_checkout_fulfill_before_cohorts(uuid),nal_private.read_offers_before_cohorts(text),nal_private.read_cohort_checkout_guard(),
 nal_private.read_offer_admin_before_cohorts(uuid,text,jsonb),public.nal_read_offer_admin(uuid,text,jsonb),
 public.nal_issue_read_enrollment(uuid,text,uuid,uuid),public.nal_read_join(uuid,text,text,jsonb),public.nal_read_payment_user(uuid,text,jsonb),
 public.nal_read_payment_processor(text,jsonb),nal_private.read_checkout_fulfill(uuid),public.nal_read_offers(text) from public,anon,authenticated;
grant execute on function nal_private.read_issue_before_cohorts(uuid,text,uuid,uuid),nal_private.read_join_before_cohorts(uuid,text,text,jsonb),
 nal_private.read_payment_user_before_cohorts(uuid,text,jsonb),nal_private.read_payment_processor_before_cohorts(text,jsonb),
 nal_private.read_checkout_fulfill_before_cohorts(uuid),nal_private.read_offers_before_cohorts(text),
 nal_private.read_offer_admin_before_cohorts(uuid,text,jsonb),public.nal_read_offer_admin(uuid,text,jsonb),
 public.nal_issue_read_enrollment(uuid,text,uuid,uuid),public.nal_read_join(uuid,text,text,jsonb),public.nal_read_payment_user(uuid,text,jsonb),
 public.nal_read_payment_processor(text,jsonb),nal_private.read_checkout_fulfill(uuid),public.nal_read_offers(text) to service_role;



-- LAYER 12: docs/NAL_READ_BUILD10_GUIDE.sql
-- Source SHA256 e7ba63528977abb5cfc9b39baaba7fa974dc247635cdceda7b8532ebd8ad1b73
-- BUILD10 implementation source only. UNAPPLIED; no user rows or approvals seeded.
-- Prerequisite: recorded FIX03 + complete BUILD04-09 source chain.

set local lock_timeout='5s';set local statement_timeout='30s';
create table nal_private.read_arrival_guides(
 season_id uuid primary key references public.nal_read_seasons(id) on delete restrict,
 source jsonb not null check(jsonb_typeof(source)='object' and octet_length(source::text)<=30000),
 revision integer not null default 1 check(revision>0),
 published_source jsonb,published_revision integer,published_by uuid references auth.users(id),published_at timestamptz,
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),
 check((published_source is null and published_revision is null) or
  (published_source is not null and published_revision is not null and jsonb_typeof(published_source)='object' and published_revision>0 and published_revision<=revision))
);
create index read_arrival_guides_editor on nal_private.read_arrival_guides(updated_by);
create index read_arrival_guides_publisher on nal_private.read_arrival_guides(published_by);
create table nal_private.read_preparation_checks(
 enrollment_id uuid primary key references public.nal_read_enrollments(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 guide_revision integer not null check(guide_revision>0),checks jsonb not null default '{}' check(jsonb_typeof(checks)='object' and octet_length(checks::text)<=4000),
 revision integer not null default 1 check(revision>0),updated_at timestamptz not null default now()
);
create index read_preparation_checks_owner on nal_private.read_preparation_checks(user_id);
create table nal_private.read_companion_history(
 id uuid primary key default gen_random_uuid(),season_id uuid not null references public.nal_read_seasons(id) on delete restrict,
 kind text not null check(kind in ('guide','runbook')),week_number integer,
 revision integer not null,event text not null check(event in ('saved','published')),
 source jsonb not null check(jsonb_typeof(source)='object' and octet_length(source::text)<=60000),
 actor_id uuid not null references auth.users(id),created_at timestamptz not null default now(),
 check((kind='guide' and week_number is null) or (kind='runbook' and week_number is not null and week_number between 1 and 4))
);
create index read_companion_history_season on nal_private.read_companion_history(season_id,created_at desc);
create index read_companion_history_actor on nal_private.read_companion_history(actor_id);
alter table nal_private.read_arrival_guides enable row level security;
alter table nal_private.read_preparation_checks enable row level security;
alter table nal_private.read_companion_history enable row level security;
revoke all on nal_private.read_arrival_guides,nal_private.read_preparation_checks,nal_private.read_companion_history from public,anon,authenticated,service_role;
grant select,insert,update on nal_private.read_arrival_guides,nal_private.read_preparation_checks to service_role;
grant select,insert on nal_private.read_companion_history to service_role;

create function nal_private.read_arrival_guide_check(p_source jsonb)
returns void language plpgsql immutable security invoker set search_path='' as $$
declare k text;x jsonb;ids text[]:='{}';
begin
 if p_source is null or jsonb_typeof(p_source)<>'object' or octet_length(p_source::text)>28000
  or p_source-ARRAY['headline','introduction','forWhom','takeAway','readingNote','beforeStart','book','prepare','faq']<>'{}'::jsonb then
  raise exception 'Invalid guide source' using errcode='22023';end if;
 foreach k in array array['headline','introduction','forWhom','takeAway','readingNote','beforeStart'] loop
  if jsonb_typeof(p_source->k) is distinct from 'string' or length(p_source->>k)>2000 then raise exception 'Invalid guide text' using errcode='22023';end if;
 end loop;
 if length(p_source->>'headline')>120 or jsonb_typeof(p_source->'book') is distinct from 'object'
  or (p_source->'book')-ARRAY['title','author','editionNote']<>'{}'::jsonb then raise exception 'Invalid book fields' using errcode='22023';end if;
 foreach k in array array['title','author','editionNote'] loop
  if jsonb_typeof(p_source->'book'->k) is distinct from 'string' or length(p_source->'book'->>k)>600 then raise exception 'Invalid book field' using errcode='22023';end if;
 end loop;
 if jsonb_typeof(p_source->'prepare') is distinct from 'array' or jsonb_typeof(p_source->'faq') is distinct from 'array' then raise exception 'Guide lists required' using errcode='22023';end if;
 if jsonb_array_length(p_source->'prepare')>12 or jsonb_array_length(p_source->'faq')>12 then raise exception 'Guide list too long' using errcode='22023';end if;
 for x in select value from jsonb_array_elements(p_source->'prepare') loop
  if jsonb_typeof(x)<>'object' or x-ARRAY['id','title','detail']<>'{}'::jsonb
   or jsonb_typeof(x->'id') is distinct from 'string' or coalesce(x->>'id','')!~'^[a-z0-9-]{1,40}$' or x->>'id'=any(ids)
   or jsonb_typeof(x->'title') is distinct from 'string' or length(btrim(x->>'title')) not between 1 and 160
   or jsonb_typeof(x->'detail') is distinct from 'string' or length(x->>'detail')>1000 then raise exception 'Invalid preparation item' using errcode='22023';end if;
  ids:=array_append(ids,x->>'id');
 end loop;
 for x in select value from jsonb_array_elements(p_source->'faq') loop
  if jsonb_typeof(x)<>'object' or x-ARRAY['question','answer']<>'{}'::jsonb
   or jsonb_typeof(x->'question') is distinct from 'string' or length(btrim(x->>'question')) not between 1 and 200
   or jsonb_typeof(x->'answer') is distinct from 'string' or length(btrim(x->>'answer')) not between 1 and 1500 then raise exception 'Invalid FAQ item' using errcode='22023';end if;
 end loop;
end $$;

-- Public projection: no draft manuscript, participant record, staff note or Zoom URL.
create function public.nal_read_program_detail(p_season_slug text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare offers jsonb;s public.nal_read_seasons%rowtype;g nal_private.read_arrival_guides%rowtype;weeks jsonb;live jsonb;
begin
 if p_season_slug is null or p_season_slug !~'^[a-z0-9-]{1,120}$' then raise exception 'Invalid season' using errcode='22023';end if;
 offers:=public.nal_read_offers(p_season_slug);
 if jsonb_array_length(offers->'offers')=0 then return jsonb_build_object('available',false);end if;
 select * into strict s from public.nal_read_seasons where slug=p_season_slug;
 select * into g from nal_private.read_arrival_guides where season_id=s.id;
 select coalesce(jsonb_agg(jsonb_build_object('number',w.week_number,'title',w.title,'subtitle',w.subtitle,
  'days',(select count(*) from nal_private.read_days d where d.week_id=w.id and d.season_id=s.id and d.status='published')) order by w.week_number),'[]') into weeks
  from nal_private.read_weeks w where w.season_id=s.id and w.status='published';
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'weekNumber',l.week_number,'title',l.title,'startsAt',l.starts_at,'endsAt',l.ends_at,'status',l.status) order by l.starts_at),'[]') into live
  from nal_private.read_live_sessions l where l.season_id=s.id and l.status in ('published','cancelled');
 return jsonb_build_object('available',true,'offer',offers->'offers'->0,'guide',g.published_source,
  'guideRevision',g.published_revision,'weeks',weeks,'liveSessions',live,'serverTime',now());
end $$;

-- Does not open future DAYs or count preparation as learning completion.
create function nal_private.read_arrival_state(p_user_id uuid,p_season_slug text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare a jsonb;eid uuid;sid uuid;c nal_private.read_cohorts%rowtype;g nal_private.read_arrival_guides%rowtype;
 p nal_private.read_preparation_checks%rowtype;phase text;sessions jsonb;safe_checks jsonb:='{}';x jsonb;
begin
 a:=public.nal_get_read_access(p_user_id,p_season_slug);
 if coalesce((a->>'allowed')::boolean,false) is not true then return jsonb_build_object('allowed',false,'reason',a->>'reason');end if;
 eid:=(a->>'enrollmentId')::uuid;select season_id into strict sid from public.nal_read_enrollments where id=eid and user_id=p_user_id;
 select * into c from nal_private.read_cohorts where season_id=sid;
 select * into g from nal_private.read_arrival_guides where season_id=sid;
 select * into p from nal_private.read_preparation_checks where enrollment_id=eid and user_id=p_user_id;
 phase:=case when c.season_id is null then 'unscheduled' when c.state='cancelled' then 'cancelled'
  when now()<c.course_starts_at then 'prestart' when now()>=c.course_ends_at then 'ended' else 'active' end;
 if g.published_source is not null and p.guide_revision=g.published_revision then
  for x in select value from jsonb_array_elements(g.published_source->'prepare') loop
   safe_checks:=safe_checks||jsonb_build_object(x->>'id',coalesce(p.checks->(x->>'id'),'false'::jsonb));end loop;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'weekNumber',l.week_number,'title',l.title,'startsAt',l.starts_at,'endsAt',l.ends_at,'status',l.status) order by l.starts_at),'[]') into sessions
  from nal_private.read_live_sessions l where l.season_id=sid and l.status in ('published','cancelled');
 return jsonb_build_object('allowed',true,'phase',phase,'seasonSlug',p_season_slug,'label',c.label,'startsAt',c.course_starts_at,'endsAt',c.course_ends_at,'serverTime',now(),
  'guide',g.published_source,'guideRevision',g.published_revision,'checks',safe_checks,'revision',coalesce(p.revision,0),
  'guideChanged',p.enrollment_id is not null and p.guide_revision is distinct from g.published_revision,'liveSessions',sessions);
end $$;

create function public.nal_read_companion(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare state jsonb;sid uuid;eid uuid;g nal_private.read_arrival_guides%rowtype;p nal_private.read_preparation_checks%rowtype;expected integer;x record;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>6000 then raise exception 'Invalid preparation request' using errcode='22023';end if;
 state:=nal_private.read_arrival_state(p_user_id,p_season_slug);
 if p_action='arrival' then return state;end if;
 if p_action<>'check-save' then raise exception 'Unknown preparation action' using errcode='22023';end if;
 if coalesce((state->>'allowed')::boolean,false) is not true or state->>'phase'='cancelled' then raise exception 'Read access unavailable' using errcode='42501';end if;
 select e.id,e.season_id into strict eid,sid from public.nal_read_enrollments e join public.nal_read_seasons s on s.id=e.season_id where e.user_id=p_user_id and s.slug=p_season_slug;
 select * into g from nal_private.read_arrival_guides where season_id=sid for share;
 if g.published_revision is null or g.published_revision is distinct from (p_payload->>'guideRevision')::integer then raise exception 'Guide changed; reload before saving' using errcode='40001';end if;
 if jsonb_typeof(p_payload->'checks') is distinct from 'object' then raise exception 'Invalid preparation checks' using errcode='22023';end if;
 for x in select * from jsonb_each(p_payload->'checks') loop
  if jsonb_typeof(x.value)<>'boolean' or not exists(select 1 from jsonb_array_elements(g.published_source->'prepare') i where i->>'id'=x.key) then
   raise exception 'Only current preparation checkboxes may be saved' using errcode='22023';end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(eid::text||':preparation',104));
 select * into p from nal_private.read_preparation_checks where enrollment_id=eid for update;
 expected:=(p_payload->>'revision')::integer;
 if expected is null or expected<0 or expected<>coalesce(p.revision,0) then raise exception 'Preparation changed in another tab' using errcode='40001';end if;
 insert into nal_private.read_preparation_checks(enrollment_id,user_id,guide_revision,checks)
  values(eid,p_user_id,g.published_revision,p_payload->'checks') on conflict(enrollment_id)
  do update set guide_revision=excluded.guide_revision,checks=excluded.checks,revision=nal_private.read_preparation_checks.revision+1,updated_at=now() returning * into p;
 return jsonb_build_object('saved',true,'revision',p.revision,'guideRevision',p.guide_revision);
end $$;
revoke all on function nal_private.read_arrival_guide_check(jsonb),public.nal_read_program_detail(text),nal_private.read_arrival_state(uuid,text),public.nal_read_companion(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_arrival_guide_check(jsonb),public.nal_read_program_detail(text),nal_private.read_arrival_state(uuid,text),public.nal_read_companion(uuid,text,text,jsonb) to service_role;



-- LAYER 13: docs/NAL_READ_BUILD10_STUDIO.sql
-- Source SHA256 96ee1405c09b22323d37fe285f7b1d66007ce140c73ba0f1d1deed65421654e8
-- BUILD10 source only. Load after BUILD10_GUIDE.sql. No runtime SQL executed here.
-- Existing owner/operator editors; no memberships, schedules, messages or prices created.

set local lock_timeout='5s';set local statement_timeout='30s';
create table nal_private.read_facilitator_plans(
 season_id uuid not null references public.nal_read_seasons(id) on delete restrict,week_number integer not null check(week_number between 1 and 4),
 session_id uuid references nal_private.read_live_sessions(id) on delete restrict,
 source jsonb not null check(jsonb_typeof(source)='object' and octet_length(source::text)<=50000),
 state text not null default 'draft' check(state in ('draft','ready')),revision integer not null default 1 check(revision>0),
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),primary key(season_id,week_number)
);
create index read_facilitator_plans_session on nal_private.read_facilitator_plans(session_id);
create index read_facilitator_plans_editor on nal_private.read_facilitator_plans(updated_by);
alter table nal_private.read_facilitator_plans enable row level security;
revoke all on nal_private.read_facilitator_plans from public,anon,authenticated,service_role;
grant select,insert,update on nal_private.read_facilitator_plans to service_role;

create function nal_private.read_runbook_check(p_source jsonb,p_ready boolean default false)
returns void language plpgsql immutable security invoker set search_path='' as $$
declare k text;x jsonb;ids text[]:='{}';total_minutes integer:=0;minutes integer;
begin
 if p_source is null or jsonb_typeof(p_source)<>'object' or octet_length(p_source::text)>48000 or p_source-ARRAY['aim','opening','closing','followUp','agenda','debrief']<>'{}'::jsonb then raise exception 'Invalid runbook' using errcode='22023';end if;
 foreach k in array array['aim','opening','closing','followUp'] loop
  if jsonb_typeof(p_source->k) is distinct from 'string' or length(p_source->>k)>2000 then raise exception 'Invalid runbook text' using errcode='22023';end if;end loop;
 if jsonb_typeof(p_source->'debrief') is distinct from 'object' or (p_source->'debrief')-ARRAY['observed','adjust','next']<>'{}'::jsonb then raise exception 'Invalid operating reflection' using errcode='22023';end if;
 foreach k in array array['observed','adjust','next'] loop
  if jsonb_typeof(p_source->'debrief'->k) is distinct from 'string' or length(p_source->'debrief'->>k)>3000 then raise exception 'Invalid operating reflection text' using errcode='22023';end if;end loop;
 if jsonb_typeof(p_source->'agenda') is distinct from 'array' then raise exception 'Agenda array required' using errcode='22023';end if;
 if jsonb_array_length(p_source->'agenda')>20 then raise exception 'Agenda too long' using errcode='22023';end if;
 for x in select value from jsonb_array_elements(p_source->'agenda') loop
  if jsonb_typeof(x)<>'object' or x-ARRAY['id','title','minutes','prompt','notes']<>'{}'::jsonb
   or jsonb_typeof(x->'id') is distinct from 'string' or coalesce(x->>'id','')!~'^[a-z0-9-]{1,60}$' or x->>'id'=any(ids)
   or jsonb_typeof(x->'title') is distinct from 'string' or length(btrim(x->>'title')) not between 1 and 120
   or jsonb_typeof(x->'minutes') is distinct from 'number'
   or jsonb_typeof(x->'prompt') is distinct from 'string' or length(x->>'prompt')>1500
   or jsonb_typeof(x->'notes') is distinct from 'string' or length(x->>'notes')>2000 then raise exception 'Invalid agenda item' using errcode='22023';end if;
  if (x->>'minutes')::numeric<>trunc((x->>'minutes')::numeric) or (x->>'minutes')::numeric not between 1 and 120 then raise exception 'Agenda minutes must be whole minutes' using errcode='22023';end if;
  minutes:=(x->>'minutes')::integer;total_minutes:=total_minutes+minutes;ids:=array_append(ids,x->>'id');
 end loop;
 if total_minutes>360 then raise exception 'Agenda exceeds six hours' using errcode='22023';end if;
 if p_ready and (jsonb_array_length(p_source->'agenda')=0 or length(btrim(p_source->>'aim'))=0 or length(btrim(p_source->>'opening'))=0 or length(btrim(p_source->>'closing'))=0) then raise exception 'Complete purpose, opening, closing and agenda before marking ready' using errcode='22023';end if;
end $$;

create function public.nal_read_studio(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare role_name text;sid uuid;week integer;expected integer;src jsonb;items jsonb;days jsonb;meetings jsonb;history jsonb;
 g nal_private.read_arrival_guides%rowtype;p nal_private.read_facilitator_plans%rowtype;selected_session uuid;next_state text;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified editor required' using errcode='42501';end if;
 select a.role into role_name from nal_private.admins a where a.user_id=p_user_id;
 if role_name is null or role_name not in ('owner','operator') then raise exception 'Editor permission required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>58000 then raise exception 'Invalid studio payload' using errcode='22023';end if;
 if p_action='seasons' then
  select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'title',s.title,'cohortLabel',c.label) order by s.created_at desc),'[]') into items from public.nal_read_seasons s left join nal_private.read_cohorts c on c.season_id=s.id;
  return jsonb_build_object('role',role_name,'seasons',items);
 end if;
 if p_season_slug is null or p_season_slug!~'^[a-z0-9-]{1,120}$' then raise exception 'Invalid season' using errcode='22023';end if;
 select s.id into sid from public.nal_read_seasons s where s.slug=p_season_slug;
 if sid is null then raise exception 'Season unavailable' using errcode='22023';end if;
 if p_action in ('get','plan-save') then
  week:=(p_payload->>'weekNumber')::integer;if week is null or week not between 1 and 4 then raise exception 'Invalid week' using errcode='22023';end if;
 end if;
 if p_action='get' then
  select * into g from nal_private.read_arrival_guides where season_id=sid;
  select * into p from nal_private.read_facilitator_plans where season_id=sid and week_number=week;
  select coalesce(jsonb_agg(jsonb_build_object('number',w.week_number,'title',w.title,'subtitle',w.subtitle,'status',w.status) order by w.week_number),'[]') into items from nal_private.read_weeks w where w.season_id=sid;
  -- Course content only; no joins to personal answers, drafts, experiments or LIVE notes.
  select coalesce(jsonb_agg(jsonb_build_object('dayNumber',d.day_number,'title',d.title,'minutes',d.estimated_minutes,
   'steps',(select coalesce(jsonb_agg(jsonb_build_object('order',st.step_order,'type',st.step_type,'content',st.content,'prompt',st.prompt,'required',st.required,'contentKey',st.content_key) order by st.step_order),'[]')
    from nal_private.read_day_steps st where st.day_id=d.id and st.status='published')) order by d.day_number),'[]') into days
   from nal_private.read_days d join nal_private.read_weeks w on w.id=d.week_id and w.season_id=sid where d.season_id=sid and w.week_number=week and w.status='published' and d.status='published';
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'weekNumber',l.week_number,'title',l.title,'question',l.opening_question,'startsAt',l.starts_at,'endsAt',l.ends_at,'status',l.status) order by l.starts_at),'[]') into meetings
   from nal_private.read_live_sessions l where l.season_id=sid and l.week_number=week;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into history from (
   select id,kind,week_number,revision,event,created_at from nal_private.read_companion_history h where h.season_id=sid and (h.kind='guide' or h.week_number=week) order by created_at desc limit 20) x;
  return jsonb_build_object('role',role_name,'seasonSlug',p_season_slug,'weeks',items,'weekNumber',week,'days',days,'liveSessions',meetings,
   'guide',jsonb_build_object('source',g.source,'revision',coalesce(g.revision,0),'publishedRevision',g.published_revision,'publishedAt',g.published_at),
   'runbook',jsonb_build_object('source',p.source,'revision',coalesce(p.revision,0),'state',coalesce(p.state,'draft'),'sessionId',p.session_id,'updatedAt',p.updated_at),'history',history);
 end if;
 expected:=(p_payload->>'revision')::integer;if expected is null or expected<0 then raise exception 'Revision required' using errcode='22023';end if;
 if p_action in ('guide-save','guide-publish') then
  perform pg_advisory_xact_lock(hashtextextended(sid::text||':arrival-guide',105));
  select * into g from nal_private.read_arrival_guides where season_id=sid for update;
  if expected<>coalesce(g.revision,0) then raise exception 'Guide changed in another editor' using errcode='40001';end if;
  if p_action='guide-save' then
   src:=p_payload->'source';perform nal_private.read_arrival_guide_check(src);
   insert into nal_private.read_arrival_guides(season_id,source,updated_by) values(sid,src,p_user_id)
    on conflict(season_id) do update set source=excluded.source,revision=nal_private.read_arrival_guides.revision+1,updated_by=p_user_id,updated_at=now() returning * into g;
   insert into nal_private.read_companion_history(season_id,kind,revision,event,source,actor_id) values(sid,'guide',g.revision,'saved',g.source,p_user_id);
  else
   if role_name<>'owner' or p_payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Owner publication approval required' using errcode='42501';end if;
   if g.season_id is null then raise exception 'Save guide first' using errcode='22023';end if;
   perform nal_private.read_arrival_guide_check(g.source);
   if length(btrim(g.source->>'headline'))=0 or length(btrim(g.source->>'introduction'))=0 then raise exception 'Headline and introduction required before publication' using errcode='22023';end if;
   update nal_private.read_arrival_guides set published_source=source,published_revision=revision,published_by=p_user_id,published_at=now() where season_id=sid returning * into g;
   insert into nal_private.read_companion_history(season_id,kind,revision,event,source,actor_id) values(sid,'guide',g.revision,'published',g.published_source,p_user_id);
  end if;
  return jsonb_build_object('saved',true,'revision',g.revision,'publishedRevision',g.published_revision,'publishedAt',g.published_at);
 end if;
 if p_action='plan-save' then
  perform pg_advisory_xact_lock(hashtextextended(sid::text||':runbook:'||week::text,106));
  select * into p from nal_private.read_facilitator_plans where season_id=sid and week_number=week for update;
  if expected<>coalesce(p.revision,0) then raise exception 'Runbook changed in another editor' using errcode='40001';end if;
  src:=p_payload->'source';next_state:=p_payload->>'state';selected_session:=nullif(p_payload->>'sessionId','')::uuid;
  if next_state is null or next_state not in ('draft','ready') then raise exception 'Invalid runbook state' using errcode='22023';end if;
  perform nal_private.read_runbook_check(src,next_state='ready');
  if selected_session is not null and not exists(select 1 from nal_private.read_live_sessions l where l.id=selected_session and l.season_id=sid and l.week_number=week) then raise exception 'Select a LIVE from this same week and cohort' using errcode='22023';end if;
  insert into nal_private.read_facilitator_plans(season_id,week_number,session_id,source,state,updated_by) values(sid,week,selected_session,src,next_state,p_user_id)
   on conflict(season_id,week_number) do update set session_id=excluded.session_id,source=excluded.source,state=excluded.state,revision=nal_private.read_facilitator_plans.revision+1,updated_by=p_user_id,updated_at=now() returning * into p;
  insert into nal_private.read_companion_history(season_id,kind,week_number,revision,event,source,actor_id)
   values(sid,'runbook',week,p.revision,'saved',jsonb_build_object('plan',p.source,'state',p.state,'sessionId',p.session_id),p_user_id);
  return jsonb_build_object('saved',true,'revision',p.revision,'state',p.state,'updatedAt',p.updated_at);
 end if;
 raise exception 'Unknown studio action' using errcode='22023';
end $$;
revoke all on function nal_private.read_runbook_check(jsonb,boolean),public.nal_read_studio(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_runbook_check(jsonb,boolean),public.nal_read_studio(uuid,text,text,jsonb) to service_role;



-- LAYER 14: docs/NAL_READ_BUILD10_ARRIVAL_BRIDGE.sql
-- Source SHA256 b5a3508842ebd4d62bdfaff275464c9245939c1d9417d3ef702a7b34940f324f
-- BUILD10 source only. Load last after GUIDE and STUDIO.
-- Add preparation metadata without rewriting DAY gates or marking learning progress.

set local lock_timeout='5s';set local statement_timeout='30s';
alter function public.nal_read_bootstrap(uuid,text) set schema nal_private;
alter function nal_private.nal_read_bootstrap(uuid,text) rename to read_bootstrap_before_arrival;
create function public.nal_read_bootstrap(p_user_id uuid,p_season_slug text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare original jsonb;
begin
 original:=nal_private.read_bootstrap_before_arrival(p_user_id,p_season_slug);
 return original||jsonb_build_object('arrival',nal_private.read_arrival_state(p_user_id,p_season_slug));
end $$;
revoke all on function public.nal_read_bootstrap(uuid,text),nal_private.read_bootstrap_before_arrival(uuid,text) from public,anon,authenticated;
grant execute on function public.nal_read_bootstrap(uuid,text),nal_private.read_bootstrap_before_arrival(uuid,text) to service_role;



-- LAYER 15: docs/NAL_READ_BUILD12_SUPPORT.sql
-- Source SHA256 7720c4ebc168aed571c28d39d56c7b248e38439a10780f337de1f0fd85c9a956
-- BUILD12 SOURCE ONLY: not applied, tested, deployed or opened for customers.
-- Requires recorded FIX03 identity boundary and BUILD06/07/09 context tables.
-- This layer never reads coaching answers or mutates payment/enrollment state.

set local lock_timeout='5s';
set local statement_timeout='30s';
create table nal_private.support_threads (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 category text not null check(category in ('account','read','payment','live','technical','other')),
 subject text not null check(length(btrim(subject)) between 1 and 120),
 season_id uuid references public.nal_read_seasons(id) on delete restrict,
 order_id uuid references public.nal_orders(id) on delete restrict,
 context_snapshot jsonb not null default '{}' check(jsonb_typeof(context_snapshot)='object' and octet_length(context_snapshot::text)<=8000),
 state text not null default 'open' check(state in ('open','answered','resolved')),
 assigned_to uuid references auth.users(id) on delete restrict,
 message_count integer not null default 0 check(message_count between 0 and 1000),
 member_read_seq integer not null default 0 check(member_read_seq between 0 and message_count),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),resolved_at timestamptz
);
create index support_threads_owner on nal_private.support_threads(user_id,updated_at desc,id);
create index support_threads_assignee on nal_private.support_threads(assigned_to,state,updated_at desc,id);
create index support_threads_queue on nal_private.support_threads(state,updated_at desc,id);
create index support_threads_season on nal_private.support_threads(season_id);
create index support_threads_order on nal_private.support_threads(order_id);
create table nal_private.support_messages (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references nal_private.support_threads(id) on delete cascade,
 seq integer not null check(seq>0),author_id uuid not null references auth.users(id) on delete restrict,
 author_kind text not null check(author_kind in ('member','staff')),
 body text not null check(length(btrim(body,E' \t\r\n'||chr(12288)||chr(8203))) between 1 and 4000),
 created_at timestamptz not null default now(),unique(thread_id,seq)
);
create index support_messages_author on nal_private.support_messages(author_id,created_at desc);
-- Fingerprints compare retried commands, not passwords or authorization. Do not duplicate message bodies.
create table nal_private.support_commands (
 actor_id uuid not null references auth.users(id) on delete restrict,request_id uuid not null,
 thread_id uuid not null references nal_private.support_threads(id) on delete cascade,
 action text not null check(action in ('member:create','member:reply','member:resolve','member:reopen','staff:reply','staff:resolve','staff:reopen','staff:assign')),
 fingerprint text not null check(length(fingerprint)=32),created_at timestamptz not null default now(),primary key(actor_id,request_id)
);
create index support_commands_thread on nal_private.support_commands(thread_id,created_at);
alter table nal_private.support_threads enable row level security;
alter table nal_private.support_messages enable row level security;
alter table nal_private.support_commands enable row level security;
revoke all on nal_private.support_threads,nal_private.support_messages,nal_private.support_commands from public,anon,authenticated,service_role;
grant select,insert,update on nal_private.support_threads to service_role;
grant select,insert on nal_private.support_messages,nal_private.support_commands to service_role;

create function nal_private.support_summary(p_thread nal_private.support_threads,p_staff boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p_thread.id,'category',p_thread.category,'subject',p_thread.subject,'state',p_thread.state,
  'revision',p_thread.revision,'createdAt',p_thread.created_at,'updatedAt',p_thread.updated_at,'resolvedAt',p_thread.resolved_at,
  'context',p_thread.context_snapshot,'messageCount',p_thread.message_count,
  'unread',exists(select 1 from nal_private.support_messages m where m.thread_id=p_thread.id and m.author_kind='staff' and m.seq>p_thread.member_read_seq))
 ||case when p_staff then jsonb_build_object('assignedTo',p_thread.assigned_to,
    'displayName',coalesce((select nullif(p.display_name,'') from nal_private.account_preferences p where p.user_id=p_thread.user_id),'참가자'))
   else '{}'::jsonb end
$$;
create function nal_private.support_owned_context(p_user_id uuid,p_season_slug text,p_order_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare s public.nal_read_seasons%rowtype;o public.nal_orders%rowtype;ctx jsonb:='{}';titles text;
begin
 if p_order_id is not null then
  select * into o from public.nal_orders where id=p_order_id and user_id=p_user_id;
  if not found then raise exception 'Context unavailable' using errcode='42501';end if;
  select left(string_agg(i.title_snapshot,' / ' order by i.id),300) into titles from public.nal_order_items i where i.order_id=o.id;
  ctx:=ctx||jsonb_build_object('order',jsonb_build_object('id',o.id,'title',coalesce(titles,'내 주문'),'stateAtCreation',o.status));
 end if;
 if p_season_slug is not null then
  select * into s from public.nal_read_seasons where slug=p_season_slug;
  if not found or not (
   exists(select 1 from public.nal_read_enrollments e where e.user_id=p_user_id and e.season_id=s.id)
   or exists(select 1 from nal_private.read_waitlist w where w.user_id=p_user_id and w.season_id=s.id)
   or exists(select 1 from nal_private.read_checkout_orders q where q.user_id=p_user_id and q.season_id=s.id)
  ) then raise exception 'Context unavailable' using errcode='42501';end if;
  if p_order_id is not null and not (
   exists(select 1 from nal_private.read_checkout_orders q where q.order_id=o.id and q.user_id=p_user_id and q.season_id=s.id)
   or exists(select 1 from public.nal_order_items i where i.order_id=o.id and i.catalog_kind=s.product_kind and i.catalog_id=s.product_id)
  ) then raise exception 'Selected order and season differ' using errcode='22023';end if;
  ctx:=ctx||jsonb_build_object('season',jsonb_build_object('slug',s.slug,'title',s.title,
   'cohortLabel',(select c.label from nal_private.read_cohorts c where c.season_id=s.id)));
 end if;
 return ctx;
end $$;

create function nal_private.support_core(p_user_id uuid,p_staff boolean,p_action text,p_payload jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare role_name text;is_owner boolean:=false;t nal_private.support_threads%rowtype;
 prior nal_private.support_commands%rowtype;v_request uuid;v_thread uuid;v_digest text;v_command text;
 ctx jsonb;items jsonb;msgs jsonb;seasons jsonb;orders jsonb;sid uuid;oid uuid;target uuid;
 v_subject text;v_body text;v_category text;v_slug text;off integer;after_seq integer;last_seq integer;
 expected integer;next_state text;staff_kind text;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_staff is null or p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>22000 then raise exception 'Invalid support request' using errcode='22023';end if;
 if p_staff then
  select a.role into role_name from nal_private.admins a where a.user_id=p_user_id;
  if role_name is null or role_name not in ('owner','operator') then raise exception 'Support staff permission required' using errcode='42501';end if;
  is_owner:=role_name='owner';
  if p_action not in ('list','get','staff','reply','resolve','reopen','assign') then raise exception 'Unknown staff action' using errcode='22023';end if;
 else
  if p_action not in ('contexts','list','get','create','reply','resolve','reopen','read') then raise exception 'Unknown member action' using errcode='22023';end if;
 end if;
 if p_action='contexts' then
  select coalesce(jsonb_agg(x.item order by x.created_at desc),'[]') into seasons from (
   select s.created_at,jsonb_build_object('slug',s.slug,'title',s.title,'label',c.label) as item
   from public.nal_read_seasons s left join nal_private.read_cohorts c on c.season_id=s.id
   where exists(select 1 from public.nal_read_enrollments e where e.user_id=p_user_id and e.season_id=s.id)
    or exists(select 1 from nal_private.read_waitlist w where w.user_id=p_user_id and w.season_id=s.id)
    or exists(select 1 from nal_private.read_checkout_orders q where q.user_id=p_user_id and q.season_id=s.id)
   order by s.created_at desc,s.id limit 100
  ) x;
  select coalesce(jsonb_agg(x.item order by x.created_at desc),'[]') into orders from (
   select o.created_at,jsonb_build_object('id',o.id,'createdAt',o.created_at,'state',o.status,
    'title',coalesce((select left(string_agg(i.title_snapshot,' / ' order by i.id),300) from public.nal_order_items i where i.order_id=o.id),'내 주문')) as item
   from public.nal_orders o where o.user_id=p_user_id order by o.created_at desc,o.id limit 100
  ) x;
  return jsonb_build_object('seasons',seasons,'orders',orders,'limit',100);
 end if;
 if p_action='staff' then
  if not is_owner then raise exception 'Only owner assigns support access' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.user_id,'label',coalesce(nullif(p.display_name,''),'운영자 '||left(a.user_id::text,8)),'role',a.role) order by a.role,a.user_id),'[]')
   into items from nal_private.admins a left join nal_private.account_preferences p on p.user_id=a.user_id where a.role in ('owner','operator');
  return jsonb_build_object('staff',items);
 end if;
 if p_action='list' then
  off:=coalesce((p_payload->>'offset')::integer,0);
  if off<0 or off>10000 or coalesce(p_payload->>'state','all') not in ('all','open','answered','resolved')
   or coalesce(p_payload->>'category','all') not in ('all','account','read','payment','live','technical','other') then raise exception 'Invalid support filter' using errcode='22023';end if;
  select coalesce(jsonb_agg(nal_private.support_summary(x.item,p_staff) order by x.updated_at desc,x.id),'[]') into items from (
   select th as item,th.updated_at,th.id from nal_private.support_threads th where
    ((not p_staff and th.user_id=p_user_id) or (p_staff and (is_owner or th.assigned_to=p_user_id)))
    and (coalesce(p_payload->>'state','all')='all' or th.state=p_payload->>'state')
    and (coalesce(p_payload->>'category','all')='all' or th.category=p_payload->>'category')
   order by th.updated_at desc,th.id limit 51 offset off
  ) x;
  return jsonb_build_object('threads',items,'role',case when p_staff then role_name else 'member' end,'offset',off);
 end if;
 if p_action in ('create','reply','resolve','reopen','assign') then
  v_request:=(p_payload->>'requestId')::uuid;
  if v_request is null then raise exception 'Request identity required' using errcode='22023';end if;
  v_command:=(case when p_staff then 'staff:' else 'member:' end)||p_action;
  v_digest:=md5(jsonb_build_object('command',v_command,'payload',p_payload-'requestId')::text);
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':support-request:'||v_request::text,121));
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':support-writes',122));
  select * into prior from nal_private.support_commands c where c.actor_id=p_user_id and c.request_id=v_request;
  if found then
   if prior.action<>v_command or prior.fingerprint<>v_digest then raise exception 'Request id already used with different content' using errcode='23505';end if;
   select * into t from nal_private.support_threads where id=prior.thread_id;
   if coalesce((not p_staff and t.user_id=p_user_id) or (p_staff and (is_owner or t.assigned_to=p_user_id)),false) is not true then
    raise exception 'Inquiry unavailable' using errcode='42501';end if;
   return jsonb_build_object('saved',true,'replayed',true,'thread',nal_private.support_summary(t,p_staff));
  end if;
 end if;
 if p_action='create' then
  v_subject:=btrim(p_payload->>'subject');v_body:=btrim(p_payload->>'body',E' \t\r\n'||chr(12288)||chr(8203));v_category:=p_payload->>'category';
  v_slug:=nullif(p_payload->>'seasonSlug','');oid:=nullif(p_payload->>'orderId','')::uuid;
  if v_subject is null or length(v_subject) not between 1 and 120 or v_body is null or length(v_body) not between 1 and 4000
   or v_category is null or v_category not in ('account','read','payment','live','technical','other')
   or p_payload->'shareConfirmed' is distinct from 'true'::jsonb then raise exception 'Confirm inquiry contents before sending' using errcode='22023';end if;
  if (select count(*) from nal_private.support_threads where user_id=p_user_id and state<>'resolved')>=10
   or (select count(*) from nal_private.support_threads where user_id=p_user_id and created_at>now()-interval '1 minute')>=3 then raise exception 'Support submission limit reached' using errcode='P0120';end if;
  ctx:=nal_private.support_owned_context(p_user_id,v_slug,oid);
  if v_slug is not null then select id into strict sid from public.nal_read_seasons where slug=v_slug;end if;
  insert into nal_private.support_threads(user_id,category,subject,season_id,order_id,context_snapshot,message_count,member_read_seq)
   values(p_user_id,v_category,v_subject,sid,oid,ctx,1,1) returning * into t;
  insert into nal_private.support_messages(thread_id,seq,author_id,author_kind,body) values(t.id,1,p_user_id,'member',v_body);
  insert into nal_private.support_commands(actor_id,request_id,thread_id,action,fingerprint) values(p_user_id,v_request,t.id,v_command,v_digest);
  return jsonb_build_object('saved',true,'thread',nal_private.support_summary(t,false));
 end if;
 v_thread:=(p_payload->>'id')::uuid;
 select * into t from nal_private.support_threads th where th.id=v_thread and
  ((not p_staff and th.user_id=p_user_id) or (p_staff and (is_owner or th.assigned_to=p_user_id))) for update;
 if not found then raise exception 'Inquiry unavailable' using errcode='42501';end if;
 if p_action='get' then
  after_seq:=coalesce((p_payload->>'afterSeq')::integer,0);
  if after_seq<0 or after_seq>t.message_count then raise exception 'Invalid message page' using errcode='22023';end if;
  select coalesce(jsonb_agg(jsonb_build_object('seq',m.seq,'author',m.author_kind,'body',m.body,'createdAt',m.created_at) order by m.seq),'[]'),coalesce(max(m.seq),after_seq)
   into msgs,last_seq from (select sm.* from nal_private.support_messages sm where sm.thread_id=t.id and sm.seq>after_seq order by sm.seq limit 50) m;
  return jsonb_build_object('thread',nal_private.support_summary(t,p_staff),'messages',msgs,'lastSeq',last_seq,'hasMore',last_seq<t.message_count,'role',case when p_staff then role_name else 'member' end);
 end if;
 if p_action='read' then
  after_seq:=(p_payload->>'throughSeq')::integer;
  if after_seq is null or after_seq<0 or after_seq>t.message_count then raise exception 'Invalid read receipt' using errcode='22023';end if;
  update nal_private.support_threads set member_read_seq=greatest(member_read_seq,after_seq) where id=t.id;
  return jsonb_build_object('saved',true);
 end if;
 expected:=(p_payload->>'revision')::integer;
 if expected is null or expected<>t.revision then raise exception 'Inquiry changed; reload latest conversation' using errcode='40001';end if;
 if p_action='reply' then
  v_body:=btrim(p_payload->>'body',E' \t\r\n'||chr(12288)||chr(8203));
  if v_body is null or length(v_body) not between 1 and 4000 or p_payload->'shareConfirmed' is distinct from 'true'::jsonb then raise exception 'Confirm the reply text' using errcode='22023';end if;
  if t.state='resolved' then raise exception 'Reopen the inquiry before adding a reply' using errcode='22023';end if;
  if t.message_count>=1000 or (select count(*) from nal_private.support_messages where author_id=p_user_id and created_at>now()-interval '1 minute')>=10 then raise exception 'Support submission limit reached' using errcode='P0120';end if;
  staff_kind:=case when p_staff then 'staff' else 'member' end;
  insert into nal_private.support_messages(thread_id,seq,author_id,author_kind,body) values(t.id,t.message_count+1,p_user_id,staff_kind,v_body);
  update nal_private.support_threads set message_count=message_count+1,member_read_seq=case when not p_staff then message_count+1 else member_read_seq end,
   state=case when p_staff then 'answered' else 'open' end,revision=revision+1,updated_at=now(),resolved_at=null where id=t.id returning * into t;
 elsif p_action in ('resolve','reopen') then
  if p_payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Explicit state change required' using errcode='22023';end if;
  if (p_action='reopen' and t.state<>'resolved') or (p_action='resolve' and t.state='resolved') then raise exception 'Inquiry state already changed' using errcode='40001';end if;
  next_state:=case when p_action='resolve' then 'resolved' else 'open' end;
  update nal_private.support_threads set state=next_state,revision=revision+1,updated_at=now(),resolved_at=case when next_state='resolved' then now() else null end where id=t.id returning * into t;
 elsif p_action='assign' then
  if not is_owner or p_payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Owner must confirm assignment' using errcode='42501';end if;
  target:=nullif(p_payload->>'assignedTo','')::uuid;
  if target is not null and not exists(select 1 from nal_private.admins where user_id=target and role in ('owner','operator')) then raise exception 'Support assignee unavailable' using errcode='22023';end if;
  update nal_private.support_threads set assigned_to=target,revision=revision+1,updated_at=now() where id=t.id returning * into t;
 else raise exception 'Unknown support mutation' using errcode='22023';end if;
 insert into nal_private.support_commands(actor_id,request_id,thread_id,action,fingerprint) values(p_user_id,v_request,t.id,v_command,v_digest);
 return jsonb_build_object('saved',true,'thread',nal_private.support_summary(t,p_staff));
end $$;
create function public.nal_support_user(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language sql volatile security invoker set search_path='' as $$ select nal_private.support_core(p_user_id,false,p_action,p_payload) $$;
create function public.nal_support_admin(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language sql volatile security invoker set search_path='' as $$ select nal_private.support_core(p_user_id,true,p_action,p_payload) $$;
revoke all on function nal_private.support_summary(nal_private.support_threads,boolean),nal_private.support_owned_context(uuid,text,uuid),nal_private.support_core(uuid,boolean,text,jsonb),public.nal_support_user(uuid,text,jsonb),public.nal_support_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.support_summary(nal_private.support_threads,boolean),nal_private.support_owned_context(uuid,text,uuid),nal_private.support_core(uuid,boolean,text,jsonb),public.nal_support_user(uuid,text,jsonb),public.nal_support_admin(uuid,text,jsonb) to service_role;



-- LAYER 16: docs/NAL_READ_BUILD14_HOME.sql
-- Source SHA256 71ea12d8cd35200c6b8381bf4757c8b60c3637edaa70832f4d11f80841a6dbbe
-- BUILD14 SOURCE ONLY. Unapplied; no tables, data, schedules or permissions for users created.
-- Requires the complete BUILD04-13 source chain. READ-only account overview.

set local lock_timeout='5s';
set local statement_timeout='30s';

create function nal_private.read_account_home(p_user_id uuid,p_runtime jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 result jsonb;profile jsonb;programs jsonb:='[]';lives jsonb:='[]';items jsonb;
 e record;a jsonb;b jsonb;next_day jsonb;item jsonb;part jsonb;
 phase text;next_kind text;display_name text;staff_role text;
 program_total integer:=0;recorded integer;before_done boolean;total integer;pending integer;k text;
begin
 if not nal_private.read_verified_subject(p_user_id) then
  raise exception 'Verified identity required' using errcode='42501';end if;
 if p_runtime is null or jsonb_typeof(p_runtime)<>'object' or
  p_runtime-ARRAY['read','companion','cohorts','support','payments']<>'{}'::jsonb then
  raise exception 'Invalid server feature context' using errcode='22023';end if;
 foreach k in array array['read','companion','cohorts','support','payments'] loop
  if jsonb_typeof(p_runtime->k) is distinct from 'boolean' then
   raise exception 'Server feature context required' using errcode='22023';end if;
 end loop;
 result:=jsonb_build_object('version',14,'serverTime',now(),'refreshMode','explicit',
  'programs',jsonb_build_object('state','disabled'), 'live',jsonb_build_object('state','disabled'),
  'support',jsonb_build_object('state','disabled'),'waitlist',jsonb_build_object('state','disabled'),
  'orders',jsonb_build_object('state','disabled'));
 begin
  select p.display_name into display_name from nal_private.account_preferences p where p.user_id=p_user_id;
  select a.role into staff_role from nal_private.admins a where a.user_id=p_user_id and a.role in ('owner','operator');
  profile:=jsonb_build_object('state','ready','displayName',coalesce(display_name,''),'staffRole',staff_role);
 exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
  profile:=jsonb_build_object('state','unavailable');
 end;
 result:=result||jsonb_build_object('profile',profile);

 if p_runtime->'read'='true'::jsonb then
  begin
   select count(*)::integer into program_total from public.nal_read_enrollments where user_id=p_user_id;
   -- Bounded lookup: active cohorts first, then future preparation and archived/restricted entries.
   for e in
    select en.id,en.season_id,en.status,en.created_at,s.slug,s.title,c.label,c.state as cohort_state,
     c.course_starts_at,c.course_ends_at,c.season_id as cohort_id,activity.last_activity
    from public.nal_read_enrollments en join public.nal_read_seasons s on s.id=en.season_id
    left join nal_private.read_cohorts c on c.season_id=s.id
    left join lateral (select max(p.updated_at) as last_activity from public.nal_read_day_progress p
     where p.user_id=p_user_id and p.enrollment_id=en.id) activity on true
    where en.user_id=p_user_id
    order by case when en.status not in ('active','completed') then 5
     when c.state='cancelled' then 4 when now()>=c.course_starts_at and now()<c.course_ends_at then 0
     when now()<c.course_starts_at then 1 when c.season_id is null then 3 else 2 end,
     activity.last_activity desc nulls last,c.course_starts_at asc nulls last,en.created_at desc,en.id
    limit 20
   loop
    phase:=case when e.cohort_id is null then 'unscheduled' when e.cohort_state='cancelled' then 'cancelled'
     when now()<e.course_starts_at then 'prestart' when now()>=e.course_ends_at then 'ended' else 'active' end;
    item:=jsonb_build_object('enrollmentId',e.id,'slug',e.slug,'title',e.title,'label',e.label,
     'status',e.status,'phase',phase,'startsAt',e.course_starts_at,'endsAt',e.course_ends_at,
     'lastActivityAt',e.last_activity,'companionAvailable',p_runtime->'companion'='true'::jsonb);
    begin
     a:=public.nal_get_read_access(p_user_id,e.slug);
     if coalesce((a->>'allowed')::boolean,false) is not true then
      item:=item||jsonb_build_object('state','restricted','allowed',false,'reason',a->>'reason','next',jsonb_build_object('kind','account'));
     else
      b:=null;next_day:=null;recorded:=null;before_done:=null;
      if phase in ('prestart','unscheduled','cancelled') then
       next_kind:=case when p_runtime->'companion'='true'::jsonb then 'prepare' else 'today' end;
      else
       -- Bootstrap is read-only. Do NOT call nal_get_read_day here: that marks a DAY started.
       b:=public.nal_read_bootstrap(p_user_id,e.slug);
       select count(*)::integer into recorded from jsonb_array_elements(b->'journey') j
        where (j->>'dayNumber')::integer>0 and j->>'progress'='completed';
       before_done:=exists(select 1 from jsonb_array_elements(b->'journey') j
        where (j->>'dayNumber')::integer=0 and j->>'progress'='completed');
       select j into next_day from jsonb_array_elements(b->'journey') j
        where j->'unlocked'='true'::jsonb and j->>'progress' is distinct from 'completed'
        order by (j->>'dayNumber')::integer limit 1;
       next_kind:=case when phase='ended' then 'archive' when next_day is not null then 'day'
        when jsonb_array_length(b->'journey')>0 and not exists(select 1 from jsonb_array_elements(b->'journey') j
         where j->>'progress' is distinct from 'completed') then 'archive' else 'journey' end;
      end if;
      item:=item||jsonb_build_object('state','ready','allowed',true,'recordedDays',recorded,'beforeCompleted',before_done,
       'next',jsonb_build_object('kind',next_kind,'dayNumber',case when next_kind='day' then next_day->'dayNumber' end,
        'title',case when next_kind='day' then next_day->'title' end,
        'minutes',case when next_kind='day' then next_day->'estimatedMinutes' end));
      if phase not in ('cancelled','unscheduled') then
       select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'slug',e.slug,'programTitle',e.title,'cohortLabel',e.label,
        'weekNumber',l.week_number,'title',l.title,'startsAt',l.starts_at,'endsAt',l.ends_at,
        'stage',case when now()>=l.starts_at then 'in_progress' when now()>=l.starts_at-interval '15 minutes' then 'opening' else 'scheduled' end)
        order by l.starts_at,l.id),'[]') into part
       from nal_private.read_live_sessions l where l.season_id=e.season_id and l.status='published' and l.ends_at>now();
       lives:=lives||part;
      end if;
     end if;
    exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
     item:=item||jsonb_build_object('state','unavailable','allowed',false,'next',jsonb_build_object('kind','account'));
    end;
    programs:=programs||jsonb_build_array(item);
   end loop;
   total:=jsonb_array_length(lives);
   select coalesce(jsonb_agg(x.item order by (x.item->>'startsAt')::timestamptz,x.item->>'id'),'[]') into lives
    from (select j as item from jsonb_array_elements(lives) j order by (j->>'startsAt')::timestamptz,j->>'id' limit 5) x;
   result:=result||jsonb_build_object('programs',jsonb_build_object('state','ready','items',programs,'total',program_total,
     'scope','priority_cohorts','limit',20,'limited',program_total>20),
    'live',jsonb_build_object('state',case when exists(select 1 from jsonb_array_elements(programs) j where j->>'state'='unavailable') then 'partial' else 'ready' end,
     'items',lives,'totalWithinLoadedCohorts',total,'limit',5,'limited',total>5 or program_total>20,'scope','loaded_cohorts'));
  exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
   result:=result||jsonb_build_object('programs',jsonb_build_object('state','unavailable'),'live',jsonb_build_object('state','unavailable'));
  end;
 end if;

 if p_runtime->'support'='true'::jsonb then
  begin
   select count(*)::integer into total from nal_private.support_threads t where t.user_id=p_user_id
    and exists(select 1 from nal_private.support_messages m where m.thread_id=t.id and m.author_kind='staff' and m.seq>t.member_read_seq);
   select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'subject',x.subject,'state',x.state,'updatedAt',x.last_reply) order by x.last_reply desc,x.id),'[]') into items
    from (select t.id,t.subject,t.state,(select max(m.created_at) from nal_private.support_messages m
     where m.thread_id=t.id and m.author_kind='staff' and m.seq>t.member_read_seq) as last_reply
     from nal_private.support_threads t where t.user_id=p_user_id and exists(select 1 from nal_private.support_messages m
      where m.thread_id=t.id and m.author_kind='staff' and m.seq>t.member_read_seq)
     order by last_reply desc,t.id limit 5) x;
   result:=result||jsonb_build_object('support',jsonb_build_object('state','ready','unreadThreads',total,'items',items,'limit',5,'limited',total>5));
  exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
   result:=result||jsonb_build_object('support',jsonb_build_object('state','unavailable'));
  end;
 end if;

 if p_runtime->'cohorts'='true'::jsonb then
  begin
   select count(*)::integer into pending from nal_private.read_waitlist where user_id=p_user_id and state='waiting';
   select count(*)::integer into total from nal_private.read_waitlist where user_id=p_user_id and state='offered' and offer_until>now();
   select coalesce(jsonb_agg(jsonb_build_object('slug',x.slug,'title',x.title,'label',x.label,'offerUntil',x.offer_until) order by x.offer_until,x.slug),'[]') into items
    from (select s.slug,s.title,c.label,w.offer_until from nal_private.read_waitlist w
     join public.nal_read_seasons s on s.id=w.season_id join nal_private.read_cohorts c on c.season_id=s.id
     where w.user_id=p_user_id and w.state='offered' and w.offer_until>now() order by w.offer_until,s.slug limit 5) x;
   result:=result||jsonb_build_object('waitlist',jsonb_build_object('state','ready','waitingCount',pending,'offeredCount',total,'items',items,'limited',total>5));
  exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
   result:=result||jsonb_build_object('waitlist',jsonb_build_object('state','unavailable'));
  end;
 end if;

 if p_runtime->'payments'='true'::jsonb then
  begin
   -- Locally recorded state only. No confirm, launch, refresh, retry or external provider lookup.
   select count(*)::integer into total from nal_private.read_checkout_orders q where q.user_id=p_user_id and
    (q.state='pending' or (q.state in ('paid','partially_refunded','manual_review') and q.fulfillment not in ('ready','refunded')));
   select coalesce(jsonb_agg(jsonb_build_object('id',x.order_id,'title',x.title,'state',x.state,'fulfillment',x.fulfillment,
     'updatedAt',x.updated_at,'lastCheckedAt',x.last_checked_at) order by x.updated_at desc,x.order_id),'[]') into items
    from (select q.order_id,q.title,q.state,q.fulfillment,q.updated_at,q.last_checked_at from nal_private.read_checkout_orders q
     where q.user_id=p_user_id and (q.state='pending' or (q.state in ('paid','partially_refunded','manual_review') and q.fulfillment not in ('ready','refunded')))
     order by q.updated_at desc,q.order_id limit 3) x;
   result:=result||jsonb_build_object('orders',jsonb_build_object('state','ready','attentionCount',total,'items',items,'limit',3,'limited',total>3));
  exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
   result:=result||jsonb_build_object('orders',jsonb_build_object('state','unavailable'));
  end;
 end if;
 return result;
end $$;

-- Existing action names continue to the exact prior account implementation.
alter function public.nal_account(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_account(uuid,text,jsonb) rename to account_before_home;
create function public.nal_account(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
begin
 if p_action='home' then return nal_private.read_account_home(p_user_id,p_payload);end if;
 return nal_private.account_before_home(p_user_id,p_action,p_payload);
end $$;
revoke all on function nal_private.read_account_home(uuid,jsonb),nal_private.account_before_home(uuid,text,jsonb),public.nal_account(uuid,text,jsonb)
 from public,anon,authenticated;
grant execute on function nal_private.read_account_home(uuid,jsonb),nal_private.account_before_home(uuid,text,jsonb),public.nal_account(uuid,text,jsonb) to service_role;



-- LAYER 17: docs/NAL_READ_BUILD15_PATHWAY.sql
-- Source SHA256 705a4bf0372083a92bbc70b7763502927e53e02ab525a165c2662cea93bd871f
-- BUILD15 SOURCE ONLY. UNAPPLIED. No tests, sample data or runtime changes.
-- Load after the full BUILD04-14 chain. Reuse workspace and report storage.

set local lock_timeout='5s';
set local statement_timeout='30s';

alter table nal_private.read_experiments
 add column source_answer_id uuid references public.nal_read_answers(id) on delete set null,
 add column source_snapshot jsonb check(source_snapshot is null or
   (jsonb_typeof(source_snapshot)='object' and octet_length(source_snapshot::text)<=30000));
create unique index read_experiment_one_source
 on nal_private.read_experiments(enrollment_id,source_answer_id) where source_answer_id is not null;
-- Existing manually created experiments remain unlinked. Do not infer a source by text similarity.
-- Existing experiments/report serializers already include these nullable fields with to_jsonb.

alter function public.nal_read_workspace(uuid,text,text,jsonb) set schema nal_private;
alter function nal_private.nal_read_workspace(uuid,text,text,jsonb) rename to read_workspace_before_pathway;
create function public.nal_read_workspace(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 access_state jsonb;eid uuid;sid uuid;v_day integer;v_step integer;v_week integer;v_revision integer;v_answer uuid;
 gate record;step_row nal_private.read_day_steps%rowtype;draft_row nal_private.read_drafts%rowtype;
 answer_row public.nal_read_answers%rowtype;experiment_row nal_private.read_experiments%rowtype;
 session_row nal_private.read_live_sessions%rowtype;note_row nal_private.read_live_notes%rowtype;result jsonb;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>30000 then
  raise exception 'Invalid workspace payload' using errcode='22023';end if;
 if p_action not in ('experiment-from-answer','live-join') then
  return nal_private.read_workspace_before_pathway(p_user_id,p_season_slug,p_action,p_payload);
 end if;
 access_state:=public.nal_get_read_access(p_user_id,p_season_slug);
 if coalesce((access_state->>'allowed')::boolean,false) is not true then raise exception 'Read access unavailable' using errcode='42501';end if;
 eid:=(access_state->>'enrollmentId')::uuid;
 select season_id into strict sid from public.nal_read_enrollments where id=eid and user_id=p_user_id;

 if p_action='live-join' then
  -- Serialize the click with note saving, and return the resulting note revision in
  -- this transaction. A later blanket reload must not adopt someone else's note
  -- revision and overwrite their edits with an older local form.
  select * into session_row from nal_private.read_live_sessions
   where id=(p_payload->>'id')::uuid and season_id=sid and status='published' for share;
  if not found then raise exception 'Live session unavailable' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(eid::text||':live:'||session_row.id::text,6));
  select * into note_row from nal_private.read_live_notes
   where enrollment_id=eid and session_id=session_row.id and user_id=p_user_id for update;
  if p_payload ? 'revision' then
   v_revision:=(p_payload->>'revision')::integer;
   if v_revision is null or v_revision<0 or v_revision<>coalesce(note_row.revision,0) then
    raise exception 'Live note changed in another tab' using errcode='40001';end if;
  end if;
  result:=nal_private.read_workspace_before_pathway(p_user_id,p_season_slug,p_action,p_payload);
  select * into strict note_row from nal_private.read_live_notes
   where enrollment_id=eid and session_id=session_row.id and user_id=p_user_id;
  return result||jsonb_build_object('revision',note_row.revision);
 end if;

 if p_payload-ARRAY['dayNumber','stepOrder','revision','answerId']<>'{}'::jsonb then
  raise exception 'Unexpected source fields' using errcode='22023';end if;
 v_day:=(p_payload->>'dayNumber')::integer;v_step:=(p_payload->>'stepOrder')::integer;
 v_revision:=(p_payload->>'revision')::integer;v_answer:=(p_payload->>'answerId')::uuid;
 if v_day is null or v_day not between 1 and 366 or v_step is null or v_step not between 1 and 100
  or v_revision is null or v_revision<1 or v_answer is null then raise exception 'Saved TRY answer required' using errcode='22023';end if;
 select * into strict gate from nal_private.read_day_gate(p_user_id,p_season_slug,v_day);
 select * into step_row from nal_private.read_day_steps
  where day_id=gate.day_id and step_order=v_step and status='published' and step_type='TRY' for share;
 if not found then raise exception 'Published TRY step required' using errcode='22023';end if;
 if not exists(select 1 from public.nal_read_answers where id=v_answer and user_id=p_user_id
  and enrollment_id=eid and day_id=gate.day_id and step_id=step_row.id) then
  raise exception 'Saved source answer unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(eid::text||':experiment-source:'||v_answer::text,151));
 select * into experiment_row from nal_private.read_experiments
  where enrollment_id=eid and user_id=p_user_id and source_answer_id=v_answer;
 if found then
  -- Re-entry and retries return the same experiment, including completed/cancelled
  -- ones. Do not restart it or replace a reflection with the newly edited answer.
  return jsonb_build_object('saved',true,'created',false,'experiment',to_jsonb(experiment_row)-'user_id'-'enrollment_id');
 end if;
 -- Match the just-committed draft and saved answer. Never trust browser-supplied
 -- title, prompt, week, text, owner or source snapshot. Lock draft before answer,
 -- matching the pre-existing draft-commit order.
 select * into draft_row from nal_private.read_drafts where enrollment_id=eid and user_id=p_user_id
  and step_id=step_row.id and day_id=gate.day_id for share;
 if not found or not draft_row.committed or draft_row.revision<>v_revision then
  raise exception 'Source draft changed; save it again' using errcode='40001';end if;
 select * into answer_row from public.nal_read_answers where id=v_answer and user_id=p_user_id
  and enrollment_id=eid and step_id=step_row.id and day_id=gate.day_id for share;
 if not found then raise exception 'Saved source unavailable' using errcode='42501';end if;
 if answer_row.answer_text is distinct from draft_row.payload->>'answerText' then
  raise exception 'Saved answer changed in another tab' using errcode='40001';end if;
 if length(btrim(coalesce(answer_row.answer_text,''))) not between 1 and 5000 then
  raise exception 'A written experiment plan is required' using errcode='22023';end if;
 select w.week_number into v_week from nal_private.read_days d
  join nal_private.read_weeks w on w.id=d.week_id and w.season_id=d.season_id
  where d.id=gate.day_id and d.season_id=sid and w.status='published';
 if v_week is null then raise exception 'Source week unavailable' using errcode='22023';end if;
 insert into nal_private.read_experiments(id,user_id,enrollment_id,week_number,title,intention,status,duration_hours,
  source_answer_id,source_snapshot)
 values(gen_random_uuid(),p_user_id,eid,v_week,left(btrim(answer_row.answer_text),200),left(answer_row.answer_text,2000),'planned',72,
  answer_row.id,jsonb_build_object('version',1,'dayNumber',v_day,'stepOrder',v_step,'weekNumber',v_week,
   'prompt',step_row.prompt,'text',answer_row.answer_text,'capturedAt',now())) returning * into experiment_row;
 return jsonb_build_object('saved',true,'created',true,'experiment',to_jsonb(experiment_row)-'user_id'-'enrollment_id');
end $$;
revoke all on function nal_private.read_workspace_before_pathway(uuid,text,text,jsonb),public.nal_read_workspace(uuid,text,text,jsonb)
 from public,anon,authenticated;
grant execute on function nal_private.read_workspace_before_pathway(uuid,text,text,jsonb),public.nal_read_workspace(uuid,text,text,jsonb) to service_role;



-- LAYER 18: docs/NAL_READ_BUILD17_OPERATIONS.sql
-- Source SHA256 3cb11da80d51d1a9ccd2dc271e6b2a8951b3810bcd7b30bf0592fe5f5e4fa6e3
-- BUILD17 source only. UNAPPLIED. No tables, grants to browser roles or hosted records created.
-- Load after the complete recorded FIX03 + BUILD04-16 source chain, including BUILD14_HOME.
-- Read-only metadata for the existing owner/operator roles; not a release-health check.

set local lock_timeout='5s';
set local statement_timeout='30s';

create function nal_private.read_operations_home(p_user_id uuid,p_payload jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 role_name text;flags jsonb;q jsonb;k text;sid uuid;slug text;term text;off integer;total integer;
 result jsonb;section jsonb;items jsonb;detail jsonb;weeks jsonb;missing jsonb;published integer;
 approved integer;revision integer;pub_revision integer;doc_state text;stamp timestamptz;
 r record;inv jsonb;
begin
 if not nal_private.read_verified_subject(p_user_id) then
  raise exception 'Verified identity required' using errcode='42501';end if;
 select a.role into role_name from nal_private.admins a where a.user_id=p_user_id;
 if role_name is null or role_name not in ('owner','operator') then
  raise exception 'Existing operator permission required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>3000
  or p_payload-ARRAY['query','runtime']<>'{}'::jsonb then raise exception 'Invalid operations request' using errcode='22023';end if;
 flags:=p_payload->'runtime';q:=p_payload->'query';
 if jsonb_typeof(flags) is distinct from 'object' or jsonb_typeof(q) is distinct from 'object' then
  raise exception 'Server feature context required' using errcode='22023';end if;
 if flags-ARRAY['editorial','companion','cohorts','support','payments']<>'{}'::jsonb
  or q-ARRAY['seasonSlug','search','offset']<>'{}'::jsonb then raise exception 'Unexpected operations fields' using errcode='22023';end if;
 foreach k in array array['editorial','companion','cohorts','support','payments'] loop
  if jsonb_typeof(flags->k) is distinct from 'boolean' then raise exception 'Invalid server feature flag' using errcode='22023';end if;
 end loop;
 if (q ? 'seasonSlug' and jsonb_typeof(q->'seasonSlug') not in ('string','null'))
  or (q ? 'search' and jsonb_typeof(q->'search') is distinct from 'string')
  or (q ? 'offset' and jsonb_typeof(q->'offset') is distinct from 'number') then raise exception 'Invalid operations filter' using errcode='22023';end if;
 slug:=nullif(q->>'seasonSlug','');term:=btrim(coalesce(q->>'search',''));off:=coalesce((q->>'offset')::integer,0);
 if (slug is not null and slug!~'^[a-z0-9-]{1,120}$') or length(term)>120 or off not between 0 and 10000
  or (q ? 'offset' and (q->>'offset')::numeric<>off) then raise exception 'Invalid operations filter' using errcode='22023';end if;
 result:=jsonb_build_object('version',17,'role',role_name,'serverTime',now(),'refreshMode','explicit',
  'selected',null,'runtime',flags,'content',jsonb_build_object('state','not_selected'),
  'guide',jsonb_build_object('state','not_selected'),'plans',jsonb_build_object('state','not_selected'),
  'cohort',jsonb_build_object('state','not_selected'),'orders',jsonb_build_object('state','not_selected'));

 -- The library returns titles/IDs only, never manuscript bodies or participant names.
 begin
  select count(*)::integer into total from public.nal_read_seasons s
   where term='' or strpos(lower(s.title||' '||s.slug),lower(term))>0;
  select coalesce(jsonb_agg(jsonb_build_object('slug',x.slug,'title',x.title,'contentState',x.status)
   order by x.created_at desc,x.id),'[]') into items from (
   select s.id,s.slug,s.title,s.status,s.created_at from public.nal_read_seasons s
    where term='' or strpos(lower(s.title||' '||s.slug),lower(term))>0
    order by s.created_at desc,s.id limit 51 offset off) x;
  result:=result||jsonb_build_object('library',jsonb_build_object('state','ready','items',items,'total',total,'offset',off,'pageSize',50));
  if slug is not null then
   select s.id,jsonb_build_object('slug',s.slug,'title',s.title,'contentState',s.status) into sid,detail
    from public.nal_read_seasons s where s.slug=slug;
   if sid is null then raise exception 'Selected season unavailable' using errcode='22023';end if;
   result:=result||jsonb_build_object('selected',detail);
  end if;
 exception when undefined_table or undefined_column or insufficient_privilege then
  result:=result||jsonb_build_object('library',jsonb_build_object('state','unavailable'));
  -- A requested scope cannot silently fall back to all-season support/orders.
  if slug is not null then return result||jsonb_build_object('support',jsonb_build_object('state','unavailable'));end if;
 end;

 if sid is not null then
  section:=jsonb_build_object('state','disabled');
  if flags->'editorial'='true'::jsonb then
   begin
    select d.revision,d.approved_revision,d.published_revision,d.state,d.updated_at
     into revision,approved,pub_revision,doc_state,stamp from nal_private.read_editorial_documents d where d.season_id=sid;
    select count(*)::integer into published from nal_private.read_days d
     where d.season_id=sid and d.day_number between 1 and 28 and d.status='published';
    select coalesce(jsonb_agg(n order by n),'[]') into missing from generate_series(1,28) n
     where not exists(select 1 from nal_private.read_days d where d.season_id=sid and d.day_number=n and d.status='published');
    section:=jsonb_build_object('state','ready','documentExists',revision is not null,'revision',revision,
     'approvedRevision',approved,'publishedRevision',pub_revision,'editorialState',doc_state,'updatedAt',stamp,
     'publishedDays',published,'expectedDays',28,'missingDays',missing,
     'beforePublished',exists(select 1 from nal_private.read_days d where d.season_id=sid and d.day_number=0 and d.status='published'));
   exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
    section:=jsonb_build_object('state','unavailable');
   end;
  end if;
  result:=result||jsonb_build_object('content',section);

  section:=jsonb_build_object('state','disabled');
  if flags->'companion'='true'::jsonb then
   begin
    select g.revision,g.published_revision,g.updated_at into revision,pub_revision,stamp
     from nal_private.read_arrival_guides g where g.season_id=sid;
    section:=jsonb_build_object('state','ready','exists',revision is not null,'revision',revision,
     'publishedRevision',pub_revision,'hasUnpublishedChanges',revision is not null and revision is distinct from pub_revision,'updatedAt',stamp);
   exception when undefined_table or undefined_column or insufficient_privilege then
    section:=jsonb_build_object('state','unavailable');
   end;
  end if;
  result:=result||jsonb_build_object('guide',section);

  section:=jsonb_build_object('state','disabled');
  if flags->'companion'='true'::jsonb then
   begin
    -- Plan/source text stays on the authorized editor. Only lengths and matching LIVE metadata here.
    select coalesce(jsonb_agg(jsonb_build_object('weekNumber',w.n,'exists',p.season_id is not null,
      'planState',p.state,'revision',p.revision,'updatedAt',p.updated_at,
      'agendaMinutes',(select sum((part->>'minutes')::integer) from jsonb_array_elements(p.source->'agenda') part),
      'sessionId',p.session_id,'selectedSessionState',chosen.status,'selectedStartsAt',chosen.starts_at,
      'selectedEndsAt',chosen.ends_at,'selectedMatchesWeek',p.session_id is null or (chosen.season_id=sid and chosen.week_number=w.n),
      'sessions',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'state',l.status,'startsAt',l.starts_at,'endsAt',l.ends_at)
       order by l.starts_at,l.id),'[]') from nal_private.read_live_sessions l where l.season_id=sid and l.week_number=w.n)) order by w.n),'[]')
     into weeks from generate_series(1,4) as w(n)
      left join nal_private.read_facilitator_plans p on p.season_id=sid and p.week_number=w.n
      left join nal_private.read_live_sessions chosen on chosen.id=p.session_id and chosen.season_id=sid;
    section:=jsonb_build_object('state','ready','weeks',weeks);
   exception when undefined_table or undefined_column or undefined_function or insufficient_privilege or invalid_text_representation then
    section:=jsonb_build_object('state','unavailable');
   end;
  end if;
  result:=result||jsonb_build_object('plans',section);

  section:=jsonb_build_object('state',case when role_name<>'owner' then 'restricted' else 'disabled' end);
  if role_name='owner' and flags->'cohorts'='true'::jsonb then
   begin
    select c.label,c.course_starts_at,c.course_ends_at,c.capacity,c.state,f.status as offer_state,
     f.starts_at as registration_starts_at,f.ends_at as registration_ends_at
     into r from nal_private.read_cohorts c left join nal_private.read_offers f on f.season_id=c.season_id where c.season_id=sid;
    if not found then section:=jsonb_build_object('state','ready','configured',false);
    else
     inv:=nal_private.read_cohort_inventory(sid);
     section:=jsonb_build_object('state','ready','configured',true,'label',r.label,'startsAt',r.course_starts_at,'endsAt',r.course_ends_at,
      'recruitmentState',r.state,'offerState',r.offer_state,'registrationStartsAt',r.registration_starts_at,'registrationEndsAt',r.registration_ends_at,
      'capacity',r.capacity,'occupied',inv->'occupied','enrolled',inv->'enrolled','waiting',inv->'waiting','offered',inv->'offered');
    end if;
   exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
    section:=jsonb_build_object('state','unavailable');
   end;
  end if;
  result:=result||jsonb_build_object('cohort',section);

  section:=jsonb_build_object('state',case when role_name<>'owner' then 'restricted' else 'disabled' end);
  if role_name='owner' and flags->'payments'='true'::jsonb then
   begin
    select count(*)::integer into total from nal_private.read_checkout_orders o where o.season_id=sid and
     (o.state='pending' or (o.state in ('paid','partially_refunded','manual_review') and o.fulfillment not in ('ready','refunded')));
    -- No provider request, customer data, payment key, refund execution or delivery retry.
    section:=jsonb_build_object('state','ready','attentionCount',total,'scope','selected_season','source','recorded_order_state');
   exception when undefined_table or undefined_column or insufficient_privilege then
    section:=jsonb_build_object('state','unavailable');
   end;
  end if;
  result:=result||jsonb_build_object('orders',section);
 end if;

 section:=jsonb_build_object('state','disabled');
 if flags->'support'='true'::jsonb then
  begin
   select count(*)::integer into total from nal_private.support_threads t where t.state='open'
    and (role_name='owner' or t.assigned_to=p_user_id) and (sid is null or t.season_id=sid);
   select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'subject',x.subject,'category',x.category,'updatedAt',x.updated_at)
    order by x.updated_at,x.id),'[]') into items from (
    select t.id,t.subject,t.category,t.updated_at from nal_private.support_threads t where t.state='open'
     and (role_name='owner' or t.assigned_to=p_user_id) and (sid is null or t.season_id=sid)
     order by t.updated_at,t.id limit 5) x;
   section:=jsonb_build_object('state','ready','openCount',total,'items',items,'limit',5,
    'scope',case when sid is null then 'all_seasons_and_general' else 'selected_season_only' end,
    'permissionScope',case when role_name='owner' then 'owner_queue' else 'assigned_only' end);
  exception when undefined_table or undefined_column or insufficient_privilege then
   section:=jsonb_build_object('state','unavailable');
  end;
 end if;
 return result||jsonb_build_object('support',section);
end $$;

-- Keep the existing account RPC name and verified caller boundary. No new Auth allowlist entry.
alter function public.nal_account(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_account(uuid,text,jsonb) rename to account_before_operations;
create function public.nal_account(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
begin
 if p_action='operator-home' then return nal_private.read_operations_home(p_user_id,p_payload);end if;
 return nal_private.account_before_operations(p_user_id,p_action,p_payload);
end $$;
revoke all on function nal_private.read_operations_home(uuid,jsonb),nal_private.account_before_operations(uuid,text,jsonb),
 public.nal_account(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_operations_home(uuid,jsonb),nal_private.account_before_operations(uuid,text,jsonb),
 public.nal_account(uuid,text,jsonb) to service_role;



-- LAYER 19: docs/NAL_READ_BUILD18_CONTEXT.sql
-- Source SHA256 c4cfd41672fb4d1841fb98ac2c1ce9ddd0a8466b3f1c746cd182517febad9afa
-- BUILD18 SOURCE ONLY, UNAPPLIED. Complete prior FIX03/BUILD04-17 chain required.
-- Read-only scoped listing through the existing account endpoint. No new tables or role grants.

set local lock_timeout='5s';set local statement_timeout='30s';
create function nal_private.read_operator_context(p_user_id uuid,p_payload jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare role_name text;q jsonb;flags jsonb;kind text;slug text;sid uuid;title text;off integer;
 items jsonb;result jsonb;state_filter text;category_filter text;thread_id uuid;after_seq integer;k text;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 select role into role_name from nal_private.admins where user_id=p_user_id;
 if role_name is null or role_name not in ('owner','operator') then raise exception 'Operator required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload-ARRAY['query','runtime']<>'{}'::jsonb then raise exception 'Invalid scope' using errcode='22023';end if;
 q:=p_payload->'query';flags:=p_payload->'runtime';
 if jsonb_typeof(q) is distinct from 'object' or jsonb_typeof(flags) is distinct from 'object' or octet_length(q::text)>2500
  or q-ARRAY['kind','seasonSlug','offset','state','category','filter','id','afterSeq']<>'{}'::jsonb then raise exception 'Invalid scope query' using errcode='22023';end if;
 foreach k in array array['editorial','companion','cohorts','support','payments'] loop
  if jsonb_typeof(flags->k) is distinct from 'boolean' then raise exception 'Server context required' using errcode='22023';end if;
 end loop;
 kind:=q->>'kind';slug:=q->>'seasonSlug';
 if kind is null or kind not in ('orders','support','support-thread') or slug is null or slug!~'^[a-z0-9-]{1,120}$' then raise exception 'Selected season required' using errcode='22023';end if;
 select s.id,s.title into sid,title from public.nal_read_seasons s where s.slug=slug;
 if sid is null then raise exception 'Selected season unavailable' using errcode='22023';end if;
 off:=coalesce((q->>'offset')::integer,0);
 if off not between 0 and 10000 or (q ? 'offset' and (jsonb_typeof(q->'offset') is distinct from 'number' or (q->>'offset')::numeric<>off)) then raise exception 'Invalid page' using errcode='22023';end if;
 result:=jsonb_build_object('scopeVersion',18,'seasonSlug',slug,'seasonTitle',title,'role',role_name,'offset',off);
 if kind='orders' then
  if role_name<>'owner' then raise exception 'Owner required' using errcode='42501';end if;
  if flags->'payments' is distinct from 'true'::jsonb then raise exception 'Payment view disabled' using errcode='P0018';end if;
  if coalesce(q->>'filter','all')<>'all' then raise exception 'Unsupported order filter' using errcode='22023';end if;
  select coalesce(jsonb_agg(nal_private.read_checkout_view(x.order_id) order by x.created_at desc,x.order_id),'[]') into items
   from (select o.order_id,o.created_at from nal_private.read_checkout_orders o where o.season_id=sid order by o.created_at desc,o.order_id limit 51 offset off) x;
  return result||jsonb_build_object('orders',items);
 end if;
 if flags->'support' is distinct from 'true'::jsonb then raise exception 'Support view disabled' using errcode='P0018';end if;
 if kind='support-thread' then
  thread_id:=(q->>'id')::uuid;after_seq:=coalesce((q->>'afterSeq')::integer,0);
  if thread_id is null or after_seq not between 0 and 1000 then raise exception 'Invalid conversation page' using errcode='22023';end if;
  if not exists(select 1 from nal_private.support_threads t where t.id=thread_id and t.season_id=sid and (role_name='owner' or t.assigned_to=p_user_id)) then raise exception 'Thread unavailable in selected season' using errcode='42501';end if;
  -- Existing get rechecks current assignment. It has no read-receipt/message mutation.
  return public.nal_support_admin(p_user_id,'get',jsonb_build_object('id',thread_id,'afterSeq',after_seq))||result;
 end if;
 state_filter:=coalesce(q->>'state','all');category_filter:=coalesce(q->>'category','all');
 if state_filter not in ('all','open','answered','resolved') or category_filter not in ('all','account','read','payment','live','technical','other') then raise exception 'Invalid support filter' using errcode='22023';end if;
 select coalesce(jsonb_agg(nal_private.support_summary(x.thread,true) order by x.updated_at desc,x.id),'[]') into items from (
  select t as thread,t.updated_at,t.id from nal_private.support_threads t
   where t.season_id=sid and (role_name='owner' or t.assigned_to=p_user_id)
    and (state_filter='all' or t.state=state_filter) and (category_filter='all' or t.category=category_filter)
   order by t.updated_at desc,t.id limit 51 offset off
 ) x;
 return result||jsonb_build_object('threads',items);
end $$;
alter function public.nal_account(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_account(uuid,text,jsonb) rename to account_before_context;
create function public.nal_account(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
begin
 if p_action='operator-context' then return nal_private.read_operator_context(p_user_id,p_payload);end if;
 return nal_private.account_before_context(p_user_id,p_action,p_payload);
end $$;
revoke all on function nal_private.read_operator_context(uuid,jsonb),nal_private.account_before_context(uuid,text,jsonb),public.nal_account(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_operator_context(uuid,jsonb),nal_private.account_before_context(uuid,text,jsonb),public.nal_account(uuid,text,jsonb) to service_role;



CREATE FUNCTION nal_private.read_build20_integration() RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $nal_build20_marker$
 SELECT '{"build":20,"sourceCommit":"3ccdbe665435734e5eb6f40922b49ddf9d8ff54e","layerCount":19}'::jsonb
$nal_build20_marker$;
REVOKE ALL ON FUNCTION nal_private.read_build20_integration() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION nal_private.read_build20_integration() TO service_role;
COMMIT;
