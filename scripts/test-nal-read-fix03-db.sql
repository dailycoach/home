\set ON_ERROR_STOP on
-- Synthetic Auth attestations here test SQL under the real runtime role.
-- They are NOT a claim that a real email login was completed. All rows roll back.
begin;
set local statement_timeout='30s';
create temporary table fix03_results(label text primary key,passed boolean not null);
create function pg_temp.ok(v boolean,label text) returns void language plpgsql as $$
begin
 if v is not true then raise exception 'FIX03: %',label; end if;
 insert into fix03_results values(label,true);
end $$;
create function pg_temp.rt(q text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
 execute 'set local role service_role'; execute q into r; execute 'reset role'; return r;
exception when others then execute 'reset role'; raise;
end $$;
create function pg_temp.denied(q text,want text,label text) returns void language plpgsql as $$
begin
 begin perform pg_temp.rt(q);
 exception when others then
  if sqlstate<>want then raise exception 'FIX03: % wrong SQLSTATE %, wanted %',label,sqlstate,want; end if;
  insert into fix03_results values(label,true); return;
 end;
 raise exception 'FIX03: % unexpectedly allowed',label;
end $$;
create function pg_temp.identity(u uuid,overrides jsonb default '{}') returns void language plpgsql as $$
declare i jsonb;
begin
 i:=jsonb_build_object('user_id',u::text,'email_confirmed_at',statement_timestamp()-interval '1 day',
  'is_anonymous',false,'deleted_at',null,'banned_until',null,'verified_at',statement_timestamp())||overrides;
 perform set_config('request.headers',jsonb_build_object('x-nal-read-verified',i::text)::text,true);
end $$;
do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); s uuid; s2 uuid; d0 uuid; d1 uuid;
 o uuid:=gen_random_uuid(); item uuid:=gen_random_uuid(); req uuid:=gen_random_uuid(); pe uuid;
 k text:='fix03-'||substr(gen_random_uuid()::text,1,8); r jsonb; n integer; bad jsonb; j integer:=0;
