/**
 * TALK CARD 180 v2.0 — A06 DECK ENGINE
 *
 * Responsibilities
 * - accept exactly one 15-card theme deck
 * - shuffle without mutating source data
 * - prevent repetition until all 15 cards have been visited
 * - expose previous / next / completion progress
 * - persist only non-sensitive deck state in sessionStorage
 */

export const TALKCARD_DECK_SIZE = 15;
export const TALKCARD_SESSION_VERSION = 1;
export const TALKCARD_SESSION_KEY = "talkcard180:v2:deck-session";

const SESSION_MODES = new Set(["play", "extra"]);
const SESSION_FIELDS = new Set([
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
    throw new RangeError("Deck random source must return a number from 0 (inclusive) to 1 (exclusive).");
  }
}

function validateCards(cards, themeId, cardType) {
  if (!Array.isArray(cards) || cards.length !== TALKCARD_DECK_SIZE) {
    throw new RangeError(`A theme deck must contain exactly ${TALKCARD_DECK_SIZE} cards.`);
  }
  if (typeof themeId !== "string" || !themeId.trim()) {
    throw new TypeError("A themeId is required.");
  }
  if (!new Set(["text", "image"]).has(cardType)) {
    throw new TypeError("cardType must be text or image.");
  }

  const ids = cards.map((card) => card?.id);
  if (ids.some((id) => typeof id !== "string" || !id.trim())) {
    throw new TypeError("Every card needs a stable string ID.");
  }
  if (new Set(ids).size !== TALKCARD_DECK_SIZE) {
    throw new Error("Card IDs inside a theme deck must be unique.");
  }
  if (cards.some((card) => card.theme !== themeId)) {
    throw new Error("Every card must belong to the selected theme.");
  }
  if (cards.some((card) => card.type !== cardType)) {
    throw new Error("Every card must match the selected deck type.");
  }
}

