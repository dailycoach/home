"use strict";

const ITEMS = [
  { id: 1, domain: "P", text: "일상에서 잔잔한 만족이나 기쁨을 자주 느낀다." },
  { id: 2, domain: "SN", text: "몸의 긴장이나 호흡 변화를 비교적 빨리 알아차린다." },
  { id: 3, domain: "E", text: "중요한 일을 할 때 주의가 한곳에 모인다." },
  { id: 4, domain: "R", text: "솔직한 마음을 나눌 수 있는 사람이 있다." },
  { id: 5, domain: "M", text: "내가 하는 일이 무엇을 위해 이어지는지 알고 있다." },

  { id: 6, domain: "A", text: "작게라도 끝낸 일을 확인하며 살아간다." },
  { id: 7, domain: "NM", text: "막연한 기분을 구체적인 감정의 이름으로 표현할 수 있다." },
  { id: 8, domain: "P", text: "예상과 다른 일이 생겨도 다시 희망을 떠올릴 수 있다." },
  { id: 9, domain: "E", text: "나의 강점이 쓰이는 활동에 시간을 내고 있다." },
  { id: 10, domain: "R", text: "필요할 때 다른 사람에게 도움을 요청하거나 받을 수 있다." },

  { id: 11, domain: "M", text: "나보다 큰 가치나 공동체와 연결되어 있다고 느낀다." },
  { id: 12, domain: "PT", text: "비슷한 어려움이 반복될 때 그것을 촉발하는 조건을 살펴본다." },
  { id: 13, domain: "A", text: "목표를 현실적으로 실행할 수 있는 단계로 나눈다." },
  { id: 14, domain: "P", text: "좋은 순간을 서두르지 않고 충분히 음미하는 편이다." },
  { id: 15, domain: "VL", text: "중요한 선택에서 타인의 기대와 내가 소중히 여기는 기준을 구분한다." },

  { id: 16, domain: "E", text: "적절히 도전적인 일을 만날 때 활력이 살아난다." },
  { id: 17, domain: "R", text: "가까운 관계 안에서 존중받고 있다고 느낀다." },
  { id: 18, domain: "M", text: "어려운 경험에서도 배울 의미를 찾을 수 있다." },
  { id: 19, domain: "CH", text: "감정이 올라올 때 바로 반응하기보다 잠시 멈출 틈을 만든다." },
  { id: 20, domain: "A", text: "어려움이 있어도 나에게 중요한 일을 다시 시작한다." },

  { id: 21, domain: "P", text: "힘든 감정이 생기면 그날의 좋은 경험까지 잘 보이지 않는다.", reverse: true },
  { id: 22, domain: "SN", text: "몸이 지친 뒤에야 내가 무리했다는 것을 알아차린다.", reverse: true },
  { id: 23, domain: "E", text: "해야 할 일을 하면서도 주의가 자주 흩어진다.", reverse: true },
  { id: 24, domain: "NM", text: "불편한 기분이 들어도 무엇을 느끼는지 구분하지 않고 지나간다.", reverse: true },
  { id: 25, domain: "R", text: "혼자 해결해야 한다는 생각 때문에 도움을 청하지 못한다.", reverse: true },

  { id: 26, domain: "M", text: "바쁘게 움직이지만 왜 이 일을 하는지 모를 때가 많다.", reverse: true },
  { id: 27, domain: "PT", text: "비슷한 반응을 반복한 뒤에도 원인을 상황 탓으로만 돌리는 편이다.", reverse: true },
  { id: 28, domain: "A", text: "시작했지만 마무리하지 못한 일이 계속 쌓여 있다.", reverse: true },
  { id: 29, domain: "VL", text: "타인이 기대하는 방식에 맞추느라 내 강점과 방식을 뒤로 미룬다.", reverse: true },
  { id: 30, domain: "CH", text: "문제를 알아차린 뒤에도 다음 행동을 정하지 못한 채 머문다.", reverse: true },

  { id: 31, domain: "SN", text: "감정이 커지기 전 에너지와 분위기의 작은 변화를 감지한다." },
  { id: 32, domain: "NM", text: "관찰한 사실과 내가 붙인 해석을 나누어 볼 수 있다." },
  { id: 33, domain: "PT", text: "나의 자동적인 반응이 관계와 선택에 미치는 영향을 살펴본다." },
  { id: 34, domain: "VL", text: "나답게 잘해 온 방식과 강점을 다음 선택에 활용한다." },
  { id: 35, domain: "CH", text: "작은 행동을 실행한 뒤 결과를 관찰하고 다시 조정한다." }
];

