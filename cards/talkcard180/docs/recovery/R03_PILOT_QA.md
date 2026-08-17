# R04 PILOT UX QA

## RUN

R04 — PILOT UX QA

## STATUS

PARTIAL

핵심 PICK → SEE → TALK Pilot는 실제 브라우저에서 PASS했다. 다만 R04 검수 항목 중 정확한 모바일 viewport 조작을 현재 브라우저에서 실행할 수 없어 전체 R04 Gate는 승인하지 않는다. 지시대로 R05로 확장하지 않고 여기서 중지한다.

## CANDIDATE

- URL: `https://daily-coach-ing.com/cards/talkcard180/index-v21.html`
- 배포 형태: hidden, `noindex, nofollow`
- Pilot: T01 + I01 only
- Production `index.html`: 미변경
- v2.0 `index-v2.html`: 미변경

## ENVIRONMENT

- 실제 브라우저: Chrome
- 실제 검증 viewport: 1363 × 936, DPR 1
- 대상 배포: GitHub `main`의 숨은 v2.1 candidate 경로
- 정확한 390 / 430 / 768 / 1440 viewport QA: R08 범위

## PILOT SUCCESS TEST

| 단계 | 실제 행동 | 결과 |
|---|---|---|
| 1. 테마 선택 | OPENING → `카드 시작하기` → T01 또는 I01 선택 | PASS |
| 2. 카드 펼치기 | DECK INTRO의 `카드 펼치기` 선택 | PASS |
| 3. 카드 한 장 선택 | 내용 없는 15개 카드 뒷면 중 임의 카드 click/Enter/Space | PASS |
| 4. 질문/이미지 보기 | T01 질문 공개, I01 이미지 단독 공개 | PASS |
| 5. 대화 | PASS, 질문 열기, 한 걸음 더, 조기 종료 액션 제공 | PASS |
| 6. 다음 카드 고르기 | 새 카드 자동 노출 없이 TABLE 복귀 | PASS |

설명 없이 주요 CTA 문구와 카드 뒷면만으로 위 흐름을 수행할 수 있었다.

## TEXT PILOT — T01

| 검사 | 실제 결과 | 상태 |
|---|---|---|
| CARD TABLE 진입 | 15개 button, 0 used, `00 / 15` | PASS |
| 선택 전 내용 비노출 | TABLE visible text와 button accessible name에 질문 없음 | PASS |
| 직접 선택 | 7번 카드 선택 후 `ice_6` 질문 공개 | PASS |
| 진행 의미 | 선택 직후 `01 / 15` | PASS |
| 자동 NEXT 없음 | `data-action="next-card"` 0개 | PASS |
| TABLE 복귀 | `다음 카드 고르기` 후 table만 visible | PASS |
| used 상태 | 7번 자리에 `가볍게 인사 카드 7번, 이미 사용함` | PASS |
| 위치 안정성 | 나머지 14개 ID의 슬롯 index 및 회전값 유지 | PASS |
| 중복 방지 | used 슬롯은 button이 아니며 다시 선택 불가 | PASS |
| Keyboard Enter | 2번 카드 Enter로 선택·질문 공개 | PASS |
| Keyboard Escape | REVEAL에서 Escape 후 TABLE 복귀, used 2장 유지 | PASS |
| session restore | reload 후 `02 / 15`, used 2, 동일 셔플·슬롯 | PASS |
| 조기 CLOSING | 2장 사용 후 종료, `2 CARDS PICKED` | PASS |
| 같은 덱 다시 섞기 | `00 / 15`, 15 backs, used 0, 새 순서 | PASS |

## IMAGE PILOT — I01

| 검사 | 실제 결과 | 상태 |
|---|---|---|
| DECK INTRO | 실제 이미지 0개, 카드 뒷면 stack만 표시 | PASS |
| CARD TABLE | 15 backs, `00 / 15`, 이미지 preview 0개 | PASS |
| 접근성 이름 | `기억 한 조각 카드 n번, 아직 열지 않음` | PASS |
| 직접 선택 | 4번 카드 선택 후 `memory_10` 공개 | PASS |
| IMAGE FIRST | 이미지 visible, main prompt hidden, follow-up hidden | PASS |
| 이미지 자산 | 1122 × 1402 WebP 실제 로드 | PASS |
| 객관적 ALT | `낮은 풀밭 사이로 먼 언덕까지 이어지는 가느다란 흙길` | PASS |
| main prompt | `질문 열기` 후 main 1개만 visible | PASS |
| follow-up 격리 | main 공개 시 follow-up hidden | PASS |
| 한 걸음 더 | 두 번째 선택 후 follow-up visible, 추가 버튼 제거 | PASS |
| prompt session restore | reload 후 같은 image/main/follow-up 상태 복원 | PASS |
| TABLE 복귀 | used 슬롯 1개, 나머지 14 backs, preview 0개 | PASS |
| Keyboard Space | 카드 1번을 Space로 선택, image only 확인 | PASS |
| 15장 완주 | `15 / 15` 카드 후 자동 새 카드 없이 CLOSING | PASS |
| CLOSING count | `15 CARDS PICKED` | PASS |

