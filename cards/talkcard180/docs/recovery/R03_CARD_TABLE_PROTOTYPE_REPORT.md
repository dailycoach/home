# R03 CARD TABLE PROTOTYPE REPORT

## RUN

R03 — CARD TABLE PROTOTYPE

## STATUS

COMPLETE

## PILOT SCOPE

- T01 가볍게 인사 — 15 TEXT CARDS
- I01 기억 한 조각 — 15 IMAGE CARDS
- 나머지 10개 테마 — 데이터 보존, UI 미연결
- ALL 180 — R06까지 미구현

## COMPLETED

- Production과 v2.0을 건드리지 않는 `index-v21.html` 후보를 추가했다.
- OPENING → Pilot theme select → DECK INTRO → CARD TABLE → REVEAL → TALK → TABLE → CLOSING 흐름을 구현했다.
- DECK INTRO CTA를 `카드 펼치기`로 변경했다.
- 15장의 카드 뒷면을 desktop 5 × 3, mobile 3열로 배치했다.
- 슬롯별 미세 회전·위치 차이를 고정값으로 부여했다.
- 카드 선택 전 질문, 이미지 경로, prompt, follow-up이 정적 HTML과 카드 뒷면 DOM에 삽입되지 않게 했다.
- 선택 카드 lift → 확대 → 뒷면 제거/reveal 전환을 구현했다.
- 사용한 슬롯은 자리를 유지한 채 USED 빈자리로 전환했다.
- TEXT는 선택 후 질문을 즉시 공개한다.
- IMAGE는 선택 후 이미지만 먼저 공개하고 `질문 열기`와 `한 걸음 더`를 선택 동작으로 분리했다.
- `다음 카드 고르기`와 `PASS`는 새 카드를 자동 출력하지 않고 TABLE로 복귀한다.
- 사용 카드 수가 15장보다 적어도 `오늘 대화 마치기`로 CLOSING 진입이 가능하다.
- CLOSING에 다른 테마, 같은 덱 다시 섞기, 처음으로 액션을 연결했다.
- Tab/Enter/Space는 native button으로, Escape는 REVEAL → TABLE 복귀로 지원한다.
- 세션 복원 시 TABLE 위치, used, selected, promptLevel을 복원한다.
- 선택 IMAGE 한 장만 eager/high-priority로 로드하며 테마/인트로에서 카드 이미지를 미리 노출하지 않는다.

## OUTPUT

- `index-v21.html`
- `css/talkcard-v21.css`
- `js/talkcard-v21-view.js`
- `scripts/validate-r03-pilot.mjs`
- `docs/recovery/R03_CARD_TABLE_PROTOTYPE_REPORT.md`

## QA

정적 R03 validator: PASS

- 12 themes / 120 text / 60 image / 180 unique IDs 보존: PASS
- 이미지 WebP 60개 보존: PASS
- Production `index.html` 생성·수정 없음: PASS
- `index-v2.html` byte-identical: PASS
- 선택 전 card content 비노출: PASS
- user pick action: PASS
- used state 및 stable slot: PASS
- return-to-table loop: PASS
- automatic next 부재: PASS
- IMAGE FIRST: PASS
- optional main/follow-up: PASS
- early closing: PASS
- session restore: PASS
- Escape: PASS
- 390/430/768 대응 CSS 및 44px target: PASS
- reduced motion: PASS
- JavaScript syntax: PASS

## ISSUES

- 정확한 시각 배치, focus 이동, 실제 click loop, 이미지 로딩은 R04 브라우저 Pilot QA에서 판정해야 한다.
- R01에서 SOFTEN/REWRITE로 분류된 prompt는 R07 이전이므로 Pilot 런타임에는 아직 원문이 표시된다.
- 12개 테마 전체와 ALL 180은 Pilot Gate 밖이며 의도적으로 연결하지 않았다.

## NEXT

R04 — PILOT UX QA
