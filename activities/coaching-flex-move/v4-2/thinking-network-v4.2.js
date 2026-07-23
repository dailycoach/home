(()=>{
'use strict';
const wrap=document.querySelector('#cfm42Intro');
const scene=wrap?.querySelector('.cfm42-one');
if(!wrap||!scene||wrap.querySelector('#cfm42ThinkingNetwork'))return;
const word=document.createElement('div');
word.id='cfm42ThinkingNetwork';
word.className='cfm42-thinking-network';
word.setAttribute('aria-hidden','true');
const line=(text,cls,offset)=>`<span class="cfm42-thinking-line ${cls}">${[...text].map((letter,index)=>`<b data-order="${offset+index}">${letter}</b>`).join('')}</span>`;
word.innerHTML=line('THINKING','thinking',0)+line('NETWORK','network',8);
scene.appendChild(word);
const letters=[...word.querySelectorAll('b')].sort((a,b)=>Number(a.dataset.order)-Number(b.dataset.order));
let timers=[];
function clearTimers(){timers.forEach(clearTimeout);timers=[]}
function reset(){clearTimers();word.classList.remove('is-complete','is-leaving');letters.forEach(letter=>letter.classList.remove('is-on'))}
function play(){
 reset();
 if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
 const start=620,interval=82;
 letters.forEach((letter,index)=>timers.push(setTimeout(()=>letter.classList.add('is-on'),start+index*interval)));
 timers.push(setTimeout(()=>word.classList.add('is-complete'),start+letters.length*interval+80));
 timers.push(setTimeout(()=>word.classList.add('is-leaving'),2860));
}
wrap.querySelector('#cfm42Replay')?.addEventListener('click',()=>setTimeout(play,0));
wrap.querySelector('#cfm42Skip')?.addEventListener('click',()=>{clearTimers();word.classList.add('is-leaving')});
setTimeout(play,180);
})();
