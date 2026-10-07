begin;
set local lock_timeout='5s';set local statement_timeout='30s';
-- BUILD25: source layers 12-14 from 3ccdbe665435734e5eb6f40922b49ddf9d8ff54e.
-- GUIDE + STUDIO + ARRIVAL_BRIDGE. Definitions only; no content, roles or participant rows.
do $guard$
declare v text;object_name text;signature text;
begin
 perform pg_advisory_xact_lock(hashtextextended('nal-read:integration:build22',22));
 lock table nal_private.read_release_control in share row exclusive mode;
 if current_setting('server_version_num')::integer/10000<>17 then raise exception 'Reviewed PostgreSQL 17 baseline required';end if;
 if (select count(*) from nal_private.read_release_control)<>1 or exists(select 1 from nal_private.read_release_control where mode is distinct from 'off') then raise exception 'READ must remain OFF';end if;
 foreach v in array array['20261007131539','20261007131833','20261007132041','20261007134152','20261007150710'] loop
  if not exists(select 1 from supabase_migrations.schema_migrations where version=v) then raise exception 'Recorded predecessor missing: %',v;end if;
 end loop;
 foreach signature in array array['public.nal_read_bootstrap(uuid,text)','public.nal_get_read_access(uuid,text)','public.nal_read_offers(text)','public.nal_read_cohort_admin(uuid,text,jsonb)','nal_private.read_cohort_summary(uuid,uuid)','nal_private.read_verified_subject(uuid)'] loop
  if to_regprocedure(signature) is null then raise exception 'Required function missing: %',signature;end if;
 end loop;
 if md5(pg_get_functiondef(to_regprocedure('public.nal_read_bootstrap(uuid,text)'))) is distinct from 'ba3ca631a4924ffa16aa0abd39210cf8'
  or md5(pg_get_functiondef(to_regprocedure('public.nal_get_read_access(uuid,text)'))) is distinct from '8440bbdc14e99a98c94cd114f68d7a53' then raise exception 'Participant bootstrap/access changed; reconcile before wrapping';end if;
 lock table public.nal_read_enrollments,nal_private.read_checkout_orders in share row exclusive mode;
 if exists(select 1 from public.nal_read_enrollments) or exists(select 1 from public.nal_orders) or exists(select 1 from nal_private.read_checkout_orders) then raise exception 'Initial integration now has participants or orders; reconcile before continuing';end if;
 foreach object_name in array array['read_arrival_guides','read_preparation_checks','read_companion_history','read_facilitator_plans'] loop
  if to_regclass('nal_private.'||object_name) is not null then raise exception 'Companion layer already present: %',object_name;end if;
 end loop;
 foreach signature in array array['nal_private.read_arrival_guide_check(jsonb)','public.nal_read_program_detail(text)','nal_private.read_arrival_state(uuid,text)','public.nal_read_companion(uuid,text,text,jsonb)','nal_private.read_runbook_check(jsonb,boolean)','public.nal_read_studio(uuid,text,text,jsonb)','nal_private.read_bootstrap_before_arrival(uuid,text)'] loop
  if to_regprocedure(signature) is not null then raise exception 'Companion layer already partly installed: %',signature;end if;
 end loop;
end $guard$;
-- SOURCE LAYER 12: BUILD10_GUIDE.
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
-- Public projection returns only the approved guide and public schedule metadata.
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
-- Preparation state does not open future DAYs or count checks as completion.
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
-- SOURCE LAYER 13: BUILD10_STUDIO.
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
  -- Published course content only; no participant answers, drafts, experiments or LIVE notes.
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
-- SOURCE LAYER 14: BUILD10_ARRIVAL_BRIDGE.
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
commit;