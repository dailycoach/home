import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const siteRoot = path.join(root, "programs", "art-psychology-coaching");
const htmlNames = ["index.html", "journey.html", "guide.html", "slides.html", "course.html"];
const failures = [];
const warnings = [];

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const htmlByName = Object.fromEntries(
  htmlNames.map((name) => [name, read(path.join(siteRoot, name))]),
);
const css = read(path.join(siteRoot, "styles.css"));
const app = read(path.join(siteRoot, "app.js"));
const auth = read(path.join(siteRoot, "slides-auth.js"));
const config = read(path.join(siteRoot, "config.js"));

const idsFor = (html) => {
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  return { ids, set: new Set(ids) };
};

for (const [name, html] of Object.entries(htmlByName)) {
  assert(/<html\b[^>]*\blang=["']ko["']/i.test(html), `${name}: lang="ko"가 없습니다.`);
  assert(
    /<meta\b[^>]*\bname=["']viewport["']/i.test(html),
    `${name}: viewport 메타가 없습니다.`,
  );

  const { ids, set } = idsFor(html);
  assert(ids.length === set.size, `${name}: 중복 ID가 있습니다.`);

  const headingLevels = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  if (headingLevels.length) {
    assert(headingLevels[0] === 1, `${name}: 첫 제목이 H1이 아닙니다.`);
    for (let index = 1; index < headingLevels.length; index += 1) {
      assert(
        headingLevels[index] - headingLevels[index - 1] <= 1,
        `${name}: H${headingLevels[index - 1]}에서 H${headingLevels[index]}로 건너뜁니다.`,
      );
    }
  }

  const refs = [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map(
    (match) => match[1],
  );
  for (const ref of refs) {
    if (
      !ref ||
      ref === "#" ||
      /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(ref)
    ) {
      continue;
    }
    const [rawTarget, hash = ""] = ref.split("#");
    const targetName = rawTarget || name;
    const targetPath = path.resolve(siteRoot, targetName);
    assert(
      targetPath.startsWith(`${siteRoot}${path.sep}`) || targetPath === siteRoot,
      `${name}: 사이트 범위를 벗어난 참조입니다: ${ref}`,
    );
    assert(fs.existsSync(targetPath), `${name}: 없는 로컬 참조입니다: ${ref}`);
    if (hash && fs.existsSync(targetPath) && path.extname(targetPath) === ".html") {
      const targetHtml = rawTarget ? read(targetPath) : html;
      assert(
        idsFor(targetHtml).set.has(hash),
        `${name}: 없는 앵커를 가리킵니다: ${ref}`,
      );
    }
  }
}
for (const name of ["index.html", "journey.html", "guide.html", "slides.html"]) {
  assert(
    htmlByName[name].includes('name="theme-color" content="#232735"'),
    `${name}: 공식 차콜 theme-color가 적용되지 않았습니다.`,
  );
  assert(
    htmlByName[name].includes('href="assets/fonts/gowun-batang-700.woff2"'),
    `${name}: 제목 웹폰트 preload가 없습니다.`,
  );
}

const landing = htmlByName["index.html"];
for (const required of [
  "다양한 빛깔,",
  "나만의 존재감",
  "정해진 틀에 나를 맞추는 대신",
  "나는 왜",
  "한 가지 모습으로 설명되지 않을까?",
  "먼저 그립니다",
  "직접 읽습니다",
  "삶으로 옮깁니다",
]) {
  assert(landing.includes(required), `대표 시안 핵심 문구가 없습니다: ${required}`);
}
for (const requiredClass of [
  "identity-hero",
  "identity-collage",
  "identity-why",
  "identity-layer-stage",
  "identity-value-composition",
]) {
  assert(landing.includes(requiredClass), `대표 시안 구조가 없습니다: ${requiredClass}`);
  assert(css.includes(`.${requiredClass}`), `대표 시안 스타일이 없습니다: .${requiredClass}`);
}
assert(
  /<img\b[^>]*hero-identity-collage\.webp[^>]*\bwidth=["']1000["'][^>]*\bheight=["']1250["']/i.test(
    landing,
  ),
  "Hero 이미지에 고정 width/height가 없습니다.",
);
assert(
  landing.includes('alt=""') && landing.includes('aria-hidden="true"'),
  "장식용 Hero 이미지의 접근성 처리가 없습니다.",
);

const requiredTokens = {
  "--color-charcoal": "#232735",
  "--color-warm-gray": "#f7f1f0",
  "--color-soft-pink": "#f2b7c6",
  "--color-cobalt": "#3e5bd6",
  "--color-lime": "#a8c65b",
  "--color-coral": "#ff8a5b",
};
for (const [token, value] of Object.entries(requiredTokens)) {
  assert(css.includes(`${token}:${value}`), `공식 디자인 토큰이 다릅니다: ${token}`);
}
for (const oldColor of ["#f6f1e7", "#f4ce46", "#d16d4f", "#4e8b83", "#efe6d8"]) {
  assert(!css.includes(oldColor), `기존 팔레트 색상이 남아 있습니다: ${oldColor}`);
}

assert(css.includes("@font-face"), "로컬 웹폰트 선언이 없습니다.");
assert(css.includes("font-display:swap"), "웹폰트 font-display: swap이 없습니다.");
assert(css.includes("a:focus-visible"), "명확한 키보드 focus-visible 스타일이 없습니다.");
assert(css.includes("width:44px;height:44px"), "44×44px 최소 터치 영역 규칙이 없습니다.");
assert(
  /@media \(max-width:760px\)[\s\S]*?body\{font-size:16px/.test(css),
  "모바일 본문 기본 크기가 16px이 아닙니다.",
);
for (const breakpoint of ["980px", "760px", "420px"]) {
  assert(css.includes(`@media (max-width:${breakpoint})`), `반응형 기준이 없습니다: ${breakpoint}`);
}
assert(css.includes("@media (prefers-reduced-motion:reduce)"), "reduced motion 대응이 없습니다.");
assert(css.includes("visibility:hidden;pointer-events:none"), "닫힌 모바일 메뉴가 포커스에서 제외되지 않습니다.");
assert(app.includes('e.key === "Escape"'), "모바일 메뉴 Escape 닫기가 없습니다.");
assert(app.includes('aria-label", next ? "메뉴 닫기" : "메뉴 열기"'), "모바일 메뉴 상태 라벨이 없습니다.");

const fontPath = path.join(siteRoot, "assets", "fonts", "gowun-batang-700.woff2");
const licensePath = path.join(siteRoot, "assets", "fonts", "GOWUN_BATANG_LICENSE.txt");
assert(fs.existsSync(fontPath) && fs.statSync(fontPath).size > 100000, "한글 제목 웹폰트가 없습니다.");
assert(fs.existsSync(licensePath), "웹폰트 라이선스 파일이 없습니다.");

const facilitatorScript = read(
  path.join(siteRoot, "downloads", "facilitator-script-v1.0.txt"),
);
assert(
  facilitatorScript.charCodeAt(0) === 0xfeff,
  "강사대본에 Windows 호환 UTF-8 BOM이 없습니다.",
);
assert(!facilitatorScript.includes("\ufffd"), "강사대본에 깨진 대체문자가 있습니다.");
assert(
  (facilitatorScript.match(/^SLIDE_ID: W\d{2}-S\d{2}/gm) || []).length === 114,
  "강사대본의 SLIDE_ID가 114개가 아닙니다.",
);
assert(
  (facilitatorScript.match(/^워크북 코드:/gm) || []).length === 114,
  "강사대본의 워크북 코드가 114개가 아닙니다.",
);

const expectedHash = auth.match(/EXPECTED_HASH\s*=\s*"([a-f0-9]{64})"/)?.[1];
const currentPasswordHash = crypto.createHash("sha256").update("250409").digest("hex");
assert(expectedHash === currentPasswordHash, "강사용 비밀번호 250409의 해시가 보존되지 않았습니다.");
assert(auth.includes("sessionStorage"), "강사용 세션 잠금 상태가 보존되지 않았습니다.");
assert(auth.includes('crypto.subtle.digest("SHA-256"'), "강사용 비밀번호 해시 검증이 없습니다.");
assert(htmlByName["slides.html"].includes("noindex,nofollow,noarchive"), "강사용 페이지 noindex가 없습니다.");

const forbiddenClaims = [
  "그림만 보면 마음을 알 수 있습니다",
  "색으로 성격을 진단합니다",
  "무의식을 정확히 분석합니다",
  "상처를 완전히 치료합니다",
  "과거 기억을 복원합니다",
  "내면아이를 치유하면 모든 문제가 해결됩니다",
  "특정 그림 상징은 반드시 특정 심리를 의미합니다",
];
const allPublicCopy = Object.values(htmlByName).join("\n");
for (const claim of forbiddenClaims) {
  assert(!allPublicCopy.includes(claim), `금지된 효과·해석 문구가 있습니다: ${claim}`);
}

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
    `${label} 색 대비가 WCAG AA에 미달합니다.`,
  );
}

if (/formUrl:\s*["']\s*["']/.test(config)) {
  warnings.push("참여 신청 formUrl이 비어 있어 안내 대화상자가 표시됩니다.");
}
warnings.push(
  "이 작업 환경에서 브라우저 렌더러가 실행되지 않아 360–1440px 실제 캡처는 이번 정적 검수에서 제외했습니다.",
);

if (failures.length) {
  console.error(`Representative QA failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Art psychology representative QA passed.");
console.log(`HTML routes checked: ${htmlNames.length}`);
console.log(`WCAG contrast pairs checked: ${contrastPairs.length}`);
console.log(`Warnings: ${warnings.length}`);
warnings.forEach((warning) => console.log(`- ${warning}`));
