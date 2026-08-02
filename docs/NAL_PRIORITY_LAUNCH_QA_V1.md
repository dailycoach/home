# NAL 우선 런칭 QA v1

검수일: 2026-08-02

## 정적 점검

- `launches.json` JSON 구조와 필수 URL 3종 확인
- NAL 홈에서 `launch.css`, `launch.js` 로드 확인
- JavaScript 활성 환경에서 `.nal-home-hero` 뒤에 `#nal-opening-lineup`을 한 번만 삽입하도록 구현
- JavaScript 비활성 환경에서 미술심리코칭·흐르는 강물처럼·마음서재 링크가 정적 폴백으로 노출
- 내부 URL, 외부 HTTPS URL, `mailto:` URL을 구분해 안전하게 처리
- 외부 마음서재 링크에 `noopener noreferrer` 적용
- 모바일 640px 이하 단일 카드 레이아웃과 44px 이상 CTA 적용
- `prefers-reduced-motion` 대응 유지

## 참여 경로

- 미술심리코칭: `mailto:` 참여 문의
- 흐르는 강물처럼: `mailto:` 커뮤니티 참여 문의
- 마음서재: 기존 외부 사이트 바로 입장

## 확인된 제한

- 미술심리코칭 정식 Google Form은 아직 미개통
- 흐르는 강물처럼 커뮤니티 입장 링크와 첫 일정은 아직 미확정
- 마음서재 정기 Zoom 일정과 선정 도서는 외부 사이트 운영 정보에 따름
- 본 패치는 참여 문의와 입장 경로를 먼저 개통하는 프리오픈 단계임
