(() => {
  const config = window.SITE_CONFIG || {};
  const formUrl = (config.formUrl || "").trim();
  const applyLinks = [...document.querySelectorAll("[data-apply-link]")];
  const dialog = document.querySelector("[data-link-dialog]");
  const hasValidFormUrl = /^https:\/\/(docs\.google\.com\/forms|forms\.gle)\//i.test(formUrl);

  applyLinks.forEach((link) => {
    if (hasValidFormUrl) {
      link.href = formUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    } else {
      link.href = "#";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        if (dialog?.showModal) dialog.showModal();
      });
    }
  });

  document.querySelectorAll("[data-dialog-close]").forEach((button) => {
    button.addEventListener("click", () => dialog?.close());
  });

  dialog?.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) dialog.close();
  });

  const header = document.querySelector("[data-header]");
  const syncHeader = () => header?.classList.toggle("scrolled", window.scrollY > 24);
  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });

  const menuButton = document.querySelector("[data-menu-button]");
  const nav = document.querySelector("[data-nav]");
  const closeMenu = () => {
    menuButton?.setAttribute("aria-expanded", "false");
    nav?.classList.remove("open");
    document.body.classList.remove("menu-open");
  };
  menuButton?.addEventListener("click", () => {
    const next = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(next));
    nav?.classList.toggle("open", next);
    document.body.classList.toggle("menu-open", next);
  });
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("visible"));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -30px" });
    revealItems.forEach((item) => observer.observe(item));
  }

  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  const weekPanels = [...document.querySelectorAll(".week-panel")];
  weekPanels.forEach((panel) => {
    panel.addEventListener("toggle", () => {
      if (!panel.open) return;
      weekPanels.forEach((other) => {
        if (other !== panel) other.open = false;
      });
    });
  });
})();
