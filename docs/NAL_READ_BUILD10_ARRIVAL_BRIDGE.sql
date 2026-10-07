-- BUILD10 source only. Load last after GUIDE and STUDIO.
-- Add preparation metadata without rewriting DAY gates or marking learning progress.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
alter function public.nal_read_bootstrap(uuid,text) set schema nal_private;
alter function nal_private.nal_read_bootstrap(uuid,text) rename to read_bootstrap_before_arrival;
create function public.nal_read_bootstrap(p_user_id uuid,p_season_slug text)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare original jsonb;
begin
 original:=nal_private.read_bootstrap_before_arrival(p_user_id,p_season_slug);
 return original||jsonb_build_object('arrival',nal_private.read_arrival_state(p_user_id,p_season_slug));
end $$;
revoke all on function public.nal_read_bootstrap(uuid,text),nal_private.read_bootstrap_before_arrival(uuid,text) from public,anon,authenticated;
grant execute on function public.nal_read_bootstrap(uuid,text),nal_private.read_bootstrap_before_arrival(uuid,text) to service_role;
commit;
