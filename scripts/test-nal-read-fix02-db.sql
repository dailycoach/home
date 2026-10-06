\set ON_ERROR_STOP on
-- Transaction-only fixtures. No email, permanent user, or payment provider call.
begin;
set local statement_timeout='30s';
create temporary table fix02_results(label text primary key,passed boolean not null);
create function pg_temp.fix02_check(ok boolean,label text) returns void language plpgsql as $$
begin
 if ok is not true then raise exception 'NAL-FIX-02: %',label; end if;
 insert into fix02_results values(label,true);
end $$;
create function pg_temp.fix02_reject(q text,want text,label text) returns void language plpgsql as $$
begin
 begin execute q;
 exception when others then
  if sqlstate<>want then raise exception 'NAL-FIX-02: % got %, wanted %',label,sqlstate,want; end if;
  insert into fix02_results values(label,true);return;
 end;
 raise exception 'NAL-FIX-02: % unexpectedly accepted',label;
end $$;
do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); s uuid; s2 uuid; d0 uuid; d1 uuid;
 o uuid:=gen_random_uuid(); item uuid:=gen_random_uuid(); req uuid:=gen_random_uuid(); pe uuid;
 k text:='scopeqa-'||substr(gen_random_uuid()::text,1,8); r jsonb; n integer; value text;
