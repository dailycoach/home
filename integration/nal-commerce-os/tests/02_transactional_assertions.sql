\set ON_ERROR_STOP on
-- Every statement runs only on synthetic fixtures in nal_ci_ledger.
DO $gate$ BEGIN
 IF current_database()<>'nal_ci_ledger' THEN RAISE EXCEPTION 'DO NOT RUN ON PRODUCTION'; END IF;
END $gate$;

SET ROLE anon;
DO $deny$
BEGIN
 BEGIN
  PERFORM count(*) FROM nal_private.commerce_os_orders;
  RAISE EXCEPTION 'Anon unexpectedly read private orders';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $deny$;
RESET ROLE;
SET ROLE authenticated;
DO $deny$
BEGIN
 BEGIN
  PERFORM count(*) FROM nal_private.commerce_os_orders;
  RAISE EXCEPTION 'Signed-in customer unexpectedly read private orders';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $deny$;
RESET ROLE;

SET ROLE service_role;
DO $pdf$
DECLARE
 original jsonb; duplicate jsonb; order_id uuid; booked int; event jsonb;
BEGIN
 original:=nal_private.commerce_os_begin_order(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','synthetic@example.invalid',repeat('a',64),
 'pdf-test',NULL,'testpg','provider-order-pdf-01','merchant-fixture');
 order_id:=(original->>'orderId')::uuid;
 ASSERT (original->>'amountWon')::int=4900;
 ASSERT original->>'state'='pending';

 duplicate:=nal_private.commerce_os_begin_order(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','synthetic@example.invalid',repeat('a',64),
 'pdf-test',NULL,'testpg','provider-order-pdf-01','merchant-fixture');
 ASSERT duplicate->>'idempotent'='true';
 ASSERT duplicate->>'orderId'=original->>'orderId';

 BEGIN
   PERFORM nal_private.commerce_os_begin_order(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','different@example.invalid',repeat('a',64),
    'pdf-test',NULL,'testpg','provider-order-pdf-01','merchant-fixture');
   RAISE EXCEPTION 'Reused request id accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;

 -- Even after published price/edition changes, the immutable order snapshot
 -- must remain exactly the price/version accepted by the customer.
 UPDATE nal_private.commerce_os_offers
 SET price_won=6900,edition='next-edition' WHERE id='pdf-test';
 ASSERT EXISTS(SELECT 1 FROM nal_private.commerce_os_order_lines
   WHERE order_id=order_id AND unit_amount_won=4900 AND edition_snapshot='approved-v7');

 event:=nal_private.commerce_os_apply_provider(order_id,'provider-order-pdf-01','merchant-fixture',
 'payment-pdf','4900'::int,'KRW','DONE','event-pdf-paid',true);
 ASSERT event->>'state'='paid';
 ASSERT event->>'effect'='private_pdf';
 ASSERT nal_private.commerce_os_can_deliver(order_id,repeat('a',64),'private_pdf');
 ASSERT NOT nal_private.commerce_os_can_deliver(order_id,repeat('b',64),'private_pdf');
 ASSERT NOT nal_private.commerce_os_can_deliver(order_id,repeat('a',64),'reading_pass');

 duplicate:=nal_private.commerce_os_apply_provider(order_id,'provider-order-pdf-01','merchant-fixture',
 'payment-pdf',4900,'KRW','DONE','event-pdf-paid',true);
 ASSERT duplicate->>'idempotent'='true';
 ASSERT (SELECT count(*) FROM nal_private.commerce_os_fulfillments WHERE order_id=order_id)=1;

 event:=nal_private.commerce_os_apply_provider(order_id,'provider-order-pdf-01','merchant-fixture',
 'payment-pdf',4900,'KRW','CANCELED','event-pdf-refund',true);
 ASSERT event->>'state'='refunded';
 ASSERT NOT nal_private.commerce_os_can_deliver(order_id,repeat('a',64),'private_pdf');
 ASSERT EXISTS(SELECT 1 FROM nal_private.commerce_os_fulfillments
   WHERE order_id=order_id AND status='revoked' AND revoked_at IS NOT NULL);

 BEGIN
   PERFORM nal_private.commerce_os_apply_provider(order_id,'provider-order-pdf-01','merchant-fixture',
     'payment-pdf',4900,'KRW','DONE','late-paid-observation',true);
   RAISE EXCEPTION 'Refunded order re-granted PDF';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 ASSERT (SELECT status FROM nal_private.commerce_os_orders WHERE id=order_id)='refunded';

 BEGIN
   PERFORM nal_private.commerce_os_apply_provider(order_id,'provider-order-pdf-01','merchant-fixture',
     'payment-pdf',4999,'KRW','DONE','mismatched-amount',true);
   RAISE EXCEPTION 'Mismatched payment price accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
   PERFORM nal_private.commerce_os_apply_provider(order_id,'provider-order-pdf-01','merchant-fixture',
     'payment-pdf',4900,'KRW','DONE','unverified',false);
   RAISE EXCEPTION 'Unverified browser payment accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 RAISE NOTICE 'NAL P7-B PDF: immutable snapshots, idempotency, verified DONE, refund and stale replay PASS';
