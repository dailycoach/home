# APILOS Naver Search Advisor 설정

## Target site

- 권장 사이트: `https://daily-coach-ing.com/`
- 이유: APILOS를 포함한 production origin 전체를 소유확인하고 루트 sitemap을 단일 기준으로 제출하기 위함

## Verification

- 현재 상태: `BLOCKED_BY_EXTERNAL_VERIFICATION`
- 실제 Naver verification token: 미발급
- 저장소/운영 HTML 확인: `naver-site-verification` meta 없음
- 조치: token을 임의 생성하거나 placeholder를 삽입하지 않음

Google Domain property의 DNS 확인 단계에서 사용자 조치가 필요해 외부 등록 흐름을 중지했다. Google 확인 완료 후 Naver Search Advisor에서 아래 절차를 계속한다.

## Site registration

1. Naver Search Advisor 웹마스터 도구에서 `https://daily-coach-ing.com/`을 등록한다.
2. Naver가 제공하는 실제 소유확인 방법과 token을 확인한다.
3. HTML meta 방식을 선택했다면 Naver가 제공한 meta tag 전체를 검증 대상 HTML의 `<head>`에 그대로 삽입한다.

실제 provider 값이 없으므로 현재 저장소에는 어떤 verification meta도 추가하지 않았다.

## Sitemap

- 제출 URL: `https://daily-coach-ing.com/sitemap.xml`
- 상태: 사이트 소유확인 완료 후 제출 필요

## URL inspection / collection priority

1. `https://daily-coach-ing.com/apilos/`
2. `https://daily-coach-ing.com/apilos/programs/`
3. `https://daily-coach-ing.com/apilos/center/`
4. `https://daily-coach-ing.com/apilos/archive/`
5. `https://daily-coach-ing.com/apilos/news/`

## Remaining action

1. Naver Search Advisor 로그인 상태를 확인한다.
2. production root 사이트를 등록한다.
3. provider가 발급한 실제 token으로 소유확인한다.
4. 루트 sitemap을 제출한다.
5. 우선순위 URL을 검사하고 웹페이지 수집 요청을 진행한다.
