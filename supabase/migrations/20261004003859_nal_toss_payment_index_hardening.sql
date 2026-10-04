-- Applied to hosted NAL project as 20261004003859_nal_toss_payment_index_hardening.
create index if not exists product_checkout_requests_catalog_product_idx
  on nal_private.product_checkout_requests(catalog_kind,product_id);