const DOMAINS = {
  P:  { group: "flourish", code: "P", name: "긍정정서", short: "정서", desc: "좋은 감정을 만들기보다 이미 존재하는 만족, 희망, 감사를 받아들이는 힘", questions: ["최근 나에게 실제로 힘을 준 감정은 무엇입니까?", "좋았던 순간을 더 오래 머물게 하려면 무엇을 달리할 수 있을까요?"], experiment: ["좋은 순간을 20초 더 머물러 보기", "7주 동안 매주 세 번, 좋았던 장면에 20초 더 머물고 감정과 몸의 변화를 한 문장으로 기록하세요."], observe: "한 주의 좋은 순간을 알아차릴 때 내 몸과 생각에는 어떤 변화가 생겼습니까?" },
  E:  { group: "flourish", code: "E", name: "몰입", short: "몰입", desc: "강점과 주의를 적절한 도전에 온전히 연결하는 힘", questions: ["시간의 흐름을 잊었던 최근 장면에는 어떤 조건이 있었습니까?", "주의를 흩뜨리는 한 가지를 덜어낸다면 무엇입니까?"], experiment: ["25분의 몰입 조건 만들기", "7주 동안 매주 한 차례, 강점을 쓸 수 있는 일의 방해 요소를 치우고 25분간 집중한 뒤 조건을 기록하세요."], observe: "이번 주 집중이 살아난 순간, 나의 능력과 과제 난이도는 어떻게 맞아 있었습니까?" },
  R:  { group: "flourish", code: "R", name: "관계", short: "관계", desc: "도움을 주고받고, 존중과 소속을 경험하는 연결의 힘", questions: ["지금 내 마음을 조금 더 솔직하게 나눌 수 있는 사람은 누구입니까?", "도움을 청하지 못하게 막는 생각은 사실입니까, 익숙한 해석입니까?"], experiment: ["매주 한 번 구체적으로 연결 요청하기", "7주 동안 매주 한 사람에게 안부를 넘어, 필요한 도움이나 나누고 싶은 마음 한 가지를 구체적인 문장으로 전하세요."], observe: "이번 주 솔직하게 연결했을 때 예상과 실제 반응 사이에는 어떤 차이가 있었습니까?" },
  M:  { group: "flourish", code: "M", name: "의미", short: "의미", desc: "일상의 선택을 가치, 기여, 더 큰 목적과 이어 보는 힘", questions: ["지금의 수고가 궁극적으로 지키려는 것은 무엇입니까?", "해야 하는 일과 중요해서 하는 일을 어떻게 구분할 수 있을까요?"], experiment: ["한 주의 일에 ‘왜’를 한 줄 붙이기", "7주 동안 매주 가장 많은 시간을 쓴 일 하나를 고르고, 그것이 어떤 가치와 연결되는지 한 문장으로 적으세요."], observe: "이번 주 일에 가치를 붙여 본 뒤 같은 일을 대하는 태도는 어떻게 달라졌습니까?" },
  A:  { group: "flourish", code: "A", name: "성취", short: "성취", desc: "중요한 일을 작게 나누고 끝맺으며 유능감을 축적하는 힘", questions: ["이미 해낸 것 중 내가 충분히 인정하지 않은 것은 무엇입니까?", "다음 행동을 실패하기 어려울 만큼 작게 만든다면 어느 정도입니까?"], experiment: ["매주 최소 행동 하나 완결하기", "7주 동안 매주 미뤄 둔 일 하나를 15분 안에 끝낼 수 있는 크기로 줄이고, 완료 표시까지 남기세요."], observe: "이번 주 시작보다 완료를 선택했을 때 나의 에너지에는 어떤 변화가 생겼습니까?" },
  SN: { group: "awareness", code: "S", name: "신호 포착", short: "신호", desc: "몸, 감정, 에너지의 작은 변화를 반응이 커지기 전에 감지하는 역량", questions: ["지금 내 몸이 먼저 말하고 있는 것은 무엇입니까?", "반응이 커지기 전 가장 먼저 나타나는 신호는 무엇입니까?"] },
  NM: { group: "awareness", code: "N", name: "경험 명명", short: "명명", desc: "감정, 욕구, 사실과 해석에 정확한 이름을 붙이는 역량", questions: ["지금 경험을 한 단어가 아니라 한 문장으로 이름 붙이면 무엇입니까?", "확인된 사실과 내가 해석한 부분은 각각 무엇입니까?"] },
  PT: { group: "awareness", code: "P", name: "패턴 이해", short: "패턴", desc: "상황-생각-반응 사이에서 반복되는 연결을 발견하는 역량", questions: ["이 장면은 언제, 누구와, 어떤 조건에서 반복됩니까?", "반복될 때 내가 자동으로 취하는 역할은 무엇입니까?"] },
  VL: { group: "awareness", code: "U", name: "고유성 정렬", short: "고유성", desc: "타인의 기대와 자기 기준을 구분하고, 자신의 강점·방식·가치를 선택에 반영하는 역량", questions: ["타인의 기대를 잠시 내려놓으면, 나는 어떤 방식으로 이 일을 풀고 싶습니까?", "지금 더 살려야 할 나만의 강점과 기준은 무엇입니까?"] },
  CH: { group: "awareness", code: "C", name: "선택과 조정", short: "선택", desc: "알아차린 뒤 작은 행동을 선택하고 결과에 따라 조정하는 역량", questions: ["지금 할 수 있는 가장 작은 다음 행동은 무엇입니까?", "실행 후 무엇을 관찰하면 다음 선택이 선명해집니까?"] }
};

