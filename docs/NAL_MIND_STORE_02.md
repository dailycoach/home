# NAL-MIND-STORE-02 · PDF ebook commerce foundation

PR #155를 이어서 확장한다. `/nal/shop/`, 기존 Supabase 공개 카탈로그, 실물 카드 4종, 로컬 찜·최근 본 항목과 사용자 테마를 유지한다. 이번 PR은 배포하거나 운영 DB에 적용하지 않았다.

## 구현 범위

- 짧은 스토어 소개, 형태·주제·대상 필터, 추천·최신·가격 정렬. 기본 추천은 디지털 자료 우선이다.
- PDF 표지는 3:4, 원본을 자르지 않는 `contain`. 작은 화면은 2열, 336px 이하에서는 1열이다.
- 상품 상세에 저자·파일·분량·용량·이용권·인쇄 여부, 목차·활용, 공개 미리보기, 다운로드·이용 안내를 표시한다. 없는 값과 섹션은 숨긴다.
- 확정 가격·판매 상태·상품별 URL이 있을 때 외부 `구매하기`. 나머지는 스마트스토어 안내 또는 구매 불가 이유를 표시한다. 자체 장바구니·결제·다운로드 버튼은 만들지 않았다.
- 검색은 제목·부제·저자·설명·주제·태그·대상·목차를 포함한다.
- MY NAL `#purchased-materials` 슬롯은 연결 준비 상태다. 외부 주문을 NAL 구매자료로 표시하지 않는다.

## 상품 모델과 반복 등록

표준은 `nal/data/product.schema.json`, 초안 템플릿은 `nal/data/pdf-ebook-product-template.json`이다. 미정 값은 `null`, 미정 목록은 빈 배열로 둔다. 템플릿에서 `published=false`, `stockStatus=comingSoon`, `policyStatus=draft`로 시작한다.

| 구분 | 값 |
| --- | --- |
| 상품 | pdfEbook / pdfWorkbook / pdfWorksheet / digitalGuide / physicalCard / physicalBook / kit |
| 제공 | digital / physical |
| 형식 | PDF / ZIP / PPTX / DOCX / XLSX |
| 이용권 | personal-use / facilitator-use / organization-use |
| 공개 가격 | 원 단위 정수 또는 null |
| 여러 이용권 | licenseOptions 배열: id, licenseType, price, printingAllowed, downloadLimit, accessPeriod, purchaseUrl, 선택 label |

공개 상품은 id·slug·제목·소개·설명·표지·alt가 필요하다. 디지털 상품을 `available`로 전환하려면 확정 가격, 개별 구매 URL, 저자, 페이지, 용량, 목차, 제공 방식, 이용권, 인쇄 여부, 환불 기준과 `policyStatus=reviewed`가 필요하다. 페이지 수를 알 수 없는 초안은 판매 준비 상태로 공개할 수 있다. 미리보기는 선택 항목이다.

첫 PDF의 최소 입력(title, slug, author, coverImage, summary, description, price, fileFormat, pageCount, fileSizeMB, tableOfContents, sampleUrl, purchaseUrl, deliveryMethod, licenseType, printingAllowed, refundPolicy)만으로도 `publish-ready`가 완성된 공개 payload를 만든다. id는 slug에서, alt는 제목에서 보완한다. 이 명령은 실제 판매·전달·정책을 검토한 운영자가 선택하는 공개 단계이며, published/available/reviewed 상태만 설정한다. 금액·페이지·PDF·이용조건을 만들어 넣지 않는다.

운영 입력 순서:

