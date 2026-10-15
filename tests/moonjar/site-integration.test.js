import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const homepage=read('index.html'),template=read('index-source-disc.html');
const page=read('activities/moonjar/index.html');
test('actual homepage loader preserves both moonjar tool links and resolves their route',async()=>{
 const script=[...homepage.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];
 let output='',settle;const done=new Promise(resolve=>{settle=resolve;});
 vm.runInNewContext(script,{fetch:async()=>({ok:true,text:async()=>template}),document:{open(){},write(html){output=html;},close(){settle();},body:{set innerHTML(_){throw new Error('Homepage loader failed');}}}});
 await done;assert.equal((output.match(/href="\/activities\/moonjar\/" data-route="moonjar"/g)||[]).length,2);
 assert.match(output,/moonjar: '\/activities\/moonjar\/',/);
 for(const path of ['career-deduction-game','coaching-flex-move','value-scene','wilderness-survival','live-board'])assert.ok(output.includes(`/activities/${path}/`),path);
});
test('tool registry, sitemap and canonical point to the existing domain route',()=>{
 const listed=JSON.parse(read('pages.json')).filter(p=>p.url==='/activities/moonjar/');assert.equal(listed.length,1);assert.equal(listed[0].category,'activities');
 assert.match(read('sitemap.xml'),/<loc>https:\/\/daily-coach-ing.com\/activities\/moonjar\/<\/loc>/);
 assert.match(page,/<link rel="canonical" href="https:\/\/daily-coach-ing.com\/activities\/moonjar\/">/);
 for(const file of ['styles.css','src/app.js','src/domain.js','src/persistence.js','src/rendering.js','data/story.json','data/manifest.json','data/schema.json','data/empty.json','assets/opening.webp'])assert.ok(existsSync(new URL(`activities/moonjar/${file}`,root)),file);
});
test('public app retains source attribution and omits private approval correspondence',()=>{
 const m=JSON.parse(read('activities/moonjar/data/manifest.json'));assert.equal(m.openingImage.credit,'사진 출처: 국립중앙박물관');assert.equal(m.openingImage.sourceUrl,'https://www.museum.go.kr/');assert.equal(m.pieces.length,96);assert.equal(m.canvases.length,2);assert.ok(!('projectImageUseApproval' in m));
 const app=read('activities/moonjar/src/app.js');assert.match(app,/photo.credit/);assert.match(app,/photo.sourceUrl/);
 assert.match(page,/connect-src 'self'/);assert.ok(!/supabase|analytics|gtag|stripe|firebase|openai/i.test(page));
});
