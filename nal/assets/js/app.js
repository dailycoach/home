(() => {
  "use strict";

  const DATA_BASE = "/nal/data";
  const STORAGE = {
    wishlist: "nal:wishlist:v1",
    recent: "nal:recent:v1"
  };
  const DEFAULT_NAV = [
    ["모임", "NAL GATHER", "/nal/gather/"],
    ["원데이", "NAL CLASS", "/nal/class/"],
    ["스토어", "NAL SHOP", "/nal/shop/"],
    ["콘텐츠", "NAL NOTE", "/nal/note/"],
    ["진행자", "NAL HOST", "/nal/host/"],
    ["MY NAL", "MY NAL", "/nal/my/"]
  ];
  const ICONS = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 5.9a5.5 5.5 0 0 0-7.8 0L12 7l-1.1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 22l8.8-8.3a5.5 5.5 0 0 0 0-7.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  const body = document.body;
  const root = document.querySelector("[data-page-root]");
  const headerSlot = document.querySelector("[data-site-header]");
  const footerSlot = document.querySelector("[data-site-footer]");
  const mobileCtaSlot = document.querySelector("[data-mobile-cta]");
  const toastNode = document.querySelector("[data-toast]");
  const page = body.dataset.page || "home";
  const collection = body.dataset.collection || "";
  const pageType = body.dataset.type || "";
  const slug = body.dataset.slug || new URLSearchParams(location.search).get("slug") || "";
  let lastDrawerTrigger = null;
  let state = {
    site: null,
    programs: [],
    products: [],
    hosts: [],
    content: [],
    errors: []
  };

  const asArray = (value) => Array.isArray(value) ? value : [];

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const safeUrl = (value) => {
    if (!value) return "";
    const input = String(value).trim();
    try {
      const url = new URL(input, location.origin);
      if (url.protocol === "mailto:") {
        return /^mailto:[^\s"'<>]+$/i.test(input) ? input : "";
      }
      if (!["http:", "https:"].includes(url.protocol)) return "";
      const relative = !/^[a-z][a-z\d+.-]*:/i.test(input) && !input.startsWith("//");
      return relative ? `${url.pathname}${url.search}${url.hash}` : url.href;
    } catch {
      return "";
    }
  };

  const externalAttrs = (value) => {
    try {
      const url = new URL(value, location.origin);
      return ["http:", "https:"].includes(url.protocol) && url.origin !== location.origin
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";
    } catch {
      return "";
    }
  };

  const publicItems = (items) => asArray(items).filter((item) => item && item.published === true);
  const byId = (items, id) => asArray(items).find((item) => item.id === id);
  const statusLabel = (value) =>
    state.site?.statusLabels?.[value] ||
    ({ draft: "초안", comingSoon: "준비 중", open: "모집 중", closing: "마감 임박", waiting: "대기 신청", closed: "신청 마감", completed: "종료" }[value] || "상태 확인");

  function itemRoute(kind, item) {
    const itemSlug = encodeURIComponent(String(item?.slug || ""));
    if (kind === "programs") return `/nal/${item?.type === "class" ? "class" : "gather"}/${itemSlug}/`;
    if (kind === "products") return `/nal/shop/${itemSlug}/`;
    if (kind === "hosts") return `/nal/host/${itemSlug}/`;
    return `/nal/note/${itemSlug}/`;
  }

  function readLocal(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      showToast("이 브라우저에서는 로컬 저장을 사용할 수 없습니다.");
      return false;
    }
  }

  const wishKey = (kind, id) => `${kind}:${id}`;
  const isWished = (key) => readLocal(STORAGE.wishlist).includes(key);

  function toggleWish(key) {
    const current = readLocal(STORAGE.wishlist);
    const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
    if (!writeLocal(STORAGE.wishlist, next)) return;
    document.querySelectorAll("[data-wish-key]").forEach((button) => {
      const active = next.includes(button.dataset.wishKey);
      button.setAttribute("aria-pressed", String(active));
      const label = button.querySelector("[data-wish-label]");
      if (label) label.textContent = active ? "찜 해제" : "찜하기";
    });
    updateWishCount(next.length);
    showToast(next.includes(key) ? "MY NAL에 찜했습니다." : "찜에서 해제했습니다.");
    if (page === "my") renderCurrentPage();
  }

  function remember(kind, id) {
    const key = wishKey(kind, id);
    const current = readLocal(STORAGE.recent).filter((item) => item !== key);
    writeLocal(STORAGE.recent, [key, ...current].slice(0, 12));
  }

  function showToast(message) {
    if (!toastNode) return;
    toastNode.textContent = message;
    toastNode.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toastNode.classList.remove("is-visible");
      setTimeout(() => { toastNode.textContent = ""; }, 200);
    }, 2600);
  }

  function updateWishCount(count = readLocal(STORAGE.wishlist).length) {
    document.querySelectorAll("[data-wish-count]").forEach((node) => {
      node.textContent = String(count);
      node.hidden = count === 0;
    });
  }

  function imageMarkup(src, alt, className = "") {
    const url = safeUrl(src);
    if (!url) {
      return `<div class="nal-media-placeholder ${className}" role="img" aria-label="${escapeHtml(alt)}"><span>IMAGE / READY</span></div>`;
    }
    return `<img class="${className}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  }

  function renderHeader(site = null) {
    if (!headerSlot) return;
    const nav = site?.navigation?.primary?.map((item) => [item.label, item.nalLabel, item.href]) || DEFAULT_NAV;
    const currentPath = location.pathname;
    const navLinks = nav
      .map(([label, nalLabel, href]) => {
        const active = href === "/nal/" ? currentPath === href : currentPath.startsWith(href);
        return `<li><a class="nal-nav__link" href="${href}"${active ? ' aria-current="page"' : ""}>${escapeHtml(label)}</a></li>`;
      })
      .join("");
    const drawerLinks = nav
      .map(([label, nalLabel, href]) => `<li><a class="nal-drawer__link" href="${href}"><span>${escapeHtml(label)}</span><small>${escapeHtml(nalLabel)}</small></a></li>`)
      .join("");

    headerSlot.innerHTML = `
      <header class="nal-site-header">
        <div class="nal-container nal-header__inner">
          <a class="nal-logo" href="/nal/" aria-label="NAL 홈"><span class="nal-logo__mark">N</span>NAL</a>
          <nav class="nal-nav" aria-label="주요 메뉴"><ul class="nal-nav__list">${navLinks}</ul></nav>
          <ul class="nal-header-actions" aria-label="사용자 메뉴">
            <li><a class="nal-icon-button" href="/nal/search/">${ICONS.search}<span class="nal-icon-button__label">검색</span></a></li>
            <li><a class="nal-icon-button" href="/nal/my/#wishlist">${ICONS.heart}<span class="nal-icon-button__label">찜</span><span class="nal-icon-button__count" data-wish-count hidden>0</span></a></li>
            <li><button class="nal-menu-button" type="button" data-drawer-open aria-controls="nalDrawer" aria-expanded="false">${ICONS.menu}<span class="nal-sr-only">메뉴 열기</span></button></li>
          </ul>
        </div>
      </header>
      <div class="nal-drawer" id="nalDrawer" data-state="closed" aria-hidden="true">
        <button class="nal-drawer__backdrop" type="button" data-drawer-close tabindex="-1" aria-label="메뉴 닫기"></button>
        <div class="nal-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="nalDrawerTitle">
          <div class="nal-drawer__header">
            <strong class="nal-logo" id="nalDrawerTitle"><span class="nal-logo__mark">N</span>NAL</strong>
            <button class="nal-close-button" type="button" data-drawer-close>${ICONS.close}<span class="nal-sr-only">메뉴 닫기</span></button>
          </div>
          <nav aria-label="모바일 메뉴"><ul class="nal-drawer__nav">${drawerLinks}</ul></nav>
          <div class="nal-drawer__utility">
            <a class="nal-button--ghost" href="/nal/search/">검색</a>
            <a class="nal-button--ghost" href="/nal/my/">MY NAL</a>
          </div>
        </div>
      </div>`;
    updateWishCount();
  }

  function renderFooter(site = null) {
    if (!footerSlot) return;
    const inquiry = safeUrl(site?.externalLinks?.inquiry);
    footerSlot.innerHTML = `
      <footer class="nal-footer">
        <div class="nal-container nal-footer__grid">
          <div><a class="nal-logo nal-footer__logo" href="/nal/">NAL</a><p>취향과 마음을 주제로 만나는 큐레이션 플랫폼.</p>${inquiry ? `<p><a href="${escapeHtml(inquiry)}">운영 문의</a></p>` : ""}</div>
          <div><h2>NAL</h2><ul class="nal-footer__links">
            <li><a href="/nal/gather/">모임</a></li><li><a href="/nal/class/">원데이</a></li><li><a href="/nal/shop/">스토어</a></li>
            <li><a href="/nal/note/">콘텐츠</a></li><li><a href="/nal/host/">진행자</a></li><li><a href="/nal/my/">MY NAL</a></li>
          </ul></div>
          <div><h2>운영 안내</h2><ul class="nal-footer__links">
            <li><a href="/nal/notice/">공지사항</a></li><li><a href="/nal/faq/">FAQ</a></li><li><a href="/nal/partnership/">입점·제휴 문의</a></li>
            <li><a href="/nal/policy/terms/">이용약관</a></li><li><a href="/nal/policy/privacy/">개인정보처리방침</a></li>
            <li><a href="/nal/policy/cancellation/">취소·환불</a></li><li><a href="/nal/policy/shipping/">배송·교환</a></li>
          </ul></div>
        </div>
        <div class="nal-container nal-footer__bottom"><span>© ${new Date().getFullYear()} NAL</span><span>날빛 운영</span></div>
      </footer>`;
  }

  function openDrawer(trigger) {
    const drawer = document.querySelector("#nalDrawer");
    if (!drawer) return;
    lastDrawerTrigger = trigger;
    drawer.dataset.state = "open";
    drawer.setAttribute("aria-hidden", "false");
    trigger?.setAttribute("aria-expanded", "true");
    body.classList.add("is-scroll-locked");
    if (root) root.inert = true;
    if (footerSlot) footerSlot.inert = true;
    drawer.querySelector("[data-drawer-close]:not(.nal-drawer__backdrop)")?.focus();
  }

  function closeDrawer() {
    const drawer = document.querySelector("#nalDrawer");
    if (!drawer || drawer.dataset.state !== "open") return;
    drawer.dataset.state = "closed";
    drawer.setAttribute("aria-hidden", "true");
    document.querySelector("[data-drawer-open]")?.setAttribute("aria-expanded", "false");
    body.classList.remove("is-scroll-locked");
    if (root) root.inert = false;
    if (footerSlot) footerSlot.inert = false;
    lastDrawerTrigger?.focus();
  }

  function trapDrawerFocus(event) {
    const drawer = document.querySelector("#nalDrawer");
    if (!drawer || drawer.dataset.state !== "open") return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...drawer.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((node) => !node.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function badgeClass(item) {
    if (item.type === "gather") return "nal-badge--gather";
    if (item.type === "class") return "nal-badge--class";
    return "nal-badge--neutral";
  }

  function formatDate(item) {
    if (!item.startDate) return "";
    const date = new Date(`${item.startDate}T00:00:00`);
    if (Number.isNaN(date.valueOf())) return "";
    return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(date);
  }

  function formatPrice(value) {
    return typeof value === "number" ? `${new Intl.NumberFormat("ko-KR").format(value)}원` : "";
  }

  function stockLabel(value) {
    return ({ comingSoon: "준비 중", inStock: "구매 가능", available: "구매 가능", soldOut: "품절", outOfStock: "품절" })[value] || "";
  }

  function isThisWeek(value) {
    if (!value) return false;
    const target = new Date(`${value}T00:00:00`);
    if (Number.isNaN(target.valueOf())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    return target >= monday && target < nextMonday;
  }

  function wishButton(kind, item, detailed = false) {
    const key = wishKey(kind, item.id);
    const active = isWished(key);
    return `<button class="${detailed ? "nal-button--ghost" : "nal-wish-button nal-wish-button--text"}" type="button" data-wish-key="${escapeHtml(key)}" aria-pressed="${active}">${ICONS.heart}<span data-wish-label>${active ? "찜 해제" : "찜하기"}</span></button>`;
  }

  function programCard(item) {
    const route = itemRoute("programs", item);
    const date = formatDate(item);
    const facts = [
      date,
      item.startTime && item.endTime ? `${item.startTime}–${item.endTime}` : "",
      item.location || (item.format === "online" ? "온라인" : ""),
      item.duration,
      Number.isFinite(item.remainingSeats) ? `잔여 ${item.remainingSeats}석` : ""
    ].filter(Boolean);
    const price = formatPrice(item.price);
    return `<article class="nal-card nal-card--${item.type}">
      <div class="nal-card__media">
        ${imageMarkup(item.coverImage, `${item.title} 대표 이미지`)}
        <div class="nal-card__badges"><span class="nal-badge ${badgeClass(item)}">${item.type === "gather" ? "커뮤니티" : "클래스"}</span><span class="nal-badge--status">${escapeHtml(statusLabel(item.status))}</span></div>
        <div class="nal-card__wish">${wishButton("programs", item)}</div>
      </div>
      <div class="nal-card__body">
        <p class="nal-card__eyebrow">${item.type === "gather" ? "NAL GATHER" : "NAL CLASS"}</p>
        <h3 class="nal-card__title"><a href="${route}">${escapeHtml(item.title)}</a></h3>
        <p class="nal-card__summary">${escapeHtml(item.summary)}</p>
        ${facts.length ? `<div class="nal-card__details">${facts.map((fact) => `<span class="nal-card__detail"><span aria-hidden="true">·</span><span>${escapeHtml(fact)}</span></span>`).join("")}</div>` : ""}
        <div class="nal-card__footer"><span class="nal-card__delivery">${price || "일정·참가비 확정 후 공개"}</span><span aria-hidden="true">→</span></div>
      </div>
    </article>`;
  }

  function productCard(item) {
    const route = itemRoute("products", item);
    return `<article class="nal-card nal-card--product">
      <div class="nal-card__media">${imageMarkup(item.coverImage, `${item.title} 상품 이미지`)}<div class="nal-card__badges"><span class="nal-badge--shop">NAL SHOP</span></div><div class="nal-card__wish">${wishButton("products", item)}</div></div>
      <div class="nal-card__body"><p class="nal-card__eyebrow">${escapeHtml(item.category)}</p><h3 class="nal-card__title"><a href="${route}">${escapeHtml(item.title)}</a></h3>
      <p class="nal-card__summary">${escapeHtml(item.summary)}</p><div class="nal-card__footer"><span class="nal-card__delivery">${formatPrice(item.price) || "가격 확정 후 공개"}</span><span>${escapeHtml(stockLabel(item.stockStatus))}</span></div></div>
    </article>`;
  }

  function hostCard(item) {
    return `<article class="nal-card nal-card--host"><div class="nal-card__media">${imageMarkup(item.profileImage, `${item.name} 진행자 프로필`)}</div><div class="nal-card__body">
      <p class="nal-card__eyebrow">NAL HOST</p><h3 class="nal-card__title"><a href="${itemRoute("hosts", item)}">${escapeHtml(item.name)}</a></h3>
      <p class="nal-card__summary">${escapeHtml(item.headline)}</p><p class="nal-card__delivery">${escapeHtml(asArray(item.fields).join(" · ") || "진행 분야 확인")}</p>
    </div></article>`;
  }

  function noteCard(item) {
    return `<article class="nal-card nal-card--note"><div class="nal-card__body"><p class="nal-card__eyebrow">NAL NOTE · ${escapeHtml(item.category)}</p>
      <h3 class="nal-card__title"><a href="${itemRoute("content", item)}">${escapeHtml(item.title)}</a></h3><p class="nal-card__summary">${escapeHtml(item.summary)}</p>
      <div class="nal-card__footer"><span>${item.readingTime ? `${escapeHtml(item.readingTime)}분 읽기` : "원문 안내"}</span><span aria-hidden="true">→</span></div></div></article>`;
  }

  function emptyState(title, copy, action = "") {
    return `<div class="nal-empty"><p class="nal-eyebrow">NAL / HONEST STATUS</p><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p>${action}</div>`;
  }

  function section({ label, title, copy = "", content, action = "" }) {
    return `<section class="nal-section home-section"><div class="nal-container">
      <div class="nal-section__header"><div><p class="nal-eyebrow">${escapeHtml(label)}</p><h2>${escapeHtml(title)}</h2>${copy ? `<p>${escapeHtml(copy)}</p>` : ""}</div>${action}</div>
      ${content}
    </div></section>`;
  }

  function renderHome() {
    const programs = publicItems(state.programs);
    const featured = programs.find((item) => item.featured && !["closed", "completed"].includes(item.status))
      || programs.find((item) => !["closed", "completed"].includes(item.status))
      || programs[0];
    const recruiting = programs.filter((item) => ["open", "closing", "waiting"].includes(item.status));
    const classes = programs.filter((item) => item.type === "class" && ["open", "closing", "waiting"].includes(item.status) && isThisWeek(item.startDate));
    const gathers = programs.filter((item) => item.type === "gather" && !["closed", "completed"].includes(item.status));
    const products = publicItems(state.products).filter((item) => item.featured);
    const hosts = publicItems(state.hosts).filter((item) => item.featured || item.programIds?.length);
    const notes = publicItems(state.content).filter((item) => item.featured);
    const smartStore = safeUrl(state.site?.externalLinks?.smartStore);

    const heroFeature = featured
      ? `<article class="nal-hero__feature nal-card--class">${imageMarkup(featured.coverImage, `${featured.title} 대표 이미지`)}<div class="nal-hero__feature-copy"><span class="nal-badge--class">${escapeHtml(statusLabel(featured.status))}</span><h2>${escapeHtml(featured.title)}</h2><p>${escapeHtml(featured.summary)}</p><a class="nal-button--secondary" href="${itemRoute("programs", featured)}">과정 미리보기</a></div></article>`
      : emptyState("대표 프로그램 준비 중", "확인된 모집 정보가 등록되면 이곳에서 가장 먼저 안내합니다.");

    root.innerHTML = `
      <section class="nal-hero nal-home-hero"><div class="nal-container nal-hero__grid">
        <div class="nal-hero__copy"><p class="nal-eyebrow">NAL / CURATED COMMUNITY</p><h1>오늘, 조금 다른 사람들과<br><span>조금 더 나다운 시간을.</span></h1><p>취향과 마음이 만나는 커뮤니티와 원데이클래스,<br>그리고 일상에서 사용하는 감정·코칭 도구.</p>
          <div class="nal-hero__actions"><a class="nal-button--primary" href="/nal/gather/">모집 중인 모임 보기</a><a class="nal-button--secondary" href="/nal/class/">원데이클래스 찾기</a></div>
        </div>${heroFeature}
      </div></section>
      ${section({ label: "01 / NOW OPEN", title: "지금 모집 중", copy: "현재 신청 가능한 프로그램만 먼저 보여드립니다.", content: recruiting.length ? `<div class="card-grid">${recruiting.map(programCard).join("")}</div>` : emptyState("현재 공개된 모집 일정이 없습니다.", "임의의 날짜나 잔여 좌석을 만들지 않습니다. 실제 일정이 확정되면 모집 상태와 함께 공개합니다."), action: '<a class="nal-text-link" href="/nal/gather/">NAL GATHER 보기 →</a>' })}
      ${section({ label: "02 / THIS WEEK", title: "이번 주 원데이클래스", copy: "가볍게 한 번 참여할 수 있는 프로그램.", content: classes.length ? `<div class="card-grid">${classes.map(programCard).join("")}</div>` : emptyState("이번 주 일정 등록 전입니다.", "날짜·시간·장소가 확인된 클래스만 이 영역에 노출합니다."), action: '<a class="nal-text-link" href="/nal/class/">전체 클래스 보기 →</a>' })}
      ${section({ label: "03 / KEEP MEETING", title: "계속 만나는 커뮤니티", copy: "원데이와 구분되는 정기·시즌·자유 모임.", content: gathers.length ? `<div class="card-grid">${gathers.map(programCard).join("")}</div>` : emptyState("공개된 커뮤니티가 아직 없습니다.", "운영 기간·주기·규칙이 확정된 모임부터 공개합니다.") })}
      ${section({ label: "04 / NAL SHOP", title: "말로 꺼내기 어려운 마음을 한 장의 카드에서", copy: "감정을 발견하고 대화를 시작하며 생각을 기록하는 도구.", content: products.length ? `<div class="card-grid">${products.map(productCard).join("")}</div>` : emptyState("NAL 상품 카탈로그 준비 중", "상품 구성·가격·배송 정보가 확인되기 전에는 구매 버튼을 노출하지 않습니다.", smartStore ? `<a class="nal-button--lime" href="${smartStore}"${externalAttrs(smartStore)}>운영 중인 스마트스토어 보기</a>` : ""), action: '<a class="nal-text-link" href="/nal/shop/">NAL SHOP 보기 →</a>' })}
      ${section({ label: "05 / USED TOGETHER", title: "모임에서 사용한 도구", copy: "실제로 연결된 프로그램과 상품만 함께 보여드립니다.", content: emptyState("공개 가능한 연결 상품이 없습니다.", "판매를 위한 억지 연결 없이 실제 사용 관계가 확인된 항목만 공개합니다.") })}
      ${section({ label: "06 / NAL HOST", title: "추천 진행자", copy: "자격보다 먼저 어떤 방식으로 진행하는지 확인하세요.", content: hosts.length ? `<div class="card-grid">${hosts.map(hostCard).join("")}</div>` : emptyState("진행자 프로필 준비 중", "NAL이 검토한 진행자만 공개합니다."), action: '<a class="nal-text-link" href="/nal/host/">전체 진행자 보기 →</a>' })}
      ${section({ label: "07 / EXPERIENCE", title: "참여자 경험", copy: "칭찬보다 실제 참여 조건과 발견을 기록합니다.", content: emptyState("공개 동의가 확인된 후기가 아직 없습니다.", "민감한 경험을 임의로 만들거나 공개하지 않습니다.") })}
      ${section({ label: "08 / NAL NOTE", title: "관심에서 다음 경험으로", copy: "마음·관계·도구 활용법을 관련 프로그램과 연결합니다.", content: notes.length ? `<div class="card-grid">${notes.map(noteCard).join("")}</div>` : emptyState("새 콘텐츠 준비 중", "출처와 관련 프로그램이 확인된 글부터 공개합니다."), action: '<a class="nal-text-link" href="/nal/note/">NAL NOTE 보기 →</a>' })}
      <section class="nal-letter"><div class="nal-container nal-letter__grid"><div><p class="nal-eyebrow">09 / NAL LETTER</p><h2>새로운 모임과 클래스,<br>일상에서 사용할 질문을.</h2><p>구독 시스템 연결 전에는 이메일을 입력받지 않습니다.</p></div><div class="nal-letter__form" aria-label="NAL LETTER 준비 상태"><input type="email" placeholder="이메일 구독 준비 중" disabled aria-label="이메일 구독 준비 중"><button class="nal-button--primary" type="button" disabled>구독 준비 중</button></div></div></section>`;
  }

  function getListingItems() {
    let items = publicItems(state[collection] || []);
    if (pageType) items = items.filter((item) => item.type === pageType);
    const params = new URLSearchParams(location.search);
    const q = (params.get("q") || "").trim().toLocaleLowerCase("ko");
    const category = params.get("category") || "";
    const status = params.get("status") || "";
    if (q) items = items.filter((item) => [item.title, item.name, item.summary, item.description, item.headline, item.bio, ...asArray(item.tags), ...asArray(item.fields)].filter(Boolean).join(" ").toLocaleLowerCase("ko").includes(q));
    if (category) items = items.filter((item) => item.category === category || item.fields?.includes(category));
    if (status) items = items.filter((item) => item.status === status || item.stockStatus === status);
    const allowedSorts = ["recommended", "closing", "nearest", "newest", "lowPrice"];
    const sort = allowedSorts.includes(params.get("sort")) ? params.get("sort") : "recommended";
    const dateValue = (item) => item.startDate ? Date.parse(item.startDate) : Number.MAX_SAFE_INTEGER;
    if (sort === "nearest") items.sort((a, b) => dateValue(a) - dateValue(b));
    if (sort === "closing") items.sort((a, b) => (a.status === "closing" ? -1 : 1) - (b.status === "closing" ? -1 : 1));
    if (sort === "newest") items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    if (sort === "lowPrice") items.sort((a, b) => (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER));
    if (sort === "recommended") items.sort((a, b) => Number(b.featured) - Number(a.featured));
    return items;
  }

  function listingConfig() {
    if (collection === "programs") return pageType === "gather"
      ? ["NAL GATHER", "계속 만나며 조금씩 달라지는 모임", state.site?.categories?.gather || [], programCard]
      : ["NAL CLASS", "한 번의 참여로 새로운 장면을 여는 시간", state.site?.categories?.class || [], programCard];
    if (collection === "products") return ["NAL SHOP", "감정과 대화를 위한 자기이해 도구", state.site?.categories?.shop || [], productCard];
    if (collection === "hosts") return ["NAL HOST", "어떻게 진행하는지 먼저 보여주는 사람들", [], hostCard];
    return ["NAL NOTE", "읽고 끝나지 않는 다음 경험의 기록", state.site?.categories?.note || [], noteCard];
  }

  function renderListing() {
    const [label, title, categories, card] = listingConfig();
    const params = new URLSearchParams(location.search);
    const items = getListingItems();
    const q = params.get("q") || "";
    root.innerHTML = `
      <section class="nal-page-hero"><div class="nal-container"><p class="nal-eyebrow">${label}</p><h1>${title}</h1><p>확인되지 않은 일정·가격·잔여 좌석은 표시하지 않습니다.</p></div></section>
      <section class="nal-section nal-listing"><div class="nal-container">
        <form class="nal-filter-bar" data-filter-form role="search">
          <label class="nal-form-field nal-filter-search"><span>검색</span><input type="search" name="q" value="${escapeHtml(q)}" placeholder="주제나 이름으로 검색"></label>
          ${categories.length ? `<label class="nal-form-field"><span>카테고리</span><select name="category" data-filter><option value="">전체</option>${categories.filter((value) => !value.startsWith("전체") && value !== "지난 모임").map((value) => `<option value="${escapeHtml(value)}"${params.get("category") === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>` : ""}
          ${collection === "programs" ? `<label class="nal-form-field"><span>모집 상태</span><select name="status" data-filter><option value="">전체</option>${["open","closing","waiting","closed","completed","comingSoon"].map((value) => `<option value="${value}"${params.get("status") === value ? " selected" : ""}>${statusLabel(value)}</option>`).join("")}</select></label>` : ""}
          <label class="nal-form-field"><span>정렬</span><select name="sort" data-filter><option value="recommended"${!params.get("sort") || params.get("sort") === "recommended" ? " selected" : ""}>추천순</option><option value="closing"${params.get("sort") === "closing" ? " selected" : ""}>마감 임박순</option><option value="nearest"${params.get("sort") === "nearest" ? " selected" : ""}>가까운 일정순</option><option value="newest"${params.get("sort") === "newest" ? " selected" : ""}>신규 등록순</option><option value="lowPrice"${params.get("sort") === "lowPrice" ? " selected" : ""}>낮은 가격순</option></select></label>
          <button class="nal-button--primary" type="submit">적용</button>
        </form>
        <div class="nal-result-summary" role="status"><strong>${items.length}</strong>개의 공개 항목${q ? ` · “${escapeHtml(q)}” 검색 결과` : ""}</div>
        ${items.length ? `<div class="card-grid">${items.map(card).join("")}</div>` : emptyState("조건에 맞는 공개 항목이 없습니다.", "초안 데이터나 확인되지 않은 일정은 목록에 노출하지 않습니다.", '<a class="nal-button--secondary" href="' + location.pathname + '">필터 초기화</a>')}
      </div></section>`;
  }

  function detailFacts(item) {
    const facts = [
      ["일정", formatDate(item)],
      ["시간", item.startTime && item.endTime ? `${item.startTime}–${item.endTime}` : ""],
      ["장소", item.location || (item.format === "online" ? "온라인" : "")],
      ["소요 시간", item.duration],
      ["회차", item.sessionCount ? `${item.sessionCount}회` : ""],
      ["정원", Number.isFinite(item.capacity) ? `${item.capacity}명` : ""],
      ["잔여 좌석", Number.isFinite(item.remainingSeats) ? `${item.remainingSeats}석` : ""],
      ["참가비", formatPrice(item.price)]
    ].filter(([, value]) => value);
    return facts.length ? `<dl class="nal-detail-facts">${facts.map(([key, value]) => `<div><dt>${key}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>` : '<p class="nal-honest-note">일정·장소·참가비는 확정 후 공개합니다.</p>';
  }

  function detailCta(item, kind) {
    const sourceUrl = safeUrl(item.sourceUrl);
    if (kind === "programs") {
      const applicationUrl = safeUrl(item.applicationUrl);
      if (["open", "closing"].includes(item.status) && applicationUrl) return [applicationUrl, "신청하기", statusLabel(item.status)];
      if (item.status === "waiting" && applicationUrl) return [applicationUrl, "대기 신청", statusLabel(item.status)];
      if (sourceUrl) return [sourceUrl, "과정 자세히 보기", statusLabel(item.status || "comingSoon")];
      if (item.status === "closed") return ["", "신청 마감", statusLabel(item.status)];
      if (item.status === "completed") return ["", "종료된 프로그램", statusLabel(item.status)];
      return ["", item.status === "waiting" ? "대기 신청 준비 중" : "다음 일정 준비 중", statusLabel(item.status || "comingSoon")];
    }
    if (kind === "products") {
      const purchaseUrl = safeUrl(item.purchaseUrl || item.externalPurchaseUrl);
      const unavailable = ["comingSoon", "soldOut", "outOfStock"].includes(item.stockStatus) || (typeof item.stock === "number" && item.stock <= 0);
      if (!unavailable && ["inStock", "available"].includes(item.stockStatus) && purchaseUrl) return [purchaseUrl, "구매하기", stockLabel(item.stockStatus)];
      if (sourceUrl) return [sourceUrl, "상품 자세히 보기", stockLabel(item.stockStatus) || "판매 상태 확인"];
      return ["", ["soldOut", "outOfStock"].includes(item.stockStatus) ? "품절" : "구매 준비 중", stockLabel(item.stockStatus) || "준비 중"];
    }
    if (sourceUrl) return [sourceUrl, "원문 보기", "공개 콘텐츠"];
    return ["", "원문 준비 중", "준비 중"];
  }

  function renderProgramDetail(item) {
    remember("programs", item.id);
    const host = byId(publicItems(state.hosts), item.hostId);
    const relatedContent = publicItems(state.content).filter((entry) => item.relatedContentIds?.includes(entry.id));
    const relatedProducts = publicItems(state.products).filter((entry) => item.productIds?.includes(entry.id));
    const [ctaUrl, ctaLabel, ctaState] = detailCta(item, "programs");
    root.innerHTML = `
      <section class="nal-detail-hero"><div class="nal-container nal-detail-hero__grid"><div class="nal-detail-hero__copy"><p class="nal-eyebrow">${item.type === "gather" ? "NAL GATHER" : "NAL CLASS"}</p><div class="nal-detail-hero__badges"><span class="nal-badge ${badgeClass(item)}">${escapeHtml(statusLabel(item.status))}</span><span class="nal-badge--neutral">${escapeHtml(item.category)}</span></div><h1>${escapeHtml(item.title)}</h1><p class="nal-detail-hero__lead">${escapeHtml(item.summary)}</p>${detailFacts(item)}<div class="nal-detail-actions">${wishButton("programs", item, true)}${ctaUrl ? `<a class="nal-button--primary" href="${ctaUrl}"${externalAttrs(ctaUrl)}>${ctaLabel}</a>` : `<button class="nal-button--primary" type="button" disabled>${ctaLabel}</button>`}</div></div><div class="nal-detail-hero__media">${imageMarkup(item.coverImage, `${item.title} 대표 이미지`)}</div></div></section>
      <div class="nal-container nal-detail-layout"><article class="nal-detail-content">
        <section class="nal-detail-section"><p class="nal-eyebrow">WHY THIS</p><h2>이 프로그램을 만든 이유</h2><p>${escapeHtml(item.description)}</p></section>
        <section class="nal-detail-section"><p class="nal-eyebrow">FOR YOU</p><h2>이런 주제를 살펴봅니다</h2><div class="nal-chip-list">${(item.tags || []).map((tag) => `<span class="nal-filter-chip">${escapeHtml(tag)}</span>`).join("")}</div></section>
        <section class="nal-detail-section"><p class="nal-eyebrow">PRACTICAL</p><h2>준비물과 제공 항목</h2><div class="nal-grid nal-grid--two"><div><h3>준비물</h3>${item.materials?.length ? `<ul>${item.materials.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>` : "<p>확정 후 안내합니다.</p>"}</div><div><h3>제공 항목</h3>${item.includedItems?.length ? `<ul>${item.includedItems.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>` : "<p>확정 후 안내합니다.</p>"}</div></div></section>
        ${host ? `<section class="nal-detail-section"><p class="nal-eyebrow">NAL HOST</p><h2>진행자</h2><div class="nal-host-profile">${imageMarkup(host.profileImage, `${host.name} 프로필`)}<div><h3><a href="${itemRoute("hosts", host)}">${escapeHtml(host.name)}</a></h3><p>${escapeHtml(host.headline)}</p><p>${escapeHtml(host.bio)}</p></div></div></section>` : ""}
        <section class="nal-detail-section nal-safety-guide"><p class="nal-eyebrow">SAFE PARTICIPATION</p><h2>안전한 참여를 위한 약속</h2>${item.safetyGuide?.length ? `<ul>${item.safetyGuide.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>` : "<p>모임별 안전 안내 확정 후 공개합니다.</p>"}</section>
        <section class="nal-detail-section"><p class="nal-eyebrow">POLICY</p><h2>취소·환불 안내</h2><p>${escapeHtml(item.refundPolicy || "실제 모집 조건과 신청 채널이 확정된 후 해당 프로그램의 규정을 공개합니다.")}</p></section>
        ${relatedProducts.length ? `<section class="nal-detail-section"><p class="nal-eyebrow">RELATED TOOLS</p><h2>함께 사용하는 도구</h2><div class="card-grid">${relatedProducts.map(productCard).join("")}</div></section>` : ""}
        ${relatedContent.length ? `<section class="nal-detail-section"><p class="nal-eyebrow">RELATED NOTE</p><h2>관련 콘텐츠</h2><div class="card-grid">${relatedContent.map(noteCard).join("")}</div></section>` : ""}
      </article><aside class="nal-detail-aside"><div class="nal-detail-booking"><span>${escapeHtml(ctaState)}</span><strong>${formatPrice(item.price) || "참가비 확정 후 공개"}</strong>${ctaUrl ? `<a class="nal-button--primary" href="${ctaUrl}"${externalAttrs(ctaUrl)}>${ctaLabel}</a>` : `<button class="nal-button--primary" disabled>${ctaLabel}</button>`}</div></aside></div>`;
    renderStickyCta(ctaState, ctaLabel, ctaUrl);
  }

  function renderHostDetail(item) {
    remember("hosts", item.id);
    const programs = publicItems(state.programs).filter((entry) => item.programIds?.includes(entry.id));
    const notes = publicItems(state.content).filter((entry) => item.contentIds?.includes(entry.id));
    const sourceUrl = safeUrl(item.sourceUrl);
    root.innerHTML = `<section class="nal-detail-hero"><div class="nal-container nal-detail-hero__grid"><div class="nal-detail-hero__copy"><p class="nal-eyebrow">NAL HOST</p><h1>${escapeHtml(item.name)}</h1><p class="nal-detail-hero__lead">${escapeHtml(item.headline)}</p><p>${escapeHtml(item.bio || "공개된 상세 소개는 원문 프로필에서 확인할 수 있습니다.")}</p>${sourceUrl ? `<a class="nal-button--secondary" href="${escapeHtml(sourceUrl)}"${externalAttrs(sourceUrl)}>원문 프로필 보기</a>` : ""}</div><div class="nal-detail-hero__media">${imageMarkup(item.profileImage, `${item.name} 진행자 프로필`)}</div></div></section>
      <section class="nal-section"><div class="nal-container nal-detail-content"><div class="nal-detail-section"><p class="nal-eyebrow">HOW I HOST</p><h2>진행 방식과 전문 영역</h2><div class="nal-chip-list">${(item.fields || []).map((value) => `<span class="nal-filter-chip">${escapeHtml(value)}</span>`).join("")}</div></div>
      ${item.credentials?.length ? `<div class="nal-detail-section"><p class="nal-eyebrow">PROFILE</p><h2>주요 경력과 자격</h2><ul>${item.credentials.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></div>` : ""}
      <div class="nal-detail-section"><p class="nal-eyebrow">CURRENT PROGRAM</p><h2>현재 공개된 프로그램</h2>${programs.length ? `<div class="card-grid">${programs.map(programCard).join("")}</div>` : emptyState("공개된 프로그램이 없습니다.", "실제 모집 정보가 연결되면 이곳에 표시합니다.")}</div>
      ${notes.length ? `<div class="nal-detail-section"><p class="nal-eyebrow">RELATED NOTE</p><h2>관련 콘텐츠</h2><div class="card-grid">${notes.map(noteCard).join("")}</div></div>` : ""}</div></section>`;
  }

  function renderContentDetail(item) {
    remember("content", item.id);
    const programs = publicItems(state.programs).filter((entry) => item.relatedProgramIds?.includes(entry.id));
    const [url, label] = detailCta(item, "content");
    const bodyCopy = typeof item.body === "string" && item.body.trim()
      ? item.body.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")
      : "<p>이 페이지는 확인된 원문 안내와 관련 프로그램을 연결합니다. 원문 내용은 출처 페이지에서 확인해 주세요.</p>";
    root.innerHTML = `<article><header class="nal-page-hero"><div class="nal-container nal-container--narrow"><p class="nal-eyebrow">NAL NOTE · ${escapeHtml(item.category)}</p><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.summary)}</p></div></header><div class="nal-container nal-container--narrow nal-prose">${bodyCopy}${url ? `<p><a class="nal-button--primary" href="${escapeHtml(url)}"${externalAttrs(url)}>${escapeHtml(label)}</a></p>` : ""}</div></article>
      ${programs.length ? section({ label: "RELATED PROGRAM", title: "이 콘텐츠와 연결된 프로그램", content: `<div class="card-grid">${programs.map(programCard).join("")}</div>` }) : ""}`;
  }

  function renderProductDetail(item) {
    remember("products", item.id);
    const [url, label, status] = detailCta(item, "products");
    const policies = [item.shippingPolicy, item.exchangePolicy, item.refundPolicy].filter(Boolean);
    root.innerHTML = `<section class="nal-detail-hero"><div class="nal-container nal-detail-hero__grid"><div class="nal-detail-hero__copy"><p class="nal-eyebrow">NAL SHOP</p><h1>${escapeHtml(item.title)}</h1><p class="nal-detail-hero__lead">${escapeHtml(item.summary)}</p><p>${formatPrice(item.price) || "가격 확정 후 공개"}</p><div class="nal-detail-actions">${wishButton("products", item, true)}${url ? `<a class="nal-button--primary" href="${escapeHtml(url)}"${externalAttrs(url)}>${escapeHtml(label)}</a>` : `<button class="nal-button--primary" disabled>${escapeHtml(label)}</button>`}</div></div><div class="nal-detail-hero__media">${imageMarkup(item.coverImage, `${item.title} 상품 이미지`)}</div></div></section><section class="nal-section"><div class="nal-container nal-detail-content"><div class="nal-detail-section"><h2>상품이 필요한 상황</h2><p>${escapeHtml(item.description)}</p></div><div class="nal-detail-section"><h2>사용 방법</h2><h3>혼자</h3><p>${escapeHtml(item.usageIndividual || "사용법 확정 후 공개")}</p><h3>커플·가족</h3><p>${escapeHtml(item.usageCouple || "사용법 확정 후 공개")}</p><h3>모임</h3><p>${escapeHtml(item.usageGroup || "사용법 확정 후 공개")}</p></div><div class="nal-detail-section"><h2>배송·교환·환불</h2>${policies.length ? `<ul>${policies.map((policy) => `<li>${escapeHtml(policy)}</li>`).join("")}</ul>` : "<p>실제 판매 채널과 상품 유형이 확정된 뒤 해당 정책을 공개합니다.</p>"}</div></div></section>`;
    renderStickyCta(status, label, url);
  }

  function renderDetail() {
    const items = publicItems(state[collection] || []);
    const item = items.find((entry) => entry.slug === slug);
    if (!item) {
      root.innerHTML = `<section class="nal-section"><div class="nal-container">${emptyState("공개된 정보를 찾을 수 없습니다.", "초안이거나 주소가 변경된 항목입니다.", '<a class="nal-button--secondary" href="/nal/">NAL 홈으로</a>')}</div></section>`;
      document.title = "페이지를 찾을 수 없음 | NAL";
      return;
    }
    if (collection === "programs") renderProgramDetail(item);
    else if (collection === "products") renderProductDetail(item);
    else if (collection === "hosts") renderHostDetail(item);
    else renderContentDetail(item);
  }

  function resolveKey(key) {
    const [kind, id] = key.split(":");
    const item = byId(publicItems(state[kind] || []), id);
    return item ? { kind, item } : null;
  }

  function mixedCard(entry) {
    if (entry.kind === "programs") return programCard(entry.item);
    if (entry.kind === "products") return productCard(entry.item);
    if (entry.kind === "hosts") return hostCard(entry.item);
    return noteCard(entry.item);
  }

  function renderMy() {
    const wishes = readLocal(STORAGE.wishlist).map(resolveKey).filter(Boolean);
    const recent = readLocal(STORAGE.recent).map(resolveKey).filter(Boolean);
    root.innerHTML = `<section class="nal-page-hero"><div class="nal-container"><p class="nal-eyebrow">MY NAL / LOCAL</p><h1>내가 남겨둔 NAL의 장면들</h1><p>찜과 최근 본 항목은 로그인 없이 현재 기기에만 저장됩니다. 신청·구매 내역이 아닙니다.</p></div></section>
      <section class="nal-section" id="wishlist"><div class="nal-container"><div class="nal-section__header"><div><p class="nal-eyebrow">LOCAL WISHLIST</p><h2>찜한 항목</h2></div></div>${wishes.length ? `<div class="card-grid">${wishes.map(mixedCard).join("")}</div>` : emptyState("찜한 항목이 없습니다.", "모임이나 프로그램 카드의 ‘찜하기’를 눌러 이 기기에 저장할 수 있습니다.")}</div></section>
      <section class="nal-section"><div class="nal-container"><div class="nal-section__header"><div><p class="nal-eyebrow">RECENTLY VIEWED</p><h2>최근 본 항목</h2></div>${recent.length ? '<button class="nal-button--ghost" type="button" data-clear-recent>최근 기록 지우기</button>' : ""}</div>${recent.length ? `<div class="card-grid">${recent.map(mixedCard).join("")}</div>` : emptyState("최근 본 항목이 없습니다.", "상세 페이지를 열면 이 기기에만 최근 기록이 남습니다.")}</div></section>
      <section class="nal-section"><div class="nal-container">${emptyState("회원형 MY NAL은 2차 구축 범위입니다.", "신청한 모임, 구매한 상품, 디지털 다운로드, 후기와 팔로우 기능은 회원·결제 시스템을 연결한 뒤 제공합니다.")}</div></section>`;
  }

  function searchCorpus() {
    return [
      ...publicItems(state.programs).map((item) => ({ kind: "programs", item })),
      ...publicItems(state.products).map((item) => ({ kind: "products", item })),
      ...publicItems(state.hosts).map((item) => ({ kind: "hosts", item })),
      ...publicItems(state.content).map((item) => ({ kind: "content", item }))
    ];
  }

  function renderSearch() {
    const q = (new URLSearchParams(location.search).get("q") || "").trim();
    const lowered = q.toLocaleLowerCase("ko");
    const results = lowered
      ? searchCorpus().filter(({ item }) => [item.title, item.name, item.summary, item.description, item.headline, item.bio, item.body, item.category, ...asArray(item.tags), ...asArray(item.fields)].filter(Boolean).join(" ").toLocaleLowerCase("ko").includes(lowered))
      : [];
    root.innerHTML = `<section class="nal-page-hero"><div class="nal-container nal-container--narrow"><p class="nal-eyebrow">NAL SEARCH</p><h1>지금 필요한 경험을 한 번에</h1><form class="nal-search-form" role="search" data-search-form><label class="nal-sr-only" for="nalSearch">NAL 검색</label><input id="nalSearch" type="search" name="q" value="${escapeHtml(q)}" placeholder="모임, 클래스, 도구, 진행자 검색" required><button class="nal-button--primary" type="submit">검색</button></form></div></section>
      <section class="nal-section"><div class="nal-container">${!q ? emptyState("검색어를 입력해 주세요.", "공개된 프로그램·도구·진행자·콘텐츠만 검색합니다.") : results.length ? `<div class="nal-result-summary" role="status">“${escapeHtml(q)}” 검색 결과 <strong>${results.length}</strong>개</div><div class="card-grid">${results.map(mixedCard).join("")}</div>` : emptyState("검색 결과가 없습니다.", "다른 주제나 진행자 이름으로 검색해 보세요.")}</div></section>`;
  }

  function renderInfo() {
    const sectionName = body.dataset.section;
    const inquiry = safeUrl(state.site?.externalLinks?.inquiry);
    const info = {
      notice: ["NAL NOTICE", "공지사항", "현재 공개된 운영 공지가 없습니다.", "확인된 일정과 운영 변경만 이곳에 게시합니다."],
      faq: ["NAL FAQ", "자주 묻는 질문", "NAL은 어떤 플랫폼인가요?", "NAL은 커뮤니티와 원데이클래스, 감정·코칭 도구를 연결하는 큐레이션 플랫폼입니다."],
      partnership: ["NAL PARTNERSHIP", "입점·제휴 문의", "누구나 즉시 등록하는 오픈마켓이 아닙니다.", "프로그램의 실제 운영 방식, 참여 안전 기준, 상품 정보와 사용 권한을 확인한 뒤 협업을 검토합니다."],
      terms: ["NAL POLICY", "이용약관", "정식 약관 공개 전입니다.", "운영 주체와 서비스 범위에 대한 법적 검토가 끝나기 전에는 약관이 확정된 것처럼 표시하지 않습니다."],
      privacy: ["NAL POLICY", "개인정보처리방침", "개인정보 수집 기능 연결 전입니다.", "현재 NAL은 서버로 개인정보를 받지 않으며, 찜과 최근 본 항목은 이 기기의 로컬 저장소에만 남습니다."],
      cancellation: ["NAL POLICY", "취소·환불 규정", "프로그램별 실제 규정 확정 전입니다.", "일정·참가비·신청 채널이 확정되면 프로그램 상세에 적용되는 취소·노쇼·환불 기준을 함께 공개합니다."],
      shipping: ["NAL POLICY", "배송·교환 안내", "판매 상품과 배송 방식 확정 전입니다.", "상품 유형, 출고 주체, 배송비와 교환 조건이 확인되기 전에는 정책을 만들어 표시하지 않습니다."]
    }[sectionName] || ["NAL INFO", "운영 안내", "안내 준비 중입니다.", "확인된 내용만 공개합니다."];
    const extra = sectionName === "faq"
      ? `<div class="nal-faq"><details><summary>일정과 가격은 어디에서 확인하나요?</summary><p>실제 모집이 시작된 프로그램의 상세 페이지와 연결된 신청 채널에서 확인합니다.</p></details><details><summary>혼자 참여해도 되나요?</summary><p>프로그램마다 다릅니다. 확인된 경우에만 ‘혼자 참여 가능’ 정보를 표시합니다.</p></details><details><summary>감정카드는 진단 도구인가요?</summary><p>아닙니다. 감정을 발견하고 대화를 시작하며 생각을 기록하도록 돕는 자기이해 도구입니다.</p></details><details><summary>말하고 싶지 않은 이야기도 해야 하나요?</summary><p>참여자는 답변을 거절하거나 활동을 쉬고 중단할 수 있습니다. 프로그램별 안전 안내를 확인해 주세요.</p></details></div>`
      : sectionName === "partnership"
        ? inquiry ? `<p><a class="nal-button--primary" href="${escapeHtml(inquiry)}">이메일로 문의하기</a></p>` : "<p>운영 문의 경로를 준비 중입니다.</p>"
        : "";
    root.innerHTML = `<section class="nal-page-hero"><div class="nal-container nal-container--narrow"><p class="nal-eyebrow">${info[0]}</p><h1>${info[1]}</h1><p>${info[2]}</p></div></section><section class="nal-section"><div class="nal-container nal-container--narrow nal-prose"><p>${info[3]}</p>${extra}</div></section>`;
  }

  function renderStickyCta(status, label, url) {
    if (!mobileCtaSlot) return;
    mobileCtaSlot.innerHTML = `<div class="nal-sticky-cta"><div><span>${escapeHtml(status || "상태 확인")}</span><strong>${escapeHtml(label)}</strong></div>${url ? `<a class="nal-button--primary" href="${url}"${externalAttrs(url)}>${escapeHtml(label)}</a>` : `<button class="nal-button--primary" disabled>${escapeHtml(label)}</button>`}</div>`;
  }

  function renderCurrentPage() {
    if (mobileCtaSlot) mobileCtaSlot.innerHTML = "";
    if (page === "home") renderHome();
    else if (page === "listing") renderListing();
    else if (page === "detail") renderDetail();
    else if (page === "my") renderMy();
    else if (page === "search") renderSearch();
    else renderInfo();
    renderLoadNotice();
    updateWishCount();
  }

  function renderLoadNotice() {
    if (!root || page === "info" || !state.errors.length) return;
    root.insertAdjacentHTML("afterbegin", `<div class="nal-container"><div class="nal-error" role="alert"><strong>일부 정보를 불러오지 못했습니다.</strong><p>불러온 공개 정보만 표시하고 있습니다.</p><button class="nal-button--secondary" type="button" data-retry-data>다시 시도</button></div></div>`);
  }

  function updateQuery(form) {
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) if (String(value).trim()) params.set(key, String(value).trim());
    const url = `${location.pathname}${params.size ? `?${params}` : ""}`;
    history.pushState({}, "", url);
    renderCurrentPage();
  }

  async function loadData() {
    const entries = [
      ["site", "site.json", "site"],
      ["programs", "programs.json", "programs"],
      ["products", "products.json", "products"],
      ["hosts", "hosts.json", "hosts"],
      ["content", "content.json", "content"]
    ];
    state.errors = [];
    const loaded = await Promise.allSettled(entries.map(async ([name, file, key]) => {
      const response = await fetch(`${DATA_BASE}/${file}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
      const data = await response.json();
      return [name, key === "site" ? data : asArray(data[key])];
    }));
    loaded.forEach((result, index) => {
      const name = entries[index][0];
      if (result.status === "fulfilled") state[result.value[0]] = result.value[1];
      else {
        state.errors.push(name);
        if (name !== "site") state[name] = [];
      }
    });
  }

  document.addEventListener("click", (event) => {
    const open = event.target.closest("[data-drawer-open]");
    if (open) return openDrawer(open);
    if (event.target.closest("[data-drawer-close]")) return closeDrawer();
    const wish = event.target.closest("[data-wish-key]");
    if (wish) {
      event.preventDefault();
      return toggleWish(wish.dataset.wishKey);
    }
    if (event.target.closest("[data-clear-recent]")) {
      if (window.confirm("이 기기의 최근 본 기록을 지울까요?")) {
        writeLocal(STORAGE.recent, []);
        renderCurrentPage();
        showToast("최근 본 기록을 지웠습니다.");
      }
    }
    if (event.target.closest("[data-retry-data]")) {
      loadData().then(() => {
        renderHeader(state.site);
        renderFooter(state.site);
        renderCurrentPage();
        showToast(state.errors.length ? "일부 정보를 여전히 불러오지 못했습니다." : "정보를 다시 불러왔습니다.");
      });
    }
  });
  document.addEventListener("keydown", trapDrawerFocus);
  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-filter-form], [data-search-form]");
    if (!form) return;
    event.preventDefault();
    updateQuery(form);
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-filter]")) updateQuery(event.target.form);
  });
  addEventListener("popstate", renderCurrentPage);

  async function init() {
    renderHeader();
    renderFooter();
    try {
      await loadData();
      renderHeader(state.site);
      renderFooter(state.site);
      renderCurrentPage();
    } catch (error) {
      if (root) root.innerHTML = `<section class="nal-section"><div class="nal-container"><div class="nal-error" role="alert"><p class="nal-eyebrow">NAL / ERROR</p><h1>정보를 불러오지 못했습니다.</h1><p>잠시 후 새로고침해 주세요. 오류가 계속되면 NAL 홈에서 다시 시작할 수 있습니다.</p><a class="nal-button--secondary" href="/nal/">NAL 홈으로</a></div></div></section>`;
    }
  }

  init();
})();
