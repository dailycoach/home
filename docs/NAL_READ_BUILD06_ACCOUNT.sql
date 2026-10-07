-- BUILD06 source only; UNAPPLIED. Depends on BUILD04, BUILD05 and BUILD06_JOIN.sql.
-- Aggregates OWNED records, never creates payment/enrollment from a page visit.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create table nal_private.account_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(length(display_name)<=80),
 revision integer not null default 1 check(revision>0),updated_at timestamptz not null default now()
);
alter table nal_private.account_preferences enable row level security;
revoke all on nal_private.account_preferences from public,anon,authenticated,service_role;
grant select,insert,update on nal_private.account_preferences to service_role;

create function public.nal_account(p_user_id uuid,p_action text,p_payload jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare items jsonb;off integer;pref nal_private.account_preferences%rowtype;rev integer;
 e record;a jsonb;entries jsonb:='[]';progress jsonb;next_day integer;
begin
 if not nal_private.read_verified_subject(p_user_id) then raise exception 'Verified identity required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 then raise exception 'Invalid request' using errcode='22023';end if;
 off:=coalesce((p_payload->>'offset')::integer,0);
 if off<0 or off>10000 then raise exception 'Invalid page' using errcode='22023';end if;
 if p_action='profile' then
  select * into pref from nal_private.account_preferences where user_id=p_user_id;
  return jsonb_build_object('displayName',coalesce(pref.display_name,''),'revision',coalesce(pref.revision,0));
 end if;
 if p_action='profile-save' then
  rev:=(p_payload->>'revision')::integer;
  if rev is null or rev<0 or jsonb_typeof(p_payload->'displayName') is distinct from 'string' or length(p_payload->>'displayName')>80 then raise exception 'Invalid profile' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':profile',31));
  select * into pref from nal_private.account_preferences where user_id=p_user_id for update;
  if coalesce(pref.revision,0)<>rev then raise exception 'Profile changed' using errcode='40001';end if;
  insert into nal_private.account_preferences(user_id,display_name) values(p_user_id,btrim(p_payload->>'displayName'))
   on conflict(user_id) do update set display_name=excluded.display_name,revision=nal_private.account_preferences.revision+1,updated_at=now() returning * into pref;
  return jsonb_build_object('saved',true,'displayName',pref.display_name,'revision',pref.revision);
 end if;
 if p_action='orders' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into items from (
   select o.id,o.status,o.amount_won,o.created_at,
    (select coalesce(jsonb_agg(jsonb_build_object('title',i.title_snapshot,'productId',i.catalog_id,'kind',i.catalog_kind,
      'quantity',i.quantity,'unitPrice',i.unit_price_won,'readSeason',s.slug) order by i.id),'[]')
     from public.nal_order_items i left join nal_private.read_offers f on f.catalog_kind=i.catalog_kind and f.catalog_id=i.catalog_id
     left join public.nal_read_seasons s on s.id=f.season_id where i.order_id=o.id) as items
   from public.nal_orders o where o.user_id=p_user_id order by o.created_at desc,o.id limit 51 offset off
  ) x;
  return jsonb_build_object('orders',items,'offset',off);
 end if;
 if p_action='files' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into items from (
   select d.id,d.product_id,i.title_snapshot as title,d.created_at,d.license_type,d.printing_allowed,d.download_count,d.download_limit,
    d.expires_at,d.revoked_at,o.status as order_status,
    coalesce(d.revoked_at is null and (d.expires_at is null or d.expires_at>now()) and o.status='paid'
     and (d.download_limit is null or d.download_count<d.download_limit) and f.active,false) as downloadable,
    case when d.revoked_at is not null then 'revoked' when o.status<>'paid' then 'order_inactive'
     when d.expires_at<=now() then 'expired' when d.download_limit is not null and d.download_count>=d.download_limit then 'limit'
     when not coalesce(f.active,false) then 'preparing' else 'available' end as reason
   from public.nal_digital_entitlements d join public.nal_orders o on o.id=d.order_id and o.user_id=p_user_id
   join public.nal_order_items i on i.id=d.order_item_id and i.order_id=o.id
   left join nal_private.product_files f on f.id=d.file_id
   where d.user_id=p_user_id order by d.created_at desc,d.id limit 51 offset off
  ) x;
  return jsonb_build_object('files',items,'offset',off);
 end if;
 if p_action='programs' then
  for e in select en.id,en.status,en.started_at,en.completed_at,en.created_at,s.slug,s.title,
   ob.completed_at as welcomed_at from public.nal_read_enrollments en join public.nal_read_seasons s on s.id=en.season_id
   left join nal_private.read_onboarding ob on ob.enrollment_id=en.id and ob.user_id=p_user_id
   where en.user_id=p_user_id order by en.created_at desc,en.id limit 51 offset off loop
   a:=public.nal_get_read_access(p_user_id,e.slug);progress:=null;next_day:=null;
   if coalesce((a->>'allowed')::boolean,false) then
    progress:=public.nal_read_bootstrap(p_user_id,e.slug);next_day:=(progress->>'currentDay')::integer;
   end if;
   entries:=entries||jsonb_build_array(jsonb_build_object('id',e.id,'slug',e.slug,'title',e.title,'status',e.status,
    'createdAt',e.created_at,'welcomed',e.welcomed_at is not null,'allowed',coalesce((a->>'allowed')::boolean,false),
    'reason',a->>'reason','currentDay',next_day,
    'recordedDays',case when progress is null then null else
      (select count(*) from jsonb_array_elements(progress->'journey') j where j->>'progress'='completed') end));
  end loop;
  return jsonb_build_object('programs',entries,'offset',off);
 end if;
 if p_action='registrations' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into items from (
   select r.id,r.status,r.price_won,r.created_at,s.starts_at,s.ends_at,s.location,s.status as session_status,
     coalesce(c.body->>'title','프로그램') as title
   from public.nal_registrations r join public.nal_sessions s on s.id=r.session_id
   left join public.nal_catalog c on c.kind=s.program_kind and c.id=s.program_id
   where r.user_id=p_user_id order by r.created_at desc,r.id limit 51 offset off
  ) x;
  return jsonb_build_object('registrations',items,'offset',off);
 end if;
 if p_action='reports' then
  -- Metadata only; snapshots and personal answer text remain behind the report RPC.
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id),'[]') into items from (
   select r.id,r.created_at,s.slug,s.title as season_title,
    r.snapshot->'cover'->>'title' as title,r.snapshot->>'stage' as stage,
    coalesce((public.nal_get_read_access(p_user_id,s.slug)->>'allowed')::boolean,false) as allowed
   from nal_private.read_report_editions r join public.nal_read_enrollments en on en.id=r.enrollment_id and en.user_id=p_user_id
   join public.nal_read_seasons s on s.id=en.season_id where r.user_id=p_user_id
   order by r.created_at desc,r.id limit 51 offset off
  ) x;
  return jsonb_build_object('reports',items,'offset',off);
 end if;
 raise exception 'Unknown account action' using errcode='22023';
end $$;
revoke all on function public.nal_account(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.nal_account(uuid,text,jsonb) to service_role;
commit;
