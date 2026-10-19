import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const app=new URL('../../activities/moonjar/',import.meta.url);
const read=path=>readFileSync(new URL(path,app),'utf8');
const manifest=JSON.parse(read('data/manifest.json'));
const project=JSON.parse(read('data/empty.json'));
const schema=JSON.parse(read('data/schema.json'));

test('A preview is opt-in query only, not a saved art style',()=>{
 const source=read('src/app.js');
 assert.match(source,/artStudy=craft-a/);
 assert.match(source,/if\(craftAStudyFlag\)viewtools\.append/);
 assert.match(source,/if\(craftAStudyFlag\)actions\.append/);
 assert.match(source,/const snapshot=clone\(editor\.doc\.scene\)/);
 assert.match(source,/craft-a-preview/);
 assert.ok(!JSON.stringify(project).includes('craft-a'));
 assert.ok(!JSON.stringify(schema).includes('craft-a'));
 assert.ok(!JSON.stringify(manifest).includes('craft-a'));
 assert.equal(project.scene.canvasVariant,'porcelain-v2');
});
test('no art study assets are shipped in product repo',()=>{
 assert.equal(existsSync(new URL('assets/moonjar-a-study',app)),false);
 assert.equal(manifest.pieces.length,96);
 assert.equal(manifest.backgroundVariants['porcelain-v2'].assets.day.sha256,
   'bba50e825f0109c499cf05cd94059da1681d2eda7d86a474296400eced779a1a');
});
test('A-only visual study uses the same renderer for read-only dialog and export',()=>{
 const source=read('src/craft-a-study.js');
 assert.match(source,/drawStudyScene\(canvas\.getContext\('2d'\)/);
 assert.match(source,/createCraftAArtwork\(scene,materials\)/);
 assert.match(source,/createCraftACard\(artworkPNG,copy/);
 assert.match(source,/ctx\.drawImage\(artwork,140,218,1320,1485\)/);
 assert.match(source,/pieces\.get\(n\.assetId\)/);
 assert.ok(!source.includes('editor.commit('));
 assert.ok(!source.includes('localStorage.'));
 assert.ok(!source.includes('fetch('));
 assert.ok(!source.includes('B형'));
});
test('design preview preserves legacy drawing and export code byte contracts',()=>{
 const render=read('src/rendering.js');
 const domain=read('src/domain.js');
 assert.match(render,/export async function exportPNG\(scene, materials, scale = 1\)/);
 assert.match(render,/export async function exportCardPNG\(scene, materials, copy = \{\}, scale = 1\)/);
 assert.match(domain,/export function backgroundKey\(scene\)/);
 assert.match(domain,/function drawScene/);
 assert.ok(!render.includes('craft-a'));
 assert.ok(!domain.includes('craft-a'));
});
test('A-only preview uses self-hosted materials and retains strict CSP',()=>{
 const index=read('index.html');
 assert.match(index,/craft-a-preview\.css/);
 assert.match(index,/connect-src 'self'/);
 assert.match(index,/script-src 'self'/);
 assert.match(index,/frame-src 'none'/);
 assert.match(read('src/app.js'),/createCraftAArtwork\(snapshot,materials\)/);
});
