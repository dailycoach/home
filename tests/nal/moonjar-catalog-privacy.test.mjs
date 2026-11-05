import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),'utf8');
const programs=JSON.parse(read('nal/data/programs.json')).programs;
const hosts=JSON.parse(read('nal/data/hosts.json')).hosts;
const routes=JSON.parse(read('nal/data/routes.json')).routes;
const publicFiles=['index.html','index-source-disc.html','pages.json','sitemap.xml',
  'nal/data/programs.json','nal/data/routes.json',
  'nal/class/moonjar-nacre-artcoaching/index.html',
  'nal/gather/moonjar-reflection-circle/index.html'];
const slugs=[['moonjar-nacre-artcoaching-class','class','moonjar-nacre-artcoaching'],
  ['moonjar-reflection-circle-gather','gather','moonjar-reflection-circle']];

test('two public NAL experiences exist but no signup or unknown date and price',()=>{
  const host=hosts.find(h=>h.id==='kim-cheol-woong');
  assert.ok(host&&host.published);
  for(const [id,type,slug] of slugs){
    const item=programs.find(p=>p.id===id);
    assert.ok(item,id);
    assert.equal(item.type,type);
    assert.equal(item.slug,slug);
    assert.equal(item.status,'comingSoon');
    assert.equal(item.published,true);
    assert.ok(host.programIds.includes(id),'host linked');
    for(const field of ['sourceUrl','onlineUrl','applicationUrl','groupChat','price','originalPrice','capacity','remainingSeats','startDate','endDate','startTime','endTime'])
      assert.equal(item[field],null,id+' '+field);
    const route='/nal/'+type+'/'+slug+'/';
    const meta=routes.find(r=>r.path===route);
    assert.ok(meta?.indexable,'NAL public page should be discoverable');
    const html=read(route.slice(1)+'index.html');
    assert.ok(html.includes('data-slug="'+slug+'"'));
    assert.ok(html.includes('meta property="og:title"'));
    assert.ok(read('sitemap.xml').includes('<loc>https://daily-coach-ing.com'+route+'</loc>'));
  }
});

test('public marketing and discovery pages never leak private Moonjar tool link',()=>{
  for(const file of publicFiles){
    const content=read(file);
    assert.ok(!content.includes('/activities/moonjar/'),file+' must not expose workshop path');
  }
  const registry=JSON.parse(read('pages.json'));
  assert.ok(registry.every(item=>!item.url.includes('moonjar')),'private tool must be absent from public search registry');
  const moonjar=read('activities/moonjar/index.html');
  assert.ok(moonjar.includes('<meta name="robots" content="noindex,nofollow,noarchive">'));
  assert.ok(existsSync(new URL('activities/moonjar/src/app.js',root)),
    'workshop tool itself is preserved for separate facilitator access');
});

test('NEL privacy test cannot substitute for authentication',()=>{
  assert.ok(programs.filter(p=>p.id.startsWith('moonjar-')&&p.published).length===2);
  // Static GitHub Pages files remain URL-accessible; true access control must
  // be implemented separately. We only verify public link suppression here.
});
