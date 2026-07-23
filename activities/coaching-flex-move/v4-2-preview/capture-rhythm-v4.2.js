(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const STORAGE='cfm-v4-3sec-capture-log';
const armed={self:false,live:false};
const shown={self:0,live:0};
let pending=false;
function readLog(){try{const v=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function writeLog(log){try{localStorage.setItem(STORAGE,JSON.stringify(log.slice(-40)))}catch{}}
function saveRecord(record){const log=readLog(),i=log.findIndex(x=>x.id===record.id);if(i>=0)log[i]=record;else log.push(record);writeLog(log)}
function contextFor(mode){
 if(mode==='self')return [$('#selfStepLabel')?.textContent,$('#selfPhaseLabel')?.textContent].filter(Boolean).join(' · ')||'SELF FLEX';
 return [$('#proRoundLabel')?.textContent,$('#proPhaseLabel')?.textContent].filter(Boolean).join(' · ')||'LIVE FLEX';
}
function targetFor(mode){
 if(mode==='self'){
  const screen=$('#selfGame.active'),card=$('#selfContent .self-card');
  if(!screen||!card)return null;
  return{host:card,anchor:$('.self-stage-title',card),prompt:'3초 안에 떠오른 말·감정·장면',placeholder:'정리하지 말고, 가장 먼저 떠오른 표현을 그대로 적어보세요.'};
 }
 const screen=$('#proGame.active'),content=$('#proContent');
 if(!screen||!content||!content.children.length)return null;
 const cards=[...content.querySelectorAll(':scope > article.card')];
 const host=cards[cards.length-1]||content;
 const anchor=$('.stage-head',host)||host.firstElementChild;
 return{host,anchor,prompt:'3초 안에 떠오른 질문·판단·감정·충동',placeholder:'좋은 개입으로 고치기 전에, 코치 안에서 먼저 움직인 반응을 적어보세요.'};
}
function build(mode,target){
 const el=document.createElement('aside');
 el.className='cfm-capture-rhythm';el.dataset.mode=mode;el.setAttribute('aria-label','3초 첫 반응 포착');
 el.innerHTML=`<div class="cfm-capture-head"><i class="cfm-capture-count" aria-live="polite">3</i><div class="cfm-capture-copy"><b>생각을 편집하기 전에 먼저 적습니다.</b><span>입력은 지금부터 가능합니다. 숫자는 제한시간이 아니라 리듬입니다.</span></div><button type="button" class="cfm-capture-toggle" aria-expanded="true">접기</button></div><div class="cfm-capture-progress"><i></i></div><div class="cfm-capture-field"><label>${target.prompt}</label><textarea maxlength="600" placeholder="${target.placeholder}"></textarea></div><div class="cfm-capture-chips" aria-label="내용이 바로 떠오르지 않을 때"><button type="button">잘 모르겠다</button><button type="button">아무 생각이 없다</button><button type="button">여러 생각이 동시에 든다</button><button type="button">몸이 먼저 긴장한다</button></div><p class="cfm-capture-status">첫 반응은 결론이 아니라, 유연성을 시작하는 관찰 자료입니다.</p>`;
 if(target.anchor)target.anchor.insertAdjacentElement('afterend',el);else target.host.prepend(el);
 const count=$('.cfm-capture-count',el),copy=$('.cfm-capture-copy b',el),status=$('.cfm-capture-status',el),input=$('textarea',el),toggle=$('.cfm-capture-toggle',el);
 const record={id:`${mode}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,mode,context:contextFor(mode),createdAt:new Date().toISOString(),text:''};
 el.dataset.captureId=record.id;
 try{sessionStorage.setItem(`cfm-v4-active-capture-${mode}`,record.id)}catch{}
 window.dispatchEvent(new CustomEvent('cfm:capture-created',{detail:{mode,id:record.id,context:record.context}}));
 let saveTimer=0;
 const setCount=(value,label)=>{count.textContent=value;copy.textContent=label};
 setTimeout(()=>setCount('2','첫 번째 표현을 고르지 말고, 먼저 나타난 것을 봅니다.'),900);
 setTimeout(()=>setCount('1','좋게 보이도록 고치기 전에 그대로 적습니다.'),1800);
 setTimeout(()=>{el.classList.add('is-ready');setCount('지금','첫 반응을 적어보세요.');status.textContent='계속 써도 괜찮습니다. 3초는 실패를 가르는 시간이 아닙니다.'},2700);
 input.addEventListener('input',()=>{el.classList.toggle('has-input',Boolean(input.value.trim()));record.text=input.value;record.updatedAt=new Date().toISOString();clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveRecord(record),220);if(input.value.trim())status.textContent=mode==='self'?'첫 반응이 포착되었습니다. 아래 훈련에서 사실·해석·감정과 함께 다시 살펴봅니다.':'첫 반응이 포착되었습니다. 아래 훈련에서 고객 언어·내적 규칙·개입과 함께 다시 살펴봅니다.'});
 input.addEventListener('blur',()=>{if(input.value.trim())saveRecord(record)});
 $('.cfm-capture-chips',el).addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(input.value.trim())input.value+=` · ${b.textContent}`;else input.value=b.textContent;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus({preventScroll:true})});
 toggle.addEventListener('click',()=>{const collapsed=el.classList.toggle('is-collapsed');toggle.textContent=collapsed?'펼치기':'접기';toggle.setAttribute('aria-expanded',String(!collapsed))});
 return el;
}
function tryInject(){pending=false;for(const mode of ['self','live']){if(!armed[mode])continue;const target=targetFor(mode);if(!target)continue;if(target.host.querySelector(`.cfm-capture-rhythm[data-mode="${mode}"]`)){armed[mode]=false;continue}build(mode,target);armed[mode]=false;shown[mode]++}}
function schedule(){if(pending)return;pending=true;requestAnimationFrame(tryInject)}
function arm(mode){if(mode!=='self'&&mode!=='live')return;armed[mode]=true;schedule();setTimeout(schedule,50);setTimeout(schedule,180)}
window.addEventListener('cfm:entry-proceed',e=>arm(e.detail?.mode));
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();
