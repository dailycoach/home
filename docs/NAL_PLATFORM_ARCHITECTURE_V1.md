# NAL Platform Architecture v1

기준 브랜치: `agent/nal-community-platform-v1`

기준 경로: `/nal/`
canonical 대상 URL: `https://daily-coach-ing.com/nal/`

이 문서는 현재 저장소에 구현된 NAL v1의 구조와 공개 기준을 기록한다. 향후 희망 기능이 아니라 현재 정적 사이트가 실제로 지원하는 범위를 기준으로 한다. 위 URL은 HTML과 데이터에 설정된 canonical 대상이며, 이 작업 브랜치가 실제 운영 환경에 배포됐다는 의미는 아니다.

## 1. 구조 결정

### 1.1 `/nal/` 격리 이유

NAL은 저장소 루트와 기존 `/programs/`, `/tests/`, `/cards/`, `/lcms/` 페이지를 교체하지 않고 `/nal/` 아래에 독립시켰다.

- 기존 DAILYCOACHING 페이지와 전역 스타일·스크립트의 충돌을 피한다.
- 내부 표기는 NAL, 외부 사이트명은 날빛이라는 별도 브랜드 규칙을 한 경로 안에서 일관되게 적용한다.
- NAL 전용 데이터, CSS, JavaScript, 이미지와 상세 URL을 함께 관리한다.
- 문제가 생기면 `/nal/`과 NAL에 추가된 사이트맵 항목만 되돌릴 수 있다.
- 기존 미술심리코칭 원문은 `/programs/art-psychology-coaching/`에 그대로 두고 NAL이 이를 참조한다.

NAL 전용 범위는 다음과 같다.

```text
/nal/
├── assets/
│   ├── css/nal.css
│   ├── js/app.js
│   └── images/
├── data/
│   ├── site.json
│   ├── programs.json
│   ├── products.json
│   ├── hosts.json
│   ├── content.json
│   └── routes.json
├── gather/
├── class/
├── shop/
├── note/
├── host/
├── my/
├── search/
└── 운영·정책 페이지
```

### 1.2 배포 방식

- 저장소는 `CNAME`의 `daily-coach-ing.com`을 대상으로 하는 정적 GitHub Pages 구조다. 현재 브랜치의 실제 배포 완료 여부는 별도 확인해야 한다.
- NAL은 서버 렌더링, 데이터베이스, API 서버 또는 프레임워크 빌드에 의존하지 않는다.
- 각 공개 URL에 실제 `index.html`을 생성하므로 직접 접근과 새로고침 때 SPA 폴백을 요구하지 않는다.
- 브라우저 런타임은 `site.json`, `programs.json`, `products.json`, `hosts.json`, `content.json`을 읽어 페이지 본문을 구성한다. 생성된 `routes.json`은 런타임 입력이 아니라 라우트·메타데이터 목록이다.
- 페이지 생성기는 공개 항목의 기본 목록과 상세 요약을 정적 HTML 폴백으로 함께 넣고 `routes.json`을 다시 만든다. JavaScript는 이를 필터·검색·찜·상세 UI로 교체한다.
- JSON `fetch()`가 필요하므로 전체 기능 검수는 `file://`이 아니라 HTTP 서버 또는 실제 Pages 환경에서 해야 한다.
- 별도의 `package.json` 명령은 없다. 페이지·사이트맵 생성과 QA는 저장소의 Node.js 스크립트를 직접 실행한다.

```bash
node scripts/generate-nal-pages.mjs
node scripts/generate-nal-sitemap.mjs
node scripts/check-nal-platform.mjs
```

`generate-nal-pages.mjs`는 NAL HTML을 다시 쓰므로 HTML을 직접 수정한 뒤 생성기를 실행하면 수동 변경이 사라질 수 있다. 공통 메타데이터나 기본 마크업 변경은 생성기에서 먼저 반영한다.

## 2. 라우트

### 2.1 현재 물리적으로 생성된 라우트

