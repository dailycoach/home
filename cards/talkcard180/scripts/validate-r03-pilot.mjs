import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { THEMES } from "../data/themes.js";
import { IMAGE_CARDS, TEXT_CARDS } from "../data/runtime-cards.js";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");

const paths = {
  candidate: path.join(root, "index-v21.html"),
  v2: path.join(root, "index-v2.html"),
  production: path.join(root, "index.html"),
  themes: path.join(root, "data/themes.js"),
  runtime: path.join(root, "data/runtime-cards.js"),
  manifest: path.join(root, "data/image-card-manifest.json"),
  baseCss: path.join(root, "css/talkcard.css"),
  pilotCss: path.join(root, "css/talkcard-v21.css"),
  oldEngine: path.join(root, "js/talkcard-engine.js"),
  oldView: path.join(root, "js/talkcard-view.js"),
  pickEngine: path.join(root, "js/talkcard-pick-engine.js"),
  pilotView: path.join(root, "js/talkcard-v21-view.js"),
};

const EXPECTED_HASHES = Object.freeze({
  v2: "b1fa2c3705b341262806abbab7b46db521991285b6be2a5288d815ac473d08c3",
  themes: "c7c5ee8b476d17922b4f86950bce20dcdde16e5cf867c519d39d2f1f20d7d3c7",
  runtime: "65b4d47cec1572ddaf31903d5dd31e087af0986e6898510edd6c1386aa73f518",
  manifest: "8507a2ecf6209d87d4313e2081cdd968b6d774b1b161035bc526af7bdfe94a9f",
  baseCss: "4cb10ecc93bdd6d1d917cc18c72267d96c0c1ca83891ea355bbc426feba09eda",
  oldEngine: "140b871ae4c527c0aa592745a2cc59a5893586f1905c22e727c9a3e900ed51de",
  oldView: "c41e79dba0f982beba1d89daa2deb6cec5dec4c10eb2336e3548fe4592c6874c",
});

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

async function productionCandidateIsAbsent() {
  try {
    await access(paths.production, constants.F_OK);
    return false;
  } catch {
    return true;
  }
}

const [
  candidate,
  v2,
  themesSource,
  runtimeSource,
  manifestSource,
  baseCss,
  pilotCss,
  oldEngine,
  oldView,
  pickEngine,
  pilotView,
] = await Promise.all([
  readFile(paths.candidate, "utf8"),
  readFile(paths.v2, "utf8"),
  readFile(paths.themes, "utf8"),
  readFile(paths.runtime, "utf8"),
  readFile(paths.manifest, "utf8"),
  readFile(paths.baseCss, "utf8"),
  readFile(paths.pilotCss, "utf8"),
  readFile(paths.oldEngine, "utf8"),
  readFile(paths.oldView, "utf8"),
  readFile(paths.pickEngine, "utf8"),
  readFile(paths.pilotView, "utf8"),
]);

assert.equal(await productionCandidateIsAbsent(), true, "The local recovery patch must not create production index.html");
assert.equal(sha256(v2), EXPECTED_HASHES.v2, "The v2.0 candidate must remain byte-identical");
assert.equal(sha256(themesSource), EXPECTED_HASHES.themes, "Theme data must remain unchanged");
assert.equal(sha256(runtimeSource), EXPECTED_HASHES.runtime, "Runtime card data must remain unchanged");
assert.equal(sha256(manifestSource), EXPECTED_HASHES.manifest, "Image manifest must remain unchanged");
assert.equal(sha256(baseCss), EXPECTED_HASHES.baseCss, "The v2.0 stylesheet must remain unchanged");
assert.equal(sha256(oldEngine), EXPECTED_HASHES.oldEngine, "The v2.0 automatic engine must remain archived unchanged");
assert.equal(sha256(oldView), EXPECTED_HASHES.oldView, "The v2.0 view must remain archived unchanged");

assert.equal(THEMES.length, 12);
assert.equal(THEMES.filter((theme) => theme.type === "text").length, 8);
assert.equal(THEMES.filter((theme) => theme.type === "image").length, 4);
assert.equal(TEXT_CARDS.length, 120);
assert.equal(IMAGE_CARDS.length, 60);
assert.equal(new Set([...TEXT_CARDS, ...IMAGE_CARDS].map((card) => card.id)).size, 180);
for (const theme of THEMES) {
  assert.equal([...TEXT_CARDS, ...IMAGE_CARDS].filter((card) => card.theme === theme.id).length, 15);
}

for (const theme of ["memory", "recharge", "future", "kind"]) {
  const files = (await readdir(path.join(root, `assets/images/${theme}`))).filter((file) => file.endsWith(".webp"));
  assert.equal(files.length, 15, `${theme} must retain 15 full WebP images`);
}

assert.match(candidate, /<meta name="robots" content="noindex, nofollow" \/>/);
assert.match(candidate, /css\/talkcard\.css\?v=2\.0\.0-a07/);
assert.match(candidate, /css\/talkcard-v21\.css\?v=2\.1\.0-r04/);
assert.match(candidate, /js\/talkcard-v21-view\.js\?v=2\.1\.0-r04/);
assert.doesNotMatch(candidate, /js\/talkcard-view\.js/);
assert.doesNotMatch(candidate, /js\/talkcard-engine\.js/);

