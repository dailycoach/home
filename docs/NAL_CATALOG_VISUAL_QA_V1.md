# NAL 카탈로그 비주얼 QA v1.0

검수일: 2026-08-01

기준 브랜치: `main`

작업 브랜치: `agent/nal-catalog-visual-upgrade-v1`

## 1. 완료 범위

| 항목 | 결과 |
|---|---|
| 공개 GATHER | 4종 확인 |
| 신규 공개 CLASS | 4종 확인 |
| 기존 미술심리코칭 6주 과정 | 공개 상태·연결 유지 |
| 공개 SHOP | 4종 확인 |
| 전용 WebP | 28개, 1,470,332 bytes |
| 공개 상세 HTML | 데이터 기반 재생성 |
| 공개 카탈로그 플레이스홀더 | 0건 |
| 미확정 가격·재고·신청 URL | 모두 `null` 유지 |

## 2. 정적 QA

다음 명령을 순서대로 실행했다.

```sh
node scripts/generate-nal-pages.mjs
node scripts/generate-nal-sitemap.mjs
node scripts/check-nal-platform.mjs
node --check nal/assets/js/app.js
git diff --check
```

결과:

```text
Generated 31 NAL pages from published data.
Generated sitemap with 52 URLs.
NAL QA passed: pages=31, programs=10 (9 public), products=8 (4 public), hosts=2 (2 public), content=1 (1 public)
```

`check-nal-platform.mjs`가 추가로 확인하는 항목:

- 공개 모임 4종, 신규 클래스 4종, 상품 4종의 정확한 ID 집합
- 기존 미술심리코칭 6주 과정 보존
- 중복 ID·slug와 잘못된 관계 ID
- 공개·비공개 상세 경로 일치
- 28개 파일 존재, 파일명, WebP 파싱, 정확한 픽셀 규격, 용량 상한
- 프로그램의 모바일 이미지·alt·활동·추천 대상
- 상품의 gallery alt·콘셉트 고지·미확정 운영 필드
- canonical, OG 이미지, sitemap, robots, JSON-LD
- 금지 브랜드 문구와 치료·효능 주장

## 3. 브라우저 QA

로컬 정적 서버와 Chromium 140 headless 환경에서 `scripts/nal-browser-qa.mjs`를 실행했다.

검수 화면폭:

- 360×800
- 390×844
- 412×915
- 768×1024
- 1280×900
- 1440×1000

검수 경로:

- 홈, GATHER·CLASS·SHOP 목록
- 카탈로그 상세 12개
- 검색, MY NAL
- 전체 공개 경로 31개 HTTP·콘솔 스모크

| 검수 | 결과 |
|---|---:|
| 전체 공개 경로 HTTP 200 | 31/31 |
| 반응형 레이아웃 검사 | 108/108 통과 |
| 가로 넘침 | 0px |
| 콘솔·pageerror·내부 4xx/5xx | 0건 |
| 카탈로그 이미지 실패 | 0건 |
| 공개 카탈로그 폴백 노출 | 0건 |
| 모바일 제목 최대 줄 수 | 2줄 |
| 모바일 찜 버튼 최소 터치 영역 | 44px |
| 배지·찜 버튼 겹침 | 0건 |
| 최대 CLS | 0.000 |
| 최대 로컬 LCP | 188ms |
| JavaScript 비활성 폴백 | 7/7 통과 |
| Axe WCAG A/AA 대표 스캔 | 8/8, serious·critical 0건 |

LCP는 로컬 정적 서버의 회귀 지표다. 실제 네트워크, CDN, 캐시 상태를 포함한 배포 환경 성능 수치는 배포 후 Lighthouse 또는 필드 데이터로 다시 확인해야 한다.

## 4. 기능 QA

| 흐름 | 결과 |
|---|---|
| 모바일 메뉴 열기·Escape 닫기·포커스 복귀 | 통과 |
| 클래스 상태 필터 URL 반영 | 통과 |
| 감정카드 대화모임 찜 → MY NAL | 통과 |
| 상세 방문 → 최근 본 항목 | 통과 |
| 카탈로그 12종 제목 개별 검색 | 12/12 통과 |
| JavaScript 비활성 홈·목록·상세 | 통과 |

## 5. QA 캡처

캡처는 lazy 이미지가 실제 페인트되도록 페이지 전체를 스크롤한 뒤 저장했다.

| 화면 | 390px | 1440px |
|---|---|---|
| NAL 홈 | `home-390.png` | `home-1440.png` |
| GATHER 목록 | `gather-list-390.png` | `gather-list-1440.png` |
| CLASS 목록 | `class-list-390.png` | `class-list-1440.png` |
| SHOP 목록 | `shop-list-390.png` | `shop-list-1440.png` |

대표 상세:

- `gather-detail-1440.png`: 감정카드 대화모임
- `class-detail-1440.png`: 미술로 그리는 현재의 마음
- `shop-detail-1440.png`: 감정카드
- `browser-results.json`: 전체 자동 검수 결과

저장 위치: `/docs/nal-catalog-visual-qa/`

## 6. 변경 파일 범위

| 구분 | 파일 |
|---|---|
| 데이터 | `nal/data/programs.json`, `nal/data/products.json`, `nal/data/site.json`, `nal/data/routes.json` |
| 런타임 | `nal/assets/js/app.js`, `nal/assets/css/nal.css` |
| 이미지 | `nal/assets/images/catalog/{gather,class,shop}/` 28개 |
| 생성기·QA | `scripts/generate-nal-pages.mjs`, `scripts/generate-nal-sitemap.mjs`, `scripts/check-nal-platform.mjs`, `scripts/nal-browser-qa.mjs` |
| 생성 결과 | `/nal/` 아래 공개 HTML 31개, `sitemap.xml` |
| 문서 | `docs/NAL_CATALOG_VISUAL_SYSTEM_V1.md`, `docs/NAL_CATALOG_IMAGE_GUIDE_V1.md`, 이 문서와 QA 캡처 |

`generate-nal-sitemap.mjs`는 실행 결과만 갱신되었고 스크립트 본문 변경은 없다.

## 7. 롤백 방법

배포 전에는 작업 브랜치를 배포 대상에서 제외하면 된다. 병합 후에는 NAL 카탈로그 품질업 커밋을 `git revert`해 데이터, 런타임, 생성 HTML, 이미지, 문서를 한 번에 되돌린다.

일부 이미지만 교체할 때도 생성 HTML을 직접 수정하지 않는다. JSON 이미지 경로와 alt를 먼저 되돌리거나 교체한 다음 페이지·sitemap 생성과 전체 QA를 다시 실행한다.

로컬 찜과 최근 본 항목은 브라우저 localStorage에 있으므로 코드 롤백 과정에서 사용자 기기의 데이터를 삭제하지 않는다.

## 8. 제한사항과 운영 확정 필요 항목

다음 정보는 확정되지 않아 공개하지 않았다.

- 실제 모집 날짜·시간·장소·주소
- 참가비·상품 가격
- 모집 정원·잔여 좌석
- 상품 재고·배송 조건·교환·환불 정책
- 실제 신청·개별 구매 URL
- 실물 카드 수량·크기·패키지 소재·구성
- 실제 행사 사진과 참여자 후기

배포 전 운영자는 이미지가 비주얼 콘셉트라는 고지가 현재 판매·운영 단계에 적절한지, 스마트스토어 홈 보조 링크를 유지할지, 실제 운영정보 공개 시점을 최종 승인해야 한다.
