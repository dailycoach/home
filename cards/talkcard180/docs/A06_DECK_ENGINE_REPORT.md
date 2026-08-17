# A06 DECK ENGINE REPORT

## RUN

A06 DECK ENGINE

## STATUS

COMPLETE

## COMPLETED

- 선택한 한 테마의 15장만 엔진 입력으로 받도록 잠갔다.
- TEXT 8개 덱과 IMAGE 4개 덱에 동일한 Fisher–Yates shuffle 엔진을 연결했다.
- 원본 카드 배열을 변경하지 않고 별도의 ID 순서를 생성한다.
- 15장을 모두 보기 전 같은 카드가 다시 나오지 않는다.
- 이전 → 다음 이동 시 최초 shuffle 순서를 유지한다.
- `01 / 15`부터 `15 / 15`까지 엔진 진행 상태를 View에 연결했다.
- 15번째 카드에서 다음을 누르면 Closing으로 이동하고 완료 상태를 기록한다.
- 완료된 덱을 다시 시작하면 새 shuffle cycle을 만들고 직전 15번째 카드의 즉시 반복을 피한다.
- Closing의 `한 장 더`도 직전 카드와 다른 카드로 시작하며 한 장 사용 후 Closing으로 돌아간다.
- 손상되거나 다른 테마에 속한 session state는 폐기하고 안전한 새 덱을 생성한다.

## SESSION STATE

`sessionStorage` 한 곳에 아래 엔진 정보만 저장한다.

- schema version
- theme ID / card type
- shuffled card ID order
- current position / completion / mode / cycle
- start / update timestamp

질문 문장, 이미지 질문, FOLLOW-UP, 사용자 답변, 이름·이메일 등 민감 정보는 저장하지 않는다.

## DATA / ENGINE / VIEW

- DATA: `data/themes.js`, `data/cards.js`, `data/image-card-manifest.json`
- ENGINE: `js/talkcard-engine.js`
- VIEW: `js/talkcard-view.js`

View는 `Math.random` 또는 shuffle을 직접 호출하지 않고 이전·다음·한 장 더를 모두 Engine API로 처리한다.

## OUTPUT

- `cards/talkcard180/js/talkcard-engine.js`
- `cards/talkcard180/js/talkcard-view.js`
- `cards/talkcard180/scripts/validate-a06-engine.mjs`
- `cards/talkcard180/scripts/validate-a05-ux.mjs` · A06 이후 회귀 검수 가능하도록 단계형 보강
- `cards/talkcard180/docs/a06/A06_DECK_ENGINE_QA_RESULT.json`
- `cards/talkcard180/docs/A06_DECK_ENGINE_REPORT.md`

## QA

- A06 engine validator: `99 / 99 PASS`
- 12개 테마 실제 엔진 순회: `180 visited / 180 unique within each deck / theme mix 0`
- TEXT DECK: `8 / 8 PASS`
- IMAGE DECK: `4 / 4 PASS`
- source data mutation: 없음
- previous / next stable order: PASS
- session progress restore: PASS
- different-theme isolation: PASS
- corrupt session recovery: PASS
- completed cycle renewal: PASS
- cycle boundary immediate repeat prevention: PASS
- one-more immediate repeat prevention: PASS
- session minimal field check: PASS · 10 fields
- A00–A06 regression validators: `8 / 8 PASS`
- HTTP module smoke: HTML / View / Engine / Themes / Cards / Manifest 모두 200 및 정상 MIME

## ISSUES

- 중단 대상 오류 없음.
- 전체 180장 RANDOM MODE는 보조 기능이며 v2.0 핵심 경험에 필수가 아니므로 추가하지 않았다.
- 실제 브라우저 클릭, 모바일 실기기, 이미지 preload/lazy-load 및 Production E2E는 A07 Gate로 유지한다.

## NEXT

A07 PERFORMANCE / QA / RELEASE

- 60개 이미지 초기 일괄 로딩 방지 검증
- 현재 카드 + 다음 1–2장 preload
- 390 / 430 / 768 / 1440 및 landscape QA
- keyboard / focus / contrast / alt / image fallback QA
- 12개 테마 실제 클릭 E2E
- `01 / 15 → 15 / 15 → Closing → Restart` E2E
- Final diff review 후 Production 교체·배포 판단

PR, live `index.html` 교체 및 Production 배포는 A06에서 실행하지 않았다.
