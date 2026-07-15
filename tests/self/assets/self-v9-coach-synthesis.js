(() => {
  const ORDER = ["SR", "ST", "BD", "CS", "RS"];
  const domainData = window.SELF_INC_DATA?.DOMAINS || {};
  const content = document.querySelector("#coachContent");
  const tabs = document.querySelector("#coachTabs");
  const openButton = document.querySelector("#coachViewBtn");

  if (!content || !tabs || !openButton) return;

  const PAIR_ANALYSIS = {
    "BD|CS": "관계 안에서 타인의 기대와 평가를 크게 의식하면서도 자신의 한계와 요청을 충분히 말하지 못하는 흐름입니다. 겉으로는 협조적이거나 잘 적응하는 모습으로 보일 수 있지만, 실제로는 비교·승인 부담이 경계를 약화시키고 뒤늦은 피로와 불만으로 이어질 수 있습니다.",
    "BD|RS": "관계를 유지하기 위해 시간과 감정을 많이 내어주지만, 소진 뒤 회복하는 장치가 충분히 작동하지 않는 흐름입니다. 거절하지 못하는 문제가 아니라 부담을 조기에 알아차리고 조정하는 과정 전체가 늦어지는 상태로 볼 수 있습니다.",
    "CS|RS": "비교와 평가 압력이 커질수록 생활 리듬과 정서 회복이 함께 흔들리는 흐름입니다. 의지 부족보다 외부 기준에 오래 노출된 뒤 회복 행동을 시작하지 못하는 패턴을 구체적인 장면에서 확인할 필요가 있습니다.",
    "SR|BD": "관계의 불편을 줄이기 위해 자신을 뒤로 미루고, 그 결과를 다시 자기비난으로 처리하는 흐름입니다. 타인을 배려하는 능력과 자신을 함부로 다루는 방식이 섞여 있을 수 있어, 관계를 지키면서도 자신을 존중하는 표현을 함께 연습해야 합니다.",
    "SR|CS": "성과·비교·평가가 자기 가치와 빠르게 결합되는 흐름입니다. 잘한 일은 축소하고 부족한 장면은 존재 전체의 문제로 확대할 수 있으므로, 외부 결과와 자기 존재를 분리하는 대화가 우선됩니다.",
    "SR|RS": "피로하거나 흔들릴 때 자신을 돌보기보다 더 강하게 몰아붙이고, 회복이 늦어질수록 자기비난이 커지는 흐름입니다. 행동 개선보다 자기대화와 기본 생활 리듬을 동시에 낮은 난이도로 복구하는 접근이 필요합니다.",
    "SR|ST": "자신의 판단과 시도를 충분히 믿지 못하면서, 결과가 좋지 않을 때 자신을 과하게 평가하는 흐름입니다. 시작 전에는 망설임이 길고 시작 후에는 실수에 가혹해질 수 있어, 작은 완료 경험과 공정한 자기평가를 함께 설계해야 합니다.",
    "BD|ST": "스스로 결정하는 데 망설임이 있고 관계 안에서 조건이나 도움을 요청하는 일도 어려운 흐름입니다. 타인의 확신과 허락을 기다리기보다, 감당 가능한 작은 선택을 하고 필요한 지원을 구체적으로 말하는 연습이 필요합니다.",
    "CS|ST": "외부 평가와 비교가 자신의 판단을 흔들어 선택과 실행이 늦어지는 흐름입니다. 정보가 부족해서라기보다 틀려 보이거나 뒤처져 보일 가능성을 크게 느끼는 상태일 수 있어, 자기기준과 작은 실험을 함께 세워야 합니다.",
    "RS|ST": "확신이 부족할 때 행동이 늦어지고, 스트레스가 높아지면 회복 리듬까지 흔들리는 흐름입니다. 결정과 실행을 요구하기 전에 몸과 생활의 기본 리듬을 복구하고, 실패해도 감당 가능한 크기의 과제를 제공하는 것이 적절합니다."
  };

  const RESOURCE_TRANSFER = {
    SR: "자기존중의 공정한 말투를 사용해 낮은 영역의 실패와 부담을 존재 전체의 문제로 확대하지 않도록 돕습니다.",
    ST: "자기신뢰의 작은 실행 감각을 활용해 낮은 영역에서도 완벽한 확신보다 수정 가능한 행동을 먼저 시작하게 합니다.",
    BD: "경계와 요청의 협상 능력을 활용해 낮은 영역에서 필요한 조건·지원·중단 기준을 구체적으로 말하게 합니다.",
    CS: "자기기준의 분리 능력을 활용해 외부 평가보다 피검사자에게 실제로 중요한 성장 기준을 다시 세웁니다.",
    RS: "회복력의 생활 리듬과 복귀 방법을 활용해 낮은 영역을 다루는 과정에서 과부하와 자기소모를 줄입니다."
  };

  function readScores() {
    const nodes = [...document.querySelectorAll("#domainList .domain-score")];
    return ORDER.reduce((result, key, index) => {
      const value = Number.parseInt(nodes[index]?.textContent || "", 10);
      result[key] = Number.isFinite(value) ? value : null;
      return result;
    }, {});
  }

  function getOverall(scores) {
    const rendered = Number.parseInt(document.querySelector("#totalScore")?.textContent || "", 10);
    if (Number.isFinite(rendered)) return rendered;
    const values = ORDER.map((key) => scores[key]).filter(Number.isFinite);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  }

  function getProfile(scores) {
    const entries = ORDER
      .map((key) => ({ key, name: domainData[key]?.name || key, score: scores[key] }))
      .filter((entry) => Number.isFinite(entry.score));
    const ascending = [...entries].sort((a, b) => a.score - b.score);
    const descending = [...ascending].reverse();
    const low1 = ascending[0];
    const low2 = ascending[1] || low1;
    const high1 = descending[0];
    const spread = low1 && high1 ? high1.score - low1.score : 0;
    return { entries, ascending, descending, low1, low2, high1, spread };
  }

  function pairKey(a, b) {
    return [a, b].sort().join("|");
  }

  function overallState(overall, spread) {
    if (overall < 45 && spread <= 10) {
      return {
        label: "전반 회복 우선형",
        headline: "다섯 영역이 함께 낮아져 특정 약점보다 전반적인 부담과 소진 조건을 먼저 확인해야 합니다.",
        focus: "성과 목표를 추가하기보다 수면·생활 리듬·관계 안전·도움 요청 가능성을 확인하고, 한 번에 하나의 회복 행동만 설계합니다."
      };
    }
    if (overall < 45) {
      return {
        label: "회복 우선·영역 분화형",
        headline: "전체 흐름은 낮지만 일부 영역의 자원은 남아 있어, 강점을 빌려 취약영역을 복구할 수 있습니다.",
        focus: "낮은 영역을 직접 압박하지 말고 가장 높은 영역이 작동했던 실제 조건을 찾아 재사용합니다."
      };
    }
    if (spread >= 25) {
      return {
        label: "집중 병목형",
        headline: "전반적인 능력 부족보다 특정 관계·과제·상황에서 흐름이 막히는 영역 분화가 뚜렷합니다.",
        focus: "최저 2영역이 함께 나타나는 장면을 찾고, 최고영역의 강점을 그 장면에 전이하는 회기 설계가 적절합니다."
      };
    }
    if (spread <= 10) {
      return {
        label: overall >= 70 ? "안정 균형형" : "조정 균형형",
        headline: "영역 간 격차가 작아 한 영역의 문제보다 최근 환경과 반복되는 운영 방식이 전체 점수에 영향을 주는 구조입니다.",
        focus: "특정 기술을 집중 교정하기보다 모든 영역을 함께 지탱하는 루틴·관계·피드백 조건을 조정합니다."
      };
    }
    return {
      label: overall >= 70 ? "강점 기반 차이형" : "성장 조정형",
      headline: "기본 자원은 있으나 영역별 작동 수준이 달라 상황에 따라 자기운영의 체감이 크게 달라질 수 있습니다.",
      focus: "낮은 영역의 실제 장면을 좁히고 높은 영역의 성공 조건을 연결해 작고 관찰 가능한 변화를 만듭니다."
    };
  }

  function cautionText(overall, profile) {
    const cautions = [];
    if (overall < 45) cautions.push("낮은 전체점수를 의지 부족이나 성격 문제로 단정하지 않습니다.");
    if (profile.spread >= 25) cautions.push("최저영역의 점수를 피검사자 전체의 모습으로 일반화하지 않습니다.");
    if (profile.high1?.score >= 85) cautions.push("매우 높은 강점은 과잉 사용·경직성·타인에게 같은 방식을 요구하는지 함께 확인합니다.");
    if (profile.low2 && Math.abs(profile.low2.score - profile.low1.score) <= 5) cautions.push("최저 2영역을 분리된 문제보다 서로 강화하는 연결 패턴으로 살펴봅니다.");
    if (!cautions.length) cautions.push("점수보다 최근의 구체적 장면과 실제 기능 수준을 우선 확인합니다.");
    return cautions;
  }

  function sessionQuestions(profile, overall) {
    const low1 = profile.low1;
    const low2 = profile.low2;
    const high1 = profile.high1;
    const action = domainData[low1.key]?.action || "이번 주 작은 행동 하나를 정해보세요.";
    return [
      { code: "K", label: "관계와 주도권 열기", question: `전체 ${overall}점과 현재 결과를 보며 가장 먼저 이야기하고 싶은 장면은 무엇인가요?` },
      { code: "I", label: "현재 장면 인식", question: `${low1.name}과 ${low2.name}이 함께 흔들렸던 최근 장면에서 생각·감정·몸·행동은 어떻게 이어졌나요?` },
      { code: "N", label: "핵심 패턴 명명", question: `두 영역을 동시에 어렵게 만드는 공통된 기대, 두려움 또는 욕구를 한 문장으로 이름 붙인다면 무엇인가요?` },
      { code: "G", label: "성장 방향 세우기", question: `${high1.name} ${high1.score}점의 강점을 빌려 ${low1.name}과 ${low2.name}에서 만들고 싶은 구체적인 성장 장면은 무엇인가요?` },
      { code: "O", label: "작은 실행", question: `${action} 이 행동을 이번 주 언제, 어디서, 몇 회 실행하면 부담 없이 확인할 수 있을까요?` }
    ];
  }

  function renderBrief(scores) {
    const overall = getOverall(scores);
    const profile = getProfile(scores);
    if (!Number.isFinite(overall) || !profile.low1 || !profile.low2 || !profile.high1) return null;

    const state = overallState(overall, profile.spread);
    const pair = PAIR_ANALYSIS[pairKey(profile.low1.key, profile.low2.key)] || `${profile.low1.name}과 ${profile.low2.name}이 함께 낮아지는 장면에서 공통된 부담과 환경 조건을 확인할 필요가 있습니다.`;
    const resource = RESOURCE_TRANSFER[profile.high1.key] || "가장 높은 영역의 성공 조건을 낮은 영역에 연결합니다.";
    const cautions = cautionText(overall, profile);
    const questions = sessionQuestions(profile, overall);

    const section = document.createElement("section");
    section.className = "coach-synthesis";
    section.dataset.signature = `${overall}-${profile.entries.map((entry) => entry.score).join("-")}`;
    section.innerHTML = `
      <div class="coach-synthesis-head">
        <div>
          <span class="coach-synthesis-kicker">5-DOMAIN SYNTHESIS</span>
          <h3>5영역 종합상태 · 코치용 1페이지 브리핑</h3>
        </div>
        <span class="coach-synthesis-type">${state.label}</span>
      </div>

      <div class="coach-synthesis-summary">
        <strong>${state.headline}</strong>
        <p>${state.focus}</p>
      </div>

      <div class="coach-synthesis-metrics">
        <div><span>전체</span><b>${overall}점</b></div>
        <div><span>우선 1</span><b>${profile.low1.name} ${profile.low1.score}</b></div>
        <div><span>우선 2</span><b>${profile.low2.name} ${profile.low2.score}</b></div>
        <div><span>핵심 자원</span><b>${profile.high1.name} ${profile.high1.score}</b></div>
      </div>

      <div class="coach-synthesis-grid">
        <article class="coach-synthesis-card is-combo">
          <b>최저 2영역 조합 해석</b>
          <p>${pair}</p>
        </article>
        <article class="coach-synthesis-card is-resource">
          <b>${profile.high1.name} 강점의 전이 방법</b>
          <p>${resource}</p>
        </article>
      </div>

      <div class="coach-synthesis-caution">
        <b>코치가 주의할 해석</b>
        <ul>${cautions.map((item) => `<li>${item}</li>`).join("")}</ul>
      </div>

      <div class="coach-session-plan">
        <div class="coach-session-plan-head">
          <b>이번 회기에 우선 사용할 KINGDOM 질문 5개</b>
          <span>점수·조합·강점자원 반영</span>
        </div>
        <div class="coach-session-questions">
          ${questions.map((item) => `
            <div class="coach-session-question">
              <span>${item.code}</span>
              <div><b>${item.label}</b><p>${item.question}</p></div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="coach-synthesis-action">
        <b>이번 회기 설계</b>
        <p><strong>장면:</strong> ${profile.low1.name}과 ${profile.low2.name}이 함께 흔들린 실제 장면 하나를 고릅니다.<br><strong>자원:</strong> ${profile.high1.name}이 잘 작동했던 조건을 가져옵니다.<br><strong>실험:</strong> 점수 상승이 아니라 7일 안에 관찰 가능한 행동 하나를 합의합니다.</p>
      </div>
    `;
    return section;
  }

  let queued = false;
  function enhance() {
    const scoreProfile = content.querySelector(".coach-score-profile");
    if (!scoreProfile) return;
    const scores = readScores();
    const overall = getOverall(scores);
    const signature = `${overall}-${ORDER.map((key) => scores[key]).join("-")}`;
    const existing = content.querySelector(".coach-synthesis");
    if (existing?.dataset.signature === signature) return;
    existing?.remove();
    const brief = renderBrief(scores);
    if (brief) content.insertBefore(brief, content.firstChild);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhance();
    });
  }

  new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
  tabs.addEventListener("click", schedule);
  openButton.addEventListener("click", () => setTimeout(schedule, 0));
})();
