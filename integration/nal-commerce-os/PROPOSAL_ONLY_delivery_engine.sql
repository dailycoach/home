-- NAL COMMERCE OS P7-D / UNIFIED FULFILLMENT DELIVERY
-- Proposal only, NOT a Supabase migration. Installs exclusively in the
-- disposable PostgreSQL 16 CI database after P7-B and P7-C fixtures.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
 IF current_database() IS DISTINCT FROM 'nal_ci_ledger'
 OR current_setting('nal.commerce_os_ci_approval',true) IS DISTINCT FROM 'isolated'
 THEN RAISE EXCEPTION 'P7-D UNIFIED DELIVERY MAY RUN ONLY IN ISOLATED TEST DB'
 USING ERRCODE='42501'; END IF;
END $guard$;

-- Exactly ONE current notification per order/event type. Delivery jobs are
-- NOT payments, reservations, emails or grants of authorization.
CREATE TABLE nal_private.commerce_os_delivery_jobs (
 order_id uuid NOT NULL REFERENCES nal_private.commerce_os_orders(id),
 event_kind text NOT NULL CHECK(event_kind IN('grant','revoke')),
 fulfillment_kind text NOT NULL CHECK(fulfillment_kind IN('private_pdf','reading_pass','class_pass')),
 state text NOT NULL DEFAULT 'queued'
   CHECK(state IN('queued','leased','retry','sent','cancelled','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 lease_id uuid,
 lease_until timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(order_id,event_kind),
 CHECK((state='leased' AND lease_id IS NOT NULL AND lease_until IS NOT NULL)
 OR (state<>'leased' AND lease_id IS NULL AND lease_until IS NULL)),
 CHECK(error_code IS NULL OR error_code ~ '^[A-Z_]{1,40}$')
);
CREATE INDEX commerce_os_delivery_due ON nal_private.commerce_os_delivery_jobs(next_attempt_at)
 WHERE state IN('queued','retry','leased');

-- Separate program-pass bearer proofs; PDF keeps the existing P7-C
-- commerce_os_receipt_tokens. NO raw token appears in the database.
CREATE TABLE nal_private.commerce_os_pass_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES nal_private.commerce_os_orders(id),
 fulfillment_kind text NOT NULL CHECK(fulfillment_kind IN('reading_pass','class_pass')),
 token_digest char(64) NOT NULL UNIQUE CHECK(token_digest ~ '^[a-f0-9]{64}$'),
 state text NOT NULL DEFAULT 'new'
   CHECK(state IN('new','reserved','redeemed','revoked')),
 expires_at timestamptz NOT NULL,
 reserved_until timestamptz,
 redeemed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(expires_at>created_at),
 CHECK((state='reserved' AND reserved_until IS NOT NULL)
 OR (state<>'reserved' AND reserved_until IS NULL))
);
CREATE INDEX commerce_os_pass_claims_order ON nal_private.commerce_os_pass_claims(order_id,expires_at);

-- Trigger executes INSIDE P7-B provider settlement transaction.
-- The ledger is the source of truth: creating an active fulfillment queues
-- one confirmation. Revoking it cancels undelivered confirmations, invalidates
-- pending pass claims, and queues ONE cancellation notice.
CREATE FUNCTION nal_private.commerce_os_after_fulfillment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'DELIVERY_SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' AND NEW.status='active' THEN
  INSERT INTO nal_private.commerce_os_delivery_jobs(order_id,event_kind,fulfillment_kind)
  VALUES(NEW.order_id,'grant',NEW.kind)
  ON CONFLICT(order_id,event_kind) DO NOTHING;
 ELSIF TG_OP='UPDATE' AND OLD.status='active' AND NEW.status='revoked' THEN
  UPDATE nal_private.commerce_os_delivery_jobs
   SET state='cancelled',lease_id=NULL,lease_until=NULL,updated_at=now()
   WHERE order_id=NEW.order_id AND event_kind='grant'
   AND state IN('queued','retry','leased');
  UPDATE nal_private.commerce_os_pass_claims
   SET state='revoked',reserved_until=NULL
   WHERE order_id=NEW.order_id AND state IN('new','reserved');
  INSERT INTO nal_private.commerce_os_delivery_jobs(order_id,event_kind,fulfillment_kind)
  VALUES(NEW.order_id,'revoke',NEW.kind)
  ON CONFLICT(order_id,event_kind) DO NOTHING;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER commerce_os_fulfillment_delivery
 AFTER INSERT OR UPDATE OF status ON nal_private.commerce_os_fulfillments
 FOR EACH ROW EXECUTE FUNCTION nal_private.commerce_os_after_fulfillment();

-- Lock financial order FIRST, then queued job; matches the P7-B
-- settlement (order -> fulfillment) lock order and avoids double leases.
-- Caller selects due orderIds via a separate service-only read/port.
CREATE FUNCTION nal_private.commerce_os_lease_delivery(
 p_order_id uuid,p_event_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE
 o nal_private.commerce_os_orders%rowtype;
 f nal_private.commerce_os_fulfillments%rowtype;
 j nal_private.commerce_os_delivery_jobs%rowtype;
 l nal_private.commerce_os_order_lines%rowtype;
 s nal_private.commerce_os_slots%rowtype;
 lease uuid;
 valid_state boolean;
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_order_id IS NULL OR p_event_kind NOT IN('grant','revoke')
 THEN RETURN NULL; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders
 WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO j FROM nal_private.commerce_os_delivery_jobs
 WHERE order_id=o.id AND event_kind=p_event_kind FOR UPDATE;
 IF NOT FOUND OR j.state IN('sent','cancelled','failed')
 OR j.next_attempt_at>now()
 OR (j.state='leased' AND j.lease_until>now())
 THEN RETURN NULL; END IF;
 SELECT * INTO f FROM nal_private.commerce_os_fulfillments WHERE order_id=o.id;
 SELECT * INTO l FROM nal_private.commerce_os_order_lines WHERE order_id=o.id;
 valid_state:=f.order_id IS NOT NULL AND f.kind=j.fulfillment_kind
 AND ( (p_event_kind='grant' AND o.status='paid' AND o.revoked_at IS NULL
   AND f.status='active' AND f.revoked_at IS NULL)
 OR (p_event_kind='revoke' AND o.status IN('refund_requested','refunded')
   AND o.revoked_at IS NOT NULL AND f.status='revoked' AND f.revoked_at IS NOT NULL) );
 IF NOT valid_state THEN
  UPDATE nal_private.commerce_os_delivery_jobs
   SET state='cancelled',lease_id=NULL,lease_until=NULL,updated_at=now()
   WHERE order_id=o.id AND event_kind=p_event_kind;
  RETURN NULL;
 END IF;
 IF p_event_kind='grant' AND f.kind IN('reading_pass','class_pass') THEN
  SELECT * INTO s FROM nal_private.commerce_os_slots WHERE id=f.slot_id;
  IF NOT FOUND OR s.slot_status<>'available' OR s.starts_at<=now()
  THEN
   UPDATE nal_private.commerce_os_delivery_jobs SET state='cancelled',
    lease_id=NULL,lease_until=NULL,updated_at=now()
   WHERE order_id=o.id AND event_kind=p_event_kind;
   RETURN NULL;
  END IF;
 END IF;
 IF j.attempts>=5 THEN
  UPDATE nal_private.commerce_os_delivery_jobs SET state='failed',
    lease_id=NULL,lease_until=NULL,error_code='RETRY_EXHAUSTED',updated_at=now()
    WHERE order_id=o.id AND event_kind=p_event_kind;
  RETURN NULL;
 END IF;
 lease:=gen_random_uuid();
 UPDATE nal_private.commerce_os_delivery_jobs
 SET state='leased',attempts=attempts+1,
   lease_id=lease,lease_until=now()+interval '2 minutes',updated_at=now()
 WHERE order_id=o.id AND event_kind=p_event_kind;
 RETURN jsonb_build_object(
  'orderId',o.id::text,'leaseId',lease::text,'eventKind',p_event_kind,
  'fulfillmentKind',f.kind,'email',o.buyer_email,
  'title',l.title_snapshot,'edition',l.edition_snapshot,
  'slotId',f.slot_id::text,'startsAt',s.starts_at,
  'attempts',j.attempts+1);
END $fn$;

-- Safe to call twice. Never marks "sent" if paid/revocation state disagrees,
-- if lease was cancelled due to refund, or if provider email send failed.
CREATE FUNCTION nal_private.commerce_os_finish_delivery(
 p_order_id uuid,p_event_kind text,p_lease_id uuid,
 p_sent boolean,p_error_code text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE
 o nal_private.commerce_os_orders%rowtype;
 f nal_private.commerce_os_fulfillments%rowtype;
 j nal_private.commerce_os_delivery_jobs%rowtype;
 allowed boolean;
 delay_minutes integer;
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_order_id IS NULL OR p_event_kind NOT IN('grant','revoke')
 OR p_lease_id IS NULL OR p_sent IS NULL
 OR (p_error_code IS NOT NULL AND p_error_code !~ '^[A-Z_]{1,40}$')
 THEN RETURN 'invalid'; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN 'missing'; END IF;
 SELECT * INTO j FROM nal_private.commerce_os_delivery_jobs
 WHERE order_id=o.id AND event_kind=p_event_kind FOR UPDATE;
 IF NOT FOUND OR j.state<>'leased' OR j.lease_id IS DISTINCT FROM p_lease_id
 OR j.lease_until<=now() THEN RETURN 'stale'; END IF;
 SELECT * INTO f FROM nal_private.commerce_os_fulfillments WHERE order_id=o.id;
 allowed:=f.kind=j.fulfillment_kind AND (
   (p_event_kind='grant' AND o.status='paid' AND o.revoked_at IS NULL AND f.status='active' AND f.revoked_at IS NULL)
   OR (p_event_kind='revoke' AND o.status IN('refund_requested','refunded') AND o.revoked_at IS NOT NULL AND f.status='revoked')
 );
 IF NOT allowed THEN
  UPDATE nal_private.commerce_os_delivery_jobs SET
   state='cancelled',lease_id=NULL,lease_until=NULL,updated_at=now()
  WHERE order_id=o.id AND event_kind=p_event_kind;
  RETURN 'cancelled';
 END IF;
 IF p_sent THEN
  UPDATE nal_private.commerce_os_delivery_jobs SET
   state='sent',lease_id=NULL,lease_until=NULL,sent_at=now(),
   error_code=NULL,updated_at=now()
  WHERE order_id=o.id AND event_kind=p_event_kind;
  RETURN 'sent';
 END IF;
 IF j.attempts>=5 THEN
  UPDATE nal_private.commerce_os_delivery_jobs SET
   state='failed',lease_id=NULL,lease_until=NULL,
   error_code=coalesce(p_error_code,'SEND_RETRY_FAILED'),updated_at=now()
  WHERE order_id=o.id AND event_kind=p_event_kind;
  RETURN 'failed';
 END IF;
 delay_minutes:=least(1<<least(j.attempts,5),30);
 UPDATE nal_private.commerce_os_delivery_jobs SET
  state='retry',lease_id=NULL,lease_until=NULL,
  next_attempt_at=now()+(delay_minutes||' minutes')::interval,
  error_code=coalesce(p_error_code,'SEND_RETRY_FAILED'),updated_at=now()
 WHERE order_id=o.id AND event_kind=p_event_kind;
 RETURN 'retry';
END $fn$;

-- Server-only program pass claim: materializes a random token digest
-- for a payment-verified attendee. No plaintext token or meeting URL.
CREATE FUNCTION nal_private.commerce_os_issue_pass_claim(
 p_order_id uuid,p_digest text,p_expire timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE o nal_private.commerce_os_orders%rowtype;
 f nal_private.commerce_os_fulfillments%rowtype;
 s nal_private.commerce_os_slots%rowtype;
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_digest IS NULL OR p_digest !~ '^[a-f0-9]{64}$'
 OR p_expire IS NULL OR p_expire<now()+interval '5 minutes'
 OR p_expire>now()+interval '48 hours' THEN
  RAISE EXCEPTION 'INVALID_PASS_CLAIM' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO f FROM nal_private.commerce_os_fulfillments WHERE order_id=p_order_id;
 IF NOT FOUND OR o.id IS NULL OR o.status<>'paid' OR o.revoked_at IS NOT NULL
 OR f.kind NOT IN('reading_pass','class_pass') OR f.status<>'active'
 OR f.revoked_at IS NOT NULL THEN RETURN false; END IF;
 SELECT * INTO s FROM nal_private.commerce_os_slots WHERE id=f.slot_id;
 IF NOT FOUND OR s.slot_status<>'available' OR s.starts_at<=now()
 THEN RETURN false; END IF;
 IF (SELECT count(*) FROM nal_private.commerce_os_pass_claims
  WHERE order_id=o.id AND state IN('new','reserved') AND expires_at>now())>=5
 THEN RAISE EXCEPTION 'TOO_MANY_PASS_CLAIMS' USING ERRCODE='23514'; END IF;
 INSERT INTO nal_private.commerce_os_pass_claims(order_id,fulfillment_kind,token_digest,expires_at)
 VALUES(o.id,f.kind,p_digest,p_expire);
 RETURN true;
END $fn$;

-- Attendee privacy: orderId is not a sufficient credential; require
-- the original random token, hashed before this DB function is called.
CREATE FUNCTION nal_private.commerce_os_reserve_pass_claim(
 p_order_id uuid,p_digest text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE o nal_private.commerce_os_orders%rowtype;
 f nal_private.commerce_os_fulfillments%rowtype;
 t nal_private.commerce_os_pass_claims%rowtype;
 s nal_private.commerce_os_slots%rowtype;
 l nal_private.commerce_os_order_lines%rowtype;
BEGIN
 IF current_user<>'service_role' THEN
  RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_order_id IS NULL OR p_digest IS NULL OR p_digest !~ '^[a-f0-9]{64}$'
 THEN RETURN NULL; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'paid' OR o.revoked_at IS NOT NULL THEN RETURN NULL; END IF;
 SELECT * INTO f FROM nal_private.commerce_os_fulfillments WHERE order_id=o.id;
 IF NOT FOUND OR f.status<>'active' OR f.revoked_at IS NOT NULL
 OR f.kind NOT IN('reading_pass','class_pass') THEN RETURN NULL; END IF;
 SELECT * INTO s FROM nal_private.commerce_os_slots WHERE id=f.slot_id;
 IF NOT FOUND OR s.slot_status<>'available' OR s.starts_at<=now() THEN RETURN NULL; END IF;
 SELECT * INTO t FROM nal_private.commerce_os_pass_claims
 WHERE order_id=o.id AND token_digest=p_digest AND fulfillment_kind=f.kind FOR UPDATE;
 IF NOT FOUND OR t.expires_at<=now() OR t.state NOT IN('new','reserved')
 OR (t.state='reserved' AND t.reserved_until>now()) THEN RETURN NULL; END IF;
 UPDATE nal_private.commerce_os_pass_claims
 SET state='reserved',reserved_until=now()+interval '2 minutes' WHERE id=t.id;
 SELECT * INTO l FROM nal_private.commerce_os_order_lines WHERE order_id=o.id;
 RETURN jsonb_build_object(
  'orderId',o.id::text,'kind',f.kind,'slotId',f.slot_id::text,
  'startsAt',s.starts_at,'title',l.title_snapshot,
  'state','confirmed');
END $fn$;

CREATE FUNCTION nal_private.commerce_os_finish_pass_claim(
 p_order_id uuid,p_digest text,p_issued boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE o nal_private.commerce_os_orders%rowtype;
 t nal_private.commerce_os_pass_claims%rowtype;
 f nal_private.commerce_os_fulfillments%rowtype;
 s nal_private.commerce_os_slots%rowtype;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_order_id IS NULL OR p_digest IS NULL OR p_digest !~ '^[a-f0-9]{64}$'
 OR p_issued IS NULL THEN RETURN false; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO t FROM nal_private.commerce_os_pass_claims
 WHERE order_id=o.id AND token_digest=p_digest FOR UPDATE;
 IF NOT FOUND OR t.state<>'reserved' OR t.reserved_until<=now()
 OR t.expires_at<=now() THEN RETURN false; END IF;
 IF NOT p_issued THEN
  UPDATE nal_private.commerce_os_pass_claims
   SET state='new',reserved_until=NULL WHERE id=t.id;
  RETURN false;
 END IF;
 SELECT * INTO f FROM nal_private.commerce_os_fulfillments WHERE order_id=o.id;
 SELECT * INTO s FROM nal_private.commerce_os_slots WHERE id=f.slot_id;
 IF o.status<>'paid' OR o.revoked_at IS NOT NULL OR f.status<>'active'
 OR f.revoked_at IS NOT NULL OR f.kind IS DISTINCT FROM t.fulfillment_kind
 OR s.slot_status<>'available' OR s.starts_at<=now()
 THEN RETURN false; END IF;
 UPDATE nal_private.commerce_os_pass_claims
 SET state='redeemed',reserved_until=NULL,redeemed_at=now() WHERE id=t.id;
 RETURN true;
END $fn$;

ALTER TABLE nal_private.commerce_os_delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nal_private.commerce_os_pass_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
 nal_private.commerce_os_delivery_jobs,nal_private.commerce_os_pass_claims
 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE
 nal_private.commerce_os_delivery_jobs,nal_private.commerce_os_pass_claims
 TO service_role;
REVOKE ALL ON FUNCTION
 nal_private.commerce_os_after_fulfillment(),
 nal_private.commerce_os_lease_delivery(uuid,text),
 nal_private.commerce_os_finish_delivery(uuid,text,uuid,boolean,text),
 nal_private.commerce_os_issue_pass_claim(uuid,text,timestamptz),
 nal_private.commerce_os_reserve_pass_claim(uuid,text),
 nal_private.commerce_os_finish_pass_claim(uuid,text,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 nal_private.commerce_os_after_fulfillment(),
 nal_private.commerce_os_lease_delivery(uuid,text),
 nal_private.commerce_os_finish_delivery(uuid,text,uuid,boolean,text),
 nal_private.commerce_os_issue_pass_claim(uuid,text,timestamptz),
 nal_private.commerce_os_reserve_pass_claim(uuid,text),
 nal_private.commerce_os_finish_pass_claim(uuid,text,boolean)
 TO service_role;
COMMIT;
