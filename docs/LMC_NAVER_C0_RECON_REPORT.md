# LMC × NAVER C0 RECON

조사일: 2026-09-22. Canonical source: `dailycoach/home` HEAD `3b79fe35c4c8a26a681c4249063535dab9accf16` (2026-09-19). 작업 브랜치: `feature/lmc-smartstore-automation`. C0에서는 애플리케이션 코드를 변경하지 않았다.

## 확인 범위와 증거

저장소 전체 tracked-file 목록, workflow 목록, LMC 소스·테스트·운영 문서와 연결된 진도/영상 스크립트를 조사했다. 관련 AGENTS.md는 없다. 무관한 다른 교육상품 소스 전체를 LMC 소스로 간주하지 않았다. Windows checkout에서는 기존 `LCMS/index.html`과 `lcms/index.html`의 대소문자 충돌로 `LCMS/index.html`이 수정으로 보인다. 이 파일은 변경·stage하지 않는다.

GitHub Pages API: legacy build, `main:/`, `https://daily-coach-ing.com/`, built. 정적 enter 페이지의 HTTP 응답과 기존 R2 Worker `/health` 응답을 확인했다. Apps Script 배포본/Script Properties, 운영 Sheet 실제 데이터, Cloudflare 계정 설정, 판매자센터는 아직 인증해 읽지 않았다. 저장소 소스와 실제 운영 배포본의 완전 일치는 **EXTERNAL_AUTH_REQUIRED**다. 과거 README의 “배포 전” 문구보다 현재 source config 및 published 77개 카탈로그를 우선한다.

## 현재 구조

SmartStore 구매 → Google Form → `handleFormSubmit` → 수강생(결제대기) → 운영자 결제확인 → `provisionStudentRow_` → MailApp → 이메일+8자리 코드 → R2 Worker `/access` → Apps Script 세션 → Worker `/authorize` → 비공개 R2 Range/HEAD.

* Apps Script `Code.gs` VERSION 1.3.0, ACCESS_DAYS 180, SESSION_HOURS 12, header row 2/data row 3.
* `generateAccessCode_`: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 8자리. 기존 `CODE_PEPPER` HMAC과 CODE_HINT/HASH/ISSUED_AT만 저장.
* provisioning: 확인완료만 발급. 정상 활성+발송완료이면 skip. 재발급은 기존 활성 기간만 유지. 만료/정지는 새 결제 없이 회복 불가.
* 중요: 메일 오류 뒤 기존 provisioning 재호출은 새 코드를 생성할 수 있다. 자동 retry는 이 함수를 무조건 다시 호출하면 안 된다. Sheet와 MailApp은 원자적 트랜잭션이 아니므로 결과 불명확 시 자동 재발송 대신 운영 검토가 필요하다.
* `suspendStudentRow_`: 세션 종료, 코드 hint/hash 삭제, 정지. expire도 기존 함수로 처리.
* Form과 payment edit 및 일일 expiry 트리거는 유지한다. Form은 주문번호 중복을 검사하지만 외부 결제검증은 하지 않는다.
* `Api.gs`: GET health, 인증된 POST login/validate/logout/workerValidate, SYNC_SECRET 기반 confirmPayment. confirmPayment는 이미 존재하는 신청의 결제확인 훅으로, 새 주문등록 API가 아니다.
* 기존 관리 UI는 Google 계정/Sheet 편집권한 기반 메뉴다. 웹 관리자 인증은 없다.

## Sheet/비밀값

수강생 23열: ID, APPLIED_AT, COURSE_ID, ORDER_NO, CHANNEL, BUYER_NAME, STUDENT_NAME, EMAIL, PHONE, CONSENT, PAYMENT_STATUS, PAYMENT_AT, CODE_HINT, CODE_HASH, CODE_ISSUED_AT, ACCESS_EXPIRES_AT, ACCESS_STATUS, MAIL_STATUS, MAIL_AT, LAST_ACCESS_AT, ACCESS_COUNT, ERROR, NOTE.

