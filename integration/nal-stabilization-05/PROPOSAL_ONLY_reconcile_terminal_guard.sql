-- P5 DESIGN-ONLY / NOT AN APPLIED MIGRATION.
-- DO NOT run on production without approved sales-security review and isolated SQL tests.
-- Deliberately requires session-local approval (not set by this file).
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $nal_p5_preflight$
BEGIN
  IF current_setting('nal.p5_change_approved',true) IS DISTINCT FROM 'approved'
  THEN RAISE EXCEPTION 'P5 paid settlement patch not approved for execution'; END IF;
  IF md5(pg_get_functiondef('public.nal_reconcile_toss_payment(uuid,text,integer,text)'::regprocedure))
     IS DISTINCT FROM '3b6b1771d9fc356bf424456d47a8f6cf'
  THEN RAISE EXCEPTION 'Production payment function changed since P5 audit'; END IF;
  IF EXISTS(SELECT 1 FROM public.nal_orders)
     OR EXISTS(SELECT 1 FROM public.nal_payments)
     OR EXISTS(SELECT 1 FROM public.nal_digital_entitlements)
  THEN RAISE EXCEPTION 'Real paid records require separate non-destructive migration review'; END IF;
  IF EXISTS(SELECT 1 FROM public.nal_settings
     WHERE id='site' AND (body->'features'->>'storePurchase'='true'
                      OR body->'features'->>'checkout'='true'))
  THEN RAISE EXCEPTION 'Storefront checkout must remain OFF during patch'; END IF;
END $nal_p5_preflight$;

CREATE OR REPLACE FUNCTION public.nal_reconcile_toss_payment(p_order_id uuid, p_payment_key text, p_amount_won integer, p_toss_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  -- P5: a provider DONE replay may NEVER undo a refund or any recorded revocation.
  -- Postgres order row is locked above; conflicting provider observations are
  -- rejected for human/protocol review rather than silently re-granting access.
  if normalized='DONE' and (
    o.status in ('refunded','refund_requested','cancelled')
    or exists(select 1 from public.nal_digital_entitlements e
              where e.order_id=o.id and e.revoked_at is not null)
  ) then
    raise exception 'Terminal or revoked order requires settlement review'
      using errcode='40001';
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
end $function$

COMMIT;