END $pdf$;

DO $reading$
DECLARE o uuid; v jsonb; slot uuid:='11111111-1111-4111-8111-111111111111';
BEGIN
 v:=nal_private.commerce_os_begin_order(
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','reader@example.invalid',repeat('b',64),
 'read-test',slot,'testpg','provider-order-reading-01','merchant-fixture');
 o:=(v->>'orderId')::uuid;
 ASSERT (SELECT held_count FROM nal_private.commerce_os_slots WHERE id=slot)=1;
 ASSERT (SELECT confirmed_count FROM nal_private.commerce_os_slots WHERE id=slot)=0;

 BEGIN
  PERFORM nal_private.commerce_os_begin_order(
   'cccccccc-cccc-4ccc-8ccc-cccccccccccc','reader2@example.invalid',repeat('c',64),
   'read-test',slot,'testpg','provider-order-reading-02','merchant-fixture');
  RAISE EXCEPTION 'Oversold reading circle';
 EXCEPTION WHEN check_violation THEN NULL; END;

 v:=nal_private.commerce_os_apply_provider(o,'provider-order-reading-01','merchant-fixture',
 'payment-reading',19000,'KRW','DONE','event-reading-paid',true);
 ASSERT v->>'effect'='reading_pass';
 ASSERT (SELECT held_count FROM nal_private.commerce_os_slots WHERE id=slot)=0;
 ASSERT (SELECT confirmed_count FROM nal_private.commerce_os_slots WHERE id=slot)=1;
 ASSERT nal_private.commerce_os_can_deliver(o,repeat('b',64),'reading_pass');

 PERFORM nal_private.commerce_os_apply_provider(o,'provider-order-reading-01','merchant-fixture',
 'payment-reading',19000,'KRW','PARTIAL_CANCELED','event-reading-partial',true);
 ASSERT (SELECT confirmed_count FROM nal_private.commerce_os_slots WHERE id=slot)=0;
 ASSERT NOT nal_private.commerce_os_can_deliver(o,repeat('b',64),'reading_pass');
 ASSERT (SELECT status FROM nal_private.commerce_os_orders WHERE id=o)='refund_requested';

 BEGIN
  PERFORM nal_private.commerce_os_apply_provider(o,'provider-order-reading-01','merchant-fixture',
   'payment-reading',19000,'KRW','DONE','event-reading-replayed',true);
  RAISE EXCEPTION 'Partially refunded reading pass restored';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;

 v:=nal_private.commerce_os_begin_order(
   'dddddddd-dddd-4ddd-8ddd-dddddddddddd','reader2@example.invalid',repeat('d',64),
   'read-test',slot,'testpg','provider-order-reading-03','merchant-fixture');
 ASSERT v->>'state'='pending';
 ASSERT (SELECT held_count FROM nal_private.commerce_os_slots WHERE id=slot)=1;
 RAISE NOTICE 'NAL P7-B reading: one-seat hold, no oversell, issue/revoke and rebooking PASS';
END $reading$;

