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

const expectedIds = Array.from({ length: 15 }, (_, index) => `recharge_${String(index + 1).padStart(2, "0")}`);
const pilotIds = ["recharge_01", "recharge_05", "recharge_15"];
const generatedIds = expectedIds.filter((id) => !pilotIds.includes(id));
const normalizedCanvasIds = ["recharge_07", "recharge_10", "recharge_11"];

const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/image-card-manifest.json"), "utf8"));
const memoryRegistry = JSON.parse(fs.readFileSync(path.join(root, "data/a04-batch1-memory.json"), "utf8"));
const registry = JSON.parse(fs.readFileSync(path.join(root, "data/a04-batch2-recharge.json"), "utf8"));
const rechargeManifest = manifest.cards.filter((card) => card.theme === "recharge");

assert(memoryRegistry.status === "BATCH_1_COMPLETE_BATCH_2_BLOCKED", "A04 Batch 1 registry changed unexpectedly");
assert(registry.status === "BATCH_2_COMPLETE_BATCH_3_BLOCKED", "A04 Batch 3 gate is not locked");
assert(JSON.stringify(registry.inheritedPilotIds) === JSON.stringify(pilotIds), "pilot ID set differs");
assert(JSON.stringify(registry.generatedIds) === JSON.stringify(generatedIds), "generated ID set differs");
assert(JSON.stringify(registry.allIds) === JSON.stringify(expectedIds), "full recharge ID set differs");
assert(JSON.stringify(registry.qa.normalizedCanvasIds) === JSON.stringify(normalizedCanvasIds), "normalized canvas ID set differs");
assert(rechargeManifest.length === 15, `recharge manifest has ${rechargeManifest.length} cards`);
assert(JSON.stringify(rechargeManifest.map((card) => card.id)) === JSON.stringify(expectedIds), "recharge manifest order or IDs differ");
assert(registry.cards.length === 15, `A04 Batch 2 registry has ${registry.cards.length} cards`);

const hashes = [];
let fullDeckBytes = 0;
let newAssetBytes = 0;

for (const id of expectedIds) {
  const relativePath = `assets/images/recharge/${id}.webp`;
  const assetPath = path.join(root, relativePath);
  const manifestCard = rechargeManifest.find((card) => card.id === id);
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
  hashes.push(hash);

  assert(stat.size > 20_000, `${id}: suspiciously small asset (${stat.size} bytes)`);
  assert(dimensions === "1122 1402 WEBP", `${id}: dimensions or format are ${dimensions}`);
  assert(registered, `${id}: missing A04 Batch 2 registry entry`);
  if (registered) {
    assert(registered.asset === relativePath, `${id}: registry asset path mismatch`);
    assert(registered.bytes === stat.size, `${id}: registry byte size mismatch`);
    assert(registered.sha256 === hash, `${id}: registry hash mismatch`);
    assert(registered.manualQa === "PASS", `${id}: manual QA is not PASS`);
  }
}

assert(new Set(hashes).size === 15, "recharge image hashes are not unique");
assert(registry.qa.newAssetBytes === newAssetBytes, "new asset byte total differs");
assert(registry.qa.fullDeckBytes === fullDeckBytes, "full deck byte total differs");

const boardPath = path.join(root, "docs/a04/A04_BATCH2_RECHARGE_DECK_BOARD.webp");
assert(fs.existsSync(boardPath), "recharge review board missing");
if (fs.existsSync(boardPath)) {
  const boardDimensions = execFileSync("identify", ["-format", "%w %h %m", boardPath], { encoding: "utf8" }).trim();
  assert(boardDimensions === "1040 912 WEBP", `review board dimensions or format are ${boardDimensions}`);
  assert(fs.statSync(boardPath).size > 20_000, "review board is suspiciously small");
}

const producedByTheme = Object.fromEntries(["memory", "recharge", "future", "kind"].map((theme) => {
  const dir = path.join(root, `assets/images/${theme}`);
  const ids = fs.readdirSync(dir).filter((name) => name.endsWith(".webp")).sort();
  return [theme, ids];
}));

assert(producedByTheme.memory.length === 15, "memory Batch 1 deck is incomplete");
assert(producedByTheme.recharge.length === 15, "recharge Batch 2 deck is incomplete");
assert(producedByTheme.future.length === 3, "future Batch 3 assets were added early");
assert(producedByTheme.kind.length === 3, "kind Batch 4 assets were added early");

const report = {
  status: errors.length === 0 ? "PASS" : "FAIL",
  run: "A04 IMAGE PRODUCTION · BATCH 2 RECHARGE",
  rechargeCards: expectedIds.length,
  inheritedPilots: pilotIds.length,
  newAssets: generatedIds.length,
  dimensions: "1122x1402",
  format: "webp",
  uniqueHashes: new Set(hashes).size,
  newAssetBytes,
  fullDeckBytes,
  board: "1040x912 WEBP",
  manualBoardReview: registry.qa.manualBoardReview,
  regeneratedCards: registry.qa.regeneratedCards,
  normalizedCanvasCards: normalizedCanvasIds.length,
  producedAssetCounts: Object.fromEntries(Object.entries(producedByTheme).map(([theme, ids]) => [theme, ids.length])),
  nextBatchGate: "BLOCKED UNTIL USER CONTINUES",
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exitCode = 1;

