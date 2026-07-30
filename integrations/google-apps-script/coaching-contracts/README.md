# DAILYCOACHING 코칭계약 Apps Script

라이프·비즈니스·커리어 코칭계약의 발행, 이메일 OTP 확인, 2자·3자 전자확인,
비공개 Google Docs/PDF 생성과 이메일 전달을 담당하는 Google Apps Script V8
패키지입니다.

이 패키지는 법률전문가의 검토를 대신하지 않으며 ICF 또는 한국코치협회가 승인한
공식 계약서라고 표시하지 않습니다.

## 구현 범위

- `DAILYCOACHING_CONTRACTS` 바인딩 스프레드시트
- `CONTRACTS`, `SIGNERS`, `CONSENTS`, `AUDIT_LOG`, `SETTINGS` 5개 시트
- 비공개 Drive 루트와 `DOCUMENTS`, `PDF`, `SNAPSHOTS`, `TEMPLATES`
- 라이프·비즈니스·커리어 Google Docs 템플릿
- HMAC-SHA-256 초대토큰·OTP·인증 세션
- 이메일 OTP 10분, 5회 입력, 60초 재요청 대기, 시간창별 요청 제한
- 고객·스폰서 개별 토큰과 3자 계약 상태머신
- 발행 계약내용 `documentHash`, 전자확인 `acceptanceEvidenceHash`, 최종
  PDF blob `pdfHash` 분리
- 서명자별 정규화된 확인·동의 증거를 비공개 불변 JSON으로 저장하고
  `acceptanceEvidenceFileId`와 SHA-256으로 원장에 연결
- ScriptLock, requestId idempotency, PDF·메일 lease, 주기 재시도와 reconciliation
- `ISSUE_STARTED`/acceptance stage 원장으로 브라우저 종료 후에도 다중 쓰기
  부분실패를 서버에서 복구
- 계약 체결 후 요청을 위한 관리자 접수 API와 감사기록

## 중요한 설계 한계

### PDF 자기 해시

최종 PDF 안에 그 PDF 파일 자체의 SHA-256을 넣을 수는 없습니다. 해시를 넣는 순간
파일이 바뀌어 다시 다른 해시가 되기 때문입니다.

- PDF 본문: 계약내용 SHA-256과 전자확인 증거 SHA-256
- PDF 생성 후: PDF blob SHA-256을 `CONTRACTS.pdfHash`와 `AUDIT_LOG`에 기록

### exactly-once

Google Sheet, Drive, Docs 변환과 MailApp 사이에는 하나의 원자적 트랜잭션이
없습니다. 전송 성공 직후 실행이 중단되면 재시도 이메일이 중복될 가능성이 있습니다.
이 패키지는 다음 방식으로 위험을 줄이지만 exactly-once를 보장하지 않습니다.

- 계약 상태와 PDF 생성 상태, 수신자별 전달 상태 분리
- 10분 lease
- 최대 5회 제한 재시도
- idempotency request hash
- `processPendingContractJobs_`와 `reconcileContract`
- 발행·OTP·전자확인의 브라우저 메모리 requestId를 작업 단위로 재사용
- 전자확인 `STARTED` 이후에는 비공개 pending/evidence를 권위 자료로 사용해
  원 브라우저나 원 requestId가 없어도 서버 reconciliation으로 완결
- 만료 작업과 관리자 종료는 먼저 pending acceptance를 복구하고, lock 안에서
  fresh 상태를 다시 확인합니다. 복구 가능한 선행 전자확인 intent가 남아 있으면
  만료를 건너뛰거나 종료를 보류해 시간순 증적을 보호합니다.
- PDF/Docs 생성 실패나 finalization lease 상실 시 이번 시도에서 만든 파일을
  휴지통으로 보상 정리하고, 정리 실패는 `CLEANUP_FAILED`와 별도 감사 이벤트로
  차단
- 실행시간 초과로 생성 파일 ID를 원장에 기록하지 못한 경우에도 계약번호별
  결정적 파일명만 제한적으로 검색해 미참조 파일을 정리한 뒤 재시도
