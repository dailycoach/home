-- BUILD07 source only, UNAPPLIED. Load after BUILD07_PAYMENTS.sql.
-- Processor RPCs are service-only. Webhook bodies are hints, not payment authority.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';

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
 -- Delivery may remain pending while READ is OFF; financial truth is still recorded.
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
  -- Refunds are queued only after a separate owner execution authorization.
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
  -- A verified provider 404 is not authority to grant or refund anything.
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
   -- Partial refunds pause delivery for owner review; never silently claim a full refund.
   update public.nal_product_entitlements set status=case when refunded=q.amount_won then 'refunded' else 'revoked' end,
    revoked_at=coalesce(revoked_at,now()) where order_id=oid and resource_type='read-season';
   update public.nal_read_enrollments e set status=case when refunded=q.amount_won then 'refunded' else 'paused' end,updated_at=now()
    from public.nal_product_entitlements pe where e.entitlement_id=pe.id and pe.order_id=oid;
   update nal_private.read_checkout_orders set fulfillment=case when refunded=q.amount_won then 'refunded' else 'manual_review' end,
     fulfillment_reason=case when refunded=q.amount_won then 'full_refund_confirmed' else 'partial_refund_access_review' end where order_id=oid;
  elsif normalized='DONE' then
   -- Isolate fulfillment failure: keep the verified payment durable and retry delivery.
   begin perform nal_private.read_checkout_fulfill(oid);
   exception when others then
    update nal_private.read_checkout_orders set fulfillment='pending',fulfillment_reason='delivery_retry_required' where order_id=oid;
   end;
  end if;
 end if;
 -- A specific refund finishes only when its verified provider transaction is present.
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
commit;
