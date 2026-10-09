import { readFile } from 'node:fs/promises';
import { checkPublicCatalog } from './nal-catalog-contract.mjs';
import '../nal/assets/js/backend.js';

const loadJson = async (name) => JSON.parse(await readFile(`nal/data/${name}.json`, 'utf8'));
const [programs, products, hosts, content, site, launches, config] = await Promise.all([
  loadJson('programs'), loadJson('products'), loadJson('hosts'), loadJson('content'),
  loadJson('site'), loadJson('launches'), loadJson('backend')
]);

// Public publishable key only: no service-role credentials, data writes, or browser login.
const payload = await globalThis.NALBackend.load(config);
const expected = { programs: programs.programs, products: products.products, hosts: hosts.hosts, content: content.content, site, launches };
const errors = checkPublicCatalog(expected, payload);
if (errors.length) {
  console.error(`NAL public catalog drift (${errors.length})`);
  for (const failure of errors) console.error('- ' + failure);
  process.exit(1);
}
console.log(
  'NAL catalog parity PASS:',
  ['programs','products','hosts','content'].map(kind => `${kind}=${payload[kind].length}`).join(' '),
  'archived starters hidden, no paid release, no private storage details'
);
