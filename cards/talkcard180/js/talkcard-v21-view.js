/**
 * TALK CARD 180 v2.1 — R03 PILOT VIEW
 * Pilot allowlist: T01 가볍게 인사 + I01 기억 한 조각.
 */
import { THEME_BY_ID } from "../data/themes.js";
import { IMAGE_CARDS, TEXT_CARDS } from "../data/runtime-cards.js";
import {
  TALKCARD_PICK_SESSION_KEY,
  TalkCardPickEngine,
} from "./talkcard-pick-engine.js";

const PILOT_THEME_IDS = Object.freeze(["ice", "memory"]);
const SLOT_LAYOUT = Object.freeze([
  { rotate: -3.2, x: 3, y: 5, z: 2 },
  { rotate: 1.8, x: -2, y: -2, z: 4 },
  { rotate: -1.1, x: 2, y: 7, z: 3 },
  { rotate: 2.7, x: -4, y: 1, z: 5 },
  { rotate: -2.1, x: 2, y: 4, z: 2 },
  { rotate: 1.2, x: -3, y: -4, z: 5 },
  { rotate: -2.6, x: 4, y: 3, z: 3 },
  { rotate: 0.7, x: -1, y: -1, z: 6 },
  { rotate: 2.3, x: -3, y: 5, z: 4 },
  { rotate: -1.7, x: 3, y: 0, z: 2 },
  { rotate: 2.9, x: -2, y: 3, z: 4 },
  { rotate: -0.9, x: 3, y: -3, z: 5 },
  { rotate: 1.5, x: -4, y: 4, z: 3 },
  { rotate: -2.4, x: 2, y: 0, z: 4 },
  { rotate: 0.9, x: -1, y: 6, z: 2 },
]);

