-- BUILD10 source only. Load after BUILD10_GUIDE.sql. No runtime SQL executed here.
-- Existing owner/operator editors; no memberships, schedules, messages or prices created.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table nal_private.read_facilitator_plans(
 season_id uuid not null references public.nal_read_seasons(id) on delete restrict,week_number integer not null check(week_number between 1 and 4),
 session_id uuid references nal_private.read_live_sessions(id) on delete restrict,
 source jsonb not null check(jsonb_typeof(source)='object' and octet_length(source::text)<=50000),
 state text not null default 'draft' check(state in ('draft','ready')),revision integer not null default 1 check(revision>0),
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),primary key(season_id,week_number)
);
create index read_facilitator_plans_session on nal_private.read_facilitator_plans(session_id);
create index read_facilitator_plans_editor on nal_private.read_facilitator_plans(updated_by);
alter table nal_private.read_facilitator_plans enable row level security;
revoke all on nal_private.read_facilitator_plans from public,anon,authenticated,service_role;
grant select,insert,update on nal_private.read_facilitator_plans to service_role;

create function nal_private.read_runbook_check(p_source jsonb,p_ready boolean default false)
returns void language plpgsql immutable security invoker set search_path='' as $$
declare k text;x jsonb;ids text[]:='{}';total_minutes integer:=0;minutes integer;
begin
 if p_source is null or jsonb_typeof(p_source)<>'object' or octet_length(p_source::text)>48000 or p_source-ARRAY['aim','opening','closing','followUp','agenda','debrief']<>'{}'::jsonb then raise exception 'Invalid runbook' using errcode='22023';end if;
 foreach k in array array['aim','opening','closing','followUp'] loop
  if jsonb_typeof(p_source->k) is distinct from 'string' or length(p_source->>k)>2000 then raise exception 'Invalid runbook text' using errcode='22023';end if;end loop;
 if jsonb_typeof(p_source->'debrief') is distinct from 'object' or (p_source->'debrief')-ARRAY['observed','adjust','next']<>'{}'::jsonb then raise exception 'Invalid operating reflection' using errcode='22023';end if;
 foreach k in array array['observed','adjust','next'] loop
  if jsonb_typeof(p_source->'debrief'->k) is distinct from 'string' or length(p_source->'debrief'->>k)>3000 then raise exception 'Invalid operating reflection text' using errcode='22023';end if;end loop;
 if jsonb_typeof(p_source->'agenda') is distinct from 'array' then raise exception 'Agenda array required' using errcode='22023';end if;
 if jsonb_array_length(p_source->'agenda')>20 then raise exception 'Agenda too long' using errcode='22023';end if;
 for x in select value from jsonb_array_elements(p_source->'agenda') loop
  if jsonb_typeof(x)<>'object' or x-ARRAY['id','title','minutes','prompt','notes']<>'{}'::jsonb
   or jsonb_typeof(x->'id') is distinct from 'string' or coalesce(x->>'id','')!~'^[a-z0-9-]{1,60}$' or x->>'id'=any(ids)
   or jsonb_typeof(x->'title') is distinct from 'string' or length(btrim(x->>'title')) not between 1 and 120
   or jsonb_typeof(x->'minutes') is distinct from 'number'
   or jsonb_typeof(x->'prompt') is distinct from 'string' or length(x->>'prompt')>1500
   or jsonb_typeof(x->'notes') is distinct from 'string' or length(x->>'notes')>2000 then raise exception 'Invalid agenda item' using errcode='22023';end if;
  if (x->>'minutes')::numeric<>trunc((x->>'minutes')::numeric) or (x->>'minutes')::numeric not between 1 and 120 then raise exception 'Agenda minutes must be whole minutes' using errcode='22023';end if;
  minutes:=(x->>'minutes')::integer;total_minutes:=total_minutes+minutes;ids:=array_append(ids,x->>'id');
 end loop;
 if total_minutes>360 then raise exception 'Agenda exceeds six hours' using errcode='22023';end if;
 if p_ready and (jsonb_array_length(p_source->'agenda')=0 or length(btrim(p_source->>'aim'))=0 or length(btrim(p_source->>'opening'))=0 or length(btrim(p_source->>'closing'))=0) then raise exception 'Complete purpose, opening, closing and agenda before marking ready' using errcode='22023';end if;
