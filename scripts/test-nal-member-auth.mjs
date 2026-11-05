import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "../nal/assets/js/member-auth.js";

// Unit/contract tests only. The SDK and database below are isolated fakes;
// passing these tests does not establish live Kakao/Google or production RLS QA.
const api = globalThis.NALMemberAuth;
const origin = "https://daily-coach-ing.com";
const userId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const backend = { enabled: true, url: "https://tdglznjjkgaulerbduwt.supabase.co", publishableKey: "sb_publishable_test" };

function harness(config = {}) {
  const release = { authEnabled: true, policyVersion: "test-only-v1", allowedOrigins: [origin], providers: ["kakao", "google"], ...config.release };
  const data = { profiles: config.profiles || [], consents: config.consents || [] };
  const calls = { fetch: [], clients: [], oauth: [], exchanges: [], reads: [], writes: [], signouts: [], assigned: [], verified: 0 };
  const flags = { ...config.flags };
  let user = Object.hasOwn(config, "user") ? config.user : { id: userId, email: "member@example.test", email_confirmed_at: "2026-10-01", identities: [{ provider: "kakao" }] };
  const stored = new Map();
  if (config.pendingFlowId) stored.set("nal.member.pkce-flow.v1", config.pendingFlowId);
  const storage = { setItem: (key, value) => stored.set(key, value), getItem: key => stored.get(key) ?? null, removeItem: key => stored.delete(key) };
  const persistentValues = new Map();
  const persistentStorage = { setItem: (key, value) => persistentValues.set(key, value), getItem: key => persistentValues.get(key) ?? null, removeItem: key => persistentValues.delete(key) };
  let authListener;
  const client = {
    auth: {
      signInWithOAuth: async input => {
        calls.oauth.push(input);
        const url = new URL(backend.url + "/auth/v1/authorize");
        url.search = new URLSearchParams({ provider: input.provider, redirect_to: input.options.redirectTo, code_challenge: "A".repeat(43), code_challenge_method: "s256" }).toString();
        return flags.oauthFail ? { error: new Error("Secret internal failure") } : { data: {
          url: flags.authorizeUrl || url.href, flowId: config.flowId || "test-flow-0001"
        } };
      },
      exchangeCodeForSession: async (...args) => { calls.exchanges.push(args); return flags.exchangeFail ? { error: { message: "Secret internal failure" } } : { data: { session: { user: { id: otherId } } } }; },
      getUser: async () => {
        calls.verified += 1;
        if (flags.userNetworkFail) return { error: { status: 503, message: "Upstream raw error" } };
        return user ? { data: { user } } : { data: { user: null }, error: { name: "AuthSessionMissingError" } };
      },
      signOut: async input => { calls.signouts.push(input); if (flags.signoutFail) return { error: { message: "Failed" } }; user = null; return { error: null }; },
      onAuthStateChange: listener => { authListener = listener; return { data: { subscription: { unsubscribe() { authListener = null; } } } }; }
    },
    from(table) {
      const filters = [];
      let limit = Infinity;
      const builder = {
        select() { return builder; },
        eq(key, value) { filters.push([key, value]); return builder; },
        order() { return builder; },
        limit(value) { limit = value; return builder; },
        maybeSingle() { return Promise.resolve(execute(true)); },
        then(resolve, reject) { return Promise.resolve(execute(false)).then(resolve, reject); },
        async upsert(value) {
          calls.writes.push({ table, type: "upsert", value: structuredClone(value) });
          if (flags.profileFail) return { error: { message: "Denied" } };
          data.profiles = [...data.profiles.filter(row => row.user_id !== value.user_id), structuredClone(value)];
          return { error: null };
        },
        async insert(value) {
          calls.writes.push({ table, type: "insert", value: structuredClone(value) });
          if (flags.consentFail) return { error: { message: "Denied" } };
          if (!flags.dropConsentWrite) data.consents.push(...structuredClone(value).map(row => ({ ...row, recorded_at: new Date().toISOString() })));
          return { error: null };
        }
      };
      function execute(single) {
        calls.reads.push({ table, filters: structuredClone(filters) });
        if (flags.readFail) return { error: { message: "Denied" } };
        const rows = (table === "nal_profiles" ? data.profiles : data.consents)
          .filter(row => filters.every(([key, value]) => row[key] === value)).slice().reverse().slice(0, limit);
        return { error: null, data: single ? rows[0] || null : rows };
      }
      return builder;
    }
  };
  const sdk = { createClient(...args) { calls.clients.push(args); return client; } };
  const fetcher = async (url, init) => {
    calls.fetch.push({ url, init });
    if (url.endsWith("/auth/v1/settings")) return { ok: !flags.settingsFail, json: async () => ({ external: config.providers || { kakao: true, google: true } }) };
    return { ok: true, json: async () => structuredClone(url.includes("backend.json") ? { ...backend, ...config.backend } : release) };
  };
  const auth = api.create({ sdk, fetcher, storage: config.storage || storage,
    persistentStorage: config.persistentStorage || persistentStorage,
    location: { href: origin + "/nal/login/", assign: url => calls.assigned.push(url) }, userAgent: config.userAgent || "Mozilla/5.0 Chrome" });
  return { auth, calls, data, flags, stored, release, persistentValues, persistentStorage,
    setUser(value) { user = value; }, emit(event, id = user?.id) { authListener?.(event, id ? { user: { id } } : null); } };
}

