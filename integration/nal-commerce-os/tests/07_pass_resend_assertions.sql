\set ON_ERROR_STOP on
DO $gate$ BEGIN
 IF current_database()<>'nal_ci_ledger' THEN
  RAISE EXCEPTION 'P7-E SQL ASSERTIONS REQUIRE DISPOSABLE DB'; END IF;
END $gate$;

SET ROLE anon;
DO $deny$ BEGIN
 BEGIN
  PERFORM 1 FROM nal_private.commerce_os_pass_resend_jobs;
  RAISE EXCEPTION 'ANONYMOUS_RESEND_TABLE_ACCESS';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM nal_private.commerce_os_queue_pass_resend(
   '11111111-1111-4111-8111-111111111111',repeat('a',64),
   '11111111-1111-4111-8111-111111111111');
  RAISE EXCEPTION 'ANONYMOUS_RESEND_FUNCTION_ACCESS';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $deny$;
RESET ROLE;
SET ROLE service_role;

INSERT INTO nal_private.commerce_os_slots
 (id,offer_id,starts_at,registration_deadline,capacity,published,slot_status)
VALUES
 ('77777777-7777-4777-8777-777777777777','read-delivery',
  now()+interval '16 days',now()+interval '15 days',1,true,'available'),
 ('88888888-8888-4888-8888-888888888888','class-delivery',
  now()+interval '17 days',now()+interval '16 days',1,true,'available'),
 ('99999999-9999-4999-8999-999999999999','read-delivery',
  now()+interval '18 days',now()+interval '17 days',1,true,'available');

DO $reading$
DECLARE v uuid; response jsonb; job jsonb; rec uuid;
BEGIN
 response:=nal_private.commerce_os_begin_order(
  '61616161-6161-4161-8161-616161616161','reading-resend@example.invalid',
  repeat('a',64),'read-delivery','77777777-7777-4777-8777-777777777777',
  'testpg','provider-resend-reading','merchant-fixture');
 v:=(response->>'orderId')::uuid;
 PERFORM nal_private.commerce_os_apply_provider(
  v,'provider-resend-reading','merchant-fixture','payment-resend-reading',
  19000,'KRW','DONE','event-resend-reading-paid',true);
 ASSERT NOT nal_private.commerce_os_queue_pass_resend(
  v,repeat('b',64),'aaaa0000-1111-4111-8111-111111111111');
 ASSERT nal_private.commerce_os_queue_pass_resend(
  v,repeat('a',64),'aaaa0000-1111-4111-8111-111111111111');
 ASSERT nal_private.commerce_os_queue_pass_resend(
  v,repeat('a',64),'aaaa0000-1111-4111-8111-111111111111');
 ASSERT (SELECT count(*) FROM nal_private.commerce_os_pass_resend_jobs WHERE order_id=v)=1;
 ASSERT NOT nal_private.commerce_os_queue_pass_resend(
  v,repeat('a',64),'aaaa0000-1111-4111-8111-222222222222');
 SELECT id INTO rec FROM nal_private.commerce_os_pass_resend_jobs WHERE order_id=v;
 job:=nal_private.commerce_os_lease_pass_resend(rec);
 ASSERT job->>'kind'='reading_pass';
 ASSERT job->>'email'='reading-resend@example.invalid';
 ASSERT job->>'title'='합성 독서모임 참가권';
 ASSERT (job->>'attempts')::int=1;
 ASSERT nal_private.commerce_os_lease_pass_resend(rec) IS NULL;
 ASSERT nal_private.commerce_os_finish_pass_resend(
  rec,(job->>'leaseId')::uuid,false)='retry';
 ASSERT nal_private.commerce_os_lease_pass_resend(rec) IS NULL;
 UPDATE nal_private.commerce_os_pass_resend_jobs
 SET next_attempt_at=now()-interval '1 second' WHERE id=rec;
 job:=nal_private.commerce_os_lease_pass_resend(rec);
 ASSERT (job->>'attempts')::int=2;
 ASSERT nal_private.commerce_os_finish_pass_resend(
  rec,(job->>'leaseId')::uuid,true)='sent';
 ASSERT nal_private.commerce_os_finish_pass_resend(
  rec,(job->>'leaseId')::uuid,true)='stale';
 ASSERT nal_private.commerce_os_lease_pass_resend(rec) IS NULL;
 ASSERT NOT nal_private.commerce_os_queue_pass_resend(
  v,repeat('a',64),'aaaa0000-1111-4111-8111-333333333333');

 -- Time simulation only inside disposable fixture. Real orders have no
 -- privileged UI for backdating the queue.
 UPDATE nal_private.commerce_os_pass_resend_jobs
 SET created_at=now()-interval '16 minutes' WHERE order_id=v;
 ASSERT nal_private.commerce_os_queue_pass_resend(
  v,repeat('a',64),'aaaa0000-1111-4111-8111-333333333333');
 ASSERT (SELECT count(*) FROM nal_private.commerce_os_pass_resend_jobs WHERE order_id=v)=2;
 RAISE NOTICE 'NAL P7-E reading: original purchase proof, idempotent request, 15-minute cooldown, retry/lease PASS';
