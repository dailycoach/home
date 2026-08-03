# LMC Access and Security v2

## 신뢰 경계

브라우저가 신뢰할 수 있는 값은 없습니다. `courseId`, `week`, `part`, 세션토큰을 받더라도 Worker가 고정 카탈로그와 Apps Script를 통해 모두 재검증합니다. 클라이언트는 object key를 전달하지 않습니다.

## 권한 순서

1. Origin allowlist
2. 과정 ID
3. week 1~11
4. 해당 주차 part 존재
5. mediaId·object key 고정 매핑
6. `published` 상태
7. Apps Script 세션·결제·접근상태·수강기간
8. 만료시각
9. HMAC
10. R2 HEAD 또는 Range/GET

WEEK-12, week 0·13, 존재하지 않는 part, 다른 주차 part, 임의 object key를 차단합니다.

## 재생주소

- 기본·최대 TTL: 4시간
- HMAC: `courseId|week|part|mediaId|objectKey|expiresAt`
- localStorage·sessionStorage·분석로그·오류 메시지에 signed URL 저장 금지
- 현재 탭의 메모리 cache에서만 재사용
- 만료 오류 시 현재 위치를 저장하고 세션이 유효할 때 새 URL 발급
- 로그아웃 시 memory cache 삭제와 신규 발급 차단

## 수강생 진도

- localStorage key는 불투명 `studentId`로 분리
- 이메일·전화번호·입장코드 원문을 key에 사용하지 않음
- 수강생 전환 시 다른 수강생의 진도·메모 미노출
- 브라우저 진도는 공식 출결·수료 증거가 아님

## 비밀값

`PLAYBACK_SECRET`, `ACCESS_API_URL`, `ACCESS_API_SECRET`, `WORKER_SHARED_SECRET`은 Cloudflare secret 또는 Apps Script Script Properties에서만 관리합니다. 정적 파일과 Git history에 기록하지 않습니다.

## 한계

HTML5 `nodownload`, 비공개 R2, Origin, HMAC은 무단 링크와 임의 object 접근을 줄이지만 화면녹화·외부 촬영을 완전히 방지하지 않습니다. 운영 시 영상 원본 워터마크를 함께 사용합니다.
