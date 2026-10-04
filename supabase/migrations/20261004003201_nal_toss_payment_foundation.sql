-- NAL Toss Payments foundation.
-- Provider-neutral order/entitlement tables are reused; this migration only adds
-- idempotent product-order creation and verified payment reconciliation helpers.
begin;

create table nal_private.product_checkout_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id),
  catalog_kind text not null default 'products' check (catalog_kind='products'),
  product_id text not null,
  order_id uuid not null unique references public.nal_orders(id),
  created_at timestamptz not null default now(),
  foreign key(catalog_kind,product_id) references public.nal_catalog(kind,id)
);
create index product_checkout_requests_user
  on nal_private.product_checkout_requests(user_id,created_at desc);
alter table nal_private.product_checkout_requests enable row level security;
revoke all on nal_private.product_checkout_requests from public,anon,authenticated;
grant all on nal_private.product_checkout_requests to service_role;

create function public.nal_create_product_order(
  p_user_id uuid,
  p_product_id text,
  p_request_id uuid
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  c public.nal_catalog%rowtype;
  existing nal_private.product_checkout_requests%rowtype;
  o public.nal_orders%rowtype;
  price integer;
  title text;
begin
  if p_user_id is null or p_request_id is null or p_product_id is null or p_product_id !~ '^[a-z0-9-]+$' then
    raise exception 'Invalid checkout request' using errcode='22023';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then
    raise exception 'Verified login required' using errcode='42501';
  end if;

  select * into existing
    from nal_private.product_checkout_requests
    where request_id=p_request_id;
  if found then
    if existing.user_id<>p_user_id or existing.product_id<>p_product_id then
      raise exception 'Request ID already used' using errcode='23505';
    end if;
    select * into o from public.nal_orders where id=existing.order_id;
    return jsonb_build_object(
      'orderId',o.id::text,
      'amount',o.amount_won,
      'orderName',(select title_snapshot from public.nal_order_items where order_id=o.id order by id limit 1),
      'status',o.status
    );
  end if;

  select * into c
    from public.nal_catalog
    where kind='products' and id=p_product_id
    for update;
  if not found or not c.published
    or c.body->>'deliveryType'<>'digital'
    or c.body->>'stockStatus'<>'available'
    or jsonb_typeof(c.body->'price')<>'number'
    or coalesce((c.body->>'price')::integer,0)<100 then
    raise exception 'Product unavailable' using errcode='22023';
  end if;

  if not exists(
    select 1
    from nal_private.product_files f
    join storage.objects so on so.bucket_id=f.bucket_id and so.name=f.object_path
    join storage.buckets sb on sb.id=f.bucket_id
    where f.product_id=p_product_id and f.active and not sb.public
  ) then
    raise exception 'Product delivery is not ready' using errcode='22023';
  end if;

  price := (c.body->>'price')::integer;
  title := left(coalesce(nullif(c.body->>'title',''),p_product_id),100);

  insert into public.nal_orders(user_id,amount_won,status)
    values(p_user_id,price,'pending') returning * into o;
  insert into public.nal_order_items(order_id,catalog_kind,catalog_id,title_snapshot,quantity,unit_price_won)
    values(o.id,'products',p_product_id,title,1,price);
  insert into nal_private.product_checkout_requests(request_id,user_id,product_id,order_id)
    values(p_request_id,p_user_id,p_product_id,o.id);

  return jsonb_build_object('orderId',o.id::text,'amount',price,'orderName',title,'status','pending');
end $$;
revoke all on function public.nal_create_product_order(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.nal_create_product_order(uuid,text,uuid) to service_role;

create function public.nal_get_product_order(
  p_user_id uuid,
  p_order_id uuid
) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'orderId',o.id::text,
    'userId',o.user_id::text,
    'amount',o.amount_won,
    'status',o.status,
    'productId',i.catalog_id,
    'orderName',i.title_snapshot
  )
  from public.nal_orders o
  join public.nal_order_items i on i.order_id=o.id
  where o.id=p_order_id and o.user_id=p_user_id
    and i.catalog_kind='products'
  order by i.id
  limit 1
$$;
revoke all on function public.nal_get_product_order(uuid,uuid) from public,anon,authenticated;
grant execute on function public.nal_get_product_order(uuid,uuid) to service_role;

create function public.nal_reconcile_toss_payment(
  p_order_id uuid,
  p_payment_key text,
  p_amount_won integer,
  p_toss_status text
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  o public.nal_orders%rowtype;
  i public.nal_order_items%rowtype;
  c public.nal_catalog%rowtype;
  f nal_private.product_files%rowtype;
  payment_status text;
  entitlement_id uuid;
  license text;
  print_ok boolean;
  dl_limit integer;
  normalized text := upper(coalesce(p_toss_status,''));
begin
  if p_order_id is null or p_payment_key is null or length(p_payment_key) not between 1 and 200
    or p_amount_won is null or p_amount_won<0 then
    raise exception 'Invalid payment reconciliation' using errcode='22023';
  end if;

  select * into o from public.nal_orders where id=p_order_id for update;
  if not found or o.amount_won<>p_amount_won then
    raise exception 'Order amount mismatch' using errcode='22023';
  end if;
  select * into i from public.nal_order_items
    where order_id=o.id and catalog_kind='products'
    order by id limit 1;
  if not found then raise exception 'Order item missing' using errcode='22023'; end if;

  if normalized='DONE' then
    select * into c from public.nal_catalog where kind='products' and id=i.catalog_id and published;
    if not found or c.body->>'deliveryType'<>'digital'
      or (c.body->>'price')::integer<>o.amount_won then
      raise exception 'Product snapshot mismatch' using errcode='22023';
    end if;
    select pf.* into f
      from nal_private.product_files pf
      join storage.objects so on so.bucket_id=pf.bucket_id and so.name=pf.object_path
      join storage.buckets sb on sb.id=pf.bucket_id
      where pf.product_id=i.catalog_id and pf.active and not sb.public
      order by pf.created_at desc limit 1;
    if not found then raise exception 'Product delivery unavailable' using errcode='22023'; end if;

    insert into public.nal_payments(order_id,provider,provider_event_id,amount_won,status)
      values(o.id,'toss',p_payment_key,p_amount_won,'paid')
      on conflict(provider,provider_event_id) do update
        set status='paid'
        where public.nal_payments.order_id=excluded.order_id
          and public.nal_payments.amount_won=excluded.amount_won;
    if not exists(select 1 from public.nal_payments where provider='toss' and provider_event_id=p_payment_key
      and order_id=o.id and amount_won=p_amount_won and status='paid') then
      raise exception 'Payment key conflict' using errcode='23505';
    end if;
    update public.nal_orders set status='paid' where id=o.id;

    license := coalesce(nullif(c.body->>'licenseType',''),'personal-use');
    print_ok := coalesce((c.body->>'printingAllowed')::boolean,false);
    dl_limit := case when jsonb_typeof(c.body->'downloadLimit')='number' then (c.body->>'downloadLimit')::integer end;

    insert into public.nal_digital_entitlements(
      user_id,product_id,order_id,order_item_id,file_id,license_type,printing_allowed,download_limit
    ) values(o.user_id,i.catalog_id,o.id,i.id,f.id,license,print_ok,dl_limit)
    on conflict(order_item_id,license_type) do update set
      file_id=excluded.file_id,
      printing_allowed=excluded.printing_allowed,
      download_limit=excluded.download_limit,
      revoked_at=null
    returning id into entitlement_id;

    return jsonb_build_object('status','paid','orderId',o.id::text,'entitlementId',entitlement_id::text);
  end if;

  if normalized in ('CANCELED','PARTIAL_CANCELED') then
    payment_status := case when normalized='CANCELED' then 'refunded' else 'cancelled' end;
    insert into public.nal_payments(order_id,provider,provider_event_id,amount_won,status)
      values(o.id,'toss',p_payment_key,p_amount_won,payment_status)
      on conflict(provider,provider_event_id) do update
        set status=excluded.status
        where public.nal_payments.order_id=excluded.order_id
          and public.nal_payments.amount_won=excluded.amount_won;
    update public.nal_orders
      set status=case when normalized='CANCELED' then 'refunded' else 'refund_requested' end
      where id=o.id;
    update public.nal_digital_entitlements set revoked_at=coalesce(revoked_at,now()) where order_id=o.id;
    return jsonb_build_object('status',case when normalized='CANCELED' then 'refunded' else 'refund_requested' end,'orderId',o.id::text);
  end if;

  if normalized in ('ABORTED','EXPIRED') then
    insert into public.nal_payments(order_id,provider,provider_event_id,amount_won,status)
      values(o.id,'toss',p_payment_key,p_amount_won,'failed')
      on conflict(provider,provider_event_id) do update
        set status='failed'
        where public.nal_payments.order_id=excluded.order_id
          and public.nal_payments.amount_won=excluded.amount_won;
    if o.status='pending' then update public.nal_orders set status='cancelled' where id=o.id; end if;
    return jsonb_build_object('status','failed','orderId',o.id::text);
  end if;

  return jsonb_build_object('status','pending','orderId',o.id::text,'providerStatus',normalized);
end $$;
revoke all on function public.nal_reconcile_toss_payment(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.nal_reconcile_toss_payment(uuid,text,integer,text) to service_role;

commit;