END $reading$;

DO $class$
DECLARE v uuid; response jsonb; job jsonb; resend_id uuid;
BEGIN
 response:=nal_private.commerce_os_begin_order(
  '62626262-6262-4262-8262-626262626262','class-resend@example.invalid',
  repeat('b',64),'class-delivery','88888888-8888-4888-8888-888888888888',
  'testpg','provider-resend-class','merchant-fixture');
 v:=(response->>'orderId')::uuid;
 PERFORM nal_private.commerce_os_apply_provider(
  v,'provider-resend-class','merchant-fixture','payment-resend-class',
  35000,'KRW','DONE','event-resend-class-paid',true);
 ASSERT nal_private.commerce_os_queue_pass_resend(
  v,repeat('b',64),'bbbb0000-1111-4111-8111-111111111111');
 SELECT id INTO resend_id FROM nal_private.commerce_os_pass_resend_jobs WHERE order_id=v;
 job:=nal_private.commerce_os_lease_pass_resend(resend_id);
 ASSERT job->>'kind'='class_pass';
 PERFORM nal_private.commerce_os_apply_provider(
  v,'provider-resend-class','merchant-fixture','payment-resend-class',
  35000,'KRW','CANCELED','event-resend-class-refunded',true);
 ASSERT (SELECT state FROM nal_private.commerce_os_pass_resend_jobs WHERE id=resend_id)='cancelled';
 ASSERT nal_private.commerce_os_finish_pass_resend(
  resend_id,(job->>'leaseId')::uuid,true)='stale';
 ASSERT nal_private.commerce_os_lease_pass_resend(resend_id) IS NULL;
 ASSERT NOT nal_private.commerce_os_queue_pass_resend(
  v,repeat('b',64),'bbbb0000-1111-4111-8111-222222222222');
 ASSERT NOT nal_private.commerce_os_can_deliver(v,repeat('b',64),'class_pass');
 RAISE NOTICE 'NAL P7-E class: paid-only resend and refund cancels even in-flight lease PASS';
END $class$;

-- Prepare paid reading order for parallel request and worker lease tests.
DO $race$
DECLARE v uuid; response jsonb;
BEGIN
 response:=nal_private.commerce_os_begin_order(
  '63636363-6363-4363-8363-636363636363','race-resend@example.invalid',
  repeat('c',64),'read-delivery','99999999-9999-4999-8999-999999999999',
  'testpg','provider-resend-race','merchant-fixture');
 v:=(response->>'orderId')::uuid;
 PERFORM nal_private.commerce_os_apply_provider(
  v,'provider-resend-race','merchant-fixture','payment-resend-race',
  19000,'KRW','DONE','event-resend-race-paid',true);
 ASSERT (SELECT status FROM nal_private.commerce_os_orders WHERE id=v)='paid';
 RAISE NOTICE 'NAL P7-E concurrent resend fixture prepared';
END $race$;
RESET ROLE;
SELECT 'NAL P7-E private resend, cooldown and refund SQL assertions PASS' AS result;
