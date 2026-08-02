# NAL 카탈로그 이미지 가이드 v1.0

작성일: 2026-08-01
저장 위치: `/nal/assets/images/catalog/`

## 1. 제작·출처 기록

| 항목 | 기록 |
|---|---|
| 생성 방식 | OpenAI 내장 이미지 생성 도구로 NAL 전용 에디토리얼 콘셉트 제작 |
| 원본 구성 | 프로그램 8종 대표 마스터 8개 + 상품 대표·사용·디테일 마스터 12개, 총 20개 |
| 파생 구성 | 프로그램 마스터의 모바일 안전 크롭 8개 |
| 최종 파일 | WebP 28개, 총 1,470,332 bytes |
| 외부 사진 | 사용하지 않음 |
| 실제 행사 기록 | 사용하지 않음 |
| 실제 판매 확정 제품 사진 | 사용하지 않음 |
| 후처리 | 중앙 안전영역 크롭, 규격 리사이즈, WebP 최적화, 상품 단어·질문의 로컬 타이포그래피 합성 |

생성 이미지는 실제 행사 참여자나 실제 판매 제품을 증명하는 자료가 아니다. 프로그램 이미지는 활동의 분위기와 도구 사용 방식을 설명하고, 상품 이미지는 제품 사양 확정 전 사용 경험을 보여주는 비주얼 콘셉트다.

외부 스톡 이미지가 없으므로 별도의 스톡 출처·상업 라이선스 항목은 없다. 생성물의 사용은 OpenAI 제품 약관과 프로젝트 운영 주체의 정책을 따른다.

상품 카드의 한글 타이포그래피에는 저장소의 `gowun-batang-700.woff2`를 사용했다. Gowun Batang은 SIL Open Font License 1.1이며 전체 라이선스는 `/programs/art-psychology-coaching/assets/fonts/GOWUN_BATANG_LICENSE.txt`, NAL 기록은 `/nal/assets/fonts/FONT_LICENSES.md`에 있다.

## 2. 생성 프롬프트 체계

공통 베이스 프롬프트:

> NAL editorial lifestyle catalog visual, quiet natural light, warm ivory background, tactile real paper and tools, cobalt/lilac/coral/lime accents, spacious asymmetrical composition, human but not sentimental, imperfect process, premium Korean lifestyle curation, no logo, no watermark, no identifiable face.

공통 제외 조건:

> No documentary event claim, no therapy or hospital scene, no corporate stock meeting, no exaggerated smiling, no yoga/meditation cliché, no app icon, no final retail packaging claim, no fixed card count, no medical promise, no malformed hands, no random generated lettering.

| 항목 | 프롬프트 변형 |
|---|---|
| 감정카드 대화모임 | 둥근 나무 테이블, 여러 성인의 손, 감정카드 선택, 조용한 커뮤니티 공간 |
| 자기이해 글쓰기 모임 | 여러 열린 노트, 쓰는 손, 문장 조각, Warm Ivory와 Cobalt |
| 코치들의 대화와 실습 모임 | 2~4명 성인, 차콜 대화 랩, 노트·타이머·질문카드, 수평적 실습 |
| 흐르는 강물처럼 | 서울 도시 조각, 서로 다른 방향의 사람, 대화 경로를 암시하는 코발트 물결선 |
| 감정카드로 만나는 나 | 여러 카드에서 한 장을 고르는 손, 짧은 기록, 코럴·라일락 종이 층 |
| 미술로 그리는 현재의 마음 | 색연필·오일파스텔, 미완성 선과 색, 여러 손의 서로 다른 표현 |
| 관계 속 나의 대화 방식 | 마주 보는 두 자리, 질문카드, 겹치고 엇갈리는 두 선, 관계의 거리 |
| 올해의 방향 콜라주 | 가위·풀·종이·손글씨, 선택하고 배열하는 과정, Acid Lime와 Cobalt |
| 감정카드 | 라일락·코럴 카드 모형, 넓은 여백, 단어가 중심인 대표·사용·디테일 장면 |
| 코칭 질문카드 | Cobalt·Ivory 카드 모형, 한 장에 한 질문, 노트·코치의 손·타이머 |
| 관계 질문카드 | 라일락·차콜 두 카드의 연결과 거리, 가족·동료까지 포괄하는 중립적 장면 |
| 강점카드 | Acid Lime·Charcoal 카드, 강점 단어 중심, 행동→장면→다음 활용을 암시 |

