# LMC NAVER 구현·검증 결과

작성일 2026-09-22. 기준 HEAD `3b79fe35c4c8a26a681c4249063535dab9accf16`. 작업 브랜치 `feature/lmc-smartstore-automation`.

## 완료 범위와 남은 단계

**C0 보고서와 C1–C7 코드/mock/VM/브라우저 검증을 완료했다. 운영 서비스는 변경하지 않았다.** C8 실 NAVER/Apps Script/Cloudflare 인증 연결, C9 실제 테스트 구매·실메일·영상·취소 검수, C10 운영 활성화는 **EXTERNAL_AUTH_REQUIRED**다. 상품번호 13702661269와 API 필드의 실매핑은 확정하지 않았다. 신규 feature flags는 OFF, DRY_RUN=true, canary allowlist는 비어 있고 정적 apiBase도 비어 있다.

## 1. 변경 아키텍처

NAVER 변경 피드/상세조회 → 별도 integration Worker/SQLite Durable Object → HMAC Apps Script API → 기존 수강생 Sheet → 기존 provisioning/MailApp → 기존 이메일+8자리 로그인/R2. 구매자 등록은 `/lcms/register/`의 고정 URL에서 주문자명·전체 연락처까지 대조한다. 주문별 outbound URL 발송을 추측하여 만들지 않았다. 상세는 [계약](LMC_NAVER_CONTRACT.md).

## 2. 신규 파일

* `.github/workflows/check-lmc-naver.yml`
* `docs/LMC_NAVER_C0_RECON_REPORT.md`, `LMC_NAVER_CONTRACT.md`, `LMC_NAVER_RUNBOOK.md`, `LMC_NAVER_DELIVERY_REPORT.md`
* `lcms/academy/apps-script/NaverIntegration.gs`
* `lcms/academy/naver-worker/README.md`, `package.json`, `package-lock.json`, `wrangler.jsonc`
* `lcms/academy/naver-worker/src/{admin,bridge,domain,index,naver,security,service,store}.js`
* `lcms/academy/naver-worker/test/{adapter,durable,integration,security}.test.js`, `test/helpers.js`
* `lcms/academy/naver-worker/scripts/inspect-mapping.mjs`
* `lcms/register/{index.html,config.js,privacy.html,register.css,register.js}`

## 3. 수정 파일

* `Api.gs`: HMAC 인증 네이버 action 라우팅만 추가.
* `Provisioning.gs`: 기존 ScriptLock을 호출자가 이미 소유한 경우의 내부 옵션, 취소 ledger 확인. 기존 코드 생성·해시·180일·메일 템플릿·세션 회수는 유지.
* `DataHelpers.gs`: 네이버 호출의 로그에 이메일/원문 주문번호/provider 오류를 남기지 않도록 제한.
* `.gitignore`: secret 파일 실수 방어.

`Code.gs`, 기존 Form/trigger 로직, 기존 사용자 schema, access.js, R2 Worker, 카탈로그, 기존 primary CTA는 수정하지 않았다. Windows에서 HEAD의 LCMS/lcms 대소문자 충돌 때문에 표시되는 `LCMS/index.html`은 변경 산출물에 포함하지 않았다.

## 4. DB/Sheet

기존 수강생 23열과 세션 10열 유지. 신규 `네이버연동` 8열 ledger만 추가하도록 setup 함수를 제공했다. 아직 운영 Sheet에 생성하지 않았다. 상품주문번호 유일성은 durable 고유 key와 ScriptLock 안의 canonical Sheet 중복검사로 방어한다. raw 입장코드/등록 token은 저장하지 않는다. 신규 연락처 retention trigger는 새 동의 버전의 등록행에만 적용하며 기존 Form 고객을 migration하지 않는다.

## 5. Cloudflare resource

신규 독립 Worker + SQLite-backed Durable Object + 2분 Cron + Access 관리자 보호 설정을 코드로 준비했다. 원격 Cloudflare 자원 생성/변경 없음. R2 자원 변경 없음. Worker outbound IP와 NAVER 허용정책이 맞지 않으면 고정 egress transport가 추가로 필요하며 해당 환경 선택/검증은 남아 있다.

## 6. Secret 이름

신규 Worker: NAVER_COMMERCE_CLIENT_ID, NAVER_COMMERCE_CLIENT_SECRET, NAVER_COMMERCE_ACCOUNT_ID(SELLER만), APPS_SCRIPT_ACCESS_URL, APPS_SCRIPT_SHARED_SECRET, REGISTRATION_SECRET. Apps Script: NAVER_SHARED_SECRET. 값은 수집/기록하지 않았다. 기존 pepper 및 R2 secrets는 재사용·회전하지 않았다. 실행 환경에서 필요한 신규 secret 변수는 제공되지 않았다.

## 7. NAVER API mapping

