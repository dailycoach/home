/**
 * TALK CARD 180 v2.1 — THEMELESS VIEW
 *
 * QUESTION 120: shuffled once, then revealed one at a time.
 * IMAGE 60: a replenishing 15-card hand, user pick, image-only flip.
 */
import { IMAGE_CARDS, TEXT_CARDS } from "../data/runtime-cards.js";
import {
  ImageHandEngine,
  SequentialQuestionEngine,
  TALKCARD_IMAGE_HAND_SIZE,
} from "./talkcard-pick-engine.js?v=2.1.3-themeless";

const IMAGE_DECK = IMAGE_CARDS.map(({ id, type, theme, image, alt }) => ({
  id,
  type,
  theme,
  image,
  alt,
}));

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
  mode: null,
  engine: null,
  pickTimer: null,
  selecting: false,
};

const screens = [...document.querySelectorAll("[data-screen]")];
const introVisual = document.querySelector("#intro-visual");
const introCode = document.querySelector("#intro-code");
const introTitle = document.querySelector("#intro-title");
const introDescription = document.querySelector("#intro-description");
const introCount = document.querySelector("#intro-count");
const introMethod = document.querySelector("#intro-method");
const introNote = document.querySelector("#intro-note");
const introStartButton = document.querySelector("#intro-start-button");

const questionProgress = document.querySelector("#question-progress");
const questionCard = document.querySelector("#question-card");
const questionNumber = document.querySelector("#question-number");
const questionText = document.querySelector("#question-text");
const nextQuestionButton = document.querySelector("#next-question-button");

const imageTableProgress = document.querySelector("#image-table-progress");
const imageCardTable = document.querySelector("#image-card-table");
const imageRevealProgress = document.querySelector("#image-reveal-progress");
const imageRevealedCard = document.querySelector("#image-revealed-card");
const imageFrame = document.querySelector("#image-frame");
const imageCardArt = document.querySelector("#image-card-art");
const imageFallback = document.querySelector("#image-fallback");

