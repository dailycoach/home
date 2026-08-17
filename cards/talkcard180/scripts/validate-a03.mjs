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

const expectedIds = [
  "memory_01",
  "memory_06",
  "memory_13",
  "recharge_01",
  "recharge_05",
  "recharge_15",
  "future_02",
  "future_03",
  "future_06",
  "kind_01",
  "kind_08",
  "kind_14",
];

const manifest = JSON.parse(fs.readFileSync(path.join(root, "data/image-card-manifest.json"), "utf8"));
const master = JSON.parse(fs.readFileSync(path.join(root, "data/visual-master-a03.json"), "utf8"));
const expectedFromManifest = manifest.cards
  .filter((card) => card.pilotCandidate)
  .map((card) => card.id);

assert(JSON.stringify(expectedFromManifest) === JSON.stringify(expectedIds), "pilot candidate order differs from A02 manifest");
assert(master.status === "REVIEW_READY_A04_BLOCKED", "A04 gate status is not locked");
assert(master.cards.length === 12, `visual master registry has ${master.cards.length} cards`);

const hashes = [];
let totalBytes = 0;
for (const id of expectedIds) {
  const theme = id.split("_")[0];
  const relativePath = `assets/images/${theme}/${id}.webp`;
  const assetPath = path.join(root, relativePath);
  assert(fs.existsSync(assetPath), `${id}: asset missing`);
  if (!fs.existsSync(assetPath)) continue;

  const bytes = fs.readFileSync(assetPath);
  const stat = fs.statSync(assetPath);
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const dimensions = execFileSync("identify", ["-format", "%w %h", assetPath], { encoding: "utf8" }).trim();
  const registered = master.cards.find((card) => card.id === id);

  totalBytes += stat.size;
  hashes.push(hash);
  assert(stat.size > 20_000, `${id}: suspiciously small asset (${stat.size} bytes)`);
  assert(dimensions === "1122 1402", `${id}: dimensions are ${dimensions}`);
  assert(registered, `${id}: missing visual master registry entry`);
  if (registered) {
    assert(registered.asset === relativePath, `${id}: registry asset path mismatch`);
    assert(registered.bytes === stat.size, `${id}: registry byte size mismatch`);
    assert(registered.sha256 === hash, `${id}: registry hash mismatch`);
    assert(registered.manualQa === "PASS", `${id}: manual QA is not PASS`);
  }
}

assert(new Set(hashes).size === 12, "pilot image hashes are not unique");

const boardPath = path.join(root, "docs/a03/A03_VISUAL_MASTER_PILOT_BOARD.webp");
assert(fs.existsSync(boardPath), "review board missing");
if (fs.existsSync(boardPath)) {
  const boardDimensions = execFileSync("identify", ["-format", "%w %h", boardPath], { encoding: "utf8" }).trim();
  assert(boardDimensions === "780 1464", `review board dimensions are ${boardDimensions}`);
  assert(fs.statSync(boardPath).size > 20_000, "review board is suspiciously small");
}

const report = {
  status: errors.length === 0 ? "PASS" : "FAIL",
  pilotCount: expectedIds.length,
  perDeck: {
    memory: expectedIds.filter((id) => id.startsWith("memory_")).length,
    recharge: expectedIds.filter((id) => id.startsWith("recharge_")).length,
    future: expectedIds.filter((id) => id.startsWith("future_")).length,
    kind: expectedIds.filter((id) => id.startsWith("kind_")).length,
  },
  dimensions: "1122x1402",
  format: "webp",
  uniqueHashes: new Set(hashes).size,
  totalBytes,
  board: "780x1464",
  a04Gate: "PENDING USER APPROVAL",
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) process.exitCode = 1;
