-- BUILD12 SOURCE ONLY: not applied, tested, deployed or opened for customers.
-- Requires recorded FIX03 identity boundary and BUILD06/07/09 context tables.
-- This layer never reads coaching answers or mutates payment/enrollment state.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table nal_private.support_threads (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 category text not null check(category in ('account','read','payment','live','technical','other')),
 subject text not null check(length(btrim(subject)) between 1 and 120),
 season_id uuid references public.nal_read_seasons(id) on delete restrict,
 order_id uuid references public.nal_orders(id) on delete restrict,
 context_snapshot jsonb not null default '{}' check(jsonb_typeof(context_snapshot)='object' and octet_length(context_snapshot::text)<=8000),
 state text not null default 'open' check(state in ('open','answered','resolved')),
 assigned_to uuid references auth.users(id) on delete restrict,
 message_count integer not null default 0 check(message_count between 0 and 1000),
 member_read_seq integer not null default 0 check(member_read_seq between 0 and message_count),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),resolved_at timestamptz
);
create index support_threads_owner on nal_private.support_threads(user_id,updated_at desc,id);
create index support_threads_assignee on nal_private.support_threads(assigned_to,state,updated_at desc,id);
create index support_threads_queue on nal_private.support_threads(state,updated_at desc,id);
create index support_threads_season on nal_private.support_threads(season_id);
create index support_threads_order on nal_private.support_threads(order_id);
create table nal_private.support_messages (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references nal_private.support_threads(id) on delete cascade,
 seq integer not null check(seq>0),author_id uuid not null references auth.users(id) on delete restrict,
 author_kind text not null check(author_kind in ('member','staff')),
 body text not null check(length(btrim(body,E' \t\r\n'||chr(12288)||chr(8203))) between 1 and 4000),
 created_at timestamptz not null default now(),unique(thread_id,seq)
);
create index support_messages_author on nal_private.support_messages(author_id,created_at desc);
-- Fingerprints compare retried commands, not passwords or authorization. Do not duplicate message bodies.
create table nal_private.support_commands (
 actor_id uuid not null references auth.users(id) on delete restrict,request_id uuid not null,
 thread_id uuid not null references nal_private.support_threads(id) on delete cascade,
 action text not null check(action in ('member:create','member:reply','member:resolve','member:reopen','staff:reply','staff:resolve','staff:reopen','staff:assign')),
 fingerprint text not null check(length(fingerprint)=32),created_at timestamptz not null default now(),primary key(actor_id,request_id)
);
create index support_commands_thread on nal_private.support_commands(thread_id,created_at);
alter table nal_private.support_threads enable row level security;
alter table nal_private.support_messages enable row level security;
alter table nal_private.support_commands enable row level security;
revoke all on nal_private.support_threads,nal_private.support_messages,nal_private.support_commands from public,anon,authenticated,service_role;
grant select,insert,update on nal_private.support_threads to service_role;
grant select,insert on nal_private.support_messages,nal_private.support_commands to service_role;

create function nal_private.support_summary(p_thread nal_private.support_threads,p_staff boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p_thread.id,'category',p_thread.category,'subject',p_thread.subject,'state',p_thread.state,
  'revision',p_thread.revision,'createdAt',p_thread.created_at,'updatedAt',p_thread.updated_at,'resolvedAt',p_thread.resolved_at,
  'context',p_thread.context_snapshot,'messageCount',p_thread.message_count,
  'unread',exists(select 1 from nal_private.support_messages m where m.thread_id=p_thread.id and m.author_kind='staff' and m.seq>p_thread.member_read_seq))
 ||case when p_staff then jsonb_build_object('assignedTo',p_thread.assigned_to,
    'displayName',coalesce((select nullif(p.display_name,'') from nal_private.account_preferences p where p.user_id=p_thread.user_id),'참가자'))
   else '{}'::jsonb end
