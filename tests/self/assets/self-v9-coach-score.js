(() => {
  const ORDER = ["SR", "ST", "BD", "CS", "RS"];
  const KINGDOM = {
    K: "관계와 주도권 열기",
    I: "현재 장면 인식",
    N: "핵심 욕구·패턴 명명",
    G: "성장 방향 세우기",
    D: "선택과 설계",
    O: "작은 실행",
    M: "의미화와 성장기록"
  };

  const content = document.querySelector("#coachContent");
  const tabs = document.querySelector("#coachTabs");
  const openButton = document.querySelector("#coachViewBtn");
  const domainData = window.SELF_INC_DATA?.DOMAINS || {};

  if (!content || !tabs || !openButton) return;

  function readScores() {
    const nodes = [...document.querySelectorAll("#domainList .domain-score")];
    return ORDER.reduce((result, key, index) => {
      const value = Number.parseInt(nodes[index]?.textContent || "", 10);
      result[key] = Number.isFinite(value) ? value : null;
      return result;
    }, {});
  }

  function overallScore(scores) {
    const rendered = Number.parseInt(document.querySelector("#totalScore")?.textContent || "", 10);
    if (Number.isFinite(rendered)) return rendered;
    const valid = ORDER.map((key) => scores[key]).filter(Number.isFinite);
    return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
  }

  function activeKey() {
    const buttons = [...tabs.querySelectorAll(".coach-tab")];
    const index = buttons.findIndex((button) => button.classList.contains("is-active"));
    return ORDER[index >= 0 ? index : 0];
  }

  function scoreBand(score) {
    if (score <= 34) return { label: "우선 회복 구간", className: "is-critical", direction: "회복과 안전을 우선할 필요가 있는" };
    if (score <= 44) return { label: "취약 구간", className: "is-low", direction: "반복 장면을 세밀하게 확인해야 하는" };
    if (score <= 54) return { label: "전환 구간", className: "is-transition", direction: "상황에 따라 작동과 흔들림이 교차하는" };
    if (score <= 69) return { label: "관리 구간", className: "is-middle", direction: "기본 힘은 있으나 조건에 따라 기복이 생길 수 있는" };
    if (score <= 84) return { label: "강점 구간", className: "is-high", direction: "비교적 안정적으로 작동하는" };
    return { label: "강점 확장 구간", className: "is-expanded", direction: "매우 강하게 작동하며 과잉 사용도 함께 살펴볼" };
  }

  function profileType(spread) {
    if (spread <= 10) return { label: "균형형", copy: "다섯 영역의 차이가 크지 않아 단일 약점보다 상황별 작동 조건을 확인하는 편이 좋습니다." };
    if (spread <= 24) return { label: "차이형", copy: "영역별 강약 차이가 보여 우선영역과 강점 자원을 연결하는 코칭이 효과적입니다." };
    return { label: "집중형", copy: "최저영역과 최고영역의 격차가 커서 약점을 직접 교정하기보다 강점 자원을 빌려 병목을 다루는 접근이 필요합니다." };
  }

  function profile(scores) {
    const entries = ORDER
      .map((key) => ({ key, score: scores[key], name: domainData[key]?.name || key }))
      .filter((entry) => Number.isFinite(entry.score));
    const ascending = [...entries].sort((a, b) => a.score - b.score);
    const descending = [...ascending].reverse();
    const lowest = ascending[0];
    const second = ascending[1] || lowest;
    const highest = descending[0];
    const spread = lowest && highest ? highest.score - lowest.score : 0;
    return { entries, ascending, descending, lowest, second, highest, spread };
  }

  function relation(diff) {
    const amount = Math.abs(diff);
    if (amount <= 5) return `전체 점수와 거의 같은 수준입니다.`;
    if (diff < 0) return `전체 점수보다 ${amount}점 낮아 상대적으로 더 많은 코칭 주의가 필요합니다.`;
    return `전체 점수보다 ${amount}점 높아 다른 영역을 지원할 수 있는 자원으로 활용할 수 있습니다.`;
  }

  function roleText(key, currentProfile) {
    if (key === currentProfile.lowest?.key) return "현재 우선개입 1순위";
    if (key === currentProfile.second?.key) return "후속 확인 2순위";
    if (key === currentProfile.highest?.key) return "현재 활용 가능한 핵심 자원";
    return "현재 균형을 유지하며 관찰할 영역";
  }

  function coachingPriority(key, score, overall, currentProfile) {
    const name = domainData[key]?.name || key;
    const strongest = currentProfile.highest;
    if (overall < 45) {
      return `전체 ${overall}점으로 나타난 흐름을 고려하면 성과 목표를 추가하기보다 일상 기능, 관계 안전, 회복 리듬을 먼저 확인하세요. ${name}은 문제를 교정하는 방식보다 부담을 줄이고 작동 조건을 복구하는 방식으로 접근합니다.`;
    }
    if (key === currentProfile.lowest?.key) {
      return `${name}을 직접 끌어올리려 하기보다 ${strongest.name} ${strongest.score}점의 강점을 어떻게 빌려올지 설계하세요. 점수 상승이 아니라 한 장면에서의 행동 변화가 1차 목표입니다.`;
    }
    if (key === currentProfile.highest?.key) {
      return `${name}은 현재 강점 자원입니다. 이 힘을 가장 낮은 ${currentProfile.lowest.name} ${currentProfile.lowest.score}점 영역에 연결하되, 과잉 사용이나 타인에게 같은 방식을 요구하는지 확인하세요.`;
    }
    if (score >= 85) {
      return `${name}은 매우 강하게 작동합니다. 더 강화하기보다 유연성, 과잉 사용, 관계 속 균형을 점검하고 약한 영역을 돕는 자원으로 전환하세요.`;
    }
    return `${name}은 독립된 약점이나 강점으로 단정하기보다 최저영역과 최고영역 사이를 연결하는 조절 영역으로 살펴보세요.`;
  }

  function dynamicQuestions(key, score, overall, currentProfile) {
    const name = domainData[key]?.name || key;
    const strongest = currentProfile.highest;
    const lowest = currentProfile.lowest;
    const diff = score - overall;
    const action = domainData[key]?.action || "이번 주 작은 행동 하나를 반복해보세요.";
    const isStrongest = key === strongest?.key;

    return {
      K: `현재 ${name} ${score}점이라는 결과를 보며 가장 먼저 떠오르는 최근의 실제 장면은 무엇인가요?`,
      I: `그 장면에서 ${name}이 작동하거나 멈추는 신호를 생각·감정·몸·행동으로 나누면 각각 무엇인가요?`,
      N: `전체 ${overall}점과 ${Math.abs(diff)}점 차이를 만드는 반복 패턴, 욕구 또는 두려움을 한 문장으로 이름 붙인다면 무엇인가요?`,
      G: isStrongest
        ? `강점인 ${name} ${score}점을 가장 낮은 ${lowest.name} ${lowest.score}점 영역에 빌려준다면 어떤 성장 장면이 가능할까요?`
        : `강점인 ${strongest.name} ${strongest.score}점의 자원을 빌려 ${name}에서 만들고 싶은 구체적인 성장 장면은 무엇인가요?`,
      D: `${name}의 점수를 올리는 목표 대신, 지금보다 한 단계 나아갔음을 보여줄 관찰 가능한 행동 기준을 하나 정한다면 무엇인가요?`,
      O: `${action} 이 행동을 이번 주 언제, 어디서, 몇 회 실행할지 구체적으로 정해볼까요?`,
      M: `7일 뒤 점수보다 어떤 행동·관계·회복 신호가 달라지면 ${name}이 성장했다고 말할 수 있나요?`
    };
  }

  function renderQuestionList(questions) {
    return Object.entries(KINGDOM).map(([code, label]) => `
      <div class="kingdom-item">
        <span class="kingdom-code">${code}</span>
        <div><b>${label}</b><p>${questions[code]}</p></div>
      </div>
    `).join("");
  }

  function enhance() {
    if (!content.querySelector(".coach-domain-head")) return;
    if (content.querySelector(".coach-score-profile")) return;

    const scores = readScores();
    const overall = overallScore(scores);
    const key = activeKey();
    const score = scores[key];
    if (!Number.isFinite(overall) || !Number.isFinite(score)) return;

    const currentProfile = profile(scores);
    const band = scoreBand(score);
    const type = profileType(currentProfile.spread);
    const name = domainData[key]?.name || key;
    const rank = currentProfile.ascending.findIndex((entry) => entry.key === key) + 1;
    const diff = score - overall;
    const role = roleText(key, currentProfile);
    const questions = dynamicQuestions(key, score, overall, currentProfile);

    const profileBlock = document.createElement("section");
    profileBlock.className = "coach-score-profile";
    profileBlock.dataset.scoreEnhanced = "true";
    profileBlock.innerHTML = `
      <div class="coach-score-kicker">
        <b>현재 검사결과를 반영한 코치 해석</b>
        <span class="coach-score-band ${band.className}">${band.label}</span>
      </div>
      <div class="coach-score-metrics">
        <div class="coach-score-metric"><span>전체 점수</span><b>${overall}점</b></div>
        <div class="coach-score-metric"><span>${name}</span><b>${score}점</b></div>
        <div class="coach-score-metric"><span>낮은 점수 기준</span><b>${rank}순위</b></div>
        <div class="coach-score-metric"><span>영역 간 격차</span><b>${currentProfile.spread}점</b></div>
      </div>
      <div class="coach-score-narrative">
        <strong>${name} ${score}점</strong>은 ${band.direction} 상태로 읽을 수 있습니다. ${relation(diff)}
        5영역 안에서는 <strong>${role}</strong>이며, 최저 ${currentProfile.lowest.name} ${currentProfile.lowest.score}점과 최고 ${currentProfile.highest.name} ${currentProfile.highest.score}점의 차이는 ${currentProfile.spread}점입니다.
      </div>
      <div class="coach-score-profile-grid">
        <div class="coach-score-card"><b>전체 프로파일 · ${type.label}</b><p>${type.copy}</p></div>
        <div class="coach-score-card"><b>강점 자원 연결</b><p>${currentProfile.highest.name} ${currentProfile.highest.score}점의 작동 방식을 ${currentProfile.lowest.name} ${currentProfile.lowest.score}점 영역에 어떻게 연결할지 탐색하세요.</p></div>
      </div>
      <div class="coach-score-priority"><b>점수 기반 코칭 우선순위</b><p>${coachingPriority(key, score, overall, currentProfile)}</p></div>
    `;

    content.insertBefore(profileBlock, content.firstChild);

    const genericTitle = content.querySelector(".coach-kingdom-title");
    if (genericTitle) {
      genericTitle.classList.add("coach-pattern-title");
      genericTitle.textContent = "저점·고점 패턴별 KINGDOM 질문";

      const currentTitle = document.createElement("h4");
      currentTitle.className = "coach-current-title";
      currentTitle.textContent = "현재 점수 기반 KINGDOM 질문";

      const note = document.createElement("div");
      note.className = "coach-current-note";
      note.textContent = `선택한 ${name} ${score}점, 전체 ${overall}점, 강점 ${currentProfile.highest.name} ${currentProfile.highest.score}점, 우선영역 ${currentProfile.lowest.name} ${currentProfile.lowest.score}점을 함께 반영한 질문입니다.`;

      const list = document.createElement("div");
      list.className = "kingdom-list coach-current-kingdom";
      list.innerHTML = renderQuestionList(questions);

      genericTitle.parentNode.insertBefore(currentTitle, genericTitle);
      genericTitle.parentNode.insertBefore(note, genericTitle);
      genericTitle.parentNode.insertBefore(list, genericTitle);
    }
  }

  let queued = false;
  function scheduleEnhance() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhance();
    });
  }

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(content, { childList: true, subtree: true });
  tabs.addEventListener("click", scheduleEnhance);
  openButton.addEventListener("click", () => setTimeout(scheduleEnhance, 0));
})();
