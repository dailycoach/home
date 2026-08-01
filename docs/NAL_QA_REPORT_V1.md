# NAL 커뮤니티 플랫폼 v1.0 완료·QA 보고서

검수일: 2026-08-01

작업 브랜치: `agent/nal-community-platform-v1`

NAL 기준 경로: `/nal/`

## 작업 완료 범위

기존 DAILYCOACHING 정적 사이트를 교체하지 않고 `/nal/`에 NAL 전용 정보 구조, 디자인 시스템, 데이터 계층, 19개 물리 라우트와 브라우저 런타임을 구축했다.

- NAL GATHER, NAL CLASS, NAL SHOP 중심 홈 10개 전환 섹션
- 모임·클래스·스토어·콘텐츠·진행자 목록
- 공개 프로그램·진행자·콘텐츠 상세
- URL 쿼리 기반 검색·카테고리·상태 필터와 정렬
- 현재 기기에만 저장되는 찜과 최근 본 항목
- 검색, 공지, FAQ, 입점·제휴, 정책 준비 상태
- 페이지별 SEO 메타데이터, canonical, Open Graph, JSON-LD, sitemap, robots
- JavaScript 미실행 시에도 읽을 수 있는 정적 폴백
- 모바일 드로어, 모바일 프로그램·구매 고정 CTA 기반
- 확인되지 않은 일정·가격·정원·좌석·후기·상품을 공개하지 않는 발행 조건

## 작업 전 실제 소스 조사

| 항목 | 확인 결과 |
|---|---|
| 저장소 | `dailycoach/home` |
| 기준 브랜치·HEAD | `main`, `27050da` |
| 배포 구조 | `CNAME`을 사용하는 정적 GitHub Pages |
| 기존 배포 주소 | `https://daily-coach-ing.com/` |
| 빌드 명령 | 기존 사이트는 별도 패키지·빌드 없음 |
| 실제 루트 진입 | `/index.html`이 `/index-source-disc.html`을 읽고 문자열 치환 후 출력 |
| 기존 라우팅 | 디렉터리별 물리 `index.html`을 사용하는 다중 페이지 구조 |
| 기존 공통 UI | 루트 메뉴·푸터가 로더와 원본 HTML에 분산되어 중복 관리됨 |
| 기존 데이터 | `pages.json`과 페이지 내부 하드코딩이 혼재 |
| 기존 스타일 | 페이지별 CSS 중심이며 NAL에 재사용 가능한 단일 디자인 시스템 없음 |
| 이미지·폰트 | 로컬 프로그램 이미지와 Gowun Batang 웹폰트 1종 확인 |
| 회원·예약·결제 | 자체 회원, 예약, 장바구니, 주문·결제 시스템 없음 |
| 외부 연결 | 스마트스토어 홈, 기존 프로그램 원문, 실제 문의 메일 경로 확인 |
| 주의사항 | 루트 수정 시 문자열 치환 로더와 GitHub Actions 워크플로 충돌 위험이 있어 NAL을 `/nal/`로 격리 |

## 실제 배포 주소

- 운영 주소: `https://daily-coach-ing.com/nal/`
- 배포 PR: `https://github.com/dailycoach/home/pull/91`
- 운영 반영 커밋: `4a378f938bcaae918d95ee480518dca45bf996b5`
- GitHub Pages에서 19개 물리 라우트의 HTTP 200과 홈·CSS·JavaScript·사이트 데이터·OG 이미지의 배포 소스 해시 일치를 확인했다.

## 전체 페이지·라우트

