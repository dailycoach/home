# DAILYCOACHING 코칭계약 시스템 설치·운영 매뉴얼

문서 버전: 2026.07-v1
대상: DAILYCOACHING 운영자·개발자·개인정보 담당자

## 1. 시스템 경계

이 시스템은 두 흐름을 분리한다.

### 공개 초안 작성기

- 경로: `/coaching/agreement/`
- 누구나 라이프·비즈니스·커리어 계약 조건을 입력하고 초안을 미리볼 수 있다.
- 입력값은 현재 페이지의 JavaScript 메모리에만 유지한다.
- 브라우저 저장소, URL, GitHub 저장소 또는 서버로 전송하지 않는다.
- 계약상 역할, 코칭 목적과 코칭 목표를 서로 다른 항목으로 확인한다.
- 공개 초안 작성기에서는 선택 동의를 수집하지 않는다. 선택 동의는 항목별 안내와
  서버 준비상태가 검증된 초대형 전자계약에서만 제시한다.
- 새로고침하거나 페이지를 닫으면 다시 입력해야 한다.
- 인쇄·PDF 저장본에는 `DRAFT · 전자확인 전`을 표시한다.
- 공개 초안은 전자계약 발행본이나 최종 계약 사본이 아니다.

### 초대형 전자계약

- 경로: `/coaching/agreement/sign/#TOKEN`
- 운영자가 Apps Script에서 발행한 계약 스냅샷만 사용한다.
- 공개 초안 작성기의 입력값을 이어받지 않는다.
- 토큰은 정적 부모 페이지에서 형식 검증 후 URL fragment에서 제거한다.
- 검증된 Apps Script iframe과 origin-bound 메시지 교환으로만 전달한다.
- 이메일 OTP, 계약 전문, 핵심 조항, 개인정보 안내와 성명 입력을 확인한다.
- 3자 계약은 고객과 스폰서의 확인이 모두 끝난 뒤 최종 PDF 작업을 시작한다.

## 2. 정적 사이트 파일

```text
/coaching/
  index.html
  /agreement/
    index.html
    /sign/index.html
    /success/index.html
  /assets/
    coaching.css
    coaching.js
    agreement.css
    agreement.js
    sign-gateway.js
    contract-templates.js
    runtime-config.js
    runtime-config.example.js
```

`runtime-config.js`는 공개 파일이다. 비밀값을 넣지 않는다. Apps Script URL은 비밀키가 아니지만 실제 `/exec` 배포와 법률·운영 검토가 끝나기 전에는 빈 문자열로 유지한다.

## 3. Apps Script 설치 전 필수 확인

1. 실제 사업자 정보, 담당 코치, 세무 표기와 문의처를 확정한다.
2. 일정변경·노쇼·중도종료·환불 정책을 확정한다.
3. 계약·결제·전자확인 기록의 보유기간을 확정한다.
4. Google 처리위탁·국외이전 고지와 개인정보처리방침을 확정한다.
5. 고객과 스폰서의 정보공유 동의 구조를 최종 검토한다.
6. 전자 청약철회·중도종료·변경·동의철회·개인정보 권리요청 경로를 준비한다.
7. 국내 법률전문가와 개인정보 담당자의 최종 검토를 기록한다.

미확정 상태에서는 정적 초안 작성기만 운영하고 전자계약을 활성화하지 않는다.

## 4. Google 운영계정

- 개인 일상 계정보다 DAILYCOACHING 전용 Google Workspace 운영계정을 권장한다.
- 2단계 인증을 적용한다.
- 스프레드시트·스크립트·Drive 편집자를 최소화한다.
- Apps Script 편집자는 Script Properties의 비밀값을 볼 수 있는 최고 신뢰 운영자로 취급한다.
- Shared Drive를 쓸 때 상위 폴더 권한 상속을 확인한다.
- 스크립트와 스프레드시트 시간대는 `Asia/Seoul`로 맞춘다.

## 5. Apps Script 패키지 설치

패키지 위치:

