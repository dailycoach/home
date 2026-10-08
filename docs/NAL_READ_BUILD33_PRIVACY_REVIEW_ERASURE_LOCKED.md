# NAL READ BUILD33 — 개인정보 검토·파기 실행 경계 (기본 잠금)

## 실제 반영

기존 `nal-platform`의 READ DB에 `20261008044411 / nal_read_build33_privacy_review_erasure_disabled`를 실제 적용했다. 마이그레이션 21,718바이트와 Git blob `069a625f000cb976dd59ce68bcf4412706537d51`이 DB 이력 및 저장소의 신규 SQL 파일과 일치한다. 새 기능은 **접수된 개인정보 요청을 검토하고, 한정된 개인 저널 파기 절차를 별도 승인 조건으로 설치하는 것**이다. **이번 실행에서 데이터를 지우지 않았다.**

첫 시즌은 기존 BUILD32 운영 준비 패킷을 계속 사용한다. 사용자·운영자·기수·상품·실제 일정·가격은 임의로 만들지 않았다. 기존 READ API 11개 및 static host PR #166을 재배포·병합하지 않았다.

## 3개 비공개 테이블

| 저장소 | 범위 |
| --- | --- |
| `read_privacy_execution_control` | 실행 허가, 승인된 고지 버전, 승인자·시각. 최초 `journal_erasure_enabled=false`; 승인 버전 NULL |
| `read_privacy_journal_reviews` | 본인 요청에 대한 기존 소유자의 검토·승인 상태, 대상 해시, 일회 승인 nonce, 검토 시각 |
| `read_privacy_journal_receipts` | 요청 ID·운영자·삭제 전후 건수·요약 증거 해시. 원문은 기록하지 않음 |

새 테이블 모두 RLS 활성화. `anon`과 `authenticated`는 직접 테이블 권한이 없다. 실행 제어 테이블은 `service_role`에도 SELECT만 허용하며 UPDATE는 허용하지 않는다. 관리 화면이나 Edge에서 스위치를 켜는 RPC는 만들지 않았다.

## 파기 계획·검토·승인 기능

`nal_private.read_privacy_journal_plan`은 다음 **8개 저장소의 건수와 내용 해시의 조합**을 계산한다. 실제 질문 답변·성찰 텍스트를 운영자에게 반환하지 않는다.

- `public.nal_read_answers` 및 `public.nal_read_day_progress`
- `nal_private.read_drafts`, `read_experiments`, `read_answer_marks`
- `nal_private.read_report_editions`, `read_preparation_checks`, `read_live_notes`

저널과 별개인 주문·고객지원·참가 등록 건수는 별도로 표시한다. 실험의 `source_snapshot`과 리포트의 `snapshot`·`request_body`는 별도 사본이라는 점을 검토 범위에 명시한다. 실제 삭제 시에는 위 개인 기록 **행 전체를 지우도록** 설치했으므로 그 행 안의 복제 문자열도 삭제 대상에 포함된다.

`public.nal_read_privacy_admin`은 기존 소유자 계정, 최신 신원 확인, `service_role` 경계를 함께 요구한다. 운영자가 확인 가능한 명령은 `queue`·`preview`·`start-review`·`approve-journal`·`execute-journal`이다. 단순 검토 중 사용자 요청은 여전히 `requested`로 남아 기존 `withdraw` 요청을 받을 수 있다. 정책 버전과 검토한 콘텐츠 지문을 확인하여 승인했을 때만 `under-review`로 전환한다.

## 실행기는 설치됐지만 OFF

실제 삭제 코드는 `nal_private.read_privacy_journal_erase`에만 있으며, 비공개 스키마의 `SECURITY DEFINER` 함수다. `PUBLIC`·`anon`·`authenticated` 실행 권한은 없고 `service_role` 호출만 허용한다. 이 권한도 **파기를 허용하는 스위치가 아니다.**

기본 스위치 false, 승인 정책 버전 NULL, 소유자 역할 0건, 개인정보 요청 0건으로 확인했다. 파기 함수는 실행 전 별도 DB 승인 설정, READ OFF, 본인 요청의 `read-journal` 범위, 검토한 운영자와 현재 소유자 권한, 정확한 정책 버전, 최근 24시간 승인 nonce, 변경 없는 개인 기록 지문을 다시 요구한다. 실행 시 8개 테이블을 유지보수 잠금으로 동결하고 본인의 저널 행만 대상으로 하며, 실제 삭제 건수와 사전 승인 건수가 다르면 트랜잭션을 취소하도록 작성했다.

**중요:** 설치 확인은 함수 메타데이터만 확인한 것이다. 실제 고객 데이터 삭제·실로그인·승인/취소 경쟁상황·동시수정·백업 파기 시나리오를 시험하지 않았다. 이 상태를 파기 절차의 법률·보안 적합성 승인으로 표시하면 안 된다.

## 완료되지 않은 권리 행사 기능

* 금융·상품 주문·환불·분쟁 문의·참가권·Auth 계정·세션·Storage·브라우저 로컬 기록·서버 로그·백업은 **이번 절차의 파기 대상이 아니다**. 법정 보존 필요성 및 서비스 종료/계정 탈퇴와 별도로 검토해야 한다.
* 결과 영수증의 회원 식별자와 승인 기록도 개인정보 처리 대상이다. 실제 보존 기간을 정하고 만료 파기를 구현해야 한다.
* 기존 회원 `nal-account`의 privacy 요청 경로는 기본 OFF인 `NAL_PRIVACY_REQUEST_ENABLED`를 사용한다. **신규 관리자 검토 경로는 Edge에 배포하지 않았다.** 앞으로 다른 기본 OFF 스위치를 갖춘 소유자 전용 경로를 작성해야 한다.
* 공개 `/nal/policy/privacy/`의 기존 초기 안내를 실제 승인된 개인정보처리방침으로 교체하지 않았다. 책 원고·자료·정원·기수·모집 일정·가격·Zoom·owner 계정을 저장하지 않았다.
* 고객에게 ‘모든 개인정보 삭제 완료’라고 안내할 수 없다. 8개 DB 저널만 대상으로 하는 파기는 별도의 좁은 범위이고, 실행 스위치 자체도 잠겨 있다.

## 적용 관찰 및 다음 단계

READ 공개는 `off`였다. 새 리뷰 및 파기 영수증은 0건이며 소유자 계정 멤버십도 0건이다. 새 함수는 3개로 조회됐고, 관리/계획 2개는 `SECURITY INVOKER`, 좁은 개인 저널 파기 1개는 비공개 `SECURITY DEFINER`다. 신규 테이블 직접 브라우저 권한은 모두 거부로 확인했다.

Supabase 보안 Advisor의 `rls_enabled_no_policy`는 프로젝트 전체 INFO **40건**이다. 서버 전용 비공개 테이블을 브라우저에 개방하지 않았으며 이 결과는 전반적 보안 점검 통과가 아니다.

다음 BUILD34는 검토 기능을 기존 인증체계의 소유자 전용 Edge 경로와 **고객에게 정확한 접수 상태를 표시하는 비공개 화면 소스**로 연결하되, 신규 Edge 경로는 기본 OFF로 유지해야 한다. 실제 민감 정보 삭제·고객 판매·Auth 변경·첫 기수 공개·호스팅 병합·유료 자원 추가·고객 판매 직전 QA는 수행하지 않는다.

관측 및 적용 기록은 `integration/nal-read/build33/result.json`과 `integration/nal-read/build33/runtime-handoff.json`을 기준으로 한다.