## AGENCY ACCEPTANCE

- 질문 또는 이미지를 보기 전에 사용자가 카드 뒷면을 직접 선택한다: PASS
- `NEXT` 연타로 15장을 소비하는 흐름이 없다: PASS
- 대화가 끝나면 시스템이 다음 카드를 자동 출력하지 않는다: PASS
- 선택 카드가 TABLE에서 USED 빈자리로 바뀌고 나머지 위치는 유지된다: PASS
- IMAGE card는 이미지가 질문보다 먼저다: PASS
- main prompt와 follow-up 모두 optional이다: PASS

## ACCESSIBILITY PILOT

| 검사 | 상태 |
|---|---|
| semantic button / list / region | PASS |
| 카드 accessible name | PASS |
| used accessible name | PASS |
| Enter 선택 | PASS |
| Space 선택 | PASS |
| Escape 복귀 | PASS |
| focus-visible 기반 | PASS — 정적 + 실제 focus 이동 |
| ARIA live progress/announcement | PASS |
| objective image ALT | PASS |
| image failure fallback binding | PASS — 정적 |
| reduced motion | PASS — 정적 |

## RESPONSIVE PILOT

| 항목 | 결과 |
|---|---|
| Desktop 1363 × 936 실제 click/visual | PASS |
| Desktop 기본 5 × 3 table | PASS |
| 768 이하 3열 media rule | PASS — 정적 |
| 430 rule | PASS — 정적 |
| 390 rule | PASS — 정적 |
| card minimum target 44px | PASS — 정적 |
| 정확한 모바일 viewport 실제 조작 | BLOCKED |

현재 Cloud Browser는 viewport 변경 API를 제공하지 않고 1363 × 936으로 고정돼 있다. 390px 격리 미리보기를 열려는 시도는 브라우저 URL 보안 정책으로 거부되었으며, 정책상 우회하지 않았다. 따라서 실제 390/430/768 판정은 R08 이전에 PASS로 올리지 않는다.

## ISSUES FOUND AND FIXED

1. 숨김 IMAGE 요소의 `src=""`가 현재 문서를 이미지로 재요청할 수 있었다.
   - 조치: 초기 `src` 속성을 제거하고 PICK 이후에만 실제 WebP 경로를 설정했다.
   - 회귀 검사: `validate-r03-pilot.mjs`에 empty-src 금지 추가.
2. 15장 완주 자동화 묶음이 브라우저 실행 제한 시간을 넘겼다.
   - 조치: 테스트를 짧은 단계로 나눠 `15 / 15 → CLOSING`까지 완료했다.
   - 제품 오류 아님.

## CONTENT NOTE

- R01 분류: KEEP 34 / SOFTEN 14 / REWRITE 12.
- R07 이전이므로 Pilot 런타임 prompt는 원문을 유지한다.
- I01에서 확인한 `memory_10`은 R01에서 SOFTEN 대상이며 R07 제안은 `이 길을 보니 어떤 장면이 떠오르나요?`이다.
- follow-up 데이터는 삭제하지 않고 기본 숨김 정책을 지켰다.

## PROTECTION QA

- 12 themes: 보존
- TEXT 120: 보존
- IMAGE 60: 보존
- 180 unique IDs: 보존
- IMAGE WebP 60: 보존
- Production `index.html` blob: `4078aa8a9ba1c37ce6e5d20049c8d3f438860bac` — unchanged
- v2.0 `index-v2.html` blob: `d8ee82c3d9e351328a572dd3c8bd11e8f03ba89a` — unchanged

## COMPLETED

- T01 end-to-end direct-pick loop
- I01 image-first optional-prompt loop
- used/no-repeat/stable-position/session checks
- click, Enter, Space, Escape checks
- early closing, restart, full 15-card closing checks
- visual review of OPENING, TABLE, TEXT, IMAGE screens
- empty-src performance defect fix

## OUTPUT

- `docs/recovery/R03_PILOT_QA.md`
- hidden Pilot candidate `index-v21.html`

## QA

- R01 validator: PASS
- R02 validator: PASS
- R03 static validator: PASS
- R04 desktop browser E2E: PASS
- R04 exact mobile interaction: BLOCKED

## ISSUES

- R04 overall status remains PARTIAL because mobile interaction was not actually executed at 390px.
- R01 prompt changes remain intentionally unapplied until R07.

## NEXT

STOP.

R05 — 12 DECK INTEGRATION은 시작하지 않는다. 다음 작업은 Pilot 검토와 정확한 mobile QA 실행 가능 환경 확인 이후에만 진행한다.
