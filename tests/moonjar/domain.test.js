import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Editor,clone,newProject,importAsNew,parseImport,validateProject} from '../../activities/moonjar/src/domain.js';
const read=name=>JSON.parse(readFileSync(new URL(`../../activities/moonjar/data/${name}.json`,import.meta.url)));
const manifest=read('manifest'),schema=read('schema'),empty=read('empty'),story=read('story');
const make=()=>new Editor(newProject(empty),manifest);
const validate=d=>validateProject(d,schema,manifest);

test('all supplied valid and invalid fixtures are checked against schema and domain rules',()=>{
  for(const name of readdirSync(new URL('fixtures/',import.meta.url))){
    const d=JSON.parse(readFileSync(new URL(`fixtures/${name}`,import.meta.url)));
    assert.equal(validate(d).length===0,name.startsWith('valid_'),name);
  }
});
test('fresh projects have new IDs and current times; optional fields stay empty',()=>{
  const a=newProject(empty),b=newProject(empty,'free');assert.notEqual(a.projectId,b.projectId);assert.notEqual(a.projectId,empty.projectId);assert.equal(a.title,'');assert.equal(b.currentScene,'arrange');assert.deepEqual(validate(a),[]);
});
test('all 96 original assets add with correct proportions and unique instance IDs',()=>{
  const e=make();for(const a of manifest.pieces)e.add(a.id);assert.equal(e.doc.scene.nodes.length,96);assert.deepEqual(validate(e.doc),[]);assert.equal(new Set(e.doc.scene.nodes.map(n=>n.instanceId)).size,96);
});
test('a dozen fragments can be added at once to fill the jar without repeated note prompts',()=>{
  const e=make();
  const first=manifest.pieces.slice(0,12).map(p=>p.id);
  e.addBatch(first);
  assert.equal(e.doc.scene.nodes.length,12);
  assert.equal(e.past.length,1,'one batch is a single undoable action');
  assert.equal(e.doc.scene.nodes.map(n=>n.assetId).join(','),first.join(','));
  assert.equal(new Set(e.doc.scene.nodes.map(n=>`${n.x},${n.y}`)).size,12,
    'new fragments should not stack as an invisible pile in the same spot');
  assert.ok(e.doc.scene.nodes.every(n=>n.x>=0&&n.x<=1600&&n.y>=0&&n.y<=1800));
  assert.ok(Object.values(e.doc.pieceNotes).every(v=>v.label===''&&v.memory===''));
  e.undo();assert.equal(e.doc.scene.nodes.length,0);
  e.redo();assert.equal(e.doc.scene.nodes.length,12);
  assert.deepEqual(validate(e.doc),[]);
});

test('repeated batch filling spreads 96 nacre pieces while preserving every original',()=>{
  const e=make();
  const ids=manifest.pieces.map(p=>p.id);
  for(let i=0;i<8;i++)e.addBatch(ids.slice(i*12,(i+1)*12));
  assert.equal(e.doc.scene.nodes.length,96);
  const different=new Set(e.doc.scene.nodes.map(n=>`${n.x},${n.y}`));
  assert.ok(different.size>=40,'batch filling should distribute rather than hide all fragments under one');
  assert.deepEqual(validate(e.doc),[]);
  const before=clone(e.doc);
  assert.throws(()=>e.addBatch(Array(105).fill('A01')),'200 cap still protects projects over 200');
  assert.deepEqual(e.doc,before,'failed batch must not lose or partially add pieces');
  e.addBatch(ids.slice(0,12));
  assert.equal(e.doc.scene.nodes.length,108);
});

test('200-piece limit and invalid-asset batch remain atomic',()=>{
  const e=make();
  const group=Array(12).fill('A01');
  for(let i=0;i<16;i++)e.addBatch(group);
  assert.equal(e.doc.scene.nodes.length,192);
  const before=clone(e.doc);
  assert.throws(()=>e.addBatch(group));
  assert.deepEqual(e.doc,before);
  e.addBatch(group.slice(0,8));
  assert.equal(e.doc.scene.nodes.length,200);
  assert.deepEqual(validate(e.doc),[]);
  const frozen=clone(e.doc);
  assert.throws(()=>e.addBatch(['A01']));
  assert.deepEqual(e.doc,frozen);
  const second=make(),fresh=clone(second.doc);
  assert.throws(()=>second.addBatch(['A01','INVALID']));
  assert.deepEqual(second.doc,fresh);
});

