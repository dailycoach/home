import test from 'node:test';
import assert from 'node:assert/strict';
import {SaveQueue,ConflictError,openRepository} from '../../activities/moonjar/src/persistence.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function fake(){const map=new Map();return {map,async save(doc,expected){await pause(5);if((map.get(doc.projectId)?.revision??null)!==expected)throw new ConflictError();map.set(doc.projectId,structuredClone(doc));return doc.revision;}};}

test('serial queue preserves latest revision during delayed writes and reports success after commit',async()=>{
  const repository=fake(),events=[],q=new SaveQueue(repository,null,s=>events.push([s,repository.map.get('test')?.revision]),10000);
  q.schedule({projectId:'test',revision:1,value:'first'});const running=q.flush();await pause(1);q.schedule({projectId:'test',revision:2,value:'newest'});await running;await q.flush();assert.equal(repository.map.get('test').value,'newest');assert.equal(q.expected,2);assert.deepEqual(events.filter(e=>e[0]==='saved'),[['saved',2]]);await q.stop();
});
test('queued snapshots are deep copies, not mutable editor references',async()=>{const r=fake(),q=new SaveQueue(r,null,()=>{},10000),d={projectId:'p',revision:1,text:'가'};q.schedule(d);d.text='나';await q.flush();assert.equal(r.map.get('p').text,'가');await q.stop();});
test('failure keeps source document and never announces saved; explicit retry recovers',async()=>{
  const source={projectId:'p',revision:2,text:'개인 글'},states=[];let fail=true;const r={async save(d){if(fail)throw new Error('quota');return d.revision;}};
  const q=new SaveQueue(r,null,s=>states.push(s),10000);q.schedule(source);await q.flush();assert.equal(source.text,'개인 글');assert.equal(states.at(-1),'error');assert.ok(!states.includes('saved'));fail=false;await q.retry(source);assert.equal(states.at(-1),'saved');await q.stop();
});
test('revision check refuses a second writer and keeps first writer data intact',async()=>{
  const r=fake(),states=[],a=new SaveQueue(r,null,()=>{},10000),b=new SaveQueue(r,null,s=>states.push(s),10000);
  a.schedule({projectId:'p',revision:1,text:'first'});await a.flush();b.schedule({projectId:'p',revision:1,text:'second'});await b.flush();assert.equal(states.at(-1),'conflict');assert.equal(r.map.get('p').text,'first');await a.stop();await b.stop();
});
test('unavailable IndexedDB rejects instead of pretending to save',async()=>{await assert.rejects(openRepository(null));});
test('stop flushes last pending edit, then refuses later writes',async()=>{const r=fake(),q=new SaveQueue(r,null,()=>{},10000);q.schedule({projectId:'p',revision:1});await q.stop();q.schedule({projectId:'p',revision:2});await q.flush();assert.equal(r.map.get('p').revision,1);});
