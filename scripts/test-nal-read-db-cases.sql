\set ON_ERROR_STOP on

insert into auth.users(id,email_confirmed_at)
values ('11111111-1111-4111-8111-111111111111',now());

insert into public.nal_catalog(kind,id,published,body)
values ('products','trend-2027-read',true,'{"title":"NAL READ 01","price":39000}'::jsonb);

insert into public.nal_orders(id,user_id,status,amount_won)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'paid',
  39000
);

insert into public.nal_order_items(
  id,order_id,catalog_kind,catalog_id,title_snapshot,quantity,unit_price_won
) values (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  'products',
  'trend-2027-read',
  'NAL READ 01',
  1,
  39000
);

insert into public.nal_read_seasons(slug,title,product_id,status)
values ('trend-2027','TREND 2027','trend-2027-read','open');

select public.nal_issue_read_enrollment(
  '11111111-1111-4111-8111-111111111111',
  'trend-2027',
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444444'
);

do $$
declare
  result jsonb;
  count_enrollment integer;
  count_entitlement integer;
begin
  result := public.nal_get_read_access(
    '11111111-1111-4111-8111-111111111111',
    'trend-2027'
  );
  if coalesce((result->>'allowed')::boolean,false) is not true then
    raise exception 'expected active access, got %', result;
  end if;

  select count(*) into count_enrollment from public.nal_read_enrollments;
  select count(*) into count_entitlement from public.nal_product_entitlements;
  if count_enrollment <> 1 then raise exception 'expected 1 enrollment'; end if;
  if count_entitlement <> 1 then raise exception 'expected 1 entitlement'; end if;
end $$;

select public.nal_issue_read_enrollment(
  '11111111-1111-4111-8111-111111111111',
  'trend-2027',
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444444'
);

do $$
declare
  count_enrollment integer;
  count_entitlement integer;
begin
  select count(*) into count_enrollment from public.nal_read_enrollments;
  select count(*) into count_entitlement from public.nal_product_entitlements;
  if count_enrollment <> 1 then raise exception 'duplicate enrollment created'; end if;
  if count_entitlement <> 1 then raise exception 'duplicate entitlement created'; end if;
end $$;

update public.nal_orders
set status='refunded'
where id='22222222-2222-4222-8222-222222222222';

do $$
declare
  result jsonb;
begin
  result := public.nal_get_read_access(
    '11111111-1111-4111-8111-111111111111',
    'trend-2027'
  );
  if coalesce((result->>'allowed')::boolean,true) is not false then
    raise exception 'refunded order must block access, got %', result;
  end if;
  if result->>'reason' <> 'order_inactive' then
    raise exception 'unexpected refund reason: %', result;
  end if;
end $$;

update public.nal_orders
set status='paid'
where id='22222222-2222-4222-8222-222222222222';

update public.nal_product_entitlements
set status='revoked', revoked_at=now()
where user_id='11111111-1111-4111-8111-111111111111';

do $$
declare
  result jsonb;
begin
  result := public.nal_get_read_access(
    '11111111-1111-4111-8111-111111111111',
    'trend-2027'
  );
  if coalesce((result->>'allowed')::boolean,true) is not false then
    raise exception 'revoked entitlement must block access';
  end if;
  if result->>'reason' <> 'entitlement_inactive' then
    raise exception 'unexpected revoke reason: %', result;
  end if;
end $$;

select count(*) as audit_rows
from nal_private.audit_log
where table_name in ('nal_read_seasons','nal_product_entitlements','nal_read_enrollments');
