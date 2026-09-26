# LMC NAVER 배포·운영 매뉴얼

## 현재 release 상태

C0 조사 및 C1–C7의 코드/mock 통합 검증 완료. **운영 배포·자동화 활성화는 수행하지 않았다.** C8 실제 NAVER 연결, C9 실제 구매/메일/영상 canary, C10 운영 활성화는 EXTERNAL_AUTH_REQUIRED다. 실제 상품 매핑은 미확정이다. Google Form과 기존 CTA/트리거는 유지되어 있다.

## 신규 자원

* 별도 Worker `lmc-naver-integration-staging`와 SQLite-backed Durable Object class `NaverIntegration`, binding `INTEGRATION`, migration tag `v1`.
* 2분 Cron Trigger. R2 binding/bucket/기존 R2 Worker는 추가·수정하지 않는다.
* Cloudflare Access self-hosted application: 신규 Worker의 `/admin*`, 운영자 계정 allow policy. JWT issuer/audience도 Worker에서 재검증한다.
* Apps Script `네이버연동` ledger 시트와 `purgeNaverContactData` 일일 04시 트리거.
* 정적 `/lcms/register/` 페이지. 기존 GitHub Pages URL 규칙상 trailing slash/index.html을 사용한다.

staging과 production은 Worker 이름과 Durable Object namespace를 분리한다. staging에서 실제 학생 Sheet를 쓰지 말고 복제 테스트 Sheet와 별도 Apps Script 웹앱을 사용한다. production으로 전환할 때 staging token/cursor/학생을 복사하지 않는다.

## Secret 이름 (값 없음)

| 보관 위치 | 이름 | 용도 |
|---|---|---|
| 신규 Cloudflare Secret | NAVER_COMMERCE_CLIENT_ID | NAVER 애플리케이션 ID |
| 신규 Cloudflare Secret | NAVER_COMMERCE_CLIENT_SECRET | bcrypt salt 규격 secret |
| 신규 Cloudflare Secret | NAVER_COMMERCE_ACCOUNT_ID | SELLER 유형만 필요 |
| 신규 Cloudflare Secret | APPS_SCRIPT_ACCESS_URL | 신규 배포본의 HTTPS /exec |
| 신규 Cloudflare Secret | APPS_SCRIPT_SHARED_SECRET | Apps Script NAVER_SHARED_SECRET과 동일 |
| 신규 Cloudflare Secret | REGISTRATION_SECRET | IP/구매정보/등록 payload/admin ref HMAC |
| Apps Script Script Properties | NAVER_SHARED_SECRET | 독립 bridge HMAC key |

기존 CODE_PEPPER/SESSION_PEPPER/WORKER_SHARED_SECRET/SYNC_SECRET 및 기존 Worker ACCESS_API_URL/ACCESS_API_SECRET/PLAYBACK_SECRET은 교체하지 않는다. 실제 값을 .env/.dev.vars/README/fixture/Git/로그/채팅에 넣지 않는다. Wrangler의 대화형 Secret 입력 또는 Cloudflare Secret UI를 사용한다. `.gitignore`는 실수 방어이며 파일에 secret을 저장할 허가가 아니다.

## 로컬/CI 검증

Node 24 사용.

```sh
node scripts/check-lmc-academy.mjs
node lcms/academy/apps-script/test-access-validation.mjs
node scripts/test-lmc-progress-scope.mjs
node lcms/academy/r2-worker/scripts/preflight-segmented-videos.mjs --catalog-only
node --test lcms/academy/r2-worker/test/worker.test.js
cd lcms/academy/naver-worker
npm ci
npm test
npm run check
npm audit
```

GS 파일도 `node --check` stdin으로 구문 검사한다. `.github/workflows/check-lmc-naver.yml`이 mock/VM/workerd/legacy 검사를 실행한다. 여기에는 실주문·실메일 호출이 없다.

## C8 — 연결 및 읽기 검증