- 최종본이 `READY`인데 전달 상태 초기화 도중 실행이 중단된 경우
  `reconcileContract`가 운영자와 확인 완료 서명자의 `NOT_READY`를 `PENDING`으로
  복구

### CacheService

CacheService 값은 만료 전에 사라질 수 있습니다. OTP 시도·쿨다운·잠금은 항상
`SIGNERS`가 권위 저장소이며 Cache는 짧은 폭주 감지 힌트로만 사용합니다.

### 이메일 OTP

초대링크와 OTP가 같은 이메일로 전달되므로 이는 이메일함 소유 확인이지 독립된
다중요소 인증이 아닙니다. 공인전자서명 또는 공인인증 전자서명으로 표시하지 않습니다.

### Apps Script iframe

`HtmlService.XFrameOptionsMode.ALLOWALL`은 임의 사이트가 iframe을 만들 수 있게
합니다. 서명 UI는 허용된 부모 origin의 handshake가 끝나기 전 비활성 상태이며,
서버는 토큰·OTP·인증 세션을 계속 검증합니다.

Apps Script HtmlOutput은 CSP `frame-ancestors`, `X-Robots-Tag`,
`Referrer-Policy` 같은 임의 응답 헤더를 설정하기 어렵습니다. 따라서 다음도
필수입니다.

- 정적 `/coaching/agreement/sign/`에 `noindex`, `nofollow`, `noarchive`
- iframe `referrerpolicy="no-referrer"`
- Apps Script `/exec` URL을 sitemap과 공개 내비게이션에서 제외
- 직접 `/exec` 진입 시 계약 UI 비활성화
- 부모 페이지와 iframe의 허용 origin, 고정 `source`, 프로토콜 `version` 검증
- `DAILYCOACHING_SIGN_READY` → `DAILYCOACHING_SIGN_TOKEN` →
  `TOKEN_RECEIVED`/`STATUS`/`COMPLETED`/`FAILED` 메시지 흐름

## 설치

1. 실제 운영 Google 계정으로 새 Google Sheet를 만듭니다.
2. Sheet의 확장 프로그램 → Apps Script에서 바인딩 프로젝트를 엽니다.
3. 이 폴더의 `.gs`, `.html`, `appsscript.json`을 프로젝트에 반영합니다.
4. `installCoachingContractSystem()`을 스크립트 편집기에서 실행합니다.
   설치 함수 전체는 ScriptLock을 최대 30초 기다린 뒤 실행하므로 동시 최초 설치가
   폴더·템플릿·trigger를 중복 생성하지 않습니다. lock 시간초과 시 다른 설치가
   끝난 뒤 다시 실행합니다.
5. 생성된 Script Properties, 5개 시트, 비공개 Drive 폴더와 템플릿을 확인합니다.
   각 템플릿에는 `{{DC_BRAND}}`, `{{DC_TITLE}}`, `{{DC_NOTICE}}`,
   `{{DC_TEMPLATE_VERSION}}`, `{{DC_CONTENT}}`가 각각 정확히 한 번 있어야 합니다.
   시스템은 원본 템플릿을 비우지 않고 복사본의 marker를 병합한 뒤 본문을 추가합니다.
6. `SETTINGS`의 빈 운영·법률·개인정보 값을 검토된 실제 값으로 입력합니다.
7. 웹앱을 새 버전으로 배포합니다.
   - 실행 주체: 배포자
   - 접근: 로그인 없이 계약 수신자가 접근 가능한 설정
8. 실제 `/exec` URL을 Script Property `WEB_APP_EXEC_URL`에 저장합니다.
9. `ALLOWED_PARENT_ORIGINS`와 `ADMIN_EMAIL_ALLOWLIST`를 실제 값으로 확인합니다.
10. `SIGN_PAGE_BASE_URL`은 허용 origin의 정확한
    `/coaching/agreement/sign/` 주소로 설정합니다. credentials, query, fragment는
    허용되지 않습니다.
11. `menuCheckSettings`에서 미확정값이 없는지 확인합니다.

