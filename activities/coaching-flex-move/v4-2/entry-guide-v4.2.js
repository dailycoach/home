(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const KEYS={
 selfCount:'cfm-v4-self-entry-count',
 liveCount:'cfm-v4-live-entry-count',
 selfVariant:'cfm-v4-self-guide-variant',
 liveVariant:'cfm-v4-live-guide-variant',
 selfLast:'cfm-v4-self-guide-last-seen',
 liveLast:'cfm-v4-live-guide-last-seen'
};
const COPY={
 self:{
  label:'SELF FLEX · 3초 포착',
  title:'편집되기 전의 나를 포착합니다.',
  full:'질문이나 장면을 마주한 뒤 약 3초 안에 가장 먼저 떠오른 말·감정·장면을 기록하세요. 좋은 답으로 다듬거나 설명하기 전에, 자아가 정리하기 전 자기(Self)가 보내는 첫 신호를 붙잡습니다.',
  note:'첫 반응은 결론이 아닙니다. 감정과 머릿속 규칙을 발견하고 더 유연한 응답을 선택하기 위한 출발점입니다.',
  button:'첫 장면 포착하기',
  variants:[
   '먼저 떠오른 것을 적고, 판단은 나중에 합니다.',
   '좋은 답보다 처음 떠오른 답을 먼저 잡아보세요.',
   '설명하기 전에 몸과 감정이 보낸 신호를 기록하세요.',
   '고치고 싶은 마음이 들기 전의 문장을 붙잡아보세요.',
   '첫 반응은 결론이 아니라 자기(Self)에게 들어가는 입구입니다.',
   '무엇이 옳은지보다 무엇이 먼저 움직였는지 살펴보세요.'
  ]
 },
 live:{
  label:'LIVE FLEX · 3초 포착',
  title:'고객보다 먼저 움직인 코치를 봅니다.',
  full:'고객의 말과 침묵을 접한 뒤 약 3초 안에 떠오른 질문·판단·감정·충동을 기록하세요. 좋은 코치처럼 보이도록 수정하기 전에, 내 안에서 먼저 움직인 직관과 자동반응을 함께 봅니다.',
  note:'첫 개입은 정답이 아닙니다. 그 개입을 만든 기대와 내적 규칙을 확인한 뒤 고객 반응에 맞춰 다시 선택합니다.',
  button:'내 첫 반응 포착하기',
  variants:[
   '고객보다 먼저 움직인 내 반응을 기록하세요.',
   '질문하기 전에 질문하고 싶은 충동을 먼저 봅니다.',
   '좋은 개입을 찾기 전에 내 판단이 향한 곳을 확인하세요.',
   '고객이 어떻게 반응해야 한다고 기대했는지 살펴보세요.',
   '첫 개입은 정답이 아니라 코치의 자동반응을 보여주는 자료입니다.',
   '고객 반응을 보고 내 규칙과 개입을 함께 수정합니다.'
  ]
 }
};
let modal=null,lastTrigger=null,bypassId='';
function readNum(key){try{return Math.max(0,Number(localStorage.getItem(key)||0)||0)}catch{return 0}}
function write(key,val){try{localStorage.setItem(key,String(val))}catch{}}
function stageFor(count){return count<3?'full':count<10?'compact':'ritual'}
function build(){
 if(modal)return modal;
 const el=document.createElement('div');
 el.id='cfmEntryGuide';
 el.className='cfm-entry-guide';
 el.hidden=true;
 el.innerHTML=`<div class="cfm-entry-backdrop" aria-hidden="true"></div>
 <section class="cfm-entry-card" role="dialog" aria-modal="true" aria-labelledby="cfmEntryTitle" aria-describedby="cfmEntryBody">
  <button type="button" class="cfm-entry-close" id="cfmEntryClose" aria-label="진입 안내 닫기">×</button>
  <div class="cfm-entry-label" id="cfmEntryLabel"></div>
  <div class="cfm-entry-pulse" aria-label="3초 포착 리듬"><i>3</i><i>2</i><i>1</i><span>FIRST RESPONSE</span></div>
  <h2 id="cfmEntryTitle"></h2>
  <p class="cfm-entry-body" id="cfmEntryBody"></p>
  <blockquote id="cfmEntryVariant"></blockquote>
  <p class="cfm-entry-note" id="cfmEntryNote"></p>
  <div class="cfm-entry-actions"><button type="button" class="cfm-entry-start" id="cfmEntryStart"></button></div>
  <p class="cfm-entry-foot">3초는 제한시간이 아니라, 편집되기 전의 첫 반응을 포착하기 위한 리듬입니다.</p>
 </section>`;
 document.body.appendChild(el);
 modal=el;
 $('#cfmEntryClose',el).addEventListener('click',()=>close(true));
 $('#cfmEntryStart',el).addEventListener('click',proceed);
 el.addEventListener('keydown',trapFocus);
 return el;
}
function open(mode,trigger,{increment=true}={}){
 const el=build(),data=COPY[mode];
 lastTrigger=trigger||lastTrigger;
 const countKey=mode==='self'?KEYS.selfCount:KEYS.liveCount;
 const variantKey=mode==='self'?KEYS.selfVariant:KEYS.liveVariant;
 const lastKey=mode==='self'?KEYS.selfLast:KEYS.liveLast;
 const count=readNum(countKey),stage=stageFor(count),variantIndex=count%data.variants.length;
 if(increment){write(countKey,count+1);write(variantKey,variantIndex);write(lastKey,new Date().toISOString())}
 el.dataset.mode=mode;el.dataset.stage=stage;el.hidden=false;
 document.documentElement.classList.add('cfm-entry-lock');document.body.classList.add('cfm-entry-lock');
 $('#cfmEntryLabel',el).textContent=data.label;
 $('#cfmEntryTitle',el).textContent=stage==='ritual'?'오늘의 3초 포착':data.title;
 $('#cfmEntryBody',el).textContent=stage==='full'?data.full:stage==='compact'?'먼저 떠오른 반응을 기록하고, 설명과 판단은 그다음에 합니다.':'';
 $('#cfmEntryVariant',el).textContent=data.variants[variantIndex];
 $('#cfmEntryNote',el).textContent=stage==='full'?data.note:'';
 $('#cfmEntryStart',el).textContent=trigger?.id==='selfResume'||trigger?.id==='resume'?'훈련 이어가기':data.button;
 requestAnimationFrame(()=>el.classList.add('is-open'));
 setTimeout(()=>$('#cfmEntryStart',el)?.focus({preventScroll:true}),40);
}
function close(restore=false){
 if(!modal||modal.hidden)return;
 modal.classList.remove('is-open');
 document.documentElement.classList.remove('cfm-entry-lock');document.body.classList.remove('cfm-entry-lock');
 setTimeout(()=>{if(modal)modal.hidden=true},180);
 if(restore&&lastTrigger)setTimeout(()=>lastTrigger.focus?.({preventScroll:true}),40);
}
function proceed(){
 const trigger=lastTrigger;
 if(!trigger){close(false);return;}
 bypassId=trigger.id;
 close(false);
 setTimeout(()=>trigger.click(),30);
}
function trapFocus(e){
 if(e.key==='Escape'){e.preventDefault();close(true);return;}
 if(e.key!=='Tab')return;
 const focusables=[...modal.querySelectorAll('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')].filter(x=>!x.hidden&&x.offsetParent!==null);
 if(!focusables.length)return;
 const first=focusables[0],last=focusables[focusables.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
}
function modeFor(id){return id==='startSelf'||id==='selfResume'?'self':'live'}
document.addEventListener('click',e=>{
 const trigger=e.target.closest?.('#startSelf,#selfResume,#startProfessional,#resume');
 if(!trigger)return;
 if(bypassId===trigger.id){bypassId='';return;}
 e.preventDefault();e.stopImmediatePropagation();
 open(modeFor(trigger.id),trigger,{increment:true});
},true);
function addHelpButtons(){
 const configs=[['#selfOrientation','self','3초 포착 안내 다시 보기'],['#proOrientation','live','3초 포착 안내 다시 보기']];
 for(const [screen,mode,text] of configs){
  const root=$(screen);if(!root||root.querySelector('.cfm-entry-help'))continue;
  const actions=root.querySelector('.actions');if(!actions)continue;
  const btn=document.createElement('button');btn.type='button';btn.className='cfm-entry-help';btn.textContent=text;
  btn.addEventListener('click',()=>open(mode,btn,{increment:false}));
  actions.insertAdjacentElement('beforebegin',btn);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addHelpButtons,{once:true});else addHelpButtons();
})();