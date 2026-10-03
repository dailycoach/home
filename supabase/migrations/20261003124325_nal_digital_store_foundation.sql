-- NAL-MIND-STORE-02. Prepared only; not applied to the hosted project.
-- Apply with the existing foundation after deployment review and real fulfillment setup.
begin;
create function public.nal_public_product_body(input jsonb) returns jsonb
language sql immutable security invoker set search_path = '' as $$
  select coalesce(jsonb_object_agg(key,case
    when key in ('tags','gallery','galleryAlts','components','recommendedFor','relatedProgramIds','relatedContentIds','audiences','topics','tableOfContents') and jsonb_typeof(value)='array' then
      coalesce((select jsonb_agg(x) from jsonb_array_elements(value) x where jsonb_typeof(x)='string'),'[]'::jsonb)
    when key='licenseOptions' and jsonb_typeof(value)='array' then
      coalesce((select jsonb_agg(coalesce((select jsonb_object_agg(k,v) from jsonb_each(case when jsonb_typeof(x)='object' then x else '{}'::jsonb end) entry(k,v)
        where k in ('id','licenseType','label','price','printingAllowed','downloadLimit','accessPeriod','purchaseUrl') and jsonb_typeof(v)<>'object' and jsonb_typeof(v)<>'array'),'{}'::jsonb)) from jsonb_array_elements(value) x),'[]'::jsonb)
    when key='options' and jsonb_typeof(value)='array' then
      coalesce((select jsonb_agg(case when jsonb_typeof(x)='string' then x else coalesce((select jsonb_object_agg(k,v) from jsonb_each(case when jsonb_typeof(x)='object' then x else '{}'::jsonb end) entry(k,v) where k in ('label','name') and jsonb_typeof(v)='string'),'{}'::jsonb) end) from jsonb_array_elements(value) x),'[]'::jsonb)
    when jsonb_typeof(value) in ('string','number','boolean','null') then value else 'null'::jsonb end),'{}'::jsonb) from jsonb_each(input)
  where key = any(array['id','slug','title','subtitle','summary','description','category','tags','coverImage','coverImageAlt','gallery','galleryAlts','price','originalPrice','productType','deliveryType','stock','stockStatus','options','components','cardCount','pageCount','recommendedFor','usageIndividual','usageCouple','usageGroup','precautions','visualNote','shippingPolicy','exchangePolicy','refundPolicy','purchaseUrl','sourceUrl','relatedProgramIds','relatedContentIds','featured','featuredOrder','published','createdAt','updatedAt','fileFormat','fileSizeMB','sampleUrl','deliveryMethod','licenseType','printingAllowed','downloadLimit','accessPeriod','fulfillmentNote','author','audiences','topics','tableOfContents','previewUrl','licenseOptions','version','policyStatus','policyVersion']);
$$;
revoke all on function public.nal_public_product_body(jsonb) from public;
grant execute on function public.nal_public_product_body(jsonb) to anon,authenticated,service_role;

-- Direct catalog reads must be just as safe as the public RPC: reject private keys
-- rather than silently removing them only at the RPC boundary.
alter table public.nal_catalog add constraint nal_product_public_fields check (
  kind <> 'products' or (body = public.nal_public_product_body(body)
    and body::text !~* '(originalPdfUrl|privateStoragePath|downloadToken|paymentIdentifier|nal-products-private|[?&](token|access_token|signature)=)')
);
create view public.nal_products with (security_invoker=true) as
  select id,slug,published,public.nal_public_product_body(body) as metadata from public.nal_catalog where kind='products';
grant select on public.nal_products to anon,authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values ('nal-products-private','nal-products-private',false,104857600,array['application/pdf']) on conflict(id) do nothing;
do $$ begin
  if exists(select 1 from storage.buckets where id='nal-products-private' and public) then
    raise exception 'Paid PDF bucket must be private';
  end if;
end $$;
-- No client storage.objects policy is added. Only the server signs paid originals.

create table nal_private.product_files (
  id uuid primary key default gen_random_uuid(),
  catalog_kind text not null default 'products' check(catalog_kind='products'),
  product_id text not null,
  bucket_id text not null default 'nal-products-private' check(bucket_id='nal-products-private'),
  object_path text not null check(object_path ~ '^[a-z0-9][a-z0-9/_-]*[.]pdf$' and object_path like product_id || '/%'),
  download_name text not null check(download_name ~ '^[a-zA-Z0-9가-힣_-]+[.]pdf$'),
  version text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(bucket_id,object_path),
  foreign key(catalog_kind,product_id) references public.nal_catalog(kind,id)
);
alter table nal_private.product_files enable row level security;
revoke all on nal_private.product_files from public,anon,authenticated;
grant all on nal_private.product_files to service_role;

