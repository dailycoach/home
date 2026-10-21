# MOONJAR STUDIO V3.1 · QA

2026-10-21 KST. PR #208의 V3.0 head `99c7cda61e84487afdfd02213fe80401a9c7c256`에서 후속 작업했다. **로컬 기능·시각 회귀 PASS / Work cloud preview BLOCKED / 최종 디자인 승인 대기.** main 병합과 운영 배포는 수행하지 않았다.

## 실행 결과

Playwright 1.55.0의 실제 Chromium 140 / WebKit 엔진을 로컬 HTTP에서 실행했다. 모든 저장·삭제·실패 테스트는 격리한 가상 브라우저 데이터다. 실기기 테스트가 아니다.

| 실제 실행 명령 | 최종 결과 |
|---|---|
| `node scripts/check-moonjar.mjs` | PASS: 원본 해시·치수·문법·전송 제한 |
| `node --test tests/moonjar/*.test.js` | 74 / 74 PASS |
| `node scripts/check-moonjar-browser.mjs` | 123 assertions PASS |
| `node scripts/check-moonjar-nacre96.mjs` | 18 assertions PASS, 96종 × 낮/밤 |
| `node scripts/check-moonjar-release.mjs` | 179 assertions / 11 scenarios PASS |
| `node scripts/check-moonjar-viewport.mjs` | 212 assertions / 12 scenarios PASS |
| `node scripts/check-moonjar-journey.mjs` | 159 assertions / 4 scenarios PASS |
| `node scripts/check-moonjar-atelier.mjs` | 268 assertions / 14 scenarios PASS |
| `node scripts/check-moonjar-refinement.mjs` | **730 assertions / 16 scenarios PASS** |

