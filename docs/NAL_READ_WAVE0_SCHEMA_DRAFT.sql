-- REVIEW DRAFT ONLY. Do not apply to production.
-- NAL READ WAVE 0: season, generic product entitlement, enrollment and idempotent claim/access RPCs.
begin;

create table public.nal_read_seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,120}$'),
  title text not null check (length(title) between 1 and 120),
  subtitle text,
  product_id text,
  status text not null default 'draft' check (status in ('draft','preview','open','closed','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.nal_product_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('read-season')),
  resource_id text not null check (resource_id ~ '^[a-z0-9-]{1,120}$'),
  source_type text not null check (source_type in ('order','manual','promotion')),
  order_id uuid references public.nal_orders(id),
  order_item_id uuid references public.nal_order_items(id),
  status text not null default 'active' check (status in ('active','revoked','expired','refunded')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  unique(order_item_id,resource_type,resource_id),
  check ((source_type='order' and order_id is not null and order_item_id is not null) or source_type<>'order')
);

create table public.nal_read_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references public.nal_read_seasons(id) on delete restrict,
  entitlement_id uuid not null references public.nal_product_entitlements(id) on delete restrict,
  status text not null default 'active' check (status in ('pending','active','paused','completed','revoked','refunded')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,season_id)
);

create table nal_private.read_enrollment_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references public.nal_read_seasons(id) on delete cascade,
  order_id uuid not null references public.nal_orders(id) on delete cascade,
  enrollment_id uuid not null references public.nal_read_enrollments(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index nal_read_seasons_status on public.nal_read_seasons(status,starts_at);
create index nal_product_entitlements_user on public.nal_product_entitlements(user_id,granted_at desc);
create index nal_product_entitlements_order on public.nal_product_entitlements(order_id);
create index nal_read_enrollments_user on public.nal_read_enrollments(user_id,created_at desc);

alter table public.nal_read_seasons enable row level security;
alter table public.nal_product_entitlements enable row level security;
alter table public.nal_read_enrollments enable row level security;
alter table nal_private.read_enrollment_requests enable row level security;

revoke all on public.nal_read_seasons from public,anon,authenticated;
revoke all on public.nal_product_entitlements from public,anon,authenticated;
revoke all on public.nal_read_enrollments from public,anon,authenticated;
revoke all on nal_private.read_enrollment_requests from public,anon,authenticated;

grant select on public.nal_read_seasons to anon,authenticated;
grant select on public.nal_product_entitlements to authenticated;
grant select on public.nal_read_enrollments to authenticated;
grant all on public.nal_read_seasons,public.nal_product_entitlements,public.nal_read_enrollments to service_role;
grant all on nal_private.read_enrollment_requests to service_role;

create policy nal_read_seasons_public_read on public.nal_read_seasons
  for select to anon,authenticated using (status in ('open','closed'));
create policy nal_product_entitlements_own_read on public.nal_product_entitlements
  for select to authenticated using ((select auth.uid())=user_id);
create policy nal_read_enrollments_own_read on public.nal_read_enrollments
  for select to authenticated using ((select auth.uid())=user_id);

create function public.nal_get_read_access(
  p_user_id uuid,
  p_season_slug text
) returns jsonb
language sql stable security invoker set search_path='' as $$
  select coalesce((
    select jsonb_build_object(
      'allowed',
        e.status in ('active','completed')
        and pe.status='active'
        and pe.revoked_at is null
        and (pe.expires_at is null or pe.expires_at>now())
        and (pe.source_type<>'order' or o.status='paid'),
      'seasonSlug',s.slug,
      'enrollmentId',e.id::text,
      'enrollmentStatus',e.status,
      'sourceType',pe.source_type
    )
    from public.nal_read_enrollments e
    join public.nal_read_seasons s on s.id=e.season_id
    join public.nal_product_entitlements pe on pe.id=e.entitlement_id
    left join public.nal_orders o on o.id=pe.order_id
    where e.user_id=p_user_id and s.slug=p_season_slug
    limit 1
  ),jsonb_build_object('allowed',false,'reason','not_enrolled','seasonSlug',p_season_slug))
$$;

create function public.nal_issue_read_enrollment(
  p_user_id uuid,
  p_season_slug text,
  p_order_id uuid,
  p_request_id uuid
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  s public.nal_read_seasons%rowtype;
  o public.nal_orders%rowtype;
  i public.nal_order_items%rowtype;
  existing nal_private.read_enrollment_requests%rowtype;
  entitlement_id uuid;
  enrollment_id uuid;
begin
  if p_user_id is null or p_order_id is null or p_request_id is null
     or p_season_slug is null or p_season_slug !~ '^[a-z0-9-]{1,120}$' then
    raise exception 'Invalid read enrollment request' using errcode='22023';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then
    raise exception 'Verified login required' using errcode='42501';
  end if;

  select * into existing from nal_private.read_enrollment_requests where request_id=p_request_id;
  if found then
    if existing.user_id<>p_user_id or existing.order_id<>p_order_id then
      raise exception 'Request ID already used' using errcode='23505';
    end if;
    return public.nal_get_read_access(p_user_id,p_season_slug);
  end if;

  select * into s from public.nal_read_seasons where slug=p_season_slug for update;
  if not found or s.status='archived' or s.product_id is null then
    raise exception 'Read season unavailable' using errcode='22023';
  end if;

  select * into o from public.nal_orders where id=p_order_id and user_id=p_user_id for update;
  if not found or o.status<>'paid' then
    raise exception 'Paid order not found' using errcode='42501';
  end if;

  select * into i from public.nal_order_items
    where order_id=o.id and catalog_kind='products' and catalog_id=s.product_id
    order by id limit 1;
  if not found then raise exception 'Order product mismatch' using errcode='42501'; end if;

  insert into public.nal_product_entitlements(
    user_id,resource_type,resource_id,source_type,order_id,order_item_id,status
  ) values(p_user_id,'read-season',s.slug,'order',o.id,i.id,'active')
  on conflict(order_item_id,resource_type,resource_id) do update set
    user_id=excluded.user_id,status='active',revoked_at=null,expires_at=null
  returning id into entitlement_id;

  insert into public.nal_read_enrollments(user_id,season_id,entitlement_id,status)
    values(p_user_id,s.id,entitlement_id,'active')
  on conflict(user_id,season_id) do update set
    entitlement_id=excluded.entitlement_id,status='active',updated_at=now()
  returning id into enrollment_id;

  insert into nal_private.read_enrollment_requests(request_id,user_id,season_id,order_id,enrollment_id)
    values(p_request_id,p_user_id,s.id,o.id,enrollment_id);

  return public.nal_get_read_access(p_user_id,p_season_slug);
end $$;

revoke all on function public.nal_issue_read_enrollment(uuid,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.nal_get_read_access(uuid,text) from public,anon,authenticated;
grant execute on function public.nal_issue_read_enrollment(uuid,text,uuid,uuid) to service_role;
grant execute on function public.nal_get_read_access(uuid,text) to service_role;

commit;
