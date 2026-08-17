/**
 * TALK CARD 180 v2.1 — PICK ENGINE
 *
 * Product loop: TABLE → PICK → REVEAL → TALK → RETURN → TABLE.
 * This engine never advances to or reveals another card automatically.
 */

export const TALKCARD_PICK_DECK_SIZE = 15;
export const TALKCARD_PICK_SESSION_VERSION = 1;
export const TALKCARD_PICK_SESSION_KEY = "talkcard180:v21:pick-session";

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
  "promptLevel",
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

function validateThemeCards(cards, themeId, cardType) {
  if (!Array.isArray(cards) || cards.length !== TALKCARD_PICK_DECK_SIZE) {
    throw new RangeError(`A theme hand must contain exactly ${TALKCARD_PICK_DECK_SIZE} cards.`);
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
  if (new Set(ids).size !== TALKCARD_PICK_DECK_SIZE) {
    throw new Error("Card IDs inside a theme hand must be unique.");
  }
  if (cards.some((card) => card.theme !== themeId)) {
    throw new Error("Every card must belong to the selected theme.");
  }
  if (cards.some((card) => card.type !== cardType)) {
    throw new Error("Every card must match the selected deck type.");
  }
}

function sameOrder(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((id, index) => id === right[index]);
}

export function shuffleForTable(cards, { random = cryptoRandom, avoidOrder = null } = {}) {
  if (!Array.isArray(cards)) throw new TypeError("shuffleForTable expects an array.");

  const shuffled = cards.slice();
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = random();
    assertRandomValue(value);
    const swapIndex = Math.floor(value * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  const shuffledIds = shuffled.map((card) => card?.id);
  if (shuffled.length > 1 && sameOrder(shuffledIds, avoidOrder)) {
    shuffled.push(shuffled.shift());
  }

  return shuffled;
}

export class TalkCardPickEngine {
  constructor({
    cards,
    themeId,
    cardType,
    storage,
    sessionKey = TALKCARD_PICK_SESSION_KEY,
    random = cryptoRandom,
    now = () => Date.now(),
  }) {
    validateThemeCards(cards, themeId, cardType);

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

  startTheme({ resume = true } = {}) {
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

  get progress() {
    const used = this.session?.used.length ?? 0;
    return {
      used,
      total: TALKCARD_PICK_DECK_SIZE,
      remaining: TALKCARD_PICK_DECK_SIZE - used,
      complete: used === TALKCARD_PICK_DECK_SIZE,
    };
  }

  get availableCardIds() {
    if (!this.session) return [];
    const used = new Set(this.session.used);
    return this.session.hand.filter((id) => !used.has(id));
  }

  get tableSlots() {
    if (!this.session) return [];
    const used = new Set(this.session.used);
    return this.session.hand.map((cardId, index) => ({
      position: index + 1,
      cardId,
      used: used.has(cardId),
      selected: this.session.selectedCard === cardId,
      selectable: !used.has(cardId) && this.session.selectedCard === null,
    }));
  }

  selectCard(cardId) {
    this.#requireSession();
    if (this.session.selectedCard !== null) {
      throw new Error("Return the selected card to the table before choosing another card.");
    }
    if (!this.cardById.has(cardId) || !this.session.hand.includes(cardId)) {
      throw new RangeError("The selected card does not belong to this hand.");
    }
    if (this.session.used.includes(cardId)) {
      throw new Error("A used card cannot be selected again.");
    }

    this.session.used.push(cardId);
    this.session.selectedCard = cardId;
    this.session.revealed = false;
    this.session.promptLevel = 0;
    this.#touchAndPersist();
    return this.snapshot();
  }

  revealSelected() {
    this.#requireSelected();
    this.session.revealed = true;
    this.#touchAndPersist();
    return this.snapshot();
  }

  openPrompt() {
    this.#requireSelected();
    if (this.cardType !== "image") {
      throw new Error("Only image cards have optional prompt levels.");
    }
    if (!this.session.revealed) {
      throw new Error("Reveal the selected image before opening a prompt.");
    }

    this.session.promptLevel = Math.min(this.session.promptLevel + 1, 2);
    this.#touchAndPersist();
    return this.snapshot();
  }

  returnToTable() {
    this.#requireSession();
    this.session.selectedCard = null;
    this.session.revealed = false;
    this.session.promptLevel = 0;
    this.#touchAndPersist();
    return this.snapshot();
  }

  restart() {
    const previousOrder = this.session?.hand ?? null;
    const nextCycle = (this.session?.cycle ?? 0) + 1;
    this.session = this.#createSession({ cycle: nextCycle, avoidOrder: previousOrder });
    this.#persist();
    return this.snapshot();
  }

  clear() {
    this.session = null;
    try {
      this.storage?.removeItem(this.sessionKey);
    } catch {
      // Session persistence is optional; in-memory play must remain available.
    }
  }

  snapshot() {
    if (!this.session) {
      return {
        mode: "theme",
        themeId: this.themeId,
        cardType: this.cardType,
        pool: [],
        hand: [],
        used: [],
        selectedCard: null,
        card: null,
        revealed: false,
        promptLevel: 0,
        table: [],
        availableCardIds: [],
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
      selectedCard: this.session.selectedCard,
      card: this.selectedCard,
      revealed: this.session.revealed,
      promptLevel: this.session.promptLevel,
      table: this.tableSlots,
      availableCardIds: this.availableCardIds,
      progress: this.progress,
      cycle: this.session.cycle,
    };
  }

  #createSession({ cycle, avoidOrder = null }) {
    const timestamp = this.now();
    return {
      version: TALKCARD_PICK_SESSION_VERSION,
      mode: "theme",
      themeId: this.themeId,
      cardType: this.cardType,
      pool: [],
      hand: shuffleForTable(this.cards, {
        random: this.random,
        avoidOrder,
      }).map((card) => card.id),
      used: [],
      selectedCard: null,
      revealed: false,
      promptLevel: 0,
      cycle,
      startedAt: timestamp,
      updatedAt: timestamp,
    };
  }

  #requireSession() {
    if (!this.session) throw new Error("Start the theme hand before interacting with cards.");
  }

  #requireSelected() {
    this.#requireSession();
    if (!this.session.selectedCard) throw new Error("Select a card before revealing content.");
  }

  #touchAndPersist() {
    this.session.updatedAt = this.now();
    this.#persist();
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
    if (candidate.version !== TALKCARD_PICK_SESSION_VERSION || candidate.mode !== "theme") return false;
    if (candidate.themeId !== this.themeId || candidate.cardType !== this.cardType) return false;
    if (!Array.isArray(candidate.pool) || candidate.pool.length !== 0) return false;
    if (!Array.isArray(candidate.hand) || candidate.hand.length !== TALKCARD_PICK_DECK_SIZE) return false;
    if (new Set(candidate.hand).size !== TALKCARD_PICK_DECK_SIZE) return false;
    if (candidate.hand.some((id) => !this.cardById.has(id))) return false;
    if (!Array.isArray(candidate.used) || new Set(candidate.used).size !== candidate.used.length) return false;
    if (candidate.used.some((id) => !candidate.hand.includes(id))) return false;
    if (candidate.selectedCard !== null && !candidate.used.includes(candidate.selectedCard)) return false;
    if (typeof candidate.revealed !== "boolean") return false;
    if (!Number.isInteger(candidate.promptLevel) || candidate.promptLevel < 0 || candidate.promptLevel > 2) return false;
    if (candidate.selectedCard === null && (candidate.revealed || candidate.promptLevel !== 0)) return false;
    if (!candidate.revealed && candidate.promptLevel !== 0) return false;
    if (this.cardType === "text" && candidate.promptLevel !== 0) return false;
    if (!Number.isInteger(candidate.cycle) || candidate.cycle < 1) return false;
    if (!Number.isFinite(candidate.startedAt) || !Number.isFinite(candidate.updatedAt)) return false;
    return true;
  }
}
