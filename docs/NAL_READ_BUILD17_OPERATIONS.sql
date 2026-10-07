-- BUILD17 source only. UNAPPLIED. No tables, grants to browser roles or hosted records created.
-- Load after the complete recorded FIX03 + BUILD04-16 source chain, including BUILD14_HOME.
-- Read-only metadata for the existing owner/operator roles; not a release-health check.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create function nal_private.read_operations_home(p_user_id uuid,p_payload jsonb)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 role_name text;flags jsonb;q jsonb;k text;sid uuid;slug text;term text;off integer;total integer;
 result jsonb;section jsonb;items jsonb;detail jsonb;weeks jsonb;missing jsonb;published integer;
 approved integer;revision integer;pub_revision integer;doc_state text;stamp timestamptz;
 r record;inv jsonb;
begin
 if not nal_private.read_verified_subject(p_user_id) then
  raise exception 'Verified identity required' using errcode='42501';end if;
 select a.role into role_name from nal_private.admins a where a.user_id=p_user_id;
 if role_name is null or role_name not in ('owner','operator') then
  raise exception 'Existing operator permission required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>3000
  or p_payload-ARRAY['query','runtime']<>'{}'::jsonb then raise exception 'Invalid operations request' using errcode='22023';end if;
 flags:=p_payload->'runtime';q:=p_payload->'query';
 if jsonb_typeof(flags) is distinct from 'object' or jsonb_typeof(q) is distinct from 'object' then
  raise exception 'Server feature context required' using errcode='22023';end if;
 if flags-ARRAY['editorial','companion','cohorts','support','payments']<>'{}'::jsonb
  or q-ARRAY['seasonSlug','search','offset']<>'{}'::jsonb then raise exception 'Unexpected operations fields' using errcode='22023';end if;
 foreach k in array array['editorial','companion','cohorts','support','payments'] loop
  if jsonb_typeof(flags->k) is distinct from 'boolean' then raise exception 'Invalid server feature flag' using errcode='22023';end if;
 end loop;
 if (q ? 'seasonSlug' and jsonb_typeof(q->'seasonSlug') not in ('string','null'))
  or (q ? 'search' and jsonb_typeof(q->'search') is distinct from 'string')
  or (q ? 'offset' and jsonb_typeof(q->'offset') is distinct from 'number') then raise exception 'Invalid operations filter' using errcode='22023';end if;
 slug:=nullif(q->>'seasonSlug','');term:=btrim(coalesce(q->>'search',''));off:=coalesce((q->>'offset')::integer,0);
 if (slug is not null and slug!~'^[a-z0-9-]{1,120}$') or length(term)>120 or off not between 0 and 10000
  or (q ? 'offset' and (q->>'offset')::numeric<>off) then raise exception 'Invalid operations filter' using errcode='22023';end if;
 result:=jsonb_build_object('version',17,'role',role_name,'serverTime',now(),'refreshMode','explicit',
  'selected',null,'runtime',flags,'content',jsonb_build_object('state','not_selected'),
  'guide',jsonb_build_object('state','not_selected'),'plans',jsonb_build_object('state','not_selected'),
  'cohort',jsonb_build_object('state','not_selected'),'orders',jsonb_build_object('state','not_selected'));

 -- The library returns titles/IDs only, never manuscript bodies or participant names.
 begin
  select count(*)::integer into total from public.nal_read_seasons s
   where term='' or strpos(lower(s.title||' '||s.slug),lower(term))>0;
  select coalesce(jsonb_agg(jsonb_build_object('slug',x.slug,'title',x.title,'contentState',x.status)
   order by x.created_at desc,x.id),'[]') into items from (
   select s.id,s.slug,s.title,s.status,s.created_at from public.nal_read_seasons s
    where term='' or strpos(lower(s.title||' '||s.slug),lower(term))>0
    order by s.created_at desc,s.id limit 51 offset off) x;
  result:=result||jsonb_build_object('library',jsonb_build_object('state','ready','items',items,'total',total,'offset',off,'pageSize',50));
  if slug is not null then
   select s.id,jsonb_build_object('slug',s.slug,'title',s.title,'contentState',s.status) into sid,detail
    from public.nal_read_seasons s where s.slug=slug;
   if sid is null then raise exception 'Selected season unavailable' using errcode='22023';end if;
   result:=result||jsonb_build_object('selected',detail);
  end if;
 exception when undefined_table or undefined_column or insufficient_privilege then
  result:=result||jsonb_build_object('library',jsonb_build_object('state','unavailable'));
  -- A requested scope cannot silently fall back to all-season support/orders.
  if slug is not null then return result||jsonb_build_object('support',jsonb_build_object('state','unavailable'));end if;
 end;

 if sid is not null then
  section:=jsonb_build_object('state','disabled');
  if flags->'editorial'='true'::jsonb then
   begin
    select d.revision,d.approved_revision,d.published_revision,d.state,d.updated_at
     into revision,approved,pub_revision,doc_state,stamp from nal_private.read_editorial_documents d where d.season_id=sid;
    select count(*)::integer into published from nal_private.read_days d
     where d.season_id=sid and d.day_number between 1 and 28 and d.status='published';
    select coalesce(jsonb_agg(n order by n),'[]') into missing from generate_series(1,28) n
     where not exists(select 1 from nal_private.read_days d where d.season_id=sid and d.day_number=n and d.status='published');
    section:=jsonb_build_object('state','ready','documentExists',revision is not null,'revision',revision,
     'approvedRevision',approved,'publishedRevision',pub_revision,'editorialState',doc_state,'updatedAt',stamp,
     'publishedDays',published,'expectedDays',28,'missingDays',missing,
     'beforePublished',exists(select 1 from nal_private.read_days d where d.season_id=sid and d.day_number=0 and d.status='published'));
   exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
    section:=jsonb_build_object('state','unavailable');
   end;
  end if;
  result:=result||jsonb_build_object('content',section);

  section:=jsonb_build_object('state','disabled');
  if flags->'companion'='true'::jsonb then
   begin
    select g.revision,g.published_revision,g.updated_at into revision,pub_revision,stamp
     from nal_private.read_arrival_guides g where g.season_id=sid;
    section:=jsonb_build_object('state','ready','exists',revision is not null,'revision',revision,
     'publishedRevision',pub_revision,'hasUnpublishedChanges',revision is not null and revision is distinct from pub_revision,'updatedAt',stamp);
   exception when undefined_table or undefined_column or insufficient_privilege then
    section:=jsonb_build_object('state','unavailable');
   end;
  end if;
  result:=result||jsonb_build_object('guide',section);

  section:=jsonb_build_object('state','disabled');
  if flags->'companion'='true'::jsonb then
   begin
    -- Plan/source text stays on the authorized editor. Only lengths and matching LIVE metadata here.
    select coalesce(jsonb_agg(jsonb_build_object('weekNumber',w.n,'exists',p.season_id is not null,
      'planState',p.state,'revision',p.revision,'updatedAt',p.updated_at,
      'agendaMinutes',(select sum((part->>'minutes')::integer) from jsonb_array_elements(p.source->'agenda') part),
      'sessionId',p.session_id,'selectedSessionState',chosen.status,'selectedStartsAt',chosen.starts_at,
      'selectedEndsAt',chosen.ends_at,'selectedMatchesWeek',p.session_id is null or (chosen.season_id=sid and chosen.week_number=w.n),
      'sessions',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'state',l.status,'startsAt',l.starts_at,'endsAt',l.ends_at)
       order by l.starts_at,l.id),'[]') from nal_private.read_live_sessions l where l.season_id=sid and l.week_number=w.n)) order by w.n),'[]')
     into weeks from generate_series(1,4) as w(n)
      left join nal_private.read_facilitator_plans p on p.season_id=sid and p.week_number=w.n
      left join nal_private.read_live_sessions chosen on chosen.id=p.session_id and chosen.season_id=sid;
    section:=jsonb_build_object('state','ready','weeks',weeks);
   exception when undefined_table or undefined_column or undefined_function or insufficient_privilege or invalid_text_representation then
    section:=jsonb_build_object('state','unavailable');
   end;
  end if;
  result:=result||jsonb_build_object('plans',section);

  section:=jsonb_build_object('state',case when role_name<>'owner' then 'restricted' else 'disabled' end);
  if role_name='owner' and flags->'cohorts'='true'::jsonb then
   begin
    select c.label,c.course_starts_at,c.course_ends_at,c.capacity,c.state,f.status as offer_state,
     f.starts_at as registration_starts_at,f.ends_at as registration_ends_at
     into r from nal_private.read_cohorts c left join nal_private.read_offers f on f.season_id=c.season_id where c.season_id=sid;
    if not found then section:=jsonb_build_object('state','ready','configured',false);
    else
     inv:=nal_private.read_cohort_inventory(sid);
     section:=jsonb_build_object('state','ready','configured',true,'label',r.label,'startsAt',r.course_starts_at,'endsAt',r.course_ends_at,
      'recruitmentState',r.state,'offerState',r.offer_state,'registrationStartsAt',r.registration_starts_at,'registrationEndsAt',r.registration_ends_at,
      'capacity',r.capacity,'occupied',inv->'occupied','enrolled',inv->'enrolled','waiting',inv->'waiting','offered',inv->'offered');
    end if;
   exception when undefined_table or undefined_column or undefined_function or insufficient_privilege then
    section:=jsonb_build_object('state','unavailable');
   end;
  end if;
  result:=result||jsonb_build_object('cohort',section);

  section:=jsonb_build_object('state',case when role_name<>'owner' then 'restricted' else 'disabled' end);
  if role_name='owner' and flags->'payments'='true'::jsonb then
   begin
    select count(*)::integer into total from nal_private.read_checkout_orders o where o.season_id=sid and
     (o.state='pending' or (o.state in ('paid','partially_refunded','manual_review') and o.fulfillment not in ('ready','refunded')));
    -- No provider request, customer data, payment key, refund execution or delivery retry.
    section:=jsonb_build_object('state','ready','attentionCount',total,'scope','selected_season','source','recorded_order_state');
   exception when undefined_table or undefined_column or insufficient_privilege then
    section:=jsonb_build_object('state','unavailable');
   end;
  end if;
  result:=result||jsonb_build_object('orders',section);
 end if;

 section:=jsonb_build_object('state','disabled');
 if flags->'support'='true'::jsonb then
  begin
   select count(*)::integer into total from nal_private.support_threads t where t.state='open'
    and (role_name='owner' or t.assigned_to=p_user_id) and (sid is null or t.season_id=sid);
   select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'subject',x.subject,'category',x.category,'updatedAt',x.updated_at)
    order by x.updated_at,x.id),'[]') into items from (
    select t.id,t.subject,t.category,t.updated_at from nal_private.support_threads t where t.state='open'
     and (role_name='owner' or t.assigned_to=p_user_id) and (sid is null or t.season_id=sid)
     order by t.updated_at,t.id limit 5) x;
   section:=jsonb_build_object('state','ready','openCount',total,'items',items,'limit',5,
    'scope',case when sid is null then 'all_seasons_and_general' else 'selected_season_only' end,
    'permissionScope',case when role_name='owner' then 'owner_queue' else 'assigned_only' end);
  exception when undefined_table or undefined_column or insufficient_privilege then
   section:=jsonb_build_object('state','unavailable');
  end;
 end if;
 return result||jsonb_build_object('support',section);
end $$;

-- Keep the existing account RPC name and verified caller boundary. No new Auth allowlist entry.
alter function public.nal_account(uuid,text,jsonb) set schema nal_private;
alter function nal_private.nal_account(uuid,text,jsonb) rename to account_before_operations;
create function public.nal_account(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
begin
 if p_action='operator-home' then return nal_private.read_operations_home(p_user_id,p_payload);end if;
 return nal_private.account_before_operations(p_user_id,p_action,p_payload);
end $$;
revoke all on function nal_private.read_operations_home(uuid,jsonb),nal_private.account_before_operations(uuid,text,jsonb),
 public.nal_account(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_operations_home(uuid,jsonb),nal_private.account_before_operations(uuid,text,jsonb),
 public.nal_account(uuid,text,jsonb) to service_role;
commit;
