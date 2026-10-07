-- REVIEW DRAFT ONLY.
-- NAL READ WAVE 1: private daily content engine + user answer/progress state.
begin;

create table nal_private.read_weeks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.nal_read_seasons(id) on delete cascade,
  week_number integer not null check (week_number between 1 and 52),
  slug text not null check (slug ~ '^[a-z0-9-]{1,120}$'),
  title text not null check (length(title) between 1 and 120),
  subtitle text,
  status text not null default 'draft' check (status in ('draft','review','approved','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id,week_number),
  unique(season_id,slug)
);

create table nal_private.read_days (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.nal_read_seasons(id) on delete cascade,
  week_id uuid references nal_private.read_weeks(id) on delete set null,
  day_number integer not null check (day_number between 0 and 366),
  title text not null check (length(title) between 1 and 160),
  day_type text not null default 'daily' check (day_type in ('before','daily','try','live','final')),
  estimated_minutes integer not null default 5 check (estimated_minutes between 1 and 180),
  status text not null default 'draft' check (status in ('draft','review','approved','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id,day_number)
);

create table nal_private.read_day_steps (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references nal_private.read_days(id) on delete cascade,
  step_order integer not null check (step_order between 1 and 100),
  step_type text not null check (
    step_type in ('HOOK','IDEA','MIRROR','QUESTION','MULTI_SELECT','SCALE','TRY','RECORD','LIVE')
  ),
  content text,
  prompt text,
  placeholder text,
  options jsonb,
  record_template text,
  required boolean not null default false,
  status text not null default 'draft' check (status in ('draft','review','approved','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(day_id,step_order),
  check (options is null or jsonb_typeof(options)='array')
);

create table public.nal_read_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null references public.nal_read_enrollments(id) on delete cascade,
  day_id uuid not null references nal_private.read_days(id) on delete cascade,
  step_id uuid not null references nal_private.read_day_steps(id) on delete cascade,
  answer_text text,
  answer_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,step_id),
  check (answer_text is null or length(answer_text)<=5000)
);

create table public.nal_read_day_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enrollment_id uuid not null references public.nal_read_enrollments(id) on delete cascade,
  day_id uuid not null references nal_private.read_days(id) on delete cascade,
  status text not null default 'started' check (status in ('started','completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id,day_id)
);

create index read_weeks_season on nal_private.read_weeks(season_id,week_number);
create index read_days_season on nal_private.read_days(season_id,day_number);
create index read_days_week on nal_private.read_days(week_id);
create index read_steps_day on nal_private.read_day_steps(day_id,step_order);
create index nal_read_answers_user on public.nal_read_answers(user_id,updated_at desc);
create index nal_read_answers_enrollment on public.nal_read_answers(enrollment_id);
create index nal_read_answers_day on public.nal_read_answers(day_id);
create index nal_read_answers_step on public.nal_read_answers(step_id);
create index nal_read_progress_user on public.nal_read_day_progress(user_id,updated_at desc);
create index nal_read_progress_enrollment on public.nal_read_day_progress(enrollment_id);
create index nal_read_progress_day on public.nal_read_day_progress(day_id);

alter table nal_private.read_weeks enable row level security;
alter table nal_private.read_days enable row level security;
alter table nal_private.read_day_steps enable row level security;
alter table public.nal_read_answers enable row level security;
alter table public.nal_read_day_progress enable row level security;

revoke all on nal_private.read_weeks from public,anon,authenticated;
revoke all on nal_private.read_days from public,anon,authenticated;
revoke all on nal_private.read_day_steps from public,anon,authenticated;
revoke all on public.nal_read_answers from public,anon,authenticated;
revoke all on public.nal_read_day_progress from public,anon,authenticated;

grant all on nal_private.read_weeks,nal_private.read_days,nal_private.read_day_steps to service_role;
grant select on public.nal_read_answers,public.nal_read_day_progress to authenticated;
grant all on public.nal_read_answers,public.nal_read_day_progress to service_role;

create policy nal_read_answers_own_read on public.nal_read_answers
  for select to authenticated using ((select auth.uid())=user_id);
create policy nal_read_progress_own_read on public.nal_read_day_progress
  for select to authenticated using ((select auth.uid())=user_id);

create trigger nal_touch before update on nal_private.read_weeks
  for each row execute function nal_private.touch_updated_at();
create trigger nal_touch before update on nal_private.read_days
  for each row execute function nal_private.touch_updated_at();
create trigger nal_touch before update on nal_private.read_day_steps
  for each row execute function nal_private.touch_updated_at();
create trigger nal_touch before update on public.nal_read_answers
  for each row execute function nal_private.touch_updated_at();
create trigger nal_touch before update on public.nal_read_day_progress
  for each row execute function nal_private.touch_updated_at();

create trigger nal_audit after insert or update or delete on nal_private.read_weeks
  for each row execute function nal_private.audit_change();
create trigger nal_audit after insert or update or delete on nal_private.read_days
  for each row execute function nal_private.audit_change();
create trigger nal_audit after insert or update or delete on nal_private.read_day_steps
  for each row execute function nal_private.audit_change();
create trigger nal_audit after insert or update or delete on public.nal_read_answers
  for each row execute function nal_private.audit_change();
create trigger nal_audit after insert or update or delete on public.nal_read_day_progress
  for each row execute function nal_private.audit_change();

create function public.nal_read_bootstrap(
  p_user_id uuid,
  p_season_slug text
) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare
  access_state jsonb;
  season_row public.nal_read_seasons%rowtype;
  enrollment_row public.nal_read_enrollments%rowtype;
  current_day integer;
  journey jsonb;
begin
  access_state := public.nal_get_read_access(p_user_id,p_season_slug);
  if coalesce((access_state->>'allowed')::boolean,false) is not true then
    raise exception 'Read access unavailable' using errcode='42501';
  end if;

  select * into season_row from public.nal_read_seasons where slug=p_season_slug;
  select * into enrollment_row
    from public.nal_read_enrollments
    where user_id=p_user_id and season_id=season_row.id
    limit 1;

  select min(d.day_number) into current_day
  from nal_private.read_days d
  left join public.nal_read_day_progress p
    on p.day_id=d.id and p.user_id=p_user_id and p.status='completed'
  where d.season_id=season_row.id
    and d.status='published'
    and p.id is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'dayNumber',d.day_number,
    'title',d.title,
    'dayType',d.day_type,
    'estimatedMinutes',d.estimated_minutes,
    'progress',coalesce(p.status,'locked'),
    'unlocked',case
      when d.day_number=0 then true
      when exists(
        select 1
        from nal_private.read_days prev
        join public.nal_read_day_progress pp
          on pp.day_id=prev.id and pp.user_id=p_user_id and pp.status='completed'
        where prev.season_id=d.season_id and prev.day_number=d.day_number-1
      ) then true
      else false
    end
  ) order by d.day_number),'[]'::jsonb) into journey
  from nal_private.read_days d
  left join public.nal_read_day_progress p
    on p.day_id=d.id and p.user_id=p_user_id
  where d.season_id=season_row.id and d.status='published';

  return jsonb_build_object(
    'seasonSlug',season_row.slug,
    'seasonTitle',season_row.title,
    'enrollmentId',enrollment_row.id::text,
    'enrollmentStatus',enrollment_row.status,
    'currentDay',coalesce(current_day,28),
    'journey',journey
  );
end $$;

create function public.nal_get_read_day(
  p_user_id uuid,
  p_season_slug text,
  p_day_number integer
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  access_state jsonb;
  season_row public.nal_read_seasons%rowtype;
  enrollment_row public.nal_read_enrollments%rowtype;
  day_row nal_private.read_days%rowtype;
  unlocked boolean;
  step_payload jsonb;
begin
  access_state := public.nal_get_read_access(p_user_id,p_season_slug);
  if coalesce((access_state->>'allowed')::boolean,false) is not true then
    raise exception 'Read access unavailable' using errcode='42501';
  end if;

  select * into season_row from public.nal_read_seasons where slug=p_season_slug;
  select * into enrollment_row
    from public.nal_read_enrollments
    where user_id=p_user_id and season_id=season_row.id
    limit 1;
  select * into day_row
    from nal_private.read_days
    where season_id=season_row.id and day_number=p_day_number and status='published';
  if not found then raise exception 'Read day unavailable' using errcode='22023'; end if;

  unlocked := day_row.day_number=0 or exists(
    select 1
    from nal_private.read_days prev
    join public.nal_read_day_progress p
      on p.day_id=prev.id and p.user_id=p_user_id and p.status='completed'
    where prev.season_id=season_row.id and prev.day_number=day_row.day_number-1
  );
  if not unlocked then raise exception 'Read day locked' using errcode='42501'; end if;

  insert into public.nal_read_day_progress(user_id,enrollment_id,day_id,status)
  values(p_user_id,enrollment_row.id,day_row.id,'started')
  on conflict(user_id,day_id) do nothing;

  select coalesce(jsonb_agg(jsonb_build_object(
    'order',s.step_order,
    'type',s.step_type,
    'content',s.content,
    'prompt',s.prompt,
    'placeholder',s.placeholder,
    'options',s.options,
    'recordTemplate',s.record_template,
    'required',s.required,
    'answerText',a.answer_text,
    'answerJson',a.answer_json
  ) order by s.step_order),'[]'::jsonb) into step_payload
  from nal_private.read_day_steps s
  left join public.nal_read_answers a
    on a.step_id=s.id and a.user_id=p_user_id
  where s.day_id=day_row.id and s.status='published';

  return jsonb_build_object(
    'dayNumber',day_row.day_number,
    'title',day_row.title,
    'dayType',day_row.day_type,
    'estimatedMinutes',day_row.estimated_minutes,
    'steps',step_payload
  );
end $$;

create function public.nal_save_read_answer(
  p_user_id uuid,
  p_season_slug text,
  p_day_number integer,
  p_step_order integer,
  p_answer_text text,
  p_answer_json jsonb
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  access_state jsonb;
  season_row public.nal_read_seasons%rowtype;
  enrollment_row public.nal_read_enrollments%rowtype;
  day_row nal_private.read_days%rowtype;
  step_row nal_private.read_day_steps%rowtype;
  answer_id uuid;
begin
  if p_answer_text is not null and length(p_answer_text)>5000 then
    raise exception 'Answer too long' using errcode='22023';
  end if;
  access_state := public.nal_get_read_access(p_user_id,p_season_slug);
  if coalesce((access_state->>'allowed')::boolean,false) is not true then
    raise exception 'Read access unavailable' using errcode='42501';
  end if;

  select * into season_row from public.nal_read_seasons where slug=p_season_slug;
  select * into enrollment_row
    from public.nal_read_enrollments
    where user_id=p_user_id and season_id=season_row.id
    limit 1;
  select * into day_row from nal_private.read_days
    where season_id=season_row.id and day_number=p_day_number and status='published';
  if not found then raise exception 'Read day unavailable' using errcode='22023'; end if;

  if day_row.day_number>0 and not exists(
    select 1 from nal_private.read_days prev
    join public.nal_read_day_progress p
      on p.day_id=prev.id and p.user_id=p_user_id and p.status='completed'
    where prev.season_id=season_row.id and prev.day_number=day_row.day_number-1
  ) then
    raise exception 'Read day locked' using errcode='42501';
  end if;

  select * into step_row from nal_private.read_day_steps
    where day_id=day_row.id and step_order=p_step_order and status='published';
  if not found then raise exception 'Read step unavailable' using errcode='22023'; end if;
  if step_row.step_type not in ('QUESTION','MULTI_SELECT','SCALE','RECORD','TRY') then
    raise exception 'Step does not accept an answer' using errcode='22023';
  end if;

  insert into public.nal_read_day_progress(user_id,enrollment_id,day_id,status)
  values(p_user_id,enrollment_row.id,day_row.id,'started')
  on conflict(user_id,day_id) do nothing;

  insert into public.nal_read_answers(
    user_id,enrollment_id,day_id,step_id,answer_text,answer_json
  ) values(
    p_user_id,enrollment_row.id,day_row.id,step_row.id,p_answer_text,p_answer_json
  )
  on conflict(user_id,step_id) do update set
    answer_text=excluded.answer_text,
    answer_json=excluded.answer_json,
    updated_at=now()
  returning id into answer_id;

  return jsonb_build_object('saved',true,'answerId',answer_id::text);
end $$;

create function public.nal_complete_read_day(
  p_user_id uuid,
  p_season_slug text,
  p_day_number integer
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  access_state jsonb;
  season_row public.nal_read_seasons%rowtype;
  enrollment_row public.nal_read_enrollments%rowtype;
  day_row nal_private.read_days%rowtype;
  required_count integer;
  answered_count integer;
begin
  access_state := public.nal_get_read_access(p_user_id,p_season_slug);
  if coalesce((access_state->>'allowed')::boolean,false) is not true then
    raise exception 'Read access unavailable' using errcode='42501';
  end if;
  select * into season_row from public.nal_read_seasons where slug=p_season_slug;
  select * into enrollment_row from public.nal_read_enrollments
    where user_id=p_user_id and season_id=season_row.id limit 1;
  select * into day_row from nal_private.read_days
    where season_id=season_row.id and day_number=p_day_number and status='published';
  if not found then raise exception 'Read day unavailable' using errcode='22023'; end if;

  select count(*) into required_count
  from nal_private.read_day_steps
  where day_id=day_row.id and status='published' and required;

  select count(*) into answered_count
  from nal_private.read_day_steps s
  join public.nal_read_answers a
    on a.step_id=s.id and a.user_id=p_user_id
  where s.day_id=day_row.id and s.status='published' and s.required;

  if answered_count<required_count then
    raise exception 'Required answers missing' using errcode='22023';
  end if;

  insert into public.nal_read_day_progress(
    user_id,enrollment_id,day_id,status,completed_at
  ) values(
    p_user_id,enrollment_row.id,day_row.id,'completed',now()
  )
  on conflict(user_id,day_id) do update set
    status='completed',
    completed_at=coalesce(public.nal_read_day_progress.completed_at,now()),
    updated_at=now();

  return jsonb_build_object('completed',true,'dayNumber',p_day_number);
end $$;

revoke all on function public.nal_read_bootstrap(uuid,text) from public,anon,authenticated;
revoke all on function public.nal_get_read_day(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.nal_save_read_answer(uuid,text,integer,integer,text,jsonb) from public,anon,authenticated;
revoke all on function public.nal_complete_read_day(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.nal_read_bootstrap(uuid,text) to service_role;
grant execute on function public.nal_get_read_day(uuid,text,integer) to service_role;
grant execute on function public.nal_save_read_answer(uuid,text,integer,integer,text,jsonb) to service_role;
grant execute on function public.nal_complete_read_day(uuid,text,integer) to service_role;

commit;