공식 OAuth bcrypt/Base64, changed-statuses cursor, query 300건 batch, 수량클레임 호환 플래그를 구현했다. 401/GW.AUTHN 한 번 갱신, 429/5xx/network 제한 재시도, 부분응답 checkpoint 금지를 검증했다. 실상품 mapping은 빈 목록이며 API 응답으로 확인하기 전 자동등록 불가. [공식 인증](https://apicenter.commerce.naver.com/docs/auth)과 [상세 API](https://apicenter.commerce.naver.com/docs/commerce-api/current/seller-get-product-orders-pay-order-seller)를 기준으로 구현했다.

## 8. 주문 상태

NAVER_DETECTED → REGISTRATION_PENDING → REGISTERED → ACTIVE. 상품 불일치는 IGNORED. 취소/반품/미결제취소는 terminal tombstone → SUSPENDED. 수량>1/교환/선물·마스킹/클레임/발급 결과 불명은 MANUAL_REVIEW. 오래된 PAYED로 terminal/수동 정지를 해제하지 않는다. 정상 후속상태로 새 수강권을 만들지 않는다.

## 9. 신규 테스트

**44/44 PASS**: 실제 기존 GS를 VM에서 실행하는 통합검사, NAVER adapter, HTTP/JWT/HMAC, workerd SQLite 영속성.

요청한 A–P fixture를 모두 포함: PAYED/3회·100회 중복/타상품/결제대기/취소/반품/미결제취소/등록 후 취소/발급 후 재동기화/메일실패/401/500/Apps Script timeout/invalid·expired token/복수수량.

추가 검증: API 응답 일부 누락·300건 batch, pagination 재시작, HMAC 변조·replay 만료, Access 서명/audience/만료, 취소 race, legacy Form 중복, 관리자 재발급 UUID/기간 유지, 초기 시도 후 crash, 보유기간 삭제 범위, flags/canary, 제한된 취소 retry와 deadletter.

**동일 주문 100회:** 수강생 1명, 코드 발급 1회, 최초 MailApp 호출/성공 1회. 별도의 실제 workerd SQLite 테스트에서도 100회 동시 처리 및 런타임 종료·재시작 후 주문 1건/cursor 유지.

**브라우저 16/16 PASS:** Chrome headless 390×844 및 1440×1000, 구매검증→등록 UI→실제 서비스/GS mock 성공, 중복메일 없음, overflow 없음, JS 오류 없음, local/sessionStorage 민감정보 없음, 연결 전 fallback. 화면 PNG를 별도 산출물로 제공한다.

## 10. 기존 회귀

| 검사 | 변경 전 | 변경 후 |
|---|---:|---:|
| Apps Script access validation | 52 PASS | 52 PASS |
| 수강생별 browser progress | 14 PASS | 14 PASS |
| 기존 R2 Worker | 18 PASS | 18 PASS |
| Academy 구조/12주/77파트 | PASS | PASS |
| catalog 77파트/74,669초 | PASS | PASS |
| CIP 검사 | PASS | PASS |
| GS/JS syntax | CI 계약 확인 | PASS |
| 기존 R2/new Worker dry-run build | 후속 실행 대상 | 둘 다 PASS |

기존 기능검사 **84개 모두 유지**, 신규 44개와 브라우저 16개 추가. 실제 NAVER 주문/Google 메일 발송/R2 객체의 온라인 canary는 실행하지 않았으며 mock 성공을 실운영 성공으로 표시하지 않는다.

## 11. Security review

* 기존 8자리 alphabet/HMAC/pepper/raw 비저장 보존, 새 code generator 없음.
* 무인증 mutation/admin 차단, 독립 HMAC key 및 5분 서명 유효성, Access JWT cryptographic verification, Origin/JSON/body 제한.
* 등록 CSPRNG 256bit/hash-only/15분/원문 URL·브라우저 저장 금지, IP·주문 rate limit, 제출 직전 재검증.
* 배송주소/네이버 원응답을 저장하지 않음. 신규 audit 로그에는 개인정보/secret 원문 없음. 관리표시는 주문 마스킹/opaque student ID.
* 메일 응답 유실 시 자동 재발급 금지. exactly-once delivery를 과장하지 않고 at-most-once 시도 + 검토/명시적 재발급으로 처리.
* canary allowlist와 Worker/GAS 이중 OFF flag, 정지 기능 OFF 시 신규 등록 차단.
* 새 Worker dependency audit: **0 vulnerabilities**. 기존 R2 runtime production dependency audit도 0. 기존 R2 잠금파일의 dev-tool dependency audit에는 high 4건이 이미 존재하며 이번 변경에서 R2 lockfile을 수정하지 않았다. 별도 tooling 업데이트 검토가 필요하다.

남은 제약: 주문정보 대조는 OTP가 아니다. 이미 발급된 R2 재생 URL은 기존 정책대로 최대 4시간 유효하다. 외부 NAVER/GAS 장애 중 취소 전파는 지연될 수 있으며 수동 정지가 필요하다. 전체 법률 검토/실환경 penetration test가 수행됐다는 의미가 아니다.

## 12–14. 롤백·배포·운영

[운영 매뉴얼](LMC_NAVER_RUNBOOK.md)에 Secret 설정, 복제 Sheet staging, 실제 매핑 읽기 도구, 단건 canary, 운영 전환, 오류분류, 수동 메일 복구 및 롤백을 포함했다. 롤백은 신규 발급 OFF → Form 안내 복귀 → 취소 처리 유지/수동 대체 → 신규 Worker/Apps Script 배포 복귀 순서이며 기존 학생/ledger/pepper/R2는 삭제하지 않는다.

## 15–17. 남은 manual step

* NAVER 애플리케이션 권한·허용 IP·토큰 연결, 실제 상품 매핑/수량/마스킹 확인.
* Cloudflare staging namespace/Access 운영자 정책/Secret과 복제 Apps Script/Sheet 연결.
* 사업자 개인정보 처리방침의 위탁·국외 처리/연락처/보관정책 일치 확인.
* 판매자센터 구매 후 안내 기능 확인 및 고정 등록 URL 삽입. 승인된 outbound 수단 없이는 동적 토큰 메시지 배송 없음.
* 실구매 단건 → 실제 메일 → 로그인 → 실제 영상 → 취소 검수 후에만 자동화 ON.
* Google Form 종료: 실운영 대조에서 누락/중복 없음, 복구 검증, 예외 고객 지원경로, 미처리 legacy 정리 및 운영자 전환 결정이 모두 필요. 자동 삭제/종료 없음.
