# [CODEX EXECUTION ORDER]

# RS에듀컨설팅 LMC Academy
## 77개 PART Zoom 참여자 타일 비식별화 · WEEK별 렌더 · QA · Cloudflare R2 실교체
### v2.0 FINAL

> 이 문서와 `LMC_77_PART_MASK_INTERVALS_v1.0.json`이 이번 작업의 단일 실행 기준이다.
> 이전 WEEK 후보 좌표와 이전 작업지시서는 참고자료일 뿐, 렌더 입력으로 직접 사용하지 않는다.

---

## 0. 최종 미션

LMC 평생진로상담사 WEEK-01~11의 77개 분할 MP4에 대해, 이미 PART 로컬타임으로 확정된 마스킹 구간과 픽셀 좌표를 적용한다.

```text
77개 PART 입력 검증
→ WEEK별 privacy render
→ 기술 QA
→ 개인정보 시각 QA
→ 사람 승인
→ 해당 WEEK R2 기존 objectKey 덮어쓰기
→ HEAD / Range / signed playback 검증
→ 카탈로그 동기화
→ 다음 WEEK 진행
```

최종 완료는 분석이나 좌표 추출이 아니라, **77개 privacy-safe 운영영상이 기존 강의 URL에서 정상 재생되는 상태**다.

---

## 1. 저장소와 대상

```text
Repository: dailycoach/home
Base: main
Working branch: agent/lmc-zoom-tile-privacy-rework
Draft PR: #115
R2 bucket: rsedu-lmc-videos
Worker: lmc-r2-video-gateway
Course ID: lmc-lifetime-management-counselor
```

규칙:

- PR #115의 기존 브랜치에서 계속한다.
- `main` 직접 수정 금지.
- 대용량 MP4는 Git에 커밋하지 않는다.
- Git에는 코드, config, manifest, QA JSON, SHA256, 보고서만 기록한다.
- 강의장 UI, 인증, Apps Script, DB, 진도, 결제, WEEK-12는 수정하지 않는다.
- PR에 남아 있는 `r2-player.css`의 `object-position: left center;` 변경은 제거한다.

---

## 2. 필수 입력

Codex 작업환경에 다음 파일을 배치한다.

```text
LMC_77_PART_MASK_INTERVALS_v1.0.json   # 77개 PART별 최종 로컬타임·좌표
LMC_77_PART_MASK_INTERVALS_v1.0.md     # 사람이 읽는 검수표
```

환경변수:

```bash
export LMC_PART_SOURCE_ROOT="/absolute/path/to/pristine/77-parts"
export LMC_OUTPUT_ROOT="/absolute/path/to/privacy-safe-output"
export LMC_QA_ROOT="/absolute/path/to/privacy-qa"
export LMC_MASK_CONFIG="/absolute/path/to/LMC_77_PART_MASK_INTERVALS_v1.0.json"
```

소스 원칙:

- 입력은 사용자가 별도로 보관한 pristine 77개 PART다.
- 현재 운영 R2에서 내려받은 잘못 마스킹된 파일은 입력으로 사용하지 않는다.
- `filename`으로 pristine 파일을 찾되, 처리 식별자는 `mediaId`를 사용한다.

---

## 3. 가장 중요한 objectKey 정합성 규칙

`LMC_77_PART_MASK_INTERVALS_v1.0.json`의 `objectKey` 필드는 과거 PART manifest를 기반으로 생성됐으므로 **R2 업로드 목적의 권위값으로 사용하지 않는다.**

현재 운영 objectKey의 단일 출처는 반드시 다음 파일이다.

```text
lcms/academy/data/media-catalog.json
```

작업 시작 시 `mediaId`를 키로 다음 JOIN을 수행한다.

```text
MASK JSON.mediaId
JOIN
CURRENT media-catalog.json.mediaId
```

실행용 row는 반드시 현재 카탈로그에서 다음을 가져온다.

```text
objectKey
sourceFilename
week
part
status
```

강제조건:

- MASK JSON 77개 mediaId가 모두 현재 카탈로그에 존재해야 한다.
- 현재 카탈로그 mediaId도 정확히 77개여야 한다.
- 중복 mediaId 0.
- week/part 불일치 0.
- `status=published` 유지.
- 업로드 시 JSON의 과거 objectKey를 사용하면 즉시 실패 처리한다.

