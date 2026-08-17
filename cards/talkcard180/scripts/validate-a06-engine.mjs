import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const errors = [];
const checks = [];

function assert(condition, name, detail) {
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
  if (!condition) errors.push(`${name}: ${detail}`);
}

function readExportedJson(relativePath, exportName, nextExportName) {
  const source = read(relativePath);
  const marker = `export const ${exportName} = `;
  const start = source.indexOf(marker);
  if (start < 0) return [];
  const valueStart = start + marker.length;
  const valueEnd = source.indexOf(`\n\nexport const ${nextExportName}`, valueStart);
  if (valueEnd < 0) return [];
  return JSON.parse(source.slice(valueStart, valueEnd).replace(/;\s*$/, ""));
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    return value / 4_294_967_296;
  };
}

function memoryStorage() {
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
    dump(key) {
      return values.get(key) ?? null;
    },
  };
}

const engineSource = read("js/talkcard-engine.js");
const engineModuleUrl = `data:text/javascript;base64,${Buffer.from(engineSource).toString("base64")}`;
const {
  TALKCARD_DECK_SIZE,
  TALKCARD_SESSION_KEY,
  TALKCARD_SESSION_VERSION,
  TalkCardDeckEngine,
  shuffleCards,
} = await import(engineModuleUrl);

const themes = readExportedJson("data/themes.js", "THEMES", "THEME_BY_ID");
const textCards = readExportedJson("data/cards.js", "TEXT_CARDS", "IMAGE_CARD_SLOTS");
const manifest = JSON.parse(read("data/image-card-manifest.json"));
const imageCards = manifest.cards.map((card) => ({ ...card, type: "image" }));
const allCards = [...textCards, ...imageCards];
const view = read("js/talkcard-view.js");
const html = read("index-v2.html");

assert(exists("js/talkcard-engine.js"), "ENGINE_FILE", "talkcard-engine.js must exist");
assert(TALKCARD_DECK_SIZE === 15, "DECK_SIZE_LOCK", `expected 15, received ${TALKCARD_DECK_SIZE}`);
assert(TALKCARD_SESSION_VERSION === 1, "SESSION_VERSION", "session schema version must be 1");
assert(TALKCARD_SESSION_KEY === "talkcard180:v2:deck-session", "SESSION_KEY", "session key must be stable");
assert(themes.length === 12, "THEME_COUNT", `expected 12, received ${themes.length}`);
assert(textCards.length === 120, "TEXT_CARD_COUNT", `expected 120, received ${textCards.length}`);
assert(imageCards.length === 60, "IMAGE_CARD_COUNT", `expected 60, received ${imageCards.length}`);
assert(allCards.length === 180, "TOTAL_CARD_COUNT", `expected 180, received ${allCards.length}`);

const sourceProbe = textCards.slice(0, TALKCARD_DECK_SIZE);
const sourceIdsBefore = sourceProbe.map((card) => card.id);
const shuffledProbe = shuffleCards(sourceProbe, { random: seededRandom(42) });
assert(
  JSON.stringify(sourceProbe.map((card) => card.id)) === JSON.stringify(sourceIdsBefore),
  "SHUFFLE_IMMUTABILITY",
  "shuffle must not mutate source card data",
);
assert(new Set(shuffledProbe.map((card) => card.id)).size === 15, "SHUFFLE_UNIQUENESS", "shuffle output must contain 15 unique cards");
assert(
  JSON.stringify(shuffledProbe.map((card) => card.id)) !== JSON.stringify(sourceIdsBefore),
  "SHUFFLE_ORDER",
  "deterministic test seed must change source order",
);

const deckResults = {};
for (const [themeIndex, theme] of themes.entries()) {
  const cards = allCards.filter((card) => card.theme === theme.id);
  const originalIds = new Set(cards.map((card) => card.id));
  const engine = new TalkCardDeckEngine({
    cards,
    themeId: theme.id,
    cardType: theme.type,
    storage: null,
    random: seededRandom(100 + themeIndex),
    now: () => 1_800_000_000_000 + themeIndex,
  });
  const first = engine.start({ resume: false });
  const visited = [];

  while (true) {
    visited.push(engine.currentCard.id);
    const result = engine.next();
    if (result.reachedClosing) break;
  }

  const uniqueVisited = new Set(visited);
  assert(cards.length === 15, `DECK_${theme.id.toUpperCase()}_INPUT`, `${theme.label} must provide 15 cards`);
  assert(first.order.length === 15, `DECK_${theme.id.toUpperCase()}_ORDER`, `${theme.label} order must contain 15 IDs`);
  assert(uniqueVisited.size === 15, `DECK_${theme.id.toUpperCase()}_NO_REPEAT`, `${theme.label} repeated a card before completion`);
  assert(
    visited.every((id) => originalIds.has(id)),
    `DECK_${theme.id.toUpperCase()}_SCOPE`,
    `${theme.label} must not contain another theme's card`,
  );
  assert(engine.progress.completed, `DECK_${theme.id.toUpperCase()}_COMPLETE`, `${theme.label} must close after card 15`);
  deckResults[theme.id] = {
    type: theme.type,
    visited: visited.length,
    unique: uniqueVisited.size,
    completed: engine.progress.completed,
  };
}

