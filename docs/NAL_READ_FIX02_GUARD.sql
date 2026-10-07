-- NAL-FIX-02 controlled rollout guard. Append atomically after FIX-01.
-- No launch/open mode exists. Test permits require a user AND a season AND an expiry.
create table nal_private.read_release_control (
 singleton boolean primary key default true check(singleton),
 mode text not null default 'off' check(mode in ('off','test_only')),
 updated_at timestamptz not null default now()
);
insert into nal_private.read_release_control(singleton,mode) values(true,'off');
create table nal_private.read_test_allowlist (
 user_id uuid not null references auth.users(id) on delete cascade,
 season_id uuid not null references public.nal_read_seasons(id) on delete cascade,
 granted_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '24 hours'),
 revoked_at timestamptz,
 approval_ref text not null check(length(btrim(approval_ref)) between 1 and 200),
 primary key(user_id,season_id),
 check(expires_at>granted_at and expires_at<=granted_at+interval '7 days')
);
create index read_test_allowlist_season on nal_private.read_test_allowlist(season_id);
alter table nal_private.read_release_control enable row level security;
alter table nal_private.read_test_allowlist enable row level security;
revoke all on nal_private.read_release_control,nal_private.read_test_allowlist from public,anon,authenticated,service_role;
-- Runtime can inspect scope, but cannot grant access or activate READ.
grant select on nal_private.read_release_control,nal_private.read_test_allowlist to service_role;
create trigger nal_touch before update on nal_private.read_release_control
 for each row execute function nal_private.touch_updated_at();
create trigger nal_audit after insert or update or delete on nal_private.read_release_control
 for each row execute function nal_private.audit_change();
create trigger nal_audit after insert or update or delete on nal_private.read_test_allowlist
 for each row execute function nal_private.audit_change();

create function public.nal_read_release_guard(p_user_id uuid,p_season_slug text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not exists(select 1 from nal_private.read_release_control where singleton and mode='test_only') then
  return jsonb_build_object('allowed',false,'reason','read_release_off');
 end if;
 if p_user_id is null or p_season_slug is null or not exists(
   select 1 from nal_private.read_test_allowlist a
   join public.nal_read_seasons s on s.id=a.season_id
   join auth.users u on u.id=a.user_id
   where a.user_id=p_user_id and s.slug=p_season_slug
     and a.revoked_at is null and a.granted_at<=now() and a.expires_at>now()
     and u.email_confirmed_at is not null
     and coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false)=false
     and (to_jsonb(u)->>'deleted_at') is null
     and ((to_jsonb(u)->>'banned_until') is null or (to_jsonb(u)->>'banned_until')::timestamptz<=now())
 ) then
  return jsonb_build_object('allowed',false,'reason','read_test_scope_required');
 end if;
 return jsonb_build_object('allowed',true,'mode','test_only');
end $$;
revoke all on function public.nal_read_release_guard(uuid,text) from public,anon,authenticated;
grant execute on function public.nal_read_release_guard(uuid,text) to service_role;

-- Preserve tested FIX-01 cores, behind server-only scope wrappers.
alter function public.nal_get_read_access(uuid,text) rename to read_access_core;
alter function public.read_access_core(uuid,text) set schema nal_private;
alter function public.nal_issue_read_enrollment(uuid,text,uuid,uuid) rename to read_claim_core;
alter function public.read_claim_core(uuid,text,uuid,uuid) set schema nal_private;
revoke all on function nal_private.read_access_core(uuid,text),nal_private.read_claim_core(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function nal_private.read_access_core(uuid,text),nal_private.read_claim_core(uuid,text,uuid,uuid) to service_role;

create function public.nal_get_read_access(p_user_id uuid,p_season_slug text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare g jsonb;
begin
 g:=public.nal_read_release_guard(p_user_id,p_season_slug);
 if coalesce((g->>'allowed')::boolean,false) is not true then return g; end if;
 return nal_private.read_access_core(p_user_id,p_season_slug);
end $$;
create function public.nal_issue_read_enrollment(p_user_id uuid,p_season_slug text,p_order_id uuid,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g jsonb;
begin
 g:=public.nal_read_release_guard(p_user_id,p_season_slug);
 if coalesce((g->>'allowed')::boolean,false) is not true then
  raise exception 'Read access unavailable' using errcode='42501';
 end if;
 return nal_private.read_claim_core(p_user_id,p_season_slug,p_order_id,p_request_id);
end $$;
revoke all on function public.nal_get_read_access(uuid,text),public.nal_issue_read_enrollment(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.nal_get_read_access(uuid,text),public.nal_issue_read_enrollment(uuid,text,uuid,uuid) to service_role;

-- READ development is API-only. No direct browser table bypass while testing.
-- Restrictive policies intersect existing owner policies; STORE policies are untouched.
create policy nal_read_controlled_api_only on public.nal_read_seasons as restrictive
 for all to anon,authenticated using(false) with check(false);
create policy nal_read_controlled_api_only on public.nal_product_entitlements as restrictive
 for all to anon,authenticated using(false) with check(false);
create policy nal_read_controlled_api_only on public.nal_read_enrollments as restrictive
 for all to anon,authenticated using(false) with check(false);
create policy nal_read_controlled_api_only on public.nal_read_answers as restrictive
 for all to anon,authenticated using(false) with check(false);
create policy nal_read_controlled_api_only on public.nal_read_day_progress as restrictive
 for all to anon,authenticated using(false) with check(false);
