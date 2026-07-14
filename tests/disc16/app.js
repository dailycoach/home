(() => {
  'use strict';

  const D = window.DISC16_DATA;
  const { TYPES, COLORS, COPY, DISPLAY, QUESTIONS, PROFILES, PAIRS, TARGET_NEEDS, SELF_WATCH } = D;
  const STORAGE_KEY = 'disc16:answers:v2';
  const $ = (selector) => document.querySelector(selector);
  const start = $('#start');
  const test = $('#test');
  const result = $('#result');
  const startBtn = $('#startBtn');
  let current = 0;
  let advanceTimer = null;
  let answers = loadAnswers();

  function loadAnswers() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(0, QUESTIONS.length).map((answer) => {
        if (!Array.isArray(answer)) return [];
        return [...new Set(answer.filter((type) => TYPES.includes(type)))].slice(0, 4);
      });
    } catch {
      return [];
    }
  }

  function saveAnswers() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  }

  function cancelAdvance() {
    if (!advanceTimer) return;
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }

  function isComplete() {
    return answers.length === QUESTIONS.length && answers.every((answer) => Array.isArray(answer) && answer.length === 4);
  }

  function openTest() {
    start.classList.add('hidden');
    test.classList.remove('hidden');
    renderQuestion();
  }

  function renderQuestion() {
    const question = QUESTIONS[current];
    const order = answers[current] || [];
    $('#progressText').textContent = `${current + 1} / ${QUESTIONS.length}`;
    $('#progressBar').style.width = `${((current + 1) / QUESTIONS.length) * 100}%`;
    $('#sceneText').textContent = question.scene;

    const options = $('#options');
    options.innerHTML = '';
    DISPLAY[current].forEach((index) => {
      const [type, keyword] = question.choices[index];
      const rank = order.includes(type) ? order.indexOf(type) + 1 : 0;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `option${rank ? ' selected' : ''}`;
      button.setAttribute('aria-pressed', rank ? 'true' : 'false');
      if (rank) button.dataset.rank = String(rank);
      button.innerHTML = `${keyword}${rank ? `<span class="rank" aria-label="${rank}순위">${rank}</span>` : ''}`;
      button.addEventListener('click', () => pick(type));
      options.appendChild(button);
    });
    $('#prevBtn').disabled = current === 0;
  }

  function pick(type) {
    cancelAdvance();
    let order = [...(answers[current] || [])];
    const selectedIndex = order.indexOf(type);
    if (selectedIndex >= 0) order = order.slice(0, selectedIndex);
    else if (order.length < 4) order.push(type);

    answers[current] = order;
    saveAnswers();
    renderQuestion();

    if (order.length === 4) {
      advanceTimer = setTimeout(() => {
        advanceTimer = null;
        if (current < QUESTIONS.length - 1) {
          current += 1;
          renderQuestion();
          window.scrollTo(0, 0);
        } else {
          showResult();
        }
      }, 450);
    }
  }

  const clamp = (value) => Math.max(0, Math.min(10, value));

  function calculateResult() {
    const scores = { D: 0, I: 0, S: 0, C: 0 };
    answers.forEach((order) => order.forEach((type, rank) => { scores[type] += 4 - rank; }));
    const sorted = TYPES.map((type) => [type, scores[type]])
      .sort((a, b) => b[1] - a[1] || TYPES.indexOf(a[0]) - TYPES.indexOf(b[0]));
    const [first, second, third, fourth] = sorted.map(([type]) => type);
    const gap = sorted[0][1] - sorted[1][1];
    const code = gap >= 8 ? first : first + second;
    const pair = PAIRS[first + second];
    const headline = code.length === 1
      ? { name: `${first} ${PROFILES[first].name} 중심형`, summary: PROFILES[first].core }
      : pair;
    const scale = Object.fromEntries(TYPES.map((type) => [
      type,
      ((scores[type] - QUESTIONS.length) / (QUESTIONS.length * 3)) * 10
    ]));
    const axisMax = QUESTIONS.length * 4;
    const x = clamp(5 + (5 * ((scores.D + scores.I) - (scores.S + scores.C))) / axisMax);
    const y = clamp(5 + (5 * ((scores.D + scores.C) - (scores.I + scores.S))) / axisMax);
    const spread = gap >= 14 ? '좁은 분포' : gap >= 6 ? '중간 분포' : '넓은 분포';
    return { sorted, first, second, third, fourth, code, pair, headline, scale, x, y, spread };
  }

  function showResult() {
    cancelAdvance();
    if (!isComplete()) return;
    test.classList.add('hidden');
    result.classList.remove('hidden');
    $('#progressText').textContent = '결과';
    $('#progressBar').style.width = '100%';

    const r = calculateResult();
    const { sorted, first, second, third, fourth, code, pair, headline, scale, x, y, spread } = r;
    const primary = PROFILES[first];

    result.style.setProperty('--mainColor', COLORS[first]);
    result.style.setProperty('--subColor', COLORS[second]);
    result.style.setProperty('--tone1', `${COLORS[first]}20`);
    result.style.setProperty('--tone2', `${COLORS[second]}12`);
    result.style.setProperty('--glow', `${COLORS[first]}30`);

    const codeHtml = code.length === 2
      ? `<span class="main">${code[0]}</span><span class="sub">${code[1]}</span>`
      : `<span class="main">${code}</span>`;
    const roleText = { D:'가장 먼저 방향과 결정을 만듭니다.', I:'가장 먼저 사람의 반응과 가능성을 움직입니다.', S:'가장 먼저 관계의 안정과 지속을 살핍니다.', C:'가장 먼저 기준과 정확성을 확인합니다.' };
    const secondText = { D:'필요할 때 추진력과 결단을 더합니다.', I:'표현과 참여를 통해 주성향의 영향력을 넓힙니다.', S:'관계와 속도를 안정시키며 주성향을 부드럽게 조절합니다.', C:'근거와 점검을 더해 주성향의 완성도를 높입니다.' };
    const thirdText = { D:'상황이 멈출 때 행동으로 전환하는 세 번째 자원입니다.', I:'관계가 굳을 때 표현과 연결을 더하는 세 번째 자원입니다.', S:'긴장과 충돌이 커질 때 안정감을 회복하는 세 번째 자원입니다.', C:'불확실성이 커질 때 기준과 점검을 제공하는 세 번째 자원입니다.' };
    const thirdInsight = `세 번째 성향인 ${third}(${PROFILES[third].name})는 평소 가장 먼저 드러나지는 않지만, ${thirdText[third]} 따라서 당신은 ${first}의 중심 행동에 ${second}의 보조 방식과 ${third}의 조절 자원을 함께 사용하는 사람으로 볼 수 있습니다.`;

    result.innerHTML = `
      <div class="result-head"><div class="type-code">${codeHtml}</div><div class="type-name">${headline.name}</div><p class="lead">${headline.summary}</p></div>
      <div class="interpretation-note"><b>이 결과를 읽는 기준</b><p>DISC는 사람을 네 종류로 고정하는 진단이 아닙니다. 현재의 관계와 환경에서 상대적으로 익숙하게 사용하는 행동의 순서를 보여줍니다. 모든 성향에는 강점과 과도사용이 함께 있으며, 상황과 역할에 따라 다른 성향을 사용할 수 있습니다.</p></div>
      <div class="rank-three">${rankCard(1,'중심 성향',first,roleText[first])}${rankCard(2,'보조 성향',second,secondText[second])}${rankCard(3,'조절 성향',third,thirdText[third])}</div>
      <div class="section"><h2>세 가지 성향 종합분석</h2><div class="summary-box"><p><b>${first}가 행동의 출발점을 만듭니다.</b> ${primary.core}</p><p><b>${second}가 그 행동의 방식을 조절합니다.</b> ${PROFILES[second].tagline}이 더해져 ${pair.name}의 모습이 나타납니다.</p><p><b>${third}는 상황 대응의 세 번째 자원입니다.</b> ${thirdInsight}</p><p><b>상대적으로 낮은 ${fourth} 성향</b>은 약점이 아닙니다. 다만 ${PROFILES[fourth].tagline}을 의식적으로 요청하거나 연습해야 할 가능성이 있습니다.</p></div></div>
      <div class="section"><h2>1순위 성향 심층 해설</h2><div class="deep-grid">${deepCard('행동을 움직이는 동기',primary.motivation)}${deepCard('마음속에서 피하고 싶은 것',primary.fear)}${deepCard('잘 작동하는 환경',primary.preferred)}${deepCard('일할 때 나타나는 모습',primary.work)}${deepCard('가까운 관계에서',primary.relationship)}${deepCard('대화하는 방식',primary.communication)}${deepCard('갈등을 만났을 때',primary.conflict)}${deepCard('강점이 과해지는 순간',primary.overuse)}</div><div class="coaching-focus"><b>이 성향의 핵심 코칭질문</b><p>${primary.coaching}</p></div></div>
      <div class="section"><h2>1·2순위 조합의 작동 방식</h2><div class="pair-panel" style="--pairColor:${COLORS[first]}"><div class="pair-title"><span>${first}${second}</span><div><b>${pair.name}</b><p>${pair.summary}</p></div></div><div class="deep-grid pair-grid">${deepCard('관계와 조직에 주는 기여',pair.contribution)}${deepCard('이 조합이 원하는 것',pair.motivation)}${deepCard('두 성향이 충돌하는 지점',pair.tension)}${deepCard('대화와 설득 방식',pair.communication)}${deepCard('편안하게 작동하는 조건',pair.needs)}${deepCard('압박받을 때',pair.pressure)}</div><div class="meaning next"><b>이 조합의 성장선택</b>${pair.growth}</div><div class="coaching-focus"><b>조합형 코칭질문</b><p>${pair.coaching}</p></div></div></div>
      <div class="section"><h2>행동에너지 분포</h2><div class="score-list">${TYPES.map((type)=>scoreRow(type,scale[type])).join('')}</div><div class="map-wrap"><div class="axis-note vertical">과제와 성과를 우선하는 방향 ↑</div><canvas id="map" width="700" height="700"></canvas><div class="axis-note"><span>← 신중하게 살핌</span><span>빠르게 표현함 →</span></div><div class="axis-note vertical">↓ 관계와 안정을 우선하는 방향</div></div><span class="pill">1순위 ${first}</span><span class="pill">2순위 ${second}</span><span class="pill">3순위 ${third}</span><span class="pill">${spread}</span></div>
      <div class="section"><h2>관계 장면에서 나타나는 모습</h2><div class="scene"><strong>회의와 협업에서</strong>${pair.meeting}</div><div class="scene"><strong>가까운 관계에서</strong>${pair.close}</div><div class="scene"><strong>압박을 받을 때</strong>${pair.pressure}</div></div>
      <div class="section"><h2>좋은 의도와 새로운 선택</h2><div class="meaning-grid"><div class="meaning intent"><b>당신이 지키려는 것</b>${primary.tagline}을 통해 상황과 관계에 기여하려 합니다.</div><div class="meaning other"><b>상대가 다르게 경험할 수 있는 것</b>${primary.seen}</div><div class="meaning next"><b>이번 관계에서 시도할 것</b>${pair.growth}</div></div></div>
      <div class="section"><h2>네 성향의 특징과 대인관계 교류</h2><div class="trait-grid">${sorted.map(([type],index)=>traitCard(type,index+1,scale[type])).join('')}</div></div>
      <div class="section"><h2>다른 성향과 교류할 때</h2><div class="interaction-list">${TYPES.map((type)=>interactionCard(first,type)).join('')}</div></div>
      <div class="section"><h2>코칭질문</h2><div class="question-list">${coachingQuestions(primary,pair).map((question,index)=>`<div class="coach-q"><span>0${index+1}</span><p>${question}</p></div>`).join('')}</div></div>
      <button class="ghost" id="printBtn" type="button" style="margin-top:28px">결과 인쇄하기</button><button class="ghost" id="again" type="button" style="margin-top:10px">다시 검사하기</button>
      <p class="notice">각 점수는 능력이나 우수성을 뜻하지 않습니다. 네 행동 중 상대적으로 더 익숙하게 사용하는 순서를 보여줍니다. 본 결과는 진단이나 채용판정이 아닌 자기이해와 코칭대화를 위한 참고자료입니다.</p>`;

    drawMap(x,y,spread,first,second,third);
    $('#printBtn').addEventListener('click',()=>window.print());
    $('#again').addEventListener('click',()=>{localStorage.removeItem(STORAGE_KEY);window.location.reload();});
    window.scrollTo(0,0);
  }

  const rankCard = (rank,role,type,text) => `<div class="rank-card" style="--rankColor:${COLORS[type]}"><small>${rank}순위 · ${role}</small><strong>${type} ${PROFILES[type].name}</strong><p>${text}</p></div>`;
  const scoreRow = (type,score) => `<div class="score-row"><div class="score-label" style="color:${COLORS[type]}">${type}</div><div><div class="score-copy">${COPY[type]}</div><div class="track"><div class="fill" style="width:${score*10}%;background:${COLORS[type]}"></div></div></div><div class="score-value">${score.toFixed(1)}</div></div>`;
  const deepCard = (title,text) => `<article class="deep-card"><h3>${title}</h3><p>${text}</p></article>`;

  function traitCard(type,rank,score){
    const p=PROFILES[type];
    return `<article class="trait-card" style="--traitColor:${COLORS[type]}"><span class="score-tag">${rank}순위 · ${type} ${p.name} · ${score.toFixed(1)}</span><h3>${p.tagline}</h3><dl><dt>행동의 동기</dt><dd>${p.motivation}</dd><dt>두려움과 민감지점</dt><dd>${p.fear}</dd><dt>선호환경</dt><dd>${p.preferred}</dd><dt>잘 작동할 때</dt><dd>${p.strength}</dd><dt>업무장면</dt><dd>${p.work}</dd><dt>대인관계</dt><dd>${p.relationship}</dd><dt>의사소통</dt><dd>${p.communication}</dd><dt>갈등반응</dt><dd>${p.conflict}</dd><dt>강점의 남용</dt><dd>${p.overuse}</dd><dt>편안한 교류 조건</dt><dd>${p.needs}</dd><dt>성장 방향</dt><dd>${p.growth}</dd></dl></article>`;
  }

  const interactionCard = (primary,target) => `<div class="interaction" style="--targetColor:${COLORS[target]}"><strong>${target} ${PROFILES[target].name}과 대화할 때</strong><p><b>상대에게 필요한 것:</b> ${TARGET_NEEDS[target]}</p><p><b>내가 주의할 것:</b> ${SELF_WATCH[primary][target]}</p></div>`;

  const coachingQuestions = (profile,pair) => [
    profile.coaching,
    pair.coaching,
    '최근 내 강점이 상대에게는 부담으로 경험된 장면은 언제였습니까?',
    '그 장면에서 내가 지키고 싶었던 욕구와 상대가 지키고 싶었던 욕구는 각각 무엇이었습니까?',
    '내가 두려워한 상황 때문에 행동이 더 강해지거나 작아진 순간은 언제였습니까?',
    '3순위 성향을 조금 더 사용했다면 관계가 어떻게 달라졌을까요?',
    '다음 관계에서 한 가지 행동을 10% 다르게 한다면 무엇을 선택하겠습니까?'
  ];

  function drawMap(x,y,spread,first,second,third){
    const canvas=$('#map'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,p=64,plot=w-p*2;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#10161e';ctx.fillRect(0,0,w,h);
    [['C',p,p,COLORS.C],['D',w/2,p,COLORS.D],['S',p,h/2,COLORS.S],['I',w/2,h/2,COLORS.I]].forEach(([,left,top,color])=>{ctx.globalAlpha=.055;ctx.fillStyle=color;ctx.fillRect(left,top,plot/2,plot/2);ctx.globalAlpha=1;});
    ctx.strokeStyle='#273140';ctx.lineWidth=1;for(let i=0;i<=10;i+=1){const pos=p+plot*i/10;ctx.beginPath();ctx.moveTo(pos,p);ctx.lineTo(pos,h-p);ctx.stroke();ctx.beginPath();ctx.moveTo(p,pos);ctx.lineTo(w-p,pos);ctx.stroke();}
    ctx.strokeStyle='#7f6c45';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w/2,p);ctx.lineTo(w/2,h-p);ctx.moveTo(p,h/2);ctx.lineTo(w-p,h/2);ctx.stroke();
    ctx.font='bold 29px sans-serif';ctx.fillStyle=COLORS.C;ctx.fillText('C',p+18,p+40);ctx.fillStyle=COLORS.D;ctx.fillText('D',w-p-42,p+40);ctx.fillStyle=COLORS.S;ctx.fillText('S',p+18,h-p-18);ctx.fillStyle=COLORS.I;ctx.fillText('I',w-p-38,h-p-18);
    const px=p+plot*x/10,py=h-p-plot*y/10,r=spread==='넓은 분포'?72:spread==='중간 분포'?50:34;
    ctx.globalAlpha=.2;ctx.fillStyle=COLORS[first];ctx.beginPath();ctx.ellipse(px,py,r*1.35,r*.78,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    [first,second,third].forEach((type,index)=>{ctx.strokeStyle=COLORS[type];ctx.lineWidth=5-index;ctx.beginPath();ctx.arc(px,py,20-index*5,(Math.PI*2/3)*index,(Math.PI*2/3)*(index+1));ctx.stroke();});ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();
  }

  $('#prevBtn').addEventListener('click',()=>{cancelAdvance();if(current>0){current-=1;renderQuestion();window.scrollTo(0,0);}});
  $('#resetBtn').addEventListener('click',()=>{cancelAdvance();answers[current]=[];saveAnswers();renderQuestion();});
  if(isComplete()){
    startBtn.textContent='저장된 결과 이어보기';
    startBtn.addEventListener('click',()=>{start.classList.add('hidden');showResult();},{once:true});
  }else startBtn.addEventListener('click',openTest);
})();
