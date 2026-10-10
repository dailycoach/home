-- NAL COMMERCE LITE / VERSION 1 / DESIGN-ONLY / NOT AN APPLIED MIGRATION.
-- NEVER apply to production until provider selection, legal/privacy approval,
-- independent DB/security review and transactional Pg tests. This file deliberately
-- fails BEFORE creating objects unless a separate approved session is provided.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $nal_guest_release$
BEGIN
  IF current_setting('nal.commerce_lite_schema_approved', true) IS DISTINCT FROM 'approved'
  THEN RAISE EXCEPTION 'NAL GUEST COMMERCE SCHEMA IS NOT APPROVED'; END IF;
  IF EXISTS (SELECT 1 FROM public.nal_orders)
    OR EXISTS (SELECT 1 FROM public.nal_payments)
    OR EXISTS (SELECT 1 FROM public.nal_digital_entitlements)
  THEN RAISE EXCEPTION 'Existing paid data requires isolated migration review'; END IF;
  IF (SELECT body->'features'->>'storePurchase' FROM public.nal_settings WHERE id='site') IS DISTINCT FROM 'false'
  THEN RAISE EXCEPTION 'Commerce storefront must be OFF during schema preparation'; END IF;
END $nal_guest_release$;

-- Isolation: no anonymous/client JWT table access. Only audited Edge servers
-- may use service_role; neither REST clients nor user-provided IDs are trusted.
CREATE TABLE nal_private.commerce_guest_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  create_request_id uuid NOT NULL UNIQUE,
  email text NOT NULL CHECK (length(email) BETWEEN 5 AND 254),
  claim_digest char(64) NOT NULL CHECK (claim_digest ~ '^[a-f0-9]{64}$'),
  catalog_kind text NOT NULL DEFAULT 'products' CHECK (catalog_kind='products'),
  product_id text NOT NULL,
  title_snapshot text NOT NULL CHECK (length(title_snapshot) BETWEEN 2 AND 100),
  amount_won integer NOT NULL CHECK (amount_won>=100),
  currency text NOT NULL DEFAULT 'KRW' CHECK (currency='KRW'),
  file_version text NOT NULL CHECK (length(file_version) BETWEEN 1 AND 80),
  provider_code text NOT NULL CHECK (provider_code ~ '^[a-z][a-z0-9-]{1,30}$'),
  provider_order_id text NOT NULL UNIQUE CHECK(length(provider_order_id) BETWEEN 8 AND 200),
  merchant_id text NOT NULL CHECK(length(merchant_id) BETWEEN 1 AND 200),
  provider_payment_key text UNIQUE,
  last_provider_status text,
  status text NOT NULL DEFAULT 'pending'
     CHECK(status IN ('pending','paid','refund_requested','refunded','cancelled','review_required')),
  paid_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '2 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (catalog_kind,product_id) REFERENCES public.nal_catalog(kind,id),
  CHECK (status NOT IN ('refunded','refund_requested') OR revoked_at IS NOT NULL)
);
CREATE INDEX commerce_guest_orders_created ON nal_private.commerce_guest_orders(created_at DESC);
CREATE INDEX commerce_guest_orders_status ON nal_private.commerce_guest_orders(status,updated_at);
ALTER TABLE nal_private.commerce_guest_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nal_private.commerce_guest_orders FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON nal_private.commerce_guest_orders TO service_role;

-- Keep a projection of verified provider events only, NOT provider raw payload,
-- full card/account details, signature, authorization headers or secret keys.
CREATE TABLE nal_private.commerce_guest_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_order_id uuid NOT NULL REFERENCES nal_private.commerce_guest_orders(id),
  provider_code text NOT NULL,
  provider_event_id text NOT NULL CHECK (length(provider_event_id) BETWEEN 1 AND 200),
  provider_payment_key text,
  status text NOT NULL CHECK(status IN('READY','IN_PROGRESS','DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED')),
  amount_won integer NOT NULL CHECK(amount_won>=0),
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_code,provider_event_id)
);
CREATE INDEX commerce_guest_provider_events_order ON nal_private.commerce_guest_provider_events(guest_order_id,verified_at DESC);
ALTER TABLE nal_private.commerce_guest_provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nal_private.commerce_guest_provider_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON nal_private.commerce_guest_provider_events TO service_role;

