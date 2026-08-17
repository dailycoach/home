/**
 * TALK CARD 180 v2.1 — THEMELESS DECK ENGINES
 *
 * User-facing modes:
 *   QUESTION 120 → one shuffled question at a time
 *   IMAGE 60    → choose and flip from a replenishing 15-card hand
 *
 * Theme IDs remain in source data for preservation only. No participant
 * response or other sensitive content is accepted or stored.
 */

export const TALKCARD_DECK_SESSION_VERSION = 3;
export const TALKCARD_QUESTION_SESSION_KEY = "talkcard180:v21:question-120";
export const TALKCARD_IMAGE_SESSION_KEY = "talkcard180:v21:image-60";
export const TALKCARD_QUESTION_TOTAL = 120;
export const TALKCARD_IMAGE_TOTAL = 60;
export const TALKCARD_IMAGE_HAND_SIZE = 15;

const COMMON_FIELDS = new Set([
  "version",
  "mode",
  "pool",
  "used",
  "finished",
  "cycle",
  "startedAt",
  "updatedAt",
]);

function defaultStorage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function cryptoRandom() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const value = new Uint32Array(1);
    cryptoApi.getRandomValues(value);
    return value[0] / 4_294_967_296;
  }
  return Math.random();
}

function assertRandomValue(value) {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Random source must return a value from 0 (inclusive) to 1 (exclusive).");
  }
}

function unique(values) {
  return new Set(values).size === values.length;
}

function sameOrder(first, second) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function sameMembers(first, second) {
  return sameOrder([...first].sort(), [...second].sort());
}

function validateDeck(cards, { type, total }) {
  if (!Array.isArray(cards) || cards.length !== total) {
    throw new RangeError(`${type} deck must contain exactly ${total} cards.`);
  }

  const ids = cards.map((card) => card?.id);
  if (ids.some((id) => typeof id !== "string" || !id.trim())) {
    throw new TypeError("Every card needs a stable string ID.");
  }
  if (!unique(ids)) throw new Error("Card IDs must be unique.");
  if (cards.some((card) => card.type !== type)) {
    throw new TypeError(`Every card in this deck must have type "${type}".`);
  }
}

