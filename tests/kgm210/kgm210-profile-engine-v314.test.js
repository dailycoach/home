'use strict';
const assert=require('assert');
const engine=require('./kgm210-profile-engine-v314.js');

assert.strictEqual(Object.keys(engine.PAIR_NAMES).length,42,'42개 복합 유형명이 필요합니다.');

const all7=engine.buildProfile({scores:engine.ORDER.map(key=>({key,avg:7})),axes:{X:7,Y:7,Z:7}});
assert.strictEqual(all7.kind,'balanced');
assert.strictEqual(all7.displayName,'전영역 균형상승형');
assert.strictEqual(all7.profileCode,'BAL-HIGH');

const profile=engine.buildProfile({
  scores:[{key:'K',avg:6.7},{key:'I',avg:6.2},{key:'N',avg:4.8},{key:'G',avg:5.1},{key:'D',avg:3.2},{key:'O',avg:5.7},{key:'M',avg:4.4}],
  axes:{X:5.2,Y:5.1,Z:4.3}
});
assert.strictEqual(profile.displayName,'가치기반 선택형');
assert.strictEqual(profile.profileCode,'K-I/D');
assert.strictEqual(profile.focus.key,'D');

const tied=engine.buildProfile({
  scores:[{key:'K',avg:6},{key:'I',avg:6},{key:'N',avg:4.8},{key:'G',avg:4.7},{key:'D',avg:3.2},{key:'O',avg:5.2},{key:'M',avg:4.4}],
  evidence:{K:{applied:4.8,variance:.3},I:{applied:5.7,variance:.4}},axes:{X:4.8,Y:5.2,Z:4.1}
});
assert.strictEqual(tied.primary.key,'I','동점이면 적용하기 근거가 높은 영역을 대표 강점으로 둡니다.');
assert.strictEqual(tied.secondary.key,'K');
assert.strictEqual(tied.topTied,true);
assert.ok(![tied.primary.key,tied.secondary.key].includes(tied.focus.key),'성장초점은 대표·보조 강점을 제외합니다.');

console.log('KGM210 profile engine v3.14 tests passed');