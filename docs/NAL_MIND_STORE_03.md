# NAL-MIND-STORE-03 · Release QA / merge gate

PR #155 · `feat/nal-mind-tools-commerce-v1`. 검증 시작 HEAD: `401ccdc9a834dcc8457ed4e6fdcda37e542d59da`.

판정: **MERGE READY WITH EXISTING INFRA WARNING**. main 병합, production 배포, 운영 Supabase migration·Storage 업로드·Edge 배포는 수행하지 않았다.

| Gate | 결과 | 근거 |
| --- | --- | --- |
| G0 DATA | PASS | schema, canonical/legacy 상품 타입, 등록 템플릿, 비공개 route·목록·검색 차단 |
| G1 STOREFRONT | PASS | PDF 우선, 실물 4종 유지, 형태·주제·대상·정렬·검색, PDF 3:4 / 실물 1:1 |
| G2 DETAIL | PASS | 저자·가격·파일·쪽수·용량·목차·미리보기·구매·이용권·인쇄·전달 안내 |
| G3 DELIVERY ARCHITECTURE | PASS · LOCAL | private 파일 매핑, 구매권한·본인 확인, RLS·FK·indexes, 행 잠금·한도·재시도·실패 복구 |
| G4 QA | PASS | 실제 Chromium 232개 검증, 캡처 검토, 정적·회귀·보안 검사 |

| 화면 QA | 결과 |
| --- | --- |
| 320 / 390 / 768 / 1024 / 1440 | 모두 PASS |
| system / light / dark | PASS |
| 200% TEXT | PASS · 고정 CSS viewport에서 모든 computed font-size를 2배로 렌더링 |
| Keyboard | PASS · Tab/Enter, 포커스 outline 또는 shadow, disabled 제외, drawer ESC·포커스 복귀 |
| Search / SEO / Security / Regression | 모두 PASS |
| P0/P1 화면 결함 | 확인된 미해결 항목 없음 |

## 실제 브라우저 검증

`scripts/nal-store-release-qa.mjs`는 저장소의 실제 generator와 CSS/JS를 사용한다. 임시 디렉터리에만 PDF fixture와 sample PDF를 만들고 임시 test server에서만 backend를 비활성화한다. production의 products.json, backend.json에는 변경이 없다. 테스트 종료 후 임시 빌드는 삭제된다. 테스트 가격·저자·쪽수·정책은 실제 판매 정보가 아니다.

Playwright 1.62.1 / Chromium 153.0.8010.0 / axe-core 4.10.3. 검증 대상은 스토어, 실물 상세 4종, PDF 상세·목차·미리보기·이용 안내, 가격·쪽수·저자·표지 미정, 미리보기 없음, 품절·긴 제목, 비공개 상품이다. 텍스트 확대는 브라우저 메뉴의 zoom 조작 대신 실제 Chromium에서 텍스트만 2배로 확대하는 방식이다. deviceScaleFactor 확대와 구분한다. 모든 5개 폭에서 확대 후 수평 넘침·CTA 영역과 하단 CTA 위 푸터 접근을 확인했다.

형태·주제·대상 조합과 URL/history, 추천·최신·가격 양방향 정렬, 빈 검색, 제목·부제·저자·설명·카테고리·태그·대상·목차 검색을 검증했다. 찜과 최근 본 항목은 기존 local storage 흐름을 유지한다. 탐색·미리보기에 로그인은 요구하지 않는다. MY NAL의 구매자료는 연결 준비 상태를 유지한다.

필수 캡처 11개와 추가 텍스트 확대 캡처, results.json, axe 결과, workflow parser 결과는 별도 QA artifact로 보관한다. 배포 저장소에 PNG를 추가하지 않는다.

- shop-320.png / shop-390.png / shop-768.png / shop-1024.png / shop-1440.png
- pdf-detail-390.png / pdf-detail-1440.png
- physical-detail-390.png / physical-detail-1440.png
- dark-shop-390.png / dark-pdf-detail-390.png
- text-200-shop-390.png / text-200-pdf-390.png / text-200-long-title-390.png

## QA에서 수정한 결함

- PDF 목록 표지의 3:4 규칙이 더 구체적인 실물 1:1 CSS에 덮이던 문제를 수정했다.
- 320px·768px의 200% 텍스트에서 구매 패널 버튼이 넘치던 문제를 flex wrap과 텍스트 줄바꿈으로 수정했다.
- 상품 metadata 갱신 시 preview 서버 origin이 canonical·OG·Product URL에 들어가지 않도록 공개 도메인을 사용한다.
- 가격 미정 상세 문구를 `판매가 준비 중`으로 맞추고 기존 DOM assertion을 갱신했다.
- 모바일 상품 카드 배지는 이미지 하단으로 옮겨 찜 버튼과 겹치지 않게 했고 실물 표기는 `실물`로 줄였다. 상품 형태의 상세 텍스트는 그대로 유지한다.
- 기존 홈의 런칭 섹션이 늦게 삽입되던 렌더링 순서도 보완했다. 홈에서만 런칭 자료를 먼저 읽고, launch listener를 app보다 먼저 등록하며 실제 페이지 렌더 완료 event에서 즉시 삽입한다. 화면 구성·프로그램·CTA는 변경하지 않는다. 768px 동일 조건 6회 비교에서 main CLS 0.374–0.398이 release 0–0.000263으로 줄었다.
- 기존 전체 브라우저 QA의 JavaScript 없는 홈 화면 기대 문구를 현재 generator의 `가장 먼저 여는`에 맞췄다.
- 생성 HTML의 asset version을 mind-store-03으로 갱신해 수정된 CSS/JS가 이전 캐시에 남지 않게 했다.