`Config.gs.example`은 검토값 입력용 예시 골격입니다. 빈 값이 남아 있으면 실행을
거부합니다. 비밀 pepper는 설치 함수가 Script Properties에 생성하므로 소스나
Sheet에 옮기지 않습니다.

## 발행 readiness blocker

다음 항목이 하나라도 비어 있거나 검토 확인값이 `YES`가 아니면
`adminIssueContract`가 계약 발행을 차단합니다.

- 실제 제공자·사업자·코치·연락처·세무·관할 정보
- 취소·노쇼·환불·결제 정책
- 개인정보 보유기간·파기방법·문의처
- Google 처리위탁 수탁자·목적·항목·보유기간
- 국외 이전받는 자·국가·일시방법·목적·항목·보유기간
- 녹음·전사·AI·연구·사례·홍보·마케팅·제3자 전달 실제 운영 여부
- 실제로 제시하는 각 선택동의의 목적, 항목·범위, 도구·수탁자·제공받는 자,
  보유·이용기간과 안내 버전
- 조직 스폰서 제공 동의의 제공받는 자·목적·선택항목·보유기간·거부 안내
- 청약철회·중도종료·계약변경·선택동의 철회·개인정보 권리요청 절차
- 실제 Sign 관문 URL과 Apps Script `/exec` URL
- 개인정보·국외이전·계약관리·법률 검토 확인

가짜 endpoint, 임시 성공 URL, 추정한 사업자정보를 넣어 readiness를 우회하지
않습니다.

`RECORDING_AI_MODE=NOT_USED`이면 녹음·전사·AI 제공 플래그는 모두 `NO`여야
합니다. 연구·익명사례·후기·마케팅·제3자 제공은 이 mode와 별개이며 실제
제공 플래그가 `YES`일 때만 상세 안내값을 요구하고 화면·PDF에 표시합니다.

## 토큰과 OTP

- 초대토큰: UUID 두 개를 결합한 64자리 hex
- Sheet에는 HMAC-SHA-256 해시만 저장
- OTP 확인 성공 즉시 초대토큰을 `CONSUMED` 처리
- OTP 확인 성공 원장 쓰기 뒤 응답·감사기록 전에 실행이 중단되어도 동일
  requestId와 같은 OTP를 다시 보내면 저장된 challenge에서 동일 인증 세션을
  재구성하고 누락 감사기록을 보완
- 계약 체결 시 인증 세션도 소비
- 토큰은 URL query가 아닌 fragment로 전달
- 토큰·OTP·인증 세션을 브라우저 영구·세션·인덱스 저장소나 쿠키에 저장하지 않음
- 초대 재발송은 기존 원토큰을 복구하지 않고 기존 해시를 폐기한 뒤 새 토큰 발행
- 초대 이메일 실패는 제한된 지수 백오프 후 새 일회성 토큰으로 최대 5회 재시도
- 발행 중단으로 필수 signer 행이 누락되면 비공개 계약 snapshot/hash를 검증한 뒤
  서버 작업이 누락 역할을 생성하고 새 토큰으로 초대를 재개
- `DRAFT`는 초대 재시도, bootstrap, OTP, 계약 열람·체결 전 구간에서 거부
- 재발송이 메일 호출 전에 중단된 `CLAIMED`/오래된 `PENDING`은 원토큰을 저장하지
  않고 새 토큰으로 회전해 복구

OTP 요청은 OTP 해시와 `PENDING` 전달 상태를 먼저 기록한 뒤 `MailApp`을 호출합니다.
그 사이 Apps Script 실행이 강제 종료되면 같은 requestId는 성공으로 간주하지 않고
`전송 상태 미확인`으로 fail-closed합니다. MailApp이 메일을 접수한 직후 상태 기록
전에 종료된 경우 실제 인증번호가 도착했어도 같은 요청은 오류로 보일 수 있습니다.
화면은 실패 뒤 requestId를 폐기하며, 서버 cooldown 60초가 지난 뒤 새 requestId와
새 인증번호를 요청해 이전 challenge를 대체합니다. 운영에서는 실패 알림, 전달 지연,
중복 도착 가능성을 함께 안내합니다.

