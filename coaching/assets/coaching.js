(() => {
  'use strict';

  const menuButton = document.querySelector('[data-menu-button]');
  const navigation = document.querySelector('[data-navigation]');
  const year = document.querySelector('[data-current-year]');

  function setMenu(open, restoreFocus = false) {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    navigation.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    if (!open && restoreFocus) menuButton.focus();
  }

  menuButton?.addEventListener('click', () => {
    setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
  });

  navigation?.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      const restoreFocus = window.innerWidth <= 1040 &&
        menuButton?.getAttribute('aria-expanded') === 'true';
      setMenu(false, restoreFocus);
      if (restoreFocus) {
        window.requestAnimationFrame(() => menuButton.focus());
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    const menuOpen = menuButton?.getAttribute('aria-expanded') === 'true';
    if (event.key === 'Escape' && menuOpen) {
      event.preventDefault();
      setMenu(false, true);
      return;
    }
    if (event.key !== 'Tab' || !menuOpen || window.innerWidth > 1040) return;

    const focusable = [
      menuButton,
      ...navigation.querySelectorAll('a[href]:not([tabindex="-1"])')
    ];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1040) setMenu(false);
  });

  if (year) year.textContent = String(new Date().getFullYear());
})();