1. 템플릿을 복사해 실제 상품 정보만 입력한다. `deliveryMethod`의 표준 값은 `digital-download` 또는 `email`이다.
2. 아래 검증 명령으로 공개 정보·이용권 옵션·URL을 확인한다. 알 수 없는 필드, private bucket URL, 서명 토큰 URL은 거부한다.
3. 현재 backend가 켜져 있으므로 승인된 운영자가 `catalog-payload` 결과를 Supabase `nal_catalog`에 제품 행으로 등록한다. 동일 kind/id는 기존 행을 수정한다. 원본 파일은 여기에 넣지 않는다. 이 CLI는 DB를 쓰거나 서비스 키를 요구하지 않는다.
4. 새 Supabase 상품은 공통 상세 `/nal/shop/item/?slug=...`에서 즉시 연결된다. 기존 생성된 `/nal/shop/{slug}/` URL은 그대로 유지한다. 공통 상세는 `noindex`이며 공개 상품만 조회한다.
5. 정식 SEO 주소가 필요하면 공개 카탈로그를 JSON으로 동기화하고 페이지·사이트맵 생성기를 실행한 뒤 일반 PR 배포 절차를 따른다. 새 상세 페이지를 손으로 작성할 필요가 없다. 비공개 전환된 기존 생성 상품 페이지도 제거한다.

```bash
# 임시 검증 의존성. repo에 node_modules나 비밀키를 추가하지 않는다.
npm install --prefix /tmp/nal-mind-test --save-exact ajv@8.17.1
export NAL_AJV_MODULE=/tmp/nal-mind-test/node_modules/ajv/dist/ajv.js
node scripts/nal-product.mjs validate product.json
node scripts/nal-product.mjs catalog-payload product.json
# 실제 판매·전달·정책 검토를 마친 최소 정보 입력의 공개 payload:
node scripts/nal-product.mjs publish-ready product.json
# JSON 기반 로컬 카탈로그 등록 경로:
node scripts/nal-product.mjs import product.json
# 운영 공개 카탈로그를 SEO 빌드 입력으로 반영하는 경로:
node scripts/sync-nal-product-catalog.mjs
node scripts/generate-nal-pages.mjs
node scripts/generate-nal-sitemap.mjs
```

`import`는 로컬 JSON만 바꾼다. backend가 켜져 있을 때 운영 스토어를 바꾸는 명령이 아니다. `sync`는 공개 publishable key로 읽고, 로컬 초안은 유지하며 서버에서 비공개가 된 상품의 공개 상태를 해제한다. 운영자가 가격·이용권·환불 정책과 미리보기 파일을 확인한 후 공개한다.

향후 Admin은 이 모델로 새 상품 → 표지·원본·샘플 업로드 → 메타데이터 검증 → 이용권·가격·정책 확인 → 공개 흐름을 사용할 수 있다. Admin UI는 이번 범위에서 구현하지 않았다.

## Supabase migration · 적용 전 초안

`20261003124325_nal_digital_store_foundation.sql`을 준비했다. 기존 `nal_catalog`, `nal_orders`, `nal_order_items`, `nal_payments`를 재사용한다.

| 대상 | 역할 / 접근 |
| --- | --- |
| nal_products | nal_catalog 제품의 security_invoker view. 기존 공개 RLS 유지 |
| nal_public_product_body | 공개 필드와 이용권 하위 필드 allowlist. direct catalog CHECK도 미등록·비공개 필드 거부 |
| nal_private.product_files | product_id, bucket_id, object_path, version, download_name, active. 서버 전용 |
| nal_digital_entitlements | 사용자·상품·주문·주문항목·파일버전·이용권·인쇄·횟수·만료·취소. 본인 SELECT만 |
| nal_download_events | pending / issued / failed 발급 이벤트. 본인 SELECT만 |
| nal_begin_download / nal_finish_download | service_role만 실행. 클라이언트가 사용자·경로·횟수를 바꿀 수 없음 |

공개 payload에는 구매자 정보, 원본 경로, 원본 URL, 결제 식별자, 다운로드 토큰을 넣지 않는다. 기존 public catalog 제품의 알려진 공개 필드만 허용한다. 기존 DB에 새 필드가 있는 경우 실제 migration 적용 전에 allowlist와 충돌 여부를 확인한다.

이용권 생성은 결제 검증 서비스가 수행해야 한다. 트리거는 사용자·paid 주문·상품 주문항목·활성 파일 매핑·동일 금액의 paid 결제기록을 확인한다. 결제 기록의 진실성은 별도 검증된 provider webhook이 책임진다. 이 PR에는 주문 생성·결제·웹훅·자동 이용권 발급이 없다.

