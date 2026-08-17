# TALK CARD 180 v2.1 — R00 INTENT RELOCK REPORT

- 기준일: 2026-08-17
- 감사 대상: `index-v2.html`, `css/talkcard.css`, `js/talkcard-engine.js`, `js/talkcard-view.js`, `data/themes.js`, `data/runtime-cards.js`
- Production 보호: `index.html` 변경 금지
- Pilot 범위: T01 `ice` + I01 `memory`
- 제품 잠금: **PICK → SEE → TALK**

## 1. 보존 자산 확인

| 항목 | 확인 결과 | 판정 |
|---|---:|---|
| 테마 | TEXT 8 + IMAGE 4 = 12 | 보존 |
| TEXT 질문 | 8 × 15 = 120 | 원문 잠금 |
| IMAGE 카드 | 4 × 15 = 60 | 자산·ID·ALT 보존 |
| 이미지 포맷 | 본 이미지 60장 WebP | 보존 |
| 이미지 매니페스트 | 60개 카드 데이터 존재 | 보존 |
| 세션 저장 | `sessionStorage` 기반 | 방식 보존, 스키마 교체 |
| 기존 산출물 | `legacy/`, A00~A07 문서·QA·이미지 보드 존재 | 삭제 금지 |

## 2. v2.0 경험 감사

### 유지할 부분

- OPENING의 브랜드 구조, 필수 메시지, 세 가지 대화 약속이 확보되어 있다.
- 12개 테마와 덱 인트로가 분리되어 있다.
- IMAGE 카드는 이미지 → 메인 질문 → Follow-up의 단계 공개가 이미 구현되어 있다.
- 이미지 오류 대체, ALT, `aria-live`, 버튼 기반 키보드 조작, 반응형 CSS 기반이 있다.
- WebP 이미지와 제한적 preload로 초기 성능을 관리하고 있다.

### 원래 의도와 충돌하는 부분

| 구간 | 현재 v2.0 | 충돌 | v2.1 복구 |
|---|---|---|---|
| 덱 인트로 | 실제 질문·이미지 미리보기 | 선택 전에 내용 노출 | 카드 뒷면만 보여준다 |
| 덱 시작 | 첫 카드 자동 출력 | 사용자는 카드를 고르지 못함 | 15장 CARD TABLE로 진입 |
| 핵심 행동 | 이전 / 다음 | `NEXT`가 제품 중심 | 카드 직접 선택이 중심 |
| 엔진 | `order + position++` | 순차 뷰어 모델 | `hand + used + selectedCard` 모델 |
| 진행 | 현재 위치 `01 / 15` | 사용량과 다름 | 사용 카드 수 `00 / 15` |
| 카드 종료 | 다음 카드 자동 출력 | 대화 후 선택권 제거 | TABLE로 반드시 복귀 |
| 사용 상태 | 앞뒤 이동 가능 | 같은 카드 재소비 가능 | 사용 카드는 hand에서 제거 |
| Closing | 15장 종료 뒤 도달 | 15장 완주 압력 | 언제든 `오늘 대화 마치기` |
| IMAGE | 단계 공개는 적합 | 다음 카드가 자동 연결 | IMAGE ONLY 자유연상 + TABLE 복귀 |
| Keyboard | 기본 버튼 탐색 | ESC 복귀 없음 | ESC로 TABLE 복귀 |

## 3. R00 제품 정의 재잠금

TALK CARD 180 v2.1은 카드 콘텐츠를 자동 배달하지 않는다. 시스템은 카드의 순서와 배치를 섞을 뿐이며, 공개할 카드의 선택은 매번 사용자에게 남긴다.

```text
OPENING
  → THEME SELECT
  → DECK INTRO
  → CARD TABLE (PICK)
  → CARD REVEAL (SEE)
  → CONVERSATION (TALK)
  → RETURN TO TABLE
```

### PICK

- CARD TABLE에는 내용이 가려진 15장의 카드 뒷면만 둔다.
- 카드 위치는 세션 안에서 고정한다.
- 사용자가 클릭·탭·Enter·Space로 직접 한 장을 고른다.
- 시스템은 선택 직후 다른 카드를 자동으로 지정하지 않는다.

### SEE

- 선택된 카드만 lift → zoom → flip 순서로 공개한다.
- TEXT는 flip 뒤 질문을 공개한다.
- IMAGE는 flip 뒤 이미지만 공개한다.
- IMAGE 질문과 Follow-up은 각각 사용자의 명시적 행동 뒤에만 공개한다.

### TALK

- 화면은 답을 입력·평가·저장하지 않는다.
- `다음 카드 고르기` 또는 `PASS`는 현재 카드를 used 처리하고 TABLE로 돌려보낸다.
- 대화 종료는 카드 수와 무관하게 언제든 가능하다.

## 4. v2.1 Pilot 구현 경계

R03에서는 다음 두 덱만 연결한다.

- T01 `ice` — TEXT 15장
- I01 `memory` — IMAGE 15장

나머지 10개 덱, ALL 180 HAND, production swap은 R04 이후 범위다. 파일럿 후보는 `index-v21.html`과 v2.1 전용 CSS/JS로 분리하여 v2.0과 production을 보존한다. 2026-08-17 추가 결정에 따라 IMAGE 질문은 v2.1 런타임에 반영하지 않고 이미지 단독 자유연상 경험으로 잠근다.

## 5. 엔진 계약

파일럿 엔진의 외부 상태는 아래 의미를 유지한다.

```js
{
  mode,          // "theme"
  themeId,       // "ice" | "memory" in Pilot
  pool,          // 최초 셔플된 15개 ID, 세션 동안 불변
  hand,          // 아직 선택 가능한 카드 ID
  used,          // 대화를 마친 카드 ID
  selectedCard,  // 현재 고른 카드 ID 또는 null
  revealed       // 카드 앞면 공개 여부
}
```

필수 불변식:

1. `pool`은 중복 없는 15개 ID다.
2. `hand`와 `used`는 중복되지 않는다.
3. `selectedCard`는 used에 포함될 수 없다.
4. TABLE 복귀 전까지 다른 카드가 자동 선택되지 않는다.
5. session restore 뒤 `pool`과 남은 카드 순서는 바뀌지 않는다.
6. 사용자 답변은 저장하지 않는다.

## 6. Pilot acceptance mapping

| 테스트 | 구현 기준 |
|---|---|
| 선택 전 내용 비노출 | TABLE·인트로 모두 카드 뒷면 |
| 사용자 직접 선택 | 카드별 독립 `<button>` |
| 선택 후 reveal | lift → flip 뒤 앞면 화면 |
| used 방지 | return 시 hand에서 제거 |
| TABLE 복귀 | `다음 카드 고르기`가 새 카드 대신 TABLE 표시 |
| IMAGE ONLY | 이미지 외 질문·지시·해석 문구를 렌더링하지 않음 |
| 자유연상 | 질문·Follow-up·공개 컨트롤 없이 참여자가 떠오르는 대로 대화 |
| 조기 종료 | TABLE·REVEAL 모두 `오늘 대화 마치기` |
| Keyboard | Tab, Enter/Space, ESC |
| 모바일 | 3열 TABLE, 44px 이상 tap target |

## 7. R00 판정

**PASS — 구현 진행 가능**

PICK → SEE → TALK가 화면 구조, 상태 모델, 입력 방식, 진행 의미, 종료 방식에 모두 반영되었다. R01 질문 감사와 R02 Pick Engine으로 진행한다.