DO $class$
DECLARE a uuid; b uuid; slot uuid:='22222222-2222-4222-8222-222222222222';v jsonb;
BEGIN
 v:=nal_private.commerce_os_begin_order(
 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','teacher@example.invalid',repeat('e',64),
 'class-test',slot,'testpg','provider-order-class-01','merchant-fixture');
 a:=(v->>'orderId')::uuid;
 v:=nal_private.commerce_os_begin_order(
 'ffffffff-ffff-4fff-8fff-ffffffffffff','learner@example.invalid',repeat('f',64),
 'class-test',slot,'testpg','provider-order-class-02','merchant-fixture');
 b:=(v->>'orderId')::uuid;
 ASSERT (SELECT held_count FROM nal_private.commerce_os_slots WHERE id=slot)=2;
 BEGIN
   PERFORM nal_private.commerce_os_begin_order(
   '00000000-0000-4000-8000-000000000001','extra@example.invalid',repeat('0',64),
   'class-test',slot,'testpg','provider-order-class-03','merchant-fixture');
   RAISE EXCEPTION 'Class oversold';
 EXCEPTION WHEN check_violation THEN NULL; END;
 PERFORM nal_private.commerce_os_apply_provider(a,'provider-order-class-01','merchant-fixture',
 'payment-class-01',35000,'KRW','DONE','event-class-01',true);
 ASSERT (SELECT confirmed_count FROM nal_private.commerce_os_slots WHERE id=slot)=1;
 ASSERT nal_private.commerce_os_can_deliver(a,repeat('e',64),'class_pass');
 PERFORM nal_private.commerce_os_apply_provider(a,'provider-order-class-01','merchant-fixture',
 'payment-class-01',35000,'KRW','CANCELED','event-class-refund',true);
 ASSERT (SELECT confirmed_count FROM nal_private.commerce_os_slots WHERE id=slot)=0;
 ASSERT (SELECT held_count FROM nal_private.commerce_os_slots WHERE id=slot)=1;
 ASSERT NOT nal_private.commerce_os_can_deliver(a,repeat('e',64),'class_pass');
 RAISE NOTICE 'NAL P7-B class: capacity 2, verified pass, refund releases one seat PASS';
END $class$;
RESET ROLE;

-- Simulate time passage in an isolated fixture ONLY. Production trigger is
-- restored immediately and real operators can never edit order expiry.
ALTER TABLE nal_private.commerce_os_orders DISABLE TRIGGER commerce_os_order_guard;
UPDATE nal_private.commerce_os_orders
 SET expires_at=now()-interval '1 minute'
 WHERE provider_order_id IN ('provider-order-class-02','provider-order-reading-03');
ALTER TABLE nal_private.commerce_os_orders ENABLE TRIGGER commerce_os_order_guard;

SET ROLE service_role;
DO $expiry$
DECLARE slot uuid:='22222222-2222-4222-8222-222222222222'; o uuid; v jsonb;
BEGIN
 SELECT id INTO o FROM nal_private.commerce_os_orders WHERE provider_order_id='provider-order-class-02';
 v:=nal_private.commerce_os_expire_order(o);
 ASSERT v->>'state'='cancelled';
 ASSERT v->>'changed'='true';
 ASSERT (SELECT held_count FROM nal_private.commerce_os_slots WHERE id=slot)=0;
 ASSERT (SELECT confirmed_count FROM nal_private.commerce_os_slots WHERE id=slot)=0;
 v:=nal_private.commerce_os_expire_order(o);
 ASSERT v->>'changed'='false';
 BEGIN
  PERFORM nal_private.commerce_os_apply_provider(o,'provider-order-class-02','merchant-fixture',
   'payment-class-02',35000,'KRW','DONE','event-class-late-done',true);
  RAISE EXCEPTION 'Expired class order gained seat';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 ASSERT NOT EXISTS(SELECT 1 FROM nal_private.commerce_os_fulfillments WHERE order_id=o);
 RAISE NOTICE 'NAL P7-B expiry: holds freed once, late payment cannot fill PASS';
END $expiry$;
RESET ROLE;

-- Charge arrives immediately AFTER reservation TTL but BEFORE cleanup:
-- mark as review_required and release the seat without issuing a pass.
ALTER TABLE nal_private.commerce_os_orders DISABLE TRIGGER commerce_os_order_guard;
UPDATE nal_private.commerce_os_orders
 SET expires_at=now()-interval '1 minute'
 WHERE provider_order_id='provider-order-reading-03';
ALTER TABLE nal_private.commerce_os_orders ENABLE TRIGGER commerce_os_order_guard;
SET ROLE service_role;
DO $late$
DECLARE o uuid; v jsonb; slot uuid:='11111111-1111-4111-8111-111111111111';
BEGIN
 SELECT id INTO o FROM nal_private.commerce_os_orders WHERE provider_order_id='provider-order-reading-03';
 v:=nal_private.commerce_os_apply_provider(o,'provider-order-reading-03','merchant-fixture',
   'payment-reading-03',19000,'KRW','DONE','event-reading-late-charge',true);
 ASSERT v->>'state'='review_required';
 ASSERT NOT EXISTS(SELECT 1 FROM nal_private.commerce_os_fulfillments WHERE order_id=o);
 ASSERT (SELECT held_count FROM nal_private.commerce_os_slots WHERE id=slot)=0;
 ASSERT (SELECT state FROM nal_private.commerce_os_seat_reservations WHERE order_id=o)='expired';
 RAISE NOTICE 'NAL P7-B late charged after expiry: manual review without overbooking PASS';
END $late$;
RESET ROLE;
SELECT 'NAL P7-B PostgreSQL transactional assertions: PASS' AS result;
