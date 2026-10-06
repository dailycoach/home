\set ON_ERROR_STOP on

create schema if not exists auth;
create schema if not exists nal_private;

do $$
begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;

create table auth.users (
  id uuid primary key,
  email_confirmed_at timestamptz
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;

create table public.nal_catalog (
  kind text not null,
  id text not null,
  published boolean not null default false,
  body jsonb not null default '{}'::jsonb,
  primary key(kind,id)
);

create table public.nal_orders (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  status text not null check (status in ('pending','paid','cancelled','refund_requested','refunded')),
  amount_won integer not null default 0,
  updated_at timestamptz not null default now()
);

create table public.nal_order_items (
  id uuid primary key,
  order_id uuid not null references public.nal_orders(id),
  catalog_kind text not null,
  catalog_id text not null,
  title_snapshot text not null default '',
  quantity integer not null default 1,
  unit_price_won integer not null default 0,
  foreign key(catalog_kind,catalog_id) references public.nal_catalog(kind,id)
);

create table nal_private.audit_log (
  id bigserial primary key,
  actor_id uuid,
  table_name text,
  operation text,
  record_id text,
  before_catalog jsonb,
  after_catalog jsonb
);

create or replace function nal_private.touch_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create or replace function nal_private.audit_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  before_row jsonb;
  after_row jsonb;
begin
  if tg_op <> 'INSERT' then before_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_row := to_jsonb(new); end if;
  insert into nal_private.audit_log(actor_id,table_name,operation,record_id,before_catalog,after_catalog)
  values (
    auth.uid(), tg_table_name, tg_op,
    coalesce(after_row,before_row)->>'id',
    before_row, after_row
  );
  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;
