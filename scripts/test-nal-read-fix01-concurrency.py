"""Concurrent retries against an explicitly disposable PostgreSQL CI database only."""
import concurrent.futures
import json
import os
import subprocess
import uuid

if os.environ.get('NAL_QA_ISOLATED_DATABASE') != '1':
    raise SystemExit('Refusing concurrency fixtures outside an isolated CI database')

def sql(query):
    result = subprocess.run(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query],
                            text=True, capture_output=True, timeout=30, check=True)
    return result.stdout.strip()

if not sql('select current_database()').startswith('nal_read_fix01'):
    raise SystemExit('Unexpected database; fixture creation refused')

u, order, item, request_id = [str(uuid.uuid4()) for _ in range(4)]
slug = 'fix01-concurrent-' + uuid.uuid4().hex[:8]
sql(f"""
insert into auth.users(id,email_confirmed_at) values('{u}',now());
insert into public.nal_catalog(kind,id,published,body) values('products','{slug}',false,'{{"title":"Synthetic concurrency QA"}}');
insert into public.nal_orders(id,user_id,amount_won,status) values('{order}','{u}',0,'paid');
insert into public.nal_order_items(id,order_id,catalog_kind,catalog_id,title_snapshot,quantity,unit_price_won)
values('{item}','{order}','products','{slug}','Synthetic QA',1,0);
insert into public.nal_read_seasons(slug,title,product_id,status) values('{slug}','Synthetic QA','{slug}','open');
""")

def claim(rid):
    return json.loads(sql(f"select public.nal_issue_read_enrollment('{u}','{slug}','{order}','{rid}')"))

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    first = list(pool.map(claim, [request_id] * 8))
assert all(x['allowed'] is True for x in first)
assert len({x['enrollmentId'] for x in first}) == 1
assert sql(f"select count(*) from nal_private.read_enrollment_requests where request_id='{request_id}'") == '1'

sql(f"update public.nal_product_entitlements set status='revoked',revoked_at=now() where user_id='{u}'")
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    retried = list(pool.map(claim, [str(uuid.uuid4()) for _ in range(8)]))
assert all(x['allowed'] is False for x in retried)
assert sql(f"select count(*) from public.nal_read_enrollments where user_id='{u}'") == '1'
assert sql(f"select count(*) from public.nal_product_entitlements where user_id='{u}' and status='revoked' and revoked_at is not null") == '1'
print('NAL-FIX-01 concurrency: 16 parallel requests / 6 assertions PASS; disposable CI fixtures only')