const accepted = ["/nal/", "/nal/shop/book/", "/nal/checkout/?product=mind-reset", "/nal/my/#wishlist"];
for (const path of accepted) test(`return URL preserves NAL path: ${path}`, () => assert.equal(api.safeNext(path, origin), path));
const attacks = [
  "https://evil.example/nal/", "//evil.example/nal/", "/nal//evil.example", "/nal/../admin/",
  "/nal/%2e%2e/admin/", "/nal/%252e%252e/admin/", "/nal/%2f%2fevil.example/", "/nal/\\evil.example/",
  "/nal/\nshop/", "javascript:alert(1)", "/nal/auth/callback/?code=bad", "/nal/login/?next=bad", "/nal/./shop/", null
];
test("external, encoded, normalized and looping return URLs fail closed", () => {
  for (const value of attacks) assert.equal(api.safeNext(value, origin), api.DEFAULT_NEXT, String(value));
});

test("committed release does not start unconfigured production signup", async () => {
  const cfg = JSON.parse(await readFile(new URL("../nal/data/membership.json", import.meta.url), "utf8"));
  assert.equal(cfg.authEnabled, false); assert.equal(cfg.policyVersion, null);
  const { auth, calls } = harness({ release: cfg });
  const state = await auth.init(); assert.equal(state.enabled, false);
  assert.equal(calls.clients.length, 0); assert.equal(calls.fetch.length, 2);
  await assert.rejects(auth.signIn("kakao"), { code: "disabled" });
  assert.equal(calls.oauth.length, 0);
});

test("missing policy, foreign origin and malformed provider settings stay disabled", async () => {
  for (const release of [{ policyVersion: null }, { policyVersion: "" }, { allowedOrigins: ["https://evil.example"] }, { providers: "kakao" }]) {
    const { auth, calls } = harness({ release });
    assert.equal((await auth.init()).enabled, false); assert.equal(calls.clients.length, 0);
  }
});

test("rejects non-publishable backend credentials", async () => {
  const { auth, calls } = harness({ backend: { publishableKey: "sb_secret_never_in_frontend" } });
  await assert.rejects(auth.init(), { code: "configuration" }); assert.equal(calls.clients.length, 0);
});

test("SDK uses one PKCE exchange path and retains the existing storage key", async () => {
  const { auth, calls } = harness(); await Promise.all([auth.init(), auth.init()]);
  assert.equal(calls.clients.length, 1);
  const { storage, ...settings } = calls.clients[0][2].auth;
  assert.deepEqual(settings, { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true });
  assert.equal(typeof storage.setItem, "function");
  assert.equal(calls.clients[0][2].auth.storageKey, undefined);
});

test("provider settings must explicitly report true", async () => {
  const { auth, calls } = harness({ providers: { kakao: false, google: "true" } });
  assert.deepEqual((await auth.init()).providers, { kakao: false, google: false });
  await assert.rejects(auth.signIn("kakao"), { code: "provider" });
  await assert.rejects(auth.signIn("github"), { code: "provider" }); assert.equal(calls.oauth.length, 0);
});

test("settings outage does not manufacture a usable provider", async () => {
  const { auth, calls, flags } = harness({ flags: { settingsFail: true } });
  await assert.rejects(auth.init(), { code: "configuration" }); assert.equal(calls.clients.length, 0);
  flags.settingsFail = false; assert.equal((await auth.init()).providers.kakao, true); assert.equal(calls.clients.length, 1);
});

