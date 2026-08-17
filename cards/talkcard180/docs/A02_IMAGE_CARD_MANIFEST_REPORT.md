# RUN A02 — IMAGE CARD MANIFEST 60

## STATUS

COMPLETE

## COMPLETED

- 4개 이미지 덱 × 15장 = 60장 설계
- 모든 카드의 ID·테마·자산 경로 확정
- 모든 카드의 IMAGE SUBJECT·SCENE DESCRIPTION·COMPOSITION 확정
- 모든 카드의 MAIN PROMPT·FOLLOW-UP PROMPT 확정
- 모든 카드의 객관적 ALT 확정
- 카드별 DUPLICATION CHECK 작성
- 오브젝트·공간·자연·거리·빛·움직임·정적·클로즈업·와이드 구도 혼합
- A03에서 사용할 Pilot 후보를 덱당 3장씩 표시

## MANIFEST COUNT

- I01 기억 한 조각 · SCENE · 15
- I02 충전·회복 · EMOTION · 15
- I03 미래 상상 · METAPHOR · 15
- I04 서로에게 따뜻 · RELATION · 15
- TOTAL · 60

## QUESTION PRINCIPLE

- 이미지가 답이나 감정명을 지정하지 않는다.
- 카드가 상징의 뜻을 먼저 설명하지 않는다.
- 첫 질문은 관찰한 이미지와 자신의 경험을 연결할 여지를 연다.
- 후속 질문은 답을 교정하거나 결론으로 몰지 않고 이야기를 한 단계 더 이어준다.
- 관계 덱은 옳고 그름·가까워져야 함·화해해야 함을 전제하지 않는다.

## ACCESSIBILITY PRINCIPLE

ALT는 화면에서 객관적으로 확인 가능한 사물·위치·빛·거리만 기술한다.

- 허용 예: `빈 방에서 서로를 향해 비스듬히 놓인 모양이 다른 나무 의자 두 개`
- 배제 예: `멀어진 관계를 상징하는 두 의자`

## DUPLICATION CONTROL

- 의자: 기억 덱은 단일 빈 의자, 관계 덱은 각도가 다른 두 의자로 분리
- 창: 기억 덱은 창턱 정물·비 오는 이동 창, 미래 덱은 열린 건축 창으로 분리
- 계단: 기억 덱은 생활 흔적이 있는 낡은 실내 계단, 미래 덱은 미니멀 단일 계단, 관계 덱은 경사가 다른 두 계단으로 분리
- 빛: 방의 스탠드·좁은 틈·황동 등불·해안 등대·밀랍 촛불을 구도와 기능 면에서 분리
- 길: 골목·단일 회상길·미래 갈림길·관계의 두 산책로를 공간과 시점으로 분리
- 컵·그릇: 두 찻잔·가득 찬 단일 컵·빈 넓은 그릇으로 형태와 질문을 분리

## A03 PILOT CANDIDATES

기억 한 조각

- `memory_01` 오래된 식탁
- `memory_06` 비 오는 창문
- `memory_13` 기다리는 벤치

충전·회복

- `recharge_01` 팽팽한 실
- `recharge_05` 좁은 틈의 빛
- `recharge_15` 조용히 켜진 등불

미래 상상

- `future_02` 다리
- `future_03` 씨앗
- `future_06` 지도

서로에게 따뜻

- `kind_01` 두 개의 의자
- `kind_08` 겹쳐진 두 원
- `kind_14` 같은 풍경을 보는 두 사람

후보 표시는 제작 승인이 아니다. A03 시작 시 이 12장의 장면 범위와 공통 스타일 프롬프트를 다시 잠근 뒤 생성한다.

## OUTPUT

- `data/image-card-manifest.json`
- `docs/IMAGE_CARD_MANIFEST_60.md`
- `docs/A02_IMAGE_CARD_MANIFEST_REPORT.md`
- `scripts/validate-a00-a02.mjs`

## QA

- Manifest: PASS · 60
- 카드 ID 고유성: PASS · 60 / 60
- A01 이미지 슬롯과 ID 일치: PASS · 60 / 60
- 자산 경로 일치: PASS · 60 / 60
- MAIN PROMPT 완전중복: PASS · 0
- FOLLOW-UP PROMPT 완전중복: PASS · 0
- 덱 내부 IMAGE SUBJECT 완전중복: PASS · 0
- 필수 필드 누락: PASS · 0
- ALT 해석어 기본 패턴 검사: PASS
- Pilot 후보: PASS · 덱당 3, 총 12
- 생성 이미지: 0장

## ISSUES

중단 오류 없음.

## NEXT

FIRST EXECUTION LOCK에 따라 STOP.

검수 승인 후 A03 VISUAL MASTER PILOT에서 12장만 생성한다. A04·UI·Production은 진행하지 않는다.
