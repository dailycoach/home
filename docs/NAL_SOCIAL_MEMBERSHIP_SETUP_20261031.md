# NAL 카카오·Google 회원가입 구축 및 개통 인계

기준일: 2026-10-31, Asia/Seoul. 기준 소스: `dailycoach/home`의 `8c14dd196c9d3a608102b7bbdecaa241bdd7eab8`.

## 1. 현재 결과와 운영 상태

이번 변경은 기존 NAL 전용 Supabase를 재사용하는 소셜 회원가입 코드와 PDF 구독 설계다. 운영 사이트 배포, OAuth 공급자 활성화, 정책 확정, 결제 계약, 실제 회원 생성, 결제 또는 운영 DB 변경을 수행하지 않았다.

직접 확인한 공개 런타임 설정:

| 확인 대상 | 확인 결과 |
| --- | --- |
| Supabase 프로젝트 | `nal-platform`, `tdglznjjkgaulerbduwt`, 서울 |
| Auth `/auth/v1/settings` | Kakao `false`, Google `false`, email `true` |
| 공개 카탈로그 `site.features` | `account`, `checkout`, `storePurchase`, `orderLibrary`, `secureDownload` 모두 `false` |
| 공개 운영자 정보 | 운영자·대표자·사업자등록번호·주소·연락처가 비어 있음 |
| 사이트 응답 | `x-github-request-id` 응답 헤더 확인; 기존 GitHub Pages 호스팅 |
| 정책 페이지 소스 | 정식 약관·개인정보 처리방침 공개 전 안내 |

이 상태를 "로그인 개통 완료" 또는 "유료 구독 운영 중"으로 표현하면 안 된다. 기존 무료 PDF·모임·DAILYCOACHING 클래스와 다른 미병합 READ/Commerce 브랜치는 이번 변경에 포함하지 않는다.

## 2. 구현된 페이지

| 경로 | 역할 |
| --- | --- |
| `/nal/login/` | 카카오·Google 통합 가입/로그인, 미연결 상태 안내, 무료 PDF 진입 |
| `/nal/auth/callback/` | PKCE 코드 교환, 서버 사용자 확인, 최초 이름·약관·개인정보 확인 |
| `/nal/my/account/` | 회원 이름·로그인 방법·이메일 확인 상태·로그아웃 |
| 기존 `/nal/my/` | 찜·최근 기록 보존; 계정 기능 공개 후 회원정보 진입 추가 |

`nal/data/membership.json`의 `authEnabled:false`, `policyVersion:null`은 현재 준비 상태다. `allowedOrigins`에는 실제 공개 도메인만 등록한다. 카탈로그 `features.account`는 메뉴 노출 여부다. 이 두 값은 브라우저 표시 설정이며, 실제 인증은 Supabase Auth, 데이터 소유권은 RLS가 집행한다.

독립 회원 페이지는 공통 카탈로그 생성기가 덮어쓰지 않는다. `scripts/generate-nal-pages.mjs`는 회원 페이지의 경로 정보만 `routes.json`에 보존한다.

## 3. 두 종류의 콜백 주소

두 주소는 용도가 다르므로 서로 바꾸어 등록하지 않는다.

| 등록 위치 | 정확한 값 |
| --- | --- |
| Kakao Developers의 Redirect URI | `https://tdglznjjkgaulerbduwt.supabase.co/auth/v1/callback` |
| Google OAuth Web client의 Authorized redirect URI | `https://tdglznjjkgaulerbduwt.supabase.co/auth/v1/callback` |
| Supabase Auth URL Configuration의 Site URL | `https://daily-coach-ing.com/nal/` |
| Supabase Auth 허용 Redirect URL | `https://daily-coach-ing.com/nal/auth/callback/` |
| Google Authorized JavaScript origin | `https://daily-coach-ing.com` |
| Google 앱의 서비스 도메인 | `daily-coach-ing.com` |

개발/스테이징 도메인을 추가할 때는 그 도메인의 callback을 별도로 등록한다. 운영 도메인에 광범위한 wildcard를 사용하지 않는다. 호스팅 이전으로 원본 도메인이 달라지면 앱 콘솔, Supabase 허용 목록, membership.json을 같은 배포에서 함께 맞춘다.

## 4. 외부 계정에서 완료할 설정

### Kakao Developers

1. NAL용 기존 앱이 있으면 재사용한다. 서비스 이름·운영주체·사이트 도메인을 확인한다.
2. 카카오 로그인을 활성화하고 위 Supabase callback을 등록한다.
3. REST API key를 Supabase Kakao Client ID에, Kakao Login Client Secret을 Client Secret에 안전하게 등록한다.
4. 필요한 동의항목만 요청한다. 연락처·생년월일·성별·친구목록·메시지 권한을 가입 필수로 추가하지 않는다.
5. 이메일 없는 로그인을 허용하려면 Supabase Kakao의 `Allow users without an email`을 설정하고 해당 시나리오를 실제 테스트한다. 이메일을 받는 경우 카카오 동의항목 이용 권한과 검증 여부를 확인한다.

카카오싱크와 채널 추가·오픈채팅 입장은 기본 로그인과 별도다. 이번 가입 구현이 카카오톡 단체방 자동 입장이나 카카오페이 자동결제를 제공하지 않는다.

### Google Auth Platform

1. 기존 NAL용 프로젝트와 Web application OAuth client가 있는지 확인한다.
2. 실제 서비스명, 지원 연락처, 홈페이지, 공개 개인정보처리방침·이용약관을 등록한다.
3. 기본 로그인 범위 `openid email profile`만 사용한다.
4. 위 origin과 Supabase callback을 정확히 등록한다.
5. Client ID와 Client Secret은 Supabase Google provider 설정에 등록한다.
6. 대상 사용자·운영 게시 상태와 Google이 요구하는 브랜드/도메인 확인을 완료한다.