test("Kakao starts through the SDK and returns only to the fixed callback", async () => {
  const { auth, calls } = harness(); await auth.signIn("kakao", "/nal/shop/book/");
  assert.deepEqual(calls.oauth[0], { provider: "kakao", options: { redirectTo: origin + "/nal/auth/callback/", skipBrowserRedirect: true } });
  assert.equal(calls.assigned.length, 1); assert.equal(new URL(calls.assigned[0]).origin, backend.url);
  assert.equal(auth.consumeNext(), "/nal/shop/book/"); assert.equal(auth.consumeNext(), api.DEFAULT_NEXT);
});

test("Google in app browser requests a fresh browser login without starting OAuth", async () => {
  const { auth, calls } = harness({ userAgent: "Mozilla KAKAOTALK 26.1" });
  await assert.rejects(auth.signIn("google"), { code: "embedded" }); assert.equal(calls.oauth.length, 0);
  assert.equal(api.isEmbeddedBrowser("Mozilla/5.0 Chrome Safari"), false);
  assert.equal(api.isEmbeddedBrowser("Mozilla/5.0 (Linux; Android 16; wv)"), true);
});

test("Google minimal login uses account selection, without additional data scopes", async () => {
  const { auth, calls } = harness(); await auth.signIn("google");
  assert.deepEqual(calls.oauth[0].options.queryParams, { prompt: "select_account" });
  assert.equal(calls.oauth[0].options.scopes, undefined);
});

test("unavailable browser storage does not begin an unresumable flow", async () => {
  const { auth, calls } = harness({ storage: { setItem() { throw new Error("Denied"); } } });
  await assert.rejects(auth.signIn("kakao"), { code: "storage" }); assert.equal(calls.oauth.length, 0);
});

test("OAuth failure clears return intent and hides provider internals", async () => {
  const { auth, stored } = harness({ flags: { oauthFail: true } });
  await assert.rejects(auth.signIn("kakao"), error => error.code === "oauth" && !error.message.includes("Secret"));
  assert.equal(stored.size, 0);
});

test("callback URL is scrubbed synchronously before code exchange", () => {
  const replacements = [];
  const result = api.consumeCallbackUrl(origin + "/nal/auth/callback/?code=auth-code&sb_flow_id=flow-id&state=state#error_description=secret", { replaceState: (...args) => replacements.push(args) });
  assert.deepEqual(result, { code: "auth-code", error: "", flowId: "flow-id" });
  assert.deepEqual(replacements, [[null, "", "/nal/auth/callback/"]]);
});

test("consent denial never exchanges a code and clears pending navigation", async () => {
  const { auth, calls, stored } = harness(); auth.rememberNext("/nal/shop/");
  await assert.rejects(auth.handleCallback({ code: "unused", error: "access_denied" }), { code: "cancelled" });
  assert.equal(calls.exchanges.length, 0); assert.equal(stored.size, 0);
});

test("concurrent callback handlers exchange exactly once and verify the server user", async () => {
  const { auth, calls } = harness({ pendingFlowId: "flow-id-0001" });
  const result = await Promise.all([auth.handleCallback({ code: "one-time-code", flowId: "flow-id-0001" }), auth.handleCallback({ code: "one-time-code" })]);
  assert.equal(calls.exchanges.length, 1); assert.equal(calls.verified, 1);
  assert.deepEqual(calls.exchanges[0], ["one-time-code", { flowId: "flow-id-0001" }]);
  assert.equal(result[0].id, userId); // The untrusted session fixture intentionally has otherId.
});

test("missing code and failed exchanges cannot report authentication success", async () => {
  await assert.rejects(harness().auth.handleCallback({ code: "" }), { code: "missing_code" });
  await assert.rejects(harness({ flags: { exchangeFail: true }, pendingFlowId: "test-flow-0001" }).auth.handleCallback({ code: "bad" }), { code: "callback" });
  await assert.rejects(harness({ user: null, pendingFlowId: "test-flow-0001" }).auth.handleCallback({ code: "bad" }), { code: "callback" });
});

test("anonymous users and fabricated identifiers cannot become members", async () => {
  for (const user of [{ id: userId, is_anonymous: true }, { id: "forged-user" }]) {
    const { auth, calls } = harness({ user }); await assert.rejects(auth.getAccount(), { code: "session" });
    assert.equal(calls.reads.length, 0); assert.equal(calls.writes.length, 0);
  }
});

