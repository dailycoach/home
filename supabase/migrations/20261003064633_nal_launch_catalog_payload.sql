create or replace function public.nal_public_catalog() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'site', (select body from public.nal_settings where id = 'site' and published),
    'launches', (select body from public.nal_settings where id = 'launches' and published),
    'programs', coalesce((select jsonb_agg(body || jsonb_build_object('id', id, 'slug', slug, 'published', true) order by id) from public.nal_catalog where kind = 'programs' and published), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(body || jsonb_build_object('id', id, 'slug', slug, 'published', true) order by id) from public.nal_catalog where kind = 'products' and published), '[]'::jsonb),
    'hosts', coalesce((select jsonb_agg(body || jsonb_build_object('id', id, 'slug', slug, 'published', true) order by id) from public.nal_catalog where kind = 'hosts' and published), '[]'::jsonb),
    'content', coalesce((select jsonb_agg(body || jsonb_build_object('id', id, 'slug', slug, 'published', true) order by id) from public.nal_catalog where kind = 'content' and published), '[]'::jsonb)
  );
$$;
