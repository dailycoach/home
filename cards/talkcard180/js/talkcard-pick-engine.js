/**
 * TALK CARD 180 v2.1 — PICK ENGINE
 *
 * Product contract:
 *   TABLE → PICK → REVEAL → TALK → RETURN → TABLE
 *
 * This engine never advances to another card by itself. It persists only
 * non-sensitive card state; no participant response is accepted or stored.
 */

export const TALKCARD_PICK_SESSION_VERSION = 2;
export const TALKCARD_PICK_SESSION_KEY = "talkcard180:v21:pick-session";
export const TALKCARD_THEME_DECK_SIZE = 15;

const SESSION_MODES = new Set(["theme"]);
const CARD_TYPES = new Set(["text", "image"]);
const SESSION_FIELDS = new Set([
  "version",
  "mode",
  "themeId",
  "cardType",
  "pool",
  "hand",
  "used",
  "selectedCard",
  "revealed",
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
    throw new RangeError("Pick Engine random source must return a value from 0 (inclusive) to 1 (exclusive).");
  }
}

function unique(values) {
  return new Set(values).size === values.length;
}

function sameOrder(first, second) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function validateCards(cards, themeId, cardType) {
  if (!Array.isArray(cards) || cards.length !== TALKCARD_THEME_DECK_SIZE) {
    throw new RangeError(`A theme hand must contain exactly ${TALKCARD_THEME_DECK_SIZE} cards.`);
  }
  if (typeof themeId !== "string" || !themeId.trim()) {
    throw new TypeError("A themeId is required.");
  }
  if (!CARD_TYPES.has(cardType)) {
    throw new TypeError("cardType must be text or image.");
  }

  const ids = cards.map((card) => card?.id);
  if (ids.some((id) => typeof id !== "string" || !id.trim())) {
    throw new TypeError("Every card needs a stable string ID.");
  }
  if (!unique(ids)) {
    throw new Error("Card IDs inside a theme hand must be unique.");
  }
  if (cards.some((card) => card.theme !== themeId)) {
    throw new Error("Every card must belong to the selected theme.");
  }
  if (cards.some((card) => card.type !== cardType)) {
    throw new Error("Every card must match the selected deck type.");
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

export class TalkCardPickEngine {
  constructor({
    cards,
    themeId,
    cardType,
    mode = "theme",
    storage,
    sessionKey = TALKCARD_PICK_SESSION_KEY,
    random = cryptoRandom,
    now = () => Date.now(),
  }) {
    validateCards(cards, themeId, cardType);
    if (!SESSION_MODES.has(mode)) throw new TypeError("Pilot Pick Engine mode must be theme.");

    this.cards = cards.slice();
    this.cardById = new Map(this.cards.map((card) => [card.id, card]));
    this.sourceIds = this.cards.map((card) => card.id);
    this.themeId = themeId;
    this.cardType = cardType;
    this.mode = mode;
    this.storage = storage === undefined ? defaultStorage() : storage;
    this.sessionKey = sessionKey;
    this.random = random;
    this.now = now;
    this.session = null;
  }

  start({ resume = true } = {}) {
    const restored = resume ? this.#restore() : null;
    if (restored) {
      this.session = restored;
      return this.snapshot();
    }

    this.session = this.#createSession({ cycle: 1 });
    this.#persist();
    return this.snapshot();
  }

  get selectedCard() {
    if (!this.session?.selectedCard) return null;
    return this.cardById.get(this.session.selectedCard) ?? null;
  }

  get tableCards() {
    if (!this.session) return [];
    return this.session.hand.map((id) => this.cardById.get(id)).filter(Boolean);
  }

  get progress() {
    const total = this.session?.pool.length ?? TALKCARD_THEME_DECK_SIZE;
    const used = this.session?.used.length ?? 0;
    const remaining = this.session?.hand.length ?? total;
    return {
      used,
      total,
      remaining,
      complete: remaining === 0,
    };
  }

  pick(cardId) {
    this.#assertStarted();
    if (this.session.selectedCard) {
      throw new Error("Return the selected card before picking another card.");
    }
    if (!this.session.hand.includes(cardId) || this.session.used.includes(cardId)) {
      throw new RangeError("Only an unused card in the current hand can be picked.");
    }

    this.session.selectedCard = cardId;
    this.session.revealed = false;
    this.session.updatedAt = this.now();
    this.#persist();
    return this.snapshot();
  }

  revealSelected() {
    this.#assertSelected();
    this.session.revealed = true;
    this.session.updatedAt = this.now();
    this.#persist();
    return this.snapshot();
  }

  returnToTable({ markUsed = true } = {}) {
    this.#assertStarted();
    const selectedId = this.session.selectedCard;
    if (!selectedId) return this.snapshot();

    if (markUsed) {
      this.session.hand = this.session.hand.filter((id) => id !== selectedId);
      if (!this.session.used.includes(selectedId)) this.session.used.push(selectedId);
    }

    this.session.selectedCard = null;
    this.session.revealed = false;
    this.session.updatedAt = this.now();
    this.#persist();
    return this.snapshot();
  }

  restart() {
    const previousPool = this.session?.pool.slice() ?? [];
    const cycle = (this.session?.cycle ?? 0) + 1;
    this.session = this.#createSession({ cycle, previousPool });
    this.#persist();
    return this.snapshot();
  }

  clear() {
    this.session = null;
    try {
      this.storage?.removeItem(this.sessionKey);
    } catch {
      // Storage is optional. In-memory play remains available.
    }
  }

  snapshot() {
    if (!this.session) {
      return {
        mode: this.mode,
        themeId: this.themeId,
        cardType: this.cardType,
        pool: [],
        hand: [],
        used: [],
        selectedCard: null,
        selectedCardId: null,
        revealed: false,
        tableCards: [],
        progress: this.progress,
        cycle: 0,
      };
    }

    return {
      mode: this.session.mode,
      themeId: this.session.themeId,
      cardType: this.session.cardType,
      pool: this.session.pool.slice(),
      hand: this.session.hand.slice(),
      used: this.session.used.slice(),
      selectedCard: this.selectedCard,
      selectedCardId: this.session.selectedCard,
      revealed: this.session.revealed,
      tableCards: this.tableCards,
      progress: this.progress,
      cycle: this.session.cycle,
    };
  }

  #assertStarted() {
    if (!this.session) throw new Error("Start the Pick Engine before using it.");
  }

  #assertSelected() {
    this.#assertStarted();
    if (!this.session.selectedCard || !this.selectedCard) {
      throw new Error("Pick a card before revealing it.");
    }
  }

  #createSession({ cycle, previousPool = [] }) {
    const timestamp = this.now();
    let pool = shuffleCards(this.cards, { random: this.random }).map((card) => card.id);

    // A deterministic test source—or an unlikely shuffle—must not make a
    // restart look unchanged. Rotate once while retaining every card.
    if (pool.length > 1 && sameOrder(pool, previousPool)) {
      pool = [...pool.slice(1), pool[0]];
    }

    return {
      version: TALKCARD_PICK_SESSION_VERSION,
      mode: this.mode,
      themeId: this.themeId,
      cardType: this.cardType,
      pool,
      hand: pool.slice(),
      used: [],
      selectedCard: null,
      revealed: false,
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

    return this.#isValidSession(candidate) ? candidate : null;
  }

  #isValidSession(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    if (Object.keys(candidate).some((key) => !SESSION_FIELDS.has(key))) return false;
    if (candidate.version !== TALKCARD_PICK_SESSION_VERSION) return false;
    if (candidate.mode !== this.mode || !SESSION_MODES.has(candidate.mode)) return false;
    if (candidate.themeId !== this.themeId || candidate.cardType !== this.cardType) return false;
    if (!Array.isArray(candidate.pool) || candidate.pool.length !== TALKCARD_THEME_DECK_SIZE) return false;
    if (!unique(candidate.pool) || candidate.pool.some((id) => !this.cardById.has(id))) return false;
    if (!sameOrder([...candidate.pool].sort(), [...this.sourceIds].sort())) return false;
    if (!Array.isArray(candidate.hand) || !unique(candidate.hand)) return false;
    if (!Array.isArray(candidate.used) || !unique(candidate.used)) return false;
    if (candidate.hand.some((id) => !candidate.pool.includes(id))) return false;
    if (candidate.used.some((id) => !candidate.pool.includes(id))) return false;
    if (candidate.hand.some((id) => candidate.used.includes(id))) return false;
    if (!sameOrder([...candidate.hand, ...candidate.used].sort(), [...candidate.pool].sort())) return false;
    if (candidate.selectedCard !== null && !candidate.hand.includes(candidate.selectedCard)) return false;
    if (typeof candidate.revealed !== "boolean") return false;
    if (candidate.selectedCard === null && candidate.revealed) return false;
    if (!Number.isInteger(candidate.cycle) || candidate.cycle < 1) return false;
    if (!Number.isFinite(candidate.startedAt) || !Number.isFinite(candidate.updatedAt)) return false;
    return true;
  }
}