test("no current session is distinct from a failing authentication service", async () => {
  assert.equal(await harness({ user: null }).auth.getAccount(), null);
  await assert.rejects(harness({ flags: { userNetworkFail: true } }).auth.getAccount(), { code: "session" });
});

test("Kakao user without an email remains signed in, with purchase email still unverified", async () => {
  const { auth } = harness({ user: { id: userId, identities: [{ provider: "kakao" }] } });
  const account = await auth.getAccount(); assert.equal(account.id, userId);
  assert.equal(account.email, ""); assert.equal(account.emailVerified, false); assert.equal(account.onboardingNeeded, true);
});

test("account queries always bind to the verified user and current policy", async () => {
  const { auth, calls } = harness({ profiles: [{ user_id: otherId, display_name: "Wrong owner" }] });
  const account = await auth.getAccount(); assert.equal(account.displayName, "");
  for (const call of calls.reads) assert.ok(call.filters.some(([key, value]) => key === "user_id" && value === userId));
  for (const call of calls.reads.filter(value => value.table === "nal_consents")) assert.ok(call.filters.some(([key, value]) => key === "policy_version" && value === "test-only-v1"));
});

test("policy read errors do not appear as an accepted member", async () => {
  await assert.rejects(harness({ flags: { readFail: true } }).auth.getAccount(), { code: "account" });
});

test("incomplete consent and invalid names cannot be stored", async () => {
  const { auth, calls } = harness();
  await assert.rejects(auth.completeOnboarding({ displayName: "회원", terms: true, privacy: false }), { code: "consent" });
  await assert.rejects(auth.completeOnboarding({ displayName: " ", terms: true, privacy: true }), { code: "nickname" });
  assert.equal(calls.writes.length, 0);
});

test("onboarding binds owner on the server-verified identity and reads back consent", async () => {
  const { auth, calls } = harness();
  const account = await auth.completeOnboarding({ user_id: otherId, displayName: " NAL 회원 ", terms: true, privacy: true });
  assert.equal(account.onboardingNeeded, false); assert.equal(account.displayName, "NAL 회원");
  assert.equal(calls.writes[0].value.user_id, userId);
  assert.deepEqual(calls.writes[1].value, ["terms", "privacy"].map(purpose => ({ user_id: userId, purpose, policy_version: "test-only-v1", granted: true })));
  assert.ok(calls.verified >= 2);
});

test("consent persistence failure stays incomplete and supports a successful retry", async () => {
  const { auth, flags, data, calls } = harness({ flags: { consentFail: true } });
  const input = { displayName: "회원", terms: true, privacy: true };
  await assert.rejects(auth.completeOnboarding(input), { code: "save" }); assert.equal(data.consents.length, 0);
  flags.consentFail = false; assert.equal((await auth.completeOnboarding(input)).onboardingNeeded, false);
  const writesBefore = calls.writes.filter(value => value.table === "nal_consents").length;
  await auth.completeOnboarding(input);
  assert.equal(calls.writes.filter(value => value.table === "nal_consents").length, writesBefore);
});

test("a successful HTTP write without consent readback cannot complete signup", async () => {
  await assert.rejects(harness({ flags: { dropConsentWrite: true } }).auth.completeOnboarding({ displayName: "회원", terms: true, privacy: true }), { code: "save" });
});

test("profile save failure cannot write required consents", async () => {
  const { auth, calls } = harness({ flags: { profileFail: true } });
  await assert.rejects(auth.completeOnboarding({ displayName: "회원", terms: true, privacy: true }), { code: "save" });
  assert.equal(calls.writes.filter(value => value.table === "nal_consents").length, 0);
});

test("latest withdrawal for the current policy requires consent again", async () => {
  const consents = ["terms", "privacy"].map(purpose => ({ user_id: userId, purpose, policy_version: "test-only-v1", granted: true }));
  consents.push({ user_id: userId, purpose: "terms", policy_version: "test-only-v1", granted: false });
  const { auth } = harness({ profiles: [{ user_id: userId, display_name: "회원" }], consents });
  const account = await auth.getAccount(); assert.equal(account.terms, false); assert.equal(account.onboardingNeeded, true);
});

test("signout clears local intent and asks the SDK to revoke this browser session", async () => {
  const { auth, calls, stored } = harness(); await auth.init(); auth.rememberNext("/nal/shop/"); await auth.signOut();
  assert.deepEqual(calls.signouts, [{ scope: "local" }]); assert.equal(stored.size, 0); assert.equal(await auth.getAccount(), null);
});

