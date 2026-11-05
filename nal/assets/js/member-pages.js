(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const page = document.body.dataset.memberPage;
  const api = globalThis.NALMemberAuth;
  if (!api) return;
  const next = api.safeNext(new URL(location.href).searchParams.get("next"), location.origin);
  const callback = page === "callback" ? api.consumeCallbackUrl(location.href, history) : null;
  const auth = api.create();
  let busy = false, account = null, watching = false, navigating = false;
  let callbackVerified = page !== "callback";
  const identity = api.createIdentityGuard({
    isBusy: () => busy || navigating || !callbackVerified,
    onInvalidate: change => {
      clearAccount();
      if (!change.userId) {
        setVisible("[data-member-signin]", page === "login");
        setVisible("[data-member-empty]", page === "account");
        if (change.event === "SIGNED_OUT") status("로그아웃되었습니다.");
      } else status("로그인 계정을 확인하고 있습니다.");
    },
    onRefresh: () => { void refreshAccount(); }
  });

  function clearAccount() {
    account = null;
    text("[data-member-name]", ""); text("[data-member-email]", ""); text("[data-member-providers]", "");
    setVisible("[data-member-account]", false); setVisible("[data-member-session]", false);
    setVisible("[data-member-onboarding]", false);
    const form = $("[data-onboarding-form]"); if (form) form.reset();
  }

  function status(message, error = false) {
    const target = $("[data-member-status]");
    if (!target) return;
    target.textContent = message;
    target.hidden = !message;
    target.classList.toggle("is-error", error);
  }

  function setVisible(selector, visible) { const node = $(selector); if (node) node.hidden = !visible; }
  function text(selector, value) { const node = $(selector); if (node) node.textContent = value; }
  function message(error) { return error instanceof api.MemberError ? error.message : "연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."; }

  function finishOperation() { busy = false; buttons(); identity.flush(); }
  function navigate(destination) {
    if (navigating) return;
    navigating = true; identity.stop(); location.replace(destination);
  }

  function buttons() {
    const state = auth.state();
    document.querySelectorAll("[data-member-provider]").forEach(button => {
      const available = state.providers[button.dataset.memberProvider] === true;
      button.disabled = busy || !available;
      button.setAttribute("aria-describedby", "member-status");
      const note = button.closest(".member-provider")?.querySelector("[data-provider-note]");
      if (note) { note.textContent = available ? "" : "준비 중"; note.hidden = available; }
    });
    document.querySelectorAll("[data-member-signout], [data-onboarding-submit]").forEach(button => { button.disabled = busy; });
  }

  function showOnboarding(value) {
    setVisible("[data-member-signin]", false);
    setVisible("[data-member-session]", false);
    setVisible("[data-member-account]", false);
    setVisible("[data-member-onboarding]", true);
    const form = $("[data-onboarding-form]");
    form.elements.displayName.value = value.displayName || "";
    form.elements.terms.checked = value.terms;
    form.elements.privacy.checked = value.privacy;
    status("처음 한 번, 이름과 이용 안내를 확인하면 가입이 완료됩니다.");
  }

  function showAccount(value) {
    setVisible("[data-member-onboarding]", false);
    setVisible("[data-member-empty]", false);
    if (value.onboardingNeeded) return showOnboarding(value);
    if (page === "callback") { if (callbackVerified) navigate(auth.consumeNext()); return; }
    setVisible("[data-member-signin]", false);
    setVisible("[data-member-session]", page === "login");
    setVisible("[data-member-account]", page === "account");
    text("[data-member-name]", value.displayName);
    text("[data-member-email]", value.email || "등록된 이메일이 없습니다.");
    text("[data-member-providers]", value.providers.map(provider => provider === "kakao" ? "카카오" : "Google").join(" · ") || "기존 로그인");
    setVisible("[data-email-unverified]", !value.emailVerified);
    const continuation = $("[data-member-continue]");
    if (continuation) continuation.href = next;
    status("");
  }

  async function loadAccount() {
    const ticket = identity.snapshot();
    try {
      const latest = await auth.getAccount();
      if (!identity.accept(ticket, latest)) {
        if (identity.matches(ticket)) {
          status("로그인 계정이 변경되었습니다. 연결을 다시 확인해 주세요.", true);
          setVisible("[data-member-recovery]", true);
        }
        return;
      }
      account = latest;
      setVisible("[data-member-recovery]", false);
      if (account) showAccount(account);
      else {
        clearAccount();
        setVisible("[data-member-signin]", page === "login");
        setVisible("[data-member-empty]", page === "account");
        const state = auth.state();
        status(page === "account" ? "로그인하면 내 정보를 확인할 수 있습니다." :
          !state.providers.kakao && !state.providers.google ? "간편로그인 연결을 준비하고 있습니다. 무료 PDF는 바로 이용할 수 있어요." : "");
      }
    } catch (error) {
      if (identity.matches(ticket)) throw error;
    }
  }

  async function refreshAccount() {
    busy = true; buttons();
    try { await loadAccount(); }
    catch (error) { status(message(error), true); setVisible("[data-member-recovery]", true); }
    finally { finishOperation(); }
  }

  async function boot() {
    busy = true;
    buttons();
    try {
      if (callback?.error) await auth.handleCallback(callback);
      const state = await auth.init();
      setVisible("[data-inapp-help]", state.embedded);
      if (!state.enabled) { status(new api.MemberError("disabled").message); setVisible("[data-member-recovery]", true); return; }
      if (!watching) {
        watching = true;
        auth.watchSession((event, userId) => identity.observe(event, userId));
      }
      if (page === "callback") { await auth.handleCallback(callback); callbackVerified = true; }
      await loadAccount();
    } catch (error) {
      status(message(error), true);
      setVisible("[data-member-recovery]", true);
    } finally { finishOperation(); }
  }

  document.querySelectorAll("[data-member-provider]").forEach(button => button.addEventListener("click", async () => {
    if (busy) return;
    busy = true; buttons(); status("로그인 페이지로 이동하고 있습니다.");
    try { await auth.signIn(button.dataset.memberProvider, next); navigating = true; identity.stop(); }
    catch (error) { status(message(error), true); }
    finally { finishOperation(); }
  }));

  $("[data-onboarding-form]")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const ticket = identity.snapshot();
    const expectedUserId = account?.id;
    busy = true; buttons(); status("회원 정보를 저장하고 있습니다.");
    try {
      const latest = await auth.completeOnboarding({ displayName: form.elements.displayName.value,
        terms: form.elements.terms.checked, privacy: form.elements.privacy.checked, expectedUserId });
      if (!identity.accept(ticket, latest)) return;
      account = latest;
      if (page === "login") { navigate(next); return; }
      showAccount(account);
    } catch (error) { if (identity.matches(ticket)) status(message(error), true); }
    finally { finishOperation(); }
  });

  document.querySelectorAll("[data-member-signout]").forEach(button => button.addEventListener("click", async () => {
    if (busy) return;
    busy = true; buttons();
    try {
      await auth.signOut();
      clearAccount();
      navigate("/nal/login/");
    } catch (error) { status(message(error), true); }
    finally { finishOperation(); }
  }));

  $("[data-copy-login]")?.addEventListener("click", async () => {
    // Restart authentication in the destination browser; never copy an OAuth URL.
    const cleanUrl = location.origin + "/nal/login/?next=" + encodeURIComponent(next);
    try { await navigator.clipboard.writeText(cleanUrl); status("주소를 복사했습니다. Chrome 또는 Safari의 주소창에 붙여 넣어 주세요."); }
    catch {
      const target = $("[data-login-address]");
      if (target) { target.hidden = false; target.value = cleanUrl; target.focus(); target.select(); }
      status("아래 로그인 주소를 복사해 Chrome 또는 Safari에서 열어 주세요.");
    }
  });
  $("[data-member-retry]")?.addEventListener("click", () => location.reload());
  boot();
})();
