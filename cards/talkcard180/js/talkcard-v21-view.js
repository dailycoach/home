/**
 * TALK CARD 180 v2.1 — R03 PILOT VIEW
 * Connected decks only: T01 (ice) and I01 (memory).
 */
import { THEME_BY_ID, THEMES } from "../data/themes.js";
import { IMAGE_CARDS, TEXT_CARDS } from "../data/runtime-cards.js";
import { TalkCardPickEngine } from "./talkcard-pick-engine.js?v=2.1.2-image-only";

const PILOT_THEME_IDS = new Set(["ice", "memory"]);
const TABLE_LAYOUT = [
  [-2.8, -2, 7, 3],
  [1.6, 1, -2, 2],
  [-1.1, 0, 3, 4],
  [2.3, 2, 8, 1],
  [-1.9, -1, -1, 2],
  [1.2, 1, 4, 3],
  [-2.1, -2, 9, 2],
  [0.7, 0, 1, 5],
  [2.7, 2, -3, 1],
  [-1.3, -1, 6, 3],
  [2, 1, 2, 2],
  [-2.5, -2, -4, 1],
  [0.9, 0, 7, 4],
  [-1.6, -1, 0, 2],
  [2.2, 2, 5, 3],
];

const state = {
  screen: "opening",
  theme: null,
  engine: null,
  pickTimer: null,
  selecting: false,
};

const screens = [...document.querySelectorAll("[data-screen]")];
const textThemeList = document.querySelector("#text-theme-list");
const imageThemeList = document.querySelector("#image-theme-list");
const introVisual = document.querySelector("#intro-visual");
const introCode = document.querySelector("#intro-code");
const introTitle = document.querySelector("#intro-title");
const introDescription = document.querySelector("#intro-description");
const introCount = document.querySelector("#intro-count");
const introMethod = document.querySelector("#intro-method");
const introNote = document.querySelector("#intro-note");
const tableCode = document.querySelector("#table-code");
const tableTheme = document.querySelector("#table-theme");
const tableProgress = document.querySelector("#table-progress");
const cardTable = document.querySelector("#card-table");
const revealCode = document.querySelector("#reveal-code");
const revealTheme = document.querySelector("#reveal-theme");
const revealProgress = document.querySelector("#reveal-progress");
const revealedCard = document.querySelector("#revealed-card");
const revealedText = document.querySelector("#revealed-text");
const textCardCode = document.querySelector("#text-card-code");
const textQuestion = document.querySelector("#text-question");
const revealedImage = document.querySelector("#revealed-image");
const imageFrame = document.querySelector("#image-frame");
const imageCardArt = document.querySelector("#image-card-art");
const imageFallback = document.querySelector("#image-fallback");
const passCardButton = document.querySelector("#pass-card");
const closingUsed = document.querySelector("#closing-used");
const cardAnnouncement = document.querySelector("#card-announcement");

function pad(value) {
  return String(value).padStart(2, "0");
}

