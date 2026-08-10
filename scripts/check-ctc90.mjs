import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const siteRoot = path.join(root, "coaching", "coach-the-coach");
const pages = {
  hub: path.join(siteRoot, "index.html"),
  kac: path.join(siteRoot, "kac", "index.html"),
  kpc: path.join(siteRoot, "kpc", "index.html"),
};
const kakaoUrl = "https://open.kakao.com/o/s2ZmJFHi";
const ctcHomePath = "/coaching/coach-the-coach/";
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const read = (filePath) => fs.readFileSync(filePath, "utf8");
const idsFor = (html) => [
  ...html.matchAll(/\bid=["']([^"']+)["']/gi),
].map((match) => match[1]);

const htmlByPage = Object.fromEntries(
  Object.entries(pages).map(([name, filePath]) => [name, read(filePath)]),
);
const combinedHtml = Object.values(htmlByPage).join("\n");

for (const [name, html] of Object.entries(htmlByPage)) {
  assert(/<html\b[^>]*\blang=["']ko["']/i.test(html), `${name}: lang="ko" 누락`);
  assert(/<meta\b[^>]*\bname=["']viewport["']/i.test(html), `${name}: viewport 메타 누락`);
  assert(/<link\b[^>]*\brel=["']canonical["']/i.test(html), `${name}: canonical 누락`);
  assert((html.match(/<h1\b/gi) || []).length === 1, `${name}: H1은 정확히 1개여야 함`);
  assert(/<main\b[^>]*\bid=["']main["']/i.test(html), `${name}: main 랜드마크 누락`);
  assert(/class=["'][^"']*skip-link[^"']*["'][^>]*href=["']#main["']/i.test(html), `${name}: 본문 바로가기 누락`);
  assert(/<nav\b[^>]*\baria-label=/i.test(html), `${name}: 내비게이션 이름 누락`);

  const brandTag = html.match(/<a\b[^>]*class=["'][^"']*\bbrand\b[^"']*["'][^>]*>/i)?.[0] || "";
  const brandHref = brandTag.match(/\bhref=["']([^"']+)["']/i)?.[1] || "";
  assert(brandHref === ctcHomePath, `${name}: DAILYCOACHING 브랜드 링크가 CTC 90 홈을 가리키지 않음`);

  const ids = idsFor(html);
  assert(ids.length === new Set(ids).size, `${name}: 중복 ID 존재`);

  for (const match of html.matchAll(/\baria-labelledby=["']([^"']+)["']/gi)) {
    for (const id of match[1].trim().split(/\s+/)) {
      assert(ids.includes(id), `${name}: aria-labelledby 대상 #${id} 누락`);
    }
  }

  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    const href = tag.match(/\bhref=["']([^"']*)["']/i)?.[1] || "";
    assert(href !== "" && href !== "#", `${name}: 비어 있는 링크 ${tag}`);
    if (/\btarget=["']_blank["']/i.test(tag)) {
      assert(/\brel=["'][^"']*noopener[^"']*["']/i.test(tag), `${name}: 새 창 링크 noopener 누락 ${href}`);
    }
    if (href.startsWith("#")) {
      assert(ids.includes(href.slice(1)), `${name}: 없는 페이지 앵커 ${href}`);
    }
    if (href.startsWith("/coaching/coach-the-coach/")) {
      const relative = href.replace(/^\//, "");
      const target = path.join(root, relative);
      const resolved = path.extname(target) ? target : path.join(target, "index.html");
      assert(fs.existsSync(resolved), `${name}: 없는 내부 경로 ${href}`);
    }
  }

  const kakaoLinks = [
    ...html.matchAll(/<a\b[^>]*\bhref=["'](https:\/\/open\.kakao\.com\/[^"']+)["'][^>]*>/gi),
  ].map((match) => match[1]);
  assert(kakaoLinks.length === 1, `${name}: 카카오 CTA는 최종 구간에 정확히 1개여야 함`);
  assert(kakaoLinks.every((href) => href === kakaoUrl), `${name}: 카카오 URL 불일치`);

  const heroHtml = html.match(/<section\b[^>]*class=["'][^"']*hero[^"']*["'][\s\S]*?<\/section>/i)?.[0] || "";
  const heroPrimary = heroHtml.match(/<a\b[^>]*class=["'][^"']*button-primary[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1] || "";
  assert(heroPrimary.startsWith("#"), `${name}: 첫 CTA는 페이지 내부 근거 구간으로 이동해야 함`);
  assert(!heroHtml.includes(kakaoUrl), `${name}: 히어로에서 카카오로 직접 이동하면 안 됨`);

  const storySources = [
    ...html.matchAll(/<img\b[^>]*class=["'][^"']*story-image[^"']*["'][^>]*src=["']([^"']+)["']/gi),
  ].map((match) => match[1]);
  assert(storySources.length === 5, `${name}: 스토리 이미지는 정확히 5장이어야 함`);
  assert(new Set(storySources).size === 5, `${name}: 스토리 이미지가 중복됨`);
  for (const src of storySources) {
    assert(src.startsWith("/coaching/coach-the-coach/assets/images/story/"), `${name}: 스토리 이미지 경로 불일치 ${src}`);
    assert(fs.existsSync(path.join(root, src.replace(/^\//, ""))), `${name}: 스토리 이미지 파일 누락 ${src}`);
  }

  const finalCtaIndex = html.indexOf('class="cta-band"');
  const kakaoIndex = html.indexOf(kakaoUrl);
  assert(finalCtaIndex >= 0 && kakaoIndex > finalCtaIndex, `${name}: 카카오 CTA는 최종 CTA 구간에만 있어야 함`);
  assert((html.match(/\bkakao-final\b/g) || []).length === 1, `${name}: 최종 카카오 CTA 식별자 누락`);
  const trustBridgeHtml = html.match(/<aside\b[^>]*class=["'][^"']*trust-bridge[^"']*["'][\s\S]*?<\/aside>/i)?.[0] || "";
  assert(trustBridgeHtml !== "", `${name}: 중간 신뢰 CTA 구조 누락`);
  assert(/href=["']#file-check["']/i.test(trustBridgeHtml), `${name}: 중간 신뢰 CTA가 파일 준비 체크로 연결되지 않음`);
  assert(/\bid=["']file-check["']/i.test(html), `${name}: 파일 준비 체크 앵커 누락`);
  assert(!trustBridgeHtml.includes(kakaoUrl), `${name}: 중간 신뢰 CTA에서 카카오로 직접 이동하면 안 됨`);
  assert(!/\sstyle=["']/i.test(html), `${name}: 인라인 스타일이 남아 있음`);
}

for (const [file, content] of [
  ["ctc90.css", read(path.join(siteRoot, "assets", "ctc90.css"))],
  ["ctc90.js", read(path.join(siteRoot, "assets", "ctc90.js"))],
]) {
  assert(content.trim().length > 0, `${file}: 파일이 비어 있음`);
}

for (const required of ["존재", "관계", "합의", "경청", "확장", "성장"]) {
  assert(htmlByPage.hub.includes(required), `허브: DAILY 렌즈 누락 ${required}`);
}
for (const required of [
  "당신은 고객의",
  "당신의 코칭 사각지대는",
  "누가 봅니까?",
  "돈을 받고 코칭하기 시작하면",
  "고객이 오래 침묵할 때",
  "잘해주고 싶은 마음이",
  "이번 장면을 그냥 지나치지 마십시오",
]) {
  assert(htmlByPage.hub.includes(required), `허브: 전환 카피 누락 ${required}`);
}
assert(htmlByPage.hub.includes('id="paid-coaching"'), "허브: 유료코칭 리스크 섹션 누락");
for (const [name, html] of Object.entries(htmlByPage)) {
  assert(html.includes(`/assets/images/story/${name}-01-hero.webp`), `${name}: 전용 히어로 이미지 누락`);
  assert(!html.includes("ctc90-editorial-hero.webp"), `${name}: 구형 공용 히어로 이미지가 남아 있음`);
  assert(html.includes('class="hero-collage"'), `${name}: 히어로 콜라주 구조 누락`);
}
for (const required of ["멈춤", "반영", "한 질문", "확인", "내면 듣기", "고객다움", "복기"]) {
  assert(htmlByPage.hub.includes(required), `허브: 7 STEPS 누락 ${required}`);
}
for (const required of ["관계", "합의", "고객 언어 경청", "열린 질문", "고객 선택권"]) {
  assert(htmlByPage.kac.includes(required), `KAC: 핵심 관찰요소 누락 ${required}`);
}
for (const required of ["통합적 경청", "침묵", "감정", "에너지", "정체성", "은유", "직관"]) {
  assert(htmlByPage.kpc.includes(required), `KPC: 핵심 관찰요소 누락 ${required}`);
}

const prohibited = [
  new RegExp(["1:1 코치더코치", "60"].join("\\s+"), "i"),
  new RegExp(["코치더코치", "60"].join("\\s+"), "i"),
  new RegExp(["실제 고객", "LIVE"].join("\\s+"), "i"),
  new RegExp(["3회", "성장트랙"].join("\\s+"), "i"),
  new RegExp(["track", "Enabled"].join(""), "i"),
  new RegExp(["track", "Price"].join(""), "i"),
  new RegExp(["합격", "예측"].join(""), "i"),
  new RegExp(["인정시간", "자동계산"].join("\\s*"), "i"),
  new RegExp(["카카오", "채널"].join("\\s*"), "i"),
];
for (const pattern of prohibited) {
  assert(!pattern.test(combinedHtml), `금지 문구 노출: ${pattern}`);
}

assert(
  !/(?:₩|[0-9][0-9,]*\s*원)/.test(combinedHtml),
  "미확정 판매가격 숫자가 웹페이지에 노출됨",
);
assert(
  combinedHtml.includes("영상") && combinedHtml.includes("음성파일") && combinedHtml.includes("화자"),
  "영상·음성 허용 및 화자 식별 게이트 문구 누락",
);
assert(
  combinedHtml.includes("재제출") && combinedHtml.includes("역량평가"),
  "파일 부적격 시 역량평가 없이 재제출하는 규칙 누락",
);

if (failures.length) {
  console.error(`CTC90 QA 실패 (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("CTC90 QA 통과");
console.log(`- 페이지: ${Object.keys(pages).length}`);
console.log(`- 카카오 CTA: ${(combinedHtml.match(new RegExp(kakaoUrl, "g")) || []).length}`);
console.log(`- 스토리 이미지: ${(combinedHtml.match(/\bstory-image\b/g) || []).length}`);
console.log("- 구형 상품·자동판정·잘못된 운영명칭 회귀: 0건");
