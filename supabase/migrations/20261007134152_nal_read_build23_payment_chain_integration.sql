begin;
set local lock_timeout='5s';set local statement_timeout='30s';
-- BUILD23: remaining source layers 6-8 only, based on 3ccdbe665435734e5eb6f40922b49ddf9d8ff54e.
-- PAYMENTS + RECONCILIATION + INTEGRATION. Install definitions; never call a payment/fulfillment action here.
do $guard$
declare v text;obj text;
begin
 perform pg_advisory_xact_lock(hashtextextended('nal-read:integration:build22',22));
 lock table nal_private.read_release_control in share row exclusive mode;
 if current_setting('server_version_num')::integer/10000<>17 then raise exception 'Reviewed PostgreSQL 17 baseline required';end if;
 if (select count(*) from nal_private.read_release_control)<>1 or exists(select 1 from nal_private.read_release_control where mode is distinct from 'off') then raise exception 'READ must remain OFF';end if;
 foreach v in array array['20261007131539','20261007131833','20261007132041'] loop
  if not exists(select 1 from supabase_migrations.schema_migrations where version=v) then raise exception 'BUILD22 predecessor missing: %',v;end if;
 end loop;
 if to_regprocedure('public.nal_account(uuid,text,jsonb)') is null or to_regprocedure('public.nal_read_join(uuid,text,text,jsonb)') is null or to_regprocedure('nal_private.read_verified_subject(uuid)') is null then raise exception 'Account/join/identity prerequisites missing';end if;
 if exists(select 1 from public.nal_read_enrollments) or exists(select 1 from public.nal_orders) then raise exception 'Initial integration scope changed; reconcile actual participation/orders first';end if;
 foreach obj in array array['read_checkout_orders','read_payment_work','read_payment_observations','read_payment_refunds','read_payment_decisions'] loop
  if to_regclass('nal_private.'||obj) is not null then raise exception 'Payment source already partly installed: %',obj;end if;
 end loop;
 if to_regprocedure('public.nal_read_payment_user(uuid,text,jsonb)') is not null or to_regprocedure('public.nal_read_payment_processor(text,jsonb)') is not null or to_regprocedure('nal_private.read_preserve_checkout_offer()') is not null then raise exception 'Payment functions already present; do not replay';end if;
