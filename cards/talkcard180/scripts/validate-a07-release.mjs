import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const bytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const size = (relativePath) => fs.statSync(path.join(root, relativePath)).size;
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
  const valueEnd = source.indexOf(`\n\nexport const ${nextExportName}`, valueStart);
  if (valueEnd < 0) return [];
  return JSON.parse(source.slice(valueStart, valueEnd).replace(/;\s*$/, ""));
}

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    return value / 4_294_967_296;
  };
}

const html = read("index-v2.html");
const css = read("css/talkcard.css");
const view = read("js/talkcard-view.js");
const engineSource = read("js/talkcard-engine.js");
const themes = readExportedJson("data/themes.js", "THEMES", "THEME_BY_ID");
const sourceTextCards = readExportedJson("data/cards.js", "TEXT_CARDS", "IMAGE_CARD_SLOTS");
const manifest = JSON.parse(read("data/image-card-manifest.json"));
const runtime = await import(moduleUrl(read("data/runtime-cards.js")));
const { TalkCardDeckEngine } = await import(moduleUrl(engineSource));

const expectedTextCards = sourceTextCards.map(({ id, theme, type, text }) => ({ id, theme, type, text }));
const expectedImageCards = manifest.cards.map(({ id, theme, image, alt, prompt, followup }) => ({
  id,
  theme,
  type: "image",
  image,
  alt,
  prompt,
  followup,
}));
const runtimeTextCards = [...runtime.TEXT_CARDS];
const runtimeImageCards = [...runtime.IMAGE_CARDS];
const runtimeCards = [...runtimeTextCards, ...runtimeImageCards];

assert(
  JSON.stringify(runtimeTextCards) === JSON.stringify(expectedTextCards),
  "RUNTIME_TEXT_SOURCE_EQUALITY",
  "the 120 runtime text cards must be an exact field projection of the locked A01 source",
);
assert(
  JSON.stringify(runtimeImageCards) === JSON.stringify(expectedImageCards),
  "RUNTIME_IMAGE_SOURCE_EQUALITY",
  "the 60 runtime image cards must be an exact field projection of the approved manifest",
);
assert(runtimeTextCards.length === 120, "RUNTIME_TEXT_COUNT", `expected 120, received ${runtimeTextCards.length}`);
assert(runtimeImageCards.length === 60, "RUNTIME_IMAGE_COUNT", `expected 60, received ${runtimeImageCards.length}`);
assert(runtimeCards.length === 180, "RUNTIME_TOTAL_COUNT", `expected 180, received ${runtimeCards.length}`);
assert(new Set(runtimeCards.map((card) => card.id)).size === 180, "RUNTIME_ID_UNIQUENESS", "all runtime IDs must be unique");
assert(themes.length === 12, "THEME_COUNT", `expected 12, received ${themes.length}`);

for (const theme of themes) {
  assert(
    runtimeCards.filter((card) => card.theme === theme.id).length === 15,
    `RUNTIME_DECK_${theme.id.toUpperCase()}`,
    `${theme.label} must contain exactly 15 runtime cards`,
  );
}

assert(
  runtimeImageCards.every((card) => exists(card.image)),
  "IMAGE_ASSET_COMPLETENESS",
  "all 60 runtime image paths must resolve to local WebP assets",
);

const sourceDataBytes = size("data/cards.js") + size("data/image-card-manifest.json");
const runtimeDataBytes = size("data/runtime-cards.js");
assert(
  runtimeDataBytes < sourceDataBytes * 0.55,
  "RUNTIME_DATA_REDUCTION",
  `runtime ${runtimeDataBytes} bytes; source payload ${sourceDataBytes} bytes`,
);
assert(
  view.includes('import { IMAGE_CARDS, TEXT_CARDS } from "../data/runtime-cards.js"'),
  "RUNTIME_DATA_IMPORT",
  "the browser view must import the lean runtime projection",
);
assert(!view.includes("../data/cards.js"), "NO_A01_BROWSER_IMPORT", "the full A01 registry must not ship to the browser");
assert(!view.includes("image-card-manifest.json"), "NO_MANIFEST_BROWSER_LOAD", "the full authoring manifest must not load at runtime");
assert(!view.includes("fetch("), "NO_RUNTIME_DATA_FETCH", "runtime data must not require an additional manifest fetch");

