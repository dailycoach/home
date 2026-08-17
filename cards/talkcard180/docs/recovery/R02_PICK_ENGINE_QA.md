# TALK CARD 180 v2.1 — R02 PICK ENGINE QA

- 구현: `js/talkcard-pick-engine.js`
- 자동검사: `scripts/validate-r02-pick-engine.mjs`
- 판정: **PASS — 9 / 9**

## 상태 모델

엔진은 다음 상태를 `sessionStorage`에만 저장한다.

```js
{
  mode,
  themeId,
  cardType,
  pool,
  hand,
  used,
  selectedCard,
  revealed,
  cycle,
  startedAt,
  updatedAt
}
```

사용자의 답변, 대화 내용, 개인정보는 입력받거나 저장하지 않는다.

## 자동검사 결과

| # | 검사 | 결과 |
|---:|---|---|
| 1 | 15장 셔플 hand 생성, 사전 선택 없음 | PASS |
| 2 | hand의 임의 카드를 사용자가 직접 선택, 자동 다음 없음 | PASS |
| 3 | 사용 카드 제거 뒤 남은 hand 순서 고정 | PASS |
| 4 | used 카드 중복 선택 차단 | PASS |
| 5 | pool·hand·used·selected·reveal 상태 세션 복원 | PASS |
| 6 | IMAGE optional prompt 상태·API 완전 제거 | PASS |
| 7 | 활성 IMAGE 카드에서 질문·Follow-up 필드 제외 | PASS |
| 8 | 구 prompt 상태 세션 폐기 후 깨끗한 hand 생성 | PASS |
| 9 | 같은 덱 다시 섞기 시 used 초기화·새 순서 생성 | PASS |

## 핵심 불변식 확인

- `pool`은 중복 없는 15장이고 세션 중 바뀌지 않는다.
- `hand ∩ used = ∅`이다.
- `hand ∪ used = pool`이다.
- 선택 카드는 TABLE 복귀 전까지 다른 카드로 교체되지 않는다.
- TABLE 복귀 시 선택 카드는 hand에서 사라지고 used에 한 번만 들어간다.
- reload 뒤 카드 위치와 현재 이미지 reveal 상태가 유지된다.
- IMAGE 세션에는 `promptLevel`, 질문, Follow-up이 저장되지 않는다.
- invalid storage는 UI를 막지 않고 새 세션으로 복구된다.

## R02 판정

**PASS.** 순차 `position++` 모델을 제품 중심에서 제거했고, 사용자가 직접 고른 카드만 소비되는 Pick Engine이 준비되었다.
