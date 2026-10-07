-- BUILD10 implementation source only. UNAPPLIED; no user rows or approvals seeded.
-- Prerequisite: recorded FIX03 + complete BUILD04-09 source chain.
begin;
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
commit;