const STATE_DATA = {
  aligned: { code: "01", name: "성장을 설계하는 플로리셔", summary: "삶의 여러 영역에서 웰빙이 비교적 안정적으로 작동하고, 자신의 경험을 읽어 다음 선택으로 연결하는 힘도 살아 있습니다. 지금은 부족함을 고치는 시기보다 잘되는 조건을 의식적으로 재현하고 주변으로 확장할 시기입니다." },
  momentum: { code: "02", name: "잘 살아가지만 신호를 놓치기 쉬운 상태", summary: "삶의 성과와 만족은 비교적 잘 유지되지만, 속도가 빠를수록 몸과 감정의 신호를 뒤늦게 볼 수 있습니다. 현재의 좋은 흐름을 오래 이어 가려면 더 노력하기보다 내적 신호를 읽는 정교함이 필요합니다." },
  observer: { code: "03", name: "변화를 준비하는 관찰자", summary: "삶의 만족감은 아직 충분히 차오르지 않았지만, 무엇이 일어나고 있는지 읽어낼 수 있는 힘이 있습니다. 알아차림을 분석에만 머물게 하지 않고 작은 행동으로 옮기면 변화의 감각이 빠르게 살아날 수 있습니다." },
  restore: { code: "04", name: "회복의 바닥을 고르는 시기", summary: "삶의 에너지와 자신을 관찰하는 여유가 함께 낮아진 때일 수 있습니다. 많은 것을 바꾸려 하기보다 한 가지 신호를 알아차리고, 실패하기 어려운 최소 행동을 반복하는 것이 먼저입니다." }
};

const GROUP_ORDER = ["P", "E", "R", "M", "A", "SN", "NM", "PT", "VL", "CH"];
const PAGE_SIZE = 5;
const STORAGE_KEY = "dailycoaching_flourish_notice_v1";

const state = { page: 0, answers: {}, name: "", context: "life", result: null };

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const mean = (numbers) => numbers.reduce((a, b) => a + b, 0) / numbers.length;
const round1 = (n) => Math.round(n * 10) / 10;
const escapeHtml = (value = "") => value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function getRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveRecord(record) {
  const records = getRecords();
  records.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 12)));
  updateHistoryCount();
}

function updateHistoryCount() { $("#history-count").textContent = getRecords().length; }

function showView(id) {
  $$(".view").forEach((view) => { view.hidden = view.id !== id; });
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => $(`#${id}`).focus?.({ preventScroll: true }), 50);
}

function startTest() {
  state.name = $("#participant-name").value.trim();
  state.context = $("input[name='context']:checked").value;
  state.page = 0;
  state.answers = {};
  renderPage();
  showView("test-view");
}

