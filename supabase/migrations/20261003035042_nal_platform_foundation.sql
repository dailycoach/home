-- Dedicated NAL project only. No modifications to ERP tables or data.
create schema if not exists nal_private;
revoke all on schema nal_private from public, anon, authenticated;
grant usage on schema nal_private to authenticated, service_role;

create table nal_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'operator')),
  created_at timestamptz not null default now()
);
alter table nal_private.admins enable row level security;
revoke all on nal_private.admins from public, anon, authenticated;
grant all on nal_private.admins to service_role;

-- Narrow definer lookup: callers can test only their own trusted membership.
create function nal_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from nal_private.admins where user_id = (select auth.uid())
  );
$$;
revoke all on function nal_private.is_admin() from public, anon, authenticated;
grant execute on function nal_private.is_admin() to authenticated;

create table public.nal_catalog (
  kind text not null check (kind in ('programs', 'products', 'hosts', 'content')),
  id text not null check (id ~ '^[a-z0-9-]+$'),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  published boolean not null default false,
  body jsonb not null check (jsonb_typeof(body) = 'object' and not body ? 'onlineUrl'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (kind, id), unique (kind, slug)
);
create index nal_catalog_published on public.nal_catalog (kind, updated_at desc) where published;

create table public.nal_settings (
  id text primary key check (id in ('site', 'launches')),
  body jsonb not null check (jsonb_typeof(body) = 'object'),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.nal_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 80),
  phone text check (length(phone) <= 30),
  updated_at timestamptz not null default now()
);

create table public.nal_sessions (
  id uuid primary key default gen_random_uuid(),
  program_kind text not null default 'programs' check (program_kind = 'programs'),
  program_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  location text,
  capacity integer not null check (capacity > 0 and capacity <= 10000),
  price_won integer not null check (price_won >= 0),
  status text not null default 'draft' check (status in ('draft', 'open', 'waiting', 'closed', 'completed')),
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  foreign key (program_kind, program_id) references public.nal_catalog(kind, id)
);
create index nal_sessions_program on public.nal_sessions (program_kind, program_id, starts_at);

create table public.nal_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  session_id uuid not null references public.nal_sessions(id),
  request_id uuid not null,
  status text not null check (status in ('pending_payment', 'confirmed', 'waitlisted', 'cancellation_requested', 'cancelled', 'expired')),
  price_won integer not null check (price_won >= 0),
  hold_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id),
  check (status <> 'pending_payment' or hold_expires_at is not null)
);
create unique index nal_registrations_one_active on public.nal_registrations (user_id, session_id)
  where status in ('pending_payment', 'confirmed', 'waitlisted', 'cancellation_requested');
create index nal_registrations_capacity on public.nal_registrations (session_id, status, hold_expires_at);

create table public.nal_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  registration_id uuid unique references public.nal_registrations(id),
  amount_won integer not null check (amount_won >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refund_requested', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index nal_orders_user on public.nal_orders (user_id, created_at desc);

create table public.nal_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.nal_orders(id),
  catalog_kind text not null check (catalog_kind in ('products', 'programs')),
  catalog_id text not null,
  title_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price_won integer not null check (unit_price_won >= 0),
  foreign key (catalog_kind, catalog_id) references public.nal_catalog(kind, id)
);
create index nal_order_items_order on public.nal_order_items (order_id);
create index nal_order_items_catalog on public.nal_order_items (catalog_kind, catalog_id);

-- A protected reconciliation ledger, not a checkout or refund implementation.
create table public.nal_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.nal_orders(id),
  provider text not null,
  provider_event_id text not null,
  amount_won integer not null check (amount_won >= 0),
  status text not null check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index nal_payments_order on public.nal_payments (order_id);

create table public.nal_wishlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, item_id),
  foreign key (kind, item_id) references public.nal_catalog(kind, id)
);
create index nal_wishlist_catalog on public.nal_wishlist (kind, item_id);

create table public.nal_host_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  host_kind text not null default 'hosts' check (host_kind = 'hosts'),
  host_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, host_id),
  foreign key (host_kind, host_id) references public.nal_catalog(kind, id)
);
create index nal_host_follows_host on public.nal_host_follows (host_kind, host_id);

create table public.nal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  purpose text not null check (purpose in ('newsletter', 'schedule_alert', 'terms', 'privacy')),
  policy_version text not null check (length(policy_version) between 1 and 80),
  granted boolean not null,
  recorded_at timestamptz not null default now()
);
create index nal_consents_user on public.nal_consents (user_id, purpose, recorded_at desc);