생성할 정규화 파일:

```text
artifacts/lmc-privacy-rework/execution-map.json
```

필수 필드:

```json
{
  "mediaId": "lmc-w01-p01",
  "week": 1,
  "part": 1,
  "sourceFilename": "LMC_WEEK01_P01_....mp4",
  "currentObjectKey": "현재 media-catalog.json의 실제 key",
  "decision": "MASK",
  "intervals": []
}
```

---

## 4. 입력 데이터 확정값

```text
TOTAL PARTS: 77
MASK: 75
NO_MASK: 2
```

WEEK별 수량:

```text
W01=5
W02=7
W03=8
W04=6
W05=8
W06=7
W07=7
W08=8
W09=7
W10=7
W11=7
TOTAL=77
```

NO_MASK 파일:

```text
lmc-w05-p06  LMC_WEEK05_P06_stress-case-application-01.mp4
lmc-w05-p07  LMC_WEEK05_P07_stress-case-application-02.mp4
```

복합 마스킹 집중검수 파일:

```text
lmc-w04-p05  intervals=3
lmc-w04-p06  intervals=2
lmc-w08-p05  intervals=3, FULL_FRAME 포함
lmc-w09-p01  intervals=2, 오프닝 FULL_FRAME 포함
lmc-w09-p04  intervals=3, 중간 FULL_FRAME 포함
```

분포:

```text
interval 0개: 2 PART
interval 1개: 70 PART
interval 2개: 2 PART
interval 3개: 3 PART
```

---

## 5. 좌표 적용 계약

### 5.1 좌표는 이미 안전 여백이 포함된 최종값

JSON의 `coordinate.xStart`는 원래 패널 경계에서 좌측 안전 여백 8px을 이미 반영한 값이다.

따라서 렌더러는:

```text
추가 padding = 0
```

으로 처리한다.

기존 스크립트의 `defaultPadding=8`을 다시 적용하면 PPT를 불필요하게 8px 더 가리므로, 이 JSON 입력 모드에서는 추가 padding을 금지한다.

### 5.2 RIGHT_PANEL

```text
x = coordinate.xStart
y = 0
w = 실제 frameWidth - x
h = 실제 frameHeight
opacity = 1.0
color = #000000
```

JSON의 `xEnd`, `width`는 검증용이다. 실제 렌더 시 프레임 우측 끝까지 계산해 1px도 남기지 않는다.

### 5.3 FULL_FRAME

```text
x = 0
y = 0
w = frameWidth
h = frameHeight
opacity = 1.0
color = #000000
```

오디오는 그대로 유지한다.

### 5.4 시간구간

- `startSeconds`, `endSeconds`는 해당 PART의 로컬타임이다.
- 새로 WEEK 절대시간을 계산하지 않는다.
- `endIsFileEnd=true`이면 마지막 프레임까지 반드시 마스크한다.
- 파일 끝 구간은 `between(t,start,end)`만 믿지 말고, 필요하면 `gte(t,start)`를 사용해 컨테이너의 sub-second tail 누출을 막는다.
- 인접 interval 경계에서 1프레임 누출이 생기지 않도록 필터 경계를 연속적으로 적용한다.
- 좌표나 시간을 임의 보정하지 않는다. 소스가 다르면 즉시 중단한다.

---

## 6. 소스 사전검증

각 PART에 대해 렌더 전에 다음을 검사한다.

```text
파일 존재
파일명 일치
video stream 존재
audio stream 존재
H.264 입력
AAC 입력
FPS 약 25
actual duration 일치
해상도 일치
```

해상도 기대값:

```text
WEEK-05: 1212×720
그 외: 1280×720
```

러닝타임 허용:

```text
MASK JSON durationSeconds 대비 차이 ≤ 0.75초 권장
절대 최대 2초
```

0.75초를 초과하면 자동 렌더하지 않고 원인 조사한다. 2초를 초과하면 해당 WEEK FAIL.

생성:

```text
artifacts/lmc-privacy-rework/week-NN/source-preflight.json
```

---

## 7. 기존 스크립트 보강

먼저 읽고 재사용한다.

