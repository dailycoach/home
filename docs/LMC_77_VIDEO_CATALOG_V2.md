# LMC 77 Video Catalog v2

## 요약

| 구분 | 값 |
|---|---:|
| 영상 주차 | 11 |
| 전체 파트 | 77 |
| 비영상 주차 | WEEK-12 |
| 개별 러닝타임 합계 | 74,669초 |
| 화면 표기 | 약 20시간 44분 |
| 초기 상태 | 77개 `pending_upload` |

지시서의 개괄 합계 20시간 44분 25초와 개별 확정 러닝타임의 산술합계는 4초 차이가 있습니다. 개별 러닝타임을 보존하여 카탈로그 정확 합계는 20시간 44분 29초로 기록하고, 사용자 화면은 초 단위를 생략합니다.

## 주차별 수량

| 주차 | 파트 | 주제 |
|---:|---:|---|
| 01 | 5 | 나와 타인 그리고 세상을 보는 눈 |
| 02 | 7 | 적성의 다요인 종합분석기법을 활용한 진로적성검사 |
| 03 | 8 | 성격 이해와 16PF 검사 해석 |
| 04 | 6 | 의사소통 유형의 이해와 검사 해석 |
| 05 | 8 | 스트레스의 이해와 RS-스트레스 검사 활용 |
| 06 | 7 | 학습검사의 이해와 활용 |
| 07 | 7 | 정서검사의 이해와 활용 |
| 08 | 8 | 행복지수(우울)검사의 이해와 활용 |
| 09 | 7 | 심리건강(이상심리)검사의 이해와 활용 |
| 10 | 7 | 부부커플검사의 이해와 활용 |
| 11 | 7 | 발달진단검사의 이해와 활용 |
| 12 | 0 | 수료시험 및 과정 통합 |

## 식별 규칙

- partId: `week-01-part-01`
- mediaId: `lmc-w01-p01`
- objectKey: `lmc/v2/week-01/LMC_WEEK01_P01_self-concept-and-sources.mp4`
- 로컬 파일: `LMC_WEEK01_P01_self-concept-and-sources.mp4`

`objectKey`는 Cloudflare R2에 수동 업로드된 실제 객체명을 사용하며, `sourceFilename`은 로컬 프리플라이트 파일명을 유지합니다.

전체 상세목록은 다음 파일을 단일 출처로 사용합니다.

- `lcms/academy/data/media-catalog.json`
- `lcms/academy/r2-worker/upload/video-upload-map.json`
- `lcms/academy/r2-worker/upload/video-upload-map.csv`
- `scripts/lmc-r2-object-key-map.json`

## 게시 상태 전환

```text
pending_upload → uploaded_unverified → verified → published
                                      ↘ disabled
```

`published`는 R2 객체 존재, 크기·SHA-256 일치, MP4/H.264/AAC, Fast Start, Range/HEAD, 시작·중간·종료·모바일 재생 검증 이후에만 설정합니다.