create table public.nal_digital_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  product_id text not null,
  order_id uuid not null references public.nal_orders(id),
  order_item_id uuid not null references public.nal_order_items(id),
  file_id uuid not null references nal_private.product_files(id),
  license_type text not null check(license_type in ('personal-use','facilitator-use','organization-use')),
  printing_allowed boolean not null,
  download_count integer not null default 0 check(download_count>=0),
  download_limit integer check(download_limit>0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(order_item_id,license_type),
  check(download_limit is null or download_count<=download_limit)
);
create index nal_entitlements_user on public.nal_digital_entitlements(user_id,created_at desc);
create index nal_entitlements_order on public.nal_digital_entitlements(order_id);
create index nal_entitlements_file on public.nal_digital_entitlements(file_id);
alter table public.nal_digital_entitlements enable row level security;
revoke all on public.nal_digital_entitlements from public,anon,authenticated;
grant select on public.nal_digital_entitlements to authenticated;
grant all on public.nal_digital_entitlements to service_role;
create policy nal_entitlements_own_read on public.nal_digital_entitlements for select to authenticated using(user_id=(select auth.uid()));

create table public.nal_download_events (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.nal_digital_entitlements(id),
  request_id uuid not null,
  status text not null default 'pending' check(status in ('pending','issued','failed')),
  created_at timestamptz not null default now(),
  issued_at timestamptz,
  unique(entitlement_id,request_id)
);
create index nal_download_events_pending on public.nal_download_events(entitlement_id,created_at) where status='pending';
alter table public.nal_download_events enable row level security;
revoke all on public.nal_download_events from public,anon,authenticated;
grant select on public.nal_download_events to authenticated;
grant all on public.nal_download_events to service_role;
create policy nal_download_events_own_read on public.nal_download_events for select to authenticated using(exists(
  select 1 from public.nal_digital_entitlements e where e.id=entitlement_id and e.user_id=(select auth.uid())
));

create function nal_private.validate_entitlement() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.nal_orders o join public.nal_order_items i on i.order_id=o.id
    join nal_private.product_files f on f.id=new.file_id
    where o.id=new.order_id and o.user_id=new.user_id and o.status='paid'
      and i.id=new.order_item_id and i.catalog_kind='products' and i.catalog_id=new.product_id
      and f.product_id=new.product_id and f.active
      and exists(select 1 from public.nal_payments p where p.order_id=o.id and p.status='paid' and p.amount_won=o.amount_won)) then
    raise exception 'Verified paid order and matching product required' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function nal_private.validate_entitlement() from public,anon,authenticated;
grant execute on function nal_private.validate_entitlement() to service_role;
create trigger nal_entitlement_guard before insert or update of user_id,product_id,order_id,order_item_id,file_id,license_type
  on public.nal_digital_entitlements for each row execute function nal_private.validate_entitlement();

create function public.nal_begin_download(p_user_id uuid,p_entitlement_id uuid,p_request_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.nal_digital_entitlements%rowtype; f nal_private.product_files%rowtype; d public.nal_download_events%rowtype; recovered integer;
begin
  if p_user_id is null or p_request_id is null then raise exception 'Verified identity required' using errcode='42501'; end if;
  -- Serialize with order/refund updates, then serialize reservations on the entitlement.
  perform 1 from public.nal_orders where id=(select order_id from public.nal_digital_entitlements where id=p_entitlement_id) for update;
  select * into e from public.nal_digital_entitlements where id=p_entitlement_id and user_id=p_user_id for update;
  if not found or e.revoked_at is not null or e.expires_at<=now() or not exists(select 1 from public.nal_orders where id=e.order_id and status='paid')
    or not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null)
    or not exists(select 1 from public.nal_payments p join public.nal_orders o on o.id=p.order_id where o.id=e.order_id and p.status='paid' and p.amount_won=o.amount_won) then
    raise exception 'Download unavailable' using errcode='42501';
  end if;
  select * into f from nal_private.product_files where id=e.file_id and active;
  if not found or not exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.bucket_id=f.bucket_id and o.name=f.object_path and not b.public) then
    raise exception 'Original file unavailable' using errcode='42501';
  end if;
  with stale as (update public.nal_download_events set status='failed' where entitlement_id=e.id and status='pending' and created_at<now()-interval '2 minutes' returning id)
    select count(*) into recovered from stale;
  if recovered>0 then update public.nal_digital_entitlements set download_count=download_count-recovered where id=e.id returning * into e; end if;
  select * into d from public.nal_download_events where entitlement_id=e.id and request_id=p_request_id;
  if found then
    if d.status='failed' or d.created_at<now()-interval '2 minutes' then raise exception 'Use a new request ID' using errcode='42501'; end if;
  else
    if e.download_limit is not null and e.download_count>=e.download_limit then raise exception 'Download limit reached' using errcode='42501'; end if;
    update public.nal_digital_entitlements set download_count=download_count+1 where id=e.id;
    insert into public.nal_download_events(entitlement_id,request_id) values(e.id,p_request_id) returning * into d;
  end if;
  return jsonb_build_object('bucket_id',f.bucket_id,'object_path',f.object_path,'download_name',f.download_name,
    'expires_at',least(d.created_at+interval '10 minutes',coalesce(e.expires_at,'infinity'::timestamptz)));
