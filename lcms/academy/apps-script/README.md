# LMC Academy 자동화 설치

이 소스는 `RS 온라인강의 자동화 운영DB v1.0`을 기준으로 다음 흐름을 연결합니다.

> 스마트스토어 구매 → Google Form 신청 → 수강생 시트 등록 → 결제확인 → 입장코드 메일 → 강의실 로그인 → Cloudflare R2 영상 재생

## 1. 설치 위치

1. 운영DB 스프레드시트를 엽니다.
2. **확장 프로그램 → Apps Script**를 엽니다.
3. Apps Script 프로젝트에 `Code.gs`, `Provisioning.gs`, `Api.gs`, `DataHelpers.gs`, `Expiry.gs` 파일을 만들고 이 폴더의 동명 소스를 붙여 넣습니다.
4. 프로젝트 설정에서 `appsscript.json` 표시를 켠 뒤 이 폴더의 manifest로 교체합니다.
5. `setupAcademyAutomation()`을 1회 실행하고 요청 권한을 승인합니다.

설치 함수는 아래 작업을 수행합니다.

- Script Properties 비밀값 생성
- LMC 수강생 등록 Google Form 생성
- Form 응답을 운영DB와 연결
- 신청완료 메시지에 `https://daily-coach-ing.com/lcms/academy/enter.html` 삽입
- Form 제출 트리거 설치
- 수강생 시트 결제상태 변경 트리거 설치
- 매일 새벽 수강기간 만료 계정의 입장코드·세션을 회수하는 트리거 설치
- 과정설정 시트와 스마트스토어 구매안내 문구에 신청서 URL 입력

## 2. Apps Script 웹앱 배포

Apps Script에서 **배포 → 새 배포 → 웹 앱**을 선택합니다.

- 실행 사용자: **본인**
- 액세스 권한: **모든 사용자**

배포 후 `syncDeploymentUrl()`을 실행합니다. 함수가 표시하는 URL은 운영DB나 소스에 저장하지 않고 Cloudflare의 Secret 입력창으로만 옮깁니다.

그 URL은 Cloudflare Worker Secret `ACCESS_API_URL`에만 입력합니다. 정적
`access-config.js`에는 Apps Script 주소를 넣지 않습니다. 브라우저 로그인 요청도
Worker의 `POST /access`를 거쳐 Apps Script `doPost`로 전달되므로 이메일,
입장코드, 세션토큰이 URL이나 JSONP 스크립트 주소에 남지 않습니다.

사이트 `lcms/academy/access-config.js`에는 공개 가능한 Worker 주소만 입력합니다.

```js
playbackWorkerUrl: 'https://배포한-Worker-주소'
```

Worker 주소가 비어 있는 상태에서는 입장 페이지가 “인증 서버 연결 준비 중”으로 표시되며 실제 로그인이 열리지 않습니다.

## 3. Cloudflare R2 Worker 연결

`../r2-worker/README.md`에 따라 다음을 진행합니다.

1. 비공개 R2 버킷 `rsedu-lmc-videos` 생성
2. R2 Worker 배포
3. Apps Script의 Script Properties에 생성된 `WORKER_SHARED_SECRET` 값(32자 이상)을 Cloudflare Worker의 `ACCESS_API_SECRET` Wrangler Secret으로 동일하게 등록
4. `PLAYBACK_SECRET`을 별도의 Wrangler Secret으로 등록
5. 배포된 Worker 주소를 `access-config.js`에 입력

`WORKER_SHARED_SECRET`은 **Apps Script → 프로젝트 설정 → 스크립트 속성**에서 확인합니다. 값을 시트나 소스에 옮기지 말고 Cloudflare의 Secret 입력창에만 붙여 넣습니다.

```bash
cd lcms/academy/r2-worker
npx wrangler secret put ACCESS_API_SECRET
```

```js
playbackWorkerUrl: 'https://lmc-r2-video-gateway.<계정>.workers.dev'
```

## 4. 1차 운영 방식

Naver Commerce API를 연결하기 전에도 운영할 수 있습니다.

