-- NAL COMMERCE OS P7-E · PRIVATE PROGRAM PASS RESEND QUEUE
-- TEST-ONLY PROPOSAL: NOT a Supabase migration or Edge deployment.
-- Run after P7-B, P7-C, P7-D in disposable CI PostgreSQL ONLY.
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
DO $isolated$
BEGIN
 IF current_database() IS DISTINCT FROM 'nal_ci_ledger'
 OR current_setting('nal.commerce_os_ci_approval',true) IS DISTINCT FROM 'isolated'
 THEN RAISE EXCEPTION 'NAL P7-E ONLY RUNS IN ISOLATED TEST POSTGRES' USING ERRCODE='42501'; END IF;
END $isolated$;

CREATE TABLE nal_private.commerce_os_pass_resend_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE,
 order_id uuid NOT NULL REFERENCES nal_private.commerce_os_orders(id),
 fulfillment_kind text NOT NULL CHECK(fulfillment_kind IN('reading_pass','class_pass')),
 state text NOT NULL DEFAULT 'queued'
 CHECK(state IN('queued','leased','retry','sent','cancelled','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 lease_id uuid,
 lease_until timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 error_code text,
 CHECK((state='leased' AND lease_id IS NOT NULL AND lease_until IS NOT NULL)
 OR (state<>'leased' AND lease_id IS NULL AND lease_until IS NULL)),
 CHECK(error_code IS NULL OR error_code ~ '^[A-Z_]{1,40}$')
);
CREATE INDEX commerce_os_pass_resend_cooldown
 ON nal_private.commerce_os_pass_resend_jobs(order_id,created_at DESC);
CREATE INDEX commerce_os_pass_resend_due
 ON nal_private.commerce_os_pass_resend_jobs(next_attempt_at)
 WHERE state IN('queued','retry','leased');

-- A real sender is forbidden until operator consent, domain verification,
-- real email service and buyer-privacy approval. The request is authenticated
-- by the original server-HMAC purchase claim digest, NOT by an email address.
-- Non-eligible requests return false to the private adapter; HTTP remains
-- generic 202 to prevent order/email existence enumeration.
CREATE FUNCTION nal_private.commerce_os_queue_pass_resend(
 p_order_id uuid,p_claim_digest text,p_request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE
 o nal_private.commerce_os_orders%rowtype;
 f nal_private.commerce_os_fulfillments%rowtype;
 s nal_private.commerce_os_slots%rowtype;
 prior nal_private.commerce_os_pass_resend_jobs%rowtype;
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_order_id IS NULL OR p_request_id IS NULL
 OR p_claim_digest IS NULL OR p_claim_digest !~ '^[a-f0-9]{64}$'
 THEN RETURN false; END IF;
 -- Serialize duplicate resend requests and cooldown checking on this order.
 SELECT * INTO o FROM nal_private.commerce_os_orders
 WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'paid' OR o.revoked_at IS NOT NULL
 OR o.claim_digest IS DISTINCT FROM p_claim_digest THEN RETURN false; END IF;
 SELECT * INTO f FROM nal_private.commerce_os_fulfillments WHERE order_id=o.id;
 IF NOT FOUND OR f.status<>'active' OR f.revoked_at IS NOT NULL
 OR f.kind NOT IN('reading_pass','class_pass')
 OR NOT nal_private.commerce_os_can_deliver(o.id,p_claim_digest,f.kind)
 THEN RETURN false; END IF;
 SELECT * INTO s FROM nal_private.commerce_os_slots WHERE id=f.slot_id;
 IF NOT FOUND OR s.slot_status<>'available' OR s.starts_at<=now()
 THEN RETURN false; END IF;
 SELECT * INTO prior FROM nal_private.commerce_os_pass_resend_jobs
 WHERE request_id=p_request_id;
 IF FOUND THEN RETURN prior.order_id IS NOT DISTINCT FROM o.id; END IF;
 -- A safe cap: max 3 per rolling 24 h, no more than one / 15 minutes.
 -- Do not allow a new request while any previous delivery remains queued.
 IF EXISTS(SELECT 1 FROM nal_private.commerce_os_pass_resend_jobs
    WHERE order_id=o.id AND created_at>now()-interval '15 minutes')
 OR EXISTS(SELECT 1 FROM nal_private.commerce_os_pass_resend_jobs
    WHERE order_id=o.id AND state IN('queued','leased','retry'))
 OR (SELECT count(*) FROM nal_private.commerce_os_pass_resend_jobs
    WHERE order_id=o.id AND created_at>now()-interval '24 hours')>=3
 THEN RETURN false; END IF;
 INSERT INTO nal_private.commerce_os_pass_resend_jobs
 (request_id,order_id,fulfillment_kind)
 VALUES(p_request_id,o.id,f.kind);
 RETURN true;
END $fn$;

-- Worker fetches candidate IDs from a private service-only query; the
-- job is claimed under order->job row locks and never returns payment data.
CREATE FUNCTION nal_private.commerce_os_lease_pass_resend(p_job_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE
 o nal_private.commerce_os_orders%rowtype;
 j nal_private.commerce_os_pass_resend_jobs%rowtype;
 f nal_private.commerce_os_fulfillments%rowtype;
 s nal_private.commerce_os_slots%rowtype;
 l nal_private.commerce_os_order_lines%rowtype;
 lease uuid;
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_job_id IS NULL THEN RETURN NULL; END IF;
 SELECT order_id INTO j.order_id FROM nal_private.commerce_os_pass_resend_jobs
 WHERE id=p_job_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders
 WHERE id=j.order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO j FROM nal_private.commerce_os_pass_resend_jobs
 WHERE id=p_job_id FOR UPDATE;
 IF NOT FOUND OR j.order_id IS DISTINCT FROM o.id
 OR j.state IN('sent','cancelled','failed')
 OR j.next_attempt_at>now()
 OR (j.state='leased' AND j.lease_until>now())
 THEN RETURN NULL; END IF;
 SELECT * INTO f FROM nal_private.commerce_os_fulfillments WHERE order_id=o.id;
 SELECT * INTO s FROM nal_private.commerce_os_slots WHERE id=f.slot_id;
 IF o.status<>'paid' OR o.revoked_at IS NOT NULL
 OR f.order_id IS NULL OR f.status<>'active' OR f.revoked_at IS NOT NULL
 OR f.kind IS DISTINCT FROM j.fulfillment_kind OR s.id IS NULL
 OR s.slot_status<>'available' OR s.starts_at<=now()
 OR NOT nal_private.commerce_os_can_deliver(o.id,o.claim_digest,j.fulfillment_kind)
 THEN
  UPDATE nal_private.commerce_os_pass_resend_jobs
   SET state='cancelled',lease_id=NULL,lease_until=NULL,updated_at=now()
  WHERE id=j.id;
  RETURN NULL;
 END IF;
 IF j.attempts>=5 THEN
  UPDATE nal_private.commerce_os_pass_resend_jobs
   SET state='failed',error_code='RETRY_EXHAUSTED',
   lease_id=NULL,lease_until=NULL,updated_at=now() WHERE id=j.id;
  RETURN NULL;
 END IF;
 SELECT * INTO l FROM nal_private.commerce_os_order_lines WHERE order_id=o.id;
 lease:=gen_random_uuid();
 UPDATE nal_private.commerce_os_pass_resend_jobs
 SET state='leased',lease_id=lease,lease_until=now()+interval '2 minutes',
  attempts=attempts+1,updated_at=now()
 WHERE id=j.id;
 RETURN jsonb_build_object(
  'jobId',j.id::text,'orderId',o.id::text,'kind',j.fulfillment_kind,
  'leaseId',lease::text,'email',o.buyer_email,
  'title',l.title_snapshot,'startsAt',s.starts_at,
  'attempts',j.attempts+1);
END $fn$;

CREATE FUNCTION nal_private.commerce_os_finish_pass_resend(
 p_job_id uuid,p_lease_id uuid,p_sent boolean)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE
 o nal_private.commerce_os_orders%rowtype;
 j nal_private.commerce_os_pass_resend_jobs%rowtype;
 f nal_private.commerce_os_fulfillments%rowtype;
 s nal_private.commerce_os_slots%rowtype;
 minutes_delay integer;
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_job_id IS NULL OR p_lease_id IS NULL OR p_sent IS NULL
 THEN RETURN 'invalid'; END IF;
 SELECT order_id INTO j.order_id FROM nal_private.commerce_os_pass_resend_jobs
 WHERE id=p_job_id;
 IF NOT FOUND THEN RETURN 'missing'; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders WHERE id=j.order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN 'missing'; END IF;
 SELECT * INTO j FROM nal_private.commerce_os_pass_resend_jobs
 WHERE id=p_job_id FOR UPDATE;
 IF NOT FOUND OR j.state<>'leased'
 OR j.lease_id IS DISTINCT FROM p_lease_id OR j.lease_until<=now()
 THEN RETURN 'stale'; END IF;
 SELECT * INTO f FROM nal_private.commerce_os_fulfillments WHERE order_id=o.id;
 SELECT * INTO s FROM nal_private.commerce_os_slots WHERE id=f.slot_id;
 IF o.status<>'paid' OR o.revoked_at IS NOT NULL
 OR f.order_id IS NULL OR f.status<>'active' OR f.revoked_at IS NOT NULL
 OR f.kind IS DISTINCT FROM j.fulfillment_kind OR s.id IS NULL
 OR s.slot_status<>'available' OR s.starts_at<=now() THEN
  UPDATE nal_private.commerce_os_pass_resend_jobs
   SET state='cancelled',lease_id=NULL,lease_until=NULL,updated_at=now()
  WHERE id=j.id;
  RETURN 'cancelled';
 END IF;
 IF p_sent THEN
  UPDATE nal_private.commerce_os_pass_resend_jobs
   SET state='sent',sent_at=now(),lease_id=NULL,lease_until=NULL,updated_at=now()
  WHERE id=j.id;
  RETURN 'sent';
 END IF;
 IF j.attempts>=5 THEN
  UPDATE nal_private.commerce_os_pass_resend_jobs
   SET state='failed',error_code='RETRY_EXHAUSTED',
   lease_id=NULL,lease_until=NULL,updated_at=now() WHERE id=j.id;
  RETURN 'failed';
 END IF;
 minutes_delay:=least(1<<least(j.attempts,5),30);
 UPDATE nal_private.commerce_os_pass_resend_jobs
 SET state='retry',lease_id=NULL,lease_until=NULL,
  error_code='MAIL_RETRY_FAILED',next_attempt_at=now()+(minutes_delay||' minutes')::interval,
  updated_at=now() WHERE id=j.id;
 RETURN 'retry';
END $fn$;

-- This separate trigger runs in the SAME payment-refund transaction as the
-- P7-B entitlement revocation. Never allow a stale resend lease to report
-- success after a refund.
CREATE FUNCTION nal_private.commerce_os_cancel_pass_resend_on_refund()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF OLD.status='active' AND NEW.status='revoked' THEN
  UPDATE nal_private.commerce_os_pass_resend_jobs
   SET state='cancelled',lease_id=NULL,lease_until=NULL,updated_at=now()
  WHERE order_id=NEW.order_id AND state IN('queued','leased','retry');
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER commerce_os_cancel_program_resends
 AFTER UPDATE OF status ON nal_private.commerce_os_fulfillments
 FOR EACH ROW EXECUTE FUNCTION nal_private.commerce_os_cancel_pass_resend_on_refund();

ALTER TABLE nal_private.commerce_os_pass_resend_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE nal_private.commerce_os_pass_resend_jobs
 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE nal_private.commerce_os_pass_resend_jobs TO service_role;
REVOKE ALL ON FUNCTION
 nal_private.commerce_os_queue_pass_resend(uuid,text,uuid),
 nal_private.commerce_os_lease_pass_resend(uuid),
 nal_private.commerce_os_finish_pass_resend(uuid,uuid,boolean),
 nal_private.commerce_os_cancel_pass_resend_on_refund()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 nal_private.commerce_os_queue_pass_resend(uuid,text,uuid),
 nal_private.commerce_os_lease_pass_resend(uuid),
 nal_private.commerce_os_finish_pass_resend(uuid,uuid,boolean),
 nal_private.commerce_os_cancel_pass_resend_on_refund()
 TO service_role;
COMMIT;