```text
scripts/lmc-zoom-tile-privacy.mjs
scripts/lmc-r2-overwrite-privacy.mjs
lcms/academy/privacy/README.md
.github/workflows/check-lmc-privacy.yml
```

### 7.1 `lmc-zoom-tile-privacy.mjs`

필수 보강:

```text
--week N
--config <LMC_77_PART_MASK_INTERVALS_v1.0.json>
--catalog <media-catalog.json>
--input-root
--output-root
--report
--dry-run
```

기능:

- mediaId JOIN을 통해 현재 objectKey 확정
- 해당 WEEK row만 처리
- EXPECTED PART COUNT 검사
- NO_MASK는 바이트 그대로 복사
- MASK는 FFmpeg 1회 재인코딩
- JSON의 final safe coordinate를 그대로 사용
- FULL_FRAME 지원
- endIsFileEnd 지원
- 출력은 objectKey mirror tree 사용

출력 경로:

```text
<LMC_OUTPUT_ROOT>/<currentObjectKey>
```

### 7.2 `lmc-r2-overwrite-privacy.mjs`

필수 보강:

```text
--week N
--dir <LMC_OUTPUT_ROOT>
--technical-qa <json>
--visual-approval <json>
--catalog <media-catalog.json>
--execute
```

파일 탐색:

```text
<dir>/<currentObjectKey>
```

금지:

```text
<dir>/<sourceFilename>만으로 업로드 파일 탐색
MASK JSON의 과거 objectKey 사용
QA 없이 --execute
```

---

## 8. 렌더 규칙

MASK PART:

```text
video: libx264
audio: copy 우선
preset: slow
CRF: 18
pixel format: yuv420p
Fast Start: +faststart
metadata 최소화
```

NO_MASK PART:

```text
재인코딩하지 않고 pristine 파일을 그대로 복사
출력 SHA가 입력 SHA와 같아야 함
```

절대 금지:

```text
얼굴만 blur
반투명 mask
추가적인 좌표 추론
영상 2회 재인코딩
오디오 제거
자동 스케일링
프레임 크롭
플레이어 CSS로 화면을 숨기는 방식
```

---

## 9. WEEK별 실행 순서

반드시 다음 순서로 진행한다.

```text
WEEK-01 → WEEK-02 → ... → WEEK-11
```

각 WEEK마다:

```text
1. source preflight
2. execution-map JOIN 검증
3. dry-run 및 FFmpeg filter graph 출력
4. 해당 WEEK PART render
5. technical QA
6. privacy QA frame 생성
7. contact sheet 생성
8. 사람 visual approval
9. R2 cutover dry-run
10. 해당 WEEK object overwrite
11. remote HEAD/Range 검증
12. signed playback 검증
13. catalog 및 generated metadata 동기화
14. commit / PR 진행보고
15. WEEK COMPLETE
```

한 WEEK가 COMPLETE되기 전에 다음 WEEK의 R2 업로드를 시작하지 않는다.

---

## 10. 기술 QA

각 PART 필수:

```text
output exists
size > 0
video stream 존재
audio stream 존재
videoCodec = h264
audioCodec = 입력과 동일, 기본 aac
width/height 유지
FPS 유지
duration delta ≤ 0.75초 권장, 절대 2초 이하
Fast Start = true
SHA256 생성
```

NO_MASK는 추가:

```text
input SHA256 == output SHA256
```

생성:

```text
artifacts/lmc-privacy-rework/week-NN/week-NN-technical-qa.json
```

자동 QA가 모두 PASS하지 않으면 visual approval 단계로 넘어가지 않는다.

---

## 11. 개인정보 시각 QA

각 interval에서 최소 다음 프레임을 생성한다.

```text
start - 0.50초
start + 0.10초
middle
end - 0.10초
end + 0.50초  # 파일/다음 구간 범위 안에서만
```

`endIsFileEnd=true`이면:

```text
END - 1.00초
END - 0.10초
```

을 반드시 포함한다.

확인 항목:

```text
참여자 얼굴 노출 0
참여자 이름 노출 0
프로필 사진 노출 0
개인 배경 노출 0
패널 가장자리 누출 0
전환 순간 1프레임 누출 0
강사 불필요 가림 0
PPT 핵심내용 과도 침범 0
오디오 정상
```

