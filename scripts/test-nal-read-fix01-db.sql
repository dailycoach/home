\set ON_ERROR_STOP on
-- All fixtures and test results are rolled back. No email or payment provider is called.
begin;
set local statement_timeout='30s';
create temporary table fix01_results(label text primary key,passed boolean not null);
create function pg_temp.check_ok(ok boolean,label text) returns void language plpgsql as $$
begin
 if ok is not true then raise exception 'NAL-FIX-01: %',label; end if;
 insert into fix01_results values(label,true);
end $$;
create function pg_temp.reject(q text,want text,label text) returns void language plpgsql as $$
begin
 begin
  execute q;
 exception when others then
  if sqlstate<>want then raise exception 'NAL-FIX-01: % wrong SQLSTATE %, wanted %',label,sqlstate,want; end if;
  insert into fix01_results values(label,true); return;
 end;
 raise exception 'NAL-FIX-01: % unexpectedly accepted',label;
end $$;

do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); o uuid:=gen_random_uuid();
 item uuid:=gen_random_uuid(); req uuid:=gen_random_uuid(); s uuid; w uuid; d0 uuid; d1 uuid;
 k text:='fix01-'||substr(gen_random_uuid()::text,1,8); e uuid; pe uuid; r jsonb; expiry timestamptz;
 state text; q text; val text; answer_id uuid;
