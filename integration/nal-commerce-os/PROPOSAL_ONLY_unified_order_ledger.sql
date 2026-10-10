-- NAL COMMERCE OS P7-B · EPHEMERAL POSTGRES REFERENCE ONLY.
-- Not a Supabase migration, not an approved production change.
-- Source assumes new nal_private schema, service_role, anon, authenticated
-- provided by the isolated test bootstrap (no customer database touched).
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $review$
BEGIN
  IF current_database() IS DISTINCT FROM 'nal_ci_ledger'
     OR current_setting('nal.commerce_os_ci_approval',true) IS DISTINCT FROM 'isolated'
  THEN RAISE EXCEPTION 'NAL COMMERCE OS LEDGER MAY RUN ONLY ON EPHEMERAL TEST DB'
    USING ERRCODE='42501';
  END IF;
END $review$;

CREATE TABLE nal_private.commerce_os_offers (
  id text PRIMARY KEY CHECK(id ~ '^[a-z0-9-]{1,120}$'),
  kind text NOT NULL CHECK(kind IN ('pdf','reading_circle','class_session')),
  title text NOT NULL CHECK(length(title) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '',
  price_won integer NOT NULL CHECK(price_won>=0),
  currency text NOT NULL DEFAULT 'KRW' CHECK(currency='KRW'),
  edition text NOT NULL CHECK(length(edition) BETWEEN 1 AND 80),
  license_type text NOT NULL CHECK(license_type IN ('personal-use','single-participant')),
  sale_status text NOT NULL DEFAULT 'draft' CHECK(sale_status IN ('draft','comingSoon','available','discontinued')),
  published boolean NOT NULL DEFAULT false,
  policy_approved boolean NOT NULL DEFAULT false,
  terms_approved boolean NOT NULL DEFAULT false,
  file_ready boolean NOT NULL DEFAULT false,
  host_approved boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind='pdf' AND license_type='personal-use')
    OR (kind IN ('reading_circle','class_session') AND license_type='single-participant')
  )
);

CREATE TABLE nal_private.commerce_os_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id text NOT NULL REFERENCES nal_private.commerce_os_offers(id),
  starts_at timestamptz NOT NULL,
  registration_deadline timestamptz NOT NULL,
  capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 10000),
  held_count integer NOT NULL DEFAULT 0 CHECK(held_count>=0),
  confirmed_count integer NOT NULL DEFAULT 0 CHECK(confirmed_count>=0),
  published boolean NOT NULL DEFAULT false,
  slot_status text NOT NULL DEFAULT 'draft' CHECK(slot_status IN ('draft','available','cancelled','completed')),
  revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  CHECK(registration_deadline<starts_at),
  CHECK(held_count+confirmed_count<=capacity)
);
CREATE INDEX commerce_os_slots_by_offer ON nal_private.commerce_os_slots(offer_id,starts_at);

CREATE TABLE nal_private.commerce_os_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  buyer_email text NOT NULL CHECK(length(buyer_email) BETWEEN 5 AND 254),
  claim_digest char(64) NOT NULL CHECK(claim_digest ~ '^[a-f0-9]{64}$'),
  provider_code text NOT NULL CHECK(provider_code ~ '^[a-z][a-z0-9-]{1,30}$'),
  provider_order_id text NOT NULL UNIQUE CHECK(length(provider_order_id) BETWEEN 8 AND 200),
  merchant_id text NOT NULL CHECK(length(merchant_id) BETWEEN 1 AND 200),
  provider_payment_key text UNIQUE,
  amount_won integer NOT NULL CHECK(amount_won>=100),
  currency text NOT NULL DEFAULT 'KRW' CHECK(currency='KRW'),
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','paid','refund_requested','refunded','cancelled','review_required')),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '15 minutes'),
  paid_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status NOT IN('refunded','refund_requested') OR revoked_at IS NOT NULL)
);

