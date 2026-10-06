-- NAL-FIX-02: tested FIX-01 + whitespace correction + fail-closed test scope.
-- No real-user grants or payment data changes. Effective runtime mode remains OFF.
begin;
-- NAL-FIX-01 corrective patch. Historical applied migrations remain immutable.
-- Apply only after PostgreSQL regression tests. No user rows are rewritten.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table nal_private.read_days add column if not exists available_at timestamptz;

create or replace function public.nal_get_read_access(p_user_id uuid,p_season_slug text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce((
    select jsonb_build_object(
      'allowed',coalesce(
        s.status in ('open','closed') and e.status in ('active','completed')
        and pe.user_id=e.user_id and pe.resource_type='read-season' and pe.resource_id=s.slug
        and pe.status='active' and pe.revoked_at is null
        and (pe.expires_at is null or pe.expires_at>now())
        and (pe.source_type<>'order' or (o.status='paid' and o.user_id=e.user_id
          and i.order_id=o.id and i.catalog_kind=s.product_kind and i.catalog_id=s.product_id)),false),
      'reason',case
        when s.status not in ('open','closed') then 'season_unavailable'
        when e.status not in ('active','completed') then 'enrollment_inactive'
        when pe.user_id<>e.user_id or pe.resource_type<>'read-season' or pe.resource_id<>s.slug then 'entitlement_mismatch'
        when pe.status<>'active' or pe.revoked_at is not null then 'entitlement_inactive'
        when pe.expires_at is not null and pe.expires_at<=now() then 'entitlement_expired'
        when pe.source_type='order' and (o.status is distinct from 'paid' or o.user_id is distinct from e.user_id
          or i.order_id is distinct from o.id or i.catalog_kind is distinct from s.product_kind
          or i.catalog_id is distinct from s.product_id) then 'order_inactive'
        else null end,
      'seasonSlug',s.slug,'enrollmentId',e.id::text,'enrollmentStatus',e.status,'sourceType',pe.source_type)
    from public.nal_read_enrollments e
    join public.nal_read_seasons s on s.id=e.season_id
    join public.nal_product_entitlements pe on pe.id=e.entitlement_id
    left join public.nal_orders o on o.id=pe.order_id
    left join public.nal_order_items i on i.id=pe.order_item_id
    where e.user_id=p_user_id and s.slug=p_season_slug
  ),jsonb_build_object('allowed',false,'reason','not_enrolled','seasonSlug',p_season_slug))
$$;

create or replace function public.nal_issue_read_enrollment(
 p_user_id uuid,p_season_slug text,p_order_id uuid,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.nal_read_seasons%rowtype; o public.nal_orders%rowtype;
 i public.nal_order_items%rowtype; prior nal_private.read_enrollment_requests%rowtype;
 e public.nal_read_enrollments%rowtype; pe public.nal_product_entitlements%rowtype;
begin
 if p_user_id is null or p_order_id is null or p_request_id is null or p_season_slug is null
  or p_season_slug !~ '^[a-z0-9-]{1,120}$' then
  raise exception 'Invalid read enrollment request' using errcode='22023';
 end if;
 if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then
  raise exception 'Verified login required' using errcode='42501';
 end if;
 -- Serialize retries by request, and all grants for a user/season. No global season write lock.
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_season_slug,1));
 select * into s from public.nal_read_seasons where slug=p_season_slug for share;
 if not found then raise exception 'Read season unavailable' using errcode='22023'; end if;
 select * into prior from nal_private.read_enrollment_requests where request_id=p_request_id;
 if found then
  if prior.user_id<>p_user_id or prior.order_id<>p_order_id or prior.season_id<>s.id then
   raise exception 'Request ID already used' using errcode='23505';
  end if;
  return public.nal_get_read_access(p_user_id,p_season_slug);
 end if;
 if s.status not in ('open','closed') or s.product_id is null then
  raise exception 'Read season unavailable' using errcode='22023';
 end if;
 select * into o from public.nal_orders where id=p_order_id and user_id=p_user_id for share;
 if not found or o.status<>'paid' then raise exception 'Paid order not found' using errcode='42501'; end if;
 select * into i from public.nal_order_items where order_id=o.id
  and catalog_kind=s.product_kind and catalog_id=s.product_id order by id limit 1 for share;
 if not found then raise exception 'Order product mismatch' using errcode='42501'; end if;
 select * into e from public.nal_read_enrollments where user_id=p_user_id and season_id=s.id for update;
 if not found then
  insert into public.nal_product_entitlements(user_id,resource_type,resource_id,source_type,order_id,order_item_id)
   values(p_user_id,'read-season',s.slug,'order',o.id,i.id)
   on conflict(order_item_id,resource_type,resource_id) do nothing;
  select * into pe from public.nal_product_entitlements where order_item_id=i.id
   and resource_type='read-season' and resource_id=s.slug for share;
  if not found or pe.user_id<>p_user_id or pe.order_id<>o.id then
   raise exception 'Entitlement mismatch' using errcode='42501';
  end if;
  insert into public.nal_read_enrollments(user_id,season_id,entitlement_id)
   values(p_user_id,s.id,pe.id) returning * into e;
 end if;
 -- An existing enrollment/entitlement is NEVER reactivated or replaced by claim.
 -- Refund, revoke, pause, completed state and expiration remain exactly as stored.
 insert into nal_private.read_enrollment_requests(request_id,user_id,season_id,order_id,enrollment_id)
  values(p_request_id,p_user_id,s.id,o.id,e.id);
 return public.nal_get_read_access(p_user_id,p_season_slug);