end $$;

create function public.nal_read_studio(p_user_id uuid,p_season_slug text,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare role_name text;sid uuid;week integer;expected integer;src jsonb;items jsonb;days jsonb;meetings jsonb;history jsonb;
 g nal_private.read_arrival_guides%rowtype;p nal_private.read_facilitator_plans%rowtype;selected_session uuid;next_state text;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified editor required' using errcode='42501';end if;
 select a.role into role_name from nal_private.admins a where a.user_id=p_user_id;
 if role_name is null or role_name not in ('owner','operator') then raise exception 'Editor permission required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>58000 then raise exception 'Invalid studio payload' using errcode='22023';end if;
 if p_action='seasons' then
  select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'title',s.title,'cohortLabel',c.label) order by s.created_at desc),'[]') into items from public.nal_read_seasons s left join nal_private.read_cohorts c on c.season_id=s.id;
  return jsonb_build_object('role',role_name,'seasons',items);
 end if;
 if p_season_slug is null or p_season_slug!~'^[a-z0-9-]{1,120}$' then raise exception 'Invalid season' using errcode='22023';end if;
 select s.id into sid from public.nal_read_seasons s where s.slug=p_season_slug;
 if sid is null then raise exception 'Season unavailable' using errcode='22023';end if;
 if p_action in ('get','plan-save') then
  week:=(p_payload->>'weekNumber')::integer;if week is null or week not between 1 and 4 then raise exception 'Invalid week' using errcode='22023';end if;
 end if;
 if p_action='get' then
  select * into g from nal_private.read_arrival_guides where season_id=sid;
  select * into p from nal_private.read_facilitator_plans where season_id=sid and week_number=week;
  select coalesce(jsonb_agg(jsonb_build_object('number',w.week_number,'title',w.title,'subtitle',w.subtitle,'status',w.status) order by w.week_number),'[]') into items from nal_private.read_weeks w where w.season_id=sid;
  -- Course content only; no joins to personal answers, drafts, experiments or LIVE notes.
  select coalesce(jsonb_agg(jsonb_build_object('dayNumber',d.day_number,'title',d.title,'minutes',d.estimated_minutes,
   'steps',(select coalesce(jsonb_agg(jsonb_build_object('order',st.step_order,'type',st.step_type,'content',st.content,'prompt',st.prompt,'required',st.required,'contentKey',st.content_key) order by st.step_order),'[]')
    from nal_private.read_day_steps st where st.day_id=d.id and st.status='published')) order by d.day_number),'[]') into days
   from nal_private.read_days d join nal_private.read_weeks w on w.id=d.week_id and w.season_id=sid where d.season_id=sid and w.week_number=week and w.status='published' and d.status='published';
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'weekNumber',l.week_number,'title',l.title,'question',l.opening_question,'startsAt',l.starts_at,'endsAt',l.ends_at,'status',l.status) order by l.starts_at),'[]') into meetings
   from nal_private.read_live_sessions l where l.season_id=sid and l.week_number=week;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into history from (
   select id,kind,week_number,revision,event,created_at from nal_private.read_companion_history h where h.season_id=sid and (h.kind='guide' or h.week_number=week) order by created_at desc limit 20) x;
  return jsonb_build_object('role',role_name,'seasonSlug',p_season_slug,'weeks',items,'weekNumber',week,'days',days,'liveSessions',meetings,
   'guide',jsonb_build_object('source',g.source,'revision',coalesce(g.revision,0),'publishedRevision',g.published_revision,'publishedAt',g.published_at),
   'runbook',jsonb_build_object('source',p.source,'revision',coalesce(p.revision,0),'state',coalesce(p.state,'draft'),'sessionId',p.session_id,'updatedAt',p.updated_at),'history',history);
 end if;
 expected:=(p_payload->>'revision')::integer;if expected is null or expected<0 then raise exception 'Revision required' using errcode='22023';end if;
 if p_action in ('guide-save','guide-publish') then
  perform pg_advisory_xact_lock(hashtextextended(sid::text||':arrival-guide',105));
  select * into g from nal_private.read_arrival_guides where season_id=sid for update;
  if expected<>coalesce(g.revision,0) then raise exception 'Guide changed in another editor' using errcode='40001';end if;
  if p_action='guide-save' then
   src:=p_payload->'source';perform nal_private.read_arrival_guide_check(src);
   insert into nal_private.read_arrival_guides(season_id,source,updated_by) values(sid,src,p_user_id)
    on conflict(season_id) do update set source=excluded.source,revision=nal_private.read_arrival_guides.revision+1,updated_by=p_user_id,updated_at=now() returning * into g;
   insert into nal_private.read_companion_history(season_id,kind,revision,event,source,actor_id) values(sid,'guide',g.revision,'saved',g.source,p_user_id);
  else
   if role_name<>'owner' or p_payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Owner publication approval required' using errcode='42501';end if;
   if g.season_id is null then raise exception 'Save guide first' using errcode='22023';end if;
   perform nal_private.read_arrival_guide_check(g.source);
   if length(btrim(g.source->>'headline'))=0 or length(btrim(g.source->>'introduction'))=0 then raise exception 'Headline and introduction required before publication' using errcode='22023';end if;
   update nal_private.read_arrival_guides set published_source=source,published_revision=revision,published_by=p_user_id,published_at=now() where season_id=sid returning * into g;
   insert into nal_private.read_companion_history(season_id,kind,revision,event,source,actor_id) values(sid,'guide',g.revision,'published',g.published_source,p_user_id);
  end if;
  return jsonb_build_object('saved',true,'revision',g.revision,'publishedRevision',g.published_revision,'publishedAt',g.published_at);
 end if;
 if p_action='plan-save' then
  perform pg_advisory_xact_lock(hashtextextended(sid::text||':runbook:'||week::text,106));
  select * into p from nal_private.read_facilitator_plans where season_id=sid and week_number=week for update;
  if expected<>coalesce(p.revision,0) then raise exception 'Runbook changed in another editor' using errcode='40001';end if;
  src:=p_payload->'source';next_state:=p_payload->>'state';selected_session:=nullif(p_payload->>'sessionId','')::uuid;
  if next_state is null or next_state not in ('draft','ready') then raise exception 'Invalid runbook state' using errcode='22023';end if;
  perform nal_private.read_runbook_check(src,next_state='ready');
  if selected_session is not null and not exists(select 1 from nal_private.read_live_sessions l where l.id=selected_session and l.season_id=sid and l.week_number=week) then raise exception 'Select a LIVE from this same week and cohort' using errcode='22023';end if;
  insert into nal_private.read_facilitator_plans(season_id,week_number,session_id,source,state,updated_by) values(sid,week,selected_session,src,next_state,p_user_id)
   on conflict(season_id,week_number) do update set session_id=excluded.session_id,source=excluded.source,state=excluded.state,revision=nal_private.read_facilitator_plans.revision+1,updated_by=p_user_id,updated_at=now() returning * into p;
  insert into nal_private.read_companion_history(season_id,kind,week_number,revision,event,source,actor_id)
   values(sid,'runbook',week,p.revision,'saved',jsonb_build_object('plan',p.source,'state',p.state,'sessionId',p.session_id),p_user_id);
  return jsonb_build_object('saved',true,'revision',p.revision,'state',p.state,'updatedAt',p.updated_at);
 end if;
 raise exception 'Unknown studio action' using errcode='22023';
end $$;
revoke all on function nal_private.read_runbook_check(jsonb,boolean),public.nal_read_studio(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function nal_private.read_runbook_check(jsonb,boolean),public.nal_read_studio(uuid,text,text,jsonb) to service_role;
commit;