end $$;
revoke all on function public.nal_begin_download(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.nal_begin_download(uuid,uuid,uuid) to service_role;

create function public.nal_finish_download(p_user_id uuid,p_entitlement_id uuid,p_request_id uuid,p_issued boolean) returns boolean
language plpgsql security invoker set search_path='' as $$
declare e public.nal_digital_entitlements%rowtype; d public.nal_download_events%rowtype;
begin
  if p_issued is null then raise exception 'Explicit issuance status required' using errcode='22023'; end if;
  perform 1 from public.nal_orders where id=(select order_id from public.nal_digital_entitlements where id=p_entitlement_id) for update;
  select * into e from public.nal_digital_entitlements where id=p_entitlement_id and user_id=p_user_id for update;
  if not found then raise exception 'Download unavailable' using errcode='42501'; end if;
  select * into d from public.nal_download_events where entitlement_id=e.id and request_id=p_request_id for update;
  if not found then raise exception 'Reservation missing' using errcode='42501'; end if;
  if d.status='failed' then return false; end if;
  if p_issued and (e.revoked_at is not null or e.expires_at<=now() or d.created_at<now()-interval '2 minutes'
    or not exists(select 1 from public.nal_orders where id=e.order_id and status='paid')
    or not exists(select 1 from public.nal_payments p join public.nal_orders o on o.id=p.order_id where o.id=e.order_id and p.status='paid' and p.amount_won=o.amount_won)
    or not exists(select 1 from nal_private.product_files f join storage.objects o on o.bucket_id=f.bucket_id and o.name=f.object_path join storage.buckets b on b.id=o.bucket_id where f.id=e.file_id and f.active and not b.public)) then
    raise exception 'Download permission changed' using errcode='42501';
  end if;
  if d.status='issued' then return true; end if;
  update public.nal_download_events set status=case when p_issued then 'issued' else 'failed' end,issued_at=case when p_issued then now() end where id=d.id;
  if not p_issued then update public.nal_digital_entitlements set download_count=download_count-1 where id=e.id; end if;
  return p_issued;
end $$;
revoke all on function public.nal_finish_download(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.nal_finish_download(uuid,uuid,uuid,boolean) to service_role;

-- Published metadata only; private file locations and entitlements never enter this payload.
create or replace function public.nal_public_catalog() returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'site',(select body from public.nal_settings where id='site' and published),
    'launches',(select body from public.nal_settings where id='launches' and published),
    'programs',coalesce((select jsonb_agg(body || jsonb_build_object('id',id,'slug',slug,'published',true) order by id) from public.nal_catalog where kind='programs' and published),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(public.nal_public_product_body(body) || jsonb_build_object('id',id,'slug',slug,'published',true) order by id) from public.nal_catalog where kind='products' and published),'[]'::jsonb),
    'hosts',coalesce((select jsonb_agg(body || jsonb_build_object('id',id,'slug',slug,'published',true) order by id) from public.nal_catalog where kind='hosts' and published),'[]'::jsonb),
    'content',coalesce((select jsonb_agg(body || jsonb_build_object('id',id,'slug',slug,'published',true) order by id) from public.nal_catalog where kind='content' and published),'[]'::jsonb)
  );
$$;
commit;