현재 `/nal/` 아래에는 물리 `index.html` 기준 19개 라우트가 있다. 이 중 13개는 index 대상이고 6개는 `noindex,follow`다.

| 구분 | 라우트 | 검색 정책 |
|---|---|---|
| 홈 | `/nal/` | index |
| 모임 목록 | `/nal/gather/` | index |
| 클래스 목록 | `/nal/class/` | index |
| 클래스 상세 | `/nal/class/art-psychology-coaching-6week/` | index |
| 스토어 목록 | `/nal/shop/` | index |
| 콘텐츠 목록 | `/nal/note/` | index |
| 콘텐츠 상세 | `/nal/note/art-psychology-coaching-guide/` | index |
| 진행자 목록 | `/nal/host/` | index |
| 진행자 상세 | `/nal/host/park-jia/`, `/nal/host/kim-cheol-woong/` | index |
| 로컬 MY | `/nal/my/` | noindex |
| 검색 | `/nal/search/` | noindex |
| 운영 | `/nal/notice/`, `/nal/faq/`, `/nal/partnership/` | index |
| 정책 | `/nal/policy/terms/`, `/nal/policy/privacy/`, `/nal/policy/cancellation/`, `/nal/policy/shipping/` | noindex |

초안 모임·클래스·상품은 JSON에만 있으며 물리 상세 페이지가 없다. 실제 정보가 확정되기 전에 검색엔진이나 사용자에게 완성 상품처럼 노출하지 않기 위한 선택이다.

현재 루트 `pages.json`, 루트 헤더와 루트 메뉴에는 NAL 진입 링크가 등록돼 있지 않다. 따라서 이 브랜치 상태에서의 진입점은 `/nal/` 직접 URL과 NAL 내부 링크다.

### 2.2 라우트 생성 규칙

- 컬렉션의 `slug`가 물리 URL 마지막 경로가 된다.
- 프로그램은 `type`에 따라 `/nal/gather/{slug}/` 또는 `/nal/class/{slug}/`를 사용한다.
- 상품은 `/nal/shop/{slug}/`, 진행자는 `/nal/host/{slug}/`, 콘텐츠는 `/nal/note/{slug}/`를 사용한다.
- 생성기는 프로그램·상품·진행자 상세를 컬렉션별 `detailSets.slugs`와 `publicSlugs`로 제한한다.
- 현재 콘텐츠 상세 한 건은 범용 `publicSlugs` 처리 없이 생성기에 별도 페이지로 등록돼 있다. 새 콘텐츠 상세는 생성기에 페이지를 추가하거나 생성 방식을 일반화해야 한다.
- QA는 `published: true`인 데이터에 상세 파일이 존재하고, `published: false`인 데이터에는 상세 파일이 없음을 검사한다.
- 런타임 목록·검색·관계 영역도 `published === true`인 항목만 사용한다.

현재 프로그램·상품·진행자는 데이터의 `published`와 생성기의 `publicSlugs`가 서로 다른 두 공개 관문이다. 새 항목을 공개할 때 둘 중 하나만 바꾸면 QA가 실패하거나 링크와 검색 노출이 어긋난다. 생성 후 `routes.json`에는 실제 19개 라우트의 path, title, description, indexable 값이 기록된다.

## 3. 데이터 계층

운영 데이터 5개와 생성 라우트 목록 1개는 모두 `schemaVersion: "1.0"`을 가진다. 운영 데이터는 UI와 HTML에서 분리하고, `routes.json`은 HTML 생성 결과를 기록한다.

현재 데이터 공개 현황은 다음과 같다.

| 컬렉션 | 전체 | `published: true` | 비공개 초안·후보 |
|---|---:|---:|---:|
| 프로그램 | 9 | 1 (`comingSoon`) | 8 (`draft`) |
| 상품 | 8 | 0 | 8 (`stockStatus: comingSoon`) |
| 진행자 | 2 | 2 | 0 |
| 콘텐츠 | 1 | 1 | 0 |
| 생성 라우트 | 19 | 13 indexable | 6 noindex |

