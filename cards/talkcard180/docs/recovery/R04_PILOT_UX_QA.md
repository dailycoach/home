# TALK CARD 180 v2.1 — R04 PILOT UX QA

- 실행일: 2026-08-17
- Harness: headless Chromium + Playwright
- 자동검사: `scripts/validate-r03-pilot-browser.mjs`
- 판정: **TECHNICAL PASS — 4 / 4 VIEWPORTS**
- Scale 상태: **STOP — R05 진행 금지**

## 1. Viewport 결과

| Viewport | TABLE | T01 reveal | I01 image only | Keyboard | Overflow | 결과 |
|---|---:|---:|---:|---:|---:|---|
| 390 × 844 | 3열 | PASS | PASS | PASS | 없음 | PASS |
| 430 × 932 | 3열 | PASS | PASS | PASS | 없음 | PASS |
| 768 × 1024 | 5열 | PASS | PASS | PASS | 없음 | PASS |
| 1440 × 1000 | 5열 | PASS | PASS | PASS | 없음 | PASS |

각 viewport에서 다음 11개 항목을 같은 시나리오로 검증했다.

1. directPick
2. noPreExposure
3. returnToTable
4. usedState
5. imageOnlyFreeAssociation
6. noImageQuestionControls
7. noImagePromptText
8. sessionRestore
9. keyboardTabEnterSpaceEscape
10. tapTarget44
11. noHorizontalOverflow

총 판정: **44 / 44 PASS**. Page error, console error, 4xx/5xx asset 응답은 없었다.

### IMAGE ONLY 재검증

- 선택된 이미지 영역의 가시 텍스트: **0**
- 메인 질문·Follow-up·안내 문장 DOM 렌더링: **0**
- `질문 열기`·`한 걸음 더` 컨트롤: **0**
- 활성 IMAGE 카드 필드: `id`, `type`, `theme`, `image`, `alt`만 허용
- sessionStorage의 IMAGE 질문·Follow-up·`promptLevel`: **0**
- reload 뒤 동일 이미지 단독 reveal 복원: **PASS**

## 2. 키보드·접근성

| 항목 | 결과 |
|---|---|
| Tab으로 카드 간 이동 | PASS |
| Enter로 TEXT 카드 선택 | PASS |
| Space로 IMAGE 카드 선택 | PASS |
| ESC로 REVEAL → TABLE 복귀 | PASS |
| 카드 뒷면 ARIA label | PASS — 테마·번호·미개봉 상태 포함 |
| IMAGE ALT | PASS — 기존 ALT 사용 |
| focus-visible | PASS — 질문 본문에 불필요한 포커스 테두리 제거 |
| reduced motion | PASS — 기존 media rule 보존 |

## 3. 시각 QA에서 발견·수정한 항목

| 발견 | 수정 | 재검수 |
|---|---|---|
| 모바일 sticky action이 긴 이미지를 가림 | action을 이미지 아래 정상 흐름으로 이동 | PASS |
| 질문 제목의 programmatic focus가 테두리 박스로 보임 | 스크린리더 전용 화면 제목으로 focus 이동 | PASS |
| 데스크톱 PASS 버튼이 PRIMARY보다 넓음 | PASS 폭 축소, PRIMARY 위계 복원 | PASS |
| 데스크톱 Pilot 두 덱 사이 과도한 공백 | T01·I01을 2열로 병치 | PASS |
| 카드 제거 뒤 animation 소수점 좌표를 재배치로 오판 | stable slot 좌표 기준 QA로 교정 | PASS |

## 4. 20초 성공 경로

자동 상호작용 기준으로 다음 경로가 설명 없이 성립했다.

1. 카드 시작하기
2. T01 또는 I01 선택
3. 카드 펼치기
4. 카드 한 장 직접 선택
5. 질문 또는 이미지 한 장만 봄
6. 다음 카드 고르기로 TABLE 복귀

기술·정보구조 기준은 PASS다. 실제 첫 사용자에게 “무엇을 해야 하는지 말해보세요”라고 묻는 관찰형 20초 테스트는 사람 대상 검증이므로, R05 시작 전 최종 승인 체크로 남긴다.

## 5. 보호 확인

- `cards/talkcard180/index.html`: 변경 없음
- `cards/talkcard180/index-v2.html`: 변경 없음
- TEXT 120 원문: 변경 없음
- IMAGE 60 자산·ID·ALT: 변경 없음
- R01 질문 제안: 감사 기록으로만 보존, v2.1 런타임 미사용
- ALL 180: 미구현
- 나머지 10개 덱: 미연결

## 6. R04 판정과 STOP

**TECHNICAL PASS.** T01·I01 파일럿은 PICK → SEE → TALK의 기술·UX 기준을 충족한다. I01은 보이는 안내 문장·메인 질문·Follow-up·질문 버튼이 모두 없는 IMAGE ONLY 자유연상 구조다.

**여기서 중지한다.** R05 12-DECK INTEGRATION, R06 ALL 180, production swap은 실행하지 않는다. R07 질문 반영은 제품 결정으로 취소한다.
