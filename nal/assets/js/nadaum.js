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
  const phaseDefaults = [
    {id:"criteria",title:"내 선택의 기준을 알아본다",period:"12–2월",question:"나는 누구의 기대와 기준으로 선택해 왔는가?",description:"익숙한 자기 설명을 살피고, 내가 선택할 것과 책임질 것을 구분합니다."},
    {id:"experience",title:"현실에서 나를 알아본다",period:"3–5월",question:"실제로 해보고, 보여주고, 대화하면 무엇이 달라지는가?",description:"진로·일·관계에서 예상과 실제의 차이를 확인합니다."},
    {id:"resources",title:"가능성에 자원을 쓴다",period:"6–8월",question:"무엇에 자원을 쓰고, 무엇을 계속하거나 멈출 것인가?",description:"쌓인 경험을 근거로 시간과 돈을 배분하고 강점을 기회에 연결합니다."},
    {id:"contribution",title:"함께 기여하고 다음 방향을 정한다",period:"9–11월",question:"어떤 역할로 함께 일하고, 어떤 삶을 이어갈 것인가?",description:"자신의 기여 방식과 앞으로 사용할 선택의 기준을 구체화합니다."}
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
    const m = (p && p.membership) || {};
    const number = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
    const monthly = number(m.monthlyPrice, 120000);
    const annual = number(m.annualPrice, 1000000);
    const months = number(m.months, 12);
    return {monthly, annual, months, total: monthly * months, saving: monthly * months - annual};
  }

  function contact(plan) {
    return "mailto:hello@daily-coach-ing.com?subject=" + encodeURIComponent("[NAL 나다움] " + plan + " 참여 문의");
  }

  function picture(name, alt, width, height, extra) {
    return '<img src="' + ASSETS + 'nal_nadaum_' + name + '.webp" alt="' + escape(alt) + '" width="' + width + '" height="' + height + '" loading="lazy" decoding="async"' + (extra || "") + '>';
  }

  function hero(isDetail) {
    return `<section class="nd-hero" aria-labelledby="nd-title">
      <div class="nd-hero__visual">
        <picture class="nd-hero__art"><source media="(max-width: 760px)" srcset="${ASSETS}nal_nadaum_hero_mobile.webp" width="1080" height="1350"><img src="${ASSETS}nal_nadaum_hero_desktop.webp" alt="푸른 길 위로 한 걸음을 내딛는 청년" width="2400" height="1350" fetchpriority="high" decoding="async"></picture>
        <div class="nd-hero__headline"><p class="nd-eyebrow">NAL CLASS · 2026년 12월 시작</p><p class="nd-hero__name">나다움으로 자기경영하기</p><h1 id="nd-title"><span>나답게 살겠다는 말,</span><span>이제 <em>행동으로.</em></span></h1></div>
        <div class="nd-hero__support"><p class="nd-hero__description">반복되는 선택의 이유를 배우고,<br>실제 행동과 결과에서 나의 기준을 세웁니다.</p><ul class="nd-hero__facts" aria-label="참여 안내"><li>19–39세 청년</li><li>2026.12–2027.11</li><li>월 4회 · 회당 2시간</li></ul><p class="nd-hero__meeting"><strong>${MEETING}</strong><span>${VENUE} · 오프라인</span></p><div class="nd-actions"><a class="nd-button nd-button--blue" href="${isDetail ? "#nd-first-month" : ROOT + "#nd-first-month"}">12월에 배우는 내용${arrow}</a><a class="nd-text-link" href="${isDetail ? "#nd-membership" : ROOT + "#nd-membership"}">멤버십 안내 <span aria-hidden="true">↓</span></a></div><p class="nd-hero__faith">${FAITH}</p></div>
      </div>
    </section>`;
  }

  function priceStrip(p) {
    const m = pricing(p);
    return `<div class="nd-price-strip"><div class="nd-wrap nd-price-strip__inner"><p>${MEETING}<br><strong>${VENUE}에서 만납니다.</strong></p><div><span>월 멤버십</span><strong>${money(m.monthly)}<small>원 / 월</small></strong></div><div><span>1년 일시납</span><strong>${money(m.annual)}<small>원 / 년</small></strong>${m.saving > 0 ? `<small>월납 ${escape(m.months)}개월 대비 ${money(m.saving)}원 절약</small>` : ""}</div><a class="nd-text-link" href="${ROOT}#nd-membership">멤버십 안내 ${arrow}</a></div></div>`;
  }

  function audience() {
    return `<section class="nd-wrap nd-section nd-questions"><p class="nd-eyebrow">지금, 내 삶의 질문</p><h2>내가 원하는 삶과<br>실제 선택 사이에서.</h2><div class="nd-questions__grid"><p>진로를 고민하지만<br><strong>시작할 결정을 미루고 있나요?</strong></p><p>관계를 지키려다가<br><strong>내 의견을 삼키고 있나요?</strong></p><p>중요한 일이라면서<br><strong>시간과 돈은 늘 남지 않나요?</strong></p></div><p class="nd-intro">나다움은 내가 중요하게 여기는 것을 실제 선택에 사용하고, 그 선택이 만든 결과를 살피며 구체화됩니다. 이 과정에서 두 가지를 함께 배웁니다.</p><div class="nd-benefits"><article><span class="nd-number">01</span><h3>반복되는 선택을 이해합니다.</h3><p>대상관계이론과 심리·정신분석의 관점으로 내가 나를 설명하는 말, 관계에서 품는 기대, 익숙하게 반복하는 반응을 살핍니다.</p></article><article><span class="nd-number">02</span><h3>현실에서 확인하고 수정합니다.</h3><p>경제·경영·리더십의 판단법을 배우고, 직접 고른 행동을 실행합니다. 실제 결과로 나에 대한 이해와 다음 선택을 고칩니다.</p></article></div></section>`;
  }

  function firstMonth(p, compact) {
    const first = curriculum(p)[0];
    if (compact) return `<section class="nd-wrap nd-section nd-first-preview" id="nd-first-month"><div><p class="nd-eyebrow">12월, 첫 네 번의 만남</p><h2>${escape(first.title)}</h2><p>올해 내가 했던 선택을 재료로 삼아,<br>새해에 바꿀 첫 행동을 정합니다.</p></div><div><ol class="nd-first-preview__classes"><li><span>첫 클래스</span><h3>${escape(first.class1.title)}</h3></li><li><span>두 번째 클래스</span><h3>${escape(first.class2.title)}</h3></li></ol><p class="nd-caption">클래스 사이에는 실행한 경험을 나누고, 실제 결과에서 다음 선택을 정합니다.</p><a class="nd-text-link" href="${ROOT}#nd-first-month">12월 네 번의 만남 자세히 보기 ${arrow}</a></div></section>`;
    const sessions = [
      {type:"클래스",key:"class1",action:"지금 바꾸고 싶은 선택을 정하고, 행동 하나를 선언합니다. 실행에 필요한 n개로 직접 나눕니다."},
      {type:"실기·나눔",key:"practice1",action:"자신이 정한 실행 시점을 바탕으로, 현재까지 한 일과 하지 않은 일을 구체적으로 살핍니다."},
      {type:"클래스",key:"class2",action:"실제 경험을 읽는 관점을 배우고, 기존 행동을 이어가거나 수정할 기준을 세웁니다."},
      {type:"실기·나눔",key:"practice2",action:"처음의 자기 설명과 실제 경험을 대조하고 다음 행동을 선택합니다."}
    ];
    return `<section class="nd-first-month nd-section" id="nd-first-month"><div class="nd-wrap"><div class="nd-section-heading"><div><p class="nd-eyebrow">12월, 첫 네 번의 만남</p><h2>${escape(first.title)}</h2></div><p>올해 내가 했던 선택으로<br>새해에 바꿀 첫 행동을 정합니다.</p></div><p class="nd-first-month__promise">내가 반복하는 선택 하나를 이해하고, 그것을 바꿔볼 행동을 선택하며, 실제 경험을 근거로 나에 대한 설명을 수정합니다.</p><ol class="nd-opening-sessions">${sessions.map((session,index) => {const item = first[session.key];return `<li><div class="nd-session-label"><span>${String(index + 1).padStart(2,"0")}</span><strong>${session.type}</strong><small>2시간</small></div><div><h3>${escape(item.title)}</h3><p>${escape(item.detail)}</p><p class="nd-session-action">${escape(session.action)}</p></div></li>`;}).join("")}</ol><p class="nd-caption">일요일 오전 10–12시 · 시메진 카페 · 오프라인. 클래스는 티칭 80%·코칭 20%로 진행합니다. 월별 세부 회차는 참여 문의를 통해 안내합니다.</p></div></section>`;
  }

  function steps(compact) {
    return `<ol class="nd-steps"><li><span class="nd-number">01</span><h3>깨달음</h3><p>${compact ? "관계와 선택 속에서 반복되는 반응과 자신의 기준을 알아봅니다." : "대상관계이론과 심리·정신분석의 관점으로 관계에서 형성된 기대와 자기 설명을 살핍니다. 경제·경영·리더십을 삶의 선택에 연결합니다."}</p><strong>“나는 왜 이렇게 선택할까?”</strong></li><li><span class="nd-number">02</span><h3>선언과 실행</h3><p>${compact ? "내가 선택한 행동 하나를 선언하고, 실행에 필요한 n개의 행동으로 나눕니다." : "자신이 바꿀 행동 하나를 선언합니다. 스스로 필요한 만큼 n개의 구체적인 행동으로 나누고, 본인이 책임질 실행 시점을 정합니다."}</p><strong>“그래서, 무엇을 할 것인가?”</strong></li><li><span class="nd-number">03</span><h3>결과 자가평가</h3><p>${compact ? "실제로 한 행동과 나타난 결과로 자신에 대한 이해와 다음 선택을 고칩니다." : "선언한 것, 실제로 한 것, 일어난 결과를 비교합니다. 그 결과를 설명할 근거를 살피고, 나에 대한 이해와 다음 행동을 선택합니다."}</p><strong>“이 결과에서 무엇을 알게 되었나?”</strong></li></ol>`;
  }

  function rhythm(compact) {
    return `<div class="nd-rhythm"><div class="nd-section-heading"><div><p class="nd-eyebrow">한 달의 리듬</p><h2>배움과 실행이<br>네 번의 만남으로 이어집니다.</h2></div><p>클래스 2회 + 실행 나눔 2회<br>월 4회 · 회당 2시간</p></div><ol class="nd-rhythm__list"><li><span>첫 번째 만남</span><h3>클래스</h3><p>선택을 설명할 관점을 배우고<br>행동을 선언합니다.</p><small>이론 · 티칭 80% / 코칭 20%</small></li><li><span>두 번째 만남</span><h3>실행 나눔</h3><p>실제로 한 일과<br>막힌 지점을 살핍니다.</p><small>실기 · 행동과 조건 검토</small></li><li><span>세 번째 만남</span><h3>클래스</h3><p>판단법을 더 배우고<br>실행할 선택을 다듬습니다.</p><small>이론 · 티칭 80% / 코칭 20%</small></li><li><span>네 번째 만남</span><h3>실행 나눔</h3><p>실제 결과를 평가하고<br>다음 선택을 나눕니다.</p><small>실기 · 결과 자가평가</small></li></ol>${compact ? "" : '<p class="nd-caption">행동의 종류와 나눌 개수, 실행 시점은 참가자가 정합니다. 한 번 선언한 행동을 여러 만남에 걸쳐 이어가고 수정할 수 있습니다.</p>'}</div>`;
  }

  function method() {
    const examples = [
      {label:"진로·기회",title:"관심 있는 프로젝트에 내가 맡을 수 있는 역할을 제안하겠다.",result:"보낸 제안, 받은 응답, 상대가 필요로 한 일과 조건을 확인합니다."},
      {label:"관계·일",title:"계속 맡아온 일의 범위와 우선순위를 협의하겠다.",result:"실제 대화에서 무엇을 말했고, 어떤 조건이 달라졌는지 살핍니다."},
      {label:"시간·돈",title:"현재의 자원 배분을 바꾸고, 선택한 배움을 시작하겠다.",result:"무엇을 포기하고 무엇을 시작했는지, 예상한 가치가 있었는지 평가합니다."}
    ];
    return `<section class="nd-method nd-section" id="nd-method"><div class="nd-wrap"><div class="nd-section-heading"><div><p class="nd-eyebrow">나다움을 찾는 방식</p><h2>깨달음을<br>내 삶의 행동으로.</h2></div><p>깨달음 → 행동 하나의 선언<br>→ n개로 분해 → 실행 → 결과 자가평가</p></div>${steps(false)}<div class="nd-example-heading"><h3>내가 선택할 수 있는 행동</h3><p class="nd-caption">아래는 적용 예시입니다. 자신의 삶에서 다룰 행동을 직접 선택합니다.</p></div><div class="nd-scenarios">${examples.map((item)=>`<article><p class="nd-eyebrow">${escape(item.label)}</p><h4>“${escape(item.title)}”</h4><p>${escape(item.result)}</p></article>`).join("")}</div></div><div class="nd-wrap nd-image-story"><figure>${picture("action", "자신이 선택한 행동을 여러 단계로 나누어 배치하는 손", 1600, 1200)}<figcaption>하나의 선언을 실제로 움직일 수 있는 행동으로.</figcaption></figure><div class="nd-image-story__copy"><p class="nd-eyebrow">한 사람, 하나의 선언</p><h3>“그래서 나는<br>무엇을 하겠습니다.”</h3><p>자신의 선언을 실행 가능한 단위와 순서로 나눕니다. 어떤 준비와 확인, 연락과 후속 행동이 필요한지는 선택한 일에 따라 달라집니다.</p><p>그 시점까지 실제로 한 일과 일어난 결과를 가져와 이야기합니다. 경험을 근거로 다음 선택을 수정합니다.</p></div></div></section>`;
  }

  function sharing() {
    return `<section class="nd-wrap nd-section" id="nd-month">${rhythm(false)}<div class="nd-image-story nd-image-story--reverse"><figure>${picture("gather", "푸른 의자를 옮겨 함께 앉을 자리를 만드는 청년들", 1600, 1200)}<figcaption>일요일 오전 10–12시, 시메진 카페에서 만나 실제 경험을 나눕니다.</figcaption></figure><div class="nd-image-story__copy"><p class="nd-eyebrow">함께 나누는 실기</p><h3>내가 한 일과<br>일어난 결과를 이야기합니다.</h3><ol class="nd-review-questions"><li>무엇을 하겠다고 했는가?</li><li>실제로 무엇을 했고, 하지 않았는가?</li><li>예상과 실제 결과는 무엇이 달랐는가?</li><li>그 결과를 설명할 근거는 무엇인가?</li><li>나에 대한 이해와 다음 행동을 어떻게 고칠까?</li></ol><p>서로의 질문을 듣고, 자신이 선택한 행동과 결과를 스스로 평가합니다.</p></div></div></section>`;
  }

  function coach() {
    return `<section class="nd-wrap nd-section nd-coach" id="nd-coach"><div><p class="nd-eyebrow">함께할 코치</p><h2>김철웅 코치</h2><p class="nd-coach__role">나다움으로 자기경영하기 · 진행</p><a class="nd-text-link" href="/nal/host/kim-cheol-woong/">코치 소개 더 보기 ${arrow}</a></div><div><p class="nd-coach__lead">삶에서 했던 선택을<br>수업의 질문으로 가져옵니다.</p><p>가족을 통해 코칭을 접하고 자신의 진로를 선택한 과정, 캠프 참가자의 재방문과 다른 프로젝트의 참여 제안, 저자의 이야기를 책으로 만드는 일을 수업에서 다룹니다.</p><div class="nd-coach__story"><p>각 장면에서 무엇을 선택했고 어떤 결과가 나타났는지 살펴봅니다. 그 경험을 대상관계이론과 경제·경영·리더십의 관점에 연결하고, 참가자가 자신의 삶에 적용할 행동을 고르도록 돕습니다.</p></div><ul class="nd-coach__facts"><li><strong>KPC</strong><span>한국코치협회 인증</span></li><li><strong>11년</strong><span>코칭 경력</span></li><li><strong>5,000시간+</strong><span>1:1 코칭</span></li></ul></div></section>`;
  }

  function year(p) {
    const months = curriculum(p);
    const supplied = p && Array.isArray(p.phases) && p.phases.length === 4 ? p.phases : phaseDefaults;
    return `<section class="nd-year nd-section" id="nd-year"><div class="nd-wrap"><div class="nd-section-heading"><div><p class="nd-eyebrow">2026.12 — 2027.11 · 4개의 단계</p><h2>선택의 기준에서<br>나의 기여와 다음 방향까지.</h2></div><p>24번의 클래스와 24번의 실행 나눔.<br>앞선 경험을 다음 선택에 사용합니다.</p></div><div class="nd-year-phases">${supplied.map((phase,index) => `<section class="nd-phase" aria-labelledby="nd-phase-${index + 1}"><div class="nd-phase__heading"><span class="nd-phase__number">${String(index + 1).padStart(2,"0")}</span><div><p class="nd-eyebrow">${escape(phase.period)}</p><h3 id="nd-phase-${index + 1}">${escape(phase.title)}</h3><p>${escape(phase.question)}</p><p class="nd-caption">${escape(phase.description)}</p></div></div><div class="nd-month-cards">${months.slice(index * 3,index * 3 + 3).map((item,position) => `<details class="nd-month-card"${index === 0 && position === 0 ? " open" : ""}><summary><span class="nd-month-card__month">${escape(item.month)}</span><span class="nd-month-card__heading"><strong>${escape(item.title)}</strong><small>클래스 2회 · 실기·나눔 2회</small></span><span class="nd-month-card__toggle" aria-hidden="true"></span></summary><div class="nd-month-card__content"><ol class="nd-month-sessions">${[{key:"class1",label:"01 · 클래스"},{key:"practice1",label:"02 · 실기·나눔"},{key:"class2",label:"03 · 클래스"},{key:"practice2",label:"04 · 실기·나눔"}].map((session) => `<li><span>${session.label}</span><h4>${escape(item[session.key].title)}</h4><p>${escape(item[session.key].detail)}</p></li>`).join("")}</ol><div class="nd-month-application"><p><strong>선택할 수 있는 행동의 예</strong>${escape(item.actionExample)}</p><p><strong>결과 자가평가</strong>${escape(item.evaluation)}</p></div></div></details>`).join("")}</div></section>`).join("")}</div><p class="nd-caption">개인의 행동은 첫 달부터 자신의 상황에 맞게 선택합니다. 같은 행동을 여러 달에 걸쳐 이어가며 각 달의 배움으로 계속·변경·종료를 판단할 수 있습니다.</p></div></section>`;
  }

  function faith() {
    return `<section class="nd-faith" id="nd-faith"><div class="nd-wrap nd-faith__inner"><p class="nd-eyebrow">이 클래스가 품은 관점</p><div><h2>삶의 질문에서,<br>신앙의 질문까지.</h2><p>${FAITH}</p><p>예수 그리스도 안에서 주어지는 은혜와 새로운 삶, 관계에서의 사랑과 책임, 시간·돈·능력을 사용하는 소명을 성경과 복음의 메시지로 함께 살핍니다.</p><p>자신의 경험과 연결해 질문하고 생각을 나눌 수 있습니다. 신앙에 관한 응답과 나눔은 자율이며, 결과 자가평가는 자신이 선언한 행동과 실제 결과를 중심으로 진행합니다.</p></div></div></section>`;
  }

  function membership(p) {
    const m = pricing(p);
    return `<section class="nd-membership nd-section" id="nd-membership"><div class="nd-wrap"><div class="nd-section-heading"><div><p class="nd-eyebrow">MEMBERSHIP</p><h2>내 선택을<br>실제 삶으로 이어갈 시간.</h2></div><p>월 2회 클래스와 격주 실행 나눔으로<br>배움과 선택을 이어갑니다.</p></div><dl class="nd-operating"><div><dt>진행</dt><dd>오프라인</dd></div><div><dt>시간</dt><dd>${MEETING}</dd></div><div><dt>장소</dt><dd>${VENUE}</dd></div><div><dt>기간</dt><dd>2026.12–2027.11</dd></div></dl><div class="nd-plans"><article class="nd-plan"><p class="nd-eyebrow">MONTHLY</p><h3>월 멤버십</h3><p class="nd-plan__price">${money(m.monthly)}<small>원 / 월</small></p><p>지금 다루고 싶은 선택을<br>배움과 실제 실행으로 검토합니다.</p><ul><li>월 2회 이론 클래스</li><li>월 2회 실행 나눔 모임</li><li>회당 2시간 · 월 총 8시간</li></ul><a class="nd-button nd-button--outline" href="${contact("월 멤버십")}">월 멤버십 참여 문의 ${arrow}</a></article><article class="nd-plan nd-plan--annual"><div class="nd-plan__top"><p class="nd-eyebrow">ANNUAL</p><span class="nd-plan__label">1년 일시납</span></div><h3>연간 멤버십</h3><p class="nd-plan__price">${money(m.annual)}<small>원 / 년</small></p><p>경험을 누적하며 관계·진로·자원·기여에<br>사용할 나의 기준을 구체화합니다.</p><ul><li>네 단계로 이어지는 12개월 과정</li><li>총 48회 · 96시간</li><li>2026년 12월–2027년 11월</li></ul><a class="nd-button nd-button--blue" href="${contact("연간 멤버십")}">연간 멤버십 참여 문의 ${arrow}</a>${m.saving > 0 ? `<p class="nd-plan__saving">월납 ${escape(m.months)}개월 ${money(m.total)}원 대비 <strong>${money(m.saving)}원 절약</strong></p>` : ""}</article></div><p class="nd-membership__note">월별 세부 회차와 참여 신청, 이용 조건은 문의를 통해 안내합니다.<br><a href="mailto:hello@daily-coach-ing.com">hello@daily-coach-ing.com</a></p></div></section>`;
  }

  function home(p) {
    return `<div class="nd nd-home">${hero(false)}${priceStrip(p)}${firstMonth(p,true)}<section class="nd-wrap nd-section nd-section--ruled" id="nd-home-method"><div class="nd-section-heading"><div><p class="nd-eyebrow">나다움을 찾는 방식</p><h2>깨닫고, 움직이고,<br>내 결과를 확인합니다.</h2></div><p>내가 중요하게 여기는 것을<br>실제 선택에 사용할 수 있도록.</p></div>${steps(true)}<a class="nd-text-link nd-section-link" href="${ROOT}#nd-method">클래스의 방식 자세히 보기 ${arrow}</a></section><section class="nd-wrap nd-section nd-section--ruled">${rhythm(true)}</section><div class="nd-home-end"><div class="nd-wrap"><p>일요일 오전 10–12시,<br><strong>시메진 카페에서 만납니다.</strong></p><a class="nd-button nd-button--light" href="${ROOT}">12월 클래스 알아보기 ${arrow}</a></div></div></div>`;
  }

  function feature(p) {
    const m = pricing(p);
    return `<section class="nd nd-feature" aria-labelledby="nd-feature-title"><a class="nd-feature__image" href="${ROOT}" aria-label="나다움으로 자기경영하기 자세히 보기">${picture("class_card", "나답게 살기 위한 한 걸음을 내딛는 청년", 1200, 1200)}</a><div class="nd-feature__copy"><p class="nd-eyebrow">NAL 대표 클래스 · 2026년 12월 시작</p><h2 id="nd-feature-title">나답게 살겠다는 말,<br><em>이제 행동으로.</em></h2><p class="nd-feature__name">나다움으로 자기경영하기</p><p>반복되는 선택의 이유를 배우고,<br>실제 행동과 결과에서 나의 기준을 세웁니다.</p><p class="nd-feature__meta">19–39세 · 월 4회 · 회당 2시간</p><p class="nd-feature__meeting"><strong>${MEETING}</strong><br>${VENUE} · 오프라인</p><div class="nd-feature__price"><span>월 멤버십 <strong>${money(m.monthly)}원</strong></span><span>1년 일시납 <strong>${money(m.annual)}원</strong></span></div><a class="nd-button nd-button--blue" href="${ROOT}#nd-first-month">12월에 배우는 내용 ${arrow}</a><p class="nd-caption">${FAITH}</p></div></section>`;
  }

  function card(p) {
    const m = pricing(p);
    return `<article class="nd nd-card nal-card" data-catalog-id="${escape((p && p.id) || "nadaum-self-management")}"><a class="nd-card__image" href="${ROOT}" tabindex="-1" aria-hidden="true">${picture("class_card", "", 1200, 1200)}</a><div class="nd-card__body"><p class="nd-eyebrow">NAL CLASS · 12월 시작</p><h3><a href="${ROOT}">나다움으로 자기경영하기</a></h3><p>반복되는 선택을 이해하고,<br>실제 행동과 결과에서 나를 알아갑니다.</p><p class="nd-card__meta">19–39세 · 월 4회 · 회당 2시간</p><p class="nd-card__meeting"><strong>${MEETING}</strong><br>${VENUE} · 오프라인</p><div class="nd-card__prices"><span>월 멤버십 <strong>${money(m.monthly)}원</strong></span><span>1년 일시납 <strong>${money(m.annual)}원</strong></span></div></div></article>`;
  }

  function detail(p) {
    const m = pricing(p);
    const faq = [
      ["언제, 어디서 진행하나요?", "2026년 12월부터 2027년 11월까지, 일요일 오전 10–12시에 시메진 카페에서 오프라인으로 만납니다. 월 4회·회당 2시간이며, 월별 세부 회차는 참여 문의를 통해 안내합니다."],
      ["기독교인이 아니어도 참여할 수 있나요?", FAITH + " 성경과 복음에 관한 질문을 나눌 수 있으며, 신앙에 관한 응답과 나눔은 자율입니다."],
      ["클래스와 실행 나눔은 어떻게 다른가요?", "클래스는 개념과 사례, 판단법을 배우고 자신의 삶에 적용하는 시간으로 티칭 80%·코칭 20%로 진행합니다. 격주로 이어지는 실행 나눔에서는 실제로 한 행동과 나타난 결과를 살피고, 서로의 질문을 통해 다음 선택을 정합니다."],
      ["매번 새로운 행동을 정해야 하나요?", "자신이 선택한 행동 하나를 선언하고, 실행에 필요한 n개의 행동으로 스스로 나눕니다. 행동의 종류와 개수, 실행 시점은 본인이 정합니다. 한 번 선언한 행동을 여러 만남과 여러 달에 걸쳐 이어가고 수정할 수 있습니다."],
      ["결과 자가평가는 어떻게 하나요?", "선언한 행동, 실제로 한 행동, 나타난 결과를 비교합니다. 실행하지 못한 부분도 어디까지 했고 무엇이 막혔는지 구체적으로 살핍니다. 결과를 해석할 근거와 자신에 대해 새롭게 알게 된 점을 바탕으로 다음 선택을 정합니다."],
      ["월 멤버십과 연간 멤버십의 차이는 무엇인가요?", "월 멤버십은 월 " + money(m.monthly) + "원이며 해당 월의 클래스와 실행 나눔에 참여합니다. 연간 멤버십은 1년 일시납 " + money(m.annual) + "원으로, 네 단계의 배움과 실행을 12개월 동안 이어갑니다. " + (m.saving > 0 ? "월납 " + m.months + "개월 합계 " + money(m.total) + "원 대비 " + money(m.saving) + "원을 절약합니다." : "")],
      ["참여 신청과 이용 조건은 어떻게 확인하나요?", "월간 또는 연간 멤버십 참여 문의를 선택해 연락해 주세요. 월별 세부 회차, 중간 참여, 결석 및 이용 조건을 확인한 뒤 참여를 결정할 수 있습니다."]
    ];
    return `<div class="nd nd-detail">${hero(true)}<nav class="nd-subnav" aria-label="클래스 소개 목차"><div class="nd-wrap"><a href="#nd-first-month">12월에 배우는 것</a><a href="#nd-method">진행 방식</a><a href="#nd-coach">함께할 코치</a><a href="#nd-year">12개월 과정</a><a href="#nd-membership">시간·장소·멤버십</a></div></nav>${audience()}${firstMonth(p,false)}${method()}${sharing()}${coach()}${year(p)}${faith()}${membership(p)}<section class="nd-wrap nd-section nd-faq" id="nd-faq"><div class="nd-section-heading"><div><p class="nd-eyebrow">참여 전 궁금한 점</p><h2>자주 묻는 질문</h2></div></div><div class="nd-faq__list">${faq.map(([q, a]) => `<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join("")}</div></section><div class="nd-detail-end"><div class="nd-wrap"><p>올해 내가 했던 선택으로,<br><strong>새해에 바꿀 첫 행동을 정합니다.</strong></p><a class="nd-button nd-button--blue" href="#nd-membership">멤버십 참여 안내 ${arrow}</a></div></div></div>`;
  }

  window.NALNadaum = Object.freeze({home, feature, detail, card});
}());