상품 메타데이터의 `downloadLimit=null`은 미정이다. 실제 이용권의 `download_limit=null`은 운영자가 명시적으로 허용한 무제한을 의미한다. 미정 값을 그대로 자동 발급하지 않는다. 이용권의 `expires_at=null`도 명시적인 기간 제한 없음에만 쓴다. 재구매·옵션별 가격·라이선스 snapshot 정책은 결제 연결 단계에서 확정한다.

## 비공개 PDF와 다운로드

- 원본: private `nal-products-private/{product-id}/{version}/original.pdf`. 준비한 bucket은 PDF MIME만, 최대 100 MiB를 허용한다. 기존 public bucket과 충돌하면 migration은 실패한다.
- 표지와 공개 샘플은 기존 공개 이미지 또는 별도 공개 샘플 영역을 사용한다. 원본 bucket을 공개하지 않는다. 샘플 signed URL이 필요한 경우 별도 샘플 발급 기능을 만든다. 임시 signed URL을 상품 JSON에 저장하지 않는다.
- 유료 PDF를 GitHub에 커밋하지 않는다. 원본 업로드는 Storage API/대시보드로, Storage SQL metadata를 직접 삽입해 업로드를 대신하지 않는다.
- Edge Function `nal-digital-download`는 기본 비활성. `NAL_DIGITAL_DELIVERY_ENABLED=true`는 실제 Auth·결제·파일·이용권 연결 검증 후 설정한다.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 함수의 서버 환경에만 사용한다. 서버 키를 public backend.json에 넣지 않는다. 허용 Origin은 `NAL_ALLOWED_ORIGINS`, 기본 실제 NAL 도메인이다.
- 요청은 `POST {entitlementId, requestId}`와 사용자 Bearer 세션뿐이다. `/auth/v1/user`로 세션을 검증하고 이메일 확인 사용자만 통과시킨다. 익명 사용자는 거절한다.
- 서버가 본인 이용권·유효기간·취소·paid 주문·활성 파일·실제 Storage object를 확인하고 횟수를 예약한다. 행 잠금은 주문 → 이용권 순서다. 클라이언트는 경로를 전달하지 않는다.
- 서명 링크의 유효기간은 최대 600초이며 이용권 만료를 넘지 않는다. 발급 완료에도 취소·환불·파일 상태를 다시 확인한다. 응답은 `downloadUrl`, `expiresAt`뿐이며 `Cache-Control:no-store`다.
- 같은 requestId의 2분 내 재시도는 한 번으로 계산한다. 신규 ID는 한도를 적용한다. 서명 실패는 예약 횟수를 복구하며, 미완료 예약은 2분 후 다음 신규 요청에서 복구한다. 이전 issued 이벤트를 유지한다.
- 횟수와 이벤트는 **링크 발급 횟수**다. 실제 PDF 저장 완료나 동일 링크의 반복 GET 횟수를 확정하는 측정이 아니다.
- signed URL은 유효기간 중 전달 가능한 bearer 링크다. 이미 받은 PDF와 이미 발급한 링크는 즉시 회수할 수 없다. 취소·환불은 신규 발급을 막으며, 기존 링크는 최대 10분까지 남는다. DRM이나 공유 방지 보장은 하지 않는다.
- 함수의 실제 Auth/JWT gateway 설정, Storage REST 요청, Edge 배포와 통합 테스트는 운영 활성화 전에 검증한다. 함수·bucket·migration을 운영에 적용하지 않았다.

