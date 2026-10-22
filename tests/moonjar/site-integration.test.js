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
 await done;assert.equal((output.match(/href="\/activities\/moonjar\/" data-route="moonjar"/g)||[]).length,0,'private workshop link must not appear in public tools');
 assert.match(output,/moonjar: '\/activities\/moonjar\/',/);
 for(const path of ['career-deduction-game','coaching-flex-move','value-scene','wilderness-survival','live-board'])assert.ok(output.includes(`/activities/${path}/`),path);
});
test('private workshop route is no longer exposed by the public registry or sitemap',()=>{
 const listed=JSON.parse(read('pages.json')).filter(p=>p.url==='/activities/moonjar/');assert.equal(listed.length,0,'app must be absent from public pages registry');
 assert.doesNotMatch(read('sitemap.xml'),/<loc>https:\/\/daily-coach-ing.com\/activities\/moonjar\/<\/loc>/);
 assert.match(page,/<meta name="robots" content="noindex,nofollow,noarchive">/);
 for(const file of ['styles.css','src/app.js','src/domain.js','src/persistence.js','src/rendering.js','data/story.json','data/manifest.json','data/schema.json','data/empty.json','assets/moonjar-original.svg'])assert.ok(existsSync(new URL(`activities/moonjar/${file}`,root)),file);
});
test('public app contains an original vector hero, not the removed museum photograph',()=>{
 const m=JSON.parse(read('activities/moonjar/data/manifest.json'));
 assert.equal(m.heroArtwork.src,'assets/moonjar-original.svg');
 assert.equal(m.heroArtwork.creator,'DAILYCOACHING');
 assert.ok(!('openingImage' in m));
 assert.equal(m.pieces.length,96);
 assert.equal(m.canvases.length,2);
 assert.ok(!('projectImageUseApproval' in m));
 const art=read('activities/moonjar/assets/moonjar-original.svg');
 assert.match(art,/<svg xmlns=/);
 assert.match(art,/viewBox="0 0 780 920"/);
 assert.doesNotMatch(art,/<script|onload=|<foreignObject/i);
 assert.ok(!existsSync(new URL('activities/moonjar/assets/opening.webp',root)),'removed museum photo must not remain');
 const app=read('activities/moonjar/src/app.js');
 assert.match(app,/manifest.heroArtwork/);
 assert.doesNotMatch(app,/openingImage|photo.sourceUrl|museum.go.kr|opening.webp/);
 assert.doesNotMatch(JSON.stringify(m),/opening.webp|museum.go.kr/);
 assert.match(page,/connect-src 'self'/);
 assert.ok(!/supabase|analytics|gtag|stripe|firebase|openai/i.test(page));
});

test('post-evaluation design stylesheet loads after main CSS and ownership wording is correct',()=>{
  const page=read('activities/moonjar/index.html');
  const order=['styles.css?v=20261022-photo-journal','refinement.css?v=20261021-v3.2','viewport.css?v=20261021-v3.2','nacre-visibility.css?v=20261021-v3.2'];
  assert.ok(order.every((asset,i)=>page.indexOf(asset)>=0 && (i===0||page.indexOf(order[i-1])<page.indexOf(asset))));
  assert.ok(!page.includes('decorating-flow.css'),'legacy collision layer is no longer loaded');
  assert.ok(!page.includes('brand-seal'),'wordmark does not include a replacement emblem');
  const css=read('activities/moonjar/styles.css');
  assert.match(css,/result-overview/);
  assert.match(css,/max-width:\s*767px/);
  const app=read('activities/moonjar/src/app.js');
  assert.match(app,/자개 도안 8종과 파생 조각 96개는 운영자가 직접 디자인한 자료/);
  assert.match(app,/class:'reflection-recap'/);
  assert.match(app,/class:'result-essay'/);
  assert.doesNotMatch(app,/자개 PNG의 공개 이용 권한은 별도로 확인/);
});

test('photo story requires explicit field selection and adds mobile-native sharing with fallback',()=>{
  const app=read('activities/moonjar/src/app.js');
  const writer=read('activities/moonjar/src/photo-journal.js');
  assert.match(page,/src\/app\.js\?v=20261022-photo-journal/);
  assert.match(app,/photoJournalOptions/);
  assert.match(app,/photo-journal-field/);
  assert.match(app,/navigator\.canShare/);
  assert.match(app,/download:fileName\(index\)/);
  assert.match(writer,/exportPhotoJournalPNGs/);
  assert.match(writer,/drawScene/);
  assert.doesNotMatch(writer,/fetch\s*\(|sendBeacon|XMLHttpRequest|WebSocket/);
});
