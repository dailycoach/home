(() => {
  'use strict';

  const previousLoad = load;

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    if (!Array.isArray(entry.hints)) entry.hints = [];
    if (!Array.isArray(entry.qa)) entry.qa = [];
    return entry;
  }

  function normalizeState() {
    if (!state.rosters || typeof state.rosters !== 'object') state.rosters = { A: [], B: [] };
    ['A', 'B'].forEach(side => {
      if (!Array.isArray(state.rosters[side])) state.rosters[side] = [];
      state.rosters[side] = state.rosters[side].map(normalizeEntry);
    });
    if (!state.chanceUsed || typeof state.chanceUsed !== 'object') state.chanceUsed = { A: false, B: false };
    if (!Array.isArray(state.log)) state.log = [];
    if (!Array.isArray(state.bonusDone)) state.bonusDone = [];
    if (!Array.isArray(state.bonusTurns)) state.bonusTurns = [];
  }

  save = function operationsStableSaveV74() {
    normalizeState();
    try {
      const snapshot = {
        ...state,
        timer: null,
        bonusTimer: null,
        matchTimer: null
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      return true;
    } catch (error) {
      console.error('JOB BATTLE v7.4 저장 실패', error);
      return false;
    }
  };

  load = function operationsStableLoadV74() {
    const loaded = previousLoad();
    if (!loaded) return false;
    normalizeState();
    state.timer = null;
    state.bonusTimer = null;
    state.matchTimer = null;
    return true;
  };

  function addQuickHostButton() {
    if (document.querySelector('#jb74HostQuick')) return;
    const button = document.createElement('button');
    button.id = 'jb74HostQuick';
    button.className = 'jb74-host-quick hidden';
    button.type = 'button';
    button.textContent = '🎛 진행자';
    button.addEventListener('click', () => document.querySelector('#jb74HostOpen')?.click());
    document.body.appendChild(button);
  }

  function syncQuickButton() {
    const button = document.querySelector('#jb74HostQuick');
    if (!button) return;
    button.classList.toggle('hidden', state.phase !== 'play');
  }

  addQuickHostButton();
  syncQuickButton();
  setInterval(syncQuickButton, 500);
})();