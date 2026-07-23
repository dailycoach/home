const QUESTIONS = [
  '이 직업은 사람을 직접 많이 만나나요?',
  '주로 실내에서 일하나요?',
  '결과물이 눈에 보이는 형태인가요?',
  '안전이나 생명과 관련이 있나요?',
  '컴퓨터나 기계를 자주 사용하나요?',
  '팀으로 일하는 경우가 많나요?',
  '전문 자격이나 교육이 꼭 필요한가요?',
  '새로운 것을 만들거나 표현하나요?',
  '현장 이동이 잦은 편인가요?',
  '숫자나 자료를 많이 다루나요?',
  '어린이나 청소년을 자주 만나나요?',
  '고객에게 서비스를 직접 제공하나요?'
];

const STORAGE_KEY = 'career-deduction-team-v5';
const HINT_TYPES = ['category', 'keyword', 'first', 'last', 'length', 'work', 'doubleKeyword'];

const state = {
  phase: 'setup',
  teamSizes: { A: 5, B: 5 },
  teamNames: { A: 'TEAM BLUE', B: 'TEAM ORANGE' },
  players: { A: [], B: [] },
  rosters: { A: [], B: [] },
  revealed: { A: false, B: false },
  turn: 'A',
  timerSeconds: 30,
  bonusCount: 3,
  bonusTurns: [3, 6, 9],
  bonusDone: [],
  turnCount: 0,
  timeLeft: 30,
  timer: null,
  bonusTimer: null,
  bonusTimeLeft: 15,
  lastBonusType: null,
  pendingAction: null,
  log: [],
  chanceUsed: { A: false, B: false },
  bonusWinner: null,
  winner: null
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const screens = ['setupScreen', 'dealScreen', 'playScreen', 'gameEndScreen'];

function showScreen(id) {
  screens.forEach(screenId => $(`#${screenId}`)?.classList.toggle('hidden', screenId !== id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function chosung(text) {
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  return [...text].map(char => {
    const code = char.charCodeAt(0) - 44032;
    if (code >= 0 && code < 11172) return CHO[Math.floor(code / 588)];
    return char === ' ' ? ' ' : (/[A-Za-z0-9·]/.test(char) ? char : '');
  }).join('');
}

function teamLabel(side) {
  return state.teamNames[side] || `TEAM ${side}`;
}

function opponent(side) {
  return side === 'A' ? 'B' : 'A';
}

function clearTimers() {
  if (state.timer) clearInterval(state.timer);
  if (state.bonusTimer) clearInterval(state.bonusTimer);
  state.timer = null;
  state.bonusTimer = null;
}

function save() {
  const snapshot = { ...state, timer: null, bonusTimer: null };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function load() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!snapshot?.players?.A?.length || !snapshot?.players?.B?.length) return false;
    Object.assign(state, snapshot, { timer: null, bonusTimer: null });
    state.chanceUsed ||= { A: false, B: false };
    state.rosters.A = (state.rosters.A || []).map(entry => ({ ...entry, hints: entry.hints || [] }));
    state.rosters.B = (state.rosters.B || []).map(entry => ({ ...entry, hints: entry.hints || [] }));
    return true;
  } catch {
    return false;
  }
}

function defaultPlayers(side, count) {
  const prefix = side === 'A' ? '블루' : '오렌지';
  return Array.from({ length: count }, (_, index) => ({ name: `${prefix} ${index + 1}` }));
}

function renderTeamInputs(side) {
  const box = $(`#names${side}`);
  if (!box) return;
  const count = state.teamSizes[side];
  const previous = state.players[side] || [];
  const defaults = defaultPlayers(side, count);
  state.players[side] = Array.from({ length: count }, (_, index) => previous[index] || defaults[index]);
  box.innerHTML = state.players[side].map((player, index) => `
    <label class="name-row">
      <span>${index + 1}</span>
      <input maxlength="12" value="${escapeHtml(player.name)}" aria-label="${teamLabel(side)} ${index + 1}번 이름">
    </label>
  `).join('');
  $(`#count${side}`).textContent = count;
}

function captureTeamInputs(side) {
  const inputs = $$(`#names${side} input`);
  const prefix = side === 'A' ? '블루' : '오렌지';
  if (inputs.length) {
    state.players[side] = inputs.map((input, index) => ({
      name: input.value.trim() || `${prefix} ${index + 1}`
    }));
  }
  const nameInput = $(`#teamName${side}`);
  if (nameInput) state.teamNames[side] = nameInput.value.trim() || `TEAM ${side}`;
}

function setTeamSize(side, next) {
  captureTeamInputs(side);
  state.teamSizes[side] = Math.max(2, Math.min(6, next));
  renderTeamInputs(side);
}

function initSetup() {
  state.players.A = defaultPlayers('A', 5);
  state.players.B = defaultPlayers('B', 5);
  renderTeamInputs('A');
  renderTeamInputs('B');
  $('#resumeBtn')?.classList.toggle('hidden', !localStorage.getItem(STORAGE_KEY));
}

function collectSetup() {
  state.teamNames.A = $('#teamNameA').value.trim() || 'TEAM BLUE';
  state.teamNames.B = $('#teamNameB').value.trim() || 'TEAM ORANGE';
  state.players.A = $$('#namesA input').map((input, index) => ({ name: input.value.trim() || `블루 ${index + 1}` }));
  state.players.B = $$('#namesB input').map((input, index) => ({ name: input.value.trim() || `오렌지 ${index + 1}` }));
  state.teamSizes.A = state.players.A.length;
  state.teamSizes.B = state.players.B.length;
  state.timerSeconds = Number($('input[name="timer"]:checked').value);
  state.bonusCount = Number($('input[name="bonus"]:checked').value);
  prepareMatch();
}

function calcBonusTurns() {
  if (state.bonusCount === 2) return [4, 8];
  if (state.bonusCount === 4) return [2, 5, 8, 11];
  return [3, 6, 9];
}

function prepareMatch() {
  clearTimers();
  const jobs = shuffle(JOBS).slice(0, state.teamSizes.A + state.teamSizes.B);
  state.rosters.A = state.players.A.map((player, index) => ({
    player: player.name,
    job: jobs[index],
    revealed: false,
    hints: []
  }));
  state.rosters.B = state.players.B.map((player, index) => ({
    player: player.name,
    job: jobs[state.teamSizes.A + index],
    revealed: false,
    hints: []
  }));
  state.revealed = { A: false, B: false };
  state.turn = 'A';
  state.turnCount = 0;
  state.bonusTurns = calcBonusTurns();
  state.bonusDone = [];
  state.lastBonusType = null;
  state.log = [];
  state.chanceUsed = { A: false, B: false };
  state.bonusWinner = null;
  state.winner = null;
  state.phase = 'deal';
  renderDeal();
  showScreen('dealScreen');
  save();
}

function renderDeal() {
  $('#dealTeamA').textContent = `${teamLabel('A')} · ${state.teamSizes.A}명`;
  $('#dealTeamB').textContent = `${teamLabel('B')} · ${state.teamSizes.B}명`;
  $('#beginMatch').disabled = true;
  $('#beginMatch').textContent = '두 팀 확인 후 배틀 시작';
}

function renderSecretCards(side) {
  return `
    <div class="secret-team-title ${side.toLowerCase()}">
      <b>${escapeHtml(teamLabel(side))}</b>
      <span>${state.teamSizes[side]}개의 비밀 직업</span>
    </div>
    <div class="secret-card-grid">
      ${state.rosters[side].map(entry => `
        <article class="secret-card ${side.toLowerCase()}">
          <small>${escapeHtml(entry.player)} · ${entry.job.id}</small>
          <h3>${escapeHtml(entry.job.name)}</h3>
          <p>${escapeHtml(entry.job.desc)}</p>
          <div class="tags">${entry.job.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}</div>
        </article>
      `).join('')}
    </div>
  `;
}

function showTeamSecret(side) {
  state.revealed[side] = true;
  $('#secretTitle').textContent = `${teamLabel(side)} 비밀 카드`;
  $('#secretContent').innerHTML = renderSecretCards(side);
  openModal('secretModal');
  if (state.revealed.A && state.revealed.B) {
    $('#beginMatch').disabled = false;
    $('#beginMatch').textContent = 'JOB BATTLE 시작 →';
  }
  save();
}
