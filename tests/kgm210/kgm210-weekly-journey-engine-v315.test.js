'use strict';
const assert=require('assert');
const engine=require('./kgm210-weekly-journey-engine-v315.js');

assert.strictEqual(engine.STAGES.length,7);
assert.deepStrictEqual(engine.STAGES.map(s=>s.key),['K','I','N','G','D','O','M']);

let journey=engine.createJourney({growthTheme:'책임경계 조율',successCriterion:'내 몫을 구분해 말한다',profileCode:'K-I/D',profileName:'가치기반 선택형'});
assert.strictEqual(journey.currentWeek,1);
assert.strictEqual(journey.status,'active');
assert.strictEqual(engine.progress(journey).completed,0);

journey=engine.savePre(journey,1,{scene:'팀 회의',attempt:'조금 해봄',learning:'기준을 말하지 않고 대신 처리했다',agenda:'내 몫을 구분하고 싶다'});
assert.strictEqual(journey.weeks[0].pre.scene,'팀 회의');

journey=engine.savePost(journey,1,{insight:'기준을 말하는 것도 책임이다',phrase:'내가 다 하지 않아도 된다',action:'다음 회의에서 기준을 먼저 말한다',returnPhrase:'놓는 것이 아니라 나누는 것이다',nextCheck:'팀원이 자기 몫을 말했는지'});
let completed=engine.completeWeek(journey,1,'2026-07-14T00:00:00.000Z');
assert.strictEqual(completed.ok,true);
journey=completed.journey;
assert.strictEqual(journey.currentWeek,2);
assert.strictEqual(engine.progress(journey).completed,1);

const invalid=engine.completeWeek(engine.createJourney({growthTheme:'x',successCriterion:'y'}),1);
assert.strictEqual(invalid.ok,false);
assert.ok(invalid.reason.length>0);

for(let week=2;week<=7;week++){
  journey=engine.savePost(journey,week,{insight:`${week}주차 배움`,phrase:`${week}주차 문장`,action:week<7?`${week}주차 행동`:'',returnPhrase:'다시 돌아오기',nextCheck:'다음 성장지점'});
  completed=engine.completeWeek(journey,week,`2026-08-${String(week).padStart(2,'0')}T00:00:00.000Z`);
  assert.strictEqual(completed.ok,true);
  journey=completed.journey;
}
assert.strictEqual(journey.status,'completed');
assert.strictEqual(engine.progress(journey).completed,7);
assert.strictEqual(engine.completionSummary(journey).finalPhrase,'7주차 문장');

const legacy={logs:[{done:'시도함'},{done:'',learn:''},{feel:'알게 됨'}]};
assert.strictEqual(engine.legacyDailyCount(legacy),2);

let gapJourney=engine.createJourney({startedAt:'2026-01-01T00:00:00.000Z'});
gapJourney.updatedAt='2026-01-01T00:00:00.000Z';
const returned=engine.noteReturn(gapJourney,'2026-01-15T00:00:00.000Z');
assert.strictEqual(returned.returned,true);
assert.strictEqual(returned.journey.returnCount,1);

console.log('KGM210 seven-week journey engine v3.15 tests passed');