### 암호 버전 교체

`ACTIVE_CRYPTO_VERSION`은 새 초대토큰·OTP·인증 세션의 HMAC pepper와 현재 lookup
버전을 선택합니다. 값을 바꾸면 기존 미완료 초대링크와 인증 세션은 의도적으로
무효화되므로 운영 중 즉시 변경하지 않습니다.

1. 신규 계약 발행과 수동 초대 재발송을 일시 중단합니다.
2. `processPendingContractJobs_`를 실행해 pending acceptance를 먼저 복구합니다.
3. `ISSUED`, `CLIENT_VERIFIED`, `SPONSOR_VERIFIED` 계약과 미완료 signer를 목록화하고
   고객·스폰서에게 기존 링크 만료와 새 링크 발행 일정을 안내합니다.
4. 다음 버전의 `TOKEN_PEPPER_*`, `OTP_PEPPER_*`, `SESSION_PEPPER_*`,
   `IDEMPOTENCY_PEPPER_*`를 Script Properties에 안전하게 생성한 뒤
   `ACTIVE_CRYPTO_VERSION`을 변경합니다.
5. 각 미완료 signer의 초대를 관리자 기능으로 재발행해 새 버전 token hash를
   저장하고, 이전 링크·OTP·세션이 거부되는지 확인합니다.
6. 완료 계약의 증거와 감사기록을 확인하고 신규 발행을 재개합니다. 기존 pepper는
   검토된 보유·감사 정책에 따른 제거 시점까지 임의로 삭제하지 않습니다.

정적 Sign 관문은 endpoint가 없을 때 iframe을 만들지 않고
`전자계약 시스템 연결 전` 상태를 표시해야 합니다. 런타임 설정에 빈 문자열이나
임시 URL을 넣어 연결된 것처럼 처리하지 않습니다.

## 3자 계약과 스폰서 제공 동의

조직지원 비즈니스 계약은 `CLIENT`와 `SPONSOR`에게 별도 토큰을 발행합니다.

```text
ISSUED → CLIENT_VERIFIED → COMPLETED
ISSUED → SPONSOR_VERIFIED → COMPLETED
```

`CLIENT_VERIFIED`와 `SPONSOR_VERIFIED`는 OTP만 통과한 상태가 아니라 계약 전문의
전자확인을 마친 상태입니다.

고객의 스폰서 제공 동의는 일반 선택동의와 분리해 `CONSENTS`에 다음을 저장합니다.

- 제공 상태와 확인시각
- 제공받는 자
- 제공 목적
- 선택 제공항목
- 보유·이용기간
- 거부 안내 버전

세션의 구체적인 대화와 개인적인 감정·고민은 설정값과 관계없이 항상 제외됩니다.
코칭 참여 여부를 포함한 일반 공유항목은 모두 기본 비공유이며, 발행 시 명시적으로
선택된 항목만 계약 스냅샷에 고정합니다. 선택 제공항목이 있을 때 고객이 별도
제공 안내를 확인해야 체결할 수 있습니다.

스폰서 화면에는 고객 휴대전화번호를 전달하지 않습니다. 합의된 전체 목표 공유가
선택된 계약은 고객이 별도 제공 안내를 확인하기 전까지 스폰서의 OTP 요청과 계약
열람을 대기시키며, 고객 확인 후 목표를 포함한 스폰서 열람본을 고정합니다. 목표
공유가 선택되지 않은 계약은 스폰서가 먼저 진행할 수 있고 목표를 제외한 열람본이
고정됩니다. 원계약 해시와 서명자별 열람본 해시를 별도로 기록해 실제 확인한 문서와
전자확인 증거를 연결합니다.
스폰서에게는 고객 세션의 녹음·전사·AI·사례·후기 등 선택동의를 제시하지 않습니다.
스폰서에게 발송하는 PDF 수령본도 같은 제공 동의 증거를 검증해, 목표 공유가
선택되고 고객이 별도 확인한 경우에만 합의된 전체 목표를 포함합니다. 고객
휴대전화번호와 고객의 일반 선택동의 결과는 포함하지 않으며, 완료 이메일 본문과
제목에도 목표나 해당 정보를 넣지 않습니다.

