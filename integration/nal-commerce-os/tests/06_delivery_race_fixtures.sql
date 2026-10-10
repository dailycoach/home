\set ON_ERROR_STOP on
DO $isolated$ BEGIN
 IF current_database()<>'nal_ci_ledger' THEN RAISE EXCEPTION 'NOT_EPHEMERAL_DB'; END IF;
END $isolated$;
SET ROLE service_role;

DO $create_races$
DECLARE v_oid uuid; v jsonb;
BEGIN
 v:=nal_private.commerce_os_begin_order(
  '40404040-4040-4040-8040-404040404040','mail-race@example.invalid',repeat('e',64),
  'pdf-delivery',NULL,'testpg','provider-delivery-race-mail','merchant-fixture');
 v_oid:=(v->>'orderId')::uuid;
 PERFORM nal_private.commerce_os_apply_provider(
  v_oid,'provider-delivery-race-mail','merchant-fixture','key-delivery-race-mail',
  4900,'KRW','DONE','evt-delivery-race-mail-paid',true);
 ASSERT (SELECT state FROM nal_private.commerce_os_delivery_jobs
  WHERE order_id=v_oid AND event_kind='grant')='queued';

 v:=nal_private.commerce_os_begin_order(
  '50505050-5050-4050-8050-505050505050','pass-race@example.invalid',repeat('f',64),
  'read-delivery','55555555-5555-4555-8555-555555555555','testpg',
  'provider-delivery-race-pass','merchant-fixture');
 v_oid:=(v->>'orderId')::uuid;
 PERFORM nal_private.commerce_os_apply_provider(
  v_oid,'provider-delivery-race-pass','merchant-fixture','key-delivery-race-pass',
  19000,'KRW','DONE','evt-delivery-race-pass-paid',true);
 ASSERT nal_private.commerce_os_issue_pass_claim(
  v_oid,repeat('9',64),now()+interval '24 hours');
 RAISE NOTICE 'NAL P7-D ephemeral email and pass lease race fixtures prepared';
END $create_races$;
RESET ROLE;
