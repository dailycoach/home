# DAILYCOACHING 코칭안내·코칭계약 QA 결과 v1.1

- 기준일: 2026-08-01
- 브랜치: `agent/coaching-guide-contract-system-v1`
- 기준: 로컬 코드·정적 Chromium 모의 환경
- 운영 상태: **NOT DEPLOYED**

`PASS`는 아래에 적은 코드 또는 로컬 실행 증거로 확인한 범위만 뜻한다. Cloudflare
운영 환경, 법률 승인, 메일 전달 및 실제 기기 브라우저는 별도 표의 `BLOCKED` 또는
`NOT TESTED`로 구분한다.

## 요약

| 영역 | 결과 | 확인 내용 |
|---|---|---|
| 홈 구조·라우트 | PASS | 33개 라우트 키, 81개 `data-route` 요소, 누락·미사용·중복 없음 |
| `pages.json` | PASS | 29개 항목 `JSON.parse` |
| 신규 경로 | PASS | 필수 파일 31개 존재, 정적 6개 주소 HTTP 200 |
| 프런트 문법 | PASS | 신규 JavaScript `node --check`, 템플릿 JSON 파싱 |
| HTML | PASS | `html-validate` 오류 0건(프로젝트의 기존 스타일 규칙 3개 제외) |
| Worker | PASS | TypeScript 검사, ESM 번들 240.8KB |
| Worker 단위 테스트 | PASS | 4개 파일, 38개 테스트 |
| 의존성 | PASS | `npm audit --audit-level=high --omit=optional`: 취약점 0건 |
| D1 마이그레이션 | PASS | 깨끗한 로컬 D1에 38개 명령 적용, foreign keys 활성 |
| Chromium 레이아웃 | PASS | 360·390·768·1024·1440px, 가로 넘침 없음 |
| 접근성 자동검사 | PASS/WITH MANUAL CHECK | axe 확인 위반 0건; 그라데이션 대비는 팔레트 극값 수동 확인 |
| 계약 모의 흐름 | PASS | 고객·스폰서 분리, 부분/최종 서명, 완료본·철회 UI |
| 실제 Worker+D1 종단간 | BLOCKED | 승인 법률 템플릿과 Cloudflare 프리뷰 환경 없음 |
| 운영 배포 | NOT DEPLOYED | Cloudflare 자격·D1·Access·도메인·메일 채널 없음 |

## 코드 구조·메뉴

- `index.html`의 검사·활동·운영자 링크 문자열 삽입을 제거했다.
- 운영 링크와 `DAILYCOACHING_ROUTES`를 `index-source-disc.html`에 직접 통합했다.
- `kgm210` 다음에 존재하지 않던 `flourishAwareness`를 기대하던 치환 의존을 없애고
  `flourishAwareness`, `disc16`, `disc16Youth` 라우트를 원본에 등록했다.
- 기존 `grow88` 링크가 가리키던 실제 경로와 라우트 키의 불일치를 `kingdom35`로
  교정했다.
- 코칭안내 데스크톱 드롭다운, 전체 메뉴 카테고리 5개 링크, 푸터 2개 링크와
  기업소개·코치소개 메뉴를 확인했다.
- 모바일 전체 메뉴 360×640에서 열기·닫기·ESC·포커스 복귀·본문 스크롤 잠금과
  복원·패널 세로 스크롤·가로 넘침 없음·가로쓰기 유지가 모두 확인됐다.
- 기존 검사·활동·미술심리코칭·LCMS 파일은 기준 `main` 대비 수정하지 않았다.

## 계약 템플릿·흐름

| 항목 | 결과 |
|---|---|
| 공통 27개 조항 순서·식별자 | PASS |
| 라이프 추가 5개 조항 | PASS |
| 비즈니스 추가 7개 조항 | PASS |
| 커리어 추가 7개 조항 | PASS |
| 성인 고객 전용·미성년자 차단 | PASS |
| 비즈니스 코치·고객·스폰서 필수 서명 | PASS |
| 비즈니스 세션 원문·노트·개인 발언 기본 공유 금지 | PASS |
| 발행 스냅샷과 SHA-256 고정 | PASS |
| 발행 후 원본 변경 DB 트리거 차단 | PASS |
| 변경 시 새 계약·이전 계약 `superseded` | PASS |
| 마지막 서명 후 최종 문서 생성 | PASS (단위·코드 경로) |
| 최종화 실패 후 토큰 재시도·관리자 멱등 복구 | PASS (단위·코드 경로) |
| 만료된 `issued` 계약의 lazy `expired` 전이·초대 폐기·감사 | PASS (단위·코드 경로) |

계약 전문, 개인정보, 서명자 원문 및 초대 토큰은 정적 HTML·URL 쿼리의 식별정보·
LocalStorage·SessionStorage·`pages.json`에 저장하지 않는다. 서명·완료 모의 흐름에서
두 브라우저 저장소의 항목 수가 모두 0임을 확인했다.

## 선택 동의

| 시험 | 결과 | 증거 |
|---|---|---|
| 모두 미동의 | PASS | 서버 조합 테스트 + 고객 서명 모의 E2E |
| 녹음만 동의 | PASS | 서버 조합 테스트 |
| AI 요약만 동의 | PASS | 서버 조합 테스트 |
| 익명 사례만 동의 | PASS | 서버 조합 테스트 |
| 후기·홍보만 동의 | PASS | 4개 공개요소·채널·기간을 포함한 서버 조합 테스트 |
| 일부 동의 후 철회 | PASS | 완료본 세션 철회 모의 E2E |

