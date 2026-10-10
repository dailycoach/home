\set ON_ERROR_STOP on
DO $isolated$ BEGIN
 IF current_database()<>'nal_ci_ledger' THEN RAISE EXCEPTION 'NOT_EPHEMERAL_DB'; END IF;
END $isolated$;

-- No anonymized account or client JWT gains private delivery privileges.
SET ROLE anon;
DO $anonymous$
BEGIN
 BEGIN
  PERFORM 1 FROM nal_private.commerce_os_delivery_jobs;
  RAISE EXCEPTION 'PUBLIC_DELIVERY_TABLE_ACCESS';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM nal_private.commerce_os_lease_delivery(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'grant');
  RAISE EXCEPTION 'PUBLIC_DELIVERY_WORKER_EXECUTE';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $anonymous$;
RESET ROLE;

SET ROLE service_role;
INSERT INTO nal_private.commerce_os_offers
 (id,kind,title,description,price_won,edition,license_type,sale_status,
 published,policy_approved,terms_approved,file_ready,host_approved)
VALUES
 ('pdf-delivery','pdf','합성 이메일 PDF 도서','전달 자동화',4900,'v7-final','personal-use','available',true,true,true,true,false),
 ('read-delivery','reading_circle','합성 독서모임 참가권','전달 자동화',19000,'2026-deliv','single-participant','available',true,true,true,false,true),
 ('class-delivery','class_session','합성 강의 참가권','전달 자동화',35000,'2026-class','single-participant','available',true,true,true,false,true);
INSERT INTO nal_private.commerce_os_slots
 (id,offer_id,starts_at,registration_deadline,capacity,published,slot_status)
VALUES
 ('55555555-5555-4555-8555-555555555555','read-delivery',
  now()+interval '12 days',now()+interval '11 days',1,true,'available'),
 ('66666666-6666-4666-8666-666666666666','class-delivery',
  now()+interval '13 days',now()+interval '12 days',1,true,'available');

DO $pdf$
DECLARE v_oid uuid; v_event jsonb; v_job jsonb; v_again jsonb;
BEGIN
 v_event:=nal_private.commerce_os_begin_order(
 '10101010-1010-4010-8010-101010101010','pdf-delivery@example.invalid',repeat('a',64),
 'pdf-delivery',NULL,'testpg','provider-delivery-pdf','merchant-fixture');
 v_oid:=(v_event->>'orderId')::uuid;
 ASSERT NOT EXISTS(SELECT 1 FROM nal_private.commerce_os_delivery_jobs WHERE order_id=v_oid);
 v_event:=nal_private.commerce_os_apply_provider(
 v_oid,'provider-delivery-pdf','merchant-fixture','key-delivery-pdf',4900,'KRW',
 'DONE','evt-delivery-pdf-paid',true);
 ASSERT v_event->>'state'='paid';
 ASSERT (SELECT count(*) FROM nal_private.commerce_os_delivery_jobs
   WHERE order_id=v_oid AND event_kind='grant' AND fulfillment_kind='private_pdf')=1;
 v_again:=nal_private.commerce_os_apply_provider(
 v_oid,'provider-delivery-pdf','merchant-fixture','key-delivery-pdf',4900,'KRW',
 'DONE','evt-delivery-pdf-paid',true);
 ASSERT v_again->>'idempotent'='true';
 ASSERT (SELECT count(*) FROM nal_private.commerce_os_delivery_jobs WHERE order_id=v_oid)=1;

 v_job:=nal_private.commerce_os_lease_delivery(v_oid,'grant');
 ASSERT v_job->>'fulfillmentKind'='private_pdf';
 ASSERT v_job->>'email'='pdf-delivery@example.invalid';
 ASSERT (v_job->>'attempts')::integer=1;
 ASSERT nal_private.commerce_os_lease_delivery(v_oid,'grant') IS NULL;
 ASSERT nal_private.commerce_os_finish_delivery(
   v_oid,'grant',(v_job->>'leaseId')::uuid,false,'MAIL_TIMEOUT')='retry';
 ASSERT (SELECT state FROM nal_private.commerce_os_delivery_jobs
   WHERE order_id=v_oid AND event_kind='grant')='retry';
 ASSERT nal_private.commerce_os_lease_delivery(v_oid,'grant') IS NULL;
 UPDATE nal_private.commerce_os_delivery_jobs SET next_attempt_at=now()-interval '1 second'
 WHERE order_id=v_oid AND event_kind='grant';
 v_job:=nal_private.commerce_os_lease_delivery(v_oid,'grant');
 ASSERT (v_job->>'attempts')::integer=2;
 ASSERT nal_private.commerce_os_finish_delivery(
   v_oid,'grant',(v_job->>'leaseId')::uuid,true,NULL)='sent';
 ASSERT nal_private.commerce_os_lease_delivery(v_oid,'grant') IS NULL;
 ASSERT (SELECT attempts FROM nal_private.commerce_os_delivery_jobs
   WHERE order_id=v_oid AND event_kind='grant')=2;

 PERFORM nal_private.commerce_os_apply_provider(
 v_oid,'provider-delivery-pdf','merchant-fixture','key-delivery-pdf',4900,'KRW',
 'CANCELED','evt-delivery-pdf-refund',true);
 ASSERT NOT nal_private.commerce_os_can_deliver(v_oid,repeat('a',64),'private_pdf');
 ASSERT nal_private.commerce_os_lease_delivery(v_oid,'grant') IS NULL;
 ASSERT (SELECT count(*) FROM nal_private.commerce_os_delivery_jobs
   WHERE order_id=v_oid AND event_kind='revoke' AND state='queued')=1;
 v_job:=nal_private.commerce_os_lease_delivery(v_oid,'revoke');
 ASSERT v_job->>'eventKind'='revoke';
 ASSERT nal_private.commerce_os_finish_delivery(
  v_oid,'revoke',(v_job->>'leaseId')::uuid,true,NULL)='sent';
 ASSERT nal_private.commerce_os_lease_delivery(v_oid,'revoke') IS NULL;
 RAISE NOTICE 'P7-D PDF: payment-driven enqueue, retry, send, refund notification & no regrant PASS';
