(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isBusiness = document.body.classList.contains('cip-experience-page');
  const isAcademy = document.body.classList.contains('academy-page');

  function createMarquee() {
    const hero = document.querySelector(isBusiness ? '.art-experience-hero' : '.art-academy-hero');
    if (!hero || document.querySelector('.trend-marquee')) return;

    const words = isBusiness
      ? ['FIELD EXPERIENCE', 'PUBLIC EDUCATION', 'DATA INFRASTRUCTURE', 'HUMAN GROWTH', '2010—NOW']
      : ['LEARN', 'REFLECT', 'APPLY', 'RECORD', 'LMC · 12 WEEKS'];

    const repeated = [...words, ...words].map((word) => `<span>${word}</span>`).join('');
    const marquee = document.createElement('div');
    marquee.className = 'trend-marquee';
    marquee.setAttribute('aria-hidden', 'true');
    marquee.innerHTML = `<div class="trend-marquee-track">${repeated}</div>`;
    hero.insertAdjacentElement('afterend', marquee);
  }

  function createHumanNote() {
    const hero = document.querySelector(isBusiness ? '.art-experience-hero' : '.art-academy-hero');
    if (!hero || hero.querySelector('.trend-note')) return;
    const note = document.createElement('aside');
    note.className = `trend-note ${isBusiness ? 'business-note' : 'academy-note'}`;
    note.dataset.index = isBusiness ? 'FIELD NOTE 01' : 'LEARNING NOTE 01';
    note.textContent = isBusiness
      ? '기록은 과거를 장식하는 일이 아니라, 다음 시스템을 설계하는 근거가 된다.'
      : '배움은 영상을 본 시간보다, 한 문장을 남긴 순간부터 오래 지속된다.';
    hero.appendChild(note);
  }

  function revealOnScroll() {
    const selectors = [
      '.content-section', '.project-card', '.capability-card', '.timeline-item',
      '.academy-section', '.course-card', '.status-card', '.lmc-phase-card',
      '.lesson-content-card', '.course-detail-hero', '.lesson-layout'
    ];
    const elements = document.querySelectorAll(selectors.join(','));
    elements.forEach((element, index) => {
      element.classList.add('trend-reveal');
      element.style.transitionDelay = `${Math.min(index % 5, 4) * 55}ms`;
    });

    if (reduceMotion || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -8% 0px' });
    elements.forEach((element) => observer.observe(element));
  }

  function pointerAtmosphere() {
    if (reduceMotion || window.matchMedia('(pointer: coarse)').matches) return;
    let frame = null;
    window.addEventListener('pointermove', (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const x = `${Math.round((event.clientX / window.innerWidth) * 100)}%`;
        const y = `${Math.round((event.clientY / window.innerHeight) * 100)}%`;
        document.documentElement.style.setProperty('--pointer-x', x);
        document.documentElement.style.setProperty('--pointer-y', y);
        frame = null;
      });
    }, { passive: true });
  }

  function tactileTilt() {
    if (reduceMotion || window.matchMedia('(pointer: coarse)').matches) return;
    const targets = document.querySelectorAll('.project-card,.art-index-card,.lmc-overview-card,.status-card,.course-card,.lesson-content-card');
    targets.forEach((target) => {
      target.addEventListener('pointermove', (event) => {
        const rect = target.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        target.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-2px)`;
      });
      target.addEventListener('pointerleave', () => {
        target.style.transform = '';
      });
    });
  }

  function init() {
    if (!isBusiness && !isAcademy) return;
    createMarquee();
    createHumanNote();
    revealOnScroll();
    pointerAtmosphere();
    tactileTilt();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
