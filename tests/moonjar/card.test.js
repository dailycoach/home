import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeCardCopy} from '../../activities/moonjar/src/rendering.js';

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