1. 구매자가 Google Form을 제출합니다.
2. 신청정보가 `수강생` 시트에 `결제대기`로 등록됩니다.
3. 운영자가 스마트스토어 주문을 확인합니다.
4. `수강생!K` 결제상태를 `확인완료`로 변경합니다.
5. 8자리 입장코드와 180일 수강기간을 생성하여 이메일로 발송합니다.
6. 수강생은 입장 페이지에서 이메일·코드로 로그인합니다.
7. 강의실이 Worker에 현재 세션을 확인시킨 뒤 짧은 R2 재생주소를 발급받습니다.

Worker는 Apps Script 웹앱에 JSON `POST` 요청을 보냅니다.

```json
{
  "action": "workerValidate",
  "token": "수강 세션",
  "courseId": "lmc-lifetime-management-counselor",
  "workerSecret": "ACCESS_API_SECRET",
  "userAgent": "브라우저 사용자 에이전트"
}
```

Apps Script는 공유 비밀값, 활성 세션, 세션 만료시각, 결제상태, 접근상태, 수강기간, 과정코드, 로그인 브라우저 지문을 모두 확인합니다. 정상일 때만 `valid: true`와 최소한의 수강정보를 반환하며, 실패 응답에는 수강생 식별정보를 넣지 않습니다.

`취소` 또는 `환불`로 변경하면 입장코드와 활성 세션을 회수합니다. 수강기간이 끝난 계정은 로그인·세션 확인 시 즉시 만료되며, 매일 새벽 자동점검에서도 다시 확인합니다.

## 5. 테스트

저장소에서 결정론적 접근 판정과 원문 비저장 회귀검사를 먼저 실행합니다.

```bash
node lcms/academy/apps-script/test-access-validation.mjs
```

실제 운영 전에 테스트 주문 1건으로 전체 흐름을 검수합니다.

- Form 제출 후 수강생 행 생성
- 같은 상품주문번호 중복 차단
- `확인완료` 변경 후 입장코드 메일 도착
- 이메일·입장코드 로그인
- Worker `/authorize` 세션 확인
- R2 MP4 재생과 구간 이동
- 새로고침 후 마지막 재생 위치 이어보기
- 영상 종료 후 학습 완료
- 로그아웃·세션만료
- `환불` 변경 후 새 재생주소 발급 차단
- 만료된 `/media/` 주소 재사용 차단

스프레드시트 메뉴 **LMC 자동화 → 자동화 자체점검**으로 Form·웹앱·트리거 상태를 점검할 수 있습니다. **만료권한 지금 점검** 메뉴로 예정된 일일 만료 작업을 즉시 시험할 수 있습니다.

## 6. 보안 원칙

- R2 버킷은 Public access를 켜지 않습니다.
- 입장코드 원문은 시트에 저장하지 않고 해시와 힌트만 저장합니다.
- 세션 토큰 원문도 시트에 저장하지 않습니다.
- `CODE_PEPPER`, `SESSION_PEPPER`, `SYNC_SECRET`, `WORKER_SHARED_SECRET`은 Apps Script Properties에만 저장합니다.
- Worker의 `ACCESS_API_SECRET`은 Apps Script의 `WORKER_SHARED_SECRET`과 같은 값으로 설정하며, 어느 시트에도 기록하지 않습니다.
- `PLAYBACK_SECRET`은 Cloudflare Wrangler Secret에만 저장합니다.
- Naver Client Secret은 시트나 정적 웹페이지에 넣지 않습니다.
- Worker는 1~11주의 고정 object key만 허용합니다.
- R2 재생주소는 최대 4시간 후 만료되고 허용된 사이트 Origin에서만 재생됩니다.
- 취소·환불·수강기간 만료 시 코드 해시와 활성 세션을 폐기합니다.

## 7. 완전 자동 결제확인

`doPost()`에는 추후 주문확인 시스템이 호출할 `confirmPayment` 훅이 포함되어 있습니다. Naver Commerce API 앱 승인과 Client ID·Secret 발급 후 서버 또는 GitHub Actions에서 주문상태를 검증한 다음, `SYNC_SECRET`을 사용해 이 웹앱을 호출합니다.

정적 웹페이지나 Apps Script 클라이언트 코드에 Naver Client Secret을 넣어서는 안 됩니다.
