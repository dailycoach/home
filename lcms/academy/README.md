# RS EDU LMC Academy

Career Intelligence Platform 안에서 운영되는 `Lifetime Management Counselor` 유튜브 연동형 교육 모듈입니다.

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
- `lesson.html?course=lmc-lifetime-management-counselor&module=0` — 영상 업로드 전 차시 미리보기
- `lesson.html?course=lmc-lifetime-management-counselor&video=<video-id>` — 실제 영상강의와 학습기록

## 콘텐츠 데이터

### `data/courses.json`

LMC 과정 기본정보와 유튜브 재생목록 ID를 관리합니다.

핵심 필드:

- `qualificationName`, `qualificationNumber`, `credentialNotice`
- `scheduleSummary`, `deliveryOptions`, `cohortNotice`
- `benefits`, `instructors`, `ethicsNotice`
- `playlistId`
- `modules[].week`
- `modules[].title`
- `modules[].theory`
- `modules[].practice`
- `modules[].recommendedFor`
- `learningGoals`, `reflectionQuestions`

### `data/youtube-cache.json`

YouTube Data API에서 읽어온 차시 데이터를 보관합니다. 브라우저가 API를 직접 호출하지 않고 이 캐시만 읽습니다.

## 영상 업로드 전 운영

`playlistId`가 비어 있어도 12주 전체 차시가 표시됩니다.

- 각 차시의 이론과 실습내용 확인
- 차시별 강의실 이동
- 학습완료 표시
- 나의 한 문장 기록
- 과정 진행률 확인

## YouTube 연결 방법

1. LMC 전용 YouTube 재생목록을 만듭니다.
2. 영상 순서를 1주차부터 12주차 순으로 정리합니다.
3. `courses.json`의 `playlistId`에 재생목록 ID를 입력합니다.
4. GitHub 저장소 Secret에 `YOUTUBE_API_KEY`를 등록합니다.
5. `Sync RS Edu Academy` 워크플로를 수동 실행하거나 자동 실행을 기다립니다.
6. `youtube-cache.json`이 갱신되면 과정상세와 강의실에 실제 영상 차시가 표시됩니다.

## 자동 동기화

`.github/workflows/sync-rsedu-academy.yml`이 다음 경우 실행됩니다.

- 6시간마다
- 수동 실행
- `courses.json`, 동기화 스크립트 또는 워크플로 변경 시

재생목록 ID나 API 키가 없으면 기존 캐시를 유지하고 종료합니다.

## 학습기록 MVP

브라우저 localStorage의 `rsedu-academy-progress:v1` 키에 다음을 저장합니다.

- 완료한 LMC 차시
- 최근 본 차시
- 차시별 나의 한 문장

회원 시스템을 연결할 때 동일한 데이터 구조를 서버 저장 방식으로 이전할 수 있습니다.

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
