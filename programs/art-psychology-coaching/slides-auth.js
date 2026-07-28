(() => {
  const STORAGE_KEY = "dc-art-facilitator-slides-unlocked";
  const EXPECTED_HASH = "5cb9895aab221167f4d7fddc7ec0028de028d56d947583149860465cd97df446";
  const DOWNLOADS = {
    complete: "downloads/complete-package-v1.0.zip",
    "master-pptx": "downloads/art-psychology-coaching-6week-master-v1.0.pptx",
    "master-pdf": "downloads/art-psychology-coaching-6week-master-v1.0.pdf",
    week01: "downloads/week01-arrival-v1.0.pptx",
    week02: "downloads/week02-encounter-v1.0.pptx",
    week03: "downloads/week03-rename-v1.0.pptx",
    week04: "downloads/week04-future-scene-v1.0.pptx",
    week05: "downloads/week05-action-translation-v1.0.pptx",
    week06: "downloads/week06-integration-v1.0.pptx",
    script: "downloads/facilitator-script-v1.0.txt",
    "contact-sheet": "downloads/slide-contact-sheet-v1.0.pdf",
    "qa-report": "downloads/qa-report-v1.0.md",
  };
  const root = document.documentElement;
  const gate = document.querySelector("[data-slides-gate]");
  const content = document.querySelector("[data-protected-content]");
  const form = document.querySelector("[data-slides-auth-form]");
  const input = form?.querySelector('input[name="password"]');
  const status = document.querySelector("[data-slides-auth-status]");
  let failedAttempts = 0;

  const digest = async (value) => {
    const bytes = new TextEncoder().encode(value);
    const result = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const hydrateDownloads = () => {
    document.querySelectorAll("[data-download-key]").forEach((link) => {
      const downloadUrl = DOWNLOADS[link.dataset.downloadKey];
      if (downloadUrl) {
        link.href = downloadUrl;
      }
    });
  };

  const showProtectedContent = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    hydrateDownloads();
    gate.hidden = true;
    content.hidden = false;
    root.classList.remove("slides-auth-pending");
    root.classList.add("slides-authenticated");
    window.scrollTo(0, 0);
  };

  const lockPage = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  document.querySelectorAll("[data-slides-lock]").forEach((button) => {
    button.addEventListener("click", lockPage);
  });

  if (sessionStorage.getItem(STORAGE_KEY) === "1") {
    showProtectedContent();
    return;
  }

  gate.hidden = false;
  content.hidden = true;
  requestAnimationFrame(() => input?.focus());

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = input.value.trim();
    if (!password) {
      status.textContent = "비밀번호를 입력해 주세요.";
      input.focus();
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    status.textContent = "확인 중입니다…";

    try {
      const hash = await digest(password);
      if (hash === EXPECTED_HASH) {
        status.textContent = "확인되었습니다.";
        showProtectedContent();
        return;
      }

      failedAttempts += 1;
      const delay = Math.min(600 * failedAttempts, 3000);
      status.textContent = "비밀번호가 일치하지 않습니다.";
      input.value = "";
      await new Promise((resolve) => setTimeout(resolve, delay));
      input.focus();
    } catch (error) {
      status.textContent = "보안 확인을 지원하지 않는 환경입니다. 최신 브라우저에서 다시 시도해 주세요.";
    } finally {
      submitButton.disabled = false;
    }
  });
})();
