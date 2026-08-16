# A04 BATCH 2 — 충전·회복 PROMPT PACK

## 범위

- A03 Pilot 유지: `recharge_01`, `recharge_05`, `recharge_15`
- 이번 생성: `recharge_02–04`, `recharge_06–14`
- 질문·FOLLOW-UP·ALT는 A02 Manifest를 변경하지 않음
- 이미지 안에는 감정명·질문·설명 문구를 넣지 않음

## 참조 역할

- `recharge_01`: 덱의 미니멀 표면·여백·추상도 기준
- `recharge_05`: 공간·명암·빛의 절제 기준
- `recharge_15`: 작은 오브젝트와 넓은 어둠의 스케일 기준
- `memory_01`: 제품 전체의 종이·charcoal line·grain·저채도 팔레트 기준
- 모든 참조는 STYLE REFERENCE ONLY이며 기존 피사체와 구도를 복제하지 않음

## 공통 Visual Lock

- 성인용 editorial illustration
- warm off-white fibrous paper
- sparse thin rough charcoal line
- subtle printed grain
- low-saturation matte color fields
- muted terracotta · deep navy · sage · olive · mustard · dusty blue
- 감정명을 지정하지 않는 표면·형태·공간·질감
- 금지: 인물, 글자·유사 글자, 숫자, 로고, 워터마크, 사진풍, 3D, glossy, 아동용 그림책, 심리검사 교재, 설명적인 상징

## 카드별 Production Direction

| ID | Subject | Composition | 구조·중복 방지 Lock |
|---|---|---|---|
| `recharge_02` | 잔물결과 작은 반사가 있는 잿빛 파랑 수면 | 수평선 없는 전면 수면 | 동심원·비·육지 없음, `recharge_11`과 구분 |
| `recharge_03` | 서로 닿지 않는 파랑·테라코타 잉크 번짐 | 탑뷰, 중앙에 종이 여백 | 구체 형상·대칭 검사도식 없음 |
| `recharge_04` | 김 서린 유리와 비정형 맑은 자국 1개 | 유리 밀착 정면 클로즈업 | 손자국·인물·빗방울 없음, `memory_06`과 구분 |
| `recharge_06` | 주름진 천을 깊게 누르는 회색 돌 1개 | 낮은 사선 클로즈업 | 돌·천 접점과 압력 구조 정상, `recharge_12`와 구분 |
| `recharge_07` | 넓은 빈 방의 작은 세이지 매트 1개 | 초광각 정면 와이드 | 가구·램프·창문 없음, `memory_15`와 구분 |
| `recharge_08` | 오프화이트 회벽의 단일 가는 균열 | 우측으로 흐르는 세로 클로즈업 | 파손·빛·금박·지도형 패턴 없음 |
| `recharge_09` | 두께·투명도가 다른 무문자 종이 층 | 탑뷰, 어긋난 모서리 | 잉크·사진·클립 없음, `recharge_03`과 구분 |
| `recharge_10` | 프레임 밖에서 떨어져 쌓이는 모래 | 수직 매크로, 언덕 하단 1/3 | 용기·시계·두 번째 흐름 없음 |
| `recharge_11` | 단일 충격점에서 퍼지는 동심원 파문 | 탑뷰, 중심 좌하단 | 수평선·잎·다중 물방울 없음, `recharge_02`와 구분 |
| `recharge_12` | 바닥에 느슨하게 구겨진 테라코타 천 | 바닥 가까운 중간 클로즈업 | 한 조각 연속성, 돌·외부 물체 없음 |
| `recharge_13` | 열린 틈의 바람에 부푼 세이지 커튼 1장 | 측면 아이레벨 미디엄 | 창틀 부착·그림자 정상, 인체형 실루엣 없음 |
| `recharge_14` | 물이 가장자리까지 찬 무광 컵 1개 | 컵 테두리 높이의 매크로 | 수면·테두리 정상, 받침·숟가락·추가 잔 없음 |

## 생성·정규화 방식

- built-in `image_gen`
- 카드마다 별도 생성 호출
- 3장씩 4개 소그룹으로 생성해 형태 오류를 즉시 확인
- 첫 결과 12장 모두 내용 QA 통과, 재생성 없음
- `recharge_07`, `recharge_10`, `recharge_11` 생성 원본은 1064×1478 캔버스였으므로 중앙 4:5 크롭 후 1122×1402로 정규화
- 나머지 9장은 원본 1122×1402 유지
- 최종 15장 모두 웹용 WebP 품질 84

