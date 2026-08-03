# LMC Segmented Academy Architecture v2

기준일: 2026-08-03
기준 `main`: `667be369dfbec1711688edf61b3c7d57790d5c78`
기존 Draft PR #74 head: `338ace772feee00ae091205271c964e7d59f8af9`
신규 브랜치: `agent/lmc-segmented-academy-v2`

## 목적

기존 11개 주차별 단일영상 강의장을 1~11주 77개 분할영상과 비영상 WEEK-12를 지원하는 구조로 전환합니다. PR #74의 구매확인·입장코드·Apps Script 세션·비공개 R2·HMAC·Range/HEAD·수강생별 진도를 재사용합니다.

## 계층

```text
Course
└─ Week 01…12
   ├─ Part 01…08
   │  └─ Media
   └─ WEEK-12: no media
```

`courses.json`은 교육·화면 구조, `media-catalog.json`은 배포 미디어 구조를 담당합니다. 두 파일은 `mediaId`, `partId`, 주차·파트·제목·러닝타임으로 교차 검증합니다.

## 화면 흐름

```text
입장코드 로그인 → 과정 홈 → 12주 커리큘럼 → 주차 펼치기
→ 파트 선택 → 현재 영상만 URL 발급 → 5초 이어보기
→ 90% 자동완료 → 다음 파트 → WEEK-12 운영 절차
```

`lesson.html`은 `week`와 `part` query를 사용합니다. 기존 `module` query는 과거 링크를 WEEK 번호로만 해석하는 제한적 호환 경로이며 신규 링크에는 생성하지 않습니다.

## 진도

- 완료키: `week-01-part-01` … `week-11-part-07`
- 재생키: `lmc-lifetime-management-counselor:week-01-part-01`
- 메모키: `courseId:partId`
- 저장범위: 검증된 수강생의 불투명 `studentId`
- 공식 수료: 77파트 브라우저 진도와 별도로 WEEK-12 운영자 확인

## 공개정책

`courses.json > releasePolicy.mode`에서 `all_open`, `sequential`, `scheduled`를 지원합니다. 기본값은 `all_open`이며 `scheduledDates`가 없을 때 임의 공개일을 만들지 않습니다.

## PR #74 재사용 범위

- `/access` Apps Script POST 프록시와 12시간 세션
- 결제·접근·180일 수강기간 서버 검증
- 입장코드·세션토큰 해시 저장
- R2 비공개 버킷과 HMAC 만료 URL
- Range 206·HEAD 전달
- 수강생별 브라우저 진도 격리
- 영상 종료 자동완료의 기본 흐름
- Apps Script 경합·환불·수식주입 방어

## v2 변경 범위

- 11개 week allowlist → 77개 week/part/media allowlist
- `lmc/week-01.mp4` → `lmc/v2/week-01/part-01.mp4`
- 주차 진도 → 파트 진도와 주차·전체 집계
- sessionStorage signed URL cache → 메모리 전용 cache
- WEEK-12 전용 비영상 화면과 운영자 확인 안내
- 77개 카탈로그·업로드 매핑·사전검사·Worker 테스트

실제 MP4 업로드, R2·Worker·Apps Script 운영 배포, 입장코드 발급, `main` 병합은 이 공사 범위에 포함하지 않습니다.
