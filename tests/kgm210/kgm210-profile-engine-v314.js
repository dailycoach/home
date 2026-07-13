(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.KGMProfileEngineV314=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const VERSION='KGM210 profile engine v3.14.0';
  const ORDER=['K','I','N','G','D','O','M'];
  const TIE_THRESHOLD=0.12;

  const DOMAIN_META={
    K:{key:'K',full:'K 주도성',type:'선택주도형',title:'선택과 방향을 잡는 힘',current:'상황에 끌려가기보다 내가 선택할 수 있는 지점을 찾는 힘입니다.',strength:'기준을 세우고 시작점을 만들며, 흔들릴 때 선택권을 다시 가져옵니다.',overuse:'과하게 사용되면 다른 사람의 속도를 기다리지 못하거나 혼자 결정하려 할 수 있습니다.',underuse:'흔들릴 때는 주변 반응을 먼저 살피느라 결정을 미루거나 내 기준이 흐려질 수 있습니다.',question:'지금 이 상황에서 내가 실제로 선택할 수 있는 한 가지는 무엇입니까?',action:'오늘 미루고 있던 작은 결정 하나를 직접 정하고 이유를 한 줄로 남겨보세요.'},
    I:{key:'I',full:'I 존재초점',type:'존재정렬형',title:'가치와 나다움을 붙잡는 힘',current:'해야 할 일 너머에서 내가 어떤 사람으로 서고 싶은지 확인하는 힘입니다.',strength:'역할이나 성과가 흔들려도 지키고 싶은 가치와 태도를 기준으로 돌아옵니다.',overuse:'과하게 사용되면 이상적인 자기상에 맞추려는 압박이 커지거나 현실의 조건을 놓칠 수 있습니다.',underuse:'흔들릴 때는 해야 할 일은 많지만 왜 하는지 잃고, 타인의 기준으로 자신을 설명할 수 있습니다.',question:'이 장면에서 내가 지키고 싶은 나다움과 가치는 무엇입니까?',action:'“나는 ___을 지키고 싶은 사람이다”라는 문장을 하나 적어보세요.'},
    N:{key:'N',full:'N 자기이야기',type:'이야기통찰형',title:'경험과 반복흐름을 이해하는 힘',current:'실제 장면과 반복되는 감정·해석·행동을 연결해 자기 이야기를 듣는 힘입니다.',strength:'추상적인 자기평가를 구체적인 장면과 패턴으로 바꾸어 이해합니다.',overuse:'과하게 사용되면 분석과 해석이 길어져 실행이 늦어지거나 이야기 속에 오래 머물 수 있습니다.',underuse:'흔들릴 때는 “늘 그렇다”는 말만 남고 실제 장면이나 반복 조건을 구체화하기 어려울 수 있습니다.',question:'이 말이 가장 선명하게 나타났던 실제 장면 하나는 무엇입니까?',action:'반복해서 떠오르는 자기 말 하나를 적고, 그 말이 나타난 실제 장면을 한 줄로 남겨보세요.'},
    G:{key:'G',full:'G 고유성',type:'고유자원형',title:'나다운 자원과 방식을 발견하는 힘',current:'문제 안에서도 이미 작동하고 있는 자원과 나다운 방식을 발견하는 힘입니다.',strength:'버텨온 힘, 보호기능, 몰입되는 방식과 이미 가진 자원을 실제 장면에서 찾아냅니다.',overuse:'과하게 사용되면 특별함을 증명하려 하거나 강점을 이유로 약점과 도움 필요를 피할 수 있습니다.',underuse:'흔들릴 때는 잘한 것을 축소하고 비교에 머물러 내가 이미 가진 힘을 보지 못할 수 있습니다.',question:'이 어려움 속에서도 이미 사용하고 있던 나다운 힘은 무엇입니까?',action:'이번 주 나에게 잘 맞았던 순간 하나를 찾아 무엇이 잘 맞았는지 적어보세요.'},
    D:{key:'D',full:'D 책임경계',type:'책임조율형',title:'내 몫과 타인의 몫을 구분하는 힘',current:'내 몫·타인의 몫·환경의 몫을 구분해 실제 책임 범위를 조율하는 힘입니다.',strength:'책임을 회피하지 않으면서도 모두 떠안지 않고 관계와 현실 안에서 몫을 나눕니다.',overuse:'과하게 사용되면 지나치게 선을 긋거나 도움과 협력을 거절하며 관계가 단절될 수 있습니다.',underuse:'흔들릴 때는 타인의 감정과 결과까지 내 책임처럼 떠안거나, 반대로 선택 가능한 몫을 잃을 수 있습니다.',question:'이 상황에서 내 몫, 타인의 몫, 환경의 몫은 각각 무엇입니까?',action:'떠안고 있는 일 하나를 내 몫/타인의 몫/함께 조율할 몫으로 나누어보세요.'},
    O:{key:'O',full:'O 실행기회',type:'실행전환형',title:'통찰을 작은 행동으로 옮기는 힘',current:'알게 된 것을 작고 현실적인 행동으로 옮기고 결과를 확인하는 힘입니다.',strength:'행동을 구체화하고 작게 시작하며, 막혔을 때 방법을 바꾸어 다시 시도합니다.',overuse:'과하게 사용되면 충분히 듣고 정렬하기 전에 성급하게 움직이거나 성과만 좇을 수 있습니다.',underuse:'흔들릴 때는 계획과 생각은 많지만 시작점이 크고 실패가 걱정되어 행동이 늦어질 수 있습니다.',question:'오늘 또는 내일 10분 안에 시작할 수 있는 가장 작은 행동은 무엇입니까?',action:'지금 생각하는 행동을 10분짜리 첫걸음으로 줄여 실제 일정에 넣어보세요.'},
    M:{key:'M',full:'M 성장통합',type:'성장통합형',title:'경험을 배움과 다음 성장으로 잇는 힘',current:'경험에서 배운 것을 자기 언어로 정리하고 다음 선택과 복귀로 연결하는 힘입니다.',strength:'성공과 실패를 함께 돌아보며 배움을 남기고 다음 장면에 다시 사용합니다.',overuse:'과하게 사용되면 모든 경험에 의미를 붙이거나 완벽하게 정리해야 한다는 부담이 커질 수 있습니다.',underuse:'흔들릴 때는 경험은 많이 쌓이지만 배움과 복귀 기준이 남지 않아 같은 시행착오가 반복될 수 있습니다.',question:'이번 경험에서 다음 장면에도 가져가고 싶은 배움은 무엇입니까?',action:'최근 경험 하나를 “다음에는 ___을 기억하겠다”라는 문장으로 정리해보세요.'}
  };

  const PAIR_NAMES={
    'K-I':'가치기반 선택형','K-N':'맥락주도형','K-G':'강점주도형','K-D':'책임선택형','K-O':'행동주도형','K-M':'성찰주도형',
    'I-K':'가치실천형','I-N':'의미탐색형','I-G':'고유정렬형','I-D':'가치경계형','I-O':'의미실행형','I-M':'정체성통합형',
    'N-K':'이야기전환형','N-I':'의미해석형','N-G':'자원발견형','N-D':'맥락조율형','N-O':'통찰실행형','N-M':'이야기통합형',
    'G-K':'자원주도형','G-I':'고유가치형','G-N':'강점서사형','G-D':'자원조율형','G-O':'강점실행형','G-M':'자원통합형',
    'D-K':'책임주도형','D-I':'가치책임형','D-N':'관계맥락형','D-G':'경계자원형','D-O':'현실실행형','D-M':'책임성찰형',
    'O-K':'실행주도형','O-I':'가치실행형','O-N':'경험실험형','O-G':'자원실행형','O-D':'책임실행형','O-M':'실행학습형',
    'M-K':'성찰선택형','M-I':'의미통합형','M-N':'이야기성찰형','M-G':'자원성찰형','M-D':'책임통합형','M-O':'학습실행형'
  };

  const KEY_BY_NAME=Object.values(DOMAIN_META).reduce((acc,d)=>{acc[d.full]=d.key;acc[d.key]=d.key;return acc;},{});
  function number(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}
  function round(v,d=2){const p=10**d;return Math.round(number(v)*p)/p;}
  function mean(values){const xs=values.map(v=>number(v,NaN)).filter(Number.isFinite);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;}
  function keyOf(value){return KEY_BY_NAME[String(value||'').trim()]||String(value||'').trim().slice(0,1).toUpperCase();}
  function normalizeScores(scores){const seen=new Map();(Array.isArray(scores)?scores:[]).forEach(item=>{const key=keyOf(item?.key||item?.name||item?.domain);if(DOMAIN_META[key])seen.set(key,{key,name:DOMAIN_META[key].full,avg:round(item?.avg??item?.score??item?.value,4)});});return ORDER.map(key=>seen.get(key)||{key,name:DOMAIN_META[key].full,avg:0});}
  function stateBand(avg){const v=number(avg);if(v>=6.1)return {key:'strong',label:'강하게 작동하는 상태',short:'강하게 작동',summary:'여러 실제 장면에서 매우 자주 사용하는 힘입니다.'};if(v>=5.1)return {key:'stable',label:'안정적으로 작동하는 상태',short:'안정적으로 작동',summary:'여러 상황에서 비교적 안정적으로 사용하는 힘입니다.'};if(v>=4.1)return {key:'situational',label:'상황에 따라 작동하는 상태',short:'상황에 따라 작동',summary:'조건과 관계에 따라 작동 정도가 달라질 수 있습니다.'};if(v>=3.1)return {key:'shaky',label:'흔들리는 상태',short:'흔들리는 상태',summary:'필요성은 알고 있지만 실제 장면에서 편차가 큰 힘입니다.'};return {key:'awakening',label:'먼저 깨워볼 상태',short:'먼저 깨워보기',summary:'결핍이 아니라 안전한 작은 장면부터 사용 경험을 늘려볼 힘입니다.'};}
  function balancedName(avg){if(avg>=5.8)return {name:'전영역 균형상승형',code:'BAL-HIGH',sentence:'일곱 성장 힘을 전반적으로 높게 인식하고 있는 상태입니다. 강점이 실제 장면에서도 고르게 작동하는지와 과하게 사용되는 힘은 없는지를 함께 확인합니다.'};if(avg>=4.6)return {name:'전영역 균형작동형',code:'BAL-MID',sentence:'일곱 성장 힘이 비교적 비슷한 수준에서 작동하는 상태입니다. 영역 간 우열보다 알아차림·세우기·해보기 흐름의 차이를 먼저 살펴봅니다.'};if(avg>=3.6)return {name:'전영역 균형탐색형',code:'BAL-SEARCH',sentence:'일곱 성장 힘이 비슷하게 나타나며 상황에 따라 작동 편차가 있을 수 있습니다. 최근 실제 장면을 통해 먼저 움직이는 힘과 필요한 힘을 확인합니다.'};return {name:'전영역 기초회복형',code:'BAL-BASE',sentence:'일곱 영역을 고정된 약점으로 보지 않고 안전한 일상 장면에서 작은 사용 경험을 회복해갈 시점입니다.'};}
  function evidenceFor(key,evidence){const e=evidence?.[key]||{};return {applied:number(e.applied??e.Z??e.z,0),variance:number(e.variance,999),answered:number(e.answered,0)};}
  function compareDesc(a,b,evidence){const diff=b.avg-a.avg;if(Math.abs(diff)>TIE_THRESHOLD)return diff;const ea=evidenceFor(a.key,evidence),eb=evidenceFor(b.key,evidence);if(Math.abs(eb.applied-ea.applied)>.001)return eb.applied-ea.applied;if(Math.abs(ea.variance-eb.variance)>.001)return ea.variance-eb.variance;return ORDER.indexOf(a.key)-ORDER.indexOf(b.key);}
  function compareAsc(a,b,evidence){const diff=a.avg-b.avg;if(Math.abs(diff)>TIE_THRESHOLD)return diff;const ea=evidenceFor(a.key,evidence),eb=evidenceFor(b.key,evidence);if(Math.abs(ea.applied-eb.applied)>.001)return ea.applied-eb.applied;if(Math.abs(eb.variance-ea.variance)>.001)return eb.variance-ea.variance;return ORDER.indexOf(a.key)-ORDER.indexOf(b.key);}
  function lowAxis(axes){return [{key:'X',label:'알아차림',value:number(axes?.X)},{key:'Y',label:'세우기',value:number(axes?.Y)},{key:'Z',label:'해보기',value:number(axes?.Z)}].sort((a,b)=>a.value-b.value)[0];}
  function profileSentence(primary,secondary,focus){return `${DOMAIN_META[primary].title}과 ${DOMAIN_META[secondary].title}이 함께 작동하며, ${DOMAIN_META[focus].title}을 조율할 때 강점이 더 지속적으로 이어지는 상태입니다.`;}
  function buildProfile(input={}){const scores=normalizeScores(input.scores),evidence=input.evidence||{},axes=input.axes||{},average=mean(scores.map(x=>x.avg)),max=Math.max(...scores.map(x=>x.avg)),min=Math.min(...scores.map(x=>x.avg)),spread=max-min,isBalanced=spread<=TIE_THRESHOLD,domains=scores.map(s=>({...s,meta:DOMAIN_META[s.key],state:stateBand(s.avg)}));if(isBalanced){const b=balancedName(average),axis=lowAxis(axes);return {version:VERSION,kind:'balanced',displayName:b.name,profileCode:b.code,stateSentence:b.sentence,average:round(average),spread:round(spread),primary:null,secondary:null,focus:null,lowAxis:axis,topTied:true,bottomTied:true,domains};}const ranked=[...scores].sort((a,b)=>compareDesc(a,b,evidence)),primary=ranked[0],secondary=ranked[1],remaining=scores.filter(s=>s.key!==primary.key&&s.key!==secondary.key).sort((a,b)=>compareAsc(a,b,evidence)),focus=remaining[0],pairCode=`${primary.key}-${secondary.key}`,displayName=PAIR_NAMES[pairCode]||`${DOMAIN_META[primary.key].type} · ${DOMAIN_META[secondary.key].type}`;return {version:VERSION,kind:'profile',displayName,profileCode:`${pairCode}/${focus.key}`,stateSentence:profileSentence(primary.key,secondary.key,focus.key),average:round(average),spread:round(spread),primary:{...primary,meta:DOMAIN_META[primary.key],state:stateBand(primary.avg)},secondary:{...secondary,meta:DOMAIN_META[secondary.key],state:stateBand(secondary.avg)},focus:{...focus,meta:DOMAIN_META[focus.key],state:stateBand(focus.avg)},lowAxis:lowAxis(axes),topTied:Math.abs(primary.avg-secondary.avg)<=TIE_THRESHOLD,bottomTied:remaining.length>1&&Math.abs(remaining[0].avg-remaining[1].avg)<=TIE_THRESHOLD,domains};}
  return {VERSION,ORDER,TIE_THRESHOLD,DOMAIN_META,PAIR_NAMES,keyOf,normalizeScores,stateBand,buildProfile};
});