function getCardsForTheme(themeId) {
  const theme = THEME_BY_ID[themeId];
  if (!theme) return [];
  const source = theme.type === "text" ? TEXT_CARDS : IMAGE_CARDS;
  const cards = source.filter((card) => card.theme === themeId);

  // Image-question copy stays only in the preserved v2.0 source data. The
  // v2.1 session receives no prompt or follow-up fields, so its reveal can
  // remain a genuinely image-only free-association experience.
  if (theme.type === "image") {
    return cards.map(({ id, type, theme: cardTheme, image, alt }) => ({
      id,
      type,
      theme: cardTheme,
      image,
      alt,
    }));
  }

  return cards;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createClosedDeckPreview(theme) {
  const preview = makeElement("div", `deck-preview deck-preview--closed deck-preview--${theme.type}`);
  preview.setAttribute("aria-hidden", "true");

  for (let index = 0; index < 3; index += 1) {
    const card = makeElement("span", "closed-preview-card");
    const label = makeElement("i", "closed-preview-label", index === 2 ? theme.code : "TALK CARD");
    card.append(label);
    preview.append(card);
  }
  return preview;
}

function createThemeCard(theme) {
  const button = makeElement("button", `theme-card theme-card--${theme.type} theme-card--pilot`);
  button.type = "button";
  button.dataset.action = "select-theme";
  button.dataset.themeId = theme.id;
  button.setAttribute("aria-label", `${theme.label}, ${theme.type === "text" ? "질문 덱" : "이미지 덱"}, 15장`);

  const top = makeElement("div", "theme-card-top");
  top.append(
    makeElement("span", "", theme.code),
    makeElement("span", "theme-card-type", theme.type === "text" ? "QUESTION DECK" : "IMAGE DECK"),
  );

  const title = makeElement("h4", "", theme.label);
  const description = makeElement("p", "theme-card-description", theme.description);
  const footer = makeElement("div", "theme-card-footer");
  footer.append(makeElement("span", "", "15 CARDS"), makeElement("b", "", "→"));
  footer.lastElementChild.setAttribute("aria-hidden", "true");

  button.append(top, createClosedDeckPreview(theme), title, description, footer);
  return button;
}

function renderThemeSelection() {
  textThemeList.replaceChildren();
  imageThemeList.replaceChildren();

  THEMES.filter((theme) => PILOT_THEME_IDS.has(theme.id)).forEach((theme) => {
    const card = createThemeCard(theme);
    (theme.type === "text" ? textThemeList : imageThemeList).append(card);
  });
}

function createIntroBack(theme, index) {
  const card = makeElement("article", `intro-back-card intro-back-card--${theme.type}`);
  const top = makeElement("span", "intro-back-top", `${theme.code} · ${pad(index + 1)}`);
  const center = makeElement("strong", "intro-back-mark", "TC");
  const bottom = makeElement(
    "span",
    "intro-back-bottom",
    theme.type === "text" ? "QUESTION DECK" : "IMAGE DECK",
  );
  card.append(top, center, bottom);
  return card;
}

function renderIntroVisual(theme) {
  introVisual.replaceChildren();
  [0, 1, 2].forEach((index) => introVisual.append(createIntroBack(theme, index)));
}

function selectTheme(themeId) {
  const theme = THEME_BY_ID[themeId];
  if (!theme || !PILOT_THEME_IDS.has(themeId)) return;
  const cards = getCardsForTheme(themeId);
  if (cards.length !== 15) {
    announce("이 덱의 카드 수를 확인할 수 없습니다.");
    return;
  }

  cancelPendingPick();
  state.theme = theme;
  state.engine = null;
  introCode.textContent = `${theme.code} · ${theme.type === "text" ? "QUESTION DECK" : "IMAGE DECK"}`;
  introTitle.textContent = theme.label;
  introDescription.textContent = theme.description;
  introCount.textContent = `${theme.cardCount} CARDS`;
  introMethod.textContent = theme.method;
  introNote.textContent =
    theme.type === "text"
      ? "15장의 뒷면을 펼쳐놓습니다. 한 장을 직접 고른 뒤 질문으로 대화를 시작하세요."
      : "15장의 뒷면을 펼쳐놓습니다. 한 장을 고르면 이미지 한 장만 펼쳐집니다. 떠오르는 대로 이야기하세요.";
  renderIntroVisual(theme);
  showScreen("intro");
}

function showScreen(name, { focus = true } = {}) {
  state.screen = name;
  screens.forEach((screen) => {
    screen.hidden = screen.dataset.screen !== name;
  });
  window.scrollTo({ top: 0, behavior: "auto" });

  if (!focus) return;
  requestAnimationFrame(() => {
    const activeScreen = document.querySelector(`[data-screen="${name}"]`);
    const heading = activeScreen?.querySelector("h1, h2, h3");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    } else {
      document.querySelector("#app")?.focus({ preventScroll: true });
    }
  });
}

function createEngine(theme) {
  return new TalkCardPickEngine({
    cards: getCardsForTheme(theme.id),
    themeId: theme.id,
    cardType: theme.type,
  });
}

function unfoldDeck() {
  if (!state.theme) return;
  state.engine = createEngine(state.theme);
  let snapshot = state.engine.start({ resume: true });

  if (snapshot.selectedCard) {
    if (!snapshot.revealed) snapshot = state.engine.revealSelected();
    renderReveal(snapshot, { animate: false });
    showScreen("reveal");
    announce("고르던 카드로 돌아왔습니다.");
    return;
  }

  if (snapshot.progress.complete) {
    renderClosing(snapshot);
    showScreen("closing");
    return;
  }

  renderTable(snapshot);
  showScreen("table");
  announce(`${state.theme.label} 카드 15장을 펼쳤습니다. 한 장을 골라보세요.`);
}