END $pdf$;

DO $reading$
DECLARE v_oid uuid; v_event jsonb; v_pass jsonb;
BEGIN
 v_event:=nal_private.commerce_os_begin_order(
 '20202020-2020-4020-8020-202020202020','read-delivery@example.invalid',repeat('b',64),
 'read-delivery','55555555-5555-4555-8555-555555555555',
 'testpg','provider-delivery-read','merchant-fixture');
 v_oid:=(v_event->>'orderId')::uuid;
 PERFORM nal_private.commerce_os_apply_provider(
  v_oid,'provider-delivery-read','merchant-fixture','key-delivery-read',19000,'KRW',
  'DONE','evt-delivery-read-paid',true);
 ASSERT (SELECT state FROM nal_private.commerce_os_delivery_jobs
   WHERE order_id=v_oid AND event_kind='grant')='queued';
 ASSERT nal_private.commerce_os_issue_pass_claim(
  v_oid,repeat('a',64),now()+interval '24 hours');
 v_pass:=nal_private.commerce_os_reserve_pass_claim(v_oid,repeat('a',64));
 ASSERT v_pass->>'kind'='reading_pass';
 ASSERT v_pass->>'state'='confirmed';
 ASSERT v_pass->>'slotId'='55555555-5555-4555-8555-555555555555';
 ASSERT NOT (v_pass ? 'buyer_email');
 ASSERT nal_private.commerce_os_reserve_pass_claim(v_oid,repeat('a',64)) IS NULL;
 ASSERT NOT nal_private.commerce_os_finish_pass_claim(v_oid,repeat('a',64),false);
 ASSERT (nal_private.commerce_os_reserve_pass_claim(v_oid,repeat('a',64)))->>'kind'='reading_pass';
 ASSERT nal_private.commerce_os_finish_pass_claim(v_oid,repeat('a',64),true);
 ASSERT nal_private.commerce_os_reserve_pass_claim(v_oid,repeat('a',64)) IS NULL;
 ASSERT (SELECT state FROM nal_private.commerce_os_pass_claims
 WHERE order_id=v_oid AND token_digest=repeat('a',64))='redeemed';
 ASSERT nal_private.commerce_os_issue_pass_claim(
  v_oid,repeat('c',64),now()+interval '24 hours');
 ASSERT (nal_private.commerce_os_reserve_pass_claim(v_oid,repeat('c',64)))->>'kind'='reading_pass';
 PERFORM nal_private.commerce_os_apply_provider(
  v_oid,'provider-delivery-read','merchant-fixture','key-delivery-read',19000,'KRW',
  'PARTIAL_CANCELED','evt-delivery-read-partial',true);
 ASSERT (SELECT state FROM nal_private.commerce_os_pass_claims
   WHERE order_id=v_oid AND token_digest=repeat('c',64))='revoked';
 ASSERT nal_private.commerce_os_reserve_pass_claim(v_oid,repeat('c',64)) IS NULL;
 ASSERT NOT nal_private.commerce_os_finish_pass_claim(v_oid,repeat('c',64),true);
 ASSERT NOT nal_private.commerce_os_issue_pass_claim(
  v_oid,repeat('d',64),now()+interval '24 hours');
 ASSERT (SELECT state FROM nal_private.commerce_os_delivery_jobs
  WHERE order_id=v_oid AND event_kind='grant')='cancelled';
 ASSERT (SELECT state FROM nal_private.commerce_os_delivery_jobs
  WHERE order_id=v_oid AND event_kind='revoke')='queued';
 RAISE NOTICE 'P7-D reading: 1-use private pass, concurrency lock, partial refund invalidation PASS';