고위험 PART는 전체 전환점 프레임을 별도로 생성한다.

```text
W04-P05
W04-P06
W08-P05
W09-P01
W09-P04
```

산출물:

```text
artifacts/lmc-privacy-rework/week-NN/qa-frames/<mediaId>/
artifacts/lmc-privacy-rework/week-NN/week-NN-contact-sheet.jpg
```

---

## 12. 사람 승인 게이트

자동 스크립트가 visual PASS를 스스로 만들면 안 된다.

파일:

```text
artifacts/lmc-privacy-rework/week-NN/week-NN-visual-approval.json
```

예시:

```json
{
  "week": 1,
  "approved": true,
  "approvedAt": "ISO-8601",
  "reviewer": "human",
  "parts": [
    {
      "mediaId": "lmc-w01-p01",
      "privacyVisualPass": true,
      "reviewNote": "participant panel fully covered"
    }
  ]
}
```

R2 업로드 조건:

```text
approved = true
해당 WEEK 모든 PART privacyVisualPass = true
technical QA 모든 PART PASS
실제 output SHA = technical QA SHA
```

하나라도 누락되면 업로드 차단.

---

## 13. R2 덮어쓰기

Bucket:

```text
rsedu-lmc-videos
```

업로드 대상:

```text
현재 media-catalog.json의 currentObjectKey
```

WEEK별 기대 업로드 수량이 정확해야 한다.

```text
W01 5 | W02 7 | W03 8 | W04 6 | W05 8 | W06 7
W07 7 | W08 8 | W09 7 | W10 7 | W11 7
```

업로드 직전 manifest:

```text
artifacts/lmc-privacy-rework/week-NN/week-NN-cutover-plan.json
```

필수 필드:

```text
mediaId
currentObjectKey
sourceFilename
newSizeBytes
newSha256
technicalPass
privacyVisualPass
```

업로드 전에 실행:

```bash
npx wrangler --version
npx wrangler whoami
```

먼저 dry-run을 출력하고, 모든 행을 검증한 뒤 `--execute`한다.

운영 PUT은 해당 WEEK만 실행한다.

---

## 14. 원격 검증

업로드 명령 성공만으로 COMPLETE 처리 금지.

각 PART:

```text
HEAD = 200
Content-Type = video/mp4
Content-Length = 신규 manifest size
Accept-Ranges = bytes
Range bytes=0-0 = 206
Content-Range 정상
```

그리고 해당 WEEK에서 최소 다음을 signed playback으로 재생한다.

```text
첫 PART
복합 interval PART
FULL_FRAME 포함 PART
마지막 PART
```

WEEK-01/02/03/06/07/10/11처럼 단순구간 주차도 최소 첫·마지막 PART를 확인한다.

실재생 확인:

```text
시작
pause/resume
seek
마스킹 구간 전환
오디오
다음 PART 이동
```

생성:

```text
artifacts/lmc-privacy-rework/week-NN/week-NN-remote-playback-qa.json
```

---

## 15. 카탈로그 동기화

해당 WEEK 원격검증 PASS 후에만 다음을 갱신한다.

```text
lcms/academy/data/media-catalog.json
lcms/academy/r2-worker/src/media-catalog.js
lcms/academy/r2-worker/upload/video-upload-map.json
lcms/academy/r2-worker/upload/video-upload-map.csv
lcms/academy/r2-worker/upload/LMC_77_SHA256SUMS.txt
```

갱신값:

```text
sha256
sizeBytes
technical.actualDurationSeconds
technical.durationDeltaSeconds
technical.width
technical.height
technical.fps
technical.videoCodec
technical.audioCodec
technical.fastStart
```

보존값:

```text
mediaId
week
part
objectKey
status=published
accessPolicy
```

한 source manifest에서 모두 재생성해 JSON과 Worker catalog가 갈라지지 않게 한다.

---

## 16. CI 보강

`.github/workflows/check-lmc-privacy.yml`에 최소 다음을 추가한다.

