(() => {
  const config = window.SITE_CONFIG || {};
  const applyUrl = (config.applyUrl || config.formUrl || "").trim();

  // Keep the facilitator slide page discoverable across all public pages
  // without duplicating navigation markup in every HTML file.
  if (!document.body.classList.contains("page-slides")) {
    document.querySelectorAll(".main-nav").forEach((nav) => {
      if (nav.querySelector('a[href="slides.html"]')) return;
      const link = document.createElement("a");
      link.href = "slides.html";
      link.textContent = "진행 슬라이드";
      const cta = nav.querySelector(".nav-cta");
      nav.insertBefore(link, cta || null);
    });
    document.querySelectorAll(".footer-links").forEach((footer) => {
      if (footer.querySelector('a[href="slides.html"]')) return;
      const link = document.createElement("a");
      link.href = "slides.html";
      link.textContent = "진행 슬라이드";
      const apply = footer.querySelector("[data-apply-link]");
      footer.insertBefore(link, apply || null);
    });
  }

  const applyLinks = [...document.querySelectorAll("[data-apply-link]")];
  const dialog = document.querySelector("[data-link-dialog]");
  const validFormUrl = /^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//i.test(applyUrl);
  const validMailtoUrl = /^mailto:[^\s"'<>]+$/i.test(applyUrl);
  const validApplyUrl = validFormUrl || validMailtoUrl;

  applyLinks.forEach(link => {
    if (validApplyUrl) {
      link.href = applyUrl;
      if (validFormUrl) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      } else {
        link.removeAttribute("target");
        link.removeAttribute("rel");
      }
    } else {
      link.href = "#";
      link.addEventListener("click", e => {
        e.preventDefault();
        if (dialog?.showModal) dialog.showModal();
      });
    }
  });

  document.querySelectorAll("[data-dialog-close]").forEach(btn => {
    btn.addEventListener("click", () => dialog?.close());
  });

  dialog?.addEventListener("click", e => {
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      dialog.close();
    }
  });

  const menuBtn = document.querySelector("[data-menu-button]");
  const nav = document.querySelector("[data-nav]");
  const closeMenu = (restoreFocus = false) => {
    menuBtn?.setAttribute("aria-expanded", "false");
    menuBtn?.setAttribute("aria-label", "메뉴 열기");
    nav?.classList.remove("open");
    document.body.classList.remove("menu-open");
    if (restoreFocus) menuBtn?.focus();
  };
  menuBtn?.addEventListener("click", () => {
    const next = menuBtn.getAttribute("aria-expanded") !== "true";
    menuBtn.setAttribute("aria-expanded", String(next));
    menuBtn.setAttribute("aria-label", next ? "메뉴 닫기" : "메뉴 열기");
    nav?.classList.toggle("open", next);
    document.body.classList.toggle("menu-open", next);
  });
  nav?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => closeMenu()));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && menuBtn?.getAttribute("aria-expanded") === "true") {
      closeMenu(true);
    }
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 760 && menuBtn?.getAttribute("aria-expanded") === "true") {
      closeMenu();
    }
  }, { passive: true });

  const header = document.querySelector("[data-header]");
  const syncHeader = () => header?.classList.toggle("scrolled", window.scrollY > 24);
  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });

  document.querySelectorAll("[data-year]").forEach(el => {
    el.textContent = String(new Date().getFullYear());
  });

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    revealItems.forEach(item => item.classList.add("visible"));
  } else {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: .12, rootMargin: "0px 0px -30px" });
    revealItems.forEach(item => obs.observe(item));
  }
})();
