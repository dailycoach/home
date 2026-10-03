import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${literal(JSON.stringify(value))}::jsonb`;

export async function buildSeed(root = process.cwd()) {
  const sql = ['begin;'];
  for (const kind of ['hosts', 'programs', 'products', 'content']) {
    const source = JSON.parse(await readFile(path.join(root, `nal/data/${kind}.json`), 'utf8'));
    if (!Array.isArray(source[kind])) throw new Error(`Missing ${kind} array`);
    const seen = new Set();
    for (const item of source[kind]) {
      if (!/^[a-z0-9-]+$/.test(item.id) || !/^[a-z0-9-]+$/.test(item.slug)
        || typeof item.published !== 'boolean' || seen.has(item.id)) {
        throw new Error(`Invalid or duplicate catalog identity: ${kind}/${item.id}`);
      }
      // Online meeting URLs are attendance information, not public catalog data.
      if (item.onlineUrl) throw new Error(`Move private meeting URL out of catalog: ${item.id}`);
      seen.add(item.id);
      const { id, slug, published, onlineUrl, ...body } = item;
      sql.push(`insert into public.nal_catalog (kind, id, slug, published, body) values (${literal(kind)}, ${literal(id)}, ${literal(slug)}, ${published}, ${json(body)}) on conflict (kind, id) do nothing;`);
    }
  }
  for (const name of ['site', 'launches']) {
    const body = JSON.parse(await readFile(path.join(root, `nal/data/${name}.json`), 'utf8'));
    sql.push(`insert into public.nal_settings (id, body, published) values (${literal(name)}, ${json(body)}, true) on conflict (id) do nothing;`);
  }
  sql.push('commit;');
  return sql.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.stdout.write(await buildSeed());
}