test("failed signout cannot show a success state", async () => {
  const { auth, stored } = harness({ flags: { signoutFail: true } }); await auth.init(); auth.rememberNext("/nal/shop/");
  await assert.rejects(auth.signOut(), { code: "logout" }); assert.equal(stored.size, 0); assert.ok(await auth.getAccount());
});

test("SDK events synchronously invalidate identity while network refresh is deferred", async () => {
  const { auth, emit } = harness(); await auth.init(); const events = [];
  const guard = api.createIdentityGuard({ isBusy: () => false,
    onInvalidate: change => events.push(change.event), onRefresh: () => events.push("refresh") });
  const stop = auth.watchSession((event, id) => guard.observe(event, id)); emit("SIGNED_IN");
  assert.deepEqual(events, ["SIGNED_IN"]);
  await new Promise(resolve => setTimeout(resolve, 10)); assert.deepEqual(events, ["SIGNED_IN", "refresh"]);
  stop(); emit("SIGNED_OUT"); await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(events.length, 2);
});

test("unavailable or silently dropping localStorage blocks SDK creation", async () => {
  for (const persistentStorage of [
    { setItem() { throw new Error("Blocked"); }, getItem() { return null; }, removeItem() {} },
    { setItem() {}, getItem() { return null; }, removeItem() {} }
  ]) {
    const { auth, calls } = harness({ persistentStorage });
    await assert.rejects(auth.init(), { code: "storage" });
    assert.equal(calls.clients.length, 0); assert.equal(calls.oauth.length, 0);
  }
});

test("persistent adapter uses the actual local store and probe leaves no keys", async () => {
  const { auth, calls, persistentValues } = harness(); await auth.init();
  assert.equal(persistentValues.size, 0);
  const adapter = calls.clients[0][2].auth.storage;
  adapter.setItem("test-session-key", "persisted");
  assert.equal(persistentValues.get("test-session-key"), "persisted");
  assert.equal(adapter.getItem("test-session-key"), "persisted");
  adapter.removeItem("test-session-key"); assert.equal(persistentValues.size, 0);
});

test("localStorage loss between page load and sign in prevents redirect", async () => {
  const { auth, calls, persistentStorage } = harness(); await auth.init();
  persistentStorage.setItem = () => { throw new Error("Quota denied"); };
  await assert.rejects(auth.signIn("kakao"), { code: "storage" });
  assert.equal(calls.oauth.length, 0); assert.equal(calls.assigned.length, 0);
});

test("callback without its tab flow or with a conflicting URL flow never borrows a verifier", async () => {
  for (const config of [{}, { pendingFlowId: "saved-flow-0001" }]) {
    const { auth, calls, stored } = harness(config);
    await assert.rejects(auth.handleCallback({ code: "one-time-code", flowId: "different-flow-0002" }), { code: "callback" });
    assert.equal(calls.exchanges.length, 0); assert.equal(stored.size, 0);
  }
});

test("concurrent tabs retain their own flow ids and return destinations", async () => {
  const sharedPersistent = harness().persistentStorage;
  const first = harness({ persistentStorage: sharedPersistent, flowId: "first-tab-flow-0001" });
  const second = harness({ persistentStorage: sharedPersistent, flowId: "second-tab-flow-0002" });
  await first.auth.signIn("kakao", "/nal/shop/first/");
  await second.auth.signIn("google", "/nal/shop/second/");
  await first.auth.handleCallback({ code: "first-code" });
  assert.equal(first.stored.has("nal.member.pkce-flow.v1"), false);
  assert.equal(second.stored.get("nal.member.pkce-flow.v1"), "second-tab-flow-0002");
  await second.auth.handleCallback({ code: "second-code" });
  assert.deepEqual(first.calls.exchanges[0], ["first-code", { flowId: "first-tab-flow-0001" }]);
  assert.deepEqual(second.calls.exchanges[0], ["second-code", { flowId: "second-tab-flow-0002" }]);
  assert.equal(first.auth.consumeNext(), "/nal/shop/first/");
  assert.equal(second.auth.consumeNext(), "/nal/shop/second/");
});

test("unexpected authorization origins or routes cannot navigate the browser", async () => {
  for (const authorizeUrl of ["https://evil.example/auth/v1/authorize", backend.url + "/auth/v1/user", "http://tdglznjjkgaulerbduwt.supabase.co/auth/v1/authorize"]) {
    const { auth, calls, stored } = harness({ flags: { authorizeUrl } });
    await assert.rejects(auth.signIn("kakao"), { code: "oauth" });
    assert.equal(calls.assigned.length, 0); assert.equal(stored.size, 0);
  }
});

