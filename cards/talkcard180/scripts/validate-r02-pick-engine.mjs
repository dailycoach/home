import assert from "node:assert/strict";
import { IMAGE_CARDS, TEXT_CARDS } from "../data/runtime-cards.js";
import {
  TALKCARD_PICK_DECK_SIZE,
  TALKCARD_PICK_SESSION_KEY,
  TalkCardPickEngine,
  shuffleForTable,
} from "../js/talkcard-pick-engine.js";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1_664_525 * value + 1_013_904_223) >>> 0;
    return value / 4_294_967_296;
  };
}

function tickingClock(start = 1_000) {
  let value = start;
  return () => {
    value += 1;
    return value;
  };
}

const textCards = TEXT_CARDS.filter((card) => card.theme === "ice");
const imageCards = IMAGE_CARDS.filter((card) => card.theme === "memory");
assert.equal(textCards.length, TALKCARD_PICK_DECK_SIZE);
assert.equal(imageCards.length, TALKCARD_PICK_DECK_SIZE);

const textStorage = createStorage();
const textEngine = new TalkCardPickEngine({
  cards: textCards,
  themeId: "ice",
  cardType: "text",
  storage: textStorage,
  random: seededRandom(21),
  now: tickingClock(),
});

assert.throws(() => textEngine.selectCard("ice_1"), /Start the theme hand/);

const initial = textEngine.startTheme({ resume: false });
assert.equal(initial.mode, "theme");
assert.equal(initial.themeId, "ice");
assert.equal(initial.cardType, "text");
assert.equal(initial.pool.length, 0);
assert.equal(initial.hand.length, 15);
assert.equal(new Set(initial.hand).size, 15);
assert.equal(initial.table.length, 15);
assert.equal(initial.availableCardIds.length, 15);
assert.deepEqual(initial.progress, { used: 0, total: 15, remaining: 15, complete: false });
assert.equal(initial.selectedCard, null);
assert.equal(initial.card, null);
assert.ok(initial.table.every((slot) => slot.selectable && !slot.used));
assert.ok(initial.table.every((slot) => !Object.hasOwn(slot, "text")), "Card backs must not expose question text");

const initialPositions = new Map(initial.table.map((slot) => [slot.cardId, slot.position]));
const selectedTextId = initial.hand[4];
const pickedText = textEngine.selectCard(selectedTextId);
assert.equal(pickedText.selectedCard, selectedTextId);
assert.equal(pickedText.card.id, selectedTextId);
assert.equal(pickedText.used.length, 1);
assert.equal(pickedText.progress.used, 1);
assert.equal(pickedText.revealed, false);
assert.equal(pickedText.promptLevel, 0);
assert.equal(pickedText.table.find((slot) => slot.cardId === selectedTextId).used, true);
assert.ok(pickedText.table.every((slot) => !slot.selectable), "No second card can be picked while one is selected");
assert.throws(() => textEngine.selectCard(initial.hand[5]), /Return the selected card/);

const revealedText = textEngine.revealSelected();
assert.equal(revealedText.revealed, true);
assert.throws(() => textEngine.openPrompt(), /Only image cards/);

const returnedText = textEngine.returnToTable();
assert.equal(returnedText.selectedCard, null);
assert.equal(returnedText.card, null);
assert.equal(returnedText.revealed, false);
assert.equal(returnedText.progress.used, 1);
assert.equal(returnedText.table.find((slot) => slot.cardId === selectedTextId).selectable, false);
assert.ok(returnedText.table.filter((slot) => !slot.used).every((slot) => slot.selectable));
assert.ok(returnedText.table.every((slot) => initialPositions.get(slot.cardId) === slot.position), "Table positions must stay stable");
assert.throws(() => textEngine.selectCard(selectedTextId), /used card cannot be selected again/i);

const persistedText = JSON.parse(textStorage.getItem(TALKCARD_PICK_SESSION_KEY));
assert.deepEqual(Object.keys(persistedText).sort(), [
  "cardType",
  "cycle",
  "hand",
  "mode",
  "pool",
  "promptLevel",
  "revealed",
  "selectedCard",
  "startedAt",
  "themeId",
  "updatedAt",
  "used",
  "version",
].sort());
const serializedText = JSON.stringify(persistedText);
assert.ok(!serializedText.includes(textCards[0].text), "Session data must not store card content or user answers");

const restoredTextEngine = new TalkCardPickEngine({
  cards: textCards,
  themeId: "ice",
  cardType: "text",
  storage: textStorage,
  random: seededRandom(999),
  now: tickingClock(2_000),
});
const restoredText = restoredTextEngine.startTheme({ resume: true });
assert.deepEqual(restoredText.hand, initial.hand, "Session restore must keep shuffle order");
assert.deepEqual(restoredText.used, [selectedTextId]);
assert.ok(restoredText.table.every((slot) => initialPositions.get(slot.cardId) === slot.position));

