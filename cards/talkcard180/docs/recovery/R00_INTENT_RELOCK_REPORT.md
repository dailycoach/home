# R00 INTENT RELOCK REPORT

## RUN

R00 — INTENT RELOCK

## STATUS

COMPLETE

## PRODUCT LOCK

**TALK CARD 180 v2.1 — PICK · SEE · TALK**

이 복구 작업의 중심 행동은 아래 순서로 고정한다.

1. **PICK** — 내용이 보이지 않는 카드 뒷면 중 사용자가 직접 한 장을 고른다.
2. **SEE** — 선택된 카드만 앞으로 나오고, 질문 또는 이미지를 공개한다.
3. **TALK** — 카드로 대화한 뒤 자동으로 다음 카드를 보여주지 않고 테이블로 돌아간다.

따라서 정상 플레이 루프는 `TABLE → PICK → REVEAL → TALK → RETURN → TABLE`이다. `NEXT`나 배열 위치 증가가 제품의 중심 행동이 되는 구현은 허용하지 않는다.

## SOURCE BASELINE

2026-08-17 기준 로컬 후보와 GitHub `main`을 대조했다.

| 영역 | 기준 | 결과 |
|---|---|---|
| 테마 | 12개 | PASS — TEXT 8, IMAGE 4 |
| TEXT 카드 | 120장 | PASS — 원문 유지 |
| IMAGE 카드 | 60장 | PASS — WebP 경로·ALT·prompt·followup 유지 |
| 전체 카드 ID | 180개 | PASS — 180개 모두 고유 |
| 테마별 카드 수 | 각 15장 | PASS — 12개 테마 모두 15장 |
| 이미지 원본 | WebP 60개 | PASS — 전 경로 존재 |
| 썸네일 | 12개 | PASS — 이미지 테마별 3개 |
| 기존 A07 정적 QA | 91개 검사 | PASS — 91 / 91 |
| Production | `index.html` | LOCKED — 이번 복구 대상에서 제외 |
| v2.0 후보 | `index-v2.html` | PRESERVED — 직접 수정하지 않음 |

보존 기준 SHA-256:

- `index-v2.html`: `b1fa2c3705b341262806abbab7b46db521991285b6be2a5288d815ac473d08c3`
- `data/themes.js`: `c7c5ee8b476d17922b4f86950bce20dcdde16e5cf867c519d39d2f1f20d7d3c7`
- `data/runtime-cards.js`: `65b4d47cec1572ddaf31903d5dd31e087af0986e6898510edd6c1386aa73f518`
- `data/image-card-manifest.json`: `8507a2ecf6209d87d4313e2081cdd968b6d774b1b161035bc526af7bdfe94a9f`
- `legacy/index-v1.html`: `059e341a9bfec5386025bebd863341d4b8d02c87f9120aaf9a06923c64f52561`

GitHub `main` 보호 기준:

- Production `cards/talkcard180/index.html` blob: `4078aa8a9ba1c37ce6e5d20049c8d3f438860bac`
- v2.0 `cards/talkcard180/index-v2.html` blob: `d8ee82c3d9e351328a572dd3c8bd11e8f03ba89a`

## CURRENT V2.0 AUDIT

### 현재 구조

- `index-v2.html`이 OPENING, 12 THEMES, DECK INTRO, CARD PLAY, CLOSING 화면을 제공한다.
- `data/themes.js`가 12개 테마 메타데이터를 관리한다.
- `data/runtime-cards.js`가 브라우저용 120 TEXT + 60 IMAGE 투영 데이터를 제공한다.
- `js/talkcard-engine.js`가 한 테마의 15장을 셔플하고 `position`을 저장한다.
- `js/talkcard-view.js`가 `currentCard`를 렌더링하고 이전/다음 버튼으로 `position`을 이동한다.
- IMAGE 카드는 이미지 → 질문 → follow-up 공개 단계와 다음 1~2장 preload를 이미 지원한다.
- `css/talkcard.css`가 브랜드, 반응형, focus-visible, reduced-motion, safe-area 기반을 제공한다.

### 의도와 어긋나는 지점

1. 덱 시작 시 `TalkCardDeckEngine.start()`가 셔플된 첫 카드를 곧바로 `currentCard`로 노출한다.
2. 핵심 진행은 `next()`의 `position += 1`이며 사용자의 카드 선택 단계가 없다.
3. CARD PLAY 화면에 `이전 / 다음`이 상시 노출되어 카드 뷰어로 인식된다.
4. 카드 내용이 테이블의 뒷면 뒤에 숨겨진 상태가 존재하지 않는다.
5. 사용한 카드 상태와 남은 카드의 고정 위치가 없다.
6. 대화 후 시스템이 다음 카드를 직접 출력하므로 `RETURN TO TABLE`이 없다.
7. IMAGE 덱 인트로와 테마 선택에서 이미지는 보여도 되지만, 실제 PICK 화면이라는 구분이 없다.

