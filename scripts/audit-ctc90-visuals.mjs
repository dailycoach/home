import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const rootUrl = process.env.CTC90_BASE_URL || "http://127.0.0.1:4173";
const outputDir = process.env.CTC90_AUDIT_DIR || "/tmp/ctc90-visual-audit";
const routes = [
  ["hub", "/coaching/coach-the-coach/"],
  ["kac", "/coaching/coach-the-coach/kac/"],
  ["kpc", "/coaching/coach-the-coach/kpc/"],
];
const viewports = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 900 },
  { name: "laptop-1024", width: 1024, height: 900 },
  { name: "desktop-1440", width: 1440, height: 1000 },
];

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });

  for (const [routeName, route] of routes) {
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });

    const response = await page.goto(`${rootUrl}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.locator(".hero-collage img").evaluate(async (image) => {
      image.loading = "eager";
      await image.decode();
    });
    if (["mobile-390", "desktop-1440"].includes(viewport.name)) {
      await page.screenshot({
        path: path.join(outputDir, `${routeName}-${viewport.name}-hero.png`),
        fullPage: false,
      });
    }
    await page.locator("img").evaluateAll(async (images) => {
      for (const image of images) {
        image.loading = "eager";
        image.scrollIntoView({ block: "center" });
        try { await image.decode(); } catch { /* broken images are reported below */ }
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const buttonRects = [...document.querySelectorAll("a.button, a.nav-cta, a.mobile-header-cta")]
        .map((button) => {
          const style = getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          return { button, style, rect };
        })
        .filter(({ style, rect }) => style.display !== "none" && style.visibility !== "hidden" &&
          rect.width > 0 && rect.height > 0)
        .map(({ button, rect }) => ({
          text: button.textContent.trim(),
          width: rect.width,
          height: rect.height,
        }));
      const clippedText = [...document.querySelectorAll("h1, h2, h3, p, a, span, summary")]
        .filter((element) => {
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden" &&
            element.scrollWidth > element.clientWidth + 2;
        })
        .map((element) => element.textContent.trim().slice(0, 80));

      return {
        title: document.title,
        h1Count: document.querySelectorAll("h1").length,
        mainExists: Boolean(document.querySelector("main#main")),
        horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1 || body.scrollWidth > body.clientWidth + 1,
        overflowAmount: Math.max(doc.scrollWidth - doc.clientWidth, body.scrollWidth - body.clientWidth),
        clippedText,
        smallestCtaHeight: buttonRects.length ? Math.min(...buttonRects.map((rect) => rect.height)) : 0,
        smallestCtaWidth: buttonRects.length ? Math.min(...buttonRects.map((rect) => rect.width)) : 0,
        storyImageCount: document.querySelectorAll("img.story-image").length,
        brokenImages: [...document.images]
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.currentSrc || image.src),
        focusVisibleRuleLoaded: [...document.styleSheets].some((sheet) => {
          try {
            return [...sheet.cssRules].some((rule) => rule.cssText.includes(":focus-visible"));
          } catch {
            return false;
          }
        }),
      };
    });

    const result = {
      route: routeName,
      viewport: viewport.name,
      status: response?.status() || 0,
      runtimeErrors,
      ...metrics,
    };
    result.passed = result.status === 200 && result.runtimeErrors.length === 0 &&
      result.h1Count === 1 && result.mainExists && !result.horizontalOverflow &&
      result.clippedText.length === 0 && result.smallestCtaHeight >= 44 &&
      result.smallestCtaWidth >= 44 && result.storyImageCount === 5 &&
      result.brokenImages.length === 0 && result.focusVisibleRuleLoaded;
    report.push(result);

    if (["mobile-390", "desktop-1440"].includes(viewport.name)) {
      await page.screenshot({
        path: path.join(outputDir, `${routeName}-${viewport.name}.png`),
        fullPage: true,
      });
    }
    await page.close();
  }
  await context.close();
}

await browser.close();
await fs.writeFile(
  path.join(outputDir, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

const failures = report.filter((result) => !result.passed);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log(`CTC90 visual QA 통과: ${report.length}/${report.length}`);
console.log(`결과: ${path.join(outputDir, "report.json")}`);