### 3.1 프로그램: `nal/data/programs.json`

상위 배열은 `programs`다.

| 영역 | 필드 |
|---|---|
| 식별 | `id`, `slug`, `type` |
| 소개 | `title`, `subtitle`, `summary`, `description`, `category`, `tags` |
| 미디어 | `coverImage`, `gallery` |
| 연결 | `hostId`, `productIds`, `relatedContentIds`, `sourceUrl` |
| 방식·장소 | `format`, `location`, `address`, `onlineUrl` |
| 일정 | `startDate`, `endDate`, `startTime`, `endTime`, `duration`, `frequency`, `sessionCount` |
| 모집·가격 | `capacity`, `remainingSeats`, `price`, `originalPrice`, `status`, `applicationUrl` |
| 참여 안내 | `difficulty`, `materials`, `includedItems`, `soloFriendly`, `beginnerFriendly`, `groupChat`, `refundPolicy`, `safetyGuide` |
| 발행 | `featured`, `published`, `createdAt`, `updatedAt` |

`type`은 `gather` 또는 `class`만 사용한다. 날짜, 시간, 가격과 인원은 확인된 값이 없으면 `null`을 유지한다.

### 3.2 상품: `nal/data/products.json`

상위 배열은 `products`이며 `storefrontUrl`에는 스마트스토어 홈만 기록돼 있다. 현재 홈 화면의 스마트스토어 CTA는 이 값이 아니라 `site.json`의 `externalLinks.smartStore`를 읽으며 두 값은 같은 주소다.

| 영역 | 필드 |
|---|---|
| 식별·소개 | `id`, `slug`, `title`, `subtitle`, `summary`, `description`, `category`, `tags` |
| 미디어 | `coverImage`, `gallery` |
| 판매 | `price`, `originalPrice`, `productType`, `deliveryType`, `stock`, `stockStatus`, `options`, `purchaseUrl` |
| 구성 | `components`, `cardCount`, `pageCount`, `recommendedFor` |
| 활용 | `usageIndividual`, `usageCouple`, `usageGroup`, `precautions` |
| 정책 | `shippingPolicy`, `exchangePolicy`, `refundPolicy` |
| 연결·발행 | `relatedProgramIds`, `relatedContentIds`, `featured`, `published`, `createdAt`, `updatedAt` |

`deliveryType`은 공개 전 `physical`, `digital`, `physical-and-digital` 중 실제 판매 방식 하나로 확정한다. QA는 비공개 초안의 `null`도 허용한다. 현재 후보 상품은 판매 여부와 방식이 확정되지 않아 가격·재고·구매 URL을 비워 두고 `published: false`로 둔다.

### 3.3 진행자: `nal/data/hosts.json`

상위 배열은 `hosts`다. `id`, `slug`, `name`, 프로필 이미지, `headline`, `bio`, `fields`, `credentials`, `experience`, `location`, 연결 프로그램·콘텐츠, `socialLinks`, `featured`, `published`를 관리한다.

- 박지아 정보와 이미지는 기존 미술심리코칭 페이지의 공개 내용만 사용한다.
- 김철웅 정보는 기존 `/coach/`에서 확인되는 최소 공개 정보만 사용한다.
- 자격, 경력, 활동 지역은 운영 확인 없이 보강하지 않는다.

### 3.4 콘텐츠: `nal/data/content.json`

상위 배열은 `content`다. `id`, `slug`, `title`, `summary`, `category`, `coverImage`, `authorId`, `publishedAt`, `readingTime`, `body`, 관련 프로그램·상품, `sourceUrl`, `featured`, `published`를 관리한다.

현재 공개 콘텐츠는 미술심리코칭 참여 안내 원문을 연결하는 한 건이다. `body`와 발행일이 확정되지 않았으므로 임의 본문이나 날짜를 만들지 않았다.

### 3.5 사이트 설정: `nal/data/site.json`

브랜드 표기, 기본 메타데이터, 메뉴, 카테고리, 상태 라벨, 외부 링크, 기능 가용성, 디자인 토큰과 법적 정보 슬롯을 관리한다.