function renderPage() {
  const start = state.page * PAGE_SIZE;
  const items = ITEMS.slice(start, start + PAGE_SIZE);
  const form = $("#question-form");
  form.innerHTML = items.map((item) => `
    <div class="question-card" data-item="${item.id}">
      <span class="question-number">${String(item.id).padStart(2, "0")}</span>
      <p class="question-text">${item.text}</p>
      <div class="scale" role="radiogroup" aria-label="${item.id}번 문항 응답">
        ${[1,2,3,4,5,6,7].map((value) => `<label><input type="radio" name="q${item.id}" value="${value}" ${state.answers[item.id] === value ? "checked" : ""}><span>${value}</span></label>`).join("")}
      </div>
      <div class="scale-labels" aria-hidden="true"><span>전혀 아니다</span><span>매우 그렇다</span></div>
    </div>`).join("");
  form.querySelectorAll("input").forEach((input) => input.addEventListener("change", (event) => {
    state.answers[Number(event.target.name.slice(1))] = Number(event.target.value);
    updatePageStatus();
  }));
  $("#progress-step").textContent = `${String(state.page + 1).padStart(2, "0")} / 07`;
  $("#progress-bar").style.width = `${((state.page + 1) / 7) * 100}%`;
  $("#progress-copy").textContent = state.page < 5 ? "현재의 장면을 떠올려 주세요" : state.page === 5 ? "반복되는 방식을 살펴봅니다" : "선택과 행동을 확인합니다";
  $("#prev-button").disabled = state.page === 0;
  $("#next-button span:first-child").textContent = state.page === 6 ? "결과 보기" : "다음";
  updatePageStatus();
}

function updatePageStatus() {
  const pageItems = ITEMS.slice(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE);
  const answered = pageItems.filter((item) => state.answers[item.id]).length;
  $("#answer-status").textContent = answered === PAGE_SIZE ? "응답을 확인했습니다" : `${PAGE_SIZE - answered}개 문항이 남았습니다`;
  $("#next-button").disabled = answered !== PAGE_SIZE;
}

function nextPage() {
  if ($("#next-button").disabled) return;
  if (state.page < 6) {
    state.page += 1;
    renderPage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else finishTest();
}

function prevPage() {
  if (state.page === 0) return;
  state.page -= 1;
  renderPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function calculateResult() {
  const domainScores = {};
  GROUP_ORDER.forEach((domain) => {
    const domainItems = ITEMS.filter((item) => item.domain === domain);
    const scores = domainItems.map((item) => item.reverse ? 8 - state.answers[item.id] : state.answers[item.id]);
    domainScores[domain] = round1(mean(scores));
  });
  const flourish = round1(mean(["P", "E", "R", "M", "A"].map((key) => domainScores[key])));
  const awareness = round1(mean(["SN", "NM", "PT", "VL", "CH"].map((key) => domainScores[key])));
  const threshold = 4.7;
  const stateKey = flourish >= threshold && awareness >= threshold ? "aligned" : flourish >= threshold ? "momentum" : awareness >= threshold ? "observer" : "restore";
  return { id: crypto.randomUUID?.() || `${Date.now()}`, createdAt: new Date().toISOString(), name: state.name, context: state.context, domainScores, flourish, awareness, stateKey };
}

function finishTest() {
  state.result = calculateResult();
  saveRecord(state.result);
  renderResult(state.result);
  showView("result-view");
}

function sortedKeys(result, group) {
  return GROUP_ORDER.filter((key) => DOMAINS[key].group === group).sort((a, b) => result.domainScores[b] - result.domainScores[a]);
}

function contextLabel(context) {
  return ({ life: "삶 전체", work: "일과 성장", relationship: "관계", change: "변화 과제" })[context] || "삶 전체";
}

function renderResult(result) {
  const flourishKeys = sortedKeys(result, "flourish");
  const awarenessKeys = sortedKeys(result, "awareness");
  const strengthKey = flourishKeys[0];
  const growthKey = flourishKeys.at(-1);
  const leverKey = awarenessKeys.at(-1);
  const stateInfo = STATE_DATA[result.stateKey];
  const displayName = result.name ? `${escapeHtml(result.name)}님의` : "당신의";

  $("#result-title").innerHTML = `${displayName}<br>성장 지도를 읽었습니다.`;
  $("#result-date").textContent = `${new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" }).format(new Date(result.createdAt))} · ${contextLabel(result.context)}`;
  $("#state-code").textContent = stateInfo.code;
  $("#state-name").textContent = stateInfo.name;
  $("#state-summary").textContent = stateInfo.summary;
  $("#flourish-score").textContent = result.flourish.toFixed(1);
  $("#awareness-score").textContent = result.awareness.toFixed(1);

  $("#strength-title").textContent = `${DOMAINS[strengthKey].name}이 삶을 받치고 있습니다.`;
  $("#strength-copy").textContent = `${DOMAINS[strengthKey].desc}이 현재 가장 선명합니다. 이 점수가 높다는 사실보다, 이 힘이 살아나는 조건을 다른 장면에도 옮겨 쓰는 것이 중요합니다.`;
  $("#growth-title").textContent = `${DOMAINS[growthKey].name}에 먼저 여백이 필요합니다.`;
  $("#growth-copy").textContent = `${DOMAINS[growthKey].desc}이 부족하다는 판정이 아닙니다. 지금의 생활에서 이 경험이 상대적으로 덜 확보되어 있음을 뜻합니다.`;
  $("#lever-title").textContent = `${DOMAINS[leverKey].name}부터 연결합니다.`;
  $("#lever-copy").textContent = `${DOMAINS[leverKey].desc}을 보완하면 ${DOMAINS[growthKey].name}을 의지로 밀어붙이지 않고 실제 장면에서 다룰 수 있습니다.`;

  renderRadar(result);
  renderLegend(result);
  renderBridge(result, growthKey, leverKey);
  renderFocusOptions(result, growthKey);
}

function pointFor(index, radius, count = 10, center = 300) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index / count);
  return [center + Math.cos(angle) * radius, center + Math.sin(angle) * radius];
}

