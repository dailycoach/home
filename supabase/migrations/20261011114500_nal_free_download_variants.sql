-- NAL free-workbook multi-format downloads; public catalog metadata only.
-- No permissions, payments, private storage or order tables are changed.
create or replace function public.nal_public_product_body(input jsonb)
returns jsonb
language sql
immutable
set search_path to ''
as $function$
  select coalesce(
    jsonb_object_agg(key, case
      when key in ('tags','gallery','galleryAlts','components','recommendedFor',
        'relatedProgramIds','relatedContentIds','audiences','topics','tableOfContents')
        and jsonb_typeof(value) = 'array'
      then coalesce((
        select jsonb_agg(x)
        from jsonb_array_elements(value) x
        where jsonb_typeof(x) = 'string'
      ), '[]'::jsonb)
      when key = 'licenseOptions' and jsonb_typeof(value) = 'array'
      then coalesce((
        select jsonb_agg(coalesce((
          select jsonb_object_agg(k,v)
          from jsonb_each(case when jsonb_typeof(x) = 'object' then x else '{}'::jsonb end) entry(k,v)
          where k in ('id','licenseType','label','price','printingAllowed','downloadLimit','accessPeriod','purchaseUrl')
            and jsonb_typeof(v) <> 'object' and jsonb_typeof(v) <> 'array'
        ), '{}'::jsonb))
        from jsonb_array_elements(value) x
      ), '[]'::jsonb)
      when key = 'options' and jsonb_typeof(value) = 'array'
      then coalesce((
        select jsonb_agg(case when jsonb_typeof(x) = 'string' then x
          else coalesce((
            select jsonb_object_agg(k,v)
            from jsonb_each(case when jsonb_typeof(x) = 'object' then x else '{}'::jsonb end) entry(k,v)
            where k in ('label','name') and jsonb_typeof(v) = 'string'
          ), '{}'::jsonb) end)
        from jsonb_array_elements(value) x
      ), '[]'::jsonb)
      -- Expose only explicitly named same-origin public free PDFs. Never return arbitrary URLs,
      -- private storage paths, signatures, access tokens or nested objects from this field.
      when key = 'freeDownloads' and jsonb_typeof(value) = 'array'
        and input->>'deliveryType' = 'digital' and input->>'price' = '0'
      then coalesce((
        select jsonb_agg(jsonb_build_object(
          'label', left(entry->>'label', 55),
          'description', left(entry->>'description', 180),
          'url', entry->>'url'
        ))
        from (
          select x as entry
          from jsonb_array_elements(value) x
          where jsonb_typeof(x) = 'object'
            and jsonb_typeof(x->'label') = 'string'
            and jsonb_typeof(x->'description') = 'string'
            and jsonb_typeof(x->'url') = 'string'
            and (x->>'url') ~ '^/nal/assets/downloads/free/[a-z0-9-]+[.]pdf$'
          limit 5
        ) safe_free
      ), '[]'::jsonb)
      when jsonb_typeof(value) in ('string','number','boolean','null') then value
      else 'null'::jsonb
    end), '{}'::jsonb
  ) from jsonb_each(input)
  where key = any(array[
    'id','slug','title','subtitle','summary','description','category','tags',
    'coverImage','coverImageAlt','gallery','galleryAlts','price','originalPrice',
    'productType','deliveryType','stock','stockStatus','options','components',
    'cardCount','pageCount','recommendedFor','usageIndividual','usageCouple',
    'usageGroup','precautions','visualNote','shippingPolicy','exchangePolicy',
    'refundPolicy','purchaseUrl','sourceUrl','relatedProgramIds','relatedContentIds',
    'featured','featuredOrder','published','createdAt','updatedAt','fileFormat',
    'fileSizeMB','sampleUrl','deliveryMethod','licenseType','printingAllowed',
    'downloadLimit','accessPeriod','fulfillmentNote','author','audiences','topics',
    'tableOfContents','previewUrl','licenseOptions','version','policyStatus',
    'policyVersion','freeDownloads'
  ]);
$function$;

comment on function public.nal_public_product_body(jsonb)
is 'Public product JSON allowlist with safe same-origin free PDF variant URLs; strips arbitrary nested metadata and private fields.';
