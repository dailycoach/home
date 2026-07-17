(() => {
  'use strict';
  const DATA=window.DISC16_YOUTH_DATA;
  const {TYPES,COLORS,COPY,DISPLAY,QUESTIONS,PROFILES,PAIRS}=DATA;
  const STORAGE_KEY='disc16:youth:answers:v2';
  const $=(s)=>document.querySelector(s);
  const start=$('#start'),test=$('#test'),result=$('#result'),startBtn=$('#startBtn');
  let timer=null,answers=load();
  let current=findResumeIndex();

  function load(){try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(value)?value.slice(0,QUESTIONS.length).map(a=>Array.isArray(a)?[...new Set(a.filter(t=>TYPES.includes(t)))].slice(0,4):[]):[]}catch{return[]}}
  function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(answers))}
  function cancel(){if(timer){clearTimeout(timer);timer=null}}
  function complete(){return answers.length===QUESTIONS.length&&answers.every(a=>Array.isArray(a)&&a.length===4)}
  function clamp(v){return Math.max(0,Math.min(10,v))}
  function findResumeIndex(){const index=QUESTIONS.findIndex((_,i)=>(answers[i]||[]).length<4);return index<0?0:index}
  function answeredCount(){return answers.filter(a=>Array.isArray(a)&&a.length===4).length}

  function openTest(){current=findResumeIndex();start.classList.add('hidden');test.classList.remove('hidden');renderQuestion();scrollTo(0,0)}
  function renderQuestion(){
    const q=QUESTIONS[current],order=answers[current]||[];
    $('#progressText').textContent=`${current+1} / ${QUESTIONS.length} · ${order.length}/4 선택`;
    $('#progressBar').style.width=`${((current+1)/QUESTIONS.length)*100}%`;
    $('#sceneText').textContent=q.scene;
    const box=$('#options');box.innerHTML='';
    DISPLAY[current].forEach(index=>{
      const [type,label]=q.choices[index],rank=order.includes(type)?order.indexOf(type)+1:0;
      const b=document.createElement('button');b.type='button';b.className=`option${rank?' selected':''}`;
      if(rank)b.dataset.rank=String(rank);
      b.setAttribute('aria-pressed',rank?'true':'false');
      b.setAttribute('aria-label',rank?`${label}, ${rank}순위로 선택됨`:label);
      b.innerHTML=`${label}${rank?`<span class="rank" aria-hidden="true">${rank}</span>`:''}`;
      b.addEventListener('click',()=>pick(type));box.appendChild(b);
    });
    $('#prevBtn').disabled=current===0;
    $('#resetBtn').disabled=order.length===0;
  }

  function pick(type){
    cancel();let order=[...(answers[current]||[])],at=order.indexOf(type);
    if(at>=0)order=order.slice(0,at);else if(order.length<4)order.push(type);
    answers[current]=order;save();renderQuestion();
    if(order.length===4)timer=setTimeout(()=>{timer=null;if(current<QUESTIONS.length-1){current+=1;renderQuestion();scrollTo(0,0)}else showResult()},700);
  }

  function calculate(){
    const scores={D:0,I:0,S:0,C:0};answers.forEach(order=>order.forEach((type,rank)=>{scores[type]+=4-rank}));
    const sorted=TYPES.map(type=>[type,scores[type]]).sort((a,b)=>b[1]-a[1]||TYPES.indexOf(a[0])-TYPES.indexOf(b[0]));
    const [first,second,third,fourth]=sorted.map(([type])=>type),gap=sorted[0][1]-sorted[1][1];
    const code=gap>=8?first:first+second,pair=PAIRS[first+second];
    const scale=Object.fromEntries(TYPES.map(type=>[type,((scores[type]-16)/48)*10]));
    const axisMax=64;
    const x=clamp(5+5*((scores.D+scores.I)-(scores.S+scores.C))/axisMax);
    const y=clamp(5+5*((scores.D+scores.C)-(scores.I+scores.S))/axisMax);
    return{scores,sorted,first,second,third,fourth,code,pair,scale,x,y,gap};
  }

  function showResult(){
    cancel();if(!complete())return;test.classList.add('hidden');result.classList.remove('hidden');
    $('#progressText').textContent='결과';$('#progressBar').style.width='100%';
    const r=calculate(),{sorted,first,second,third,fourth,code,pair,scale,x,y}=r,primary=PROFILES[first];
    const headline=code.length===1?{name:`${primary.title}`,summary:primary.core}:pair;
    result.style.setProperty('--mainColor',COLORS[first]);result.style.setProperty('--subColor',COLORS[second]);result.style.setProperty('--tone1',`${COLORS[first]}25`);result.style.setProperty('--tone2',`${COLORS[second]}15`);result.style.setProperty('--glow',`${COLORS[first]}30`);
    const codeHtml=code.length===2?`<span class="main">${code[0]}</span><span class="sub">${code[1]}</span>`:`<span class="main">${code}</span>`;
    const thirdRole={D:'필요할 때 내 입장을 더 분명히 하는 힘',I:'관계가 굳을 때 다시 말을 걸고 연결하는 힘',S:'감정이 커질 때 기다리고 안정시키는 힘',C:'혼란스러울 때 사실과 기준을 확인하는 힘'}[third];
    result.innerHTML=`
      <div class="result-head"><div class="type-code">${codeHtml}</div><div class="type-name">${headline.name}</div><p class="lead">${headline.summary}</p></div>
      <div class="rank-three">${rankCard(1,'가장 익숙한 반응',first,primary.tagline)}${rankCard(2,'반응을 조절하는 힘',second,PROFILES[second].tagline)}${rankCard(3,'필요할 때 꺼내는 힘',third,thirdRole)}</div>
      <div class="section"><h2>나의 관계 반응을 한 문장으로 보면</h2><div class="summary-box"><p><b>${first} 성향</b>이 행동의 출발점을 만들고, <b>${second} 성향</b>이 표현방식을 조절합니다. ${pair.summary}</p><p>3순위인 <b>${third} 성향</b>은 ${thirdRole}입니다. 상대적으로 낮은 ${fourth} 성향은 부족함이 아니라 아직 덜 익숙한 행동입니다.</p></div></div>
      <div class="section"><h2>집에서 나타나는 모습</h2><div class="scene"><strong>${first} 성향의 기본 반응</strong>${primary.family}</div><div class="scene"><strong>${first}${second} 조합으로 보면</strong>${pair.family}</div></div>
      <div class="section"><h2>친구 사이에서 나타나는 모습</h2><div class="scene"><strong>${first} 성향의 기본 반응</strong>${primary.peers}</div><div class="scene"><strong>${first}${second} 조합으로 보면</strong>${pair.peers}</div><div class="scene"><strong>또래집단에서 맡기 쉬운 역할</strong>${pair.groupRole}</div></div>
      <div class="section"><h2>행동에너지 분포</h2><div class="score-list">${TYPES.map(t=>scoreRow(t,scale[t])).join('')}</div><canvas id="map" width="700" height="700" style="width:100%;aspect-ratio:1/1;border-radius:17px;background:#101725;margin-top:18px"></canvas><span class="pill">1순위 ${first}</span><span class="pill">2순위 ${second}</span><span class="pill">3순위 ${third}</span></div>
      <div class="section"><h2>갈등과 압박을 받을 때</h2><div class="two-grid"><div class="tip"><strong>기본 갈등반응</strong>${primary.conflict}</div><div class="tip"><strong>압박이 커지면</strong>${pair.pressure}</div><div class="tip"><strong>강점이 과해질 때</strong>${primary.overuse}</div><div class="tip"><strong>두 성향의 충돌</strong>${pair.tension}</div></div></div>
      <div class="section"><h2>가족과 친구가 알아두면 좋은 점</h2><div class="two-grid"><div class="tip"><strong>가족에게 바라는 대화</strong>${primary.$parent}</div><div class="tip"><strong>친구에게 바라는 대화</strong>${primary.$friend}</div><div class="tip"><strong>나에게 필요한 관계조건</strong>${pair.needs}</div><div class="tip"><strong>이번에 연습할 행동</strong>${pair.growth}</div></div></div>
      <div class="section"><h2>네 성향 자세히 보기</h2><div class="two-grid">${sorted.map(([t],i)=>profileCard(t,i+1,scale[t])).join('')}</div></div>
      <div class="section"><h2>나를 이해하는 질문</h2><div class="question-list">${questions(primary,pair,third).map((q,i)=>`<div class="coach-q"><span>0${i+1}</span><p>${q}</p></div>`).join('')}</div></div>
      <button class="ghost" id="printBtn" type="button" style="margin-top:28px">결과 인쇄하기</button><button class="ghost" id="again" type="button" style="margin-top:10px">다시 검사하기</button>
      <p class="notice">이 결과는 누가 더 좋은지를 평가하지 않습니다. 집과 친구 사이에서 내가 자주 사용하는 반응을 이해하고 새로운 선택을 찾기 위한 자료입니다.</p>`;
    drawMap(x,y,first,second,third);
    $('#printBtn').addEventListener('click',()=>window.print());$('#again').addEventListener('click',()=>{if(confirm('저장된 응답을 지우고 처음부터 다시 검사할까요?')){localStorage.removeItem(STORAGE_KEY);location.reload()}});scrollTo(0,0);
  }

  const rankCard=(rank,role,type,text)=>`<div class="rank-card" style="--rankColor:${COLORS[type]}"><small>${rank}순위 · ${role}</small><strong>${type} ${PROFILES[type].name}</strong><p>${text}</p></div>`;
  const scoreRow=(type,score)=>`<div class="score-row"><div class="score-label" style="color:${COLORS[type]}">${type}</div><div><div class="score-copy">${COPY[type]}</div><div class="track"><div class="fill" style="width:${score*10}%;background:${COLORS[type]}"></div></div></div><div class="score-value">${score.toFixed(1)}</div></div>`;
  function profileCard(type,rank,score){const p=PROFILES[type];return`<article class="detail-card" style="--cardColor:${COLORS[type]}"><small style="color:${COLORS[type]};font-weight:800">${rank}순위 · ${type} ${p.name} · ${score.toFixed(1)}</small><h3>${p.title}</h3><dl><dt>중심 욕구</dt><dd>${p.motivation}</dd><dt>집에서</dt><dd>${p.family}</dd><dt>친구 사이에서</dt><dd>${p.peers}</dd><dt>말하는 방식</dt><dd>${p.communication}</dd><dt>성장 방향</dt><dd>${p.growth}</dd></dl></article>`}
  const questions=(p,pair,third)=>[p.coaching,pair.coaching,'가족과 대화할 때 내가 가장 지키고 싶은 것은 무엇인가?','친구 사이에서 괜찮다고 했지만 사실은 불편했던 장면은 언제였나?',`다음 관계에서 ${third} 성향을 10% 더 사용한다면 무엇을 다르게 할 수 있을까?`,'내가 먼저 바꿀 수 있는 가장 작은 행동은 무엇인가?'];

  function drawMap(x,y,first,second,third){const c=$('#map'),g=c.getContext('2d'),w=c.width,h=c.height,p=64,plot=w-p*2;g.clearRect(0,0,w,h);g.fillStyle='#101725';g.fillRect(0,0,w,h);g.strokeStyle='#2a3850';for(let i=0;i<=10;i++){const k=p+plot*i/10;g.beginPath();g.moveTo(k,p);g.lineTo(k,h-p);g.stroke();g.beginPath();g.moveTo(p,k);g.lineTo(w-p,k);g.stroke()}g.strokeStyle='#687895';g.lineWidth=2;g.beginPath();g.moveTo(w/2,p);g.lineTo(w/2,h-p);g.moveTo(p,h/2);g.lineTo(w-p,h/2);g.stroke();g.font='bold 29px sans-serif';g.fillStyle=COLORS.C;g.fillText('C',p+18,p+40);g.fillStyle=COLORS.D;g.fillText('D',w-p-42,p+40);g.fillStyle=COLORS.S;g.fillText('S',p+18,h-p-18);g.fillStyle=COLORS.I;g.fillText('I',w-p-38,h-p-18);const px=p+plot*x/10,py=h-p-plot*y/10;g.globalAlpha=.2;g.fillStyle=COLORS[first];g.beginPath();g.arc(px,py,58,0,Math.PI*2);g.fill();g.globalAlpha=1;[first,second,third].forEach((t,i)=>{g.strokeStyle=COLORS[t];g.lineWidth=5-i;g.beginPath();g.arc(px,py,20-i*5,(Math.PI*2/3)*i,(Math.PI*2/3)*(i+1));g.stroke()});g.fillStyle='#fff';g.beginPath();g.arc(px,py,5,0,Math.PI*2);g.fill()}

  $('#prevBtn').addEventListener('click',()=>{cancel();if(current>0){current-=1;renderQuestion();scrollTo(0,0)}});
  $('#resetBtn').addEventListener('click',()=>{cancel();if((answers[current]||[]).length===0)return;answers[current]=[];save();renderQuestion()});

  if(complete()){
    startBtn.textContent='저장된 결과 보기';
    startBtn.addEventListener('click',()=>{start.classList.add('hidden');showResult()},{once:true});
  }else{
    const done=answeredCount();
    if(done>0)startBtn.textContent=`이어서 검사하기 · ${done}/${QUESTIONS.length}`;
    startBtn.addEventListener('click',openTest);
  }
})();