```text
모든 관련 스크립트 node --check
77개 mediaId JOIN 테스트
현재 objectKey 우선 사용 테스트
과거 objectKey 사용 차단 테스트
WEEK별 기대 수량 테스트
--week 필터 테스트
RIGHT_PANEL final-safe-x에 추가 padding 없음 테스트
FULL_FRAME 테스트
endIsFileEnd tail 테스트
NO_MASK SHA 동일성 테스트
REVIEW_REQUIRED/visual approval 미충족 시 업로드 차단
technical QA SHA와 실제 파일 SHA 불일치 차단
objectKey mirror path 및 path traversal 테스트
overwrite dry-run 테스트
catalog JSON ↔ Worker JS 동기화 테스트
r2-player.css 범위이탈 diff 없음
```

CI PASS가 사람 시각검수를 대체하지 않는다.

---

## 17. 커밋 및 진행보고

WEEK 완료 후 커밋:

```text
feat(lmc): complete week 01 zoom tile redaction
feat(lmc): complete week 02 zoom tile redaction
...
```

PR #115 진행표:

```text
W01 ✅
W02 🔄
W03 ⬜
...
```

사용자 보고 형식:

```text
[LMC PRIVACY REWORK]

WEEK-01 ✅ COMPLETE
- parts: 5/5
- masked: 5
- no-mask: 0
- technical QA: 5/5 PASS
- visual QA: 5/5 PASS
- R2 overwrite: 5/5
- HEAD 200: 5/5
- Range 206: 5/5
- playback: PASS
- catalog sync: PASS

OVERALL: 5/77
```

---

## 18. 실패 규칙

다음 중 하나라도 발생하면 해당 WEEK 업로드를 중단한다.

```text
소스 누락
소스 duration/해상도 불일치
mediaId JOIN 실패
현재 objectKey 미확정
좌표 frame 밖
MASK interval 없음
NO_MASK에 interval 존재
기술 QA 실패
시각 승인 누락
SHA 불일치
업로드 수량 불일치
HEAD/Range 실패
Content-Length 불일치
signed playback 실패
catalog sync 실패
```

실패 보고:

```text
WEEK:
PART:
STAGE:
문제:
원인:
개인정보 영향:
서비스 영향:
현재까지 R2 변경된 파일:
다음 조치:
```

분석만 하고 완료라고 보고하지 않는다.

---

## 19. 최종 완료조건

```text
WEEK-01~11 COMPLETE
77/77 source verified
75 MASK 처리 완료
2 NO_MASK 원본 바이트 보존
기술 QA 77/77
사람 시각승인 77/77
참여자 얼굴·이름·프로필·개인배경 노출 0
전환 순간 누출 0
잘못된 마스크 0
R2 현재 objectKey 덮어쓰기 77/77
HEAD 200 77/77
Range 206 77/77
Content-Length 일치 77/77
운영 signed playback 정상
media-catalog 및 Worker generated catalog 동기화
PR #115 최종 보고
```

최종 산출물:

```text
LMC_77_PRIVACY_SHA256SUMS.txt
LMC_77_PRIVACY_MANIFEST.json
LMC_77_PRIVACY_QA_REPORT.json
LMC_77_R2_OVERWRITE_REPORT.json
LMC_77_REMOTE_PLAYBACK_QA.json
```

---

## 20. START NOW

설명만 하지 말고 아래 순서로 바로 실행한다.

```text
1. PR #115 최신 브랜치 checkout/pull
2. 변경파일 전수검사
3. r2-player.css 범위이탈 revert
4. 77개 MASK JSON 로드
5. 현재 media-catalog.json과 mediaId JOIN
6. execution-map.json 생성
7. 과거 objectKey가 업로드에 사용되지 않는지 테스트
8. WEEK-01 5개 pristine PART 사전검증
9. WEEK-01 dry-run filter graph 출력
10. WEEK-01 5개 render
11. technical QA
12. QA frames/contact sheet 생성
13. 사람 visual approval 준비
14. approval 전 R2 차단 테스트
15. 승인 후 WEEK-01 R2 5개 교체
16. HEAD/Range/signed playback 검증
17. catalog sync
18. commit 및 WEEK-01 완료 보고
19. WEEK-02 진행
```

**좌표를 새로 추측하지 않는다. `LMC_77_PART_MASK_INTERVALS_v1.0.json`의 PART 로컬타임과 final-safe 좌표를 사용하되, 현재 R2 objectKey만 저장소 최신 카탈로그에서 mediaId로 재매핑한다.**