참고한 공식 자료: [private bucket](https://supabase.com/docs/guides/storage/buckets/fundamentals), [downloads](https://supabase.com/docs/guides/storage/serving/downloads), [Storage signing implementation](https://github.com/supabase/storage-js/blob/main/src/packages/StorageFileApi.ts).

## 디지털 정책 · DRAFT / 운영 확정 필요

상품별 개인·진행자·기관 이용범위, 인쇄 허용, 전달 수단, 횟수·기간, 파일 공유·재배포 제한, 환불 조건과 문의 채널을 판매 전에 확정한다. 정책 검토가 끝난 상품만 `policyStatus=reviewed`로 전환한다. 실제 환불 가능 여부와 강한 법적 문구를 만들어 넣지 않는다.

기존 스마트스토어 연결은 유지한다. PDF 상품의 네이버 판매 가능 방식과 구매 후 전달은 실제 채널 운영정책을 확인한 뒤 결정한다. 개별 디지털 상품 판매가 가능하다고 보장하지 않는다. 외부 판매채널 주문을 NAL 사용자와 연결하려면 검증된 주문 연동·이메일 확인 절차가 별도로 필요하다.

## 검증 기록과 남은 항목

| 게이트 | 결과 | 근거 |
| --- | --- | --- |
| G0 DATA | PASS | Ajv 상품·템플릿 검증, canonical enum, 미공개 route 제외, private 필드 거부 |
| G1 STOREFRONT | PASS | 형태·주제·대상 필터, 디지털 우선, 가격 정렬, 표지 contain 3:4 규칙, 누락값 처리 |
| G2 DETAIL | PASS | 합성 PDF DOM 검증: 저자·형식·쪽수·목차·미리보기·이용권·구매 CTA, 누락·품절·초안 |
| G3 DELIVERY ARCHITECTURE | PASS | local PostgreSQL/RLS 및 HTTP handler 검증. 운영 연결을 뜻하지 않음 |
| G4 QA | FAIL | 구문·정적 SEO·검색·테마·DOM·RLS·기존 API 회귀 통과. 실제 responsive/200% 확대 시각 QA 미완료 |

검증에서 사용한 가격·페이지·파일·주문·사용자는 합성 fixture다. 공개 상품 데이터에 넣지 않았다. 공개 디지털 상품·원본 PDF·샘플·실결제는 아직 없다.

- generator: 32페이지, sitemap 77 URL (기존 NAL 외 URL 유지). 비공개 상품 route 없음. 공통 상품 route는 noindex.
- 플랫폼 정적 검사 PASS, theme 검사 PASS, 실제 public RPC: programs 9 / products 4 / hosts 2 / content 1.
- 상품 schema/helper PASS, 최소 입력·공개/비공개 workflow 9 checks PASS. DOM 26 checks, 다운로드 HTTP 26 checks, PGlite SQL/RLS 90 checks PASS.
- DOM 검사는 실제 레이아웃 엔진이 아니다. 320 / 390 / 768 / 1024 / 1440, 다크 화면, 200% 글자 확대, 표지 잘림, 키보드 focus 및 하단 safe area의 실제 브라우저 검증은 PR 미리보기 환경에서 수행해야 한다.
- Supabase CLI는 외부 PostHog telemetry 메타데이터 공개를 확인할 수 없어 자동 승인 검토에 차단되었다. 이후 CLI 실행을 중단했고 기존에 생성된 migration 초안을 로컬 SQL로 작성·검증했다. 운영 적용이나 CLI 배포를 하지 않았다.

```bash
npm install --prefix /tmp/nal-mind-test --save-exact @electric-sql/pglite@0.5.8 ajv@8.17.1 happy-dom@20.14.5
export NAL_AJV_MODULE=/tmp/nal-mind-test/node_modules/ajv/dist/ajv.js
export NAL_PGLITE_MODULE=/tmp/nal-mind-test/node_modules/@electric-sql/pglite/dist/index.js
export NAL_DOM_MODULE=/tmp/nal-mind-test/node_modules/happy-dom/lib/index.js
node scripts/check-nal-store.mjs
node scripts/test-nal-product-workflow.mjs
node scripts/test-nal-store-dom.mjs
node scripts/test-nal-digital-download.mjs
node scripts/test-nal-supabase.mjs
node scripts/check-nal-platform.mjs
node scripts/check-nal-theme.mjs
node scripts/check-nal-backend.mjs
```

Production: UNCHANGED. PR 병합·배포·DB migration 적용은 별도 단계다.