end $guard$;
-- SOURCE LAYER 6: BUILD07_PAYMENTS.
create table nal_private.read_checkout_orders(
 order_id uuid primary key references public.nal_orders(id),
 order_item_id uuid not null unique references public.nal_order_items(id),
 user_id uuid not null references auth.users(id),season_id uuid not null references public.nal_read_seasons(id),
 create_request_id uuid not null unique,provider_order_id text not null unique check(provider_order_id ~ '^nr_[a-f0-9]{32}$'),
 provider_mode text not null check(provider_mode in ('test','live')),merchant_id text not null,
 customer_key uuid not null default gen_random_uuid(),confirm_key uuid not null default gen_random_uuid(),
 payment_key text unique check(length(payment_key) between 1 and 200),
 amount_won integer not null check(amount_won between 100 and 10000000),currency text not null default 'KRW' check(currency='KRW'),
 title text not null,policy_version text not null,notice_snapshot text not null,access_days integer,
 accepted_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',
 confirm_started_at timestamptz,
 state text not null default 'pending' check(state in ('pending','paid','failed','partially_refunded','refunded','manual_review')),
 provider_status text,refunded_won integer not null default 0 check(refunded_won>=0 and refunded_won<=amount_won),
 fulfillment text not null default 'not_paid' check(fulfillment in ('not_paid','pending','ready','blocked','manual_review','refunded')),
 fulfillment_reason text,enrollment_id uuid references public.nal_read_enrollments(id),
 approved_at timestamptz,last_checked_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index read_checkout_owner on nal_private.read_checkout_orders(user_id,season_id,created_at desc);
create index read_checkout_season on nal_private.read_checkout_orders(season_id);
create index read_checkout_enrollment on nal_private.read_checkout_orders(enrollment_id);
create table nal_private.read_payment_work(
 order_id uuid primary key references nal_private.read_checkout_orders(order_id),
 pending boolean not null default true,signal_number bigint not null default 1,
 lease_token uuid,lease_until timestamptz,leased_signal bigint,
 attempts integer not null default 0,last_error text,next_attempt_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table nal_private.read_payment_observations(
 order_id uuid not null references nal_private.read_checkout_orders(order_id),
 observation_key text not null,provider_status text not null,total_won integer not null,refunded_won integer not null,
 observed_at timestamptz not null default now(),primary key(order_id,observation_key)
);
create table nal_private.read_payment_refunds(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,
 order_id uuid not null references nal_private.read_checkout_orders(order_id),user_id uuid not null references auth.users(id),
 reason text not null check(length(btrim(reason)) between 1 and 1000),
 state text not null default 'requested' check(state in ('requested','approved','processing','completed','rejected','withdrawn','manual_review')),
 amount_won integer check(amount_won>0),base_refunded_won integer,
 decision_note text,decided_by uuid references auth.users(id),decided_at timestamptz,
 provider_key uuid not null default gen_random_uuid(),provider_transaction_key text,
 attempted_at timestamptz,completed_at timestamptz,
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index read_refund_one_open on nal_private.read_payment_refunds(order_id) where state in ('requested','approved','processing','manual_review');
create index read_refund_owner on nal_private.read_payment_refunds(user_id,created_at desc);
create index read_refund_decider on nal_private.read_payment_refunds(decided_by);
create table nal_private.read_payment_decisions(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references nal_private.read_checkout_orders(order_id),
 refund_id uuid references nal_private.read_payment_refunds(id),actor_id uuid not null references auth.users(id),
 action text not null,note text not null,created_at timestamptz not null default now()
);
create index read_payment_decisions_order on nal_private.read_payment_decisions(order_id,created_at);
create index read_payment_decisions_actor on nal_private.read_payment_decisions(actor_id);
create index read_payment_decisions_refund on nal_private.read_payment_decisions(refund_id);
do $$ declare t text;begin
 foreach t in array array['read_checkout_orders','read_payment_work','read_payment_observations','read_payment_refunds','read_payment_decisions'] loop
  execute format('alter table nal_private.%I enable row level security',t);
  execute format('revoke all on nal_private.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert,update on nal_private.%I to service_role',t);
 end loop;
end $$;
create function nal_private.read_checkout_view(p_order_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('orderId',q.order_id,'providerOrderId',q.provider_order_id,'seasonSlug',s.slug,
  'title',q.title,'amount',q.amount_won,'currency',q.currency,'state',q.state,'providerStatus',q.provider_status,
  'fulfillment',q.fulfillment,'fulfillmentReason',q.fulfillment_reason,'refundedAmount',q.refunded_won,
  'policyVersion',q.policy_version,'notice',q.notice_snapshot,'accessDays',q.access_days,
  'createdAt',q.created_at,'expiresAt',q.expires_at,'approvedAt',q.approved_at,'lastCheckedAt',q.last_checked_at,
  'canResume',q.state='pending' and q.confirm_started_at is null and q.expires_at>now(),
  'refunds',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'state',r.state,'reason',r.reason,
    'amount',r.amount_won,'decisionNote',r.decision_note,'revision',r.revision,'createdAt',r.created_at,'completedAt',r.completed_at) order by r.created_at desc),'[]')
    from nal_private.read_payment_refunds r where r.order_id=q.order_id),
  'workPending',coalesce(w.pending,false),'workError',w.last_error)
 from nal_private.read_checkout_orders q join public.nal_read_seasons s on s.id=q.season_id
 left join nal_private.read_payment_work w on w.order_id=q.order_id where q.order_id=p_order_id