1. 운영 Apps Script 배포 버전과 Sheet 사본을 백업하고 C0 기준과 비교한다. 권한/헤더/열 위치가 다르면 자동 migration하지 않는다.
2. 테스트 Sheet의 Apps Script에 기존 파일과 `NaverIntegration.gs`를 반영하고 `setupNaverIntegration()`을 1회 실행한다. 기존 Form 설치 함수는 다시 실행할 필요가 없다. 이 함수는 신규 ledger/secret/retention trigger와 기본 OFF flag만 준비한다.
3. 웹앱을 테스트 환경에 새 버전으로 배포한다. URL과 HMAC secret은 Secret 저장소에만 연결한다. 기존 R2 secret과 혼용하지 않는다.
4. NAVER 커머스API센터에서 본인 스토어 애플리케이션/SELF인지 대행 SELLER인지 확인하고 주문 조회 권한과 허용 IP를 점검한다. **Cloudflare의 outbound IP가 계정의 허용 정책에 맞는지 아직 검증되지 않았다.** 허용되지 않으면 고정 egress 서버에서 NaverAdapter를 실행하는 transport를 먼저 배치한다. 무제한 IP 허용으로 우회하지 않는다. 해당 transport는 현재 배포의 일부가 아니며 운영 환경 선택 후 구현/검증해야 한다. 검증 전 NAVER_EGRESS_VERIFIED=false 유지.
5. 신규 Worker Secret을 입력한다. config에는 실제 secret을 쓰지 않는다. ACCESS_TEAM_DOMAIN/ACCESS_AUD, REGISTRATION_ORIGIN을 설정하고 Access 정책으로 운영자만 허용한다.
6. feature flags는 NAVER_SYNC_ENABLED=false, NAVER_AUTO_PROVISION_ENABLED=false, NAVER_AUTO_SUSPEND_ENABLED=false, DRY_RUN=true 유지. 배포 직후 무인증 `/admin` 및 `/admin/api/orders`가 차단되는지 확인한다.
7. 승인된 비밀관리 환경에서 sample productOrderId를 NAVER_SAMPLE_PRODUCT_ORDER_ID로 주입하고 `node scripts/inspect-mapping.mjs`를 실행한다. 이는 토큰/주문 상세 **읽기만** 수행하며 상품 식별자·수량·상태·canary hash만 출력한다. 이름/이메일/전화/주소/주문번호는 출력하지 않는다.
8. `13702661269`와 응답의 productId/originalProductId/sellerProductCode 중 실제 대응을 사람이 확정한다. 확인된 field/value/courseId만 PRODUCT_MAPPINGS에 넣고 PRODUCT_MAPPING_VERIFIED=true로 설정한다. 코드가 이 번호를 추측하여 매핑하지 않는다.
9. 실제 단일 구매 수량, 전화번호 제공/마스킹, 현재 claim 구조를 확인한다. quantity>1/선물/마스킹은 자동 발급되지 않으며 기존 Form을 통해 운영자가 확인한다.
10. SYNC_START_AT을 명시한다. NAVER_SYNC_ENABLED=true, DRY_RUN=true로 읽기 동기화를 켠다. 변경 cursor/페이지/상품 식별/취소 상태를 관리자 화면에서 확인한다. 이 단계는 학생 생성/메일/정지를 수행하지 않는다.
11. 수강등록 개인정보 안내 기본값(수강 종료+30일)과 실제 사업자 처리방침/Google·Cloudflare 위탁·국외 처리 고지가 일치하는지 운영 담당자가 확인한다. 화면 안내는 수집·이용 동의이며 전체 사업자 개인정보처리방침을 대체한다고 주장하지 않는다. 확인 후 PRIVACY_POLICY_VERIFIED=true. 이 단계에서 외부 전문가의 법률 검토가 수행됐다고 기록하지 않는다.

## C9 — 단건 canary

