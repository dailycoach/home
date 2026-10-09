# NAL-STABILIZATION-03 · READ 호스팅 통합 정상화

## 범위와 증거 (2026-10-10 KST)

| 구분 | Git SHA/PR |
| --- | --- |
| 실제 배포 중인 main | `1ccaa503aa7823ab1711ed70f1880bc83084b671` |
| 정상화 P1 | Draft PR #167 · `e66634ff9a83dd379f48ab29b76238aa61038a09` |
| 정상화 P2 기준 | Draft PR #168 · `bd4709efeb0796c4881e3d08d00e4b5ace20bedb` |
| READ 최신 개발 | Draft PR #160 · `277025e4f88d5befa863d6d8c98fcec35fdcdf30` |
| READ 구 호스팅 후보 | Draft PR #166 · `0dd95e697e2a246c4fa1953b8bbc7f7d7a75ffbe` |
| 새 호스팅 통합 후보 | Draft PR #169 · `integration/nal-stabilization-03-read-candidate` |

기존 호스팅 후보 80개 `nal/` 경로를 READ 최신 개발 브랜치 88개 `nal/` 경로와 **Git blob SHA로 직접 비교**한 결과:

- 76개 내용 동일.
- 4개 구버전: `nal/assets/js/account-layout.js`, `nal/assets/js/account-session.js`, `nal/assets/js/read-operations.js`, `nal/my/index.html`.
- 8개 신규 누락: `nal/assets/css/nal-privacy-review.css`, `nal/assets/css/nal-privacy.css`, `nal/assets/js/read-privacy-member.js`, `nal/assets/js/read-privacy-review.js`, `nal/data/read-backend.staging.json`, `nal/data/read-privacy-review.release.json`, `nal/my/privacy/index.html`, `nal/read/admin/privacy/index.html`.
- 전체 개발 PR #160의 나머지 **170개 비-`nal/` 파일**은 문서, 워크플로, SQL, Edge 소스, 테스트 등을 포함하므로 이번 **호스팅 후보에 자동 병합하지 않았다**. 해당 170개를 완료된 서버 검증으로 간주하지 않는다.

## 실제 조정 및 보존

P2 브랜치 위에 최신 READ 88개 경로만 원본 blob을 그대로 가져와 저장. 기존 NAL 파일 131개 중 `nal/my/index.html` **1개만 지정 변경**, 그 외 **130개 파일의 SHA 불변**.

따라서 기존 상품 데이터, 최종 무료 PDF, 표지, 홈페이지, 앱 JS, 검색, 상품 상세, `backend.json` 및 테마를 과거 READ 브랜치의 파일로 덮어쓰지 않는다.

MY NAL:
- 새 READ 계정 홈: `/nal/my/`
- 기존 로컬 찜·최근 본 항목: `/nal/my/local/`
- `/nal/my/#wishlist` → `/nal/my/local/#wishlist` 호환 유지

신규 READ HTML 36개는 **모두 `noindex`**이며 링크된 로컬 JS/CSS가 실제 존재함을 자동 검사한다. 주의: 검색 제외는 접근 통제나 인증 검증이 아니다.

## 운영 상태 (읽기 전용 점검)

- READ release mode = `off`
- 실제 READ 기수 0, 사용자 주문 0, 결제 0
- 저널 파기 기능 = OFF
- owner 사용자 역할 0
- 개인정보 운영자 API `nal-read-privacy-admin` = **미배포**
- 최신 READ 호스팅 소스의 개인정보 관리자 공개 플래그 5개 = 모두 false, `destructiveApiExposed` false, 허용 명령 `queue/preview/start-review`만 명시
- `nal/data/read-backend.staging.json` = 비활성, URL/키 공란
- 정규 유료 판매 기능 checkout/storePurchase/secureDownload = OFF

**P4 차단 조건:** 권한을 브라우저에서 판단하지 않는다. 서버에서 요청별 검증된 Auth · 기존 owner 멤버십 · `p_owner_id` 안전 바인딩 · 별도 기본-OFF 서버 스위치 · 관련 개인정보 고지/보관/파기 정책 승인. BUILD34에서 안전 검사에 차단된 민감한 인증 코드를 우회하지 않는다.

## 현재 검증과 그 한계

- `scripts/check-nal-read-integration-snapshot.mjs`: 88개 READ 블롭 / 130개 원본 파일 / 경로 의존성 / MY 호환 / READ 출시 차단 계약.
- `scripts/test-nal-read-integration-negative.mjs`: 7가지 변조에서 정상적으로 CI 실패하고 원본 복원되는지.
- 기존 P1 플랫폼·테마 검사 및 P2 운영 Supabase 카탈로그 검사도 회귀 실행.
- 브라우저 실접속 / 로그인 / 고객 자료 / 실제 결제 / 관리자 개인정보 요청 API 검증은 **범위 밖**. 위 조건을 충족해야만 고객 판매 직전 실시.

## 병합·배포 원칙

**PR #167 → #168 → #169의 의존 관계**이나, 현재는 전부 **Draft / 미병합 / 자동 배포 없음**. #166은 예전 시점의 후보이므로 이 통합 후보와 함께 병합하지 않는다.

배포 호스트는 GitHub Pages로 연결되므로 PR #169의 수동 병합조차 고객 경로를 노출할 수 있다. P4·P5·최종 사용자 승인 전에는 **main 병합 금지**.

대상 운영 Supabase·DB·Storage·Edge·기존 고객 데이터·결제 설정을 수정하지 않는다.
