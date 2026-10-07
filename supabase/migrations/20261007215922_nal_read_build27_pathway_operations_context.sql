begin;
set local lock_timeout='5s';set local statement_timeout='30s';
-- BUILD27: source layers 17-19 from 3ccdbe665435734e5eb6f40922b49ddf9d8ff54e.
-- PATHWAY + OPERATIONS + CONTEXT. Definitions only; no content, users or transactions seeded.
do $guard$
declare v text;object_name text;signature text;
begin
 perform pg_advisory_xact_lock(hashtextextended('nal-read:integration:build22',22));
 lock table nal_private.read_release_control in share row exclusive mode;
 if current_setting('server_version_num')::integer/10000<>17 then raise exception 'Reviewed PostgreSQL 17 baseline required';end if;
 if (select count(*) from nal_private.read_release_control)<>1 or exists(select 1 from nal_private.read_release_control where mode is distinct from 'off') then raise exception 'READ must remain OFF';end if;
 foreach v in array array['20261007131539','20261007131833','20261007132041','20261007134152','20261007150710','20261007210247','20261007211433'] loop
  if not exists(select 1 from supabase_migrations.schema_migrations where version=v) then raise exception 'Recorded predecessor missing: %',v;end if;
 end loop;
 foreach signature in array array['public.nal_account(uuid,text,jsonb)','public.nal_read_workspace(uuid,text,text,jsonb)','public.nal_get_read_access(uuid,text)','nal_private.read_day_gate(uuid,text,integer)','nal_private.read_verified_subject(uuid)','public.nal_support_admin(uuid,text,jsonb)','nal_private.support_summary(nal_private.support_threads,boolean)','nal_private.read_checkout_view(uuid)','nal_private.read_cohort_inventory(uuid,uuid)'] loop
  if to_regprocedure(signature) is null then raise exception 'Required function missing: %',signature;end if;
 end loop;
 if md5(pg_get_functiondef(to_regprocedure('public.nal_account(uuid,text,jsonb)'))) is distinct from '8dbf08d31a479fe31ae4079bfeb09d30'
  or md5(pg_get_functiondef(to_regprocedure('public.nal_read_workspace(uuid,text,text,jsonb)'))) is distinct from 'fd41e6c3682edb64cf37047fd8a4592c' then raise exception 'Account or workspace changed; reconcile before wrapping';end if;
 foreach object_name in array array['nal_private.read_drafts','nal_private.read_experiments','nal_private.read_live_notes','nal_private.read_editorial_documents','nal_private.read_arrival_guides','nal_private.read_facilitator_plans','nal_private.read_cohorts','nal_private.read_offers','nal_private.support_threads','nal_private.read_checkout_orders'] loop
  if to_regclass(object_name) is null then raise exception 'Required table missing: %',object_name;end if;
 end loop;
 lock table public.nal_read_enrollments,public.nal_orders,nal_private.read_checkout_orders,public.nal_read_answers,nal_private.read_experiments in share row exclusive mode;
 if exists(select 1 from public.nal_read_enrollments) or exists(select 1 from public.nal_orders) or exists(select 1 from nal_private.read_checkout_orders) or exists(select 1 from public.nal_read_answers) or exists(select 1 from nal_private.read_experiments) then raise exception 'Initial integration now has participant data; reconcile before continuing';end if;
 if exists(select 1 from information_schema.columns where table_schema='nal_private' and table_name='read_experiments' and column_name in ('source_answer_id','source_snapshot')) or to_regclass('nal_private.read_experiment_one_source') is not null then raise exception 'Pathway fields already partly installed';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','nal_private') and p.proname in ('read_workspace_before_pathway','read_operations_home','read_operator_context','account_before_operations','account_before_context')) then raise exception 'Final layers already partly installed';end if;
end $guard$;
-- SOURCE LAYER 17: BUILD15_PATHWAY.
alter table nal_private.read_experiments
 add column source_answer_id uuid references public.nal_read_answers(id) on delete set null,
 add column source_snapshot jsonb check(source_snapshot is null or
   (jsonb_typeof(source_snapshot)='object' and octet_length(source_snapshot::text)<=30000));
create unique index read_experiment_one_source
 on nal_private.read_experiments(enrollment_id,source_answer_id) where source_answer_id is not null;
