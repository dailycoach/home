# NAL READ BUILD30 — 운영 기준 파일 대조·충돌 보존·메인 기반 통합 후보

## 확인한 범위
CNAME과 저장소 문서상 정적 GitHub Pages 형태를 쓰는 `dailycoach/home`의 `main` 소스 커밋 `1ccaa503aa7823ab1711ed70f1880bc83084b671`을 BUILD29/30 READ 소스와 비교했다. 현재 사이트 URL의 실제 HTTP 응답은 사용 가능한 웹 조회에서 가져오지 못했으므로, **실시간 서비스 배포 상태를 확인했다고 주장하지 않는다.** GitHub `main`의 파일 상태와 실제 배포 CDN의 상태는 다를 수 있다.

BUILD29 READ 전용 79개 중 `main`에 없는 파일 78개, 겹쳐 다른 파일 1개였다. 유일한 충돌은 `nal/my/index.html`로, 기존에는 이 기기의 로컬 찜/최근 본 항목을 보여주고 READ 소스에서는 계정/진행 홈을 보여준다. 이를 무작정 덮으면 기존 사용자 기능이 없어질 수 있다.

## 해결한 원본 경로
- 기존 `main`의 MY NAL 로컬 페이지를 `nal/my/local/index.html`에 보존했다. `data-page=my`, 찜/최근 본 기록의 저장소 키, 현재 사이트의 `app.js?v=nal-free-ux-20261008`, `store.js`, 기타 스크립트는 그대로 사용한다. canonical/og URL만 새로운 로컬 경로로 정정했다.
- 새로운 계정/READ 홈은 계속 `nal/my/index.html`로 둔다.
- 현재 사이트 메뉴가 보내던 `/nal/my/#wishlist`는 새 계정 페이지에서 `/nal/my/local/#wishlist`로 이동하도록 좁은 경로 호환을 추가했다.
- 공통 테마, `nal.css`, 기존 `app.js`, `store.js`, `backend.json`, 무료 PDF·STORE 파일과 NAL 나머지 페이지는 변경하지 않았다.

이것은 브라우저 테스트 결과가 아니라 소스 호환 처리를 구현한 결과다.

## 실제 생성한 Git 통합 후보
- **개발 소스:** `feat/nal-read-v1` — `859c7b3e20374a968e1216b74644a2d13dbcd4c3`
- **main 비교 기준:** `1ccaa503aa7823ab1711ed70f1880bc83084b671`
- **별도 후보 브랜치:** `integration/nal-read-build30-host-candidate`
- **후보 커밋:** `0dd95e697e2a246c4fa1953b8bbc7f7d7a75ffbe` (부모는 위 main 커밋)
- **후보 diff:** 새 파일 79개, `nal/my/index.html` 수정 1개, 총 80개 경로

BUILD29 정렬본 79개와 기존 로컬 기능 보존 페이지 1개를 **main 기준 파일 트리 위에 선택적으로 적용한 Git 커밋**이다. 80개 파일은 개발 소스와 같은 Git blob을 가리키고, 그 외 기존 파일은 main의 blob을 그대로 둔다. Git 비교에서는 79 추가·1 수정만 보였다. SQL/Edge 코드·키·전역 설정·GitHub workflow는 이 후보에 섞지 않았다.

후보 브랜치가 존재한다고 실제 GitHub Pages가 그 브랜치를 호스팅하는 것은 아니다. Pages 소스 설정 변경이나 운영 main 갱신, 사이트 배포는 이번에 실행하지 않았다. **공개 미적용 / 판매 OFF / 앱 테스트 미실행**으로 기록한다.

## 후속 적용 제한
1. 실제 사이트가 이 Git 저장소의 어느 ref/artifact를 서비스하는지 확인해야 한다. 이번에는 CNAME/기존 정적 구조와 main 파일 상태를 확인했으며 운영 HTTP 직접 응답은 확인하지 못했다.
2. 최종 반영 직전에 main HEAD를 다시 읽는다. 기록된 SHA와 달라졌다면 현재 호스트의 변경을 반영해 후보를 새로 구성한다.
3. 전체 소스/기존 파일을 삭제 동기화하지 않는다. 유일한 기존 교체 경로는 `/nal/my/`이며 `/nal/my/local/`과 옛 찜 링크 호환을 함께 제공해야 한다.
4. BUILD29의 79파일 오프라인 packager/overlay만으로 main을 직접 덮으면 MY 기존 기능 호환 페이지를 놓친다. **BUILD30의 80경로 후보가 통합 기준**이다.
5. READ OFF·서버 플래그·결제사 설정·인증 callback·고객 공개, 첫 기수 데이터는 모두 별도 단계다. 고객 판매 직전 QA는 기존 사용자 지시대로 별도로 남긴다.

별도 호스팅·유료 프로젝트·API 과금·CI/브라우저 테스트·DB 변경·메인 병합은 하지 않았다. 실제 사용자 데이터도 조회하거나 만들지 않았다.