const state = {
  screen: "opening",
  theme: null,
  engine: null,
  picking: false,
  pickTimer: null,
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
const tableAnnouncement = document.querySelector("#table-announcement");
const revealCode = document.querySelector("#reveal-code");
const revealTheme = document.querySelector("#reveal-theme");
const revealProgress = document.querySelector("#reveal-progress");
const conversationCard = document.querySelector("#conversation-card");
const textRevealContent = document.querySelector("#text-reveal-content");
const textRevealKicker = document.querySelector("#text-reveal-kicker");
const textQuestion = document.querySelector("#text-question");
const imageRevealContent = document.querySelector("#image-reveal-content");
const pickedImageFrame = document.querySelector("#picked-image-frame");
const pickedImage = document.querySelector("#picked-image");
const pickedImageFallback = document.querySelector("#picked-image-fallback");
const optionalPrompt = document.querySelector("#optional-prompt");
const imagePrompt = document.querySelector("#image-prompt");
const followupPanel = document.querySelector("#followup-panel");
const imageFollowup = document.querySelector("#image-followup");
const openPromptButton = document.querySelector("#open-prompt");
const passCardButton = document.querySelector("#pass-card");
const revealAnnouncement = document.querySelector("#reveal-announcement");
const closingMark = document.querySelector("#closing-mark");
const closingUsed = document.querySelector("#closing-used");

function padCardNumber(value) {
  return String(value).padStart(2, "0");
}

function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function getCardsForTheme(themeId) {
  const theme = THEME_BY_ID[themeId];
  if (!theme || !PILOT_THEME_IDS.includes(themeId)) return [];
  return (theme.type === "text" ? TEXT_CARDS : IMAGE_CARDS).filter((card) => card.theme === themeId);
}

function createEngine(theme) {
  return new TalkCardPickEngine({
    cards: getCardsForTheme(theme.id),
    themeId: theme.id,
    cardType: theme.type,
  });
}

function deckTypeLabel(theme) {
  return theme.type === "text" ? "QUESTION DECK" : "IMAGE DECK";
}

function createMiniBackStack(theme, className = "pilot-back-stack") {
  const stack = document.createElement("div");
  stack.className = `${className} ${className}--${theme.type}`;
  stack.setAttribute("aria-hidden", "true");

  for (let index = 0; index < 3; index += 1) {
    const card = document.createElement("span");
    card.className = "mini-card-back";
    const code = document.createElement("i");
    code.textContent = theme.code;
    const mark = document.createElement("b");
    mark.textContent = "180";
    const type = document.createElement("small");
    type.textContent = deckTypeLabel(theme);
    card.append(code, mark, type);
    stack.append(card);
  }

  return stack;
}

function createThemeCard(theme) {
  const button = document.createElement("button");
  button.className = `theme-card theme-card--${theme.type} theme-card--pilot`;
  button.type = "button";
  button.dataset.action = "select-theme";
  button.dataset.themeId = theme.id;
  button.setAttribute("aria-label", `${theme.label}, ${theme.type === "text" ? "질문 덱" : "이미지 덱"}, 15장`);

  const top = document.createElement("div");
  top.className = "theme-card-top";
  const code = document.createElement("span");
  code.textContent = theme.code;
  const type = document.createElement("span");
  type.className = "theme-card-type";
  type.textContent = deckTypeLabel(theme);
  top.append(code, type);

  const title = document.createElement("h4");
  title.textContent = theme.label;
  const description = document.createElement("p");
  description.className = "theme-card-description";
  description.textContent = theme.description;

  const footer = document.createElement("div");
  footer.className = "theme-card-footer";
  const count = document.createElement("span");
  count.textContent = "15 CARDS";
  const action = document.createElement("b");
  action.textContent = "펼쳐보기 →";
  footer.append(count, action);

  button.append(top, createMiniBackStack(theme), title, description, footer);
  return button;
}

function renderPilotThemes() {
  textThemeList.replaceChildren();
  imageThemeList.replaceChildren();

  PILOT_THEME_IDS.forEach((themeId) => {
    const theme = THEME_BY_ID[themeId];
    if (!theme) return;
    (theme.type === "text" ? textThemeList : imageThemeList).append(createThemeCard(theme));
  });
}

function renderIntroBacks(theme) {
  introVisual.replaceChildren();
  const stack = createMiniBackStack(theme, "intro-back-stack");
  introVisual.append(stack);
}

function selectTheme(themeId) {
  const theme = THEME_BY_ID[themeId];
  if (!theme || !PILOT_THEME_IDS.includes(themeId)) return;
  if (getCardsForTheme(themeId).length !== 15) {
    announce(tableAnnouncement, "이 덱의 카드 데이터를 확인하고 있습니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  clearPickTransition();
  state.theme = theme;
  state.engine = null;

  introCode.textContent = `${theme.code} · ${deckTypeLabel(theme)}`;
  introTitle.textContent = theme.label;
  introDescription.textContent = theme.description;
  introCount.textContent = "15 CARDS";
  introMethod.textContent = theme.method;
  introNote.textContent = theme.type === "text"
    ? "질문은 아직 보이지 않습니다. 카드를 펼친 뒤 마음이 가는 한 장을 직접 골라보세요."
    : "이미지는 아직 보이지 않습니다. 카드를 고른 뒤 천천히 바라보고, 원할 때만 질문을 여세요.";

  renderIntroBacks(theme);
  showScreen("intro");
}

function updateIdentity(snapshot) {
  const theme = state.theme;
  if (!theme) return;
  const codeLabel = `${theme.code} · ${deckTypeLabel(theme)}`;
  const progressText = `${padCardNumber(snapshot.progress.used)} / ${padCardNumber(snapshot.progress.total)}`;
  const progressLabel = `${snapshot.progress.total}장 중 ${snapshot.progress.used}장 사용`;

  tableCode.textContent = codeLabel;
  tableTheme.textContent = theme.label;
  tableProgress.textContent = progressText;
  tableProgress.setAttribute("aria-label", progressLabel);
  revealCode.textContent = `${theme.code} · ${theme.type === "text" ? "QUESTION" : "IMAGE"}`;
  revealTheme.textContent = theme.label;
  revealProgress.textContent = progressText;
  revealProgress.setAttribute("aria-label", progressLabel);
}

function createCardBack(slot, theme) {
  const button = document.createElement("button");
  button.className = `table-card table-card--${theme.type}`;
  button.type = "button";
  button.dataset.action = "pick-card";
  button.dataset.cardId = slot.cardId;
  button.setAttribute("aria-label", `${theme.label} 카드 ${slot.position}번, 아직 열지 않음`);

  const top = document.createElement("span");
  top.className = "table-card-topline";
  top.innerHTML = `<i>${theme.code}</i><i>${padCardNumber(slot.position)}</i>`;

  const mark = document.createElement("span");
  mark.className = "table-card-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML = "<b>TC</b><i>180</i>";

  const bottom = document.createElement("span");
  bottom.className = "table-card-bottomline";
  bottom.textContent = deckTypeLabel(theme);

  button.append(top, mark, bottom);
  return button;
}

function createUsedSlot(slot, theme) {
  const used = document.createElement("div");
  used.className = "used-card-slot";
  used.setAttribute("role", "img");
  used.setAttribute("aria-label", `${theme.label} 카드 ${slot.position}번, 이미 사용함`);

  const label = document.createElement("span");
  label.textContent = "USED";
  const number = document.createElement("small");
  number.textContent = padCardNumber(slot.position);
  used.append(label, number);
  return used;
}

function renderTable(snapshot = state.engine?.snapshot()) {
  if (!snapshot || !state.theme) return;
  updateIdentity(snapshot);
  cardTable.replaceChildren();
  cardTable.classList.remove("is-choosing");
  cardTable.setAttribute("aria-label", `${state.theme.label} 카드 15장, ${snapshot.progress.used}장 사용`);

  snapshot.table.forEach((slot, index) => {
    const layout = SLOT_LAYOUT[index];
    const wrapper = document.createElement("div");
    wrapper.className = `table-slot${slot.used ? " is-used" : ""}`;
    wrapper.setAttribute("role", "listitem");
    wrapper.style.setProperty("--slot-rotation", `${layout.rotate}deg`);
    wrapper.style.setProperty("--slot-x", `${layout.x}px`);
    wrapper.style.setProperty("--slot-y", `${layout.y}px`);
    wrapper.style.setProperty("--slot-z", String(layout.z));
    wrapper.append(slot.used ? createUsedSlot(slot, state.theme) : createCardBack(slot, state.theme));
    cardTable.append(wrapper);
  });
}

function activateRevealAnimation({ restored = false } = {}) {
  conversationCard.classList.remove("is-revealed");
  if (restored || prefersReducedMotion()) {
    conversationCard.classList.add("is-revealed");
    focusConversationCard();
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      conversationCard.classList.add("is-revealed");
      globalThis.setTimeout(focusConversationCard, 440);
    });
  });
}

