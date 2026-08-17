import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, resolve, sep } from "node:path";
import { IMAGE_CARDS } from "../data/runtime-cards.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const CHROMIUM_PATH = process.env.TALKCARD_CHROMIUM_PATH || "/tmp/chromium";
const SCREENSHOT_DIR = process.env.TALKCARD_SCREENSHOT_DIR || "/tmp/talkcard-v21-themeless-screens";
const PAGE_PATH = process.env.TALKCARD_PAGE_PATH || "/cards/talkcard180/index-v21.html";
const QA_FONT_ROOT = "/tmp/talkcard-browser/node_modules/@fontsource/noto-sans-kr";
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
};

if (!existsSync(CHROMIUM_PATH)) {
  throw new Error(`Chromium executable not found: ${CHROMIUM_PATH}`);
}
mkdirSync(SCREENSHOT_DIR, { recursive: true });

function startStaticServer() {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const isQaFont = decodedPath.startsWith("/__qa_font/");
    const servingRoot = isQaFont ? QA_FONT_ROOT : REPO_ROOT;
    const relativePath = isQaFont ? decodedPath.replace("/__qa_font", "") : decodedPath;
    const filePath = resolve(servingRoot, `.${relativePath}`);
    const rootPrefix = `${servingRoot}${sep}`;

    if (!(filePath === servingRoot || filePath.startsWith(rootPrefix)) || !existsSync(filePath)) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const stats = statSync(filePath);
    if (!stats.isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    if (filePath.endsWith(`${sep}index-v21.html`) || filePath.endsWith(`${sep}index.html`)) {
      const fontInjection = `
        <link rel="stylesheet" href="/__qa_font/korean-400.css" />
        <link rel="stylesheet" href="/__qa_font/korean-700.css" />
      `;
      const html = readFileSync(filePath, "utf8").replace("</head>", `${fontInjection}</head>`);
      response.writeHead(200, {
        "content-type": MIME_TYPES[extname(filePath)],
        "content-length": Buffer.byteLength(html),
        "cache-control": "no-store",
      });
      response.end(html);
      return;
    }

    response.writeHead(200, {
      "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
      "content-length": stats.size,
      "cache-control": "no-store",
    });
    createReadStream(filePath).pipe(response);
  });

  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveServer({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function expectScreen(page, name) {
  const screen = page.locator(`[data-screen="${name}"]`);
  await screen.waitFor({ state: "visible" });
  assert.equal(await screen.getAttribute("hidden"), null, `${name} must be the active screen`);
}

async function assertNoHorizontalOverflow(page, viewportWidth) {
  const sizes = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(sizes.body <= viewportWidth + 1, `body overflow: ${sizes.body} > ${viewportWidth}`);
  assert.ok(
    sizes.document <= viewportWidth + 1,
    `document overflow: ${sizes.document} > ${viewportWidth}`,
  );
}

async function imageHand(page) {
  return page.locator("#image-card-table .table-slot").evaluateAll((slots) =>
    slots.map((slot) => slot.querySelector(".table-card")?.dataset.cardId ?? null),
  );
}

function assertOnlySelectedSlotChanged(before, after, selectedSlot, selectedId) {
  assert.equal(after.length, 15, "image hand must retain 15 slots while the pool can refill it");
  assert.notEqual(after[selectedSlot], selectedId, "used image must leave its selected slot");
  assert.ok(after[selectedSlot], "the selected slot must be replenished from the remaining image pool");
  before.forEach((cardId, index) => {
    if (index !== selectedSlot) {
      assert.equal(after[index], cardId, `image slot ${index + 1} must remain stable`);
    }
  });
}

async function openDeckChoice(page) {
  await page.locator('[data-action="show-decks"]').first().click();
  await expectScreen(page, "decks");
}

async function chooseModeAndStart(page, mode) {
  await page.locator(`[data-action="select-mode"][data-mode="${mode}"]`).click();
  await expectScreen(page, "intro");
  await page.locator('[data-action="start-deck"]').click();
}

async function takeShot(page, viewport, name, paths) {
  if (viewport.width !== 390 && viewport.width !== 1440) return;
  const path = `${SCREENSHOT_DIR}/${viewport.width}x${viewport.height}-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  paths.push(path);
}

async function assertSessionIsContentFree(page) {
  const sessions = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith("talkcard180:v21:"))
        .map((key) => [key, JSON.parse(sessionStorage.getItem(key))]),
    ),
  );
  assert.ok(Object.keys(sessions).length > 0, "at least one v2.1 session must be stored");
  for (const session of Object.values(sessions)) {
    const serialized = JSON.stringify(session);
    assert.equal(serialized.includes('"themeId"'), false, "theme selection must not be stored");
    assert.equal(serialized.includes('"text"'), false, "question copy must not be stored");
    assert.equal(serialized.includes('"prompt"'), false, "image question must not be stored");
    assert.equal(serialized.includes('"followup"'), false, "image follow-up must not be stored");
  }
}

async function runViewport(browser, origin, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  const webpRequests = [];
  const screenshots = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    if (/\.webp(?:$|\?)/.test(request.url())) webpRequests.push(request.url());
  });

  const url = `${origin}${PAGE_PATH}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await expectScreen(page, "opening");
  assert.equal(webpRequests.length, 0, "opening must not request image faces");
  assert.equal(
    await page.locator(".theme-card, [data-theme-id]").count(),
    0,
    "themes must not exist in the participant UI",
  );
  assert.equal(
    await page.locator('[data-action="select-mode"]').count(),
    2,
    "only two deck modes must be offered",
  );
  await assertNoHorizontalOverflow(page, viewport.width);
  await takeShot(page, viewport, "opening", screenshots);

  await openDeckChoice(page);
  assert.equal(await page.locator(".mode-card").count(), 2, "deck choice must contain question and image only");
  assert.equal(await page.locator('[data-mode="questions"]').isVisible(), true);
  assert.equal(await page.locator('[data-mode="images"]').isVisible(), true);
  assert.equal(
    await page.locator('[data-screen="decks"] img').count(),
    0,
    "deck choice must not expose image faces",
  );
  await assertNoHorizontalOverflow(page, viewport.width);
  await takeShot(page, viewport, "two-decks", screenshots);

  // QUESTION 120: one shuffled fixed sequence, one visible question at a time.
  await page.locator('[data-mode="questions"]').click();
  await expectScreen(page, "intro");
  assert.equal(await page.locator("#intro-visual .intro-back-card").count(), 3);
  assert.equal(
    await page.locator("#intro-visual img").count(),
    0,
    "question intro must reveal no question content",
  );
  await page.locator('[data-action="start-deck"]').click();
  await expectScreen(page, "question");
  assert.equal((await page.locator("#question-progress").textContent()).trim(), "01 / 120");
  assert.ok((await page.locator("#question-text").textContent()).trim().length > 0);
  assert.equal(await page.locator('[data-action="next-question"]').count(), 1);
  assert.equal(await page.locator("#image-card-table .table-card").count(), 0);
  const firstQuestionId = await page.locator("#question-card").getAttribute("data-current-card-id");
  assert.ok(firstQuestionId, "first sequential question must have a preserved card ID");
  await assertSessionIsContentFree(page);
  await assertNoHorizontalOverflow(page, viewport.width);
  await takeShot(page, viewport, "question-01", screenshots);

  await page.locator('[data-action="next-question"]').click();
  await expectScreen(page, "question");
  assert.equal((await page.locator("#question-progress").textContent()).trim(), "02 / 120");
  const secondQuestionId = await page.locator("#question-card").getAttribute("data-current-card-id");
  assert.ok(
    secondQuestionId && secondQuestionId !== firstQuestionId,
    "the next question must advance without repeating",
  );

  await page.reload({ waitUntil: "networkidle" });
  await openDeckChoice(page);
  await chooseModeAndStart(page, "questions");
  await expectScreen(page, "question");
  assert.equal((await page.locator("#question-progress").textContent()).trim(), "02 / 120");
  assert.equal(
    await page.locator("#question-card").getAttribute("data-current-card-id"),
    secondQuestionId,
    "question session must restore its exact shuffled position",
  );

  // IMAGE 60: 15 backs, arbitrary user pick, image-only reveal, same-slot refill.
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(url, { waitUntil: "networkidle" });
  webpRequests.length = 0;
  await openDeckChoice(page);
  await page.locator('[data-mode="images"]').click();
  await expectScreen(page, "intro");
  assert.equal(await page.locator("#intro-visual .intro-back-card").count(), 3);
  assert.equal(
    await page.locator("#intro-visual img").count(),
    0,
    "image intro must show backs only",
  );
  assert.equal(webpRequests.length, 0, "image intro must not request image faces");
  await page.locator('[data-action="start-deck"]').click();
  await expectScreen(page, "table");
  assert.equal(await page.locator("#image-card-table .table-slot").count(), 15);
  assert.equal(await page.locator("#image-card-table .table-card").count(), 15);
  assert.equal((await page.locator("#image-table-progress").textContent()).trim(), "사용 00 / 60");
  assert.equal(webpRequests.length, 0, "unpicked image faces must stay unloaded");
  const expectedColumns = viewport.width <= 640 ? 3 : 5;
  const gridColumnCount = await page.locator("#image-card-table").evaluate((table) =>
    getComputedStyle(table).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  assert.equal(gridColumnCount, expectedColumns, `${viewport.width}px image table column count`);
  const tapRect = await page.locator("#image-card-table .table-card").first().boundingBox();
  assert.ok(
    tapRect.width >= 44 && tapRect.height >= 44,
    "image card tap target must be at least 44 × 44",
  );
  const beforeHand = await imageHand(page);
  await assertNoHorizontalOverflow(page, viewport.width);
  await takeShot(page, viewport, "image-table-00", screenshots);

  const pickedIndex = 7;
  const imageCards = page.locator("#image-card-table .table-card");
  await imageCards.nth(pickedIndex - 1).focus();
  await page.keyboard.press("Tab");
  const focusedId = await page.evaluate(() => document.activeElement?.dataset?.cardId ?? null);
  assert.equal(focusedId, beforeHand[pickedIndex], "Tab must move between image card backs");
  await page.keyboard.press("Space");
  await expectScreen(page, "image");
  await page.waitForFunction(() => {
    const image = document.querySelector("#image-card-art");
    return image?.complete && image.naturalWidth > 0;
  });
  await page.waitForTimeout(700);
  const selectedImageId = beforeHand[pickedIndex];
  assert.equal(
    await page.locator("#image-revealed-card").getAttribute("data-card-id"),
    selectedImageId,
  );
  assert.ok(
    (await page.locator("#image-card-art").getAttribute("alt"))?.trim().length > 0,
    "selected image must keep its ALT text",
  );
  const revealedImageRect = await page.locator("#image-card-art").boundingBox();
  assert.ok(revealedImageRect, "selected image must have a visible layout box");
  const revealedImageRatio = revealedImageRect.height / revealedImageRect.width;
  assert.ok(
    Math.abs(revealedImageRatio - 1402 / 1122) < 0.02,
    `selected image must keep its source card aspect ratio; got ${revealedImageRatio}`,
  );
  assert.equal(
    await page
      .locator(
        '#open-question, #image-question-panel, #followup-panel, [data-action="open-question"]',
      )
      .count(),
    0,
    "image question and follow-up controls must not exist",
  );
  assert.equal(
    (await page.locator("#image-revealed-card").innerText()).trim(),
    "",
    "the revealed image card must contain only the image",
  );
  const sourceCard = IMAGE_CARDS.find((card) => card.id === selectedImageId);
  assert.ok(sourceCard, "selected image must resolve to a preserved source card ID");
  const visibleBodyText = await page.locator("body").innerText();
  if (sourceCard.prompt) {
    assert.equal(
      visibleBodyText.includes(sourceCard.prompt),
      false,
      "image question copy must not enter the visible UI",
    );
  }
  if (sourceCard.followup) {
    assert.equal(
      visibleBodyText.includes(sourceCard.followup),
      false,
      "image follow-up copy must not enter the visible UI",
    );
  }
  assert.equal(new Set(webpRequests).size, 1, "only one selected image face may be requested");
  await assertSessionIsContentFree(page);
  await assertNoHorizontalOverflow(page, viewport.width);
  await takeShot(page, viewport, "image-only", screenshots);

  await page.keyboard.press("Escape");
  await expectScreen(page, "table");
  assert.equal((await page.locator("#image-table-progress").textContent()).trim(), "사용 01 / 60");
  assert.equal(await page.locator("#image-card-table .table-card").count(), 15);
  const afterHand = await imageHand(page);
  assertOnlySelectedSlotChanged(beforeHand, afterHand, pickedIndex, selectedImageId);
  assert.equal(afterHand.includes(selectedImageId), false, "used image must not remain selectable");
  await assertNoHorizontalOverflow(page, viewport.width);

  await page.reload({ waitUntil: "networkidle" });
  await openDeckChoice(page);
  await chooseModeAndStart(page, "images");
  await expectScreen(page, "table");
  assert.equal((await page.locator("#image-table-progress").textContent()).trim(), "사용 01 / 60");
  assert.deepEqual(await imageHand(page), afterHand, "image hand and slot positions must restore exactly");

  await page.locator('[data-screen="table"] [data-action="finish-conversation"]').click();
  await expectScreen(page, "closing");
  assert.equal((await page.locator("#closing-used").textContent()).trim(), "1");

  assert.deepEqual(pageErrors, [], `page errors at ${viewport.width}px`);
  assert.deepEqual(consoleErrors, [], `console errors at ${viewport.width}px`);
  assert.deepEqual(failedResponses, [], `failed responses at ${viewport.width}px`);

  await context.close();
  return {
    viewport: `${viewport.width}x${viewport.height}`,
    status: "PASS",
    imageTableColumns: expectedColumns,
    screenshots,
    checks: {
      themesRemoved: true,
      twoModesOnly: true,
      question120Sequential: true,
      questionSessionRestore: true,
      image60Hand15: true,
      arbitraryImagePick: true,
      imageOnlyReveal: true,
      noImageQuestionOrFollowup: true,
      selectedSlotRefill: true,
      stableRemainingSlots: true,
      imageSessionRestore: true,
      keyboardTabSpaceEscape: true,
      altAndAria: true,
      tapTarget44: true,
      noHorizontalOverflow: true,
    },
  };
}

const { server, origin } = await startStaticServer();
let browser;

try {
  browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const viewports = [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ];
  const results = [];
  for (const viewport of viewports) {
    results.push(await runViewport(browser, origin, viewport));
  }

  console.log(
    JSON.stringify(
      {
        suite: "TALK CARD 180 v2.1 THEMELESS BROWSER QA",
        status: "PASS",
        passedViewports: results.length,
        failedViewports: 0,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
