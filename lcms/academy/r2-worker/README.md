# LMC Cloudflare R2 비공개 영상 게이트

이 Worker는 비공개 R2 버킷의 MP4를 직접 공개하지 않고 다음 순서로 재생합니다.

> LMC 입장코드 로그인 → Worker 인증 프록시 → Apps Script 세션 확인 → 4시간 재생주소 발급 → R2 Range 스트리밍

## 1. Cloudflare 계정에서 최초 1회

```bash
cd lcms/academy/r2-worker
npm ci
npx wrangler login
npx wrangler r2 bucket create rsedu-lmc-videos
```

R2 버킷은 **Public access를 켜지 않습니다.** Worker의 `VIDEOS` binding만 버킷에 접근합니다.

## 2. Worker 비밀값 설정

배포된 Google Apps Script 웹앱 URL을 Worker Secret으로 등록합니다.

```bash
npx wrangler secret put ACCESS_API_URL
```

입력값:

```text
https://script.google.com/macros/s/배포_ID/exec
```

재생주소 서명 비밀값도 등록합니다.

```bash
npx wrangler secret put PLAYBACK_SECRET
```

32자 이상의 무작위 문자열을 입력합니다.

Worker가 Apps Script에 자신을 증명할 공유 비밀값도 등록합니다.

```bash
npx wrangler secret put ACCESS_API_SECRET
```

여기에 입력하는 값은 Apps Script의 Script Property `WORKER_SHARED_SECRET`과 정확히 같아야 하며 32자 이상이어야 합니다. `ACCESS_API_URL`, `PLAYBACK_SECRET`, `ACCESS_API_SECRET`은 GitHub, 스프레드시트, 정적 JS에 저장하지 않습니다.

Worker는 브라우저의 `POST /access` 로그인·세션확인·로그아웃 요청을 Apps Script로 전달할 때에도 `ACCESS_API_SECRET`을 `workerSecret`으로 추가합니다. 따라서 Apps Script 배포주소, 공유 비밀값, 이메일·입장코드·세션토큰은 정적 JS나 요청 URL에 들어가지 않습니다.

Worker는 `/authorize` 요청을 받으면 Apps Script에 다음 JSON을 서버 간 `POST`로 보냅니다.

```json
{
  "action": "workerValidate",
  "token": "수강 세션",
  "courseId": "lmc-lifetime-management-counselor",
  "workerSecret": "ACCESS_API_SECRET 값",
  "userAgent": "브라우저 사용자 에이전트"
}
```

Apps Script가 `ok: true`, `valid: true`, 동일한 `courseId`, 미래의 `expiresAt`을 모두 반환해야 재생주소가 발급됩니다. 재생주소 만료시각은 4시간과 남은 수강 세션 시간 중 더 이른 시각으로 제한됩니다.

공개 경로는 다음 네 개뿐이며 모두 `/health`를 제외하고 정확한 허용 Origin을 요구합니다.

- `GET /health`
- `POST /access` — 브라우저 로그인·세션확인·로그아웃 프록시
- `POST /authorize` — 현재 1~11주 재생주소 발급
- `GET|HEAD /media/:course/:week` — HMAC·만료·Range 검증 후 R2 응답

## 3. Worker 배포

```bash
npm run check
npm run deploy
```

배포 결과로 나온 주소를 `../access-config.js`에 입력합니다.

```js
playbackWorkerUrl: 'https://lmc-r2-video-gateway.<계정>.workers.dev'
```

## 4. 11개 영상 업로드

고정 object key:

```text
lmc/week-01.mp4
lmc/week-02.mp4
...
lmc/week-11.mp4
```

업로드 전에 영상 폴더를 읽기 전용으로 점검합니다.

```bash
npm run preflight:videos -- /영상/폴더
```

이 점검은 다음을 모두 확인합니다.

- `week-01.mp4`부터 `week-11.mp4`까지 정확히 11개
- `week-12.mp4` 및 잘못된 주차 파일 없음
- 전체 용량 4GB 미만
- MP4 컨테이너, H.264 비디오, AAC 오디오
- `moov` atom이 `mdat`보다 앞에 있는 Fast Start
- 파일별 Wrangler 315MB 이하 또는 multipart 업로드 필요 여부

