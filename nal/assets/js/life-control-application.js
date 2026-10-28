(() => {
  "use strict";

  const form = document.getElementById("life-control-form");
  const success = document.getElementById("life-control-success");
  if (!form || !success) return;

  const button = form.querySelector("[data-submit]");
  const buttonLabel = form.querySelector("[data-submit-label]");
  const status = form.querySelector("[data-form-status]");
  const previousReceipt = document.querySelector("[data-previous-receipt]");
  const codeNode = success.querySelector("[data-application-code]");
  const RECEIPT_STORAGE_KEY = "nal:life-control:application-code";
  const SUBMIT_STORAGE_KEY = "nal:life-control:application-last";
  const ACCOUNT_NUMBER = "3333280615350";
  let backend = null;
  let busy = false;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.error = String(isError);
  }

  function getLocal(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function setLocal(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Storage can be blocked. */ }
  }

  function newApplicationCode() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    return "LC-" + hex;
  }

  function getChecked(name) {
    return form.querySelector('input[name="' + name + '"]:checked')?.value || "";
  }

  function inputValue(name) {
    const node = form.elements.namedItem(name);
    return typeof node?.value === "string" ? node.value.trim() : "";
  }

  function validateFields() {
    if (!form.reportValidity()) return false;
    const applicantName = inputValue("applicant_name");
    const email = inputValue("email");
    const phone = inputValue("phone").replace(/[\\s-]/g, "");
    const nickname = inputValue("nickname");
    const depositor = inputValue("depositor_name");
    const note = inputValue("note");
    if (!applicantName || applicantName.length > 40 || /[\\x00-\\x1f]/.test(applicantName)) {
      setStatus("배지에 표시할 이름을 40자 이내로 정확하게 입력해 주세요.", true);
      form.elements.namedItem("applicant_name").focus();
      return false;
    }
    if (email.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      setStatus("디지털배지를 수령할 이메일 주소를 확인해 주세요.", true);
      form.elements.namedItem("email").focus();
      return false;
    }
    if (!/^01[016789][0-9]{7,8}$/.test(phone)) {
      setStatus("휴대전화번호를 010-1234-5678 형식으로 입력해 주세요.", true);
      form.elements.namedItem("phone").focus();
      return false;
    }
    if (!nickname || nickname.length > 24 || !depositor || depositor.length > 40 || note.length > 240) {
      setStatus("닉네임, 입금자명, 메모의 글자 수를 확인해 주세요.", true);
      return false;
    }
    if (!["10:00", "10:30", "either", "other"].includes(getChecked("time_preference"))
      || !["all", "partial", "undecided"].includes(getChecked("attendance"))
      || !["reality", "feelings", "choices", "writing", "undecided"].includes(inputValue("focus_area"))) {
      setStatus("참여 가능 시간과 연습 주제를 선택해 주세요.", true);
      return false;
    }
    return true;
  }

  function showReceipt(applicationCode) {
    codeNode.textContent = applicationCode;
    form.hidden = true;
    success.hidden = false;
    success.focus({ preventScroll: true });
    success.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showPreviousReceipt() {
    const code = getLocal(RECEIPT_STORAGE_KEY);
    if (!previousReceipt || !/^LC-[A-F0-9]{12}$/.test(code || "")) return;
    previousReceipt.hidden = false;
    previousReceipt.textContent = "이 기기에서 이전에 접수한 확인번호: " + code + ". 변경이 필요하면 오픈채팅으로 문의해 주세요.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !backend) return;
    if (!validateFields()) return;

    if (inputValue("website")) {
      setStatus("내용을 확인할 수 없습니다. 페이지를 새로고침해 주세요.", true);
      return;
    }

    const last = Number(getLocal(SUBMIT_STORAGE_KEY) || 0);
    if (last && Date.now() - last < 60000) {
      setStatus("중복 접수를 방지하기 위해 잠시 후 다시 시도할 수 있습니다.", true);
      return;
    }

    const applicationCode = newApplicationCode();
    const payload = {
      application_code: applicationCode,
      applicant_name: inputValue("applicant_name"),
      email: inputValue("email").toLowerCase(),
      phone: inputValue("phone").replace(/[\\s-]/g, ""),
      nickname: inputValue("nickname"),
      depositor_name: inputValue("depositor_name"),
      time_preference: getChecked("time_preference"),
      attendance: getChecked("attendance"),
      focus_area: inputValue("focus_area"),
      note: inputValue("note") || null,
      privacy_consent: form.elements.namedItem("privacy_consent").checked,
      community_consent: form.elements.namedItem("community_consent").checked,
      honeypot: ""
    };

    if (!payload.privacy_consent || !payload.community_consent) {
      setStatus("신청에 필요한 동의 내용을 확인해 주세요.", true);
      return;
    }

    busy = true;
    button.disabled = true;
    buttonLabel.textContent = "신청서를 접수하고 있어요…";
    setStatus("신청서를 안전하게 접수하고 있습니다.");

    try {
      const response = await fetch(backend.url + "/rest/v1/nal_life_control_applications", {
        method: "POST",
        headers: {
          apikey: backend.publishableKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error("Application submission HTTP " + response.status);
      setLocal(RECEIPT_STORAGE_KEY, applicationCode);
      setLocal(SUBMIT_STORAGE_KEY, String(Date.now()));
      showReceipt(applicationCode);
    } catch (error) {
      console.warn("NAL application submission failed:", error?.message || "unknown");
      setStatus("신청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요. 접수 여부가 불확실하면 오픈채팅으로 문의해 주세요.", true);
    } finally {
      busy = false;
      button.disabled = !backend || !success.hidden;
      buttonLabel.textContent = "신청서 제출하기";
    }
  });

  async function copyValue(text, buttonNode) {
    if (!navigator.clipboard?.writeText) {
      buttonNode.textContent = "길게 눌러 복사";
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      buttonNode.textContent = "복사 완료";
    } catch {
      buttonNode.textContent = "길게 눌러 복사";
    }
  }

  success.querySelector("[data-copy-code]")?.addEventListener("click", (event) => {
    if (codeNode.textContent) copyValue(codeNode.textContent, event.currentTarget);
  });
  success.querySelector("[data-copy-account]")?.addEventListener("click", (event) => {
    copyValue(ACCOUNT_NUMBER, event.currentTarget);
  });

  async function initialize() {
    showPreviousReceipt();
    button.disabled = true;
    try {
      const response = await fetch("/nal/data/backend.json", {
        cache: "no-store",
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error("Backend config unavailable");
      const config = await response.json();
      backend = globalThis.NALBackend?.validateConfig(config) || null;
      if (!backend) throw new Error("Application backend disabled");
      button.disabled = false;
      buttonLabel.textContent = "신청서 제출하기";
      setStatus("");
    } catch (error) {
      button.disabled = true;
      buttonLabel.textContent = "현재 신청 접수 준비 중";
      setStatus("신청 시스템에 연결하지 못했습니다. 잠시 후 새로고침하거나 카카오톡 오픈채팅으로 문의해 주세요.", true);
      console.warn("NAL application initialization failed:", error?.message || "unknown");
    }
  }

  initialize();
})();