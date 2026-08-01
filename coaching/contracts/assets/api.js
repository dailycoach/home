(() => {
  "use strict";

  const DEFAULT_API_ORIGIN = "https://api.daily-coach-ing.com";
  const REQUEST_TIMEOUT_MS = 12000;
  const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,512}$/;
  const ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

  class ContractApiError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = "ContractApiError";
      this.status = options.status || 0;
      this.code = options.code || "REQUEST_FAILED";
      this.retryable = Boolean(options.retryable);
    }
  }

  const resolveOrigin = () => {
    const configured = document.querySelector('meta[name="contracts-api-base"]')?.content?.trim();
    if (!configured) return DEFAULT_API_ORIGIN;
    try {
      const url = new URL(configured, window.location.origin);
      if (url.protocol !== "https:" && url.origin !== window.location.origin) return DEFAULT_API_ORIGIN;
      return url.origin;
    } catch {
      return DEFAULT_API_ORIGIN;
    }
  };

  const API_ORIGIN = resolveOrigin();

  const assertOpaqueToken = token => {
    if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
      throw new ContractApiError("초대 또는 접근 링크 형식이 올바르지 않습니다.", { code: "INVALID_TOKEN" });
    }
    return token;
  };

  const assertIdentifier = id => {
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      throw new ContractApiError("계약 식별 정보가 올바르지 않습니다.", { code: "INVALID_ID" });
    }
    return id;
  };

  const publicMessage = (status, fallbackCode) => {
    if (status === 400) return "입력 내용을 다시 확인해 주세요.";
    if (status === 401) return "본인 확인 또는 관리자 인증이 필요합니다.";
    if (status === 403) return "이 요청을 수행할 권한이 없습니다.";
    if (status === 404) return "요청한 계약 또는 초대 정보를 찾을 수 없습니다.";
    if (status === 409) return "계약 상태가 변경되어 현재 요청을 처리할 수 없습니다.";
    if (status === 410) return "링크가 만료되었거나 이미 사용되었습니다.";
    if (status === 422) return "필수 조건이 충족되지 않았습니다.";
    if (status === 429) return "확인 시도가 많습니다. 잠시 후 다시 시도해 주세요.";
    if (status >= 500) return "계약 서비스에서 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return fallbackCode === "TIMEOUT" ? "계약 서비스 응답 시간이 초과되었습니다." : "계약 서비스에 연결할 수 없습니다.";
  };

  const request = async (path, options = {}) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const method = options.method || "GET";
    const headers = new Headers({ "Accept": "application/json" });

    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    if (options.sessionToken) headers.set("Authorization", `Bearer ${options.sessionToken}`);
    if (method !== "GET" && method !== "HEAD") headers.set("X-Requested-With", "DAILYCOACHING-Contracts");

    try {
      const response = await fetch(`${API_ORIGIN}${path}`, {
        method,
        headers,
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });

      if (!response.ok) {
        let code = "HTTP_ERROR";
        try {
          const errorBody = await response.json();
          if (typeof errorBody?.code === "string" && /^[A-Z0-9_]{2,64}$/.test(errorBody.code)) code = errorBody.code;
        } catch {
          // Error bodies are intentionally not surfaced because they may contain sensitive detail.
        }
        throw new ContractApiError(publicMessage(response.status), {
          status: response.status,
          code,
          retryable: response.status === 429 || response.status >= 500
        });
      }

      if (response.status === 204) return null;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new ContractApiError("계약 서비스 응답 형식이 올바르지 않습니다.", { status: response.status, code: "INVALID_RESPONSE" });
      }
      return await response.json();
    } catch (error) {
      if (error instanceof ContractApiError) throw error;
      if (error?.name === "AbortError") {
        throw new ContractApiError(publicMessage(0, "TIMEOUT"), { code: "TIMEOUT", retryable: true });
      }
      throw new ContractApiError(publicMessage(0), { code: "NETWORK_ERROR", retryable: true });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const encode = value => encodeURIComponent(value);
  const makeRequestId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, "");
    const bytes = new Uint8Array(18);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  };
  const mutationBody = body => ({ ...(body || {}), request_id: body?.request_id || makeRequestId() });

  const api = Object.freeze({
    origin: API_ORIGIN,
    isOpaqueToken: token => typeof token === "string" && TOKEN_PATTERN.test(token),
    health: () => request("/v1/health"),

    adminAccessProbe: () => request("/v1/admin/session"),
    adminListContracts: (query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value).length) params.set(key, String(value));
      });
      const suffix = params.size ? `?${params.toString()}` : "";
      return request(`/v1/admin/contracts${suffix}`);
    },
    adminGetContract: id => request(`/v1/admin/contracts/${encode(assertIdentifier(id))}`),
    adminCreateContract: payload => request("/v1/admin/contracts", { method: "POST", body: mutationBody(payload) }),
    adminUpdateContract: (id, payload) => request(`/v1/admin/contracts/${encode(assertIdentifier(id))}`, { method: "PATCH", body: mutationBody(payload) }),
    adminIssueContract: (id, payload) => request(`/v1/admin/contracts/${encode(assertIdentifier(id))}/issue`, { method: "POST", body: mutationBody(payload) }),
    adminCancelContract: (id, payload) => request(`/v1/admin/contracts/${encode(assertIdentifier(id))}/cancel`, { method: "POST", body: mutationBody(payload) }),
    adminReissueContract: (id, payload) => request(`/v1/admin/contracts/${encode(assertIdentifier(id))}/reissue`, { method: "POST", body: mutationBody(payload) }),

    // Raw invitation and final-access tokens are exchanged once in a POST body.
    // They never appear in an API URL, referrer, browser log or persistent storage.
    exchangeInvite: token => request("/v1/invites/exchange", {
      method: "POST",
      body: mutationBody({ token: assertOpaqueToken(token) })
    }),
    getInviteSummary: sessionToken => request("/v1/invites/summary", { sessionToken: assertOpaqueToken(sessionToken) }),
    verifyInvite: (sessionToken, verificationCode) => request("/v1/invites/verify", {
      method: "POST",
      sessionToken: assertOpaqueToken(sessionToken),
      body: mutationBody({ pin: String(verificationCode || "") })
    }),
    getContractSnapshot: (contractId, sessionToken) => request(`/v1/contracts/${encode(assertIdentifier(contractId))}/snapshot`, { sessionToken: assertOpaqueToken(sessionToken) }),
    saveConsents: (contractId, sessionToken, payload) => request(`/v1/contracts/${encode(assertIdentifier(contractId))}/consents`, {
      method: "POST",
      sessionToken: assertOpaqueToken(sessionToken),
      body: mutationBody(payload)
    }),
    signContract: (contractId, sessionToken, payload) => request(`/v1/contracts/${encode(assertIdentifier(contractId))}/sign`, {
      method: "POST",
      sessionToken: assertOpaqueToken(sessionToken),
      body: mutationBody(payload)
    }),
    withdrawConsents: (contractId, sessionToken, consentKeys) => request(`/v1/contracts/${encode(assertIdentifier(contractId))}/consents/withdraw`, {
      method: "POST",
      sessionToken: assertOpaqueToken(sessionToken),
      body: mutationBody({ consent_keys: Array.isArray(consentKeys) ? consentKeys : [] })
    }),
    getFinalDocument: (contractId, sessionToken) => request(`/v1/contracts/${encode(assertIdentifier(contractId))}/final-document`, { sessionToken: assertOpaqueToken(sessionToken) }),

    // The raw final-access token is read from the URL fragment, removed immediately,
    // exchanged once, and replaced with a short-lived in-memory session.
    exchangeFinalAccess: token => request("/v1/final-access/exchange", {
      method: "POST",
      body: mutationBody({ token: assertOpaqueToken(token) })
    }),
    getFinalAccess: sessionToken => request("/v1/final-access", { sessionToken: assertOpaqueToken(sessionToken) }),
    getFinalAccessDocument: sessionToken => request("/v1/final-access/document", { sessionToken: assertOpaqueToken(sessionToken) })
  });

  Object.defineProperty(window, "ContractApi", { value: api, configurable: false, writable: false });
  Object.defineProperty(window, "ContractApiError", { value: ContractApiError, configurable: false, writable: false });
})();
