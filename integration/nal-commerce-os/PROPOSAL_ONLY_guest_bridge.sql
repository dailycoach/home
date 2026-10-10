-- NAL P7-C · Guest checkout bridge + receipt durability
-- PROPOSAL ONLY. Run only after P7-B in disposable nal_ci_ledger Postgres.
-- NOT Supabase migration. NO migration to real customers.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
 IF current_database() IS DISTINCT FROM 'nal_ci_ledger'
   OR current_setting('nal.commerce_os_ci_approval',true) IS DISTINCT FROM 'isolated'
 THEN RAISE EXCEPTION 'P7-C MAY RUN ONLY ON EXPLICITLY APPROVED EPHEMERAL TEST DB'
   USING ERRCODE='42501'; END IF;
END $guard$;

CREATE TABLE nal_private.commerce_os_receipt_outbox (
 order_id uuid PRIMARY KEY REFERENCES nal_private.commerce_os_orders(id),
 status text NOT NULL DEFAULT 'queued'
  CHECK(status IN('queued','sending','retry','sent','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 20),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commerce_os_receipt_outbox_due
 ON nal_private.commerce_os_receipt_outbox(next_attempt_at)
 WHERE status IN('queued','retry');

CREATE TABLE nal_private.commerce_os_receipt_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES nal_private.commerce_os_orders(id),
 token_digest char(64) NOT NULL UNIQUE CHECK(token_digest ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'new'
  CHECK(state IN('new','reserved','redeemed','revoked')),
 reserved_until timestamptz,
 redeemed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(
   (state='reserved' AND reserved_until IS NOT NULL)
   OR (state<>'reserved' AND reserved_until IS NULL)
 ),
 CHECK(expires_at>created_at)
);
CREATE INDEX commerce_os_receipt_tokens_order
 ON nal_private.commerce_os_receipt_tokens(order_id,expires_at);

-- A private read projection. Absolutely no email, claim digest, secret,
-- payment raw payload, bank/card data or Storage object path is returned.
CREATE FUNCTION nal_private.commerce_os_order_by_claim(
 p_order_id uuid,p_claim_digest text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT jsonb_build_object(
   'id',o.id::text,'productId',l.offer_id,'kind',l.kind,
   'slotId',l.slot_id::text,'status',o.status,
   'amountWon',o.amount_won,'currency',o.currency,
   'fileVersion',l.edition_snapshot,'orderName',l.title_snapshot,
   'providerCode',o.provider_code,'providerOrderId',o.provider_order_id,
   'merchantId',o.merchant_id,
   'paymentKey',o.provider_payment_key,
   'revoked',o.revoked_at IS NOT NULL)
 FROM nal_private.commerce_os_orders o
 JOIN nal_private.commerce_os_order_lines l ON l.order_id=o.id
 WHERE current_user='service_role'
   AND o.id=p_order_id
   AND p_claim_digest ~ '^[a-f0-9]{64}$'
   AND o.claim_digest=p_claim_digest
 LIMIT 1
$fn$;

-- Idempotent receipt email queue; source-only worker sends email separately.
CREATE FUNCTION nal_private.commerce_os_queue_receipt(p_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE o nal_private.commerce_os_orders%rowtype;
BEGIN
 IF current_user<>'service_role' THEN
   RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'paid' OR o.revoked_at IS NOT NULL
 OR NOT nal_private.commerce_os_can_deliver(o.id,o.claim_digest,'private_pdf')
 THEN RETURN false; END IF;
 INSERT INTO nal_private.commerce_os_receipt_outbox(order_id)
 VALUES(o.id) ON CONFLICT(order_id) DO NOTHING;
 RETURN true;
END $fn$;

-- Worker can create token digest only for a paid, unreversed order. Token
-- secret is NOT stored; only the digest needed for one-time redemption.
CREATE FUNCTION nal_private.commerce_os_issue_receipt(
 p_order_id uuid,p_token_digest text,p_expires_at timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE o nal_private.commerce_os_orders%rowtype;
BEGIN
 IF current_user<>'service_role' THEN
   RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_token_digest IS NULL OR p_token_digest !~ '^[a-f0-9]{64}$'
 OR p_expires_at IS NULL
 OR p_expires_at < now()+interval '5 minutes'
 OR p_expires_at > now()+interval '60 minutes'
 THEN RAISE EXCEPTION 'INVALID_RECEIPT_WINDOW' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'paid' OR o.revoked_at IS NOT NULL
 OR NOT nal_private.commerce_os_can_deliver(o.id,o.claim_digest,'private_pdf')
 OR NOT EXISTS(SELECT 1 FROM nal_private.commerce_os_receipt_outbox q
     WHERE q.order_id=o.id AND q.status IN('queued','sending','retry'))
 THEN RETURN false; END IF;
 IF (SELECT count(*) FROM nal_private.commerce_os_receipt_tokens
       WHERE order_id=o.id AND state IN('new','reserved') AND expires_at>now())>=5
 THEN RAISE EXCEPTION 'TOO_MANY_ACTIVE_RECEIPTS' USING ERRCODE='23514'; END IF;
 INSERT INTO nal_private.commerce_os_receipt_tokens(order_id,token_digest,expires_at)
 VALUES(o.id,p_token_digest,p_expires_at);
 RETURN true;
END $fn$;

-- Locks order then one token; concurrent use can reserve once. A crashed
-- reservation can be retried only AFTER a short server-side reservation TTL.
CREATE FUNCTION nal_private.commerce_os_reserve_receipt(
 p_order_id uuid,p_token_digest text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE o nal_private.commerce_os_orders%rowtype;
  t nal_private.commerce_os_receipt_tokens%rowtype;
BEGIN
 IF current_user<>'service_role' THEN
   RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_token_digest IS NULL OR p_token_digest !~ '^[a-f0-9]{64}$'
 THEN RETURN NULL; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.status<>'paid' OR o.revoked_at IS NOT NULL
 OR NOT nal_private.commerce_os_can_deliver(o.id,o.claim_digest,'private_pdf')
 THEN RETURN NULL; END IF;
 SELECT * INTO t FROM nal_private.commerce_os_receipt_tokens
 WHERE order_id=o.id AND token_digest=p_token_digest FOR UPDATE;
 IF NOT FOUND OR t.expires_at<=now()
 OR (t.state NOT IN('new','reserved'))
 OR (t.state='reserved' AND t.reserved_until>now()) THEN RETURN NULL; END IF;
 UPDATE nal_private.commerce_os_receipt_tokens
 SET state='reserved',reserved_until=now()+interval '2 minutes'
 WHERE id=t.id;
 RETURN nal_private.commerce_os_order_by_claim(o.id,o.claim_digest);
END $fn$;

-- A false finish releases the short reservation, not the paid entitlement.
-- A true finish consumes this token irreversibly.
CREATE FUNCTION nal_private.commerce_os_finish_receipt(
 p_order_id uuid,p_token_digest text,p_issued boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE o nal_private.commerce_os_orders%rowtype;
  t nal_private.commerce_os_receipt_tokens%rowtype;
BEGIN
 IF current_user<>'service_role' THEN
   RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_token_digest IS NULL OR p_token_digest !~ '^[a-f0-9]{64}$' OR p_issued IS NULL
 THEN RETURN false; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO t FROM nal_private.commerce_os_receipt_tokens
 WHERE order_id=o.id AND token_digest=p_token_digest FOR UPDATE;
 IF NOT FOUND OR t.state<>'reserved' THEN RETURN false; END IF;
 IF p_issued IS FALSE THEN
   UPDATE nal_private.commerce_os_receipt_tokens
   SET state='new',reserved_until=NULL WHERE id=t.id;
   RETURN false;
 END IF;
 IF t.reserved_until<=now() OR t.expires_at<=now()
 OR o.status<>'paid' OR o.revoked_at IS NOT NULL
 OR NOT nal_private.commerce_os_can_deliver(o.id,o.claim_digest,'private_pdf')
 THEN RETURN false; END IF;
 UPDATE nal_private.commerce_os_receipt_tokens
 SET state='redeemed',reserved_until=NULL,redeemed_at=now() WHERE id=t.id;
 RETURN true;
END $fn$;

-- Private signer proof checks token is currently reserved; actual PDF object
-- lookup and Storage signature are separate server-only components.
CREATE FUNCTION nal_private.commerce_os_can_receipt_deliver(
 p_order_id uuid,p_token_digest text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT current_user='service_role' AND p_token_digest ~ '^[a-f0-9]{64}$'
 AND EXISTS(
   SELECT 1 FROM nal_private.commerce_os_receipt_tokens t
   JOIN nal_private.commerce_os_orders o ON o.id=t.order_id
   WHERE t.order_id=p_order_id AND t.token_digest=p_token_digest
     AND t.state='reserved' AND t.reserved_until>now() AND t.expires_at>now()
     AND nal_private.commerce_os_can_deliver(o.id,o.claim_digest,'private_pdf')
 )
$fn$;

ALTER TABLE nal_private.commerce_os_receipt_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE nal_private.commerce_os_receipt_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE
 nal_private.commerce_os_receipt_outbox,nal_private.commerce_os_receipt_tokens
 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE
 nal_private.commerce_os_receipt_outbox,nal_private.commerce_os_receipt_tokens
 TO service_role;
REVOKE ALL ON FUNCTION
 nal_private.commerce_os_order_by_claim(uuid,text),
 nal_private.commerce_os_queue_receipt(uuid),
 nal_private.commerce_os_issue_receipt(uuid,text,timestamptz),
 nal_private.commerce_os_reserve_receipt(uuid,text),
 nal_private.commerce_os_finish_receipt(uuid,text,boolean),
 nal_private.commerce_os_can_receipt_deliver(uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION
 nal_private.commerce_os_order_by_claim(uuid,text),
 nal_private.commerce_os_queue_receipt(uuid),
 nal_private.commerce_os_issue_receipt(uuid,text,timestamptz),
 nal_private.commerce_os_reserve_receipt(uuid,text),
 nal_private.commerce_os_finish_receipt(uuid,text,boolean),
 nal_private.commerce_os_can_receipt_deliver(uuid,text)
 TO service_role;
COMMIT;
