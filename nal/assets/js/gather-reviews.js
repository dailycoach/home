(() => {
  "use strict";

  const form = document.querySelector("[data-gather-review-form]");
  const list = document.querySelector("[data-gather-review-list]");
  if (!form || !list) return;

  const submitButton = form.querySelector("[type=submit]");
  const status = form.querySelector("[data-gather-review-status]");
  const textarea = form.querySelector("[name=review_body]");
  const counter = form.querySelector("[data-gather-review-count]");
  const nameInput = form.querySelector("[name=display_name]");
  const consent = form.querySelector("[name=publication_consent]");
  const website = form.querySelector("[name=website]");
  const SLUG = "life-control-monthly";
  let backend = null;
  let sending = false;

  function message(value, error = false) {
    status.textContent = value;
    status.dataset.error = String(error);
  }

  function api(path) {
    return backend.url + "/rest/v1/" + path;
  }

  function render(items) {
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "nal-genz__review-empty";
      empty.textContent = "아직 후기가 없습니다.";
      list.append(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const card = document.createElement("article");
      card.className = "nal-genz__review-card";
      const quote = document.createElement("blockquote");
      quote.textContent = String(item.review_body || "");
      const footer = document.createElement("footer");
      const author = document.createElement("span");
      author.textContent = String(item.display_name || "익명");
      const date = document.createElement("time");
      const parsed = new Date(item.created_at);
      if (Number.isFinite(parsed.getTime())) {
        date.dateTime = parsed.toISOString();
        date.textContent = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short" }).format(parsed);
      }
      footer.append(author, date);
      card.append(quote, footer);
      fragment.append(card);
    }
    list.append(fragment);
  }

  async function refresh() {
    const params = new URLSearchParams({
      select: "id,display_name,review_body,created_at",
      gather_slug: "eq." + SLUG,
      order: "created_at.desc",
      limit: "24"
    });
    try {
      const response = await fetch(api("nal_gather_reviews") + "?" + params, {
        headers: { apikey: backend.publishableKey },
        cache: "no-store",
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error("Reviews HTTP " + response.status);
      const items = await response.json();
      if (!Array.isArray(items)) throw new Error("Unexpected review list");
      render(items);
    } catch {
      list.replaceChildren();
      const error = document.createElement("p");
      error.className = "nal-genz__review-error";
      error.textContent = "후기를 불러오지 못했어요. 잠시 후 페이지를 새로고침해 주세요.";
      list.append(error);
    }
  }

  textarea.addEventListener("input", () => {
    counter.textContent = textarea.value.length + " / 800";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending || !backend || !form.reportValidity()) return;
    const review = textarea.value.trim();
    const displayName = nameInput.value.trim() || "익명";
    if (review.length < 20 || review.length > 800) {
      message("후기는 20~800자로 작성해 주세요.", true);
      textarea.focus();
      return;
    }
    if (website.value.trim()) {
      message("후기가 등록되었어요.");
      form.reset();
      counter.textContent = "0 / 800";
      return;
    }
    if (!consent.checked) {
      message("공개 동의 항목을 확인해 주세요.", true);
      return;
    }
    try {
      const last = Number(sessionStorage.getItem("nal:gather:review:last") || 0);
      if (Date.now() - last < 60000) {
        message("잠시 후 다시 작성할 수 있어요.", true);
        return;
      }
    } catch { /* Private mode may disable sessionStorage. */ }

    sending = true;
    submitButton.disabled = true;
    message("후기를 등록하고 있어요…");
    try {
      const response = await fetch(api("nal_gather_reviews"), {
        method: "POST",
        headers: {
          apikey: backend.publishableKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          gather_slug: SLUG,
          display_name: displayName,
          review_body: review,
          publication_consent: true
        }),
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error("Submit HTTP " + response.status);
      try { sessionStorage.setItem("nal:gather:review:last", String(Date.now())); } catch {}
      form.reset();
      counter.textContent = "0 / 800";
      await refresh();
      message("후기가 등록되어 바로 공개되었어요. 고맙습니다!");
    } catch {
      message("등록하지 못했어요. 잠시 후 다시 시도해 주세요.", true);
    } finally {
      sending = false;
      submitButton.disabled = false;
    }
  });

  async function initialize() {
    try {
      const response = await fetch("/nal/data/backend.json", { cache: "no-store", signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error("Backend settings unavailable");
      const config = await response.json();
      backend = globalThis.NALBackend?.validateConfig(config);
      if (!backend) throw new Error("Review backend disabled");
      submitButton.disabled = false;
      message("");
      await refresh();
    } catch {
      submitButton.disabled = true;
      message("현재 후기 접수가 연결되지 않았어요. 잠시 후 다시 방문해 주세요.", true);
      list.replaceChildren();
      const error = document.createElement("p");
      error.className = "nal-genz__review-error";
      error.textContent = "후기 목록을 불러올 수 없어요.";
      list.append(error);
    }
  }

  initialize();
})();
