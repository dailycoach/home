# LMC Cloudflare R2 비공개 영상 게이트

이 Worker는 비공개 R2 버킷의 MP4를 직접 공개하지 않고 다음 순서로 재생합니다.

> LMC 입장코드 로그인 → Apps Script 세션 확인 → 4시간 재생주소 발급 → R2 Range 스트리밍

## 1. Cloudflare 계정에서 최초 1회

```bash
cd lcms/academy/r2-worker
npm install
npx wrangler login
npx wrangler r2 bucket create rsedu-lmc-videos
```

R2 버킷은 **Public access를 켜지 않습니다.** Worker의 `VIDEOS` binding만 버킷에 접근합니다.

## 2. Worker 설정

`wrangler.jsonc`의 `ACCESS_API_URL`을 배포된 Google Apps Script 웹앱 URL로 바꿉니다.

```json
"ACCESS_API_URL": "https://script.google.com/macros/s/배포_ID/exec"
```

재생주소 서명 비밀값을 등록합니다.

```bash
npx wrangler secret put PLAYBACK_SECRET
```

32자 이상의 무작위 문자열을 입력합니다. GitHub, 스프레드시트, 정적 JS에는 저장하지 않습니다.

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

LMC 영상 총량이 4GB 미만이면 R2 무료 저장 10GB-month 범위 안입니다. Worker 무료 플랜은 하루 100,000요청이며, R2 Standard는 월 Class A 100만 회와 Class B 1,000만 회가 무료입니다. R2 인터넷 전송비는 없습니다.

영상 재생은 브라우저의 Range 요청 수만큼 Worker와 R2 읽기 요청을 사용합니다. 초기 소규모 기수에는 충분하지만, 수강생이 크게 증가하면 Cloudflare 사용량 알림을 설정하고 요청량을 점검합니다.

## 7. 보안 주의

- R2 버킷 Public access 금지
- `PLAYBACK_SECRET`은 Wrangler Secret만 사용
- `ACCESS_API_URL`은 Apps Script 인증 웹앱만 사용
- 영상 object key를 임의 입력받지 않고 Worker 내부 1~11주 매핑만 허용
- 재생주소는 최대 4시간 후 만료
- 허용 Origin은 `daily-coach-ing.com`만 유지
- 완전한 화면녹화 방지는 불가능하므로 영상 자체 고정 워터마크를 권장
