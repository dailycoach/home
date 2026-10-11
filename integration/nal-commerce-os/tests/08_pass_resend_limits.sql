\set ON_ERROR_STOP on
DO $gate$ BEGIN
 IF current_database()<>'nal_ci_ledger' THEN
  RAISE EXCEPTION 'P7-E RATE TEST MUST NOT RUN IN PRODUCTION'; END IF;
END $gate$;
SET ROLE service_role;
DO $daily$
DECLARE v uuid; r uuid; j jsonb;
BEGIN
 SELECT id INTO v FROM nal_private.commerce_os_orders
 WHERE provider_order_id='provider-resend-reading';
 ASSERT v IS NOT NULL;
 -- Two prior requests: older sent + current queued. Backdate the synthetic
 -- queued row so that we can isolate the daily cap independently of cooldown.
 UPDATE nal_private.commerce_os_pass_resend_jobs SET
 state='sent',lease_id=NULL,lease_until=NULL,sent_at=now(),
 created_at=now()-interval '16 minutes'
 WHERE order_id=v;
 ASSERT (SELECT count(*) FROM nal_private.commerce_os_pass_resend_jobs
 WHERE order_id=v)=2;
 ASSERT nal_private.commerce_os_queue_pass_resend(
 v,repeat('a',64),'aaaabbbb-cccc-4ddd-8eee-111111111111');
 ASSERT (SELECT count(*) FROM nal_private.commerce_os_pass_resend_jobs
 WHERE order_id=v)=3;
 UPDATE nal_private.commerce_os_pass_resend_jobs SET
 state='sent',lease_id=NULL,lease_until=NULL,sent_at=now(),
 created_at=now()-interval '16 minutes'
 WHERE order_id=v;
 ASSERT NOT nal_private.commerce_os_queue_pass_resend(
 v,repeat('a',64),'aaaabbbb-cccc-4ddd-8eee-222222222222');
 ASSERT (SELECT count(*) FROM nal_private.commerce_os_pass_resend_jobs
 WHERE order_id=v)=3;
 ASSERT NOT nal_private.commerce_os_queue_pass_resend(
 v,repeat('b',64),'aaaabbbb-cccc-4ddd-8eee-333333333333');
 RAISE NOTICE 'NAL P7-E 24-hour resend cap 3, different purchaser claim rejected PASS';
END $daily$;
RESET ROLE;
SELECT 'NAL P7-E rate cap and email provenance assertions PASS' AS result;
