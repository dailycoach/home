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
- DNS 제공업체: 가비아
- TTL: 600초
- 상태: `VERIFIED`
- 완료 조치: 루트 도메인 TXT 추가, 공개 DNS 전파 확인, Search Console 소유권 확인 완료

## Sitemap

- 제출 URL: `https://daily-coach-ing.com/sitemap.xml`
- 제출 상태: `성공`
- Search Console 발견 페이지 수: 77

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

## Indexing requests completed

- `https://daily-coach-ing.com/apilos/`
- `https://daily-coach-ing.com/apilos/programs/`

두 URL 모두 URL 검사 후 색인 생성 요청 접수를 확인했다. 나머지 URL은 sitemap을 통해 발견될 수 있으며, 필요하면 P0 → P1 → P2 순서로 추가 요청한다.

Search Console이 발급한 실제 TXT만 사용했다. HTML에 Google verification meta나 placeholder는 추가하지 않았다. 실제 색인 반영은 Google 처리 일정에 따라 시간이 걸릴 수 있다.
