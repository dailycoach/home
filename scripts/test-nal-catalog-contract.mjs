import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkPublicCatalog, ARCHIVED_STARTER_IDS } from './nal-catalog-contract.mjs';

const readJson = async name => JSON.parse(await readFile(`nal/data/${name}.json`, 'utf8'));
const [programs, products, hosts, content, site, launches] = await Promise.all([
  readJson('programs'), readJson('products'), readJson('hosts'), readJson('content'),
  readJson('site'), readJson('launches')
]);
const base = { programs: programs.programs, products: products.products, hosts: hosts.hosts, content: content.content, site, launches };
const copy = value => JSON.parse(JSON.stringify(value));
const setup = () => {
  const local = copy(base);
  const live = { site: copy(local.site), launches: copy(local.launches) };
  for (const kind of ['programs','products','hosts','content']) {
    live[kind] = copy(local[kind].filter(item => item.published));
  }
  // This is the known, supported legacy DB type; no schema mutation required.
  for (const product of live.products) if (product.productType === 'physicalCard') product.productType = 'card';
  return { local, live };
};

assert.deepEqual(checkPublicCatalog(...Object.values(setup())), [], 'canonical source should pass with legacy card aliases');
const cases = [
  ['free starter price drift', (local, live) => {
    live.products.find(item => item.id === 'nal-small-book-01-mind-reset').price = 100;
  }, 'products/nal-small-book-01-mind-reset/price'],
  ['free starter preview drift', (local, live) => {
    live.products.find(item => item.id === 'nal-small-book-02-relationship').previewUrl = '/old.pdf';
  }, 'products/nal-small-book-02-relationship/previewUrl'],
  ['AWARENESS checkout activation', (local, live) => {
    live.products.find(item => item.id === 'dailycoaching-awareness-100').stockStatus = 'available';
  }, 'products/dailycoaching-awareness-100/stockStatus'],
  ['unexpected legacy product exposure', (local, live) => {
    const old = { ...live.products[0], id: ARCHIVED_STARTER_IDS[0], published: true };
    live.products.push(old);
  }, 'unpublished or unknown id exposed'],
  ['missing public product', (local, live) => {
    live.products = live.products.filter(item => item.id !== 'nal-small-book-03-next-step');
  }, 'products/nal-small-book-03-next-step: missing'],
  ['unapproved type alias', (local, live) => {
    live.products.find(item => item.id === 'emotion-card').productType = 'unmapped-type';
  }, 'products/emotion-card/productType'],
  ['private download field leakage', (local, live) => {
    live.products[0].originalPdfUrl = 'https://example.invalid/hidden.pdf';
  }, 'private delivery field'],
  ['paid global feature accidentally enabled', (local, live) => {
    live.site.features.checkout = true;
  }, 'site/checkout'],
  ['published programs changed', (local, live) => {
    live.programs[0].title = 'DRIFT';
  }, 'programs/'],
  ['site operator metadata changed', (local, live) => {
    live.site.legal = { ...live.site.legal, operatorName: 'DRIFT' };
  }, 'site/legal']
];

for (const [name, mutate, expected] of cases) {
  const { local, live } = setup();
  mutate(local, live);
  const errors = checkPublicCatalog(local, live);
  assert(errors.some(e => e.includes(expected)), `Missing expected detector for ${name}: ${errors.join('; ')}`);
}
console.log(`NAL catalog parity guard tests PASS: ${cases.length} negative cases and normalized card compatibility`);
