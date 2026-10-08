# NAL READ BUILD31 — GitHub Pages 배포 기준과 고객 공개 차단선

## 확인된 운영 배포 경로
GitHub Actions `pages build and deployment` 실행 [#37710942545](https://github.com/dailycoach/home/actions/runs/37710942545)은 `dailycoach/home` 저장소의 `main` 커밋 `1ccaa503aa7823ab1711ed70f1880bc83084b671`을 소스로 사용했습니다. 이 실행에서 **build·report-build-status·deploy 작업이 모두 success**였습니다. `CNAME`은 `daily-coach-ing.com`입니다.

단, 현재 외부 HTTP 조회 도구에서 해당 도메인을 가져오지 못했으므로 **실제 CDN HTML·캐시·브라우저 표시는 검증하지 않았습니다.** GitHub Actions 성공은 정적 배포가 GitHub 측에서 완료됐다는 근거이지 고객 시나리오 통과 증거가 아닙니다.

## 실제 호스팅 통합 후보 PR
- 검토용 Draft [PR #166](https://github.com/dailycoach/home/pull/166): `integration/nal-read-build30-host-candidate` → `main`
- 부모(main 기준): `1ccaa503aa7823ab1711ed70f1880bc83084b671`
- 후보 커밋: `0dd95e697e2a246c4fa1953b8bbc7f7d7a75ffbe`
- diff: **신규 79, 수정 1, 삭제 0** — 변경 80개 모두 `nal/` 내부
- 유일하게 교체되는 기존 파일: `nal/my/index.html`
- 기존 MY NAL 기기 내 찜·최근 항목은 새 `nal/my/local/index.html`로 보존, `/nal/my/#wishlist` 예전 링크는 새 경로로 연결
- 기존 `app.js`, `store.js`, 공통 테마/CSS, `backend.json`, 무료 PDF, 마음도구 상품/이미지/폰트 및 NAL 루트는 변경하지 않음

**PR을 병합하면 GitHub Pages가 `main`을 새로 배포합니다.** READ 공개가 OFF여도 새 정적 HTML은 인터넷에 공개되므로, 고객에게 미완성 화면을 보여주지 않기 위해 PR은 Draft입니다. 이번 BUILD31에서 병합·퍼블리시하지 않았습니다.

## 설치와 공개를 혼동하지 않기
1. DB 19개 선언 계층은 설치됐고 Edge 이름 11개도 배포됐지만, 기능 활성화·고객 공개 및 운영 초기 데이터는 독립된 문제입니다.
2. `NAL_READ_ENABLED` 등 서버 환경값·Auth callback·결제사 키·READ release control은 이번에 변경하지 않았습니다.
3. 운영자의 실제 첫 기수·정원·날짜·안내문·원고 승인 등은 승인된 입력이 없으므로 임의로 생성하지 않았습니다.
4. 아직 기존 test_only 가드에서 일반 고객 판매 모드로 이어지는 정책과 개인 기록의 삭제·보존 경계를 별도로 정리해야 합니다.
5. 사용자가 정한 **판매 직전 일괄 기능검증** 전에는 QA PASS/상품 판매 준비 완료를 선언하지 않습니다.

## 안전한 반영 경계
- `main`을 바꾸기 전에 최신 SHA와 이번 기준 `1ccaa503aa7823ab1711ed70f1880bc83084b671`을 재확인해야 합니다. 다른 커밋이면 최신 변경을 보존하도록 새 후보를 재구성합니다.
- 배포 변경은 선택한 경로만 합치고 파일 삭제 동기화, 기존 STORE/PDF 파일 교체, 환경값/키 변경을 함께 하지 않습니다.
- PR #166은 별도의 호스팅 범위 전용이며 개발 PR #160 전체를 `main`에 합치지 않습니다.
- 미래에 실제 공개를 결정한 경우에는 해당 게시 커밋과 GitHub Pages 실행 번호를 별도로 기록해야 합니다.
- 롤백은 게시된 변경만 **새로운 `git revert` 커밋**으로 되돌리는 방식이 원칙입니다. `main`을 강제 reset하거나 unrelated 파일을 삭제하지 않습니다.
- READ 또는 결제 스위치를 켜는 것은 별도의 사전승인된 고객 공개 단계입니다.

## BUILD31 실제 산출
Draft PR #166 생성 및 `main`·Git 후보 경로 목록·성공 배포 작업 이력 확인, 80경로 변경 내역을 `integration/nal-read/build31/host-release-gate.json`에 고정합니다. 그 외 신규 유료 인프라·실결제·데이터 생성·웹 배포·테스트 실행 없음.