const screenNames = [...candidate.matchAll(/data-screen="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(screenNames, ["opening", "themes", "intro", "table", "reveal", "closing"]);
for (const screen of ["themes", "intro", "table", "reveal", "closing"]) {
  assert.match(candidate, new RegExp(`data-screen="${screen}"[^>]* hidden`));
}

assert.match(candidate, /PICK · SEE · TALK/);
assert.match(candidate, /카드 펼치기/);
assert.match(candidate, /카드 한 장을 골라보세요\./);
assert.match(candidate, /다음 카드 고르기/);
assert.match(candidate, /오늘 대화 마치기/);
assert.match(candidate, /같은 덱 다시 섞기/);
assert.doesNotMatch(candidate, /data-action="(?:next-card|previous-card)"/);
assert.doesNotMatch(pilotView, /\.next\(|\.previous\(|position\s*\+=\s*1/);

assert.match(pilotView, /const PILOT_THEME_IDS = Object\.freeze\(\["ice", "memory"\]\)/);
for (const nonPilot of ["taste", "lately", "talk", "work", "value", "courage", "tmi", "recharge", "future", "kind"]) {
  assert.doesNotMatch(pilotView, new RegExp(`PILOT_THEME_IDS[^;]*["']${nonPilot}["']`));
}

const createBackSource = pilotView.slice(
  pilotView.indexOf("function createCardBack"),
  pilotView.indexOf("function createUsedSlot")
);
assert.ok(createBackSource.length > 0);
assert.doesNotMatch(createBackSource, /card\.(?:text|image|alt|prompt|followup)/);
assert.match(createBackSource, /아직 열지 않음/);
assert.match(pilotView, /이미 사용함/);
assert.match(pilotView, /state\.engine\.selectCard/);
assert.match(pilotView, /state\.engine\.revealSelected/);
assert.match(pilotView, /state\.engine\.returnToTable/);
assert.match(pilotView, /state\.engine\.openPrompt/);
assert.match(pilotView, /event\.key !== "Escape"/);
assert.match(pilotView, /restorePilotSession/);
assert.match(pilotView, /TALKCARD_PICK_SESSION_KEY/);

for (const card of TEXT_CARDS.filter((item) => item.theme === "ice")) {
  assert.ok(!candidate.includes(card.text), `${card.id} question must not be present in static HTML`);
}
for (const card of IMAGE_CARDS.filter((item) => item.theme === "memory")) {
  assert.ok(!candidate.includes(card.image), `${card.id} image path must not be present before selection`);
  assert.ok(!candidate.includes(card.prompt), `${card.id} prompt must not be present in static HTML`);
  assert.ok(!candidate.includes(card.followup), `${card.id} follow-up must not be present in static HTML`);
}

assert.match(candidate, /id="optional-prompt"[^>]* hidden/);
assert.match(candidate, /id="followup-panel" hidden/);
assert.match(candidate, /id="open-prompt"[^>]*data-action="open-prompt" hidden/);
assert.match(candidate, /id="picked-image"[\s\S]*loading="eager"[\s\S]*decoding="async"[\s\S]*fetchpriority="high"/);
assert.equal((candidate.match(/<img\b/g) ?? []).length, 1, "Only the selected-card image element may exist in Pilot HTML");

assert.match(pickEngine, /tableSlots/);
assert.match(pickEngine, /used\.includes\(cardId\)/);
assert.match(pickEngine, /selectedCard = null/);
assert.match(pickEngine, /promptLevel = Math\.min/);
assert.doesNotMatch(pickEngine, /position\s*\+=\s*1/);

assert.match(pilotCss, /grid-template-columns: repeat\(5,/);
assert.match(pilotCss, /@media \(max-width: 768px\)/);
assert.match(pilotCss, /grid-template-columns: repeat\(3,/);
assert.match(pilotCss, /@media \(max-width: 430px\)/);
assert.match(pilotCss, /@media \(max-width: 390px\)/);
assert.match(pilotCss, /min-width: 44px/);
assert.match(pilotCss, /prefers-reduced-motion: reduce/);
assert.match(baseCss, /:focus-visible/);
assert.match(baseCss, /safe-area-inset-top/);

let braceDepth = 0;
for (const character of pilotCss.replaceAll(/\/\*[\s\S]*?\*\//g, "")) {
  if (character === "{") braceDepth += 1;
  if (character === "}") braceDepth -= 1;
  assert.ok(braceDepth >= 0, "Pilot CSS cannot close more blocks than it opens");
}
assert.equal(braceDepth, 0, "Pilot CSS braces must balance");

console.log(JSON.stringify({
  run: "R03 CARD TABLE PROTOTYPE — STATIC",
  status: "PASS",
  pilotDecks: ["T01", "I01"],
  preserved: {
    themes: THEMES.length,
    textCards: TEXT_CARDS.length,
    imageCards: IMAGE_CARDS.length,
    uniqueIds: 180,
    imageAssets: 60,
    productionIndexCreated: false,
    v2CandidateChanged: false,
  },
  checks: {
    cardBackBeforeContent: "PASS",
    directPickAction: "PASS",
    usedState: "PASS",
    returnToTable: "PASS",
    noAutomaticNext: "PASS",
    imageFirst: "PASS",
    optionalPrompt: "PASS",
    optionalFollowup: "PASS",
    earlyClosing: "PASS",
    sessionRestore: "PASS",
    keyboardEscape: "PASS",
    mobileThreeColumnRules: "PASS",
    reducedMotion: "PASS",
  },
}, null, 2));
