# A05 UX BUILD REPORT

## RUN

A05 UX BUILD

## STATUS

COMPLETE

## COMPLETED

- 기존 라이브 `index.html`을 수정하지 않고 `index-v2.html`에 별도 스테이징 화면을 구축했다.
- `OPENING → 12 THEMES → DECK INTRO → CARD PLAY → CLOSING`의 5단계 제품 흐름을 구현했다.
- `themes.js`, `cards.js`, `image-card-manifest.json`을 화면 코드가 직접 사용하도록 연결했다.
- 테마 선택 화면에 8개 QUESTION DECK과 4개 IMAGE DECK을 모두 표시한다.
- QUESTION DECK은 질문을 카드 중앙에 크게 배치하고 이전·다음·테마 이동 및 `01 / 15` 진행 표시를 제공한다.
- IMAGE DECK은 이미지 우선 공개 → 질문 보기 → 선택적 FOLLOW-UP의 단계형 흐름을 제공한다. 질문은 이미지 위에 겹치지 않는다.
- 마지막 카드 이후 단순 완료 대신 대화형 Closing Question과 `다른 테마 고르기 / 한 장 더 / 처음으로` CTA를 제공한다.
- PASS, LISTEN, NO RIGHT ANSWER의 축약된 대화 규칙을 Opening에 배치했다.
- 실제 카드 더미처럼 보이는 겹침, 종이 질감, 미세한 slide/fade/rotate 동작을 적용했다. 3D flip과 게임형 효과는 사용하지 않았다.
- TITLE, DESCRIPTION, OG 기본 메타를 v2 제품 정의에 맞췄다.

## DATA / ENGINE / VIEW SEPARATION

- DATA: `data/themes.js`, `data/cards.js`, `data/image-card-manifest.json`
- VIEW: `index-v2.html`, `css/talkcard.css`, `js/talkcard-view.js`
- ENGINE: A06 잠금 유지. A05는 검수 가능한 원본 순서만 사용하며 `Math.random`과 shuffle을 사용하지 않는다.

## OUTPUT

- `cards/talkcard180/index-v2.html`
- `cards/talkcard180/css/talkcard.css`
- `cards/talkcard180/js/talkcard-view.js`
- `cards/talkcard180/scripts/validate-a05-ux.mjs`
- `cards/talkcard180/docs/a05/A05_UX_QA_RESULT.json`
- `cards/talkcard180/docs/A05_UX_BUILD_REPORT.md`

## QA

- A05 validator: `55 / 55 PASS`
- A00–A04 regression validators: `6 / 6 PASS`
- Node syntax check: PASS
- HTTP smoke: HTML / CSS / JS / manifest / sample WebP 모두 200 및 정상 MIME
- 데이터: `12 themes / 120 text / 60 image / 180 total` PASS
- 반응형 계약: 390px, 430px, 768px, 1440px, 낮은 landscape 화면 대응 규칙 확인
- 접근성 계약: skip link, native button, focus-visible, heading, aria-live, 객관적 ALT 연결, image fallback, reduced motion, safe-area 확인
- Production `cards/talkcard180/index.html` SHA: main과 작업 브랜치 모두 `4078aa8a9ba1c37ce6e5d20049c8d3f438860bac`로 동일

## ISSUES

- 오류 없음.
- 저장소 로컬 서버는 Cloud Browser와 연결되지 않아 이 RUN에서는 실제 브라우저 클릭 E2E를 완료로 주장하지 않는다. 해당 검수는 작업지시서대로 A07의 필수 Gate로 유지한다.
- 테마별 shuffle, 15장 중복 방지, 세션 상태는 의도적으로 A06에 남겨두었다.

## NEXT

A06 DECK ENGINE

- 선택한 테마의 15장만 shuffle
- 15장을 모두 보기 전 중복 금지
- TEXT / IMAGE 공통 엔진 연결
- 현재 덱·카드·진행도 수준의 가벼운 session state
- A05 원본 순서 검수 어댑터를 A06 엔진으로 교체

Production 배포, PR, live `index.html` 교체는 계속 금지한다.
