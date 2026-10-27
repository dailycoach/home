-- NAL monthly reading group: immediate publication with operator hide/delete.
-- No synthetic reviews or personal contact details are seeded.
create table public.nal_gather_reviews (
  id uuid primary key default gen_random_uuid(),
  gather_slug text not null check (gather_slug = 'life-control-monthly'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 24),
  review_body text not null check (char_length(btrim(review_body)) between 20 and 800),
  publication_consent boolean not null check (publication_consent is true),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.nal_gather_reviews is
  'Public visitor-submitted NAL monthly group reviews; published immediately, operator can hide/delete.';
comment on column public.nal_gather_reviews.is_hidden is
  'Operator moderation switch: true hides the review without deleting its contents.';

alter table public.nal_gather_reviews enable row level security;
revoke all on table public.nal_gather_reviews from public, anon, authenticated;

-- Visitors can read only visible, consented reviews and cannot see moderation fields.
grant select (id, gather_slug, display_name, review_body, created_at)
  on public.nal_gather_reviews to anon, authenticated;
-- Visitors can supply only public fields; ID, timestamps and moderation flag are server-owned.
grant insert (gather_slug, display_name, review_body, publication_consent)
  on public.nal_gather_reviews to anon, authenticated;

create policy nal_gather_reviews_visible_read
  on public.nal_gather_reviews for select to anon, authenticated
  using (is_hidden = false and publication_consent = true);

create policy nal_gather_reviews_public_insert
  on public.nal_gather_reviews for insert to anon, authenticated
  with check (gather_slug = 'life-control-monthly' and is_hidden = false and publication_consent = true);

create index nal_gather_reviews_visible_recent_idx
  on public.nal_gather_reviews (gather_slug, created_at desc)
  where is_hidden = false;

-- A small global write cap reduces automated floods without retaining IP addresses.
create function nal_private.nal_gather_review_throttle()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(271027, 1);
  if (select count(*) from public.nal_gather_reviews
      where created_at >= pg_catalog.now() - interval '1 minute') >= 10 then
    raise exception 'Review submission limit reached. Try again shortly.'
      using errcode = 'P0001';
  end if;
  if exists (select 1 from public.nal_gather_reviews
             where review_body = new.review_body
             and created_at >= pg_catalog.now() - interval '1 day') then
    raise exception 'Duplicate review. Try a different message.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function nal_private.nal_gather_review_throttle() from public, anon, authenticated;
create trigger nal_gather_review_throttle_before_insert
before insert on public.nal_gather_reviews
for each row execute function nal_private.nal_gather_review_throttle();
