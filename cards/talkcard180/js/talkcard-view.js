/**
 * TALK CARD 180 v2.0 — A05 VIEW CONTROLLER
 *
 * This run intentionally presents cards in their source order so the five-screen
 * experience can be reviewed safely. Theme shuffle, no-repeat guarantees and
 * session persistence belong to A06 DECK ENGINE.
 */
import { THEMES, THEME_BY_ID } from "../data/themes.js";
import { TEXT_CARDS } from "../data/cards.js";

const IMAGE_MANIFEST_URL = "data/image-card-manifest.json";

const state = {
  screen: "opening",
  theme: null,
  deck: [],
  index: 0,
  imageCards: [],
  revealLevels: new Map(),
  extraCursor: 0,
  isExtra: false,
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
  return (theme.type === "text" ? TEXT_CARDS : state.imageCards).filter((card) => card.theme === themeId);
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
    image.src = card.image;
    image.alt = "";
    image.width = 1122;
    image.height = 1402;
    image.loading = "lazy";
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
      image.src = card.image;
      image.alt = "";
      image.width = 1122;
      image.height = 1402;
      image.loading = "lazy";
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
  state.deck = [];
  state.index = 0;
  state.isExtra = false;

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

  // A05 review order only. A06 will inject the shuffled, no-repeat deck here.
  state.deck = getCardsForTheme(state.theme.id).slice();
  state.index = 0;
  state.isExtra = false;
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
  const card = state.deck[state.index];
  if (!card || !state.theme) return;

  const position = state.index + 1;
  const revealLevel = state.revealLevels.get(card.id) ?? 0;

  playCode.textContent = state.theme.code;
  playTitle.textContent = state.theme.label;
  playProgress.textContent = state.isExtra ? "한 장 더" : `${padCardNumber(position)} / ${padCardNumber(state.deck.length)}`;
  previousCardButton.disabled = state.index === 0 || state.isExtra;
  nextCardLabel.textContent = !state.isExtra && position === state.deck.length ? "대화 마치기" : "다음";
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
    renderImageReveal(revealLevel);
  }

  const typeName = card.type === "text" ? "질문" : "이미지";
  announce(`${state.theme.label} ${typeName} 카드 ${position}번째`);
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
  const card = state.deck[state.index];
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
  if (state.index <= 0 || state.isExtra) return;
  state.index -= 1;
  renderPlayCard();
  focusPlayCard();
}

function nextCard() {
  if (!state.deck.length) return;

  if (!state.isExtra && state.index >= state.deck.length - 1) {
    showScreen("closing");
    return;
  }

  if (state.isExtra) {
    showScreen("closing");
    return;
  }

  state.index += 1;
  renderPlayCard();
  focusPlayCard();
}

function focusPlayCard() {
  playCard.setAttribute("tabindex", "-1");
  playCard.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showOneMoreCard() {
  if (!state.deck.length) {
    showScreen("themes");
    return;
  }

  // A05 deterministic preview. A06 will choose this post-completion card.
  state.index = state.extraCursor % state.deck.length;
  state.extraCursor += 1;
  state.isExtra = true;
  renderPlayCard();
  showScreen("play");
}

function goHome() {
  state.theme = null;
  state.deck = [];
  state.index = 0;
  state.isExtra = false;
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

async function loadImageCards() {
  const response = await fetch(IMAGE_MANIFEST_URL);
  if (!response.ok) throw new Error(`Image manifest request failed: ${response.status}`);
  const manifest = await response.json();

  if (!Array.isArray(manifest.cards) || manifest.cards.length !== 60) {
    throw new Error("Image manifest must contain exactly 60 cards.");
  }

  return manifest.cards.map((card) => ({
    id: card.id,
    theme: card.theme,
    type: "image",
    image: card.image,
    alt: card.alt,
    prompt: card.prompt,
    followup: card.followup,
  }));
}

async function init() {
  try {
    state.imageCards = await loadImageCards();
    renderThemeSelection();
  } catch (error) {
    console.error(error);
    renderThemeSelection();
    imageThemeList.replaceChildren();
    const message = document.createElement("p");
    message.className = "intro-note";
    message.textContent = "이미지 카드 정보를 불러오지 못했습니다. 페이지를 새로고침해주세요.";
    message.setAttribute("role", "alert");
    imageThemeList.append(message);
  }
}

init();