## Static / local security

모두 PASS:

- `node scripts/check-nal-platform.mjs`: 32 pages, public programs 9 / products 4 / hosts 2 / content 1.
- `node scripts/check-nal-theme.mjs`: 초기 적용·기기 설정 변경·저장·탭 동기화·저장 제한 대응.
- `node scripts/check-nal-backend.mjs`: 운영 public RPC가 기존 공개 카탈로그를 정상 반환한다. 읽기 전용 검증이다.
- `scripts/check-nal-store.mjs`: Ajv schema·필터·정렬·검색·URL 안전성·직접 구매 CTA.
- `scripts/test-nal-product-workflow.mjs`: 9 checks, 최소 등록·생성·SEO·비공개 전환·개인 파일 필드 거부.
- `scripts/test-nal-store-dom.mjs`: 26 checks, 데이터·상세·검색·테마·찜·미정 상태.
- `scripts/nal-browser-qa.mjs`: 기존 전체 NAL 회귀 suite, 31 routes / 6 viewports / 108 layout cases / 8 accessibility scans. PDF fixture 없이 별도 임시 server에서 검증한다.
- `scripts/test-nal-digital-download.mjs`: 26 checks, mocked Auth/Storage 기반 함수 검증.
- `scripts/test-nal-supabase.mjs`: PGlite PostgreSQL 90 checks, migration·FK·unique·RLS·anon/authenticated/service 권한·순차 예약·한도·복구.
- app/store/generator/sitemap/browser QA/Edge entry syntax, css-tree parse, `git diff --check`.
- 공개 NAL HTML/JSON/JS 48개에서 originalPdfUrl·privateStoragePath·entitlement ID·서버 키·private bucket public/sign URL·하드코딩 download token 미노출.

행 잠금 순서와 원자적 예약 SQL은 별도 소스 검토했다. PGlite는 Auth/Storage 테이블을 stub으로 준비하는 로컬 검증이며 실제 Supabase CLI·JWT gateway·Storage·결제 통합 배포 검증을 의미하지 않는다. 운영 DB에는 migration을 적용하지 않았다. CLI 분석 metadata 전송 차단을 우회하지 않았다.

## Actions root cause / gate

| Workflow | 기존 feature HEAD 실패 | 기존 main 실패 | jobs |
| --- | --- | --- | --- |
| KGM210 | [37124812197](https://github.com/dailycoach/home/actions/runs/37124812197) | [37121869818](https://github.com/dailycoach/home/actions/runs/37121869818) | 모두 0 |
| RSEDU | [37124811583](https://github.com/dailycoach/home/actions/runs/37124811583) | [37121870190](https://github.com/dailycoach/home/actions/runs/37121870190) | 모두 0 |

main `856e6652be1fe798b2f633045e2c0d0270bbc6e4`와 시작 feature HEAD의 두 workflow 파일은 byte-identical이었다. KGM210의 여러 줄 issue body와 RSEDU의 Python triple-quoted 문자열 continuation이 `run: |` 들여쓰기 밖으로 빠져 YAML 파싱이 실패했다. step 실행 중 실패가 아니다.

수정은 해당 문자열 줄에 YAML indentation 10 spaces를 추가하는 것뿐이다. triggers·permissions·expressions·배포·메뉴 로직을 변경하지 않았다. YAML 1.2, SchemaStore GitHub workflow schema, GitHub 공식 `@actions/workflow-parser` 0.3.61 parse/convert, bash -n, 내장 Python compile을 통과했다. RSEDU의 원래 legacy 메뉴 fixture에 적용한 결과와 재실행 idempotence도 통과했다.

**남은 기존 인프라 경고:** RSEDU 내장 patch는 현재 index.html에 없는 오래된 LCMS 데스크톱 기준 문자열을 요구한다. 현재 main 메뉴 사본에 실행하면 해당 기준 문자열을 찾지 못해 실패한다. production 메뉴 치환·배포 로직은 이번 RUN에서 수정하지 않았다. 새 feature branch push에서 두 workflow는 main-only 조건에 의해 실행 대상이 아니며, 실제 운영 배포 재실행은 하지 않는다. 기존 실패 run은 과거 기록으로 남는다.

GitHub branch API에서 main은 `protected=false`, enforcement off / required contexts·checks empty였다. 적용 rulesets도 빈 목록이다. 별도 protection endpoint는 앱의 administration 권한 부족으로 403이었으나, 접근 가능한 branch/rulesets 결과에서 required-check 차단은 확인되지 않았다. 다른 Actions와 Pages build의 성공 이력이 있어 repository 전체 Actions 비활성화 증상도 아니다.

## 재실행

Playwright/axe는 QA 전용 dependency로 준비한다. 기본 Playwright Chromium 또는 `NAL_BROWSER_EXECUTABLE`로 지정한 test Chromium을 사용한다. 사용자 브라우저 세션에는 연결하지 않는다.

```bash
NAL_PLAYWRIGHT_MODULE=/path/to/playwright \
NAL_AXE_MODULE=/path/to/axe-core \
NAL_QA_OUTPUT=/tmp/nal-mind-store-03-qa \
node scripts/nal-store-release-qa.mjs
```

최종 PR은 merge-ready 판정이며 병합 자체는 하지 않는다. 실제 판매 PDF·Auth/Storage 통합·결제·웹훅·Admin·production migration은 이번 범위에서 구현하거나 활성화하지 않았다.