세션 10열: ID, TOKEN_HASH, STUDENT_ID, COURSE_ID, CREATED_AT, EXPIRES_AT, LAST_CHECKED_AT, STATUS, USER_AGENT_HASH, NOTE. 발송로그 9열. 과정설정 10열. 필수 시트는 수강생/과정설정/영상목록/세션/발송로그/스마트스토어/설정/설치안내. 설문응답·대시보드·신청서필드의 실제 운영 스키마는 미확인.

기존 Script Properties: CODE_PEPPER, SESSION_PEPPER, WORKER_SHARED_SECRET, SYNC_SECRET, SPREADSHEET_ID, FORM_ID, FORM_URL. 기존 Worker Secrets: ACCESS_API_URL, ACCESS_API_SECRET, PLAYBACK_SECRET. 값은 읽거나 보고서에 복제하지 않았다.

## 기존 Worker 및 취소 한계

`r2-worker/src/index.js`는 공개 health, Origin 제한 `/access`, `/authorize`, signed `/media`를 제공한다. bucket `rsedu-lmc-videos`, 77개 allowlist, 주차 12는 영상 없음. 기존 Worker는 변경하지 않고 별도 네이버 Worker를 둔다.

취소 후 새 로그인/authorize는 차단할 수 있지만 **이미 발급된 영상 URL은 최대 4시간 동안 유효**하다. 현재 설계와 테스트가 Apps Script 장애 중에도 기존 URL 재생을 의도적으로 보장한다. “취소 즉시 진행 중인 스트리밍까지 정지”는 기존 R2 계약 변경 없이는 충족되지 않는다. 이번 연동은 기존 계약을 보존하며 이 한계를 배포 검토에 명시한다.

## NAVER 공식 계약 및 구매자 검증 정책