```text
/integrations/google-apps-script/coaching-contracts/
```

설치 개요:

1. 새 Google 스프레드시트를 만든다.
2. 이름을 `DAILYCOACHING_CONTRACTS`로 정한다.
3. 해당 스프레드시트에 바인딩된 Apps Script 프로젝트를 연다.
4. 패키지의 `.gs`와 `.html` 파일을 같은 이름으로 복사한다.
5. `Config.gs.example`을 `Config.gs`로 복사한다.
6. 프로젝트 설정에서 V8 런타임과 `Asia/Seoul` 시간대를 확인한다.
7. Script Properties에 필요한 ID·허용 origin·관리자 allowlist·pepper를 설정한다.
8. 스프레드시트에서 `installCoachingContractSystem()`을 한 번 실행한다.
9. 생성된 시트, 폴더와 템플릿이 비공개인지 확인한다.
10. `DAILYCOACHING 계약 → 설정 점검`을 실행한다.

설치 함수는 ScriptLock으로 동시 최초 실행을 직렬화하며, 이미 존재하는
시트·폴더·템플릿·trigger를 중복 생성하지 않아야 한다.

## 6. Sheet 구조

- `CONTRACTS`: 고객 역할·소속·직책, 코칭 목적·목표를 포함한 계약 조건, 계약 전문
  스냅샷 참조, 상태, 해시와 PDF·전달 작업상태
- `SIGNERS`: 고객·스폰서별 토큰 해시, OTP challenge, 인증 세션, 확인상태
- `CONSENTS`: 개인정보 안내 확인과 선택 동의 결과
- `AUDIT_LOG`: 개인정보를 복제하지 않는 상태전이·요청·오류 코드 기록
- `SETTINGS`: 비밀이 아닌 운영 설정과 필수값 상태

비밀값, 원토큰, 원 OTP와 인증 세션 원문은 Sheet에 저장하지 않는다.

## 7. Script Properties

최소 키:

```text
SYSTEM_SCHEMA_VERSION
INSTALLATION_ID
CONTRACT_SPREADSHEET_ID
ROOT_FOLDER_ID
DOCUMENT_FOLDER_ID
PDF_FOLDER_ID
SNAPSHOT_FOLDER_ID
TEMPLATE_FOLDER_ID
TEMPLATE_LIFE_ID
TEMPLATE_BUSINESS_ID
TEMPLATE_CAREER_ID
WEB_APP_EXEC_URL
ALLOWED_PARENT_ORIGINS
ADMIN_EMAIL_ALLOWLIST
ACTIVE_CRYPTO_VERSION
TOKEN_PEPPER_V1
OTP_PEPPER_V1
SESSION_PEPPER_V1
IDEMPOTENCY_PEPPER_V1
```

pepper는 충분히 긴 무작위 값으로 운영자가 Script Properties에 직접 넣고, GitHub·Sheet·README·채팅에 복사하지 않는다.

## 8. 웹 앱 배포

1. Apps Script의 새 배포에서 웹 앱을 선택한다.
2. 실행 주체와 접근 권한이 실제 운영 요구에 맞는지 검토한다.
3. 테스트용 `/dev`가 아닌 운영 `/exec` URL을 확인한다.
4. `doGet()`이 직접 민감정보를 출력하지 않는지 확인한다.
5. 정적 sign 페이지에서 Apps Script origin과 iframe source를 함께 검증한다.
6. 실제 Google 리디렉션에서 fragment 또는 origin handshake가 보존되는지 시험한다.
7. 직접 Apps Script URL로 진입했을 때 계약 UI가 활성화되지 않는지 확인한다.
8. 종단간 검수 전까지 `runtime-config.js`의 `appsScriptUrl`을 비워 둔다.

Apps Script `ALLOWALL`은 모든 사이트의 iframe 삽입을 허용한다. 정적 sign 페이지의 `noindex`, `no-referrer`, 외부 리소스 제거만으로 clickjacking이 완전히 해결되는 것은 아니다. 자식 페이지는 허용된 부모 origin과 handshake를 확인하기 전까지 입력·확인 기능을 비활성화한다.