| 영역 | 라우트 | 검색 정책 |
|---|---|---|
| 홈 | `/nal/` | index |
| 모임 | `/nal/gather/` | index |
| 클래스 | `/nal/class/` | index |
| 클래스 상세 | `/nal/class/art-psychology-coaching-6week/` | index |
| 스토어 | `/nal/shop/` | index |
| 콘텐츠 | `/nal/note/` | index |
| 콘텐츠 상세 | `/nal/note/art-psychology-coaching-guide/` | index |
| 진행자 | `/nal/host/` | index |
| 진행자 상세 | `/nal/host/park-jia/`, `/nal/host/kim-cheol-woong/` | index |
| 로컬 MY | `/nal/my/` | noindex |
| 검색 | `/nal/search/` | noindex |
| 운영 | `/nal/notice/`, `/nal/faq/`, `/nal/partnership/` | index |
| 정책 준비 상태 | `/nal/policy/terms/`, `/nal/policy/privacy/`, `/nal/policy/cancellation/`, `/nal/policy/shipping/` | noindex |

총 19개 물리 라우트이며 13개는 sitemap에 포함하고 6개는 `noindex,follow`로 관리한다.

## 주요 구현 내용

### 데이터와 발행 규칙

| 컬렉션 | 전체 | 공개 | 상태 |
|---|---:|---:|---|
| 프로그램 | 9 | 1 | 미술심리코칭 6주 과정만 `comingSoon`; 후보 8건은 `draft` |
| 상품 | 8 | 0 | 가격·재고·배송·구매 URL 미확정으로 모두 비공개 |
| 진행자 | 2 | 2 | 기존 사이트에서 확인한 최소 정보만 공개 |
| 콘텐츠 | 1 | 1 | 기존 미술심리코칭 참여 안내 원문과 연결 |

초안 프로그램의 날짜, 시간, 가격, 정원, 잔여석, 신청 URL은 모두 `null`이다. 공개 상품이 없으므로 개별 상품 상세 URL이나 가짜 구매 흐름도 만들지 않았다.

세부 스키마와 관계 구조는 `docs/NAL_PLATFORM_ARCHITECTURE_V1.md`에 기록했다.

### 디자인 토큰

| 역할 | 토큰 | 값 |
|---|---|---|
| 기본 배경 | Warm Ivory | `#F5F1E8` |
| 기본 텍스트 | Deep Charcoal | `#202126` |
| 브랜드·CTA | Electric Cobalt | `#4055D8` |
| 커뮤니티 | Soft Lilac | `#C8B8EE` |
| 원데이 | Coral Pink | `#EF9CA8` |
| 스토어 강조 | Acid Lime | `#D7F35A` |
| 보조 배경 | Mist Gray | `#DDDCD6` |
| 흰 표면 | Clean White | `#FFFFFF` |
| 최소 본문 | 16px | CSS 토큰 적용 |
| 최소 터치 영역 | 44px | CSS 토큰 적용 |

타이포그래피는 Pretendard·SUIT·Noto Sans KR·Apple SD Gothic Neo·Malgun Gothic 계열의 로컬·시스템 폰트를 우선한다. 해당 글꼴이 전혀 없는 환경에서는 저장소에 이미 포함된 오픈 라이선스 Gowun Batang을 한글 글리프 폴백으로만 사용한다. 외부 폰트 요청은 없다.

## 신청 기능 연결 상태

- 현재 공개 프로그램은 `comingSoon`이고 실제 신청 URL이 없어 신청 완료 기능을 제공하지 않는다.
- 상세 CTA는 기존 과정 원문으로 연결하며 문구는 `과정 자세히 보기`다.
- `open`, `closing`, `waiting` 상태와 실제 `applicationUrl`이 함께 있을 때만 신청 또는 대기 신청 CTA가 활성화된다.
- `closed`, `completed`, `comingSoon`에는 URL이 남아 있어도 신청 CTA를 활성화하지 않는다.
- 자체 예약, 신청 폼 제출, 신청 내역 저장은 미구현이다.

## 구매 기능 연결 상태

- 스마트스토어 홈 `https://smartstore.naver.com/nalbitcoaching`만 별도 창으로 연결한다.
- 개별 상품의 실제 구성·가격·재고·배송 방식·구매 URL이 없으므로 공개 상품과 구매 버튼은 0건이다.
- 상품 런타임은 구매 가능 재고 상태와 유효한 `purchaseUrl`이 함께 있을 때만 외부 구매 CTA를 만든다.
- 자체 장바구니, 주문, 결제, 결제 성공·실패 화면은 만들지 않았다.

