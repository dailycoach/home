const LiveBoard = (() => {
  const cfg = window.APP_CONFIG || {};
  const STORAGE_KEY = "liveBoardLocalResponses";

  function hasScriptUrl() {
    const url = cfg.SCRIPT_URL || "";
    return Boolean(url && !url.includes("PASTE_YOUR"));
  }

  function scriptUrl() {
    if (!hasScriptUrl()) {
      throw new Error("docs/assets/config.js의 SCRIPT_URL을 Google Apps Script Web App URL로 교체해야 합니다.");
    }
    return cfg.SCRIPT_URL;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function splitTerms(value) {
    return String(value || "")
      .split(/[,/·|\\n]/)
      .map(v => v.trim())
      .filter(Boolean);
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = "jsonp_" + Date.now() + "_" + Math.round(Math.random() * 100000);
      const script = document.createElement("script");
      const separator = url.includes("?") ? "&" : "?";
      script.src = `${url}${separator}callback=${callbackName}`;

      const cleanup = () => {
        delete window[callbackName];
        script.remove();
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("데이터를 불러오지 못했습니다."));
      };

      window[callbackName] = (data) => {
        cleanup();
        resolve(data);
      };

      document.body.appendChild(script);
    });
  }

  async function loadConfig() {
    const fallback = cfg.FALLBACK || {};

    try {
      if (!hasScriptUrl()) throw new Error("Local demo mode");
      const data = await jsonp(`${scriptUrl()}?action=config`);
      return {
        ...fallback,
        ...(data.settings || {}),
        participantCodes: data.participantCodes || []
      };
    } catch (error) {
      return {
        ...fallback,
        participantCodes: [
          "A01","A02","A03","A04","A05","A06","A07","A08",
          "A09","A10","A11","A12","A13","A14","A15","A16"
        ]
      };
    }
  }

  function readLocalItems() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (error) {
      return [];
    }
  }

  function saveLocalItem(payload) {
    const items = readLocalItems();
    items.unshift({
      timestamp: new Date().toISOString(),
      participantCode: payload.participantCode,
      keyword: payload.keyword,
      response: payload.response,
      publicConsent: payload.publicConsent,
      privateMemo: payload.privateMemo
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 200)));
  }

  function loadLocalPublicItems() {
    return readLocalItems()
      .filter(item => item.publicConsent === "공개 가능")
      .map(item => ({
        timestamp: item.timestamp,
        participantCode: item.participantCode,
        keyword: item.keyword,
        response: item.response
      }));
  }

  function applyTextConfig(settings) {
    document.querySelectorAll("[data-config]").forEach(el => {
      const key = el.getAttribute("data-config");
      const value = settings[key];
      if (value !== undefined && value !== "") {
        el.textContent = value;
      }
    });

    const keywordInput = document.querySelector('input[name="keyword"]');
    if (keywordInput && settings.placeholderKeyword) {
      keywordInput.placeholder = settings.placeholderKeyword;
    }

    const responseInput = document.querySelector('textarea[name="response"], input[name="response"]');
    if (responseInput && settings.placeholderResponse) {
      responseInput.placeholder = settings.placeholderResponse;
    }

    const privateMemoWrap = document.querySelector("#privateMemoWrap");
    if (privateMemoWrap && String(settings.enablePrivateMemo).toUpperCase() !== "TRUE") {
      privateMemoWrap.classList.add("hidden");
    }

    if (settings.siteTitle || settings.liveTitle) {
      document.title = settings.siteTitle || settings.liveTitle;
    }
  }

  function setStatus(el, message, type = "") {
    if (!el) return;
    el.textContent = message;
    el.className = `status ${type}`.trim();
  }

  return {
    cfg,
    hasScriptUrl,
    scriptUrl,
    escapeHtml,
    splitTerms,
    jsonp,
    loadConfig,
    saveLocalItem,
    loadLocalPublicItems,
    applyTextConfig,
    setStatus
  };
})();
