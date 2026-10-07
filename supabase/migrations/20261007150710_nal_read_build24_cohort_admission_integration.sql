begin;
set local lock_timeout='5s';set local statement_timeout='30s';
-- BUILD24: source layers 9-11 from 3ccdbe665435734e5eb6f40922b49ddf9d8ff54e.
-- COHORTS + COHORT_ADMIN + ADMISSION_BRIDGES. Definitions only; READ remains OFF.
do $guard$
declare v text;object_name text;signature text;
begin
 perform pg_advisory_xact_lock(hashtextextended('nal-read:integration:build22',22));
 lock table nal_private.read_release_control in share row exclusive mode;
 if current_setting('server_version_num')::integer/10000<>17 then raise exception 'Reviewed PostgreSQL 17 baseline required';end if;
 if (select count(*) from nal_private.read_release_control)<>1 or exists(select 1 from nal_private.read_release_control where mode is distinct from 'off') then raise exception 'READ must remain OFF';end if;
 foreach v in array array['20261007131539','20261007131833','20261007132041','20261007134152'] loop
  if not exists(select 1 from supabase_migrations.schema_migrations where version=v) then raise exception 'Recorded predecessor missing: %',v;end if;
 end loop;
 foreach signature in array array['public.nal_issue_read_enrollment(uuid,text,uuid,uuid)','public.nal_read_join(uuid,text,text,jsonb)','public.nal_read_payment_user(uuid,text,jsonb)','public.nal_read_payment_processor(text,jsonb)','nal_private.read_checkout_fulfill(uuid)','public.nal_read_offers(text)','public.nal_read_offer_admin(uuid,text,jsonb)','nal_private.read_verified_subject(uuid)'] loop
  if to_regprocedure(signature) is null then raise exception 'Required function missing: %',signature;end if;
 end loop;
 lock table public.nal_read_enrollments,nal_private.read_checkout_orders in share row exclusive mode;
 if exists(select 1 from public.nal_read_enrollments) or exists(select 1 from public.nal_orders) or exists(select 1 from nal_private.read_checkout_orders) then raise exception 'Initial integration now has participants or orders; reconcile rather than replay';end if;
 foreach object_name in array array['read_cohorts','read_waitlist','read_cohort_attendance','read_cohort_events'] loop
  if to_regclass('nal_private.'||object_name) is not null then raise exception 'Cohort layer already present: %',object_name;end if;
 end loop;
 foreach signature in array array['nal_private.read_cohort_lock(uuid)','public.nal_read_cohort_admin(uuid,text,jsonb)','nal_private.read_issue_before_cohorts(uuid,text,uuid,uuid)','nal_private.read_join_before_cohorts(uuid,text,text,jsonb)','nal_private.read_payment_user_before_cohorts(uuid,text,jsonb)','nal_private.read_payment_processor_before_cohorts(text,jsonb)','nal_private.read_checkout_fulfill_before_cohorts(uuid)','nal_private.read_offers_before_cohorts(text)','nal_private.read_offer_admin_before_cohorts(uuid,text,jsonb)'] loop
  if to_regprocedure(signature) is not null then raise exception 'Admission layer already partly present: %',signature;end if;
 end loop;
end $guard$;
-- SOURCE LAYER 9: BUILD09_COHORTS.
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
-- Fresh snapshots after the shared cohort lock; count each person once.
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
 if p_settlement and (inv->>'ownsPlace')::boolean then return;end if;
 info:=nal_private.read_cohort_summary(p_season_id,p_user_id);
 if coalesce((info->>'canEnroll')::boolean,false) is not true then
  raise exception 'Cohort admission unavailable: %',info->>'reason' using errcode='22023';end if;
end $$;
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
   null;
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
-- SOURCE LAYER 10: BUILD09_COHORT_ADMIN.
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
-- SOURCE LAYER 11: BUILD09_ADMISSION_BRIDGES.
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
commit;