## 수정·추가한 파일

- `nal/`: 19개 페이지, 데이터 6개, 공통 CSS·JavaScript, NAL 심볼·OG 이미지·촬영 가이드
- `scripts/generate-nal-pages.mjs`: 물리 페이지·정적 폴백·라우트 데이터 생성
- `scripts/generate-nal-sitemap.mjs`: 기존 페이지와 NAL 공개 페이지의 sitemap 생성
- `scripts/check-nal-platform.mjs`: 스키마·관계·발행·브랜드·메타데이터·안전 규칙 검증
- `scripts/nal-browser-qa.mjs`: 19개 라우트·6개 화면폭·상호작용·접근성·무 JavaScript 폴백 검증과 캡처
- `robots.txt`, `sitemap.xml`: 검색 엔진 제어와 공개 URL 등록
- `docs/NAL_PLATFORM_ARCHITECTURE_V1.md`: 구조·운영·발행·롤백 문서
- `docs/NAL_QA_REPORT_V1.md`, `docs/nal-qa/`: QA 결과와 화면 캡처

기존 루트 페이지, 프로그램 원문, 테스트·카드·LCMS 페이지는 수정하지 않았다.

## 모바일 검수 결과

| 폭 | 홈 가로 넘침 | 본문 기본 크기 | 콘솔·네트워크 | 결과 |
|---:|---|---|---|---|
| 360px | 없음 | 16px | 오류 없음 | 통과 |
| 390px | 없음 | 16px | 오류 없음 | 통과 |
| 412px | 없음 | 16px | 오류 없음 | 통과 |
| 768px | 없음 | 16px | 오류 없음 | 통과 |
| 1280px | 없음 | 16px | 오류 없음 | 통과 |
| 1440px | 없음 | 16px | 오류 없음 | 통과 |

모바일 드로어 열기·Escape 종료·트리거 포커스 복귀, 클래스 필터의 URL 상태, 로컬 찜의 MY NAL 반영, 공개 데이터 검색을 실제 Chromium에서 확인했다.

## 접근성 검수 결과

- 홈 390px, 클래스 목록 390px, 클래스 상세 1440px, FAQ 390px에서 WCAG 2 A·AA 및 2.1 A·AA 자동 검사를 실행했다.
- 위 4개 검사에서 위반 0건이었다.
- 스킵 링크, 제목 구조, `lang="ko"`, 고유 main, 상태 텍스트, 이미지 alt, 포커스 표시, 모션 축소, 44px 터치 영역을 정적 검사했다.
- 모바일 드로어의 `aria-modal`, 배경 `inert`, Tab 포커스 순환, Escape와 포커스 복귀를 구현했다.

자동 검사는 실제 보조기기 사용성 전체를 보장하지 않으므로 운영 콘텐츠 입력 후 키보드·화면낭독기 수동 검수를 다시 수행해야 한다.

## SEO 검수 결과

- 19개 페이지별 title, description, canonical, Open Graph, JSON-LD 확인
- 공통 1200×630 PNG 공유 이미지 확인
- canonical 중복 0건
- index 페이지 13개 sitemap 포함, noindex 페이지 6개 sitemap 제외
- 미공개 프로그램·상품 상세 URL 미생성 확인
- `robots.txt`의 sitemap 주소 확인
- JavaScript를 끈 상태에서 홈, 클래스 목록, 클래스 상세 핵심 콘텐츠 출력 확인

## 콘솔·네트워크 오류

- 로컬 HTTP 환경에서 19개 물리 라우트 모두 HTTP 200
- 내부 4xx·5xx, 요청 실패, 이미지 실패, JavaScript 예외, 콘솔 오류 0건
- 외부 워드프레스 프로필 이미지 의존은 제거하고 촬영 전 플레이스홀더로 처리
- 공개 화면에 임의의 외부 이미지 요청 없음
- 운영 GitHub Pages의 19개 라우트도 모두 HTTP 200
- 운영 서버의 핵심 HTML·CSS·JavaScript·JSON·PNG 해시가 병합 소스와 일치
- 운영 URL의 원격 Chromium 검수는 실행 환경의 외부 브라우저 네트워크 제한으로 수행하지 못했으며, 동일 소스를 로컬 HTTP Chromium에서 검수하고 운영 서버는 경로·해시로 교차 확인했다.