end $$;

create or replace function nal_private.read_day_gate(p_user_id uuid,p_season_slug text,p_day_number integer)
returns table(day_id uuid,enrollment_id uuid)
language plpgsql security invoker set search_path='' as $$
declare a jsonb; d nal_private.read_days%rowtype; s public.nal_read_seasons%rowtype;
 w nal_private.read_weeks%rowtype; eid uuid;
begin
 if p_day_number is null or p_day_number not between 0 and 366 then
  raise exception 'Invalid day' using errcode='22023'; end if;
 a:=public.nal_get_read_access(p_user_id,p_season_slug);
 if coalesce((a->>'allowed')::boolean,false) is not true then
  raise exception 'Read access unavailable' using errcode='42501'; end if;
 eid:=(a->>'enrollmentId')::uuid;
 select * into s from public.nal_read_seasons where slug=p_season_slug for share;
 select * into d from nal_private.read_days where season_id=s.id and day_number=p_day_number for share;
 if not found or d.status<>'published' then raise exception 'Read day unavailable' using errcode='22023'; end if;
 if d.week_id is not null then
  select * into w from nal_private.read_weeks where id=d.week_id for share;
  if not found or w.season_id<>s.id or w.status<>'published' then
   raise exception 'Read week unavailable' using errcode='22023'; end if;
 end if;
 if s.starts_at>now() or d.available_at>now() then
  raise exception 'Read day locked' using errcode='42501'; end if;
 if d.day_number>0 and not exists(
  select 1 from nal_private.read_days prev join public.nal_read_day_progress p
   on p.day_id=prev.id and p.user_id=p_user_id and p.enrollment_id=eid and p.status='completed'
  where prev.season_id=s.id and prev.day_number=d.day_number-1 and prev.status='published'
 ) then raise exception 'Read day locked' using errcode='42501'; end if;
 return query select d.id,eid;
end $$;
revoke all on function nal_private.read_day_gate(uuid,text,integer) from public,anon,authenticated;
grant execute on function nal_private.read_day_gate(uuid,text,integer) to service_role;

