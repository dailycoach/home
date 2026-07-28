import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const siteRoot = path.join(root, "programs", "art-psychology-coaching");
const pageNames = ["index.html", "journey.html", "guide.html", "slides.html"];
const routeNames = [...pageNames, "course.html"];
const failures = [];
const warnings = [];

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const htmlByName = Object.fromEntries(
  routeNames.map((name) => [name, read(path.join(siteRoot, name))]),
);
const css = read(path.join(siteRoot, "styles.css"));
const slidesCss = read(path.join(siteRoot, "slides.css"));
const app = read(path.join(siteRoot, "app.js"));
const auth = read(path.join(siteRoot, "slides-auth.js"));
const config = read(path.join(siteRoot, "config.js"));
const allCss = `${css}\n${slidesCss}`;

const idsFor = (html) => {
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  return { ids, set: new Set(ids) };
};

const tagAttribute = (tag, attribute) =>
  tag.match(new RegExp(`\\b${attribute}=["']([^"']*)["']`, "i"))?.[1];

for (const [name, html] of Object.entries(htmlByName)) {
  assert(/<html\b[^>]*\blang=["']ko["']/i.test(html), `${name}: lang="ko" 누락`);
  assert(
    /<meta\b[^>]*\bname=["']viewport["']/i.test(html),
    `${name}: viewport 메타 누락`,
  );

  const { ids, set } = idsFor(html);
  assert(ids.length === set.size, `${name}: 중복 ID 존재`);

  const refs = [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map(
    (match) => match[1],
  );
  for (const ref of refs) {
    if (!ref || ref === "#" || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(ref)) {
      continue;
    }
    const [rawTarget, hash = ""] = ref.split("#");
    const targetName = rawTarget || name;
    const targetPath = path.resolve(siteRoot, targetName);
    assert(
      targetPath.startsWith(`${siteRoot}${path.sep}`) || targetPath === siteRoot,
      `${name}: 사이트 범위를 벗어난 참조 ${ref}`,
    );
    assert(fs.existsSync(targetPath), `${name}: 없는 로컬 참조 ${ref}`);
    if (hash && fs.existsSync(targetPath) && path.extname(targetPath) === ".html") {
      const targetHtml = rawTarget ? read(targetPath) : html;
      assert(idsFor(targetHtml).set.has(hash), `${name}: 없는 앵커 ${ref}`);
    }
  }
}

for (const name of pageNames) {
  const html = htmlByName[name];
  assert(html.includes("<main"), `${name}: main 랜드마크 누락`);
  assert(html.includes('class="skip-link"'), `${name}: 건너뛰기 링크 누락`);
  assert(
    html.includes('name="theme-color" content="#232735"'),
    `${name}: 공식 차콜 theme-color 누락`,
  );
  assert(
    html.includes('href="assets/fonts/gowun-batang-700.woff2"'),
    `${name}: 제목 웹폰트 preload 누락`,
  );

  const headingLevels = [...html.matchAll(/<h([1-6])\b/gi)].map((match) =>
    Number(match[1]),
  );
  assert(headingLevels[0] === 1, `${name}: 첫 제목이 H1이 아님`);
  for (let index = 1; index < headingLevels.length; index += 1) {
    assert(
      headingLevels[index] - headingLevels[index - 1] <= 1,
      `${name}: H${headingLevels[index - 1]}→H${headingLevels[index]} 제목 단계 건너뜀`,
    );
  }

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    assert(tagAttribute(tag, "alt") !== undefined, `${name}: alt 없는 이미지`);
    assert(tagAttribute(tag, "width"), `${name}: width 없는 이미지`);
    assert(tagAttribute(tag, "height"), `${name}: height 없는 이미지`);
  }
}

const landing = htmlByName["index.html"];
const journey = htmlByName["journey.html"];
const guide = htmlByName["guide.html"];
const slides = htmlByName["slides.html"];

for (const text of [
  "다양한 빛깔,",
  "나만의 존재감",
  "나는 하나의 색으로",
  "잘 그리는 것보다",
  "당신은 한 가지 색으로",
]) {
  assert(landing.includes(text), `랜딩 핵심 메시지 누락: ${text}`);
}

for (const className of [
  "identity-hero",
  "identity-why",
  "journey-teaser",
  "artwork-experience",
  "voice-notes",
  "landing-facilitator",
  "identity-final-cta",
]) {
  assert(landing.includes(className), `랜딩 섹션 누락: ${className}`);
  assert(css.includes(`.${className}`), `랜딩 스타일 누락: .${className}`);
}

const imageSpecs = [
  ["hero-identity-collage.webp", "1000", "1250", false],
  ["artwork-self-layers.webp", "1200", "900", true],
  ["artwork-future-scene.webp", "1000", "1250", true],
  ["artwork-support-symbol.webp", "1200", "900", true],
];
for (const [fileName, width, height, lazy] of imageSpecs) {
  const assetPath = path.join(siteRoot, "assets", fileName);
  assert(fs.existsSync(assetPath), `이미지 자산 누락: ${fileName}`);
  assert(fs.statSync(assetPath).size < 250_000, `이미지 최적화 필요: ${fileName}`);
  const tag = landing.match(new RegExp(`<img\\b[^>]*${fileName}[^>]*>`, "i"))?.[0] || "";
  assert(tagAttribute(tag, "width") === width, `${fileName}: width 불일치`);
  assert(tagAttribute(tag, "height") === height, `${fileName}: height 불일치`);
  if (lazy) assert(tagAttribute(tag, "loading") === "lazy", `${fileName}: lazy loading 누락`);
  else assert(tagAttribute(tag, "fetchpriority") === "high", `${fileName}: Hero 우선 로딩 누락`);
}

assert(
  (journey.match(/class="journey-week journey-week-\d{2}/g) || []).length === 6,
  "6주 과정의 주차 섹션이 6개가 아님",
);
assert(
  (journey.match(/<details>/g) || []).length === 6,
  "6주 과정의 주차 상세 펼치기가 6개가 아님",
);
for (const required of [
  "120분 × 6주",
  "참여자 워크북",
  "말하지 않을 권리",
  'id="facilitator"',
  "작품을 대신 해석",
  "자주 묻는 질문",
]) {
  assert(guide.includes(required), `참여 안내 핵심 내용 누락: ${required}`);
}

assert(
  (slides.match(/class="facilitator-week reveal"/g) || []).length === 6,
  "강사용 주차 개요가 6개가 아님",
);
assert(
  (slides.match(/<div><strong>\d{2}<\/strong><span>/g) || []).length === 19,
  "강사용 공통 진행 흐름이 19개가 아님",
);
assert(slides.includes("6주 × 주차당 19장"), "강사용 고정 제작 규격 문구 누락");
assert(slides.includes("114장"), "강사용 114장 문구 누락");
assert(slides.includes("120분/회기"), "강사용 120분 문구 누락");
assert(slides.includes("실제 발화·대체 질문·안전 대응·워크북 코드"), "강사용 자료 구성 문구 누락");

const expectedDownloads = {
  complete: "downloads/complete-package-v1.0.zip",
  "master-pptx": "downloads/art-psychology-coaching-6week-master-v1.0.pptx",
  "master-pdf": "downloads/art-psychology-coaching-6week-master-v1.0.pdf",
  week01: "downloads/week01-arrival-v1.0.pptx",
  week02: "downloads/week02-encounter-v1.0.pptx",
  week03: "downloads/week03-rename-v1.0.pptx",
  week04: "downloads/week04-future-scene-v1.0.pptx",
  week05: "downloads/week05-action-translation-v1.0.pptx",
  week06: "downloads/week06-integration-v1.0.pptx",
  script: "downloads/facilitator-script-v1.0.txt",
  "contact-sheet": "downloads/slide-contact-sheet-v1.0.pdf",
  "qa-report": "downloads/qa-report-v1.0.md",
};
const downloadKeys = [...slides.matchAll(/data-download-key=["']([^"']+)["']/g)].map(
  (match) => match[1],
);
assert(downloadKeys.length === 12, "강사용 다운로드 링크 수가 12개가 아님");
assert(new Set(downloadKeys).size === 12, "강사용 다운로드 키가 중복됨");
assert(!slides.includes('href="downloads/'), "인증 전 HTML에 직접 다운로드 경로가 노출됨");
for (const [key, relativePath] of Object.entries(expectedDownloads)) {
  assert(downloadKeys.includes(key), `다운로드 키 누락: ${key}`);
  assert(
    auth.includes(`${JSON.stringify(key)}: ${JSON.stringify(relativePath)}`) ||
      auth.includes(`${key}: ${JSON.stringify(relativePath)}`),
    `인증 스크립트 다운로드 매핑 누락: ${key}`,
  );
  assert(fs.existsSync(path.join(siteRoot, relativePath)), `다운로드 파일 누락: ${relativePath}`);
}
assert(auth.includes("hydrateDownloads();"), "인증 후 다운로드 링크 주입 누락");
assert(
  auth.indexOf("hydrateDownloads();") < auth.indexOf("gate.hidden = true"),
  "보호 콘텐츠 노출 전에 다운로드 링크가 준비되지 않음",
);

const expectedHash = auth.match(/EXPECTED_HASH\s*=\s*"([a-f0-9]{64})"/)?.[1];
const passwordHash = crypto.createHash("sha256").update("250409").digest("hex");
assert(expectedHash === passwordHash, "강사용 비밀번호 250409 해시가 보존되지 않음");
assert(auth.includes("sessionStorage"), "강사용 세션 잠금 상태 누락");
assert(auth.includes('crypto.subtle.digest("SHA-256"'), "SHA-256 검증 누락");
assert(slides.includes("noindex,nofollow,noarchive"), "강사용 페이지 검색 제외 메타 누락");
assert(slides.includes("data-protected-content hidden"), "보호 콘텐츠 기본 숨김 누락");

const pptxSpecs = [
  ["art-psychology-coaching-6week-master-v1.0.pptx", 114],
  ["week01-arrival-v1.0.pptx", 19],
  ["week02-encounter-v1.0.pptx", 19],
  ["week03-rename-v1.0.pptx", 19],
  ["week04-future-scene-v1.0.pptx", 19],
  ["week05-action-translation-v1.0.pptx", 19],
  ["week06-integration-v1.0.pptx", 19],
];
for (const [fileName, expectedCount] of pptxSpecs) {
  const pptxPath = path.join(siteRoot, "downloads", fileName);
  const entries = execFileSync("unzip", ["-Z1", pptxPath], { encoding: "utf8" }).split(/\r?\n/);
  const slidesCount = entries.filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry)).length;
  const notesCount = entries.filter((entry) =>
    /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(entry),
  ).length;
  assert(slidesCount === expectedCount, `${fileName}: 슬라이드 수 ${slidesCount}/${expectedCount}`);
  assert(notesCount === expectedCount, `${fileName}: 발표자 노트 수 ${notesCount}/${expectedCount}`);
}

const downloadsRoot = path.join(siteRoot, "downloads");
const masterPdfInfo = execFileSync(
  "pdfinfo",
  [path.join(downloadsRoot, "art-psychology-coaching-6week-master-v1.0.pdf")],
  { encoding: "utf8" },
);
assert(/^Pages:\s+114$/m.test(masterPdfInfo), "통합 MASTER PDF가 114페이지가 아님");

const packagePath = path.join(downloadsRoot, "complete-package-v1.0.zip");
const packageEntries = execFileSync("unzip", ["-Z1", packagePath], {
  encoding: "utf8",
}).split(/\r?\n/);
assert(
  packageEntries.filter((entry) => /FINAL_OUTPUT\/02_WEEKLY_PPT\/.*\.pptx$/.test(entry))
    .length === 6,
  "전체 ZIP의 주차별 PPT가 6개가 아님",
);
const packagedScriptName = packageEntries.find((entry) => entry.endsWith("강사대본_전체.txt"));
const packagedMasterName = packageEntries.find((entry) =>
  entry.endsWith("DAILYCOACHING_미술심리코칭_6주_진행슬라이드_MASTER_v1.0.pptx"),
);
assert(packagedScriptName, "전체 ZIP에 강사대본 누락");
assert(packagedMasterName, "전체 ZIP에 통합 MASTER 누락");
if (packagedScriptName) {
  assert(
    execFileSync("unzip", ["-p", packagePath, packagedScriptName]).equals(
      fs.readFileSync(path.join(downloadsRoot, "facilitator-script-v1.0.txt")),
    ),
    "전체 ZIP 강사대본과 개별 다운로드본이 다름",
  );
}
if (packagedMasterName) {
  assert(
    execFileSync("unzip", ["-p", packagePath, packagedMasterName]).equals(
      fs.readFileSync(
        path.join(downloadsRoot, "art-psychology-coaching-6week-master-v1.0.pptx"),
      ),
    ),
    "전체 ZIP MASTER와 개별 다운로드본이 다름",
  );
}

const facilitatorScript = read(path.join(downloadsRoot, "facilitator-script-v1.0.txt"));
assert(facilitatorScript.charCodeAt(0) === 0xfeff, "강사대본 UTF-8 BOM 누락");
assert(!facilitatorScript.includes("\ufffd"), "강사대본 한글 대체문자 존재");
for (const [label, pattern] of [
  ["SLIDE_ID", /^SLIDE_ID: W\d{2}-S\d{2}/gm],
  ["참여자 화면", /^참여자 화면:/gm],
  ["진행자 실제 발화", /^진행자 실제 발화:/gm],
  ["대체 질문", /^참여자가 막혔을 때의 대체 질문:/gm],
  ["안전 대응", /^정서 반응이 커졌을 때의 대응:/gm],
  ["워크북 코드", /^워크북 코드:/gm],
]) {
  assert(
    (facilitatorScript.match(pattern) || []).length === 114,
    `강사대본 ${label} 항목이 114개가 아님`,
  );
}

const requiredTokens = {
  "--color-charcoal": "#232735",
  "--color-warm-gray": "#f7f1f0",
  "--color-soft-pink": "#f2b7c6",
  "--color-cobalt": "#3e5bd6",
  "--color-lime": "#a8c65b",
  "--color-coral": "#ff8a5b",
};
for (const [token, value] of Object.entries(requiredTokens)) {
  assert(css.includes(`${token}:${value}`), `디자인 토큰 불일치: ${token}`);
}
for (const oldColor of [
  "#f6f1e7",
  "#f4ce46",
  "#d16d4f",
  "#4e8b83",
  "#efe6d8",
  "rgba(78,139,131",
  "rgba(209,109,79",
  "rgba(244,206,70",
]) {
  assert(!allCss.includes(oldColor), `기존 팔레트 값 잔존: ${oldColor}`);
}

assert(css.includes("font-display:swap"), "웹폰트 font-display: swap 누락");
assert(css.includes('var(--font-body)'), "한글 본문 fallback stack 적용 누락");
assert(css.includes("a:focus-visible"), "키보드 focus-visible 스타일 누락");
assert(css.includes("overflow-x:hidden"), "가로 스크롤 방지 규칙 누락");
assert(css.includes("min-height:54px"), "기본 버튼 44px 이상 터치 영역 누락");
assert(
  /@media \(max-width:760px\)[\s\S]*?body\{font-size:16px/.test(css),
  "모바일 본문 16px 규칙 누락",
);
for (const breakpoint of ["1100px", "980px", "760px", "420px"]) {
  assert(allCss.includes(`@media (max-width:${breakpoint})`), `반응형 기준 누락: ${breakpoint}`);
}
assert(allCss.includes("@media (prefers-reduced-motion:reduce)"), "reduced motion 대응 누락");
assert(css.includes("visibility:hidden;pointer-events:none"), "닫힌 모바일 메뉴 비활성화 누락");
assert(app.includes('e.key === "Escape"'), "모바일 메뉴 Escape 닫기 누락");
assert(app.includes('next ? "메뉴 닫기" : "메뉴 열기"'), "모바일 메뉴 상태 라벨 누락");

const fontPath = path.join(siteRoot, "assets", "fonts", "gowun-batang-700.woff2");
const licensePath = path.join(siteRoot, "assets", "fonts", "GOWUN_BATANG_LICENSE.txt");
assert(fs.existsSync(fontPath) && fs.statSync(fontPath).size > 100_000, "한글 제목 웹폰트 누락");
assert(fs.existsSync(licensePath), "웹폰트 라이선스 누락");

const forbiddenClaims = [
  "그림만 보면 마음을 알 수 있습니다",
  "색으로 성격을 진단합니다",
  "무의식을 정확히 분석합니다",
  "상처를 완전히 치료합니다",
  "과거 기억을 복원합니다",
  "내면아이를 치유하면 모든 문제가 해결됩니다",
  "특정 그림 상징은 반드시 특정 심리를 의미합니다",
];
const publicCopy = pageNames.map((name) => htmlByName[name]).join("\n");
for (const claim of forbiddenClaims) {
  assert(!publicCopy.includes(claim), `금지된 효과·해석 문구 존재: ${claim}`);
}
assert(!publicCopy.includes("기억을 복원"), "공개 화면에 기억 복원 표현 존재");

const luminance = (hex) => {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((part) => Number.parseInt(part, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (first, second) => {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const contrastPairs = [
  ["Primary CTA", "#3e5bd6", "#ffffff"],
  ["Primary CTA hover", "#2f48b8", "#ffffff"],
  ["Body", "#f7f1f0", "#232735"],
  ["Muted body", "#f7f1f0", "#545a68"],
  ["Pink block", "#f2b7c6", "#232735"],
  ["Lime label", "#a8c65b", "#232735"],
  ["Coral label", "#ff8a5b", "#232735"],
];
for (const [label, background, foreground] of contrastPairs) {
  assert(
    contrast(background, foreground) >= 4.5,
    `${label}: WCAG AA 명도 대비 미달`,
  );
}

if (/formUrl:\s*["']\s*["']/.test(config)) {
  warnings.push("참여 신청 formUrl이 비어 있어 현재는 준비 안내 대화상자가 열립니다.");
}
warnings.push(
  "현재 실행 환경의 브라우저 렌더러 제약으로 360·390·412·768·1024·1440px 실제 화면 캡처는 별도 확인이 필요합니다.",
);
warnings.push(
  "정적 GitHub Pages 인증은 화면 접근 억제용입니다. 파일 자체를 서버 권한으로 차단하는 방식은 아닙니다.",
);

if (failures.length) {
  console.error(`Art psychology site QA failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Art psychology site QA passed.");
console.log(`Routes checked: ${routeNames.length}`);
console.log("Journey weeks checked: 6");
console.log("Facilitator flow items checked: 19");
console.log("PPTX slides / speaker notes checked: 114 + 6×19");
console.log("MASTER PDF pages checked: 114");
console.log("Complete ZIP consistency checked");
console.log("Facilitator script records checked: 114");
console.log(`Download mappings checked: ${Object.keys(expectedDownloads).length}`);
console.log(`WCAG contrast pairs checked: ${contrastPairs.length}`);
console.log(`Warnings: ${warnings.length}`);
warnings.forEach((warning) => console.log(`- ${warning}`));
