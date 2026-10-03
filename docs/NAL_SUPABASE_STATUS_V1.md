# NAL Supabase 실제 연결 상태

## 연결

- 프로젝트: `nal-platform`, ref `tdglznjjkgaulerbduwt`
- 조직: `udzaugmtleotbeomjvar` / 생성 당시 Free 조직
- 리전: 서울 `ap-northeast-2`
- DB: PostgreSQL 17.11 / `ACTIVE_HEALTHY`
- API: `https://tdglznjjkgaulerbduwt.supabase.co`
- 다른 ERP 프로젝트와 별도 DB다.

## 적용된 데이터

| 대상 | 전체 | 공개 |
|---|---:|---:|
| 프로그램 | 10 | 9 |
| 상품 | 8 | 4 |
| 진행자 | 2 | 2 |
| 콘텐츠 | 1 | 1 |
| 사이트 설정·우선 런칭 | 2 | 2 |

테이블은 공개 스키마 11개·비공개 스키마 2개이며 전부 RLS가 켜져 있다.
운영 회차·신청자·회원·주문·결제는 임의 생성하지 않았다. 테스트 계정과
회차는 트랜잭션을 롤백했고 실제 DB에 남은 테스트 데이터는 0건이다.

## 실제 동작 범위

`backend.json`은 공개용 publishable key만 보관한다. 런타임은
`nal_public_catalog()` RPC에서 공개 카탈로그·사이트 설정·우선 런칭을 읽는다.
기존 첫 런칭 화면·이미지·URL을 유지하고 페이지 생성기도 해당 구성을
재현한다. 회원·신청·주문·결제 데이터는 이 공개 RPC에 포함하지 않는다.

백엔드가 활성화된 상태에서 API 오류가 나면 재시도 안내를 표시한다.
이 경우 오래된 JSON의 가격·정원을 실제 값인 것처럼 대신 표시하지 않는다.
명시적 롤백은 `backend.json`의 `enabled`를 `false`로 바꾸고 검수·배포하여
기존 JSON 소스로 되돌릴 수 있다. DB 데이터는 삭제하지 않는다.

DB에는 소유자별 프로필·찜·팔로우 정책, 신청 RPC, 대기 신청, 유료 신청의
15분 자리 보유, 취소, 주문·결제 기록과 관리자 변경 이력이 준비되어 있다.
신청 RPC는 회차 행을 잠가 정원을 계산하고 원래 요청 ID로 중복 호출을
처리한다. 유료 확정 신청 취소는 환불 검토 요청이며 자동 환불을 뜻하지 않는다.

## GPT 운영

- Supabase 연결로 카탈로그·신청·주문을 조회하고 권한에 맞는 운영 변경을 수행한다.
- 공개 여부·가격·소개 변경은 DB 공개 RPC에 반영되어 페이지를 다시 열면 표시된다.
- 새 slug·페이지·SEO·사이트맵 변경은 DB와 정적 스냅샷을 일치시킨 후 생성기·QA·GitHub 배포를 함께 수행한다.
- 개인정보·신청자·주문·결제 데이터는 공개 저장소나 JSON 스냅샷에 저장하지 않는다.
- 브라우저용 키로 관리자 작업을 수행하지 않는다. 실제 관리자의 Auth 사용자 ID를 확인한 뒤 비공개 관리자 명단에 등록한다.

## 검증

- PostgreSQL/PGlite 검사 45개 통과
- 실제 DB: 회원 간 기록 분리, 익명 접근 차단, 정원·대기, 중복 호출, 취소 통과
- 공개 HTTP API: 프로그램 9·상품 4·진행자 2·콘텐츠 1 및 사이트·런칭 원본 일치
- 기존 NAL QA: 31페이지 통과
- 보안 Advisor: finding 0건
- 성능 Advisor: 새 DB의 미사용 인덱스와 관리자/회원 읽기 정책 중복 안내가 있음
  ([정책 중복 안내](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies),
  [미사용 인덱스 안내](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index))

## 아직 연결 전인 운영 기능

회원 로그인 UI·회원 MY NAL, 공개 잔여석 API, 실제 운영 회차·가격·정원,
상품 재고·주문 생성, PG 결제·검증된 webhook·환불, Storage 파일 관리,
신청/일정/뉴스레터 이메일 발송, 관리자 CRM 화면.

현재 사이트 설정의 회원·자체 신청·결제 기능은 준비 완료로 표시하지 않는다.
Supabase 연결을 모든 운영 기능의 완성이나 ‘100% 운영 완료’로 표현하지 않는다.