function createCardBack(cardId, slotIndex) {
  const theme = state.theme;
  const button = makeElement("button", `table-card table-card--${theme.type}`);
  const [rotation, x, y, z] = TABLE_LAYOUT[slotIndex];
  button.type = "button";
  button.dataset.action = "pick-card";
  button.dataset.cardId = cardId;
  button.style.setProperty("--card-rotate", `${rotation}deg`);
  button.style.setProperty("--card-x", `${x}px`);
  button.style.setProperty("--card-y", `${y}px`);
  button.style.setProperty("--card-z", String(z));
  button.setAttribute("aria-label", `${theme.label} 카드 ${slotIndex + 1}번, 아직 열지 않음`);

  const inner = makeElement("span", "table-card-inner");
  const top = makeElement("span", "table-card-topline");
  top.append(makeElement("span", "", "TALK CARD 180"), makeElement("span", "", theme.code));
  const motif = makeElement("span", "table-card-motif");
  motif.setAttribute("aria-hidden", "true");
  const bottom = makeElement(
    "span",
    "table-card-bottomline",
    theme.type === "text" ? "QUESTION DECK" : "IMAGE DECK",
  );
  const number = makeElement("span", "table-card-number", pad(slotIndex + 1));
  inner.append(top, motif, bottom, number);
  button.append(inner);
  return button;
}

