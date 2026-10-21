# MOONJAR STUDIO V3 · PHASE 0

- 조사 기준: `dailycoach/home` 원격 main `6faa99110b2662ba67a88068edc6c12a8c916833` (2026-10-21 KST).
- 작업 브랜치: `design/moonjar-atelier-v3`. 원격에 같은 이름이 없음을 확인한 뒤 생성했다.
- 대상: index, 전체 src 5종, CSS 5종, data 4종, 전체 원본·썸네일, tests/moonjar 9종과 fixtures, check-moonjar 스크립트 6종, Moonjar 워크플로 3종. 다른 서비스의 구현 파일은 수정하지 않았다.
- B안: 첨부 보드의 중앙 **공방의 시간**. 어두운 공간, 밝은 작품, 명조 제목, 한 개의 주요 꾸미기 CTA, 하단 세 목적지. 사진을 배경에 붙이지 않고 실제 재료를 실제 렌더러로 표시한다.

## 보존 계약

| 항목 | 기존 계약 |
|---|---|
| IndexedDB | `dailycoaching-moonjar-v1`, version 1; projects / thumbnails / meta |
| 편집 파일 | `dailycoaching.moonjar.project`, schemaVersion 1.0.0; 엄격한 로컬 검증 |
| 좌표 | 1600×1800, 조각의 x/y는 중심, 배열이 겹침 순서 |
| 자개 | 원본 PNG 96종, 8색상군, 원본 비율, 별도 WebP 썸네일 |
| 배경 | legacy-outline-v3 및 porcelain-v2 × light/dark, 총 4가지 |
| 한도 | 200조각, 실행 취소 100회, 배치 스냅샷 3개 |
| 출력 | PNG 1600×1800, 카드 1600×2400, JSON, 선택형 인쇄/PDF |
| 개인정보 | 자동 원격 전송 없음, 카드·인쇄의 기록은 opt-in, 비저장은 메모리만 |

`review/v3/protected-files.json`은 핵심 모듈·데이터 8개가 base와 바이트 단위로 동일함을 증명한다. `asset-integrity.json`은 자개·도안 원본 해시 검증 결과다. 사용자 브라우저 저장소에 접근하거나 초기화하지 않았다. 모든 쓰기/삭제/충돌 테스트는 새로 만든 자동화 브라우저 컨텍스트의 가상 데이터만 사용했다.

## 기존 화면과 CSS 감사

전후 실제 캡처는 `review/v3/before/`, `review/v3/after/`에 있다. 작업 전 모바일·데스크톱 캡처를 먼저 확보했고, 재현성을 위해 동일 SHA를 분리한 읽기용 worktree에서도 캡처했다.

- 기존 첫 화면에 원형 `月` 인장, 두 개의 동등한 시작 버튼, 저장 라디오와 설명이 함께 있었다.
- 기존 `begin()`은 첫 화면 DOM의 `#storage-personal` 체크 여부를 직접 읽었다. 라디오를 단순 삭제하면 저장 선택을 잃는다.
- styles/refinement/viewport가 각각 hero, drawer, studio geometry를 반복 선언했다. `!important`는 styles 12, refinement 4, viewport 34, nacre visibility 1, 총 51개였다.
- styles의 페이지 흐름, decorating-flow의 fixed drawer, viewport의 absolute drawer가 중첩되었다. WAVE별 반응형 덧붙임이 서로 다른 높이와 폰트 크기를 선언했다.
- V3는 styles=공통 토큰·폼·문서, refinement=커버, viewport=공방 배치, nacre-visibility=선택적 윤곽으로 책임을 분리한다. decorating-flow는 보존하되 로드하지 않는다. `!important`는 native hidden 보장 1개만 사용한다.
- 본문 Pretendard는 자체 호스팅 파일이 없어 환경에 의존했다. V3는 정식 배포본·OFL 라이선스를 추가한다. 기존 자체 호스팅 고운바탕은 유지한다.

## 작업 전 실행 기록

| 명령 | 최종 기준선 결과 |
|---|---|
| `node scripts/check-moonjar.mjs` | PASS: 원본 98개 + porcelain 원본, 치수·해시·문법·원격 전송 금지 |
| `node --test tests/moonjar/*.test.js` | 74 / 74 PASS |
| `node scripts/check-moonjar-browser.mjs` | 123 assertions PASS |
| `node scripts/check-moonjar-nacre96.mjs` | 18 assertions PASS |
| `node scripts/check-moonjar-release.mjs` | 179 assertions / 11 scenarios PASS |
| `node scripts/check-moonjar-viewport.mjs` | 212 assertions / 12 scenarios PASS |
| `node scripts/check-moonjar-journey.mjs` | 159 assertions / 4 scenarios PASS |

초기 실행에서는 한글 시스템 폰트 부재로 카드 문구 검사 1건이 timeout 되었고 WebKit 공유 라이브러리가 없었다. 환경을 보완한 뒤 **변경하지 않은 base SHA**에서 전체 재실행해 위 결과를 얻었다. 선행 제품 결함으로 단정하지 않았다. 로그는 `review/v3/logs/baseline-*`에 보존했다.

PRODUCTION DEPLOYMENT: NOT PERFORMED
