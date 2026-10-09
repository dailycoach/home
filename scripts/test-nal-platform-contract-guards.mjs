import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const run = () => spawnSync(process.execPath, ['scripts/check-nal-platform.mjs'], {
  encoding: 'utf8',
  timeout: 30_000,
  maxBuffer: 1024 * 1024
});

const baseline = run();
assert.equal(baseline.status, 0, `Baseline platform contract must pass:\n${baseline.stdout}\n${baseline.stderr}`);

const tests = [
  {
    name: 'reject charging for a canonical free PDF',
    path: 'nal/data/products.json',
    mutate(source) {
      const data = JSON.parse(source);
      const item = data.products.find((p) => p.id === 'nal-small-book-01-mind-reset');
      assert(item);
      item.price = 100;
      return JSON.stringify(data);
    },
    message: 'free starter nal-small-book-01-mind-reset must remain a free'
  },
  {
    name: 'reject selling AWARENESS before the sale gate',
    path: 'nal/data/products.json',
    mutate(source) {
      const data = JSON.parse(source);
      const item = data.products.find((p) => p.id === 'dailycoaching-awareness-100');
      assert(item);
      item.stockStatus = 'available';
      return JSON.stringify(data);
    },
    message: 'AWARENESS dailycoaching-awareness-100 must keep the agreed price'
  },
  {
    name: 'reject activating the checkout feature without release approval',
    path: 'nal/data/site.json',
    mutate(source) {
      const data = JSON.parse(source);
      data.features.checkout = true;
      return JSON.stringify(data);
    },
    message: 'NAL paid release gate checkout must remain OFF'
  },
  {
    name: 'reject public indexing of a legacy redirect',
    path: 'nal/shop/nal-starter-01-mind-reset/index.html',
    mutate(source) {
      assert(source.includes('noindex,follow'));
      return source.replace('noindex,follow', 'index,follow');
    },
    message: 'nal/shop/nal-starter-01-mind-reset/index.html redirect must be noindex'
  },
  {
    name: 'reject noindex redirect URL in sitemap',
    path: 'sitemap.xml',
    mutate(source) {
      assert(source.includes('</urlset>'));
      return source.replace('</urlset>', '<url><loc>https://daily-coach-ing.com/nal/shop/nal-starter-01-mind-reset/</loc></url>\n</urlset>');
    },
    message: 'noindex https://daily-coach-ing.com/nal/shop/nal-starter-01-mind-reset/ must not be in sitemap'
  },
  {
    name: 'reject unsafe script in a catalog SVG',
    path: 'nal/assets/images/catalog/shop/retail/nal-small-book-01-cover.svg',
    mutate(source) {
      assert(source.includes('</svg>'));
      return source.replace('</svg>', '<script>alert(1)</script></svg>');
    },
    message: 'unsafe catalog SVG'
  }
];

for (const test of tests) {
  const original = await readFile(test.path, 'utf8');
  try {
    const changed = test.mutate(original);
    assert.notEqual(changed, original, `No mutation applied: ${test.name}`);
    await writeFile(test.path, changed);
    const result = run();
    const output = `${result.stdout}\n${result.stderr}`;
    assert.notEqual(result.status, 0, `Expected contract FAIL: ${test.name}\n${output}`);
    assert(output.includes(test.message), `Wrong failure reason: ${test.name}\n${output}`);
  } finally {
    await writeFile(test.path, original);
  }
}

const final = run();
assert.equal(final.status, 0, `Restoration failed:\n${final.stdout}\n${final.stderr}`);
console.log(`NAL guard negative tests: ${tests.length} fail-closed scenarios PASS; baseline restored PASS`);