조사 시 공식 current 문서는 2.89.0이다. [인증](https://apicenter.commerce.naver.com/docs/auth): bcrypt(client_id + '_' + timestamp, client_secret) 결과의 Base64를 form body에 전송한다. raw secret 전송 금지. 토큰 수명 응답으로 캐시, 401/GW.AUTHN에 1회 갱신.

[변경 조회](https://apicenter.commerce.naver.com/docs/commerce-api/current/seller-get-last-changed-status-pay-order-seller)와 [상세 조회](https://apicenter.commerce.naver.com/docs/commerce-api/current/seller-get-product-orders-pay-order-seller): 변경 피드 후 상세, 최대 300건, moreFrom/moreSequence 사용. 고정 종료시각과 durable page cursor, inclusive 경계 overlap 및 주문키 dedupe를 사용한다. 상세 일부 누락은 성공 checkpoint로 취급하지 않는다.

[주문 스키마](https://apicenter.commerce.naver.com/docs/commerce-api/current/schemas/상품-주문-정보-구조체)에 order.ordererName/ordererTel, productOrder.productId/originalProductId/sellerProductCode가 존재한다. **13702661269의 실제 대응 필드는 아직 미확정**. 운영 mapping은 기본 빈 목록이며 실제 API 응답으로 확인한 필드/값/과정만 운영자가 설정한다. 상품명으로 매핑하지 않는다.

일반 Commerce API에 주문별 outbound URL 발송을 가정하지 않는다. [NAVER 공식 답변 #3482](https://github.com/commerce-api-naver/commerce-api/discussions/3482)는 톡톡 기능을 Commerce API에서 제공하지 않는다고 안내하고, [공식 답변 #1542](https://github.com/commerce-api-naver/commerce-api/discussions/1542)는 비즈니스톡톡 대행사 연동을 설명한다. 현재 판매자센터의 계약/기능 활성화 여부는 **EXTERNAL_AUTH_REQUIRED**다. 기본 경로는 고정 `/lcms/register/` → 상품주문번호 + 주문자명 + 전체 주문자 휴대전화번호 대조 → 15분 opaque 등록 세션 → 수강생 정보/동의 → 기존 발급 함수다. 이메일은 네이버 ID에서 추측하지 않는다.

마스킹/누락/선물 주문, 수량이 1이 아닌 주문, 교환/불명확한 수량 클레임은 수동검토. 인증 실패는 동일한 공개 오류와 IP+주문 단위 제한. 비교용 구매자 개인정보는 요청 메모리에서만 사용하고 durable 주문정보에는 복제하지 않는다. 연락처 소유 OTP가 아닌 정보대조 방식임을 명시하며, 유출된 주문정보를 아는 사람까지 막는 강한 본인인증으로 표현하지 않는다.

## C1 이후 설계

별도 `naver-worker` + SQLite-backed Durable Object(주문별 고유 storage key, 직렬 실행, durable cursor/등록 세션 hash/audit) → HMAC+timestamp 인증 Apps Script 액션 → 기존 수강생 Sheet. 학생 canonical DB는 계속 Sheet다. 신규 `네이버연동` 시트는 tombstone/발급 시도/운영 액션 영수증만 저장한다. ScriptLock 내부에서 주문 검사와 학생 생성을 연결하고 기존 lifecycle 함수를 같은 lock 내에서 호출하도록 최소 확장한다.

NAVER_SYNC_ENABLED/NAVER_AUTO_PROVISION_ENABLED/NAVER_AUTO_SUSPEND_ENABLED 기본 false, DRY_RUN 기본 true. live adapter는 egress 및 mapping 검증 전 fail closed. NAVER 계정의 허용 IP 요건과 Cloudflare outbound 경로는 staging에서 확인해야 한다. 필요시 고정 egress의 제한된 서버 transport를 사용하며 R2 Worker와 병합하지 않는다.

웹 관리자는 Cloudflare Access JWT(서명/issuer/audience/expiry) 검증 후에만 HTML/API 제공. 재동기화·상태조회·기존 코드 재발급·정지·검토기록을 제공한다. 실패 메일은 원문코드가 없으므로 조회 후 명시적 기존 재발급만 허용한다. 자동화 retry로 메일을 재발송하지 않는다.

## baseline (변경 전)

| 검사 | 결과 |
|---|---|
| check-lmc-academy.mjs | PASS, 12주/77파트/74,669초 |
| test-access-validation.mjs | 52 PASS |
| test-lmc-progress-scope.mjs | 14 PASS |
| preflight --catalog-only | PASS 77파트 |
| R2 worker node tests | 18 PASS |
| check-cip-art.mjs | PASS |

기존 CI는 추가로 JS/GS syntax와 wrangler dry-run을 수행한다. 새 의존성 설치 후 동일하게 실행한다. 현재 기능 테스트 baseline 합계 84개. 구조/카탈로그 검사는 테스트 개수를 출력하지 않아 별도 PASS로 기록한다.

## 예상 변경 파일과 위험

신규: naver-worker(도메인/adapter/storage/service/HTTP/admin/테스트/config), apps-script/NaverIntegration.gs 및 VM 통합테스트, lcms/register/(HTML/CSS/JS), docs의 계약/배포/운영/검증 보고서, 신규 CI. 수정: Api.gs 라우팅, Provisioning.gs lock 소유권 최소 확장, .gitignore. 기존 로그인·학생 schema·메일 템플릿·R2·Form·primary CTA는 보존한다.

주요 위험: mail send 후 응답/시트 기록 유실, Form 경합, 발급/취소 경합, 오래된 PAYED가 취소를 뒤집는 문제, cursor 경계/부분응답, 구매자 정보 마스킹, 주문수량, 권한/허용 IP, GAS 배포본 불일치, 운영 메일 quota. 각 위험은 mock/VM 테스트 및 기본 OFF로 다룬다. 실구매·실메일·영상 E2E는 가짜 PASS로 기록하지 않는다.

## 롤백

우선 신규 auto provision OFF, 신규 등록 CTA를 기존 Form으로 복원. 취소 감지는 가능한 한 유지하고 필요하면 수동 취소 점검으로 전환. 신규 Worker만 이전 버전/route로 롤백한다. 새 학생/주문 ledger는 삭제하지 않는다. Apps Script 이전 배포로 되돌릴 때 네이버 등록을 먼저 차단한다. 기존 pepper/세션/영상/수강기간을 재설정하지 않는다. production 활성화는 staging + 단건 canary 구매/등록/메일/로그인/영상/취소 검증 후에만 가능하다.
