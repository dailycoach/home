# LMC QA Report v2

검수일: 2026-08-03

## 현재 자동검사 결과

| 영역 | 결과 |
|---|---|
| Course→Week→Part 데이터 | 12주 · 77파트 통과 |
| 주차별 수량 | 5·7·8·6·8·7·7·8·7·7·7 통과 |
| WEEK-12 영상 | 0개 통과 |
| mediaId·partId·objectKey·파일명 중복 | 0개 통과 |
| 미디어 초기상태 | 77개 `pending_upload` 통과 |
| 실제 영상 합계 | 74,669초 통과 |
| 수강생별 진도 격리 | 14개 확인 통과 |
| Worker 기능·보안 | 17개 테스트 통과 |
| Worker Range 206·HEAD | 단위테스트 통과 |
| signed URL 브라우저 저장소 | local/session storage 0건 통과 |
| Apps Script 회귀 | 52개 확인 통과 |
| JavaScript 문법 | Academy·Access·Player·Worker·Apps Script 통과 |
| 실제 MP4 사전검수 | 77/77 통과 |
| H.264·AAC·Fast Start | 77/77 통과 |
| SHA-256·크기 | 77/77 카탈로그 반영 |
| 실제 총용량 | 3,181,566,342 bytes (3.182 GB) |
| 실제 러닝타임 | 74,668.105초 · 예상값 대비 -0.895초 |
| Wrangler dry-run | PR CI 통과 |
| 7개 뷰포트 시각 QA | 14개 화면·상태 × 7개 = 98개 조합 통과 |

## 데이터 판단

지시서의 전체시간은 약 20시간 44분 25초이며 개별 확정 러닝타임 산술합계는 20시간 44분 29초입니다. 차이는 4초로 허용범위 5초 안이며, 카탈로그는 개별값의 정확 합계 74,669초를 사용합니다.

## 운영환경에서 남은 검증

- R2 직접 URL 비공개
- R2 객체별 크기·SHA-256 일치
- Worker HEAD 200·Range 206·Content-Range
- 실영상 시작·중간 seek·종료와 모바일 재생
- 테스트 주문 1건 end-to-end
- 취소·환불·기간만료·로그아웃 이후 신규 URL 발급 차단
- Cloudflare 사용량·알림·과금 상태

실제 영상 업로드와 운영 배포는 수행하지 않았습니다.

## 로컬 실행 기록

- `node scripts/check-lmc-academy.mjs`: 통과
- `node scripts/test-lmc-progress-scope.mjs`: 14개 통과
- `node lcms/academy/apps-script/test-access-validation.mjs`: 52개 통과
- `node lcms/academy/r2-worker/scripts/preflight-segmented-videos.mjs --catalog-only`: 77개 통과
- `node lcms/academy/r2-worker/scripts/preflight-segmented-videos.mjs /검수영상경로`: 77개 통과
- `node --test lcms/academy/r2-worker/test/worker.test.js`: 17개 통과
- `node --check`: Academy·Access·Player·Worker·Apps Script 통과

로컬에서 실행할 수 없었던 Wrangler와 Chromium 검사는 PR Actions에서 통과했습니다. 실제 MP4는 별도 검수 환경에서 77개 전수검사했고 SHA-256·크기·코덱·Fast Start·러닝타임을 공개 카탈로그에 기록했습니다. 이는 R2 업로드나 운영 재생 검증을 통과했다는 의미가 아닙니다.
