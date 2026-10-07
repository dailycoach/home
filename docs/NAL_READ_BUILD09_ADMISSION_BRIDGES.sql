-- BUILD09 source only. Load after BUILD09_COHORTS and COHORT_ADMIN.
-- Global mutation lock order: cohort -> existing request/user-season -> order/row.
-- Existing Auth, financial verification, prices, consent and non-reactivation rules remain.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';

alter function public.nal_issue_read_enrollment(uuid,text,uuid,uuid) set schema nal_private;
alter function nal_private.nal_issue_read_enrollment(uuid,text,uuid,uuid) rename to read_issue_before_cohorts;
create function public.nal_issue_read_enrollment(p_user_id uuid,p_season_slug text,p_order_id uuid,p_request_id uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare sid uuid;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 select id into sid from public.nal_read_seasons where slug=p_season_slug;perform nal_private.read_cohort_lock(sid);
 if not exists(select 1 from public.nal_read_enrollments where season_id=sid and user_id=p_user_id) then perform nal_private.read_cohort_require_place(sid,p_user_id,true);end if;
 return nal_private.read_issue_before_cohorts(p_user_id,p_season_slug,p_order_id,p_request_id);
end $$;

alter function public.nal_read_join(uuid,text,text,jsonb) set schema nal_private;
alter function nal_private.nal_read_join(uuid,text,text,jsonb) rename to read_join_before_cohorts;
create function public.nal_read_join(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare sid uuid;result jsonb;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 select id into sid from public.nal_read_seasons where slug=p_season_slug;
 if p_action='claim' then
  perform nal_private.read_cohort_lock(sid);
  if not exists(select 1 from public.nal_read_enrollments where season_id=sid and user_id=p_user_id) then perform nal_private.read_cohort_require_place(sid,p_user_id,true);end if;
 end if;
 result:=nal_private.read_join_before_cohorts(p_user_id,p_season_slug,p_action,p_payload);
 if p_action='options' then result:=result||jsonb_build_object('cohort',nal_private.read_cohort_summary(sid,p_user_id));end if;
 return result;
end $$;

alter function public.nal_read_payment_user(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_read_payment_user(uuid,text,jsonb) rename to read_payment_user_before_cohorts;
create function public.nal_read_payment_user(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare sid uuid;result jsonb;uid uuid;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_action<>'list' then
  if p_action='create' then select id into sid from public.nal_read_seasons where slug=p_payload->>'seasonSlug';
  else select season_id,user_id into sid,uid from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid;
   if uid is distinct from p_user_id then raise exception 'Order unavailable' using errcode='42501';end if;
  end if;
  perform nal_private.read_cohort_lock(sid);
 end if;
 if p_action='create' and not exists(select 1 from nal_private.read_checkout_orders where season_id=sid and user_id=p_user_id and state not in ('failed','refunded')) then
  perform nal_private.read_cohort_require_place(sid,p_user_id,false);
 elsif p_action in ('launch','queue-confirm','queue-confirm-recovery') then
  if exists(select 1 from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid and state='pending') then
   -- Already-started, reserved payments may settle after recruitment closes. Opening
   -- a new payment selector must still satisfy the current recruitment window.
   perform nal_private.read_cohort_require_place(sid,p_user_id,p_action<>'launch');
  end if;
 end if;
 result:=nal_private.read_payment_user_before_cohorts(p_user_id,p_action,p_payload);
 if sid is not null then result:=result||jsonb_build_object('cohort',nal_private.read_cohort_summary(sid,p_user_id));end if;
 return result;
end $$;

alter function public.nal_read_payment_processor(text,jsonb) set schema nal_private;
alter function nal_private.nal_read_payment_processor(text,jsonb) rename to read_payment_processor_before_cohorts;
create function public.nal_read_payment_processor(p_action text,p_payload jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare sid uuid;
begin
 if current_user<>'service_role' then raise exception 'Processor context required' using errcode='42501';end if;
 if p_action='hint' then select season_id into sid from nal_private.read_checkout_orders where provider_order_id=p_payload->>'providerOrderId';
 else select season_id into sid from nal_private.read_checkout_orders where order_id=(p_payload->>'orderId')::uuid;end if;
 if sid is not null then perform nal_private.read_cohort_lock(sid);end if;
 return nal_private.read_payment_processor_before_cohorts(p_action,p_payload);
end $$;

alter function nal_private.read_checkout_fulfill(uuid) rename to read_checkout_fulfill_before_cohorts;
create function nal_private.read_checkout_fulfill(p_order_id uuid)
returns void language plpgsql volatile security invoker set search_path='' as $$
declare q nal_private.read_checkout_orders%rowtype;
begin
 select * into strict q from nal_private.read_checkout_orders where order_id=p_order_id;
 perform nal_private.read_cohort_lock(q.season_id);
 if q.state<>'paid' or q.refunded_won<>0 then return;end if;
 if not exists(select 1 from public.nal_read_enrollments where season_id=q.season_id and user_id=q.user_id) then
  begin perform nal_private.read_cohort_require_place(q.season_id,q.user_id,true);
  exception when sqlstate '22023' then
   update nal_private.read_checkout_orders set fulfillment='manual_review',fulfillment_reason='cohort_admission_review',updated_at=now() where order_id=p_order_id;
   return;
  end;
 end if;
 perform nal_private.read_checkout_fulfill_before_cohorts(p_order_id);
end $$;

create function nal_private.read_cohort_checkout_guard()
returns trigger language plpgsql volatile security invoker set search_path='' as $$
begin perform nal_private.read_cohort_require_place(new.season_id,new.user_id,false);return new;end $$;
create trigger nal_read_cohort_checkout before insert on nal_private.read_checkout_orders
 for each row execute function nal_private.read_cohort_checkout_guard();

alter function public.nal_read_offers(text) set schema nal_private;
alter function nal_private.nal_read_offers(text) rename to read_offers_before_cohorts;
create function public.nal_read_offers(p_slug text default null)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare original jsonb;out_items jsonb;
begin
 original:=nal_private.read_offers_before_cohorts(p_slug);
 select coalesce(jsonb_agg(o.value||jsonb_build_object('cohort',nal_private.read_cohort_summary(s.id)) order by o.ordinality),'[]') into out_items
  from jsonb_array_elements(original->'offers') with ordinality o(value,ordinality)
  left join public.nal_read_seasons s on s.slug=o.value->>'seasonSlug';
 return jsonb_build_object('offers',out_items);
end $$;

-- Keep offer editing in the same lock order; it cannot extend registration into
-- a cohort that has already started. It still cannot change price or activate READ.
alter function public.nal_read_offer_admin(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_read_offer_admin(uuid,text,jsonb) rename to read_offer_admin_before_cohorts;
create function public.nal_read_offer_admin(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare sid uuid;course_start timestamptz;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_action='save' then
  select id into sid from public.nal_read_seasons where slug=p_payload->>'seasonSlug';perform nal_private.read_cohort_lock(sid);
  select course_starts_at into course_start from nal_private.read_cohorts where season_id=sid;
  if nullif(p_payload->>'endsAt','')::timestamptz>course_start then raise exception 'Registration must close before the cohort starts' using errcode='22023';end if;
 end if;
 return nal_private.read_offer_admin_before_cohorts(p_user_id,p_action,p_payload);
end $$;

revoke all on function nal_private.read_issue_before_cohorts(uuid,text,uuid,uuid),nal_private.read_join_before_cohorts(uuid,text,text,jsonb),
 nal_private.read_payment_user_before_cohorts(uuid,text,jsonb),nal_private.read_payment_processor_before_cohorts(text,jsonb),
 nal_private.read_checkout_fulfill_before_cohorts(uuid),nal_private.read_offers_before_cohorts(text),nal_private.read_cohort_checkout_guard(),
 nal_private.read_offer_admin_before_cohorts(uuid,text,jsonb),public.nal_read_offer_admin(uuid,text,jsonb),
 public.nal_issue_read_enrollment(uuid,text,uuid,uuid),public.nal_read_join(uuid,text,text,jsonb),public.nal_read_payment_user(uuid,text,jsonb),
 public.nal_read_payment_processor(text,jsonb),nal_private.read_checkout_fulfill(uuid),public.nal_read_offers(text) from public,anon,authenticated;
grant execute on function nal_private.read_issue_before_cohorts(uuid,text,uuid,uuid),nal_private.read_join_before_cohorts(uuid,text,text,jsonb),
 nal_private.read_payment_user_before_cohorts(uuid,text,jsonb),nal_private.read_payment_processor_before_cohorts(text,jsonb),
 nal_private.read_checkout_fulfill_before_cohorts(uuid),nal_private.read_offers_before_cohorts(text),
 nal_private.read_offer_admin_before_cohorts(uuid,text,jsonb),public.nal_read_offer_admin(uuid,text,jsonb),
 public.nal_issue_read_enrollment(uuid,text,uuid,uuid),public.nal_read_join(uuid,text,text,jsonb),public.nal_read_payment_user(uuid,text,jsonb),
 public.nal_read_payment_processor(text,jsonb),nal_private.read_checkout_fulfill(uuid),public.nal_read_offers(text) to service_role;
commit;
