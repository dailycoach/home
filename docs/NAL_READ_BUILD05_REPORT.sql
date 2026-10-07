-- BUILD05 source only. Unapplied. Depends on BUILD04 workspace and BUILD05 editorial columns.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table nal_private.read_report_editions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 enrollment_id uuid not null references public.nal_read_enrollments(id) on delete cascade,
 request_id uuid not null,request_body jsonb not null,
 snapshot jsonb not null check(octet_length(snapshot::text)<=2000000),
 created_at timestamptz not null default now(),unique(enrollment_id,request_id)
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
 if p_action='list' then
  return jsonb_build_object('editions',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') from (
   select id,created_at,snapshot->'cover'->>'title' as title,snapshot->>'stage' as stage
   from nal_private.read_report_editions where user_id=p_user_id and enrollment_id=eid order by created_at desc limit 50) x));
 end if;
 if p_action='open' then
  select * into edition from nal_private.read_report_editions where id=(p_payload->>'id')::uuid and user_id=p_user_id and enrollment_id=eid;
  if not found then raise exception 'Report not found' using errcode='42501';end if;
  return jsonb_build_object('id',edition.id,'snapshot',edition.snapshot);
 end if;
 if p_action not in ('source','save') then raise exception 'Unknown report action' using errcode='22023';end if;
 if p_action='save' then
  request:=(p_payload->>'requestId')::uuid;
  if request is null then raise exception 'Request id required' using errcode='22023';end if;
  config:=p_payload-'requestId';sel:=coalesce(config->'selectedAnswerIds','[]');
  if jsonb_typeof(sel)<>'array' or jsonb_array_length(sel)>12
   or length(btrim(coalesce(config->>'title','')) ) not between 1 and 120
   or length(coalesce(config->>'displayName',''))>80 or length(coalesce(config->>'closingNote',''))>3000 then
   raise exception 'Invalid report cover or selection' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements_text(sel) selected where not exists(
   select 1 from public.nal_read_answers x where x.id=selected::uuid and x.user_id=p_user_id and x.enrollment_id=eid)) then
   raise exception 'Selected answer unavailable' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(eid::text||':report',10));
  select * into edition from nal_private.read_report_editions where enrollment_id=eid and request_id=request;
  if found then
   if edition.request_body<>config then raise exception 'Request id reused' using errcode='23505';end if;
   return jsonb_build_object('id',edition.id,'snapshot',edition.snapshot);
  end if;
  if (select count(*) from nal_private.read_report_editions where enrollment_id=eid)>=30 then
   raise exception 'Report edition limit reached' using errcode='22023';end if;
 end if;
 select count(*) into answer_count from public.nal_read_answers where user_id=p_user_id and enrollment_id=eid;
 if answer_count>1500 then raise exception 'Report too large; contact operator' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'dayNumber',d.day_number,'dayTitle',d.title,'stepOrder',s.step_order,
  'type',s.step_type,'prompt',s.prompt,'text',x.answer_text,'value',x.answer_json,'measureKey',s.measure_key,
  'measureVersion',s.measure_version,'reportKey',s.report_key,'starred',m.answer_id is not null,'updatedAt',x.updated_at)
  order by d.day_number,s.step_order),'[]') into answers
  from public.nal_read_answers x join nal_private.read_days d on d.id=x.day_id and d.season_id=sid
  join nal_private.read_day_steps s on s.id=x.step_id and s.day_id=d.id
  left join nal_private.read_answer_marks m on m.answer_id=x.id and m.enrollment_id=eid and m.user_id=p_user_id
  where x.user_id=p_user_id and x.enrollment_id=eid;
 select coalesce(jsonb_agg(to_jsonb(x)-'user_id'-'enrollment_id' order by x.week_number,x.created_at),'[]') into tries
  from nal_private.read_experiments x where x.user_id=p_user_id and x.enrollment_id=eid;
 select coalesce(jsonb_agg(jsonb_build_object('weekNumber',l.week_number,'title',l.title,'startsAt',l.starts_at,
  'beforeNote',n.before_note,'afterNote',n.after_note,'rsvp',n.rsvp) order by l.starts_at),'[]') into lives
  from nal_private.read_live_notes n join nal_private.read_live_sessions l on l.id=n.session_id and l.season_id=sid
  where n.user_id=p_user_id and n.enrollment_id=eid;
 select coalesce(jsonb_agg(jsonb_build_object('dayNumber',d.day_number,'status',p.status,'completedAt',p.completed_at) order by d.day_number),'[]'),
  count(*) filter(where p.status='completed' and d.day_number between 1 and 28) into progress,completed
  from public.nal_read_day_progress p join nal_private.read_days d on d.id=p.day_id and d.season_id=sid
  where p.user_id=p_user_id and p.enrollment_id=eid;
 snap:=jsonb_build_object('schemaVersion',1,'seasonSlug',p_season_slug,
  'seasonTitle',(select title from public.nal_read_seasons where id=sid),'generatedAt',statement_timestamp(),
  'stage',case when completed=28 then 'complete' else 'in_progress' end,'completedDays',completed,'plannedDays',28,
  'answers',answers,'experiments',tries,'liveNotes',lives,'progress',progress,
  'notice','내가 작성한 기록을 모은 리포트입니다. 심리검사 결과나 프로그램 효과 측정이 아닙니다.');
 if p_action='source' then return jsonb_build_object('snapshot',snap);end if;
 snap:=snap||jsonb_build_object('cover',jsonb_build_object('title',config->>'title','displayName',coalesce(config->>'displayName',''),
  'closingNote',coalesce(config->>'closingNote','')),'selectedAnswerIds',sel);
 insert into nal_private.read_report_editions(user_id,enrollment_id,request_id,request_body,snapshot)
  values(p_user_id,eid,request,config,snap) returning * into edition;
 return jsonb_build_object('id',edition.id,'snapshot',edition.snapshot);
end $$;
revoke all on function public.nal_read_report(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_report(uuid,text,text,jsonb) to service_role;
commit;
