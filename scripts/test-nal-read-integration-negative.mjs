import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const run = () => spawnSync(process.execPath, ['scripts/check-nal-read-integration-snapshot.mjs'], {
  encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024
});
const clean = run();
assert.equal(clean.status, 0, `READ snapshot baseline must pass:\n${clean.stdout}\n${clean.stderr}`);

const cases = [
  {
    title: 'deny privacy admin UI opening before owner Auth',
    path: 'nal/data/read-privacy-review.release.json',
    mutate(data) {
      const o = JSON.parse(data); o.uiEnabled = true; return JSON.stringify(o);
    },
    expected: 'READ owner privacy interlock altered: uiEnabled'
  },
  {
    title: 'deny season publication before approval',
    path: 'nal/data/read-seasons.json',
    mutate(data) {
      const o = JSON.parse(data); o.seasons[0].published = true; return JSON.stringify(o);
    },
    expected: 'READ staging season must remain unpublished draft'
  },
  {
    title: 'deny staging backend accidental enable',
    path: 'nal/data/read-backend.staging.json',
    mutate(data) {
      const o = JSON.parse(data); o.enabled = true; return JSON.stringify(o);
    },
    expected: 'staging backend configuration must remain disconnected'
  },
  {
    title: 'deny loss of local favorites legacy hash',
    path: 'nal/my/index.html',
    mutate(data) {
      assert(data.includes("location.hash === '#wishlist'"));
      return data.replace("location.hash === '#wishlist'", "location.hash === '#favorites'");
    },
    expected: 'MY NAL legacy hash redirect lost'
  },
  {
    title: 'deny published READ routes before launch',
    path: 'nal/read/index.html',
    mutate(data) {
      assert(data.includes('noindex,nofollow'));
      return data.replace('noindex,nofollow', 'index,follow');
    },
    expected: 'READ staging route must not be indexed'
  },
  {
    title: 'deny stale or altered READ Auth assets',
    path: 'nal/assets/js/account-session.js',
    mutate(data) { return data + '\n// unreviewed change\n'; },
    expected: 'READ source: bytes changed nal/assets/js/account-session.js'
  },
  {
    title: 'deny rewriting canonical source products',
    path: 'nal/data/products.json',
    mutate(data) {
      const o = JSON.parse(data);
      const item = o.products.find(x => x.id === 'nal-small-book-01-mind-reset');
      assert(item); item.price = 100; return JSON.stringify(o);
    },
    expected: 'protected base: bytes changed nal/data/products.json'
  }
];

for (const test of cases) {
  const before = await readFile(test.path, 'utf8');
  try {
    const changed = test.mutate(before);
    assert.notEqual(changed, before, test.title);
    await writeFile(test.path, changed, 'utf8');
    const result = run();
    const output = `${result.stdout}\n${result.stderr}`;
    assert.notEqual(result.status, 0, `Unexpected PASS for ${test.title}\n${output}`);
    assert(output.includes(test.expected), `Wrong failure detector for ${test.title}\n${output}`);
  } finally {
    await writeFile(test.path, before, 'utf8');
  }
}
const restored = run();
assert.equal(restored.status, 0, `READ snapshot not restored:\n${restored.stdout}\n${restored.stderr}`);
console.log(`NAL READ integration negative guards PASS: ${cases.length} failures detected and clean snapshot restored`);
