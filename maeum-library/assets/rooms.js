(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function initConcepts() {
    const concepts = [...document.querySelectorAll('details.concept-disclosure')];
    for (const current of concepts) {
      current.addEventListener('toggle', () => {
        if (!current.open) return;
        for (const other of concepts) if (other !== current) other.open = false;
      });
    }
  }

  function openRoomFromHash() {
    const hash = location.hash.slice(1);
    let id;
    try { id = decodeURIComponent(hash); } catch { return; }
    if (!/^room-[a-e]\d{2}$/.test(id)) return;
    const room = document.getElementById(id);
    if (!(room instanceof HTMLDetailsElement)) return;
    const concept = room.closest('details.concept-disclosure');
    if (concept) concept.open = true;
    room.open = true;
    requestAnimationFrame(() => {
      room.scrollIntoView({
        block: 'start',
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
      });
      room.querySelector('summary')?.focus({ preventScroll: true });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initConcepts();
    openRoomFromHash();
  });
  window.addEventListener('hashchange', openRoomFromHash);
})();
