# DAILYCOACHING VALUE SCENE v2.0 패치 적용 보고

## 적용 결과

기존 네이비·골드 검사형 화면을 폐기하고 `Editorial Gen Z Coaching` 시스템으로 전환했다. 기능을 꾸미는 수준이 아니라 사용자 흐름을 `단어 → 반응 → 장면 → 충돌 → 선택 → 작은 행동`으로 재구성했다.

## 핵심 변경

- COVER를 `WHAT STAYS?` 대형 타이포 중심으로 교체
- SELF/COACH와 탐색 장면을 시작 화면에서 바로 선택
- 96개 전체 노출을 중단하고 첫 24개 + 4개 묶음 탐색으로 변경
- 18개 선택 뒤 10개, 5개로 실제로 덜어내는 CUT 인터랙션 적용
- 가치어 96개에 생활언어 한 줄 설명 추가
- 한자 아이콘을 WIDE/WORK/WITH/NEXT로 전면 교체
- `NOT THIS → BUT THIS → REAL SCENE → CLASH → THIS WEEK`로 단계 분리
- 기존 중요도·충족도 표현을 `내게 크게 남은 정도 / 요즘 삶에 보이는 정도`로 재작성
- 결과를 문서형 보고서에서 `MY WORD SCENE` 포스터로 전환
- 핵심 단어 5개, RIGHT NOW 2개, REAL SCENE, REAL CLASH, THIS WEEK I WILL을 한 장에 배치
- 모바일 2열 카드와 결과 포스터 재배열, A4 인쇄 전용 스타일 추가
- v1 로컬 기록을 v2 구조로 복구하는 마이그레이션 추가
- 메인 메뉴·전체 패널·푸터·라우트·`pages.json` 소개 문구 갱신

## 수정 파일

- `activities/value-scene/index.html`
- `activities/value-scene/styles.css`
- `activities/value-scene/app.js`
- `activities/value-scene/data.js`
- `index.html`
- `pages.json`

## 유지된 기능

- 로컬 자동 저장과 재진입
- 결과 텍스트 복사
- 인쇄/PDF 저장
- SELF/COACH 모드
- 코치 진행 질문
- 선택·압축·충돌·행동의 기능적 뼈대

## 운영 반영 상태

코드 패치와 자동 검수는 완료했다. 작업 브랜치는 `agent/value-scene-genz-redesign`이며, `main` 반영 전 검토가 가능하도록 GitHub Draft PR로 제출한다. 병합 후 GitHub Pages 운영 주소에서 모바일 390px와 A4 인쇄 미리보기의 최종 육안 검수를 진행한다.

## 2026-08-01 QA 핫픽스

- 선택·필터·방향 조작 때 화면이 상단으로 초기화되던 전역 렌더 동작 수정
- 클릭한 카드의 화면 좌표와 키보드 포커스 복원
- 단계 이동에서만 상단 이동과 본문 포커스 적용
- 한국 시간 기준 실행 날짜를 오늘~D+7로 제한
- 결과의 두 WORD PULSE가 같은 단어로 겹치지 않도록 보정
- 코칭 질문과 범위 입력의 한국어 조사 자동 보정
- 전체 결과 영역의 과도한 스크린리더 재낭독 제거
- 주요 본문 색상 대비를 WCAG AA 수준으로 보정
- 결과 포스터 A4 1페이지 수렴을 위한 인쇄 밀도 재조정
- 캐시 버전을 `genz3`로 올려 운영 반영 직후 최신 파일을 로드하도록 처리

핫픽스 작업 브랜치는 `agent/value-scene-qa-hotfix-v2`이며 Draft PR에서 검토 후 `main`에 반영한다.
