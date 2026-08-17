import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const errors = [];
const checks = [];

function assert(condition, name, detail) {
  checks.push({ name, status: condition ? "PASS" : "FAIL", detail });
  if (!condition) errors.push(`${name}: ${detail}`);
}

function readExportedJson(relativePath, exportName, nextExportName) {
  const source = read(relativePath);
  const marker = `export const ${exportName} = `;
  const start = source.indexOf(marker);
  if (start < 0) return [];
  const valueStart = start + marker.length;
  const nextMarker = `\n\nexport const ${nextExportName}`;
  const valueEnd = source.indexOf(nextMarker, valueStart);
  if (valueEnd < 0) return [];
  return JSON.parse(source.slice(valueStart, valueEnd).replace(/;\s*$/, ""));
}

const html = read("index-v2.html");
const css = read("css/talkcard.css");
const view = read("js/talkcard-view.js");
const a06EnginePresent = exists("js/talkcard-engine.js");
const themes = readExportedJson("data/themes.js", "THEMES", "THEME_BY_ID");
const textCards = readExportedJson("data/cards.js", "TEXT_CARDS", "IMAGE_CARD_SLOTS");
const manifest = JSON.parse(read("data/image-card-manifest.json"));

const requiredFiles = [
  "index-v2.html",
  "css/talkcard.css",
  "js/talkcard-view.js",
  "data/themes.js",
  "data/cards.js",
  "data/image-card-manifest.json",
  "legacy/index-v1.html",
];
assert(requiredFiles.every(exists), "A05_FILE_SET", "staging, view, data and legacy files must all exist");
assert(!exists("index.html"), "LIVE_FILE_LOCK", "A05 workspace must not introduce or overwrite production index.html");
assert(
  !a06EnginePresent || exists("scripts/validate-a06-engine.mjs"),
  "A06_ENGINE_TRANSITION",
  "a later A06 engine must include its dedicated validator",
);

assert(themes.length === 12, "THEME_COUNT", `expected 12, received ${themes.length}`);
assert(themes.filter((theme) => theme.type === "text").length === 8, "TEXT_THEME_COUNT", "expected 8 text themes");
assert(themes.filter((theme) => theme.type === "image").length === 4, "IMAGE_THEME_COUNT", "expected 4 image themes");
assert(textCards.length === 120, "TEXT_CARD_COUNT", `expected 120, received ${textCards.length}`);
assert(manifest.cards.length === 60, "IMAGE_CARD_COUNT", `expected 60, received ${manifest.cards.length}`);
assert(textCards.length + manifest.cards.length === 180, "TOTAL_CARD_COUNT", "120 text + 60 image must equal 180");
assert(
  new Set([...textCards, ...manifest.cards].map((card) => card.id)).size === 180,
  "CARD_ID_UNIQUENESS",
  "all 180 card IDs must be unique",
);

for (const theme of themes) {
  const source = theme.type === "text" ? textCards : manifest.cards;
  assert(
    source.filter((card) => card.theme === theme.id).length === 15,
    `DECK_${theme.id.toUpperCase()}_COUNT`,
    `${theme.label} must contain 15 cards`,
  );
}

assert(
  manifest.cards.every((card) => card.alt && card.prompt && card.followup && exists(card.image)),
  "IMAGE_CONTENT_READY",
  "every image card needs an asset, objective alt, prompt and follow-up",
);

const expectedTitle = "톡카드180 | TALK CARD 180 | DAILYCOACHING";
const expectedDescription =
  "서로를 조금 더 알고 싶은 순간을 위한 180개의 대화 카드. 질문 120장과 이미지 카드 60장으로 새로운 대화를 시작해보세요.";
assert(html.includes(`<title>${expectedTitle}</title>`), "SEO_TITLE", "locked title must be present");
assert(html.includes(`content="${expectedDescription}"`), "SEO_DESCRIPTION", "locked description must be present");

const requiredScreens = ["opening", "themes", "intro", "play", "closing"];
for (const screen of requiredScreens) {
  const matches = html.match(new RegExp(`data-screen="${screen}"`, "g")) ?? [];
  assert(matches.length === 1, `SCREEN_${screen.toUpperCase()}`, `${screen} screen must exist exactly once`);
}

