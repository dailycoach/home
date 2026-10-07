-- BUILD07 integration source, UNAPPLIED. Load after PAYMENTS and RECONCILIATION.
-- Keep original implementations in private scope; wrappers add consistent lock order and explicit recovery.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
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
  -- Same user/season -> order row order as checkout creation and existing enrollment core.
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
