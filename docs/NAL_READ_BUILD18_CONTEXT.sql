-- BUILD18 SOURCE ONLY, UNAPPLIED. Complete prior FIX03/BUILD04-17 chain required.
-- Read-only scoped listing through the existing account endpoint. No new tables or role grants.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create function nal_private.read_operator_context(p_user_id uuid,p_payload jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare role_name text;q jsonb;flags jsonb;kind text;slug text;sid uuid;title text;off integer;
 items jsonb;result jsonb;state_filter text;category_filter text;thread_id uuid;after_seq integer;k text;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 select role into role_name from nal_private.admins where user_id=p_user_id;
 if role_name is null or role_name not in ('owner','operator') then raise exception 'Operator required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload-ARRAY['query','runtime']<>'{}'::jsonb then raise exception 'Invalid scope' using errcode='22023';end if;
 q:=p_payload->'query';flags:=p_payload->'runtime';
 if jsonb_typeof(q) is distinct from 'object' or jsonb_typeof(flags) is distinct from 'object' or octet_length(q::text)>2500
  or q-ARRAY['kind','seasonSlug','offset','state','category','filter','id','afterSeq']<>'{}'::jsonb then raise exception 'Invalid scope query' using errcode='22023';end if;
 foreach k in array array['editorial','companion','cohorts','support','payments'] loop
  if jsonb_typeof(flags->k) is distinct from 'boolean' then raise exception 'Server context required' using errcode='22023';end if;
 end loop;
 kind:=q->>'kind';slug:=q->>'seasonSlug';
 if kind is null or kind not in ('orders','support','support-thread') or slug is null or slug!~'^[a-z0-9-]{1,120}$' then raise exception 'Selected season required' using errcode='22023';end if;
 select s.id,s.title into sid,title from public.nal_read_seasons s where s.slug=slug;
 if sid is null then raise exception 'Selected season unavailable' using errcode='22023';end if;
 off:=coalesce((q->>'offset')::integer,0);
 if off not between 0 and 10000 or (q ? 'offset' and (jsonb_typeof(q->'offset') is distinct from 'number' or (q->>'offset')::numeric<>off)) then raise exception 'Invalid page' using errcode='22023';end if;
 result:=jsonb_build_object('scopeVersion',18,'seasonSlug',slug,'seasonTitle',title,'role',role_name,'offset',off);
 if kind='orders' then
  if role_name<>'owner' then raise exception 'Owner required' using errcode='42501';end if;
  if flags->'payments' is distinct from 'true'::jsonb then raise exception 'Payment view disabled' using errcode='P0018';end if;
  if coalesce(q->>'filter','all')<>'all' then raise exception 'Unsupported order filter' using errcode='22023';end if;
  select coalesce(jsonb_agg(nal_private.read_checkout_view(x.order_id) order by x.created_at desc,x.order_id),'[]') into items
   from (select o.order_id,o.created_at from nal_private.read_checkout_orders o where o.season_id=sid order by o.created_at desc,o.order_id limit 51 offset off) x;
  return result||jsonb_build_object('orders',items);
 end if;
 if flags->'support' is distinct from 'true'::jsonb then raise exception 'Support view disabled' using errcode='P0018';end if;
 if kind='support-thread' then
  thread_id:=(q->>'id')::uuid;after_seq:=coalesce((q->>'afterSeq')::integer,0);
  if thread_id is null or after_seq not between 0 and 1000 then raise exception 'Invalid conversation page' using errcode='22023';end if;
  if not exists(select 1 from nal_private.support_threads t where t.id=thread_id and t.season_id=sid and (role_name='owner' or t.assigned_to=p_user_id)) then raise exception 'Thread unavailable in selected season' using errcode='42501';end if;
  -- Existing get rechecks current assignment. It has no read-receipt/message mutation.
  return public.nal_support_admin(p_user_id,'get',jsonb_build_object('id',thread_id,'afterSeq',after_seq))||result;
 end if;
 state_filter:=coalesce(q->>'state','all');category_filter:=coalesce(q->>'category','all');
 if state_filter not in ('all','open','answered','resolved') or category_filter not in ('all','account','read','payment','live','technical','other') then raise exception 'Invalid support filter' using errcode='22023';end if;
 select coalesce(jsonb_agg(nal_private.support_summary(x.thread,true) order by x.updated_at desc,x.id),'[]') into items from (
  select t as thread,t.updated_at,t.id from nal_private.support_threads t
   where t.season_id=sid and (role_name='owner' or t.assigned_to=p_user_id)
    and (state_filter='all' or t.state=state_filter) and (category_filter='all' or t.category=category_filter)
   order by t.updated_at desc,t.id limit 51 offset off
 ) x;
 return result||jsonb_build_object('threads',items);
end $$;
alter function public.nal_account(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_account(uuid,text,jsonb) rename to account_before_context;
create function public.nal_account(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
begin
 if p_action='operator-context' then return nal_private.read_operator_context(p_user_id,p_payload);end if;
 return nal_private.account_before_context(p_user_id,p_action,p_payload);
end $$;
revoke all on function nal_private.read_operator_context(uuid,jsonb),nal_private.account_before_context(uuid,text,jsonb),public.nal_account(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_operator_context(uuid,jsonb),nal_private.account_before_context(uuid,text,jsonb),public.nal_account(uuid,text,jsonb) to service_role;
commit;
