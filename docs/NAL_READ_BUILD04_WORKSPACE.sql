-- BUILD04 implementation source. NOT APPLIED. QA and hosted activation deferred to pre-sale.
-- Depends on recorded FIX03 migration. Release gate stays OFF; no live fixtures or grants are seeded.
begin;
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
commit;
