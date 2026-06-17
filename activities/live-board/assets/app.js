const form = document.querySelector("#liveForm");
const statusEl = document.querySelector("#status");
const submitBtn = document.querySelector("#submitBtn");
const responseInput = document.querySelector("#response");
const responseCount = document.querySelector("#responseCount");

function populateParticipants(codes) {
  const select = form.elements.participantCode;
  const savedCode = localStorage.getItem("liveBoardParticipantCode") || "";

  codes.forEach(code => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    select.appendChild(option);
  });

  if (savedCode && codes.includes(savedCode)) {
    select.value = savedCode;
  }
}

function updateCounter() {
  if (!responseInput || !responseCount) return;
  const max = responseInput.getAttribute("maxlength") || 140;
  responseCount.textContent = `${responseInput.value.length} / ${max}`;
}

async function init() {
  const settings = await LiveBoard.loadConfig();
  LiveBoard.applyTextConfig(settings);
  populateParticipants(settings.participantCodes || []);
  updateCounter();
}

responseInput?.addEventListener("input", updateCounter);

form?.elements.participantCode?.addEventListener("change", (event) => {
  localStorage.setItem("liveBoardParticipantCode", event.target.value);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  submitBtn.disabled = true;
  const originalButtonText = submitBtn.textContent;
  submitBtn.textContent = "저장 중...";
  LiveBoard.setStatus(statusEl, "");

  try {
    const data = new FormData(form);
    data.append("action", "create");
    data.append("userAgent", navigator.userAgent || "");

    if (LiveBoard.hasScriptUrl()) {
      await fetch(LiveBoard.scriptUrl(), {
        method: "POST",
        mode: "no-cors",
        body: data
      });
    } else {
      LiveBoard.saveLocalItem(Object.fromEntries(data.entries()));
    }

    const currentCode = form.elements.participantCode.value;
    form.reset();
    form.elements.participantCode.value = currentCode;
    updateCounter();

    LiveBoard.setStatus(statusEl, "저장되었습니다. 라이브보드에 반영됩니다.", "success");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    LiveBoard.setStatus(statusEl, error.message || "저장 중 오류가 발생했습니다.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalButtonText || "라이브보드에 기록하기";
  }
});

init();