begin
 insert into auth.users(id,email_confirmed_at) values(u,now()),(other_u,now());
 -- The shared CI fixture has no slug requirement; use only the common catalog contract.
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='nal_catalog' and column_name='slug') then
  execute 'insert into public.nal_catalog(kind,id,slug,published,body) values(''products'',$1,$1,false,''{"title":"Synthetic QA","price":0}'')' using k;
 else
  insert into public.nal_catalog(kind,id,published,body) values('products',k,false,'{"title":"Synthetic QA","price":0}');
 end if;
 insert into public.nal_orders(id,user_id,amount_won,status) values(o,u,0,'paid');
 insert into public.nal_order_items(id,order_id,catalog_kind,catalog_id,title_snapshot,quantity,unit_price_won)
  values(item,o,'products',k,'Synthetic QA',1,0);
 insert into public.nal_read_seasons(slug,title,product_id,status) values(k,'Synthetic QA',k,'open') returning id into s;
 r:=public.nal_issue_read_enrollment(u,k,o,req);
 e:=(r->>'enrollmentId')::uuid;
 select entitlement_id into pe from public.nal_read_enrollments where id=e;
 perform pg_temp.check_ok((r->>'allowed')::boolean,'first claim active');
 perform public.nal_issue_read_enrollment(u,k,o,req);
 perform pg_temp.check_ok((select count(*)=1 from public.nal_read_enrollments where user_id=u),'same request idempotent');
 update public.nal_product_entitlements set status='revoked',revoked_at=now() where id=pe;
 r:=public.nal_issue_read_enrollment(u,k,o,gen_random_uuid());
 perform pg_temp.check_ok((r->>'allowed')::boolean=false,'revoked claim denied');
 perform pg_temp.check_ok((select status='revoked' and revoked_at is not null from public.nal_product_entitlements where id=pe),'revoked state preserved');
 expiry:=now()-interval '1 day';
 update public.nal_product_entitlements set status='active',revoked_at=null,expires_at=expiry where id=pe;
 r:=public.nal_issue_read_enrollment(u,k,o,gen_random_uuid());
 perform pg_temp.check_ok((r->>'allowed')::boolean=false,'elapsed expiry denied');
 perform pg_temp.check_ok((select expires_at=expiry from public.nal_product_entitlements where id=pe),'expiry timestamp preserved');
 foreach state in array array['expired','refunded'] loop
  update public.nal_product_entitlements set status=state,expires_at=null where id=pe;
  r:=public.nal_issue_read_enrollment(u,k,o,gen_random_uuid());
  perform pg_temp.check_ok((r->>'allowed')::boolean=false,'entitlement '||state||' denied');
  perform pg_temp.check_ok((select status=state from public.nal_product_entitlements where id=pe),'entitlement '||state||' preserved');
 end loop;
 update public.nal_product_entitlements set status='active',expires_at=null,revoked_at=null where id=pe;
 foreach state in array array['paused','revoked','refunded'] loop
  update public.nal_read_enrollments set status=state where id=e;
  r:=public.nal_issue_read_enrollment(u,k,o,gen_random_uuid());
  perform pg_temp.check_ok((r->>'allowed')::boolean=false,'enrollment '||state||' denied');
  perform pg_temp.check_ok((select status=state from public.nal_read_enrollments where id=e),'enrollment '||state||' preserved');
 end loop;
 update public.nal_read_enrollments set status='completed',completed_at=now() where id=e;
 r:=public.nal_issue_read_enrollment(u,k,o,gen_random_uuid());
 perform pg_temp.check_ok((r->>'allowed')::boolean and (select status='completed' from public.nal_read_enrollments where id=e),'completed access retained without resetting');
 update public.nal_read_enrollments set status='active' where id=e;
 perform pg_temp.reject(format('select public.nal_issue_read_enrollment(%L,%L,%L,%L)',other_u,k,o,req),'23505','request owner collision');
 perform pg_temp.reject(format('select public.nal_issue_read_enrollment(%L,%L,%L,%L)',other_u,k,o,gen_random_uuid()),'42501','other user order rejected');
 insert into public.nal_read_seasons(slug,title,status) values(k||'-other','Other synthetic season','open');
 perform pg_temp.reject(format('select public.nal_issue_read_enrollment(%L,%L,%L,%L)',u,k||'-other',o,req),'23505','request season collision');
 update public.nal_orders set status='refunded' where id=o;
 r:=public.nal_issue_read_enrollment(u,k,o,req);
 perform pg_temp.check_ok((r->>'allowed')::boolean=false,'same request after refund denied');
 perform pg_temp.reject(format('select public.nal_issue_read_enrollment(%L,%L,%L,%L)',u,k,o,gen_random_uuid()),'42501','new request after refund denied');
 update public.nal_orders set status='paid' where id=o;
 update public.nal_product_entitlements set resource_id=k||'-other' where id=pe;
 perform pg_temp.check_ok((public.nal_get_read_access(u,k)->>'allowed')::boolean=false,'entitlement resource binding');
 update public.nal_product_entitlements set resource_id=k where id=pe;
 insert into nal_private.read_weeks(season_id,week_number,slug,title,status) values(s,1,'one','Week','published') returning id into w;
 insert into nal_private.read_days(season_id,day_number,title,day_type,status) values(s,0,'Before','before','published') returning id into d0;
 insert into nal_private.read_days(season_id,week_id,day_number,title,status) values(s,w,1,'Locked zero-required day','published') returning id into d1;
 insert into nal_private.read_day_steps(day_id,step_order,step_type,prompt,required,status)
  values(d0,1,'QUESTION','Question',true,'published'),(d0,2,'SCALE','Scale',true,'published');
 insert into nal_private.read_day_steps(day_id,step_order,step_type,prompt,required,status,options)
  values(d0,3,'MULTI_SELECT','Choices',true,'published','["A","B"]');
 insert into nal_private.read_day_steps(day_id,step_order,step_type,prompt,required,status)
  values(d1,1,'QUESTION','Optional',false,'published');
 perform pg_temp.reject(format('select public.nal_get_read_day(%L,%L,1)',u,k),'42501','locked day read rejected');
 perform pg_temp.reject(format('select public.nal_save_read_answer(%L,%L,1,1,''x'',null)',u,k),'42501','locked day save rejected');
 perform pg_temp.reject(format('select public.nal_complete_read_day(%L,%L,1)',u,k),'42501','locked zero-required completion rejected');
 perform pg_temp.reject(format('select public.nal_complete_read_day(%L,%L,0)',u,k),'22023','missing required answers rejected');
 foreach val in array array['',E' \n\t',chr(12288)||chr(8203)] loop
  perform pg_temp.reject(format('select public.nal_save_read_answer(%L,%L,0,1,%L,null)',u,k,val),'22023','blank text '||length(val)||' rejected');
 end loop;
 perform pg_temp.reject(format('select public.nal_save_read_answer(%L,%L,0,1,null,null)',u,k),'22023','null required text rejected');
 perform pg_temp.reject(format('select public.nal_save_read_answer(%L,%L,0,1,%L,null)',u,k,repeat('x',5001)),'22023','oversize text rejected');
 foreach val in array array['{"value":0}','{"value":6}','{"value":1.5}','{"value":"4"}','{}','{"value":4,"extra":1}','null'] loop
  perform pg_temp.reject(format('select public.nal_save_read_answer(%L,%L,0,2,null,%L::jsonb)',u,k,val),'22023','invalid scale '||val);
 end loop;
 foreach val in array array['{"values":[]}','{"values":["C"]}','{"values":["A","A"]}','{"values":[1]}','{"values":"A"}','{"values":["A"],"extra":1}'] loop
  perform pg_temp.reject(format('select public.nal_save_read_answer(%L,%L,0,3,null,%L::jsonb)',u,k,val),'22023','invalid choices '||val);
 end loop;
 perform public.nal_save_read_answer(u,k,0,1,'Valid test answer',null);
 perform public.nal_save_read_answer(u,k,0,2,null,'{"value":4}');
 perform public.nal_save_read_answer(u,k,0,3,null,'{"values":["A","B"]}');
 perform pg_temp.check_ok((select count(*)=3 from public.nal_read_answers where user_id=u),'valid typed answers saved');
 -- Privileged fixture injection models legacy invalid rows, not an end-user write.
 update public.nal_read_answers set answer_text=' ' where user_id=u and step_id=(select id from nal_private.read_day_steps where day_id=d0 and step_order=1);
 perform pg_temp.reject(format('select public.nal_complete_read_day(%L,%L,0)',u,k),'22023','legacy invalid row cannot complete');
 perform public.nal_save_read_answer(u,k,0,1,'Valid test answer',null);
 perform pg_temp.check_ok((public.nal_complete_read_day(u,k,0)->>'completed')::boolean,'valid day completion');
 update nal_private.read_days set available_at=now()+interval '1 day' where id=d1;
 perform pg_temp.reject(format('select public.nal_get_read_day(%L,%L,1)',u,k),'42501','future day read rejected');
 perform pg_temp.reject(format('select public.nal_save_read_answer(%L,%L,1,1,''x'',null)',u,k),'42501','future day save rejected');
 perform pg_temp.reject(format('select public.nal_complete_read_day(%L,%L,1)',u,k),'42501','future day completion rejected');
 r:=public.nal_read_bootstrap(u,k);
 perform pg_temp.check_ok(not (r->'journey'->1->>'unlocked')::boolean,'journey honors release time');
 update nal_private.read_days set available_at=null where id=d1;
 update nal_private.read_weeks set status='draft' where id=w;
 perform pg_temp.reject(format('select public.nal_get_read_day(%L,%L,1)',u,k),'22023','unpublished week read rejected');
 perform pg_temp.reject(format('select public.nal_complete_read_day(%L,%L,1)',u,k),'22023','unpublished week completion rejected');
 update nal_private.read_weeks set status='published' where id=w;
 update public.nal_read_seasons set starts_at=now()+interval '1 day' where id=s;
 perform pg_temp.reject(format('select public.nal_complete_read_day(%L,%L,1)',u,k),'42501','future season rejected');
 update public.nal_read_seasons set starts_at=null,status='draft' where id=s;
 perform pg_temp.reject(format('select public.nal_get_read_day(%L,%L,0)',u,k),'42501','unpublished season rejected');
 update public.nal_read_seasons set status='open' where id=s;
 perform pg_temp.check_ok((public.nal_complete_read_day(u,k,1)->>'completed')::boolean,'unlocked zero-required day completes');
 perform pg_temp.check_ok((select count(*)=1 from public.nal_read_enrollments where user_id=u),'retry enrollment count remains one');
 perform pg_temp.check_ok((select count(*)=1 from public.nal_product_entitlements where user_id=u),'retry entitlement count remains one');
 perform pg_temp.check_ok(not has_function_privilege('authenticated','public.nal_complete_read_day(uuid,text,integer)','execute'),'authenticated cannot call privileged completion RPC');
 perform pg_temp.check_ok(not has_function_privilege('anon','public.nal_issue_read_enrollment(uuid,text,uuid,uuid)','execute'),'anon cannot call claim RPC');
 perform pg_temp.check_ok(not has_function_privilege('authenticated','nal_private.read_day_gate(uuid,text,integer)','execute'),'private gate is not public');
 perform pg_temp.check_ok((select count(*)=1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='nal_private' and p.proname='read_day_gate' and not p.prosecdef),'gate does not bypass RLS');
end $$;
select count(*) as passed_checks, bool_and(passed) as all_passed from fix01_results;
select label,passed from fix01_results order by label;
rollback;