const sessionTheme = themes.find((theme) => theme.type === "text");
const sessionCards = textCards.filter((card) => card.theme === sessionTheme.id);
const storage = memoryStorage();
const timeValues = { value: 1_800_000_100_000 };
const now = () => (timeValues.value += 1);
const sessionEngine = new TalkCardDeckEngine({
  cards: sessionCards,
  themeId: sessionTheme.id,
  cardType: sessionTheme.type,
  storage,
  random: seededRandom(701),
  now,
});
sessionEngine.start({ resume: false });
sessionEngine.next();
sessionEngine.next();
sessionEngine.next();
const resumeId = sessionEngine.currentCard.id;
const resumePosition = sessionEngine.progress.position;

const restoredEngine = new TalkCardDeckEngine({
  cards: sessionCards,
  themeId: sessionTheme.id,
  cardType: sessionTheme.type,
  storage,
  random: seededRandom(999),
  now,
});
const restored = restoredEngine.start({ resume: true });
assert(restored.card.id === resumeId, "SESSION_CURRENT_CARD", "same-theme session must restore the current card");
assert(restored.progress.position === resumePosition, "SESSION_PROGRESS", "same-theme session must restore progress");

const storedSession = JSON.parse(storage.dump(TALKCARD_SESSION_KEY));
const allowedSessionFields = [
  "version",
  "themeId",
  "cardType",
  "order",
  "position",
  "completed",
  "mode",
  "cycle",
  "startedAt",
  "updatedAt",
].sort();
assert(
  JSON.stringify(Object.keys(storedSession).sort()) === JSON.stringify(allowedSessionFields),
  "SESSION_MINIMAL_FIELDS",
  "session state must contain only engine metadata",
);
assert(
  !["text", "prompt", "followup", "alt", "answer", "response", "name", "email"].some((field) => field in storedSession),
  "SESSION_NO_SENSITIVE_CONTENT",
  "questions, answers and personal data must not be stored",
);

const differentTheme = themes.find((theme) => theme.id !== sessionTheme.id && theme.type === "text");
const differentCards = textCards.filter((card) => card.theme === differentTheme.id);
const isolatedEngine = new TalkCardDeckEngine({
  cards: differentCards,
  themeId: differentTheme.id,
  cardType: differentTheme.type,
  storage,
  random: seededRandom(702),
  now,
});
const isolated = isolatedEngine.start({ resume: true });
assert(isolated.themeId === differentTheme.id, "SESSION_THEME_ISOLATION", "another theme must start its own deck");
assert(isolated.progress.position === 1, "SESSION_THEME_RESET", "another theme must begin at 01 / 15");

const previousEngine = new TalkCardDeckEngine({
  cards: sessionCards,
  themeId: sessionTheme.id,
  cardType: sessionTheme.type,
  storage: null,
  random: seededRandom(703),
  now,
});
previousEngine.start({ resume: false });
const firstId = previousEngine.currentCard.id;
previousEngine.next();
const secondId = previousEngine.currentCard.id;
previousEngine.previous();
assert(previousEngine.currentCard.id === firstId, "PREVIOUS_CARD", "previous must return to the prior shuffled card");
previousEngine.next();
assert(previousEngine.currentCard.id === secondId, "NEXT_AFTER_PREVIOUS", "next must return to the same ordered card");

while (!previousEngine.progress.completed) previousEngine.next();
const lastCompletedId = previousEngine.currentCard.id;
const extra = previousEngine.drawExtra();
assert(extra.progress.mode === "extra", "EXTRA_MODE", "one-more card must use extra mode");
assert(extra.card.id !== lastCompletedId, "EXTRA_NO_IMMEDIATE_REPEAT", "one-more must not immediately repeat card 15");
assert(previousEngine.next().reachedClosing, "EXTRA_RETURNS_CLOSING", "one-more must return to closing after one card");