$$;
revoke all on function nal_private.read_checkout_view(uuid) from public,anon,authenticated;
grant execute on function nal_private.read_checkout_view(uuid) to service_role;
create function public.nal_read_payment_user(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;s public.nal_read_seasons%rowtype;
 f nal_private.read_offers%rowtype;c public.nal_catalog%rowtype;
 o uuid;i uuid;rid uuid;price numeric;list jsonb;r nal_private.read_payment_refunds%rowtype;off integer;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 then raise exception 'Invalid request' using errcode='22023';end if;
 if p_action='list' then
  off:=coalesce((p_payload->>'offset')::integer,0);if off<0 or off>10000 then raise exception 'Invalid page' using errcode='22023';end if;
  select coalesce(jsonb_agg(nal_private.read_checkout_view(x.order_id) order by x.created_at desc,x.order_id),'[]') into list
   from (select order_id,created_at from nal_private.read_checkout_orders where user_id=p_user_id order by created_at desc,order_id limit 51 offset off) x;
  return jsonb_build_object('orders',list);
 end if;
 if p_action='create' then
  rid:=(p_payload->>'requestId')::uuid;
  if rid is null or p_payload->'accepted' is distinct from 'true'::jsonb or p_payload->>'mode' is null
    or p_payload->>'mode' not in ('test','live') or length(coalesce(p_payload->>'merchantId','')) not between 1 and 80 then
   raise exception 'Participation terms required' using errcode='22023';end if;
  select * into s from public.nal_read_seasons where slug=p_payload->>'seasonSlug';
  if not found then raise exception 'Season unavailable' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(rid::text,20));
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||s.slug,1));
  select * into q from nal_private.read_checkout_orders where create_request_id=rid;
  if found then
   if q.user_id<>p_user_id or q.season_id<>s.id or q.provider_mode<>p_payload->>'mode'
    or q.merchant_id<>p_payload->>'merchantId' or q.policy_version<>p_payload->>'policyVersion' then
    raise exception 'Request reused for different purchase' using errcode='23505';end if;
   return nal_private.read_checkout_view(q.order_id);
  end if;
  if coalesce((public.nal_read_release_guard(p_user_id,s.slug)->>'allowed')::boolean,false) is not true then
   raise exception 'READ is not available to this participant' using errcode='42501';end if;
  if exists(select 1 from public.nal_read_enrollments where user_id=p_user_id and season_id=s.id) then
   raise exception 'Existing participation must be resolved before repurchase' using errcode='22023';end if;
  select * into q from nal_private.read_checkout_orders where user_id=p_user_id and season_id=s.id
    and state not in ('failed','refunded') order by created_at desc limit 1 for update;
  if found then return nal_private.read_checkout_view(q.order_id);end if;
  select * into f from nal_private.read_offers where season_id=s.id for share;
  select * into c from public.nal_catalog where kind=f.catalog_kind and id=f.catalog_id for share;
  if f.season_id is null or f.mode<>'paid' or f.status<>'accepting' or not coalesce(c.published,false)
    or s.status<>'open' or f.catalog_id is distinct from s.product_id or f.catalog_kind<>s.product_kind
    or f.starts_at>now() or f.ends_at<=now() or f.policy_version is distinct from p_payload->>'policyVersion'
    or jsonb_typeof(c.body->'price') is distinct from 'number' then raise exception 'Offer changed or unavailable' using errcode='22023';end if;
  price:=(c.body->>'price')::numeric;
  if price<>trunc(price) or price not between 100 and 10000000 or price is distinct from (p_payload->>'expectedAmount')::numeric then
   raise exception 'Price changed; review before buying' using errcode='22023';end if;
  if not exists(select 1 from nal_private.read_days where season_id=s.id and day_number=0 and status='published')
    or not exists(select 1 from nal_private.read_days where season_id=s.id and day_number=1 and status='published') then
   raise exception 'Program delivery is not prepared' using errcode='22023';end if;
  insert into public.nal_orders(user_id,amount_won,status) values(p_user_id,price::integer,'pending') returning id into o;
  insert into public.nal_order_items(order_id,catalog_kind,catalog_id,title_snapshot,quantity,unit_price_won)
    values(o,'products',c.id,left(coalesce(c.body->>'title',s.title),100),1,price::integer) returning id into i;
  insert into nal_private.read_checkout_orders(order_id,order_item_id,user_id,season_id,create_request_id,provider_order_id,
    provider_mode,merchant_id,amount_won,title,policy_version,notice_snapshot,access_days)
   values(o,i,p_user_id,s.id,rid,'nr_'||replace(gen_random_uuid()::text,'-',''),p_payload->>'mode',p_payload->>'merchantId',
    price::integer,left(coalesce(c.body->>'title',s.title),100),f.policy_version,f.participation_notice,f.access_days);
  return nal_private.read_checkout_view(o);
 end if;
 select * into q from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid and user_id=p_user_id for update;
 if not found then raise exception 'Order unavailable' using errcode='42501';end if;
 if p_action='get' then return nal_private.read_checkout_view(q.order_id);end if;
 if p_action='launch' then
  if q.state<>'pending' or q.confirm_started_at is not null or q.expires_at<=now() then raise exception 'Order must be refreshed, not charged again' using errcode='22023';end if;
  select * into s from public.nal_read_seasons where id=q.season_id;
  if coalesce((public.nal_read_release_guard(p_user_id,s.slug)->>'allowed')::boolean,false) is not true then raise exception 'READ unavailable' using errcode='42501';end if;
  return nal_private.read_checkout_view(q.order_id)||jsonb_build_object('customerKey',q.customer_key,'mode',q.provider_mode);
 end if;
 if p_action='queue-confirm' then
  if p_payload->>'providerOrderId' is distinct from q.provider_order_id or (p_payload->>'amount')::integer is distinct from q.amount_won then raise exception 'Order mismatch' using errcode='22023';end if;
  if q.state<>'pending' then return nal_private.read_checkout_view(q.order_id);end if;
  if length(coalesce(p_payload->>'paymentKey','')) not between 1 and 200 then raise exception 'Invalid payment identity' using errcode='22023';end if;
  if q.payment_key is not null and q.payment_key<>p_payload->>'paymentKey' then raise exception 'Payment key conflict' using errcode='23505';end if;
  update nal_private.read_checkout_orders set payment_key=coalesce(payment_key,p_payload->>'paymentKey'),confirm_started_at=coalesce(confirm_started_at,now()),updated_at=now() where order_id=q.order_id;
 end if;
 if p_action in ('queue-confirm','queue-refresh') then
  insert into nal_private.read_payment_work(order_id) values(q.order_id)
   on conflict(order_id) do update set pending=true,signal_number=nal_private.read_payment_work.signal_number+1,updated_at=now();
  return nal_private.read_checkout_view(q.order_id);
 end if;
 if p_action='refund-request' then
  rid:=(p_payload->>'requestId')::uuid;
  if rid is null or length(btrim(coalesce(p_payload->>'reason',''))) not between 1 and 1000 then raise exception 'Reason required' using errcode='22023';end if;
  select * into r from nal_private.read_payment_refunds where request_id=rid;
  if found then
   if r.order_id<>q.order_id or r.user_id<>p_user_id or r.reason<>btrim(p_payload->>'reason') then raise exception 'Request conflict' using errcode='23505';end if;
   return nal_private.read_checkout_view(q.order_id);
  end if;
  if q.state not in ('paid','partially_refunded') or q.refunded_won>=q.amount_won then raise exception 'No refundable payment' using errcode='22023';end if;
  if exists(select 1 from nal_private.read_payment_refunds where order_id=q.order_id and state in ('requested','approved','processing','manual_review')) then return nal_private.read_checkout_view(q.order_id);end if;
  insert into nal_private.read_payment_refunds(request_id,order_id,user_id,reason) values(rid,q.order_id,p_user_id,btrim(p_payload->>'reason'));
  return nal_private.read_checkout_view(q.order_id);
 end if;
 if p_action='refund-withdraw' then
  update nal_private.read_payment_refunds set state='withdrawn',revision=revision+1,updated_at=now()
   where id=(p_payload->>'refundId')::uuid and order_id=q.order_id and user_id=p_user_id and state='requested';
  if not found then raise exception 'Only an unreviewed request can be withdrawn' using errcode='22023';end if;
  return nal_private.read_checkout_view(q.order_id);
 end if;
 raise exception 'Unknown payment action' using errcode='22023';
