/* NAL × NALDUCK: lightweight home-page invitation and first-visit dialog. */
(() => {
  "use strict";

  const TARGET = "https://nalduck.dailycoaching.chatgpt.site/";
  const DUCK_IMAGE = "https://nalduck.dailycoaching.chatgpt.site/assets/duck01.png";
  const SESSION_KEY = "nalduck-promo-seen-20261110";
  const NEVER_KEY = "nalduck-promo-never-20261110";
  const BANNER_ID = "nalduck-promo-banner";

  function safelyRead(storage, key) {
    try { return storage.getItem(key); } catch (_) { return null; }
  }

  function safelyWrite(storage, key, value) {
    try { storage.setItem(key, value); } catch (_) { /* Privacy mode: still dismiss current dialog. */ }
  }

  function renderBanner() {
    const root = document.querySelector("[data-page-root]");
    if (!root || root.querySelector(`#${BANNER_ID}`)) return;

    const anchor = root.querySelector(".nd-price-strip")
      || root.querySelector(".nd-hero")
      || root.querySelector(".nal-stories")
      || root.querySelector(".nal-page-intro");
    if (!anchor) return;

    const banner = document.createElement("section");
    banner.className = "nalduck-promo-banner";
    banner.id = BANNER_ID;
    banner.setAttribute("aria-labelledby", "nalduck-banner-title");
    banner.innerHTML = `
      <a class="nalduck-promo-banner__link" href="${TARGET}" target="_blank" rel="noopener noreferrer" aria-label="날덕 NALDUCK에서 심리테스트 12가지 살펴보기, 새 창 열림">
        <div class="nalduck-promo-banner__copy">
          <p class="nalduck-promo-kicker"><span aria-hidden="true">✳</span> NAL × NALDUCK <span class="nalduck-promo-kicker__line" aria-hidden="true"></span> SELF FAN CLUB</p>
          <h2 id="nalduck-banner-title">오늘은 어떤 나를<br><em>덕질해볼까?</em></h2>
          <p class="nalduck-promo-banner__description">12가지 심리테스트로 발견하는 나의 캐릭터.<br>결과는 굿즈 도감에, 나에 대한 발견은 배지에.</p>
          <span class="nalduck-promo-banner__cta">날덕 테스트 하러 가기 <span aria-hidden="true">↗</span></span>
          <span class="nalduck-promo-banner__meta">무료 테스트 · 나만의 캐릭터 · 디지털배지</span>
        </div>
        <div class="nalduck-promo-banner__art" aria-hidden="true">
          <span class="nalduck-promo-banner__sticker">MY<br>FAV<br>ME!</span>
          <img src="${DUCK_IMAGE}" alt="" width="362" height="362" loading="lazy" decoding="async">
          <span class="nalduck-promo-banner__asterisk">✳</span>
        </div>
      </a>`;
    anchor.insertAdjacentElement("afterend", banner);
  }

  function showFirstVisitDialog() {
    if (safelyRead(localStorage, NEVER_KEY) === "1" || safelyRead(sessionStorage, SESSION_KEY) === "1") return;
    safelyWrite(sessionStorage, SESSION_KEY, "1");

    const previouslyFocused = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "nalduck-promo-overlay";
    overlay.innerHTML = `
      <div class="nalduck-promo-dialog" role="dialog" aria-modal="true" aria-labelledby="nalduck-dialog-title" aria-describedby="nalduck-dialog-description" tabindex="-1">
        <button class="nalduck-promo-dialog__close" type="button" data-nd-dismiss aria-label="날덕 안내 팝업 닫기">×</button>
        <div class="nalduck-promo-dialog__copy">
          <p class="nalduck-promo-dialog__brand">NAL<span aria-hidden="true"> ✳ </span>NALDUCK <span>SELF FAN CLUB</span></p>
          <p class="nalduck-promo-dialog__overline">TODAY'S LITTLE DISCOVERY</p>
          <h2 id="nalduck-dialog-title">오늘의 덕질 대상은<br><em>바로 나!</em></h2>
          <p id="nalduck-dialog-description" class="nalduck-promo-dialog__description">나는 어떤 고양이일까? 면접장에서 나는 어떤 사람일까?<br>12가지 가벼운 테스트로 내 새로운 모습을 발견해보세요.</p>
          <div class="nalduck-promo-dialog__actions">
            <a class="nalduck-promo-dialog__go" href="${TARGET}" target="_blank" rel="noopener noreferrer" data-nd-visit>날덕에서 나를 만나기 <span aria-hidden="true">↗</span></a>
            <button class="nalduck-promo-dialog__not-again" type="button" data-nd-never>다시 보지 않기</button>
          </div>
          <p class="nalduck-promo-dialog__fineprint">무료 · 재미와 자기탐색을 위한 테스트 · 임상 진단이 아닙니다.</p>
        </div>
        <div class="nalduck-promo-dialog__art" aria-hidden="true">
          <span class="nalduck-promo-dialog__circle"></span>
          <img src="${DUCK_IMAGE}" alt="" width="362" height="362" decoding="async">
          <span class="nalduck-promo-dialog__speech">오늘도 나를<br><strong>최애로 ♡</strong></span>
          <span class="nalduck-promo-dialog__stamp">12 TESTS<br>ONE & ONLY ME</span>
        </div>
      </div>`;

    function close(never = false) {
      if (never) safelyWrite(localStorage, NEVER_KEY, "1");
      overlay.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeydown, true);
      document.body.classList.remove("nalduck-promo-lock");
      overlay.remove();
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus({ preventScroll: true });
      }
    }

    function onClick(event) {
      if (event.target.closest("[data-nd-never]")) return close(true);
      if (event.target === overlay || event.target.closest("[data-nd-dismiss], [data-nd-visit]")) close();
    }

    function onKeydown(event) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...overlay.querySelectorAll("a[href], button:not([disabled])")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    overlay.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown, true);
    document.body.append(overlay);
    document.body.classList.add("nalduck-promo-lock");
    overlay.querySelector(".nalduck-promo-dialog__close").focus({ preventScroll: true });
  }

  function init() {
    if (document.body?.dataset.page !== "home") return;
    const root = document.querySelector("[data-page-root]");
    if (!root) return;

    renderBanner();
    // The NAL catalog can re-render the entire home asynchronously. Retain the banner.
    new MutationObserver(renderBanner).observe(root, { childList: true });
    showFirstVisitDialog();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