function renderTable(snapshot = state.engine?.snapshot()) {
  if (!snapshot || !state.theme) return;
  tableCode.textContent = state.theme.code;
  tableTheme.textContent = state.theme.label;
  tableProgress.textContent = `${pad(snapshot.progress.used)} / ${pad(snapshot.progress.total)}`;
  tableProgress.setAttribute(
    "aria-label",
    `${snapshot.progress.total}장 중 ${snapshot.progress.used}장 사용함`,
  );
  cardTable.setAttribute(
    "aria-label",
    `${state.theme.label}, 남은 카드 ${snapshot.progress.remaining}장. Tab으로 이동하고 Enter 또는 Space로 고르세요.`,
  );
  cardTable.classList.remove("is-selecting");
  cardTable.replaceChildren();

  snapshot.pool.forEach((cardId, slotIndex) => {
    const slot = makeElement("div", "table-slot");
    slot.dataset.slot = String(slotIndex + 1);
    if (snapshot.used.includes(cardId)) {
      slot.classList.add("table-slot--used");
      slot.setAttribute("aria-hidden", "true");
    } else {
      slot.append(createCardBack(cardId, slotIndex));
    }
    cardTable.append(slot);
  });
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function preloadSelectedImage(card) {
  if (card?.type !== "image" || !card.image) return;
  const image = new Image();
  image.decoding = "async";
  image.src = card.image;
}

function pickCard(trigger) {
  if (!state.engine || state.selecting) return;
  const cardId = trigger.dataset.cardId;
  let snapshot;
  try {
    snapshot = state.engine.pick(cardId);
  } catch {
    announce("이 카드는 지금 고를 수 없습니다.");
    return;
  }

  state.selecting = true;
  cardTable.classList.add("is-selecting");
  trigger.classList.add("is-picking");
  trigger.setAttribute("aria-disabled", "true");
  preloadSelectedImage(snapshot.selectedCard);
  announce(`${state.theme.label} 카드 ${snapshot.pool.indexOf(cardId) + 1}번을 골랐습니다.`);

  state.pickTimer = window.setTimeout(
    () => {
      state.pickTimer = null;
      state.selecting = false;
      const revealed = state.engine.revealSelected();
      renderReveal(revealed, { animate: true });
      showScreen("reveal");
    },
    prefersReducedMotion() ? 0 : 280,
  );
}

function renderReveal(snapshot = state.engine?.snapshot(), { animate = true } = {}) {
  const card = snapshot?.selectedCard;
  if (!card || !state.theme) return;

  revealCode.textContent = state.theme.code;
  revealTheme.textContent = state.theme.label;
  revealProgress.textContent = `${pad(snapshot.progress.used)} / ${pad(snapshot.progress.total)} 사용`;
  revealProgress.setAttribute(
    "aria-label",
    `${snapshot.progress.total}장 중 ${snapshot.progress.used}장 사용함. 현재 고른 카드는 아직 사용 수에 포함되지 않음`,
  );
  revealedCard.dataset.cardId = card.id;
  revealedCard.dataset.cardType = card.type;
  revealedCard.classList.toggle("revealed-card--image", card.type === "image");
  revealedCard.classList.remove("is-entering");

  if (card.type === "text") {
    revealedText.hidden = false;
    revealedImage.hidden = true;
    passCardButton.hidden = false;
    textCardCode.textContent = `${state.theme.code} · QUESTION`;
    textQuestion.textContent = card.text;
    announce("질문 카드가 열렸습니다.");
  } else {
    revealedText.hidden = true;
    revealedImage.hidden = false;
    passCardButton.hidden = false;
    imageFrame.classList.remove("is-failed");
    imageFallback.hidden = true;
    imageCardArt.style.visibility = "visible";
    imageCardArt.src = card.image;
    imageCardArt.alt = card.alt;
    announce("이미지 카드가 열렸습니다. 이미지에서 자유롭게 떠오르는 이야기를 나눠보세요.");
  }

  if (animate) {
    void revealedCard.offsetWidth;
    revealedCard.classList.add("is-entering");
  }
}

function returnToTable({ passed = false } = {}) {
  if (!state.engine) return;
  cancelPendingPick();
  const snapshot = state.engine.returnToTable({ markUsed: true });

  if (snapshot.progress.complete) {
    renderClosing(snapshot);
    showScreen("closing");
    announce("15장의 카드를 모두 사용했습니다.");
    return;
  }

  renderTable(snapshot);
  showScreen("table");
  announce(
    passed
      ? `PASS. 사용한 카드 ${snapshot.progress.used}장. 다른 카드를 골라보세요.`
      : `카드 테이블로 돌아왔습니다. 사용한 카드 ${snapshot.progress.used}장.`,
  );
}

function finishConversation() {
  cancelPendingPick();
  let snapshot = state.engine?.snapshot() ?? null;
  if (snapshot?.selectedCard) snapshot = state.engine.returnToTable({ markUsed: snapshot.revealed });
  renderClosing(snapshot);
  showScreen("closing");
}

function renderClosing(snapshot = state.engine?.snapshot()) {
  const usedCount = snapshot?.progress.used ?? 0;
  closingUsed.textContent = String(usedCount);
  closingUsed.setAttribute("aria-label", `오늘 사용한 카드 ${usedCount}장`);
}

function restartDeck() {
  if (!state.engine || !state.theme) {
    showThemes();
    return;
  }
  const snapshot = state.engine.restart();
  renderTable(snapshot);
  showScreen("table");
  announce(`${state.theme.label} 덱을 다시 섞었습니다.`);
}

function cancelPendingPick() {
  if (state.pickTimer !== null) {
    window.clearTimeout(state.pickTimer);
    state.pickTimer = null;
  }
  state.selecting = false;

  const snapshot = state.engine?.snapshot();
  if (snapshot?.selectedCard && !snapshot.revealed) {
    state.engine.returnToTable({ markUsed: false });
  }
}

function showThemes() {
  cancelPendingPick();
  const snapshot = state.engine?.snapshot();
  if (snapshot?.selectedCard && snapshot.revealed) state.engine.returnToTable({ markUsed: true });
  state.theme = null;
  state.engine = null;
  showScreen("themes");
}

function goHome() {
  cancelPendingPick();
  const snapshot = state.engine?.snapshot();
  if (snapshot?.selectedCard && snapshot.revealed) state.engine.returnToTable({ markUsed: true });
  state.theme = null;
  state.engine = null;
  showScreen("opening");
}

function announce(message) {
  cardAnnouncement.textContent = "";
  requestAnimationFrame(() => {
    cardAnnouncement.textContent = message;
  });
}

function handleAction(action, trigger) {
  switch (action) {
    case "home":
      goHome();
      break;
    case "show-themes":
      showThemes();
      break;
    case "select-theme":
      selectTheme(trigger.dataset.themeId);
      break;
    case "unfold-deck":
      unfoldDeck();
      break;
    case "pick-card":
      pickCard(trigger);
      break;
    case "return-table":
      returnToTable();
      break;
    case "pass-card":
      returnToTable({ passed: true });
      break;
    case "finish-conversation":
      finishConversation();
      break;
    case "restart-deck":
      restartDeck();
      break;
    default:
      break;
  }
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  handleAction(trigger.dataset.action, trigger);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (state.selecting) {
    event.preventDefault();
    cancelPendingPick();
    renderTable();
    announce("카드 선택을 취소했습니다.");
    return;
  }
  if (state.screen === "reveal") {
    event.preventDefault();
    returnToTable();
  }
});

imageCardArt.addEventListener("load", () => {
  imageFrame.classList.remove("is-failed");
  imageFallback.hidden = true;
  imageCardArt.style.visibility = "visible";
});

imageCardArt.addEventListener("error", () => {
  imageFrame.classList.add("is-failed");
  imageFallback.hidden = false;
  imageCardArt.style.visibility = "hidden";
});

function init() {
  renderThemeSelection();
}

init();