$$;
create function nal_private.support_owned_context(p_user_id uuid,p_season_slug text,p_order_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare s public.nal_read_seasons%rowtype;o public.nal_orders%rowtype;ctx jsonb:='{}';titles text;
begin
 if p_order_id is not null then
  select * into o from public.nal_orders where id=p_order_id and user_id=p_user_id;
  if not found then raise exception 'Context unavailable' using errcode='42501';end if;
  select left(string_agg(i.title_snapshot,' / ' order by i.id),300) into titles from public.nal_order_items i where i.order_id=o.id;
  ctx:=ctx||jsonb_build_object('order',jsonb_build_object('id',o.id,'title',coalesce(titles,'내 주문'),'stateAtCreation',o.status));
 end if;
 if p_season_slug is not null then
  select * into s from public.nal_read_seasons where slug=p_season_slug;
  if not found or not (
   exists(select 1 from public.nal_read_enrollments e where e.user_id=p_user_id and e.season_id=s.id)
   or exists(select 1 from nal_private.read_waitlist w where w.user_id=p_user_id and w.season_id=s.id)
   or exists(select 1 from nal_private.read_checkout_orders q where q.user_id=p_user_id and q.season_id=s.id)
  ) then raise exception 'Context unavailable' using errcode='42501';end if;
  if p_order_id is not null and not (
   exists(select 1 from nal_private.read_checkout_orders q where q.order_id=o.id and q.user_id=p_user_id and q.season_id=s.id)
   or exists(select 1 from public.nal_order_items i where i.order_id=o.id and i.catalog_kind=s.product_kind and i.catalog_id=s.product_id)
  ) then raise exception 'Selected order and season differ' using errcode='22023';end if;
  ctx:=ctx||jsonb_build_object('season',jsonb_build_object('slug',s.slug,'title',s.title,
   'cohortLabel',(select c.label from nal_private.read_cohorts c where c.season_id=s.id)));
 end if;
 return ctx;
end $$;

create function nal_private.support_core(p_user_id uuid,p_staff boolean,p_action text,p_payload jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare role_name text;is_owner boolean:=false;t nal_private.support_threads%rowtype;
 prior nal_private.support_commands%rowtype;v_request uuid;v_thread uuid;v_digest text;v_command text;
 ctx jsonb;items jsonb;msgs jsonb;seasons jsonb;orders jsonb;sid uuid;oid uuid;target uuid;
 v_subject text;v_body text;v_category text;v_slug text;off integer;after_seq integer;last_seq integer;
 expected integer;next_state text;staff_kind text;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_staff is null or p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>22000 then raise exception 'Invalid support request' using errcode='22023';end if;
 if p_staff then
  select a.role into role_name from nal_private.admins a where a.user_id=p_user_id;
  if role_name is null or role_name not in ('owner','operator') then raise exception 'Support staff permission required' using errcode='42501';end if;
  is_owner:=role_name='owner';
  if p_action not in ('list','get','staff','reply','resolve','reopen','assign') then raise exception 'Unknown staff action' using errcode='22023';end if;
 else
  if p_action not in ('contexts','list','get','create','reply','resolve','reopen','read') then raise exception 'Unknown member action' using errcode='22023';end if;
 end if;
 if p_action='contexts' then
  select coalesce(jsonb_agg(x.item order by x.created_at desc),'[]') into seasons from (
   select s.created_at,jsonb_build_object('slug',s.slug,'title',s.title,'label',c.label) as item
   from public.nal_read_seasons s left join nal_private.read_cohorts c on c.season_id=s.id
   where exists(select 1 from public.nal_read_enrollments e where e.user_id=p_user_id and e.season_id=s.id)
    or exists(select 1 from nal_private.read_waitlist w where w.user_id=p_user_id and w.season_id=s.id)
    or exists(select 1 from nal_private.read_checkout_orders q where q.user_id=p_user_id and q.season_id=s.id)
   order by s.created_at desc,s.id limit 100
  ) x;
  select coalesce(jsonb_agg(x.item order by x.created_at desc),'[]') into orders from (
   select o.created_at,jsonb_build_object('id',o.id,'createdAt',o.created_at,'state',o.status,
    'title',coalesce((select left(string_agg(i.title_snapshot,' / ' order by i.id),300) from public.nal_order_items i where i.order_id=o.id),'내 주문')) as item
   from public.nal_orders o where o.user_id=p_user_id order by o.created_at desc,o.id limit 100
  ) x;
  return jsonb_build_object('seasons',seasons,'orders',orders,'limit',100);
 end if;
 if p_action='staff' then
  if not is_owner then raise exception 'Only owner assigns support access' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.user_id,'label',coalesce(nullif(p.display_name,''),'운영자 '||left(a.user_id::text,8)),'role',a.role) order by a.role,a.user_id),'[]')
   into items from nal_private.admins a left join nal_private.account_preferences p on p.user_id=a.user_id where a.role in ('owner','operator');
  return jsonb_build_object('staff',items);
 end if;
 if p_action='list' then
  off:=coalesce((p_payload->>'offset')::integer,0);
  if off<0 or off>10000 or coalesce(p_payload->>'state','all') not in ('all','open','answered','resolved')
   or coalesce(p_payload->>'category','all') not in ('all','account','read','payment','live','technical','other') then raise exception 'Invalid support filter' using errcode='22023';end if;
  select coalesce(jsonb_agg(nal_private.support_summary(x.item,p_staff) order by x.updated_at desc,x.id),'[]') into items from (
   select th as item,th.updated_at,th.id from nal_private.support_threads th where
    ((not p_staff and th.user_id=p_user_id) or (p_staff and (is_owner or th.assigned_to=p_user_id)))
    and (coalesce(p_payload->>'state','all')='all' or th.state=p_payload->>'state')
    and (coalesce(p_payload->>'category','all')='all' or th.category=p_payload->>'category')
   order by th.updated_at desc,th.id limit 51 offset off
  ) x;
  return jsonb_build_object('threads',items,'role',case when p_staff then role_name else 'member' end,'offset',off);
 end if;
 if p_action in ('create','reply','resolve','reopen','assign') then
  v_request:=(p_payload->>'requestId')::uuid;
  if v_request is null then raise exception 'Request identity required' using errcode='22023';end if;
  v_command:=(case when p_staff then 'staff:' else 'member:' end)||p_action;
  v_digest:=md5(jsonb_build_object('command',v_command,'payload',p_payload-'requestId')::text);
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':support-request:'||v_request::text,121));
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':support-writes',122));
  select * into prior from nal_private.support_commands c where c.actor_id=p_user_id and c.request_id=v_request;
  if found then
   if prior.action<>v_command or prior.fingerprint<>v_digest then raise exception 'Request id already used with different content' using errcode='23505';end if;
   select * into t from nal_private.support_threads where id=prior.thread_id;
   if coalesce((not p_staff and t.user_id=p_user_id) or (p_staff and (is_owner or t.assigned_to=p_user_id)),false) is not true then
    raise exception 'Inquiry unavailable' using errcode='42501';end if;
   return jsonb_build_object('saved',true,'replayed',true,'thread',nal_private.support_summary(t,p_staff));
  end if;
 end if;
 if p_action='create' then
  v_subject:=btrim(p_payload->>'subject');v_body:=btrim(p_payload->>'body',E' \t\r\n'||chr(12288)||chr(8203));v_category:=p_payload->>'category';
  v_slug:=nullif(p_payload->>'seasonSlug','');oid:=nullif(p_payload->>'orderId','')::uuid;
  if v_subject is null or length(v_subject) not between 1 and 120 or v_body is null or length(v_body) not between 1 and 4000
   or v_category is null or v_category not in ('account','read','payment','live','technical','other')
   or p_payload->'shareConfirmed' is distinct from 'true'::jsonb then raise exception 'Confirm inquiry contents before sending' using errcode='22023';end if;
  if (select count(*) from nal_private.support_threads where user_id=p_user_id and state<>'resolved')>=10
   or (select count(*) from nal_private.support_threads where user_id=p_user_id and created_at>now()-interval '1 minute')>=3 then raise exception 'Support submission limit reached' using errcode='P0120';end if;
  ctx:=nal_private.support_owned_context(p_user_id,v_slug,oid);
  if v_slug is not null then select id into strict sid from public.nal_read_seasons where slug=v_slug;end if;
  insert into nal_private.support_threads(user_id,category,subject,season_id,order_id,context_snapshot,message_count,member_read_seq)
   values(p_user_id,v_category,v_subject,sid,oid,ctx,1,1) returning * into t;
  insert into nal_private.support_messages(thread_id,seq,author_id,author_kind,body) values(t.id,1,p_user_id,'member',v_body);
  insert into nal_private.support_commands(actor_id,request_id,thread_id,action,fingerprint) values(p_user_id,v_request,t.id,v_command,v_digest);
  return jsonb_build_object('saved',true,'thread',nal_private.support_summary(t,false));
 end if;
 v_thread:=(p_payload->>'id')::uuid;
 select * into t from nal_private.support_threads th where th.id=v_thread and
  ((not p_staff and th.user_id=p_user_id) or (p_staff and (is_owner or th.assigned_to=p_user_id))) for update;
 if not found then raise exception 'Inquiry unavailable' using errcode='42501';end if;
 if p_action='get' then
  after_seq:=coalesce((p_payload->>'afterSeq')::integer,0);
  if after_seq<0 or after_seq>t.message_count then raise exception 'Invalid message page' using errcode='22023';end if;
  select coalesce(jsonb_agg(jsonb_build_object('seq',m.seq,'author',m.author_kind,'body',m.body,'createdAt',m.created_at) order by m.seq),'[]'),coalesce(max(m.seq),after_seq)
   into msgs,last_seq from (select sm.* from nal_private.support_messages sm where sm.thread_id=t.id and sm.seq>after_seq order by sm.seq limit 50) m;
  return jsonb_build_object('thread',nal_private.support_summary(t,p_staff),'messages',msgs,'lastSeq',last_seq,'hasMore',last_seq<t.message_count,'role',case when p_staff then role_name else 'member' end);
 end if;
 if p_action='read' then
  after_seq:=(p_payload->>'throughSeq')::integer;
  if after_seq is null or after_seq<0 or after_seq>t.message_count then raise exception 'Invalid read receipt' using errcode='22023';end if;
  update nal_private.support_threads set member_read_seq=greatest(member_read_seq,after_seq) where id=t.id;
  return jsonb_build_object('saved',true);
 end if;
 expected:=(p_payload->>'revision')::integer;
 if expected is null or expected<>t.revision then raise exception 'Inquiry changed; reload latest conversation' using errcode='40001';end if;
 if p_action='reply' then
  v_body:=btrim(p_payload->>'body',E' \t\r\n'||chr(12288)||chr(8203));
  if v_body is null or length(v_body) not between 1 and 4000 or p_payload->'shareConfirmed' is distinct from 'true'::jsonb then raise exception 'Confirm the reply text' using errcode='22023';end if;
  if t.state='resolved' then raise exception 'Reopen the inquiry before adding a reply' using errcode='22023';end if;
  if t.message_count>=1000 or (select count(*) from nal_private.support_messages where author_id=p_user_id and created_at>now()-interval '1 minute')>=10 then raise exception 'Support submission limit reached' using errcode='P0120';end if;
  staff_kind:=case when p_staff then 'staff' else 'member' end;
  insert into nal_private.support_messages(thread_id,seq,author_id,author_kind,body) values(t.id,t.message_count+1,p_user_id,staff_kind,v_body);
  update nal_private.support_threads set message_count=message_count+1,member_read_seq=case when not p_staff then message_count+1 else member_read_seq end,
   state=case when p_staff then 'answered' else 'open' end,revision=revision+1,updated_at=now(),resolved_at=null where id=t.id returning * into t;
 elsif p_action in ('resolve','reopen') then
  if p_payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Explicit state change required' using errcode='22023';end if;
  if (p_action='reopen' and t.state<>'resolved') or (p_action='resolve' and t.state='resolved') then raise exception 'Inquiry state already changed' using errcode='40001';end if;
  next_state:=case when p_action='resolve' then 'resolved' else 'open' end;
  update nal_private.support_threads set state=next_state,revision=revision+1,updated_at=now(),resolved_at=case when next_state='resolved' then now() else null end where id=t.id returning * into t;
 elsif p_action='assign' then
  if not is_owner or p_payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Owner must confirm assignment' using errcode='42501';end if;
  target:=nullif(p_payload->>'assignedTo','')::uuid;
  if target is not null and not exists(select 1 from nal_private.admins where user_id=target and role in ('owner','operator')) then raise exception 'Support assignee unavailable' using errcode='22023';end if;
  update nal_private.support_threads set assigned_to=target,revision=revision+1,updated_at=now() where id=t.id returning * into t;
 else raise exception 'Unknown support mutation' using errcode='22023';end if;
 insert into nal_private.support_commands(actor_id,request_id,thread_id,action,fingerprint) values(p_user_id,v_request,t.id,v_command,v_digest);
 return jsonb_build_object('saved',true,'thread',nal_private.support_summary(t,p_staff));
end $$;
create function public.nal_support_user(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language sql volatile security invoker set search_path='' as $$ select nal_private.support_core(p_user_id,false,p_action,p_payload) $$;
create function public.nal_support_admin(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language sql volatile security invoker set search_path='' as $$ select nal_private.support_core(p_user_id,true,p_action,p_payload) $$;
revoke all on function nal_private.support_summary(nal_private.support_threads,boolean),nal_private.support_owned_context(uuid,text,uuid),nal_private.support_core(uuid,boolean,text,jsonb),public.nal_support_user(uuid,text,jsonb),public.nal_support_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.support_summary(nal_private.support_threads,boolean),nal_private.support_owned_context(uuid,text,uuid),nal_private.support_core(uuid,boolean,text,jsonb),public.nal_support_user(uuid,text,jsonb),public.nal_support_admin(uuid,text,jsonb) to service_role;
commit;