## 9. 계약 발행

발행 전 자동 차단 항목:

- 사업자·대표자·주소·연락처·세무 안내 누락
- 취소·노쇼·환불 정책 누락
- 보유기간 누락
- 개인정보 담당자 누락
- Google 처리위탁·국외이전 검토 상태 미확인
- 전자 계약관리 경로 미확인
- 실제 `/exec` URL 누락

발행 순서:

1. 운영자가 계약 유형과 2자·3자 모드를 선택한다.
2. 고객·스폰서·조건과 정보공유 범위를 입력한다.
3. 계약 전문·개인정보 안내·선택 동의 버전의 스냅샷을 고정한다.
4. canonical 계약 JSON의 `documentHash`를 계산한다.
5. 고객과 스폰서별 서로 다른 토큰을 발행한다.
6. 원토큰은 발행 실행 메모리와 초대 이메일에만 존재한다.
7. 원장에는 HMAC 해시만 저장한다.

합의된 전체 목표의 스폰서 공유를 선택한 3자 계약은 고객이 별도 제공 안내를
확인하기 전까지 스폰서의 OTP 요청과 계약 열람을 대기시킨다. 고객 확인 후 목표가
포함된 스폰서 열람본을 고정하므로 스폰서가 확인한 내용과 최종 수령본이 달라지지
않는다. 목표 공유를 선택하지 않은 계약만 스폰서가 먼저 확인할 수 있다.

원토큰을 저장하지 않으므로 초대 재발송은 기존 링크 재발송이 아니다. 기존 토큰을 `ROTATED`로 폐기하고 새 토큰을 발행해 새 링크를 전송한다.

## 10. OTP와 전자확인

- 이메일 OTP는 6자리, 10분 만료, challenge당 최대 5회다.
- 60초 전에는 재발송할 수 없다.
- 재발송하면 이전 OTP가 즉시 무효가 된다.
- OTP·토큰 해시는 서버 비밀 pepper와 HMAC-SHA-256을 사용한다.
- `CacheService`는 보조 폭주 감지만 담당한다.
- OTP 시도·쿨다운·잠금의 권위 상태는 `SIGNERS`에 저장한다.
- OTP 성공 후 짧은 수명의 인증 세션을 발행하고 계약 확인 때 한 번 소비한다.
- 이메일 초대 링크와 OTP가 같은 메일함으로 전달되므로 이를 독립적인 2단계 인증으로 표시하지 않는다.
- OTP 해시와 `PENDING` 전달상태를 기록한 직후 실행이 중단되면 같은 requestId를
  성공으로 표시하지 않는다. 60초 cooldown 뒤 새 requestId와 새 OTP를 요청해 이전
  challenge를 교체한다.

고객 안내:

> 이 절차는 이메일 일회용 인증번호와 성명 입력으로 계약 의사를 확인합니다. 공인전자서명 또는 정부가 보증하는 본인확인으로 표시하지 않습니다.

`ACTIVE_CRYPTO_VERSION`을 바꾸면 현재 lookup 버전도 바뀌어 미완료 초대링크와
인증 세션이 무효화된다. 회전 전 신규 발행을 중단하고 pending acceptance를
재조정한 뒤 미완료 계약을 목록화한다. 고객·스폰서에게 기존 링크 만료를 안내하고,
새 pepper와 active version을 설정한 뒤 모든 미완료 signer에게 새 초대를 발행한다.
완료 계약의 증거와 감사기록을 확인하기 전 기존 pepper를 임의로 삭제하지 않는다.

## 11. 상태와 재시도

계약 상태:

```text
DRAFT → ISSUED
ISSUED → CLIENT_VERIFIED 또는 SPONSOR_VERIFIED
CLIENT_VERIFIED + 스폰서 확인 → COMPLETED
SPONSOR_VERIFIED + 고객 확인 → COMPLETED
ISSUED/부분확인 → EXPIRED 또는 TERMINATED
```

