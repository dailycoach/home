-- BUILD14 SOURCE ONLY. Unapplied; no tables, data, schedules or permissions for users created.
-- Requires the complete BUILD04-13 source chain. READ-only account overview.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

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
   -- Bounded lookup: active cohorts first, then future preparation and archived/restricted entries.
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
       -- Bootstrap is read-only. Do NOT call nal_get_read_day here: that marks a DAY started.
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
   -- Locally recorded state only. No confirm, launch, refresh, retry or external provider lookup.
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

-- Existing action names continue to the exact prior account implementation.
alter function public.nal_account(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_account(uuid,text,jsonb) rename to account_before_home;
create function public.nal_account(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
begin
 if p_action='home' then return nal_private.read_account_home(p_user_id,p_payload);end if;
 return nal_private.account_before_home(p_user_id,p_action,p_payload);
end $$;
revoke all on function nal_private.read_account_home(uuid,jsonb),nal_private.account_before_home(uuid,text,jsonb),public.nal_account(uuid,text,jsonb)
 from public,anon,authenticated;
grant execute on function nal_private.read_account_home(uuid,jsonb),nal_private.account_before_home(uuid,text,jsonb),public.nal_account(uuid,text,jsonb) to service_role;
commit;
