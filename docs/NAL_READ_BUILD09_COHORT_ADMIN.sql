-- BUILD09 source only. Owner-only cohort settings, FIFO invitations and manual attendance.
-- No coaching text, psychological scores, Auth-table queries or message sending.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create function public.nal_read_cohort_admin(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare s public.nal_read_seasons%rowtype;c nal_private.read_cohorts%rowtype;f nal_private.read_offers%rowtype;
 w nal_private.read_waitlist%rowtype;front nal_private.read_waitlist%rowtype;
 att nal_private.read_cohort_attendance%rowtype;inv jsonb;items jsonb;waiters jsonb;sessions jsonb;logs jsonb;
 off integer;rev integer;start_at timestamptz;end_at timestamptz;until_at timestamptz;cap integer;hours integer;
 target uuid;v_session uuid;frozen boolean;note text;next_state text;
begin
 if not nal_private.read_verified_subject(p_user_id) or not exists(select 1 from nal_private.admins where user_id=p_user_id and role='owner') then
  raise exception 'Owner permission required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>14000 then raise exception 'Invalid admin request' using errcode='22023';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('seasonSlug',rs.slug,'title',rs.title,'contentState',rs.status,
   'cohort',case when rc.season_id is null then null else to_jsonb(rc)||jsonb_build_object('summary',nal_private.read_cohort_summary(rs.id)) end,
   'registration',jsonb_build_object('startsAt',rf.starts_at,'endsAt',rf.ends_at,'status',rf.status)) order by rs.created_at desc),'[]') into items
   from public.nal_read_seasons rs left join nal_private.read_cohorts rc on rc.season_id=rs.id left join nal_private.read_offers rf on rf.season_id=rs.id;
  return jsonb_build_object('seasons',items);
 end if;
 select * into s from public.nal_read_seasons where slug=p_payload->>'seasonSlug';
 if not found then raise exception 'Unknown cohort season' using errcode='22023';end if;
 perform nal_private.read_cohort_lock(s.id);
 select * into c from nal_private.read_cohorts where season_id=s.id for update;
 select * into f from nal_private.read_offers where season_id=s.id;
 inv:=nal_private.read_cohort_inventory(s.id);
 if p_action='save' then
  if (select mode from nal_private.read_release_control) is distinct from 'off' then raise exception 'Edit recruitment settings with READ OFF' using errcode='42501';end if;
  rev:=(p_payload->>'revision')::integer;
  if rev is null or rev<0 or rev<>coalesce(c.revision,0) then raise exception 'Cohort changed' using errcode='40001';end if;
  note:=btrim(p_payload->>'reason');cap:=(p_payload->>'capacity')::integer;hours:=(p_payload->>'waitOfferHours')::integer;
  start_at:=(p_payload->>'courseStartsAt')::timestamptz;end_at:=(p_payload->>'courseEndsAt')::timestamptz;next_state:=p_payload->>'state';
  if p_payload->'confirmed' is distinct from 'true'::jsonb or note is null or length(note) not between 1 and 500
   or cap is null or cap not between 1 and 5000 or hours is null or hours not between 1 and 168
   or start_at is null or end_at is null or not isfinite(start_at) or not isfinite(end_at) or end_at<=start_at
   or next_state is null or next_state not in ('draft','recruiting','paused','closed','cancelled')
   or jsonb_typeof(p_payload->'waitlistEnabled') is distinct from 'boolean' then raise exception 'Invalid cohort configuration' using errcode='22023';end if;
  if cap<(inv->>'occupied')::integer then raise exception 'Capacity cannot be lower than committed places' using errcode='22023';end if;
  if f.ends_at>start_at then raise exception 'Close registration no later than course start' using errcode='22023';end if;
  if next_state='recruiting' and (f.season_id is null or f.status<>'accepting' or start_at<=now()) then raise exception 'Configure an accepting offer and future course first' using errcode='22023';end if;
  frozen:=exists(select 1 from public.nal_read_enrollments where season_id=s.id) or exists(select 1 from nal_private.read_checkout_orders where season_id=s.id) or exists(select 1 from nal_private.read_waitlist where season_id=s.id);
  if c.season_id is not null and frozen and
   (c.program_key is distinct from p_payload->>'programKey' or c.cohort_number is distinct from (p_payload->>'cohortNumber')::integer
    or c.label is distinct from btrim(p_payload->>'label') or c.course_starts_at<>start_at or c.course_ends_at<>end_at) then
   raise exception 'Do not rewrite a cohort with applicants; create a new cohort' using errcode='22023';end if;
  if c.season_id is null and frozen and (s.starts_at is distinct from start_at or s.ends_at is distinct from end_at) then raise exception 'Preserve the dates of an existing cohort' using errcode='22023';end if;
  if exists(select 1 from nal_private.read_live_sessions where season_id=s.id and status='published' and (starts_at<start_at or ends_at>end_at)) then raise exception 'Published LIVE sessions must fit inside course dates' using errcode='22023';end if;
  insert into nal_private.read_cohorts(season_id,program_key,cohort_number,label,course_starts_at,course_ends_at,capacity,state,waitlist_enabled,wait_offer_hours)
   values(s.id,p_payload->>'programKey',(p_payload->>'cohortNumber')::integer,btrim(p_payload->>'label'),start_at,end_at,cap,next_state,(p_payload->>'waitlistEnabled')::boolean,hours)
   on conflict(season_id) do update set program_key=excluded.program_key,cohort_number=excluded.cohort_number,label=excluded.label,
    course_starts_at=excluded.course_starts_at,course_ends_at=excluded.course_ends_at,capacity=excluded.capacity,state=excluded.state,
    waitlist_enabled=excluded.waitlist_enabled,wait_offer_hours=excluded.wait_offer_hours,revision=nal_private.read_cohorts.revision+1,updated_at=now() returning * into c;
  update public.nal_read_seasons set starts_at=start_at,ends_at=end_at,updated_at=now() where id=s.id;
  insert into nal_private.read_cohort_events(season_id,actor_id,action,detail) values(s.id,p_user_id,'cohort.save',jsonb_build_object('revision',c.revision,'capacity',cap,'state',next_state,'reason',note));
  return jsonb_build_object('saved',true,'cohort',to_jsonb(c),'summary',nal_private.read_cohort_summary(s.id));
 end if;
 if c.season_id is null then raise exception 'Configure the cohort first' using errcode='22023';end if;
 if p_action='roster' then
  off:=coalesce((p_payload->>'offset')::integer,0);if off<0 or off>10000 then raise exception 'Invalid page' using errcode='22023';end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]') into items from (
   select e.id,e.status,e.created_at,coalesce(nullif(p.display_name,''),'참가자 '||left(e.id::text,8)) as display_name,
    (select count(*) from public.nal_read_day_progress d where d.enrollment_id=e.id and d.user_id=e.user_id and d.status='completed') as recorded_days,
    (select coalesce(jsonb_agg(jsonb_build_object('sessionId',a.session_id,'status',a.status,'revision',a.revision,'updatedAt',a.updated_at)),'[]') from nal_private.read_cohort_attendance a where a.enrollment_id=e.id) as attendance
   from public.nal_read_enrollments e left join nal_private.account_preferences p on p.user_id=e.user_id
   where e.season_id=s.id order by e.created_at,e.id limit 51 offset off
  ) x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.joined_at,x.user_id),'[]') into waiters from (
   select rw.user_id,rw.joined_at,rw.offer_until,rw.revision,case when rw.state='offered' and rw.offer_until<=now() then 'expired' else rw.state end as state,
    coalesce(nullif(p.display_name,''),'대기자 '||left(rw.user_id::text,8)) as display_name
   from nal_private.read_waitlist rw left join nal_private.account_preferences p on p.user_id=rw.user_id
   where rw.season_id=s.id and rw.state not in ('joined','withdrawn') order by rw.joined_at,rw.user_id limit 101 offset off
  ) x;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'startsAt',l.starts_at,'endsAt',l.ends_at,'status',l.status) order by l.starts_at),'[]') into sessions from nal_private.read_live_sessions l where l.season_id=s.id;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into logs from (select action,detail,created_at from nal_private.read_cohort_events where season_id=s.id order by created_at desc limit 20) x;
  return jsonb_build_object('participants',items,'waiters',waiters,'sessions',sessions,'events',logs,'summary',nal_private.read_cohort_summary(s.id),'offset',off);
 end if;
 if p_action in ('offer-next','offer-cancel') then
  target:=(p_payload->>'userId')::uuid;rev:=(p_payload->>'revision')::integer;
  if target is null or rev is null or p_payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Confirm the selected applicant first' using errcode='22023';end if;
  select * into w from nal_private.read_waitlist where season_id=s.id and user_id=target for update;
  if not found then raise exception 'Waitlist application unavailable' using errcode='22023';end if;
  if p_action='offer-next' then
   if w.state='offered' and w.offer_until>now() and w.revision=rev+1 then return jsonb_build_object('offered',true,'offerUntil',w.offer_until,'revision',w.revision);end if;
   if w.revision<>rev then raise exception 'Application changed' using errcode='40001';end if;
   select * into front from nal_private.read_waitlist where season_id=s.id and state='waiting' order by joined_at,user_id limit 1 for update;
   if front.user_id is distinct from target then raise exception 'Offer the first waiting applicant, not a later one' using errcode='22023';end if;
   if (inv->>'occupied')::integer>=c.capacity or c.state<>'recruiting' or f.status<>'accepting' or f.starts_at>now() or f.ends_at<=now() or now()>=c.course_starts_at then raise exception 'No available admission place' using errcode='22023';end if;
   until_at:=least(now()+make_interval(hours=>c.wait_offer_hours),coalesce(f.ends_at,c.course_starts_at),c.course_starts_at);
   update nal_private.read_waitlist set state='offered',offered_at=now(),offer_until=until_at,revision=revision+1,updated_at=now() where season_id=s.id and user_id=target returning * into w;
   insert into nal_private.read_cohort_events(season_id,actor_id,action,detail) values(s.id,p_user_id,'waitlist.offer',jsonb_build_object('userId',target,'offerUntil',until_at));
   return jsonb_build_object('offered',true,'offerUntil',until_at,'revision',w.revision,'notification','not_sent');
  end if;
  note:=btrim(p_payload->>'reason');
  if w.revision<>rev then raise exception 'Application changed' using errcode='40001';end if;
  if w.state<>'offered' or note is null or length(note) not between 1 and 500 then raise exception 'An offered place and a reason are required' using errcode='22023';end if;
  if exists(select 1 from public.nal_read_enrollments where season_id=s.id and user_id=target)
   or exists(select 1 from nal_private.read_checkout_orders where season_id=s.id and user_id=target and state not in ('failed','refunded')) then
   raise exception 'Do not cancel an offer with an unresolved payment or enrollment' using errcode='22023';end if;
  update nal_private.read_waitlist set state='expired',offer_until=least(offer_until,now()),revision=revision+1,updated_at=now() where season_id=s.id and user_id=target;
  insert into nal_private.read_cohort_events(season_id,actor_id,action,detail) values(s.id,p_user_id,'waitlist.offer_cancel',jsonb_build_object('userId',target,'reason',note));
  return jsonb_build_object('saved',true);
 end if;
 if p_action='attendance' then
  target:=(p_payload->>'enrollmentId')::uuid;v_session:=(p_payload->>'sessionId')::uuid;rev:=(p_payload->>'revision')::integer;
  if p_payload->'confirmed' is distinct from 'true'::jsonb or target is null or v_session is null or rev is null or p_payload->>'status' is null
   or p_payload->>'status' not in ('unknown','present','absent','excused') then raise exception 'Confirm attendance status' using errcode='22023';end if;
  if not exists(select 1 from public.nal_read_enrollments where id=target and season_id=s.id)
   or not exists(select 1 from nal_private.read_live_sessions l where l.id=v_session and l.season_id=s.id and l.status='published' and l.starts_at<=now()) then
   raise exception 'Only a started session and its participant may be recorded' using errcode='22023';end if;
  select * into att from nal_private.read_cohort_attendance a where a.session_id=v_session and a.enrollment_id=target for update;
  if coalesce(att.revision,0)<>rev then raise exception 'Attendance changed' using errcode='40001';end if;
  insert into nal_private.read_cohort_attendance(session_id,enrollment_id,status,recorded_by) values(v_session,target,p_payload->>'status',p_user_id)
   on conflict(session_id,enrollment_id) do update set status=excluded.status,recorded_by=p_user_id,revision=nal_private.read_cohort_attendance.revision+1,updated_at=now();
  insert into nal_private.read_cohort_events(season_id,actor_id,action,detail) values(s.id,p_user_id,'attendance.record',jsonb_build_object('enrollmentId',target,'sessionId',v_session,'status',p_payload->>'status'));
  return jsonb_build_object('saved',true,'source','owner_recorded');
 end if;
 raise exception 'Unknown cohort admin action' using errcode='22023';
end $$;
revoke all on function public.nal_read_cohort_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_read_cohort_admin(uuid,text,jsonb) to service_role;
commit;
