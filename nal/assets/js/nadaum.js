(function () {
  "use strict";

  const ROOT = "/nal/class/nadaum-self-management/";
  const ASSETS = "/nal/assets/images/nadaum/";
  const FAITH = "기독교적 관점과 성경·복음을 함께 다룹니다. 신앙 유무와 관계없이 참여할 수 있습니다.";
  const escape = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const money = (value) => Number(value).toLocaleString("ko-KR");
  const arrow = '<span aria-hidden="true">↗</span>';
  const MEETING = "일요일 오전 10–12시";
  const VENUE = "시메진 카페";
  const CAPACITY_NOTE = "정원 20명 · 선착순 모집";
  const phaseDefaults = [
    {id:"criteria",title:"내 선택의 기준을 알아본다",period:"12–2월",question:"나는 누구의 기대와 기준으로 선택해 왔는가?",description:"익숙한 자기 설명을 살피고, 내가 선택할 것과 책임질 것을 구분합니다."},
    {id:"experience",title:"현실에서 나를 알아본다",period:"3–5월",question:"실제로 해보고, 보여주고, 대화하면 무엇이 달라지는가?",description:"진로·일·관계에서 예상과 실제의 차이를 확인합니다."},
    {id:"resources",title:"가능성에 자원을 쓴다",period:"6–8월",question:"무엇에 자원을 쓰고, 무엇을 계속하거나 멈출 것인가?",description:"쌓인 경험을 근거로 시간과 돈을 배분하고 강점을 기회에 연결합니다."},
    {id:"contribution",title:"함께 기여하고 다음 방향을 정한다",period:"9–11월",question:"어떤 역할로 함께 일하고, 어떤 삶을 이어갈 것인가?",description:"자신의 기여 방식과 앞으로 사용할 선택의 기준을 구체화합니다."}
  ];
  const enrollmentDefaults = [
  {
    "enrollmentTitle": "내 선택의 기준 찾기",
    "forWhom": "남의 기대에 맞추느라 내 선택을 미뤄왔다면.",
    "outcome": "미뤄 온 선택 하나를 행동으로 옮기고, 실제 경험에서 나의 기준을 확인합니다.",
    "topics": [
      "12월 · 반복되는 선택",
      "1월 · 목표와 자원",
      "2월 · 가족의 기대와 내 결정"
    ],
    "startLabel": "12월 시작"
  },
  {
    "enrollmentTitle": "생각을 현실에서 시험하기",
    "forWhom": "진로·일·관계에서 결정을 미루고 있다면.",
    "outcome": "진로 경험·결과물 제출·대화 중 자신의 과제를 실행하고, 실제 반응에서 다음 선택을 정합니다.",
    "topics": [
      "3월 · 진로를 실제로 경험하기",
      "4월 · 완성하고 평가받기",
      "5월 · 내 뜻을 말하기"
    ],
    "startLabel": "3월 시작"
  },
  {
    "enrollmentTitle": "시간과 돈을 내 가능성에 쓰기",
    "forWhom": "하고 싶은 일에 쓸 시간과 돈이 늘 부족하다면.",
    "outcome": "자원 배분·현재 일의 결정·강점을 담은 제안 중 하나를 실행하고, 바뀐 선택의 결과를 평가합니다.",
    "topics": [
      "6월 · 시간과 돈의 우선순위",
      "7월 · 계속·수정·종료의 결정",
      "8월 · 강점을 기회로 연결하기"
    ],
    "startLabel": "6월 시작"
  },
  {
    "enrollmentTitle": "함께 일하고 다음 방향 세우기",
    "forWhom": "협업에서 같은 역할과 어려움을 반복한다면.",
    "outcome": "공동의 일에서 자신의 역할을 실행하고, 실제 기여와 한계를 근거로 다음 방향을 정합니다.",
    "topics": [
      "9월 · 함께 결과를 만드는 협업",
      "10월 · 필요한 기여와 소명",
      "11월 · 다음 삶의 방향"
    ],
    "startLabel": "9월 시작"
  }
];
  const defaultRows = [
    ["2026.12","내 인생인데, 왜 남의 기준으로 선택할까?","‘나는 원래 이런 사람’이라는 말은 어디서 왔을까","내면화된 평가와 자기표상을 살피며 반복되는 선택의 이유를 배웁니다.","실제 결과로 자기 설명을 고치는 법","행동·결과·해석을 구분하고, 첫 실행에서 얻은 경험으로 판단을 수정합니다.","미뤄온 지원·대화·제안 중 자신이 선택한 행동을 실행합니다.","예상했던 반응과 실제 반응은 어떻게 달랐으며, 나에 대한 설명을 무엇부터 고칠까?"],
    ["2027.01","계획은 많은데, 왜 중요한 일은 늘 밀릴까?","남들이 좋다는 목표와 내가 선택한 목표","인정 욕구와 가치, 순응을 살펴 자신의 목표를 구분합니다.","선택한 목표에 시간과 돈을 쓰는 법","기회비용과 제약을 이해하고 필요한 시간·돈·도움을 실제로 배정합니다.","선택한 일에 필요한 자원을 배정하고 행동합니다.","내가 말한 우선순위와 실제로 자원을 쓴 선택은 일치했는가?"],
    ["2027.02","가족의 기대 앞에서 내 선택을 말하는 법","내 결정에는 누구의 승인이 필요한가","가족 안에서 익힌 역할과 분리·개별화를 배웁니다.","독립적인 선택에 따르는 책임","선택권과 비용, 약속을 구체적으로 협의하는 법을 배웁니다.","진로·독립·가족 역할 중 자신의 문제에 관해 선택을 전달하고 책임을 이행합니다.","내가 선택한 것과 상대에게 기대한 것, 실제로 맡은 책임은 무엇인가?"],
    ["2027.03","머릿속 진로를 현실에서 시험하는 법","상상한 적성과 실제 경험은 어떻게 다른가","자기표상과 새로운 자기 경험을 연결해 진로의 가설을 세웁니다.","큰 결정을 앞두고 경험을 설계하는 법","실제 과업과 대화, 협업과 피드백으로 가능성을 확인합니다.","관심 분야의 실제 일이나 협업을 경험할 기회를 구합니다.","무엇이 맞았고 무엇이 예상과 달랐으며, 다음에는 무엇을 확인할까?"],
    ["2027.04","잘하려다 못 끝내는 일, 완성하고 평가받는 법","‘제대로 못하면 하지 않는다’는 선택의 대가","이상화·분열·회피의 관점에서 평가받는 일을 미루는 이유를 살핍니다.","평가받고 고치는 능력","완료 기준과 피드백의 범위를 구분하고 수정할 부분을 선택합니다.","자신이 선택한 결과물을 제출하거나 제안하고 실제 피드백을 검토합니다.","어떤 평가를 받았고, 그중 무엇을 받아들여 어떻게 고쳤는가?"],
    ["2027.05","맞춰주기와 싸우기 사이, 내 뜻을 말하는 법","내가 기대한 사람과 실제 상대","투사와 이상화, 상대의 별개됨을 살펴 관계의 기대를 검토합니다.","추측을 요청으로 바꾸는 대화","양가감정과 관계의 책임을 이해하고 요청·약속을 행동으로 옮깁니다.","말하지 못한 요청이나 불편을 구체적으로 전달합니다.","실제 상대의 반응은 무엇이었고, 이후 나는 어떻게 행동했는가?"],
    ["2027.06","하고 싶은 일에는 왜 돈과 시간이 없을까?","부러운 삶과 내가 원하는 삶","비교와 인정 욕구가 소비와 선택에 미치는 영향을 살핍니다.","실제 사용을 보고 우선순위를 바꾸는 법","시간·돈·주의의 기회비용을 검토하고 배분을 조정합니다.","기존 일정이나 지출을 참고해 자신의 우선순위에 맞게 배분을 바꿉니다.","바꾼 배분이 중요하게 여기는 일에 어떤 영향을 주었는가?"],
    ["2027.07","버틸까, 멈출까? 내 선택에 근거를 세운다","‘여기까지 했는데’라는 마음","매몰비용과 익숙한 역할, 상실의 관점에서 붙잡고 있는 선택을 살핍니다.","계속·수정·종료를 결정하는 법","남은 가능성과 제약, 대안과 마무리 책임으로 판단의 근거를 세웁니다.","현재의 일이나 역할에 관해 결정을 내리고 필요한 협의·인계·수정을 실행합니다.","계속·수정·종료를 택한 근거는 무엇이며, 그 결정에 필요한 책임을 이행했는가?"],
    ["2027.08","내 강점을 실제 기회로 연결하는 법","경험에서 확인되는 나의 강점","내가 해낸 일과 타인이 실제로 필요로 한 일을 함께 살핍니다.","상대가 선택할 제안을 만드는 법","상대의 필요와 내가 제공할 가치, 역할과 조건을 구체화합니다.","확인한 강점을 바탕으로 업무·협업·활동을 제안합니다.","무엇이 상대에게 필요했고, 제안에서 어떤 조건을 다시 다뤄야 하는가?"],
    ["2027.09","일 잘하는 사람도 협업에서 막히는 이유","나는 왜 늘 수습하거나 물러나는 역할을 맡을까","관계에서 반복되는 역할과 반응의 순환을 살핍니다.","함께 결과를 만드는 리더십","권한·책임·기대·피드백을 협의하는 방법을 배웁니다.","공동 과업에서 자신의 역할과 상대의 기대를 협의합니다.","나의 반응과 행동은 공동 결과에 어떤 영향을 주었는가?"],
    ["2027.10","내 일은 누구에게 필요한가?","인정받고 싶은 마음과 기여하고 싶은 마음","자기 경험의 통합과 상대의 실제 필요를 연결합니다.","소명을 실제 기여로 연결하는 법","섬김과 감당할 책임, 지속할 조건을 구체적으로 살핍니다.","중요하게 여기는 기여를 선택해 실제로 수행합니다.","누구에게 어떤 도움이 되었으며, 앞으로 무엇을 감당할 수 있는가?"],
    ["2027.11","내가 해온 선택으로 다음 삶을 설계한다","성공한 나와 실패한 나를 함께 설명하기","실제 경험을 통합해 자신을 설명하는 근거를 찾습니다.","다음 선택을 결정하는 법","이어갈 것, 마무리할 것, 새로 시작할 것을 결과에 근거해 선택합니다.","실제 행동과 결과를 근거로 자신을 설명하고 다음 행동을 선택합니다.","내 가치·역량·관계 방식·실행 조건에 대한 이해는 무엇이 달라졌는가?"]
  ];
  const defaults = defaultRows.map((row,index) => ({
    month:row[0],title:row[1],phaseId:phaseDefaults[Math.floor(index / 3)].id,
    detail:row[2]+" · "+row[4],class1:{title:row[2],detail:row[3]},class2:{title:row[4],detail:row[5]},
    practice1:{title:"선언과 실제 행동을 비교하기",detail:"그 시점까지 한 일과 하지 않은 일, 예상하지 못한 조건을 나누고 실행 단위와 조건을 조정합니다."},
    practice2:{title:"결과에서 다음 선택을 정하기",detail:"실제 결과와 자신의 해석을 검토하고, 자신에 대한 이해와 다음 행동을 수정합니다."},actionExample:row[6],evaluation:row[7]
  }));

  function curriculum(p) {
    const rows = p && Array.isArray(p.curriculum) ? p.curriculum : [];
    return defaults.map((fallback,index) => {
      const found = rows.find((row) => row.month === fallback.month) || rows[index];
      return found && found.class1 && found.class2 ? Object.assign({},fallback,found) : fallback;
    });
  }

  function pricing(p) {
    const e = (p && p.enrollment) || {};
    const number = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
    const phase = number(e.pricePerPhase, 360000);
    const months = number(e.monthsPerPhase, 3);
    return {phase, months, monthly: number(e.monthlyEquivalent, phase / months), sessions: number(e.sessionsPerPhase, 12), hours: number(e.hoursPerPhase, 24)};
  }

  function phaseOptions(p) {
    const rows = p && Array.isArray(p.phases) ? p.phases : [];
    return phaseDefaults.map((phase, index) => Object.assign({}, phase, enrollmentDefaults[index], rows.find((row) => row.id === phase.id) || {}));
  }

  function contact() {
    return "https://open.kakao.com/o/pc24bvUi";
  }

  function picture(name, alt, width, height, extra) {
    return '<img src="' + ASSETS + 'nal_nadaum_' + name + '.webp" alt="' + escape(alt) + '" width="' + width + '" height="' + height + '" loading="lazy" decoding="async"' + (extra || "") + '>';
  }

  function hero(isDetail) {
    const support = isDetail
      ? `<div class="nd-hero__support nd-hero__support--minimal">
          <p class="nd-hero__description">내 선택의 이유를 배우고,<br>행동으로 나를 확인합니다.</p>
          <p class="nd-hero__meta">19–39세 · 일요일 오전 10–12시</p>
          <div class="nd-actions"><a class="nd-button nd-button--blue" href="#nd-membership">4단계 살펴보기${arrow}</a></div>
        </div>`
      : "";
    return `<section class="nd-hero" aria-labelledby="nd-title">
      <div class="nd-hero__visual">
        <picture class="nd-hero__art"><source media="(max-width: 760px)" srcset="${ASSETS}nal_nadaum_hero_mobile.webp" width="1080" height="1350"><img src="${ASSETS}nal_nadaum_hero_desktop.webp" alt="푸른 길 위로 한 걸음을 내딛는 청년" width="2400" height="1350" fetchpriority="high" decoding="async"></picture>
        <div class="nd-hero__headline"><p class="nd-eyebrow">NAL CLASS · 2026년 12월 시작</p><p class="nd-hero__name">나다움으로 자기경영하기</p><h1 id="nd-title"><span>나답게 살겠다는 말,</span><span>이제 <em>행동으로.</em></span></h1></div>
        ${support}
        ${isDetail ? "" : `<a class="nd-hero__cover-link" href="${ROOT}" aria-label="나다움으로 자기경영하기 클래스 상세 보기"></a>`}
      </div>
    </section>`;
  }

  function priceStrip(p) {
    const m = pricing(p);
    return `<div class="nd-price-strip"><div class="nd-wrap nd-price-strip__inner"><p>${MEETING}<br><strong>${VENUE}에서 만납니다.</strong></p><div><span>선택한 단계 · ${m.months}개월</span><strong>${money(m.phase)}<small>원 / 단계</small></strong><small>월 ${money(m.monthly)}원 기준</small></div><div><span>클래스 6회 + 실행 나눔 6회</span><strong>${m.sessions}회<small>총 ${m.hours}시간</small></strong><small>네 단계 중 필요한 단계부터</small></div><a class="nd-text-link" href="${ROOT}#nd-membership">단계별 신청 보기 ${arrow}</a></div></div>`;
  }

  function audience() {
    return `<section class="nd-wrap nd-section nd-questions"><p class="nd-eyebrow">지금, 내 삶의 질문</p><h2>내가 원하는 삶과<br>실제 선택 사이에서.</h2><div class="nd-questions__grid"><p>진로를 고민하지만<br><strong>시작할 결정을 미루고 있나요?</strong></p><p>관계를 지키려다가<br><strong>내 의견을 삼키고 있나요?</strong></p><p>중요한 일이라면서<br><strong>시간과 돈은 늘 남지 않나요?</strong></p></div><p class="nd-intro">나의 기준은 실제 선택과 그 결과에서 드러납니다.</p><div class="nd-benefits"><article><span class="nd-number">01</span><h3>반복되는 선택을 이해합니다.</h3><p>대상관계이론과 심리·정신분석으로 관계와 선택에서 반복되는 나의 반응을 살핍니다.</p></article><article><span class="nd-number">02</span><h3>현실에서 확인하고 수정합니다.</h3><p>경제·경영·리더십을 배우고 직접 행동하며, 나의 기준과 다음 선택을 다듬습니다.</p></article></div></section>`;
  }

  function venueScene() { return "<section class=\"nd-scene-intro nd-section\" id=\"nd-scene\" aria-labelledby=\"nd-scene-title\">\n  <div class=\"nd-wrap\">\n    <div class=\"nd-section-heading\">\n      <div><p class=\"nd-eyebrow\">우리가 만날 곳 · 시메진 카페</p><h2 id=\"nd-scene-title\">일요일 오전,<br>배운 것을 내 선택에 연결합니다.</h2></div>\n      <p>배우고, 선언하고,<br>서로의 실행을 나눕니다.</p>\n    </div>\n    <figure class=\"nd-scene-intro__photo\">\n      <picture>\n        <source media=\"(max-width: 760px)\" srcset=\"/nal/assets/images/nadaum/scenes-v2/nal_nadaum_scene_class_mobile.webp\" width=\"1080\" height=\"1350\">\n        <img src=\"/nal/assets/images/nadaum/scenes-v2/nal_nadaum_scene_class_desktop.webp\" alt=\"큰 창과 식물이 있는 카페에서 청년들이 붉은 목재 테이블에 둘러앉아 질문을 듣는다.\" width=\"2400\" height=\"1350\" loading=\"lazy\" decoding=\"async\">\n      </picture>\n      <figcaption>이 페이지의 수업 장면은 연출 이미지입니다.</figcaption>\n    </figure>\n    <div class=\"nd-scene-place\">\n      <div><h3>시메진 카페</h3><p>서울 강동구 성내로10길 9-6 1층<br>강동구청역 2번 출구에서 478m</p></div>\n      <div class=\"nd-scene-place__meeting\"><strong>일요일 오전 10–12시</strong><p>월 4회 · 오프라인<br>클래스 2회 + 실행 나눔 2회</p><a class=\"nd-text-link\" href=\"https://m.place.naver.com/restaurant/2089879267/home\" target=\"_blank\" rel=\"noopener noreferrer\">시메진 카페 위치 보기 <span aria-hidden=\"true\">↗</span></a></div>\n    </div>\n  </div>\n</section>"; }

  function actionScenes() { return "<div class=\"nd-wrap nd-action-scenes\">\n  <article class=\"nd-action-scene\" aria-labelledby=\"nd-declare-title\">\n    <div class=\"nd-action-scene__copy\"><p class=\"nd-eyebrow\">한 사람, 하나의 선언</p><h3 id=\"nd-declare-title\">“그래서 나는<br>무엇을 하겠습니다.”</h3><p>내 삶에서 바꿀 행동 하나를 구체적으로 선언합니다.</p></div>\n    <figure><img src=\"/nal/assets/images/nadaum/scenes-v2/nal_nadaum_scene_declare.webp\" alt=\"차콜 재킷을 입은 참여자가 자신이 정한 행동을 설명하고 양옆의 참여자가 듣는다.\" width=\"1600\" height=\"1200\" loading=\"lazy\" decoding=\"async\"></figure>\n  </article>\n  <article class=\"nd-action-scene\" aria-labelledby=\"nd-plan-title\">\n    <div class=\"nd-action-scene__copy\"><p class=\"nd-eyebrow\">실행할 수 있게 나누기</p><h3 id=\"nd-plan-title\">내 행동에 필요한 만큼,<br>내가 나눕니다.</h3><p>필요한 준비와 행동을 나누고, 언제 실행할지 스스로 정합니다.</p></div>\n    <figure><img src=\"/nal/assets/images/nadaum/scenes-v2/nal_nadaum_scene_action_plan.webp\" alt=\"참여자가 적갈색 나무 테이블에서 큰 종이 옆의 작은 메모를 옮겨 계획을 정리한다.\" width=\"1600\" height=\"1200\" loading=\"lazy\" decoding=\"async\"></figure>\n  </article>\n</div>"; }

  function firstMonth(p, compact) {
    const first = curriculum(p)[0];
    if (compact) return `<section class="nd-wrap nd-section nd-first-preview" id="nd-first-month"><div><p class="nd-eyebrow">12월, 첫 네 번의 만남</p><h2>${escape(first.title)}</h2><p>올해 내가 했던 선택을 재료로 삼아,<br>새해에 바꿀 첫 행동을 정합니다.</p></div><div><ol class="nd-first-preview__classes"><li><span>첫 클래스</span><h3>${escape(first.class1.title)}</h3></li><li><span>두 번째 클래스</span><h3>${escape(first.class2.title)}</h3></li></ol><p class="nd-caption">클래스 사이에는 실행한 경험을 나누고, 실제 결과에서 다음 선택을 정합니다.</p><a class="nd-text-link" href="${ROOT}#nd-first-month">12월 네 번의 만남 자세히 보기 ${arrow}</a></div></section>`;
    const sessions = [
      {type:"클래스",key:"class1"},
      {type:"실행 나눔",key:"practice1"},
      {type:"클래스",key:"class2"},
      {type:"실행 나눔",key:"practice2"}
    ];
    return `<section class="nd-first-month nd-section" id="nd-first-month"><div class="nd-wrap"><div class="nd-section-heading"><div><p class="nd-eyebrow">12월, 첫 네 번의 만남</p><h2>${escape(first.title)}</h2></div><p>올해 내가 했던 선택으로<br>새해에 바꿀 첫 행동을 정합니다.</p></div><ol class="nd-opening-sessions">${sessions.map((session,index) => {const item = first[session.key];return `<li><div class="nd-session-label"><span>${String(index + 1).padStart(2,"0")}</span><strong>${session.type}</strong><small>2시간</small></div><div><h3>${escape(item.title)}</h3><p>${escape(item.detail)}</p></div></li>`;}).join("")}</ol></div></section>`;
  }

  function steps(compact) {
    return `<ol class="nd-steps"><li><span class="nd-number">01</span><h3>깨달음</h3><p>${compact ? "관계와 선택 속에서 반복되는 반응과 자신의 기준을 알아봅니다." : "관계와 선택에서 반복되는 반응을 살피고, 나의 판단 기준을 찾습니다."}</p><strong>“나는 왜 이렇게 선택할까?”</strong></li><li><span class="nd-number">02</span><h3>선언과 실행</h3><p>${compact ? "내가 선택한 행동 하나를 선언하고, 실행할 수 있는 단위로 나눕니다." : "바꿀 행동 하나를 선언하고, 실행할 수 있는 단위로 나눕니다."}</p><strong>“그래서, 무엇을 할 것인가?”</strong></li><li><span class="nd-number">03</span><h3>결과 자가평가</h3><p>${compact ? "실제로 한 행동과 나타난 결과로 자신에 대한 이해와 다음 선택을 고칩니다." : "선언한 것과 실제 행동, 그 결과를 비교하며 다음 선택을 정합니다."}</p><strong>“이 결과에서 무엇을 알게 되었나?”</strong></li></ol>`;
  }

  function rhythm(compact) {
    return `<div class="nd-rhythm"><div class="nd-section-heading"><div><p class="nd-eyebrow">한 달의 리듬</p><h2>배움과 실행이<br>네 번의 만남으로 이어집니다.</h2></div><p>클래스 2회 + 실행 나눔 2회<br>월 4회 · 회당 2시간</p></div><ol class="nd-rhythm__list"><li><span>첫 번째 만남</span><h3>클래스</h3><p>선택을 설명할 관점을 배우고<br>행동을 선언합니다.</p></li><li><span>두 번째 만남</span><h3>실행 나눔</h3><p>실제로 한 일과<br>막힌 지점을 살핍니다.</p></li><li><span>세 번째 만남</span><h3>클래스</h3><p>판단법을 더 배우고<br>실행할 선택을 다듬습니다.</p></li><li><span>네 번째 만남</span><h3>실행 나눔</h3><p>실제 결과를 평가하고<br>다음 선택을 나눕니다.</p></li></ol>${compact ? "" : '<p class="nd-caption">클래스는 티칭 80% · 코칭 20%로 진행합니다.</p>'}</div>`;
  }

  function method() {
    const examples = [
      {label:"진로·기회",title:"관심 있는 프로젝트에 내가 맡을 수 있는 역할을 제안하겠다.",result:"보낸 제안, 받은 응답, 상대가 필요로 한 일과 조건을 확인합니다."},
      {label:"관계·일",title:"계속 맡아온 일의 범위와 우선순위를 협의하겠다.",result:"실제 대화에서 무엇을 말했고, 어떤 조건이 달라졌는지 살핍니다."},
      {label:"시간·돈",title:"현재의 자원 배분을 바꾸고, 선택한 배움을 시작하겠다.",result:"무엇을 포기하고 무엇을 시작했는지, 예상한 가치가 있었는지 평가합니다."}
    ];
    return `<section class="nd-method nd-section" id="nd-method"><div class="nd-wrap"><div class="nd-section-heading"><div><p class="nd-eyebrow">나다움을 찾는 방식</p><h2>깨달음을<br>내 삶의 행동으로.</h2></div></div>${steps(false)}<div class="nd-example-heading"><h3>이런 행동을 시작합니다</h3></div><div class="nd-scenarios">${examples.map((item)=>`<article><p class="nd-eyebrow">${escape(item.label)}</p><h4>“${escape(item.title)}”</h4><p>${escape(item.result)}</p></article>`).join("")}</div></div>${actionScenes()}</section>`;
  }

  function sharing() {
    return `<section class="nd-wrap nd-section" id="nd-month">${rhythm(false)}<div class="nd-image-story nd-image-story--reverse"><figure><img src="/nal/assets/images/nadaum/scenes-v2/nal_nadaum_scene_review.webp" alt="크림 셔츠를 입은 참여자가 펼친 노트를 가리키며 실행 경험을 설명하고 옆 사람이 함께 살핀다." width="1600" height="1200" loading="lazy" decoding="async"></figure><div class="nd-image-story__copy"><p class="nd-eyebrow">함께 나누는 실기</p><h3>내가 한 일과<br>일어난 결과를 이야기합니다.</h3><ol class="nd-review-questions"><li>무엇을 하겠다고 했는가?</li><li>실제로 무엇을 했고, 하지 않았는가?</li><li>예상과 실제 결과는 무엇이 달랐는가?</li><li>그 결과를 설명할 근거는 무엇인가?</li><li>나에 대한 이해와 다음 행동을 어떻게 고칠까?</li></ol></div></div></section>`;
  }

  function coach() {
    return `<section class="nd-wrap nd-section nd-coach" id="nd-coach"><div><p class="nd-eyebrow">함께할 코치</p><h2>김철웅 코치</h2><a class="nd-text-link" href="/nal/host/kim-cheol-woong/">코치 소개 더 보기 ${arrow}</a></div><div><p class="nd-coach__lead">삶에서 했던 선택을<br>수업의 질문으로 가져옵니다.</p><p>진로를 선택한 과정, 교육 현장에서 만난 사람들, 저자의 이야기를 책으로 만든 경험을 수업에 가져옵니다. 그때의 선택과 결과를 함께 살피고, 각자의 삶에서 실행할 행동을 찾습니다.</p><ul class="nd-coach__facts"><li><strong>KPC</strong><span>한국코치협회 인증</span></li><li><strong>11년</strong><span>코칭 경력</span></li><li><strong>5,000시간+</strong><span>1:1 코칭</span></li></ul></div></section>`;
  }

  function year(p) {
    const months = curriculum(p);
    const supplied = p && Array.isArray(p.phases) && p.phases.length === 4 ? p.phases : phaseDefaults;
    return `<section class="nd-year nd-section" id="nd-year"><div class="nd-wrap"><div class="nd-section-heading"><div><p class="nd-eyebrow">2026.12 — 2027.11 · 4개의 단계</p><h2>선택의 기준에서<br>나의 기여와 다음 방향까지.</h2></div></div><div class="nd-year-phases">${supplied.map((phase,index) => `<section class="nd-phase" aria-labelledby="nd-phase-${index + 1}"><div class="nd-phase__heading"><span class="nd-phase__number">${String(index + 1).padStart(2,"0")}</span><div><p class="nd-eyebrow">${escape(phase.period)}</p><h3 id="nd-phase-${index + 1}">${escape(phase.title)}</h3><p>${escape(phase.question)}</p></div></div><div class="nd-month-cards">${months.slice(index * 3,index * 3 + 3).map((item,position) => `<details class="nd-month-card"><summary><span class="nd-month-card__month">${escape(item.month)}</span><span class="nd-month-card__heading"><strong>${escape(item.title)}</strong></span><span class="nd-month-card__toggle" aria-hidden="true"></span></summary><div class="nd-month-card__content"><ol class="nd-month-sessions">${[{key:"class1",label:"01 · 클래스"},{key:"practice1",label:"02 · 실행 나눔"},{key:"class2",label:"03 · 클래스"},{key:"practice2",label:"04 · 실행 나눔"}].map((session) => `<li><span>${session.label}</span><h4>${escape(item[session.key].title)}</h4><p>${escape(item[session.key].detail)}</p></li>`).join("")}</ol><div class="nd-month-application"><p><strong>실행 예시</strong>${escape(item.actionExample)}</p><p><strong>결과 자가평가</strong>${escape(item.evaluation)}</p></div></div></details>`).join("")}</div></section>`).join("")}</div></div></section>`;
  }

  function faith() {
    return `<section class="nd-faith" id="nd-faith"><div class="nd-wrap nd-faith__inner"><p class="nd-eyebrow">이 클래스가 품은 관점</p><div><h2>삶의 질문에서,<br>신앙의 질문까지.</h2><p>예수 그리스도의 은혜와 새로운 삶, 관계에서의 사랑과 책임, 내게 주어진 것을 사용하는 소명을 함께 살핍니다.</p><p>질문은 자유롭게 나눕니다. 신앙에 관한 응답과 나눔은 자율입니다.</p></div></div></section>`;
  }

  function enrollment(p) {
    const m = pricing(p);
    const phases = phaseOptions(p);
    const cards = phases.map((phase, index) => `<article class="nd-plan nd-plan--phase" id="nd-enroll-${escape(phase.id)}" aria-labelledby="nd-enroll-title-${index + 1}"><div class="nd-plan__top"><p class="nd-eyebrow">STEP ${String(index + 1).padStart(2,"0")} · ${escape(phase.period)}</p><span class="nd-plan__label">${escape(phase.startLabel)}</span></div><h3 id="nd-enroll-title-${index + 1}">${escape(phase.enrollmentTitle)}</h3><p class="nd-plan__who">${escape(phase.forWhom)}</p><ul class="nd-plan__topics">${phase.topics.map((topic) => `<li>${escape(topic)}</li>`).join("")}</ul><div class="nd-plan__outcome"><strong>이 단계에서 해볼 일</strong><p>${escape(phase.outcome)}</p></div><div class="nd-plan__action"><p class="nd-plan__price">${money(m.phase)}<small>원 / 단계</small></p><p class="nd-plan__duration">${m.months}개월 · ${m.sessions}회 · ${m.hours}시간<br><strong>${CAPACITY_NOTE}</strong></p><a class="nd-button nd-button--blue" href="${contact()}" target="_blank" rel="noopener noreferrer" aria-label="${index + 1}단계 ${escape(phase.enrollmentTitle)} 카카오톡 신청 문의">${index + 1}단계 신청 문의 ${arrow}</a></div></article>`).join("");
    return `<section class="nd-membership nd-section" id="nd-membership"><div class="nd-wrap"><div class="nd-section-heading"><div><p class="nd-eyebrow">단계별 신청</p><h2>지금 필요한 단계부터<br>시작하세요.</h2></div><p>내가 선택한 과제를<br>배움과 실제 행동으로 다루는 3개월.</p></div><p class="nd-enrollment-intro"><strong>각 단계 ${CAPACITY_NOTE}</strong><br>원하는 단계만 선택해 참여할 수 있습니다.</p><dl class="nd-operating"><div><dt>진행</dt><dd>오프라인 · 19–39세</dd></div><div><dt>시간</dt><dd>${MEETING}</dd></div><div><dt>장소</dt><dd>${VENUE}</dd></div><div><dt>한 단계</dt><dd>클래스 6회 + 실행 나눔 6회</dd></div></dl><p class="nd-enrollment-faith">성경·복음을 함께 다루며, 신앙에 관한 응답과 나눔은 자율입니다.</p><div class="nd-plans nd-plans--phases">${cards}</div><div class="nd-enrollment-guide"><h3>어떤 단계가 맞을지 궁금하다면</h3><a class="nd-text-link" href="${contact()}" target="_blank" rel="noopener noreferrer">카카오톡으로 문의하기 ${arrow}</a></div></div></section>`;
  }

  function home(p) {
    return `<div class="nd nd-home">${hero(false)}</div>`;
  }

  function feature(p) {
    return `<section class="nd nd-class-front" aria-labelledby="nd-class-front-title">
      <a class="nd-class-front__link" href="${ROOT}" aria-label="나다움으로 자기경영하기 클래스 자세히 보기">
        <picture class="nd-class-front__art">
          <source media="(max-width: 760px)" srcset="${ASSETS}nal_nadaum_hero_mobile.webp" width="1080" height="1350">
          <img src="${ASSETS}nal_nadaum_hero_desktop.webp" alt="푸른 길 위로 한 걸음을 내딛는 청년" width="2400" height="1350" fetchpriority="high" decoding="async">
        </picture>
        <div class="nd-class-front__headline">
          <p class="nd-eyebrow">NAL CLASS</p>
          <h1 id="nd-class-front-title">나답게 살겠다는 말,<br>이제 <em>행동으로.</em></h1>
        </div>
      </a>
    </section>`;
  }

  function card(p) {
    const m = pricing(p);
    return `<article class="nd nd-card nal-card" data-catalog-id="${escape((p && p.id) || "nadaum-self-management")}"><a class="nd-card__image" href="${ROOT}" tabindex="-1" aria-hidden="true">${picture("hero_mobile", "", 1080, 1350)}</a><div class="nd-card__body"><p class="nd-eyebrow">NAL CLASS · 12월 시작</p><h3><a href="${ROOT}">나다움으로 자기경영하기</a></h3><p>반복되는 선택을 이해하고,<br>실제 행동과 결과에서 나를 알아갑니다.</p><p class="nd-card__meta">19–39세 · 월 4회 · 회당 2시간<br><strong>${CAPACITY_NOTE}</strong></p><p class="nd-card__meeting"><strong>${MEETING}</strong><br>${VENUE} · 오프라인</p><div class="nd-card__prices"><span>3개월 · 12회 <strong>${money(m.phase)}원</strong></span><span>단계별 신청 <strong>4개의 주제</strong></span></div></div></article>`;
  }

  function detail(p) {
    const m = pricing(p);
    const faq = [
      ["언제, 어디서 진행하나요?", "일요일 오전 10–12시, 시메진 카페에서 월 4회 만납니다. 주소는 서울 강동구 성내로10길 9-6 1층입니다. 단계별 세부 날짜는 카카오톡으로 안내합니다."],
      ["기독교인이 아니어도 참여할 수 있나요?", "네. 성경·복음의 관점을 함께 다루며, 신앙 유무와 관계없이 참여할 수 있습니다. 신앙에 관한 응답과 나눔은 자율입니다."],
      ["매번 새로운 행동을 정해야 하나요?", "아니요. 한 번 선언한 행동을 여러 만남에 걸쳐 이어가며 수정할 수 있습니다. 행동의 범위와 실행 시점은 스스로 정합니다."],
      ["앞 단계를 듣지 않아도 참여할 수 있나요?", "네. 원하는 단계부터 참여할 수 있습니다. 진행 중인 단계의 합류 가능 여부는 문의해 주세요."],
      ["한 단계의 교육비와 구성은 어떻게 되나요?", m.months + "개월 " + money(m.phase) + "원입니다. 클래스 6회와 실행 나눔 6회, 총 " + m.sessions + "회·" + m.hours + "시간으로 구성됩니다."],
      ["신청은 어떻게 하나요?", "희망 단계의 신청 문의 버튼을 눌러 카카오톡으로 말씀해 주세요. 세부 일정과 신청 조건을 안내합니다."]
    ];
    return `<div class="nd nd-detail">${hero(true)}<nav class="nd-subnav" aria-label="클래스 소개 목차"><div class="nd-wrap"><a href="#nd-scene">수업과 공간</a><a href="#nd-first-month">12월에 배우는 것</a><a href="#nd-method">진행 방식</a><a href="#nd-coach">함께할 코치</a><a href="#nd-year">전체 커리큘럼</a><a href="#nd-membership">단계별 신청</a></div></nav>${audience()}${venueScene()}${firstMonth(p,false)}${enrollment(p)}${method()}${sharing()}${coach()}${year(p)}${faith()}<section class="nd-wrap nd-section nd-faq" id="nd-faq"><div class="nd-section-heading"><div><p class="nd-eyebrow">참여 전 궁금한 점</p><h2>자주 묻는 질문</h2></div></div><div class="nd-faq__list">${faq.map(([q, a]) => `<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join("")}</div></section><div class="nd-detail-end"><div class="nd-wrap"><p>올해 내가 했던 선택으로,<br><strong>새해에 바꿀 첫 행동을 정합니다.</strong></p><a class="nd-button nd-button--blue" href="#nd-membership">단계별 신청 보기 ${arrow}</a></div></div></div>`;
  }

  window.NALNadaum = Object.freeze({home, feature, detail, card});
}());