const imageThemeIds = themes.filter((theme) => theme.type === "image").map((theme) => theme.id);
const expectedThumbnailIds = imageThemeIds.flatMap((themeId) => [1, 6, 11].map((value) => `${themeId}_${String(value).padStart(2, "0")}`));
const thumbnailFiles = expectedThumbnailIds.map((id) => {
  const themeId = id.replace(/_\d+$/, "");
  return `assets/images/${themeId}/thumbs/${id}.webp`;
});
const actualThumbnailFiles = fs
  .readdirSync(path.join(root, "assets/images"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const thumbnailDir = path.join(root, "assets/images", entry.name, "thumbs");
    if (!fs.existsSync(thumbnailDir)) return [];
    return fs.readdirSync(thumbnailDir).map((filename) => `assets/images/${entry.name}/thumbs/${filename}`);
  })
  .sort();

assert(
  JSON.stringify(actualThumbnailFiles) === JSON.stringify([...thumbnailFiles].sort()),
  "THUMBNAIL_FILE_SET",
  "only the locked 01/06/11 preview thumbnails must exist for each image deck",
);

const thumbnailHashes = new Set();
let thumbnailBytes = 0;
let correspondingOriginalBytes = 0;
for (const relativePath of thumbnailFiles) {
  assert(exists(relativePath), `THUMB_${path.basename(relativePath).toUpperCase()}`, `${relativePath} must exist`);
  if (!exists(relativePath)) continue;
  const dimensions = execFileSync("identify", ["-format", "%w %h %m", path.join(root, relativePath)], {
    encoding: "utf8",
  }).trim();
  assert(dimensions === "360 450 WEBP", `THUMB_FORMAT_${path.basename(relativePath).toUpperCase()}`, `${relativePath}: ${dimensions}`);
  thumbnailHashes.add(crypto.createHash("sha256").update(bytes(relativePath)).digest("hex"));
  thumbnailBytes += size(relativePath);
  const originalPath = relativePath.replace("/thumbs/", "/");
  correspondingOriginalBytes += size(originalPath);
}

assert(thumbnailHashes.size === 12, "THUMBNAIL_HASH_UNIQUENESS", "the 12 preview thumbnails must be visually distinct files");
assert(
  thumbnailBytes < correspondingOriginalBytes * 0.2,
  "THUMBNAIL_TRANSFER_REDUCTION",
  `thumbnails ${thumbnailBytes} bytes; matching originals ${correspondingOriginalBytes} bytes`,
);
assert(view.includes('image.loading = "lazy"'), "THUMBNAIL_LAZY_LOAD", "theme and intro thumbnails must lazy load");
assert(view.includes('image.decoding = "async"'), "THUMBNAIL_ASYNC_DECODE", "theme and intro thumbnails must decode asynchronously");
assert(view.includes("getThumbnailPath(card)"), "THUMBNAIL_VIEW_BINDING", "preview cards must use thumbnails instead of full assets");

assert(view.includes("preloadUpcomingImages(state.engine.peekNext(2))"), "NEXT_TWO_PRELOAD", "image play must preload at most the next two cards");
assert(view.includes("const preloadedImages = new Map()"), "PRELOAD_DEDUPLICATION", "preloads must be deduplicated by image path");
assert(engineSource.includes("peekNext(limit = 2)"), "ENGINE_PEEK_API", "the engine must expose a bounded look-ahead API");

const imageDeck = runtimeImageCards.filter((card) => card.theme === imageThemeIds[0]);
const peekEngine = new TalkCardDeckEngine({
  cards: imageDeck,
  themeId: imageThemeIds[0],
  cardType: "image",
  storage: null,
  random: seededRandom(707),
});
const started = peekEngine.start({ resume: false });
const peeked = peekEngine.peekNext(2);
assert(peeked.length === 2, "ENGINE_PEEK_TWO", `expected 2, received ${peeked.length}`);
assert(
  JSON.stringify(peeked.map((card) => card.id)) === JSON.stringify(started.order.slice(1, 3)),
  "ENGINE_PEEK_ORDER",
  "look-ahead cards must match the next two shuffled positions",
);
assert(peekEngine.peekNext(99).length === 2, "ENGINE_PEEK_CAP", "look-ahead must remain capped at two cards");
assert(peekEngine.peekNext(-1).length === 0, "ENGINE_PEEK_NEGATIVE", "negative look-ahead must return no cards");
peekEngine.drawExtra();
assert(peekEngine.peekNext(2).length === 0, "ENGINE_PEEK_EXTRA_MODE", "extra-card mode must not preload a new cycle");

