# RUN A00 — SOURCE FREEZE

## STATUS

COMPLETE

## SOURCE

- Repository: `dailycoach/home`
- Default branch: `main`
- Live target: `cards/talkcard180/index.html`
- Source blob SHA: `4078aa8a9ba1c37ce6e5d20049c8d3f438860bac`
- Source size: 31,062 bytes
- Freeze base commit: `4672f659fd6ec3263977c2be8754c28cc3c16aea`
- Work branch: `agent/talkcard180-v2-a00-a02`
- Production modification: 없음

## COMPLETED

- 현재 대상 파일 전체 구조 확인
- 기존 12개 테마명과 키 추출
- 기존 180개 질문 및 ID 검증
- 전체 셔플·최근 카드 회피 로직 확인
- 시작·다음·완료·키보드 동작 확인
- 원본 HTML과 원본 180문항의 별도 백업 생성

## CURRENT STRUCTURE

현재 제품은 파일 한 개에 모든 역할이 결합된 정적 페이지다.

- HTML: 화면 구조, 시작 화면, 카드, 컨트롤
- Inline CSS: 레이아웃, 테마별 색상, 반응형 글자 크기
- Inline data: `THEME_STYLE` 12개, `CARDS` 180개
- Inline engine: 셔플, 최근 카드 회피, 진행도, 세션 시작·종료

현재 12개 테마와 문항 수는 아래와 같다.

- `ice` 가볍게 인사 · 15
- `taste` 취향·감각 · 15
- `lately` 요즘 뭐하나요 · 15
- `memory` 기억 한 조각 · 15
- `talk` 대화 습관 · 15
- `work` 일·성장 · 15
- `recharge` 충전·회복 · 15
- `value` 가치·기준 · 15
- `courage` 용기·도전 · 15
- `tmi` 인간미(TMI) · 15
- `future` 미래 상상 · 15
- `kind` 서로에게 따뜻 · 15

검증값: 12 테마 × 15장 = 180장. ID 180개 고유. 질문 완전중복 없음.

## CURRENT BEHAVIOR

- 시작: 180장 전체를 Fisher–Yates 방식으로 섞고 첫 질문 표시
- 다음: 전체 덱의 다음 질문 표시
- 반복 완화: 덱 재생성 시 최근 12개 ID를 기준으로 최대 7회 다시 섞고, 새 덱 앞부분과 최근 목록의 겹침을 1개 이하로 줄임
- 진행도: `0 / 180`에서 시작해 전체 덱 기준으로 표시
- 180장 이후: Closing 없이 전체 덱을 다시 생성하고 진행도를 처음부터 반복
- 완료: 덱·최근 목록·진행도를 초기화하고 시작 화면 복귀
- 키보드: Space/Enter는 다음, Escape는 완료
- 저장: 로그인·로컬 저장·세션 저장 없음

## PRESERVE

- 기존 12개 테마명
- 텍스트 덱으로 남는 8개 테마의 원문 120문항과 기존 ID
- 기존 180문항 원본 전체
- 한 세션 안에서 같은 카드가 다시 나오지 않는 셔플 원칙
- 시작·다음·완료의 단순한 조작감
- 모바일 safe-area와 충분한 기본 터치 높이
- 테마별 시각 구분의 개념

## CHANGEABLE AREA

- 데이터·엔진·뷰의 파일 및 책임 분리
- 전체 랜덤 중심 구조를 테마 선택 중심 구조로 변경
- 이미지 카드의 관찰 → 질문 → 후속 질문 공개 순서 추가
- 진행도를 테마별 `01 / 15`로 변경
- 이전·테마로·Closing 동작 추가
- 이미지 lazy loading과 인접 카드 preload
- 접근성 역할·키보드 범위·reduced motion 처리 개선

## RISKS

- 단일 HTML 결합으로 데이터 수정이 UI 회귀를 일으키기 쉽다.
- 현재 셔플은 180장 전체 전용이라 15장 테마 덱에 그대로 사용할 수 없다.
- 180장 종료 후 자동 재순환되어 완료 경험이 없다.
- 이미지 자산 모델·오류 fallback·lazy loading 구조가 없다.
- 전역 Space/Enter 이벤트가 다른 버튼 조작과 충돌할 수 있다.
- `role="application"` 사용은 스크린리더의 일반 문서 탐색을 불필요하게 제한할 수 있다.
- 기존 색상 중심 디자인은 이미지 60장과 결합할 때 제품 톤이 분산될 수 있다.

## OUTPUT

- `legacy/index-v1.html`
- `legacy/cards-v1.json`
- `docs/A00_SOURCE_AUDIT_REPORT.md`

## QA

- 기존 카드 수: PASS · 180
- 기존 테마별 수: PASS · 각 15
- 기존 ID 고유성: PASS · 180 / 180
- 질문 완전중복: PASS · 0
- 라이브·`main` 수정 없음: PASS

## ISSUES

중단 오류 없음.

## NEXT

A01 DATA MODEL
