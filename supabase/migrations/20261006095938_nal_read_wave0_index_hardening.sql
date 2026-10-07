begin;

create index nal_read_seasons_product
  on public.nal_read_seasons(product_kind,product_id);

create index nal_read_enrollments_season
  on public.nal_read_enrollments(season_id);

create index nal_read_enrollments_entitlement
  on public.nal_read_enrollments(entitlement_id);

create index read_enrollment_requests_user
  on nal_private.read_enrollment_requests(user_id);

create index read_enrollment_requests_season
  on nal_private.read_enrollment_requests(season_id);

create index read_enrollment_requests_order
  on nal_private.read_enrollment_requests(order_id);

create index read_enrollment_requests_enrollment
  on nal_private.read_enrollment_requests(enrollment_id);

commit;
