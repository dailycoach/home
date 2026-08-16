(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function openRoomFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!/^room-[a-e]\d{2}$/.test(id)) return;
    const room = document.getElementById(id);
    if (!(room instanceof HTMLDetailsElement)) return;

    room.open = true;
    requestAnimationFrame(() => {
      room.scrollIntoView({
        block: 'start',
        behavior: reducedMotion.matches ? 'auto' : 'smooth',
      });
      room.querySelector('summary')?.focus({ preventScroll: true });
    });
  }

  document.addEventListener('DOMContentLoaded', openRoomFromHash);
  window.addEventListener('hashchange', openRoomFromHash);
})();
