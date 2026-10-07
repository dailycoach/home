begin;
set local lock_timeout='5s';set local statement_timeout='30s';
-- BUILD26: source layers 15-16 from 3ccdbe665435734e5eb6f40922b49ddf9d8ff54e.
-- SUPPORT + HOME. Install definitions only; READ stays OFF. No messages, users or orders created.
do $guard$
declare v text;object_name text;signature text;
begin
 perform pg_advisory_xact_lock(hashtextextended('nal-read:integration:build22',22));
 lock table nal_private.read_release_control in share row exclusive mode;
 if current_setting('server_version_num')::integer/10000<>17 then raise exception 'Reviewed PostgreSQL 17 baseline required';end if;
 if (select count(*) from nal_private.read_release_control)<>1 or exists(select 1 from nal_private.read_release_control where mode is distinct from 'off') then raise exception 'READ must remain OFF';end if;
 foreach v in array array['20261007131539','20261007131833','20261007132041','20261007134152','20261007150710','20261007210247'] loop
  if not exists(select 1 from supabase_migrations.schema_migrations where version=v) then raise exception 'Recorded predecessor missing: %',v;end if;
 end loop;
 foreach signature in array array['public.nal_account(uuid,text,jsonb)','public.nal_read_bootstrap(uuid,text)','public.nal_get_read_access(uuid,text)','public.nal_read_studio(uuid,text,text,jsonb)','nal_private.read_verified_subject(uuid)'] loop
  if to_regprocedure(signature) is null then raise exception 'Required function missing: %',signature;end if;
 end loop;
 if md5(pg_get_functiondef(to_regprocedure('public.nal_account(uuid,text,jsonb)'))) is distinct from 'f800068edae1892627d1fa8fe7a96c3c' then raise exception 'Account definition changed; reconcile before wrapping';end if;
 foreach object_name in array array['nal_private.account_preferences','nal_private.admins','nal_private.read_cohorts','nal_private.read_waitlist','nal_private.read_checkout_orders','nal_private.read_arrival_guides','nal_private.read_live_sessions'] loop
  if to_regclass(object_name) is null then raise exception 'Required table missing: %',object_name;end if;
 end loop;
 lock table public.nal_read_enrollments,public.nal_orders,nal_private.read_checkout_orders in share row exclusive mode;
 if exists(select 1 from public.nal_read_enrollments) or exists(select 1 from public.nal_orders) or exists(select 1 from nal_private.read_checkout_orders) then raise exception 'Initial integration now has participants or orders; reconcile before continuing';end if;
 foreach object_name in array array['support_threads','support_messages','support_commands'] loop
  if to_regclass('nal_private.'||object_name) is not null then raise exception 'Support layer already present: %',object_name;end if;
 end loop;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','nal_private') and p.proname in ('support_summary','support_owned_context','support_core','nal_support_user','nal_support_admin','read_account_home','account_before_home')) then
  raise exception 'Support or home layer already partly installed';end if;
