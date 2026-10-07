-- NAL-FIX-03: verified Auth API identity, not broad auth.users table access.
-- Forward-only correction for FIX-02. No grants, rows, release mode or permits changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- This attestation is produced ONLY by the server after Auth /user and a bound
-- Auth Admin /users/{id} lookup. Browser headers are never forwarded to this RPC.
-- It is trusted only with service_role, over the internal TLS/API-key boundary.
-- It is not an independently signed JWT and cannot replace verification in Edge.
create function nal_private.read_verified_subject(p_user_id uuid)
returns boolean language plpgsql stable security invoker set search_path='' as $$
declare h jsonb; i jsonb; verified_at timestamptz; confirmed_at timestamptz;
begin
 if current_user<>'service_role' or p_user_id is null then return false; end if;
 h:=nullif(current_setting('request.headers',true),'')::jsonb;
 i:=(h->>'x-nal-read-verified')::jsonb;
 if i is null or jsonb_typeof(i)<>'object' or
    i-ARRAY['user_id','email_confirmed_at','is_anonymous','deleted_at','banned_until','verified_at']<>'{}'::jsonb
    or jsonb_typeof(i->'user_id') is distinct from 'string'
    or i->>'user_id' is distinct from p_user_id::text
    or i->'is_anonymous' is distinct from 'false'::jsonb
    or i->'deleted_at' is distinct from 'null'::jsonb
    or not (i ? 'banned_until')
    or jsonb_typeof(i->'email_confirmed_at') is distinct from 'string'
    or jsonb_typeof(i->'verified_at') is distinct from 'string' then return false; end if;
 verified_at:=(i->>'verified_at')::timestamptz;
 confirmed_at:=(i->>'email_confirmed_at')::timestamptz;
 if not isfinite(verified_at) or not isfinite(confirmed_at)
    or verified_at<statement_timestamp()-interval '30 seconds'
    or verified_at>statement_timestamp()+interval '5 seconds'
    or confirmed_at>statement_timestamp() then return false; end if;
 if i->'banned_until'<>'null'::jsonb and
    (jsonb_typeof(i->'banned_until')<>'string' or
     (i->>'banned_until')::timestamptz>statement_timestamp() or
     not isfinite((i->>'banned_until')::timestamptz)) then return false; end if;
 return true;
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
 return false;
end $$;
revoke all on function nal_private.read_verified_subject(uuid) from public,anon,authenticated;
grant execute on function nal_private.read_verified_subject(uuid) to service_role;

create or replace function public.nal_read_release_guard(p_user_id uuid,p_season_slug text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from nal_private.read_release_control where singleton and mode='test_only') then
  return jsonb_build_object('allowed',false,'reason','read_release_off');
 end if;
 if not nal_private.read_verified_subject(p_user_id) then
  return jsonb_build_object('allowed',false,'reason','verified_identity_required');
 end if;
 if p_season_slug is null or not exists(
   select 1 from nal_private.read_test_allowlist a
   join public.nal_read_seasons s on s.id=a.season_id
   where a.user_id=p_user_id and s.slug=p_season_slug
     and a.revoked_at is null and a.granted_at<=now() and a.expires_at>now()
 ) then return jsonb_build_object('allowed',false,'reason','read_test_scope_required'); end if;
 return jsonb_build_object('allowed',true,'mode','test_only');
end $$;

-- Fail closed on schema drift; replace precisely the old Auth lookup, preserving
-- all tested order, expiry, revocation, uniqueness and concurrency logic.
do $$
declare source text;
 needle text:='if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null) then';
 replacement text:='if not nal_private.read_verified_subject(p_user_id) then';
begin
 source:=pg_get_functiondef('nal_private.read_claim_core(uuid,text,uuid,uuid)'::regprocedure);
 if strpos(source,needle)=0 or strpos(source,'SECURITY DEFINER')>0 then
  raise exception 'FIX03 baseline mismatch: review claim core before applying'; end if;
 execute replace(source,needle,replacement);
end $$;

revoke all on function public.nal_read_release_guard(uuid,text),nal_private.read_claim_core(uuid,text,uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.nal_read_release_guard(uuid,text),nal_private.read_claim_core(uuid,text,uuid,uuid)
 to service_role;
commit;