test('same asset can be used three times with independent notes',()=>{
  const e=make();for(let i=0;i<3;i++)e.add('A01');e.text('piece','memory','세 번째의 기억');assert.equal(e.doc.scene.nodes.length,3);assert.equal(Object.values(e.doc.pieceNotes).filter(n=>n.memory).length,1);
});
test('move, rotate, scale preserve center and ratio',()=>{
  const e=make();e.add('F06');const n=e.node,ratio=n.width/n.height;e.transform({x:83,y:1450,rotation:195});e.transform({factor:1.5});assert.equal(n.rotation,-165);assert.equal(n.x,83);assert.equal(n.y,1450);assert.ok(Math.abs(n.width/n.height-ratio)<1e-12);assert.deepEqual(validate(e.doc),[]);
});
test('free placement outside vessel remains while paper bounds are enforced',()=>{
  const e=make();e.add('A03');e.transform({x:50,y:50});assert.equal(e.node.x,50);assert.equal(e.node.y,50);e.transform({x:-500,y:20000});assert.equal(e.node.x,0);assert.equal(e.node.y,1800);
});
test('scale clamps both dimensions to schema bounds, including thin pieces',()=>{
  const e=make();for(const a of manifest.pieces){e.add(a.id);e.transform({factor:0.00001});e.transform({factor:100000});}assert.deepEqual(validate(e.doc),[]);
});
test('duplicate geometry and memory are deep copies with a fresh instance ID',()=>{
  const e=make();e.add('C02');e.text('piece','memory','원본');const id=e.selected;e.duplicate();assert.notEqual(e.selected,id);e.text('piece','memory','복제');assert.equal(e.doc.pieceNotes[id].memory,'원본');assert.equal(e.doc.pieceNotes[e.selected].memory,'복제');
});
test('array order is the single source for layers',()=>{
  const e=make();e.add('B01');const first=e.selected;e.add('B02');e.reorder(-1);assert.equal(e.doc.scene.nodes[0].assetId,'B02');e.selected=first;e.reorder(-1);assert.equal(e.doc.scene.nodes[0].assetId,'B01');
});
test('locked nodes resist geometry, delete and reordering; unlock is available',()=>{
  const e=make();e.add('A01');e.toggleLock();const n=clone(e.node);e.transform({x:0,factor:2,rotation:60});e.remove();e.reorder(-1);assert.deepEqual(e.node,n);e.toggleLock();e.transform({x:5});assert.equal(e.node.x,5);
});
test('one finished move creates one undo entry; redo restores geometry and note',()=>{
  const e=make();e.add('G03');e.text('piece','memory','기억');const n=clone(e.node),count=e.past.length;e.transform({x:20,y:80});assert.equal(e.past.length,count+1);e.undo();assert.deepEqual(e.node,n);e.redo();assert.equal(e.node.x,20);e.remove();e.undo();assert.equal(e.node?.x,undefined);assert.equal(e.doc.scene.nodes.length,1);assert.equal(Object.values(e.doc.pieceNotes)[0].memory,'기억');
});
test('undo new branch clears redo history',()=>{const e=make();e.add('A01');e.transform({x:2});e.undo();e.add('B02');assert.equal(e.future.length,0);});
test('clear and undo restore artwork and notes while latest reflection survives',()=>{
  const e=make();e.add('A01');e.text('piece','memory','개인 메모');e.clear();e.text('arrival','currentWord','나중에 쓴 말');e.undo();assert.equal(e.doc.scene.nodes.length,1);assert.equal(Object.values(e.doc.pieceNotes)[0].memory,'개인 메모');assert.equal(e.doc.reflections.arrival.currentWord,'나중에 쓴 말');
});
test('undo history is bounded to 100 operations',()=>{const e=make();e.add('C01');for(let i=0;i<150;i++)e.transform({x:i});assert.equal(e.past.length,100);});
test('explicit snapshots are immutable; fourth snapshot needs explicit replacement',()=>{
  const e=make();e.add('H01');e.snapshot();const s=clone(e.doc.snapshots[0]);e.transform({x:0});e.theme('dark');assert.deepEqual(e.doc.snapshots[0],s);e.snapshot();e.snapshot();assert.throws(()=>e.snapshot());e.snapshot(1);assert.equal(e.doc.snapshots.length,3);assert.deepEqual(validate(e.doc),[]);
});
test('view-only theme clone does not change document; explicit theme is undoable',()=>{
  const e=make(),preview=clone(e.doc.scene);preview.theme='dark';assert.equal(e.doc.scene.theme,'light');e.theme('dark');e.undo();assert.equal(e.doc.scene.theme,'light');
});
test('JSON round trip preserves artwork, notes, reflections, snapshot but opens new project',()=>{
  const e=make();e.add('E10');e.transform({rotation:75,factor:2,x:50});e.text('piece','memory','그때의 말');e.text('return','action','잠시 멈추기');e.snapshot();const restored=importAsNew(parseImport(JSON.stringify(e.doc),schema,manifest));assert.notEqual(restored.projectId,e.doc.projectId);for(const key of ['scene','pieceNotes','reflections','snapshots'])assert.deepEqual(restored[key],e.doc[key]);
});
test('malformed and oversized JSON fail without mutating source',()=>{const e=make(),before=clone(e.doc);assert.throws(()=>parseImport('{no',schema,manifest));assert.throws(()=>parseImport(' '.repeat(5*1024*1024+1),schema,manifest));assert.deepEqual(e.doc,before);});
test('prototype keys and unknown executable fields are rejected',()=>{
  const d=newProject(empty);for(const key of ['__proto__','constructor','prototype','imageUrl','script','svgPath']){const bad=JSON.parse(JSON.stringify(d));Object.defineProperty(bad,key,{value:'https://invalid.example',enumerable:true});assert.ok(validate(bad).length,key);}
});
test('orphaned notes, NaN, Infinity, duplicate snapshot IDs and wrong ratio fail',()=>{
  const e=make();e.add('A01');let d=clone(e.doc);d.pieceNotes.orphan_node={label:'',memory:''};assert.ok(validate(d).length);for(const value of [NaN,Infinity,-1,1601]){d=clone(e.doc);d.scene.nodes[0].x=value;assert.ok(validate(d).length);}d=clone(e.doc);d.scene.nodes[0].height*=2;assert.ok(validate(d).length);e.snapshot();e.snapshot();d=clone(e.doc);d.snapshots[1].id=d.snapshots[0].id;assert.ok(validate(d).length);
});
test('200 nodes are allowed and node 201 is refused without data loss',()=>{const e=make();for(let i=0;i<200;i++)e.add('A01');assert.deepEqual(validate(e.doc),[]);assert.throws(()=>e.add('A01'));assert.equal(e.doc.scene.nodes.length,200);});
test('text limits are validated without truncating the original text',()=>{const e=make();const text='가'.repeat(2001);e.text('arrival','currentWord',text);assert.ok(validate(e.doc).length);assert.equal(e.doc.reflections.arrival.currentWord,text);});
test('all scenes are optional, modes retain document identity, DAILY and final question match',()=>{
  assert.deepEqual(story.daily.map(d=>d.en),['DETECT','ACKNOWLEDGE','INQUIRE','LINK','YOUR ACTION']);assert.equal(story.scenes.at(-1).focusQuestion,'오늘 알아차린 것을 삶에 적용해본다면?');assert.deepEqual(story.scenes.map(s=>s.name),['도착','그릇','자개','만남','전환','이름','돌아감']);
  const e=make();e.add('A01');const id=e.doc.projectId;for(const s of story.scenes){assert.ok(s.fields.every(f=>!f.required));e.navigate(s.id,'guided');e.navigate(s.id,'free');}e.navigate('ending');assert.equal(e.doc.projectId,id);assert.equal(e.doc.title,'');assert.equal(e.doc.scene.nodes.length,1);assert.deepEqual(validate(e.doc),[]);
});
