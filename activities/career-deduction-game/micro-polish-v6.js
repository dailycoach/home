(() => {
  'use strict';

  const CLASSROOM_KEY = 'career-deduction-classroom-v6';
  let selectedOptionIndex = null;

  function addViewControls() {
    const topbar = document.querySelector('.topbar');
    const reset = document.querySelector('#resetBtn');
    if (!topbar || document.querySelector('#jb6ClassroomBtn')) return;

    const controls = document.createElement('div');
    controls.className = 'jb6-view-controls';
    controls.innerHTML = `
      <button class="jb6-mode-btn" id="jb6ClassroomBtn" type="button" aria-pressed="false">📽 교실 모드</button>
      <button class="jb6-fullscreen-btn" id="jb6FullscreenBtn" type="button" aria-label="전체화면">⛶</button>
    `;
    topbar.insertBefore(controls, reset || null);

    const modeButton = controls.querySelector('#jb6ClassroomBtn');
    const fullscreenButton = controls.querySelector('#jb6FullscreenBtn');
    const saved = localStorage.getItem(CLASSROOM_KEY) === 'true';
    setClassroomMode(saved, false);

    modeButton.addEventListener('click', () => {
      setClassroomMode(!document.body.classList.contains('jb6-classroom'), true);
    });

    fullscreenButton.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (error) {
        console.warn('전체화면 전환 실패', error);
      }
    });

    document.addEventListener('fullscreenchange', () => {
      fullscreenButton.textContent = document.fullscreenElement ? '×' : '⛶';
      fullscreenButton.setAttribute('aria-label', document.fullscreenElement ? '전체화면 종료' : '전체화면');
    });
  }

  function setClassroomMode(enabled, persist) {
    document.body.classList.toggle('jb6-classroom', enabled);
    const button = document.querySelector('#jb6ClassroomBtn');
    if (button) {
      button.setAttribute('aria-pressed', String(enabled));
      button.textContent = enabled ? '✓ 교실 모드' : '📽 교실 모드';
    }
    if (persist) localStorage.setItem(CLASSROOM_KEY, String(enabled));
    if (enabled && !document.querySelector('#playScreen')?.classList.contains('hidden')) {
      setTimeout(() => document.querySelector('.turn-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }

  function decorateTargetBoard() {
    const board = document.querySelector('#targetBoard');
    if (!board) return;
    const cards = [...board.querySelectorAll('.target-card:not(.revealed)')];
    cards.forEach((card, optionIndex) => {
      card.dataset.jb6OptionIndex = String(optionIndex);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${card.querySelector('small')?.textContent || `상대 카드 ${optionIndex + 1}`} 선택`);
      const select = () => {
        selectedOptionIndex = optionIndex;
        cards.forEach(item => item.classList.toggle('jb6-selected', item === card));
        applySelectedTarget();
      };
      card.onclick = select;
      card.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      };
    });
    if (selectedOptionIndex !== null && cards[selectedOptionIndex]) cards[selectedOptionIndex].classList.add('jb6-selected');
    else if (selectedOptionIndex !== null) selectedOptionIndex = null;

    const head = document.querySelector('.target-head');
    if (head && !head.querySelector('.jb6-target-tip')) {
      const tip = document.createElement('span');
      tip.className = 'jb6-target-tip';
      tip.textContent = '카드를 먼저 선택하면 행동에 자동 적용';
      tip.style.cssText = 'display:block;margin-top:7px;color:rgba(255,255,255,.62);font-size:.78rem;font-weight:750';
      head.querySelector('div')?.appendChild(tip);
    }
  }

  function applySelectedTarget() {
    if (selectedOptionIndex === null) return;
    ['actionTarget', 'guessTarget', 'hintTarget'].forEach(id => {
      const select = document.getElementById(id);
      if (select && select.options.length > selectedOptionIndex) {
        select.selectedIndex = selectedOptionIndex;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function observeTargetBoard() {
    const board = document.querySelector('#targetBoard');
    if (!board) return;
    new MutationObserver(() => decorateTargetBoard()).observe(board, { childList: true, subtree: true });
    decorateTargetBoard();
  }

  function observeModals() {
    const ids = ['actionModal', 'guessModal', 'hintModal'];
    ids.forEach(id => {
      const modal = document.getElementById(id);
      if (!modal) return;
      new MutationObserver(() => {
        if (!modal.classList.contains('hidden')) setTimeout(applySelectedTarget, 0);
      }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    const feedback = document.getElementById('feedbackModal');
    if (feedback) {
      new MutationObserver(() => {
        if (!feedback.classList.contains('hidden') && navigator.vibrate) navigator.vibrate(70);
      }).observe(feedback, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function observeBonusTimer() {
    const timer = document.getElementById('bonusTimer');
    if (!timer) return;
    const update = () => timer.classList.toggle('jb6-urgent', Number.parseInt(timer.textContent, 10) <= 5);
    new MutationObserver(update).observe(timer, { childList: true, characterData: true, subtree: true });
    update();
  }

  function observePlayEntry() {
    const play = document.getElementById('playScreen');
    if (!play) return;
    new MutationObserver(() => {
      if (!play.classList.contains('hidden')) {
        selectedOptionIndex = null;
        setTimeout(() => {
          decorateTargetBoard();
          if (document.body.classList.contains('jb6-classroom')) document.querySelector('.turn-stage')?.scrollIntoView({ block: 'start' });
        }, 80);
      }
    }).observe(play, { attributes: true, attributeFilter: ['class'] });
  }

  function addShortcuts() {
    window.addEventListener('keydown', event => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.key.toLowerCase() === 'c') setClassroomMode(!document.body.classList.contains('jb6-classroom'), true);
      if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey) document.querySelector('#jb6FullscreenBtn')?.click();
    });
  }

  function init() {
    addViewControls();
    observeTargetBoard();
    observeModals();
    observeBonusTimer();
    observePlayEntry();
    addShortcuts();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