create table nal_private.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  table_name text not null,
  operation text not null,
  record_id text,
  before_catalog jsonb,
  after_catalog jsonb,
  occurred_at timestamptz not null default now()
);
alter table nal_private.audit_log enable row level security;
revoke all on nal_private.audit_log from public, anon, authenticated;
grant select on nal_private.audit_log to authenticated;
grant all on nal_private.audit_log to service_role;
grant usage, select on sequence nal_private.audit_log_id_seq to service_role;
create policy nal_audit_admin_read on nal_private.audit_log for select to authenticated
  using ((select nal_private.is_admin()));

create function nal_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function nal_private.touch_updated_at() from public, anon, authenticated;

-- Trigger-only privilege: record private changes without granting log writes.
create function nal_private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  before_row jsonb;
  after_row jsonb;
begin
  if tg_op <> 'INSERT' then before_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_row := to_jsonb(new); end if;
  insert into nal_private.audit_log (actor_id, table_name, operation, record_id, before_catalog, after_catalog)
  values (auth.uid(), tg_table_name, tg_op,
    coalesce(after_row, before_row)->>'id',
    case when tg_table_name in ('nal_catalog', 'nal_settings') then before_row end,
    case when tg_table_name in ('nal_catalog', 'nal_settings') then after_row end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function nal_private.audit_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['nal_catalog', 'nal_settings', 'nal_profiles', 'nal_sessions',
    'nal_registrations', 'nal_orders', 'nal_order_items', 'nal_payments',
    'nal_wishlist', 'nal_host_follows', 'nal_consents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
  foreach t in array array['nal_catalog', 'nal_settings', 'nal_profiles', 'nal_sessions', 'nal_registrations', 'nal_orders'] loop
    execute format('create trigger nal_touch before update on public.%I for each row execute function nal_private.touch_updated_at()', t);
  end loop;
  foreach t in array array['nal_catalog', 'nal_settings', 'nal_sessions', 'nal_registrations', 'nal_orders', 'nal_order_items', 'nal_payments', 'nal_consents'] loop
    execute format('create trigger nal_audit after insert or update or delete on public.%I for each row execute function nal_private.audit_change()', t);
  end loop;
end;
$$;

grant select on public.nal_catalog, public.nal_settings, public.nal_sessions to anon;
create policy nal_catalog_public on public.nal_catalog for select to anon, authenticated using (published);
create policy nal_settings_public on public.nal_settings for select to anon, authenticated using (published);
create policy nal_sessions_public on public.nal_sessions for select to anon, authenticated
  using (published and exists (select 1 from public.nal_catalog c where c.kind = program_kind and c.id = program_id and c.published));

-- Operator policies are separate from end-user ownership policies.
do $$
declare t text;
begin
  foreach t in array array['nal_catalog', 'nal_settings', 'nal_sessions', 'nal_orders', 'nal_order_items', 'nal_payments'] loop
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy nal_operator_all on public.%I for all to authenticated using ((select nal_private.is_admin())) with check ((select nal_private.is_admin()))', t);
  end loop;
  foreach t in array array['nal_profiles', 'nal_registrations', 'nal_consents'] loop
    execute format('create policy nal_operator_read on public.%I for select to authenticated using ((select nal_private.is_admin()))', t);
  end loop;
end;
$$;

create policy nal_profile_own on public.nal_profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant insert, update on public.nal_profiles to authenticated;
create policy nal_registration_own_read on public.nal_registrations for select to authenticated using ((select auth.uid()) = user_id);
create policy nal_order_own_read on public.nal_orders for select to authenticated using ((select auth.uid()) = user_id);
create policy nal_order_items_own_read on public.nal_order_items for select to authenticated
  using (exists (select 1 from public.nal_orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy nal_payment_own_read on public.nal_payments for select to authenticated
  using (exists (select 1 from public.nal_orders o where o.id = order_id and o.user_id = (select auth.uid())));

create policy nal_wishlist_own_read_delete on public.nal_wishlist for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.nal_catalog c where c.kind = nal_wishlist.kind and c.id = nal_wishlist.item_id and c.published
  ));
grant insert, delete on public.nal_wishlist to authenticated;
create policy nal_follow_own on public.nal_host_follows for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.nal_catalog c where c.kind = host_kind and c.id = host_id and c.published
  ));
