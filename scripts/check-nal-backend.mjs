import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../nal/assets/js/backend.js';

const config = JSON.parse(await readFile('nal/data/backend.json', 'utf8'));
const { load, validateConfig } = globalThis.NALBackend;
assert.equal(validateConfig({enabled:false}), null);
assert.throws(() => validateConfig({...config, publishableKey:'sb_secret_test'}));
assert.throws(() => validateConfig({...config, url:'https://untrusted.example'}));
assert.equal(await load({enabled:false}), null);
await assert.rejects(() => load(config, async () => ({ok:false,status:503})), /HTTP 503/);
await assert.rejects(() => load(config, async () => ({ok:true,json:async()=>({site:{}})})), /Incomplete/);

const payload = await load(config);
const counts = {};
for (const kind of ['programs', 'products', 'hosts', 'content']) {
  const source = JSON.parse(await readFile(`nal/data/${kind}.json`, 'utf8'))[kind].filter(item=>item.published);
  assert.deepEqual(payload[kind].map(item=>item.id).sort(), source.map(item=>item.id).sort());
  assert.ok(payload[kind].every(item=>item.published===true));
  for (const item of payload[kind]) {
    const expected = source.find(entry=>entry.id===item.id);
    for (const field of ['slug', 'title', 'name', 'coverImage', 'price', 'status']) {
      assert.equal(item[field], expected[field], `${kind}/${item.id}/${field}`);
    }
  }
  counts[kind] = payload[kind].length;
}
assert.deepEqual(payload.site, JSON.parse(await readFile('nal/data/site.json', 'utf8')));
assert.deepEqual(payload.launches, JSON.parse(await readFile('nal/data/launches.json', 'utf8')));
console.log('NAL live public API verified:', counts);