### 재사용 가능한 기반

- 12개 테마와 180개 런타임 카드 데이터
- 안정적인 카드 ID 및 테마 매핑
- 60개 WebP 이미지, 객관적 ALT, 이미지 오류 fallback 패턴
- OPENING 메시지와 세 가지 대화 약속
- DECK INTRO와 CLOSING의 기본 카피
- focus-visible, reduced-motion, safe-area, 반응형 디자인 토큰
- sessionStorage의 예외 안전 처리 패턴
- 현재 카드 + 다음 이미지 제한 preload 패턴

## RECOVERY ARCHITECTURE

### 화면 구조

`OPENING → PILOT THEME SELECT → DECK INTRO → CARD TABLE → CARD REVEAL → TALK → CARD TABLE → CLOSING`

R03/R04 Pilot에서는 T01과 I01만 연결한다. 나머지 10개 테마와 ALL 180은 데이터에서 보존하되 화면/엔진 통합은 각각 R05와 R06 이전에 하지 않는다.

### 선택 전 정보 비노출

- CARD TABLE의 15장은 모두 카드 뒷면이다.
- TEXT 질문, IMAGE 썸네일, prompt, follow-up은 PICK 전에 DOM의 카드 버튼 내용으로 삽입하지 않는다.
- 접근성 이름은 `기억 한 조각 카드 4번, 아직 열지 않음`처럼 위치와 상태만 설명한다.
- 카드의 시각적 번호는 데이터 ID가 아니라 테이블 위치를 식별하는 보조 표식이다.

### 카드 테이블 위치

- 셔플 결과는 세션 시작 시 한 번만 생성한다.
- 각 ID의 테이블 슬롯과 미세 회전값은 그 셔플 순서로 결정하고 세션 동안 고정한다.
- 사용한 슬롯은 비활성 빈자리/USED 상태로 남겨 주변 카드가 재배치되지 않게 한다.
- 사용한 카드 ID는 다시 선택할 수 없다.

### Reveal 규칙

TEXT:

- PICK 직후 질문을 공개한다.
- 행동은 `다음 카드 고르기`, `PASS`, `오늘 대화 마치기`다.
- `다음 카드 고르기`는 새 카드를 노출하지 않고 TABLE로 복귀한다.

IMAGE:

- PICK 직후 이미지만 크게 공개한다.
- 첫 상태에서 main prompt와 follow-up은 숨긴다.
- `질문 열기`로 main prompt 하나만 공개한다.
- `한 걸음 더`로 follow-up을 선택적으로 공개한다.
- 이후 `다음 카드 고르기`로 TABLE에 복귀한다.

### Pick Engine 상태 계약

R02 엔진은 아래 상태를 소유한다.

```js
{
  mode,
  themeId,
  pool,
  hand,
  used,
  selectedCard,
  revealed,
  promptLevel
}
```

Pilot의 `mode`는 `theme`으로 고정한다. `pool`과 `hand`는 장래 ALL 180 HAND 모드를 수용할 수 있게 분리하되 R06 동작은 구현하지 않는다.

필수 전이:

- `startTheme()` — 15장 고정 셔플 및 TABLE 준비
- `selectCard(cardId)` — 남은 카드만 선택하고 즉시 used로 이동
- `revealSelected()` — 선택 카드 공개 상태 설정
- `openPrompt()` — IMAGE promptLevel을 0 → 1 → 2로만 이동
- `returnToTable()` — selectedCard를 비우고 남은 테이블로 복귀
- `finish()` — 사용 수와 무관하게 CLOSING 진입을 위한 snapshot 제공
- `restart()` — 같은 덱을 새로 섞고 used를 비움

sessionStorage에는 모드, 테마, 셔플 순서, used ID, selected ID, reveal/prompt 상태, 진행 수만 저장한다. 답변이나 사용자 입력은 저장하지 않는다.

## FILE STRATEGY

새 파일만 추가하거나 복구 전용 파일을 수정한다.

- `index-v21.html` — T01/I01 Pilot 후보
- `js/talkcard-pick-engine.js` — v2.1 선택 엔진
- `js/talkcard-v21-view.js` — Pilot 화면 제어
- `css/talkcard-v21.css` — v2.0 디자인 기반의 Card Table 확장
- `scripts/validate-r02-pick-engine.mjs` — 엔진 상태 전이 검증
- `scripts/validate-r03-pilot.mjs` — 후보 구조·데이터·보존 잠금 검증
- `docs/recovery/` — R00~R04 산출물

