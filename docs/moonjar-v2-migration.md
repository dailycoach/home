# 달항아리 백자 V2 · 기존 작품 보존 및 도안 선택 계약

상태: Draft PR #190에서 구현 · 사용자 승인 전 운영 미반영.

## 기존 자산 절대 유지
- 이전 바탕 `assets/canvas_light.png`, `assets/canvas_dark.png`의 파일과 SHA256을 바꾸지 않았다.
- 기존 작품의 `scene.templateId = outline-v3`, `assetPackVersion = moonjar-png-v3`, `schemaVersion = 1.0.0`을 그대로 읽는다.
- 기존 JSON의 `scene.canvasVariant`가 **없으면 무조건 legacy-outline-v3**으로 해석한다. 변형 과정에서 빈 필드를 자동 추가하지 않는다.
- 새로운 프로젝트는 `data/empty.json`에 `scene.canvasVariant='porcelain-v2'`를 담아 시작한다.
- `scene.theme`은 이전과 동일한 light/dark 값이며, 새 바탕에서도 사용한다.
- 배경 전환은 `Editor.setCanvas(variant,theme)`의 한 번의 undo 가능한 수정이며, 자개 x/y/크기/회전·성찰·메모는 변경되지 않는다.
- 남긴 배치(snapshot)는 scene 전체의 깊은 복사이므로 당시의 `canvasVariant`와 `theme`을 모두 갖는다. 구형 snapshot에 식별자가 없으면 기존 V3 선화로 표시한다.
- 편집 JSON/IndexedDB를 읽을 때 `additionalProperties:false`를 유지하고, schema의 **선택적** `canvasVariant`만 추가했다. 기존 문서를 강제 업그레이드하지 않는다.

## 단일 배경 해석
`src/domain.js`의 `backgroundKey(scene)`:
- 구형 필드 없음 / legacy-outline-v3 + light → `canvas-light` → `assets/canvas_light.png`
- 구형 필드 없음 / legacy-outline-v3 + dark → `canvas-dark` → `assets/canvas_dark.png`
- porcelain-v2 + light → `porcelain-light` → `assets/moonjar-v2/porcelain-day.png`
- porcelain-v2 + dark → `porcelain-dark` → `assets/moonjar-v2/porcelain-night.png`

이 식별자는 `renderSVG`, `Materials.forScene`, `drawScene`과 PNG·카드의 공통 경로에 적용된다. 화면만 새 것으로 보이고 출력이 다른 문제가 없어야 한다.

## 사용자 선택
`나의 바탕`은 백자 낮·백자 밤·기존 선화 낮·기존 선화 밤 4개 미리보기를 제공한다. **기존 작품에 새 형태를 자동 적용하지 않는다.** 취소/미리보기는 현재 작품 revision, snapshots, notes를 변경하지 않는다.

## 되돌리기 및 회귀 테스트
- 테스트: `tests/moonjar/background-v2.test.js`.
- PNG/원본 SVG의 해시/치수: `scripts/check-moonjar.mjs`.
- 실제 Chromium 사용자 흐름: `scripts/check-moonjar-browser.mjs`.
- 이전 자료를 참조하는 PDF는 앱 변경만으로 자동 교체되지 않는다.
