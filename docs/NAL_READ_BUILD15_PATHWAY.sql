-- BUILD15 SOURCE ONLY. UNAPPLIED. No tests, sample data or runtime changes.
-- Load after the full BUILD04-14 chain. Reuse workspace and report storage.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

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
  -- Serialize the click with note saving, and return the resulting note revision in
  -- this transaction. A later blanket reload must not adopt someone else's note
  -- revision and overwrite their edits with an older local form.
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
  -- Re-entry and retries return the same experiment, including completed/cancelled
  -- ones. Do not restart it or replace a reflection with the newly edited answer.
  return jsonb_build_object('saved',true,'created',false,'experiment',to_jsonb(experiment_row)-'user_id'-'enrollment_id');
 end if;
 -- Match the just-committed draft and saved answer. Never trust browser-supplied
 -- title, prompt, week, text, owner or source snapshot. Lock draft before answer,
 -- matching the pre-existing draft-commit order.
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
commit;