## 화면 캡처

| 화면 | 캡처 |
|---|---|
| 모바일 홈 390px | `docs/nal-qa/home-390.png` |
| 데스크톱 홈 1440px | `docs/nal-qa/home-1440.png` |
| 모바일 클래스 상세 390px | `docs/nal-qa/class-detail-390.png` |
| 데스크톱 클래스 상세 1440px | `docs/nal-qa/class-detail-1440.png` |

자동 검사 원본은 `docs/nal-qa/browser-results.json`이다.

## 미구현 또는 임시 처리 항목

- 회원가입·로그인·서버 동기화 MY NAL
- 자체 예약·신청 폼·신청 내역
- 자체 장바구니·결제·구매 내역
- 뉴스레터 구독 저장·발송
- 다음 일정 알림
- 실제 후기 등록·동의·익명화 흐름
- 실시간 좌석·재고 동기화
- 개별 스마트스토어 상품 연동
- 디지털 다운로드 권한과 이력
- 진행자 팔로우
- 지역·날짜·가격·진행자·방식 전체 필터와 모바일 바텀시트
- 법적 정보와 실제 정책 본문
- 루트 DAILYCOACHING 메뉴에서 `/nal/`로 들어오는 링크

## 운영자가 입력해야 할 정보

- 실제 모임·클래스의 날짜, 시간, 장소, 참가비, 정원, 좌석, 모집 상태와 신청 URL
- 상품별 실제 명칭, 촬영 이미지 권리, 구성, 수량, 가격, 재고, 배송 유형, 개별 구매 URL과 정책
- 진행자 본인 확인 정보, 사진 공개 동의, 경력·자격·지역·SNS
- 콘텐츠 최종 본문, 저자, 발행일, 이미지 권리와 관련 프로그램·상품
- 후기 원문, 연결 대상, 익명화 방식과 명시적 공개 동의
- 운영자명, 대표자, 사업자번호, 주소, 문의 채널과 정식 약관·개인정보·환불·배송 기준
- `hello@daily-coach-ing.com`의 실제 수신 가능 여부
- `/nal/`을 루트 메뉴 또는 외부 홍보에서 노출할 시점

## 재현 명령

```bash
node scripts/generate-nal-pages.mjs
node scripts/generate-nal-sitemap.mjs
node scripts/check-nal-platform.mjs
node --check nal/assets/js/app.js
git diff --check
```

브라우저 QA는 외부 개발 의존성인 Playwright와 axe-core 경로를 환경 변수로 전달해 `node scripts/nal-browser-qa.mjs`로 실행한다. 실행 결과는 `docs/nal-qa/browser-results.json`에 기록된다.

## 롤백 방법

NAL은 `/nal/`로 격리했다. 배포 커밋을 `git revert`하면 NAL 페이지·데이터·스크립트와 sitemap 변경만 되돌릴 수 있으며 기존 `/programs/art-psychology-coaching/`과 다른 DAILYCOACHING 페이지는 유지된다. 작업 트리 전체를 덮는 `git reset --hard`는 사용하지 않는다.

## 다음 작업 우선순위

1. 실제 모집 일정·신청 URL 1건과 실제 판매 상품 1건을 운영 검수 후 공개
2. 정식 법적·운영 정보와 취소·환불·배송 정책 입력
3. 루트 메뉴 또는 외부 캠페인에서 `/nal/` 진입 경로 연결
4. 뉴스레터 또는 다음 일정 알림 중 실제 운영 가능한 채널 1개 연결
5. 회원·결제보다 먼저 프로그램·상품 운영 데이터 갱신 절차와 담당자 확정
6. 실제 촬영 이미지와 참여 동의가 확인된 후기 적용
