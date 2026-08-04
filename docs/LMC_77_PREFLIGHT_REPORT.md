# LMC 77파트 실영상 업로드 사전검수 보고서

- 검수일: 2026-08-04
- 과정: LMC 평생진로상담사
- 대상: WEEK-01~11, 총 77개 MP4
- WEEK-12 영상: 없음
- R2 버킷: `rsedu-lmc-videos`
- 객체 키: `lmc/v2/week-NN/LMC_WEEKNN_PNN_<업로드 파일명>.mp4`
- R2 수동 업로드: 77개 객체명·Content-Type 확인
- 카탈로그 상태: 77개 `published`
- Worker 운영 배포: `https://lmc-r2-video-gateway.ros2468.workers.dev`
- Worker 현재 버전: `6ee5dd64-7ac8-418d-a657-eef5207a311e` (트래픽 100%)
- Worker `/health`: 정상
- Worker Secret: `ACCESS_API_URL`, `ACCESS_API_SECRET`, `PLAYBACK_SECRET` 등록·동기화 완료
- Apps Script 프로젝트: 운영DB 연결 완료
- Apps Script 소스: 5개 모듈과 manifest 원격 대조 일치
- Apps Script 설치 함수: `setupAcademyAutomation()` 실행·권한 승인 완료
- Apps Script 운영 배포: 고정 버전 1 · 익명 웹앱 배포 완료
- Apps Script `/health`: HTTP 200 · `formReady=true` · `playbackMode=CLOUDFLARE_R2_WORKER`
- Apps Script↔Worker 공유비밀 검증: 정상
- 테스트 주문 E2E: 신청→결제확인→메일→로그인→77개 서명 URL→로그아웃 통과

## 결과 요약

| 항목 | 결과 |
|---|---:|
| 기준 영상 | 77개 |
| 최종 통과 | 77개 |
| 총 용량 | 3,181,566,158 bytes (3.182 GB) |
| 예상 러닝타임 | 74,669초 |
| 실제 러닝타임 | 74,668.105초 |
| 전체 러닝타임 차이 | -0.895초 |
| H.264 비디오 | 77/77 |
| AAC 오디오 | 77/77 |
| Fast Start | 77/77 |
| 러닝타임 허용오차 ±2초 | 77/77 |
| 파일명 정규화 | 51개 |
| Fast Start 교정 | 35개 |
| 누락·중복 파트 | 0개 |
| 운영 Worker 권한승인 | 77/77 HTTP 200 |
| 운영 Worker HEAD | 77/77 HTTP 200 |
| 운영 Worker Range | 77/77 HTTP 206 |
| 운영 객체 크기 대조 | 77/77 카탈로그 일치 |

주차별 파트 수는 `5·7·8·6·8·7·7·8·7·7·7`이며 전체 77개입니다.

## 교정 내용

- WEEK-01과 WEEK-05에서 발견된 동일 크기 중복본 13개는 기준본에서 제외했습니다.
- 실제 생성 파일명과 PR #99 매핑이 다른 51개를 주차·파트 기준으로 확정 파일명에 맞췄습니다.
- Fast Start가 적용되지 않은 35개는 `-c copy -movflags +faststart` 방식으로 컨테이너만 재배치했습니다.
- 영상·음성은 재인코딩하지 않아 화질·음질 손실이 없습니다.
- 교정 전 원본 버전은 보존했습니다.

## 해상도

- WEEK-05: 1212×720
- 나머지 영상: 1280×720
- 전 영상 FPS: 25

해상도 차이는 기술검수 실패 조건이 아니며 H.264/AAC·러닝타임·Fast Start 조건을 모두 충족합니다.

## 운영 E2E 기록

- 테스트 주문번호: `CODEX20260804001`
- 테스트 수강생: `LMC 배포검증`
- 테스트 데이터는 운영DB `수강생` 시트에 보존했습니다.
- 입장코드와 세션토큰은 보고서·Git·정적 파일에 저장하지 않았습니다.
- `scripts/verify-e2e-playback.mjs`가 운영 Worker의 `/access` 로그인 후 77개 `/authorize` 응답을 받아 각 서명 URL을 `HEAD`와 `bytes=0-0`으로 검사했습니다.
- 결과: `authorized200=77`, `head200=77`, `range206=77`, 로그아웃 정상.

## 남은 공개 전 단계

- 기능 브랜치가 아직 `main`에 병합되지 않아 `https://daily-coach-ing.com/lcms/academy/enter.html`은 현재 404입니다.
- Chrome·Safari·모바일에서 시작·중간 seek·종료 시각/음향 확인
- 취소·환불·기간만료 시 신규 서명 URL 발급 차단 운영 확인
- Cloudflare 사용량 알림·과금 상태 확인
- 명시적 승인 후 `main` 병합과 정적 사이트 공개

R2·Worker·Apps Script 백엔드는 운영 배포와 77개 E2E 검증을 마쳤지만, 정적 강의실은 `main` 병합 전까지 공개되지 않습니다.
