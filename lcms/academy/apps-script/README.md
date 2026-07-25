# LMC Academy 자동화 설치

이 소스는 `RS 온라인강의 자동화 운영DB v1.0`을 기준으로 다음 흐름을 연결합니다.

> 스마트스토어 구매 → Google Form 신청 → 수강생 시트 등록 → 결제확인 → 입장코드 메일 → 강의실 로그인 → Vimeo 영상 재생

## 1. Vimeo 사전 설정

유료 강의 영상은 Vimeo 유료 플랜에 업로드하고 각 영상의 공개·임베드 설정을 다음처럼 맞춥니다.

- 영상 공개범위: **Vimeo에서 직접 시청하지 않고 임베드로만 제공**
- 임베드 허용 위치: **특정 도메인**
- 허용 도메인: `daily-coach-ing.com`
- 실제 운영에 `www.daily-coach-ing.com`을 사용한다면 해당 주소도 추가
- 공유 버튼·다운로드 버튼: 비노출
- 12개 영상의 Vimeo 영상 ID를 `data/media-catalog.json`의 해당 주차 `videoId`에 입력
- ID 입력 후 `status`를 `pending_upload`에서 `published`로 변경

Vimeo API 토큰이나 계정 비밀번호는 정적 파일과 GitHub 저장소에 넣지 않습니다. 수동 업로드·ID 매핑 방식에서는 Vimeo API 토큰이 필요하지 않습니다.

## 2. Apps Script 설치 위치

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

Vimeo 영상은 강의장 도메인에서 임베드되는 방식이므로 수강생별 Vimeo 권한을 부여하거나 회수하지 않습니다. 구매자 통제는 LMC 강의실의 입장코드·세션·수강기간으로 처리합니다.

## 3. 웹앱 배포

Apps Script에서 **배포 → 새 배포 → 웹 앱**을 선택합니다.

- 실행 사용자: **본인**
- 액세스 권한: **모든 사용자**

배포 후 `syncDeploymentUrl()`을 실행합니다. 운영DB `설정` 시트의 `APPS_SCRIPT_WEB_APP_URL`에 URL이 기록됩니다.

그 URL을 사이트의 `lcms/academy/access-config.js`에 입력합니다.

```js
apiUrl: 'https://script.google.com/macros/s/배포_ID/exec'
```

웹앱 URL이 비어 있는 상태에서는 입장 페이지가 “인증 서버 연결 준비 중”으로 표시되며 실제 로그인이 열리지 않습니다.

## 4. 1차 운영 방식

Naver Commerce API를 연결하기 전에도 운영할 수 있습니다.

1. 구매자가 Google Form을 제출합니다.
2. 신청정보가 `수강생` 시트에 `결제대기`로 등록됩니다.
3. 운영자가 스마트스토어 주문을 확인합니다.
4. `수강생!K` 결제상태를 `확인완료`로 변경합니다.
5. 8자리 입장코드와 180일 수강기간이 생성됩니다.
6. 입장안내 메일이 자동 발송됩니다.
7. 수강생은 입장 페이지에서 등록 이메일·코드로 로그인합니다.
8. 인증된 강의실 안에서 Vimeo 영상이 재생됩니다.

`취소` 또는 `환불`로 변경하면 입장코드와 활성 세션을 회수합니다. 수강기간이 끝난 계정은 로그인·세션 확인 시 즉시 만료되며, 매일 새벽 자동점검에서도 다시 확인합니다.

## 5. Vimeo 영상 연결 형식

`lcms/academy/data/media-catalog.json`

```json
{
  "week": 8,
  "provider": "VIMEO",
  "videoId": "123456789",
  "title": "8차시 우울과 우울검사",
  "accessPolicy": "EMBED_ONLY_SPECIFIC_DOMAIN",
  "status": "published"
}
```

Vimeo 영상이 비공개 링크 해시를 요구하는 경우 `privacyHash`를 함께 입력할 수 있습니다.

```json
{
  "videoId": "123456789",
  "privacyHash": "abc123def4"
}
```

## 6. 테스트

실제 운영 전에 테스트 주문 1건으로 전체 흐름을 검수합니다.

- Form 제출 후 수강생 행 생성
- 같은 상품주문번호 중복 차단
- `확인완료` 변경 후 입장코드와 수강기간 생성
- 입장코드 메일 도착
- 등록 이메일·입장코드 로그인
- Vimeo 영상 재생
- 5초 단위 재생위치 저장과 이어보기
- 영상 종료 시 학습 완료 자동처리
- 로그아웃·세션만료
- `환불` 변경 후 강의실 접근 차단
- 수강종료일을 과거로 변경한 테스트 계정의 자동 만료
- 허용되지 않은 외부 도메인에서 Vimeo 임베드 차단

스프레드시트 메뉴 **LMC 자동화 → 자동화 자체점검**으로 기본 설정과 Vimeo 영상 매핑 수를 점검할 수 있습니다. **만료권한 지금 점검** 메뉴로 예정된 일일 만료 작업을 즉시 시험할 수 있습니다.

## 7. 보안 원칙

- 유료 영상은 Vimeo의 임베드 전용·특정 도메인 허용 설정을 사용합니다.
- 공개 YouTube 영상만 `YOUTUBE_PUBLIC` 제공방식으로 등록합니다.
- 입장코드 원문은 시트에 저장하지 않고 해시와 힌트만 저장합니다.
- 세션 토큰 원문도 시트에 저장하지 않습니다.
- `CODE_PEPPER`, `SESSION_PEPPER`, `SYNC_SECRET`은 Script Properties에만 저장합니다.
- Vimeo API 토큰과 Naver Client Secret은 시트나 정적 웹페이지에 넣지 않습니다.
- 취소·환불·수강기간 만료 시 코드 해시를 폐기하고 활성 세션을 회수합니다.
- 도메인 제한은 링크 유출을 줄이지만 화면녹화까지 막는 DRM은 아닙니다.

## 8. 완전 자동 결제확인

`doPost()`에는 추후 주문확인 시스템이 호출할 `confirmPayment` 훅이 포함되어 있습니다. Naver Commerce API 앱 승인과 Client ID·Secret 발급 후 서버 또는 GitHub Actions에서 주문상태를 검증한 다음, `SYNC_SECRET`을 사용해 이 웹앱을 호출합니다.

정적 웹페이지나 Apps Script 클라이언트 코드에 Naver Client Secret을 넣어서는 안 됩니다.
