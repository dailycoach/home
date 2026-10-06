\set ON_ERROR_STOP on

insert into auth.users(id,email_confirmed_at)
values ('a1000000-0000-4000-8000-000000000001',now());

insert into public.nal_catalog(kind,id,published,body)
values ('products','trend-2027-read',true,'{"title":"NAL READ 01","price":39000}'::jsonb);

insert into public.nal_orders(id,user_id,status,amount_won)
values ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','paid',39000);

insert into public.nal_order_items(id,order_id,catalog_kind,catalog_id,title_snapshot,quantity,unit_price_won)
values ('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','products','trend-2027-read','NAL READ 01',1,39000);

insert into public.nal_read_seasons(slug,title,product_id,status)
values ('trend-2027','TREND 2027','trend-2027-read','open');

select public.nal_issue_read_enrollment(
  'a1000000-0000-4000-8000-000000000001',
  'trend-2027',
  'a2000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001'
);

insert into nal_private.read_weeks(season_id,week_number,slug,title,status)
select id,1,'signal','SIGNAL','published' from public.nal_read_seasons where slug='trend-2027';

insert into nal_private.read_days(season_id,week_id,day_number,title,day_type,estimated_minutes,status)
select s.id,null,0,'BEFORE','before',3,'published'
from public.nal_read_seasons s where s.slug='trend-2027';

insert into nal_private.read_days(season_id,week_id,day_number,title,day_type,estimated_minutes,status)
select s.id,w.id,1,'재미가 없어진 이유','daily',4,'published'
from public.nal_read_seasons s
join nal_private.read_weeks w on w.season_id=s.id and w.week_number=1
where s.slug='trend-2027';

insert into nal_private.read_day_steps(day_id,step_order,step_type,prompt,required,status)
select id,1,'SCALE','나는 요즘 삶에 만족한다.',true,'published'
from nal_private.read_days where day_number=0;

insert into nal_private.read_day_steps(day_id,step_order,step_type,prompt,placeholder,required,status)
select id,2,'QUESTION','28일 뒤 무엇이 달라져 있으면 좋겠나요?','한 문장이어도 충분합니다.',true,'published'
from nal_private.read_days where day_number=0;

insert into nal_private.read_day_steps(day_id,step_order,step_type,content,required,status)
select id,1,'HOOK','열심히 사는데 왜 재미가 없을까요?',false,'published'
from nal_private.read_days where day_number=1;

insert into nal_private.read_day_steps(day_id,step_order,step_type,prompt,placeholder,required,status)
select id,2,'QUESTION','최근 한 달 동안 가장 살아있다고 느낀 순간은 언제였나요?','한 문장이어도 충분합니다.',true,'published'
from nal_private.read_days where day_number=1;

do $$
declare r jsonb;
begin
  r:=public.nal_read_bootstrap('a1000000-0000-4000-8000-000000000001','trend-2027');
  if (r->>'currentDay')::int<>0 then raise exception 'expected currentDay 0: %',r; end if;
  if jsonb_array_length(r->'journey')<>2 then raise exception 'expected 2 journey days'; end if;
end $$;

do $$
begin
  perform public.nal_get_read_day('a1000000-0000-4000-8000-000000000001','trend-2027',1);
  raise exception 'day 1 should have been locked';
exception when sqlstate '42501' then null;
end $$;

select public.nal_get_read_day('a1000000-0000-4000-8000-000000000001','trend-2027',0);

select public.nal_save_read_answer(
  'a1000000-0000-4000-8000-000000000001','trend-2027',0,1,null,'{"value":4}'::jsonb
);
select public.nal_save_read_answer(
  'a1000000-0000-4000-8000-000000000001','trend-2027',0,2,'방향이 조금 더 선명해졌으면 좋겠다',null
);

select public.nal_complete_read_day('a1000000-0000-4000-8000-000000000001','trend-2027',0);

do $$
declare r jsonb;
begin
  r:=public.nal_read_bootstrap('a1000000-0000-4000-8000-000000000001','trend-2027');
  if (r->>'currentDay')::int<>1 then raise exception 'expected currentDay 1: %',r; end if;
end $$;

select public.nal_get_read_day('a1000000-0000-4000-8000-000000000001','trend-2027',1);
select public.nal_save_read_answer(
  'a1000000-0000-4000-8000-000000000001','trend-2027',1,2,'친한 사람과 오래 대화했을 때',null
);
select public.nal_complete_read_day('a1000000-0000-4000-8000-000000000001','trend-2027',1);

do $$
declare c integer;
begin
  select count(*) into c from public.nal_read_answers where user_id='a1000000-0000-4000-8000-000000000001';
  if c<>3 then raise exception 'expected 3 answers, got %',c; end if;
  select count(*) into c from public.nal_read_day_progress where user_id='a1000000-0000-4000-8000-000000000001' and status='completed';
  if c<>2 then raise exception 'expected 2 completed days, got %',c; end if;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',false);
do $$
declare c integer;
begin
  select count(*) into c from public.nal_read_answers;
  if c<>3 then raise exception 'owner answer RLS failed %',c; end if;
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000099',false);
do $$
declare c integer;
begin
  select count(*) into c from public.nal_read_answers;
  if c<>0 then raise exception 'cross-user answer leak %',c; end if;
end $$;
reset role;

select 'NAL READ W1 DB cases passed' as result;