기존 브라우저 회귀 **959개**를 유지했고 V3.1 **730개**를 추가했다. 총 **1,689개 브라우저 assertions + 74개 단위 테스트**이며 중복 회귀를 포함한다. [원시 로그](review/v3.1/logs/)와 [구조화 결과](review/v3.1/refinement-results.json)를 보존했다. 최종 코드에서 기존 전체 회귀를 다시 실행했다. Moonjar 전용 PR 워크플로에도 새 검사를 추가했다. 원격 실행 URL·상태는 [PR Checks](https://github.com/dailycoach/home/pull/208/checks)와 PR 본문에 제출한다.

## P1 / P2 재검증

| 요구 | 구현 및 실제 검증 |
|---|---|
| P1-01 글자 겹침 | 모바일 hero의 글자와 실제 SVG를 별도 grid track으로 분리했다. 모든 제목·본문 글자의 Range와 작품 frame이 겹치지 않음을 검사하고, 320/360/390/430의 양 엔진 캡처를 육안 검토했다. 원본 이미지·색상은 변경하지 않았다. |
| P1-02 큰 작품 | 320×568에서 동일 A01 선택 상태의 실제 SVG가 **142×159.75 → 198×222.75 CSS px**. 재료 패널을 연 상태도 약 195px 높이다. 목표 190px 이상을 추가·이동·회전·크기·undo/redo·저장 접근 중 계속 검사한다. 이전 독립 보고의 138×155와 이번 기준선 측정 차이는 실행 환경에 따른 것으로 원시 캡처를 함께 남겼다. |
| P2-01 START | form 안의 선택 영역만 스크롤하고 CTA는 별도 하단 영역에 유지한다. 320에서 submit 버튼 y=514..558, 초기 화면에 표시된다. 네 선택과 로컬 저장·비저장 유실 설명은 그대로다. |
| P2-02 버튼 밀도 | 모바일 상시 보기·모드 전환을 보기·배치 창으로 이동. 조절은 이동/회전/크기/더 조절로 단계화. 중복 undo/redo는 재료 트레이에서 접고 작품 툴바에 유지. 실제 윤곽 보기 노드를 창에 옮겼다가 복귀시켜 세션 상태와 이벤트를 보존한다. |
| P2-03 공방 공간 | 작품 주변을 잉크·올리브 차콜 frame으로 연결했다. 원본의 흰 출력 바탕은 그대로이며 renderer, SVG 좌표, source pixels를 바꾸지 않았다. 첫 화면의 세로 작품 창은 UI crop이며 출력 crop이 아니다. |
| P2-04 개인 갤러리 | 썸네일을 카드 상단 전시 크기로 확대하고 제목·최근 작업·이어 꾸미기·보조 관리 순서로 정리. 같은 6조각 legacy fixture의 전후 캡처를 비교했다. 제목 변경과 이어 꾸미기도 실제 실행했다. |

추가로 새 검사가 완성 작품의 ‘이어서 꾸미기’가 결과 화면으로 돌아가는 문제를 발견했다. 현재 열린 작품은 같은 편집기와 잠금을 재사용하고, 다른 저장 작품은 명시적으로 studio로 연다. 같은 작품의 불필요한 잠금 재요청도 피한다. 저장 스키마/핵심 persistence 코드는 바꾸지 않았다.

## 데이터·기능 보존

- [214개 보호 파일 무결성](review/v3.1/protected-integrity.json): domain/rendering/persistence/nacre-visibility JS, data 4종, 전체 기존 assets가 V3.0 head와 바이트 단위 동일. 원본 PNG 96종·8색상군·4배경 보존. 기존 원본 체크도 PASS.
- 기존 IndexedDB fixture를 무변경으로 열고, JSON export/import가 새 ID를 사용함을 검증. 실제 revision 충돌 및 IDB put 실패 시 백업과 정확한 상태를 확인했다. DB명·스토어·schema 마이그레이션 없음.
- 1/12/200조각, 자유 배치, 이동·회전·비율 크기·순서·복제·잠금·삭제·undo/redo, 키보드·터치 시뮬레이션, snapshot과 재편집을 기존 전체 회귀로 검사했다.
- PNG 1600×1800 / 카드 1600×2400 / JSON / 선택형 인쇄 경로 유지. legacy fixture SVG와 exporter 비교는 **2,880,000픽셀 중 채널 차이 >3인 픽셀 0개**. 윤곽 보기 ON/OFF의 PNG 해시도 동일하다.
- 기록·이름은 opt-in. 비저장 모드는 새로고침 후 자동 복원하지 않으며, 이동 취소 시 현재 작업을 유지한다. 실제 사용자 브라우저·운영 DB에 접근하지 않았다.
- 기존 DAILY·일곱 이야기·9개 안내·직접 링크를 검사했다. 자동 원격 데이터 전송을 추가하지 않았다.

## 캡처 및 시각 검토

양 엔진에서 필수 14개 화면씩을 [after](review/v3.1/after/)에 보존했다. [capture-index](review/v3.1/capture-index.json)에 viewport·pixels·density를 기록했다. 기본 density는 1이다. 768×1024, 1024×768, 짧은 가로 844×390까지 검사했으며 전체 실행 캡처는 CI artifact에도 남는다.

- [B안 + INTRO 320 전후](review/v3.1/compare-intro-320.png)
- [같은 A01 선택 상태의 작업실 320 전후](review/v3.1/compare-studio-320.png)
- [START 320 전후](review/v3.1/compare-start-320.png)
- [같은 기존 작품의 ARCHIVE 전후](review/v3.1/compare-archive-390.png)
- [Chromium 모바일 전체](review/v3.1/chromium-mobile-overview.png) / [WebKit 모바일 전체](review/v3.1/webkit-mobile-overview.png)
- [1440 첫 화면](review/v3.1/after/chromium-intro-1440.png) / [1440 작업실](review/v3.1/after/chromium-studio-1440.png)

캡처 자체와 비교판을 실제로 열어 확인했다. 목업이나 생성형 이미지를 증거로 사용하지 않았다. 기준선은 원본 V3.0 SHA의 분리된 worktree에서 같은 상태로 캡처했다. QA 장면의 조각 수가 다른 비교는 픽셀 정합성 비교로 쓰지 않는다. B안 원본은 499×779이고 비교판에서 비율을 유지해 축소했다. 원본 사진의 손·금박·꽃은 실제 제품 에셋 제약 때문에 복제하지 않는다.

## 환경과 미검증

- **BLOCKER — Work cloud preview:** 지원 preview 서버를 재시작하고 cloud browser로 재시도했으나 `net::ERR_BLOCKED_BY_CLIENT`. 로컬 테스트 PASS와 구분하며 이 gate는 BLOCKED다. 사용자 지시 09에 따라 독립 테스트·캡처를 계속했다.
- **MAJOR — 자동화/로컬 캡처에서 확인된 미해결 기능 결함 없음.** 최종 미학적 승인을 받은 것은 아니다. 디자인 9.0은 목표이며 자체 승인 점수로 기재하지 않는다.
- **MINOR / 미검증:** 실제 Android/iPhone, VoiceOver/TalkBack, 실제 브라우저 200% 글자 설정, OS 인쇄 대화상자의 최종 PDF 파일 저장. 짧은 가로형은 작품이 계속 보이지만 작아지며 큰 정밀 편집은 확대/전체 보기 도구를 사용한다.

초기 실행 환경에는 브라우저와 Korean canvas fallback이 없어 공식 Playwright 배포본 및 시스템 폰트를 준비했다. 카드의 긴 문구 검사를 약화하지 않고 재실행해 PASS했다. 기존 검사의 이동 경로는 접힌 도구에 맞춰 수정했으며 959개 검증 수와 목적은 유지했다.

PRODUCTION DEPLOYMENT: NOT PERFORMED