1. 정상 테스트 구매 한 건을 준비한다. REGISTRATION_MODE=canary, CANARY_ORDER_HASHES에는 inspect-mapping 결과의 **그 한 건 hash만** 넣는다. 빈 목록이면 등록은 모두 차단된다.
2. 해당 환경의 Apps Script flags NAVER_DRY_RUN=false, NAVER_AUTO_PROVISION_ENABLED=true, NAVER_AUTO_SUSPEND_ENABLED=true. Worker도 같은 효과의 flags로 설정한다. 등록은 자동 정지가 OFF이면 열리지 않는다.
3. 테스트용 정적 페이지의 config.js apiBase에 신규 Worker 공개 origin만 연결한다. 운영 main을 테스트 서버로 쓰지 않는다.
4. PAYED detection → verify → 수강생 정보/필수 동의 → 수강생 1행 → 입장코드 → 실제 메일 도착 → 기존 로그인 → 신규 R2 authorize → 영상 시작/seek를 확인한다. 브라우저/서버 로그에 입장코드/토큰을 기록하지 않는다.
5. 동일 주문 재조회/등록 재요청 후 새 학생·메일·코드가 생기지 않는지 확인한다.
6. 해당 테스트 주문의 취소/반품 완료 상태를 만들어 sync에서 감지하고 Sheet 정지, code hash 삭제, 세션 종료, 새 로그인 거절, 새 `/authorize` 거절을 확인한다. 이미 발급된 `/media` URL의 최대 4시간 유효성은 기존 계약의 한계다.
7. 구매 후 안내 메시지/등록 화면/메일/로그인/영상/취소를 실제 브라우저와 휴대전화에서 확인하고 결과를 운영 기록에 남긴다. 하나라도 실패하면 REGISTRATION_MODE=production으로 전환하지 않는다.

## C10 — 운영 전환

승인된 production Worker/namespace/Apps Script URL/Secret으로 같은 검증을 반복한다. 테스트/운영 secrets와 데이터가 섞이지 않았는지 확인한다. canary가 통과한 뒤에만 REGISTRATION_MODE=production으로 변경한다. 등록 페이지 apiBase와 primary 구매 후 안내를 새 고정 URL로 전환하는 변경을 검토·배포한다. GitHub Pages는 main 병합 시 게시되므로 배포 검토 없이 merge하지 않는다.

## 일상 운영과 오류 복구

`/admin`에서 최근 동기화 성공/오류시각을 먼저 확인한다. 주문번호는 뒤 4자리, 학생은 불투명 ID로 표시하며 원정보는 기존 운영 Sheet에서 조회한다. 목록은 50건씩 불러오고 필터는 현재 불러온 목록에 적용된다.

| 조치 | 실제 동작 |
|---|---|
| 상세 | 최근 최대 100개 감사 이벤트 및 상태 |
| 주문 재동기화 | NAVER 상세 재조회, 실패 작업의 횟수 초기화 후 안전 재처리 |
| 등록·안내 재처리 | Apps Script 결과 재조회; 새 메일/코드 생성 없음 |
| 입장코드 재발급 | 명시적 확인 후 기존 활성기간 내 재발급; 기존 세션 폐기; UUID 중복방지 |
| 접근정지 | 기존 suspend 및 주문 tombstone; 자동 PAYED 복구 없음 |
| 검토 완료 기록 | 검토시각 기록만; 결제/수량/신원/정지 조건을 우회하지 않음 |

“주문은 왔는데 코드가 안 왔다”:

* REGISTRATION_PENDING: 구매자가 아직 정보/동의를 완료하지 않았다. 구매 후 고정 등록 URL을 안내한다. 이 도구는 자동 outbound 메시지를 보내지 않는다.
* REGISTERED + APPS_SCRIPT_TIMEOUT: 먼저 등록·안내 재처리로 결과를 조회한다. 메일이 이미 전송됐을 수 있다.
* MANUAL_REVIEW + ISSUANCE_REVIEW_REQUIRED: Google 발송로그/수강생 발송상태를 확인한다. 원코드가 저장되지 않으므로 새 메일이 필요하면 기존 코드 재발급을 명시적으로 실행한다.
* 발급시도 marker는 있으나 code/수강기간이 전혀 없음: 실행이 시도기록 직후 중단된 경우다. 자동 재발급은 하지 않는다. Google 실행기록 및 코드/메일 미생성 증거를 확인한 담당자만 ledger 시도기록을 정정하고 재등록하도록 안내한다. 수강기간이 이미 생겼으면 marker를 지우지 않는다.
* LEGACY_IDENTITY_CONFLICT: 기존 Form 정보와 제출정보가 다르다. 신원을 별도로 확인하고 기존 운영 메뉴/Sheet에서 처리한다. 자동으로 기존 이메일을 덮어쓰지 않는다.
* QUANTITY_REVIEW/CLAIM_REVIEW/BUYER_INFO_UNAVAILABLE: 수량/교환/선물/마스킹 확인. 검토 완료 버튼으로 강제 발급되지 않는다.
* AUTH_ERROR/EXTERNAL_AUTH_REQUIRED: API 권한/IP/Secret 연결을 확인한다. 값을 로그나 채팅에 복사하지 않는다.
* RATE_LIMIT/NAVER_5XX/NETWORK_ERROR: 제한된 API 재시도 후 다음 Cron에서 같은 durable cursor 재개. 오래 지속되면 운영자 확인.
* 취소 전달 실패는 durable pending에 남는다. 5회 실패하면 deadletter와 MANUAL_REVIEW로 전환한다. **해당 학생은 외부 장애 동안 아직 활성일 수 있으므로 즉시 기존 Sheet 메뉴로 정지**하고 원인 해결 뒤 재동기화한다. 서비스 간 장애 중 즉시 회수를 보장한다고 표현하지 않는다.

