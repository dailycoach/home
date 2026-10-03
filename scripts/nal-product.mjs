import { readFile, writeFile } from 'node:fs/promises';
import { productValidator } from './nal-product-model.mjs';

const [command, file] = process.argv.slice(2);
if (!['validate','import','catalog-payload','publish-ready'].includes(command) || !file) throw new Error('Usage: node scripts/nal-product.mjs validate|import|catalog-payload|publish-ready product.json');
const validate = await productValidator();
const input = JSON.parse(await readFile(file, 'utf8'));
const { product: defaults } = JSON.parse(await readFile('nal/data/pdf-ebook-product-template.json', 'utf8'));
const source = input.product || input;
const product = { ...defaults, ...source };
if (!product.id && product.slug) product.id = product.slug;
if (!product.coverImageAlt && product.title && product.coverImage) product.coverImageAlt = `${product.title} 표지`;
// Operator explicitly chooses this command only after confirming real sale,
// delivery and policy terms. It does not create prices, files or orders.
if (command === 'publish-ready') Object.assign(product, { published:true,stockStatus:'available',policyStatus:'reviewed' });
const errors = validate(product);
if (errors.length) throw new Error(errors.join('\n'));
if (command === 'validate') console.log('Product valid. No catalog changes.');
if (['catalog-payload','publish-ready'].includes(command)) {
  if (!product.id || !product.slug) throw new Error('Catalog records need id and slug, including drafts.');
  console.log(JSON.stringify({ kind:'products',id:product.id,slug:product.slug,published:product.published,body:product },null,2));
}
if (command === 'import') {
  if (!product.id || !product.slug) throw new Error('Imported records need id and slug, including drafts.');
  const catalog = JSON.parse(await readFile('nal/data/products.json', 'utf8'));
  if (catalog.products.some(p=>p.slug===product.slug && p.id!==product.id)) throw new Error('Slug already belongs to another product.');
  const index = catalog.products.findIndex(p=>p.id===product.id);
  if (index < 0) catalog.products.push(product); else catalog.products[index] = product;
  await writeFile('nal/data/products.json', JSON.stringify(catalog,null,2)+'\n');
  console.log('Catalog updated. Generate pages and sitemap for static SEO; no manual detail page needed. When backend is enabled, import the validated catalog payload into nal_catalog through the authorized operator workflow.');
}