- 외부 사이트명: 날빛
- 내부 브랜드: NAL
- 기준 경로: `/nal/`
- canonical 기준: `https://daily-coach-ing.com/nal/`
- 회원·결제처럼 없는 기능은 `false` 또는 `unavailable`로 둔다.
- 운영자·사업자 정보는 확인 전 `null`을 유지한다.

### 3.6 생성 라우트: `nal/data/routes.json`

`routes.json`은 `scripts/generate-nal-pages.mjs`가 HTML과 함께 생성한다. 상위 배열 `routes`의 각 항목은 `path`, `title`, `description`, `indexable`을 가진다. 현재 19개 라우트를 기록하며 브라우저 런타임은 이 파일을 읽지 않는다. 수동 수정하지 않고 페이지 생성기를 통해 갱신한다.

### 3.7 관계 참조

관계는 제목이나 slug가 아니라 변경 가능성이 낮은 `id`로 연결한다.

```text
program.hostId              -> hosts.id
program.productIds[]        -> products.id
program.relatedContentIds[] -> content.id
product.relatedProgramIds[] -> programs.id
product.relatedContentIds[] -> content.id
host.programIds[]           -> programs.id
host.contentIds[]           -> content.id
content.authorId            -> hosts.id
content.relatedProgramIds[] -> programs.id
content.relatedProductIds[] -> products.id
```

slug를 바꿀 때는 기존 URL 리디렉션 정책을 별도로 마련해야 한다. GitHub Pages만으로 서버 리디렉션을 만들 수 없으므로 공개 후 slug 변경은 피한다.

## 4. 상태와 공개 조건

### 4.1 프로그램 상태

| 값 | 의미 | 공개·CTA 원칙 |
|---|---|---|
| `draft` | 운영 초안 | `published: false`, 상세 URL과 신청 CTA 없음 |
| `comingSoon` | 소개는 가능하나 모집 정보 미확정 | 신청 대신 `신청 준비 중` 또는 원문 보기 |
| `open` | 모집 중 | 실제 `applicationUrl`과 확정 일정·조건이 있을 때만 신청 CTA |
| `closing` | 마감 임박 | 실제 근거가 있을 때만 사용. 임의 잔여석 금지 |
| `waiting` | 대기 신청 | 실제 대기 신청 경로가 있을 때만 CTA |
| `closed` | 신청 마감 | 신청 비활성, 확정된 다음 일정 알림 경로가 없다면 준비 중 안내 |
| `completed` | 종료 | 지난 모임으로 분리하며 현재 모집처럼 노출하지 않음 |

런타임은 `open`, `closing`, `waiting` 상태이면서 유효한 `applicationUrl`이 있을 때만 신청 또는 대기 신청 CTA를 활성화한다. `closed`, `completed`, `comingSoon`에서는 URL이 잘못 남아 있더라도 신청 CTA를 만들지 않는다.

`remainingSeats`는 숫자로 확인된 값일 때만 카드와 상세에 표시한다. 실시간 좌석 API는 없으므로 운영자가 현재 좌석 수를 확인해 갱신할 수 있을 때만 값을 입력하고, 그렇지 않으면 `null`을 유지한다.

### 4.2 상품 공개 조건

상품은 최소한 실제 상품명, 이미지 사용권, 구성, 가격, 배송 유형, 재고 상태, 구매 URL, 배송·교환·환불 정책이 확인된 뒤 `published: true`로 전환한다. 현재 후보 상품은 모두 비공개이며 NAL 내부 결제 화면도 없다.

상품 JSON과 런타임은 개별 구매 주소의 기본 필드로 `purchaseUrl`을 사용한다. 이전 데이터 호환을 위해 런타임은 `externalPurchaseUrl`도 보조로 읽지만, 새 상품은 `purchaseUrl`만 사용한다. 구매 CTA는 구매 가능 재고 상태, 1개 이상의 재고 또는 수량 미연동 상태, 유효한 구매 URL이 함께 충족될 때만 활성화한다.

