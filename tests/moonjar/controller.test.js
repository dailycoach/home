// Controller logic regression checks in Node, with inert element stubs.
// These do not launch a browser or verify layout, input delivery, or device behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Editor,clone,newProject} from '../../activities/moonjar/src/domain.js';
const read=n=>JSON.parse(readFileSync(new URL(`../../activities/moonjar/data/${n}.json`,import.meta.url)));
const manifest=read('manifest'),empty=read('empty'),story=read('story');
function harness(){
 const created=[],listeners={};
 function stub(){const n={dataset:{},children:[],classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){if(k==='data-action')this.dataset.action=v;},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},addEventListener(){},showModal(){},close(){},querySelector(){return null;}};created.push(n);return n;}
 const nodes=Object.fromEntries(['#main','#modal','#modal-body','#modal-title','#modal-close','#import-file','#notice'].map(k=>[k,stub()]));
 const document={querySelector:s=>nodes[s]||null,querySelectorAll:()=>[],createElement:stub,createElementNS:stub,addEventListener:(event,fn)=>{listeners[event]=fn;}};
 const context=vm.createContext({document,window:{addEventListener(){}},navigator:{},location:{hash:''},setTimeout(){},clearTimeout(){},clone,renderSVG(){},console,matchMedia:()=>({matches:false})});
 const source=readFileSync(new URL('../../activities/moonjar/src/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/init\(\)\.catch\([\s\S]*$/,'');
 vm.runInContext(source+`\nglobalThis.controller={actions,compare,addPiece,set(d,flags={},m={}){editor=d;paused=!!flags.paused;readOnly=!!flags.readOnly;manifest=m.manifest||globalThis.manifest;story=m.story;materials=m.materials;},flags(p,r){paused=p;readOnly=r;}};`,context);
 const e=new Editor(newProject(empty),manifest);e.add('A01');e.transform({x:42});e.undo();
 const c=context.controller;c.set(e,{}, {manifest,story,materials:{load:async()=>{}}});
 return {c,e,created,listeners};
}
test('actual artwork controller refuses undo, redo, duplicate, delete, layer, lock, clear and snapshots while paused or read-only',async()=>{
 for(const flags of [{paused:true},{readOnly:true}]){
  const {c,e}=harness();c.flags(!!flags.paused,!!flags.readOnly);const before=clone(e.doc),past=e.past.length,future=e.future.length;
  for(const action of ['undo','redo','duplicate','delete','lock','forward','backward','center','clear','snapshot'])await c.actions[action]();
  await c.addPiece('B01');assert.deepEqual(e.doc,before);assert.equal(e.past.length,past);assert.equal(e.future.length,future);
 }
});
test('actual delegated move, rotate and resize commands cannot edit a paused composition',async()=>{
 const {c,e,listeners}=harness();c.flags(true,false);const before=clone(e.doc);
 for(const action of ['move:100:100','rotate:90','size:2']){const b={dataset:{action},disabled:false};listeners.click({target:{closest:()=>b},preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));}
 assert.deepEqual(e.doc,before);
});
test('comparison applies no theme while paused, including its explicit apply callbacks',()=>{
 const {c,e,created}=harness();c.flags(true,false);const before=clone(e.doc);c.compare();
 const buttons=created.filter(n=>n.dataset.action?.startsWith('apply-canvas:'));assert.equal(buttons.length,4);
 for(const b of buttons){assert.equal(b.disabled,true);b.onclick();}assert.deepEqual(e.doc,before);
});
test('a piece that finishes loading after entering pause is not added',async()=>{
 const {c,e}=harness();let resolve;const loading=new Promise(done=>{resolve=done;});
 c.set(e,{}, {manifest,story,materials:{load:()=>loading}});const before=clone(e.doc),pending=c.addPiece('B01');c.flags(true,false);resolve();await pending;assert.deepEqual(e.doc,before);
});
test('leaving pause restores ordinary undo and redo',()=>{
 const {c,e}=harness();c.flags(true,false);const before=clone(e.doc);c.actions.redo();assert.deepEqual(e.doc,before);c.flags(false,false);c.actions.redo();assert.equal(e.node.x,42);c.actions.undo();assert.deepEqual(e.doc.scene,before.scene);
});