end $$;
revoke all on function public.nal_read_payment_user(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_payment_user(uuid,text,jsonb) to service_role;
-- SOURCE LAYER 7: BUILD07_RECONCILIATION.
create function nal_private.read_checkout_fulfill(p_order_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;s public.nal_read_seasons%rowtype;
 pe public.nal_product_entitlements%rowtype;e public.nal_read_enrollments%rowtype;
begin
 select * into strict q from nal_private.read_checkout_orders where order_id=p_order_id for update;
 if q.state<>'paid' or q.refunded_won<>0 then return;end if;
 select * into strict s from public.nal_read_seasons where id=q.season_id;
 perform pg_advisory_xact_lock(hashtextextended(q.user_id::text||':'||s.slug,1));
 if not exists(select 1 from public.nal_payments p join public.nal_orders o on o.id=p.order_id
  where p.order_id=q.order_id and p.provider='toss-read' and p.provider_event_id=q.payment_key
   and p.status='paid' and p.amount_won=q.amount_won and o.user_id=q.user_id and o.status='paid') then
  raise exception 'Verified payment ledger required' using errcode='42501';end if;
 if not exists(select 1 from nal_private.read_release_control where singleton and mode='test_only')
  or not exists(select 1 from nal_private.read_test_allowlist where user_id=q.user_id and season_id=s.id
   and revoked_at is null and granted_at<=now() and expires_at>now()) or s.status not in ('open','closed') then
  update nal_private.read_checkout_orders set fulfillment='pending',fulfillment_reason='release_or_scope_pending' where order_id=q.order_id;return;
 end if;
 if not exists(select 1 from public.nal_order_items where id=q.order_item_id and order_id=q.order_id
  and catalog_kind=s.product_kind and catalog_id=s.product_id and quantity=1 and unit_price_won=q.amount_won) then
  update nal_private.read_checkout_orders set fulfillment='manual_review',fulfillment_reason='catalog_binding_changed' where order_id=q.order_id;return;
 end if;
 select * into e from public.nal_read_enrollments where user_id=q.user_id and season_id=s.id for update;
 if found then
  select * into pe from public.nal_product_entitlements where id=e.entitlement_id for share;
  if pe.order_id is distinct from q.order_id or pe.order_item_id is distinct from q.order_item_id then
   update nal_private.read_checkout_orders set fulfillment='manual_review',fulfillment_reason='existing_participation_other_source' where order_id=q.order_id;return;
  end if;
 else
  insert into public.nal_product_entitlements(user_id,resource_type,resource_id,source_type,order_id,order_item_id,expires_at)
   values(q.user_id,'read-season',s.slug,'order',q.order_id,q.order_item_id,
    case when q.access_days is not null then now()+make_interval(days=>q.access_days) end)
   on conflict(order_item_id,resource_type,resource_id) do nothing;
  select * into pe from public.nal_product_entitlements where order_item_id=q.order_item_id and resource_type='read-season' and resource_id=s.slug for share;
  if pe.user_id<>q.user_id or pe.order_id<>q.order_id then raise exception 'Entitlement ownership mismatch' using errcode='42501';end if;
  if pe.status<>'active' or pe.revoked_at is not null or pe.expires_at<=now() then
   update nal_private.read_checkout_orders set fulfillment='blocked',fulfillment_reason='existing_entitlement_inactive' where order_id=q.order_id;return;
  end if;
  insert into public.nal_read_enrollments(user_id,season_id,entitlement_id) values(q.user_id,s.id,pe.id) returning * into e;
 end if;
 if e.status not in ('active','completed') or pe.status<>'active' or pe.revoked_at is not null or pe.expires_at<=now() then
  update nal_private.read_checkout_orders set fulfillment='blocked',fulfillment_reason='existing_participation_inactive' where order_id=q.order_id;return;
 end if;
 insert into nal_private.read_join_receipts(request_id,user_id,season_id,enrollment_id,order_id,source,accepted_policy,notice_snapshot)
  values(q.create_request_id,q.user_id,s.id,e.id,q.order_id,'paid',q.policy_version,q.notice_snapshot) on conflict(request_id) do nothing;
 update nal_private.read_checkout_orders set fulfillment='ready',fulfillment_reason=null,enrollment_id=e.id,updated_at=now() where order_id=q.order_id;
end $$;
revoke all on function nal_private.read_checkout_fulfill(uuid) from public,anon,authenticated;
grant execute on function nal_private.read_checkout_fulfill(uuid) to service_role;
create function public.nal_read_payment_processor(p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;w nal_private.read_payment_work%rowtype;
 r nal_private.read_payment_refunds%rowtype;payment jsonb;token uuid;oid uuid;normalized text;refunded integer;
 ledger_status text;paid boolean;transaction_key text;refund_key text;lease_refund jsonb;unchanged boolean;
begin
 if current_user<>'service_role' or p_payload is null or jsonb_typeof(p_payload)<>'object'
  or octet_length(p_payload::text)>180000 then raise exception 'Invalid processor context' using errcode='42501';end if;
 if p_action='hint' then
  select * into q from nal_private.read_checkout_orders where provider_order_id=p_payload->>'providerOrderId';
  if not found then return jsonb_build_object('ignored',true);end if;
  insert into nal_private.read_payment_work(order_id) values(q.order_id)
   on conflict(order_id) do update set pending=true,signal_number=nal_private.read_payment_work.signal_number+1,updated_at=now();
  return jsonb_build_object('orderId',q.order_id);
 end if;
 oid:=(p_payload->>'orderId')::uuid;
 select * into q from nal_private.read_checkout_orders where order_id=oid for update;
 if not found then raise exception 'Unknown READ order' using errcode='22023';end if;
 if p_action='lease' then
  insert into nal_private.read_payment_work(order_id) values(oid) on conflict do nothing;
  select * into w from nal_private.read_payment_work where order_id=oid for update;
  if w.lease_until>now() or w.next_attempt_at>now() then return jsonb_build_object('busy',true);end if;
  token:=gen_random_uuid();
  update nal_private.read_payment_work set lease_token=token,lease_until=now()+interval '90 seconds',
   leased_signal=signal_number,pending=true,attempts=attempts+1,updated_at=now() where order_id=oid;
  select * into r from nal_private.read_payment_refunds where order_id=oid and state='processing' order by created_at limit 1;
  if r.id is not null then
   if r.attempted_at<now()-interval '14 days' then
    update nal_private.read_payment_refunds set state='manual_review',decision_note=coalesce(decision_note,'')||E'\nIdempotency window requires manual reconciliation.',updated_at=now(),revision=revision+1 where id=r.id;
   else lease_refund:=jsonb_build_object('id',r.id,'amount',r.amount_won,'baseRefunded',r.base_refunded_won,
     'key',r.provider_key,'reason',left(r.decision_note,180),'attemptedAt',r.attempted_at);end if;
  end if;
  return jsonb_build_object('lease',token,'orderId',q.order_id,'providerOrderId',q.provider_order_id,'paymentKey',q.payment_key,
   'amount',q.amount_won,'currency',q.currency,'merchantId',q.merchant_id,'mode',q.provider_mode,
   'confirmKey',q.confirm_key,'confirmStartedAt',q.confirm_started_at,'state',q.state,'refund',lease_refund);
 end if;
 select * into w from nal_private.read_payment_work where order_id=oid for update;
 token:=(p_payload->>'lease')::uuid;
 if token is null or w.lease_token is distinct from token or w.lease_until<=now() then raise exception 'Stale worker lease' using errcode='40001';end if;
 if p_action='fail' then
  update nal_private.read_payment_work set lease_token=null,lease_until=null,pending=true,
   last_error=left(coalesce(p_payload->>'code','TEMPORARY_FAILURE'),80),next_attempt_at=now()+interval '15 seconds',updated_at=now() where order_id=oid;
  return jsonb_build_object('pending',true);
 end if;
 if p_action='no-payment' then
  if q.state='pending' and q.confirm_started_at is null and q.expires_at<now() then
   update nal_private.read_checkout_orders set state='failed',provider_status='NOT_FOUND_EXPIRED',updated_at=now() where order_id=oid;
   update public.nal_orders set status='cancelled' where id=oid and status='pending';
  end if;
  update nal_private.read_payment_work set lease_token=null,lease_until=null,pending=true,
   last_error='PAYMENT_NOT_YET_FOUND',next_attempt_at=now()+interval '30 seconds',updated_at=now() where order_id=oid;
  return jsonb_build_object('pending',true);
 end if;
 if p_action<>'apply' then raise exception 'Unknown processor action' using errcode='22023';end if;
 payment:=p_payload->'payment';normalized:=payment->>'status';
 if jsonb_typeof(payment)<>'object' or payment->>'orderId' is distinct from q.provider_order_id
  or payment->>'mId' is distinct from q.merchant_id or payment->>'currency' is distinct from q.currency
  or jsonb_typeof(payment->'totalAmount') is distinct from 'number' or (payment->>'totalAmount')::numeric is distinct from q.amount_won::numeric
  or jsonb_typeof(payment->'balanceAmount') is distinct from 'number'
  or length(coalesce(payment->>'paymentKey','')) not between 1 and 200
  or (q.payment_key is not null and q.payment_key<>payment->>'paymentKey')
  or normalized is null or normalized not in ('READY','IN_PROGRESS','DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED') then
  raise exception 'Verified provider binding mismatch' using errcode='22023';end if;
 if (payment->>'balanceAmount')::numeric<>trunc((payment->>'balanceAmount')::numeric)
  or (payment->>'balanceAmount')::numeric not between 0 and q.amount_won then raise exception 'Invalid payment balance' using errcode='22023';end if;
 paid:=payment->>'approvedAt' is not null;
 refunded:=case when paid then q.amount_won-(payment->>'balanceAmount')::integer else 0 end;
 if normalized='DONE' and (not paid or refunded<>0) then raise exception 'Invalid paid state' using errcode='22023';end if;
 if normalized='PARTIAL_CANCELED' and (not paid or refunded not between 1 and q.amount_won-1) then raise exception 'Invalid partial refund' using errcode='22023';end if;
 if normalized='CANCELED' and paid and refunded<>q.amount_won then raise exception 'Invalid full refund' using errcode='22023';end if;
 transaction_key:=coalesce(payment->>'lastTransactionKey',payment->>'paymentKey');
 insert into nal_private.read_payment_observations(order_id,observation_key,provider_status,total_won,refunded_won)
  values(oid,md5(transaction_key||':'||normalized||':'||refunded::text),normalized,q.amount_won,refunded) on conflict do nothing;
 unchanged:=refunded<q.refunded_won or (q.state in ('paid','partially_refunded','refunded') and normalized in ('READY','IN_PROGRESS','ABORTED','EXPIRED'));
 if not unchanged then
  update nal_private.read_checkout_orders set payment_key=coalesce(payment_key,payment->>'paymentKey'),provider_status=normalized,
   refunded_won=greatest(refunded_won,refunded),approved_at=coalesce(approved_at,(payment->>'approvedAt')::timestamptz),
   state=case when normalized='DONE' then 'paid' when normalized='PARTIAL_CANCELED' then 'partially_refunded'
    when normalized='CANCELED' and paid then 'refunded' when normalized in ('CANCELED','ABORTED','EXPIRED') then 'failed' else state end,
   last_checked_at=now(),updated_at=now() where order_id=oid;
  if normalized in ('DONE','PARTIAL_CANCELED','CANCELED','ABORTED','EXPIRED') then
   ledger_status:=case when normalized='DONE' then 'paid' when normalized='CANCELED' and paid then 'refunded'
    when normalized='PARTIAL_CANCELED' then 'cancelled' else 'failed' end;
   insert into public.nal_payments(order_id,provider,provider_event_id,amount_won,status)
    values(oid,'toss-read',payment->>'paymentKey',q.amount_won,ledger_status)
    on conflict(provider,provider_event_id) do update set status=excluded.status
     where public.nal_payments.order_id=excluded.order_id and public.nal_payments.amount_won=excluded.amount_won;
   if not exists(select 1 from public.nal_payments where order_id=oid and provider='toss-read'
      and provider_event_id=payment->>'paymentKey' and amount_won=q.amount_won and status=ledger_status) then
    raise exception 'Payment identity reused' using errcode='23505';end if;
   update public.nal_orders set status=case when normalized='DONE' then 'paid' when normalized='PARTIAL_CANCELED' then 'refund_requested'
     when normalized='CANCELED' and paid then 'refunded' else 'cancelled' end where id=oid;
  end if;
  if refunded>0 then
   update public.nal_product_entitlements set status=case when refunded=q.amount_won then 'refunded' else 'revoked' end,
    revoked_at=coalesce(revoked_at,now()) where order_id=oid and resource_type='read-season';
   update public.nal_read_enrollments e set status=case when refunded=q.amount_won then 'refunded' else 'paused' end,updated_at=now()
    from public.nal_product_entitlements pe where e.entitlement_id=pe.id and pe.order_id=oid;
   update nal_private.read_checkout_orders set fulfillment=case when refunded=q.amount_won then 'refunded' else 'manual_review' end,
     fulfillment_reason=case when refunded=q.amount_won then 'full_refund_confirmed' else 'partial_refund_access_review' end where order_id=oid;
  elsif normalized='DONE' then
   begin perform nal_private.read_checkout_fulfill(oid);
   exception when others then
    update nal_private.read_checkout_orders set fulfillment='pending',fulfillment_reason='delivery_retry_required' where order_id=oid;
   end;
  end if;
 end if;
 if p_payload->>'refundId' is not null and p_payload->>'refundTransactionKey' is not null then
  select * into r from nal_private.read_payment_refunds where id=(p_payload->>'refundId')::uuid and order_id=oid for update;
  refund_key:=p_payload->>'refundTransactionKey';
  if r.state='processing' and exists(select 1 from jsonb_array_elements(coalesce(payment->'cancels','[]')) x
   where x->>'transactionKey'=refund_key and x->>'cancelStatus'='DONE'
    and (x->>'cancelAmount')::numeric=r.amount_won) then
   update nal_private.read_payment_refunds set state='completed',provider_transaction_key=refund_key,
    completed_at=now(),revision=revision+1,updated_at=now() where id=r.id;
  end if;
 end if;
 update nal_private.read_payment_work set lease_token=null,lease_until=null,
   pending=signal_number>leased_signal or exists(select 1 from nal_private.read_checkout_orders where order_id=oid and fulfillment='pending'),
   last_error=null,next_attempt_at=now()+interval '5 seconds',updated_at=now() where order_id=oid;
 return jsonb_build_object('recorded',true,'ignoredOlderState',unchanged);
end $$;
revoke all on function public.nal_read_payment_processor(text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_payment_processor(text,jsonb) to service_role;
create function public.nal_read_payment_admin(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;r nal_private.read_payment_refunds%rowtype;items jsonb;amount integer;off integer;
begin
 if not nal_private.read_verified_subject(p_user_id) or not exists(select 1 from nal_private.admins where user_id=p_user_id and role='owner') then
  raise exception 'Owner permission required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 then raise exception 'Invalid request' using errcode='22023';end if;
 if p_action='list' then
  off:=coalesce((p_payload->>'offset')::integer,0);if off<0 or off>10000 then raise exception 'Invalid page' using errcode='22023';end if;
  select coalesce(jsonb_agg(nal_private.read_checkout_view(x.order_id) order by x.updated_at desc,x.order_id),'[]') into items from (
   select order_id,updated_at from nal_private.read_checkout_orders where
    coalesce(p_payload->>'filter','all')='all' or
    (p_payload->>'filter'='attention' and (fulfillment in ('pending','blocked','manual_review') or
     exists(select 1 from nal_private.read_payment_refunds r where r.order_id=read_checkout_orders.order_id and r.state in ('requested','approved','processing','manual_review'))))
    order by updated_at desc,order_id limit 51 offset off) x;
  return jsonb_build_object('orders',items);
 end if;
 select * into q from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid for update;
 if not found then raise exception 'Order unavailable' using errcode='22023';end if;
 if p_action='refresh' then
  insert into nal_private.read_payment_work(order_id) values(q.order_id) on conflict(order_id) do update
   set pending=true,signal_number=nal_private.read_payment_work.signal_number+1;
  return jsonb_build_object('orderId',q.order_id);
 end if;
 select * into r from nal_private.read_payment_refunds where id=(p_payload->>'refundId')::uuid and order_id=q.order_id for update;
 if not found or r.revision is distinct from (p_payload->>'revision')::integer then raise exception 'Refund request changed' using errcode='40001';end if;
 if p_action in ('refund-approve','refund-reject') then
  if r.state<>'requested' or p_payload->'confirmed' is distinct from 'true'::jsonb
   or length(btrim(coalesce(p_payload->>'note',''))) not between 1 and 180 then raise exception 'Explicit decision and note required' using errcode='22023';end if;
  if p_action='refund-approve' then
   amount:=(p_payload->>'amount')::integer;
   if amount is null or amount<=0 or amount>q.amount_won-q.refunded_won or q.state not in ('paid','partially_refunded') then raise exception 'Refund amount invalid' using errcode='22023';end if;
   update nal_private.read_payment_refunds set state='approved',amount_won=amount,base_refunded_won=q.refunded_won,
    decision_note=btrim(p_payload->>'note'),decided_by=p_user_id,decided_at=now(),revision=revision+1,updated_at=now() where id=r.id;
  else
   update nal_private.read_payment_refunds set state='rejected',decision_note=btrim(p_payload->>'note'),
    decided_by=p_user_id,decided_at=now(),revision=revision+1,updated_at=now() where id=r.id;
  end if;
 elsif p_action='refund-execute' then
  if p_payload->'confirmed' is distinct from 'true'::jsonb or (p_payload->>'amount')::integer is distinct from r.amount_won
    or r.state not in ('approved','processing') or r.attempted_at<now()-interval '14 days' then raise exception 'Explicit execution confirmation required' using errcode='22023';end if;
  if r.state='approved' and q.refunded_won<>r.base_refunded_won then raise exception 'Payment changed; re-review refund' using errcode='40001';end if;
  update nal_private.read_payment_refunds set state='processing',attempted_at=coalesce(attempted_at,now()),revision=revision+1,updated_at=now() where id=r.id;
  insert into nal_private.read_payment_work(order_id) values(q.order_id) on conflict(order_id) do update
   set pending=true,signal_number=nal_private.read_payment_work.signal_number+1;
 else raise exception 'Unknown decision' using errcode='22023';end if;
 insert into nal_private.read_payment_decisions(order_id,refund_id,actor_id,action,note)
  values(q.order_id,r.id,p_user_id,p_action,coalesce(p_payload->>'note','Previously approved refund execution'));
 return jsonb_build_object('orderId',q.order_id,'saved',true);
end $$;
revoke all on function public.nal_read_payment_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_payment_admin(uuid,text,jsonb) to service_role;
-- SOURCE LAYER 8: BUILD07_INTEGRATION.
alter function public.nal_read_payment_processor(text,jsonb) set schema nal_private;
alter function nal_private.nal_read_payment_processor(text,jsonb) rename to read_payment_processor_core;
revoke all on function nal_private.read_payment_processor_core(text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_payment_processor_core(text,jsonb) to service_role;
create function public.nal_read_payment_processor(p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;slug text;result jsonb;w nal_private.read_payment_work%rowtype;
begin
 if current_user<>'service_role' or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Processor required' using errcode='42501';end if;
 if p_action<>'hint' then
  select * into q from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid;
  if not found then raise exception 'Unknown READ order' using errcode='22023';end if;
  select s.slug into strict slug from public.nal_read_seasons s where s.id=q.season_id;
  perform pg_advisory_xact_lock(hashtextextended(q.user_id::text||':'||slug,1));
 end if;
 if p_action='apply' and p_payload->>'refundReviewId' is not null then
  select * into w from nal_private.read_payment_work where order_id=q.order_id for update;
  if w.lease_token is distinct from (p_payload->>'lease')::uuid or w.lease_until<=now() then raise exception 'Stale lease' using errcode='40001';end if;
  update nal_private.read_payment_refunds set state='manual_review',revision=revision+1,updated_at=now(),
   decision_note=coalesce(decision_note,'')||E'\n외부 취소 또는 이전 요청의 결과 대조가 필요합니다. 추가 취소는 실행하지 않았습니다.'
   where id=(p_payload->>'refundReviewId')::uuid and order_id=q.order_id and state='processing';
 end if;
 result:=nal_private.read_payment_processor_core(p_action,p_payload);
 return result;
end $$;
revoke all on function public.nal_read_payment_processor(text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_payment_processor(text,jsonb) to service_role;
alter function public.nal_read_payment_user(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_read_payment_user(uuid,text,jsonb) rename to read_payment_user_core;
revoke all on function nal_private.read_payment_user_core(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_payment_user_core(uuid,text,jsonb) to service_role;
create function public.nal_read_payment_user(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;
begin
 if p_action<>'queue-confirm-recovery' then return nal_private.read_payment_user_core(p_user_id,p_action,p_payload);end if;
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload->'accepted' is distinct from 'true'::jsonb then
  raise exception 'Explicit approval continuation required' using errcode='22023';end if;
 select * into q from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid and user_id=p_user_id for update;
 if not found then raise exception 'Order unavailable' using errcode='42501';end if;
 if q.state<>'pending' or q.provider_status is distinct from 'IN_PROGRESS' or q.payment_key is null
  or q.expires_at<=now() or q.amount_won is distinct from (p_payload->>'amount')::integer then
  raise exception 'Existing authenticated payment cannot be continued' using errcode='22023';end if;
 update nal_private.read_checkout_orders set confirm_started_at=coalesce(confirm_started_at,now()),updated_at=now() where order_id=q.order_id;
 insert into nal_private.read_payment_work(order_id) values(q.order_id) on conflict(order_id) do update
  set pending=true,signal_number=nal_private.read_payment_work.signal_number+1;
 return nal_private.read_checkout_view(q.order_id);
end $$;
revoke all on function public.nal_read_payment_user(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_payment_user(uuid,text,jsonb) to service_role;
create function nal_private.read_preserve_checkout_offer()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (old.catalog_id is distinct from new.catalog_id or old.catalog_kind is distinct from new.catalog_kind
  or old.mode is distinct from new.mode or old.policy_version is distinct from new.policy_version
  or old.participation_notice is distinct from new.participation_notice or old.access_days is distinct from new.access_days)
  and exists(select 1 from nal_private.read_checkout_orders where season_id=old.season_id and state not in ('failed','refunded')) then
  raise exception 'An existing checkout holds these participant terms; use a new cohort' using errcode='22023';end if;
 return new;
end $$;
revoke all on function nal_private.read_preserve_checkout_offer() from public,anon,authenticated;
create trigger read_checkout_offer_snapshot before update on nal_private.read_offers for each row execute function nal_private.read_preserve_checkout_offer();
commit;