(() => {
  const config = window.SITE_CONFIG || {};
  const formUrl = (config.formUrl || "").trim();
  const applyLinks = [...document.querySelectorAll("[data-apply-link]")];
  const dialog = document.querySelector("[data-link-dialog]");
  const validFormUrl = /^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//i.test(formUrl);

  applyLinks.forEach(link => {
    if (validFormUrl) {
      link.href = formUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
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
  const closeMenu = () => {
    menuBtn?.setAttribute("aria-expanded", "false");
    nav?.classList.remove("open");
    document.body.classList.remove("menu-open");
  };
  menuBtn?.addEventListener("click", () => {
    const next = menuBtn.getAttribute("aria-expanded") !== "true";
    menuBtn.setAttribute("aria-expanded", String(next));
    nav?.classList.toggle("open", next);
    document.body.classList.toggle("menu-open", next);
  });
  nav?.querySelectorAll("a").forEach(a => a.addEventListener("click", closeMenu));

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