고객/운영본과 스폰서 수령본 PDF는 최종화 시 각각 한 번 생성해 비공개 보관하고,
각 SHA-256을 `CONTRACTS`에 고정합니다. 수신자별 실제 발송 해시는 `SIGNERS`와
`AUDIT_LOG`에 기록해 재시도에도 같은 bytes가 사용되도록 합니다.

PDF는 변경 가능한 `CONSENTS` 셀을 직접 신뢰하지 않습니다. 서명자별 비공개
acceptance evidence JSON의 해시와 원계약·열람본 연결을 다시 검증하고, Sheet의
CONSENTS mirror가 그 증거와 정확히 일치할 때만 증거에서 복원한 결과를 렌더합니다.
누락·오편집·손상이 있으면 fail-closed로 최종화를 중단합니다.

## 계약 체결 후 계약관리

전자체결용 인증 세션은 일회성이므로 완료 후 공개 쓰기 API로 관리요청을 받지
않습니다. 안전한 재인증 수단을 별도로 구축하기 전까지 다음 흐름을 사용합니다.

1. `publicContractManagementInfo()`가 검토된 정책과 접수 연락처만 안내
2. 고객·스폰서가 해당 연락처로 요청
3. 운영자가 외부 채널에서 본인과 계약번호를 확인
4. `adminRecordManagementRequest()`로 민감한 본문 대신 외부 접수 참조번호만 기록
5. 처리 후 `adminResolveManagementRequest()`로 결과 코드를 기록

외부 접수 참조번호와 결과 코드는 영문·숫자·마침표·밑줄·하이픈으로 구성된
80자 이하의 코드만 허용합니다. 이름, 연락처, 코칭 목표, 요청 본문이나 그 밖의
개인정보를 코드 필드에 입력하지 않습니다.

지원 유형:

- `WITHDRAWAL`
- `EARLY_TERMINATION`
- `CONTRACT_CHANGE`
- `OPTIONAL_CONSENT_WITHDRAWAL`
- `PRIVACY_RIGHTS`

관리자 접수 API는 요청 자체를 법적으로 처리 완료했다고 표시하지 않습니다.
환불, 계약 재발행, 선택동의 철회 반영, 열람·정정·삭제·처리정지는 검토된 운영절차에
따라 별도로 실행하고 Audit에 결과를 남겨야 합니다.

## Drive와 파기

- 계약 JSON, Docs, PDF는 공개 링크 공유를 사용하지 않습니다.
- 발행 readiness에서 Sheet·Drive 폴더·템플릿의 비공개 공유상태를 실제로 확인합니다.
- 파일을 `PRIVATE`로 고정하지 못하면 스냅샷 저장·PDF 생성을 중단합니다.
- 전용 My Drive 비공개 폴더 사용을 권장합니다.
- Shared Drive 상위 권한이 상속되는 환경에서는 설치를 중단하고 실제 접근권한을
  검토합니다.
- 파기 예정 trigger는 목록과 알림만 생성하며 자동 삭제하지 않습니다.
- 완료 계약은 완료시각, 종료·만료 계약은 각 terminal 시각, 발행 중단 `DRAFT`와
  미완료 발행은 생성·수락기한을 기준으로 검토된 보유 개월 수를 계산합니다.
- 파기 후보에는 Sheet의 계약·서명자·OTP·동의 행뿐 아니라 계약/열람/evidence
  snapshot, Docs, 고객/스폰서 PDF의 비공개 file id inventory를 함께 표시합니다.
- Drive 휴지통, Sheet 버전기록과 Workspace 보존정책 때문에 즉시·비가역적 파기를
  코드만으로 보장할 수 없습니다.

## 공개 RPC

```text
publicBootstrapSign
publicRequestOtp
publicVerifyOtp
publicLoadContract
publicAcceptContract
publicContractManagementInfo
```