END $reading$;

DO $class$
DECLARE v_oid uuid; v_event jsonb; v_job jsonb;
BEGIN
 v_event:=nal_private.commerce_os_begin_order(
 '30303030-3030-4030-8030-303030303030','class-delivery@example.invalid',repeat('c',64),
 'class-delivery','66666666-6666-4666-8666-666666666666',
 'testpg','provider-delivery-class','merchant-fixture');
 v_oid:=(v_event->>'orderId')::uuid;
 PERFORM nal_private.commerce_os_apply_provider(
  v_oid,'provider-delivery-class','merchant-fixture','key-delivery-class',35000,'KRW',
  'DONE','evt-delivery-class-paid',true);
 v_job:=nal_private.commerce_os_lease_delivery(v_oid,'grant');
 ASSERT v_job->>'fulfillmentKind'='class_pass';
 ASSERT v_job->>'slotId'='66666666-6666-4666-8666-666666666666';
 ASSERT v_job->>'startsAt' IS NOT NULL;
 ASSERT nal_private.commerce_os_issue_pass_claim(
  v_oid,repeat('e',64),now()+interval '24 hours');
 PERFORM nal_private.commerce_os_apply_provider(
  v_oid,'provider-delivery-class','merchant-fixture','key-delivery-class',35000,'KRW',
  'CANCELED','evt-delivery-class-refund',true);
 ASSERT (SELECT state FROM nal_private.commerce_os_delivery_jobs
  WHERE order_id=v_oid AND event_kind='grant')='cancelled';
 ASSERT nal_private.commerce_os_finish_delivery(
  v_oid,'grant',(v_job->>'leaseId')::uuid,true,NULL)='stale';
 ASSERT (SELECT state FROM nal_private.commerce_os_pass_claims
  WHERE order_id=v_oid AND token_digest=repeat('e',64))='revoked';
 ASSERT nal_private.commerce_os_reserve_pass_claim(v_oid,repeat('e',64)) IS NULL;
 ASSERT (SELECT state FROM nal_private.commerce_os_delivery_jobs
  WHERE order_id=v_oid AND event_kind='revoke')='queued';
 v_job:=nal_private.commerce_os_lease_delivery(v_oid,'revoke');
 ASSERT v_job->>'fulfillmentKind'='class_pass';
 ASSERT nal_private.commerce_os_finish_delivery(
  v_oid,'revoke',(v_job->>'leaseId')::uuid,true,NULL)='sent';
 RAISE NOTICE 'P7-D class: refund during in-flight notice cancels lease and pass claims PASS';
END $class$;
RESET ROLE;
SELECT 'NAL P7-D actual isolated SQL notification and passes PASS' AS result;