CREATE TABLE nal_private.commerce_os_order_lines (
  order_id uuid PRIMARY KEY REFERENCES nal_private.commerce_os_orders(id),
  offer_id text NOT NULL REFERENCES nal_private.commerce_os_offers(id),
  kind text NOT NULL CHECK(kind IN ('pdf','reading_circle','class_session')),
  title_snapshot text NOT NULL CHECK(length(title_snapshot) BETWEEN 2 AND 120),
  edition_snapshot text NOT NULL CHECK(length(edition_snapshot) BETWEEN 1 AND 80),
  license_snapshot text NOT NULL CHECK(license_snapshot IN ('personal-use','single-participant')),
  quantity integer NOT NULL DEFAULT 1 CHECK(quantity=1),
  unit_amount_won integer NOT NULL CHECK(unit_amount_won>=100),
  currency text NOT NULL DEFAULT 'KRW' CHECK(currency='KRW'),
  slot_id uuid REFERENCES nal_private.commerce_os_slots(id),
  CHECK((kind='pdf' AND slot_id IS NULL AND license_snapshot='personal-use')
       OR (kind IN('reading_circle','class_session') AND slot_id IS NOT NULL AND license_snapshot='single-participant'))
);

CREATE TABLE nal_private.commerce_os_seat_reservations (
  order_id uuid PRIMARY KEY REFERENCES nal_private.commerce_os_orders(id),
  slot_id uuid NOT NULL REFERENCES nal_private.commerce_os_slots(id),
  state text NOT NULL CHECK(state IN ('held','confirmed','expired','released','refunded')),
  held_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE(slot_id,order_id)
);
CREATE INDEX commerce_os_active_holds ON nal_private.commerce_os_seat_reservations(slot_id,held_until)
WHERE state='held';

CREATE TABLE nal_private.commerce_os_fulfillments (
  order_id uuid PRIMARY KEY REFERENCES nal_private.commerce_os_orders(id),
  kind text NOT NULL CHECK(kind IN ('private_pdf','reading_pass','class_pass')),
  edition_snapshot text NOT NULL,
  slot_id uuid REFERENCES nal_private.commerce_os_slots(id),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK((status='active' AND revoked_at IS NULL)
     OR (status='revoked' AND revoked_at IS NOT NULL))
);

CREATE TABLE nal_private.commerce_os_provider_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES nal_private.commerce_os_orders(id),
  provider_code text NOT NULL,
  provider_event_id text NOT NULL CHECK(length(provider_event_id) BETWEEN 1 AND 200),
  payment_key text NOT NULL CHECK(length(payment_key) BETWEEN 1 AND 200),
  provider_state text NOT NULL CHECK(provider_state IN('READY','IN_PROGRESS','DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED')),
  amount_won integer NOT NULL CHECK(amount_won>=100),
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_code,provider_event_id)
);
CREATE INDEX commerce_os_provider_events_by_order ON nal_private.commerce_os_provider_events(order_id,verified_at DESC);

-- Preserve approved server snapshots and prevent a refunded order going paid.
CREATE FUNCTION nal_private.commerce_os_protect_order()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
 IF NEW.request_id IS DISTINCT FROM OLD.request_id
 OR NEW.buyer_email IS DISTINCT FROM OLD.buyer_email
 OR NEW.claim_digest IS DISTINCT FROM OLD.claim_digest
 OR NEW.provider_code IS DISTINCT FROM OLD.provider_code
 OR NEW.provider_order_id IS DISTINCT FROM OLD.provider_order_id
 OR NEW.merchant_id IS DISTINCT FROM OLD.merchant_id
 OR NEW.amount_won IS DISTINCT FROM OLD.amount_won
 OR NEW.currency IS DISTINCT FROM OLD.currency
 OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
 THEN RAISE EXCEPTION 'IMMUTABLE_ORDER_SNAPSHOT' USING ERRCODE='42501'; END IF;
 IF (OLD.status IN ('refunded','refund_requested','cancelled','review_required') OR OLD.revoked_at IS NOT NULL)
 AND NEW.status='paid'
 THEN RAISE EXCEPTION 'NO_PAYMENT_REGRANT_AFTER_TERMINAL' USING ERRCODE='42501'; END IF;
 IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL
 THEN RAISE EXCEPTION 'NO_REVOCATION_RESET' USING ERRCODE='42501'; END IF;
 NEW.updated_at=now();
 RETURN NEW;
END $fn$;
CREATE TRIGGER commerce_os_order_guard BEFORE UPDATE ON nal_private.commerce_os_orders
FOR EACH ROW EXECUTE FUNCTION nal_private.commerce_os_protect_order();

