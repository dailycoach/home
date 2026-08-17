import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const manifestPath = path.join(root, "data/image-card-manifest.json");
const runtimePath = path.join(root, "data/runtime-cards.js");
const reportPath = path.join(root, "docs/recovery/R01_IMAGE_QUESTION_AUDIT.md");

const EXPECTED_HASHES = Object.freeze({
  manifest: "8507a2ecf6209d87d4313e2081cdd968b6d774b1b161035bc526af7bdfe94a9f",
  runtime: "65b4d47cec1572ddaf31903d5dd31e087af0986e6898510edd6c1386aa73f518",
});

function sha256(source) {
  return createHash("sha256").update(source).digest("hex");
}

const [manifestSource, runtimeSource, report] = await Promise.all([
  readFile(manifestPath, "utf8"),
  readFile(runtimePath, "utf8"),
  readFile(reportPath, "utf8"),
]);

assert.equal(sha256(manifestSource), EXPECTED_HASHES.manifest, "R01 must not change the image manifest");
assert.equal(sha256(runtimeSource), EXPECTED_HASHES.runtime, "R01 must not change runtime card data");

const manifest = JSON.parse(manifestSource);
assert.equal(manifest.cards.length, 60, "The authoring manifest must retain 60 image cards");
assert.equal(new Set(manifest.cards.map((card) => card.id)).size, 60, "Manifest image IDs must remain unique");
assert.ok(manifest.cards.every((card) => card.followup?.trim()), "All 60 follow-ups must remain present");

const auditRows = report
  .split("\n")
  .filter((line) => /^\| (memory|recharge|future|kind)_\d{2} \|/.test(line))
  .map((line) => {
    const columns = line.split("|").slice(1, -1).map((column) => column.trim());
    const [id, currentPrompt, decision, proposedPrompt, failedChecks, rationale] = columns;
    return { id, currentPrompt, decision, proposedPrompt, failedChecks, rationale };
  });

assert.equal(auditRows.length, 60, "The report must include exactly 60 card audit rows");
assert.equal(new Set(auditRows.map((row) => row.id)).size, 60, "Every audit row needs a unique card ID");

const manifestById = new Map(manifest.cards.map((card) => [card.id, card]));
const allowedDecisions = new Set(["KEEP", "SOFTEN", "REWRITE"]);

for (const row of auditRows) {
  const card = manifestById.get(row.id);
  assert.ok(card, `Unknown audit ID: ${row.id}`);
  assert.equal(row.currentPrompt, card.prompt, `${row.id} current prompt must exactly match the locked manifest`);
  assert.ok(allowedDecisions.has(row.decision), `${row.id} needs a valid decision`);
  assert.ok(row.proposedPrompt, `${row.id} needs a proposed R07 prompt`);
  assert.ok(row.rationale, `${row.id} needs an audit rationale`);
  if (row.decision === "KEEP") {
    assert.equal(row.proposedPrompt, row.currentPrompt, `${row.id} KEEP must preserve the original wording`);
    assert.equal(row.failedChecks, "—", `${row.id} KEEP cannot list a failed check`);
  } else {
    assert.notEqual(row.proposedPrompt, row.currentPrompt, `${row.id} ${row.decision} needs changed wording`);
    assert.match(row.failedChecks, /^Q[2-5]/, `${row.id} ${row.decision} must identify a current QA gap`);
  }
}

for (const card of manifest.cards) {
  assert.ok(auditRows.some((row) => row.id === card.id), `Missing audit row: ${card.id}`);
}

const decisions = Object.fromEntries(
  [...allowedDecisions].map((decision) => [decision, auditRows.filter((row) => row.decision === decision).length])
);
assert.deepEqual(decisions, { KEEP: 34, SOFTEN: 14, REWRITE: 12 });

const byTheme = Object.fromEntries(
  ["memory", "recharge", "future", "kind"].map((theme) => [
    theme,
    Object.fromEntries(
      [...allowedDecisions].map((decision) => [
        decision,
        auditRows.filter((row) => row.id.startsWith(`${theme}_`) && row.decision === decision).length,
      ])
    ),
  ])
);

assert.deepEqual(byTheme, {
  memory: { KEEP: 6, SOFTEN: 8, REWRITE: 1 },
  recharge: { KEEP: 7, SOFTEN: 2, REWRITE: 6 },
  future: { KEEP: 9, SOFTEN: 2, REWRITE: 4 },
  kind: { KEEP: 12, SOFTEN: 2, REWRITE: 1 },
});

console.log(JSON.stringify({
  run: "R01 IMAGE QUESTION AUDIT",
  status: "PASS",
  auditedCards: auditRows.length,
  decisions,
  byTheme,
  sourceLocks: {
    imageManifest: "UNCHANGED",
    runtimeCards: "UNCHANGED",
    followupsPresent: manifest.cards.length,
  },
}, null, 2));
