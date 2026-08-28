# APILOS Google Search Console 설정

## Property

- 권장/선택 유형: Domain property
- 값: `daily-coach-ing.com`
- 범위: 모든 프로토콜 및 하위 도메인
- Search Console 세션: 로그인 상태 확인

## Verification

- 방법: DNS TXT
- DNS 이름/호스트: `@` 또는 DNS 제공업체가 루트 도메인에 요구하는 빈 호스트 값
- DNS 값:

```text
google-site-verification=xjjPqraQDRBHUBOH0pnVMmOlFRTvys-GEHlISsQzE6I
```

- 발급 출처: Google Search Console의 `daily-coach-ing.com` Domain property 소유권 확인 화면
- 상태: `EXTERNAL ACTION REQUIRED`
- 현재 조치: DNS를 수정하지 않았고 Search Console의 `확인` 버튼을 누르지 않았다.

## Sitemap

- 제출 URL: `https://daily-coach-ing.com/sitemap.xml`
- 상태: property 소유확인 완료 후 제출 필요

## Priority indexing URLs

### P0

- `https://daily-coach-ing.com/apilos/`
- `https://daily-coach-ing.com/apilos/programs/`
- `https://daily-coach-ing.com/apilos/center/`

### P1

- `https://daily-coach-ing.com/apilos/archive/`
- `https://daily-coach-ing.com/apilos/news/`
- `https://daily-coach-ing.com/apilos/books/`

### P2

- `https://daily-coach-ing.com/apilos/programs/professional-academy/`
- `https://daily-coach-ing.com/apilos/programs/youth-family-school/`
- `https://daily-coach-ing.com/apilos/programs/pastoral-coaching/`
- `https://daily-coach-ing.com/apilos/programs/professional-network/`
- `https://daily-coach-ing.com/apilos/programs/social-impact/`
- `https://daily-coach-ing.com/apilos/programs/research-publication/`

## Remaining action

1. `daily-coach-ing.com` DNS 관리 화면에서 위 TXT 값을 루트 도메인에 추가한다.
2. DNS 전파 후 현재 Search Console 소유권 확인 화면에서 `확인`을 누른다.
3. 소유확인이 성공하면 sitemap을 제출한다.
4. P0 → P1 → P2 순서로 URL 검사를 실행하고 가능한 URL에 색인 생성 요청을 한다.

Search Console이 발급한 실제 TXT만 기록했다. HTML에 Google verification meta를 추가하지 않았고 placeholder도 만들지 않았다.