function pointsString(radiusFn) {
  return GROUP_ORDER.map((_, index) => pointFor(index, radiusFn(index)).join(",")).join(" ");
}

function renderRadar(result) {
  const svg = $("#radar-chart");
  const grid = [1,2,3,4,5,6,7].map((level) => `<polygon class="radar-grid" points="${pointsString(() => level * 31)}" />`).join("");
  const axes = GROUP_ORDER.map((_, index) => { const [x,y] = pointFor(index, 217); return `<line class="radar-axis" x1="300" y1="300" x2="${x}" y2="${y}" />`; }).join("");
  const area = `<polygon class="radar-area" points="${pointsString((index) => result.domainScores[GROUP_ORDER[index]] * 31)}" />`;
  const dots = GROUP_ORDER.map((key, index) => { const [x,y] = pointFor(index, result.domainScores[key] * 31); return `<circle class="radar-dot" cx="${x}" cy="${y}" r="6" />`; }).join("");
  const labels = GROUP_ORDER.map((key, index) => { const [x,y] = pointFor(index, 257); return `<text class="radar-label" x="${x}" y="${y}">${DOMAINS[key].short}</text>`; }).join("");
  svg.innerHTML = `${grid}${axes}${area}${dots}${labels}`;
}

function renderLegend(result) {
  $("#score-legend").innerHTML = GROUP_ORDER.map((key, index) => `
    <div class="score-item ${DOMAINS[key].group}">
      <span class="code">${String(index + 1).padStart(2, "0")}</span><strong>${DOMAINS[key].name}</strong><b>${result.domainScores[key].toFixed(1)}</b>
      <div class="bar"><span style="width:${(result.domainScores[key] / 7) * 100}%"></span></div>
    </div>`).join("");
}

function renderBridge(result, growthKey, leverKey) {
  const gap = Math.abs(result.flourish - result.awareness);
  const gapCopy = gap < .6 ? "두 축의 간격이 크지 않습니다. 현재의 알아차림을 실제 생활의 반복 가능한 조건으로 만드는 데 초점을 둡니다." : result.flourish > result.awareness ? "삶은 비교적 잘 굴러가지만 내면의 신호를 읽는 속도가 뒤따르지 못할 수 있습니다. 멈춤과 명명이 현재의 흐름을 보호합니다." : "자신을 읽는 힘에 비해 삶의 체감이 아직 따라오지 않을 수 있습니다. 분석을 줄이고 완료 가능한 행동 하나로 옮기는 것이 중요합니다.";
  $("#bridge-copy").textContent = gapCopy;
  const questions = [DOMAINS[growthKey].questions[0], DOMAINS[leverKey].questions[0], DOMAINS[growthKey].questions[1], DOMAINS[leverKey].questions[1]];
  $("#coaching-questions").innerHTML = questions.map((question, i) => `<div class="coaching-question"><span>Q${i + 1}</span><p>${question}</p></div>`).join("");
}