end $guard$;
-- SOURCE LAYER 15: BUILD12_SUPPORT.
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
-- SOURCE LAYER 16: BUILD14_HOME.
create function nal_private.read_account_home(p_user_id uuid,p_runtime jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 result jsonb;profile jsonb;programs jsonb:='[]';lives jsonb:='[]';items jsonb;
 e record;a jsonb;b jsonb;next_day jsonb;item jsonb;part jsonb;
 phase text;next_kind text;display_name text;staff_role text;
 program_total integer:=0;recorded integer;before_done boolean;total integer;pending integer;k text;
begin
 if not nal_private.read_verified_subject(p_user_id) then
  raise exception 'Verified identity required' using errcode='42501';end if;
 if p_runtime is null or jsonb_typeof(p_runtime)<>'object' or
  p_runtime-ARRAY['read','companion','cohorts','support','payments']<>'{}'::jsonb then
  raise exception 'Invalid server feature context' using errcode='22023';end if;
 foreach k in array array['read','companion','cohorts','support','payments'] loop
  if jsonb_typeof(p_runtime->k) is distinct from 'boolean' then
   raise exception 'Server feature context required' using errcode='22023';end if;
 end loop;
 result:=jsonb_build_object('version',14,'serverTime',now(),'refreshMode','explicit',
  'programs',jsonb_build_object('state','disabled'), 'live',jsonb_build_object('state','disabled'),
  'support',jsonb_build_object('state','disabled'),'waitlist',jsonb_build_object('state','disabled'),
  'orders',jsonb_build_object('state','disabled'));
 begin
  select p.display_name into display_name from nal_private.account_preferences p where p.user_id=p_user_id;
  select a.role into staff_role from nal_private.admins a where a.user_id=p_user_id and a.role in ('owner','operator');
  profile:=jsonb_build_object('state','ready','displayName',coalesce(display_name,''),'staffRole',staff_role);
 exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
  profile:=jsonb_build_object('state','unavailable');
 end;
 result:=result||jsonb_build_object('profile',profile);
 if p_runtime->'read'='true'::jsonb then
  begin
   select count(*)::integer into program_total from public.nal_read_enrollments where user_id=p_user_id;
   for e in
    select en.id,en.season_id,en.status,en.created_at,s.slug,s.title,c.label,c.state as cohort_state,
     c.course_starts_at,c.course_ends_at,c.season_id as cohort_id,activity.last_activity
    from public.nal_read_enrollments en join public.nal_read_seasons s on s.id=en.season_id
    left join nal_private.read_cohorts c on c.season_id=s.id
    left join lateral (select max(p.updated_at) as last_activity from public.nal_read_day_progress p
     where p.user_id=p_user_id and p.enrollment_id=en.id) activity on true
    where en.user_id=p_user_id
    order by case when en.status not in ('active','completed') then 5
     when c.state='cancelled' then 4 when now()>=c.course_starts_at and now()<c.course_ends_at then 0
     when now()<c.course_starts_at then 1 when c.season_id is null then 3 else 2 end,
     activity.last_activity desc nulls last,c.course_starts_at asc nulls last,en.created_at desc,en.id
    limit 20
   loop
    phase:=case when e.cohort_id is null then 'unscheduled' when e.cohort_state='cancelled' then 'cancelled'
     when now()<e.course_starts_at then 'prestart' when now()>=e.course_ends_at then 'ended' else 'active' end;
    item:=jsonb_build_object('enrollmentId',e.id,'slug',e.slug,'title',e.title,'label',e.label,
     'status',e.status,'phase',phase,'startsAt',e.course_starts_at,'endsAt',e.course_ends_at,
     'lastActivityAt',e.last_activity,'companionAvailable',p_runtime->'companion'='true'::jsonb);
    begin
     a:=public.nal_get_read_access(p_user_id,e.slug);
     if coalesce((a->>'allowed')::boolean,false) is not true then
      item:=item||jsonb_build_object('state','restricted','allowed',false,'reason',a->>'reason','next',jsonb_build_object('kind','account'));
     else
      b:=null;next_day:=null;recorded:=null;before_done:=null;
      if phase in ('prestart','unscheduled','cancelled') then
       next_kind:=case when p_runtime->'companion'='true'::jsonb then 'prepare' else 'today' end;
      else
       b:=public.nal_read_bootstrap(p_user_id,e.slug);
       select count(*)::integer into recorded from jsonb_array_elements(b->'journey') j
        where (j->>'dayNumber')::integer>0 and j->>'progress'='completed';
       before_done:=exists(select 1 from jsonb_array_elements(b->'journey') j
        where (j->>'dayNumber')::integer=0 and j->>'progress'='completed');
       select j into next_day from jsonb_array_elements(b->'journey') j
        where j->'unlocked'='true'::jsonb and j->>'progress' is distinct from 'completed'
        order by (j->>'dayNumber')::integer limit 1;
       next_kind:=case when phase='ended' then 'archive' when next_day is not null then 'day'
        when jsonb_array_length(b->'journey')>0 and not exists(select 1 from jsonb_array_elements(b->'journey') j
         where j->>'progress' is distinct from 'completed') then 'archive' else 'journey' end;
      end if;
      item:=item||jsonb_build_object('state','ready','allowed',true,'recordedDays',recorded,'beforeCompleted',before_done,
       'next',jsonb_build_object('kind',next_kind,'dayNumber',case when next_kind='day' then next_day->'dayNumber' end,
        'title',case when next_kind='day' then next_day->'title' end,
        'minutes',case when next_kind='day' then next_day->'estimatedMinutes' end));
      if phase not in ('cancelled','unscheduled') then
       select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'slug',e.slug,'programTitle',e.title,'cohortLabel',e.label,
        'weekNumber',l.week_number,'title',l.title,'startsAt',l.starts_at,'endsAt',l.ends_at,
        'stage',case when now()>=l.starts_at then 'in_progress' when now()>=l.starts_at-interval '15 minutes' then 'opening' else 'scheduled' end)
        order by l.starts_at,l.id),'[]') into part
       from nal_private.read_live_sessions l where l.season_id=e.season_id and l.status='published' and l.ends_at>now();
       lives:=lives||part;
      end if;
     end if;
    exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
     item:=item||jsonb_build_object('state','unavailable','allowed',false,'next',jsonb_build_object('kind','account'));
    end;
    programs:=programs||jsonb_build_array(item);
   end loop;
   total:=jsonb_array_length(lives);
   select coalesce(jsonb_agg(x.item order by (x.item->>'startsAt')::timestamptz,x.item->>'id'),'[]') into lives
    from (select j as item from jsonb_array_elements(lives) j order by (j->>'startsAt')::timestamptz,j->>'id' limit 5) x;
   result:=result||jsonb_build_object('programs',jsonb_build_object('state','ready','items',programs,'total',program_total,
     'scope','priority_cohorts','limit',20,'limited',program_total>20),
    'live',jsonb_build_object('state',case when exists(select 1 from jsonb_array_elements(programs) j where j->>'state'='unavailable') then 'partial' else 'ready' end,
     'items',lives,'totalWithinLoadedCohorts',total,'limit',5,'limited',total>5 or program_total>20,'scope','loaded_cohorts'));
  exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
   result:=result||jsonb_build_object('programs',jsonb_build_object('state','unavailable'),'live',jsonb_build_object('state','unavailable'));
  end;
 end if;
 if p_runtime->'support'='true'::jsonb then
  begin
   select count(*)::integer into total from nal_private.support_threads t where t.user_id=p_user_id
    and exists(select 1 from nal_private.support_messages m where m.thread_id=t.id and m.author_kind='staff' and m.seq>t.member_read_seq);
   select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'subject',x.subject,'state',x.state,'updatedAt',x.last_reply) order by x.last_reply desc,x.id),'[]') into items
    from (select t.id,t.subject,t.state,(select max(m.created_at) from nal_private.support_messages m
     where m.thread_id=t.id and m.author_kind='staff' and m.seq>t.member_read_seq) as last_reply
     from nal_private.support_threads t where t.user_id=p_user_id and exists(select 1 from nal_private.support_messages m
      where m.thread_id=t.id and m.author_kind='staff' and m.seq>t.member_read_seq)
     order by last_reply desc,t.id limit 5) x;
   result:=result||jsonb_build_object('support',jsonb_build_object('state','ready','unreadThreads',total,'items',items,'limit',5,'limited',total>5));
  exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
   result:=result||jsonb_build_object('support',jsonb_build_object('state','unavailable'));
  end;
 end if;
 if p_runtime->'cohorts'='true'::jsonb then
  begin
   select count(*)::integer into pending from nal_private.read_waitlist where user_id=p_user_id and state='waiting';
   select count(*)::integer into total from nal_private.read_waitlist where user_id=p_user_id and state='offered' and offer_until>now();
   select coalesce(jsonb_agg(jsonb_build_object('slug',x.slug,'title',x.title,'label',x.label,'offerUntil',x.offer_until) order by x.offer_until,x.slug),'[]') into items
    from (select s.slug,s.title,c.label,w.offer_until from nal_private.read_waitlist w
     join public.nal_read_seasons s on s.id=w.season_id join nal_private.read_cohorts c on c.season_id=s.id
     where w.user_id=p_user_id and w.state='offered' and w.offer_until>now() order by w.offer_until,s.slug limit 5) x;
   result:=result||jsonb_build_object('waitlist',jsonb_build_object('state','ready','waitingCount',pending,'offeredCount',total,'items',items,'limited',total>5));
  exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
   result:=result||jsonb_build_object('waitlist',jsonb_build_object('state','unavailable'));
  end;
 end if;
 if p_runtime->'payments'='true'::jsonb then
  begin
   select count(*)::integer into total from nal_private.read_checkout_orders q where q.user_id=p_user_id and
    (q.state='pending' or (q.state in ('paid','partially_refunded','manual_review') and q.fulfillment not in ('ready','refunded')));
   select coalesce(jsonb_agg(jsonb_build_object('id',x.order_id,'title',x.title,'state',x.state,'fulfillment',x.fulfillment,
     'updatedAt',x.updated_at,'lastCheckedAt',x.last_checked_at) order by x.updated_at desc,x.order_id),'[]') into items
    from (select q.order_id,q.title,q.state,q.fulfillment,q.updated_at,q.last_checked_at from nal_private.read_checkout_orders q
     where q.user_id=p_user_id and (q.state='pending' or (q.state in ('paid','partially_refunded','manual_review') and q.fulfillment not in ('ready','refunded')))
     order by q.updated_at desc,q.order_id limit 3) x;
   result:=result||jsonb_build_object('orders',jsonb_build_object('state','ready','attentionCount',total,'items',items,'limit',3,'limited',total>3));
  exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
   result:=result||jsonb_build_object('orders',jsonb_build_object('state','unavailable'));
  end;
 end if;
 return result;
end $$;
alter function public.nal_account(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_account(uuid,text,jsonb) rename to account_before_home;
create function public.nal_account(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
begin
 if p_action='home' then return nal_private.read_account_home(p_user_id,p_payload);end if;
 return nal_private.account_before_home(p_user_id,p_action,p_payload);
end $$;
revoke all on function nal_private.read_account_home(uuid,jsonb),nal_private.account_before_home(uuid,text,jsonb),public.nal_account(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_account_home(uuid,jsonb),nal_private.account_before_home(uuid,text,jsonb),public.nal_account(uuid,text,jsonb) to service_role;
commit;