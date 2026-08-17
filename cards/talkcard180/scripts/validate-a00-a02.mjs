import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

function readExportedJson(relativePath, exportName, nextExportName) {
  const source = read(relativePath);
  const marker = `export const ${exportName} = `;
  const start = source.indexOf(marker);
  assert(start >= 0, `${relativePath}: ${exportName} export not found`);
  if (start < 0) return [];

  const valueStart = start + marker.length;
  const nextMarker = nextExportName ? `\n\nexport const ${nextExportName}` : null;
  const valueEnd = nextMarker ? source.indexOf(nextMarker, valueStart) : source.indexOf(";", valueStart);
  assert(valueEnd >= 0, `${relativePath}: ${exportName} export end not found`);
  if (valueEnd < 0) return [];

  return JSON.parse(source.slice(valueStart, valueEnd).replace(/;\s*$/, ""));
}

const legacy = JSON.parse(read("legacy/cards-v1.json"));
const themes = readExportedJson("data/themes.js", "THEMES", "THEME_BY_ID");
const textCards = readExportedJson("data/cards.js", "TEXT_CARDS", "IMAGE_CARD_SLOTS");
const imageSlots = readExportedJson("data/cards.js", "IMAGE_CARD_SLOTS", "CARDS");
const manifest = JSON.parse(read("data/image-card-manifest.json"));
const cards = [...textCards, ...imageSlots];

const textThemeIds = ["ice", "taste", "lately", "talk", "work", "value", "courage", "tmi"];
const imageThemeIds = ["memory", "recharge", "future", "kind"];
const requiredManifestFields = [
  "id",
  "theme",
  "image",
  "imageSubject",
  "sceneDescription",
  "composition",
  "alt",
  "prompt",
  "followup",
  "duplicationCheck",
  "visualMix",
];

assert(legacy.cards.length === 180, `legacy card count is ${legacy.cards.length}, expected 180`);
assert(new Set(legacy.cards.map((card) => card.id)).size === 180, "legacy card IDs are not unique");
assert(new Set(legacy.cards.map((card) => card.text)).size === 180, "legacy questions contain exact duplicates");

assert(themes.length === 12, `theme count is ${themes.length}, expected 12`);
assert(new Set(themes.map((theme) => theme.id)).size === 12, "theme IDs are not unique");
assert(themes.filter((theme) => theme.type === "text").length === 8, "text theme count must be 8");
assert(themes.filter((theme) => theme.type === "image").length === 4, "image theme count must be 4");

assert(textCards.length === 120, `text card count is ${textCards.length}, expected 120`);
assert(imageSlots.length === 60, `image slot count is ${imageSlots.length}, expected 60`);
assert(cards.length === 180, `v2 card slot count is ${cards.length}, expected 180`);
assert(new Set(cards.map((card) => card.id)).size === 180, "v2 card IDs are not unique");

for (const themeId of textThemeIds) {
  const legacyThemeCards = legacy.cards
    .filter((card) => card.theme === themeId)
    .map(({ id, text }) => ({ id, text }));
  const v2ThemeCards = textCards
    .filter((card) => card.theme === themeId)
    .map(({ id, text }) => ({ id, text }));

  assert(v2ThemeCards.length === 15, `${themeId}: expected 15 text cards`);
  assert(
    JSON.stringify(v2ThemeCards) === JSON.stringify(legacyThemeCards),
    `${themeId}: text or legacy ID changed`,
  );
}

for (const slot of imageSlots) {
  assert(slot.type === "image", `${slot.id}: image slot type is not image`);
  assert(slot.image === `assets/images/${slot.theme}/${slot.id}.webp`, `${slot.id}: invalid asset path`);
  assert(slot.alt === null && slot.prompt === null && slot.followup === null, `${slot.id}: A01 slot must remain unmerged`);
  assert(slot.manifestStatus === "pending", `${slot.id}: unexpected A01 manifest status`);
}

assert(manifest.status === "DESIGN_LOCKED_NO_IMAGES_GENERATED", "manifest generation lock is missing");
assert(manifest.cards.length === 60, `manifest card count is ${manifest.cards.length}, expected 60`);
assert(new Set(manifest.cards.map((card) => card.id)).size === 60, "manifest card IDs are not unique");
assert(new Set(manifest.cards.map((card) => card.prompt)).size === 60, "main prompts contain exact duplicates");
assert(new Set(manifest.cards.map((card) => card.followup)).size === 60, "follow-up prompts contain exact duplicates");

const manifestIds = new Set(manifest.cards.map((card) => card.id));
assert(imageSlots.every((slot) => manifestIds.has(slot.id)), "image slot and manifest IDs do not match");

for (const themeId of imageThemeIds) {
  const deck = manifest.cards.filter((card) => card.theme === themeId);
  assert(deck.length === 15, `${themeId}: expected 15 manifest cards`);
  assert(new Set(deck.map((card) => card.imageSubject)).size === 15, `${themeId}: image subjects are duplicated`);
  assert(deck.filter((card) => card.pilotCandidate).length === 3, `${themeId}: expected 3 pilot candidates`);
}

const interpretiveAltPattern = /(상징|의미하는|외로운|멀어진 관계|불안|우울|치유|회복을 상징|희망을 상징)/;
for (const card of manifest.cards) {
  for (const field of requiredManifestFields) {
    assert(typeof card[field] === "string" && card[field].trim().length > 0, `${card.id}: missing ${field}`);
  }
  assert(!interpretiveAltPattern.test(card.alt), `${card.id}: alt text contains interpretation`);
  assert(card.image === `assets/images/${card.theme}/${card.id}.webp`, `${card.id}: manifest asset path mismatch`);
}

const mixCorpus = manifest.cards.map((card) => card.visualMix).join(" ").toLowerCase();
for (const requiredMix of ["object", "space", "nature", "street", "light", "movement", "still", "close-up", "wide"]) {
  assert(mixCorpus.includes(requiredMix), `visual mix is missing ${requiredMix}`);
}

const report = {
  status: errors.length === 0 ? "PASS" : "FAIL",
  counts: {
    legacyCards: legacy.cards.length,
    themes: themes.length,
    textCards: textCards.length,
    imageSlots: imageSlots.length,
    totalSlots: cards.length,
    manifestCards: manifest.cards.length,
  },
  perTheme: Object.fromEntries(themes.map((theme) => [theme.id, cards.filter((card) => card.theme === theme.id).length])),
  pilotCandidates: Object.fromEntries(
    imageThemeIds.map((themeId) => [
      themeId,
      manifest.cards.filter((card) => card.theme === themeId && card.pilotCandidate).map((card) => card.id),
    ]),
  ),
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exitCode = 1;
