import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {backgroundKey,Editor,newProject,clone,validateProject,drawScene,parseImport} from '../../activities/moonjar/src/domain.js';
import {Materials} from '../../activities/moonjar/src/rendering.js';

const root=new URL('../../activities/moonjar/',import.meta.url);
const data=name=>JSON.parse(readFileSync(new URL('data/'+name+'.json',root),'utf8'));
const manifest=data('manifest'),schema=data('schema'),empty=data('empty');
const validate=doc=>validateProject(doc,schema,manifest);
const materials=new Materials(manifest);

test('new projects start with original porcelain V2 without changing original piece pack',()=>{
 const doc=newProject(empty);
 assert.equal(doc.scene.canvasVariant,'porcelain-v2');
 assert.equal(backgroundKey(doc.scene),'porcelain-light');
 assert.equal(manifest.pieces.length,96);
 assert.equal(doc.assetPackVersion,'moonjar-png-v3');
 assert.deepEqual(validate(doc),[]);
 assert.match(materials.path(backgroundKey(doc.scene)),/porcelain-day.png$/);
 const night=clone(doc.scene);night.theme='dark';
 assert.equal(backgroundKey(night),'porcelain-dark');
 assert.match(materials.path(backgroundKey(night)),/porcelain-night.png$/);
});

test('legacy project with no optional canvasVariant still validates, loads and exports its original V3 paper',()=>{
 const original=newProject(empty);
 delete original.scene.canvasVariant;
 assert.deepEqual(validate(original),[]);
 assert.equal(backgroundKey(original.scene),'canvas-light');
 assert.match(materials.path(backgroundKey(original.scene)),/canvas_light.png$/);
 const dark=clone(original.scene);dark.theme='dark';
 assert.equal(backgroundKey(dark),'canvas-dark');
 assert.match(materials.path(backgroundKey(dark)),/canvas_dark.png$/);
 const imported=parseImport(JSON.stringify(original),schema,manifest);
 assert.deepEqual(imported.scene,original.scene);
 assert.equal('canvasVariant' in imported.scene,false);
});

test('same one undoable operation switches canvas and preserves every fragment and its metadata',()=>{
 const e=new Editor(newProject(empty),manifest);
 e.add('A01');e.text('piece','memory','내가 고른 기억');
 e.transform({x:125,y:205,rotation:45});
 const original=clone(e.doc.scene.nodes);
 const notes=clone(e.doc.pieceNotes);
 const rev=e.doc.revision,undone=e.past.length;
 e.setCanvas('legacy-outline-v3','dark');
 assert.equal(e.past.length,undone+1);
 assert.equal(e.doc.revision,rev+1);
 assert.deepEqual(e.doc.scene.nodes,original);
 assert.deepEqual(e.doc.pieceNotes,notes);
 assert.equal(backgroundKey(e.doc.scene),'canvas-dark');
 assert.deepEqual(validate(e.doc),[]);
 e.undo();
 assert.equal(backgroundKey(e.doc.scene),'porcelain-light');
 assert.deepEqual(e.doc.scene.nodes,original);
 e.redo();
 assert.equal(backgroundKey(e.doc.scene),'canvas-dark');
});

test('old snapshots retain the porcelain/legacy background of the moment they were saved',()=>{
 const e=new Editor(newProject(empty),manifest);
 e.add('B03');e.snapshot();
 e.setCanvas('legacy-outline-v3','dark');e.snapshot();
 e.setCanvas('porcelain-v2','dark');e.snapshot();
 assert.deepEqual(e.doc.snapshots.map(s=>backgroundKey(s.scene)),['porcelain-light','canvas-dark','porcelain-dark']);
 const before=clone(e.doc.snapshots);
 e.setCanvas('porcelain-v2','light');
 assert.deepEqual(e.doc.snapshots,before);
 assert.deepEqual(validate(e.doc),[]);
});

test('unsupported variants and theme identifiers fail before being persisted',()=>{
 const doc=newProject(empty);doc.scene.canvasVariant='unknown';
 assert.ok(validate(doc).length>0);
 assert.throws(()=>backgroundKey(doc.scene),/지원하지 않는/);
 const e=new Editor(newProject(empty),manifest);
 assert.throws(()=>e.setCanvas('unknown','light'),/지원하지 않는/);
 assert.deepEqual(validate(e.doc),[]);
});

test('both canvas variants use the same 1600x1800 PNG and SVG/PNG export keys',()=>{
 for(const theme of ['light','dark']){
   for(const variant of ['porcelain-v2','legacy-outline-v3']){
     const scene={...empty.scene,theme,canvasVariant:variant,nodes:[]};
     const key=backgroundKey(scene);
     let used=null;
     const ctx={clearRect(){},drawImage(image){used=image;}};
     drawScene(ctx,scene,new Map([[key,{asset:key}]]));
     assert.deepEqual(used,{asset:key});
     assert.match(materials.path(key),variant==='porcelain-v2'?/porcelain-(day|night).png$/:/canvas_(light|dark).png$/);
   }
 }
});

test('each exact new PNG, master SVG and thumbnail is registered with the true file hash and dimensions',()=>{
 const variants=manifest.backgroundVariants['porcelain-v2'].assets;
 for(const entry of [variants.day,variants.night]){
   const bytes=readFileSync(new URL(entry.src,root));
   assert.equal(bytes.length,entry.byteSize);
   assert.equal(bytes.readUInt32BE(16),1600);
   assert.equal(bytes.readUInt32BE(20),1800);
   assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
   const svg=readFileSync(new URL(entry.originalSvg,root));
   assert.equal(createHash('sha256').update(svg).digest('hex'),entry.svgSha256);
   const source=svg.toString('utf8');
   assert.match(source,/viewBox="0 0 1600 1800"/);
   assert.doesNotMatch(source,/<script|onload=|<foreignObject/i);
   assert.ok(readFileSync(new URL(entry.thumbnail,root)).length>4000);
 }
});
