import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSeed } from './prepare-nal-supabase-seed.mjs';

if (!process.env.NAL_PGLITE_MODULE) throw new Error('Set NAL_PGLITE_MODULE to the installed PGlite module path');
const { PGlite } = await import(pathToFileURL(path.resolve(process.env.NAL_PGLITE_MODULE)).href);
const db = new PGlite();
let checks = 0;
const alice = '00000000-0000-4000-8000-000000000001';
const bob = '00000000-0000-4000-8000-000000000002';
const carol = '00000000-0000-4000-8000-000000000003';
const unverified = '00000000-0000-4000-8000-000000000004';
const freeSession = '10000000-0000-4000-8000-000000000001';
const paidSession = '10000000-0000-4000-8000-000000000002';
const hiddenSession = '10000000-0000-4000-8000-000000000003';
const request = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function role(name, uid = '') {
  if (!['anon', 'authenticated', 'postgres', 'service_role'].includes(name)) throw new Error('Invalid test role');
  await db.exec(`reset role; set role ${name};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
}
async function equal(sql, expected, args = []) {
  const result = await db.query(sql, args);
  assert.equal(Object.values(result.rows[0])[0], expected);
  checks++;
}
async function denied(sql, args = [], expectedCode = '42501') {
  await assert.rejects(() => db.query(sql, args), (error) => error.code === expectedCode);
  checks++;
}
const reserve = async (session, key) => (await db.query('select public.nal_register($1, $2) as id', [session, key])).rows[0].id;

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz);
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated, service_role;
    grant select on auth.users to service_role;
    grant all on storage.objects,storage.buckets to service_role;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  for (const file of (await readdir('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort()) {
    await db.exec(await readFile(path.join('supabase/migrations', file), 'utf8'));
  }
  const seed = await buildSeed();
  await db.exec(seed);
  // Import replay must not overwrite existing operational edits.
  await db.exec("update public.nal_catalog set body = body || '{\"seedReplayTest\":true}'::jsonb where kind='hosts' and id='kim-cheol-woong'");
  await db.exec(seed);
  await equal("select (body->>'seedReplayTest')::boolean from public.nal_catalog where kind='hosts' and id='kim-cheol-woong'", true);
  await equal('select count(*)::integer from public.nal_catalog', 21);
  await equal(`select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and (n.nspname = 'nal_private' or (n.nspname = 'public' and c.relname like 'nal_%')) and c.relrowsecurity`, 16);
  await db.query('insert into auth.users values ($1, now()), ($2, now()), ($3, now()), ($4, null)', [alice, bob, carol, unverified]);
  await db.exec(`insert into public.nal_catalog(kind, id, slug, body, published) values
    ('programs', 'test-free', 'test-free', '{"title":"Synthetic free session"}', true),
    ('programs', 'test-draft', 'test-draft', '{"title":"Synthetic draft"}', false),
    ('products', 'test-free', 'test-hidden-product', '{"title":"Hidden product with overlapping id"}', false);
    insert into public.nal_sessions(id, program_id, starts_at, ends_at, capacity, price_won, status, published) values
    ('${freeSession}', 'test-free', now() + interval '1 day', now() + interval '2 days', 1, 0, 'open', true),
    ('${paidSession}', 'test-free', now() + interval '1 day', now() + interval '2 days', 1, 50000, 'open', true),
    ('${hiddenSession}', 'test-draft', now() + interval '1 day', now() + interval '2 days', 1, 0, 'open', true);`);

  await role('anon');
  await equal("select jsonb_array_length(public.nal_public_catalog()->'programs')", 10);
  await equal("select count(*)::integer from public.nal_catalog where id='test-draft'", 0);
  await equal('select count(*)::integer from public.nal_sessions where id=$1', 0, [hiddenSession]);
  await denied('select * from public.nal_profiles');
  await denied('select * from public.nal_registrations');
  await denied('select * from nal_private.audit_log');
  await denied('select public.nal_register($1, $2)', [freeSession, request(1)]);

  await role('authenticated', unverified);
  await denied('select public.nal_register($1, $2)', [freeSession, request(1)]);
  await role('authenticated', alice);
  await db.query('insert into public.nal_profiles(user_id, display_name) values ($1, $2)', [alice, 'Synthetic Alice']);
  await denied('insert into public.nal_profiles(user_id, display_name) values ($1, $2)', [bob, 'Impersonated Bob']);
  await denied('update public.nal_profiles set user_id=$1 where user_id=$2', [bob, alice]);
  await denied('insert into nal_private.admins(user_id, role) values ($1, $2)', [alice, 'owner']);
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({sub: alice, user_metadata:{role:'owner',admin:true}})]);
  await equal('select nal_private.is_admin()', false);
  await equal("with edited as (update public.nal_catalog set published=true where id='test-draft' returning *) select count(*)::integer from edited", 0);
  await denied("insert into public.nal_wishlist(user_id, kind, item_id) values ($1, 'products', 'test-free')", [alice]);
  await db.query("insert into public.nal_wishlist(user_id, kind, item_id) values ($1, 'programs', 'test-free')", [alice]);
  await db.query("insert into public.nal_consents(user_id, purpose, policy_version, granted) values ($1, 'terms', 'test-v1', true)", [alice]);
  await denied("insert into public.nal_consents(user_id, purpose, policy_version, granted, recorded_at) values ($1, 'terms', 'test-v1', true, now())", [alice]);
  await denied('select public.nal_register($1, $2)', [hiddenSession, request(2)], '22023');
  const first = await reserve(freeSession, request(3));
  assert.equal(await reserve(freeSession, request(3)), first); checks++;
  await denied('select public.nal_register($1, $2)', [freeSession, request(30)], '23505');
  await equal('select status from public.nal_registrations where id=$1', 'confirmed', [first]);
  await denied('select public.nal_register($1, $2)', [paidSession, request(3)], '22023');
  await denied("update public.nal_registrations set status='confirmed' where id=$1", [first]);
  await denied("insert into public.nal_orders(user_id, amount_won, status) values ($1, 1, 'paid')", [alice]);

  await role('authenticated', bob);
  await equal('select count(*)::integer from public.nal_profiles', 0);
  await equal('select count(*)::integer from public.nal_registrations', 0);
  await equal('select count(*)::integer from public.nal_wishlist', 0);
  await denied('select public.nal_cancel_registration($1)', [first]);
  const waitlisted = await reserve(freeSession, request(4));
  await equal('select status from public.nal_registrations where id=$1', 'waitlisted', [waitlisted]);

  await role('authenticated', alice);
  await db.query('select public.nal_cancel_registration($1)', [first]);
  await equal('select status from public.nal_registrations where id=$1', 'cancelled', [first]);
  assert.equal(await reserve(freeSession, request(3)), first); checks++;
  await role('authenticated', carol);
  const third = await reserve(freeSession, request(5));
  await equal('select status from public.nal_registrations where id=$1', 'confirmed', [third]);

  await role('authenticated', alice);
  const paid = await reserve(paidSession, request(6));
  await equal('select status from public.nal_registrations where id=$1', 'pending_payment', [paid]);
  await equal('select price_won from public.nal_registrations where id=$1', 50000, [paid]);
  await role('postgres');
  await db.query("update public.nal_registrations set hold_expires_at=now()-interval '1 second' where id=$1", [paid]);
  await role('authenticated', bob);
  const held = await reserve(paidSession, request(7));
  await equal('select status from public.nal_registrations where id=$1', 'pending_payment', [held]);
  await role('postgres');
  await equal('select status from public.nal_registrations where id=$1', 'expired', [paid]);
  await db.query("update public.nal_registrations set status='confirmed' where id=$1", [held]);
  await role('authenticated', bob);
  await db.query('select public.nal_cancel_registration($1)', [held]);
  await equal('select status from public.nal_registrations where id=$1', 'cancellation_requested', [held]);
  await role('authenticated', carol);
  const paidWaiting = await reserve(paidSession, request(8));
  await equal('select status from public.nal_registrations where id=$1', 'waitlisted', [paidWaiting]);

  // Operator authorization is fresh on every statement, rather than JWT metadata.
  await role('postgres');
  await db.query("insert into nal_private.admins(user_id, role) values ($1, 'operator')", [alice]);
  await role('authenticated', alice);
  await equal('select nal_private.is_admin()', true);
  await equal("with edited as (update public.nal_catalog set body=body || '{\"reviewed\":true}' where id='test-draft' returning *) select count(*)::integer from edited", 1);
  await equal('select count(*)::integer > 0 from nal_private.audit_log', true);
  await role('postgres');
  await db.query('delete from nal_private.admins where user_id=$1', [alice]);
  await equal("select count(*)::integer from nal_private.audit_log where table_name='nal_registrations' and (before_catalog is not null or after_catalog is not null)", 0);
  await role('authenticated', alice);
  await equal('select nal_private.is_admin()', false);
  await equal('select count(*)::integer from nal_private.audit_log', 0);

  // Digital delivery fixtures are synthetic and remain in this disposable database.
  const order='30000000-0000-4000-8000-000000000001';
  const item='40000000-0000-4000-8000-000000000001';
  const file='50000000-0000-4000-8000-000000000001';
  const entitlement='60000000-0000-4000-8000-000000000001';
  await role('postgres');
  await denied("insert into public.nal_catalog(kind,id,slug,body,published) values ('products','private-leak','private-leak','{\"originalPdfUrl\":\"secret\"}',true)",[], '23514');
  await denied("insert into public.nal_catalog(kind,id,slug,body,published) values ('products','nested-leak','nested-leak','{\"licenseOptions\":[{\"token\":\"secret\"}]}',true)",[], '23514');
  await denied("insert into public.nal_catalog(kind,id,slug,body,published) values ('products','nested-tags','nested-tags','{\"tags\":[{\"private\":\"secret\"}]}',true)",[], '23514');
  await denied("insert into public.nal_catalog(kind,id,slug,body,published) values ('products','url-leak','url-leak','{\"previewUrl\":\"https://x.test/nal-products-private/file.pdf\"}',true)",[], '23514');
  await equal("select public from storage.buckets where id='nal-products-private'", false);
  await db.exec(`insert into public.nal_orders(id,user_id,amount_won,status) values('${order}','${alice}',100,'pending');
    insert into public.nal_order_items(id,order_id,catalog_kind,catalog_id,title_snapshot,quantity,unit_price_won) values('${item}','${order}','products','emotion-card','Synthetic PDF',1,100);
    insert into nal_private.product_files(id,product_id,object_path,download_name,version,active) values('${file}','emotion-card','emotion-card/v1/original.pdf','qa.pdf','qa-v1',true);`);
  const createEnt = 'insert into public.nal_digital_entitlements(id,user_id,product_id,order_id,order_item_id,file_id,license_type,printing_allowed,download_limit) values($1,$2,\'emotion-card\',$3,$4,$5,\'personal-use\',true,2)';
  const entArgs=[entitlement,alice,order,item,file];
  await denied(createEnt,entArgs);
  await db.query("update public.nal_orders set status='paid' where id=$1",[order]);
  await denied(createEnt,entArgs); // A paid label without a verified payment is insufficient.
  await db.query("insert into public.nal_payments(order_id,provider,provider_event_id,amount_won,status) values($1,'qa','qa-digital-event',100,'paid')",[order]);
  await denied(createEnt,[entitlement,bob,order,item,file]);
  await role('service_role');
  await db.query(createEnt,entArgs);
  const begin=(user,key)=>db.query('select public.nal_begin_download($1,$2,$3) as grant',[user,entitlement,request(key)]);
  const finish=(key,issued)=>db.query('select public.nal_finish_download($1,$2,$3,$4)',[alice,entitlement,request(key),issued]);
  await denied('select public.nal_begin_download($1,$2,$3)',[alice,entitlement,request(100)]); // No original object yet.
  await db.query("insert into storage.objects(bucket_id,name) values('nal-products-private','emotion-card/v1/original.pdf')");
  await denied('select public.nal_begin_download($1,$2,$3)',[bob,entitlement,request(100)]);
  const firstGrant=(await begin(alice,100)).rows[0].grant;
  assert.equal(firstGrant.bucket_id,'nal-products-private'); checks++;
  assert(Date.parse(firstGrant.expires_at)-Date.now()<=600000); checks++;
  await equal('select download_count from public.nal_digital_entitlements where id=$1',1,[entitlement]);
  await begin(alice,100);
  await equal('select download_count from public.nal_digital_entitlements where id=$1',1,[entitlement]);
  await finish(100,true);
  await finish(100,true);
  await begin(alice,101);
  await denied('select public.nal_begin_download($1,$2,$3)',[alice,entitlement,request(102)]);
  await finish(101,false); // Storage signing failure returns the reserved quota.
  await finish(101,false);
  await equal('select download_count from public.nal_digital_entitlements where id=$1',1,[entitlement]);
  await denied('select public.nal_begin_download($1,$2,$3)',[alice,entitlement,request(101)]);
  await begin(alice,102);
  await db.query("update public.nal_download_events set created_at=now()-interval '3 minutes' where request_id=$1",[request(102)]);
  await begin(alice,103);
  await equal("select status from public.nal_download_events where request_id=$1",'failed',[request(102)]);
  await equal('select download_count from public.nal_digital_entitlements where id=$1',2,[entitlement]);
  await db.query('update public.nal_digital_entitlements set revoked_at=now() where id=$1',[entitlement]);
  await denied('select public.nal_begin_download($1,$2,$3)',[alice,entitlement,request(100)]);
  await denied('select public.nal_finish_download($1,$2,$3,true)',[alice,entitlement,request(103)]);
  await denied('select public.nal_finish_download($1,$2,$3,true)',[alice,entitlement,request(100)]); // Replayed issued request also rechecks rights.
  await finish(103,false);
  await db.query('update public.nal_digital_entitlements set revoked_at=null,expires_at=now()-interval \'1 second\' where id=$1',[entitlement]);
  await denied('select public.nal_begin_download($1,$2,$3)',[alice,entitlement,request(104)]);
  await db.query('update public.nal_digital_entitlements set expires_at=now()+interval \'1 minute\' where id=$1',[entitlement]);
  const shortGrant=(await begin(alice,104)).rows[0].grant;
  assert(Date.parse(shortGrant.expires_at)-Date.now()<=60000); checks++;
  await db.query("update public.nal_orders set status='refunded' where id=$1",[order]);
  await denied('select public.nal_finish_download($1,$2,$3,true)',[alice,entitlement,request(104)]);
  await finish(104,false);
  await denied('select public.nal_begin_download($1,$2,$3)',[alice,entitlement,request(105)]);
  await db.query("update public.nal_orders set status='paid' where id=$1",[order]);
  await db.query('update nal_private.product_files set active=false where id=$1',[file]);
  await denied('select public.nal_begin_download($1,$2,$3)',[alice,entitlement,request(105)]);
  await db.query('update nal_private.product_files set active=true where id=$1',[file]);
  await db.query("update public.nal_payments set status='refunded' where order_id=$1",[order]);
  await denied('select public.nal_begin_download($1,$2,$3)',[alice,entitlement,request(105)]);
  await db.query("update public.nal_payments set status='paid' where order_id=$1",[order]);
  await db.query("update storage.buckets set public=true where id='nal-products-private'");
  await denied('select public.nal_begin_download($1,$2,$3)',[alice,entitlement,request(105)]);
  await db.query("update storage.buckets set public=false where id='nal-products-private'");
  await denied('select public.nal_finish_download($1,$2,$3,null)',[alice,entitlement,request(100)], '22023');
  await role('anon');
  await denied('select * from public.nal_digital_entitlements');
  await denied('select * from public.nal_download_events');
  await denied('select * from nal_private.product_files');
  await denied('select public.nal_begin_download($1,$2,$3)',[alice,entitlement,request(106)]);
  await equal('select count(*)::integer from public.nal_products',4);
  await role('authenticated',bob);
  await equal('select count(*)::integer from public.nal_digital_entitlements',0);
  await equal('select count(*)::integer from public.nal_download_events',0);
  await denied('select * from nal_private.product_files');
  await denied('select public.nal_begin_download($1,$2,$3)',[alice,entitlement,request(106)]);
  await denied('select public.nal_finish_download($1,$2,$3,true)',[alice,entitlement,request(106)]);
  await role('authenticated',alice);
  await equal('select count(*)::integer from public.nal_digital_entitlements',1);
  await equal('select count(*)::integer>0 from public.nal_download_events',true);
  await denied('update public.nal_digital_entitlements set download_count=0');
  await equal('select count(*)::integer from storage.objects',0);
  await denied('insert into storage.objects(bucket_id,name) values(\'nal-products-private\',\'illegal.pdf\')');

  console.log(`NAL Supabase foundation: ${checks} checks passed (SQL/RLS, sequential reservations and digital download permissions).`);
} finally {
  await db.close();
}
