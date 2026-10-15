import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeCardCopy,planCardText} from '../../activities/moonjar/src/rendering.js';

test('postcard copy starts without any journal field included',()=>{
  assert.deepEqual(normalizeCardCopy(),{title:'',sentence:''});
  assert.deepEqual(normalizeCardCopy({}),{title:'',sentence:''});
});

test('only explicitly supplied postcard text passes normalization',()=>{
  const userText={title:'  고른 제목  ',sentence:'  지금의 한 문장\n'};
  assert.deepEqual(normalizeCardCopy(userText),{title:'고른 제목',sentence:'지금의 한 문장'});
  assert.ok(!Object.keys(normalizeCardCopy(userText)).includes('reflections'));
});

test('postcard copy rejects overlong values rather than silently shortening personal words',()=>{
  assert.throws(()=>normalizeCardCopy({title:'가'.repeat(51)}),/너무 길어요/);
  assert.throws(()=>normalizeCardCopy({sentence:'나'.repeat(101)}),/너무 길어요/);
});

test('untrusted scene notes are not a renderer argument or automatic caption',()=>{
  const src=readFileSync(new URL('../../activities/moonjar/src/rendering.js',import.meta.url),'utf8');
  const func=src.split('export async function exportCardPNG(')[1].split('export function download(')[0];
  assert.doesNotMatch(func,/pieceNotes|reflections|memory|localStorage|indexedDB/);
  assert.match(func,/normalizeCardCopy\(copy\)/);
});

function fontMetrics() {
  return {
    font:'500 90px serif',
    measureText(value){
      const px=Number(this.font.match(/([0-9]+)px/)?.[1]||90);
      return {width:[...value].length*px};
    }
  };
}
test('card layout preserves every chosen character without ellipsis',()=>{
  const ctx=fontMetrics();
  const original='봄을 기다리며 나를 다시 바라봅니다';
  const plan=planCardText(ctx,original,{maxWidth:600,maxLines:2,preferred:98,minimum:70,step:2});
  assert.equal(plan.lines.join(''),original);
  assert.ok(plan.size>=70 && plan.size<=98);
  assert.ok(plan.lines.every(line=>!line.includes('…')));
});
test('overfull card copy is explicitly rejected instead of being cropped',()=>{
  const ctx=fontMetrics();
  assert.throws(()=>planCardText(ctx,'가'.repeat(100),{
    maxWidth:1300,maxLines:3,preferred:66,minimum:48,step:2
  }),/짧게 다듬어/);
});
test('newlines are preserved in card layout when space allows',()=>{
  const ctx=fontMetrics();
  const planned=planCardText(ctx,'겨울\n봄',{maxWidth:1000,maxLines:2,preferred:80,minimum:60});
  assert.deepEqual(planned.lines,['겨울','봄']);
});