점검 스크립트는 업로드하거나 `media-catalog.json`을 변경하지 않습니다.
고정 워터마크 적용 여부, 음량 편차, 앞뒤 불필요한 공백은 자동 판정 대상이 아니므로 업로드 전에 사람이 직접 재생해 확인합니다.

각 파일이 315MB 이하이면 Wrangler로 업로드할 수 있습니다.

```bash
npx wrangler r2 object put rsedu-lmc-videos/lmc/week-01.mp4 \
  --file=/경로/week-01.mp4 \
  --content-type=video/mp4 \
  --content-disposition=inline
```

파일이 315MB를 넘거나 여러 영상을 한 번에 올릴 때는 `rclone` 또는 AWS CLI의 S3 호환 업로드를 사용합니다. 대용량 영상은 multipart upload가 안정적입니다.

업로드 완료 후 `../data/media-catalog.json`에서 해당 주차를 변경합니다.

```json
"status": "published"
```

12주는 영상이 아니라 수료시험·학기말 수료식이므로 R2 object를 만들지 않습니다.

## 5. 동작 확인

```bash
npm test
npm run check
curl https://lmc-r2-video-gateway.<계정>.workers.dev/health
```

정상 응답:

```json
{"ok":true,"service":"lmc-r2-video-gateway"}
```

그 다음 실제 LMC 테스트 계정으로 확인합니다.

1. 입장코드 로그인
2. 1주차 강의 진입
3. Worker `/authorize` 성공
4. MP4 재생과 구간 이동
5. 새로고침 후 마지막 위치 이어보기
6. 영상 종료 후 학습 완료 처리
7. 로그아웃·환불·만료 후 재생주소 발급 차단
8. 발급된 `/media/` 주소를 새 창에 직접 붙여넣었을 때 접근 차단

## 6. 무료 구간 기준

LMC 영상 총량이 4GB 미만이면 R2 Standard 무료 저장 10GB-month 범위 안입니다. R2 Standard는 월 Class A 100만 회와 Class B 1,000만 회가 무료이며 인터넷 전송비는 없습니다. 다른 R2 저장 클래스를 선택하지 않습니다.

영상 재생은 브라우저의 Range 요청 수만큼 Worker와 R2 읽기 요청을 사용합니다. 초기 소규모 기수에는 충분하지만, 수강생이 크게 증가하면 Cloudflare 사용량 알림을 설정하고 요청량을 점검합니다.

Cloudflare 예산 알림은 사용량을 알려 주는 기능이며 요청 또는 과금을 자동으로 차단하지 않습니다. R2는 무료 구간 초과분이 월 단위로 과금될 수 있으므로 결제수단과 자동 유료 청구 상태를 계정에서 확인해야 합니다. Workers Free의 일일 100,000요청은 하드 한도이며 초과 시 해당 날짜에 오류 코드 `1027`이 발생할 수 있습니다.

## 7. 보안 주의

- R2 버킷 Public access 금지
- `PLAYBACK_SECRET`은 Wrangler Secret만 사용
- `ACCESS_API_SECRET`은 Wrangler Secret만 사용하고 Apps Script의 `WORKER_SHARED_SECRET`과 일치
- `ACCESS_API_URL`도 Wrangler Secret으로 등록
- 영상 object key를 임의 입력받지 않고 Worker 내부 1~11주 매핑만 허용
- 재생주소는 최대 4시간 또는 남은 세션 시간 후 만료
- 허용 Origin은 `https://daily-coach-ing.com`, `https://www.daily-coach-ing.com`만 유지
- `/media`는 HMAC, 만료시각, 과정코드, 1~11주, 고정 object key를 모두 통과해야 R2에 접근
- 브라우저 Origin 검사는 보조 통제이며 재생주소를 확보한 비브라우저 클라이언트가 Origin 헤더를 흉내 내는 것까지 막는 DRM은 아님
- 만료 전 재생주소의 재사용, 개발자도구를 통한 영상 요청 확인, 완전한 다운로드·화면녹화 방지는 불가능하므로 영상 자체 고정 워터마크를 권장