const closingUsed = document.querySelector("#closing-used");
const closingUnit = document.querySelector("#closing-unit");
const cardAnnouncement = document.querySelector("#card-announcement");

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function announce(message) {
  cardAnnouncement.textContent = "";
  requestAnimationFrame(() => {
    cardAnnouncement.textContent = message;
  });
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

function createIntroBack(mode, index) {
  const isQuestions = mode === "questions";
  const card = makeElement(
    "article",
    `intro-back-card intro-back-card--${isQuestions ? "questions" : "image"}`,
  );
  card.append(
    makeElement(
      "span",
      "intro-back-top",
      isQuestions ? `QUESTION · ${pad(index + 1, 3)}` : `IMAGE · ${pad(index + 1, 2)}`,
    ),
    makeElement("strong", "intro-back-mark", isQuestions ? "Q" : "I"),
    makeElement("span", "intro-back-bottom", isQuestions ? "120 QUESTION CARDS" : "60 IMAGE CARDS"),
  );
  return card;
}

function renderIntroVisual(mode) {
  introVisual.replaceChildren();
  [0, 1, 2].forEach((index) => introVisual.append(createIntroBack(mode, index)));
}

function selectMode(mode) {
  if (mode !== "questions" && mode !== "images") return;
  cancelPendingPick();
  state.mode = mode;
  state.engine = null;
  renderIntroVisual(mode);

  if (mode === "questions") {
    introCode.textContent = "QUESTION DECK · 120";
    introTitle.textContent = "대화 질문 120";
    introDescription.textContent = "질문을 한 장씩 보며 대화를 이어갑니다.";
    introCount.textContent = "120 CARDS";
    introMethod.textContent = "ONE BY ONE";
    introNote.textContent = "질문은 한 번에 한 장만 보입니다. PASS하거나 다음 질문으로 바로 넘어갈 수 있습니다.";
    introStartButton.firstChild.textContent = "질문 시작하기 ";
  } else {
    introCode.textContent = "IMAGE DECK · 60";
    introTitle.textContent = "그림 카드 60";
    introDescription.textContent = "15장의 뒷면 중 한 장을 골라 그림을 봅니다.";
    introCount.textContent = "60 CARDS";
    introMethod.textContent = "PICK & FLIP";
    introNote.textContent = "그림에는 질문이 없습니다. 이미지에서 자유롭게 떠오르는 이야기를 나눠보세요.";
    introStartButton.firstChild.textContent = "카드 펼치기 ";
  }

  showScreen("intro");
}

function createEngine(mode) {
  if (mode === "questions") {
    return new SequentialQuestionEngine({ cards: TEXT_CARDS });
  }
  return new ImageHandEngine({ cards: IMAGE_DECK });
}

function startDeck() {
  if (!state.mode) return;
  state.engine = createEngine(state.mode);
  let snapshot = state.engine.start({ resume: true });
  if (snapshot.finished) snapshot = state.engine.restart();

  if (state.mode === "questions") {
    renderQuestion(snapshot, { animate: false });
    showScreen("question");
    announce("첫 번째 대화 질문을 열었습니다.");
    return;
  }

  if (snapshot.selectedCard) {
    if (!snapshot.revealed) snapshot = state.engine.revealSelected();
    renderImage(snapshot, { animate: false });
    showScreen("image");
    announce("고르던 그림 카드로 돌아왔습니다.");
    return;
  }

  renderImageTable(snapshot);
  showScreen("table");
  announce("그림 카드 15장을 펼쳤습니다. 한 장을 골라보세요.");
}

function renderQuestion(snapshot = state.engine?.snapshot(), { animate = true } = {}) {
  const card = snapshot?.currentCard;
  if (!card) return;

  const shown = snapshot.progress.shown;
  questionProgress.textContent = `${pad(shown)} / 120`;
  questionProgress.setAttribute("aria-label", `120개 질문 중 ${shown}번째 질문`);
  questionNumber.textContent = `QUESTION · ${pad(shown, 3)}`;
  questionText.textContent = card.text;
  questionCard.dataset.currentCardId = card.id;
  nextQuestionButton.firstChild.textContent = snapshot.progress.isLast ? "대화 마치기 " : "다음 질문 ";

  questionCard.classList.remove("is-entering");
  if (animate) {
    void questionCard.offsetWidth;
    questionCard.classList.add("is-entering");
  }
}

function advanceQuestion({ passed = false } = {}) {
  if (!(state.engine instanceof SequentialQuestionEngine)) return;
  const snapshot = state.engine.advance();

  if (snapshot.finished) {
    renderClosing(snapshot);
    showScreen("closing");
    announce("120개의 대화 질문을 모두 보았습니다.");
    return;
  }

  renderQuestion(snapshot);
  showScreen("question");
  announce(
    passed
      ? `PASS. ${snapshot.progress.shown}번째 질문으로 넘어갔습니다.`
      : `${snapshot.progress.shown}번째 질문을 열었습니다.`,
  );
}

function createImageCardBack(cardId, slotIndex) {
  const button = makeElement("button", "table-card table-card--image");
  const [rotation, x, y, z] = TABLE_LAYOUT[slotIndex];
  button.type = "button";
  button.dataset.action = "pick-image";
  button.dataset.cardId = cardId;
  button.style.setProperty("--card-rotate", `${rotation}deg`);
  button.style.setProperty("--card-x", `${x}px`);
  button.style.setProperty("--card-y", `${y}px`);
  button.style.setProperty("--card-z", String(z));
  button.setAttribute("aria-label", `그림 카드 ${slotIndex + 1}번, 아직 열지 않음`);

  const inner = makeElement("span", "table-card-inner");
  const top = makeElement("span", "table-card-topline");
  top.append(makeElement("span", "", "TALK CARD 180"), makeElement("span", "", "IMAGE 60"));
  const motif = makeElement("span", "table-card-motif");
  motif.setAttribute("aria-hidden", "true");
  const bottom = makeElement("span", "table-card-bottomline", "PICK & FLIP");
  const number = makeElement("span", "table-card-number", pad(slotIndex + 1));
  inner.append(top, motif, bottom, number);
  button.append(inner);
  return button;
}

function renderImageTable(snapshot = state.engine?.snapshot()) {
  if (!snapshot) return;

  imageTableProgress.textContent = `사용 ${pad(snapshot.progress.used)} / 60`;
  imageTableProgress.setAttribute(
    "aria-label",
    `그림 카드 60장 중 ${snapshot.progress.used}장 사용함`,
  );
  imageCardTable.setAttribute(
    "aria-label",
    `그림 카드 ${snapshot.progress.inHand}장. Tab으로 이동하고 Enter 또는 Space로 고르세요.`,
  );
  imageCardTable.classList.remove("is-selecting");
  imageCardTable.replaceChildren();

  snapshot.hand.forEach((cardId, slotIndex) => {
    const slot = makeElement("div", "table-slot");
    slot.dataset.slot = String(slotIndex + 1);
    if (cardId) {
      slot.append(createImageCardBack(cardId, slotIndex));
    } else {
      slot.classList.add("table-slot--empty");
      slot.setAttribute("aria-hidden", "true");
    }
    imageCardTable.append(slot);
  });
}

function preloadSelectedImage(card) {
  if (!card?.image) return;
  const image = new Image();
  image.decoding = "async";
  image.src = card.image;
}

function pickImage(trigger) {
  if (!(state.engine instanceof ImageHandEngine) || state.selecting) return;
  let snapshot;
  try {
    snapshot = state.engine.pick(trigger.dataset.cardId);
  } catch {
    announce("이 카드는 지금 고를 수 없습니다.");
    return;
  }

  state.selecting = true;
  imageCardTable.classList.add("is-selecting");
  trigger.classList.add("is-picking");
  trigger.setAttribute("aria-disabled", "true");
  preloadSelectedImage(snapshot.selectedCard);
  announce(`그림 카드 ${snapshot.selectedSlot + 1}번을 골랐습니다.`);

  state.pickTimer = window.setTimeout(
    () => {
      state.pickTimer = null;
      state.selecting = false;
      const revealed = state.engine.revealSelected();
      renderImage(revealed, { animate: true });
      showScreen("image");
    },
    prefersReducedMotion() ? 0 : 280,
  );
}

function renderImage(snapshot = state.engine?.snapshot(), { animate = true } = {}) {
  const card = snapshot?.selectedCard;
  if (!card) return;

  imageRevealProgress.textContent = `사용 ${pad(snapshot.progress.used)} / 60`;
  imageRevealProgress.setAttribute(
    "aria-label",
    `그림 카드 60장 중 ${snapshot.progress.used}장 사용함. 현재 이미지는 아직 사용 수에 포함되지 않음`,
  );
  imageRevealedCard.dataset.cardId = card.id;
  imageFrame.classList.remove("is-failed");
  imageFallback.hidden = true;
  imageCardArt.style.visibility = "visible";
  imageCardArt.src = card.image;
  imageCardArt.alt = card.alt;

  imageRevealedCard.classList.remove("is-entering");
  if (animate) {
    void imageRevealedCard.offsetWidth;
    imageRevealedCard.classList.add("is-entering");
  }

  announce("그림 카드가 열렸습니다. 이미지에서 자유롭게 떠오르는 이야기를 나눠보세요.");
}

function returnImageTable({ passed = false } = {}) {
  if (!(state.engine instanceof ImageHandEngine)) return;
  cancelPendingPick();
  const snapshot = state.engine.returnToTable({ markUsed: true });

  if (snapshot.finished) {
    renderClosing(snapshot);
    showScreen("closing");
    announce("그림 카드 60장을 모두 사용했습니다.");
    return;
  }

  imageCardArt.removeAttribute("src");
  imageCardArt.alt = "";
  renderImageTable(snapshot);
  showScreen("table");
  announce(
    passed
      ? `PASS. 사용한 그림 카드 ${snapshot.progress.used}장. 다른 카드를 골라보세요.`
      : `카드 테이블로 돌아왔습니다. 사용한 그림 카드 ${snapshot.progress.used}장.`,
  );
}

function finishConversation() {
  if (!state.engine || !state.mode) return;
  cancelPendingPick();
  let snapshot = state.engine.snapshot();

  if (state.mode === "images" && snapshot.selectedCard) {
    snapshot = state.engine.returnToTable({ markUsed: snapshot.revealed });
  }
  snapshot = state.engine.finish();
  renderClosing(snapshot);
  showScreen("closing");
}

function renderClosing(snapshot = state.engine?.snapshot()) {
  const isQuestions = snapshot?.mode === "questions";
  const count = isQuestions ? snapshot?.progress.shown ?? 0 : snapshot?.progress.used ?? 0;
  closingUsed.textContent = String(count);
  closingUsed.setAttribute(
    "aria-label",
    isQuestions ? `오늘 본 질문 ${count}개` : `오늘 본 그림 카드 ${count}장`,
  );
  closingUnit.textContent = isQuestions ? "QUESTIONS SEEN" : "IMAGES SEEN";
}

function restartDeck() {
  if (!state.engine || !state.mode) {
    showDecks();
    return;
  }

  const snapshot = state.engine.restart();
  if (state.mode === "questions") {
    renderQuestion(snapshot, { animate: false });
    showScreen("question");
    announce("대화 질문 120개를 다시 섞었습니다.");
  } else {
    renderImageTable(snapshot);
    showScreen("table");
    announce("그림 카드 60장을 다시 섞었습니다.");
  }
}

function cancelPendingPick() {
  if (state.pickTimer !== null) {
    window.clearTimeout(state.pickTimer);
    state.pickTimer = null;
  }
  state.selecting = false;

  if (state.engine instanceof ImageHandEngine) {
    const snapshot = state.engine.snapshot();
    if (snapshot.selectedCard && !snapshot.revealed) {
      state.engine.returnToTable({ markUsed: false });
    }
  }
}

function showDecks() {
  cancelPendingPick();
  if (state.engine instanceof ImageHandEngine) {
    const snapshot = state.engine.snapshot();
    if (snapshot.selectedCard && snapshot.revealed) {
      state.engine.returnToTable({ markUsed: true });
    }
  }
  imageCardArt.removeAttribute("src");
  imageCardArt.alt = "";
  state.mode = null;
  state.engine = null;
  showScreen("decks");
}

function goHome() {
  showDecks();
  showScreen("opening");
}

function handleAction(action, trigger) {
  switch (action) {
    case "home":
      goHome();
      break;
    case "show-decks":
      showDecks();
      break;
    case "select-mode":
      selectMode(trigger.dataset.mode);
      break;
    case "start-deck":
      startDeck();
      break;
    case "next-question":
      advanceQuestion();
      break;
    case "pass-question":
      advanceQuestion({ passed: true });
      break;
    case "pick-image":
      pickImage(trigger);
      break;
    case "return-image-table":
      returnImageTable();
      break;
    case "pass-image":
      returnImageTable({ passed: true });
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
    renderImageTable();
    announce("카드 선택을 취소했습니다.");
    return;
  }

  if (state.screen === "image") {
    event.preventDefault();
    returnImageTable();
  } else if (state.screen === "question") {
    event.preventDefault();
    showDecks();
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

if (TEXT_CARDS.length !== 120 || IMAGE_DECK.length !== 60 || TALKCARD_IMAGE_HAND_SIZE !== 15) {
  announce("카드 데이터를 확인할 수 없습니다.");
} else {
  showScreen("opening", { focus: false });
}
