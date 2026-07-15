(() => {
  const { ITEMS, DOMAINS } = window.SELF_INC_DATA;
  const KEYS = {
    draft: "selfinc_check_v9_draft",
    history: "selfinc_check_v9_history",
    order: "selfinc_check_v9_order",
    tracker: "selfinc_check_v9_tracker"
  };
  const $ = (selector) => document.querySelector(selector);
  const screens = [...document.querySelectorAll(".screen")];
  const state = { answers: Array(ITEMS.length).fill(null), order: [], current: 0, result: null };

  function showScreen(id) {
    screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("show"), 1500);
  }

  function shuffleOrder() {
    const order = Array.from({ length: ITEMS.length }, (_, index) => index);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [order[index], order[randomIndex]] = [order[randomIndex], order[index]];
    }
    return order;
  }

  function validOrder(order) {
    return Array.isArray(order)
      && order.length === ITEMS.length
      && new Set(order).size === ITEMS.length
      && order.every((value) => Number.isInteger(value) && value >= 0 && value < ITEMS.length);
  }

  function loadOrder() {
    try {
      const savedOrder = JSON.parse(localStorage.getItem(KEYS.order));
      if (validOrder(savedOrder)) return savedOrder;
    } catch {}
    const order = shuffleOrder();
    localStorage.setItem(KEYS.order, JSON.stringify(order));
    return order;
  }

  function saveDraft() {
    const payload = {
      answers: state.answers,
      current: state.current,
      order: state.order,
      company: $("#companyInput").value.trim(),
      name: $("#nameInput").value.trim(),
      savedAt: Date.now()
    };
    localStorage.setItem(KEYS.draft, JSON.stringify(payload));
  }

  function loadDraft() {
    let loaded = false;
    try {
      const draft = JSON.parse(localStorage.getItem(KEYS.draft));
      if (draft && Array.isArray(draft.answers) && draft.answers.length === ITEMS.length) {
        state.answers = draft.answers.map((value) => (
          Number.isInteger(value) && value >= 1 && value <= 7 ? value : null
        ));
        state.current = Math.min(Math.max(Number(draft.current) || 0, 0), ITEMS.length - 1);
        if (validOrder(draft.order)) state.order = draft.order;
        if (typeof draft.company === "string") $("#companyInput").value = draft.company;
        if (typeof draft.name === "string") $("#nameInput").value = draft.name;
        loaded = state.answers.some((value) => value !== null);
      }
    } catch {}

    if (!loaded) {
      try {
        const oldDraft = JSON.parse(localStorage.getItem("selfinc_ceo_check_v7"));
        if (oldDraft && Array.isArray(oldDraft.answers) && oldDraft.answers.length === ITEMS.length) {
          state.answers = oldDraft.answers.map((value) => (
            Number.isInteger(value) && value >= 1 && value <= 7 ? value : null
          ));
          if (typeof oldDraft.company === "string") $("#companyInput").value = oldDraft.company;
          if (typeof oldDraft.ceo === "string") $("#nameInput").value = oldDraft.ceo;
          loaded = state.answers.some((value) => value !== null);
        }
      } catch {}
    }

    $("#startBtn").textContent = loaded ? "이어서 점검하기 →" : "점검 시작하기 →";
    $("#clearDraftBtn").hidden = !loaded;
    return loaded;
  }

  function clearDraft() {
    localStorage.removeItem(KEYS.draft);
    localStorage.removeItem(KEYS.order);
    state.answers = Array(ITEMS.length).fill(null);
    state.current = 0;
    state.order = shuffleOrder();
    localStorage.setItem(KEYS.order, JSON.stringify(state.order));
    $("#startBtn").textContent = "점검 시작하기 →";
    $("#clearDraftBtn").hidden = true;
    toast("저장된 답변을 지웠습니다.");
  }

  function answeredCount() {
    return state.answers.filter((value) => value !== null).length;
  }

  function firstUnanswered() {
    const index = state.order.findIndex((itemIndex) => state.answers[itemIndex] === null);
    return index < 0 ? 0 : index;
  }

  function renderQuestion() {
    const itemIndex = state.order[state.current];
    const item = ITEMS[itemIndex];
    $("#counter").textContent = `${state.current + 1} / ${ITEMS.length}`;
    $("#progressBar").style.width = `${(answeredCount() / ITEMS.length) * 100}%`;
    $("#qNo").textContent = `QUESTION ${String(state.current + 1).padStart(2, "0")}`;
    $("#qText").textContent = item.t;
    $("#prevBtn").disabled = state.current === 0;

    const scale = $("#scale");
    scale.innerHTML = "";
    for (let score = 1; score <= 7; score += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(score);
      button.setAttribute("aria-label", `${score}점`);
      button.setAttribute("aria-pressed", String(state.answers[itemIndex] === score));
      if (state.answers[itemIndex] === score) button.classList.add("selected");
      button.addEventListener("click", () => selectAnswer(score, button));
      scale.appendChild(button);
    }
  }

  function selectAnswer(value, button) {
    const itemIndex = state.order[state.current];
    state.answers[itemIndex] = value;
    [...$("#scale").children].forEach((scaleButton) => {
      const selected = scaleButton === button;
      scaleButton.classList.toggle("selected", selected);
      scaleButton.setAttribute("aria-pressed", String(selected));
    });
    saveDraft();
    $("#progressBar").style.width = `${(answeredCount() / ITEMS.length) * 100}%`;
    setTimeout(() => {
      if (state.current < ITEMS.length - 1) {
        state.current += 1;
        renderQuestion();
      } else if (answeredCount() === ITEMS.length) {
        finishTest();
      }
    }, 180);
  }

  function startTest() {
    state.order = state.order.length ? state.order : loadOrder();
    if (answeredCount() < ITEMS.length) {
      state.current = firstUnanswered();
    } else {
      finishTest();
      return;
    }
    renderQuestion();
    showScreen("testScreen");
  }

  function scoreItem(index, value) {
    return ITEMS[index].r ? 8 - value : value;
  }

  function compute() {
    const keys = Object.keys(DOMAINS);
    const domains = {};
    let total = 0;
    keys.forEach((key) => {
      const indexes = ITEMS.map((item, index) => item.d === key ? index : -1).filter((index) => index >= 0);
      const sum = indexes.reduce((accumulator, index) => accumulator + scoreItem(index, state.answers[index]), 0);
      domains[key] = Math.round(((sum - indexes.length) / (indexes.length * 6)) * 100);
      total += sum;
    });
    const overall = Math.round(((total - ITEMS.length) / (ITEMS.length * 6)) * 100);
    const sorted = keys.map((key) => ({ key, score: domains[key] })).sort((a, b) => a.score - b.score);
    return { overall, domains, focus: sorted[0].key, strong: sorted[sorted.length - 1].key, raw: total };
  }

  function bandFor(score) {
    if (score < 45) return { title: "정비가 먼저 필요한 시기", copy: "지금은 더 밀어붙이기보다 나를 소모시키는 방식부터 줄이는 편이 좋습니다." };
    if (score < 70) return { title: "균형을 조정하는 시기", copy: "기본 힘은 있으나 상황에 따라 흔들리는 지점이 있습니다. 작은 규칙 하나가 체감을 바꿀 수 있습니다." };
    return { title: "안정적으로 운영 중", copy: "다섯 힘이 비교적 안정적으로 작동합니다. 잘되는 방식을 무리 없이 오래 유지하는 것이 중요합니다." };
  }

  function levelCopy(key, score) {
    const domain = DOMAINS[key];
    return score < 45 ? domain.low : score < 70 ? domain.mid : domain.high;
  }

  function finishTest() {
    if (answeredCount() !== ITEMS.length) {
      toast("아직 답하지 않은 문항이 있습니다.");
      state.current = firstUnanswered();
      renderQuestion();
      return;
    }
    showScreen("loadingScreen");
    const copies = [
      "점수보다 먼저, 영역 사이의 균형을 살펴봅니다.",
      "강점과 부족함보다 지금 필요한 순서를 정리합니다.",
      "이번 주에 해볼 가장 작은 실험을 고르고 있습니다."
    ];
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      $("#loadingCopy").textContent = copies[index % copies.length];
    }, 480);
    setTimeout(() => {
      clearInterval(timer);
      state.result = compute();
      saveResult();
      renderResult();
      showScreen("resultScreen");
      localStorage.removeItem(KEYS.draft);
      $("#startBtn").textContent = "점검 시작하기 →";
      $("#clearDraftBtn").hidden = true;
    }, 1300);
  }

  function saveResult() {
    const result = state.result;
    let history = [];
    try { history = JSON.parse(localStorage.getItem(KEYS.history)) || []; } catch {}
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
      overall: result.overall,
      domains: result.domains,
      focus: result.focus,
      strong: result.strong,
      company: $("#companyInput").value.trim(),
      name: $("#nameInput").value.trim()
    };
    history.unshift(entry);
    localStorage.setItem(KEYS.history, JSON.stringify(history.slice(0, 8)));
    localStorage.setItem(KEYS.tracker, JSON.stringify({ resultId: entry.id, days: Array(7).fill(false) }));
  }

  function renderResult() {
    const result = state.result;
    const band = bandFor(result.overall);
    const focus = DOMAINS[result.focus];
    const strong = DOMAINS[result.strong];
    $("#totalScore").textContent = result.overall;
    $("#bandTitle").textContent = band.title;
    $("#bandCopy").textContent = band.copy;
    $("#strongName").textContent = strong.name;
    $("#strongCopy").textContent = levelCopy(result.strong, result.domains[result.strong]);
    $("#focusName").textContent = focus.name;
    $("#focusCopy").textContent = levelCopy(result.focus, result.domains[result.focus]);

    const domainList = $("#domainList");
    domainList.innerHTML = "";
    Object.keys(DOMAINS).forEach((key) => {
      const domain = DOMAINS[key];
      const score = result.domains[key];
      const element = document.createElement("div");
      element.className = "domain";
      element.innerHTML = `<div class="domain-head"><div class="domain-name">${domain.name}</div><div class="domain-bar"><span style="width:${score}%"></span></div><div class="domain-score">${score}</div></div><details><summary>이 점수가 말해주는 것</summary><div class="domain-copy">${domain.desc}<br>${levelCopy(key, score)}</div></details>`;
      domainList.appendChild(element);
    });

    $("#experimentTitle").textContent = focus.action;
    $("#experimentCopy").textContent = `${focus.name}을 한 번에 바꾸려 하지 말고, 같은 행동을 7일 동안 작게 반복해봅니다.`;
    $("#reflectionQuestion").textContent = focus.reflect;
    renderTracker();
    renderHistory();
  }

  function renderTracker() {
    let tracker = { days: Array(7).fill(false) };
    try { tracker = JSON.parse(localStorage.getItem(KEYS.tracker)) || tracker; } catch {}
    if (!Array.isArray(tracker.days) || tracker.days.length !== 7) tracker.days = Array(7).fill(false);
    const week = $("#weekTracker");
    week.innerHTML = "";
    tracker.days.forEach((done, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `day${done ? " done" : ""}`;
      button.textContent = `${index + 1}일`;
      button.setAttribute("aria-pressed", String(done));
      button.addEventListener("click", () => {
        tracker.days[index] = !tracker.days[index];
        localStorage.setItem(KEYS.tracker, JSON.stringify(tracker));
        renderTracker();
      });
      week.appendChild(button);
    });
  }

  function renderHistory() {
    let history = [];
    try { history = JSON.parse(localStorage.getItem(KEYS.history)) || []; } catch {}
    const wrap = $("#historyList");
    wrap.innerHTML = "";
    if (!history.length) {
      wrap.innerHTML = '<div class="history-item">아직 저장된 기록이 없습니다.</div>';
      return;
    }
    history.forEach((entry) => {
      const element = document.createElement("div");
      element.className = "history-item";
      element.innerHTML = `<span>${entry.date}<br>${DOMAINS[entry.focus]?.name || "—"} 먼저 돌보기</span><b>${entry.overall}</b>`;
      wrap.appendChild(element);
    });
  }

  function resultShareText() {
    const result = state.result;
    const focus = DOMAINS[result.focus];
    const strong = DOMAINS[result.strong];
    const band = bandFor(result.overall);
    const company = $("#companyInput").value.trim() || "SELF INC.";
    return [
      "SELF INC. 자존감 운영 점검",
      `${company} · ${result.overall}점 · ${band.title}`,
      `잘 작동하는 힘: ${strong.name}`,
      `먼저 돌볼 흐름: ${focus.name}`,
      `7일 실험: ${focus.action}`,
      `돌아볼 질문: ${focus.reflect}`
    ].join("\n");
  }

  async function shareResult() {
    const text = resultShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: "SELF INC. 자존감 운영 점검", text, url: location.href });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("결과 요약을 복사했습니다.");
    } catch {
      toast("공유 기능을 사용할 수 없습니다.");
    }
  }

  function restart() {
    state.answers = Array(ITEMS.length).fill(null);
    state.current = 0;
    state.result = null;
    state.order = shuffleOrder();
    localStorage.setItem(KEYS.order, JSON.stringify(state.order));
    localStorage.removeItem(KEYS.draft);
    $("#startBtn").textContent = "점검 시작하기 →";
    $("#clearDraftBtn").hidden = true;
    startTest();
  }

  $("#startBtn").addEventListener("click", startTest);
  $("#clearDraftBtn").addEventListener("click", clearDraft);
  $("#prevBtn").addEventListener("click", () => {
    if (state.current > 0) {
      state.current -= 1;
      renderQuestion();
      saveDraft();
    }
  });
  $("#exitBtn").addEventListener("click", () => {
    saveDraft();
    loadDraft();
    showScreen("introScreen");
    toast("현재 위치까지 저장했습니다.");
  });
  $("#companyInput").addEventListener("input", saveDraft);
  $("#nameInput").addEventListener("input", saveDraft);
  $("#shareBtn").addEventListener("click", shareResult);
  $("#printBtn").addEventListener("click", () => window.print());
  $("#restartBtn").addEventListener("click", restart);
  $("#homeBtn").addEventListener("click", () => showScreen("introScreen"));
  $("#clearHistoryBtn").addEventListener("click", () => {
    localStorage.removeItem(KEYS.history);
    renderHistory();
    toast("이전 기록을 지웠습니다.");
  });

  state.order = loadOrder();
  loadDraft();
  renderHistory();
})();
