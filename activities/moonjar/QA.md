# MOONJAR STUDIO V3 · QA

## 최종 실행

2026-10-21 KST, Playwright 1.55.0 실제 Chromium / WebKit 엔진, 정적 앱을 로컬 HTTP로 제공했다. 각 테스트는 분리된 브라우저 저장소에서 실행했다. Android/iPhone 실기기 테스트라는 뜻은 아니다.

| 명령 | 결과 |
|---|---|
| `node scripts/check-moonjar.mjs` | PASS: 문법, 원본 해시·치수, 원격 전송 및 동적 HTML sink 금지 |
| `node --test tests/moonjar/*.test.js` | 74 tests PASS |
| `node scripts/check-moonjar-browser.mjs` | 123 assertions PASS |
| `node scripts/check-moonjar-nacre96.mjs` | 18 assertions PASS, 96종 × 낮/밤 |
| `node scripts/check-moonjar-release.mjs` | 179 assertions PASS, 11 scenarios |
| `node scripts/check-moonjar-viewport.mjs` | 212 assertions PASS, 12 scenarios |
| `node scripts/check-moonjar-journey.mjs` | 159 assertions PASS, 4 scenarios |
| `node scripts/check-moonjar-atelier.mjs` | 268 assertions PASS, 14 scenarios |

명령은 모두 실행했다. 합계 74 단위 테스트와 959 브라우저 assertions이며 중복 회귀 검사도 포함한다. 원시 로그·구조화 결과는 `review/v3/logs/`와 `*-results.json`에 있다. CI는 기존 Moonjar PR 워크플로에 V3 검사를 추가했으며, 실행 URL·최종 상태는 PR Checks에서 확인한다.

## 범위와 증거

- 새 START: 자유/이야기, 개인 저장/비저장을 FormData의 명시적 값으로 전달. URL query에 선택을 보존하고 취소·뒤로 가기·새로고침을 검증했다. 시작 확정 전 작품을 생성하지 않는다.
- 저장: 기존 IndexedDB fixture 무변경 열기, JSON 내보내기/새 ID 가져오기, 저장 후 새로고침, native 뒤로 가기, 비저장 재진입, 취소 시 작품 유지, 실제 revision 충돌, IDB put 실패. 미완료·실패를 저장됨으로 표시하지 않고 수동 백업을 제공한다.
- 편집: 96종 로드, 8색상군, 단일/12개/200개, 200개 초과 원자적 거부, 이동·회전·비율 크기·순서·복제·잠금·삭제·undo/redo, 160조각 스트레스, 터치 선택과 키보드 조작.
- 출력: 1600×1800 PNG, 1600×2400 카드, JSON 왕복, 출력 항목 opt-in, 인쇄/PDF 경로. 가상 legacy 6조각 장면을 실제 SVG에서 1600×1800으로 래스터화한 결과와 PNG exporter의 비교: **2,880,000픽셀 중 채널 차이 >3인 픽셀 0개**. 이것은 검사한 fixture의 결과이며 모든 가능한 작품에 대한 수학적 증명은 아니다.
- 선택적 윤곽 효과를 켜도 PNG가 바이트 단위로 동일함을 별도 96종 검사에서 검증했다. 편집 보조 효과는 출력에 들어가지 않는다.
- 탐색: INTRO → START → ATELIER/MATERIALS → REFLECTION → GALLERY → ARCHIVE, 기존 해시 직접 열기와 guide/about-materials, DAILY 5개·진행 흐름·안내 원문 9개 유지.
- 뷰포트: 320×568, 360×800, 390×844, 430×932, 768×1024, 1024×768, 1440×900, 844×390. 양 엔진의 기존 회귀 검사와 새 V3 검사를 함께 수행했다. CTA·오버플로·실제 작품 가시성·트레이·모달·저장을 검사했다.
- 접근성: native radio/fieldset/dialog, 키보드·터치, 포커스 복귀, 상태 live region, reduced-motion. 주요 텍스트 대비: 15.15:1(기본), 7.46:1(보조/charcoal), 7.36:1(bronze/charcoal), 6.32:1(문서 본문), 9.47:1(cover lead/native night).

## 시각 검토와 제한

실제 전후 캡처·B안 비교판·8개 영역은 `review/v3/`에 있다. 원본 백자와 자개를 실제 SVG로 표시했으므로 레퍼런스의 사진 속 금박·꽃 자개·손을 복제하지 않았다. 기존 작품과 일치하는 2D 재료라는 제약을 명시적으로 따른다.

- BLOCKER (검증 환경): Work cloud browser가 `terminal.local:4173`을 `ERR_BLOCKED_BY_CLIENT`로 열지 못했다. 직접 상호작용이 가능한 Work 프리뷰 인계는 미완료다. 로컬 Chromium/WebKit 캡처와 자동화는 실제 실행·통과했다. `design-qa.md`의 엄격한 프리뷰 gate는 blocked로 남긴다.
- MAJOR: 자동화에서 확인된 미해결 기능 결함 없음. 최종 디자인 승인과 독립 QA는 요청대로 별도 ChatGPT 채팅에 남긴다.
- MINOR / 미검증: 실제 Android/iPhone, VoiceOver/TalkBack, 실제 브라우저 글자 200% 확대, native OS 인쇄 대화상자에서 최종 PDF 저장. 320px에서는 작은 작품을 계속 보면서 트레이 내부를 스크롤한다.

## 별도 채팅의 최종 확인

1. PR head를 확인하고 390 / 320 / 1440 캡처와 B안을 심사한다.
2. 기존 운영 출처에서 실제 사용자 작품이 로컬 DB 그대로 열리는지, 백업 후 실기기로 확인한다. 다른 프리뷰 출처는 운영 IndexedDB를 공유하지 않는다.
3. 작품을 만들고 새로고침·JSON 왕복·비저장·뒤로 가기·저장 실패 안내를 독립 확인한다.
4. 원본 배경 4종과 PNG/카드/선택형 기록지, 96종을 확인한다.
5. PR Checks와 protected-files/asset-integrity 결과를 확인한다.
6. 사용자 최종 승인 후에만 별도 절차로 main 병합과 배포를 수행한다.

PRODUCTION DEPLOYMENT: NOT PERFORMED
