import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { IMAGE_CARDS } from "../data/runtime-cards.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const CHROMIUM_PATH = process.env.TALKCARD_CHROMIUM_PATH || "/tmp/chromium";
const SCREENSHOT_DIR = process.env.TALKCARD_SCREENSHOT_DIR || "/tmp/talkcard-r04-screens";
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

    if (filePath.endsWith(`${sep}index-v21.html`)) {
      const fontInjection = `
        <link rel="stylesheet" href="/__qa_font/korean-400.css" />
        <link rel="stylesheet" href="/__qa_font/korean-700.css" />
        <style>
          body h1, body h2, body h3, body h4,
          .table-identity p, .reveal-identity p,
          .table-progress, .reveal-progress,
          .opening-card p, .opening-lead, .closing-question {
            font-family: Georgia, "Times New Roman", "Noto Sans KR", sans-serif !important;
          }
        </style>
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

async function tablePositions(page) {
  return page.locator("#card-table").evaluate((table) => {
    const tableRect = table.getBoundingClientRect();
    return Object.fromEntries(
      [...table.querySelectorAll(".table-card")].map((card) => {
        const rect = card.closest(".table-slot").getBoundingClientRect();
        return [
          card.dataset.cardId,
          { x: rect.x - tableRect.x, y: rect.y - tableRect.y, width: rect.width, height: rect.height },
        ];
      }),
    );
  });
}

function assertStablePositions(before, after, usedId) {
  for (const [cardId, beforeRect] of Object.entries(before)) {
    if (cardId === usedId) continue;
    const afterRect = after[cardId];
    assert.ok(afterRect, `remaining card ${cardId} must stay on the table`);
    assert.ok(
      Math.abs(beforeRect.x - afterRect.x) <= 0.6,
      `${cardId} x position changed: ${beforeRect.x} → ${afterRect.x}`,
    );
    assert.ok(
      Math.abs(beforeRect.y - afterRect.y) <= 0.6,
      `${cardId} y position changed: ${beforeRect.y} → ${afterRect.y}`,
    );
  }
}

async function assertNoHorizontalOverflow(page, viewportWidth) {
  const sizes = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(sizes.body <= viewportWidth + 1, `body overflow: ${sizes.body} > ${viewportWidth}`);
  assert.ok(sizes.document <= viewportWidth + 1, `document overflow: ${sizes.document} > ${viewportWidth}`);
}

async function runViewport(browser, origin, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  const webpRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    if (request.url().endsWith(".webp")) webpRequests.push(request.url());
  });

  const url = `${origin}/cards/talkcard180/index-v21.html`;
  const journeyShots = [];
  await page.goto(url, { waitUntil: "networkidle" });
  await expectScreen(page, "opening");
  assert.equal(webpRequests.length, 0, "opening must not preload card faces");
  if (viewport.width === 390 || viewport.width === 1440) {
    const shot = `${SCREENSHOT_DIR}/${viewport.width}x${viewport.height}-opening.png`;
    await page.screenshot({ path: shot, fullPage: true });
    journeyShots.push(shot);
  }

  await page.locator('[data-action="show-themes"]').first().click();
  await expectScreen(page, "themes");
  assert.equal(await page.locator(".theme-card").count(), 2, "Pilot must expose only T01 and I01");
  assert.equal(await page.locator('[data-screen="themes"] img').count(), 0, "theme selection must not show card images");
  if (viewport.width === 390 || viewport.width === 1440) {
    const shot = `${SCREENSHOT_DIR}/${viewport.width}x${viewport.height}-themes.png`;
    await page.screenshot({ path: shot, fullPage: true });
    journeyShots.push(shot);
  }

  await page.locator('[data-theme-id="ice"]').click();
  await expectScreen(page, "intro");
  assert.equal(await page.locator("#intro-visual .intro-back-card").count(), 3);
  assert.equal(await page.locator("#intro-visual img").count(), 0, "deck intro must show backs, not content");
  assert.equal(webpRequests.length, 0, "intro must not request image card faces");
  if (viewport.width === 390 || viewport.width === 1440) {
    const shot = `${SCREENSHOT_DIR}/${viewport.width}x${viewport.height}-t01-intro.png`;
    await page.screenshot({ path: shot, fullPage: true });
    journeyShots.push(shot);
  }

  await page.locator('[data-action="unfold-deck"]').click();
  await expectScreen(page, "table");
  assert.equal(await page.locator(".table-slot").count(), 15);
  assert.equal(await page.locator(".table-card").count(), 15);
  assert.equal((await page.locator("#table-progress").textContent()).trim(), "00 / 15");
  assert.equal(
    await page.getByText("오늘 기분을 이모지 하나로만 표현하신다면, 어떤 이모지일까요?").count(),
    0,
    "questions must not be in the table DOM",
  );

  const expectedColumns = viewport.width <= 640 ? 3 : 5;
  const gridColumnCount = await page.locator("#card-table").evaluate((table) =>
    getComputedStyle(table).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  assert.equal(gridColumnCount, expectedColumns, `${viewport.width}px table column count`);

  const firstCardRect = await page.locator(".table-card").first().boundingBox();
  assert.ok(firstCardRect.width >= 44 && firstCardRect.height >= 44, "card tap target must be at least 44 × 44");
  await assertNoHorizontalOverflow(page, viewport.width);

  const textTableShot = `${SCREENSHOT_DIR}/${viewport.width}x${viewport.height}-t01-table.png`;
  await page.screenshot({ path: textTableShot, fullPage: true });

  await page.waitForTimeout(550);
  const positionsBefore = await tablePositions(page);
  const firstCard = page.locator(".table-card").first();
  const secondCard = page.locator(".table-card").nth(1);
  await firstCard.focus();
  await page.keyboard.press("Tab");
  const activeCardId = await page.evaluate(() => document.activeElement?.dataset?.cardId || null);
  const expectedSecondId = await secondCard.getAttribute("data-card-id");
  assert.equal(activeCardId, expectedSecondId, "Tab must move between card buttons");
  await page.keyboard.press("Enter");
  await expectScreen(page, "reveal");
  assert.equal(await page.locator("#revealed-text").isVisible(), true);
  assert.ok((await page.locator("#text-question").textContent()).trim().length > 0);
  assert.equal(await page.locator("[data-action=\"next-card\"]").count(), 0, "sequential NEXT action must not exist");
  await page.waitForTimeout(700);
  const textRevealShot = `${SCREENSHOT_DIR}/${viewport.width}x${viewport.height}-t01-reveal.png`;
  await page.screenshot({ path: textRevealShot, fullPage: true });

  await page.keyboard.press("Escape");
  await expectScreen(page, "table");
  assert.equal((await page.locator("#table-progress").textContent()).trim(), "01 / 15");
  assert.equal(await page.locator(".table-card").count(), 14);
  assert.equal(await page.locator(".table-slot--used").count(), 1);
  await page.waitForTimeout(550);
  assertStablePositions(positionsBefore, await tablePositions(page), activeCardId);

  await page.locator('[data-screen="table"] [data-action="finish-conversation"]').click();
  await expectScreen(page, "closing");
  assert.equal((await page.locator("#closing-used").textContent()).trim(), "1");
  await page.locator('[data-action="restart-deck"]').click();
  await expectScreen(page, "table");
  assert.equal((await page.locator("#table-progress").textContent()).trim(), "00 / 15");
  assert.equal(await page.locator(".table-card").count(), 15);

  // Fresh IMAGE pilot session in the same viewport.
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(url, { waitUntil: "networkidle" });
  webpRequests.length = 0;
  await page.locator('[data-action="show-themes"]').first().click();
  await page.locator('[data-theme-id="memory"]').click();
  await expectScreen(page, "intro");
  assert.equal(await page.locator("#intro-visual img").count(), 0);
  assert.equal(webpRequests.length, 0, "I01 intro must not request image faces");

  await page.locator('[data-action="unfold-deck"]').click();
  await expectScreen(page, "table");
  const imagePick = page.locator(".table-card").nth(7);
  await imagePick.focus();
  await page.keyboard.press("Space");
  await expectScreen(page, "reveal");
  await page.waitForFunction(() => {
    const image = document.querySelector("#image-card-art");
    return image?.complete && image.naturalWidth > 0;
  });
  assert.equal(await page.locator("#revealed-image").isVisible(), true);
  assert.equal(await page.locator("#image-question-panel, #followup-panel, #open-question").count(), 0);
  assert.equal(await page.locator("#revealed-image figcaption").count(), 0);
  assert.equal(
    (await page.locator("#revealed-image").innerText()).trim(),
    "",
    "image reveal must contain no visible prompt or instruction copy",
  );
  const selectedImageId = await page.locator("#revealed-card").getAttribute("data-card-id");
  const selectedImageSource = IMAGE_CARDS.find((card) => card.id === selectedImageId);
  assert.ok(selectedImageSource, "selected image must resolve to preserved source data");
  const visiblePageText = await page.locator("body").innerText();
  assert.equal(visiblePageText.includes(selectedImageSource.prompt), false, "main image question must not enter the DOM");
  assert.equal(visiblePageText.includes(selectedImageSource.followup), false, "image follow-up must not enter the DOM");
  assert.equal(new Set(webpRequests).size, 1, "only the selected image face should be requested");

  const imageOnlyShot = `${SCREENSHOT_DIR}/${viewport.width}x${viewport.height}-i01-image-only.png`;
  await page.screenshot({ path: imageOnlyShot, fullPage: true });

  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-action="show-themes"]').first().click();
  await page.locator('[data-theme-id="memory"]').click();
  await page.locator('[data-action="unfold-deck"]').click();
  await expectScreen(page, "reveal");
  assert.equal(await page.locator("#revealed-card").getAttribute("data-card-id"), selectedImageId);
  assert.equal((await page.locator("#revealed-image").innerText()).trim(), "");
  assert.equal(await page.locator("#image-question-panel, #followup-panel, #open-question").count(), 0);
  await page.keyboard.press("Escape");
  await expectScreen(page, "table");
  assert.equal((await page.locator("#table-progress").textContent()).trim(), "01 / 15");
  assert.equal(await page.locator(".table-card").count(), 14);
  await assertNoHorizontalOverflow(page, viewport.width);

  assert.deepEqual(pageErrors, [], `page errors at ${viewport.width}px`);
  assert.deepEqual(consoleErrors, [], `console errors at ${viewport.width}px`);
  assert.deepEqual(failedResponses, [], `failed responses at ${viewport.width}px`);

  await context.close();
  return {
    viewport: `${viewport.width}x${viewport.height}`,
    status: "PASS",
    tableColumns: expectedColumns,
    screenshots: [...journeyShots, textTableShot, textRevealShot, imageOnlyShot],
    checks: {
      directPick: true,
      noPreExposure: true,
      returnToTable: true,
      usedState: true,
      imageOnlyFreeAssociation: true,
      noImageQuestionControls: true,
      noImagePromptText: true,
      sessionRestore: true,
      keyboardTabEnterSpaceEscape: true,
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
        suite: "R03/R04 PILOT BROWSER QA",
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