라이프·커리어·비즈니스 2자 계약은 고객 확인이 끝나면 `COMPLETED`다.

법적 계약 완료, PDF 생성과 이메일 전달은 서로 다른 상태다.

```text
contract.status = COMPLETED
finalizationStatus = PENDING / GENERATING / READY / FAILED / CLEANUP_FAILED
deliveryStatus = PENDING / SENT / FAILED / RETRY_SCHEDULED
```

Sheet·Drive·Mail을 묶는 단일 트랜잭션은 없다. PDF 작업은 lease를 획득하고, 이메일은 제한된 at-least-once 방식으로 재시도한다. 중복 메일 가능성을 완전히 없앴다고 표현하지 않는다.

최종화 lease가 만료되면 계약번호·비공개 폴더·결정적 파일명을 함께 확인해 원장에
참조되지 않은 생성물을 먼저 정리한다. 정리에 실패하면 `CLEANUP_FAILED`로 전환해
자동 재생성을 막고 운영자 확인을 요구한다. `READY`인데 전달상태가 비어 있거나
`NOT_READY`에 머문 작업도 재조정기가 고객·스폰서·운영자별로 다시 예약한다.

## 12. 해시

- `documentHash`: 발행 당시 canonical 계약 데이터와 계약 전문
- `signerViewHash`: 고객·스폰서별로 실제 표시한 역할별 열람본
- `acceptanceEvidenceHash`: 서명자 역할, 확인시각, 핵심조항 확인, 개인정보 안내와 선택 동의
- `pdfHash`: 최종 PDF blob 바이트

서명자의 확인증거는 원계약 해시와 역할별 열람본 해시를 함께 참조한다. PDF 안에는
`documentHash`와 `acceptanceEvidenceHash`를 넣을 수 있다. PDF 자체의 `pdfHash`를
같은 PDF 안에 넣으면 파일이 바뀌어 다시 해시가 달라지므로 원장과 감사로그에만
저장한다.

## 13. PDF와 이메일

- 원본 Google Docs와 PDF는 비공개 Drive 폴더에 저장한다.
- `링크가 있는 모든 사용자` 공유를 사용하지 않는다.
- 설치 함수가 만든 유형별 Google Docs 템플릿의 필수 marker를 검증하고, 복사본에
  계약번호·제목·버전을 병합한 뒤 계약 조건과 23개 조항을 구성한다.
- 고객용과 스폰서용 사본은 노출 정보가 달라야 한다.
- 스폰서 사본에는 고객 휴대전화, 세션 대화와 비공개 고민을 넣지 않는다. 합의된
  전체 목표는 계약 스냅샷에서 공유가 선택되고 고객의 별도 제공 확인증거가 검증된
  경우에만 포함하며, 그 밖의 목표는 제외한다.
- 이메일 제목에는 계약번호만 넣고 목표·조직 내부정보를 넣지 않는다.
- 이메일 본문에는 계약 종류, 계약번호, 완료일과 문의처만 표시한다.
- 메일 첨부가 실패하면 상태를 기록하고 운영자가 재조정할 수 있어야 한다.

## 14. 계약 관리

전자계약 체결과 별도로 다음 요청을 전자적으로 접수할 수 있어야 한다.

- 법정 청약철회
- 코칭 계약 중도종료
- 계약조건 변경
- 선택 동의 철회
- 개인정보 열람·정정·삭제·처리정지

서명 토큰을 재사용하지 않고 별도 단기 토큰과 이메일 확인을 사용한다. 청약철회와 일반 중도종료는 상태·정산·감사로그에서 구분한다. 접수 후에는 개인정보가 없는 접수번호와 상태를 제공한다.

이 기능이 실제 배포되기 전에는 완료 이메일과 성공 페이지에서 운영 이메일을 통한 접수 방법을 제공하되, 전자적으로 완결된 관리 시스템이라고 표시하지 않는다.

## 15. 정기 운영

