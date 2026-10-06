(() => {
  "use strict";

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const SLUG = /^[a-z0-9-]{1,120}$/;
  const $ = (selector, root = document) => root.querySelector(selector);
  const page = document.body.dataset.readPage || "hub";
  const seasonSlug = SLUG.test(document.body.dataset.season || "") ? document.body.dataset.season : "";

  let config = null;
  let client = null;
  let session = null;
  let seasons = [];

  function setStatus(message, state = "") {
    const node = $("[data-read-status]");
    if (!node) return;
    node.hidden = !message;
    node.textContent = message || "";
    node.dataset.state = state;
  }

  function randomId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  async function json(url, options = {}) {
    const response = await fetch(url, { cache: "no-store", ...options });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(value.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return value;
  }

  function safeNext(raw) {
    if (!raw) return "/nal/read/";
    try {
      const url = new URL(raw, location.origin);
      if (url.origin !== location.origin || !url.pathname.startsWith("/nal/read/")) return "/nal/read/";
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return "/nal/read/";
    }
  }

  function backendConfigPath() {
    const host = location.hostname.toLowerCase();
    const isProduction = host === "daily-coach-ing.com" || host === "www.daily-coach-ing.com";
    return isProduction ? "/nal/data/backend.json" : "/nal/data/read-backend.staging.json";
  }

  async function setup() {
    const [cfg, seasonData] = await Promise.all([
      json(backendConfigPath()),
      json("/nal/data/read-seasons.json")
    ]);
    if (cfg?.enabled !== true || !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(cfg.url || "") || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(cfg.publishableKey || "")) {
      throw new Error("NAL READ 인증 설정을 확인할 수 없습니다.");
    }
    if (!globalThis.supabase?.createClient) throw new Error("인증 모듈을 불러오지 못했습니다.");

    config = cfg;
    seasons = Array.isArray(seasonData.seasons) ? seasonData.seasons : [];
    client = globalThis.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const current = await client.auth.getSession();
    session = current.data?.session || null;
    client.auth.onAuthStateChange((_event, next) => {
      session = next;
      renderAccount();
      void renderAccessState();
    });
  }

  function renderAccount() {
    const loggedOut = $("[data-read-auth]");
    const loggedIn = $("[data-read-account]");
    const email = $("[data-read-email]");
    if (loggedOut) loggedOut.hidden = Boolean(session);
    if (loggedIn) loggedIn.hidden = !session;
    if (email) email.textContent = session?.user?.email || "";
  }

  async function sendMagicLink(event) {
    event.preventDefault();
    const email = $("[data-read-login-email]")?.value.trim();
    if (!email) return setStatus("이메일을 입력해 주세요.", "error");
    const callback = new URL("/nal/read/auth/callback/", location.origin);
    callback.searchParams.set("next", `${location.pathname}${location.search}`);
    setStatus("로그인 링크를 보내는 중입니다.");
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback.href, shouldCreateUser: true }
    });
    if (error) return setStatus(error.message || "로그인 링크를 보내지 못했습니다.", "error");
    setStatus("이메일로 로그인 링크를 보냈습니다. 같은 브라우저에서 열어주세요.", "ok");
  }

  async function signOut() {
    await client.auth.signOut();
    location.href = "/nal/read/";
  }

  async function readApi(action, payload = {}) {
    if (!session?.access_token) throw new Error("로그인이 필요합니다.");
    return json(`${config.url}/functions/v1/nal-read-enroll`, {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action, ...payload })
    });
  }

  async function accessFor(slug) {
    if (!session || !SLUG.test(slug)) return { allowed: false, reason: "login_required" };
    try {
      return await readApi("access", { seasonSlug: slug });
    } catch (error) {
      if (error.status === 404) return { allowed: false, reason: "not_enrolled" };
      if (error.status === 503) return { allowed: false, reason: "foundation_disabled" };
      throw error;
    }
  }

  async function claimFromQuery() {
    const params = new URLSearchParams(location.search);
    const orderId = params.get("order") || "";
    if (!session || !seasonSlug || !UUID.test(orderId)) return null;
    return readApi("claim", { seasonSlug, orderId, requestId: randomId() });
  }

  async function renderHub() {
    const list = $("[data-read-seasons]");
    if (!list) return;
    list.replaceChildren();
    for (const season of seasons) {
      const li = document.createElement("li");
      const number = document.createElement("span");
      number.className = "read-meta";
      number.textContent = String(season.number || "").padStart(2, "0");
      const link = document.createElement("a");
      link.href = `/nal/read/${season.slug}/`;
      link.textContent = season.title;
      link.style.fontWeight = "800";
      const state = document.createElement("span");
      state.className = "read-lock";
      state.textContent = session ? "확인 중" : "로그인 후 이용권 확인";
      li.append(number, link, state);
      list.append(li);
      if (session) {
        accessFor(season.slug).then((access) => {
          state.textContent = access.allowed ? "이용 가능" : "이용권 필요";
        }).catch(() => { state.textContent = "확인 필요"; });
      }
    }
  }

  async function renderSeason() {
    const enter = $("[data-read-enter]");
    if (!enter) return;
    if (!session) {
      enter.hidden = true;
      return setStatus("로그인하면 NAL READ 이용권을 확인합니다.");
    }
    const access = await accessFor(seasonSlug);
    enter.hidden = !access.allowed;
    if (access.allowed) return setStatus("이용권이 확인되었습니다.", "ok");
    if (access.reason === "foundation_disabled") return setStatus("READ 비운영 환경 연결을 준비하고 있습니다.");
    setStatus("현재 계정에서 이 시즌의 이용권을 찾지 못했습니다.");
  }

  async function renderWelcome() {
    if (!session) {
      setStatus("먼저 로그인해 주세요. 로그인 후 이 화면으로 돌아옵니다.");
      return;
    }
    const claimed = await claimFromQuery().catch((error) => {
      setStatus(error.message || "이용권 연결을 확인하지 못했습니다.", "error");
      return null;
    });
    if (claimed?.allowed) {
      history.replaceState({}, "", location.pathname);
      setStatus("NAL READ 이용권이 연결되었습니다.", "ok");
      return;
    }
    const access = await accessFor(seasonSlug);
    if (!access.allowed) {
      setStatus("이 시즌에 접근할 수 있는 이용권이 없습니다.", "error");
      $("[data-read-protected]")?.setAttribute("hidden", "");
      return;
    }
    setStatus("이용권이 확인되었습니다.", "ok");
  }

  async function renderCallback() {
    const params = new URLSearchParams(location.search);
    const next = safeNext(params.get("next"));
    setStatus("로그인을 확인하고 있습니다.");
    const result = await client.auth.getSession();
    if (result.error || !result.data.session) {
      setStatus("로그인을 확인하지 못했습니다. 다시 로그인해 주세요.", "error");
      return;
    }
    location.replace(next);
  }

  async function renderAccessState() {
    if (page === "hub") return renderHub();
    if (page === "season") return renderSeason();
    if (page === "welcome") return renderWelcome();
  }

  async function boot() {
    try {
      await setup();
      renderAccount();
      $("[data-read-auth-form]")?.addEventListener("submit", sendMagicLink);
      $("[data-read-signout]")?.addEventListener("click", signOut);
      if (page === "callback") return renderCallback();
      await renderAccessState();
    } catch (error) {
      setStatus(error.message || "NAL READ를 준비하지 못했습니다.", "error");
    }
  }

  void boot();
})();