const preloadLinks = html.match(/<link\s+[\s\S]*?rel="preload"[\s\S]*?>/g) ?? [];
assert(preloadLinks.length === 1, "OPENING_PRELOAD_COUNT", `expected 1 opening preload, received ${preloadLinks.length}`);
assert(
  html.includes('href="assets/images/memory/thumbs/memory_11.webp"'),
  "OPENING_PRELOAD_THUMBNAIL",
  "opening must preload the visible thumbnail, not a full card image",
);
assert(html.includes('id="image-card-art"'), "ACTIVE_IMAGE_ELEMENT", "image play needs one active image element");
assert(html.includes('loading="eager"'), "ACTIVE_IMAGE_EAGER", "the current image card must load eagerly");
assert(html.includes('decoding="async"'), "ACTIVE_IMAGE_ASYNC_DECODE", "the current image card must decode asynchronously");
assert(html.includes('fetchpriority="high"'), "ACTIVE_IMAGE_PRIORITY", "the current image card must receive high fetch priority");
assert(
  /\.image-frame img\s*\{[^}]*height:\s*auto;/s.test(css),
  "ACTIVE_IMAGE_ASPECT_RATIO",
  "the active image must override HTML height hints and preserve the 1122:1402 source ratio",
);

assert(html.includes('<meta name="robots" content="noindex, nofollow"'), "STAGING_NOINDEX", "the hidden v2 candidate must remain noindex before release");
assert(
  html.includes('content="https://daily-coach-ing.com/cards/talkcard180/docs/a04/A04_IMAGE_DECKS_60_BOARD.webp"'),
  "ABSOLUTE_OG_IMAGE",
  "OG image must use an absolute public URL",
);
assert(!exists("index.html"), "PRODUCTION_INDEX_LOCK", "A07 static work must not create or overwrite the production index");

assert(html.includes("본문으로 건너뛰기"), "SKIP_LINK", "a skip link must be present");
assert(html.includes('aria-live="polite"'), "ARIA_LIVE", "progress and card changes need polite announcements");
assert(view.includes("imageCardArt.alt = card.alt"), "OBJECTIVE_ALT_BINDING", "approved objective alt text must bind to the active image");
assert(view.includes('imageCardArt.addEventListener("error"'), "IMAGE_FAILURE_FALLBACK", "image failures must expose fallback content");
assert(view.includes("playCard.dataset.cardId = card.id"), "QA_CARD_ID_HOOK", "active card IDs must be observable for no-repeat E2E QA");
assert(css.includes(":focus-visible"), "FOCUS_VISIBLE", "keyboard focus must be visibly styled");
assert(css.includes("prefers-reduced-motion: reduce"), "REDUCED_MOTION", "reduced motion must be supported");
assert(css.includes("env(safe-area-inset-bottom)"), "SAFE_AREA", "mobile safe-area padding must be present");
for (const width of [390, 560, 768, 1040]) {
  assert(css.includes(`max-width: ${width}px`), `RESPONSIVE_${width}`, `responsive rule for ${width}px must exist`);
}
assert(css.includes("orientation: landscape"), "LANDSCAPE_RULE", "landscape-specific card bounds must be present");

const result = {
  run: "A07 PERFORMANCE / QA / RELEASE — STATIC",
  status: errors.length === 0 ? "PASS" : "FAIL",
  releaseStatus: "NOT_RELEASED",
  browserQa: "PENDING_STAGING_DEPLOYMENT",
  coreWebVitals: "BLOCKED_CHROME_DEVTOOLS_MCP_UNAVAILABLE",
  summary: {
    checks: checks.length,
    passed: checks.filter((check) => check.status === "PASS").length,
    failed: checks.filter((check) => check.status === "FAIL").length,
    themes: themes.length,
    runtimeTextCards: runtimeTextCards.length,
    runtimeImageCards: runtimeImageCards.length,
    runtimeTotalCards: runtimeCards.length,
    runtimeDataBytes,
    sourceDataBytes,
    thumbnailCount: thumbnailFiles.length,
    thumbnailBytes,
    correspondingOriginalBytes,
  },
  checks,
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
