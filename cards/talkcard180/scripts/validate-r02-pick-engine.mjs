import assert from "node:assert/strict";
import { IMAGE_CARDS, TEXT_CARDS } from "../data/runtime-cards.js";
import {
  TALKCARD_PICK_SESSION_KEY,
  TalkCardPickEngine,
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

const textCards = TEXT_CARDS.filter((card) => card.theme === "ice");
const imageCards = IMAGE_CARDS.filter((card) => card.theme === "memory").map(
  ({ id, type, theme, image, alt }) => ({ id, type, theme, image, alt }),
);

assert.equal(textCards.length, 15, "T01 source must stay at 15 cards");
assert.equal(imageCards.length, 15, "I01 source must stay at 15 cards");

test("creates one stable 15-card hand without preselecting content", () => {
  const engine = new TalkCardPickEngine({
    cards: textCards,
    themeId: "ice",
    cardType: "text",
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  const snapshot = engine.start({ resume: false });

  assert.equal(snapshot.pool.length, 15);
  assert.equal(new Set(snapshot.pool).size, 15);
  assert.deepEqual(snapshot.hand, snapshot.pool);
  assert.deepEqual(snapshot.used, []);
  assert.equal(snapshot.selectedCard, null);
  assert.equal(snapshot.revealed, false);
  assert.deepEqual(snapshot.progress, { used: 0, total: 15, remaining: 15, complete: false });
});

test("lets the user choose any hand card and never advances automatically", () => {
  const engine = new TalkCardPickEngine({
    cards: textCards,
    themeId: "ice",
    cardType: "text",
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  const start = engine.start({ resume: false });
  const chosenId = start.hand[9];

  const picked = engine.pick(chosenId);
  assert.equal(picked.selectedCardId, chosenId);
  assert.equal(picked.revealed, false);

  const revealed = engine.revealSelected();
  assert.equal(revealed.selectedCardId, chosenId);
  assert.equal(revealed.revealed, true);

  const returned = engine.returnToTable({ markUsed: true });
  assert.equal(returned.selectedCard, null);
  assert.equal(returned.used[0], chosenId);
  assert.equal(returned.hand.includes(chosenId), false);
  assert.equal(returned.progress.used, 1);
});

test("keeps the remaining table order fixed after a used card is removed", () => {
  const engine = new TalkCardPickEngine({
    cards: textCards,
    themeId: "ice",
    cardType: "text",
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  const start = engine.start({ resume: false });
  const chosenId = start.hand[4];
  const expected = start.hand.filter((id) => id !== chosenId);

  engine.pick(chosenId);
  engine.revealSelected();
  const returned = engine.returnToTable();
  assert.deepEqual(returned.hand, expected);
  assert.deepEqual(returned.pool, start.pool);
});

test("prevents a used card from being picked twice", () => {
  const engine = new TalkCardPickEngine({
    cards: textCards,
    themeId: "ice",
    cardType: "text",
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  const chosenId = engine.start({ resume: false }).hand[0];
  engine.pick(chosenId);
  engine.revealSelected();
  engine.returnToTable();

  assert.throws(() => engine.pick(chosenId), /unused card/);
});

test("restores shuffled order, used state, selected image, and reveal state", () => {
  const storage = new MemoryStorage();
  const first = new TalkCardPickEngine({
    cards: imageCards,
    themeId: "memory",
    cardType: "image",
    storage,
    random: sequenceRandom(),
  });
  const initial = first.start({ resume: false });
  const usedId = initial.hand[2];
  first.pick(usedId);
  first.revealSelected();
  first.returnToTable();
  const selectedId = first.snapshot().hand[7];
  first.pick(selectedId);
  first.revealSelected();
  const beforeReload = first.snapshot();

  const restoredEngine = new TalkCardPickEngine({
    cards: imageCards,
    themeId: "memory",
    cardType: "image",
    storage,
    random: () => 0.99,
  });
  const restored = restoredEngine.start({ resume: true });

  assert.deepEqual(restored.pool, beforeReload.pool);
  assert.deepEqual(restored.hand, beforeReload.hand);
  assert.deepEqual(restored.used, beforeReload.used);
  assert.equal(restored.selectedCardId, selectedId);
  assert.equal(restored.revealed, true);
  assert.equal(Object.hasOwn(restored, "promptLevel"), false);
});

test("keeps image sessions free of optional prompt state and APIs", () => {
  const storage = new MemoryStorage();
  const engine = new TalkCardPickEngine({
    cards: imageCards,
    themeId: "memory",
    cardType: "image",
    storage,
    random: sequenceRandom(),
  });
  const chosenId = engine.start({ resume: false }).hand[0];
  engine.pick(chosenId);
  const revealed = engine.revealSelected();
  const persisted = JSON.parse(storage.getItem(TALKCARD_PICK_SESSION_KEY));

  assert.equal(typeof engine.openPrompt, "undefined");
  assert.equal(Object.hasOwn(revealed, "promptLevel"), false);
  assert.equal(Object.hasOwn(persisted, "promptLevel"), false);
  assert.equal(JSON.stringify(persisted).includes("prompt"), false);
  assert.equal(JSON.stringify(persisted).includes("followup"), false);
});

test("passes only image identity, asset, and objective ALT to the active card", () => {
  const engine = new TalkCardPickEngine({
    cards: imageCards,
    themeId: "memory",
    cardType: "image",
    storage: new MemoryStorage(),
    random: sequenceRandom(),
  });
  const chosenId = engine.start({ resume: false }).hand[0];
  engine.pick(chosenId);
  const selected = engine.revealSelected().selectedCard;

  assert.deepEqual(Object.keys(selected).sort(), ["alt", "id", "image", "theme", "type"]);
  assert.equal(Object.hasOwn(selected, "prompt"), false);
  assert.equal(Object.hasOwn(selected, "followup"), false);
});

test("rejects a legacy prompt-bearing session and creates a clean hand", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    TALKCARD_PICK_SESSION_KEY,
    JSON.stringify({
      version: 1,
      mode: "theme",
      themeId: "ice",
      cardType: "text",
      pool: textCards.map((card) => card.id),
      hand: textCards.map((card) => card.id),
      used: [textCards[0].id],
      selectedCard: null,
      revealed: false,
      promptLevel: 0,
      cycle: 1,
      startedAt: 1,
      updatedAt: 1,
    }),
  );

  const engine = new TalkCardPickEngine({
    cards: textCards,
    themeId: "ice",
    cardType: "text",
    storage,
    random: sequenceRandom(),
  });
  const snapshot = engine.start({ resume: true });

  assert.equal(snapshot.used.length, 0);
  assert.equal(snapshot.hand.length, 15);
  assert.equal(snapshot.selectedCard, null);
});

test("restart clears used state and produces a visibly new order", () => {
  const engine = new TalkCardPickEngine({
    cards: textCards,
    themeId: "ice",
    cardType: "text",
    storage: new MemoryStorage(),
    random: () => 0.999,
  });
  const initial = engine.start({ resume: false });
  const chosenId = initial.hand[0];
  engine.pick(chosenId);
  engine.revealSelected();
  engine.returnToTable();
  const restarted = engine.restart();

  assert.equal(restarted.used.length, 0);
  assert.equal(restarted.hand.length, 15);
  assert.equal(restarted.cycle, 2);
  assert.notDeepEqual(restarted.pool, initial.pool);
});

console.log(
  JSON.stringify(
    {
      suite: "R02 PICK ENGINE",
      status: "PASS",
      passed: results.length,
      failed: 0,
      tests: results,
    },
    null,
    2,
  ),
);
