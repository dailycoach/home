# LMC Video Upload Runbook v2

현재 상태는 실영상 사전검수 완료·R2 업로드 대기 단계입니다. 사전검수 77/77, R2 객체 0개, 공개 영상 0개, 업로드 대기 77개입니다.

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

## 5. 상태 전환

객체를 올린 직후 `uploaded_unverified`, 기술·재생 검증 후 `verified`, 운영 승인 후에만 `published`로 전환합니다. `media-catalog.json`과 `src/media-catalog.js`의 상태를 동일하게 갱신하고 정적검사와 Worker 테스트를 재실행합니다.

## 6. 운영 연결

1. Apps Script 설치·Web App 배포
2. Worker secret 연결 후 Worker 배포
3. 배포된 Worker HTTPS origin을 `access-config.js`에 입력
4. 테스트 주문 1건으로 구매→신청→결제확인→메일→로그인→재생→완료 검증
5. 취소·환불·수강기간 만료·로그아웃 차단 확인
6. Cloudflare 사용량 알림·과금 상태 확인

운영 승인 전 `main` 병합과 실제 수강생 공개를 수행하지 않습니다.
