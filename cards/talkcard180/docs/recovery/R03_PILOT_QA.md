# TALK CARD 180 v2.1 — R03 CARD TABLE PILOT QA

- Candidate: `index-v21.html`
- Pilot: T01 `ice` + I01 `memory`
- Production: `index.html` 미수정
- v2.0 candidate: `index-v2.html` 미수정
- 판정: **PASS — R04 브라우저 QA 진행 가능**

## 구현 파일

| 파일 | 역할 |
|---|---|
| `index-v21.html` | production과 분리된 v2.1 Pilot candidate |
| `css/talkcard-v21.css` | Card Table, card back, pick/reveal/return, responsive Pilot UI |
| `js/talkcard-pick-engine.js` | 선택·used·reveal·restore 상태 엔진 |
| `js/talkcard-v21-view.js` | T01·I01 화면과 PICK → SEE → TALK 루프 |
| `scripts/validate-r02-pick-engine.mjs` | 엔진 단위검사 |
| `scripts/validate-r03-pilot-browser.mjs` | 실제 브라우저·viewport·키보드 E2E |

## Pilot 화면 흐름

```text
OPENING
  → T01 / I01 SELECT
  → CLOSED DECK INTRO
  → 15-CARD TABLE
  → USER PICK
  → LIFT / FLIP / REVEAL
  → TALK
  → RETURN TO TABLE
```

## T01 acceptance

| 요구 | 결과 |
|---|---|
| 인트로에서 질문 미노출 | PASS — 카드 뒷면 3장만 표시 |
| TABLE에서 15장 내용 미노출 | PASS |
| 임의 카드 직접 선택 | PASS |
| 선택 후 질문 공개 | PASS |
| `다음 카드 고르기`가 TABLE 복귀 | PASS |
| 선택 카드 used 처리·자리 비움 | PASS |
| 새 카드 자동 출력 없음 | PASS |
| PASS 가능 | PASS |

## I01 acceptance

| 요구 | 결과 |
|---|---|
| 인트로·TABLE에서 이미지 미노출 | PASS |
| 고른 뒤 이미지 단독 표시 | PASS |
| 질문·Follow-up·안내 문장 미렌더링 | PASS |
| 질문 공개 컨트롤 없음 | PASS |
| 활성 카드 객체에서 질문 필드 제외 | PASS |
| 이미지에서 바로 TABLE 복귀 가능 | PASS |
| reload 뒤 동일 이미지 reveal 복원 | PASS |

## 제품 정체성 검사

- `NEXT` 액션과 순차 카드 소비 경로가 candidate에 없다.
- 카드 뒷면 버튼 15개가 제품의 핵심 조작 대상이다.
- used 카드는 빈 슬롯으로 남아 남은 카드 위치를 유지한다.
- 진행 수치는 현재 위치가 아니라 used 수다.
- TABLE과 REVEAL 양쪽에서 대화를 일찍 마칠 수 있다.
- 실제 이미지 요청은 IMAGE 카드가 선택되기 전 발생하지 않는다.
- IMAGE 카드에는 이미지 외 해석 방향을 제시하는 문장이 존재하지 않는다.

## R03 판정

**PASS.** T01과 I01만 연결한 상태에서 “질문 뷰어”가 아니라 “카드를 골라 대화를 시작하는 도구”로 동작한다.
