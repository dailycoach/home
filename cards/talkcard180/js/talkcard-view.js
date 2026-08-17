/**
 * TALK CARD 180 v2.0 — VIEW CONTROLLER
 * A05 screen experience connected to the A06 theme-local deck engine.
 */
import { THEMES, THEME_BY_ID } from "../data/themes.js";
import { IMAGE_CARDS, TEXT_CARDS } from "../data/runtime-cards.js";
import { TalkCardDeckEngine } from "./talkcard-engine.js";

const state = {
  screen: "opening",
  theme: null,
  engine: null,
  revealLevels: new Map(),
};

const preloadedImages = new Map();

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
const playCode = document.querySelector("#play-code");
const playTitle = document.querySelector("#play-title");
const playProgress = document.querySelector("#play-progress");
const playCard = document.querySelector("#play-card");
const textCardView = document.querySelector("#text-card-view");
const textQuestion = document.querySelector("#text-question");
const imageCardView = document.querySelector("#image-card-view");
const imageFrame = document.querySelector("#image-frame");
const imageCardArt = document.querySelector("#image-card-art");
const imageFallback = document.querySelector("#image-fallback");
const imageQuestionPanel = document.querySelector("#image-question-panel");
const imagePrompt = document.querySelector("#image-prompt");
const followupPanel = document.querySelector("#followup-panel");
const imageFollowup = document.querySelector("#image-followup");
const previousCardButton = document.querySelector("#previous-card");
const revealCardButton = document.querySelector("#reveal-card");
const nextCardLabel = document.querySelector("#next-card-label");
const cardAnnouncement = document.querySelector("#card-announcement");

function padCardNumber(value) {
  return String(value).padStart(2, "0");
}

function getCardsForTheme(themeId) {
  const theme = THEME_BY_ID[themeId];
  if (!theme) return [];
  return (theme.type === "text" ? TEXT_CARDS : IMAGE_CARDS).filter((card) => card.theme === themeId);
}

function getThumbnailPath(card) {
  return `assets/images/${card.theme}/thumbs/${card.id}.webp`;
}

function preloadUpcomingImages(cards) {
  cards.filter((card) => card?.type === "image").forEach((card) => {
    if (preloadedImages.has(card.image)) return;
    const image = new Image();
    image.decoding = "async";
    image.src = card.image;
    preloadedImages.set(card.image, image);
  });
}

function createTextDeckPreview(className = "deck-preview deck-preview--text") {
  const preview = document.createElement("div");
  preview.className = className;
  preview.setAttribute("aria-hidden", "true");
  preview.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
  return preview;
}

function createImageDeckPreview(cards, className = "deck-preview deck-preview--image") {
  const preview = document.createElement("div");
  preview.className = className;
  preview.setAttribute("aria-hidden", "true");

  cards.slice(0, 3).forEach((card) => {
    const image = document.createElement("img");
    image.className = "image-thumb";
    image.src = getThumbnailPath(card);
    image.alt = "";
    image.width = 360;
    image.height = 450;
    image.loading = "lazy";
    image.decoding = "async";
    preview.append(image);
  });

  return preview;
}

function createThemeCard(theme) {
  const cards = getCardsForTheme(theme.id);
  const button = document.createElement("button");
  button.className = `theme-card theme-card--${theme.type}`;
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
  type.textContent = theme.type === "text" ? "QUESTION DECK" : "IMAGE DECK";
  top.append(code, type);

  const preview =
    theme.type === "text" ? createTextDeckPreview() : createImageDeckPreview([cards[0], cards[5], cards[10]].filter(Boolean));

  const title = document.createElement("h4");
  title.textContent = theme.label;
  const description = document.createElement("p");
  description.className = "theme-card-description";
  description.textContent = theme.description;

  const footer = document.createElement("div");
  footer.className = "theme-card-footer";
  const count = document.createElement("span");
  count.textContent = "15 CARDS";
  const arrow = document.createElement("b");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";
  footer.append(count, arrow);

  button.append(top, preview, title, description, footer);
  return button;
}

function renderThemeSelection() {
  textThemeList.replaceChildren();
  imageThemeList.replaceChildren();

  THEMES.forEach((theme) => {
    const card = createThemeCard(theme);
    (theme.type === "text" ? textThemeList : imageThemeList).append(card);
  });
}

function renderIntroVisual(theme, cards) {
  introVisual.replaceChildren();

  if (theme.type === "image") {
    [cards[0], cards[5], cards[10]].filter(Boolean).forEach((card) => {
      const image = document.createElement("img");
      image.src = getThumbnailPath(card);
      image.alt = "";
      image.width = 360;
      image.height = 450;
      image.loading = "lazy";
      image.decoding = "async";
      introVisual.append(image);
    });
    return;
  }

  [cards[0], cards[6], cards[12]].filter(Boolean).forEach((card, index) => {
    const visualCard = document.createElement("article");
    visualCard.className = "intro-card";
    const label = document.createElement("span");
    label.textContent = `${theme.code} · ${padCardNumber(index + 1)}`;
    const question = document.createElement("p");
    question.textContent = card.text;
    visualCard.append(label, question);
    introVisual.append(visualCard);
  });
}