export function shuffleCards(cards, { random = cryptoRandom } = {}) {
  if (!Array.isArray(cards)) throw new TypeError("shuffleCards expects an array.");

  const shuffled = cards.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = random();
    assertRandomValue(value);
    const swapIndex = Math.floor(value * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function shuffledIds(cards, random, previousPool = []) {
  let pool = shuffleCards(cards, { random }).map((card) => card.id);
  if (pool.length > 1 && sameOrder(pool, previousPool)) {
    pool = [...pool.slice(1), pool[0]];
  }
  return pool;
}

function readStored(storage, sessionKey) {
  try {
    const raw = storage?.getItem(sessionKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(storage, sessionKey, session) {
  try {
    storage?.setItem(sessionKey, JSON.stringify(session));
  } catch {
    // Storage is optional. In-memory play remains available.
  }
}

function clearStored(storage, sessionKey) {
  try {
    storage?.removeItem(sessionKey);
  } catch {
    // Storage is optional.
  }
}

export class SequentialQuestionEngine {
  constructor({
    cards,
    storage,
    sessionKey = TALKCARD_QUESTION_SESSION_KEY,
    random = cryptoRandom,
    now = () => Date.now(),
  }) {
    validateDeck(cards, { type: "text", total: TALKCARD_QUESTION_TOTAL });
    this.cards = cards.slice();
    this.cardById = new Map(this.cards.map((card) => [card.id, card]));
    this.sourceIds = this.cards.map((card) => card.id);
    this.storage = storage === undefined ? defaultStorage() : storage;
    this.sessionKey = sessionKey;
    this.random = random;
    this.now = now;
    this.session = null;
  }

  start({ resume = true } = {}) {
    const restored = resume ? this.#restore() : null;
    this.session = restored ?? this.#createSession({ cycle: 1 });
    persist(this.storage, this.sessionKey, this.session);
    return this.snapshot();
  }

  get currentCard() {
    const id = this.session?.used.at(-1);
    return id ? this.cardById.get(id) ?? null : null;
  }

  get progress() {
    const shown = this.session?.used.length ?? 0;
    return {
      shown,
      total: TALKCARD_QUESTION_TOTAL,
      remaining: Math.max(TALKCARD_QUESTION_TOTAL - shown, 0),
      isLast: shown === TALKCARD_QUESTION_TOTAL,
      complete: this.session?.finished ?? false,
    };
  }

  advance() {
    this.#assertStarted();
    if (this.session.finished) return this.snapshot();

    if (this.session.used.length >= this.session.pool.length) {
      this.session.finished = true;
    } else {
      this.session.used.push(this.session.pool[this.session.used.length]);
    }

    this.session.updatedAt = this.now();
    persist(this.storage, this.sessionKey, this.session);
    return this.snapshot();
  }

  finish() {
    this.#assertStarted();
    this.session.finished = true;
    this.session.updatedAt = this.now();
    persist(this.storage, this.sessionKey, this.session);
    return this.snapshot();
  }

  restart() {
    const previousPool = this.session?.pool.slice() ?? [];
    const cycle = (this.session?.cycle ?? 0) + 1;
    this.session = this.#createSession({ cycle, previousPool });
    persist(this.storage, this.sessionKey, this.session);
    return this.snapshot();
  }

  clear() {
    this.session = null;
    clearStored(this.storage, this.sessionKey);
  }

  snapshot() {
    if (!this.session) {
      return {
        mode: "questions",
        pool: [],
        used: [],
        currentCard: null,
        currentCardId: null,
        finished: false,
        progress: this.progress,
        cycle: 0,
      };
    }

    return {
      mode: this.session.mode,
      pool: this.session.pool.slice(),
      used: this.session.used.slice(),
      currentCard: this.currentCard,
      currentCardId: this.currentCard?.id ?? null,
      finished: this.session.finished,
      progress: this.progress,
      cycle: this.session.cycle,
    };
  }

  #assertStarted() {
    if (!this.session) throw new Error("Start the question engine before using it.");
  }

  #createSession({ cycle, previousPool = [] }) {
    const timestamp = this.now();
    const pool = shuffledIds(this.cards, this.random, previousPool);
    return {
      version: TALKCARD_DECK_SESSION_VERSION,
      mode: "questions",
      pool,
      used: [pool[0]],
      finished: false,
      cycle,
      startedAt: timestamp,
      updatedAt: timestamp,
    };
  }

  #restore() {
    const candidate = readStored(this.storage, this.sessionKey);
    return this.#isValidSession(candidate) ? candidate : null;
  }

  #isValidSession(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    if (Object.keys(candidate).some((key) => !COMMON_FIELDS.has(key))) return false;
    if (candidate.version !== TALKCARD_DECK_SESSION_VERSION || candidate.mode !== "questions") return false;
    if (!Array.isArray(candidate.pool) || candidate.pool.length !== TALKCARD_QUESTION_TOTAL) return false;
    if (!unique(candidate.pool) || !sameMembers(candidate.pool, this.sourceIds)) return false;
    if (!Array.isArray(candidate.used) || candidate.used.length < 1 || candidate.used.length > candidate.pool.length) return false;
    if (!unique(candidate.used) || !sameOrder(candidate.used, candidate.pool.slice(0, candidate.used.length))) return false;
    if (typeof candidate.finished !== "boolean") return false;
    if (!Number.isInteger(candidate.cycle) || candidate.cycle < 1) return false;
    if (!Number.isFinite(candidate.startedAt) || !Number.isFinite(candidate.updatedAt)) return false;
    return true;
  }
}

const IMAGE_FIELDS = new Set([
  ...COMMON_FIELDS,
  "hand",
  "drawIndex",
  "selectedCard",
  "selectedSlot",
  "revealed",
]);

export class ImageHandEngine {
  constructor({
    cards,
    storage,
    sessionKey = TALKCARD_IMAGE_SESSION_KEY,
    random = cryptoRandom,
    now = () => Date.now(),
  }) {
    validateDeck(cards, { type: "image", total: TALKCARD_IMAGE_TOTAL });
    this.cards = cards.slice();
    this.cardById = new Map(this.cards.map((card) => [card.id, card]));
    this.sourceIds = this.cards.map((card) => card.id);
    this.storage = storage === undefined ? defaultStorage() : storage;
    this.sessionKey = sessionKey;
    this.random = random;
    this.now = now;
    this.session = null;
  }

  start({ resume = true } = {}) {
    const restored = resume ? this.#restore() : null;
    this.session = restored ?? this.#createSession({ cycle: 1 });
    persist(this.storage, this.sessionKey, this.session);
    return this.snapshot();
  }

  get selectedCard() {
    const id = this.session?.selectedCard;
    return id ? this.cardById.get(id) ?? null : null;
  }

  get tableCards() {
    return (this.session?.hand ?? []).map((id) => (id ? this.cardById.get(id) ?? null : null));
  }

  get progress() {
    const used = this.session?.used.length ?? 0;
    return {
      used,
      total: TALKCARD_IMAGE_TOTAL,
      remaining: Math.max(TALKCARD_IMAGE_TOTAL - used, 0),
      inHand: (this.session?.hand ?? []).filter(Boolean).length,
      undealt: this.session ? TALKCARD_IMAGE_TOTAL - this.session.drawIndex : TALKCARD_IMAGE_TOTAL,
      complete: this.session?.finished ?? false,
    };
  }

  pick(cardId) {
    this.#assertStarted();
    if (this.session.finished) throw new Error("This image deck is finished.");
    if (this.session.selectedCard) throw new Error("Return the selected card before picking another.");
    const slot = this.session.hand.indexOf(cardId);
    if (slot < 0 || this.session.used.includes(cardId)) {
      throw new RangeError("Only an unused card in the current hand can be picked.");
    }

    this.session.selectedCard = cardId;
    this.session.selectedSlot = slot;
    this.session.revealed = false;
    this.session.updatedAt = this.now();
    persist(this.storage, this.sessionKey, this.session);
    return this.snapshot();
  }

  revealSelected() {
    this.#assertSelected();
    this.session.revealed = true;
    this.session.updatedAt = this.now();
    persist(this.storage, this.sessionKey, this.session);
    return this.snapshot();
  }

  returnToTable({ markUsed = true } = {}) {
    this.#assertStarted();
    const selectedId = this.session.selectedCard;
    const selectedSlot = this.session.selectedSlot;
    if (!selectedId || selectedSlot === null) return this.snapshot();

    if (markUsed) {
      if (!this.session.used.includes(selectedId)) this.session.used.push(selectedId);
      if (this.session.drawIndex < this.session.pool.length) {
        this.session.hand[selectedSlot] = this.session.pool[this.session.drawIndex];
        this.session.drawIndex += 1;
      } else {
        this.session.hand[selectedSlot] = null;
      }
    }

    this.session.selectedCard = null;
    this.session.selectedSlot = null;
    this.session.revealed = false;
    if (this.session.used.length >= this.session.pool.length) this.session.finished = true;
    this.session.updatedAt = this.now();
    persist(this.storage, this.sessionKey, this.session);
    return this.snapshot();
  }

  finish() {
    this.#assertStarted();
    if (this.session.selectedCard) throw new Error("Return the selected image before finishing.");
    this.session.finished = true;
    this.session.updatedAt = this.now();
    persist(this.storage, this.sessionKey, this.session);
    return this.snapshot();
  }

  restart() {
    const previousPool = this.session?.pool.slice() ?? [];
    const cycle = (this.session?.cycle ?? 0) + 1;
    this.session = this.#createSession({ cycle, previousPool });
    persist(this.storage, this.sessionKey, this.session);
    return this.snapshot();
  }

  clear() {
    this.session = null;
    clearStored(this.storage, this.sessionKey);
  }

  snapshot() {
    if (!this.session) {
      return {
        mode: "images",
        pool: [],
        hand: [],
        used: [],
        selectedCard: null,
        selectedCardId: null,
        selectedSlot: null,
        revealed: false,
        finished: false,
        tableCards: [],
        progress: this.progress,
        cycle: 0,
      };
    }

    return {
      mode: this.session.mode,
      pool: this.session.pool.slice(),
      hand: this.session.hand.slice(),
      used: this.session.used.slice(),
      selectedCard: this.selectedCard,
      selectedCardId: this.session.selectedCard,
      selectedSlot: this.session.selectedSlot,
      revealed: this.session.revealed,
      finished: this.session.finished,
      tableCards: this.tableCards,
      progress: this.progress,
      cycle: this.session.cycle,
    };
  }

  #assertStarted() {
    if (!this.session) throw new Error("Start the image engine before using it.");
  }

  #assertSelected() {
    this.#assertStarted();
    if (!this.session.selectedCard || this.session.selectedSlot === null || !this.selectedCard) {
      throw new Error("Pick an image card before revealing it.");
    }
  }

  #createSession({ cycle, previousPool = [] }) {
    const timestamp = this.now();
    const pool = shuffledIds(this.cards, this.random, previousPool);
    return {
      version: TALKCARD_DECK_SESSION_VERSION,
      mode: "images",
      pool,
      hand: pool.slice(0, TALKCARD_IMAGE_HAND_SIZE),
      drawIndex: TALKCARD_IMAGE_HAND_SIZE,
      used: [],
      selectedCard: null,
      selectedSlot: null,
      revealed: false,
      finished: false,
      cycle,
      startedAt: timestamp,
      updatedAt: timestamp,
    };
  }

  #restore() {
    const candidate = readStored(this.storage, this.sessionKey);
    return this.#isValidSession(candidate) ? candidate : null;
  }

  #isValidSession(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    if (Object.keys(candidate).some((key) => !IMAGE_FIELDS.has(key))) return false;
    if (candidate.version !== TALKCARD_DECK_SESSION_VERSION || candidate.mode !== "images") return false;
    if (!Array.isArray(candidate.pool) || candidate.pool.length !== TALKCARD_IMAGE_TOTAL) return false;
    if (!unique(candidate.pool) || !sameMembers(candidate.pool, this.sourceIds)) return false;
    if (!Array.isArray(candidate.hand) || candidate.hand.length !== TALKCARD_IMAGE_HAND_SIZE) return false;
    const handIds = candidate.hand.filter((id) => id !== null);
    if (candidate.hand.some((id) => id !== null && typeof id !== "string")) return false;
    if (!unique(handIds) || handIds.some((id) => !this.cardById.has(id))) return false;
    if (!Array.isArray(candidate.used) || !unique(candidate.used)) return false;
    if (candidate.used.some((id) => !this.cardById.has(id) || handIds.includes(id))) return false;
    if (!Number.isInteger(candidate.drawIndex) || candidate.drawIndex < TALKCARD_IMAGE_HAND_SIZE || candidate.drawIndex > candidate.pool.length) return false;
    if (!sameMembers([...handIds, ...candidate.used, ...candidate.pool.slice(candidate.drawIndex)], candidate.pool)) return false;
    if (candidate.selectedCard === null) {
      if (candidate.selectedSlot !== null || candidate.revealed) return false;
    } else {
      if (!Number.isInteger(candidate.selectedSlot) || candidate.selectedSlot < 0 || candidate.selectedSlot >= candidate.hand.length) return false;
      if (candidate.hand[candidate.selectedSlot] !== candidate.selectedCard) return false;
    }
    if (typeof candidate.revealed !== "boolean" || typeof candidate.finished !== "boolean") return false;
    if (candidate.finished && candidate.selectedCard !== null) return false;
    if (!Number.isInteger(candidate.cycle) || candidate.cycle < 1) return false;
    if (!Number.isFinite(candidate.startedAt) || !Number.isFinite(candidate.updatedAt)) return false;
    return true;
  }
}

