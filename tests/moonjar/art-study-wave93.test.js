import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const json=path=>JSON.parse(read(path));
const manifest=json('activities/moonjar/data/manifest.json');

test('W9.3 art studies are original editable 1600x1800 SVGs, not image embeds',()=>{
  for(const theme of ['day','night']){
    const svg=read('design/moonjar-wave93/porcelain-'+theme+'.svg');
    assert.match(svg,/<svg[^>]+width="1600"[^>]+height="1800"[^>]+viewBox="0 0 1600 1800"/);
    assert.match(svg,/id="bodyClip"/);
    assert.match(svg,/rotate\(-\.45 797 302\)/);
    assert.match(svg,/hand-thrown joined lip/);
    assert.doesNotMatch(svg,/<image\b|<foreignObject\b|https?:\/\/|data:image|base64,/i);
    assert.match(svg,/<desc>/);
  }
});

test('original 96 transparent nacre PNGs and V2 source material checksums remain identical',()=>{
  assert.equal(manifest.pieceCount,96);
  assert.equal(manifest.pieces.length,96);
  for(const item of manifest.pieces){
    const png=readFileSync(new URL('../../activities/moonjar/'+item.src,import.meta.url));
    assert.equal(createHash('sha256').update(png).digest('hex'),item.sha256,item.id);
  }
  for(const theme of ['day','night']){
    const item=manifest.backgroundVariants['porcelain-v2'].assets[theme];
    const png=readFileSync(new URL('../../activities/moonjar/'+item.src,import.meta.url));
    assert.equal(createHash('sha256').update(png).digest('hex'),item.sha256,theme);
  }
});

test('W9.3 remains a study: no published app code points to the new art',()=>{
  const paths=[
    'activities/moonjar/index.html',
    'activities/moonjar/src/app.js',
    'activities/moonjar/src/domain.js',
    'activities/moonjar/src/rendering.js',
    'activities/moonjar/data/manifest.json',
    'activities/moonjar/data/empty.json'
  ];
  for(const path of paths){
    assert.doesNotMatch(read(path),/moonjar-wave93|porcelain-v3\.1|porcelain-v31/);
  }
  assert.equal(json('activities/moonjar/data/empty.json').scene.canvasVariant,'porcelain-v2');
});

test('renderer has independent deterministic glaze generation and no third-party photo input',()=>{
  const src=read('scripts/render-moonjar-wave93.py');
  assert.match(src,/20261019/);
  assert.match(src,/20261020/);
  assert.match(src,/study-manifest\.json/);
  assert.match(src,/porcelain-\{kind\}\.svg/);
  assert.doesNotMatch(src,/museum\.go\.kr|\.jpg['"]|\.jpeg['"]/i);
});
