# LMC Academy 자동화 설치

이 소스는 `RS 온라인강의 자동화 운영DB v1.0`을 기준으로 다음 흐름을 연결합니다.

> 스마트스토어 구매 → Google Form 신청 → 수강생 시트 등록 → 결제확인 → Drive 제한공유 → 입장코드 메일 → 강의실 로그인

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
- 매일 새벽 수강기간 만료 계정을 찾아 Drive 권한·세션을 회수하는 트리거 설치
- 과정설정 시트와 스마트스토어 구매안내 문구에 신청서 URL 입력

## 2. 웹앱 배포

Apps Script에서 **배포 → 새 배포 → 웹 앱**을 선택합니다.

- 실행 사용자: **본인**
- 액세스 권한: **모든 사용자**

배포 후 `syncDeploymentUrl()`을 실행합니다. 운영DB `설정` 시트의 `APPS_SCRIPT_WEB_APP_URL`에 URL이 기록됩니다.

그 URL을 사이트의 `lcms/academy/access-config.js`에 입력합니다.

```js
apiUrl: 'https://script.google.com/macros/s/배포_ID/exec'
```

웹앱 URL이 비어 있는 상태에서는 입장 페이지가 “인증 서버 연결 준비 중”으로 표시되며 실제 로그인이 열리지 않습니다.

## 3. 1차 운영 방식

Naver Commerce API를 연결하기 전에도 운영할 수 있습니다.

1. 구매자가 Google Form을 제출합니다.
2. 신청정보가 `수강생` 시트에 `결제대기`로 등록됩니다.
3. 운영자가 스마트스토어 주문을 확인합니다.
4. `수강생!K` 결제상태를 `확인완료`로 변경합니다.
5. 자동화가 등록 Google 계정에 Drive 열람권한을 부여합니다.
6. 8자리 입장코드를 생성하고 이메일로 발송합니다.
7. 수강생은 입장 페이지에서 이메일·코드로 로그인합니다.

`취소` 또는 `환불`로 변경하면 Drive 권한과 활성 세션을 회수합니다. 수강기간이 끝난 계정은 로그인·세션 확인 시 즉시 회수되며, 매일 새벽 자동점검에서도 다시 확인합니다.

## 4. 테스트

실제 운영 전에 테스트 주문 1건으로 전체 흐름을 검수합니다.

- Form 제출 후 수강생 행 생성
- 같은 상품주문번호 중복 차단
- `확인완료` 변경 후 Drive 폴더·영상 권한 추가
- 입장코드 메일 도착
- 신청한 Google 계정으로 8·9차시 영상 재생
- 다른 Google 계정에서 영상 차단
- 로그아웃·세션만료
- `환불` 변경 후 접근 회수
- 수강종료일을 과거로 변경한 테스트 계정의 Drive 권한 자동 회수

스프레드시트 메뉴 **LMC 자동화 → 자동화 자체점검**으로 기본 설정과 Drive 매핑을 점검할 수 있습니다. **만료권한 지금 점검** 메뉴로 예정된 일일 회수 작업을 즉시 시험할 수 있습니다.

## 5. 보안 원칙

- Drive 영상은 `RESTRICTED` 정책을 유지합니다.
- 공개 YouTube 영상만 `YOUTUBE_PUBLIC` 제공방식으로 등록합니다.
- 입장코드 원문은 시트에 저장하지 않고 해시와 힌트만 저장합니다.
- 세션 토큰 원문도 시트에 저장하지 않습니다.
- `CODE_PEPPER`, `SESSION_PEPPER`, `SYNC_SECRET`은 Script Properties에만 저장합니다.
- Naver Client Secret은 시트나 정적 웹페이지에 넣지 않습니다.
- Drive 재생은 입장코드 인증과 Google 계정 권한을 함께 요구합니다.
- 취소·환불·수강기간 만료 시 코드 해시를 폐기하고 Drive 권한과 세션을 회수합니다.

## 6. 완전 자동 결제확인

`doPost()`에는 추후 주문확인 시스템이 호출할 `confirmPayment` 훅이 포함되어 있습니다. Naver Commerce API 앱 승인과 Client ID·Secret 발급 후 서버 또는 GitHub Actions에서 주문상태를 검증한 다음, `SYNC_SECRET`을 사용해 이 웹앱을 호출합니다.

정적 웹페이지나 Apps Script 클라이언트 코드에 Naver Client Secret을 넣어서는 안 됩니다.
