-- Run only on the dedicated NAL project. Every fixture is rolled back.
begin;
do $test$
declare
  alice uuid := gen_random_uuid();
  bob uuid := gen_random_uuid();
  session_id uuid;
  request_id uuid := gen_random_uuid();
  registration_id uuid;
  waitlisted_id uuid;
  program_id text := 'nal-smoke-' || gen_random_uuid()::text;
  rejected boolean;
begin
  insert into auth.users (id, email, email_confirmed_at) values
    (alice, 'nal-smoke-' || alice::text || '@example.invalid', now()),
    (bob, 'nal-smoke-' || bob::text || '@example.invalid', now());
  insert into public.nal_catalog (kind, id, slug, published, body)
    values ('programs', program_id, program_id, true, '{"title":"Disposable NAL test"}');
  insert into public.nal_sessions (program_id, starts_at, ends_at, capacity, price_won, status, published)
    values (program_id, now()+interval '1 day', now()+interval '2 days', 1, 0, 'open', true) returning id into session_id;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', alice::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', alice, 'role', 'authenticated')::text, true);
  registration_id := public.nal_register(session_id, request_id);
  if public.nal_register(session_id, request_id) <> registration_id then raise exception 'Idempotency failed'; end if;
  if (select status from public.nal_registrations where id = registration_id) <> 'confirmed' then raise exception 'Free reservation failed'; end if;
  rejected := false;
  begin
    update public.nal_registrations set status = 'cancelled' where id = registration_id;
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Participant has direct registration writes'; end if;

  perform set_config('request.jwt.claim.sub', bob::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', bob, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.nal_registrations where id = registration_id) then raise exception 'Cross-user visibility'; end if;
  rejected := false;
  begin
    perform public.nal_cancel_registration(registration_id);
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Cross-user cancellation'; end if;
  waitlisted_id := public.nal_register(session_id, gen_random_uuid());
  if (select status from public.nal_registrations where id = waitlisted_id) <> 'waitlisted' then raise exception 'Capacity exceeded'; end if;

  perform set_config('request.jwt.claim.sub', alice::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', alice, 'role', 'authenticated')::text, true);
  perform public.nal_cancel_registration(registration_id);
  if (select status from public.nal_registrations where id = registration_id) <> 'cancelled' then raise exception 'Cancellation failed'; end if;

  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  if public.nal_public_catalog()->'site' is null then raise exception 'Catalog unavailable'; end if;
  rejected := false;
  begin
    perform 1 from public.nal_registrations;
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Anonymous applicant access'; end if;
  execute 'reset role';
end;
$test$;
select 'Passed: live RLS, capacity, waitlist, idempotency, cancellation; fixtures rolled back' as result;
rollback;
