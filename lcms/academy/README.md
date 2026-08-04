# LMC Academy 77파트 강의장

RS에듀컨설팅 `LMC(평생진로상담사) 2급`의 12주 비공개 온라인 강의장입니다.

## 과정 기준

- 과정 ID: `lmc-lifetime-management-counselor`
- 공식 교육과정: 12주 · 총 24시간
- 실제 영상학습: 1~11주 · 77개 파트 · 약 20시간 44분
- 12주차: 영상 없이 수료시험·과정 통합·전체 성찰·만족도 조사·학기말 수료식·자격증 발급 절차
- 기본 공개정책: `all_open`

공식 24시간과 실제 영상 러닝타임은 동일한 수치로 표시하지 않습니다.

## 페이지

- `index.html` — 과정 홈, 입장 상태, 전체 영상진도, 최근 학습
- `enter.html` — 등록 이메일·8자리 입장코드 로그인
- `course.html?course=lmc-lifetime-management-counselor` — 12주 커리큘럼과 77개 파트
- `lesson.html?course=lmc-lifetime-management-counselor&week=1&part=1` — 파트형 강의실
- `lesson.html?course=lmc-lifetime-management-counselor&week=12` — 비영상 수료 주차

## 데이터

- `data/courses.json` — Course → Week → Part 구조, 과정정보, 공개정책, WEEK-12 운영 URL
- `data/media-catalog.json` — 77개 R2 미디어의 고정 ID·object key·러닝타임·게시상태
- `r2-worker/upload/video-upload-map.json|csv` — 로컬 파일과 R2 object key 매핑

미디어 상태는 `pending_upload`, `uploaded_unverified`, `verified`, `published`, `disabled`만 허용합니다. 실제 객체·크기·SHA-256·코덱·Fast Start·Range·모바일 재생이 확인되기 전에는 `published`로 변경하지 않습니다.

## 진도와 이어보기

- 수강생별 불투명 `studentId`로 localStorage namespace 분리
- 파트별 재생위치 5초 단위·pause·pagehide 저장
- 90% 이상 또는 영상 종료 시 자동완료
- 파트별 한 문장 메모 자동저장
- signed URL은 localStorage·sessionStorage에 저장하지 않고 메모리에서만 짧게 재사용

브라우저 진도는 학습 편의를 위한 기록이며 공식 출결·수료·자격증 발급 증거로 단독 사용하지 않습니다.

## 보안 경계

브라우저는 `courseId`, `week`, `part`만 Worker에 요청합니다. Worker는 내부 미디어 카탈로그에서 `mediaId`와 고정 object key를 조회하고 `published` 상태, Apps Script 세션·결제·접근·수강기간, 만료시각과 HMAC을 검증합니다. WEEK-12와 카탈로그에 없는 조합은 차단합니다.

비공개 R2·Origin 제한·서버 세션 검증·만료 HMAC은 임의 링크 접근을 줄이지만 화면녹화나 외부 카메라 촬영을 완전히 막는 DRM은 아닙니다.

## 검증 명령

```bash
node scripts/check-lmc-academy.mjs
node scripts/test-lmc-progress-scope.mjs
node lcms/academy/r2-worker/scripts/preflight-segmented-videos.mjs --catalog-only
node --check lcms/academy/academy.js
node --check lcms/academy/r2-player.js
cd lcms/academy/r2-worker && npm test && npm run check
```

운영 배포와 실제 영상 업로드 절차는 `docs/LMC_VIDEO_UPLOAD_RUNBOOK_V2.md`를 따릅니다.
