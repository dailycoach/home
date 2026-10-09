import { isDeepStrictEqual } from 'node:util';

// The public RPC intentionally retains legacy "card" in the database.
// NALStore.type() normalizes it to "physicalCard" for filtering and display.
const productType = (value) => ({ card: 'physicalCard' }[value] || value);
const same = (a, b) => isDeepStrictEqual(a ?? null, b ?? null);

export const ARCHIVED_STARTER_IDS = Object.freeze([
  'nal-starter-01-mind-reset',
  'nal-starter-02-relationship-dialogue',
  'nal-starter-03-next-step'
]);

export const PRODUCT_FIELDS = Object.freeze([
  'slug', 'title', 'subtitle', 'summary', 'category', 'author',
  'deliveryType', 'price', 'originalPrice', 'stockStatus',
  'coverImage', 'coverImageAlt', 'sampleUrl', 'previewUrl', 'purchaseUrl',
  'fileSizeMB', 'version', 'pageCount', 'updatedAt',
  'licenseType', 'printingAllowed', 'refundPolicy'
]);
const GENERIC_FIELDS = Object.freeze(['slug', 'title', 'name', 'coverImage', 'price', 'status']);
const KINDS = ['programs', 'products', 'hosts', 'content'];
const CLOSED_FEATURES = ['storePurchase', 'checkout', 'secureDownload'];
const forbiddenPrivateMarkers = /originalPdfUrl|privateStoragePath|downloadToken|nal-products-private/i;

export function checkPublicCatalog(local, live) {
  const errors = [];
  const fail = (message) => errors.push(message);

  if (!local || !live || typeof local !== 'object' || typeof live !== 'object') {
    return ['catalog sources must be objects'];
  }
  for (const kind of KINDS) {
    const localRows = local[kind];
    const liveRows = live[kind];
    if (!Array.isArray(localRows) || !Array.isArray(liveRows)) {
      fail(`${kind}: invalid source or RPC payload`);
      continue;
    }
    const expected = localRows.filter(row => row?.published === true);
    const expectedIds = new Set(expected.map(row => row.id));
    const actualIds = new Set(liveRows.map(row => row?.id));

    if (expectedIds.size !== expected.length) fail(`${kind}: duplicate local public ids`);
    if (actualIds.size !== liveRows.length) fail(`${kind}: duplicate live public ids`);
    for (const row of expected) if (!actualIds.has(row.id)) fail(`${kind}/${row.id}: missing from public RPC`);
    for (const row of liveRows) {
      if (!expectedIds.has(row?.id)) {
        fail(`${kind}/${row?.id ?? '?'}: unpublished or unknown id exposed by public RPC`);
        continue;
      }
      if (row?.published !== true) fail(`${kind}/${row.id}: public RPC must mark published true`);
      const source = expected.find(item => item.id === row.id);
      const fields = kind === 'products' ? PRODUCT_FIELDS : GENERIC_FIELDS;
      for (const field of fields) {
        if (!same(source[field], row[field])) fail(`${kind}/${row.id}/${field}: live/source mismatch`);
      }
      if (kind === 'products' && productType(source.productType) !== productType(row.productType)) {
        fail(`${kind}/${row.id}/productType: unsupported legacy type or mismatch`);
      }
    }
  }

  if (Array.isArray(live.products)) {
    const ids = new Set(live.products.map(item => item.id));
    for (const id of ARCHIVED_STARTER_IDS) {
      if (ids.has(id)) fail(`archived starter ${id} must never be public`);
    }
    if (forbiddenPrivateMarkers.test(JSON.stringify(live.products))) {
      fail('public catalog contains a private delivery field or storage identifier');
    }
  }

  if (!local.site || !live.site) {
    fail('site settings missing');
  } else {
    for (const field of ['brand', 'legal', 'externalLinks', 'designTokens']) {
      if (!same(local.site[field], live.site[field])) fail(`site/${field}: live/source mismatch`);
    }
    for (const key of CLOSED_FEATURES) {
      if (local.site.features?.[key] !== false || live.site.features?.[key] !== false) {
        fail(`site/${key}: paid release gate must stay OFF`);
      }
    }
  }
  if (!same(local.launches, live.launches)) fail('launches: live/source mismatch');
  return errors;
}
