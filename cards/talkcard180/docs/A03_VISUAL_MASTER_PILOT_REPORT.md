# RUN A03 — VISUAL MASTER PILOT

## STATUS

COMPLETE · REVIEW READY

G05 VISUAL MASTER는 내부 제작·QA를 통과했으며 사용자 승인 대기 상태다. A04는 시작하지 않았다.

## COMPLETED

- A02 후보 기준 4개 덱 × 3장 = 12장 생성
- `memory_01`을 공통 그림체 기준점으로 확정
- 나머지 11장에 기준점을 스타일 참조로 적용
- 모든 이미지 4:5 세로 비율로 생성
- 웹용 WebP 변환
- 카드 ID가 표시된 3 × 4 비교판 제작
- 스타일 일관성·이미지 다양성·사물 구조·인체·문자·과잉 상징 수동 검수
- 파일 크기·해상도·해시·WebP 디코딩 자동 검수

## VISUAL MASTER LOCK

- 성인용 editorial illustration
- 얇고 거친 charcoal line
- off-white fibrous paper
- low saturation
- subtle uniform grain
- matte flat color washes
- muted terracotta · deep navy · sage · olive · mustard · dusty blue
- 넓은 여백과 비대칭 구도
- 이미지가 감정명·관계 의미·상징 해답을 지정하지 않음
- 인물이 필요한 경우 작은 뒷모습과 최소 정보 사용

## PILOT ASSETS

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

## QA

- Pilot count: PASS · 12 / 12
- Deck distribution: PASS · 3 / 3 / 3 / 3
- Dimensions: PASS · 12장 모두 1122 × 1402
- Aspect ratio: PASS · 4:5
- Format: PASS · WebP 12 / 12
- Decode integrity: PASS · 12 / 12
- Unique file hash: PASS · 12 / 12
- Total web asset size: PASS · 1,405,634 bytes
- Individual size range: 26,914–240,116 bytes
- Text·logo·watermark visual check: PASS
- Object geometry: PASS
- Chair·bridge structure: PASS
- Human anatomy and body overlap: PASS
- Image diversity: PASS · 정물·날씨·공간·추상·자연·탑뷰·인물 혼합
- Product consistency: PASS · 공통 선·종이·입자·저채도 팔레트 유지
- Adult conversation-tool tone: PASS
- Fixed symbolic explanation: 없음

## REVIEW NOTES

- 기억 덱은 장면성과 생활 흔적이 가장 풍부하다.
- 충전·회복 덱은 소재를 줄여 선·빛·여백으로 구분된다.
- 미래 상상 덱은 환경 와이드·매크로·탑뷰로 스케일을 분리했다.
- 관계 덱은 사물·추상·인물을 각 한 장씩 사용해 특정 관계 서사를 강요하지 않는다.
- 12장을 함께 놓았을 때 밀도 차이는 있으나 종이 질감·선·색이 공통 제품 언어를 유지한다.

## ISSUES

초기 WebP 변환에서 `recharge_05`, `kind_01` 두 파일이 0바이트로 출력되는 인코더 옵션 오류가 있었다.

- 생성 PNG 원본에는 이상 없음
- 해당 두 장만 기본 WebP 인코딩으로 재변환
- 최종 파일 디코딩·크기·해시 재검증 통과
- 이미지 재생성 없음

잔여 중단 오류 없음.

## OUTPUT

- `assets/images/memory/*.webp` · 3
- `assets/images/recharge/*.webp` · 3
- `assets/images/future/*.webp` · 3
- `assets/images/kind/*.webp` · 3
- `docs/a03/A03_VISUAL_MASTER_PILOT_BOARD.webp`
- `docs/a03/A03_PROMPT_PACK.md`
- `data/visual-master-a03.json`
- `scripts/validate-a03.mjs`
- `docs/a03/A03_QA_RESULT.json`

## NEXT

STOP · G05 사용자 승인 대기.

승인 후 A04 IMAGE PRODUCTION의 BATCH 1만 실행한다.

`기억 한 조각 잔여 12장 → QA → 다음 배치 전 보고`

UI·엔진·Production은 계속 미진행 상태다.
