(()=>{
'use strict';
const qs=(s,r=document)=>r.querySelector(s);
const params=new URLSearchParams(location.search);
let tries=0;
function init(){
 const wrap=qs('#cfm42Intro');
 if(!wrap){if(tries++<80)setTimeout(init,50);return;}
 if(params.get('intro')==='off'){wrap.remove();return;}
 if(wrap.dataset.modalReady==='1')return;
 wrap.dataset.modalReady='1';
 wrap.classList.add('cfm42-modal-mode');
 wrap.setAttribute('role','dialog');
 wrap.setAttribute('aria-modal','true');
 wrap.setAttribute('aria-label','복잡한 생각이 유연성의 로직으로 정리되는 시작 안내');
 wrap.tabIndex=-1;
 document.body.appendChild(wrap);
 const actions=qs('.cfm42-actions',wrap);
 const close=document.createElement('button');
 close.type='button';close.id='cfm42Close';close.className='cfm42-modal-close';close.textContent='닫기 ×';
 close.setAttribute('aria-label','오프닝 닫기');
 actions?.appendChild(close);
 const hero=qs('#intro .integrated-hero');
 const reopen=document.createElement('button');
 reopen.type='button';reopen.id='cfm42Reopen';reopen.className='cfm42-reopen';reopen.textContent='120노드 사고망 다시 보기';reopen.hidden=true;
 (hero?.querySelector('h1')||hero?.firstElementChild)?.insertAdjacentElement('beforebegin',reopen);
 function lock(){document.documentElement.classList.add('cfm42-lock');document.body.classList.add('cfm42-lock')}
 function unlock(){document.documentElement.classList.remove('cfm42-lock');document.body.classList.remove('cfm42-lock')}
 function openModal(replay=true){
  wrap.classList.remove('cfm42-modal-hidden');reopen.hidden=true;lock();
  if(replay)qs('#cfm42Replay',wrap)?.click();
  setTimeout(()=>{(qs('#cfm42Skip',wrap)||close||wrap).focus({preventScroll:true})},40);
 }
 function closeModal(focus=true){
  wrap.classList.add('cfm42-modal-hidden');unlock();reopen.hidden=false;
  if(focus)setTimeout(()=>reopen.focus({preventScroll:true}),30);
 }
 close.addEventListener('click',()=>closeModal(true));
 reopen.addEventListener('click',()=>openModal(true));
 qs('#cfm42Self',wrap)?.addEventListener('click',()=>closeModal(false),true);
 qs('#cfm42Live',wrap)?.addEventListener('click',()=>closeModal(false),true);
 wrap.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();closeModal(true);return;}
  if(e.key!=='Tab')return;
  const focusables=[...wrap.querySelectorAll('button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
  if(!focusables.length)return;
  const first=focusables[0],last=focusables[focusables.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 });
 addEventListener('pagehide',unlock,{once:true});
 openModal(false);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