아래 파일은 이번 Pilot에서 수정하지 않는다.

- `cards/talkcard180/index.html`
- `cards/talkcard180/index-v2.html`
- `legacy/**`
- `data/themes.js`
- `data/cards.js`
- `data/runtime-cards.js`
- `data/image-card-manifest.json`
- `assets/images/**`
- 기존 A00~A07 보고서와 QA 산출물

R01은 질문 감사 결과만 기록하고, 실제 IMAGE prompt 적용은 지시된 R07까지 보류한다.

## PILOT ACCEPTANCE CONTRACT

### T01

1. 덱 인트로에서 `카드 펼치기`를 선택한다.
2. 질문이 보이지 않는 카드 뒷면 15장이 나타난다.
3. 사용자가 임의의 한 장을 선택해야 질문이 공개된다.
4. `다음 카드 고르기`는 TABLE로 복귀한다.
5. 선택한 슬롯은 USED이며 다시 선택할 수 없다.

### I01

1. 카드 뒷면에서 한 장을 직접 선택한다.
2. 이미지 한 장만 먼저 공개되고 main prompt와 follow-up은 숨겨져 있다.
3. `질문 열기`로 main prompt만 공개한다.
4. `한 걸음 더`로 follow-up을 선택적으로 공개한다.
5. `다음 카드 고르기`는 새 카드를 자동 노출하지 않고 TABLE로 복귀한다.

### 공통

- 진행은 현재 위치가 아니라 `used.length / 15`다.
- 중복 선택이 불가능하다.
- TABLE 복귀 후 셔플 순서와 슬롯 위치가 유지된다.
- 15장 이전에도 `오늘 대화 마치기`가 가능하다.
- Tab, Enter/Space, Escape가 동작한다.
- 44 × 44px 이상의 선택 영역과 visible focus를 제공한다.
- reduced-motion에서는 flip/zoom 동작을 제거한다.

## RISKS AND CONTROLS

| 리스크 | 통제 |
|---|---|
| 기존 순차 엔진 재사용으로 NEXT UX가 남음 | v2.1 전용 Pick Engine과 View를 별도 파일로 추가 |
| 선택한 뒤 테이블 재배치 | 셔플 순서와 슬롯을 세션에 고정하고 USED 슬롯 유지 |
| 카드 뒷면 DOM에서 내용 유출 | 버튼에는 위치·상태만 렌더링; 데이터는 선택 후 reveal view에만 바인딩 |
| IMAGE 질문이 의미를 선결정 | R01에서 60장 전수 분류, 실제 반영은 R07 |
| sessionStorage 손상 | allowlist 스키마 검증 실패 시 안전하게 새 세션 시작 |
| 기존 데이터/자산 회귀 | R03 validator에서 12/120/60/180, ID, 해시, production 부재를 재검증 |
| Pilot가 전체 통합으로 확장됨 | 코드와 화면에서 T01/I01 allowlist; R04 후 즉시 중지 |

## GATE

R00 Gate: **PASS**

- PICK → SEE → TALK가 화면 구조, 엔진 상태, 액션 카피, 세션, 접근성, Pilot acceptance에 반영됐다.
- Production과 v2.0 후보는 보존 대상으로 잠겼다.
- R05 이상의 범위는 R04 Pilot 승인 전 금지됐다.

## COMPLETED

- v2.0 데이터·엔진·뷰·성능 기반 감사
- 12 THEMES / 120 TEXT / 60 IMAGE / 180 unique IDs 검증
- Production 및 v2.0 후보 기준 SHA 고정
- v2.1 화면 흐름·상태 전이·파일 경계 정의
- T01/I01 Pilot acceptance contract 정의

## OUTPUT

- `docs/recovery/R00_INTENT_RELOCK_REPORT.md`

## QA

- 기존 A07 validator: 91 / 91 PASS
- 테마별 카드 수: 12 / 12 PASS
- 전체 ID 고유성: 180 / 180 PASS
- 이미지 자산 경로: 60 / 60 PASS
- Production lock: PASS

## ISSUES

- 현재 v2.0의 순차 `position` 엔진은 v2.1 제품 중심으로 재사용할 수 없다.
- 정확한 모바일 viewport 실측은 R08 범위이므로 R04 Pilot에서는 구조·조작성과 가능한 브라우저 실동작까지만 판정한다.

## NEXT

R01 — IMAGE QUESTION AUDIT
