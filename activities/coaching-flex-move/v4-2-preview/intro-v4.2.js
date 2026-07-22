(()=>{
'use strict';
const q=(s,r=document)=>r.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const hero=q('#intro .integrated-hero');
if(!hero||q('#cfm42Intro'))return;
const html=`<section class="cfm42-wrap" id="cfm42Intro" aria-label="복잡한 생각이 유연성의 로직으로 정리되는 오프닝">
<div class="cfm42-top"><span>THOUGHT LOGIC → FLEX LOGIC</span><div class="cfm42-actions"><button type="button" id="cfm42Skip">핵심만 보기</button><button type="button" id="cfm42Replay">다시 보기 ↺</button></div></div>
<div class="cfm42-stage"><div class="cfm42-grid"></div><div class="cfm42-network"><canvas id="cfm42Canvas"></canvas><div class="cfm42-captions" id="cfm42Captions"></div><div class="cfm42-labels" id="cfm42Labels"></div><div class="cfm42-meter"><span>THOUGHT NETWORK</span><b><i id="cfm42Nodes">0</i> / 120</b><em><i id="cfm42Edges">0</i> connections</em></div></div>
<div class="cfm42-scene cfm42-one"><div class="cfm42-copy"><small>01 · COMPLEX THOUGHT</small><h2>한 장면이<br>120개의 생각으로 번집니다.</h2><p>사건 하나가 감정·기억·해석·예측·기대로 증식하며 서로를 다시 자극합니다.</p></div></div>
<div class="cfm42-scene cfm42-two"><div class="cfm42-orbit"><i>사실</i><i>해석</i><i>몸과 감정</i><i>기억과 예측</i><div class="cfm42-rulebox"><small>02 · THE INNER RULE</small><strong>“반드시 · 해야 한다”</strong><p>복잡한 생각의 중심에는 때때로 무언가를 지키려는 하나의 머릿속 규칙이 있습니다.</p></div></div></div>
<div class="cfm42-scene cfm42-three"><div class="cfm42-final"><div class="cfm42-final-title"><small>03 · FLEX LOGIC</small><h2>생각을 줄이지 않고,<br>움직일 순서를 만듭니다.</h2><p>하나의 유연성 엔진이 나의 장면과 코칭 장면으로 확장됩니다.</p></div><div><div class="cfm42-core"><article><small>FACT</small><strong>실제로 일어난 일</strong></article><article><small>MEANING</small><strong>내가 붙인 해석</strong></article><article><small>RESPONSE</small><strong>몸과 감정</strong></article></div><div class="cfm42-arrow">↓</div><div class="cfm42-center"><small>CENTER</small><strong>머릿속 규칙</strong></div><div class="cfm42-arrow">↓</div><div class="cfm42-move"><span>상대가 하지 않아도 됨</span><span>내가 상대에게 함</span><span>내가 하지 않아도 됨</span><span>내가 나에게 함</span><span>나에게 요구하지 않아도 됨</span></div><div class="cfm42-arrow">↓</div><div class="cfm42-routes"><article class="cfm42-route self"><small>SELF FLEX</small><strong>먼저 나를 유연하게</strong><div><span>감정의 출처</span><span>요청·경계</span><span>다음 행동</span></div></article><article class="cfm42-route live"><small>LIVE FLEX</small><strong>그다음 대화를 유연하게</strong><div><span>고객 언어</span><span>최소 개입</span><span>이중 되감기</span></div></article></div><div class="cfm42-arrow">↓</div><div class="cfm42-result"><small>FINAL</small><strong>자기수정</strong></div></div><div><div class="cfm42-choices"><button class="self" type="button" id="cfm42Self">SELF FLEX 시작</button><button class="live" type="button" id="cfm42Live">LIVE FLEX 시작</button></div><div class="cfm42-micro">생각을 없애는 것이 아니라, 실제 반응에 따라 판단과 행동을 다시 선택합니다.</div></div></div></div></div></section>`;
const anchor=hero.querySelector('h1')||hero.firstChild;
anchor.insertAdjacentHTML('beforebegin',html);
const wrap=q('#cfm42Intro'),canvas=q('#cfm42Canvas'),ctx=canvas.getContext('2d'),labelLayer=q('#cfm42Labels'),captionLayer=q('#cfm42Captions');
const nodeCountEl=q('#cfm42Nodes'),edgeCountEl=q('#cfm42Edges');
const clusters=[
 {id:'event',name:'사건',color:'#66ddff',x:.18,y:.26,words:['그 말','그 표정','침묵 5초','짧은 답변']},
 {id:'feel',name:'몸과 감정',color:'#ff7a52',x:.19,y:.72,words:['가슴이 답답하다','몸이 굳는다','조급하다','화가 난다']},
 {id:'meaning',name:'해석',color:'#b9a6ff',x:.48,y:.26,words:['나를 무시하나','이해하지 못했나','책임감이 없다','내가 틀렸나']},
 {id:'memory',name:'기억',color:'#ad91ff',x:.48,y:.74,words:['예전에도 그랬다','또 반복된다','그때도 실패했다','늘 이렇게 흔들린다']},
 {id:'fear',name:'예측과 두려움',color:'#ffd166',x:.80,y:.27,words:['관계가 깨질까','일이 더 커질까','무능해 보일까','변화하지 않을까']},
 {id:'rule',name:'기대와 규칙',color:'#dcff45',x:.80,y:.72,words:['존중해야 한다','답해야 한다','나는 잘해야 한다','지금 해결해야 한다']}
];
const helpers=['말','표정','거리','결과','긴장','분노','불안','수치','판단','의미','원인','평가','장면','기억','반복','비교','실패','미래','관계','성과','위험','통제','예측','두려움','존중','이해','책임','변화','정답','증명','요청','기대','기준','완벽','속도','침묵'];
let seed=420242;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const nodes=[];
clusters.forEach((c,ci)=>{
 for(let i=0;i<20;i++){
  const a=(i/20)*Math.PI*2+rnd()*.35,r=.035+rnd()*.105;
  const word=i<4?c.words[i]:i<10?helpers[ci*6+i-4]:'';
  nodes.push({id:nodes.length,cluster:ci,major:i<4,word,color:c.color,bx:c.x+Math.cos(a)*r,by:c.y+Math.sin(a)*r,phase:rnd()*Math.PI*2,speed:.35+rnd()*.5,size:i<4?2.8:1.25+rnd()*1.6});
 }
});
const edgeSet=new Set(),edges=[];
const addEdge=(a,b,type='inner')=>{if(a===b)return;const k=a<b?`${a}-${b}`:`${b}-${a}`;if(edgeSet.has(k))return;edgeSet.add(k);edges.push({a,b,type,phase:rnd()*Math.PI*2})};
for(let c=0;c<6;c++){const base=c*20;for(let i=0;i<20;i++)addEdge(base+i,base+(i+1)%20);for(let i=0;i<10;i++)addEdge(base+i,base+(i+2)%20)}
for(let i=0;i<30;i++){const a=(i*7)%120,ca=nodes[a].cluster,cb=(ca+1+(i%4))%6,b=cb*20+((i*11+3)%20);addEdge(a,b,'cross')}
for(let i=0;i<12;i++)addEdge(100+i,(i*9+7)%100,'focus');
while(edges.length<222){const a=Math.floor(rnd()*120),b=Math.floor(rnd()*120);addEdge(a,b,'cross')}
const labels=[];
nodes.filter(n=>n.major).forEach((n,i)=>{const el=document.createElement('span');el.className='cfm42-label major '+(n.cluster===5?'rule ':'')+(i%3===0?'mobile-hide':'');el.textContent=n.word;el.style.setProperty('--node-color',n.color);labelLayer.appendChild(el);labels.push({n,el})});
clusters.forEach(c=>{const el=document.createElement('span');el.className='cfm42-caption';el.textContent=c.name;captionLayer.appendChild(el);c.caption=el});
let dpr=1,w=1,h=1,start=0,raf=0,running=false,last=0;
function resize(){const r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);w=Math.max(1,r.width);h=Math.max(1,r.height);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
function point(n,t,settle=0){const amp=(1-settle)*(n.major?5:9);return{x:n.bx*w+Math.cos(t*n.speed+n.phase)*amp,y:n.by*h+Math.sin(t*(n.speed*.83)+n.phase)*amp}}
function draw(now){if(!running)return;const t=(now-start)/1000,reveal=clamp(t/2.05,0,1),rule=clamp((t-3.5)/1.5,0,1),settle=clamp((t-7.35)/1.2,0,1);if(now-last<28){raf=requestAnimationFrame(draw);return}last=now;ctx.clearRect(0,0,w,h);
 clusters.forEach(c=>{const gx=c.x*w,gy=c.y*h,rad=Math.min(w,h)*.18,gr=ctx.createRadialGradient(gx,gy,0,gx,gy,rad);gr.addColorStop(0,c.color+'18');gr.addColorStop(1,c.color+'00');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(gx,gy,rad,0,Math.PI*2);ctx.fill()});
 const shownEdges=Math.floor(edges.length*reveal);for(let i=0;i<shownEdges;i++){const e=edges[i],a=point(nodes[e.a],t,settle),b=point(nodes[e.b],t,settle),focus=e.type==='focus';ctx.beginPath();ctx.moveTo(a.x,a.y);const mx=(a.x+b.x)/2+(Math.sin(e.phase)*12),my=(a.y+b.y)/2+(Math.cos(e.phase)*12);ctx.quadraticCurveTo(mx,my,b.x,b.y);let alpha=e.type==='inner'?.12:e.type==='cross'?.075:.12;if(rule>0){const touchesRule=nodes[e.a].cluster===5||nodes[e.b].cluster===5;alpha=touchesRule?.10+.24*rule:.06*(1-rule)}if(settle>0)alpha*=1-settle*.7;ctx.strokeStyle=focus?`rgba(220,255,69,${alpha+.12*rule})`:`rgba(172,190,194,${alpha})`;ctx.lineWidth=focus?1.15:.7;ctx.stroke()}
 const shownNodes=Math.floor(nodes.length*reveal);for(let i=0;i<shownNodes;i++){const n=nodes[i],p=point(n,t,settle),isRule=n.cluster===5;let alpha=n.major?.86:.32;if(rule>0)alpha=isRule?.72+.25*rule:.28*(1-rule)+.05;if(settle>0)alpha*=1-settle*.65;ctx.fillStyle=n.color;ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(p.x,p.y,n.size+(isRule?rule*.7:0),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;if(n.major||isRule&&i%3===0){ctx.strokeStyle=n.color+'33';ctx.beginPath();ctx.arc(p.x,p.y,n.size+5+Math.sin(t+n.phase)*2,0,Math.PI*2);ctx.stroke()}}
 labels.forEach(({n,el},i)=>{const p=point(n,t,settle);el.style.left=p.x+'px';el.style.top=p.y+'px';el.classList.toggle('visible',i<Math.floor(labels.length*reveal));el.classList.toggle('dim',rule>.3&&n.cluster!==5);el.classList.toggle('focus',rule>.45&&n.cluster===5)});clusters.forEach(c=>{c.caption.style.left=c.x*w+'px';c.caption.style.top=(c.y*h-72)+'px';c.caption.classList.toggle('visible',reveal>.45)});
 nodeCountEl.textContent=shownNodes;edgeCountEl.textContent=shownEdges;if(t>3.6)wrap.classList.add('rule-phase');if(t>8.05)wrap.classList.add('complete');if(t<9.7)raf=requestAnimationFrame(draw);else running=false}
function play(){cancelAnimationFrame(raf);wrap.classList.remove('complete','rule-phase','play');void wrap.offsetWidth;wrap.classList.add('play');resize();start=performance.now();last=0;running=true;raf=requestAnimationFrame(draw)}
function final(){cancelAnimationFrame(raf);running=false;wrap.classList.remove('play','rule-phase');wrap.classList.add('complete');resize();start=performance.now()-9000;running=true;draw(performance.now());running=false;nodeCountEl.textContent='120';edgeCountEl.textContent='222'}
q('#cfm42Skip').addEventListener('click',final);q('#cfm42Replay').addEventListener('click',play);q('#cfm42Self').addEventListener('click',()=>q('#startSelf')?.click());q('#cfm42Live').addEventListener('click',()=>q('#startProfessional')?.click());addEventListener('resize',()=>{resize();if(!running)final()},{passive:true});
const snap=new URLSearchParams(location.search).get('snapshot');if(reduced||snap==='final')setTimeout(final,80);else if(snap==='rule'){setTimeout(()=>{play();setTimeout(()=>{cancelAnimationFrame(raf);running=false;wrap.classList.add('rule-phase')},4200)},80)}else setTimeout(play,160);
})();