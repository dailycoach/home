(function (scope) {
  "use strict";

  // This release switch controls presentation, not authorization. Supabase
  // provider configuration, verified Auth users and database RLS are the boundary.
  const DEFAULT_NEXT = "/nal/my/account/";
  const NEXT_KEY = "nal.member.next.v1";
  const FLOW_KEY = "nal.member.pkce-flow.v1";
  const FLOW_ID = /^[A-Za-z0-9_-]{8,64}$/;
  const PROVIDERS = Object.freeze(["kakao", "google"]);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const messages = Object.freeze({
    configuration: "회원 서비스를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.",
    disabled: "간편가입을 준비하고 있습니다. 지금은 무료 PDF를 먼저 만나보세요.",
    provider: "이 로그인 방법은 아직 준비 중입니다. 다른 방법을 선택해 주세요.",
    embedded: "Google 로그인은 Chrome 또는 Safari에서 이 로그인 페이지를 다시 열어 주세요.",
    storage: "로그인을 이어가려면 브라우저의 사이트 저장 기능을 허용해 주세요.",
    oauth: "로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    cancelled: "로그인이 취소되었습니다. 원하실 때 다시 시작할 수 있습니다.",
    callback: "로그인을 완료하지 못했습니다. 로그인 페이지에서 다시 시작해 주세요.",
    missing_code: "로그인 확인 정보가 없습니다. 로그인 페이지에서 다시 시작해 주세요.",
    session: "로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    required: "먼저 로그인해 주세요.",
    account: "회원 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    consent: "이용약관과 개인정보 안내를 확인해 주세요.",
    nickname: "사용할 이름을 1자 이상, 80자 이내로 입력해 주세요.",
    save: "회원 정보 저장이 완료되지 않았습니다. 아래에서 다시 시도해 주세요.",
    logout: "로그아웃을 완료하지 못했습니다. 다시 시도해 주세요."
  });

  class MemberError extends Error {
    constructor(code) { super(messages[code] || messages.configuration); this.name = "MemberError"; this.code = code; }
  }

  function safeNext(value, origin = "https://daily-coach-ing.com") {
    if (typeof value !== "string" || value.length > 1200 || !value.startsWith("/nal/")) return DEFAULT_NEXT;
    if (/[\\\u0000-\u0020\u007f]/.test(value)) return DEFAULT_NEXT;
    const path = value.split(/[?#]/, 1)[0];
    // NAL routes use ASCII slugs. Reject encoded separators and dot traversal
    // before URL parsing can normalize them into an apparently safe path.
    if (!/^\/nal\/(?:[A-Za-z0-9_~.-]+\/)*[A-Za-z0-9_~.-]*$/.test(path)
      || path.split("/").some(part => part === "." || part === "..")
      || /^\/nal\/(?:login|auth\/callback)(?:\/|$)/.test(path)) return DEFAULT_NEXT;
    try {
      const url = new URL(value, origin);
      if (url.origin !== new URL(origin).origin || !url.pathname.startsWith("/nal/")) return DEFAULT_NEXT;
      return url.pathname + url.search + url.hash;
    } catch { return DEFAULT_NEXT; }
  }

  function isEmbeddedBrowser(userAgent = "") {
    return /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER|;\s*wv\)|\bWebView\b/i.test(userAgent);
  }

  function consumeCallbackUrl(href, history) {
    const url = new URL(href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const code = url.searchParams.get("code") || "";
    const error = url.searchParams.get("error") || fragment.get("error") || "";
    const flowId = url.searchParams.get("sb_flow_id") || "";
    // Remove the entire callback query/fragment before any asynchronous work.
    // Never log or reflect authorization codes, provider tokens or raw errors.
    history.replaceState(null, "", url.pathname);
    return Object.freeze({ code, error, flowId });
  }

  function createIdentityGuard({ isBusy, onInvalidate, onRefresh, defer = callback => setTimeout(callback, 0) }) {
    let revision = 0, observed = false, subject = null, pending = false, scheduled = false, stopped = false;
    const snapshot = () => Object.freeze({ revision });
    const matches = ticket => !stopped && ticket.revision === revision;
    function flush() {
      if (stopped || !pending || scheduled || isBusy()) return;
      scheduled = true;
      defer(() => {
        scheduled = false;
        if (stopped || !pending || isBusy()) return;
        pending = false;
        onRefresh();
      });
    }
    function observe(event, userId) {
      if (stopped || !["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)) return;
      // INITIAL_SESSION is only a baseline; it must not supersede a newer event.
      if (event === "INITIAL_SESSION" && observed) return;
      const nextSubject = event === "SIGNED_OUT" ? null : UUID.test(userId || "") ? userId : null;
      if (observed && nextSubject === subject && event !== "USER_UPDATED") return;
      observed = true; subject = nextSubject; revision += 1;
      pending = subject !== null;
      // This synchronous callback only invalidates local UI. Network reads are
      // deferred until the SDK callback lock and current UI operation finish.
      onInvalidate({ event, userId: subject });
      flush();
    }
    function accept(ticket, value) {
      if (!matches(ticket) || (observed && subject !== (value?.id || null))) return false;
      pending = false;
      return true;
    }
    return Object.freeze({ snapshot, matches, accept, observe, flush,
      stop() { stopped = true; pending = false; } });
  }

  function create(options = {}) {
    const fetcher = options.fetcher || scope.fetch.bind(scope);
    const sdk = options.sdk || scope.supabase;
    const location = options.location || scope.location;
    const origin = new URL(location.href).origin;
    const userAgent = options.userAgent ?? scope.navigator?.userAgent ?? "";
    let storage, persistentStorage;
    try { storage = options.storage || scope.sessionStorage; } catch { storage = null; }
    try { persistentStorage = options.persistentStorage || scope.localStorage; } catch { persistentStorage = null; }
    let release = null, backend = null, client = null, initPromise = null, callbackPromise = null;
    let providerSettings = { kakao: false, google: false };

    function probeStorage(target) {
      const key = "nal.member.probe." + scope.crypto.randomUUID();
      try {
        if (!target) throw new Error("Storage unavailable");
        target.setItem(key, key);
        if (target.getItem(key) !== key) throw new Error("Storage did not persist");
        target.removeItem(key);
        if (target.getItem(key) !== null) throw new Error("Storage did not remove");
      } catch {
        try { target?.removeItem(key); } catch { /* Best effort on the probe key only. */ }
        throw new MemberError("storage");
      }
    }

    const persistentAdapter = {
      getItem: key => persistentStorage.getItem(key),
      setItem: (key, value) => persistentStorage.setItem(key, value),
      removeItem: key => persistentStorage.removeItem(key)
    };

    async function json(url, headers = {}) {
      const response = await fetcher(url, { cache: "no-store", credentials: "omit", headers,
        signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new MemberError("configuration");
      return response.json();
    }

    function enabled() {
      return release?.authEnabled === true && typeof release.policyVersion === "string"
        && release.policyVersion.trim().length > 0 && release.policyVersion.length <= 80
        && Array.isArray(release.allowedOrigins) && release.allowedOrigins.includes(origin)
        && Array.isArray(release.providers) && release.providers.every(provider => PROVIDERS.includes(provider));
    }

    function state() {
      return Object.freeze({ enabled: enabled(), policyVersion: enabled() ? release.policyVersion : null,
        providers: Object.freeze({ kakao: enabled() && providerSettings.kakao,
          google: enabled() && providerSettings.google }), embedded: isEmbeddedBrowser(userAgent) });
    }

    async function init() {
      if (initPromise) return initPromise;
      initPromise = (async () => {
        try {
          [backend, release] = await Promise.all([json("/nal/data/backend.json"), json("/nal/data/membership.json")]);
          if (!backend || backend.enabled !== true || !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(backend.url || "")
            || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(backend.publishableKey || "")) throw new MemberError("configuration");
          if (!enabled()) return state();
          if (!sdk?.createClient) throw new MemberError("configuration");
          probeStorage(persistentStorage);
          const settings = await json(backend.url + "/auth/v1/settings", { apikey: backend.publishableKey });
          providerSettings = Object.fromEntries(PROVIDERS.map(provider => [provider,
            release.providers.includes(provider) && settings?.external?.[provider] === true]));
          client = sdk.createClient(backend.url, backend.publishableKey, { auth: {
            flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true,
            storage: persistentAdapter
            // Keep Supabase's default storage key to share the existing checkout session.
          } });
          return state();
        } catch (error) {
          initPromise = null;
          if (error instanceof MemberError) throw error;
          throw new MemberError("configuration");
        }
      })();
      return initPromise;
    }

    async function ready() { await init(); if (!enabled() || !client) throw new MemberError("disabled"); }

    function rememberNext(value) {
      try {
        if (!storage) throw new Error("Unavailable");
        const next = safeNext(value, origin);
        storage.setItem(NEXT_KEY, next);
        if (storage.getItem(NEXT_KEY) !== next) throw new Error("Navigation did not persist");
      } catch { throw new MemberError("storage"); }
    }

    function consumeNext() {
      let next = DEFAULT_NEXT;
      try { next = safeNext(storage?.getItem(NEXT_KEY), origin); storage?.removeItem(NEXT_KEY); } catch { /* Use account home. */ }
      return next;
    }

    function clearFlow() { try { storage?.removeItem(FLOW_KEY); } catch { /* No tokens are stored here. */ } }
    function clearIntent() { clearFlow(); try { storage?.removeItem(NEXT_KEY); } catch { /* No credentials are stored here. */ } }

    async function signIn(provider, next = DEFAULT_NEXT) {
      await ready();
      if (!PROVIDERS.includes(provider) || !providerSettings[provider]) throw new MemberError("provider");
      if (provider === "google" && isEmbeddedBrowser(userAgent)) throw new MemberError("embedded");
      probeStorage(persistentStorage);
      probeStorage(storage);
      rememberNext(next);
      try {
        const result = await client.auth.signInWithOAuth({ provider, options: {
          redirectTo: origin + "/nal/auth/callback/",
          skipBrowserRedirect: true,
          ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {})
        } });
        if (result.error || !result.data?.url || !FLOW_ID.test(result.data.flowId || "")) throw new Error("OAuth unavailable");
        const authorize = new URL(result.data.url);
        if (authorize.origin !== backend.url || authorize.pathname !== "/auth/v1/authorize"
          || authorize.protocol !== "https:" || authorize.username || authorize.password || authorize.hash
          || authorize.searchParams.get("provider") !== provider
          || authorize.searchParams.getAll("provider").length !== 1
          || authorize.searchParams.get("redirect_to") !== origin + "/nal/auth/callback/"
          || authorize.searchParams.get("code_challenge_method")?.toLowerCase() !== "s256"
          || !/^[A-Za-z0-9_-]{43}$/.test(authorize.searchParams.get("code_challenge") || "")) throw new Error("Unexpected authorization URL");
        storage.setItem(FLOW_KEY, result.data.flowId);
        if (storage.getItem(FLOW_KEY) !== result.data.flowId) throw new MemberError("storage");
        // 2.117.2 keeps independent verifier slots. Retain the exact slot in this
        // tab so another tab's pending login cannot replace its legacy verifier.
        location.assign(authorize.href);
        return { provider };
      } catch (error) { clearIntent(); throw error instanceof MemberError ? error : new MemberError("oauth"); }
    }

    async function getVerifiedUser() {
      await ready();
      let result;
      try { result = await client.auth.getUser(); } catch { throw new MemberError("session"); }
      if (result.error) {
        if (result.error.name === "AuthSessionMissingError" || result.error.code === "session_not_found"
          || result.error.status === 401 || result.error.status === 403) return null;
        throw new MemberError("session");
      }
      const user = result.data?.user;
      if (!user) return null;
      if (!UUID.test(user.id || "") || user.is_anonymous === true) throw new MemberError("session");
      return user;
    }

    async function handleCallback(input) {
      if (callbackPromise) return callbackPromise;
      callbackPromise = (async () => {
        if (input.error) {
          clearIntent();
          throw new MemberError(input.error === "access_denied" ? "cancelled" : "callback");
        }
        await ready();
        if (!input.code || input.code.length > 4096 || /[\s\u0000-\u001f]/.test(input.code)) { clearIntent(); throw new MemberError("missing_code"); }
        try {
          const flowId = storage?.getItem(FLOW_KEY);
          if (!FLOW_ID.test(flowId || "") || (input.flowId && input.flowId !== flowId)) throw new Error("Unknown tab flow");
          const result = await client.auth.exchangeCodeForSession(input.code, { flowId });
          clearFlow();
          if (result.error || !result.data?.session) throw new Error("No session");
          const user = await getVerifiedUser();
          if (!user) throw new Error("No verified user");
          return user;
        } catch { clearIntent(); throw new MemberError("callback"); }
      })().catch(error => { clearIntent(); throw error; });
      return callbackPromise;
    }

    async function readConsent(userId, purpose) {
      const result = await client.from("nal_consents").select("purpose,policy_version,granted,recorded_at")
        .eq("user_id", userId).eq("purpose", purpose).eq("policy_version", release.policyVersion)
        .order("recorded_at", { ascending: false }).limit(1);
      if (result.error) throw new MemberError("account");
      return result.data?.[0]?.granted === true;
    }

    async function getAccount() {
      const user = await getVerifiedUser();
      if (!user) return null;
      try {
        const [profile, terms, privacy] = await Promise.all([
          client.from("nal_profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
          readConsent(user.id, "terms"), readConsent(user.id, "privacy")
        ]);
        if (profile.error) throw new MemberError("account");
        const displayName = typeof profile.data?.display_name === "string" ? profile.data.display_name : "";
        return Object.freeze({ id: user.id, email: typeof user.email === "string" ? user.email : "",
          emailVerified: Boolean(user.email && user.email_confirmed_at), displayName,
          providers: Object.freeze([...new Set((user.identities || []).map(identity => identity.provider)
            .filter(provider => PROVIDERS.includes(provider)))]),
          terms, privacy, onboardingNeeded: !displayName || !terms || !privacy });
      } catch { throw new MemberError("account"); }
    }

    async function completeOnboarding(input) {
      await ready();
      if (input?.terms !== true || input?.privacy !== true) throw new MemberError("consent");
      const name = typeof input.displayName === "string" ? input.displayName.trim() : "";
      if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw new MemberError("nickname");
      const user = await getVerifiedUser();
      if (!user) throw new MemberError("required");
      if (input.expectedUserId && input.expectedUserId !== user.id) throw new MemberError("session");
      try {
        const profile = await client.from("nal_profiles").upsert({ user_id: user.id, display_name: name }, { onConflict: "user_id" });
        if (profile.error) throw new Error("Profile write failed");
        const purposes = ["terms", "privacy"];
        const current = await Promise.all(purposes.map(purpose => readConsent(user.id, purpose)));
        const missing = purposes.filter((_purpose, i) => !current[i]).map(purpose => ({
          user_id: user.id, purpose, policy_version: release.policyVersion, granted: true
        }));
        if (missing.length) {
          // One batch: PostgreSQL commits both required consents together.
          const result = await client.from("nal_consents").insert(missing);
          if (result.error) throw new Error("Consent write failed");
        }
        const account = await getAccount();
        if (!account || account.id !== user.id || account.onboardingNeeded) throw new Error("Readback failed");
        return account;
      } catch { throw new MemberError("save"); }
    }

    async function signOut() {
      await ready();
      try {
        const result = await client.auth.signOut({ scope: "local" });
        if (result.error) throw new Error("Signout failed");
      } catch { throw new MemberError("logout"); }
      finally { clearIntent(); }
    }

    function watchSession(listener) {
      if (!client || typeof listener !== "function") return () => {};
      const result = client.auth.onAuthStateChange((event, session) => {
        // The listener may only invalidate local state and schedule later work.
        // Never await an Auth method while this SDK callback lock is held.
        listener(event, UUID.test(session?.user?.id || "") ? session.user.id : null);
      });
      return () => result.data.subscription.unsubscribe();
    }

    return Object.freeze({ init, state, signIn, handleCallback, getAccount, getVerifiedUser,
      completeOnboarding, signOut, consumeNext, rememberNext, watchSession });
  }

  scope.NALMemberAuth = Object.freeze({ create, safeNext, isEmbeddedBrowser, consumeCallbackUrl,
    createIdentityGuard, MemberError, DEFAULT_NEXT });
})(globalThis);
