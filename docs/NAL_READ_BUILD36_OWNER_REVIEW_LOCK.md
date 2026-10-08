# NAL READ BUILD36 — 소유자 개인정보 검토의 사전 출시 잠금

## 현재 확인한 상태
실제 개발 브랜치 `feat/nal-read-v1`의 BUILD35 검토 화면은 작성됐지만 서버의 `nal-read-privacy-admin` API는 없다. READ 공개 모드는 OFF, 별도 저널 파기 실행 스위치도 OFF, 승인된 개인정보 처리 고지 버전 NULL이다. owner 멤버십과 개인정보 요청/검토 행도 0건이다.

2026년 10월 9일 현 시점에서 **민감한 공통 서버 인증 계층의 변경을 승인·반영하지 않았다.** 이전 BUILD34에서 그 권한 변경은 안전 검사에 차단됐고, 이번에도 다른 작성 도구를 사용해 우회하지 않았다. `p_user_id` 자동 주입 도우미와 `p_owner_id`가 필요한 소유자 전용 DB RPC의 서명 불일치는 해결되지 않았다.

## 이번 실제 소스 구현
기존 `/nal/read/admin/privacy/`의 JS에 **프런트엔드 사전 출시 잠금**을 추가했다. 새 정적 선언 `/nal/data/read-privacy-review.release.json`의 값은 다음 모두가 FALSE다: UI 공개, 소유자 인증 연결 검토, 독립 서버 스위치 준비, 개인정보 고지 승인, 관리자 API 배포.

UI는 이 선언을 읽을 수 없거나, JSON이 잘못됐거나, 승인 필드 하나라도 false면 **소유자 홈 RPC와 개인정보 관리자 API를 아예 호출하지 않는다.** 실제 접수 기록 0건으로 오해하지 않도록 ‘아직 연결되지 않았음’을 명시적으로 안내한다. 파일은 요청마다 새로 읽고 캐시/로컬 저장에 긍정 결과를 보존하지 않는다.

**이 정적 JSON은 보안 권한이 아니다.** 공격자가 브라우저를 수정할 수 있으므로, 향후 서버의 별도 default-OFF `NAL_PRIVACY_ADMIN_ENABLED`, 최신 Auth 검증, 기존 owner 멤버십, 직접 Postgres 권한 통제를 반드시 유지해야 한다.

화면이 허용하도록 작성된 세 동작은 목록 `queue`, 건수 미리보기 `preview`, 검토 시작 `start-review`뿐이다. `approve-journal`, `execute-journal`, 파기 기능 켜기·계정 삭제는 추가하지 않았다.

## 승인해야 할 서버 설계
- `nal-read-privacy-admin`은 **독립 기능 스위치 기본 OFF**, 인증된 사용자 JWT 및 요청당 검증된 사용자만 허용해야 한다.
- 소유자 ID `p_owner_id`는 브라우저가 보내는 값이나 `user_metadata`가 아닌 최신 Auth 검증 결과에서만 도출해야 한다.
- DB 관리자 RPC도 `nal_private.admins`의 현재 `owner` 역할을 확인하며, 이 역할을 화면에서 임의 생성하지 않는다.
- 매 호출마다 고정 허용된 3개 명령과 입력 필드만 받는다. 파기 승인·실행 함수는 서버의 이 경로에서 사용할 수 없어야 한다.
- 서비스 키는 오직 Edge 안에서만 사용한다. 브라우저는 publishable key + 로그인 사용자 Bearer를 사용한다.
- 보안 검토와 승인된 인증 변경 수단이 확보되기 전까지 기존 공통 Auth 코드·DB 함수는 변경하지 않는다.

참고한 공식 문서:
- https://supabase.com/docs/guides/functions/auth-headers
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable

## 미변경과 남은 작업
기존 `nal-account` Edge v2, READ API 11개, BUILD33 개인정보 삭제 검토 DB, 기존 STORE/PDF, 첫 기수 원고·일정·가격·권한, 환경변수와 Auth redirect를 바꾸지 않았다. GitHub Pages 호스팅 Draft PR #166, 개발 Draft PR #160도 병합하지 않았다. 테스트·외부 결제/메시지·실제 삭제·DB 변경·새 유료 자원 없이 **개발 브랜치 소스만 추가**했다.

보안 인증 경계가 정식으로 승인되면 관리자 Edge 연결을 진행하고, 고지·보존정책 확정 후 호스팅 후보를 새 main 상태와 맞춰야 한다. 이후 고객 판매 직전 기능 검증을 별도로 수행한다. 이번 정적 잠금 자체를 인증 보안이나 법률 준수 검증 완료로 해석하지 않는다.