grant insert, delete on public.nal_host_follows to authenticated;
create policy nal_consent_own_read on public.nal_consents for select to authenticated using ((select auth.uid()) = user_id);
create policy nal_consent_own_insert on public.nal_consents for insert to authenticated with check ((select auth.uid()) = user_id);
grant insert (user_id, purpose, policy_version, granted) on public.nal_consents to authenticated;

create function nal_private.register(p_session_id uuid, p_request_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  session_row public.nal_sessions%rowtype;
  registration public.nal_registrations%rowtype;
  occupied integer;
  next_status text;
begin
  if actor is null or not exists (select 1 from auth.users where id = actor and email_confirmed_at is not null)
    then raise exception 'Verified login required' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'Request ID required' using errcode = '22023'; end if;
  select * into session_row from public.nal_sessions where id = p_session_id for update;
  if not found then raise exception 'Session unavailable' using errcode = '22023'; end if;

  select * into registration from public.nal_registrations where user_id = actor and request_id = p_request_id;
  if found then
    if registration.session_id <> p_session_id then raise exception 'Request ID reused for another session' using errcode = '22023'; end if;
    return registration.id;
  end if;
  if not session_row.published or session_row.status not in ('open', 'waiting') or session_row.starts_at <= now()
    or not exists (select 1 from public.nal_catalog where kind = 'programs' and id = session_row.program_id and published)
    then raise exception 'Session unavailable' using errcode = '22023'; end if;

  update public.nal_registrations set status = 'expired'
    where session_id = p_session_id and status = 'pending_payment' and hold_expires_at <= now();
  select * into registration from public.nal_registrations where user_id = actor and session_id = p_session_id
    and status in ('pending_payment', 'confirmed', 'waitlisted', 'cancellation_requested');
  if found then raise exception 'Active registration already exists; use original request ID' using errcode = '23505'; end if;

  select count(*) into occupied from public.nal_registrations where session_id = p_session_id
    and (status in ('confirmed', 'cancellation_requested') or (status = 'pending_payment' and hold_expires_at > now()));
  next_status := case when session_row.status = 'waiting' or occupied >= session_row.capacity then 'waitlisted'
    when session_row.price_won = 0 then 'confirmed' else 'pending_payment' end;
  insert into public.nal_registrations (user_id, session_id, request_id, status, price_won, hold_expires_at)
    values (actor, p_session_id, p_request_id, next_status, session_row.price_won,
      case when next_status = 'pending_payment' then now() + interval '15 minutes' end)
    returning * into registration;
  return registration.id;
end;
$$;
revoke all on function nal_private.register(uuid, uuid) from public, anon, authenticated;
grant execute on function nal_private.register(uuid, uuid) to authenticated;
create function public.nal_register(p_session_id uuid, p_request_id uuid) returns uuid
language sql security invoker set search_path = '' as $$
  select nal_private.register(p_session_id, p_request_id);
$$;
revoke all on function public.nal_register(uuid, uuid) from public, anon, authenticated;
grant execute on function public.nal_register(uuid, uuid) to authenticated;

create function nal_private.cancel_registration(p_registration_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  registration public.nal_registrations%rowtype;
begin
  if actor is null or not exists (select 1 from auth.users where id = actor and email_confirmed_at is not null)
    then raise exception 'Verified login required' using errcode = '42501'; end if;
  select * into registration from public.nal_registrations where id = p_registration_id and user_id = actor;
  if not found then raise exception 'Registration unavailable' using errcode = '42501'; end if;
  perform 1 from public.nal_sessions where id = registration.session_id for update;
  select * into registration from public.nal_registrations where id = p_registration_id and user_id = actor for update;
  if registration.status in ('cancelled', 'expired', 'cancellation_requested') then return registration.id; end if;
  update public.nal_registrations set status = case
    when registration.status = 'confirmed' and registration.price_won > 0 then 'cancellation_requested' else 'cancelled' end
    where id = registration.id;
  return registration.id;
end;
$$;
revoke all on function nal_private.cancel_registration(uuid) from public, anon, authenticated;
grant execute on function nal_private.cancel_registration(uuid) to authenticated;
create function public.nal_cancel_registration(p_registration_id uuid) returns uuid
language sql security invoker set search_path = '' as $$
  select nal_private.cancel_registration(p_registration_id);
$$;
revoke all on function public.nal_cancel_registration(uuid) from public, anon, authenticated;
grant execute on function public.nal_cancel_registration(uuid) to authenticated;
