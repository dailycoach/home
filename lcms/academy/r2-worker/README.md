# LMC private R2 gateway v2

77개 LMC 분할영상을 비공개 Cloudflare R2에서 전달하는 Worker입니다.

## 경로

- `GET /health`
- `POST /access` — 브라우저 로그인·검증·로그아웃을 Apps Script에 POST 프록시
- `POST /authorize` — `courseId + week + part` 검증 후 단기 URL 발급
- `GET|HEAD /media/:course/:week/:part` — HMAC 검증 후 R2 Range/HEAD 전달

## 고정 미디어 카탈로그

`src/media-catalog.js`는 공개 데이터 카탈로그에서 생성한 77개 allowlist입니다. 요청자가 object key를 전달하거나 조합할 수 없습니다. Worker는 카탈로그에서 다음을 확인합니다.

1. 과정 ID 일치
2. week 1~11
3. 해당 주차에 존재하는 part
4. mediaId·object key 고정 매핑
5. 상태가 `published`
6. WEEK-12 미디어 없음

HMAC payload는 `courseId|week|part|mediaId|objectKey|expiresAt`입니다.

## Secret과 binding

- `PLAYBACK_SECRET` — 32자 이상 HMAC 비밀값
- `ACCESS_API_URL` — Apps Script Web App HTTPS URL
- `ACCESS_API_SECRET` — Apps Script `WORKER_SHARED_SECRET`과 동일한 32자 이상 값
- `VIDEOS` — 비공개 R2 버킷 `rsedu-lmc-videos`
- `PLAYBACK_TTL_SECONDS` — 기본·최대 14,400초

비밀값과 Apps Script URL은 정적 JS·GitHub·스프레드시트·채팅에 기록하지 않습니다.

## 로컬 검증

```bash
npm ci
npm test
npm run preflight:catalog
npm run check
```

실제 영상 폴더 점검:

```bash
npm run preflight:videos -- /absolute/path/to/verified-videos
```

검사는 77개 파일, 주차별 수량, MP4/H.264/AAC, 영상·음성 트랙, Fast Start, 러닝타임 오차, 해상도, FPS, 크기, SHA-256, 전체 4GB 미만을 확인하며 업로드나 카탈로그 상태 변경을 수행하지 않습니다.

## 배포 금지 상태

`access-config.js`의 Worker URL이 비어 있고 77개 미디어가 `pending_upload`인 동안 운영 배포·재생은 준비 상태입니다. 실제 배포는 `docs/LMC_VIDEO_UPLOAD_RUNBOOK_V2.md`의 승인 절차 이후에만 수행합니다.
