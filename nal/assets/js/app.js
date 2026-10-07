(() => {
  "use strict";

  const DATA_BASE = "/nal/data";
  const STORAGE = {
    wishlist: "nal:wishlist:v1",
    recent: "nal:recent:v1"
  };
  const DEFAULT_NAV = [
    ["모임", "NAL GATHER", "/nal/gather/"],
    ["클래스", "NAL CLASS", "/nal/class/"],
    ["마음도구", "NAL MIND TOOLS", "/nal/shop/"],
    ["이야기", "NAL NOTE", "/nal/note/"]
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
    launches: null,
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
    ({ draft: "초안", comingSoon: "준비 중", open: "모집 중", closing: "마감 예정", waiting: "대기 신청", closed: "신청 마감", completed: "종료" }[value] || "상태 확인");

  function itemRoute(kind, item) {
    const itemSlug = encodeURIComponent(String(item?.slug || ""));
    if (kind === "programs") return `/nal/${item?.type === "class" ? "class" : "gather"}/${itemSlug}/`;
    if (kind === "products") return globalThis.NALProductRoutes?.includes(item.slug) ? `/nal/shop/${itemSlug}/` : `/nal/shop/item/?slug=${itemSlug}`;
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

  function imageMarkup(src, alt, className = "", options = {}) {
    const url = safeUrl(src);
    if (!url) {
      return `<div class="nal-media-placeholder ${className}" role="img" aria-label="${escapeHtml(alt)}"><span>IMAGE / READY</span></div>`;
    }
    const mobileUrl = safeUrl(options.mobileSrc);
    const loading = options.eager ? "eager" : "lazy";
    const priority = options.eager ? ' fetchpriority="high"' : "";
    const width = Number.isFinite(options.width) ? ` width="${options.width}"` : "";
    const height = Number.isFinite(options.height) ? ` height="${options.height}"` : "";
    const image = `<img class="nal-catalog-image ${className}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="${loading}" decoding="async" referrerpolicy="no-referrer" data-image-fallback="${escapeHtml(alt)}"${width}${height}${priority}>`;
    if (!mobileUrl) return image;
    return `<picture class="nal-media-picture ${escapeHtml(options.pictureClass || "")}"><source media="(max-width: 47.999rem)" srcset="${escapeHtml(mobileUrl)}">${image}</picture>`;
  }

  function renderHeader(site = null) {
    if (!headerSlot) return;
    const nav = DEFAULT_NAV;
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

    const themeControl = `<label class="nal-theme-control"><span>테마</span><select data-nal-theme aria-label="화면 테마"><option value="system">기기 설정</option><option value="light">밝게</option><option value="dark">어둡게</option></select></label>`;

    headerSlot.innerHTML = `
      <header class="nal-site-header">
        <div class="nal-container nal-header__inner">
          <a class="nal-logo" href="/nal/" aria-label="NAL 홈"><span class="nal-logo__mark">N</span>NAL</a>
          <nav class="nal-nav" aria-label="주요 메뉴"><ul class="nal-nav__list">${navLinks}</ul></nav>
          <ul class="nal-header-actions" aria-label="사용자 메뉴">
            <li class="nal-header-theme">${themeControl}</li>
            <li><a class="nal-icon-button" href="/nal/search/">${ICONS.search}<span class="nal-icon-button__label">검색</span></a></li>
            <li><a class="nal-icon-button" href="/nal/my/#wishlist">${ICONS.heart}<span class="nal-icon-button__label">내 관심</span><span class="nal-icon-button__count" data-wish-count hidden>0</span></a></li>
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
            <div class="nal-drawer-theme">${themeControl}<p>선택한 테마는 이 브라우저에 저장됩니다.</p></div>
            <a class="nal-button--ghost" href="/nal/search/">검색</a>
            <a class="nal-button--ghost" href="/nal/my/">MY NAL</a>
          </div>
        </div>
      </div>`;
    updateWishCount();
    document.dispatchEvent(new CustomEvent("nal:page-rendered", { detail: { launches: state.launches } }));
  }

  function renderFooter(site = null) {
    if (!footerSlot) return;
    const inquiry = safeUrl(site?.externalLinks?.inquiry);
    footerSlot.innerHTML = `
      <footer class="nal-footer">
        <div class="nal-container nal-footer__grid">
          <div><a class="nal-logo nal-footer__logo" href="/nal/">NAL</a><p>취향과 마음을 주제로 만나는 큐레이션 플랫폼.</p>${inquiry ? `<p><a href="${escapeHtml(inquiry)}">운영 문의</a></p>` : ""}</div>
          <div><h2>NAL</h2><ul class="nal-footer__links">
            <li><a href="/nal/gather/">모임</a></li><li><a href="/nal/class/">원데이</a></li><li><a href="/nal/shop/">마음도구</a></li>
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
    return `<article class="nal-card nal-card--${item.type}" data-catalog-id="${escapeHtml(item.id)}">
      <div class="nal-card__media">
        ${imageMarkup(item.coverImage, item.coverImageAlt || `${item.title} 대표 이미지`, "", { mobileSrc: item.coverImageMobile, width: 1600, height: 1000 })}
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

  function isDigitalProduct(item) {
    return globalThis.NALStore.digital(item);
  }

  function productFormatLabel(item) {
    if (isDigitalProduct(item)) return globalThis.NALStore.types[globalThis.NALStore.type(item)] || "디지털 자료";
    if (globalThis.NALStore.types[item.productType]) return globalThis.NALStore.types[item.productType];
    if (item.productType === "card") return "실물 카드";
    if (item.productType === "workbook") return "워크북";
    if (item.productType === "kit") return "키트";
    return item.category || "마음도구";
  }

  function digitalDeliveryLabel(item) {
    if (!isDigitalProduct(item)) return "";
    if (item.deliveryMethod === "digital-download") return "디지털 다운로드";
    if (item.deliveryMethod === "email") return "이메일 제공";
    return item.deliveryMethod || "제공 방식 확정 전";
  }

  function licenseLabel(item) {
    if (item.licenseType === "personal-use") return "개인 이용";
    if (item.licenseType === "facilitator-use") return "진행자 이용";
    if (item.licenseType === "organization-use") return "기관 이용";
    return "";
  }

  function productCard(item) {
    const route = itemRoute("products", item);
    const digital = isDigitalProduct(item);
    const meta = [
      digital ? item.fileFormat || (globalThis.NALStore.type(item)?.startsWith("pdf") ? "PDF" : "디지털 파일") : productFormatLabel(item),
      Number.isInteger(item.pageCount) && item.pageCount > 0 ? `${item.pageCount}쪽` : "",
      licenseLabel(item)
    ].filter(Boolean).join(" · ");
    return `<article class="nal-card nal-card--product${digital ? " nal-card--digital" : ""}" data-catalog-id="${escapeHtml(item.id)}">
      <div class="nal-card__media">${imageMarkup(globalThis.NALStore.safePublicUrl(item.coverImage), item.coverImageAlt || `${item.title} 상품 이미지`, "", { width: digital ? 1200 : 1600, height: digital ? 1600 : 1600 })}<div class="nal-card__badges"><span class="nal-badge--shop">${digital ? escapeHtml(item.fileFormat || (globalThis.NALStore.type(item)?.startsWith("pdf") ? "PDF" : "디지털 파일")) : "실물"}</span></div><div class="nal-card__wish">${wishButton("products", item)}</div></div>
      <div class="nal-card__body"><p class="nal-card__eyebrow">${escapeHtml(productFormatLabel(item))}</p><h3 class="nal-card__title"><a href="${route}">${escapeHtml(item.title)}</a></h3>
      <p class="nal-card__summary">${escapeHtml(item.summary)}</p>${meta ? `<p class="nal-card__product-meta">${escapeHtml(meta)}</p>` : ""}<div class="nal-card__footer"><span class="nal-card__delivery">${item.price === 0 ? "무료" : formatPrice(item.price) || "판매 준비 중"}</span><span>${escapeHtml(stockLabel(item.stockStatus))}</span></div></div>
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

  const featuredOrder = (item) => Number.isFinite(item?.featuredOrder) ? item.featuredOrder : Number.MAX_SAFE_INTEGER;
  const sortFeatured = (items) => [...items]
    .filter((item) => item.featured)
    .sort((a, b) => featuredOrder(a) - featuredOrder(b) || String(a.title).localeCompare(String(b.title), "ko"));

  function relationCard(program, product) {
    return `<article class="nal-relation-card">
      <div class="nal-relation-card__visuals" aria-hidden="true">
        <div>${imageMarkup(program.coverImage, "", "", { mobileSrc: program.coverImageMobile, width: 1600, height: 1000 })}</div>
        <span aria-hidden="true">+</span>
        <div>${imageMarkup(product.coverImage, "", "", { width: 1600, height: 1600 })}</div>
      </div>
      <div class="nal-relation-card__copy"><p class="nal-eyebrow">${program.type === "gather" ? "NAL GATHER" : "NAL CLASS"} × NAL MIND TOOLS</p>
        <h3><a href="${itemRoute("programs", program)}">${escapeHtml(program.title)}</a></h3>
        <p>${escapeHtml(product.title)}와 함께 사용하는 경험</p>
        <a class="nal-text-link" href="${itemRoute("products", product)}">도구 보기 →</a>
      </div>
    </article>`;
  }

  function renderHome() {
    const programs = publicItems(state.programs);
    const activePrograms = programs.filter((item) => !["closed", "completed"].includes(item.status));
    const featuredClass = sortFeatured(activePrograms.filter((item) => item.type === "class"))[0]
      || activePrograms.find((item) => item.type === "class");
    const featuredGather = sortFeatured(activePrograms.filter((item) => item.type === "gather"))[0]
      || activePrograms.find((item) => item.type === "gather");
    const recruiting = programs.filter((item) => ["open", "closing", "waiting"].includes(item.status));
    const classes = programs.filter((item) => item.type === "class" && ["open", "closing", "waiting"].includes(item.status) && isThisWeek(item.startDate));
    const gathers = sortFeatured(activePrograms.filter((item) => item.type === "gather"));
    const products = sortFeatured(publicItems(state.products)).sort((a, b) => Number(isDigitalProduct(b)) - Number(isDigitalProduct(a)) || featuredOrder(a) - featuredOrder(b));
    const featuredProduct = products[0];
    const hosts = publicItems(state.hosts).filter((item) => item.featured || item.programIds?.length);
    const notes = publicItems(state.content).filter((item) => item.featured);
    const smartStore = safeUrl(state.site?.externalLinks?.smartStore);
    const curated = [featuredClass, featuredGather, featuredProduct].filter(Boolean);
    const relations = products.flatMap((product) => asArray(product.relatedProgramIds)
      .map((id) => programs.find((program) => program.id === id))
      .filter(Boolean)
      .map((program) => ({ program, product })));

    const heroFeature = featuredClass
      ? `<article class="nal-hero__feature nal-card--class">${imageMarkup(featuredClass.coverImage, featuredClass.coverImageAlt || `${featuredClass.title} 대표 이미지`, "", { mobileSrc: featuredClass.coverImageMobile, eager: true, width: 1600, height: 1000 })}<div class="nal-hero__feature-copy"><span class="nal-badge--class">${escapeHtml(statusLabel(featuredClass.status))}</span><h2>${escapeHtml(featuredClass.title)}</h2><p>${escapeHtml(featuredClass.summary)}</p><a class="nal-button--secondary" href="${itemRoute("programs", featuredClass)}">클래스 미리보기</a></div></article>`
      : emptyState("대표 프로그램 준비 중", "확인된 모집 정보가 등록되면 이곳에서 가장 먼저 안내합니다.");

    root.innerHTML = `
      <section class="nal-hero nal-home-hero"><div class="nal-container nal-hero__grid">
        <div class="nal-hero__copy"><p class="nal-eyebrow">NAL / CURATED COMMUNITY</p><h1>오늘, 조금 다른 사람들과<br><span>조금 더 나다운 시간을.</span></h1><p>취향과 마음이 만나는 커뮤니티와 원데이클래스,<br>그리고 일상에서 사용하는 감정·코칭 도구.</p>
          <div class="nal-hero__actions"><a class="nal-button--primary" href="/nal/gather/">모집 중인 모임 보기</a><a class="nal-button--secondary" href="/nal/class/">원데이클래스 찾기</a></div>
        </div>${heroFeature}
      </div></section>
      ${section({ label: "00 / CURATED THREE", title: "NAL에서 먼저 만날 세 가지", copy: "클래스·모임·도구를 하나씩 골라 서로 다른 경험을 함께 보여드립니다.", content: curated.length ? `<div class="nal-curation-grid">${featuredClass ? programCard(featuredClass) : ""}${featuredGather ? programCard(featuredGather) : ""}${featuredProduct ? productCard(featuredProduct) : ""}</div>` : emptyState("대표 큐레이션 준비 중", "공개된 클래스·모임·상품이 연결되면 이곳에 표시합니다.") })}
      ${section({ label: "01 / NOW OPEN", title: "지금 모집 중", copy: "현재 신청 가능한 프로그램만 먼저 보여드립니다.", content: recruiting.length ? `<div class="card-grid">${recruiting.map(programCard).join("")}</div>` : emptyState("현재 공개된 모집 일정이 없습니다.", "임의의 날짜나 잔여 좌석을 만들지 않습니다. 실제 일정이 확정되면 모집 상태와 함께 공개합니다."), action: '<a class="nal-text-link" href="/nal/gather/">NAL GATHER 보기 →</a>' })}
      ${section({ label: "02 / THIS WEEK", title: "이번 주 원데이클래스", copy: "가볍게 한 번 참여할 수 있는 프로그램.", content: classes.length ? `<div class="card-grid">${classes.map(programCard).join("")}</div>` : emptyState("이번 주 일정 등록 전입니다.", "날짜·시간·장소가 확인된 클래스만 이 영역에 노출합니다."), action: '<a class="nal-text-link" href="/nal/class/">전체 클래스 보기 →</a>' })}
      ${section({ label: "03 / KEEP MEETING", title: "계속 만나는 커뮤니티", copy: "원데이와 구분되는 정기·시즌·자유 모임.", content: gathers.length ? `<div class="card-grid">${gathers.map(programCard).join("")}</div>` : emptyState("공개된 커뮤니티가 아직 없습니다.", "운영 기간·주기·규칙이 확정된 모임부터 공개합니다.") })}
      ${section({ label: "04 / NAL SHOP", title: "말로 꺼내기 어려운 마음을 한 장의 카드에서", copy: "감정을 발견하고 대화를 시작하며 생각을 기록하는 도구.", content: products.length ? `<div class="card-grid">${products.map(productCard).join("")}</div>` : emptyState("NAL 상품 카탈로그 준비 중", "상품 구성·가격·배송 정보가 확인되기 전에는 구매 버튼을 노출하지 않습니다.", smartStore ? `<a class="nal-button--lime" href="${smartStore}"${externalAttrs(smartStore)}>운영 중인 스마트스토어 보기</a>` : ""), action: '<a class="nal-text-link" href="/nal/shop/">NAL SHOP 보기 →</a>' })}
      ${section({ label: "05 / USED TOGETHER", title: "모임에서 사용하는 도구", copy: "공개 데이터에서 실제로 연결된 프로그램과 상품만 함께 보여드립니다.", content: relations.length ? `<div class="nal-relation-grid">${relations.map(({ program, product }) => relationCard(program, product)).join("")}</div>` : emptyState("공개 가능한 연결 상품이 없습니다.", "판매를 위한 억지 연결 없이 실제 사용 관계가 확인된 항목만 공개합니다.") })}
      ${section({ label: "06 / NAL HOST", title: "추천 진행자", copy: "자격보다 먼저 어떤 방식으로 진행하는지 확인하세요.", content: hosts.length ? `<div class="card-grid">${hosts.map(hostCard).join("")}</div>` : emptyState("진행자 프로필 준비 중", "NAL이 검토한 진행자만 공개합니다."), action: '<a class="nal-text-link" href="/nal/host/">전체 진행자 보기 →</a>' })}
      ${section({ label: "07 / EXPERIENCE", title: "참여자 경험", copy: "칭찬보다 실제 참여 조건과 발견을 기록합니다.", content: emptyState("공개 동의가 확인된 후기가 아직 없습니다.", "민감한 경험을 임의로 만들거나 공개하지 않습니다.") })}
      ${section({ label: "08 / NAL NOTE", title: "관심에서 다음 경험으로", copy: "마음·관계·도구 활용법을 관련 프로그램과 연결합니다.", content: notes.length ? `<div class="card-grid">${notes.map(noteCard).join("")}</div>` : emptyState("새 콘텐츠 준비 중", "출처와 관련 프로그램이 확인된 글부터 공개합니다."), action: '<a class="nal-text-link" href="/nal/note/">NAL NOTE 보기 →</a>' })}
      <section class="nal-letter"><div class="nal-container nal-letter__grid"><div><p class="nal-eyebrow">09 / NAL LETTER</p><h2>새로운 모임과 클래스,<br>일상에서 사용할 질문을.</h2><p>구독 시스템 연결 전에는 이메일을 입력받지 않습니다.</p></div><div class="nal-letter__form" aria-label="NAL LETTER 준비 상태"><input type="email" placeholder="이메일 구독 준비 중" disabled aria-label="이메일 구독 준비 중"><button class="nal-button--primary" type="button" disabled>구독 준비 중</button></div></div></section>`;
  }

  function getListingItems() {
    if (collection === "products") return globalThis.NALStore.filter(state.products, new URLSearchParams(location.search));
    let items = publicItems(state[collection] || []);
    if (pageType) items = items.filter((item) => item.type === pageType);
    const params = new URLSearchParams(location.search);
    const q = (params.get("q") || "").trim().toLocaleLowerCase("ko");
    const category = params.get("category") || "";
    const status = params.get("status") || "";
    const format = params.get("format") || "";
    if (q) items = items.filter((item) => [item.title, item.name, item.summary, item.description, item.headline, item.bio, ...asArray(item.tags), ...asArray(item.fields)].filter(Boolean).join(" ").toLocaleLowerCase("ko").includes(q));
    if (category) items = items.filter((item) => item.category === category || item.fields?.includes(category));
    if (status) items = items.filter((item) => item.status === status || item.stockStatus === status);
    if (collection === "products" && format === "digital") items = items.filter(isDigitalProduct);
    if (collection === "products" && format === "physical") items = items.filter((item) => !isDigitalProduct(item));
    const allowedSorts = ["recommended", "closing", "nearest", "newest", "lowPrice"];
    const sort = allowedSorts.includes(params.get("sort")) ? params.get("sort") : "recommended";
    const dateValue = (item) => item.startDate ? Date.parse(item.startDate) : Number.MAX_SAFE_INTEGER;
    if (sort === "nearest") items.sort((a, b) => dateValue(a) - dateValue(b));
    if (sort === "closing") items.sort((a, b) => (a.status === "closing" ? -1 : 1) - (b.status === "closing" ? -1 : 1));
    if (sort === "newest") items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    if (sort === "lowPrice") items.sort((a, b) => (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER));
    if (sort === "recommended") items.sort((a, b) => (collection === "products" ? Number(isDigitalProduct(b)) - Number(isDigitalProduct(a)) : 0) || Number(b.featured) - Number(a.featured) || featuredOrder(a) - featuredOrder(b));
    return items;
  }

  function listingConfig() {
    if (collection === "programs") return pageType === "gather"
      ? ["NAL GATHER", "계속 만나며 조금씩 달라지는 모임", state.site?.categories?.gather || [], programCard]
      : ["NAL CLASS", "한 번의 참여로 새로운 장면을 여는 시간", state.site?.categories?.class || [], programCard];
    if (collection === "products") return ["NAL MIND TOOLS", "PDF 전자책부터 워크북·코칭도구까지", state.site?.categories?.shop || [], productCard];
    if (collection === "hosts") return ["NAL HOST", "어떻게 진행하는지 먼저 보여주는 사람들", [], hostCard];
    return ["NAL NOTE", "읽고 끝나지 않는 다음 경험의 기록", state.site?.categories?.note || [], noteCard];
  }

  function renderListing() {
    const [label, title, categories, card] = listingConfig();
    const params = new URLSearchParams(location.search);
    const items = getListingItems();
    const q = params.get("q") || "";
    const listingIntro = collection === "products"
      ? "읽고 끝나는 자료보다, 실제 삶과 코칭 장면에서 꺼내 쓰는 도구를 만듭니다."
      : "확인되지 않은 일정·가격·잔여 좌석은 표시하지 않습니다.";
    root.innerHTML = `
      <section class="nal-page-hero"><div class="nal-container"><p class="nal-eyebrow">${label}</p><h1>${title}</h1><p>${listingIntro}</p></div></section>
      <section class="nal-section nal-listing"><div class="nal-container">
        <form class="nal-filter-bar" data-filter-form role="search">
          <label class="nal-form-field nal-filter-search"><span>검색</span><input type="search" name="q" value="${escapeHtml(q)}" placeholder="주제나 이름으로 검색"></label>
          ${collection !== "products" && categories.length ? `<label class="nal-form-field"><span>카테고리</span><select name="category" data-filter><option value="">전체</option>${categories.filter((value) => !value.startsWith("전체") && value !== "지난 모임").map((value) => `<option value="${escapeHtml(value)}"${params.get("category") === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>` : ""}
          ${collection === "programs" ? `<label class="nal-form-field"><span>모집 상태</span><select name="status" data-filter><option value="">전체</option>${["open","closing","waiting","closed","completed","comingSoon"].map((value) => `<option value="${value}"${params.get("status") === value ? " selected" : ""}>${statusLabel(value)}</option>`).join("")}</select></label>` : ""}
          ${collection === "products" ? `<label class="nal-form-field"><span>상품 형태</span><select name="format" data-filter>${[["", "전체"], ["pdfEbook", "PDF 전자책"], ["workbook", "워크북·활동지"], ["guide", "코칭자료"], ["physical", "실물도구"]].map(([value, label]) => `<option value="${value}"${params.get("format") === value ? " selected" : ""}>${label}</option>`).join("")}</select></label>
          <label class="nal-form-field"><span>주제</span><select name="topic" data-filter><option value="">전체</option>${globalThis.NALStore.topics.map(value => `<option${params.get("topic") === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
          <label class="nal-form-field"><span>대상</span><select name="audience" data-filter><option value="">전체</option>${globalThis.NALStore.audiences.map(value => `<option${params.get("audience") === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>` : ""}
          <label class="nal-form-field"><span>정렬</span><select name="sort" data-filter>${(collection === "products" ? [["recommended", "추천순"], ["newest", "최신순"], ["lowPrice", "낮은 가격"], ["highPrice", "높은 가격"]] : [["recommended", "추천순"], ["closing", "모집 상태순"], ["nearest", "가까운 일정순"], ["newest", "신규 등록순"], ["lowPrice", "낮은 가격순"]]).map(([value, label]) => `<option value="${value}"${(params.get("sort") || "recommended") === value ? " selected" : ""}>${label}</option>`).join("")}${collection === "products" ? '<option disabled>인기순 준비</option>' : ""}</select></label>
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
      const purchaseUrl = safeUrl(item.purchaseUrl || item.externalPurchaseUrl || state.site?.externalLinks?.smartStore);
      const unavailable = ["comingSoon", "soldOut", "outOfStock"].includes(item.stockStatus) || (typeof item.stock === "number" && item.stock <= 0);
      if (!unavailable && ["inStock", "available"].includes(item.stockStatus) && purchaseUrl) return [purchaseUrl, "구매하기", stockLabel(item.stockStatus)];
      if (sourceUrl) return [sourceUrl, "상품 자세히 보기", stockLabel(item.stockStatus) || "판매 상태 확인"];
      if (purchaseUrl) return [purchaseUrl, "스마트스토어 보기", stockLabel(item.stockStatus) || "판매 준비 중"];
      return ["", ["soldOut", "outOfStock"].includes(item.stockStatus) ? "품절" : "구매 준비 중", stockLabel(item.stockStatus) || "준비 중"];
    }
    if (sourceUrl) return [sourceUrl, "원문 보기", "공개 콘텐츠"];
    return ["", "원문 준비 중", "준비 중"];
  }

  function valueList(values, className = "") {
    const items = asArray(values).filter(Boolean);
    return items.length
      ? `<ul${className ? ` class="${className}"` : ""}>${items.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`
      : "";
  }

  function conceptCaption(item, fallback) {
    if (!String(item.coverImage || "").includes("/catalog/")) return "";
    return `<figcaption>${escapeHtml(item.visualNote || fallback)}</figcaption>`;
  }

  function scheduleNotice(item) {
    const facts = detailFacts(item);
    const policy = item.refundPolicy
      ? `<p class="nal-detail-policy">${escapeHtml(item.refundPolicy)}</p>`
      : '<p class="nal-detail-policy">신청 채널과 실제 모집 조건이 확정되면 취소·환불 기준을 함께 공개합니다.</p>';
    return `${facts}${policy}`;
  }

  function renderProgramDetail(item) {
    remember("programs", item.id);
    const host = byId(publicItems(state.hosts), item.hostId);
    const relatedContent = publicItems(state.content).filter((entry) => item.relatedContentIds?.includes(entry.id));
    const relatedProducts = publicItems(state.products).filter((entry) => item.productIds?.includes(entry.id));
    const [ctaUrl, ctaLabel, ctaState] = detailCta(item, "programs");
    const programLabel = item.type === "gather" ? "NAL GATHER" : "NAL CLASS";
    const tools = [...asArray(item.materials), ...asArray(item.includedItems)];
    root.innerHTML = `
      <section class="nal-detail-hero nal-detail-hero--${escapeHtml(item.type)}"><div class="nal-container nal-detail-hero__grid"><div class="nal-detail-hero__copy"><p class="nal-eyebrow">${programLabel}</p><div class="nal-detail-hero__badges"><span class="nal-badge ${badgeClass(item)}">${escapeHtml(statusLabel(item.status))}</span><span class="nal-badge--neutral">${escapeHtml(item.category)}</span></div><h1>${escapeHtml(item.title)}</h1>${item.subtitle ? `<p class="nal-detail-hero__lead">${escapeHtml(item.subtitle)}</p>` : ""}<p class="nal-detail-hero__summary">${escapeHtml(item.summary)}</p><div class="nal-detail-actions">${wishButton("programs", item, true)}${ctaUrl ? `<a class="nal-button--primary" href="${ctaUrl}"${externalAttrs(ctaUrl)}>${ctaLabel}</a>` : `<button class="nal-button--primary" type="button" disabled>${ctaLabel}</button>`}</div></div><figure class="nal-detail-hero__media">${imageMarkup(item.coverImage, item.coverImageAlt || `${item.title} 대표 이미지`, "", { mobileSrc: item.coverImageMobile, eager: true, width: 1600, height: 1000 })}${conceptCaption(item, "프로그램의 활동 방식을 설명하기 위해 제작한 NAL 에디토리얼 콘셉트 이미지입니다.")}</figure></div></section>
      <div class="nal-container nal-detail-layout"><article class="nal-detail-content">
        <section class="nal-detail-section"><p class="nal-eyebrow">01 / EXPERIENCE</p><h2>이런 경험입니다</h2><p class="nal-detail-section__lead">${escapeHtml(item.description)}</p>${item.tags?.length ? `<div class="nal-chip-list">${item.tags.map((tag) => `<span class="nal-filter-chip">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}</section>
        ${item.activities?.length ? `<section class="nal-detail-section"><p class="nal-eyebrow">02 / ACTIVITY</p><h2>무엇을 하게 되나요</h2>${valueList(item.activities, "nal-step-list")}</section>` : ""}
        ${item.recommendedFor?.length ? `<section class="nal-detail-section"><p class="nal-eyebrow">03 / FOR YOU</p><h2>이런 분에게 잘 맞습니다</h2>${valueList(item.recommendedFor, "nal-check-list")}</section>` : ""}
        ${(tools.length || relatedProducts.length) ? `<section class="nal-detail-section"><p class="nal-eyebrow">04 / TOOLS</p><h2>함께 사용하는 도구</h2>${tools.length ? valueList(tools, "nal-tool-list") : ""}${relatedProducts.length ? `<div class="card-grid nal-related-grid">${relatedProducts.map(productCard).join("")}</div>` : ""}</section>` : ""}
        ${host ? `<section class="nal-detail-section"><p class="nal-eyebrow">05 / NAL HOST</p><h2>진행자</h2><div class="nal-host-profile">${imageMarkup(host.profileImage, `${host.name} 프로필`)}<div><h3><a href="${itemRoute("hosts", host)}">${escapeHtml(host.name)}</a></h3><p>${escapeHtml(host.headline)}</p><p>${escapeHtml(host.bio)}</p></div></div></section>` : ""}
        ${item.safetyGuide?.length ? `<section class="nal-detail-section nal-safety-guide"><p class="nal-eyebrow">06 / BEFORE JOINING</p><h2>참여 전 알아둘 점</h2>${valueList(item.safetyGuide, "nal-check-list")}</section>` : ""}
        <section class="nal-detail-section nal-detail-section--status"><p class="nal-eyebrow">07 / OPEN NOTICE</p><h2>일정 오픈 전 안내</h2><p>현재 상태는 <strong>${escapeHtml(ctaState)}</strong>입니다. 확인되지 않은 일정·장소·참가비·정원은 공개하지 않습니다.</p>${scheduleNotice(item)}</section>
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

  function updateProductMetadata(item) {
    const title = `${item.title} | NAL 마음도구 · 날빛`;
    document.title = title;
    const setMeta = (selector, content) => { const node = document.querySelector(selector); if (node) node.setAttribute("content", content); };
    setMeta('meta[name="description"]', item.summary || item.description || item.title);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', item.summary || item.description || item.title);
    const route = itemRoute("products", item);
    const canonicalOrigin = "https://daily-coach-ing.com";
    const canonical = new URL(route, canonicalOrigin).href;
    const link = document.querySelector('link[rel="canonical"]');
    if (link) link.href = canonical;
    setMeta('meta[property="og:url"]', canonical);
    const cover = globalThis.NALStore.safePublicUrl(item.coverImage);
    if (cover) setMeta('meta[property="og:image"]', new URL(cover, canonicalOrigin).href);
    const data = { "@context": "https://schema.org", "@type": "Product", name: item.title, description: item.summary || item.description, sku: item.id, url: canonical, brand: { "@type": "Brand", name: "NAL · 날빛" } };
    if (cover) data.image = new URL(cover, canonicalOrigin).href;
    data.additionalProperty = [["파일형식",item.fileFormat],["페이지",item.pageCount],["저자",item.author]].filter(([,value])=>value != null).map(([name,value])=>({"@type":"PropertyValue",name,value}));
    const purchase = globalThis.NALStore.purchase(item, "");
    if (purchase.label === "구매하기") data.offers = { "@type": "Offer", price: item.price, priceCurrency: "KRW", availability: "https://schema.org/InStock", url: purchase.url };
    const script = document.querySelector('script[type="application/ld+json"]');
    if (script) script.textContent = JSON.stringify(data);
  }


  function renderAwarenessSalesStory(item) {
    const tier = {
      "dailycoaching-awareness-100": {
        code: "100",
        level: "POCKET COACHING TOOL",
        mark: "03:00",
        title: "반응을 바꾸려 하기 전에, 3분 먼저 봅니다.",
        lead: "답장을 보내기 직전처럼 손이 먼저 움직이는 순간이 있습니다. 그때 필요한 건 더 좋은 답보다, 내가 지금 무엇을 느끼고 어떤 이야기를 만들고 있는지 잠깐 보는 일일지도 모릅니다.",
        note: "이 책은 3분 안에 문제를 해결하려 하지 않습니다. 다만 자동으로 흘러가던 장면에 아주 작은 틈 하나를 남깁니다.",
        points: [
          ["PAUSE", "손이 먼저 움직이는 장면에서 속도를 늦춥니다."],
          ["NOTICE", "마음·몸·생각·사실을 한 번 나눠 봅니다."],
          ["CHOICE", "지금 할 수 있는 가장 작은 응답 하나를 남깁니다."]
        ]
      },
      "dailycoaching-awareness-1000": {
        code: "1000",
        level: "S-TOP SIGNATURE WORKBOOK",
        mark: "S T O P",
        title: "한 장면을 네 번 이동시키면, 선택할 자리가 생깁니다.",
        lead: "문제가 커질수록 우리는 사람 전체를 설명하려 합니다. “나는 왜 이럴까.” 그런데 큰 질문은 때때로 답보다 판정을 먼저 부릅니다. 이 워크북은 다시 한 장면으로 돌아옵니다.",
        note: "거리 → 질문 → 선택 → 착수. S-TOP은 잘해야 하는 방법보다, 다시 선택할 수 있게 만드는 흐름에 가깝습니다.",
        points: [
          ["STEP BACK", "장면과 나 사이에 관찰할 거리를 만듭니다."],
          ["THINK", "사실·감정·생각·욕구·패턴을 질문으로 봅니다."],
          ["OPTIONS → PROCEED", "익숙한 반응 밖의 선택을 만들고 10분 행동으로 옮깁니다."]
        ]
      },
      "dailycoaching-awareness-10000": {
        code: "10000",
        level: "DAILY PROFESSIONAL PLAYBOOK",
        mark: "D A I L Y",
        title: "알아차림을 한 번의 통찰이 아니라, 반복 가능한 방법론으로.",
        lead: "좋은 통찰이 있었는데 같은 장면에서 다시 예전처럼 반응할 때가 있습니다. 이해가 부족해서라기보다, 새로운 선택이 아직 삶의 언어가 되지 않았기 때문일 수 있습니다.",
        note: "DAILY는 신호를 발견하고, 있는 것을 인정하고, 질문으로 탐색한 뒤, 내가 지키고 싶은 방향과 다음 행동까지 연결하는 DAILYCOACHING의 실천 구조입니다.",
        points: [
          ["5 STEPS", "Detect · Acknowledge · Inquire · Link · Your Action"],
          ["7 LENSES", "몸·감정·생각·동기·행동·관계·의미를 함께 봅니다."],
          ["PRACTICE", "3개 사례와 7일 반복 실습으로 방법을 삶의 언어로 익힙니다."]
        ]
      }
    }[item.id];
    if (!tier) return "";

    const ladder = [
      ["100", "3분", "dailycoaching-awareness-100", "POCKET"],
      ["1000", "한 장면", "dailycoaching-awareness-1000", "S-TOP"],
      ["10000", "방법론", "dailycoaching-awareness-10000", "DAILY"]
    ];

    return `
      <section class="nal-awareness-story nal-awareness-story--${tier.code}" aria-labelledby="awareness-story-title">
        <div class="nal-container">
          <div class="nal-awareness-story__head">
            <div>
              <p class="nal-eyebrow">DAILYCOACHING AWARENESS / ${tier.level}</p>
              <h2 id="awareness-story-title">${tier.title}</h2>
            </div>
            <strong class="nal-awareness-story__mark" aria-hidden="true">${tier.mark}</strong>
          </div>
          <div class="nal-awareness-story__essay">
            <p>${tier.lead}</p>
            <p>${tier.note}</p>
          </div>
          <div class="nal-awareness-story__points">
            ${tier.points.map(([label, copy], index) => `<article><span>0${index + 1}</span><h3>${label}</h3><p>${copy}</p></article>`).join("")}
          </div>
          <div class="nal-awareness-ladder" aria-label="AWARENESS 제품 단계">
            <div class="nal-awareness-ladder__intro">
              <span>AWARENESS SERIES</span>
              <strong>필요한 깊이만큼 선택합니다.</strong>
              <p>세 권은 같은 내용을 양만 늘린 버전이 아닙니다. 3분의 멈춤에서 한 장면의 셀프코칭으로, 다시 하나의 방법론으로 깊어집니다.</p>
            </div>
            <div class="nal-awareness-ladder__steps">
              ${ladder.map(([code, depth, id, name]) => {
                const current = id === item.id;
                return `<a class="${current ? "is-current" : ""}" href="/nal/shop/${id}/"${current ? ' aria-current="page"' : ""}>
                  <span>${code}</span><strong>${depth}</strong><small>${name}</small>
                </a>`;
              }).join("")}
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderProductDetail(item) {
    remember("products", item.id);
    updateProductMetadata(item);
    const digital = isDigitalProduct(item);
    const { url, label, reason } = globalThis.NALStore.purchase(item, state.site?.externalLinks?.smartStore);
    const status = stockLabel(item.stockStatus);
    const smartStore = safeUrl(state.site?.externalLinks?.smartStore);
    const previewUrl = globalThis.NALStore.preview(item);
    const programs = publicItems(state.programs).filter((entry) => item.relatedProgramIds?.includes(entry.id));
    const gallery = asArray(item.gallery).map((src, index) => ({ src: globalThis.NALStore.safePublicUrl(src), alt: asArray(item.galleryAlts)[index] || item.coverImageAlt || `${item.title} 상품 이미지` })).filter(image => image.src);
    const price = item.price === 0 ? "무료" : formatPrice(item.price);
    const originalPrice = formatPrice(item.originalPrice);
    const hasPrice = Boolean(price);
    const stockText = stockLabel(item.stockStatus) || status || "판매 상태 확인";
    const optionItems = asArray(item.options).filter(Boolean);
    const license = licenseLabel(item);
    const format = productFormatLabel(item);
    const delivery = digital ? digitalDeliveryLabel(item) : (item.shippingPolicy || "스마트스토어 상품 페이지에서 배송 조건을 확인합니다.");
    const directFreeDownload = item.price === 0 && label === "무료 다운로드" && url.startsWith("/");
    const commerceButton = url
      ? `<a class="nal-commerce-buy" href="${escapeHtml(url)}"${directFreeDownload ? " download" : externalAttrs(url)}>${escapeHtml(label)}</a>`
      : `<button class="nal-commerce-buy" type="button" aria-describedby="product-purchase-status" disabled>${escapeHtml(label)}</button>`;
    const previewButton = previewUrl
      ? `<a class="nal-commerce-preview" href="${escapeHtml(previewUrl)}"${externalAttrs(previewUrl)}>${escapeHtml(item.fileFormat || "자료")} 미리보기</a>`
      : "";
    const fileFacts = digital ? [
      ["파일", item.fileFormat || (globalThis.NALStore.type(item)?.startsWith("pdf") ? "PDF" : "")],
      ["분량", Number.isInteger(item.pageCount) && item.pageCount > 0 ? `${item.pageCount}쪽` : ""],
      ["용량", Number.isFinite(item.fileSizeMB) ? `${item.fileSizeMB} MB` : ""],
      ["제공", item.deliveryMethod ? digitalDeliveryLabel(item) : "제공 방식 확정 전"],
      ["이용", license],
      ["인쇄", item.printingAllowed === true ? "가능" : item.printingAllowed === false ? "불가" : ""]
    ].filter(([, value]) => value) : [
      ["배송", delivery],
      ["구매처", smartStore ? "NAL 스마트스토어" : "판매 채널 준비 중"],
      ["상태", stockText]
    ];
    const digitalPolicy = [
      item.fulfillmentNote,
      item.accessPeriod ? `이용 가능 기간: ${item.accessPeriod}` : "",
      Number.isFinite(item.downloadLimit) ? `다운로드 가능 횟수: ${item.downloadLimit}회` : "",
      item.licenseType ? `이용 범위: ${license || item.licenseType}` : "",
      item.printingAllowed === true ? "상품에 표시된 이용 범위에서 인쇄 가능" : item.printingAllowed === false ? "인쇄 불가" : "",
      item.refundPolicy
    ].filter(Boolean);
    const physicalPolicies = [item.shippingPolicy, item.exchangePolicy, item.refundPolicy].filter(Boolean);

    root.innerHTML = `
      <section class="nal-commerce-product${digital ? " nal-commerce-product--digital" : ""}">
        <div class="nal-container nal-commerce-breadcrumb"><a href="/nal/">NAL</a><span>›</span><a href="/nal/shop/">마음도구</a><span>›</span><strong>${escapeHtml(item.category)}</strong></div>
        <div class="nal-container nal-commerce-product__grid">
          <div class="nal-commerce-gallery">
            <figure class="nal-commerce-gallery__main">
              ${imageMarkup(globalThis.NALStore.safePublicUrl(item.coverImage), item.coverImageAlt || `${item.title} 상품 이미지`, "", { eager: true, width: digital ? 1200 : 1600, height: digital ? 1600 : 1600 })}
              ${conceptCaption(item, digital ? "전자책 표지 또는 미리보기 이미지입니다." : "현재 이미지는 상품 사용 경험을 보여주는 비주얼 콘셉트입니다.")}
            </figure>
            ${gallery.length ? `<div class="nal-commerce-gallery__rail" aria-label="상품 이미지">${gallery.map((image, index) => `<figure>${imageMarkup(image.src, image.alt, "", { width: 480, height: digital ? 640 : 480 })}<figcaption class="nal-sr-only">상품 이미지 ${index + 1}</figcaption></figure>`).join("")}</div>` : ""}
          </div>
          <aside class="nal-commerce-panel" aria-label="상품 구매 정보">
            <p class="nal-commerce-brand">NAL · MIND TOOLS</p>
            <div class="nal-commerce-state"><span>${escapeHtml(item.category)}</span><b>${escapeHtml(digital ? format : stockText)}</b></div>
            <h1>${escapeHtml(item.title)}</h1>
            ${item.author ? `<p class="nal-commerce-author">저자 · ${escapeHtml(item.author)}</p>` : ""}
            ${item.subtitle ? `<p class="nal-commerce-subtitle">${escapeHtml(item.subtitle)}</p>` : ""}
            <p class="nal-commerce-summary">${escapeHtml(item.summary)}</p>
            <div class="nal-commerce-price">
              ${originalPrice && originalPrice !== price ? `<del>${escapeHtml(originalPrice)}</del>` : ""}
              <strong>${hasPrice ? escapeHtml(price) : "판매가 준비 중"}</strong>
            </div>
            <dl class="nal-commerce-facts">
              ${fileFacts.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
              ${digital ? `<div><dt>상태</dt><dd>${escapeHtml(stockText)}</dd></div>` : ""}
            </dl>
            ${optionItems.length ? `<label class="nal-commerce-option"><span>옵션</span><select><option value="">옵션을 선택하세요</option>${optionItems.map((option) => `<option>${escapeHtml(typeof option === "string" ? option : option.label || option.name || "")}</option>`).join("")}</select></label>` : ""}
            <div class="nal-commerce-actions${previewButton ? " has-preview" : ""}">
              ${commerceButton}
              ${previewButton}
              ${wishButton("products", item, true)}
            </div>
            <p class="nal-commerce-note" id="product-purchase-status">${escapeHtml(reason)}</p><p class="nal-commerce-note">${digital
              ? (label === "구매하기" ? "구매 후 제공 방식과 다운로드 조건은 실제 판매 페이지의 안내를 따릅니다." : "판매가 열리면 PDF 제공 방식·이용 범위·환불 조건을 함께 안내합니다.")
              : (url && label === "구매하기" ? "외부 스마트스토어의 실제 상품 주문 화면으로 이동합니다." : "개별 상품 판매가 열리기 전에는 스마트스토어의 현재 판매 상품을 확인할 수 있습니다.")}</p>
          </aside>
        </div>
      </section>

      ${renderAwarenessSalesStory(item)}

      <nav class="nal-commerce-tabs" aria-label="상품 상세 메뉴">
        <div class="nal-container">
          <a href="#product-info">상품정보</a>
          <a href="#product-use">${digital ? "목차·활용" : "사용방법"}</a>
          ${previewUrl ? '<a href="#product-preview">미리보기</a>' : ""}
          <a href="#product-delivery">${digital ? "다운로드·이용" : "배송·교환"}</a>
          ${programs.length ? '<a href="#product-programs">관련 프로그램</a>' : ""}
        </div>
      </nav>

      <div class="nal-container nal-commerce-detail">
        <div class="nal-commerce-content">
          <section id="product-info" class="nal-commerce-section">
            <p class="nal-eyebrow">${digital ? "PDF EBOOK INFORMATION" : "PRODUCT INFORMATION"}</p>
            <h2>${digital ? "전자책 정보" : "상품 정보"}</h2>
            <p class="nal-commerce-lead">${escapeHtml(item.description)}</p>
            ${digital ? `<dl class="nal-commerce-facts">${[["저자",item.author],["대상",asArray(item.audiences).join(" · ")],["버전",item.version],["제작일",item.createdAt],...fileFacts].filter(([,value])=>value).map(([key,value])=>`<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>` : ""}
            ${gallery.length ? `<div class="nal-commerce-detail-images${digital ? " is-digital" : ""}">${gallery.map((image) => `<figure>${imageMarkup(image.src, image.alt, "", { width: digital ? 1200 : 1400, height: digital ? 1600 : 1400 })}</figure>`).join("")}</div>` : ""}
            ${item.visualNote ? `<p class="nal-visual-note">${escapeHtml(item.visualNote)}</p>` : ""}
          </section>

          <section id="product-use" class="nal-commerce-section">
            <p class="nal-eyebrow">HOW TO USE</p>
            <h2>${digital ? "목차·활용" : "이렇게 사용합니다"}</h2>
            ${asArray(item.tableOfContents).length ? `<div class="nal-commerce-toc"><h3>목차</h3><ol>${asArray(item.tableOfContents).map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ol></div>` : ""}
            ${item.components?.length ? `<h3>구성</h3>${valueList(item.components, "nal-tool-list")}` : ""}
            ${item.recommendedFor?.length ? `<h3>이런 분께 권합니다</h3>${valueList(item.recommendedFor, "nal-check-list")}` : ""}
            <div class="nal-commerce-use-grid">
              ${item.usageIndividual ? `<article><span>01</span><h3>혼자</h3><p>${escapeHtml(item.usageIndividual)}</p></article>` : ""}
              ${item.usageCouple ? `<article><span>02</span><h3>둘이</h3><p>${escapeHtml(item.usageCouple)}</p></article>` : ""}
              ${item.usageGroup ? `<article><span>03</span><h3>모임·코칭</h3><p>${escapeHtml(item.usageGroup)}</p></article>` : ""}
            </div>
            ${item.precautions ? `<div class="nal-commerce-caution"><strong>사용 전 확인</strong><p>${escapeHtml(item.precautions)}</p></div>` : ""}
          </section>

          ${previewUrl ? `<section id="product-preview" class="nal-commerce-section"><h2>미리보기</h2><p>구매 전 공개된 샘플을 확인하세요.</p><a class="nal-button--secondary" href="${escapeHtml(previewUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.fileFormat || (globalThis.NALStore.type(item)?.startsWith("pdf") ? "PDF" : "자료"))} 미리보기 열기</a></section>` : ""}
          <section id="product-delivery" class="nal-commerce-section">
            <p class="nal-eyebrow">${digital ? "DOWNLOAD & LICENSE" : "DELIVERY & POLICY"}</p>
            <h2>${digital ? "다운로드·이용 안내" : "배송·교환 안내"}</h2>
            ${digital ? '<p>본 상품은 디지털 파일입니다. 상품별 이용범위와 인쇄 가능 여부를 확인해주세요.</p><p>구매한 파일의 무단 복제·재배포·공유는 허용되지 않습니다. 실제 환불 가능 여부는 상품 상세의 디지털 상품 환불 기준을 확인해주세요.</p>' : ""}
            ${digital && item.policyStatus !== "reviewed" ? '<p>이용 조건 검토 중입니다. 판매 시작 전 확정된 조건을 공개합니다.</p>' : ""}
            ${digital && asArray(item.licenseOptions).length ? `<h3>이용권 옵션</h3><ul class="nal-commerce-license-options">${item.licenseOptions.map(option=>`<li><strong>${escapeHtml(globalThis.NALStore.licenses[option.licenseType] || option.label)}</strong><span>${formatPrice(option.price) || "조건 준비 중"}</span>${globalThis.NALStore.safePublicUrl(option.purchaseUrl) && Number.isFinite(option.price) ? `<a href="${escapeHtml(globalThis.NALStore.safePublicUrl(option.purchaseUrl))}"${externalAttrs(option.purchaseUrl)}>이용권 판매 안내</a>` : ""}</li>`).join("")}</ul>` : ""}
            ${digital
              ? (digitalPolicy.length ? valueList(digitalPolicy, "nal-check-list") : "<p>판매 시작 전입니다. 다운로드 방식, 이용 가능 범위, 인쇄 가능 여부와 디지털 상품 환불 기준은 판매 페이지에서 함께 공개합니다.</p>")
              : (physicalPolicies.length ? valueList(physicalPolicies, "nal-check-list") : "<p>배송비·출고일·교환·반품 기준은 실제 판매가 시작된 스마트스토어 상품 페이지의 조건을 기준으로 합니다.</p>")}
            <p>${digital ? '다시 받기: NAL 구매자료 보관함은 연결 준비 중입니다. 현재 구매한 판매채널의 제공 안내를 확인해주세요.' : '배송·교환 조건은 판매채널에서 확인해주세요.'}</p>
            ${safeUrl(state.site?.externalLinks?.inquiry) ? `<a class="nal-text-link" href="${escapeHtml(safeUrl(state.site.externalLinks.inquiry))}">상품 문의 →</a>` : ""}
            ${digital && !item.refundPolicy ? '<p>디지털 상품 환불 기준은 판매 시작 전 확정된 내용을 공개합니다.</p>' : ""}
          </section>

          ${programs.length ? `<section id="product-programs" class="nal-commerce-section"><p class="nal-eyebrow">CONNECTED PROGRAM</p><h2>이 도구와 함께하는 프로그램</h2><div class="card-grid nal-related-grid">${programs.map(programCard).join("")}</div></section>` : ""}
        </div>
        <aside class="nal-commerce-sidecart">
          <span>${escapeHtml(digital ? format : stockText)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <b>${hasPrice ? escapeHtml(price) : "판매가 준비 중"}</b>
          ${previewButton}
          ${commerceButton}
        </aside>
      </div>`;
    renderStickyCta(digital ? format : stockText, label, url, "product-purchase-status");
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
      <section class="nal-section" id="purchased-materials" data-purchased-materials data-state="not-connected"><div class="nal-container"><h2>내 구매자료</h2><p>구매한 PDF와 이용권한을 확인하고 다시 내려받는 공간입니다.</p><p>현재 NAL 구매자료 보관함은 연결 준비 중입니다. 외부 판매채널에서 구매한 자료는 해당 채널의 주문 안내에 따라 받습니다.</p><a class="nal-text-link" href="/nal/shop/">마음도구 둘러보기 →</a></div></section>`;
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
      ? searchCorpus().filter(({ item }) => globalThis.NALStore.searchable(item).includes(lowered))
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
      shipping: ["NAL POLICY", "배송·다운로드 안내", "상품 제공 방식 확정 전입니다.", "실물 상품은 배송·교환 정보를, PDF 전자책 등 디지털 상품은 다운로드·이용 범위를 상품별로 확인된 내용만 표시합니다."]
    }[sectionName] || ["NAL INFO", "운영 안내", "안내 준비 중입니다.", "확인된 내용만 공개합니다."];
    const extra = sectionName === "faq"
      ? `<div class="nal-faq"><details><summary>일정과 가격은 어디에서 확인하나요?</summary><p>실제 모집이 시작된 프로그램의 상세 페이지와 연결된 신청 채널에서 확인합니다.</p></details><details><summary>혼자 참여해도 되나요?</summary><p>프로그램마다 다릅니다. 확인된 경우에만 ‘혼자 참여 가능’ 정보를 표시합니다.</p></details><details><summary>PDF 전자책은 어떻게 받나요?</summary><p>상품별 상세 페이지에 파일형식과 제공 방식을 표시합니다. 판매가 열리기 전에는 다운로드가 가능한 것처럼 표시하지 않습니다.</p></details><details><summary>감정카드는 진단 도구인가요?</summary><p>아닙니다. 감정을 발견하고 대화를 시작하며 생각을 기록하도록 돕는 자기이해 도구입니다.</p></details><details><summary>말하고 싶지 않은 이야기도 해야 하나요?</summary><p>참여자는 답변을 거절하거나 활동을 쉬고 중단할 수 있습니다. 프로그램별 안전 안내를 확인해 주세요.</p></details></div>`
      : sectionName === "partnership"
        ? inquiry ? `<p><a class="nal-button--primary" href="${escapeHtml(inquiry)}">이메일로 문의하기</a></p>` : "<p>운영 문의 경로를 준비 중입니다.</p>"
        : "";
    root.innerHTML = `<section class="nal-page-hero"><div class="nal-container nal-container--narrow"><p class="nal-eyebrow">${info[0]}</p><h1>${info[1]}</h1><p>${info[2]}</p></div></section><section class="nal-section"><div class="nal-container nal-container--narrow nal-prose"><p>${info[3]}</p>${extra}</div></section>`;
  }

  function renderStickyCta(status, label, url, descriptionId = "") {
    if (!mobileCtaSlot) return;
    mobileCtaSlot.innerHTML = `<div class="nal-sticky-cta"><div><span>${escapeHtml(status || "상태 확인")}</span><strong>${escapeHtml(label)}</strong></div>${url ? `<a class="nal-button--primary" href="${url}"${externalAttrs(url)}>${escapeHtml(label)}</a>` : `<button class="nal-button--primary"${descriptionId ? ` aria-describedby="${escapeHtml(descriptionId)}"` : ""} disabled>${escapeHtml(label)}</button>`}</div>`;
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
    document.dispatchEvent(new CustomEvent("nal:page-rendered", { detail: { launches: state.launches } }));
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
    const backendConfigResponse = await fetch(`${DATA_BASE}/backend.json`, { cache: "no-store" });
    if (backendConfigResponse.ok) {
      const config = await backendConfigResponse.json();
      if (config.enabled === true) {
        const data = await globalThis.NALBackend.load(config);
        state = { ...state, ...data, errors: [] };
        body.dataset.backend = "supabase";
        return;
      }
    } else if (backendConfigResponse.status !== 404) {
      throw new Error(`Backend configuration HTTP ${backendConfigResponse.status}`);
    }
    const entries = [
      ["site", "site.json", "site"],
      ["programs", "programs.json", "programs"],
      ["products", "products.json", "products"],
      ["hosts", "hosts.json", "hosts"],
      ["content", "content.json", "content"],
      ...(page === "home" ? [["launches", "launches.json", "launches"]] : [])
    ];
    state.errors = [];
    const loaded = await Promise.allSettled(entries.map(async ([name, file, key]) => {
      const response = await fetch(`${DATA_BASE}/${file}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
      const data = await response.json();
      return [name, key === "site" || key === "launches" ? data : asArray(data[key])];
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

  document.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.matches("[data-image-fallback]")) return;
    const alt = image.dataset.imageFallback || image.alt || "이미지 준비 중";
    const placeholder = document.createElement("div");
    placeholder.className = `nal-media-placeholder ${image.className.replace("nal-catalog-image", "").trim()}`.trim();
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute("aria-label", alt);
    placeholder.innerHTML = "<span>IMAGE / READY</span>";
    (image.closest("picture") || image).replaceWith(placeholder);
  }, true);

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
      }).catch(() => showToast("정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."));
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
      if (root) root.innerHTML = `<section class="nal-section"><div class="nal-container"><div class="nal-error" role="alert"><p class="nal-eyebrow">NAL / ERROR</p><h1>정보를 불러오지 못했습니다.</h1><p>잠시 후 다시 시도해 주세요. 오류가 계속되면 NAL 홈에서 다시 시작할 수 있습니다.</p><button class="nal-button--secondary" type="button" data-retry-data>다시 시도</button><a class="nal-button--secondary" href="/nal/">NAL 홈으로</a></div></div></section>`;
    }
  }

  init();
})();
