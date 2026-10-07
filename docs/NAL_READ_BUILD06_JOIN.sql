-- BUILD06 source only, UNAPPLIED. Requires BUILD04 + BUILD05 sources and FIX03.
-- READ offer metadata never changes PDF delivery, catalog prices, provider keys, or the release switch.
begin;
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
commit;