const requiredCopy = [
  "서로를 조금 더 알고 싶은 순간을 위한",
  "120개의 질문으로 말하고",
  "60개의 이미지로 발견한다.",
  "180 CARDS",
  "12 THEMES",
  "4 IMAGE DECKS",
  "PASS",
  "LISTEN",
  "NO RIGHT ANSWER",
  "오늘 조금 더 알게 된 것이 있나요?",
  "다른 테마 고르기",
  "한 장 더",
  "처음으로",
];
assert(requiredCopy.every((copy) => html.includes(copy)), "PRODUCT_COPY_LOCK", "all locked product and closing copy must exist");

const requiredActions = [
  "home",
  "show-themes",
  "select-theme",
  "start-deck",
  "previous-card",
  "next-card",
  "reveal-card",
  "one-more",
];
assert(
  requiredActions.every((action) => view.includes(`case "${action}"`) || html.includes(`data-action="${action}"`)),
  "FLOW_ACTIONS",
  "all five-screen navigation actions must be wired",
);

assert(view.includes('import { THEMES, THEME_BY_ID } from "../data/themes.js"'), "DATA_THEME_IMPORT", "view must import theme data");
assert(view.includes('import { TEXT_CARDS } from "../data/cards.js"'), "DATA_CARD_IMPORT", "view must import text card data");
assert(view.includes("fetch(IMAGE_MANIFEST_URL)"), "IMAGE_MANIFEST_LOAD", "view must load the locked image manifest");
assert(
  a06EnginePresent
    ? view.includes('import { TalkCardDeckEngine } from "./talkcard-engine.js"')
    : view.includes("state.deck = getCardsForTheme(state.theme.id).slice()"),
  "VIEW_DECK_SOURCE",
  "A05 source order or the later A06 engine must provide the deck sequence",
);
assert(!view.includes("Math.random"), "VIEW_ENGINE_SEPARATION", "the View must not implement random ordering directly");

assert(view.includes("imageQuestionPanel.hidden = level < 1"), "IMAGE_FIRST_FLOW", "image question must remain hidden before reveal");
assert(view.includes("followupPanel.hidden = level < 2"), "FOLLOWUP_FLOW", "follow-up must require a second reveal");
assert(view.includes("imageCardArt.alt = card.alt"), "OBJECTIVE_ALT_BINDING", "manifest alt must be bound to the active image");
assert(view.includes('imageCardArt.addEventListener("error"'), "IMAGE_FAILURE_FALLBACK", "image failure must expose a fallback");
assert(view.includes("previousCardButton.disabled"), "PREVIOUS_STATE", "previous card control must expose disabled state");
assert(view.includes("대화 마치기"), "CLOSING_TRANSITION", "last card must transition to a conversational closing");

assert(html.includes("본문으로 건너뛰기"), "SKIP_LINK", "a skip link must be present");
assert(html.includes('aria-live="polite"'), "ARIA_LIVE", "card changes need a polite live region");
assert(css.includes(":focus-visible"), "FOCUS_VISIBLE", "keyboard focus must be visibly styled");
assert(css.includes("prefers-reduced-motion: reduce"), "REDUCED_MOTION", "reduced motion must be supported");
assert(css.includes("env(safe-area-inset-bottom)"), "SAFE_AREA", "mobile bottom safe area must be respected");

for (const width of [390, 560, 768, 1040]) {
  assert(css.includes(`max-width: ${width}px`), `RESPONSIVE_${width}`, `responsive rule for ${width}px must exist`);
}
assert(css.includes("orientation: landscape"), "LANDSCAPE_RULE", "mobile landscape must have a bounded image/card treatment");
assert(!css.includes("rotateY("), "MOTION_NO_3D_FLIP", "3D card flip must not be used");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
assert(duplicateIds.length === 0, "HTML_ID_UNIQUENESS", `duplicate IDs: ${duplicateIds.join(", ") || "none"}`);

const result = {
  run: "A05 UX BUILD",
  status: errors.length === 0 ? "PASS" : "FAIL",
  summary: {
    checks: checks.length,
    passed: checks.filter((check) => check.status === "PASS").length,
    failed: checks.filter((check) => check.status === "FAIL").length,
    screens: requiredScreens.length,
    themes: themes.length,
    textCards: textCards.length,
    imageCards: manifest.cards.length,
    totalCards: textCards.length + manifest.cards.length,
  },
  checks,
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
