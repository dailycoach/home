-- NAL-STABILIZATION-05 · READ ONLY audit, do not modify production
-- No UPDATE/DELETE/DDL/GRANT and no payment/authorization RPC execution.
SELECT
  (SELECT mode FROM nal_private.read_release_control WHERE singleton=true) AS read_mode,
  (SELECT count(*) FROM public.nal_orders) AS orders,
  (SELECT count(*) FROM public.nal_payments) AS payments,
  (SELECT count(*) FROM public.nal_digital_entitlements) AS paid_entitlements,
  (SELECT count(*) FROM public.nal_download_events) AS download_events,
  (SELECT count(*) FROM nal_private.read_checkout_orders) AS read_orders,
  (SELECT count(*) FROM nal_private.read_payment_refunds) AS read_refunds;

SELECT id,published,body->>'stockStatus' AS stock_status,
       body->>'price' AS price_won,
       body->>'purchaseUrl' AS purchase_url,
       body->>'version' AS publication_version
FROM public.nal_catalog
WHERE kind='products'
  AND (id LIKE 'dailycoaching-awareness-%' OR id LIKE 'nal-small-book-%')
ORDER BY id;

SELECT f.product_id,f.version,f.active,f.bucket_id,
       (so.id IS NOT NULL) AS storage_object_present,
       NOT coalesce(sb.public,true) AS private_bucket,
       (so.metadata->>'size')::bigint AS size_bytes
FROM nal_private.product_files f
LEFT JOIN storage.objects so ON so.bucket_id=f.bucket_id AND so.name=f.object_path
LEFT JOIN storage.buckets sb ON sb.id=f.bucket_id
ORDER BY f.product_id;

SELECT p.proname,p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS signed_in_user_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS server_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
('nal_create_product_order','nal_get_product_order','nal_reconcile_toss_payment','nal_begin_download','nal_finish_download')
ORDER BY p.proname;

SELECT md5(pg_get_functiondef(
  'public.nal_reconcile_toss_payment(uuid,text,integer,text)'::regprocedure
)) AS current_reconciliation_function_fingerprint;

SELECT id, body->'features' AS features, body->'legal' AS legal_metadata
FROM public.nal_settings
WHERE id='site';
