begin;
set local lock_timeout='5s';set local statement_timeout='30s';
-- BUILD22: layers 2-3 from the BUILD21 assembled source, with READ held OFF.
do $guard$ begin
 perform pg_advisory_xact_lock(hashtextextended('nal-read:integration:build22',22));
 lock table nal_private.read_release_control in share row exclusive mode;
 if (select count(*) from nal_private.read_release_control)<>1 or exists(select 1 from nal_private.read_release_control where mode is distinct from 'off') then raise exception 'READ must remain OFF';end if;
 if to_regprocedure('public.nal_read_workspace(uuid,text,text,jsonb)') is null or exists(select 1 from public.nal_read_enrollments) then raise exception 'Unenrolled workspace baseline required';end if;
 if to_regclass('nal_private.read_editorial_documents') is not null or to_regclass('nal_private.read_report_editions') is not null then raise exception 'Editorial/report already present; reconcile rather than replay';end if;
end $guard$;
alter table nal_private.read_day_steps add column if not exists content_key text;
alter table nal_private.read_day_steps add column if not exists measure_key text;
alter table nal_private.read_day_steps add column if not exists measure_version text;
alter table nal_private.read_day_steps add column if not exists report_key text;
create table nal_private.read_editorial_documents(
 id uuid primary key default gen_random_uuid(),season_id uuid not null unique references public.nal_read_seasons(id) on delete restrict,
 revision integer not null default 1 check(revision>0),state text not null default 'draft' check(state in ('draft','review','approved','published')),
 source jsonb not null check(jsonb_typeof(source)='object' and octet_length(source::text)<=600000),
 approved_revision integer,approved_by uuid references auth.users(id),approved_at timestamptz,published_revision integer,published_at timestamptz,
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
create table nal_private.read_editorial_history(
 id uuid primary key default gen_random_uuid(),document_id uuid not null references nal_private.read_editorial_documents(id) on delete restrict,
 revision integer not null,event text not null,source jsonb not null,actor_id uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index read_editorial_history_document on nal_private.read_editorial_history(document_id,created_at desc);
create index read_editorial_history_actor on nal_private.read_editorial_history(actor_id);
create index read_editorial_documents_actor on nal_private.read_editorial_documents(updated_by);
create index read_editorial_documents_approver on nal_private.read_editorial_documents(approved_by);
alter table nal_private.read_editorial_documents enable row level security;
alter table nal_private.read_editorial_history enable row level security;
revoke all on nal_private.read_editorial_documents,nal_private.read_editorial_history from public,anon,authenticated,service_role;
grant select,insert,update on nal_private.read_editorial_documents to service_role;
grant select,insert on nal_private.read_editorial_history to service_role;
grant select on nal_private.admins to service_role;
grant insert,update on nal_private.read_live_sessions to service_role;
create function nal_private.read_manifest_check(doc jsonb,complete boolean default false)
returns void language plpgsql immutable security invoker set search_path='' as $$
declare day_doc jsonb;step_doc jsonb;week_doc jsonb;n integer;step_keys text[];numbers integer[]:='{}';week_numbers integer[]:='{}';week_slugs text[]:='{}';
begin
 if doc is null or jsonb_typeof(doc)<>'object' or octet_length(doc::text)>550000
  or doc->'schemaVersion' is distinct from '2'::jsonb or doc->'season'->'totalDays' is distinct from '28'::jsonb
  or coalesce(doc->'season'->>'slug','')!~'^[a-z0-9-]{1,120}$' or length(btrim(coalesce(doc->'season'->>'title',''))) not between 1 and 120 then raise exception 'Manifest requires schema 2 and a 28-day season' using errcode='22023';end if;
 if jsonb_typeof(doc->'weeks') is distinct from 'array' or jsonb_typeof(doc->'days') is distinct from 'array' then raise exception 'Weeks and days must be arrays' using errcode='22023';end if;
 if jsonb_array_length(doc->'weeks')<>4 or jsonb_array_length(doc->'days')<>29 then raise exception 'Four weeks and DAY 0-28 required' using errcode='22023';end if;
 for week_doc in select j.value from jsonb_array_elements(doc->'weeks') j loop
  if jsonb_typeof(week_doc->'number') is distinct from 'number' then raise exception 'Invalid week' using errcode='22023';end if;
  n:=(week_doc->>'number')::integer;
  if n not between 1 and 4 or n=any(week_numbers) or coalesce(week_doc->>'slug','')!~'^[a-z0-9-]{1,120}$' or week_doc->>'slug'=any(week_slugs) or length(btrim(coalesce(week_doc->>'title',''))) not between 1 and 120 then raise exception 'Invalid or duplicate week' using errcode='22023';end if;
  week_numbers:=array_append(week_numbers,n);week_slugs:=array_append(week_slugs,week_doc->>'slug');
 end loop;
 for day_doc in select j.value from jsonb_array_elements(doc->'days') j loop
  if jsonb_typeof(day_doc->'number') is distinct from 'number' then raise exception 'Invalid DAY' using errcode='22023';end if;
  n:=(day_doc->>'number')::integer;
  if n not between 0 and 28 or n=any(numbers) or length(btrim(coalesce(day_doc->>'title',''))) not between 1 and 160
   or coalesce(day_doc->>'type','') not in ('before','daily','try','live','final') or coalesce((day_doc->>'minutes')::integer,0) not between 1 and 180
   or (n=0 and day_doc->'week' is distinct from 'null'::jsonb) or (n>0 and not coalesce((day_doc->>'week')::integer=any(week_numbers),false)) then raise exception 'Invalid DAY structure' using errcode='22023';end if;
  if jsonb_typeof(day_doc->'steps') is distinct from 'array' then raise exception 'STEP array required' using errcode='22023';end if;
  if jsonb_array_length(day_doc->'steps') not between 1 and 100 then raise exception 'STEP count outside range' using errcode='22023';end if;
  numbers:=array_append(numbers,n);step_keys:='{}';
  for step_doc in select j.value from jsonb_array_elements(day_doc->'steps') j loop
   if coalesce(step_doc->>'key','')!~'^[a-z0-9-]{1,120}$' or step_doc->>'key'=any(step_keys)
    or coalesce(step_doc->>'type','') not in ('HOOK','IDEA','MIRROR','QUESTION','MULTI_SELECT','SCALE','TRY','RECORD','LIVE')
    or (step_doc ? 'required' and jsonb_typeof(step_doc->'required')<>'boolean') or (step_doc ? 'content' and jsonb_typeof(step_doc->'content')<>'string')
    or (step_doc ? 'prompt' and jsonb_typeof(step_doc->'prompt')<>'string') or length(coalesce(step_doc->>'content',''))>4000 or length(coalesce(step_doc->>'prompt',''))>1000 or length(coalesce(step_doc->>'placeholder',''))>1000 then raise exception 'Invalid STEP structure' using errcode='22023';end if;
   step_keys:=array_append(step_keys,step_doc->>'key');
   if step_doc->>'type' in ('QUESTION','SCALE','MULTI_SELECT','TRY') and length(btrim(coalesce(step_doc->>'prompt','')))=0 then raise exception 'Question prompt missing' using errcode='22023';end if;
   if step_doc->>'type' not in ('QUESTION','SCALE','MULTI_SELECT','TRY') and coalesce((step_doc->>'required')::boolean,false) then raise exception 'Display STEP cannot require an answer' using errcode='22023';end if;
   if step_doc->>'type'='MULTI_SELECT' then
    if jsonb_typeof(step_doc->'options') is distinct from 'array' then raise exception 'Choice array required' using errcode='22023';end if;
    if jsonb_array_length(step_doc->'options') not between 1 and 30 then raise exception 'Choice options missing' using errcode='22023';end if;
    if exists(select 1 from jsonb_array_elements(step_doc->'options') x(choice) where jsonb_typeof(x.choice)<>'string' or length(btrim(x.choice#>>'{}')) not between 1 and 160)
     or (select count(*)<>count(distinct x.value) from jsonb_array_elements(step_doc->'options') x) then raise exception 'Invalid choices' using errcode='22023';end if;
   end if;
   if step_doc ? 'measureKey' and (step_doc->>'type'<>'SCALE' or n not in (0,28) or coalesce(step_doc->>'measureKey','')!~'^[a-z0-9-]{1,120}$' or coalesce(step_doc->>'measureVersion','')!~'^[a-z0-9-]{1,120}$') then raise exception 'Invalid comparison key' using errcode='22023';end if;
   if step_doc ? 'reportKey' and coalesce(step_doc->>'reportKey','')!~'^[a-z0-9-]{1,120}$' then raise exception 'Invalid report key' using errcode='22023';end if;
  end loop;
 end loop;
 if complete and exists(select 1 from jsonb_array_elements(doc->'days') jd(day_json) cross join lateral jsonb_array_elements(jd.day_json->'steps') js(step_json)
  where js.step_json ? 'measureKey' group by js.step_json->>'measureKey',js.step_json->>'measureVersion'
  having count(*)<>2 or count(distinct jd.day_json->>'number')<>2 or count(distinct js.step_json->>'prompt')<>1) then raise exception 'Before/after questions must match exactly' using errcode='22023';end if;
end $$;
revoke all on function nal_private.read_manifest_check(jsonb,boolean) from public,anon,authenticated;
grant execute on function nal_private.read_manifest_check(jsonb,boolean) to service_role;
create function public.nal_read_editorial(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor_role text;season public.nal_read_seasons%rowtype;doc nal_private.read_editorial_documents%rowtype;
 src jsonb;item jsonb;daydoc jsonb;stepdoc jsonb;wid uuid;did uuid;expected integer;i integer;result jsonb;rid uuid;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified editor required' using errcode='42501';end if;
 select a.role into actor_role from nal_private.admins a where a.user_id=p_user_id;
 if actor_role is null or actor_role not in ('owner','operator') then raise exception 'Editor role required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>600000 then raise exception 'Invalid editor request' using errcode='22023';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'title',s.title,'seasonStatus',s.status,'revision',coalesce(d.revision,0),'state',coalesce(d.state,'empty'),'updatedAt',d.updated_at) order by s.created_at desc),'[]') into result
   from public.nal_read_seasons s left join nal_private.read_editorial_documents d on d.season_id=s.id;
  return jsonb_build_object('role',actor_role,'seasons',result);
 end if;
 if coalesce(p_season_slug,'')!~'^[a-z0-9-]{1,120}$' then raise exception 'Invalid season' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('read-editorial:'||p_season_slug,9));
 select * into season from public.nal_read_seasons where slug=p_season_slug for update;
 if p_action='save' then
  src:=p_payload->'source';perform nal_private.read_manifest_check(src,false);
  if src->'season'->>'slug' is distinct from p_season_slug then raise exception 'Season mismatch' using errcode='22023';end if;
  expected:=(p_payload->>'revision')::integer;
  if expected is null or expected<0 then raise exception 'Revision required' using errcode='22023';end if;
  if season.id is null then
   if expected<>0 then raise exception 'Document changed' using errcode='40001';end if;
   insert into public.nal_read_seasons(slug,title,subtitle,status) values(p_season_slug,src->'season'->>'title',src->'season'->>'subtitle','draft') returning * into season;
  end if;
  select * into doc from nal_private.read_editorial_documents where season_id=season.id for update;
  if coalesce(doc.revision,0)<>expected then raise exception 'Document changed' using errcode='40001';end if;
  if doc.id is null then insert into nal_private.read_editorial_documents(season_id,source,updated_by) values(season.id,src,p_user_id) returning * into doc;
  else update nal_private.read_editorial_documents set source=src,revision=revision+1,state='draft',approved_revision=null,approved_by=null,approved_at=null,updated_by=p_user_id,updated_at=now() where id=doc.id returning * into doc;end if;
  insert into nal_private.read_editorial_history(document_id,revision,event,source,actor_id) values(doc.id,doc.revision,'saved',doc.source,p_user_id);
  return jsonb_build_object('revision',doc.revision,'state',doc.state,'source',doc.source);
 end if;
 if season.id is null then raise exception 'Season missing' using errcode='22023';end if;
 select * into doc from nal_private.read_editorial_documents where season_id=season.id for update;
 if p_action='get' then return jsonb_build_object('role',actor_role,'revision',coalesce(doc.revision,0),'state',coalesce(doc.state,'empty'),'source',doc.source,'liveSessions',(select coalesce(jsonb_agg(to_jsonb(l) order by l.starts_at),'[]') from nal_private.read_live_sessions l where l.season_id=season.id));end if;
 if p_action='history' then return jsonb_build_object('history',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') from (select id,revision,event,created_at from nal_private.read_editorial_history where document_id=doc.id order by created_at desc limit 100) x));end if;
 if p_action='history-open' then
  select h.source into result from nal_private.read_editorial_history h where h.id=(p_payload->>'id')::uuid and h.document_id=doc.id;
  if result is null then raise exception 'History missing' using errcode='22023';end if;return jsonb_build_object('source',result);
 end if;
 if p_action='schedule-save' then
  if actor_role<>'owner' then raise exception 'Owner approval required' using errcode='42501';end if;
  rid:=(p_payload->>'id')::uuid;
  if rid is null or coalesce((p_payload->>'weekNumber')::integer,0) not between 1 and 4 or coalesce(p_payload->>'status','') not in ('draft','published','cancelled') or length(btrim(coalesce(p_payload->>'title',''))) not between 1 and 160 or length(coalesce(p_payload->>'question',''))>4000 or length(coalesce(p_payload->>'joinUrl',''))>1200 then raise exception 'Invalid schedule' using errcode='22023';end if;
  if exists(select 1 from nal_private.read_live_sessions l where l.id=rid and l.season_id<>season.id) then raise exception 'Schedule ownership mismatch' using errcode='42501';end if;
  if exists(select 1 from nal_private.read_live_sessions l where l.id=rid and l.updated_at is distinct from (p_payload->>'updatedAt')::timestamptz) then raise exception 'Schedule changed' using errcode='40001';end if;
  insert into nal_private.read_live_sessions(id,season_id,week_number,title,opening_question,starts_at,ends_at,join_url,status)
   values(rid,season.id,(p_payload->>'weekNumber')::integer,p_payload->>'title',coalesce(p_payload->>'question',''),(p_payload->>'startsAt')::timestamptz,(p_payload->>'endsAt')::timestamptz,p_payload->>'joinUrl',p_payload->>'status')
   on conflict(id) do update set week_number=excluded.week_number,title=excluded.title,opening_question=excluded.opening_question,starts_at=excluded.starts_at,ends_at=excluded.ends_at,join_url=excluded.join_url,status=excluded.status,updated_at=now();
  insert into nal_private.read_editorial_history(document_id,revision,event,source,actor_id) select doc.id,doc.revision,'schedule-changed',jsonb_build_object('id',rid,'status',p_payload->>'status'),p_user_id where doc.id is not null;
  return jsonb_build_object('saved',true);
 end if;
 if doc.id is null then raise exception 'Save manuscript first' using errcode='22023';end if;
 expected:=(p_payload->>'revision')::integer;
 if expected is null or doc.revision<>expected then raise exception 'Document changed' using errcode='40001';end if;
 if p_action='review' then
  if doc.state<>'draft' then raise exception 'Only drafts can request review' using errcode='22023';end if;
  perform nal_private.read_manifest_check(doc.source,true);
  update nal_private.read_editorial_documents set state='review',updated_by=p_user_id,updated_at=now() where id=doc.id;
 elsif p_action='approve' then
  if actor_role<>'owner' then raise exception 'Owner approval required' using errcode='42501';end if;
  if doc.state<>'review' or p_payload->'sourceReviewed' is distinct from 'true'::jsonb then raise exception 'Content and source review required' using errcode='22023';end if;
  perform nal_private.read_manifest_check(doc.source,true);
  update nal_private.read_editorial_documents set state='approved',approved_revision=revision,approved_by=p_user_id,approved_at=now(),updated_at=now() where id=doc.id;
 elsif p_action='publish' then
  if actor_role<>'owner' then raise exception 'Owner approval required' using errcode='42501';end if;
  if doc.state<>'approved' or doc.approved_revision is distinct from doc.revision or p_payload->>'confirmSlug' is distinct from p_season_slug then raise exception 'Explicit approved-version confirmation required' using errcode='22023';end if;
  if (select mode from nal_private.read_release_control) is distinct from 'off' then raise exception 'Turn READ OFF before changing content' using errcode='42501';end if;
  if exists(select 1 from public.nal_read_enrollments e where e.season_id=season.id) then raise exception 'Season already enrolled; clone for the next cohort' using errcode='22023';end if;
  perform nal_private.read_manifest_check(doc.source,true);
  update nal_private.read_day_steps set status='archived' where day_id in(select d.id from nal_private.read_days d where d.season_id=season.id);
  update nal_private.read_days set status='archived' where season_id=season.id;update nal_private.read_weeks set status='archived' where season_id=season.id;
  for item in select j.value from jsonb_array_elements(doc.source->'weeks') j loop
   insert into nal_private.read_weeks(season_id,week_number,slug,title,subtitle,status) values(season.id,(item->>'number')::integer,item->>'slug',item->>'title',item->>'subtitle','published')
    on conflict(season_id,week_number) do update set slug=excluded.slug,title=excluded.title,subtitle=excluded.subtitle,status='published';
  end loop;
  for daydoc in select j.value from jsonb_array_elements(doc.source->'days') j loop
   wid:=null;if daydoc->'week'<>'null'::jsonb then select w.id into wid from nal_private.read_weeks w where w.season_id=season.id and w.week_number=(daydoc->>'week')::integer;end if;
   insert into nal_private.read_days(season_id,week_id,day_number,title,day_type,estimated_minutes,status) values(season.id,wid,(daydoc->>'number')::integer,daydoc->>'title',daydoc->>'type',(daydoc->>'minutes')::integer,'published')
    on conflict(season_id,day_number) do update set week_id=excluded.week_id,title=excluded.title,day_type=excluded.day_type,estimated_minutes=excluded.estimated_minutes,status='published' returning id into did;
   i:=0;for stepdoc in select j.value from jsonb_array_elements(daydoc->'steps') j loop
    i:=i+1;
    insert into nal_private.read_day_steps(day_id,step_order,step_type,content,prompt,placeholder,options,required,status,content_key,measure_key,measure_version,report_key)
     values(did,i,stepdoc->>'type',stepdoc->>'content',stepdoc->>'prompt',coalesce(stepdoc->>'placeholder','한 문장이어도 충분합니다.'),stepdoc->'options',coalesce((stepdoc->>'required')::boolean,false),'published',stepdoc->>'key',stepdoc->>'measureKey',stepdoc->>'measureVersion',stepdoc->>'reportKey')
     on conflict(day_id,step_order) do update set step_type=excluded.step_type,content=excluded.content,prompt=excluded.prompt,placeholder=excluded.placeholder,options=excluded.options,required=excluded.required,status='published',content_key=excluded.content_key,measure_key=excluded.measure_key,measure_version=excluded.measure_version,report_key=excluded.report_key;
   end loop;
  end loop;
  update public.nal_read_seasons set title=doc.source->'season'->>'title',subtitle=doc.source->'season'->>'subtitle' where id=season.id;
  update nal_private.read_editorial_documents set state='published',published_revision=revision,published_at=now(),updated_at=now() where id=doc.id;
 else raise exception 'Unknown editorial action' using errcode='22023';end if;
 insert into nal_private.read_editorial_history(document_id,revision,event,source,actor_id) values(doc.id,doc.revision,p_action,doc.source,p_user_id);
 return jsonb_build_object('revision',doc.revision,'state',(select d.state from nal_private.read_editorial_documents d where d.id=doc.id),'readActivated',false,'note','Content publication does not enable enrollment, payments or READ access');
end $$;
revoke all on function public.nal_read_editorial(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_editorial(uuid,text,text,jsonb) to service_role;
create table nal_private.read_report_editions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 enrollment_id uuid not null references public.nal_read_enrollments(id) on delete cascade,request_id uuid not null,request_body jsonb not null,
 snapshot jsonb not null check(octet_length(snapshot::text)<=2000000),created_at timestamptz not null default now(),unique(enrollment_id,request_id)
);
create index read_report_editions_owner on nal_private.read_report_editions(user_id,enrollment_id,created_at desc);
alter table nal_private.read_report_editions enable row level security;
revoke all on nal_private.read_report_editions from public,anon,authenticated,service_role;
grant select,insert on nal_private.read_report_editions to service_role;
create function public.nal_read_report(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a jsonb;eid uuid;sid uuid;answers jsonb;tries jsonb;lives jsonb;progress jsonb;snap jsonb;config jsonb;
 edition nal_private.read_report_editions%rowtype;sel jsonb;completed integer;request uuid;answer_count integer;
begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>24000 then raise exception 'Invalid report request' using errcode='22023';end if;
 a:=public.nal_get_read_access(p_user_id,p_season_slug);
 if coalesce((a->>'allowed')::boolean,false) is not true then raise exception 'Read access unavailable' using errcode='42501';end if;
 eid:=(a->>'enrollmentId')::uuid;select season_id into strict sid from public.nal_read_enrollments where id=eid and user_id=p_user_id;
 if p_action='list' then return jsonb_build_object('editions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') from (select id,created_at,snapshot->'cover'->>'title' as title,snapshot->>'stage' as stage from nal_private.read_report_editions where user_id=p_user_id and enrollment_id=eid order by created_at desc limit 50) x));end if;
 if p_action='open' then
  select * into edition from nal_private.read_report_editions where id=(p_payload->>'id')::uuid and user_id=p_user_id and enrollment_id=eid;
  if not found then raise exception 'Report not found' using errcode='42501';end if;
  return jsonb_build_object('id',edition.id,'snapshot',edition.snapshot);
 end if;
 if p_action not in ('source','save') then raise exception 'Unknown report action' using errcode='22023';end if;
 if p_action='save' then
  request:=(p_payload->>'requestId')::uuid;if request is null then raise exception 'Request id required' using errcode='22023';end if;
  config:=p_payload-'requestId';sel:=coalesce(config->'selectedAnswerIds','[]');
  if jsonb_typeof(sel)<>'array' or jsonb_array_length(sel)>12 or length(btrim(coalesce(config->>'title',''))) not between 1 and 120 or length(coalesce(config->>'displayName',''))>80 or length(coalesce(config->>'closingNote',''))>3000 then raise exception 'Invalid report cover or selection' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements_text(sel) selected where not exists(select 1 from public.nal_read_answers x where x.id=selected::uuid and x.user_id=p_user_id and x.enrollment_id=eid)) then raise exception 'Selected answer unavailable' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(eid::text||':report',10));
  select * into edition from nal_private.read_report_editions where enrollment_id=eid and request_id=request;
  if found then if edition.request_body<>config then raise exception 'Request id reused' using errcode='23505';end if;return jsonb_build_object('id',edition.id,'snapshot',edition.snapshot);end if;
  if (select count(*) from nal_private.read_report_editions where enrollment_id=eid)>=30 then raise exception 'Report edition limit reached' using errcode='22023';end if;
 end if;
 select count(*) into answer_count from public.nal_read_answers where user_id=p_user_id and enrollment_id=eid;
 if answer_count>1500 then raise exception 'Report too large; contact operator' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'dayNumber',d.day_number,'dayTitle',d.title,'stepOrder',s.step_order,'type',s.step_type,'prompt',s.prompt,'text',x.answer_text,'value',x.answer_json,'measureKey',s.measure_key,'measureVersion',s.measure_version,'reportKey',s.report_key,'starred',m.answer_id is not null,'updatedAt',x.updated_at) order by d.day_number,s.step_order),'[]') into answers
  from public.nal_read_answers x join nal_private.read_days d on d.id=x.day_id and d.season_id=sid join nal_private.read_day_steps s on s.id=x.step_id and s.day_id=d.id
  left join nal_private.read_answer_marks m on m.answer_id=x.id and m.enrollment_id=eid and m.user_id=p_user_id where x.user_id=p_user_id and x.enrollment_id=eid;
 select coalesce(jsonb_agg(to_jsonb(x)-'user_id'-'enrollment_id' order by x.week_number,x.created_at),'[]') into tries from nal_private.read_experiments x where x.user_id=p_user_id and x.enrollment_id=eid;
 select coalesce(jsonb_agg(jsonb_build_object('weekNumber',l.week_number,'title',l.title,'startsAt',l.starts_at,'beforeNote',n.before_note,'afterNote',n.after_note,'rsvp',n.rsvp) order by l.starts_at),'[]') into lives
  from nal_private.read_live_notes n join nal_private.read_live_sessions l on l.id=n.session_id and l.season_id=sid where n.user_id=p_user_id and n.enrollment_id=eid;
 select coalesce(jsonb_agg(jsonb_build_object('dayNumber',d.day_number,'status',p.status,'completedAt',p.completed_at) order by d.day_number),'[]'),count(*) filter(where p.status='completed' and d.day_number between 1 and 28) into progress,completed
  from public.nal_read_day_progress p join nal_private.read_days d on d.id=p.day_id and d.season_id=sid where p.user_id=p_user_id and p.enrollment_id=eid;
 snap:=jsonb_build_object('schemaVersion',1,'seasonSlug',p_season_slug,'seasonTitle',(select title from public.nal_read_seasons where id=sid),'generatedAt',statement_timestamp(),'stage',case when completed=28 then 'complete' else 'in_progress' end,'completedDays',completed,'plannedDays',28,'answers',answers,'experiments',tries,'liveNotes',lives,'progress',progress,'notice','내가 작성한 기록을 모은 리포트입니다. 심리검사 결과나 프로그램 효과 측정이 아닙니다.');
 if p_action='source' then return jsonb_build_object('snapshot',snap);end if;
 snap:=snap||jsonb_build_object('cover',jsonb_build_object('title',config->>'title','displayName',coalesce(config->>'displayName',''),'closingNote',coalesce(config->>'closingNote','')),'selectedAnswerIds',sel);
 insert into nal_private.read_report_editions(user_id,enrollment_id,request_id,request_body,snapshot) values(p_user_id,eid,request,config,snap) returning * into edition;
 return jsonb_build_object('id',edition.id,'snapshot',edition.snapshot);
end $$;
revoke all on function public.nal_read_report(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_report(uuid,text,text,jsonb) to service_role;
commit;