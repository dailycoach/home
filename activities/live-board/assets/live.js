const responseBoard = document.querySelector("#responseBoard");
const keywordBoard = document.querySelector("#keywordBoard");
const countLabel = document.querySelector("#countLabel");
const lastUpdated = document.querySelector("#lastUpdated");
const emptyState = document.querySelector("#emptyState");
const refreshBtn = document.querySelector("#refreshBtn");
const fullscreenBtn = document.querySelector("#fullscreenBtn");

let settings = {};
let refreshTimer = null;

function countTerms(items) {
  const map = new Map();

  items.forEach(item => {
    LiveBoard.splitTerms(item.keyword).forEach(term => {
      const normalized = term.replace(/\s+/g, " ").trim();
      if (!normalized) return;
      map.set(normalized, (map.get(normalized) || 0) + 1);
    });
  });

  return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
}

function renderResponses(items) {
  responseBoard.innerHTML = "";
  const max = Number(settings.maxLiveItems || 100);

  items.slice(0, max).forEach(item => {
    const card = document.createElement("section");
    card.className = "response-card";
    card.innerHTML = `
      <span class="participant-code">${LiveBoard.escapeHtml(item.participantCode || "익명")}</span>
      <p>${LiveBoard.escapeHtml(item.response || "")}</p>
      <small>${LiveBoard.escapeHtml(item.keyword || "")}</small>
    `;
    responseBoard.appendChild(card);
  });
}

function renderKeywords(items) {
  keywordBoard.innerHTML = "";

  countTerms(items).slice(0, 30).forEach(([term, count]) => {
    const tag = document.createElement("span");
    tag.className = `tag size-${Math.min(5, Math.max(1, count))}`;
    tag.textContent = `${term} ${count}`;
    keywordBoard.appendChild(tag);
  });
}

async function loadLiveData() {
  try {
    const data = LiveBoard.hasScriptUrl()
      ? await LiveBoard.jsonp(`${LiveBoard.scriptUrl()}?action=public`)
      : { items: LiveBoard.loadLocalPublicItems() };
    const items = Array.isArray(data.items) ? data.items : [];

    renderResponses(items);
    renderKeywords(items);

    countLabel.textContent = `${items.length}개 기록`;
    lastUpdated.textContent = new Date().toLocaleTimeString("ko-KR");
    emptyState.classList.toggle("hidden", items.length > 0);
  } catch (error) {
    emptyState.textContent = error.message;
    emptyState.classList.remove("hidden");
  }
}

async function init() {
  settings = await LiveBoard.loadConfig();
  LiveBoard.applyTextConfig(settings);
  await loadLiveData();

  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadLiveData, Number(LiveBoard.cfg.REFRESH_MS || 5000));
}

refreshBtn?.addEventListener("click", loadLiveData);

fullscreenBtn?.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

init();
