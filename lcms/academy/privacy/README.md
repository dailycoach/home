# LMC 77개 PART Zoom 참여자 타일 비식별화

## 단일 실행 기준

`artifacts/lmc-privacy-rework/inputs/LMC_77_PART_MASK_INTERVALS_v1.2_WEEK09_INSTRUCTOR_PRESERVED.json`의 PART 로컬타임과 final-safe 좌표를 사용한다. 좌표를 다시 추론하거나 8px padding을 추가하지 않는다. 이 설정은 실제 WEEK-09 레이아웃을 구간별로 측정해 수강생 타일만 가리고 강사 타일은 보존한 승인본이다.

MASK JSON의 `objectKey`는 과거 manifest 값이므로 업로드에 사용하지 않는다. `mediaId`로 `lcms/academy/data/media-catalog.json`과 JOIN하고, 현재 카탈로그의 `objectKey`, `sourceFilename`, `week`, `part`, `status`만 실행 권위값으로 사용한다.

## 고정 규칙

- 총 77개: `MASK` 75, `NO_MASK` 2
- `RIGHT_PANEL`: `x=coordinate.xStart`, `y=0`, `w=frameWidth-x`, `h=frameHeight`
- `FULL_FRAME`: 전체 프레임을 완전 불투명 검정으로 마스킹
- `endIsFileEnd=true`: `gte(t,start)`를 사용해 마지막 프레임까지 마스킹
- MASK: H.264/libx264, preset slow, CRF 18, yuv420p, 오디오 copy, Fast Start
- NO_MASK: pristine 파일을 바이트 그대로 복사하고 입출력 SHA-256 일치 확인
- 입력은 별도 보관된 pristine 77개 PART만 사용
- 출력은 `<output-root>/<currentObjectKey>` mirror 구조
- 사람 시각승인과 기술 QA가 모두 PASS하기 전 R2 업로드 금지

## WEEK별 실행

```powershell
$env:LMC_FFMPEG = "C:\absolute\path\to\ffmpeg.exe"

node scripts/lmc-zoom-tile-privacy.mjs map `
  --week 1 --config artifacts/lmc-privacy-rework/inputs/LMC_77_PART_MASK_INTERVALS_v1.0.json `
  --catalog lcms/academy/data/media-catalog.json

node scripts/lmc-zoom-tile-privacy.mjs preflight `
  --week 1 --config <mask-json> --catalog <catalog-json> `
  --input-root <pristine-week-directory>

node scripts/lmc-zoom-tile-privacy.mjs apply `
  --week 1 --config <mask-json> --catalog <catalog-json> `
  --input-root <pristine-week-directory> --output-root <privacy-output> --dry-run

node scripts/lmc-zoom-tile-privacy.mjs apply `
  --week 1 --config <mask-json> --catalog <catalog-json> `
  --input-root <pristine-week-directory> --output-root <privacy-output> --jobs 2

node scripts/lmc-zoom-tile-privacy.mjs qa `
  --week 1 --config <mask-json> --catalog <catalog-json> `
  --input-root <pristine-week-directory> --output-root <privacy-output>
```

생성된 `week-NN-visual-approval.json`은 기본적으로 `approved:false`이다. 자동 스크립트가 이를 PASS로 바꾸면 안 된다. 사람이 모든 QA 프레임과 contact sheet를 확인한 후에만 `reviewer:"human"`, `approved:true`, 모든 PART의 `privacyVisualPass:true`를 기록한다.

## R2 교체 게이트

```powershell
node scripts/lmc-r2-overwrite-privacy.mjs `
  --week 1 --dir <privacy-output> `
  --technical-qa <week-01-technical-qa.json> `
  --visual-approval <week-01-visual-approval.json> `
  --catalog lcms/academy/data/media-catalog.json
```

위 명령은 dry-run이다. 다음 조건이 모두 충족된 경우에만 `--execute`를 추가한다.

- 기술 QA 모든 PART PASS
- 사람 시각승인 모든 PART PASS
- 실제 출력 SHA/크기가 기술 QA와 일치
- objectKey mirror 경로의 파일 수가 WEEK 기대 수량과 일치

업로드 후에는 각 PART의 HEAD 200, Content-Type, Content-Length, Accept-Ranges, Range 206을 확인하고 해당 WEEK의 첫·마지막 PART 및 고위험 PART를 signed playback으로 직접 재생한다. 원격검증이 끝난 후에만 카탈로그 SHA/size/technical metadata를 동기화한다.

## 전체 77개 최종화

WEEK-01~11이 모두 완료되면 주차별 source preflight, 기술 QA, 사람 시각승인, R2 교체, 원격 무결성·HEAD·Range·signed playback, 카탈로그 동기화 보고서를 다시 교차 검증한다.

```powershell
node scripts/lmc-finalize-privacy-rework.mjs
node scripts/lmc-finalize-privacy-rework.mjs --check
```

첫 명령은 `artifacts/lmc-privacy-rework/`에 최종 산출물 5종을 생성하고, 두 번째 명령은 산출물이 현재 11개 WEEK 보고서 및 카탈로그와 정확히 일치하는지 검사한다.

- `LMC_77_PRIVACY_SHA256SUMS.txt`
- `LMC_77_PRIVACY_MANIFEST.json`
- `LMC_77_PRIVACY_QA_REPORT.json`
- `LMC_77_R2_OVERWRITE_REPORT.json`
- `LMC_77_REMOTE_PLAYBACK_QA.json`
