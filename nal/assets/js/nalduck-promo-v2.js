/* NALDUCK SELF FAN CLUB — collectible-first homepage takeover. */
(() => {
  "use strict";

  const TARGET = "https://nalduck.dailycoaching.chatgpt.site/";
  const MASCOT = "/nal/assets/images/nalduck/nalduck-collectible-v2.webp";
  const SESSION_KEY = "nalduck-collectible-v2-seen-20261110";
  // Keep the original opt-out. People who requested no popup stay opted out.
  const NEVER_KEY = "nalduck-promo-never-20261110";
  const BANNER_ID = "nalduck-collectible-banner";

  const read = (storage, key) => {
    try { return storage.getItem(key); } catch (_) { return null; }
  };
  const save = (storage, key, value) => {
    try { storage.setItem(key, value); } catch (_) { /* Restricted storage: dismiss only this visit. */ }
  };

  function addBanner() {
    const root = document.querySelector("[data-page-root]");
    if (!root || root.querySelector(`#${BANNER_ID}`)) return;
    const anchor = root.querySelector(".nd-price-strip")
      || root.querySelector(".nd-hero")
      || root.querySelector(".nal-stories")
      || root.querySelector(".nal-page-intro");
    if (!anchor) return;

    const banner = document.createElement("section");
    banner.id = BANNER_ID;
    banner.className = "nduck-v2-banner";
    banner.setAttribute("aria-labelledby", "nduck-v2-banner-title");
    banner.innerHTML = `
      <a class="nduck-v2-banner__link" href="${TARGET}" target="_blank" rel="noopener noreferrer" aria-label="날덕에서 나의 캐릭터를 찾아보기, 새 창 열림">
        <div class="nduck-v2-banner__copy">
          <span class="nduck-v2-banner__eyebrow"><b>✳</b> NALDUCK <i>SELF FAN CLUB</i></span>
          <h2 id="nduck-v2-banner-title">오늘의 최애는,<br><em>나.</em><span class="nduck-v2-banner__star" aria-hidden="true">✴</span></h2>
          <p>썸, 면접, 의사소통까지.<br>테스트하고 <strong>내 캐릭터를 찾아봐.</strong></p>
          <span class="nduck-v2-banner__action">캐릭터 보러 가기 <span aria-hidden="true">↗</span></span>
        </div>
        <div class="nduck-v2-banner__visual" aria-hidden="true">
          <div class="nduck-v2-banner__disc"></div>
          <span class="nduck-v2-banner__sticker">ONE &<br>ONLY<br>ME ★</span>
          <img src="${MASCOT}" alt="" width="969" height="1060" loading="lazy" decoding="async">
          <span class="nduck-v2-banner__ticket">✳ YOUR TYPE. YOUR CHARACTER.</span>
        </div>
      </a>`;
    anchor.insertAdjacentElement("afterend", banner);
  }

  function showDialog() {
    if (read(localStorage, NEVER_KEY) === "1" || read(sessionStorage, SESSION_KEY) === "1") return;
    save(sessionStorage, SESSION_KEY, "1");

    const previouslyFocused = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "nduck-v2-overlay";
    overlay.innerHTML = `
      <div class="nduck-v2-dialog" role="dialog" aria-modal="true" aria-labelledby="nduck-v2-title" aria-describedby="nduck-v2-desc" tabindex="-1">
        <button class="nduck-v2-dialog__close" type="button" data-nduck-dismiss aria-label="날덕 팝업 닫기">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
        <div class="nduck-v2-dialog__stage">
          <span class="nduck-v2-dialog__brand">✳ <strong>NALDUCK</strong> <small>SELF FAN CLUB</small></span>
          <span class="nduck-v2-dialog__orbit" aria-hidden="true"></span>
          <span class="nduck-v2-dialog__smallstar" aria-hidden="true">✴</span>
          <img src="${MASCOT}" alt="" width="969" height="1060" decoding="async" fetchpriority="high">
          <span class="nduck-v2-dialog__sticker" aria-hidden="true">MY FAV<br>IS ME! ♡</span>
          <span class="nduck-v2-dialog__serial" aria-hidden="true">ME / 001<br>THE ORIGINAL</span>
        </div>
        <div class="nduck-v2-dialog__copy">
          <div class="nduck-v2-dialog__eyebrow"><span>●</span> 12 WAYS TO KNOW ME</div>
          <h2 id="nduck-v2-title">내 안에 이런<br><em>캐릭터가?</em></h2>
          <p id="nduck-v2-desc">썸 탈 때의 나, 면접장의 나, 대화할 때의 나.<br>테스트하고 내 캐릭터를 찾아봐.</p>
          <div class="nduck-v2-dialog__chips" aria-label="테스트 주제">
            <span>♡ 썸 고양이</span><span>✦ 면접 캐릭터</span><span>✳ 의사소통</span>
          </div>
          <a class="nduck-v2-dialog__cta" href="${TARGET}" target="_blank" rel="noopener noreferrer" data-nduck-visit>내 캐릭터 찾으러 가기 <span aria-hidden="true">↗</span></a>
          <div class="nduck-v2-dialog__foot"><span>무료 테스트 · 재미로 시작하는 자기탐색</span><button type="button" data-nduck-never>다시 보지 않기</button></div>
        </div>
      </div>`;

    function close(permanent = false) {
      if (permanent) save(localStorage, NEVER_KEY, "1");
      overlay.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeydown, true);
      document.body.classList.remove("nduck-v2-locked");
      overlay.remove();
      if (previouslyFocused && typeof previouslyFocused.focus === "function") previouslyFocused.focus({ preventScroll: true });
    }

    function onClick(event) {
      if (event.target.closest("[data-nduck-never]")) return close(true);
      if (event.target === overlay || event.target.closest("[data-nduck-dismiss], [data-nduck-visit]")) close();
    }

    function onKeydown(event) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const focusables = [...overlay.querySelectorAll("a[href], button:not([disabled])")];
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    overlay.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown, true);
    document.body.append(overlay);
    document.body.classList.add("nduck-v2-locked");
    overlay.querySelector(".nduck-v2-dialog__close").focus({ preventScroll: true });
  }

  function init() {
    if (document.body?.dataset.page !== "home") return;
    const root = document.querySelector("[data-page-root]");
    if (!root) return;
    addBanner();
    new MutationObserver(addBanner).observe(root, { childList: true });
    showDialog();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