while (!restoredTextEngine.progress.complete) {
  const nextId = restoredTextEngine.availableCardIds[0];
  const picked = restoredTextEngine.selectCard(nextId);
  assert.equal(picked.selectedCard, nextId);
  restoredTextEngine.revealSelected();
  const backAtTable = restoredTextEngine.returnToTable();
  assert.equal(backAtTable.selectedCard, null, "Returning must never auto-select the next card");
}

const completeText = restoredTextEngine.snapshot();
assert.equal(completeText.used.length, 15);
assert.equal(new Set(completeText.used).size, 15);
assert.equal(completeText.availableCardIds.length, 0);
assert.equal(completeText.progress.complete, true);
assert.equal(completeText.card, null);

const previousOrder = completeText.hand;
const restartedText = restoredTextEngine.restart();
assert.equal(restartedText.used.length, 0);
assert.equal(restartedText.selectedCard, null);
assert.equal(restartedText.cycle, 2);
assert.notDeepEqual(restartedText.hand, previousOrder, "Restart must produce a visibly new table order");

const imageStorage = createStorage();
const imageEngine = new TalkCardPickEngine({
  cards: imageCards,
  themeId: "memory",
  cardType: "image",
  storage: imageStorage,
  random: seededRandom(210),
  now: tickingClock(3_000),
});
const initialImage = imageEngine.startTheme({ resume: false });
const initialImagePositions = new Map(initialImage.table.map((slot) => [slot.cardId, slot.position]));
const selectedImageId = initialImage.hand[7];
const pickedImage = imageEngine.selectCard(selectedImageId);
assert.equal(pickedImage.revealed, false);
assert.equal(pickedImage.promptLevel, 0);
assert.equal(pickedImage.card.id, selectedImageId);
assert.throws(() => imageEngine.openPrompt(), /Reveal the selected image/);

const imageOnly = imageEngine.revealSelected();
assert.equal(imageOnly.revealed, true);
assert.equal(imageOnly.promptLevel, 0, "Image reveal must not open the question automatically");
const mainPrompt = imageEngine.openPrompt();
assert.equal(mainPrompt.promptLevel, 1, "First optional action reveals only the main prompt");
const followup = imageEngine.openPrompt();
assert.equal(followup.promptLevel, 2, "Second optional action reveals the follow-up");
assert.equal(imageEngine.openPrompt().promptLevel, 2, "Prompt level must remain capped at two");

const persistedImage = imageStorage.getItem(TALKCARD_PICK_SESSION_KEY);
assert.ok(!persistedImage.includes(pickedImage.card.prompt));
assert.ok(!persistedImage.includes(pickedImage.card.followup));
assert.ok(!persistedImage.includes(pickedImage.card.alt));
assert.ok(!persistedImage.includes(pickedImage.card.image));

const restoredImageEngine = new TalkCardPickEngine({
  cards: imageCards,
  themeId: "memory",
  cardType: "image",
  storage: imageStorage,
  random: seededRandom(8),
  now: tickingClock(4_000),
});
const restoredImage = restoredImageEngine.startTheme({ resume: true });
assert.deepEqual(restoredImage.hand, initialImage.hand);
assert.equal(restoredImage.selectedCard, selectedImageId);
assert.equal(restoredImage.revealed, true);
assert.equal(restoredImage.promptLevel, 2);

const returnedImage = restoredImageEngine.returnToTable();
assert.equal(returnedImage.selectedCard, null);
assert.equal(returnedImage.promptLevel, 0);
assert.equal(returnedImage.used.length, 1);
assert.ok(returnedImage.table.every((slot) => slot.position === initialImagePositions.get(slot.cardId)));

const corruptStorage = createStorage();
corruptStorage.setItem(TALKCARD_PICK_SESSION_KEY, JSON.stringify({
  ...persistedText,
  answer: "sensitive user response",
}));
const recoveredEngine = new TalkCardPickEngine({
  cards: textCards,
  themeId: "ice",
  cardType: "text",
  storage: corruptStorage,
  random: seededRandom(45),
  now: tickingClock(5_000),
});
const recovered = recoveredEngine.startTheme({ resume: true });
assert.equal(recovered.used.length, 0, "Unknown session fields must invalidate restore");
assert.equal(JSON.parse(corruptStorage.getItem(TALKCARD_PICK_SESSION_KEY)).answer, undefined);

assert.throws(() => shuffleForTable(textCards, { random: () => 1 }), /random source/);
assert.throws(() => new TalkCardPickEngine({
  cards: textCards.slice(0, 14),
  themeId: "ice",
  cardType: "text",
}), /exactly 15/);

console.log(JSON.stringify({
  run: "R02 PICK ENGINE",
  status: "PASS",
  checks: {
    directPick: "PASS",
    contentHiddenBeforePick: "PASS",
    noAutomaticNext: "PASS",
    noDuplicatePick: "PASS",
    usedProgress: "15 / 15 PASS",
    stableTablePositions: "PASS",
    imageFirst: "PASS",
    optionalMainPrompt: "PASS",
    optionalFollowup: "PASS",
    sessionRestore: "PASS",
    sessionAllowlist: "PASS",
    sensitiveContentExcluded: "PASS",
    restart: "PASS",
  },
}, null, 2));