Google이 카카오톡 등의 인앱브라우저를 거부할 수 있어 로그인 화면에 외부 브라우저 안내가 있다. 기존 OAuth URL을 복사하지 않고 NAL 로그인 페이지를 새 브라우저에서 다시 연다.

### 비밀값 취급

시크릿은 GitHub·브라우저 JS·공개 JSON·문서·채팅에 넣지 않는다. Supabase provider의 전용 입력란에서 등록한다. 공개 프런트엔드는 기존 `backend.json`의 publishable key만 사용한다.

## 5. 회원과 동의 처리

- 식별 기준은 Supabase가 검증한 사용자 UUID다. 이메일·닉네임·사용자 편집 메타데이터를 권한 식별자로 사용하지 않는다.
- SDK의 PKCE 인증을 사용하고, callback에서 인증 코드를 한 번 교환한다. 주소창의 code·오류·fragment는 비동기 작업 전에 지운다.
- SDK의 실제 저장소 동작을 점검한 뒤 인증을 시작한다. 각 탭의 PKCE flow ID는 sessionStorage에 보관해 callback 교환 시 명시적으로 전달한다. 다른 탭의 로그인으로 기존 사용자 정보가 늦게 도착하면 그 결과를 버리고 현재 사용자를 다시 확인한다.
- `getUser()`로 서버 확인 후 `nal_profiles`와 `nal_consents`를 읽는다. 다른 회원의 기록을 읽거나 수정할 수 있도록 RLS를 완화하지 않는다.
- 최초 가입에서 표시 이름, 실제 적용 중인 약관 및 개인정보 안내 동의를 저장한다. 정책 버전과 기록 시각을 보존하고 서버 재조회 성공 후 가입 완료로 표시한다.
- 현재 DB는 본인 프로필의 insert/update와 본인 동의의 제한된 열 insert를 허용한다. 클라이언트가 동의 `recorded_at`을 임의로 전송하지 않는다.
- 가입 중단 시 Supabase Auth에 중간 계정이 남을 수 있다. 실제 개인정보처리방침에는 중간 계정의 보존·정리, 문의/탈퇴 처리, 거래 보존정보와의 구분을 포함해야 한다.
- 마케팅 수신동의를 가입 필수로 묶지 않는다. 이번 화면에서는 광고메일 신청을 받지 않는다.
- 동일 이메일 계정 연결은 Supabase의 검증된 identity 동작에 맡긴다. 자체 이메일 비교 병합을 만들지 않는다. 다른 이메일의 계정을 수동 연결하는 UI는 이번 범위 밖이다.

## 6. 결제와 연결할 때 지킬 경계

이메일 없는 카카오 회원도 무료 회원가입은 가능하다. 그러나 기존 단건 결제 및 유료 PDF 전달은 `email_confirmed_at`을 요구하므로, 결제 전 연락용 이메일을 등록·검증하는 별도 흐름이 필요하다. 현재 계정 화면은 그 상태를 안내하며, 기존 결제 검증을 약화하지 않는다. 이메일 입력만으로 "검증됨"을 표시하지 않는다.

구독 가격, 자동결제 동의, 빌링키, 회차 원장, 해지, 유료 자료실은 [구독 과금 설계서](NAL_PDF_SUBSCRIPTION_DESIGN_20261031.md)에 정의되어 있다. 이번 변경은 정기결제 서버를 새로 가동하지 않는다. 유료 권한을 `localStorage`나 회원 UI 플래그로 부여하지 않는다.

GitHub Pages는 온라인 상거래 호스팅 용도로 허용되지 않는다. 유료 판매를 열기 전에 NAL의 상거래 페이지·런타임을 Cloudflare 같은 적합한 호스팅으로 옮긴다. 이 작업을 위해 다른 DAILYCOACHING 서비스까지 임의로 이전하지 않는다.

## 7. 개통 순서와 완료 기준

1. 실제 운영자 표시 정보와 회원 정책을 완성하고 공개한다. 문서 내용과 실제 수집·보관·문의/탈퇴 경로를 일치시킨다.
2. Kakao·Google 앱/시크릿/callback을 연결한다. 서비스용 계정 범위와 도메인을 확인한다.
3. 검증용 환경에 회원 코드와 실제 정책 버전을 배포하고, 실제 계정으로 신규 가입·재로그인·취소·로그아웃·동의 실패 재시도를 확인한다.
4. 카카오 이메일 누락, 카카오톡 인앱 유입, 여러 탭 계정 전환, 다른 사용자 기록 차단을 확인한다. 테스트 더블의 통과를 실제 OAuth 성공으로 대체하지 않는다.
5. 확인한 정책 버전을 `membership.json`에 적용하고 `authEnabled`를 켠다. 회원 메뉴 공개 시 정적 `site.json`과 **실제 공개 카탈로그**의 `features.account`를 함께 맞춘다. 정적 JSON만 고쳐서는 Supabase 카탈로그로 동작하는 운영 메뉴가 바뀌지 않는다.
6. 유료 구독은 별도 PG 계약·결제 테스트·상거래 호스팅·환불 고지·콘텐츠 준비를 완료한 후 연다.

## 공식 문서

- [Supabase Kakao 로그인](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao)
- [Supabase Google 로그인](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Supabase identity 연결](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [GitHub Pages 사용 제한](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Google 로그인 브랜딩](https://developers.google.com/identity/branding-guidelines)
- [카카오 로그인 디자인 가이드](https://developers.kakao.com/docs/ko/kakaologin/design-guide)