const completedStorage = memoryStorage();
const completedEngine = new TalkCardDeckEngine({
  cards: sessionCards,
  themeId: sessionTheme.id,
  cardType: sessionTheme.type,
  storage: completedStorage,
  random: seededRandom(704),
  now,
});
completedEngine.start({ resume: false });
while (!completedEngine.progress.completed) completedEngine.next();
const completedLastId = completedEngine.currentCard.id;
const completedCycle = JSON.parse(completedStorage.dump(TALKCARD_SESSION_KEY)).cycle;
const newCycleEngine = new TalkCardDeckEngine({
  cards: sessionCards,
  themeId: sessionTheme.id,
  cardType: sessionTheme.type,
  storage: completedStorage,
  random: seededRandom(705),
  now,
});
const newCycle = newCycleEngine.start({ resume: true });
assert(newCycle.cycle === completedCycle + 1, "COMPLETED_NEW_CYCLE", "a completed deck must start a new shuffled cycle");
assert(newCycle.card.id !== completedLastId, "CYCLE_BOUNDARY_REPEAT", "new cycle must avoid an immediate boundary repeat");

const corruptStorage = memoryStorage();
corruptStorage.setItem(TALKCARD_SESSION_KEY, JSON.stringify({
  version: 1,
  themeId: sessionTheme.id,
  cardType: sessionTheme.type,
  order: Array(15).fill(sessionCards[0].id),
  position: 99,
  completed: false,
  mode: "play",
  cycle: 1,
  startedAt: 1,
  updatedAt: 1,
}));
const recoveryEngine = new TalkCardDeckEngine({
  cards: sessionCards,
  themeId: sessionTheme.id,
  cardType: sessionTheme.type,
  storage: corruptStorage,
  random: seededRandom(706),
  now,
});
const recovered = recoveryEngine.start({ resume: true });
assert(new Set(recovered.order).size === 15, "CORRUPT_SESSION_RECOVERY", "invalid session state must rebuild safely");
assert(recovered.progress.position === 1, "CORRUPT_SESSION_POSITION", "recovered deck must start at 01 / 15");

let shortDeckRejected = false;
try {
  new TalkCardDeckEngine({
    cards: sessionCards.slice(0, 14),
    themeId: sessionTheme.id,
    cardType: sessionTheme.type,
    storage: null,
  });
} catch {
  shortDeckRejected = true;
}
assert(shortDeckRejected, "INVALID_DECK_REJECTED", "a 14-card deck must stop execution");

assert(
  view.includes('import { TalkCardDeckEngine } from "./talkcard-engine.js"'),
  "VIEW_ENGINE_IMPORT",
  "View must import the A06 engine",
);
assert(view.includes("new TalkCardDeckEngine"), "VIEW_ENGINE_CREATE", "View must create a theme-local engine");
assert(view.includes("state.engine.next()"), "VIEW_ENGINE_NEXT", "next action must go through the engine");
assert(view.includes("state.engine.previous()"), "VIEW_ENGINE_PREVIOUS", "previous action must go through the engine");
assert(view.includes("state.engine.drawExtra()"), "VIEW_ENGINE_EXTRA", "one-more action must go through the engine");
assert(!view.includes("Math.random"), "VIEW_NO_RANDOM", "View must not contain shuffle implementation");
assert(!view.includes("shuffleCards("), "VIEW_NO_SHUFFLE", "View must not call shuffle directly");
assert(engineSource.includes("sessionStorage"), "SESSION_STORAGE", "engine must use session-level storage");
assert(!engineSource.includes("localStorage"), "NO_LOCAL_STORAGE", "long-lived local storage must not be used");
assert(html.includes("01 / 15"), "PROGRESS_MARKUP", "card play must expose the theme progress pattern");
assert(html.includes("오늘 조금 더 알게 된 것이 있나요?"), "CLOSING_PRESERVED", "A05 closing must remain connected");
assert(!exists("index.html"), "LIVE_FILE_LOCK", "A06 must not introduce production index.html");

const result = {
  run: "A06 DECK ENGINE",
  status: errors.length === 0 ? "PASS" : "FAIL",
  summary: {
    checks: checks.length,
    passed: checks.filter((check) => check.status === "PASS").length,
    failed: checks.filter((check) => check.status === "FAIL").length,
    themesTested: themes.length,
    textDecksTested: themes.filter((theme) => theme.type === "text").length,
    imageDecksTested: themes.filter((theme) => theme.type === "image").length,
    cardsTraversed: themes.length * TALKCARD_DECK_SIZE,
    sessionFields: allowedSessionFields.length,
  },
  perDeck: deckResults,
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
