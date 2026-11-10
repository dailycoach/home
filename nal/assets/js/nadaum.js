(function () {
  "use strict";

  const ROOT = "/nal/class/nadaum-self-management/";
  const ASSETS = "/nal/assets/images/nadaum/";
  const FAITH = "기독교적 관점과 성경·복음을 함께 다룹니다. 신앙 유무와 관계없이 참여할 수 있습니다.";
  const escape = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const money = (value) => Number(value).toLocaleString("ko-KR");
  const arrow = '<span aria-hidden="true">↗</span>';
  const defaults = [
    {month:"12월",title:"내 삶의 주도권",detail:"한 해의 선택을 돌아보고, 지금 바꿀 행동 하나를 선언합니다."},
    {month:"1월",title:"결심을 실행으로",detail:"새해의 바람을 실제 행동으로 나누고, 실행의 기준을 정합니다."},
    {month:"2월",title:"관계 속의 나",detail:"가족과 가까운 관계에서 반복하는 반응과 기대를 살핍니다."},
    {month:"3월",title:"새로운 자리, 나의 선택",detail:"학교와 일터의 새로운 역할 속에서 나의 기준을 세웁니다."},
    {month:"4월",title:"일과 강점",detail:"잘하는 것과 맡은 일을 연결하고, 결과로 확인합니다."},
    {month:"5월",title:"사랑과 경계",detail:"관계를 지키면서 자신의 선택을 분명하게 표현합니다."},
    {month:"6월",title:"돈과 가치",detail:"소비와 시간 사용을 통해 실제로 우선하는 가치를 확인합니다."},
    {month:"7월",title:"상반기의 결과",detail:"선언과 실행의 차이를 평가하고, 하반기의 선택을 수정합니다."},
    {month:"8월",title:"용기 있는 시도",detail:"미뤄 온 시도를 구체적인 행동으로 옮기고 반응을 확인합니다."},
    {month:"9월",title:"나의 리더십",detail:"함께 일하는 관계에서 책임과 영향력을 행동으로 연습합니다."},
    {month:"10월",title:"삶의 방향과 소명",detail:"일·관계·신앙을 연결하며 앞으로의 방향을 구체화합니다."},
    {month:"11월",title:"나의 선택, 나의 증거",detail:"1년의 행동과 결과를 스스로 평가하고 다음 선택을 선언합니다."}
  ];

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
        <div class="nd-hero__headline"><p class="nd-eyebrow">NAL CLASS · 12월 시작</p><p class="nd-hero__name">나다움으로 자기경영하기</p><h1 id="nd-title"><span>나답게 살겠다는 말,</span><span>이제 <em>행동으로.</em></span></h1></div>
        <div class="nd-hero__support"><p class="nd-hero__description">나를 이해하는 배움에서<br>내 삶을 바꾸는 선택과 실행까지.</p><ul class="nd-hero__facts" aria-label="참여 안내"><li>19–39세 청년</li><li>2026.12–2027.11</li><li>월 4회 · 회당 2시간</li></ul><div class="nd-actions"><a class="nd-button nd-button--blue" href="${isDetail ? "#nd-membership" : ROOT}">${isDetail ? "멤버십 알아보기" : "12월 클래스 알아보기"}${arrow}</a><a class="nd-text-link" href="${isDetail ? "#nd-method" : "#nd-home-method"}">어떻게 진행되나요? <span aria-hidden="true">↓</span></a></div><p class="nd-hero__faith">${FAITH}</p></div>
      </div>
    </section>`;
  }

  function priceStrip(p) {
    const m = pricing(p);
    return `<div class="nd-price-strip"><div class="nd-wrap nd-price-strip__inner"><p>배우고, 실행하고,<br><strong>함께 결과를 확인하는 멤버십.</strong></p><div><span>월 멤버십</span><strong>${money(m.monthly)}<small>원 / 월</small></strong></div><div><span>1년 일시납</span><strong>${money(m.annual)}<small>원 / 년</small></strong>${m.saving > 0 ? `<small>월납 ${escape(m.months)}개월 대비 ${money(m.saving)}원 절약</small>` : ""}</div><a class="nd-text-link" href="${ROOT}#nd-membership">멤버십 안내 ${arrow}</a></div></div>`;
  }

  function steps(compact) {
    return `<ol class="nd-steps"><li><span class="nd-number">01</span><h3>깨달음</h3><p>${compact ? "관계와 선택 속에서 반복되는 나의 패턴을 발견합니다." : "대상관계이론과 심리·정신분석의 관점으로, 관계에서 만들어진 기대와 반복되는 선택을 살핍니다. 경제·경영·리더십을 내 삶의 질문에 연결합니다."}</p><strong>“나는 왜 이렇게 선택할까?”</strong></li><li><span class="nd-number">02</span><h3>선언과 실행</h3><p>${compact ? "내가 선택한 행동 하나를 선언하고, 실행에 필요한 n개의 행동으로 나눕니다." : "자신이 바꿀 행동 하나를 선언합니다. 스스로 필요한 만큼 n개의 구체적인 행동으로 나누고, 언제 무엇을 할지 정해 실행합니다."}</p><strong>“그래서, 무엇을 할 것인가?”</strong></li><li><span class="nd-number">03</span><h3>결과 자가평가</h3><p>${compact ? "실제로 한 행동과 결과를 확인하고, 다음 선택을 수정합니다." : "선언한 것과 실제로 한 것을 비교합니다. 어떤 결과가 생겼는지, 무엇을 배웠는지 스스로 평가하고 다음 행동을 선택합니다."}</p><strong>“무엇이 달라졌는가?”</strong></li></ol>`;
  }

  function rhythm(compact) {
    return `<div class="nd-rhythm"><div class="nd-section-heading"><div><p class="nd-eyebrow">한 달의 리듬</p><h2>배운 주, 실행한 주.<br>네 번의 만남이 이어집니다.</h2></div><p>클래스 2회 + 나눔 모임 2회<br>매회 2시간 · 한 달 총 8시간</p></div><ol class="nd-rhythm__list"><li><span>첫 번째 만남</span><h3>클래스</h3><p>이론으로 나를 이해하고<br>행동 하나를 선언합니다.</p><small>이론 · 티칭 80% / 코칭 20%</small></li><li><span>두 번째 만남</span><h3>나눔 모임</h3><p>실행을 나누고<br>막힌 지점을 구체화합니다.</p><small>실기 · 실행과 나눔</small></li><li><span>세 번째 만남</span><h3>클래스</h3><p>새로운 관점으로 배우고<br>실행할 선택을 다듬습니다.</p><small>이론 · 티칭 80% / 코칭 20%</small></li><li><span>네 번째 만남</span><h3>나눔 모임</h3><p>행동과 결과를 평가하고<br>다음 선택을 나눕니다.</p><small>실기 · 결과 자가평가</small></li></ol>${compact ? "" : '<p class="nd-caption">클래스에서 배운 내용을 나눔 모임에서 실제 경험으로 연결합니다. 한 번 선언한 행동을 여러 만남에 걸쳐 이어갈 수 있습니다.</p>'}</div>`;
  }

  function home(p) {
    return `<div class="nd nd-home">${hero(false)}${priceStrip(p)}<section class="nd-wrap nd-section" id="nd-home-method"><div class="nd-section-heading"><div><p class="nd-eyebrow">나다움을 찾는 방식</p><h2>깨닫고, 움직이고,<br>내 결과를 확인합니다.</h2></div><p>나답게 산다는 말을<br>내 삶에서 확인할 수 있도록.</p></div>${steps(true)}<a class="nd-text-link nd-section-link" href="${ROOT}#nd-method">클래스의 방식 자세히 보기 ${arrow}</a></section><section class="nd-wrap nd-section nd-section--ruled">${rhythm(true)}</section><div class="nd-home-end"><div class="nd-wrap"><p>2026년 12월,<br><strong>나다운 첫 행동을 시작하세요.</strong></p><a class="nd-button nd-button--light" href="${ROOT}">12월 클래스 알아보기 ${arrow}</a></div></div></div>`;
  }

  function feature(p) {
    const m = pricing(p);
    return `<section class="nd nd-feature" aria-labelledby="nd-feature-title"><a class="nd-feature__image" href="${ROOT}" aria-label="나다움으로 자기경영하기 자세히 보기">${picture("class_card", "나답게 살기 위한 한 걸음을 내딛는 청년", 1200, 1200)}</a><div class="nd-feature__copy"><p class="nd-eyebrow">NAL 대표 클래스 · 2026년 12월 시작</p><h2 id="nd-feature-title">나답게 살겠다는 말,<br><em>이제 행동으로.</em></h2><p class="nd-feature__name">나다움으로 자기경영하기</p><p>깨달음, 행동 하나의 선언과 실행,<br>결과 자가평가로 발견하는 나다움.</p><p class="nd-feature__meta">19–39세 · 월 4회 · 회당 2시간</p><div class="nd-feature__price"><span>월 멤버십 <strong>${money(m.monthly)}원</strong></span><span>1년 일시납 <strong>${money(m.annual)}원</strong></span></div><a class="nd-button nd-button--blue" href="${ROOT}">클래스 알아보기 ${arrow}</a><p class="nd-caption">${FAITH}</p></div></section>`;
  }

  function card(p) {
    const m = pricing(p);
    return `<article class="nd nd-card nal-card" data-catalog-id="${escape((p && p.id) || "nadaum-self-management")}"><a class="nd-card__image" href="${ROOT}" tabindex="-1" aria-hidden="true">${picture("class_card", "", 1200, 1200)}</a><div class="nd-card__body"><p class="nd-eyebrow">NAL CLASS · 12월 시작</p><h3><a href="${ROOT}">나다움으로 자기경영하기</a></h3><p>깨달음에서 행동으로.<br>실행과 결과에서 찾는 나다움.</p><p class="nd-card__meta">19–39세 · 월 4회 · 회당 2시간</p><div class="nd-card__prices"><span>월 멤버십 <strong>${money(m.monthly)}원</strong></span><span>1년 일시납 <strong>${money(m.annual)}원</strong></span></div></div></article>`;
  }

  function membership(p) {
    const m = pricing(p);
    return `<section class="nd-membership nd-section" id="nd-membership"><div class="nd-wrap"><div class="nd-section-heading"><div><p class="nd-eyebrow">MEMBERSHIP</p><h2>나를 위한 선택을,<br>삶의 행동으로 이어갈 시간.</h2></div><p>클래스와 나눔을 함께하는<br>나다움 멤버십을 선택하세요.</p></div><div class="nd-plans"><article class="nd-plan"><p class="nd-eyebrow">MONTHLY</p><h3>월 멤버십</h3><p class="nd-plan__price">${money(m.monthly)}<small>원 / 월</small></p><p>한 달, 네 번의 만남으로<br>배움과 실행을 이어갑니다.</p><ul><li>월 2회 이론 클래스</li><li>월 2회 실행 나눔 모임</li><li>회당 2시간 · 월 총 8시간</li></ul><a class="nd-button nd-button--outline" href="${contact("월 멤버십")}">월 멤버십 문의 ${arrow}</a></article><article class="nd-plan nd-plan--annual"><div class="nd-plan__top"><p class="nd-eyebrow">ANNUAL</p><span class="nd-plan__label">1년 일시납</span></div><h3>연간 멤버십</h3><p class="nd-plan__price">${money(m.annual)}<small>원 / 년</small></p><p>12개월의 선택과 실행을<br>하나의 과정으로 이어갑니다.</p><ul><li>12개월 클래스와 나눔 모임</li><li>총 48회 · 96시간</li><li>2026년 12월–2027년 11월</li></ul><a class="nd-button nd-button--blue" href="${contact("연간 멤버십")}">연간 멤버십 문의 ${arrow}</a>${m.saving > 0 ? `<p class="nd-plan__saving">월납 ${escape(m.months)}개월 ${money(m.total)}원 대비 <strong>${money(m.saving)}원 절약</strong></p>` : ""}</article></div><p class="nd-membership__note">상세 일정과 장소, 참여 신청은 문의를 통해 안내합니다.<br><a href="mailto:hello@daily-coach-ing.com">hello@daily-coach-ing.com</a></p></div></section>`;
  }

  function detail(p) {
    const months = p && Array.isArray(p.curriculum) && p.curriculum.length ? p.curriculum : defaults;
    const m = pricing(p);
    const faq = [
      ["기독교인이 아니어도 참여할 수 있나요?", FAITH + " 성경과 복음에 관한 질문을 나눌 수 있으며, 신앙에 관한 응답과 나눔은 자율입니다."],
      ["클래스와 나눔 모임은 어떻게 다른가요?", "클래스는 이론을 배우고 자신의 삶에 적용하는 시간으로, 티칭 80%와 코칭 20%로 진행합니다. 격주로 이어지는 나눔 모임에서는 실제로 실행한 행동과 결과를 나누고 서로 질문합니다."],
      ["매번 새로운 과제를 해야 하나요?", "자신이 선택한 행동 하나를 선언하고, 실행에 필요한 n개의 행동으로 스스로 나눕니다. 모두에게 같은 수의 과제를 부여하지 않습니다. 한 번 선언한 행동을 여러 만남에 걸쳐 실행하고 수정할 수 있습니다."],
      ["결과 자가평가는 어떻게 하나요?", "선언한 행동, 실제로 한 행동, 나타난 결과를 비교합니다. 실행하지 못한 부분도 구체적으로 살피고, 자신에 대해 새롭게 알게 된 점과 다음에 바꿀 선택을 정합니다."],
      ["월 멤버십과 연간 멤버십의 차이는 무엇인가요?", "월 멤버십은 월 " + money(m.monthly) + "원이며, 연간 멤버십은 1년 일시납 " + money(m.annual) + "원입니다. " + (m.saving > 0 ? "월납 " + m.months + "개월 합계 " + money(m.total) + "원과 비교해 " + money(m.saving) + "원을 절약합니다. " : "") + "두 방식 모두 해당 기간의 클래스와 나눔 모임에 참여합니다."],
      ["언제, 어디서 진행하나요?", "2026년 12월부터 2027년 11월까지, 월 4회·회당 2시간으로 진행합니다. 구체적인 날짜와 시간, 장소 및 참여 신청은 멤버십 문의를 통해 안내합니다."]
    ];
    return `<div class="nd nd-detail">${hero(true)}<nav class="nd-subnav" aria-label="클래스 소개 목차"><div class="nd-wrap"><a href="#nd-method">진행 방식</a><a href="#nd-year">12개월 과정</a><a href="#nd-coach">함께할 코치</a><a href="#nd-membership">멤버십</a></div></nav><section class="nd-wrap nd-section nd-questions"><p class="nd-eyebrow">지금, 내 삶의 질문</p><h2>생각은 많이 했는데,<br>내 선택은 달라졌나요?</h2><div class="nd-questions__grid"><p>관계가 바뀌어도<br><strong>왜 비슷한 상황이 반복될까?</strong></p><p>내가 원하는 삶과<br><strong>지금 쓰는 시간과 돈은 연결될까?</strong></p><p>다른 사람의 기대를 넘어<br><strong>나는 어떤 선택을 할 것인가?</strong></p></div><p class="nd-intro">나다움은 이해에서 시작해, 선택과 행동에서 구체화됩니다.<br>이 클래스는 내 삶의 패턴을 읽고, 행동을 선택하고, 그 결과를 스스로 확인하는 12개월의 과정입니다.</p></section><section class="nd-method nd-section" id="nd-method"><div class="nd-wrap"><div class="nd-section-heading"><div><p class="nd-eyebrow">이 클래스의 핵심</p><h2>깨달음이<br>다음 행동을 바꾸도록.</h2></div><p>심리 · 대상관계이론 · 정신분석<br>경제 · 경영 · 리더십 · 기독교 신앙</p></div>${steps(false)}</div><div class="nd-wrap nd-image-story"><figure>${picture("action", "자신이 선택한 행동을 여러 단계로 나누어 배치하는 손", 1600, 1200)}<figcaption>하나의 선언을 실제로 움직일 수 있는 행동으로.</figcaption></figure><div class="nd-image-story__copy"><p class="nd-eyebrow">한 사람, 하나의 선언</p><h3>“그래서 나는<br>무엇을 하겠습니다.”</h3><p>선언은 구체적일수록 실행에 가까워집니다. 해야 할 일을 스스로 나누고, 자신의 삶에서 시도합니다.</p><div class="nd-action-example"><span>예를 들면</span><p><strong>“관계를 잘하고 싶다”</strong>는 바람에서<br><strong>“미뤄 온 대화를 먼저 제안하겠다”</strong>는 행동으로.</p></div><p>나누는 행동의 수는 정해져 있지 않습니다. 내 상황에서 실행할 수 있는 단위와 순서를 스스로 정합니다.</p></div></div></section><section class="nd-wrap nd-section" id="nd-month">${rhythm(false)}<div class="nd-image-story nd-image-story--reverse"><figure>${picture("gather", "푸른 의자를 옮겨 함께 앉을 자리를 만드는 청년들", 1600, 1200)}<figcaption>내가 한 일을 말하고, 서로의 선택을 듣는 자리.</figcaption></figure><div class="nd-image-story__copy"><p class="nd-eyebrow">함께 나누는 실기</p><h3>실행한 뒤에<br>다시 만납니다.</h3><p>무엇을 선언했는지, 실제로 무엇을 했는지, 어떤 결과가 생겼는지 이야기합니다.</p><p>동료의 질문으로 놓친 장면을 발견하고, 자신의 평가를 바탕으로 다음 선택을 정합니다.</p><strong class="nd-pullquote">“이 결과에서, 나는 나에 대해<br>무엇을 알게 되었나?”</strong></div></div></section><section class="nd-year nd-section" id="nd-year"><div class="nd-wrap"><div class="nd-section-heading"><div><p class="nd-eyebrow">2026.12 — 2027.11</p><h2>한 해의 생활 속에서,<br>나다움을 연습합니다.</h2></div><p>연말의 돌아봄부터 새해의 결심,<br>새로운 시작과 관계, 일과 돈까지.</p></div><ol class="nd-curriculum">${months.map((item) => `<li><span class="nd-curriculum__month">${escape(item.month)}</span><h3>${escape(item.title)}</h3><p>${escape(item.detail)}</p></li>`).join("")}</ol><p class="nd-caption">매월 클래스 → 나눔 모임 → 클래스 → 나눔 모임의 흐름으로 진행합니다.</p></div></section><section class="nd-wrap nd-section nd-coach" id="nd-coach"><div><p class="nd-eyebrow">함께할 코치</p><h2>김철웅 코치</h2><p class="nd-coach__role">나다움으로 자기경영하기 · 진행</p><a class="nd-text-link" href="/nal/host/kim-cheol-woong/">코치 소개 더 보기 ${arrow}</a></div><div><p class="nd-coach__lead">내 삶의 질문을<br>실행 가능한 선택으로.</p><p>관계에서 반복되는 반응과 일상의 선택을 살피고, 배운 내용을 자신의 행동으로 옮기는 과정을 함께합니다.</p><ul class="nd-coach__facts"><li><strong>KPC</strong><span>한국코치협회 인증</span></li><li><strong>11년</strong><span>코칭 경력</span></li><li><strong>5,000시간+</strong><span>1:1 코칭</span></li></ul></div></section><section class="nd-faith"><div class="nd-wrap nd-faith__inner"><p class="nd-eyebrow">이 클래스가 품은 관점</p><div><h2>삶의 질문에서,<br>신앙의 질문까지.</h2><p>${FAITH}</p><p>정체성과 관계, 책임과 소명을 이야기하며 성경과 복음의 메시지를 함께 살핍니다. 자신의 질문을 가져오고, 서로 다른 생각을 나눌 수 있습니다. 신앙에 관한 응답과 나눔은 자율입니다.</p></div></div></section>${membership(p)}<section class="nd-wrap nd-section nd-faq" id="nd-faq"><div class="nd-section-heading"><div><p class="nd-eyebrow">참여 전 궁금한 점</p><h2>자주 묻는 질문</h2></div></div><div class="nd-faq__list">${faq.map(([q, a]) => `<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join("")}</div></section><div class="nd-detail-end"><div class="nd-wrap"><p>나답게 살겠다는 말,<br><strong>당신의 행동으로 이어가세요.</strong></p><a class="nd-button nd-button--blue" href="#nd-membership">멤버십 선택하기 ${arrow}</a></div></div></div>`;
  }

  window.NALNadaum = Object.freeze({home, feature, detail, card});
}());
