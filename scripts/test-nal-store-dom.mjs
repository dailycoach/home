// DOM unit checks, not browser screenshots, viewport layout or zoom verification.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
if (!process.env.NAL_DOM_MODULE) throw new Error('Set NAL_DOM_MODULE to happy-dom/lib/index.js.');
const { Window }=await import(pathToFileURL(path.resolve(process.env.NAL_DOM_MODULE)).href);
const data={};
for (const key of ['site','programs','products','hosts','content','launches']) {
  const value=JSON.parse(await readFile(`nal/data/${key}.json`,'utf8'));data[key]=value[key] || value;
}
const {product:template}=JSON.parse(await readFile('nal/data/pdf-ebook-product-template.json','utf8'));
const pdf={...template,id:'qa-pdf',slug:'qa-pdf',title:'매우 긴 제목으로 감정 언어를 찾는 합성 QA 전자책',summary:'QA 자료',description:'QA 자료',author:'QA 저자',published:true,coverImage:'/qa-cover.webp',coverImageAlt:'QA 전자책 표지',pageCount:86,fileSizeMB:14.2,price:9900,stockStatus:'available',purchaseUrl:'https://example.com/qa',sampleUrl:'/qa-sample.pdf',tableOfContents:['감정 언어 찾기'],licenseType:'personal-use',printingAllowed:true,deliveryMethod:'digital-download',refundPolicy:'QA 기준',policyStatus:'reviewed',audiences:['코치'],topics:['감정']};
const windows=[];
async function page(route,params='',overrides={}) {
  const w=new Window({url:`https://daily-coach-ing.com${route}${params}`,settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}}); windows.push(w);
  const html=(await readFile(`.${route}index.html`,'utf8')).replace(/<script\b[\s\S]*?<\/script>/g,m=>m.includes('application/ld+json')?m:'');
  w.document.write(html);
  w.localStorage.setItem('nal:theme:v1','dark');
  const payload={...data,products:[...data.products,{...pdf,...overrides}]};
  w.fetch=async()=>({ok:true,json:async()=>({enabled:true})});
  w.NALBackend={load:async()=>payload};
  for (const name of ['theme.js','product-routes.js','store.js','app.js']) w.eval(await readFile(`nal/assets/js/${name}`,'utf8'));
  await w.happyDOM.whenAsyncComplete();
  assert(!w.document.querySelector('.nal-error'), `Runtime error on ${route}`);
  return w;
}
let checks=0;
try {
  let w=await page('/nal/shop/');let d=w.document;
  assert.equal(d.querySelector('.nal-card').dataset.catalogId,'qa-pdf');checks++;
  assert.equal(d.querySelectorAll('.nal-card').length,5);checks++;
  assert(d.querySelector('.nal-card--digital a').getAttribute('href').includes('/nal/shop/item/?slug=qa-pdf'));checks++;
  assert.equal(d.documentElement.dataset.theme,'dark');checks++;
  for (const name of ['q','format','topic','audience','sort']) assert(d.querySelector(`[name="${name}"]`).closest('label'),name);checks++;
  assert(d.querySelector('.nal-card--digital').textContent.includes('86쪽'));checks++;
  const filter=d.querySelector('[name="format"]');filter.value='physical';filter.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(d.querySelectorAll('.nal-card--digital').length,0);checks++;
  w=await page('/nal/shop/item/','?slug=qa-pdf');d=w.document;
  assert(d.querySelector('h1').textContent.includes(pdf.title));checks++;
  assert.equal(d.querySelectorAll('main').length,1);checks++;
  assert(d.querySelector('#product-use').textContent.includes('감정 언어'));checks++;
  assert.equal(d.querySelector('#product-preview a').textContent,'PDF 미리보기 열기');checks++;
  assert(d.querySelector('.nal-commerce-buy').href==='https://example.com/qa');checks++;
  assert(d.querySelector('.nal-commerce-facts').textContent.includes('개인 이용'));checks++;
  assert(d.querySelector('title').textContent.includes(pdf.title));checks++;
  assert(JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent).offers.price===9900);checks++;
  d.querySelector('[data-wish-key]').click();assert(w.localStorage.getItem('nal:wishlist:v1').includes('qa-pdf'));checks++;
  w=await page('/nal/shop/item/','?slug=qa-pdf',{price:null,pageCount:null,fileSizeMB:null,author:null,sampleUrl:null,previewUrl:null,stockStatus:'comingSoon'});d=w.document;
  assert(!d.querySelector('#product-preview'));checks++;
  assert(!d.querySelector('.nal-commerce-author'));checks++;
  assert(d.querySelector('.nal-commerce-price').textContent.includes('판매가 준비 중'));checks++;
  assert(!d.querySelector('.nal-commerce-facts').textContent.includes('86쪽'));checks++;
  assert(!JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent).offers);checks++;
  w=await page('/nal/shop/item/','?slug=qa-pdf',{stockStatus:'soldOut'});d=w.document;
  assert(d.querySelector('.nal-commerce-buy').disabled);checks++;
  assert(d.querySelector('.nal-commerce-note').textContent.includes('구매할 수 없습니다'));checks++;
  w=await page('/nal/shop/item/','?slug=qa-pdf',{published:false});assert(!w.document.querySelector('.nal-commerce-product'));checks++;
  w=await page('/nal/search/','?q=감정 언어');assert(w.document.querySelector('.nal-card--digital'));checks++;
  w=await page('/nal/my/');assert.equal(w.document.querySelector('[data-purchased-materials]').dataset.state,'not-connected');checks++;
  console.log(`NAL store DOM: ${checks} catalog/detail/search/theme/local-wishlist/unknown-data checks passed. Real viewport/zoom QA still required.`);
} finally {for (const w of windows) await w.happyDOM.close();}