create or replace function nal_private.read_answer_valid(
 s nal_private.read_day_steps,t text,j jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare clean text:=btrim(coalesce(t,''), E' \t\n\r\f'||chr(11)||chr(160)||chr(12288)||chr(8203));
 val jsonb; n numeric; chosen jsonb; allowed jsonb;
begin
 if s.step_type not in ('QUESTION','SCALE','MULTI_SELECT','RECORD','TRY') then return false; end if;
 if length(coalesce(t,''))>5000 or length(coalesce(j::text,''))>20000 then return false; end if;
 if s.step_type in ('QUESTION','RECORD','TRY') then
  return (j is null or j='null'::jsonb) and (not s.required or clean<>'');
 end if;
 if clean<>'' then return false; end if;
 if j is null or j='null'::jsonb then return not s.required; end if;
 if jsonb_typeof(j)<>'object' then return false; end if;
 if s.step_type='SCALE' then
  if j-'value'<>'{}'::jsonb or jsonb_typeof(j->'value') is distinct from 'number' then return false; end if;
  n:=(j->>'value')::numeric;
  return n between 1 and 5 and n=trunc(n);
 end if;
 if j-'values'<>'{}'::jsonb or jsonb_typeof(j->'values') is distinct from 'array'
  or jsonb_typeof(s.options) is distinct from 'array' then return false; end if;
 chosen:=j->'values';
 if jsonb_array_length(chosen)>100 or (s.required and jsonb_array_length(chosen)=0) then return false; end if;
 if (select count(*) from jsonb_array_elements(chosen))<>(select count(distinct value) from jsonb_array_elements(chosen)) then return false; end if;
 select coalesce(jsonb_agg(case when jsonb_typeof(value)='string' then value
   when jsonb_typeof(value)='object' and jsonb_typeof(value->'value')='string' then value->'value'
   when jsonb_typeof(value)='object' and jsonb_typeof(value->'label')='string' then value->'label'
   else 'null'::jsonb end),'[]'::jsonb) into allowed from jsonb_array_elements(s.options);
 for val in select value from jsonb_array_elements(chosen) loop
  if jsonb_typeof(val)<>'string' or not (allowed @> jsonb_build_array(val)) then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function nal_private.read_answer_valid(nal_private.read_day_steps,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_answer_valid(nal_private.read_day_steps,text,jsonb) to service_role;

create or replace function public.nal_get_read_day(p_user_id uuid,p_season_slug text,p_day_number integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g record; d nal_private.read_days%rowtype; steps jsonb;
begin
 select * into strict g from nal_private.read_day_gate(p_user_id,p_season_slug,p_day_number);
 select * into d from nal_private.read_days where id=g.day_id;
 insert into public.nal_read_day_progress(user_id,enrollment_id,day_id,status)
  values(p_user_id,g.enrollment_id,d.id,'started') on conflict(user_id,day_id) do nothing;
 select coalesce(jsonb_agg(jsonb_build_object('order',s.step_order,'type',s.step_type,
  'content',s.content,'prompt',s.prompt,'placeholder',s.placeholder,'options',s.options,
  'recordTemplate',s.record_template,'required',s.required,'answerText',a.answer_text,'answerJson',a.answer_json
 ) order by s.step_order),'[]'::jsonb) into steps
 from nal_private.read_day_steps s left join public.nal_read_answers a
  on a.step_id=s.id and a.day_id=d.id and a.user_id=p_user_id and a.enrollment_id=g.enrollment_id
 where s.day_id=d.id and s.status='published';
 return jsonb_build_object('dayNumber',d.day_number,'title',d.title,'dayType',d.day_type,
  'estimatedMinutes',d.estimated_minutes,'steps',steps);
end $$;

create or replace function public.nal_save_read_answer(p_user_id uuid,p_season_slug text,
 p_day_number integer,p_step_order integer,p_answer_text text,p_answer_json jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g record; s nal_private.read_day_steps%rowtype; aid uuid;
begin
 select * into strict g from nal_private.read_day_gate(p_user_id,p_season_slug,p_day_number);
 select * into s from nal_private.read_day_steps where day_id=g.day_id and step_order=p_step_order
  and status='published' for share;
 if not found then raise exception 'Read step unavailable' using errcode='22023'; end if;
 if not nal_private.read_answer_valid(s,p_answer_text,p_answer_json) then
  raise exception 'Invalid answer' using errcode='22023'; end if;
 insert into public.nal_read_day_progress(user_id,enrollment_id,day_id,status)
  values(p_user_id,g.enrollment_id,g.day_id,'started') on conflict(user_id,day_id) do nothing;
 insert into public.nal_read_answers(user_id,enrollment_id,day_id,step_id,answer_text,answer_json)
  values(p_user_id,g.enrollment_id,g.day_id,s.id,p_answer_text,p_answer_json)
  on conflict(user_id,step_id) do update set answer_text=excluded.answer_text,answer_json=excluded.answer_json,updated_at=now()
  where public.nal_read_answers.enrollment_id=excluded.enrollment_id and public.nal_read_answers.day_id=excluded.day_id
  returning id into aid;
 if aid is null then raise exception 'Read access unavailable' using errcode='42501'; end if;
 return jsonb_build_object('saved',true,'answerId',aid::text);
end $$;

create or replace function public.nal_complete_read_day(p_user_id uuid,p_season_slug text,p_day_number integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g record;
begin
 select * into strict g from nal_private.read_day_gate(p_user_id,p_season_slug,p_day_number);
 perform id from nal_private.read_day_steps where day_id=g.day_id and status='published' for share;
 if exists(select 1 from nal_private.read_day_steps s left join public.nal_read_answers a
   on a.step_id=s.id and a.day_id=g.day_id and a.user_id=p_user_id and a.enrollment_id=g.enrollment_id
   where s.day_id=g.day_id and s.status='published' and s.required
   and (a.id is null or not nal_private.read_answer_valid(s,a.answer_text,a.answer_json))) then
  raise exception 'Valid required answers missing' using errcode='22023';
 end if;
 insert into public.nal_read_day_progress(user_id,enrollment_id,day_id,status,completed_at)
  values(p_user_id,g.enrollment_id,g.day_id,'completed',now())
  on conflict(user_id,day_id) do update set status='completed',
   completed_at=coalesce(public.nal_read_day_progress.completed_at,now()),updated_at=now();
 return jsonb_build_object('completed',true,'dayNumber',p_day_number);
end $$;

create or replace function public.nal_read_bootstrap(p_user_id uuid,p_season_slug text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare a jsonb; s public.nal_read_seasons%rowtype; d record; g record; eid uuid;
 journey jsonb:='[]'; progress text; unlocked boolean; current_day integer; last_done integer;
begin
 a:=public.nal_get_read_access(p_user_id,p_season_slug);
 if coalesce((a->>'allowed')::boolean,false) is not true then
  raise exception 'Read access unavailable' using errcode='42501'; end if;
 eid:=(a->>'enrollmentId')::uuid;
 select * into s from public.nal_read_seasons where slug=p_season_slug;
 for d in select rd.* from nal_private.read_days rd left join nal_private.read_weeks w on w.id=rd.week_id
  where rd.season_id=s.id and rd.status='published'
  and (rd.week_id is null or (w.season_id=s.id and w.status='published')) order by rd.day_number loop
  unlocked:=false;
  begin
   select * into strict g from nal_private.read_day_gate(p_user_id,p_season_slug,d.day_number);
   unlocked:=true;
  exception when sqlstate '42501' or sqlstate '22023' then unlocked:=false;
  end;
  select p.status into progress from public.nal_read_day_progress p
   where p.user_id=p_user_id and p.enrollment_id=eid and p.day_id=d.id;
  if unlocked and progress is distinct from 'completed' and current_day is null then current_day:=d.day_number; end if;
  if unlocked and progress='completed' then last_done:=d.day_number; end if;
  journey:=journey||jsonb_build_array(jsonb_build_object('dayNumber',d.day_number,'title',d.title,
   'dayType',d.day_type,'estimatedMinutes',d.estimated_minutes,'progress',coalesce(progress,'locked'),
   'unlocked',unlocked));
 end loop;
 return jsonb_build_object('seasonSlug',s.slug,'seasonTitle',s.title,'enrollmentId',eid::text,
  'enrollmentStatus',a->>'enrollmentStatus','currentDay',coalesce(current_day,last_done),'journey',journey);
end $$;

-- CREATE OR REPLACE preserves existing ACLs; reassert the service-only public RPC contract.
revoke all on function public.nal_get_read_access(uuid,text), public.nal_issue_read_enrollment(uuid,text,uuid,uuid),
 public.nal_read_bootstrap(uuid,text), public.nal_get_read_day(uuid,text,integer),
 public.nal_save_read_answer(uuid,text,integer,integer,text,jsonb), public.nal_complete_read_day(uuid,text,integer)
 from public,anon,authenticated;
grant execute on function public.nal_get_read_access(uuid,text), public.nal_issue_read_enrollment(uuid,text,uuid,uuid),
 public.nal_read_bootstrap(uuid,text), public.nal_get_read_day(uuid,text,integer),
 public.nal_save_read_answer(uuid,text,integer,integer,text,jsonb), public.nal_complete_read_day(uuid,text,integer)
 to service_role;

-- NAL-FIX-02 controlled rollout guard. Append atomically after FIX-01.
-- No launch/open mode exists. Test permits require a user AND a season AND an expiry.
create table nal_private.read_release_control (
 singleton boolean primary key default true check(singleton),
 mode text not null default 'off' check(mode in ('off','test_only')),
 updated_at timestamptz not null default now()
);
insert into nal_private.read_release_control(singleton,mode) values(true,'off');
create table nal_private.read_test_allowlist (
 user_id uuid not null references auth.users(id) on delete cascade,
 season_id uuid not null references public.nal_read_seasons(id) on delete cascade,
 granted_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '24 hours'),
 revoked_at timestamptz,
 approval_ref text not null check(length(btrim(approval_ref)) between 1 and 200),
 primary key(user_id,season_id),
 check(expires_at>granted_at and expires_at<=granted_at+interval '7 days')
);
create index read_test_allowlist_season on nal_private.read_test_allowlist(season_id);
alter table nal_private.read_release_control enable row level security;
alter table nal_private.read_test_allowlist enable row level security;
revoke all on nal_private.read_release_control,nal_private.read_test_allowlist from public,anon,authenticated,service_role;
-- Runtime can inspect scope, but cannot grant access or activate READ.
grant select on nal_private.read_release_control,nal_private.read_test_allowlist to service_role;
create trigger nal_touch before update on nal_private.read_release_control
 for each row execute function nal_private.touch_updated_at();
create trigger nal_audit after insert or update or delete on nal_private.read_release_control
 for each row execute function nal_private.audit_change();
create trigger nal_audit after insert or update or delete on nal_private.read_test_allowlist
 for each row execute function nal_private.audit_change();

create function public.nal_read_release_guard(p_user_id uuid,p_season_slug text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from nal_private.read_release_control where singleton and mode='test_only') then
  return jsonb_build_object('allowed',false,'reason','read_release_off');
 end if;
 if p_user_id is null or p_season_slug is null or not exists(
   select 1 from nal_private.read_test_allowlist a
   join public.nal_read_seasons s on s.id=a.season_id
   join auth.users u on u.id=a.user_id
   where a.user_id=p_user_id and s.slug=p_season_slug
     and a.revoked_at is null and a.granted_at<=now() and a.expires_at>now()
     and u.email_confirmed_at is not null
     and coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false)=false
     and (to_jsonb(u)->>'deleted_at') is null
     and ((to_jsonb(u)->>'banned_until') is null or (to_jsonb(u)->>'banned_until')::timestamptz<=now())
 ) then
  return jsonb_build_object('allowed',false,'reason','read_test_scope_required');
 end if;
 return jsonb_build_object('allowed',true,'mode','test_only');
end $$;
revoke all on function public.nal_read_release_guard(uuid,text) from public,anon,authenticated;
grant execute on function public.nal_read_release_guard(uuid,text) to service_role;

-- Preserve tested FIX-01 cores, behind server-only scope wrappers.
alter function public.nal_get_read_access(uuid,text) rename to read_access_core;
alter function public.read_access_core(uuid,text) set schema nal_private;
alter function public.nal_issue_read_enrollment(uuid,text,uuid,uuid) rename to read_claim_core;
alter function public.read_claim_core(uuid,text,uuid,uuid) set schema nal_private;
revoke all on function nal_private.read_access_core(uuid,text),nal_private.read_claim_core(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function nal_private.read_access_core(uuid,text),nal_private.read_claim_core(uuid,text,uuid,uuid) to service_role;

create function public.nal_get_read_access(p_user_id uuid,p_season_slug text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare g jsonb;
begin
 g:=public.nal_read_release_guard(p_user_id,p_season_slug);
 if coalesce((g->>'allowed')::boolean,false) is not true then return g; end if;
 return nal_private.read_access_core(p_user_id,p_season_slug);
end $$;
create function public.nal_issue_read_enrollment(p_user_id uuid,p_season_slug text,p_order_id uuid,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g jsonb;
begin
 g:=public.nal_read_release_guard(p_user_id,p_season_slug);
 if coalesce((g->>'allowed')::boolean,false) is not true then
  raise exception 'Read access unavailable' using errcode='42501';
 end if;
 return nal_private.read_claim_core(p_user_id,p_season_slug,p_order_id,p_request_id);
end $$;
revoke all on function public.nal_get_read_access(uuid,text),public.nal_issue_read_enrollment(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.nal_get_read_access(uuid,text),public.nal_issue_read_enrollment(uuid,text,uuid,uuid) to service_role;

-- READ development is API-only. No direct browser table bypass while testing.
-- Restrictive policies intersect existing owner policies; STORE policies are untouched.
create policy nal_read_controlled_api_only on public.nal_read_seasons as restrictive
 for all to anon,authenticated using(false) with check(false);
create policy nal_read_controlled_api_only on public.nal_product_entitlements as restrictive
 for all to anon,authenticated using(false) with check(false);
create policy nal_read_controlled_api_only on public.nal_read_enrollments as restrictive
 for all to anon,authenticated using(false) with check(false);
create policy nal_read_controlled_api_only on public.nal_read_answers as restrictive
 for all to anon,authenticated using(false) with check(false);
create policy nal_read_controlled_api_only on public.nal_read_day_progress as restrictive
 for all to anon,authenticated using(false) with check(false);

commit;