function selectTheme(themeId) {
  const theme = THEME_BY_ID[themeId];
  if (!theme) return;

  const cards = getCardsForTheme(themeId);
  if (cards.length !== 15) {
    announce("이 덱의 카드 데이터를 확인하고 있습니다. 잠시 후 다시 시도해주세요.");
    return;
  }

  state.theme = theme;
  state.engine = null;

  introCode.textContent = `${theme.code} · ${theme.type === "text" ? "QUESTION DECK" : "IMAGE DECK"}`;
  introTitle.textContent = theme.label;
  introDescription.textContent = theme.description;
  introCount.textContent = `${theme.cardCount} CARDS`;
  introMethod.textContent = theme.method;
  introNote.textContent =
    theme.type === "text"
      ? "한 장씩 질문을 읽고 번갈아 이야기해보세요. 답하고 싶지 않은 질문은 부담 없이 넘길 수 있습니다."
      : "이미지를 먼저 충분히 바라본 뒤 질문을 열어보세요. 그림의 뜻을 맞히기보다 각자 떠오르는 이야기를 나눕니다.";

  renderIntroVisual(theme, cards);
  showScreen("intro");
}

function showScreen(name) {
  state.screen = name;
  screens.forEach((screen) => {
    screen.hidden = screen.dataset.screen !== name;
  });

  window.scrollTo({ top: 0, behavior: "auto" });
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

function startDeck() {
  if (!state.theme) return;

  state.engine = new TalkCardDeckEngine({
    cards: getCardsForTheme(state.theme.id),
    themeId: state.theme.id,
    cardType: state.theme.type,
  });
  state.engine.start({ resume: true });
  state.revealLevels.clear();
  renderPlayCard();
  showScreen("play");
}

function animateCardChange() {
  playCard.classList.remove("is-changing");
  void playCard.offsetWidth;
  playCard.classList.add("is-changing");
}

function renderPlayCard() {
  const snapshot = state.engine?.snapshot();
  const card = snapshot?.card;
  const progress = snapshot?.progress;
  if (!card || !progress || !state.theme) return;

  const isExtra = progress.mode === "extra";
  const revealLevel = state.revealLevels.get(card.id) ?? 0;

  playCard.dataset.cardId = card.id;
  playCard.dataset.cardType = card.type;
  playCode.textContent = state.theme.code;
  playTitle.textContent = state.theme.label;
  playProgress.textContent = isExtra
    ? "한 장 더"
    : `${padCardNumber(progress.position)} / ${padCardNumber(progress.total)}`;
  previousCardButton.disabled = progress.isFirst || isExtra;
  nextCardLabel.textContent = !isExtra && progress.isLast ? "대화 마치기" : "다음";
  animateCardChange();

  if (card.type === "text") {
    textCardView.hidden = false;
    imageCardView.hidden = true;
    revealCardButton.hidden = true;
    textQuestion.textContent = card.text;
  } else {
    textCardView.hidden = true;
    imageCardView.hidden = false;
    revealCardButton.hidden = false;

    imageFrame.classList.remove("is-failed");
    imageFallback.hidden = true;
    imageCardArt.style.visibility = "visible";
    imageCardArt.src = card.image;
    imageCardArt.alt = card.alt;
    imagePrompt.textContent = card.prompt;
    imageFollowup.textContent = card.followup;
    preloadUpcomingImages(state.engine.peekNext(2));
    renderImageReveal(revealLevel);
  }

  const typeName = card.type === "text" ? "질문" : "이미지";
  const positionLabel = isExtra ? "추가" : `${progress.position}번째`;
  announce(`${state.theme.label} ${typeName} ${positionLabel} 카드`);
}

function renderImageReveal(level) {
  imageQuestionPanel.hidden = level < 1;
  followupPanel.hidden = level < 2;

  if (level === 0) {
    revealCardButton.hidden = false;
    revealCardButton.disabled = false;
    revealCardButton.textContent = "질문 보기";
  } else if (level === 1) {
    revealCardButton.hidden = false;
    revealCardButton.disabled = false;
    revealCardButton.textContent = "한 걸음 더";
  } else {
    revealCardButton.hidden = true;
  }
}

function revealImageQuestion() {
  const card = state.engine?.currentCard;
  if (!card || card.type !== "image") return;

  const nextLevel = Math.min((state.revealLevels.get(card.id) ?? 0) + 1, 2);
  state.revealLevels.set(card.id, nextLevel);
  renderImageReveal(nextLevel);

  const target = nextLevel === 1 ? imagePrompt : imageFollowup;
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  announce(nextLevel === 1 ? "질문이 공개되었습니다." : "이어지는 질문이 공개되었습니다.");
}

function previousCard() {
  if (!state.engine || state.engine.progress.isFirst || state.engine.progress.mode === "extra") return;
  state.engine.previous();
  renderPlayCard();
  focusPlayCard();
}

function nextCard() {
  if (!state.engine) return;
  const result = state.engine.next();
  if (result.reachedClosing) {
    showScreen("closing");
    return;
  }

  renderPlayCard();
  focusPlayCard();
}

function focusPlayCard() {
  playCard.setAttribute("tabindex", "-1");
  playCard.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showOneMoreCard() {
  if (!state.engine) {
    showScreen("themes");
    return;
  }

  const snapshot = state.engine.drawExtra();
  if (snapshot.card) state.revealLevels.delete(snapshot.card.id);
  renderPlayCard();
  showScreen("play");
}

function goHome() {
  state.theme = null;
  state.engine = null;
  state.revealLevels.clear();
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
      showScreen("themes");
      break;
    case "select-theme":
      selectTheme(trigger.dataset.themeId);
      break;
    case "start-deck":
      startDeck();
      break;
    case "previous-card":
      previousCard();
      break;
    case "next-card":
      nextCard();
      break;
    case "reveal-card":
      revealImageQuestion();
      break;
    case "one-more":
      showOneMoreCard();
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