### 4.3 발행 절차

1. 운영자가 원천 정보와 사용권을 확인한다.
2. 해당 JSON의 필수 필드와 실제 외부 신청·구매 URL을 입력한다.
3. 상태를 실제 운영 상태로 바꾸고 `published: true`로 전환한다.
4. 프로그램·상품·진행자는 `scripts/generate-nal-pages.mjs`의 `detailSets.slugs`와 `publicSlugs`에도 slug를 등록한다. 콘텐츠는 현재 별도 상세 페이지 등록이 필요하다.
5. 페이지를 생성해 물리 HTML과 `routes.json`을 갱신하고, 이어 사이트맵을 다시 생성한다.
6. QA 스크립트와 실제 HTTP 환경에서 직접 URL·CTA·모바일 화면을 확인한다.

## 5. 현재 실제 연결

### 5.1 스마트스토어

- 연결 주소: `https://smartstore.naver.com/nalbitcoaching`
- 현재 연결 범위: 홈과 스토어 빈 상태에서 `site.json`의 `externalLinks.smartStore`를 통해 스마트스토어 홈으로 이동
- 연결하지 않은 범위: 개별 상품 URL, 가격, 재고, 옵션, 주문·결제 결과

NAL은 스마트스토어의 상품 정보를 자동 동기화하지 않는다. 상품별 정보가 확인되기 전에는 스마트스토어에 존재하는 것처럼 개별 상품 카드를 공개하지 않는다.

### 5.2 미술심리코칭 원문

- 과정 원문: `/programs/art-psychology-coaching/`
- 참여 안내 원문: `/programs/art-psychology-coaching/guide.html`
- NAL 클래스 상세: `/nal/class/art-psychology-coaching-6week/`
- NAL 콘텐츠 연결: `/nal/note/art-psychology-coaching-guide/`
- 진행자: 박지아

확정되지 않은 모집 일정, 장소, 참가비, 정원, 잔여석과 신청 링크는 모두 비어 있다. 현재 공개 상태는 `comingSoon`이며 실제 신청 완료를 모방하지 않는다.

푸터와 제휴 페이지에는 `hello@daily-coach-ing.com` 메일 링크가 코드에 설정돼 있다. 운영 배포 전 실제 수신 가능한 주소인지 운영자가 확인해야 한다.

## 6. 현재 구현과 미구현

### 6.1 v1에서 가능한 범위

- 공개 데이터만 사용하는 목록·상세 탐색과 JavaScript 미실행 시 기본 목록·요약 폴백
- 공개 프로그램 1건, 진행자 2명, 콘텐츠 1건의 상세 URL. 공개 상품과 공개 모임은 현재 0건
- 브라우저 내 공개 데이터 검색. 검색 결과 페이지 자체는 `noindex`
- 목록의 검색어·카테고리·프로그램 상태 필터와 추천·마감 임박·가까운 일정·신규·낮은 가격 정렬. 선택값은 URL 쿼리에 반영
- 이 브라우저에만 저장되는 찜과 최근 본 항목. 저장 키는 `nal:wishlist:v1`, `nal:recent:v1`
- NAL 페이지별 canonical, Open Graph, JSON-LD
- 상태와 데이터 부재에 따른 준비 중·빈 상태 안내, 부분 데이터 로드 실패 시 재시도 안내
- 확인된 숫자가 있을 때만 정원·잔여 좌석 출력
- 외부 원문과 스마트스토어 홈 이동

### 6.2 미구현 범위

- 회원가입, 로그인, 사용자 계정과 서버 동기화
- 자체 예약, 신청서 제출과 신청 내역 관리
- 자체 장바구니, 주문, 결제, 결제 성공·실패·취소 처리
- 뉴스레터 구독 저장과 발송
- 다음 일정 알림 저장과 발송
- 후기 작성, 검수, 공개 동의와 익명화 처리
- 실시간 정원·잔여 좌석 동기화
- 스마트스토어 개별 상품·재고·주문 동기화
- 지역·날짜·가격대·진행자·온라인/오프라인 전용 필터와 모바일 바텀시트 필터
- 디지털 상품 권한과 다운로드 이력
- 팔로우한 진행자와 회원 기반 MY NAL
- 루트 DAILYCOACHING 메뉴·`pages.json`에서 NAL로 진입하는 연결