function renderPromptLevel(level) {
  optionalPrompt.hidden = level < 1;
  followupPanel.hidden = level < 2;
  openPromptButton.hidden = false;

  if (level === 0) {
    openPromptButton.textContent = "질문 열기";
  } else if (level === 1) {
    openPromptButton.textContent = "한 걸음 더";
  } else {
    openPromptButton.hidden = true;
  }
}

function renderReveal(snapshot, { restored = false } = {}) {
  const card = snapshot?.card;
  if (!card || !state.theme) return;

  updateIdentity(snapshot);
  conversationCard.dataset.cardId = card.id;
  conversationCard.dataset.cardType = card.type;
  conversationCard.classList.toggle("conversation-card--image", card.type === "image");
  conversationCard.setAttribute("aria-label", `${state.theme.label} ${card.type === "text" ? "질문" : "이미지"} 카드`);

  if (card.type === "text") {
    textRevealContent.hidden = false;
    imageRevealContent.hidden = true;
    openPromptButton.hidden = true;
    passCardButton.hidden = false;
    textRevealKicker.textContent = `${state.theme.code} · QUESTION`;
    textQuestion.textContent = card.text;
  } else {
    textRevealContent.hidden = true;
    imageRevealContent.hidden = false;
    passCardButton.hidden = false;
    pickedImageFrame.classList.remove("is-failed");
    pickedImageFallback.hidden = true;
    pickedImage.style.visibility = "visible";
    pickedImage.src = card.image;
    pickedImage.alt = card.alt;
    imagePrompt.textContent = card.prompt;
    imageFollowup.textContent = card.followup;
    renderPromptLevel(snapshot.promptLevel);
  }

  activateRevealAnimation({ restored });
}

function focusConversationCard() {
  if (state.screen !== "reveal") return;
  conversationCard.setAttribute("tabindex", "-1");
  conversationCard.focus({ preventScroll: true });
}

function spreadCards() {
  if (!state.theme) return;
  state.engine = createEngine(state.theme);
  const snapshot = state.engine.startTheme({ resume: true });
  routeSessionSnapshot(snapshot);
}

function pickCard(trigger) {
  if (!state.engine || state.picking || trigger.disabled) return;

  let snapshot;
  try {
    snapshot = state.engine.selectCard(trigger.dataset.cardId);
  } catch (error) {
    announce(tableAnnouncement, error.message);
    return;
  }

  state.picking = true;
  cardTable.classList.add("is-choosing");
  cardTable.querySelectorAll(".table-card").forEach((button) => {
    button.disabled = true;
  });
  trigger.closest(".table-slot")?.classList.add("is-picked-slot");
  trigger.classList.add("is-picked");
  trigger.setAttribute("aria-pressed", "true");
  const position = snapshot.table.find((slot) => slot.cardId === snapshot.selectedCard)?.position;
  announce(tableAnnouncement, `${position}번 카드를 선택했습니다. 카드를 엽니다.`);

  const delay = prefersReducedMotion() ? 0 : 360;
  state.pickTimer = globalThis.setTimeout(() => {
    state.pickTimer = null;
    if (!state.engine?.selectedCard) {
      state.picking = false;
      return;
    }
    const revealed = state.engine.revealSelected();
    state.picking = false;
    renderReveal(revealed);
    showScreen("reveal", { focus: false });
  }, delay);
}

