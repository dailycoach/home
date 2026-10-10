\set ON_ERROR_STOP on
-- Must be a brand-new disposable Postgres container, never Supabase.
DO $gate$
BEGIN
 IF current_database()<>'nal_ci_ledger' THEN
   RAISE EXCEPTION 'Refusing non-ephemeral commerce ledger database';
 END IF;
END $gate$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA nal_private;
GRANT USAGE ON SCHEMA nal_private TO service_role;
SET nal.commerce_os_ci_approval='isolated';
\ir ../PROPOSAL_ONLY_unified_order_ledger.sql

SET ROLE service_role;
INSERT INTO nal_private.commerce_os_offers
(id,kind,title,description,price_won,edition,license_type,sale_status,published,policy_approved,terms_approved,file_ready,host_approved)
VALUES
 ('pdf-test','pdf','합성 테스트 PDF 도서','상품 테스트',4900,'approved-v7','personal-use','available',true,true,true,true,false),
 ('read-test','reading_circle','합성 독서모임','예약 테스트',19000,'2026-cohort','single-participant','available',true,true,true,false,true),
 ('class-test','class_session','합성 클래스','예약 테스트',35000,'2026-class','single-participant','available',true,true,true,false,true),
 ('read-race','reading_circle','합성 경쟁예약','동시성 테스트',19000,'race-v1','single-participant','available',true,true,true,false,true);
INSERT INTO nal_private.commerce_os_slots
(id,offer_id,starts_at,registration_deadline,capacity,published,slot_status)
VALUES
 ('11111111-1111-4111-8111-111111111111','read-test',now()+interval '10 days',now()+interval '9 days',1,true,'available'),
 ('22222222-2222-4222-8222-222222222222','class-test',now()+interval '10 days',now()+interval '9 days',2,true,'available'),
 ('33333333-3333-4333-8333-333333333333','read-race',now()+interval '10 days',now()+interval '9 days',1,true,'available'),
 ('44444444-4444-4444-8444-444444444444','read-race',now()+interval '11 days',now()+interval '10 days',1,true,'available');
RESET ROLE;
