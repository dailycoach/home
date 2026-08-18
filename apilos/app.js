(()=>{
  if(!document.querySelector('link[href="/apilos/qa.css"]')){
    const l=document.createElement('link');l.rel='stylesheet';l.href='/apilos/qa.css';document.head.appendChild(l);
  }
  document.documentElement.style.setProperty('--ycc-logo',"url('/apilos/assets/ycc-logo.webp')");

  const btn=document.querySelector('[data-menu-button]'),nav=document.querySelector('[data-mobile-nav]');
  if(btn&&nav){
    const setOpen=open=>{btn.setAttribute('aria-expanded',String(open));btn.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');nav.hidden=!open;btn.textContent=open?'×':'☰';};
    btn.addEventListener('click',()=>setOpen(btn.getAttribute('aria-expanded')!=='true'));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&btn.getAttribute('aria-expanded')==='true'){setOpen(false);btn.focus();}});
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
    window.addEventListener('resize',()=>{if(window.innerWidth>840&&btn.getAttribute('aria-expanded')==='true')setOpen(false);});
  }
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
  document.querySelectorAll('.portal-nav a[href="/apilos/programs/"]').forEach(a=>a.textContent='전문사업');
  document.querySelectorAll('.portal-mobile-nav a[href="/apilos/programs/"] span:first-child').forEach(s=>s.textContent='전문사업');

  const evidence={
    '/apilos/programs/professional-academy/':{
      kicker:'EVIDENCE / PROFESSIONAL ACADEMY',title:'과정명이 아니라, <em>교육의 축적</em>이 보이게.',desc:'공식 교육과정, 현장사진, 교재·커리큘럼 기록을 한 화면에서 연결합니다.',visual:'stack',
      media:[['/apilos/assets/career-camp.webp','진로성장캠프 · 교육현장'],['/apilos/assets/iin-classroom.webp','참여형 교실수업'],['/apilos/assets/stress-lecture.webp','코칭 특강 현장']],
      sources:[
        ['SVU','UNIVERSITY OFFICIAL','2023 메타인지 자기주도학습코치 양성과정','10회기 · 20시간','https://edu.svu.ac.kr/educate/special.php?category=&code=special&idx=413&ptype=view'],
        ['SVU','UNIVERSITY OFFICIAL','2024 메타인지 자기주도학습코치 양성과정','8회기 · 20시간','https://edu.svu.ac.kr/educate/special.php?category=&code=special&idx=440&ptype=view'],
        ['BLOG','OFFICIAL BLOG RSS','제4기 통합상담코칭전문가 양성과정','대면 + 비대면 2 Track · 4강좌','https://blog.naver.com/apilos/224351456999']
      ],
      timeline:[['2013','CURRICULUM IP','아동·청소년 학습코칭 통합교재'],['2023','OFFICIAL COURSE','10회기 · 20시간'],['2024','OFFICIAL COURSE','8회기 · 20시간'],['2026','4TH COHORT','통합상담코칭전문가 양성과정']]
    },
    '/apilos/programs/youth-family-school/':{
      kicker:'EVIDENCE / YOUTH · FAMILY · SCHOOL',title:'청소년을 둘러싼 <em>실제 장면</em>을 모읍니다.',desc:'진로·학습·정서·가족·학교를 나눠 설명하지 않고 연구와 현장기록을 한 흐름으로 보여줍니다.',visual:'stack',
      media:[['/apilos/assets/career-camp.webp','AI시대 진로성장캠프'],['/apilos/assets/iin-living-lab.webp','청소년 리빙랩'],['/apilos/assets/woosung-living-lab.webp','참여형 혁신수업']],
      sources:[
        ['KCI','ACADEMIC','학교폭력예방을 위한 융합적 상담프로그램','2018 학술기록','https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART002375018'],
        ['FIELD','CENTER ARCHIVE','청소년·학교 현장 아카이브','캠프 · 리빙랩 · 참여수업','/apilos/archive/'],
        ['PROFILE','PUBLIC PROFILE','청소년 상담·코칭 공개이력','진로 · 학습 · 다문화','https://www.yes24.com/product/author/444667']
      ],
      timeline:[['1997','PUBLIC PROFILE','청소년 상담·코칭 시작 이력'],['2018','KCI','학교폭력 예방 × 융합상담'],['2026','FIELD','진로성장캠프 · 리빙랩'],['NOW','CORE FIELD','청소년·가족·학교 축']]
    },
    '/apilos/programs/pastoral-coaching/':{
      kicker:'EVIDENCE / PASTORAL · CHRISTIAN',title:'목회와 코칭의 <em>접점</em>을 분명하게.',desc:'확인되지 않은 사진이나 운영정보를 만들지 않고, 검증 가능한 전문영역과 제공 원문을 구분해 보여줍니다.',visual:'type',words:'목회 × 코칭 × 상담 × 다음세대',typeDesc:'신앙의 맥락을 지우지 않으면서 경청·질문·관계·성찰의 전문성을 더하는 독립 영역입니다.',
      sources:[
        ['SOURCE','USER-SUPPLIED PAGE','목회코칭전문과정 관련 제공 페이지','회차·기간·발급조건은 원문 추가확인','http://hdts.or.kr/sub6_1.html#intro'],
        ['PQI','PUBLIC QUALIFICATION','한국전문상담학회 · 기독교상담사','등록번호 2014-5725','https://www.pqi.or.kr/inf/qul/infQulBasDetail.do?qulId=14508'],
        ['STU','FIELD REFERENCE','서울신학대학교 목회코칭전문과정 모집기록','동일과정 주장 아님 · 분야 참고','https://pnuaa.net/ht_ml/w_06ed/6000.php?bbsid=notice&cafeid=&category=&keyfield=&keyword=&pageno=16&pagetype=&qstr=&ref_code=']
      ],
      timeline:[['2014','PQI','기독교상담 전문자격 영역'],['2017','FIELD REFERENCE','목회코칭 독립과정명 공개기록'],['VERIFY','SOURCE CHECK','세부 운영원문 추가확인'],['NOW','CORE FIELD','목회·기독교 코칭 축']]
    },
    '/apilos/programs/professional-network/':{
      kicker:'EVIDENCE / PROFESSIONAL NETWORK',title:'소속 나열이 아니라 <em>연결 구조</em>를 보여줍니다.',desc:'학회·임상·안전·학교폭력·발달·교육기관을 하나의 네트워크 캔버스로 시각화합니다.',visual:'network',nodes:['한국전문상담학회','임상감독','안전 · 생명안전','언어 · 심리운동','학교폭력상담','대학 · 교육기관'],
      sources:[
        ['PQI','PUBLIC QUALIFICATION','한국전문상담학회 자격발급기관 기록','기독교상담사 2014-5725','https://www.pqi.or.kr/inf/qul/infQulBasDetail.do?qulId=14508'],
        ['PROFILE','PUBLIC PROFILE','임상감독 및 전문기관 활동 이력','현재 재임은 별도 확인','https://www.yes24.com/product/author/444667'],
        ['KCI','ACADEMIC','학교폭력예방 × 융합상담 연구','안전·상담·학교 현장 연결','https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART002375018']
      ],
      timeline:[['2014','PQI','등록자격 영역 확인'],['PROFILE','PROFESSIONAL ACTIVITY','임상감독·전문기관 활동 공개이력'],['NETWORK','CONSILIENCE','안전·발달·학교폭력·교육 연결'],['CHECK','CURRENT STATUS','현재 관계는 기관별 분리표기']]
    },
    '/apilos/programs/social-impact/':{
      kicker:'EVIDENCE / SOCIAL IMPACT',title:'전문성이 <em>사회와 만나는 지점</em>.',desc:'해피피플 자체사업과 곽동현 원장의 전문활동 이력을 분리해 보여주며 글로벌미래교육원 직접사업과 혼동하지 않게 구성합니다.',visual:'type',words:'NGO × CSR × 안전 × 청소년 × 지역사회 × 국제구호',typeDesc:'사회공헌은 개인상담의 확장이 아니라 교육·복지·예방·지역사회가 만나는 별도의 공익축입니다.',
      sources:[
        ['BLOG','OFFICIAL BLOG RSS','해피피플 대전지부 × KB캐피탈 자립준비청년 지원','행복드림센터 · 자격증 취득 지원','https://blog.naver.com/apilos/224339731348'],
        ['PROFILE','PUBLIC PROFILE','해피피플 행복드림센터장 기재 이력','현재 재임은 별도 확인','https://www.yes24.com/product/author/444667'],
        ['NGO','ORGANIZATION CURRENT','해피피플 단체 공익활동 정보','기관 자체 사업과 역할 구분','https://together.kakao.com/fundraisings/teams/3085']
      ],
      timeline:[['PROFILE','ROLE RECORD','행복드림센터장 공개이력'],['2018','KCI','학교폭력 예방 · 안전문화 연결'],['2026','RSS RECORD','자립준비청년 자격증 취득 지원'],['CHECK','CURRENT RELATION','직책·협력관계 최신 확인 유지']]
    },
    '/apilos/programs/research-publication/':{
      kicker:'EVIDENCE / KNOWLEDGE & PUBLIC IMPACT',title:'현장이 <em>지식 자산</em>으로 남는 과정.',desc:'연구·저서·교재·미디어를 하나의 지식생산 사이클로 보여줍니다.',visual:'book',book:'/apilos/assets/sachungi-coaching-psychology-cover.webp',words:'연구 → 저서 → 교재 → 미디어 → 다시 현장',typeDesc:'실무 경험을 구조화해 다음 현장으로 다시 돌려보내는 지식순환입니다.',
      sources:[
        ['KCI','ACADEMIC','학교폭력예방 × 융합상담 연구','2018 KCI 기록','https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART002375018'],
        ['BOOK','PUBLICATION','사춘기 자녀 코칭 심리학','2023 · SISO','/apilos/books/sachungi-coaching-psychology/'],
        ['RSS','LIVE MEDIA','한국심리상담뉴스 관련 최신 기록','네이버 공식 RSS 자동수집','/apilos/news/']
      ],
      timeline:[['2013','CURRICULUM','학습코칭 통합교재 기록'],['2018','KCI','융합상담 연구'],['2023','BOOK','사춘기 자녀 코칭 심리학'],['2026','MEDIA','한국심리상담뉴스 창간 기록']]
    }
  };

  const cfg=evidence[location.pathname];
  if(!cfg)return;
  if(!document.querySelector('link[href="/apilos/evidence.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/apilos/evidence.css';document.head.appendChild(l);}
  const external=u=>!u.startsWith('/');
  const sourceHTML=cfg.sources.map(s=>`<a class="evidence-source" href="${s[4]}"${external(s[4])?' target="_blank" rel="noopener noreferrer"':''}><span class="evidence-source-mark">${s[0]}</span><span class="evidence-source-copy"><small>${s[1]}</small><strong>${s[2]}</strong><span>${s[3]}</span></span><span class="evidence-source-arrow" aria-hidden="true">↗</span></a>`).join('');
  const timelineHTML=cfg.timeline.map(t=>`<div class="evidence-timeline-item"><small>${t[0]}</small><strong>${t[1]}</strong><span>${t[2]}</span></div>`).join('');
  let visual='';
  if(cfg.visual==='stack') visual=`<div class="evidence-media"><div class="evidence-media-stack">${cfg.media.map(m=>`<figure><img src="${m[0]}" alt="${m[1]}" loading="lazy" decoding="async"><figcaption>${m[1]}</figcaption></figure>`).join('')}</div></div>`;
  if(cfg.visual==='type') visual=`<div class="evidence-typeboard"><small>CONNECTED FIELD</small><strong>${cfg.words}</strong><p>${cfg.typeDesc}</p></div>`;
  if(cfg.visual==='network') visual=`<div class="evidence-network-visual"><div class="evidence-network-core">융합 · 통섭<br>전문성</div>${cfg.nodes.map((n,i)=>`<span class="evidence-network-node n${i+1}">${n}</span>`).join('')}</div>`;
  if(cfg.visual==='book') visual=`<div class="evidence-media book"><img class="evidence-book-cover" src="${cfg.book}" alt="사춘기 자녀 코칭 심리학 표지" loading="lazy" decoding="async"><div class="evidence-book-copy"><small>KNOWLEDGE CYCLE</small><strong>${cfg.words}</strong><span>${cfg.typeDesc}</span></div></div>`;
  const section=document.createElement('section');section.className='evidence-board';
  const needsCheck=location.pathname.includes('professional-network')||location.pathname.includes('social-impact')||location.pathname.includes('pastoral-coaching');
  section.innerHTML=`<div class="evidence-board-head"><span class="evidence-board-kicker">${cfg.kicker}</span><div><h2>${cfg.title}</h2><p>${cfg.desc}</p></div></div><div class="evidence-grid">${visual}<div class="evidence-sources">${sourceHTML}<span class="evidence-proof-tag${needsCheck?' check':''}">${needsCheck?'현재 관계·세부운영 추가확인 항목 포함':'공개 근거 확인'}</span></div></div><div class="evidence-timeline">${timelineHTML}</div>`;
  const rail=document.querySelector('.business-proof-rail');
  if(rail)rail.insertAdjacentElement('afterend',section);else document.querySelector('main')?.prepend(section);
})();