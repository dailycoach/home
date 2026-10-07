-- BUILD09 implementation source only. UNAPPLIED. Requires BUILD04-08 sources.
-- One existing read_season is one operational cohort. A program_key groups cohorts.
-- No real dates, capacity, participants, messages or feature switches are seeded.
begin;
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
commit;
