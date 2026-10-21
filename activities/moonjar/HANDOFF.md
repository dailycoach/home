# MOONJAR STUDIO V3 · THE ATELIER 인계

**상태: PARTIAL — 실제 구현·로컬 브라우저 QA·Draft PR 제출, Work 프리뷰 연결 gate 미해결.**

## 구현과 보존

B안 공방 방향으로 인장 없는 워드마크, 단일 꾸미기 CTA, 실제 제품 재료로 만든 첫 화면, 명시적 시작 선택, 어두운 공방과 자개 트레이, 잠시 바라보기, 작품 전시·내 작업·안내를 연결했다. 현재 열린 작품도 내 작업에서 이름을 바로 바꿀 수 있다. 짧은 화면에서 보기 도구는 접근 가능한 별도 창으로 옮겼다.

기존 DB·스키마·사용자 기록·96개 PNG·4가지 배경·좌표·200개 한도·100회 undo·스냅샷·저장 충돌·PNG/카드/JSON/인쇄 경로를 보존했다. domain/rendering/persistence와 전체 data, nacre-visibility.js는 base와 바이트 단위로 동일하다. 새 프레임워크·서버·외부 데이터 전송은 추가하지 않았다.

## 저장소

- Repository: https://github.com/dailycoach/home
- Base: `main`, `6faa99110b2662ba67a88068edc6c12a8c916833`
- Branch: `design/moonjar-atelier-v3`
- 최종 SHA: 함께 제출하는 Draft PR head와 최종 응답에 명시.
- PR target: main, **Draft**, NOT DEPLOYED. main ref는 제출 시 base와 동일한지 다시 확인한다.
- 전체 변경 파일 및 이유: [CHANGED_FILES.md](review/v3/CHANGED_FILES.md)

## 증거 열기

- [PHASE 0 / BASELINE](BASELINE.md)
- [전체 QA 결과와 별도 채팅 체크리스트](QA.md)
- [B안 전체 비교](review/v3/comparison-intro.png), [헤더·CTA 집중 비교](review/v3/comparison-focused.png)
- [8개 영역 실제 브라우저 캡처 모음](review/v3/journey-overview.png)
- [390 첫 화면](review/v3/after/intro-390.png), [공방](review/v3/after/studio-390.png), [완성](review/v3/after/gallery-390.png)
- [320 시작](review/v3/after/start-320.png), [공방](review/v3/after/studio-320.png), [저장](review/v3/after/save-320.png)
- [1440 첫 화면](review/v3/after/intro-1440.png), [공방](review/v3/after/studio-1440.png), [완성](review/v3/after/gallery-1440.png)
- [원본 무결성](review/v3/asset-integrity.json), [핵심 파일 무변경](review/v3/protected-files.json)
- [V3 구조화 결과](review/v3/atelier-results.json), [실행 로그](review/v3/logs/)

## 테스트 및 제한

74 단위 테스트, 959 실제 브라우저 assertions가 통과했다(반복 회귀 포함). 신규 V3 검사는 268 assertions / 14 scenarios. 검사한 legacy 작품에서 1600×1800 SVG와 PNG의 픽셀 차이 0. 모든 사용자 데이터 쓰기·실패·삭제 테스트는 격리한 가상 브라우저에서만 수행했다.

Work 프리뷰 탭은 `ERR_BLOCKED_BY_CLIENT`로 연결되지 않았다. 따라서 `design-qa.md`는 strict preview gate 기준 blocked다. 로컬 Chromium/WebKit의 실제 조작·캡처·콘솔 검사는 통과했다. 실제 Android/iPhone, 스크린리더, 200% 글자 확대와 OS 인쇄 대화상자는 미검증이다. 최종 디자인 심사·독립 기능 검증은 별도 ChatGPT 채팅에서 수행한다.

운영 DB는 출처별로 격리되므로 별도 프리뷰에서 운영 작품이 보이지 않는 것이 데이터 삭제를 뜻하지 않는다. 이 변경에는 DB 마이그레이션이 없다. 운영 출처의 실제 작품으로 최종 확인할 때는 편집 파일 백업을 먼저 확보한다.

**main 병합 및 운영 배포를 수행하지 않았다.**

PRODUCTION DEPLOYMENT: NOT PERFORMED