-- Existing manually created experiments remain unlinked. Do not infer a source by text similarity.
-- Existing experiments/report serializers already include these nullable fields with to_jsonb.
alter function public.nal_read_workspace(uuid,text,text,jsonb) set schema nal_private;
alter function nal_private.nal_read_workspace(uuid,text,text,jsonb) rename to read_workspace_before_pathway;
create function public.nal_read_workspace(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare
 access_state jsonb;eid uuid;sid uuid;v_day integer;v_step integer;v_week integer;v_revision integer;v_answer uuid;
 gate record;step_row nal_private.read_day_steps%rowtype;draft_row nal_private.read_drafts%rowtype;
 answer_row public.nal_read_answers%rowtype;experiment_row nal_private.read_experiments%rowtype;
 session_row nal_private.read_live_sessions%rowtype;note_row nal_private.read_live_notes%rowtype;result jsonb;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>30000 then
  raise exception 'Invalid workspace payload' using errcode='22023';end if;
 if p_action not in ('experiment-from-answer','live-join') then
  return nal_private.read_workspace_before_pathway(p_user_id,p_season_slug,p_action,p_payload);
 end if;
 access_state:=public.nal_get_read_access(p_user_id,p_season_slug);
 if coalesce((access_state->>'allowed')::boolean,false) is not true then raise exception 'Read access unavailable' using errcode='42501';end if;
 eid:=(access_state->>'enrollmentId')::uuid;
 select season_id into strict sid from public.nal_read_enrollments where id=eid and user_id=p_user_id;
 if p_action='live-join' then
  -- Serialize the click with note saving; return the resulting note revision.
  select * into session_row from nal_private.read_live_sessions
   where id=(p_payload->>'id')::uuid and season_id=sid and status='published' for share;
  if not found then raise exception 'Live session unavailable' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(eid::text||':live:'||session_row.id::text,6));
  select * into note_row from nal_private.read_live_notes
   where enrollment_id=eid and session_id=session_row.id and user_id=p_user_id for update;
  if p_payload ? 'revision' then
   v_revision:=(p_payload->>'revision')::integer;
   if v_revision is null or v_revision<0 or v_revision<>coalesce(note_row.revision,0) then
    raise exception 'Live note changed in another tab' using errcode='40001';end if;
  end if;
  result:=nal_private.read_workspace_before_pathway(p_user_id,p_season_slug,p_action,p_payload);
  select * into strict note_row from nal_private.read_live_notes
   where enrollment_id=eid and session_id=session_row.id and user_id=p_user_id;
  return result||jsonb_build_object('revision',note_row.revision);
 end if;
 if p_payload-ARRAY['dayNumber','stepOrder','revision','answerId']<>'{}'::jsonb then
  raise exception 'Unexpected source fields' using errcode='22023';end if;
 v_day:=(p_payload->>'dayNumber')::integer;v_step:=(p_payload->>'stepOrder')::integer;
 v_revision:=(p_payload->>'revision')::integer;v_answer:=(p_payload->>'answerId')::uuid;
 if v_day is null or v_day not between 1 and 366 or v_step is null or v_step not between 1 and 100
  or v_revision is null or v_revision<1 or v_answer is null then raise exception 'Saved TRY answer required' using errcode='22023';end if;
 select * into strict gate from nal_private.read_day_gate(p_user_id,p_season_slug,v_day);
 select * into step_row from nal_private.read_day_steps
  where day_id=gate.day_id and step_order=v_step and status='published' and step_type='TRY' for share;
 if not found then raise exception 'Published TRY step required' using errcode='22023';end if;
 if not exists(select 1 from public.nal_read_answers where id=v_answer and user_id=p_user_id
  and enrollment_id=eid and day_id=gate.day_id and step_id=step_row.id) then
  raise exception 'Saved source answer unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(eid::text||':experiment-source:'||v_answer::text,151));
 select * into experiment_row from nal_private.read_experiments
  where enrollment_id=eid and user_id=p_user_id and source_answer_id=v_answer;
 if found then
  -- Re-entry returns the same experiment without restarting or replacing its reflection.
  return jsonb_build_object('saved',true,'created',false,'experiment',to_jsonb(experiment_row)-'user_id'-'enrollment_id');
 end if;
 -- Use the committed draft and saved answer, not browser-supplied source text.
 select * into draft_row from nal_private.read_drafts where enrollment_id=eid and user_id=p_user_id
  and step_id=step_row.id and day_id=gate.day_id for share;
 if not found or not draft_row.committed or draft_row.revision<>v_revision then
  raise exception 'Source draft changed; save it again' using errcode='40001';end if;
 select * into answer_row from public.nal_read_answers where id=v_answer and user_id=p_user_id
  and enrollment_id=eid and step_id=step_row.id and day_id=gate.day_id for share;
 if not found then raise exception 'Saved source unavailable' using errcode='42501';end if;
 if answer_row.answer_text is distinct from draft_row.payload->>'answerText' then
  raise exception 'Saved answer changed in another tab' using errcode='40001';end if;
 if length(btrim(coalesce(answer_row.answer_text,''))) not between 1 and 5000 then
  raise exception 'A written experiment plan is required' using errcode='22023';end if;
 select w.week_number into v_week from nal_private.read_days d
  join nal_private.read_weeks w on w.id=d.week_id and w.season_id=d.season_id
  where d.id=gate.day_id and d.season_id=sid and w.status='published';
 if v_week is null then raise exception 'Source week unavailable' using errcode='22023';end if;
 insert into nal_private.read_experiments(id,user_id,enrollment_id,week_number,title,intention,status,duration_hours,
  source_answer_id,source_snapshot)
 values(gen_random_uuid(),p_user_id,eid,v_week,left(btrim(answer_row.answer_text),200),left(answer_row.answer_text,2000),'planned',72,
  answer_row.id,jsonb_build_object('version',1,'dayNumber',v_day,'stepOrder',v_step,'weekNumber',v_week,
   'prompt',step_row.prompt,'text',answer_row.answer_text,'capturedAt',now())) returning * into experiment_row;
 return jsonb_build_object('saved',true,'created',true,'experiment',to_jsonb(experiment_row)-'user_id'-'enrollment_id');
end $$;
revoke all on function nal_private.read_workspace_before_pathway(uuid,text,text,jsonb),public.nal_read_workspace(uuid,text,text,jsonb)
 from public,anon,authenticated;
grant execute on function nal_private.read_workspace_before_pathway(uuid,text,text,jsonb),public.nal_read_workspace(uuid,text,text,jsonb) to service_role;
-- SOURCE LAYER 18: BUILD17_OPERATIONS.
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
 -- The library returns titles/IDs, not manuscript bodies or participant names.
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
-- SOURCE LAYER 19: BUILD18_CONTEXT.
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