생성 단계에서는 카드의 글자 영역을 단순하게 유지하고, 최종 한글 단어·질문은 저장소의 라이선스 확인된 로컬 폰트로 합성했다. 이는 생성형 이미지의 오탈자를 피하고 접근 가능한 alt와 화면 카피가 같은 의미를 전달하게 하기 위한 처리다.

## 3. 최종 파일 인벤토리

### GATHER

| 항목 | 1600×1000 cover | 900×1200 mobile |
|---|---|---|
| 감정카드 대화모임 | `nal-gather-emotion-card-conversation-cover.webp` | `nal-gather-emotion-card-conversation-mobile.webp` |
| 자기이해 글쓰기 모임 | `nal-gather-self-understanding-writing-cover.webp` | `nal-gather-self-understanding-writing-mobile.webp` |
| 코치들의 대화와 실습 모임 | `nal-gather-coaches-dialogue-practice-cover.webp` | `nal-gather-coaches-dialogue-practice-mobile.webp` |
| 흐르는 강물처럼 | `nal-gather-flowing-river-coaches-cover.webp` | `nal-gather-flowing-river-coaches-mobile.webp` |

### CLASS

| 항목 | 1600×1000 cover | 900×1200 mobile |
|---|---|---|
| 감정카드로 만나는 나 | `nal-class-meet-myself-with-emotion-cards-cover.webp` | `nal-class-meet-myself-with-emotion-cards-mobile.webp` |
| 미술로 그리는 현재의 마음 | `nal-class-art-current-mind-cover.webp` | `nal-class-art-current-mind-mobile.webp` |
| 관계 속 나의 대화 방식 | `nal-class-relationship-dialogue-style-cover.webp` | `nal-class-relationship-dialogue-style-mobile.webp` |
| 올해의 방향 콜라주 | `nal-class-direction-collage-cover.webp` | `nal-class-direction-collage-mobile.webp` |

### SHOP

| 항목 | 1600×1600 cover | 1600×1100 use | 1200×1500 detail |
|---|---|---|---|
| 감정카드 | `nal-shop-emotion-cards-cover.webp` | `nal-shop-emotion-cards-use.webp` | `nal-shop-emotion-cards-detail.webp` |
| 코칭 질문카드 | `nal-shop-coaching-question-cards-cover.webp` | `nal-shop-coaching-question-cards-use.webp` | `nal-shop-coaching-question-cards-detail.webp` |
| 관계 질문카드 | `nal-shop-relationship-question-cards-cover.webp` | `nal-shop-relationship-question-cards-use.webp` | `nal-shop-relationship-question-cards-detail.webp` |
| 강점카드 | `nal-shop-strength-cards-cover.webp` | `nal-shop-strength-cards-use.webp` | `nal-shop-strength-cards-detail.webp` |

## 4. 용량 검수

| 규격 | 제한 | 실제 최대 |
|---|---:|---:|
| 프로그램 cover | 250KB | 121,520 bytes |
| 프로그램 mobile | 200KB | 72,078 bytes |
| 상품 cover | 300KB | 65,168 bytes |
| 상품 use | 300KB | 64,306 bytes |
| 상품 detail | 250KB | 69,218 bytes |

모든 파일은 WebP이며 파일명은 영문 소문자, 숫자, 하이픈만 사용한다.

## 5. 대체텍스트 원칙

- 프로그램은 실제 활동 장면과 보이는 도구를 설명한다.
- 상품은 `비주얼 콘셉트`임을 alt 또는 인접 캡션에서 명시한다.
- 카드에 읽을 수 있는 핵심 단어·질문이 있으면 alt에 포함한다.
- 같은 이미지를 반복하는 장식 조합은 빈 alt와 `aria-hidden`을 사용한다.
- `이미지`, 파일명, 색상만으로 끝나는 alt는 사용하지 않는다.

상품 상세의 공통 고지:

> 현재 이미지는 사용 경험을 설명하기 위한 비주얼 콘셉트이며, 실제 판매 제품의 디자인·크기·구성과 다를 수 있습니다.

## 6. 교체 절차

실물 또는 실제 운영 사진이 준비되면 같은 파일명을 무조건 덮어쓰지 않는다.

1. 촬영 동의, 초상권, 상업 이용 권한을 확인한다.
2. 실제 행사 기록인지 연출 이미지인지 출처 문서에 표시한다.
3. 규격·안전영역·용량을 맞춘 새 파일을 추가한다.
4. JSON의 `coverImage`, `coverImageMobile`, `gallery`, alt를 함께 갱신한다.
5. 생성·sitemap·정적 QA·브라우저 QA를 다시 실행한다.
6. 상품 실물이 확정되기 전에는 `visualNote`를 제거하지 않는다.
