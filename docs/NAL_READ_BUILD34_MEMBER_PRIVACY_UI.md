# NAL READ BUILD34 — 내 기록 조회·개인정보 요청 상태 화면 소스

## 적용 결과
BUILD32/33의 실제 개인정보 요청/검토 DB를 바탕으로 **참가자 MY NAL의 개인정보 요청 상태 화면을 개발 브랜치에 소스만 추가**했습니다. `/nal/my/privacy/`는 기존 MY NAL 로그인과 기존 `nal-account` 서버 API(`area=privacy`)를 사용합니다. 새로운 Auth 클라이언트, 별도 계정 저장소, 신규 서버·유료 리소스를 추가하지 않았습니다.

이번 범위는 화면 소스 작성입니다. **GitHub Pages main 또는 호스팅 후보 PR #166을 병합·배포하지 않았습니다.** 따라서 현재 공개 서비스에서 이 URL의 작동을 확인했다고 주장하지 않습니다.

## 참가자에게 보이도록 준비한 것
- **내 기록:** 저장한 답변, DAY 진행, 초안, 실험, 중요 표시, 리포트, 준비 확인, LIVE 메모의 **건수**만 확인합니다. 본문을 브라우저에 새로 불러오거나 운영자에게 전송하지 않습니다.
- **별도 기록:** 주문·고객 문의·참가 등록은 셀프코칭 저널과 구분해 보존 검토 대상으로 표시합니다.
- **요청 상태:** 기존 본인 요청의 접수·철회·검토·보존 확인·처리 기록 상태를 표시합니다. `fulfilled`가 Auth/결제/Storage/백업 전체 삭제를 보증하지 않음을 명시합니다.
- **철회:** `requested` 요청에서만 사용자가 직접 확인한 후 기존 `withdraw` RPC를 호출합니다. 삭제 실행 RPC는 브라우저 코드에 없습니다.
- **새 요청 접수:** 개인정보처리방침과 고지 버전이 아직 확정되지 않았으므로 **접수 폼을 일부러 제공하지 않았습니다.** 기존 고객지원 경로로 안내합니다.

`NAL_PRIVACY_REQUEST_ENABLED`가 서버에서 OFF이면 문의 화면으로 안내합니다. 503/403/오류를 기록 0건으로 취급하지 않습니다. 세션 변경 시 과거 사용자 데이터가 화면에 남지 않도록 기존 계정 세션의 `epoch`와 화면 `generation`을 확인하고, 모든 사용자 메시지는 `textContent`를 사용합니다. 자동 새로고침·localStorage 복제·세션 토큰 표시·로그 출력은 없습니다.

## 실제 변경한 파일
신규:
1. `nal/my/privacy/index.html`
2. `nal/assets/js/read-privacy-member.js`
3. `nal/assets/css/nal-privacy.css`

수정:
1. `nal/my/index.html` — 개인정보 요청 상태 이동 링크
2. `nal/assets/js/account-layout.js` — MY NAL의 기존 계정 메뉴/푸터에 이동 경로 추가

기존 무료 PDF·STORE·MY NAL 기기 로컬 기능, 원고·상품·가격·권한·개인정보처리방침 URL은 수정하지 않았습니다.

## 관리자 검토 API를 이번에 배포하지 못한 이유
준비한 관리자용 서버 코드는 새로운 `nal-read-privacy-admin` Edge 함수와 기존 `_shared/nal-read-auth.mjs` 권한 경계 변경을 요구합니다. GitHub 저장소의 **권한 관련 소스 수정 요청이 안전 검사에서 차단**됐습니다. 이 요청을 다른 작성 수단으로 우회하지 않았으며 **관리자 API나 관리자 화면이 구현·배포됐다고 표기하지 않습니다.**

기존 공유 Auth RPC 도우미는 검증한 사용자 ID를 `p_user_id`로 추가하지만 BUILD33 관리자 검토 함수는 `p_owner_id`를 요구합니다. 서버에서 확인한 실제 소유자 ID를 전달하도록 인증 경계를 수정해야 하며, 클라이언트에서 `p_owner_id`를 직접 고르도록 하면 안 됩니다. 지원 범위를 `queue`, `preview`, `start-review`로 제한하고, `approve-journal`/ `execute-journal`을 웹/Edge 라우트에 노출하지 않는 방향이 필요합니다.

관리자 라우트는 독립 환경 스위치 `NAL_PRIVACY_ADMIN_ENABLED` 기본 OFF, 인증된 JWT, 현재 owner 멤버십·최신 서버 Auth 확인을 모두 충족해야 합니다. DB의 저널 파기 스위치는 별도 승인 없이는 계속 OFF입니다. 기존 운영자 권한·신규 owner 계정은 발급하지 않았습니다.

## 미완료 / 다음
개인정보 처리 주체·연락처·보존 기한·실제 처리 위탁·국외 이전·저장소/로그/백업 파기, 첫 시즌 운영자/일정/정원/가격, 게시용 개인정보처리방침은 미확정입니다. 관리자 검토 경로는 보안 경계 검토 이후 승인된 작성 절차에서 별도로 구현해야 합니다.

이번 변경을 **서비스 공개나 고객 검증 PASS로 해석하면 안 됩니다.** 사용자 요청에 따라 실제 로그인·브라우저·결제·회원 삭제 동작 테스트는 판매 직전까지 보류합니다.

참고 재개 자료: `integration/nal-read/build34/owner-route-handoff.json`, 전 단계 `docs/NAL_READ_BUILD33_PRIVACY_REVIEW_ERASURE_LOCKED.md`.

