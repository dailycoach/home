# LMC Cutover and Rollback v2

## 전환 전 조건

- 77개 카탈로그·Worker allowlist 일치
- 77개 영상 사전검사 통과
- 비공개 R2와 secret 구성
- Apps Script·Worker 실제 환경 배포
- 테스트 주문 end-to-end 통과
- 반응형·접근성·보안·Range/HEAD QA 통과
- 운영자의 명시적 병합·공개 승인

## 전환

1. 유지보수 시간 공지
2. v2 Worker 배포
3. verified 미디어만 `published` 전환
4. `access-config.js`에 Worker origin 반영
5. Academy 정적 파일 배포
6. WEEK-01 PART-01, WEEK-11 PART-07, WEEK-12 확인
7. 실제 테스트 수강생 로그인·이어보기·완료 확인
8. 오류·R2 요청량·Worker 오류율 관찰

## 롤백 조건

- 인증·결제·수강기간 차단 실패
- 다른 수강생 진도 노출
- 임의 object key 접근 가능
- signed URL·비밀값 로그 노출
- 주요 브라우저 재생 불가
- 데이터·카탈로그 수량 불일치

## 롤백

1. 신규 미디어 상태를 `disabled`로 전환해 추가 발급 차단
2. `access-config.js`의 v2 Worker origin 제거 또는 이전 승인 endpoint로 복원
3. Academy 정적 파일을 전환 전 commit으로 되돌림
4. v2 Worker route 비활성화
5. R2 객체는 삭제하지 않고 비공개 상태로 보존
6. 원인과 영향범위 확인 후 재전환 계획 수립

PR #74는 신규 PR의 기능 동등성과 v2 검증이 확인되기 전에는 닫지 않습니다. `main`에 직접 작업하거나 승인 없이 병합하지 않습니다.