test("missing callback code clears its tab pending flow", async () => {
  const { auth, stored } = harness({ pendingFlowId: "pending-flow-0001" });
  await assert.rejects(auth.handleCallback({ code: "" }), { code: "missing_code" }); assert.equal(stored.size, 0);
});

test("onboarding for a previously displayed account cannot write to a newly signed-in account", async () => {
  const { auth, calls } = harness({ user: { id: otherId } });
  await assert.rejects(auth.completeOnboarding({ displayName: "First account name", terms: true, privacy: true, expectedUserId: userId }), { code: "session" });
  assert.equal(calls.writes.length, 0);
});

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

for (const operation of ["account read", "onboarding completion"]) test(`busy ${operation}: an old user result is discarded and the new user is refreshed once`, async () => {
  let busy = true;
  const firstResult = deferred(), refreshed = deferred(), scheduled = [], rendered = [];
  let refreshCalls = 0;
  const guard = api.createIdentityGuard({
    isBusy: () => busy,
    defer: callback => scheduled.push(callback),
    onInvalidate: () => { rendered.length = 0; },
    onRefresh: async () => {
      refreshCalls += 1; busy = true;
      const ticket = guard.snapshot();
      const latest = await Promise.resolve({ id: otherId, displayName: "Second account" });
      if (guard.accept(ticket, latest)) rendered.push(latest);
      busy = false; guard.flush(); refreshed.resolve();
    }
  });
  guard.observe("INITIAL_SESSION", userId);
  const ticket = guard.snapshot();
  const inFlight = firstResult.promise.then(value => {
    if (guard.accept(ticket, value)) rendered.push(value);
    busy = false; guard.flush();
  });
  // The second tab changes identity while the first request is still unresolved.
  guard.observe("SIGNED_IN", otherId);
  assert.equal(scheduled.length, 0); assert.equal(rendered.length, 0);
  firstResult.resolve({ id: userId, displayName: "Stale first account" });
  await inFlight;
  assert.deepEqual(rendered, []); assert.equal(scheduled.length, 1);
  scheduled.shift()(); await refreshed.promise;
  assert.equal(refreshCalls, 1); assert.deepEqual(rendered, [{ id: otherId, displayName: "Second account" }]);
  assert.equal(scheduled.length, 0);
});

test("same-user SDK callback events do not invalidate a valid read or overwrite a newer identity", async () => {
  let busy = true;
  const scheduled = [], rendered = [];
  const guard = api.createIdentityGuard({ isBusy: () => busy, defer: callback => scheduled.push(callback),
    onInvalidate: () => { rendered.length = 0; }, onRefresh: () => assert.fail("Duplicate refresh") });
  guard.observe("SIGNED_IN", userId);
  const ticket = guard.snapshot();
  const inFlight = deferred();
  const read = inFlight.promise.then(value => { if (guard.accept(ticket, value)) rendered.push(value); });
  guard.observe("SIGNED_IN", userId);
  guard.observe("TOKEN_REFRESHED", userId);
  guard.observe("INITIAL_SESSION", otherId); // A late initial baseline must be ignored.
  inFlight.resolve({ id: userId }); await read;
  busy = false; guard.flush();
  assert.deepEqual(rendered, [{ id: userId }]); assert.equal(scheduled.length, 0);
});

test("USER_UPDATED invalidates same-user work while busy; logout discards pending refresh", async () => {
  let busy = true;
  const scheduled = [], rendered = [];
  const guard = api.createIdentityGuard({ isBusy: () => busy, defer: callback => scheduled.push(callback),
    onInvalidate: () => { rendered.length = 0; }, onRefresh: () => assert.fail("No refresh after logout") });
  guard.observe("INITIAL_SESSION", userId); const ticket = guard.snapshot();
  const inFlight = deferred();
  const read = inFlight.promise.then(value => { if (guard.accept(ticket, value)) rendered.push(value); });
  guard.observe("USER_UPDATED", userId); assert.equal(guard.matches(ticket), false);
  guard.observe("SIGNED_OUT", null);
  inFlight.resolve({ id: userId }); await read; busy = false; guard.flush();
  assert.deepEqual(rendered, []); assert.equal(scheduled.length, 0);
});