-- Only separately authenticated service-side adapters can execute financial
-- functions. A malicious browser's "verified=true" flag is never accepted by
-- any production Edge adapter (none is deployed in this PR).
CREATE FUNCTION nal_private.commerce_os_begin_order(
 p_request_id uuid,p_email text,p_claim_digest text,p_offer_id text,
 p_slot_id uuid,p_provider_code text,p_provider_order_id text,p_merchant_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE
 o nal_private.commerce_os_orders%rowtype;
 f nal_private.commerce_os_offers%rowtype;
 s nal_private.commerce_os_slots%rowtype;
 new_id uuid;
 hold_until timestamptz := now()+interval '15 minutes';
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_email IS NULL OR length(p_email) NOT BETWEEN 5 AND 254
 OR p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,30}$'
 OR p_claim_digest IS NULL OR p_claim_digest !~ '^[a-f0-9]{64}$'
 OR p_provider_code IS NULL OR p_provider_code !~ '^[a-z][a-z0-9-]{1,30}$'
 OR p_provider_order_id IS NULL OR length(p_provider_order_id) NOT BETWEEN 8 AND 200
 OR p_merchant_id IS NULL OR length(p_merchant_id) NOT BETWEEN 1 AND 200
 THEN RAISE EXCEPTION 'INVALID_ORDER_REQUEST' USING ERRCODE='22023'; END IF;
 -- Same UUID request has exactly one order, including simultaneous retries.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,153));
 SELECT * INTO o FROM nal_private.commerce_os_orders
  WHERE request_id=p_request_id FOR UPDATE;
 IF FOUND THEN
   IF o.buyer_email IS DISTINCT FROM lower(p_email)
   OR o.claim_digest IS DISTINCT FROM p_claim_digest
   OR o.provider_code IS DISTINCT FROM p_provider_code
   OR o.provider_order_id IS DISTINCT FROM p_provider_order_id
   OR o.merchant_id IS DISTINCT FROM p_merchant_id
   OR NOT EXISTS(SELECT 1 FROM nal_private.commerce_os_order_lines l
       WHERE l.order_id=o.id AND l.offer_id=p_offer_id AND l.slot_id IS NOT DISTINCT FROM p_slot_id)
   THEN RAISE EXCEPTION 'REQUEST_ID_REUSED_WITH_DIFFERENT_ORDER' USING ERRCODE='23505'; END IF;
   RETURN jsonb_build_object('orderId',o.id,'amountWon',o.amount_won,
     'state',o.status,'idempotent',true);
 END IF;
 SELECT * INTO f FROM nal_private.commerce_os_offers WHERE id=p_offer_id;
 IF NOT FOUND OR NOT f.published OR f.sale_status<>'available'
 OR NOT f.policy_approved OR NOT f.terms_approved
 OR f.price_won<100 OR f.currency<>'KRW'
 THEN RAISE EXCEPTION 'OFFER_NOT_FOR_SALE' USING ERRCODE='22023'; END IF;
 IF f.kind='pdf' THEN
   IF p_slot_id IS NOT NULL OR NOT f.file_ready OR f.license_type<>'personal-use'
   THEN RAISE EXCEPTION 'PDF_NOT_READY' USING ERRCODE='22023'; END IF;
 ELSE
   IF p_slot_id IS NULL OR NOT f.host_approved
   THEN RAISE EXCEPTION 'SESSION_NOT_READY' USING ERRCODE='22023'; END IF;
   -- Row lock is the only authority for concurrent seat availability.
   SELECT * INTO s FROM nal_private.commerce_os_slots
    WHERE id=p_slot_id AND offer_id=f.id FOR UPDATE;
   IF NOT FOUND OR NOT s.published OR s.slot_status<>'available'
    OR s.starts_at<=now() OR s.registration_deadline<=now()
    OR s.held_count+s.confirmed_count>=s.capacity
   THEN RAISE EXCEPTION 'SESSION_FULL_OR_CLOSED' USING ERRCODE='23514'; END IF;
 END IF;
 INSERT INTO nal_private.commerce_os_orders(
   request_id,buyer_email,claim_digest,provider_code,provider_order_id,
   merchant_id,amount_won,expires_at)
 VALUES(p_request_id,lower(p_email),p_claim_digest,p_provider_code,
   p_provider_order_id,p_merchant_id,f.price_won,hold_until)
 RETURNING id INTO new_id;
 INSERT INTO nal_private.commerce_os_order_lines(
   order_id,offer_id,kind,title_snapshot,edition_snapshot,license_snapshot,
   unit_amount_won,slot_id)
 VALUES(new_id,f.id,f.kind,f.title,f.edition,f.license_type,f.price_won,p_slot_id);
 IF p_slot_id IS NOT NULL THEN
   INSERT INTO nal_private.commerce_os_seat_reservations(order_id,slot_id,state,held_until)
   VALUES(new_id,p_slot_id,'held',hold_until);
   UPDATE nal_private.commerce_os_slots SET held_count=held_count+1 WHERE id=p_slot_id;
 END IF;
 RETURN jsonb_build_object('orderId',new_id,'amountWon',f.price_won,
   'state','pending','idempotent',false);
