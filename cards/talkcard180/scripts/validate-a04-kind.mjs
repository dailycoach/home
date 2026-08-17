import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

const themes = ["memory", "recharge", "future", "kind"];
const expectedIds = Array.from({ length: 15 }, (_, index) => `kind_${String(index + 1).padStart(2, "0")}`);
const pilotIds = ["kind_01", "kind_08", "kind_14"];
const generatedIds = expectedIds.filter((id) => !pilotIds.includes(id));
const normalizedCanvasIds = [];
const correctedCardIds = ["kind_15"];

const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/image-card-manifest.json"), "utf8"));
const memoryRegistry = JSON.parse(fs.readFileSync(path.join(root, "data/a04-batch1-memory.json"), "utf8"));
const rechargeRegistry = JSON.parse(fs.readFileSync(path.join(root, "data/a04-batch2-recharge.json"), "utf8"));
const futureRegistry = JSON.parse(fs.readFileSync(path.join(root, "data/a04-batch3-future.json"), "utf8"));
const registry = JSON.parse(fs.readFileSync(path.join(root, "data/a04-batch4-kind.json"), "utf8"));
const kindManifest = manifest.cards.filter((card) => card.theme === "kind");

assert(memoryRegistry.status === "BATCH_1_COMPLETE_BATCH_2_BLOCKED", "A04 Batch 1 registry changed unexpectedly");
assert(rechargeRegistry.status === "BATCH_2_COMPLETE_BATCH_3_BLOCKED", "A04 Batch 2 registry changed unexpectedly");
assert(futureRegistry.status === "BATCH_3_COMPLETE_BATCH_4_BLOCKED", "A04 Batch 3 registry changed unexpectedly");
assert(registry.status === "BATCH_4_COMPLETE_A04_COMPLETE_A05_BLOCKED", "A04 completion or A05 gate is not locked");
assert(JSON.stringify(registry.inheritedPilotIds) === JSON.stringify(pilotIds), "pilot ID set differs");
assert(JSON.stringify(registry.generatedIds) === JSON.stringify(generatedIds), "generated ID set differs");
assert(JSON.stringify(registry.allIds) === JSON.stringify(expectedIds), "full kind ID set differs");
assert(JSON.stringify(registry.qa.normalizedCanvasIds) === JSON.stringify(normalizedCanvasIds), "normalized canvas ID set differs");
assert(JSON.stringify(registry.qa.correctedCardIds) === JSON.stringify(correctedCardIds), "corrected card ID set differs");
assert(registry.qa.regeneratedCards === correctedCardIds.length, "corrected card count differs");
assert(kindManifest.length === 15, `kind manifest has ${kindManifest.length} cards`);
assert(JSON.stringify(kindManifest.map((card) => card.id)) === JSON.stringify(expectedIds), "kind manifest order or IDs differ");
assert(registry.cards.length === 15, `A04 Batch 4 registry has ${registry.cards.length} cards`);

const kindHashes = [];
let fullDeckBytes = 0;
let newAssetBytes = 0;

for (const id of expectedIds) {
  const relativePath = `assets/images/kind/${id}.webp`;
  const assetPath = path.join(root, relativePath);
  const manifestCard = kindManifest.find((card) => card.id === id);
  const registered = registry.cards.find((card) => card.id === id);

  assert(manifestCard?.image === relativePath, `${id}: A02 manifest asset path mismatch`);
  assert(fs.existsSync(assetPath), `${id}: asset missing`);
  if (!fs.existsSync(assetPath)) continue;

  const bytes = fs.readFileSync(assetPath);
  const stat = fs.statSync(assetPath);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const dimensions = execFileSync("identify", ["-format", "%w %h %m", assetPath], { encoding: "utf8" }).trim();

  fullDeckBytes += stat.size;
  if (generatedIds.includes(id)) newAssetBytes += stat.size;
  kindHashes.push(hash);

  assert(stat.size > 20_000, `${id}: suspiciously small asset (${stat.size} bytes)`);
  assert(dimensions === "1122 1402 WEBP", `${id}: dimensions or format are ${dimensions}`);
  assert(registered, `${id}: missing A04 Batch 4 registry entry`);
  if (registered) {
    assert(registered.asset === relativePath, `${id}: registry asset path mismatch`);
    assert(registered.bytes === stat.size, `${id}: registry byte size mismatch`);
    assert(registered.sha256 === hash, `${id}: registry hash mismatch`);
    assert(registered.manualQa === "PASS", `${id}: manual QA is not PASS`);
  }
}

