# A04 BATCH 1 — 기억 한 조각 PROMPT PACK

## 범위

- A03 Pilot 유지: `memory_01`, `memory_06`, `memory_13`
- 이번 생성: `memory_02`, `memory_03`, `memory_04`, `memory_05`, `memory_07`, `memory_08`, `memory_09`, `memory_10`, `memory_11`, `memory_12`, `memory_14`, `memory_15`
- 질문·FOLLOW-UP·ALT는 A02 Manifest를 변경하지 않음
- 이미지 안에는 질문이나 문구를 넣지 않음

## 공통 Visual Master

- `memory_01`은 그림체 참조만 사용하고 식탁·서랍·창·구도는 복제하지 않는다.
- 성인용 editorial illustration
- warm off-white fibrous paper
- sparse thin rough charcoal line
- subtle printed grain
- low-saturation matte color fields
- muted terracotta · deep navy · sage · olive · mustard · dusty blue
- 넓은 여백, 절제된 디테일, 열린 해석
- 금지: 인물, 글자·유사 글자, 숫자, 로고, 워터마크, 사진풍, 3D, glossy, 아동용 그림책, 심리검사 교재, 설명적인 상징

## 카드별 Production Direction

| ID | Subject | Composition | 구조·중복 방지 Lock |
|---|---|---|---|
| `memory_02` | 작은 원형 테이블에서 한 칸 빠진 나무 의자 1개와 긴 오후빛 | 약간 높은 미디엄, 의자 좌하단·빛 우상단 | 의자 1개만, 다리 구조 정상, `kind_01`과 구분 |
| `memory_03` | 낮은 창턱의 투명 유리병 1개와 마른 잎 1장 | 창턱 높이 클로즈업, 병 왼쪽 1/3 | 꽃·비·버스 없음, `memory_06`과 구분 |
| `memory_04` | 낮은 담·낡은 대문·기댄 자전거가 있는 좁은 골목 | 낮은 시점의 깊은 와이드 | 자전거 프레임·바퀴 정상, 간판 없음, `memory_10`과 구분 |
| `memory_05` | 교실 문과 사물함이 반복되는 빈 학교 복도 | 정면 단일 소실점 와이드 | 열린 문 1개, 방 번호·포스터 없음, `memory_09`와 구분 |
| `memory_07` | 낡은 카세트 플레이어와 무라벨 테이프 | 정면에 가까운 타이트 정물 | 테이프 릴 2개, 브랜드·유사 글자 없음, `memory_12`와 구분 |
| `memory_08` | 낡은 쟁반 위 서로 다른 찻잔 2개 | 정확한 탑뷰, 대각 배치 | 잔 2개·손잡이 각 1개, 한 잔만 차, 추가 식기 없음 |
| `memory_09` | 어두운 방에서 밝은 짧은 복도로 열린 주거 문 1개 | 아이레벨 미디엄, 문 오른쪽 | 문틀·경첩·바닥 정상, 공포 톤·학교 요소 없음 |
| `memory_10` | 낮은 풀밭 사이 먼 언덕까지 이어지는 흙길 1개 | 낮은 수평선·큰 하늘의 환경 와이드 | 갈림길·사람·차량·표지판 없음, `future_10`과 구분 |
| `memory_11` | 빈 옥상 난간과 빨랫줄 기둥 2개 위 노을 | 옥상 하단 1/4, 하늘 중심 | 빨래·해 원반·인물 없음, 덱의 유일한 하늘 중심 장면 |
| `memory_12` | 식별 불가능한 사진 3장·닫힌 만년필·작은 상자 | 사선 탑뷰 클로즈업 | 사진 내용·얼굴·글자 식별 불가, 소품 수 고정 |
| `memory_14` | 닳은 실내 계단과 손때 묻은 난간 | 계단 아래 로우앵글 | 단일 계단·난간 구조 정상, 마법적 빛·진보 상징 없음 |
| `memory_15` | 낮은 램프·접힌 담요·닫힌 책·작은 러그가 있는 방 | 문턱에서 보는 공간 와이드 | 램프 1개, 책 무문자, 카탈로그식 연출 없음, `recharge_15`와 구분 |

## 생성 방식

- built-in `image_gen`
- 카드마다 별도 생성 호출
- 3장씩 4개 소그룹으로 생성해 형태 오류를 즉시 확인
- 첫 결과 12장 모두 승인 가능 수준으로 판정되어 재생성 없음
- PNG 생성 결과를 웹용 WebP 품질 84로 변환

