/* Apply the device-local preference before CSS paints, independently of catalog loading. */
(() => {
  "use strict";

  const storageKey = "nal:theme:v1";
  const root = document.documentElement;
  const allowed = new Set(["system", "light", "dark"]);
  const system = window.matchMedia?.("(prefers-color-scheme: dark)");
  let preference = "system";

  try {
    const saved = window.localStorage.getItem(storageKey);
    if (allowed.has(saved)) preference = saved;
  } catch {
    // Browsers that restrict storage can still change appearance for this page.
  }

  function syncControls() {
    document.querySelectorAll("[data-nal-theme]").forEach((control) => {
      control.value = preference;
    });
  }

  function apply() {
    const resolved = preference === "system" ? (system?.matches ? "dark" : "light") : preference;
    root.dataset.theme = resolved;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#17191e" : "#F5F1E8");
    document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", resolved);
    syncControls();
  }

  function setPreference(value) {
    if (!allowed.has(value)) return;
    preference = value;
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // Saving is optional; applying the user's choice is not.
    }
    apply();
  }

  apply();
  document.addEventListener("DOMContentLoaded", syncControls);
  document.addEventListener("nal:page-rendered", syncControls);
  document.addEventListener("change", (event) => {
    if (event.target.matches?.("[data-nal-theme]")) setPreference(event.target.value);
  });
  const onSystemChange = () => {
    if (preference === "system") apply();
  };
  if (system?.addEventListener) system.addEventListener("change", onSystemChange);
  else system?.addListener?.(onSystemChange);
  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    // A similarly named sessionStorage event must not replace the preference.
    try {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
    } catch {
      return;
    }
    preference = allowed.has(event.newValue) ? event.newValue : "system";
    apply();
  });
})();
