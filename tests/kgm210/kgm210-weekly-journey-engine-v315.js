(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.KGMWeeklyJourneyV315=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const VERSION='KGM210 weekly journey engine v3.15.0';
  const STORAGE_KEY='kgm210:seven-week-journey:v1';
  const LEGACY_KEY='kgm210_growth_plan';
  const MAX_WEEKS=7;
  const RETURN_GAP_DAYS=10;

  const STAGES=[
    {week:1,key:'K',title:'주도권 열기',focus:'결과에서 가장 중요한 성장주제와 7주 성공기준을 선택합니다.',record:'내가 선택한 7주 성장주제'},
    {week:2,key:'I',title:'존재초점 세우기',focus:'문제 너머의 가치, 기준, 되고 싶은 모습을 확인합니다.',record:'이 주제 앞에서 서고 싶은 사람'},
    {week:3,key:'N',title:'이야기 깊이 듣기',focus:'반복되는 실제 장면, 감정, 몸의 반응과 낡은 자기이야기를 탐색합니다.',record:'이번 주 반복해서 나타난 장면과 말'},
    {week:4,key:'G',title:'고유성 비추기',focus:'문제 안의 보호기능과 이미 사용해온 힘을 발견합니다.',record:'나를 지켜준 힘과 가져갈 자원'},
    {week:5,key:'D',title:'책임경계 조율하기',focus:'내 몫, 타인의 몫, 환경의 몫을 구분합니다.',record:'내가 책임질 것과 남겨둘 것'},
    {week:6,key:'O',title:'실행기회 열기',focus:'작은 행동, 후원환경, 방해요소와 복귀문장을 설계합니다.',record:'이번 주 실제로 확인할 한 가지 행동'},
    {week:7,key:'M',title:'성장통합하기',focus:'언어·행동·관점의 변화와 다음 성장지점을 정리합니다.',record:'7주 전의 나와 지금의 나를 비교하는 문장'}
  ];

  function now(){return new Date().toISOString();}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function text(value){return String(value??'').trim();}
  function daysBetween(a,b){const x=new Date(a).getTime(),y=new Date(b).getTime();if(!Number.isFinite(x)||!Number.isFinite(y))return 0;return Math.max(0,Math.floor((y-x)/86400000));}
  function id(){return `KGM7W-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;}
  function emptyWeek(stage){return {week:stage.week,key:stage.key,title:stage.title,focus:stage.focus,record:stage.record,pre:{scene:'',attempt:'아직 정하지 않음',learning:'',agenda:''},post:{insight:'',phrase:'',action:'',returnPhrase:'',nextCheck:''},preSavedAt:null,postSavedAt:null,completedAt:null};}
  function createJourney(input={}){const startedAt=input.startedAt||now();return {version:VERSION,journeyId:id(),status:'active',startedAt,updatedAt:startedAt,completedAt:null,currentWeek:1,growthTheme:text(input.growthTheme),successCriterion:text(input.successCriterion),profileCode:text(input.profileCode),profileName:text(input.profileName),resultDate:input.resultDate||null,returnCount:0,lastReturnAt:null,legacyDailyCount:Number(input.legacyDailyCount)||0,weeks:STAGES.map(emptyWeek)};}
  function normalize(raw){if(!raw||typeof raw!=='object')return null;const base=createJourney({growthTheme:raw.growthTheme,successCriterion:raw.successCriterion,profileCode:raw.profileCode,profileName:raw.profileName,resultDate:raw.resultDate,startedAt:raw.startedAt||now(),legacyDailyCount:raw.legacyDailyCount});base.journeyId=raw.journeyId||base.journeyId;base.status=raw.status==='completed'?'completed':'active';base.updatedAt=raw.updatedAt||base.updatedAt;base.completedAt=raw.completedAt||null;base.currentWeek=Math.min(MAX_WEEKS,Math.max(1,Number(raw.currentWeek)||1));base.returnCount=Math.max(0,Number(raw.returnCount)||0);base.lastReturnAt=raw.lastReturnAt||null;base.weeks=STAGES.map((stage,i)=>{const src=Array.isArray(raw.weeks)?raw.weeks[i]||{}:{};const week=emptyWeek(stage);week.pre={...week.pre,...(src.pre||{})};week.post={...week.post,...(src.post||{})};week.preSavedAt=src.preSavedAt||null;week.postSavedAt=src.postSavedAt||null;week.completedAt=src.completedAt||null;return week;});if(base.weeks.every(w=>w.completedAt)){base.status='completed';base.currentWeek=MAX_WEEKS;base.completedAt=base.completedAt||base.weeks[MAX_WEEKS-1].completedAt;}return base;}
  function getWeek(journey,week){const normalized=normalize(journey);if(!normalized)return null;return normalized.weeks[Math.min(MAX_WEEKS,Math.max(1,Number(week)||normalized.currentWeek))-1];}
  function savePre(journey,week,data={}){const next=normalize(journey);const item=getWeek(next,week);if(!item)return next;item.pre={scene:text(data.scene),attempt:text(data.attempt)||'아직 정하지 않음',learning:text(data.learning),agenda:text(data.agenda)};item.preSavedAt=now();next.updatedAt=item.preSavedAt;return next;}
  function savePost(journey,week,data={}){const next=normalize(journey);const item=getWeek(next,week);if(!item)return next;item.post={insight:text(data.insight),phrase:text(data.phrase),action:text(data.action),returnPhrase:text(data.returnPhrase),nextCheck:text(data.nextCheck)};item.postSavedAt=now();next.updatedAt=item.postSavedAt;return next;}
  function canCompleteWeek(journey,week){const item=getWeek(journey,week);if(!item)return {ok:false,reason:'주차 정보를 찾을 수 없습니다.'};if(!text(item.post.insight)&&!text(item.post.phrase))return {ok:false,reason:'오늘 새롭게 알게 된 것 또는 가져갈 한 문장을 남겨주세요.'};if(item.week<MAX_WEEKS&&!text(item.post.action))return {ok:false,reason:'다음 대화 전까지 확인할 작은 행동을 남겨주세요.'};return {ok:true,reason:''};}
  function completeWeek(journey,week,completedAt=now()){const next=normalize(journey);const item=getWeek(next,week);const valid=canCompleteWeek(next,week);if(!valid.ok)return {journey:next,...valid};item.completedAt=item.completedAt||completedAt;next.updatedAt=completedAt;if(item.week>=MAX_WEEKS){next.status='completed';next.currentWeek=MAX_WEEKS;next.completedAt=completedAt;}else{next.currentWeek=Math.max(next.currentWeek,item.week+1);}return {journey:next,ok:true,reason:''};}
  function progress(journey){const next=normalize(journey);if(!next)return {completed:0,total:MAX_WEEKS,pct:0,currentWeek:1};const completed=next.weeks.filter(w=>w.completedAt).length;return {completed,total:MAX_WEEKS,pct:Math.round(completed/MAX_WEEKS*100),currentWeek:next.currentWeek,status:next.status};}
  function noteReturn(journey,openedAt=now()){const next=normalize(journey);if(!next||!next.updatedAt||next.status==='completed')return {journey:next,returned:false,gapDays:0};const gapDays=daysBetween(next.updatedAt,openedAt);if(gapDays<RETURN_GAP_DAYS)return {journey:next,returned:false,gapDays};if(next.lastReturnAt&&daysBetween(next.lastReturnAt,openedAt)<2)return {journey:next,returned:false,gapDays};next.returnCount+=1;next.lastReturnAt=openedAt;next.updatedAt=openedAt;return {journey:next,returned:true,gapDays};}
  function completionSummary(journey){const next=normalize(journey);if(!next)return null;const first=next.weeks[0],last=next.weeks[MAX_WEEKS-1];return {journeyId:next.journeyId,growthTheme:next.growthTheme,successCriterion:next.successCriterion,startedAt:next.startedAt,completedAt:next.completedAt,returnCount:next.returnCount,initialPhrase:first?.post?.phrase||first?.pre?.agenda||'',finalPhrase:last?.post?.phrase||last?.post?.insight||'',nextGrowth:last?.post?.nextCheck||'',weeklyPhrases:next.weeks.map(w=>({week:w.week,key:w.key,title:w.title,phrase:w.post.phrase,action:w.post.action,completedAt:w.completedAt}))};}
  function legacyDailyCount(raw){if(!raw||typeof raw!=='object')return 0;const logs=Array.isArray(raw.logs)?raw.logs:[];return logs.filter(x=>x&&Object.values(x).some(v=>text(v))).length;}
  function stage(week){return STAGES[Math.min(MAX_WEEKS,Math.max(1,Number(week)||1))-1];}

  return {VERSION,STORAGE_KEY,LEGACY_KEY,MAX_WEEKS,RETURN_GAP_DAYS,STAGES,createJourney,normalize,getWeek,savePre,savePost,canCompleteWeek,completeWeek,progress,noteReturn,completionSummary,legacyDailyCount,stage,daysBetween};
});