function renderFocusOptions(result, initialKey) {
  const select = $("#focus-select");
  select.innerHTML = ["P", "E", "R", "M", "A"].map((key) => `<option value="${key}" ${key === initialKey ? "selected" : ""}>${DOMAINS[key].name} · ${result.domainScores[key].toFixed(1)}</option>`).join("");
  select.onchange = () => renderExperiment(select.value);
  renderExperiment(initialKey);
}

function renderExperiment(key) {
  const domain = DOMAINS[key];
  $("#experiment-title").textContent = domain.experiment[0];
  $("#experiment-action").textContent = domain.experiment[1];
  $("#experiment-question").textContent = domain.observe;
}

function openMethod() { $("#method-dialog").showModal(); }
function closeDialogs() { $$('dialog[open]').forEach((dialog) => dialog.close()); }

function openHistory() {
  const records = getRecords();
  const list = $("#history-list");
  list.innerHTML = records.length ? records.map((record, index) => `
    <article class="history-item">
      <div><h3>${escapeHtml(record.name || "이름 없는 기록")} · ${STATE_DATA[record.stateKey]?.name || "성장 지도"}</h3><p>${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(record.createdAt))} · ${contextLabel(record.context)}</p></div>
      <div class="history-scores"><span>${record.flourish.toFixed(1)} / ${record.awareness.toFixed(1)}</span><button type="button" data-history-index="${index}">보기</button></div>
    </article>`).join("") : `<p class="empty-history">아직 저장된 기록이 없습니다.</p>`;
  list.querySelectorAll("button[data-history-index]").forEach((button) => button.addEventListener("click", () => {
    state.result = records[Number(button.dataset.historyIndex)];
    closeDialogs();
    renderResult(state.result);
    showView("result-view");
  }));
  $("#history-dialog").showModal();
}

function copySummary() {
  if (!state.result) return;
  const r = state.result;
  const flourishKeys = sortedKeys(r, "flourish");
  const awarenessKeys = sortedKeys(r, "awareness");
  const summary = `[플로리싱 × 알아차림 성장지도]\n${r.name ? `${r.name} · ` : ""}${contextLabel(r.context)}\n현재 상태: ${STATE_DATA[r.stateKey].name}\n삶의 플로리싱 ${r.flourish.toFixed(1)} / 알아차림 역량 ${r.awareness.toFixed(1)}\n잘 작동하는 힘: ${DOMAINS[flourishKeys[0]].name}\n먼저 볼 장면: ${DOMAINS[flourishKeys.at(-1)].name}\n연결할 알아차림: ${DOMAINS[awarenessKeys.at(-1)].name}\n\n이 결과는 진단이 아닌 성장 대화용 자기점검입니다.`;
  navigator.clipboard.writeText(summary).then(() => showToast("결과 요약을 복사했습니다")).catch(() => showToast("복사하지 못했습니다"));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function goHome() { closeDialogs(); showView("intro-view"); }
function restart() { state.page = 0; state.answers = {}; renderPage(); showView("test-view"); }

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  ({
    home: goHome,
    start: startTest,
    next: nextPage,
    prev: prevPage,
    restart,
    method: openMethod,
    history: openHistory,
    "close-dialog": closeDialogs,
    copy: copySummary,
    print: () => window.print()
  })[action]?.();
});

document.addEventListener("keydown", (event) => {
  if (!$("#test-view").hidden && /^[1-7]$/.test(event.key)) {
    const activeItem = ITEMS[state.page * PAGE_SIZE];
    const target = document.querySelector(`input[name="q${activeItem.id}"][value="${event.key}"]`);
    if (target) { target.checked = true; target.dispatchEvent(new Event("change", { bubbles: true })); }
  }
});

updateHistoryCount();
