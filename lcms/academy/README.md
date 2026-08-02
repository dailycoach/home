# RS EDU LMC Academy

Career Intelligence Platform 안에서 운영되는 `Lifetime Management Counselor` 비공개 Cloudflare R2 교육 모듈입니다.

## 과정 정체성

- 과정명: LMC 평생진로상담사
- 영문명: Lifetime Management Counselor
- 등록번호: 민간자격 제2013-1058호
- 과정구조: 12주 · 주 1회 · 회차당 2시간
- 주요영역: 심리학 개요, 적성, 성격, 의사소통, 스트레스, 학습유형, 정서, 우울 관련 이해, 심리건강, 부부·커플관계, 발달, 수료시험
- 운영방식: 오프라인 교육, RS에듀컨설팅 본사, 온라인 Zoom 등 기수별 운영

특정 개강일, 교육장소, 교육비와 제공 특전은 기수별 모집 공지에서 별도로 관리합니다.

## 화면 구조

- `index.html` — LMC 과정 소개와 학습현황
- `course.html?course=lmc-lifetime-management-counselor` — 자격정보·교육특전·강사진·12주 이론/실습 상세
- `enter.html` — 이메일·8자리 입장코드 인증
- `lesson.html?course=lmc-lifetime-management-counselor&module=0` — 1주차 영상강의와 학습기록
- `lesson.html?course=lmc-lifetime-management-counselor&module=11` — 12주차 수료시험·학기말 수료식

## 콘텐츠 데이터

### `data/courses.json`

LMC 과정 기본정보, 정확한 12주 커리큘럼, 12주차 수료 흐름을 관리합니다.

핵심 필드:

- `qualificationName`, `qualificationNumber`, `credentialNotice`
- `scheduleSummary`, `deliveryOptions`, `cohortNotice`
- `benefits`, `instructors`, `ethicsNotice`
- `modules[].week`
- `modules[].title`
- `modules[].theory`
- `modules[].practice`
- `modules[].recommendedFor`
- `completion.examUrl`, `completion.satisfactionSurveyUrl`, `completion.completionApplicationUrl`
- `learningGoals`, `reflectionQuestions`, `completion.reflectionQuestions`

### `data/media-catalog.json`

1~11주 영상의 고정 R2 object key와 업로드 상태를 관리합니다.

- 버킷: `rsedu-lmc-videos` (Public access 금지)
- object key: `lmc/week-01.mp4` ~ `lmc/week-11.mp4`
- 업로드 전: `pending_upload`
- 실제 R2 업로드 검증 후: `published`
- 12주차에는 영상 항목이나 `lmc/week-12.mp4`를 만들지 않습니다.

## 비공개 재생 흐름

브라우저에 R2 자격증명이나 정적 object URL을 두지 않습니다.

1. `access.js`가 Worker `POST /access`를 통해 Apps Script 로그인 세션을 확인합니다.
2. `r2-player.js`가 현재 차시에 대해서만 Worker `POST /authorize`를 호출합니다.
3. Worker가 Apps Script `action=workerValidate`로 세션·결제·접근상태·기간을 서버 검증합니다.
4. 검증된 1~11주 요청에만 최대 4시간의 HMAC 서명 재생주소를 발급합니다.
5. Worker `GET /media/:course/:week`가 HTTP Range를 R2에 전달합니다.
6. HTML5 video가 재생 위치를 5초 단위로 저장하고 종료 시 차시를 자동 완료합니다.

구체적인 배포·Secret·업로드 절차는 다음 문서를 기준으로 합니다.

- `apps-script/README.md`
- `r2-worker/README.md`

## 학습기록 MVP

브라우저 localStorage의 `rsedu-academy-progress:v2:{opaqueStudentId}` 키에
인증된 수강생별로 다음을 저장합니다.

- 완료한 LMC 차시
- 최근 본 차시
- 차시별 나의 한 문장
- 1~11주 마지막 재생 위치

공개 과정 안내 화면은 유효한 수강생 세션이 없으면 기존 진도나 메모를 읽지
않습니다. 기존 v1 기록은 인증된 수강생 ID가 확인된 최초 1회에만 해당 수강생
키로 이전되고, 이후 다른 수강생에게 다시 이전되지 않습니다. 회원 시스템을
연결할 때 동일한 데이터 구조를 서버 저장 방식으로 이전할 수 있습니다.

로그인 세션은 최대 12시간, 수강기간은 결제 확인 및 발급 시점부터 180일입니다. 재생주소는 세션과 수강기간보다 길게 발급되지 않습니다.

## 보안 한계

비공개 버킷, 서버 세션 검증, 짧은 HMAC 재생주소는 무단 링크 공유를 줄이지만 재생 가능한 영상을 이용한 화면녹화까지 완전히 막지는 못합니다. 민감한 고정 워터마크가 필요하면 업로드 전 영상 원본에 적용합니다.

## 표현 및 윤리 기준

- 심리측정 교육은 자기이해와 상담코칭 활용을 위한 교육으로 안내합니다.
- 의료적 진단이나 치료를 대신한다는 표현을 사용하지 않습니다.
- 수료와 자격증 발급은 시험·발급 요건 충족을 전제로 표기합니다.
- 과거 기수의 날짜·장소·교육비를 현재 모집정보처럼 고정 노출하지 않습니다.

## 디자인 원칙

`../shared-platform-shell.css`, `../CIP_DESIGN_REFERENCE.md`, `lmc.css`를 기준으로 합니다.

- 밝은 미네랄 블루 배경
- 딥네이비
- 흰색 라운드 카드
- 오렌지·그린·블루·퍼플 심리학 영역 흐름
- Platform·사업실적·Academy 공통 단일 헤더
