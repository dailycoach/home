import test from 'node:test';
import assert from 'node:assert/strict';
import {collectPhotoEntries,wrapPhotoLines,paginatePhotoEntries} from '../../activities/moonjar/src/photo-journal.js';

const ctx={font:'',measureText(text){return {width:[...text].length*33};}};
test('only populated content is available; selection is never implicit',()=>{
  const doc={title:'나의 작은 항아리',
    scene:{nodes:[{instanceId:'n1',assetId:'A01'}]},
    reflections:{arrival:{currentWord:'오늘의 마음',bodySignal:''},return:{noticed:'발견한 빛',action:' '}},
    pieceNotes:{n1:{label:'파란 조각',memory:'오래 남은 빛'}}};
  const story={scenes:[
    {id:'arrival',name:'도착',fields:[{id:'currentWord',label:'오늘의 말'},{id:'bodySignal',label:'몸'}]},
    {id:'return',name:'돌아보기',fields:[{id:'noticed',label:'알아차린 것'},{id:'action',label:'실천'}]}
  ]};
  const entries=collectPhotoEntries(doc,story);
  assert.deepEqual(entries.map(e=>e.id),['title','arrival.currentWord','return.noticed','piece.n1']);
  assert.equal(entries[1].text,'오늘의 마음');
  assert.equal(doc.title,'나의 작은 항아리');
});
test('a photo without opted-in journal text contains one artwork page',()=>{
  assert.deepEqual(paginatePhotoEntries(ctx,[]),[{cover:true,items:[]}]);
});
test('Korean, emoji and whitespace remain readable without dropped characters',()=>{
  const sample='가나다라마바사 🌙✨ 사진첩에 남겨요\n'+'오늘의 선택 '.repeat(65);
  const wrapped=wrapPhotoLines(ctx,sample,58,500);
  assert.equal(wrapped.join(''),sample.replaceAll('\n',''));
  assert.ok(wrapped.every(x=>ctx.measureText(x).width<=500));
});
test('long reflections paginate completely, preserving exact text without ellipsis',()=>{
  const text='나의 알아차림 🌙 '+('한 번 더 바라보고 적어 둔 마음 '.repeat(112));
  const pages=paginatePhotoEntries(ctx,[{label:'내가 남긴 기록',text,kind:'reflection'}]);
  assert.ok(pages.length>1);
  assert.ok(pages.every(p=>p.items.every(i=>i.y<=2165)));
  assert.equal(pages.flatMap(p=>p.items.filter(i=>i.kind==='line').map(i=>i.text)).join(''),text);
  assert.ok(pages.slice(1).every(p=>p.items.some(i=>i.kind==='heading'&&i.text.includes('이어지는 글'))));
});
test('overly long input is refused, never silently cropped',()=>{
  assert.throws(()=>paginatePhotoEntries(ctx,[{label:'기록',text:'빛'.repeat(60000),kind:'reflection'}]),/24장/);
});
