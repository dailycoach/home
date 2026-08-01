# NAL 메인 메뉴 연결 패치 v1

적용일: 2026-08-02

## 연결 범위

- DAILYCOACHING 데스크톱 상단 메뉴에 `NAL` 독립 링크 추가
- 전체 메뉴에 `NAL` 카테고리 추가
  - NAL 플랫폼 홈
  - 모임
  - 원데이클래스
  - 스토어
- 푸터 Quick Links에 `NAL 플랫폼` 추가
- `DAILYCOACHING_ROUTES`에 `nal: '/nal/'` 등록
- `pages.json`에 NAL 플랫폼 등록
- 메인 로더 캐시 키를 `20260802-nal-menu-v1`으로 갱신

## 대상 주소

- `/nal/`
- `/nal/gather/`
- `/nal/class/`
- `/nal/shop/`

## 검수 기준

- 상단 NAL 메뉴 클릭 시 `/nal/` 이동
- 모바일 전체 메뉴에서 NAL 카테고리 표시
- 전체 메뉴 내 세부 바로가기 정상 이동
- 푸터 NAL 플랫폼 링크 정상 이동
- 기존 메뉴 패치와 중복 삽입 없음
