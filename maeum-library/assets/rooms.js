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

  function connectRoomsToOneLineTalk() {
    const themes = {
      a: '온기 서가', b: '정돈 서가', c: '불씨 서가',
      d: '숨결 서가', e: '나침반 서가',
    };
    document.querySelectorAll('details.room-card').forEach((room) => {
      const match = /^room-([a-e])\d{2}$/.exec(room.id);
      const cta = room.querySelector('a.room-cta');
      if (!match || !cta || cta.parentElement?.classList.contains('room-action-stack')) return;
      const actions = document.createElement('div');
      actions.className = 'room-action-stack';
      const oneLineTalk = document.createElement('a');
      oneLineTalk.className = 'room-next-link';
      oneLineTalk.href = '/maeum-library/library/?theme=' + encodeURIComponent(themes[match[1]]);
      oneLineTalk.textContent = '같은 마음의 한줄톡 보기';
      cta.replaceWith(actions);
      actions.append(cta, oneLineTalk);
    });
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
    connectRoomsToOneLineTalk();
    openRoomFromHash();
  });
  window.addEventListener('hashchange', openRoomFromHash);
})();
