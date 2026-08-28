# APILOS 검색 발견성 사전 감사

- 감사 일시: 2026-08-28 (Asia/Seoul)
- 저장소: `dailycoach/home`
- 브랜치/기준 커밋: `main` / `c0133f2`
- 대상: `https://daily-coach-ing.com/apilos/`
- 초기 판정: `PATCH_REQUIRED`
- 외부 소유확인: `BLOCKED_BY_EXTERNAL_VERIFICATION`

이 문서는 검색 관련 구현을 변경하기 전에 저장소와 운영 사이트의 현재 상태를 확인한 결과다. 시각 디자인, 콘텐츠 문구, CSS, 이미지, UI 구조는 감사 및 후속 패치 범위에서 제외한다.

## 요약

| 영역 | 판정 | 확인 결과 |
| --- | --- | --- |
| `robots.txt` | PASS | 모든 크롤러에 `/` 접근을 허용하고 루트 sitemap을 선언한다. Googlebot 및 Naver Yeti 차단 규칙이 없다. |
| `sitemap.xml` | PASS | APILOS 공개 URL 13개가 HTTPS 및 trailing slash 형식으로 각각 1회 존재한다. 중복 APILOS URL은 없다. |
| 공개 URL 13개 | PASS | 운영 HTTP 응답이 모두 200이다. |
| indexability | PASS | 13개 공개 페이지에 `noindex`가 없고 핵심 콘텐츠가 정적 HTML에 존재한다. |
| canonical | PASS | 13개 페이지 모두 자기 자신을 가리키는 절대 HTTPS canonical을 제공한다. |
| metadata / OG | PASS | 13개 페이지 모두 title, description, `og:title`, `og:description`, `og:url`, `og:image`, `twitter:card`를 제공한다. |
| 내부 링크 | PASS | 기존 정적 QA가 14개 APILOS HTML의 내부 `href`/`src` 대상 존재 여부를 통과했다. 13개 공개 URL은 정적 HTML 링크에서 접근 가능하다. |
| 404 | PASS | 루트 `404.html`과 APILOS 404에 `noindex,follow`가 있으며 운영 테스트 경로는 404를 반환한다. |
| structured data | PATCH_REQUIRED | APILOS 홈에 JSON-LD가 없다. 검증된 사실만 사용하는 `EducationalOrganization` 추가가 적합하다. |
| 검색 전용 QA | PATCH_REQUIRED | `scripts/check-apilos-search.mjs`가 없고 GitHub Actions에서 검색 발견성 검사를 실행하지 않는다. |
| Google 소유확인 | BLOCKED_BY_EXTERNAL_VERIFICATION | 실제 Search Console DNS TXT 또는 HTML meta token이 제공되지 않았다. placeholder는 삽입하지 않는다. |
| Naver 소유확인 | BLOCKED_BY_EXTERNAL_VERIFICATION | 실제 Search Advisor token이 제공되지 않았다. placeholder는 삽입하지 않는다. |

## 필수 파일 감사

- `/robots.txt`: PASS
- `/sitemap.xml`: PASS
- `/404.html`: PASS (`noindex,follow`)
- `/apilos/index.html`: PATCH_REQUIRED (검색 메타데이터는 정상, JSON-LD 없음)
- `/apilos/center/index.html`: PASS
- `/apilos/programs/index.html`: PASS
- `/apilos/archive/index.html`: PASS
- `/apilos/books/index.html`: PASS
- `/apilos/news/index.html`: PASS
- `/apilos/app.js`: PASS (검색 메타데이터를 JavaScript에 의존하지 않음)
- `/apilos/qa.css`: PASS (검색 패치 대상 아님)
- `/scripts/check-apilos-site.mjs`: PASS (기존 사이트 QA 0 failures / 0 warnings)
- `/scripts/check-apilos-live.mjs`: PASS (13개 공개 URL, 404, 로고 운영 검사 통과)
- `/.github/workflows/check-apilos-site.yml`: PATCH_REQUIRED (검색 전용 QA 호출 없음)

