# R02 PICK ENGINE REPORT

## RUN

R02 — PICK ENGINE

## STATUS

COMPLETE

## COMPLETED

- 15장 테마 덱을 카드 테이블용으로 한 번만 셔플한다.
- 셔플된 `hand` 순서가 세션 동안 각 카드의 고정 슬롯이 되도록 구현했다.
- 사용자가 ID로 직접 선택한 카드만 `used`로 이동한다.
- 사용 중인 카드가 있거나 이미 사용한 카드는 다시 선택할 수 없다.
- 선택, reveal, IMAGE main prompt, IMAGE follow-up을 서로 다른 상태 전이로 분리했다.
- `returnToTable()`이 selected/reveal/prompt 상태만 비우며 used와 슬롯은 유지한다.
- `progress.used`가 현재 배열 위치가 아니라 실제 사용 카드 수를 나타낸다.
- 15장 사용 후에도 엔진이 새 카드를 자동 선택하거나 공개하지 않는다.
- 같은 덱 다시 섞기에서 used를 비우고 새 hand 순서를 만든다.
- allowlist 기반 sessionStorage 복원과 손상 세션 fallback을 구현했다.
- sessionStorage에는 ID·순서·상태만 저장하고 질문, 이미지 경로, ALT, prompt, follow-up, 사용자 답변을 저장하지 않는다.

## STATE

```js
{
  mode: "theme",
  themeId,
  cardType,
  pool: [],
  hand,
  used,
  selectedCard,
  revealed,
  promptLevel
}
```

- `pool`은 R06 ALL 180을 위한 경계만 유지한다.
- R02/R03 Pilot에서 지원하는 mode는 `theme` 하나뿐이다.
- TABLE snapshot에는 슬롯 위치, ID, used/selectable 상태만 있으며 카드 내용이 없다.
- 선택 이후에만 snapshot의 `card` 필드로 실제 카드 내용에 접근할 수 있다.

## OUTPUT

- `js/talkcard-pick-engine.js`
- `scripts/validate-r02-pick-engine.mjs`
- `docs/recovery/R02_PICK_ENGINE_REPORT.md`

## QA

`node scripts/validate-r02-pick-engine.mjs`

- 직접 선택: PASS
- 선택 전 질문 내용 비노출: PASS
- 자동 NEXT 부재: PASS
- used 중복 선택 방지: PASS
- used 기반 00 / 15 → 15 / 15: PASS
- TABLE 슬롯 안정성: PASS
- IMAGE ONLY reveal: PASS
- main prompt 선택 공개: PASS
- follow-up 선택 공개: PASS
- session restore: PASS
- session allowlist: PASS
- 민감·콘텐츠 데이터 미저장: PASS
- 같은 덱 restart: PASS

## ISSUES

- ALL 180의 15장 임시 HAND 보충 로직은 R06 범위이므로 구현하지 않았다.
- 애니메이션과 키보드 동작은 View 책임이며 R03/R04에서 검증한다.

## NEXT

R03 — CARD TABLE PROTOTYPE: T01 + I01