그 밖의 내부 helper와 trigger handler는 `_`로 끝나거나 `DC` namespace 안에 있어
`google.script.run`에서 직접 호출할 수 없습니다. 관리자 RPC는 매번
`Session.getActiveUser().getEmail()`과 allowlist를 확인하며
`Session.getEffectiveUser()`를 관리자 인증에 사용하지 않습니다.

## 운영 검수

최소 검수 항목:

1. `installCoachingContractSystem()`을 두 번 실행해 시트·폴더·템플릿·trigger가
   중복되지 않는지 확인
2. 설정 미완료 상태에서 발행이 차단되는지 확인
3. 라이프·커리어·비즈니스 2자·3자 계약 발행
4. 목표 비공유 계약의 고객·스폰서 양쪽 선확인 순서와, 목표 공유 계약에서 고객
   제공 확인 전 스폰서 OTP·열람 대기 및 확인 후 진행
5. OTP 오입력 5회, 만료, 60초 재요청, 시간창 제한
6. OTP 성공 후 초대토큰 재사용 차단
7. 초대 재발송 시 이전 링크 차단
8. 동일 requestId 중복 제출 시 상태 중복 변경 방지
9. 발행/동의/서명자/계약 상태 사이를 인위적으로 중단하고 브라우저를 닫은 뒤
   서버 작업이 원 requestId 없이 복구하는지 확인
10. `CONSENTS` 셀 수정·evidence 파일 누락·해시 불일치 시 PDF가 fail-closed인지 확인
11. PDF lease 만료·commit 상실·중간 변환 실패 시 생성 파일 정리,
    미참조 결정적 파일명 탐색과 `CLEANUP_FAILED` 수동 개입 차단
12. 고객·스폰서·운영자 이메일별 독립 재시도와 초대 이메일 실패 재시도
13. DRAFT 링크 전면 차단, ISSUED 필수 signer 누락 복구, 재발송 중단 복구
14. sign URL의 외부 origin·다른 path·credentials·query·fragment 거부
15. `NOT_USED`와 일반 선택동의 `YES` 조합에서 일반 상세 안내가 유지되는지 확인
16. PDF 본문의 원계약·열람본·전자확인 해시와 Sheet의 수령본별 `pdfHash` 구분
17. 스폰서 제공 동의 증적과 세션대화·개인고민 제외 확인
18. 스폰서 열람본과 PDF의 목표 공유조건 일치, 고객 전화·일반 선택동의 제외,
    완료 메일의 목표 제외
19. 고객 휴대전화번호 누락 시 전자계약 발행이 차단되는지 확인
20. 2월 30일 같은 존재하지 않는 달력 날짜가 거부되는지 확인
21. 완료·종료·만료·DRAFT 발행중단의 retention due와 artifact inventory 확인
22. 계약관리 코드 필드가 자유문자·개인정보 입력을 거부하는지 확인
23. 계약관리 요청의 상태·Audit 기록 확인
24. Sheet·Drive 공유권한과 Script Properties 편집자 범위 확인
25. 로그와 Audit에 원토큰·OTP·인증 세션·목표 전문이 남지 않는지 확인
26. `READY` 커밋 직후 전달 상태 초기화를 인위적으로 중단한 뒤 운영자와 모든
    확인 완료 서명자의 전달 상태가 `PENDING`으로 복구되는지 확인
27. Google Docs 템플릿 marker 누락·중복 시 readiness와 PDF 생성이 차단되고,
    정상 템플릿의 레이아웃은 보존되는지 확인
28. 수락기한 직전 `STARTED` intent 기록 후 실행 중단을 재현해 hourly expiry가
    먼저 실행되어도 복구 완료 또는 만료 보류되는지 확인
29. 같은 pending intent 상태에서 관리자 종료가 먼저 요청되어도 복구 완료 또는
    종료 보류되고, fresh `COMPLETED` 상태의 전자확인 증거가 보존되는지 확인

MailApp·Docs 변환·Apps Script 실행시간과 동시실행에는 계정별 할당량이 있습니다.
운영 전 실제 계정의 할당량과 실패 알림을 확인해야 합니다.
