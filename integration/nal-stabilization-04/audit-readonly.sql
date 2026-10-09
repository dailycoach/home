-- NAL-STABILIZATION-04
-- Read-only audit, no UPDATE/DELETE/GRANT/CREATE/EDGE deployment.
-- Execute only under an authorized database read-only inspection context.
SELECT n.nspname AS schema_name, p.proname AS function_name, pg_get_function_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
WHERE (n.nspname='public' AND p.proname IN ('nal_account','nal_read_privacy','nal_read_privacy_admin'))
   OR (n.nspname='nal_private' AND p.proname IN ('read_privacy_journal_erase','read_privacy_journal_plan'))
ORDER BY schema_name,function_name;

SELECT
  (SELECT mode FROM nal_private.read_release_control WHERE singleton=true) AS read_mode,
  (SELECT journal_erasure_enabled FROM nal_private.read_privacy_execution_control WHERE singleton=true) AS journal_erasure_enabled,
  (SELECT approved_policy_version FROM nal_private.read_privacy_execution_control WHERE singleton=true) AS approved_policy_version,
  (SELECT count(*) FROM nal_private.admins WHERE role='owner') AS owners,
  (SELECT count(*) FROM nal_private.read_privacy_requests) AS privacy_requests,
  (SELECT count(*) FROM nal_private.read_privacy_journal_reviews) AS privacy_reviews,
  (SELECT count(*) FROM public.nal_read_seasons) AS seasons,
  (SELECT count(*) FROM public.nal_orders) AS orders;

SELECT grantee,privilege_type,table_schema,table_name
FROM information_schema.table_privileges
WHERE table_schema='nal_private'
  AND table_name IN ('read_privacy_execution_control','read_privacy_journal_reviews','read_privacy_requests')
  AND grantee IN ('anon','authenticated','service_role')
ORDER BY table_name,grantee,privilege_type;