## 공개 URL 대조

아래 13개 URL은 저장소의 정적 HTML 파일, sitemap 항목, 내부 링크 및 운영 200 응답과 모두 대조했다.

1. `/apilos/`
2. `/apilos/center/`
3. `/apilos/programs/`
4. `/apilos/programs/professional-academy/`
5. `/apilos/programs/youth-family-school/`
6. `/apilos/programs/pastoral-coaching/`
7. `/apilos/programs/professional-network/`
8. `/apilos/programs/social-impact/`
9. `/apilos/programs/research-publication/`
10. `/apilos/archive/`
11. `/apilos/books/`
12. `/apilos/books/sachungi-coaching-psychology/`
13. `/apilos/news/`

## robots / sitemap 상세

`robots.txt`는 다음 기준을 만족한다.

- `User-agent: *`
- `Allow: /`
- `Sitemap: https://daily-coach-ing.com/sitemap.xml`
- Googlebot 전용 차단 없음
- Naver Yeti 전용 차단 없음
- `/apilos/` 차단 없음

루트 sitemap은 APILOS 13개 URL을 정확히 1회씩 포함한다. APILOS 항목은 모두 production HTTPS 호스트와 trailing slash를 사용하며 `lastmod`는 `YYYY-MM-DD` 형식이다. 루트 sitemap의 `/tests/` 항목들은 기존 별도 공개 프로젝트 URL이며, staging/QA placeholder로 간주해 제거하지 않는다.

## 콘텐츠 신호

요청된 핵심어 대부분은 현재 보이는 HTML 콘텐츠에 자연스럽게 존재한다. `글로벌미래교육원`, `글로벌미래교육원 상담코칭센터`, `곽동현`, `상담코칭`, `전문가 양성과정`, `통합상담코칭전문가`, `한국전문상담학회`, `해피피플`, `목회코칭`, `청소년 상담`, `학습코칭`, `심리상담`, `코칭`, `전문가교육`을 확인했다.

정확히 붙여 쓴 `진로코칭`은 없지만 `진로·학습`, `진로성장캠프` 등 동일 주제의 자연스러운 가시 콘텐츠가 존재한다. 디자인·콘텐츠 잠금과 keyword stuffing 금지 원칙에 따라 문구를 추가하지 않는다.

## 초기 검증 증거

- `node scripts/check-apilos-site.mjs`: PASS, 14 pages / 0 failures / 0 warnings
- `node scripts/check-apilos-runtime.mjs`: PASS
- `node scripts/check-apilos-live.mjs`: PASS, 15/15
- 운영 `/robots.txt`: HTTP 200
- 운영 `/sitemap.xml`: HTTP 200, APILOS `<loc>` 13개, 중복 0개
- 운영 `/apilos/__search_qa_not_found__/`: HTTP 404, `noindex` 확인

## 최소 패치 계획

1. APILOS 홈 `<head>`에 검증된 사실만 포함한 비시각적 `EducationalOrganization` JSON-LD를 추가한다.
2. `scripts/check-apilos-search.mjs`를 추가해 robots, sitemap, indexability, canonical, metadata, OG, JSON-LD, verification placeholder, staging/test 노출, 내부 링크를 검사한다.
3. 기존 workflow의 static QA에 검색 QA 한 줄을 추가하고 RSS-only 변경 exclusion을 유지한다.
4. Google Search Console 및 Naver Search Advisor 설정 문서를 작성하되 실제 provider token은 삽입하지 않는다.

## 변경 금지 확인

후속 패치에서 Hero, 색상, 폰트, 레이아웃, 이미지, 로고, 카드, 애니메이션, 모바일 UI, 푸터, 콘텐츠 문구, CSS를 변경하지 않는다. 검색용 `<head>` 데이터, QA 스크립트, workflow, 문서만 수정한다.
