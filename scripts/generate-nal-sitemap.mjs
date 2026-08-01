import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const base = 'https://daily-coach-ing.com';
const urls = new Set(['/']);

const registry = JSON.parse(await readFile(path.join(root, 'pages.json'), 'utf8'));
for (const item of registry) {
  if (typeof item.url === 'string' && item.url.startsWith('/')) urls.add(item.url);
}

async function walk(directory) {
  for (const entry of await readdir(directory)) {
    const full = path.join(directory, entry);
    const info = await stat(full);
    if (info.isDirectory()) {
      await walk(full);
      continue;
    }
    if (entry !== 'index.html') continue;
    const html = await readFile(full, 'utf8');
    if (/name="robots" content="noindex/i.test(html)) continue;
    const route = `/${path.relative(root, path.dirname(full)).split(path.sep).join('/')}/`;
    urls.add(route);
  }
}

await walk(path.join(root, 'nal'));

const date = new Date().toISOString().slice(0, 10);
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...[...urls].sort().map((route) => `  <url><loc>${base}${route}</loc><lastmod>${date}</lastmod></url>`),
  '</urlset>',
  ''
].join('\n');

await writeFile(path.join(root, 'sitemap.xml'), xml, 'utf8');
await writeFile(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`, 'utf8');
console.log(`Generated sitemap with ${urls.size} URLs.`);