begin
 perform pg_temp.fix02_check((select mode='off' from nal_private.read_release_control),'default OFF');
 perform pg_temp.fix02_check((select count(*)=0 from nal_private.read_test_allowlist),'empty production allowlist');
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
 insert into public.nal_read_seasons(slug,title,status) values(k||'-other','Other season','open') returning id into s2;
 perform pg_temp.fix02_check((public.nal_get_read_access(u,k)->>'allowed')::boolean=false,'OFF denies access');
 perform pg_temp.fix02_reject(format('select public.nal_issue_read_enrollment(%L,%L,%L,%L)',u,k,o,req),'42501','OFF denies claim');
 update nal_private.read_release_control set mode='test_only';
 perform pg_temp.fix02_check((public.nal_read_release_guard(u,k)->>'allowed')::boolean=false,'test_only needs allowlist');
 insert into nal_private.read_test_allowlist(user_id,season_id,approval_ref) values(u,s,'synthetic transaction-only QA');
 perform pg_temp.fix02_check((public.nal_read_release_guard(u,k)->>'allowed')::boolean,'matching user and season admitted');
 perform pg_temp.fix02_check((public.nal_read_release_guard(other_u,k)->>'allowed')::boolean=false,'other user denied');
 perform pg_temp.fix02_check((public.nal_read_release_guard(u,k||'-other')->>'allowed')::boolean=false,'other season denied');
 update auth.users set email_confirmed_at=null where id=u;
 perform pg_temp.fix02_check((public.nal_read_release_guard(u,k)->>'allowed')::boolean=false,'unconfirmed email denied');
 update auth.users set email_confirmed_at=now() where id=u;
 update nal_private.read_test_allowlist set granted_at=now()-interval '2 days',expires_at=now()-interval '1 day' where user_id=u;
 perform pg_temp.fix02_check((public.nal_read_release_guard(u,k)->>'allowed')::boolean=false,'expired scope denied');
 update nal_private.read_test_allowlist set granted_at=now(),expires_at=now()+interval '1 day',revoked_at=now() where user_id=u;
 perform pg_temp.fix02_check((public.nal_read_release_guard(u,k)->>'allowed')::boolean=false,'revoked scope denied');
 update nal_private.read_test_allowlist set revoked_at=null where user_id=u;
 -- Exercise the actual runtime role, not the table-owner role.
 execute 'set local role service_role';
 r:=public.nal_issue_read_enrollment(u,k,o,req);
 execute 'reset role';
 perform pg_temp.fix02_check((r->>'allowed')::boolean,'allowed service-role claim succeeds');
 select entitlement_id into pe from public.nal_read_enrollments where user_id=u and season_id=s;
 update public.nal_product_entitlements set status='revoked',revoked_at=now() where id=pe;
 r:=public.nal_issue_read_enrollment(u,k,o,gen_random_uuid());
 perform pg_temp.fix02_check((r->>'allowed')::boolean=false,'allowlist does not revive revoked entitlement');
 perform pg_temp.fix02_check((select status='revoked' and revoked_at is not null from public.nal_product_entitlements where id=pe),'revoked fields unchanged');
 update public.nal_product_entitlements set status='active',revoked_at=null where id=pe;
 insert into nal_private.read_days(season_id,day_number,title,day_type,status) values(s,0,'Before','before','published') returning id into d0;
 insert into nal_private.read_days(season_id,day_number,title,status) values(s,1,'DAY 1','published') returning id into d1;
 insert into nal_private.read_day_steps(day_id,step_order,step_type,prompt,required,status)
 values(d0,1,'QUESTION','Required text',true,'published');
 perform pg_temp.fix02_reject(format('select public.nal_complete_read_day(%L,%L,1)',u,k),'42501','allowlisted locked DAY cannot complete');
 perform pg_temp.fix02_reject(format('select public.nal_save_read_answer(%L,%L,0,1,%L,null)',u,k,chr(11)),'22023','vertical tab is blank');
 perform pg_temp.fix02_reject(format('select public.nal_save_read_answer(%L,%L,0,1,%L,null)',u,k,'   '),'22023','spaces rejected');
 execute 'set local role service_role';
 perform public.nal_get_read_day(u,k,0);
 r:=public.nal_save_read_answer(u,k,0,1,'v',null);
 execute 'reset role';
 perform pg_temp.fix02_check((r->>'saved')::boolean,'letter v is valid text');
 perform pg_temp.fix02_check((select answer_text='v' from public.nal_read_answers where user_id=u and day_id=d0),'letter v stored unchanged');
 execute 'set local role service_role';
 r:=public.nal_complete_read_day(u,k,0);
 perform public.nal_get_read_day(u,k,1);
 execute 'reset role';
 perform pg_temp.fix02_check((r->>'completed')::boolean,'runtime role saves and completes');
 perform set_config('request.jwt.claim.sub',u::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.nal_read_answers;
 execute 'reset role';
 perform pg_temp.fix02_check(n=0,'owner direct table reads blocked');
 execute 'set local role authenticated';
 select count(*) into n from public.nal_read_enrollments;
 execute 'reset role';
 perform pg_temp.fix02_check(n=0,'owner direct enrollment bypass blocked');
 execute 'set local role anon';
 select count(*) into n from public.nal_read_seasons;
 execute 'reset role';
 perform pg_temp.fix02_check(n=0,'anonymous season enumeration blocked');
 perform pg_temp.fix02_check(not has_function_privilege('authenticated','public.nal_read_release_guard(uuid,text)','execute'),'authenticated cannot invoke privileged scope RPC');
 perform pg_temp.fix02_check(not has_function_privilege('authenticated','nal_private.read_access_core(uuid,text)','execute'),'private access core not callable by client');
 perform pg_temp.fix02_check(not has_table_privilege('service_role','nal_private.read_test_allowlist','insert'),'runtime cannot grant test access');
 perform pg_temp.fix02_check(not has_table_privilege('service_role','nal_private.read_release_control','update'),'runtime cannot activate READ');
 update nal_private.read_release_control set mode='off';
 perform pg_temp.fix02_reject(format('select public.nal_get_read_day(%L,%L,0)',u,k),'42501','kill switch blocks reads');
 perform pg_temp.fix02_reject(format('select public.nal_save_read_answer(%L,%L,0,1,''test'',null)',u,k),'42501','kill switch blocks saves');
 perform pg_temp.fix02_reject(format('select public.nal_complete_read_day(%L,%L,1)',u,k),'42501','kill switch blocks completion');
 perform pg_temp.fix02_reject(format('select public.nal_read_bootstrap(%L,%L)',u,k),'42501','kill switch blocks journey');
 delete from nal_private.read_release_control;
 perform pg_temp.fix02_check((public.nal_get_read_access(u,k)->>'allowed')::boolean=false,'missing control row fails closed');
end $$;
select count(*) as passed_checks,bool_and(passed) as all_passed from fix02_results;
select label,passed from fix02_results order by label;
rollback;