assert(new Set(kindHashes).size === 15, "kind image hashes are not unique");
assert(registry.qa.newAssetBytes === newAssetBytes, "new asset byte total differs");
assert(registry.qa.fullDeckBytes === fullDeckBytes, "full deck byte total differs");

const boardChecks = [
  ["docs/a04/A04_BATCH4_KIND_DECK_BOARD.webp", "1040 912 WEBP", "kind review board"],
  ["docs/a04/A04_IMAGE_DECKS_60_BOARD.webp", "1240 1092 WEBP", "all image decks board"],
];

for (const [relativePath, expectedDimensions, label] of boardChecks) {
  const boardPath = path.join(root, relativePath);
  assert(fs.existsSync(boardPath), `${label} missing`);
  if (!fs.existsSync(boardPath)) continue;
  const dimensions = execFileSync("identify", ["-format", "%w %h %m", boardPath], { encoding: "utf8" }).trim();
  assert(dimensions === expectedDimensions, `${label} dimensions or format are ${dimensions}`);
  assert(fs.statSync(boardPath).size > 20_000, `${label} is suspiciously small`);
}

const producedByTheme = {};
const allHashes = [];
let allImageBytes = 0;

for (const theme of themes) {
  const expectedThemeIds = Array.from({ length: 15 }, (_, index) => `${theme}_${String(index + 1).padStart(2, "0")}`);
  const dir = path.join(root, `assets/images/${theme}`);
  const filenames = fs.readdirSync(dir).filter((name) => name.endsWith(".webp")).sort();
  const expectedFilenames = expectedThemeIds.map((id) => `${id}.webp`);
  producedByTheme[theme] = filenames;

  assert(JSON.stringify(filenames) === JSON.stringify(expectedFilenames), `${theme}: image file set or order differs`);
  const themeManifest = manifest.cards.filter((card) => card.theme === theme);
  assert(themeManifest.length === 15, `${theme}: manifest does not contain 15 cards`);

  for (const filename of filenames) {
    const assetPath = path.join(dir, filename);
    const bytes = fs.readFileSync(assetPath);
    const stat = fs.statSync(assetPath);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const dimensions = execFileSync("identify", ["-format", "%w %h %m", assetPath], { encoding: "utf8" }).trim();

    allImageBytes += stat.size;
    allHashes.push(hash);
    assert(dimensions === "1122 1402 WEBP", `${theme}/${filename}: dimensions or format are ${dimensions}`);
    assert(stat.size > 20_000, `${theme}/${filename}: suspiciously small asset (${stat.size} bytes)`);
  }
}

assert(allHashes.length === 60, `A04 produced ${allHashes.length} image cards instead of 60`);
assert(new Set(allHashes).size === 60, "A04 image card hashes are not unique");
assert(registry.qa.allImageCards === allHashes.length, "A04 image card total differs from registry");
assert(registry.qa.allImageBytes === allImageBytes, "A04 image byte total differs from registry");
assert(registry.qa.allImageUniqueHashes === new Set(allHashes).size, "A04 unique hash total differs from registry");

const report = {
  status: errors.length === 0 ? "PASS" : "FAIL",
  run: "A04 IMAGE PRODUCTION · BATCH 4 KIND",
  a04Status: errors.length === 0 ? "COMPLETE" : "BLOCKED",
  kindCards: expectedIds.length,
  inheritedPilots: pilotIds.length,
  newAssets: generatedIds.length,
  dimensions: "1122x1402",
  format: "webp",
  uniqueHashes: new Set(kindHashes).size,
  newAssetBytes,
  fullDeckBytes,
  deckBoard: "1040x912 WEBP",
  allImageDecksBoard: "1240x1092 WEBP",
  manualBoardReview: registry.qa.manualBoardReview,
  regeneratedCards: registry.qa.regeneratedCards,
  correctedCardIds,
  normalizedCanvasCards: normalizedCanvasIds.length,
  producedAssetCounts: Object.fromEntries(Object.entries(producedByTheme).map(([theme, filenames]) => [theme, filenames.length])),
  allImageCards: allHashes.length,
  allImageBytes,
  allImageUniqueHashes: new Set(allHashes).size,
  nextRunGate: "A05 BLOCKED UNTIL USER CONTINUES",
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exitCode = 1;
