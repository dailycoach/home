-- Preserve the dashboard's automatic RLS event trigger while removing its API ACL.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

-- Explicit default-deny for the trusted operator membership table.
create policy nal_admin_membership_deny on nal_private.admins for all to anon, authenticated
  using (false) with check (false);

-- Single read-only public payload. Invoker rights enforce underlying RLS.
-- Never include account, registration, order, payment or private operator data.
create function public.nal_public_catalog() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'site', (select body from public.nal_settings where id = 'site' and published),
    'programs', coalesce((select jsonb_agg(body || jsonb_build_object('id', id, 'slug', slug, 'published', true) order by id) from public.nal_catalog where kind = 'programs' and published), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(body || jsonb_build_object('id', id, 'slug', slug, 'published', true) order by id) from public.nal_catalog where kind = 'products' and published), '[]'::jsonb),
    'hosts', coalesce((select jsonb_agg(body || jsonb_build_object('id', id, 'slug', slug, 'published', true) order by id) from public.nal_catalog where kind = 'hosts' and published), '[]'::jsonb),
    'content', coalesce((select jsonb_agg(body || jsonb_build_object('id', id, 'slug', slug, 'published', true) order by id) from public.nal_catalog where kind = 'content' and published), '[]'::jsonb)
  );
$$;
revoke all on function public.nal_public_catalog() from public, anon, authenticated;
grant execute on function public.nal_public_catalog() to anon, authenticated;
