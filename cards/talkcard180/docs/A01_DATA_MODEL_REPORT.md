# RUN A01 — DATA MODEL

## STATUS

COMPLETE

## COMPLETED

- 12개 기존 테마명을 유지한 단일 theme registry 작성
- 8개 텍스트 테마와 4개 이미지 테마에 명시적 `type` 지정
- 기존 텍스트 질문 120개를 문장 수정 없이 이관
- 기존 텍스트 카드 ID를 그대로 유지
- 이미지 카드 60개에 안정적인 2자리 ID와 WebP 경로 슬롯 생성
- 새 제품용 180개 카드 슬롯 구성
- 기존 180문항 전체를 별도 legacy JSON으로 보존
- DATA와 향후 ENGINE·VIEW의 책임 경계 설정

## THEME TYPE LOCK

TEXT

- T01 `ice` 가볍게 인사
- T02 `taste` 취향·감각
- T03 `lately` 요즘 뭐하나요
- T04 `talk` 대화 습관
- T05 `work` 일·성장
- T06 `value` 가치·기준
- T07 `courage` 용기·도전
- T08 `tmi` 인간미(TMI)

IMAGE

- I01 `memory` 기억 한 조각 · SCENE
- I02 `recharge` 충전·회복 · EMOTION
- I03 `future` 미래 상상 · METAPHOR
- I04 `kind` 서로에게 따뜻 · RELATION

## ID POLICY

- 텍스트 카드: 기존 ID 보존. 예: `ice_1`, `talk_15`
- 이미지 카드: 새 고정 ID. 예: `memory_01`, `kind_15`
- 이미지 경로: 페이지 기준 상대경로. 예: `assets/images/memory/memory_01.webp`
- 상대경로를 사용해 `/cards/talkcard180/` 하위 배포와 미리보기 환경 모두에서 경로가 유지되게 한다.

## IMAGE PLACEHOLDER POLICY

A01의 `IMAGE_CARD_SLOTS`는 자산 위치와 ID만 고정한다.

- `alt`: `null`
- `prompt`: `null`
- `followup`: `null`
- `manifestStatus`: `pending`

A02 매니페스트를 A01 슬롯에 즉시 병합하지 않는다. A03 Visual Master 승인 뒤 실제 자산과 함께 통합해 데이터 설계와 이미지 제작 상태를 혼동하지 않게 한다.

## OUTPUT

- `data/themes.js`
- `data/cards.js`
- `legacy/cards-v1.json`
- `docs/A01_DATA_MODEL_REPORT.md`

## QA

- 테마: PASS · 12
- TEXT THEME: PASS · 8
- IMAGE THEME: PASS · 4
- TEXT CARD: PASS · 120
- IMAGE SLOT: PASS · 60
- TOTAL SLOT: PASS · 180
- v2 ID 고유성: PASS · 180 / 180
- 120개 텍스트 원문·ID legacy 대조: PASS · 변경 0
- 이미지 테마별 슬롯: PASS · 각 15

## ISSUES

중단 오류 없음.

## NEXT

A02 IMAGE CARD MANIFEST 60
