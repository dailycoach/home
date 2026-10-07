-- BUILD07 IMPLEMENTATION SOURCE ONLY. Not applied or validated for sale.
-- Load after BUILD06_JOIN and BUILD06_ACCOUNT. Existing PDF commerce is not replaced.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
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

-- Called by verified-user Edge only. Service identity comes from the existing FIX03 boundary.
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
  -- Do not sell a second copy while any earlier payment for this cohort is unresolved.
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
  -- A request is not a processed refund. Payment and access are not silently changed.
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
commit;
