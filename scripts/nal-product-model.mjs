import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import '../nal/assets/js/store.js';

// Use an explicit Ajv installation; no network access, installation or secrets here.
export async function productValidator() {
  if (!process.env.NAL_AJV_MODULE) throw new Error('Set NAL_AJV_MODULE to the installed ajv/dist/ajv.js path (Ajv 8).');
  const { default: Ajv } = await import(pathToFileURL(path.resolve(process.env.NAL_AJV_MODULE)).href);
  const schema = JSON.parse(await readFile('nal/data/product.schema.json', 'utf8'));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  return (product) => {
    const errors = validate(product) ? [] : validate.errors.map(e => `${e.instancePath || '/'} ${e.message}`);
    const urls = ['coverImage','purchaseUrl','sourceUrl','sampleUrl','previewUrl'].map(key=>[key,product[key]]);
    (product.gallery || []).forEach((url,i)=>urls.push([`gallery/${i}`,url]));
    (product.licenseOptions || []).forEach((option,i)=>urls.push([`licenseOptions/${i}/purchaseUrl`,option.purchaseUrl]));
    for (const [key,value] of urls) if (value != null && !globalThis.NALStore.safePublicUrl(value)) errors.push(`${key}: only safe public HTTPS or root-relative URLs are allowed`);
    if (product.gallery?.length !== product.galleryAlts?.length) errors.push('gallery and galleryAlts must have the same length');
    if ((product.galleryAlts || []).some(alt=>!alt.trim())) errors.push('Every gallery image needs alt text');
    if (['item'].includes(product.slug)) errors.push('Reserved slug');
    return errors;
  };
}
