# RUN A04 — IMAGE PRODUCTION · BATCH 3 FUTURE

## STATUS

COMPLETE

`미래 상상` 잔여 12장 생성과 15장 전체 덱 QA를 완료했다. A04 BATCH 4는 시작하지 않았다.

## COMPLETED

- A03 Pilot 3장 유지: `future_02`, `future_03`, `future_06`
- 잔여 12장 개별 생성: `future_01`, `future_04–05`, `future_07–15`
- Future Pilot 3장을 역할별 스타일 참조로 적용
- 모든 최종 이미지 4:5 세로 WebP 1122×1402로 변환
- 15장 전체 덱 비교판 제작
- 카드별 사물 구조·공간 원근·그림자·글자·왜곡·중복 소재·설명적 상징 여부 검수
- 파일 수·ID·Manifest 경로·해상도·포맷·디코딩·크기·해시 자동 검수
- BATCH 4 이미지가 조기 생성되지 않았는지 확인
- BATCH 2 검증기를 후속 승인 배치를 인식하는 단계형 검증으로 보강

## OUTPUT

- `assets/images/future/future_01.webp`–`future_15.webp` · 총 15장
- 신규 자산 · 12장
- `docs/a04/A04_BATCH3_FUTURE_DECK_BOARD.webp`
- `docs/a04/A04_BATCH3_FUTURE_PROMPT_PACK.md`
- `data/a04-batch3-future.json`
- `scripts/validate-a04-future.mjs`
- `scripts/validate-a04-recharge.mjs` · 후속 배치 인식 보강
- `docs/a04/A04_BATCH3_FUTURE_QA_RESULT.json`

## QA

- Future deck count: PASS · 15 / 15
- A03 inherited pilots: PASS · 3 / 3
- A04 new assets: PASS · 12 / 12
- ID sequence: PASS · `future_01`–`future_15`
- A02 Manifest mapping: PASS · 15 / 15
- Dimensions: PASS · 최종 15장 모두 1122 × 1402
- Format / decode: PASS · WebP 15 / 15
- Unique file hash: PASS · 15 / 15
- New web asset size: PASS · 1,536,630 bytes
- Full future deck size: PASS · 1,968,548 bytes
- Individual final asset range: PASS · 92,236–199,940 bytes
- Text·pseudo-text·logo·watermark: PASS · 없음
- People / anatomy: PASS · 인물 없음
- Object geometry: PASS · 열쇠·다리·씨앗·등대·계단·지도·창문·배·나무·문·가방·촛불·실·그릇
- Space / shadow integrity: PASS
- Content ambiguity: PASS · 오브젝트에 미래의 의미나 정답을 미리 부여하지 않음
- Choice neutrality: PASS · 두 갈래 길과 두 방향 가지가 한쪽을 더 옳게 강조하지 않음
- Intra-deck diversity: PASS · 오브젝트·공간·자연·거리·빛·이동·정적 장면·클로즈업·탑뷰·와이드 혼합
- Repetition control: PASS · 길·문·창문·계단이 각각 다른 공간 관계와 시점으로 분리됨
- Visual Master consistency: PASS · 종이·charcoal line·저채도 팔레트·grain 유지
- Adult conversation-tool tone: PASS
- Regenerated cards: 0
- Canvas normalization: 0 · 생성 원본 12장 모두 1122×1402
- BATCH 4 early production: PASS · `kind` Pilot 3장만 존재
- A00–A04 regression validation: PASS · 5 / 5

## ISSUES

중단 대상 오류 없음.

- 생성 원본 12장 모두 목표 캔버스와 일치해 크롭·리사이즈가 필요하지 않았다.
- `future_08` 배의 선체·돛대·접힌 돛, `future_11` 독립 문틀, `future_12` 정확히 3개의 선택 소품을 확대 확인했다.
- `future_10` 두 길은 폭·밝기·시각적 비중을 비슷하게 유지해 한쪽 선택을 정답으로 보이게 하지 않았다.
- `future_13` 촛불과 `future_14` 풀린 실은 Recharge의 등불·팽팽한 실과 상태·구도·질문 기능이 겹치지 않는다.

## NEXT

STOP · A04 BATCH 4 미진행.

다음 사용자 승인 후에만 아래 범위를 실행한다.

`서로에게 따뜻 잔여 12장 → QA → A05 전 보고`

UI·엔진·Production은 계속 미진행 상태다.
