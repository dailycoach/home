-- Applied to hosted NAL project as 20261004002706_nal_digital_store_index_hardening.
-- Keep repository migration history aligned with the hosted database.
create index if not exists product_files_catalog_product_idx
  on nal_private.product_files(catalog_kind, product_id);