function openImagePrompt() {
  if (!state.engine || state.theme?.type !== "image") return;

  let snapshot;
  try {
    snapshot = state.engine.openPrompt();
  } catch (error) {
    announce(revealAnnouncement, error.message);
    return;
  }

  renderPromptLevel(snapshot.promptLevel);
  const target = snapshot.promptLevel === 1 ? imagePrompt : imageFollowup;
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  announce(revealAnnouncement, snapshot.promptLevel === 1 ? "질문이 공개되었습니다." : "한 걸음 더 질문이 공개되었습니다.");
}

function returnToTable() {
  if (!state.engine) return;
  clearPickTransition();
  const snapshot = state.engine.returnToTable();

  if (snapshot.progress.complete) {
    renderClosing(snapshot);
    showScreen("closing");
    return;
  }

  renderTable(snapshot);
  showScreen("table");
  announce(tableAnnouncement, `${snapshot.progress.used}장을 사용했습니다. 다음 카드를 직접 골라보세요.`);
}

function finishConversation() {
  if (!state.engine) {
    showThemes();
    return;
  }
  clearPickTransition();
  renderClosing(state.engine.snapshot());
  showScreen("closing");
}

function renderClosing(snapshot) {
  const used = snapshot?.progress.used ?? 0;
  closingMark.textContent = padCardNumber(used);
  closingUsed.textContent = `${used} CARD${used === 1 ? "" : "S"} PICKED`;
}

function restartDeck() {
  if (!state.engine || !state.theme) {
    showThemes();
    return;
  }
  const snapshot = state.engine.restart();
  renderTable(snapshot);
  showScreen("table");
  announce(tableAnnouncement, "같은 덱 15장을 다시 섞었습니다. 마음이 가는 카드를 골라보세요.");
}

function clearPickTransition() {
  if (state.pickTimer !== null) {
    globalThis.clearTimeout(state.pickTimer);
    state.pickTimer = null;
  }
  state.picking = false;
}

function showThemes() {
  clearPickTransition();
  state.engine?.clear();
  state.engine = null;
  state.theme = null;
  renderPilotThemes();
  showScreen("themes");
}

function goHome() {
  clearPickTransition();
  state.engine?.clear();
  state.engine = null;
  state.theme = null;
  showScreen("opening");
}

function routeSessionSnapshot(snapshot, { restored = false } = {}) {
  if (!snapshot || !state.engine || !state.theme) return;

  if (snapshot.selectedCard) {
    const revealed = snapshot.revealed ? snapshot : state.engine.revealSelected();
    renderReveal(revealed, { restored });
    showScreen("reveal", { focus: false });
    return;
  }
  if (snapshot.progress.complete) {
    renderClosing(snapshot);
    showScreen("closing");
    return;
  }

  renderTable(snapshot);
  showScreen("table");
}

function restorePilotSession() {
  let candidate;
  try {
    const raw = globalThis.sessionStorage?.getItem(TALKCARD_PICK_SESSION_KEY);
    if (!raw) return false;
    candidate = JSON.parse(raw);
  } catch {
    return false;
  }

  if (candidate?.mode !== "theme" || !PILOT_THEME_IDS.includes(candidate.themeId)) return false;
  const theme = THEME_BY_ID[candidate.themeId];
  if (!theme) return false;

  try {
    state.theme = theme;
    state.engine = createEngine(theme);
    const snapshot = state.engine.startTheme({ resume: true });
    routeSessionSnapshot(snapshot, { restored: true });
    return true;
  } catch {
    state.theme = null;
    state.engine = null;
    return false;
  }
}

function showScreen(name, { focus = true } = {}) {
  state.screen = name;
  screens.forEach((screen) => {
    screen.hidden = screen.dataset.screen !== name;
  });

  globalThis.scrollTo({ top: 0, behavior: "auto" });
  if (!focus) return;

  requestAnimationFrame(() => {
    const activeScreen = document.querySelector(`[data-screen="${name}"]`);
    const heading = activeScreen?.querySelector("h1, h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    } else {
      document.querySelector("#app")?.focus({ preventScroll: true });
    }
  });
}

function announce(target, message) {
  if (!target) return;
  target.textContent = "";
  requestAnimationFrame(() => {
    target.textContent = message;
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
    case "spread-cards":
      spreadCards();
      break;
    case "pick-card":
      pickCard(trigger);
      break;
    case "open-prompt":
      openImagePrompt();
      break;
    case "return-table":
      returnToTable();
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
  if (event.key !== "Escape" || state.screen !== "reveal") return;
  event.preventDefault();
  returnToTable();
});

pickedImage.addEventListener("load", () => {
  pickedImageFrame.classList.remove("is-failed");
  pickedImageFallback.hidden = true;
  pickedImage.style.visibility = "visible";
});

pickedImage.addEventListener("error", () => {
  pickedImageFrame.classList.add("is-failed");
  pickedImageFallback.hidden = false;
  pickedImage.style.visibility = "hidden";
});

function init() {
  renderPilotThemes();
  restorePilotSession();
}

init();
