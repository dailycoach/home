import assert from 'node:assert/strict';
import { mkdtemp,mkdir,copyFile,writeFile,readFile,access,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile),root=process.cwd(),temporary=await mkdtemp(path.join(tmpdir(),'nal-product-workflow-'));
const run=(script,args=[])=>exec(process.execPath,[path.join(root,'scripts',script),...args],{cwd:temporary,env:process.env});
const input={title:'Synthetic QA ebook',slug:'qa-minimum-ebook',author:'QA',coverImage:'/qa-cover.webp',summary:'Synthetic QA',description:'Synthetic QA',price:100,fileFormat:'PDF',pageCount:2,fileSizeMB:1,tableOfContents:['QA chapter'],sampleUrl:'/qa-sample.pdf',purchaseUrl:'https://example.com/qa',deliveryMethod:'digital-download',licenseType:'personal-use',printingAllowed:false,refundPolicy:'QA policy'};
let checks=0;
try {
  await mkdir(path.join(temporary,'nal/data'),{recursive:true});
  await mkdir(path.join(temporary,'nal/assets/js'),{recursive:true});
  for (const name of ['products','pdf-ebook-product-template','product.schema','programs','hosts','content']) await copyFile(`nal/data/${name}.json`,path.join(temporary,`nal/data/${name}.json`));
  const file=path.join(temporary,'product.json');await writeFile(file,JSON.stringify(input));
  const payload=JSON.parse((await run('nal-product.mjs',['publish-ready',file])).stdout);
  assert.equal(payload.id,input.slug);checks++;assert.equal(payload.body.coverImageAlt,`${input.title} 표지`);checks++;assert.equal(payload.body.stockStatus,'available');checks++;
  await writeFile(file,JSON.stringify(payload.body));await run('nal-product.mjs',['import',file]);await run('generate-nal-pages.mjs');
  const page=path.join(temporary,`nal/shop/${input.slug}/index.html`);
  await access(page);checks++;
  const html=await readFile(page,'utf8');assert(html.includes('"@type":"Product"')&&html.includes('"price":100'));checks++;
  const routes=JSON.parse(await readFile(path.join(temporary,'nal/assets/js/product-routes.js'),'utf8').then(s=>s.match(/Object.freeze\((.*)\)/)[1]));assert(routes.includes(input.slug));checks++;
  await writeFile(file,JSON.stringify({...payload.body,published:false}));await run('nal-product.mjs',['import',file]);await run('generate-nal-pages.mjs');
  await assert.rejects(()=>access(page));checks++;
  await writeFile(file,JSON.stringify({...payload.body,originalPdfUrl:'https://example.com/original.pdf'}));await assert.rejects(()=>run('nal-product.mjs',['import',file]));checks++;
  await writeFile(file,JSON.stringify({...payload.body,id:'different-id'}));await assert.rejects(()=>run('nal-product.mjs',['import',file]));checks++;
  console.log(`NAL product workflow: ${checks} minimum-input/import/SEO-route/unpublish/privacy checks passed in temporary fixtures.`);
} finally {await rm(temporary,{recursive:true,force:true});}
