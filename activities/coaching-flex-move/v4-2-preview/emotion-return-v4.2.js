(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const SELF_KEY='coaching-flex-move-self-v4';
const STORE='cfm-v4-self-emotion-return';
let queued=false;
function readJSON(key,fallback=null){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function selfState(){return readJSON(SELF_KEY,{})||{}}
function sceneId(){try{const active=sessionStorage.getItem('cfm-v4-active-capture-self');if(active)return active}catch{}const d=selfState()?.data||{};const raw=[d.person,d.observed,d.scene].join('|')||'self';let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619)}return 'scene-'+(h>>>0).toString(36)}
function initialValue(){const n=Number(selfState()?.data?.intensity);return Number.isFinite(n)?Math.max(1,Math.min(10,n)):5}
function allRecords(){const v=readJSON(STORE,{});return v&&typeof v==='object'?v:{}}
function record(){const all=allRecords(),id=sceneId(),start=initialValue();return all[id]||{id,start,end:start,delta:0,note:'',updatedAt:null}}
function save(end,note){const all=allRecords(),id=sceneId(),start=initialValue();all[id]={id,start,end:Number(end),delta:Number(end)-start,note:String(note||''),updatedAt:new Date().toISOString()};writeJSON(STORE,all);window.dispatchEvent(new CustomEvent('cfm:emotion-return-updated',{detail:all[id]}));return all[id]}
function deltaLabel(start,end){const d=end-start;if(d<0)return `${Math.abs(d)}만큼 낮아짐`;if(d>0)return `${d}만큼 높아짐`;return '변화 없음'}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function buildEditor(){const r=record(),el=document.createElement('aside');el.className='cfm-emotion-check';el.dataset.emotionReturn='editor';el.innerHTML=`<div class="cfm-emotion-title"><span>EMOTIONAL RESPONSE · CHECK AGAIN</span><strong>감정반응을 다시 확인합니다.</strong></div><p class="cfm-emotion-copy">감정이 줄어드는 것만이 목표는 아닙니다. 같은 장면을 지금 어떻게 다르게 경험하는지 알아차립니다.</p><div class="cfm-emotion-numbers"><div><small>시작</small><b>${r.start}</b><em>/10</em></div><i>→</i><div><small>지금</small><b data-end>${r.end}</b><em>/10</em></div><div class="cfm-emotion-change"><small>변화</small><b data-delta>${esc(deltaLabel(r.start,r.end))}</b></div></div><label class="cfm-emotion-range"><span>지금 이 장면을 떠올릴 때 감정반응의 정도</span><input type="range" min="1" max="10" step="1" value="${r.end}"><div><span>1 · 낮음</span><output>${r.end}</output><span>10 · 매우 강함</span></div></label><label class="cfm-emotion-awareness"><span>이 차이에서 무엇을 알아차렸나요?</span><textarea maxlength="700" placeholder="감정이 달라진 이유, 여전히 남아 있는 반응, 새롭게 보인 사실이나 선택을 적어보세요.">${esc(r.note)}</textarea></label><p class="cfm-emotion-status">수치를 평가하지 말고, 시작과 지금 사이에 생긴 움직임을 관찰해보세요.</p>`;
 const range=$('input[type=range]',el),out=$('output',el),end=$('[data-end]',el),delta=$('[data-delta]',el),note=$('textarea',el),status=$('.cfm-emotion-status',el);let timer=0;const commit=()=>save(range.value,note.value);range.addEventListener('input',()=>{out.textContent=range.value;end.textContent=range.value;delta.textContent=deltaLabel(r.start,Number(range.value));clearTimeout(timer);timer=setTimeout(commit,120);status.textContent='감정의 변화 자체보다, 그 변화가 알려주는 것을 살펴보세요.'});note.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(commit,180);el.classList.toggle('has-note',Boolean(note.value.trim()));status.textContent=note.value.trim()?'알아차림이 기록되었습니다. 시작과 지금을 함께 볼 수 있습니다.':'수치를 평가하지 말고, 시작과 지금 사이에 생긴 움직임을 관찰해보세요.'});note.addEventListener('blur',commit);el.classList.toggle('has-note',Boolean(r.note.trim()));return el}
function buildSummary(){const r=record(),el=document.createElement('article');el.className='cfm-emotion-summary';el.dataset.emotionReturn='summary';el.innerHTML=`<span>감정반응의 변화</span><h3>${r.start}/10 → ${r.end}/10</h3><p><b>${esc(deltaLabel(r.start,r.end))}</b>\n\n${esc(r.note||'아직 알아차림을 기록하지 않았습니다.')}</p>`;return el}
function inject(){queued=false;const game=$('#selfGame.active'),final=$('#selfFinal.active');if(game){const step=Number(($('#selfStepLabel')?.textContent.match(/\d+/)||[])[0]||0),card=$('#selfContent .self-card');if(step===8&&card&&!card.querySelector('[data-emotion-return="editor"]')){const anchor=$('#selfBodyChange')?.closest('.self-field')||$('.notice',card)||card.lastElementChild;anchor.insertAdjacentElement('afterend',buildEditor())}}if(final){const summary=$('#selfSummary');if(summary&&!summary.querySelector('[data-emotion-return="summary"]'))summary.prepend(buildSummary())}}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(inject)}
window.addEventListener('cfm:emotion-return-updated',schedule);
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