취소 자동화가 OFF이거나 동기화가 멈춘 시간에는 수동 취소 점검이 필요하다. 자동화는 실행되지 않은 외부 상태변화를 알 수 없다.

## 판매자센터에서 사람이 해야 할 일

* 실제 상품 유형/배송 없음/구매수량 정책과 구매자 주문정보 표시를 확인한다.
* 구매 후 안내 또는 상세페이지에 고정 `/lcms/register/`를 넣을 수 있는 기능과 정책을 확인한다. 주문별 동적 메시지 발송을 전제로 하지 않는다.
* 자동 메시지를 원하면 비즈니스톡톡 등 별도 승인된 전달수단의 계약/권한을 확인한다. 현재 구현에는 해당 발송 기능이 없다.
* 기존 Form을 계속 안내할 수 있게 유지하고 상품주문번호 확인 위치를 설명한다.
* 테스트 구매 및 취소·반품의 실제 상태변화를 검수한다. 이 코드가 판매자 대신 발주/발송/취소 승인 요청을 보내지는 않는다.

## 개인정보 운영

새 등록은 동의 버전과 접수시각을 기존 수강생 Sheet에 저장한다. 연락정보 삭제 트리거는 신규 동의 버전 행만 처리한다. 일일 trigger 실패 알림 및 실행기록을 확인한다. 해시 기반 등록 세션/속도제한 키는 만료 후 Cron 정리한다. 주문번호/tombstone/audit 등 거래와 연결되는 식별정보도 접근권한을 제한하고 사업자의 거래 기록 보관정책으로 관리한다. 최초 공개 전 수강지원 연락처와 위탁·국외 처리 고지를 기존 사업자 정책에 연결한다.

## 롤백

1. Worker 및 GAS NAVER_AUTO_PROVISION_ENABLED=false로 신규 발급부터 중단한다. 등록 페이지는 기존 Form을 표시하도록 apiBase를 비우거나 CTA를 복원한다.
2. 취소 sync/정지는 가능하면 유지한다. 전체 정지가 필요하면 취소/반품을 기존 Sheet에서 수동 처리하는 담당자를 지정한다.
3. 신규 Worker를 이전 정상 버전으로 되돌리거나 신규 route를 끈다. 기존 R2 Worker/bucket/pepper/session을 변경하지 않는다.
4. Apps Script를 이전 배포로 되돌릴 때 신규 Worker가 오래된 웹앱에 mutation을 보내지 않도록 먼저 차단한다.
5. 학생/주문 ledger/tombstone는 삭제하지 않는다. production storage를 staging 데이터로 덮어쓰지 않는다. 장애 중 처리된 주문목록과 기존 학생을 대조한 뒤 재개한다.

## Google Form fallback 종료 조건

실제 단건 canary와 취소 검수 통과, 운영 기간의 주문 대조에서 누락/중복 없음, 메일실패 복구 성공, 마스킹·복수구매 고객의 지원경로 확립, 미처리 legacy Form 신청 정리, 운영 담당자의 전환 결정이 모두 필요하다. 고정 일수 경과만으로 Form/트리거를 자동 삭제하지 않는다. 초기 primary CTA 전환 후에도 fallback 링크는 유지한다.