export function shuffleCards(cards, { random = cryptoRandom, avoidFirstId = null } = {}) {
  if (!Array.isArray(cards)) throw new TypeError("shuffleCards expects an array.");

  const shuffled = cards.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = random();
    assertRandomValue(value);
    const swapIndex = Math.floor(value * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (avoidFirstId && shuffled.length > 1 && shuffled[0]?.id === avoidFirstId) {
    const replacementIndex = shuffled.findIndex((card, index) => index > 0 && card.id !== avoidFirstId);
    if (replacementIndex > 0) {
      [shuffled[0], shuffled[replacementIndex]] = [shuffled[replacementIndex], shuffled[0]];
    }
  }

  return shuffled;
}

export class TalkCardDeckEngine {
  constructor({
    cards,
    themeId,
    cardType,
    storage,
    sessionKey = TALKCARD_SESSION_KEY,
    random = cryptoRandom,
    now = () => Date.now(),
  }) {
    validateCards(cards, themeId, cardType);

    this.cards = cards.slice();
    this.cardById = new Map(this.cards.map((card) => [card.id, card]));
    this.themeId = themeId;
    this.cardType = cardType;
    this.storage = storage === undefined ? defaultStorage() : storage;
    this.sessionKey = sessionKey;
    this.random = random;
    this.now = now;
    this.session = null;
  }

  start({ resume = true } = {}) {
    const restored = resume ? this.#restore() : null;

    if (restored && !restored.completed) {
      this.session = restored;
      return this.snapshot();
    }

    const previousCardId = restored?.order[restored.position] ?? null;
    const nextCycle = restored ? restored.cycle + 1 : 1;
    this.session = this.#createSession({ cycle: nextCycle, avoidFirstId: previousCardId });
    this.#persist();
    return this.snapshot();
  }

  get currentCard() {
    if (!this.session) return null;
    return this.cardById.get(this.session.order[this.session.position]) ?? null;
  }

  get orderedCards() {
    if (!this.session) return [];
    return this.session.order.map((id) => this.cardById.get(id)).filter(Boolean);
  }

  get progress() {
    if (!this.session) {
      return {
        position: 0,
        total: TALKCARD_DECK_SIZE,
        isFirst: true,
        isLast: false,
        completed: false,
        mode: "play",
      };
    }

    return {
      position: this.session.position + 1,
      total: this.session.order.length,
      isFirst: this.session.position === 0,
      isLast: this.session.position === this.session.order.length - 1,
      completed: this.session.completed,
      mode: this.session.mode,
    };
  }

  previous() {
    if (!this.session || this.session.mode === "extra" || this.session.position === 0) {
      return this.snapshot();
    }

    this.session.position -= 1;
    this.session.completed = false;
    this.session.updatedAt = this.now();
    this.#persist();
    return this.snapshot();
  }

  next() {
    if (!this.session) return { ...this.snapshot(), reachedClosing: false };

    if (this.session.mode === "extra" || this.session.position >= this.session.order.length - 1) {
      this.session.completed = true;
      this.session.updatedAt = this.now();
      this.#persist();
      return { ...this.snapshot(), card: null, reachedClosing: true };
    }

    this.session.position += 1;
    this.session.updatedAt = this.now();
    this.#persist();
    return { ...this.snapshot(), reachedClosing: false };
  }

  drawExtra() {
    if (!this.session) this.start({ resume: false });

    const previousCardId = this.currentCard?.id ?? null;
    const order = shuffleCards(this.cards, {
      random: this.random,
      avoidFirstId: previousCardId,
    }).map((card) => card.id);
    const timestamp = this.now();

    this.session = {
      version: TALKCARD_SESSION_VERSION,
      themeId: this.themeId,
      cardType: this.cardType,
      order,
      position: 0,
      completed: false,
      mode: "extra",
      cycle: (this.session?.cycle ?? 0) + 1,
      startedAt: timestamp,
      updatedAt: timestamp,
    };
    this.#persist();
    return this.snapshot();
  }

  restart() {
    const avoidFirstId = this.currentCard?.id ?? null;
    const nextCycle = (this.session?.cycle ?? 0) + 1;
    this.session = this.#createSession({ cycle: nextCycle, avoidFirstId });
    this.#persist();
    return this.snapshot();
  }

  clear() {
    this.session = null;
    try {
      this.storage?.removeItem(this.sessionKey);
    } catch {
      // Storage is a convenience only; the in-memory deck remains usable.
    }
  }

  snapshot() {
    if (!this.session) {
      return {
        card: null,
        order: [],
        progress: this.progress,
        themeId: this.themeId,
        cardType: this.cardType,
        cycle: 0,
      };
    }

    return {
      card: this.currentCard,
      order: this.session.order.slice(),
      progress: this.progress,
      themeId: this.themeId,
      cardType: this.cardType,
      cycle: this.session.cycle,
    };
  }

  #createSession({ cycle, avoidFirstId = null }) {
    const timestamp = this.now();
    return {
      version: TALKCARD_SESSION_VERSION,
      themeId: this.themeId,
      cardType: this.cardType,
      order: shuffleCards(this.cards, {
        random: this.random,
        avoidFirstId,
      }).map((card) => card.id),
      position: 0,
      completed: false,
      mode: "play",
      cycle,
      startedAt: timestamp,
      updatedAt: timestamp,
    };
  }

  #persist() {
    if (!this.session) return;
    try {
      this.storage?.setItem(this.sessionKey, JSON.stringify(this.session));
    } catch {
      // Private browsing and storage quotas must not block card play.
    }
  }

  #restore() {
    let candidate;
    try {
      const raw = this.storage?.getItem(this.sessionKey);
      if (!raw) return null;
      candidate = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!this.#isValidSession(candidate)) return null;
    return candidate;
  }

  #isValidSession(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    if (Object.keys(candidate).some((key) => !SESSION_FIELDS.has(key))) return false;
    if (candidate.version !== TALKCARD_SESSION_VERSION) return false;
    if (candidate.themeId !== this.themeId || candidate.cardType !== this.cardType) return false;
    if (!Array.isArray(candidate.order) || candidate.order.length !== TALKCARD_DECK_SIZE) return false;
    if (new Set(candidate.order).size !== TALKCARD_DECK_SIZE) return false;
    if (candidate.order.some((id) => !this.cardById.has(id))) return false;
    if (!Number.isInteger(candidate.position) || candidate.position < 0 || candidate.position >= TALKCARD_DECK_SIZE) {
      return false;
    }
    if (typeof candidate.completed !== "boolean" || !SESSION_MODES.has(candidate.mode)) return false;
    if (!Number.isInteger(candidate.cycle) || candidate.cycle < 1) return false;
    if (!Number.isFinite(candidate.startedAt) || !Number.isFinite(candidate.updatedAt)) return false;
    return true;
  }
}