END $fn$;

-- Expire one unpaid order (safe to retry). Orchestrator may call this on each
-- stale reservation via a bounded non-production cleanup batch.
CREATE FUNCTION nal_private.commerce_os_expire_order(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE o nal_private.commerce_os_orders%rowtype; l nal_private.commerce_os_order_lines%rowtype;
 r nal_private.commerce_os_seat_reservations%rowtype;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='22023'; END IF;
 IF o.status<>'pending' OR o.expires_at>now()
 THEN RETURN jsonb_build_object('state',o.status,'changed',false); END IF;
 SELECT * INTO l FROM nal_private.commerce_os_order_lines WHERE order_id=o.id;
 IF l.slot_id IS NOT NULL THEN
   PERFORM 1 FROM nal_private.commerce_os_slots WHERE id=l.slot_id FOR UPDATE;
   SELECT * INTO r FROM nal_private.commerce_os_seat_reservations WHERE order_id=o.id FOR UPDATE;
   IF r.state='held' THEN
     UPDATE nal_private.commerce_os_seat_reservations SET state='expired',resolved_at=now() WHERE order_id=o.id;
     UPDATE nal_private.commerce_os_slots SET held_count=held_count-1 WHERE id=l.slot_id;
   END IF;
 END IF;
 UPDATE nal_private.commerce_os_orders SET status='cancelled',revoked_at=now()
 WHERE id=o.id;
 RETURN jsonb_build_object('state','cancelled','changed',true);
END $fn$;

-- This is a provider-verified *projection*, never a browser webhook payload.
-- The future Edge adapter must fetch/validate merchant, order, amount and
-- payment key independently BEFORE calling this service-role function.
CREATE FUNCTION nal_private.commerce_os_apply_provider(
 p_order_id uuid,p_provider_order_id text,p_merchant_id text,
 p_payment_key text,p_amount_won integer,p_currency text,
 p_provider_state text,p_provider_event_id text,p_server_verified boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE
 o nal_private.commerce_os_orders%rowtype;
 l nal_private.commerce_os_order_lines%rowtype;
 r nal_private.commerce_os_seat_reservations%rowtype;
 e nal_private.commerce_os_provider_events%rowtype;
 f nal_private.commerce_os_offers%rowtype;
 result_state text;
 grant_kind text;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_server_verified IS DISTINCT FROM true OR p_provider_event_id IS NULL
  OR length(p_provider_event_id) NOT BETWEEN 1 AND 200
  OR p_payment_key IS NULL OR length(p_payment_key) NOT BETWEEN 1 AND 200
  OR p_provider_state NOT IN('READY','IN_PROGRESS','DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED')
 THEN RAISE EXCEPTION 'PROVIDER_PROOF_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM nal_private.commerce_os_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.provider_order_id IS DISTINCT FROM p_provider_order_id
  OR o.merchant_id IS DISTINCT FROM p_merchant_id
  OR o.amount_won IS DISTINCT FROM p_amount_won OR p_currency IS DISTINCT FROM 'KRW'
  OR (o.provider_payment_key IS NOT NULL AND o.provider_payment_key<>p_payment_key)
 THEN RAISE EXCEPTION 'PROVIDER_PAYMENT_BINDING_CONFLICT' USING ERRCODE='23514'; END IF;
 SELECT * INTO e FROM nal_private.commerce_os_provider_events
  WHERE provider_code=o.provider_code AND provider_event_id=p_provider_event_id;
 IF FOUND THEN
   IF e.order_id IS DISTINCT FROM o.id OR e.payment_key IS DISTINCT FROM p_payment_key
    OR e.provider_state IS DISTINCT FROM p_provider_state OR e.amount_won IS DISTINCT FROM p_amount_won
   THEN RAISE EXCEPTION 'PROVIDER_EVENT_ID_REUSED' USING ERRCODE='23505'; END IF;
   RETURN jsonb_build_object('state',o.status,'idempotent',true,'effect','none');
 END IF;
 SELECT * INTO l FROM nal_private.commerce_os_order_lines WHERE order_id=o.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_LINE_MISSING' USING ERRCODE='23514'; END IF;
 IF p_provider_state='DONE' THEN
   IF o.status IN ('refunded','refund_requested','cancelled','review_required')
    OR o.revoked_at IS NOT NULL
   THEN RAISE EXCEPTION 'REFUNDED_ORDER_CANNOT_BE_REGRANTED' USING ERRCODE='42501'; END IF;
   IF o.status='pending' AND o.expires_at<=now() THEN
     -- Charged after an expired reservation: block fulfillment, require review.
     IF l.slot_id IS NOT NULL THEN
       PERFORM 1 FROM nal_private.commerce_os_slots WHERE id=l.slot_id FOR UPDATE;
       SELECT * INTO r FROM nal_private.commerce_os_seat_reservations WHERE order_id=o.id FOR UPDATE;
       IF r.state='held' THEN
         UPDATE nal_private.commerce_os_seat_reservations SET state='expired',resolved_at=now() WHERE order_id=o.id;
         UPDATE nal_private.commerce_os_slots SET held_count=held_count-1 WHERE id=l.slot_id;
       END IF;
     END IF;
     UPDATE nal_private.commerce_os_orders SET status='review_required',
       provider_payment_key=p_payment_key WHERE id=o.id;
   ELSIF o.status='pending' THEN
     IF l.kind='pdf' THEN
       SELECT * INTO f FROM nal_private.commerce_os_offers WHERE id=l.offer_id;
       IF NOT FOUND OR NOT f.file_ready THEN
         UPDATE nal_private.commerce_os_orders SET status='review_required',
           provider_payment_key=p_payment_key WHERE id=o.id;
       ELSE
         grant_kind:='private_pdf';
       END IF;
     ELSE
       PERFORM 1 FROM nal_private.commerce_os_slots WHERE id=l.slot_id FOR UPDATE;
       SELECT * INTO r FROM nal_private.commerce_os_seat_reservations WHERE order_id=o.id FOR UPDATE;
       IF NOT FOUND OR r.state<>'held' OR r.held_until<=now() THEN
         UPDATE nal_private.commerce_os_orders SET status='review_required',
           provider_payment_key=p_payment_key WHERE id=o.id;
       ELSE
         UPDATE nal_private.commerce_os_seat_reservations SET state='confirmed',
           resolved_at=now() WHERE order_id=o.id;
         UPDATE nal_private.commerce_os_slots SET held_count=held_count-1,
           confirmed_count=confirmed_count+1 WHERE id=l.slot_id;
         grant_kind:=CASE l.kind WHEN 'reading_circle' THEN 'reading_pass' ELSE 'class_pass' END;
       END IF;
     END IF;
     IF grant_kind IS NOT NULL THEN
       UPDATE nal_private.commerce_os_orders SET status='paid',
         paid_at=now(),provider_payment_key=p_payment_key WHERE id=o.id;
       INSERT INTO nal_private.commerce_os_fulfillments(
         order_id,kind,edition_snapshot,slot_id,status)
       VALUES(o.id,grant_kind,l.edition_snapshot,l.slot_id,'active');
     END IF;
   END IF;
 ELSIF p_provider_state IN ('CANCELED','PARTIAL_CANCELED') THEN
   IF o.status='cancelled' OR o.status='review_required'
   THEN RAISE EXCEPTION 'REFUND_CONFLICT_REVIEW' USING ERRCODE='23514'; END IF;
   IF o.status NOT IN ('refunded') THEN
     IF l.slot_id IS NOT NULL THEN
       PERFORM 1 FROM nal_private.commerce_os_slots WHERE id=l.slot_id FOR UPDATE;
       SELECT * INTO r FROM nal_private.commerce_os_seat_reservations WHERE order_id=o.id FOR UPDATE;
       IF r.state='held' THEN
         UPDATE nal_private.commerce_os_seat_reservations SET state='released',
           resolved_at=now() WHERE order_id=o.id;
         UPDATE nal_private.commerce_os_slots SET held_count=held_count-1 WHERE id=l.slot_id;
       ELSIF r.state='confirmed' THEN
         UPDATE nal_private.commerce_os_seat_reservations SET state='refunded',
           resolved_at=now() WHERE order_id=o.id;
         UPDATE nal_private.commerce_os_slots SET confirmed_count=confirmed_count-1 WHERE id=l.slot_id;
       END IF;
     END IF;
     UPDATE nal_private.commerce_os_fulfillments SET status='revoked',
       revoked_at=coalesce(revoked_at,now()) WHERE order_id=o.id AND status='active';
     UPDATE nal_private.commerce_os_orders SET
       status=CASE WHEN p_provider_state='CANCELED' THEN 'refunded' ELSE 'refund_requested' END,
       revoked_at=coalesce(revoked_at,now()),provider_payment_key=coalesce(provider_payment_key,p_payment_key)
       WHERE id=o.id;
   END IF;
 ELSIF p_provider_state IN ('ABORTED','EXPIRED') THEN
   IF o.status<>'pending' THEN
     RAISE EXCEPTION 'STALE_PROVIDER_EXPIRY' USING ERRCODE='23514'; END IF;
   IF l.slot_id IS NOT NULL THEN
     PERFORM 1 FROM nal_private.commerce_os_slots WHERE id=l.slot_id FOR UPDATE;
     SELECT * INTO r FROM nal_private.commerce_os_seat_reservations WHERE order_id=o.id FOR UPDATE;
     IF r.state='held' THEN
       UPDATE nal_private.commerce_os_seat_reservations SET state='released',
         resolved_at=now() WHERE order_id=o.id;
       UPDATE nal_private.commerce_os_slots SET held_count=held_count-1 WHERE id=l.slot_id;
     END IF;
   END IF;
   UPDATE nal_private.commerce_os_orders SET status='cancelled',revoked_at=now(),
     provider_payment_key=p_payment_key WHERE id=o.id;
 ELSE
   IF o.status<>'pending' THEN RAISE EXCEPTION 'LATE_NONFINAL_PROVIDER_STATE' USING ERRCODE='23514'; END IF;
 END IF;
 INSERT INTO nal_private.commerce_os_provider_events(
   order_id,provider_code,provider_event_id,payment_key,provider_state,amount_won)
 VALUES(o.id,o.provider_code,p_provider_event_id,p_payment_key,p_provider_state,p_amount_won);
 SELECT status INTO result_state FROM nal_private.commerce_os_orders WHERE id=o.id;
 RETURN jsonb_build_object('state',result_state,'idempotent',false,
   'effect',CASE
     WHEN grant_kind IS NOT NULL THEN grant_kind
     WHEN p_provider_state IN('CANCELED','PARTIAL_CANCELED') THEN 'revoke'
     ELSE 'none' END);
END $fn$;

-- Read-only entitlement predicates (NOT a signed-URL issuer).
CREATE FUNCTION nal_private.commerce_os_can_deliver(
 p_order_id uuid,p_claim_digest text,p_kind text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $fn$
 SELECT current_user='service_role'
  AND p_claim_digest ~ '^[a-f0-9]{64}$'
  AND EXISTS(
   SELECT 1 FROM nal_private.commerce_os_orders o
   JOIN nal_private.commerce_os_order_lines l ON l.order_id=o.id
   JOIN nal_private.commerce_os_fulfillments f ON f.order_id=o.id
   WHERE o.id=p_order_id AND o.claim_digest=p_claim_digest
     AND o.status='paid' AND o.revoked_at IS NULL AND o.provider_payment_key IS NOT NULL
     AND f.status='active' AND f.revoked_at IS NULL
     AND f.edition_snapshot=l.edition_snapshot
     AND f.kind=p_kind
     AND ( (l.kind='pdf' AND p_kind='private_pdf')
       OR (l.kind='reading_circle' AND p_kind='reading_pass')
       OR (l.kind='class_session' AND p_kind='class_pass') )
 )
$fn$;

-- Independent preview/synthetic DB must mimic the production service role.
-- No public or authenticated client table grants or function execution.
ALTER TABLE nal_private.commerce_os_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE nal_private.commerce_os_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE nal_private.commerce_os_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE nal_private.commerce_os_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE nal_private.commerce_os_seat_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nal_private.commerce_os_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nal_private.commerce_os_provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA nal_private FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA nal_private TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA nal_private TO service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nal_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA nal_private TO service_role;
COMMIT;