공통 확인 사항:

- 4개 항목은 독립 결정이며 기본 체크와 일괄 동의가 없다.
- 모두 거부해도 서명 버튼을 활성화할 수 있다.
- 고객이 모든 항목을 결정하기 전에는 서명 버튼이 비활성이다.
- 스폰서는 고객 선택 동의를 조회·대리 선택하지 않는다.
- 문구 버전과 SHA-256 해시를 표시 스냅샷에서 받아 서버에 되돌려 보내며 서버가
  고정 문구와 비교한다.
- AI 서비스·입력 범위·검토·외부 제공·국외 처리·보유기간·철회 정보가 미완성인
  경우 AI 동의 자체가 비활성이다.
- 녹음·AI 기능은 해당 동의가 유효하지 않으면 실행할 수 없도록 계약 조건에 고정한다.
- 철회는 현재 동의 상태와 별도로 이력을 남기며, 실제 `true → false` 변경만
  `consent_withdrawn` 감사 이벤트로 기록한다.

## 보안

| 항목 | 결과 |
|---|---|
| 저장소 API 키·관리자 비밀번호 | 발견 없음 |
| 초대·PIN·세션·최종열람 토큰 원문 DB 저장 | 없음; 목적별 HMAC-SHA-256 |
| 개인정보·자유서술·서명·스냅샷 | AES-256-GCM + 문맥별 AAD |
| 관리자 API | Cloudflare Access JWT의 서명·issuer·audience·시간 검증 코드 |
| 고객 API | POST 토큰 교환 후 메모리 Bearer 세션 |
| URL 토큰 | 즉시 `history.replaceState`; 구식 path-token API는 410 |
| CORS | 단일 정확한 HTTPS Origin만 허용 |
| 요청 재전송 | 16~128자 난수 `request_id`와 D1 nonce |
| 확인번호 무차별 입력 | 횟수 잠금 + D1 속도 제한 |
| 감사로그 개인정보 | IP 증거 HMAC, user-agent 요약; 원문 개인정보·토큰·PIN 제외 |
| 발행 후 변조 | 고정 snapshot hash 재계산·불일치 차단 |
| 계약 버전·감사기록 변경 | D1 immutable trigger |
| 클릭재킹 응답 헤더 | Worker API 코드에는 적용; 정적 GitHub Pages 헤더는 NOT TESTED |

## 접근성·브라우저

- Chromium 138에서 코칭 관련 6개 페이지를 390px와 1440px로 axe 검사했고 확인된
  WCAG 2 A/AA 위반과 ARIA 불완전 항목은 0건이었다.
- axe가 배경 그라데이션 때문에 코칭안내 38개, 계약 허브 7개 노드의 대비를 자동
  판정하지 못했다. 실제 팔레트의 가장 밝은 중첩 배경을 기준으로 일반 본문 조합을
  계산한 최소 대비는 5.25:1, 연한 골드 조합은 5.71:1이었다.
- 모든 입력에 label 연결, 구체적 오류와 live region, 키보드 진행, 포커스 표시,
  44px 이상 터치 영역, `prefers-reduced-motion` 대응을 확인했다.
- 실제 Chrome Android, Samsung Internet, Chrome Windows, Safari iPhone/macOS,
  Edge Windows 기기·엔진 검사는 수행하지 않았다.
- 로컬 홈페이지에서 기존 외부 WordPress 이미지 3개가 제한된 네트워크로 인해
  `ERR_EMPTY_RESPONSE`였으나 JavaScript page error는 없었다. 코칭계약 정적 페이지의
  콘솔·page error는 0건이었다.

## 법률·외부 권한 차단 항목

다음 항목은 코드가 존재해도 운영 사용 전에는 `LEGAL_REVIEW_REQUIRED` 또는
`NOT DEPLOYED` 상태다.

1. 취소·환불·청약철회 기준
2. 준거법·분쟁 처리
3. 개인정보 처리근거·보유·파기
4. 처리위탁·국외 이전과 실제 Cloudflare·메일·AI 사업자
5. 전자서명 증빙 수준과 전자문서 보관 방식
6. 미성년자 제외 고지의 적정성
7. 비밀보장 예외와 공개 최소 범위
8. AI 서비스별 입력·검토·외부 제공·국외 처리 문구
9. Cloudflare Worker·운영 D1·Access·API 도메인·인증서·정적 응답 헤더
10. 최종 계약본 이메일 전달 채널과 처리위탁 조건

현재 서버 템플릿에 검토 표시가 남아 있고 승인 manifest·정책값이 없으므로
`/v1/health`와 `/v1/admin/session`은 계약 발행 준비 완료를 반환하지 않으며,
`issue` API는 fail-closed 방식으로 차단한다.

## 재현 명령

```bash
node scripts/check-coaching-contracts.mjs
npx html-validate --rule=doctype-style:off --rule=void-style:off \
  --rule=prefer-native-element:off \
  index-source-disc.html company/index.html coach/index.html \
  coaching/index.html coaching/contracts/index.html \
  coaching/contracts/privacy/index.html coaching/contracts/coach/index.html \
  coaching/contracts/sign/index.html coaching/contracts/complete/index.html
cd workers/coaching-contract-api
npm run check
npm test
npm audit --audit-level=high --omit=optional
wrangler d1 migrations apply coaching-contracts --local --persist-to /tmp/coaching-contract-d1
```
