\set ON_ERROR_STOP on
DO $gate$ BEGIN
 IF current_database()<>'nal_ci_ledger' THEN
  RAISE EXCEPTION 'Do not run P7-C assertions on production'; END IF;
END $gate$;
SET ROLE service_role;

DO $test$
DECLARE o uuid; info jsonb; item jsonb; x jsonb;
BEGIN
 x:=nal_private.commerce_os_begin_order(
  '12345678-1234-4234-8234-123456789abc','bridge@example.invalid',repeat('f',64),
  'pdf-test',NULL,'testpg','provider-bridge-pdf-01','merchant-fixture');
 o:=(x->>'orderId')::uuid;
 ASSERT x->>'amountWon'='6900'; -- prior P7-B test changed the live catalog fixture
 info:=nal_private.commerce_os_order_by_claim(o,repeat('f',64));
 ASSERT info->>'id'=o::text;
 ASSERT info->>'productId'='pdf-test';
 ASSERT info->>'fileVersion'='next-edition';
 ASSERT info->>'kind'='pdf';
 ASSERT info->>'status'='pending';
 ASSERT info->>'merchantId'='merchant-fixture';
 ASSERT NOT (info ? 'buyer_email') AND NOT (info ? 'claim_digest');
 ASSERT nal_private.commerce_os_order_by_claim(o,repeat('e',64)) IS NULL;
 ASSERT NOT nal_private.commerce_os_queue_receipt(o);
 ASSERT NOT nal_private.commerce_os_issue_receipt(o,repeat('a',64),now()+interval '45 minutes');

 PERFORM nal_private.commerce_os_apply_provider(
  o,'provider-bridge-pdf-01','merchant-fixture','payment-bridge-01',6900,'KRW',
  'DONE','bridge-payment-paid',true);
 ASSERT (nal_private.commerce_os_order_by_claim(o,repeat('f',64)))->>'status'='paid';
 ASSERT nal_private.commerce_os_queue_receipt(o);
 ASSERT nal_private.commerce_os_queue_receipt(o);
 ASSERT (SELECT count(*) FROM nal_private.commerce_os_receipt_outbox WHERE order_id=o)=1;

 ASSERT nal_private.commerce_os_issue_receipt(o,repeat('a',64),now()+interval '45 minutes');
 item:=nal_private.commerce_os_reserve_receipt(o,repeat('a',64));
 ASSERT item->>'id'=o::text;
 ASSERT nal_private.commerce_os_reserve_receipt(o,repeat('a',64)) IS NULL;
 ASSERT nal_private.commerce_os_can_receipt_deliver(o,repeat('a',64));
 ASSERT NOT nal_private.commerce_os_finish_receipt(o,repeat('a',64),false);
 ASSERT NOT nal_private.commerce_os_can_receipt_deliver(o,repeat('a',64));
 ASSERT (nal_private.commerce_os_reserve_receipt(o,repeat('a',64)))->>'status'='paid';
 ASSERT nal_private.commerce_os_finish_receipt(o,repeat('a',64),true);
 ASSERT nal_private.commerce_os_reserve_receipt(o,repeat('a',64)) IS NULL;
 ASSERT (SELECT state FROM nal_private.commerce_os_receipt_tokens
   WHERE order_id=o AND token_digest=repeat('a',64))='redeemed';

 ASSERT nal_private.commerce_os_issue_receipt(o,repeat('b',64),now()+interval '45 minutes');
 ASSERT (nal_private.commerce_os_reserve_receipt(o,repeat('b',64)))->>'status'='paid';
 PERFORM nal_private.commerce_os_apply_provider(o,'provider-bridge-pdf-01','merchant-fixture',
  'payment-bridge-01',6900,'KRW','CANCELED','bridge-payment-refund',true);
 ASSERT NOT nal_private.commerce_os_can_receipt_deliver(o,repeat('b',64));
 ASSERT NOT nal_private.commerce_os_finish_receipt(o,repeat('b',64),true);
 ASSERT NOT nal_private.commerce_os_queue_receipt(o);
 ASSERT NOT nal_private.commerce_os_issue_receipt(o,repeat('c',64),now()+interval '45 minutes');
 ASSERT nal_private.commerce_os_reserve_receipt(o,repeat('b',64)) IS NULL;
 ASSERT (nal_private.commerce_os_order_by_claim(o,repeat('f',64)))->>'status'='refunded';
 RAISE NOTICE 'NAL P7-C guest DB bridge: claims, masked lookup, idempotent outbox, one-use email token and post-refund denial PASS';
END $test$;

-- Separate paid order with a one-time receipt for parallel redemption race.
DO $race$
DECLARE o uuid; x jsonb;
BEGIN
 x:=nal_private.commerce_os_begin_order(
  '9c067463-4d98-492c-8d13-5ca341a08c3d','race-receipt@example.invalid',repeat('d',64),
  'pdf-test',NULL,'testpg','provider-bridge-receipt-race','merchant-fixture');
 o:=(x->>'orderId')::uuid;
 PERFORM nal_private.commerce_os_apply_provider(
  o,'provider-bridge-receipt-race','merchant-fixture','payment-receipt-race',6900,'KRW',
  'DONE','receipt-race-paid',true);
 ASSERT nal_private.commerce_os_queue_receipt(o);
 ASSERT nal_private.commerce_os_issue_receipt(o,repeat('c',64),now()+interval '45 minutes');
 RAISE NOTICE 'NAL P7-C email receipt concurrency fixture prepared, order %',o;
END $race$;

RESET ROLE;
SELECT 'NAL P7-C actual isolated Postgres receipt and lookup assertions PASS' AS result;
