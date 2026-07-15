# RS EDU Academy

Career Intelligence Platform 안에서 운영되는 유튜브 연동형 동영상 강의 모듈입니다.

## 화면 구조

- `index.html` — 과정목록
- `course.html?course=<course-id>` — 과정상세
- `lesson.html?course=<course-id>&video=<video-id>` — 강의재생과 학습기록

## 콘텐츠 데이터

### `data/courses.json`

과정 기본정보와 유튜브 재생목록 ID를 관리합니다.

필수 필드:

- `id`
- `title`
- `subtitle`
- `description`
- `category`
- `audience`
- `level`
- `playlistId`
- `modules`
- `learningGoals`
- `reflectionQuestions`

### `data/youtube-cache.json`

YouTube Data API에서 읽어온 차시 데이터를 보관합니다. 브라우저가 API를 직접 호출하지 않고 이 캐시만 읽습니다.

## YouTube 연결 방법

1. 과정별 YouTube 재생목록을 만듭니다.
2. `courses.json`의 해당 과정 `playlistId`에 재생목록 ID를 입력합니다.
3. GitHub 저장소 Secret에 `YOUTUBE_API_KEY`를 등록합니다.
4. `Sync RS Edu Academy` 워크플로를 수동 실행하거나 자동 실행을 기다립니다.
5. `youtube-cache.json`이 갱신되면 과정상세와 강의실에 차시가 표시됩니다.

## 자동 동기화

`.github/workflows/sync-rsedu-academy.yml`이 다음 경우 실행됩니다.

- 6시간마다
- 수동 실행
- `courses.json`, 동기화 스크립트 또는 워크플로 변경 시

재생목록 ID나 API 키가 아직 없으면 오류를 발생시키지 않고 기존 캐시를 유지합니다.

## 학습기록 MVP

브라우저 localStorage의 `rsedu-academy-progress:v1` 키에 다음을 저장합니다.

- 완료한 차시
- 최근 본 차시
- 강의별 나의 한 문장

회원 시스템을 연결할 때 동일한 데이터 구조를 서버 저장 방식으로 이전할 수 있습니다.

## 디자인 원칙

`../shared-platform-shell.css`와 `../CIP_DESIGN_REFERENCE.md`를 기준으로 합니다.

- 밝은 미네랄 블루 배경
- 딥네이비
- 흰색 라운드 카드
- 오렌지·그린·블루·퍼플 연결 흐름
- Platform·사업실적·Academy 공통 단일 헤더