-- Queue is idempotent. The worker mints an ephemeral secret at SEND time,
-- stores only its SHA-256 digest, and retries safely after failed delivery.
CREATE TABLE nal_private.commerce_guest_receipt_outbox (
  guest_order_id uuid PRIMARY KEY REFERENCES nal_private.commerce_guest_orders(id),
  status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','sending','sent','retry','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 20),
  last_error_code text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE nal_private.commerce_guest_receipt_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nal_private.commerce_guest_receipt_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON nal_private.commerce_guest_receipt_outbox TO service_role;

CREATE TABLE nal_private.commerce_guest_receipt_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_order_id uuid NOT NULL REFERENCES nal_private.commerce_guest_orders(id),
  token_digest char(64) NOT NULL UNIQUE CHECK(token_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  issued_at timestamptz NOT NULL DEFAULT now(),
  CHECK(expires_at>issued_at)
);
CREATE INDEX commerce_guest_receipt_tokens_order ON nal_private.commerce_guest_receipt_tokens(guest_order_id,expires_at);
ALTER TABLE nal_private.commerce_guest_receipt_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nal_private.commerce_guest_receipt_tokens FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON nal_private.commerce_guest_receipt_tokens TO service_role;

-- Signed links are ephemeral. A refund prohibits future issuance; an already
-- issued URL may remain valid until its short Storage expiry.
CREATE TABLE nal_private.commerce_guest_download_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_order_id uuid NOT NULL REFERENCES nal_private.commerce_guest_orders(id),
  request_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','issued','failed')),
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guest_order_id,request_id)
);
CREATE INDEX commerce_guest_download_events_order ON nal_private.commerce_guest_download_events(guest_order_id,created_at DESC);
ALTER TABLE nal_private.commerce_guest_download_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON nal_private.commerce_guest_download_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON nal_private.commerce_guest_download_events TO service_role;

-- Defense in depth: prohibit refund-to-paid and reactivation, immutable order
-- snapshot. Event loop MUST also use transactional SELECT FOR UPDATE and the
-- current authoritative provider payment; this trigger alone is insufficient.
CREATE FUNCTION nal_private.commerce_guest_transition_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
BEGIN
 IF NEW.product_id IS DISTINCT FROM OLD.product_id
  OR NEW.email IS DISTINCT FROM OLD.email
  OR NEW.amount_won IS DISTINCT FROM OLD.amount_won
  OR NEW.currency IS DISTINCT FROM OLD.currency
  OR NEW.file_version IS DISTINCT FROM OLD.file_version
  OR NEW.claim_digest IS DISTINCT FROM OLD.claim_digest
  OR NEW.provider_code IS DISTINCT FROM OLD.provider_code
  OR NEW.provider_order_id IS DISTINCT FROM OLD.provider_order_id
  OR NEW.merchant_id IS DISTINCT FROM OLD.merchant_id
 THEN RAISE EXCEPTION 'Immutable guest-order identity cannot change' USING ERRCODE='42501'; END IF;

 IF OLD.status IN('refunded','refund_requested','cancelled')
    AND NEW.status='paid'
  OR OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS NULL
 THEN RAISE EXCEPTION 'Refunded guest order cannot regain entitlement' USING ERRCODE='42501'; END IF;

 IF OLD.status='paid' AND NEW.status='pending'
 THEN RAISE EXCEPTION 'Settled order cannot return to pending' USING ERRCODE='42501'; END IF;

 NEW.updated_at=now();
 RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION nal_private.commerce_guest_transition_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION nal_private.commerce_guest_transition_guard() TO service_role;
CREATE TRIGGER commerce_guest_order_transition
  BEFORE UPDATE ON nal_private.commerce_guest_orders
  FOR EACH ROW EXECUTE FUNCTION nal_private.commerce_guest_transition_guard();

-- Crucial TODO before deploying: standalone private RPCs or server connection
-- for atomic create, authenticated provider settlement, receipt token claim,
-- signing reservation, refund locking, version snapshot and rate limit.
-- Do NOT expose private schema in PostgREST Data API.
COMMIT;