begin
 perform pg_temp.ok((select mode='off' from nal_private.read_release_control),'starts OFF');
 perform pg_temp.ok(not has_any_column_privilege('service_role','auth.users','select'),'runtime has no Auth column access');
 insert into auth.users(id,email_confirmed_at) values(u,now()),(other_u,now());
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='nal_catalog' and column_name='slug') then
  execute 'insert into public.nal_catalog(kind,id,slug,published,body) values(''products'',$1,$1,false,''{"title":"Synthetic QA","price":0}'')' using k;
 else
  insert into public.nal_catalog(kind,id,published,body) values('products',k,false,'{"title":"Synthetic QA","price":0}');
 end if;
 insert into public.nal_orders(id,user_id,amount_won,status) values(o,u,0,'paid');
 insert into public.nal_order_items(id,order_id,catalog_kind,catalog_id,title_snapshot,quantity,unit_price_won)
 values(item,o,'products',k,'Synthetic QA',1,0);
 insert into public.nal_read_seasons(slug,title,product_id,status) values(k,'Synthetic QA',k,'open') returning id into s;
 insert into public.nal_read_seasons(slug,title,status) values(k||'-other','Other synthetic','open') returning id into s2;
 perform pg_temp.identity(u);
 r:=pg_temp.rt(format('select public.nal_get_read_access(%L,%L)',u,k));
 perform pg_temp.ok((r->>'allowed')::boolean=false,'OFF denies verified access');
 perform pg_temp.denied(format('select public.nal_issue_read_enrollment(%L,%L,%L,%L)',u,k,o,req),'42501','OFF denies verified claim');
 update nal_private.read_release_control set mode='test_only';
 insert into nal_private.read_test_allowlist(user_id,season_id,approval_ref) values(u,s,'transaction-only FIX03 verification');
 -- BEFORE the patch, this exact real-role operation fails on auth.users permission.
 r:=pg_temp.rt(format('select public.nal_issue_read_enrollment(%L,%L,%L,%L)',u,k,o,req));
 perform pg_temp.ok((r->>'allowed')::boolean,'verified runtime claim succeeds without Auth grant');
 perform pg_temp.rt(format('select public.nal_issue_read_enrollment(%L,%L,%L,%L)',u,k,o,req));
 perform pg_temp.ok((select count(*)=1 from public.nal_read_enrollments where user_id=u),'retry keeps one enrollment');
 perform pg_temp.ok((select count(*)=1 from public.nal_product_entitlements where user_id=u),'retry keeps one entitlement');
 select entitlement_id into pe from public.nal_read_enrollments where user_id=u and season_id=s;
 perform set_config('request.headers','{}',true);
 r:=pg_temp.rt(format('select public.nal_get_read_access(%L,%L)',u,k));
 perform pg_temp.ok((r->>'allowed')::boolean=false and r->>'reason'='verified_identity_required','missing proof rejected');
 perform pg_temp.denied(format('select public.nal_issue_read_enrollment(%L,%L,%L,%L)',u,k,o,gen_random_uuid()),'42501','claim without proof rejected');
 perform set_config('request.headers','{"x-nal-read-verified":"not-json"}',true);
 r:=pg_temp.rt(format('select public.nal_get_read_access(%L,%L)',u,k));
 perform pg_temp.ok((r->>'allowed')::boolean=false,'malformed proof fails closed');
 for bad in select value from jsonb_array_elements(jsonb_build_array(
  jsonb_build_object('user_id',other_u::text),jsonb_build_object('is_anonymous',true),
  jsonb_build_object('email_confirmed_at',null),jsonb_build_object('email_confirmed_at','not-a-date'),
  jsonb_build_object('email_confirmed_at',now()+interval '1 day'),
  jsonb_build_object('deleted_at',now()),jsonb_build_object('banned_until',now()+interval '1 day'),
  jsonb_build_object('banned_until','bad'),jsonb_build_object('verified_at',statement_timestamp()-interval '31 seconds'),
  jsonb_build_object('verified_at',statement_timestamp()+interval '10 seconds'),
  jsonb_build_object('verified_at','infinity'),jsonb_build_object('unexpected','field')
 )) loop
  j:=j+1;perform pg_temp.identity(u,bad);
  r:=pg_temp.rt(format('select public.nal_get_read_access(%L,%L)',u,k));
  perform pg_temp.ok((r->>'allowed')::boolean=false,'invalid identity variant '||j);
 end loop;
 perform pg_temp.identity(u);
 r:=pg_temp.rt(format('select public.nal_get_read_access(%L,%L)',u,k||'-other'));
 perform pg_temp.ok((r->>'allowed')::boolean=false,'proof does not grant another season');
 update nal_private.read_test_allowlist set granted_at=now()-interval '2 days',expires_at=now()-interval '1 day' where user_id=u;
 r:=pg_temp.rt(format('select public.nal_get_read_access(%L,%L)',u,k));
 perform pg_temp.ok((r->>'allowed')::boolean=false,'expired permit denied');
 update nal_private.read_test_allowlist set granted_at=now(),expires_at=now()+interval '1 day',revoked_at=now() where user_id=u;
 r:=pg_temp.rt(format('select public.nal_get_read_access(%L,%L)',u,k));
 perform pg_temp.ok((r->>'allowed')::boolean=false,'revoked permit denied');
 update nal_private.read_test_allowlist set revoked_at=null where user_id=u;
 update public.nal_product_entitlements set status='revoked',revoked_at=now() where id=pe;
 r:=pg_temp.rt(format('select public.nal_issue_read_enrollment(%L,%L,%L,%L)',u,k,o,gen_random_uuid()));
 perform pg_temp.ok((r->>'allowed')::boolean=false,'verified request cannot revive revoked entitlement');
 perform pg_temp.ok((select status='revoked' and revoked_at is not null from public.nal_product_entitlements where id=pe),'revoked fields remain unchanged');
 update public.nal_product_entitlements set status='active',revoked_at=null where id=pe;
 insert into nal_private.read_days(season_id,day_number,title,day_type,status) values(s,0,'Before','before','published') returning id into d0;
 insert into nal_private.read_days(season_id,day_number,title,status) values(s,1,'DAY 1','published') returning id into d1;
 insert into nal_private.read_day_steps(day_id,step_order,step_type,prompt,required,status)
 values(d0,1,'QUESTION','Required text',true,'published'),(d1,1,'SCALE','Required scale',true,'published');
 perform pg_temp.denied(format('select public.nal_complete_read_day(%L,%L,1)',u,k),'42501','locked DAY cannot complete');
 perform pg_temp.denied(format('select public.nal_save_read_answer(%L,%L,0,1,''   '',null)',u,k),'22023','required whitespace rejected');
 perform pg_temp.rt(format('select public.nal_get_read_day(%L,%L,0)',u,k));
 r:=pg_temp.rt(format('select public.nal_save_read_answer(%L,%L,0,1,''v'',null)',u,k));
 perform pg_temp.ok((r->>'saved')::boolean,'runtime BEFORE answer saved');
 r:=pg_temp.rt(format('select public.nal_complete_read_day(%L,%L,0)',u,k));
 perform pg_temp.ok((r->>'completed')::boolean,'runtime BEFORE completion');
 r:=pg_temp.rt(format('select public.nal_get_read_day(%L,%L,1)',u,k));
 perform pg_temp.ok((r->>'dayNumber')::integer=1,'DAY 1 unlock after BEFORE');
 perform pg_temp.denied(format('select public.nal_save_read_answer(%L,%L,1,1,null,''{"value":6}''::jsonb)',u,k),'22023','invalid scale rejected');
 r:=pg_temp.rt(format('select public.nal_save_read_answer(%L,%L,1,1,null,''{"value":4}''::jsonb)',u,k));
 perform pg_temp.ok((r->>'saved')::boolean,'runtime DAY 1 answer saved');
 r:=pg_temp.rt(format('select public.nal_complete_read_day(%L,%L,1)',u,k));
 perform pg_temp.ok((r->>'completed')::boolean,'runtime DAY 1 completion');
 perform set_config('request.headers','',true);
 perform pg_temp.denied(format('select public.nal_get_read_day(%L,%L,0)',u,k),'42501','cleared request context cannot read records');
 perform pg_temp.identity(u);
 r:=pg_temp.rt(format('select public.nal_get_read_day(%L,%L,0)',u,k));
 perform pg_temp.ok(r->'steps'->0->>'answerText'='v','fresh verified request reloads exact answer');
 r:=pg_temp.rt(format('select public.nal_read_bootstrap(%L,%L)',u,k));
 perform pg_temp.ok((r->'journey'->1->>'progress')='completed','journey retains completion');
 perform pg_temp.identity(other_u);
 r:=pg_temp.rt(format('select public.nal_get_read_access(%L,%L)',other_u,k));
 perform pg_temp.ok((r->>'allowed')::boolean=false,'verified other account denied');
 -- Even an owner-shaped forged header does not grant browser RPC/table access.
 perform pg_temp.identity(u);perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated'; select count(*) into n from public.nal_read_answers;execute 'reset role';
 perform pg_temp.ok(n=0,'forged client header cannot bypass table policy');
 perform pg_temp.ok(not has_function_privilege('authenticated','public.nal_get_read_access(uuid,text)','execute'),'browser cannot invoke privileged access RPC');
 perform pg_temp.ok(not has_function_privilege('authenticated','nal_private.read_verified_subject(uuid)','execute'),'browser cannot invoke identity helper');
 perform pg_temp.ok(not has_any_column_privilege('service_role','auth.users','select'),'Auth table access still absent');
 perform pg_temp.ok(not has_table_privilege('service_role','nal_private.read_test_allowlist','insert'),'runtime cannot grant test permits');
 perform pg_temp.ok(not has_table_privilege('service_role','nal_private.read_release_control','update'),'runtime cannot activate READ');
 perform pg_temp.ok(not (select prosecdef from pg_proc where oid='nal_private.read_verified_subject(uuid)'::regprocedure),'identity helper is SECURITY INVOKER');
 update nal_private.read_release_control set mode='off';
 perform pg_temp.denied(format('select public.nal_read_bootstrap(%L,%L)',u,k),'42501','kill switch denies journey');
 perform pg_temp.denied(format('select public.nal_get_read_day(%L,%L,0)',u,k),'42501','kill switch denies reads');
 perform pg_temp.denied(format('select public.nal_save_read_answer(%L,%L,0,1,''x'',null)',u,k),'42501','kill switch denies writes');
 perform pg_temp.denied(format('select public.nal_complete_read_day(%L,%L,1)',u,k),'42501','kill switch denies completion');
end $$;
select count(*) as passed_checks,bool_and(passed) as all_passed from fix03_results;
select label,passed from fix03_results order by label;
rollback;