매일 또는 운영 빈도에 맞춰:

1. 만료 계약을 확인한다.
2. 만료된 토큰·OTP·인증 세션을 무효화한다.
3. `PENDING`, `FAILED`, 만료된 `GENERATING` 및 `READY` 후 미예약 전달 작업을
   재조정한다.
4. 보유기간 종료 예정 계약을 검토한다.
5. Drive 공유권한 변경을 점검한다.
6. MailApp·Drive·Apps Script 할당량과 실패율을 확인한다.
7. 관리자·편집자 목록을 검토한다.

고객에게 알리지 않을 내부 오류 코드와 최소한의 안전한 메타데이터만 감사로그에 기록한다. 이름·이메일·전화번호·목표·토큰·OTP·세션 대화를 감사로그에 복제하지 않는다.

## 16. 장애·사고 대응

- 토큰 노출 의심: 해당 signer 토큰을 즉시 `REVOKED` 처리하고 새 토큰 발행 여부를 검토한다.
- 이메일 오발송: 링크를 폐기하고 개인정보 사고 대응 절차에 따라 영향 범위를 확인한다.
- 계정 탈취 의심: 배포 중지, 편집자·로그인 세션 검토, pepper 회전, Drive 공유점검 순으로 대응한다.
- PDF 생성 실패: 계약 완료 상태는 유지하고 finalization lease와 실패 코드를 재조정한다.
- 생성물 정리 실패: `CLEANUP_FAILED`를 임의로 해제하지 않고 비공개 폴더의 정확한
  계약번호 파일과 원장 참조를 대조한 뒤 수동 복구한다.
- 이메일 전송 실패: 동일 계약을 다시 완료하지 않고 기존 PDF의 전달 작업만 재시도한다.
- OTP 성공 응답 중단: 같은 OTP와 같은 요청 ID의 재시도에서 원문 세션을 저장하지
  않고 결정적으로 인증 세션을 복구하는지 확인한다.
- Sheet 정렬·행 이동: 행 번호를 신뢰하지 않고 lock 획득 후 `contractId`·`signerId`로 다시 찾는다.
- 민감정보 오입력: 접근 제한, 가림 또는 삭제, 필요 시 계약 재발행과 사고기록을 수행한다.

## 17. 배포 후 회귀검수

```bash
node scripts/check-coaching-contracts.mjs
npx html-validate coaching/index.html
npx html-validate coaching/agreement/index.html
npx html-validate coaching/agreement/sign/index.html
npx html-validate coaching/agreement/success/index.html
git diff --check
```

추가 브라우저 검수:

- 360, 390, 768, 1024, 1440px
- 키보드만으로 유형 선택·입력·조항 확인·미리보기·인쇄
- 오류요약에서 각 필드로 이동
- 새로고침·뒤로가기·BFCache에서 개인정보 잔존 여부
- A4 인쇄와 PDF 저장
- 정상·오류·만료·회전·사용완료 토큰
- OTP 오입력·만료·재발송·잠금
- 고객·스폰서 순서가 다른 3자 계약
- PDF 생성 실패와 이메일 전달 재시도
- 청약철회·중도종료·변경·동의철회 요청

## 18. 롤백

정적 사이트:

1. PR 병합 전 기준 SHA를 기록한다.
2. 문제 발생 시 신규 커밋으로 해당 변경을 되돌린다.
3. `main`을 강제로 과거로 이동하지 않는다.
4. `/coaching/` 링크만 제거하더라도 기존 스마트스토어 1:1 코칭 링크는 유지한다.

Apps Script:

1. 새 배포 버전 활성화를 중단한다.
2. 이전 정상 배포 버전을 다시 활성화한다.
3. 토큰·계약 상태를 임의로 되돌리지 않는다.
4. 새 발행을 중단하고 기존 계약의 안전한 조회·사본 제공 경로를 유지한다.
5. 데이터 삭제가 필요한 경우 보유·파기 정책과 사고대응 절차에 따라 별도로 처리한다.
