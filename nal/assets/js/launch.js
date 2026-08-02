(() => {
  "use strict";

  const DATA_URL = "/nal/data/launches.json";
  const ROOT_SELECTOR = "[data-page-root]";
  const HERO_SELECTOR = ".nal-home-hero";
  const SECTION_ID = "nal-opening-lineup";

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function safeUrl(value) {
    if (!value) return "";
    const input = String(value).trim();
    try {
      const url = new URL(input, location.origin);
      if (url.protocol === "mailto:") return /^mailto:[^\s"'<>]+$/i.test(input) ? input : "";
      if (!["http:", "https:"].includes(url.protocol)) return "";
      const relative = !/^[a-z][a-z\d+.-]*:/i.test(input) && !input.startsWith("//");
      return relative ? `${url.pathname}${url.search}${url.hash}` : url.href;
    } catch {
      return "";
    }
  }

  function attrsFor(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url, location.origin);
      return ["http:", "https:"].includes(parsed.protocol) && parsed.origin !== location.origin
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";
    } catch {
      return "";
    }
  }

  function renderCard(item) {
    const detailUrl = safeUrl(item.detailUrl);
    const actionUrl = safeUrl(item.actionUrl);
    const image = safeUrl(item.image);
    if (!detailUrl || !actionUrl || !image) return "";

    return `<article class="nal-launch-card nal-launch-card--${escapeHtml(item.kind || "program")}">
      <div class="nal-launch-card__media">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(item.imageAlt)}" width="1600" height="1000" loading="lazy" decoding="async">
        <div class="nal-launch-card__badges"><span>${escapeHtml(item.label)}</span><span>${escapeHtml(item.statusLabel)}</span></div>
      </div>
      <div class="nal-launch-card__body">
        <p class="nal-eyebrow">${escapeHtml(item.label)}</p>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="nal-launch-card__subtitle">${escapeHtml(item.subtitle)}</p>
        <p class="nal-launch-card__summary">${escapeHtml(item.summary)}</p>
        <p class="nal-launch-card__meta">${escapeHtml(item.meta)}</p>
        <div class="nal-launch-card__actions">
          <a class="nal-launch-card__detail" href="${escapeHtml(detailUrl)}"${attrsFor(detailUrl)}>${escapeHtml(item.detailLabel)}</a>
          <a class="nal-launch-card__action" href="${escapeHtml(actionUrl)}"${attrsFor(actionUrl)}>${escapeHtml(item.actionLabel)} <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </article>`;
  }

  function buildSection(data) {
    const cards = Array.isArray(data.items) ? data.items.map(renderCard).filter(Boolean).join("") : "";
    if (!cards) return null;
    const section = document.createElement("section");
    section.className = "nal-launch-section";
    section.id = SECTION_ID;
    section.setAttribute("aria-labelledby", `${SECTION_ID}-title`);
    section.innerHTML = `<div class="nal-container">
      <div class="nal-launch-head">
        <div><p class="nal-eyebrow">00 / ${escapeHtml(data.title || "NAL FIRST LAUNCH")}</p><h2 id="${SECTION_ID}-title">가장 먼저 여는<br>세 가지 NAL 경험</h2></div>
        <p>${escapeHtml(data.description || "NAL이 가장 먼저 여는 세 가지 경험입니다.")}<br>일정과 세부 조건은 각 프로그램 안내 또는 참여 문의에서 확인합니다.</p>
      </div>
      <div class="nal-launch-grid">${cards}</div>
      <p class="nal-launch-note">현재 미술심리코칭과 코치모임은 참여 문의를 먼저 받고, 마음서재는 기존 온라인 서재로 바로 입장합니다. 정식 신청 설문이 개통되면 같은 버튼에 연결합니다.</p>
    </div>`;
    return section;
  }

  function updateHero(root) {
    const hero = root.querySelector(HERO_SELECTOR);
    if (!hero) return null;
    const actions = hero.querySelector(".nal-hero__actions");
    if (actions) {
      actions.innerHTML = `<a class="nal-button--primary" href="#${SECTION_ID}">첫 런칭 3개 보기</a><a class="nal-button--secondary" href="/nal/gather/">전체 모임·클래스 둘러보기</a>`;
    }
    return hero;
  }

  async function mount() {
    if (document.getElementById(SECTION_ID)) return true;
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return false;
    const hero = updateHero(root);
    if (!hero) return false;

    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const section = buildSection(data);
      if (!section || document.getElementById(SECTION_ID)) return true;
      hero.insertAdjacentElement("afterend", section);
      return true;
    } catch (error) {
      console.warn("NAL launch lineup unavailable", error);
      return true;
    }
  }

  let attempts = 0;
  const timer = window.setInterval(async () => {
    attempts += 1;
    const done = await mount();
    if (done || attempts > 80) window.clearInterval(timer);
  }, 100);

  document.addEventListener("DOMContentLoaded", mount, { once: true });
})();
