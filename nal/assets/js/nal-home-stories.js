(() => {
  "use strict";
  const enhanced = new WeakSet();

  function attach(root) {
    if (enhanced.has(root)) return;
    const rail = root.querySelector("[data-stories-rail]");
    const cards = [...(rail?.querySelectorAll("[data-story-card]") || [])];
    const count = root.querySelector("[data-stories-count]");
    const dots = [...root.querySelectorAll("[data-story-index]")];
    const prev = root.querySelector('[data-story-dir="-1"]');
    const next = root.querySelector('[data-story-dir="1"]');
    if (!rail || cards.length !== 3 || dots.length !== cards.length) return;
    enhanced.add(root);
    let activeIndex = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function update() {
      const origin = rail.getBoundingClientRect().left;
      let nearest = 0;
      let minDistance = Number.POSITIVE_INFINITY;
      cards.forEach((card, i) => {
        const distance = Math.abs(card.getBoundingClientRect().left - origin);
        if (distance < minDistance) { nearest = i; minDistance = distance; }
      });
      activeIndex = nearest;
      if (count) count.textContent = String(nearest + 1).padStart(2, "0") + " / 03";
      dots.forEach((dot, i) => {
        const active = i === nearest;
        dot.classList.toggle("is-active", active);
        if (active) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });
      if (prev) prev.disabled = nearest === 0;
      if (next) next.disabled = nearest === cards.length - 1;
    }

    function goTo(nextIndex) {
      const index = Math.max(0, Math.min(cards.length - 1, nextIndex));
      const offset = cards[index].offsetLeft - cards[0].offsetLeft;
      rail.scrollTo({ left: offset, behavior: reducedMotion ? "instant" : "smooth" });
      activeIndex = index;
    }

    root.addEventListener("click", (event) => {
      const dot = event.target.closest("[data-story-index]");
      const arrow = event.target.closest("[data-story-dir]");
      if (dot && root.contains(dot)) {
        goTo(Number(dot.dataset.storyIndex));
      } else if (arrow && root.contains(arrow) && !arrow.disabled) {
        goTo(activeIndex + Number(arrow.dataset.storyDir));
      }
    });
    rail.addEventListener("scroll", update, { passive: true });
    update();
  }

  function initialize() {
    document.querySelectorAll("[data-nal-stories]").forEach(attach);
  }
  document.addEventListener("nal:page-rendered", initialize);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();