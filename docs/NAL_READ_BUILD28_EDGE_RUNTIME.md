# NAL READ BUILD28 — Edge 서버 함수 11개 소스 배포

## 실제 배포

DB 19개 계층 설치 뒤, READ·계정·문의 런타임에 필요한 Edge Function 이름 11개를 기존 nal-platform에 맞췄습니다.

기존에 있던 nal-read-enroll은 v3, nal-read-daily는 v4로 올렸고, 빠져 있던 9개 함수는 v1으로 배포했습니다. 배포 후 목록에서 11개 모두 ACTIVE와 기대한 gateway JWT 설정을 확인했습니다.

이번 배포는 기능 활성화와 다릅니다. 환경변수·기능 스위치·READ 공개 모드·Auth callback·결제사 설정을 변경하지 않았고, 실제 사용자 요청도 실행하지 않았습니다.

## 인증 경계

기존 배포본의 공유 인증 모듈에는 현재 Auth 사용자와 관리자 조회를 모두 확인하고, user_metadata를 권한 판단에 쓰지 않으며, 요청마다 인증 상태를 초기화하는 하드닝이 있었습니다. 저장소 기준본보다 이 부분이 더 강화되어 있어 옛 파일로 덮지 않았습니다.

대신 그 배포본을 기준으로 현재 필요한 DB RPC allowlist만 확장해 저장소와 새 배포에 사용했습니다.

로그인 전용 함수(enroll, daily, workspace, report, editorial, support)는 gateway JWT 확인을 유지했습니다.

공개 프로그램 목록이나 결제 설정 GET이 필요한 account, cohorts, companion, payments는 gateway JWT를 끄되, POST 쓰기 요청은 각 handler가 Bearer 토큰을 요구하고 같은 공유 인증 경계를 거칩니다. payments-webhook은 외부 결제사 호출을 받기 때문에 gateway JWT를 끄고 기존 nr_ 주문 namespace와 서버 측 결제 검증 경계를 유지합니다.

이는 Supabase 문서의 함수별 verify_jwt 경계에 맞춘 구성입니다. 전역 JWT 비활성화는 하지 않았습니다.

## 아직 하지 않은 것

- NAL_READ_ENABLED, NAL_ACCOUNT_ENABLED 등 서버 기능 스위치 변경
- READ 공개 mode 변경
- 실제 로그인·질문 저장·문의 작성·결제 요청·webhook 호출
- 프런트엔드 배포
- 첫 기수/운영자/참가자/원고 공개 데이터 생성
- main 병합
- 유료 리소스 생성
- 판매 전 QA

ACTIVE는 배포 번들이 존재한다는 뜻이지 기능 테스트 통과나 판매 준비 완료라는 뜻이 아닙니다.

## 다음

프런트엔드가 사용하는 backend 연결 파일과 함수 URL 생성 방식을 확인해, 이 11개 함수 이름과 현재 한 프로젝트를 정확히 가리키도록 소스 통합을 진행합니다. 이 단계에서도 실제 기능 활성화와 고객 판매는 분리합니다.