로컬 찜과 최근 본 항목은 같은 브라우저·기기에서만 유지된다. 브라우저 데이터 삭제, 시크릿 모드 또는 다른 기기에서는 복원되지 않으며 신청·구매 내역을 뜻하지 않는다. 개인정보나 결제정보는 로컬 저장 기능에 넣지 않는다.

## 7. 운영자가 입력해야 할 정보

| 대상 | 공개 전 필수 확인·입력 |
|---|---|
| 모임·클래스 | 실제 설명, 진행자, 사진 사용권, 온라인/오프라인 방식, 날짜·시간, 기간·회차, 장소, 참가비, 정원, 현재 상태, 신청 URL, 준비물, 포함 항목, 참여 기준, 안전 안내, 취소·환불 규정 |
| 상품 | 실제 상품명, 촬영 이미지, 구성품, 카드 수·페이지 수, 사용 대상과 사용법, 실물/디지털 구분, 옵션, 가격, 재고, 개별 구매 URL, 주의사항, 배송·교환·환불 정책 |
| 진행자 | 본인 확인 이름, 사진 공개 동의, 한 문장 소개, 실제 진행 분야, 검증된 경력·자격, 활동 지역, 진행 방식, 공개 가능한 SNS |
| 콘텐츠 | 최종 제목·요약·본문, 저자, 대표 이미지 권리, 발행일, 읽는 시간, 관련 프로그램·상품, 인용·참고 출처 |
| 후기 | 원문, 연결 프로그램·상품, 공개 범위, 익명화 방식, 명시적 공개 동의, 작성·검수일 |
| 운영·법적 | 운영자명, 대표자, 사업자등록번호, 주소, 고객 문의 채널, 개인정보 처리 주체·수집 항목·보유 기간, 정식 약관, 취소·환불, 배송·교환 기준 |
| SEO | 최종 도메인 확인, 페이지별 title·description, 공유 이미지, 공개일·수정일, 종료 프로그램의 보존 또는 noindex 결정 |

운영 정보는 다른 페이지나 기억을 근거로 자동 채우지 않고 담당자가 최종 확인한다.

## 8. SEO

- 각 물리 페이지에 고유 `title`, `description`, canonical, Open Graph와 JSON-LD를 둔다.
- 공유 이미지는 현재 `/nal/assets/images/nal-og.png`를 공통 사용한다.
- `MY NAL`, 검색 결과와 확정 전 정책 페이지는 `noindex`다.
- `scripts/generate-nal-sitemap.mjs`는 루트 `pages.json`의 내부 URL과 NAL의 물리 페이지를 모으고 NAL의 `noindex` 페이지를 제외한다.
- `robots.txt`는 `https://daily-coach-ing.com/sitemap.xml`을 가리킨다.
- 공개하지 않은 데이터에는 상세 URL을 만들지 않으며 사이트맵에도 넣지 않는다.
- 종료 프로그램은 운영 정책에 따라 정보 가치가 있으면 `completed` 상태로 보존하고, 개인정보·기간 만료 사유가 있으면 noindex 또는 제거를 별도로 결정한다.

생성된 정적 HTML에는 페이지 소개뿐 아니라 공개 목록의 제목·요약과 공개 상세의 요약·원문 링크 폴백이 들어간다. 필터, 전체 상세 구성, 관계 카드, 찜과 최근 본 항목은 JavaScript 실행에 의존한다. 검색 유입이 중요한 상세는 반드시 물리 HTML과 고유 메타데이터를 생성한다.

## 9. 접근성과 안전

