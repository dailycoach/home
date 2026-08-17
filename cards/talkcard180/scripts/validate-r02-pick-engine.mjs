import assert from "node:assert/strict";
import { IMAGE_CARDS, TEXT_CARDS } from "../data/runtime-cards.js";
import {
  ImageHandEngine,
  SequentialQuestionEngine,
  TALKCARD_DECK_SESSION_VERSION,
  TALKCARD_IMAGE_HAND_SIZE,
  TALKCARD_IMAGE_SESSION_KEY,
  TALKCARD_IMAGE_TOTAL,
  TALKCARD_QUESTION_SESSION_KEY,
  TALKCARD_QUESTION_TOTAL,
} from "../js/talkcard-pick-engine.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const results = [];

function test(name, callback) {
  callback();
  results.push({ name, status: "PASS" });
}

function sequenceRandom() {
  const values = [0.13, 0.71, 0.37, 0.92, 0.04, 0.58, 0.26, 0.83, 0.45];
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

const questionCards = TEXT_CARDS.slice();
const imageCards = IMAGE_CARDS.map(({ id, type, theme, image, alt }) => ({
  id,
  type,
  theme,
  image,
  alt,
}));

assert.equal(questionCards.length, TALKCARD_QUESTION_TOTAL);
assert.equal(imageCards.length, TALKCARD_IMAGE_TOTAL);

test("creates one shuffled 120-question sequence without user-facing theme state", () => {
  const engine = new SequentialQuestionEngine({
    cards: questionCards,
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  const snapshot = engine.start({ resume: false });

  assert.equal(snapshot.pool.length, 120);
  assert.equal(new Set(snapshot.pool).size, 120);
  assert.equal(snapshot.used.length, 1);
  assert.equal(snapshot.currentCardId, snapshot.pool[0]);
  assert.equal(snapshot.progress.shown, 1);
  assert.equal(snapshot.progress.total, 120);
  assert.equal(Object.hasOwn(snapshot, "themeId"), false);
});

test("reveals questions one at a time in the fixed shuffled sequence", () => {
  const engine = new SequentialQuestionEngine({
    cards: questionCards,
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  const start = engine.start({ resume: false });
  const second = engine.advance();
  const third = engine.advance();

  assert.equal(second.currentCardId, start.pool[1]);
  assert.equal(third.currentCardId, start.pool[2]);
  assert.deepEqual(third.used, start.pool.slice(0, 3));
  assert.equal(third.progress.shown, 3);
});

test("shows all 120 questions without duplicates before completing", () => {
  const engine = new SequentialQuestionEngine({
    cards: questionCards,
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  let snapshot = engine.start({ resume: false });

  for (let index = 1; index < TALKCARD_QUESTION_TOTAL; index += 1) {
    snapshot = engine.advance();
  }

  assert.equal(snapshot.used.length, 120);
  assert.equal(new Set(snapshot.used).size, 120);
  assert.equal(snapshot.progress.isLast, true);
  assert.equal(snapshot.finished, false);

  snapshot = engine.advance();
  assert.equal(snapshot.finished, true);
  assert.equal(snapshot.progress.complete, true);
});

test("restores the current question and shuffled order", () => {
  const storage = new MemoryStorage();
  const first = new SequentialQuestionEngine({
    cards: questionCards,
    storage,
    random: sequenceRandom(),
  });
  first.start({ resume: false });
  first.advance();
  const before = first.advance();

  const restored = new SequentialQuestionEngine({
    cards: questionCards,
    storage,
    random: () => 0.99,
  }).start({ resume: true });

  assert.deepEqual(restored.pool, before.pool);
  assert.deepEqual(restored.used, before.used);
  assert.equal(restored.currentCardId, before.currentCardId);
});

test("restarts the 120-question deck with clean progress and a new order", () => {
  const engine = new SequentialQuestionEngine({
    cards: questionCards,
    storage: new MemoryStorage(),
    random: () => 0.999,
  });
  const initial = engine.start({ resume: false });
  engine.advance();
  const restarted = engine.restart();

  assert.equal(restarted.used.length, 1);
  assert.equal(restarted.progress.shown, 1);
  assert.equal(restarted.cycle, 2);
  assert.notDeepEqual(restarted.pool, initial.pool);
});

test("creates one 15-card image hand from the 60-image pool", () => {
  const engine = new ImageHandEngine({
    cards: imageCards,
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  const snapshot = engine.start({ resume: false });

  assert.equal(snapshot.pool.length, 60);
  assert.equal(new Set(snapshot.pool).size, 60);
  assert.equal(snapshot.hand.length, TALKCARD_IMAGE_HAND_SIZE);
  assert.equal(snapshot.hand.filter(Boolean).length, 15);
  assert.deepEqual(snapshot.hand, snapshot.pool.slice(0, 15));
  assert.equal(snapshot.progress.undealt, 45);
  assert.equal(Object.hasOwn(snapshot, "themeId"), false);
});

test("lets the user pick and reveal any image without automatic selection", () => {
  const engine = new ImageHandEngine({
    cards: imageCards,
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  const start = engine.start({ resume: false });
  const chosenId = start.hand[9];
  const picked = engine.pick(chosenId);

  assert.equal(picked.selectedCardId, chosenId);
  assert.equal(picked.selectedSlot, 9);
  assert.equal(picked.revealed, false);
  assert.equal(picked.progress.used, 0);

  const revealed = engine.revealSelected();
  assert.equal(revealed.selectedCardId, chosenId);
  assert.equal(revealed.revealed, true);
  assert.equal(Object.hasOwn(revealed, "promptLevel"), false);
  assert.equal(Object.hasOwn(revealed.selectedCard, "prompt"), false);
  assert.equal(Object.hasOwn(revealed.selectedCard, "followup"), false);
});

test("uses the selected image once and replenishes the same slot", () => {
  const engine = new ImageHandEngine({
    cards: imageCards,
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  const start = engine.start({ resume: false });
  const slot = 4;
  const chosenId = start.hand[slot];
  const replacementId = start.pool[15];

  engine.pick(chosenId);
  engine.revealSelected();
  const returned = engine.returnToTable();

  assert.deepEqual(returned.used, [chosenId]);
  assert.equal(returned.hand[slot], replacementId);
  assert.equal(returned.hand.includes(chosenId), false);
  assert.equal(returned.progress.used, 1);
  assert.equal(returned.progress.undealt, 44);
});

test("keeps all non-selected image slots fixed after replenishment", () => {
  const engine = new ImageHandEngine({
    cards: imageCards,
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  const start = engine.start({ resume: false });
  const slot = 7;
  engine.pick(start.hand[slot]);
  engine.revealSelected();
  const returned = engine.returnToTable();

  start.hand.forEach((id, index) => {
    if (index !== slot) assert.equal(returned.hand[index], id);
  });
});

test("prevents a used image from being picked twice", () => {
  const engine = new ImageHandEngine({
    cards: imageCards,
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  const chosenId = engine.start({ resume: false }).hand[0];
  engine.pick(chosenId);
  engine.revealSelected();
  engine.returnToTable();

  assert.throws(() => engine.pick(chosenId), /unused card/);
});

test("restores image hand, draw position, selected image, and reveal state", () => {
  const storage = new MemoryStorage();
  const first = new ImageHandEngine({
    cards: imageCards,
    storage,
    random: sequenceRandom(),
  });
  const initial = first.start({ resume: false });
  first.pick(initial.hand[2]);
  first.revealSelected();
  first.returnToTable();
  const next = first.snapshot();
  first.pick(next.hand[11]);
  first.revealSelected();
  const before = first.snapshot();

  const restored = new ImageHandEngine({
    cards: imageCards,
    storage,
    random: () => 0.99,
  }).start({ resume: true });

  assert.deepEqual(restored.pool, before.pool);
  assert.deepEqual(restored.hand, before.hand);
  assert.deepEqual(restored.used, before.used);
  assert.equal(restored.selectedCardId, before.selectedCardId);
  assert.equal(restored.selectedSlot, before.selectedSlot);
  assert.equal(restored.revealed, true);
});

test("consumes all 60 images without duplicate use", () => {
  const engine = new ImageHandEngine({
    cards: imageCards,
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  let snapshot = engine.start({ resume: false });

  while (!snapshot.finished) {
    const id = snapshot.hand.find(Boolean);
    assert.ok(id);
    engine.pick(id);
    engine.revealSelected();
    snapshot = engine.returnToTable();
  }

  assert.equal(snapshot.used.length, 60);
  assert.equal(new Set(snapshot.used).size, 60);
  assert.equal(snapshot.hand.filter(Boolean).length, 0);
  assert.equal(snapshot.progress.complete, true);
});

test("rejects legacy theme and prompt sessions", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    TALKCARD_IMAGE_SESSION_KEY,
    JSON.stringify({
      version: TALKCARD_DECK_SESSION_VERSION,
      mode: "theme",
      themeId: "memory",
      pool: imageCards.map((card) => card.id),
      hand: imageCards.slice(0, 15).map((card) => card.id),
      used: [],
      selectedCard: null,
      selectedSlot: null,
      revealed: false,
      promptLevel: 1,
      finished: false,
      drawIndex: 15,
      cycle: 1,
      startedAt: 1,
      updatedAt: 1,
    }),
  );

  const clean = new ImageHandEngine({
    cards: imageCards,
    storage,
    random: sequenceRandom(),
  }).start({ resume: true });

  assert.equal(clean.used.length, 0);
  assert.equal(clean.hand.length, 15);
  assert.equal(clean.finished, false);
});

test("stores no question text, image prompt, follow-up, or theme selection", () => {
  const storage = new MemoryStorage();
  const questions = new SequentialQuestionEngine({
    cards: questionCards,
    storage,
    random: sequenceRandom(),
  });
  const images = new ImageHandEngine({
    cards: imageCards,
    storage,
    random: sequenceRandom(),
  });
  questions.start({ resume: false });
  images.start({ resume: false });
  images.pick(images.snapshot().hand[0]);
  images.revealSelected();

  const questionRaw = storage.getItem(TALKCARD_QUESTION_SESSION_KEY);
  const imageRaw = storage.getItem(TALKCARD_IMAGE_SESSION_KEY);
  for (const raw of [questionRaw, imageRaw]) {
    assert.equal(raw.includes("prompt"), false);
    assert.equal(raw.includes("followup"), false);
    assert.equal(raw.includes("themeId"), false);
  }
  assert.equal(questionRaw.includes(questionCards[0].text), false);
});

console.log(
  JSON.stringify(
    {
      suite: "THEMELESS TALK CARD 180 ENGINES",
      status: "PASS",
      passed: results.length,
      failed: 0,
      counts: {
        questions: questionCards.length,
        images: imageCards.length,
        imageHand: TALKCARD_IMAGE_HAND_SIZE,
      },
      tests: results,
    },
    null,
    2,
  ),
);

