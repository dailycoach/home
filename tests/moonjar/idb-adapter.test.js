import test from 'node:test';
import assert from 'node:assert/strict';
import {openRepository, ConflictError} from '../../activities/moonjar/src/persistence.js';

// Controllable IndexedDB event boundary, not a browser or a full IndexedDB emulator.
// Requests and transaction completion are advanced independently to exercise the adapter.
function boundary() {
  const transactions = [], created = [], calls = [], request = {};
  let closes = 0;
  const db = {
    createObjectStore(name){created.push(name);},
    close(){closes++;},
    transaction(names, mode){
      const stores = new Map(), tx = {names, mode, aborted:false, error:null,
        abort(){tx.aborted=true;queueMicrotask(()=>tx.onabort?.());},
        objectStore(name){
          if(!stores.has(name)) stores.set(name,{
            requests:[],
            get(key){const req={key};this.requests.push(req);return req;},
            getAll(){const req={};this.requests.push(req);return req;},
            put(value,key){calls.push({op:'put',store:name,key,value:structuredClone(value)});},
            delete(key){calls.push({op:'delete',store:name,key});}
          });
          return stores.get(name);
        }
      };transactions.push(tx);return tx;
    }
  };
  request.result = db;
  const api = {open(name,version){assert.equal(name,'dailycoaching-moonjar-v1');assert.equal(version,1);return request;}};
  return {api,request,db,transactions,created,calls,get closes(){return closes;}};
}
async function connected(){const b=boundary(),ready=openRepository(b.api);b.request.onupgradeneeded();b.request.onsuccess();return {b,repository:await ready};}
const tick=()=>new Promise(resolve=>queueMicrotask(resolve));

test('repository creates separate app stores and closes on version change',async()=>{
  const {b,repository}=await connected();assert.deepEqual(b.created,['projects','thumbnails','meta']);b.db.onversionchange();assert.equal(b.closes,1);repository.close();assert.equal(b.closes,2);
});
test('blocked open rejects, and a later successful connection is closed rather than leaked',async()=>{
  const b=boundary(),ready=openRepository(b.api);b.request.onblocked();await assert.rejects(ready,/막고/);b.request.onsuccess();assert.equal(b.closes,1);assert.equal(b.transactions.length,0);
});
test('save snapshots the argument at call time and resolves only after transaction completes',async()=>{
  const {b,repository}=await connected(),doc={projectId:'project_a',revision:7,text:'원래 글'};
  let complete=false;const saving=repository.save(doc,null).then(value=>{complete=true;return value;});
  const tx=b.transactions.at(-1),get=tx.objectStore('projects').requests[0];
  doc.revision=8;doc.text='나중 글';get.result=undefined;get.onsuccess();await tick();
  assert.equal(complete,false);assert.equal(b.calls[0].value.text,'원래 글');assert.equal(b.calls[0].value.revision,7);
  tx.oncomplete();assert.equal(await saving,7);
});
test('revision mismatch aborts the actual adapter transaction before put',async()=>{
  const {b,repository}=await connected(),saving=repository.save({projectId:'p',revision:6},3);
  const tx=b.transactions.at(-1),get=tx.objectStore('projects').requests[0];get.result={revision:4};get.onsuccess();
  await assert.rejects(saving,ConflictError);assert.equal(tx.aborted,true);assert.equal(b.calls.length,0);
});
test('quota error after a put rejects rather than announcing committed revision',async()=>{
  const {b,repository}=await connected(),saving=repository.save({projectId:'p',revision:1},null);
  const tx=b.transactions.at(-1),get=tx.objectStore('projects').requests[0];get.result=undefined;get.onsuccess();
  tx.error=new DOMException('Quota exceeded','QuotaExceededError');tx.onabort();await assert.rejects(saving,{name:'QuotaExceededError'});
});
test('read and list also wait for completed transactions',async()=>{
  const {b,repository}=await connected();let resolved=false;
  const reading=repository.get('p').then(value=>{resolved=true;return value;});let tx=b.transactions.at(-1),req=tx.objectStore('projects').requests[0];req.result={revision:1};await tick();assert.equal(resolved,false);tx.oncomplete();assert.deepEqual(await reading,{revision:1});
  const listing=repository.list();tx=b.transactions.at(-1);req=tx.objectStore('projects').requests[0];req.result=[];tx.oncomplete();assert.deepEqual(await listing,[]);
});
test('delete uses one guarded transaction to remove only the chosen project and its auxiliary keys',async()=>{
  const {b,repository}=await connected(),deleting=repository.delete('project_a',7);
  const tx=b.transactions.at(-1),get=tx.objectStore('projects').requests[0];assert.deepEqual(tx.names,['projects','thumbnails','meta']);get.result={revision:7};get.onsuccess();
  assert.deepEqual(b.calls,[{op:'delete',store:'projects',key:'project_a'},{op:'delete',store:'thumbnails',key:'project_a'},{op:'delete',store:'meta',key:'project_a'}]);tx.oncomplete();await deleting;
});
test('delete conflict aborts before deleting any store record',async()=>{
  const {b,repository}=await connected(),deleting=repository.delete('p',2),tx=b.transactions.at(-1),get=tx.objectStore('projects').requests[0];get.result={revision:3};get.onsuccess();await assert.rejects(deleting,ConflictError);assert.deepEqual(b.calls,[]);
});
