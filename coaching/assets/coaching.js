(() => {
  "use strict";

  const toggle = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-site-nav]");
  const header = document.querySelector("[data-site-header]");

  const closeMenu = () => {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", "false");
    toggle.querySelector(".sr-only").textContent = "메뉴 열기";
    nav.classList.remove("is-open");
  };

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const opening = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(opening));
      toggle.querySelector(".sr-only").textContent = opening ? "메뉴 닫기" : "메뉴 열기";
      nav.classList.toggle("is-open", opening);
    });

    nav.addEventListener("click", event => {
      if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        const wasOpen = toggle.getAttribute("aria-expanded") === "true";
        closeMenu();
        if (wasOpen) toggle.focus();
      }
    });

    document.addEventListener("click", event => {
      if (nav.classList.contains("is-open") && !header.contains(event.target)) closeMenu();
    });

    const wideScreen = window.matchMedia("(min-width: 901px)");
    const handleWidth = event => { if (event.matches) closeMenu(); };
    wideScreen.addEventListener?.("change", handleWidth);
  }

  document.querySelectorAll("[data-current-year]").forEach(node => {
    node.textContent = String(new Date().getFullYear());
  });
})();