현재 공통 HTML은 `lang="ko"`, 본문 바로가기 링크, 고유 `main`, 라이브 상태 영역을 둔다. CSS는 `:focus-visible`, 동작 축소 설정, 44px 터치 영역과 모바일 레이아웃을 제공한다. 모바일 드로어는 `aria-modal`, 배경 `inert`, Tab 포커스 순환, Escape 종료와 트리거 포커스 복귀를 런타임에 구현한다.

운영·확장 시 다음 기준을 유지한다.

- 제목 단계를 건너뛰지 않는다.
- 링크와 버튼 역할을 구분하고 비활성 기능을 링크처럼 보이게 하지 않는다.
- 메뉴·필터·모달은 키보드로 열고 닫을 수 있어야 하며 닫은 뒤 시작 버튼으로 포커스를 돌린다.
- 모집 상태는 색뿐 아니라 텍스트로 표시한다.
- 모든 정보성 이미지에 실제 장면을 설명하는 alt를 입력하고 장식 이미지는 빈 alt를 사용한다.
- 일정·가격·장소가 없을 때 숫자나 예시값을 대신 만들지 않는다.
- 감정카드, 질문카드와 프로그램은 자기이해와 대화 지원 범위로 설명하고 의료적 진단·치료 효과를 주장하지 않는다.
- 참가자 사진·후기·개인 작업은 각각 공개 동의를 확인하며 민감한 내용은 익명화한다.

## 10. 롤백

NAL은 경로가 격리돼 있어 데이터베이스 마이그레이션이나 외부 결제 취소 작업 없이 Git으로 되돌릴 수 있다.

1. 배포 직전 또는 배포 커밋을 확인한다.
2. NAL 변경 커밋을 `git revert`로 되돌린다. 다른 프로젝트의 변경이 같은 커밋에 섞였다면 `/nal/`, `scripts/generate-nal-pages.mjs`, `scripts/generate-nal-sitemap.mjs`, `scripts/check-nal-platform.mjs`와 NAL 문서만 선택적으로 복원한다.
3. 기존 `/programs/art-psychology-coaching/` 원문과 다른 DAILYCOACHING 페이지는 삭제하지 않는다.
4. 이전 기준으로 `sitemap.xml`과 `robots.txt`를 다시 생성하거나 이전 파일을 복원한다. 현재 브랜치는 루트 `pages.json`과 루트 메뉴를 수정하지 않는다.
5. 배포 후 `/nal/` 제거 여부, 기존 루트 페이지, 콘솔과 404를 확인한다.

`git reset --hard`처럼 작업 트리 전체를 덮는 방식은 사용하지 않는다. 운영 데이터 변경 전에는 JSON과 공개 상세 파일을 같은 커밋으로 묶어야 한 단계 롤백이 가능하다.

## 11. 알려진 유지보수 지점

- `published`와 생성기의 `publicSlugs`가 이중 관리된다. 다음 버전에서는 생성기가 JSON의 `published`를 단일 원천으로 읽도록 합치는 것이 안전하다.
- 콘텐츠 상세 한 건은 생성기에 개별 등록돼 있다. 콘텐츠도 데이터의 `published`와 slug에서 자동 생성하도록 일반화해야 한다.
- 개별 이미지 alt를 데이터에 저장하는 필드가 아직 없다. 이미지 교체 전 `coverImageAlt`와 gallery 항목별 `src`·`alt` 구조 확장을 검토한다.
- 상품 후보의 `deliveryType`은 현재 `null`이며 QA는 비공개 초안의 `null`을 허용한다. 공개 전 실제 판매 형태를 입력해야 한다.
- 실시간 좌석 원천이 없으므로 `remainingSeats`는 운영자가 확인해 갱신하는 값이다. 자동 동기화 전에는 오래된 숫자가 노출되지 않도록 `null` 유지 원칙이 필요하다.
- `routes.json`은 생성 파일이다. 직접 편집하지 않고 페이지 생성기를 실행해 갱신한다.
- 사이트맵의 `lastmod`는 생성 시점이다. 콘텐츠의 실제 `updatedAt`을 사용하는 방식으로 확장할 수 있다.
