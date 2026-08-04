# LMC Video Upload Runbook v2

현재 상태는 실영상 사전검수·R2 업로드·Worker/Apps Script 운영 E2E 완료 단계입니다. 사전검수 77/77, R2 객체 77개, 카탈로그 `published` 77개입니다. 정적 강의실은 기능 브랜치가 `main`에 병합되기 전이라 아직 공개되지 않았습니다.

## 1. 로컬 사전검사

```bash
node lcms/academy/r2-worker/scripts/preflight-segmented-videos.mjs --catalog-only
node lcms/academy/r2-worker/scripts/preflight-segmented-videos.mjs /absolute/path/to/77-videos
```

실패가 하나라도 있으면 업로드하지 않습니다. 확정 검사결과는 `video-upload-map.json`, `video-upload-map.csv`, `LMC_77_SHA256SUMS.txt`, `docs/LMC_77_PREFLIGHT_REPORT.md`에 보관합니다. 새 교정본이 생기면 다음 명령으로 확정 매니페스트를 다시 반영합니다.

```bash
node scripts/apply-lmc-preflight-manifest.mjs /absolute/path/to/LMC_77_UPLOAD_MANIFEST_FINAL.json
```

## 2. Cloudflare 준비

1. R2 활성화와 결제 프로필 확인
2. 비공개 버킷 `rsedu-lmc-videos` 생성 또는 존재 확인
3. Public access 비활성 확인
4. Worker secret `PLAYBACK_SECRET`, `ACCESS_API_URL`, `ACCESS_API_SECRET` 등록
5. Apps Script Script Properties의 `WORKER_SHARED_SECRET`과 `ACCESS_API_SECRET` 일치

비밀값은 채팅·GitHub·스프레드시트·정적 JS에 입력하지 않습니다.

## 3. 업로드

검토한 뒤 `r2-worker/upload/upload-commands.sh`의 Wrangler 명령 또는 주석 처리된 rclone 대안을 사용합니다. 계정 ID·토큰·비밀키는 외부 런타임 설정으로만 제공합니다.

업로드 순서는 WEEK-01 PART-01부터 WEEK-11 PART-07까지 매핑 파일 순서를 따릅니다. WEEK-12 파일은 만들지 않습니다.

## 4. 객체 검증

각 객체에 대해 다음을 확인합니다.

- object key 정확성
- 크기와 SHA-256 일치
- Content-Type `video/mp4`
- 비공개 직접 URL 차단
- Worker HEAD 200
- Worker Range 206와 Content-Range
- 시작·중간 seek·종료 재생
- Chrome·Safari·모바일 재생
- 음량·화면·고정 워터마크 최종 확인

2026-08-04 운영 검증에서는 테스트 주문으로 로그인 세션을 만든 뒤 77개 모두 `authorize 200`, `HEAD 200`, `Range 206`, 정확한 `Content-Range`와 카탈로그 크기 일치를 확인했습니다. 재검사는 입장코드를 로그나 셸 이력에 남기지 않는 환경변수 전달 방식으로 실행합니다.

```bash
LMC_E2E_EMAIL='test@example.com' LMC_E2E_CODE='8자리코드' npm run verify:e2e
```

## 5. 상태 전환

객체를 올린 직후 `uploaded_unverified`, 기술·재생 검증 후 `verified`, 운영 승인 후에만 `published`로 전환합니다. 현재 77개는 이 순서를 거쳐 `published`이며 `media-catalog.json`과 `src/media-catalog.js`가 일치합니다.

## 6. 운영 연결

1. Apps Script 설치·Web App 배포
2. Worker secret 연결 후 Worker 배포
3. 배포된 Worker HTTPS origin을 `access-config.js`에 입력
4. 테스트 주문 1건으로 구매→신청→결제확인→메일→로그인→재생→완료 검증
5. 취소·환불·수강기간 만료·로그아웃 차단 확인
6. Cloudflare 사용량 알림·과금 상태 확인

운영 승인 전 `main` 병합과 실제 수강생 공개를 수행하지 않습니다.
