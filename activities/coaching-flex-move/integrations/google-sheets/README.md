# COACHING FLEX MOVE · Google Sheets 비식별 수집

## 배포 대상
- 스프레드시트: COACHING FLEX MOVE 참여 변화 측정
- 기록 탭: 참여기록
- 수집 버전: 1.0

## Apps Script 배포
1. 운영용 Google Sheet에서 확장 프로그램 → Apps Script를 엽니다.
2. Code.gs 내용을 이 폴더의 Code.gs 전체 내용으로 교체합니다.
3. 배포 → 새 배포 → 유형: 웹 앱을 선택합니다.
4. 실행 계정: 나, 액세스 권한: 모든 사용자로 배포합니다.
5. 생성된 /exec URL을 복사합니다.
6. activities/coaching-flex-move/v4-2/sheets-config.js에서 endpoint에 URL을 넣고 enabled를 true로 바꿉니다.

## 전송 원칙
- 명시적 체크 동의 후에만 전송
- 이름, 연락처, 로그인 정보, 장면 속 인물·기관, 기기 식별자 미전송
- 서술형 3개 항목은 사용자가 전송 전에 확인·수정 가능
- 이메일, 전화번호, URL, 주민등록번호 형식은 브라우저와 서버에서 이중 가림
- 실패해도 앱 기록과 완주 흐름은 유지
- submissionId 중복 방지 및 수신 확인 후에만 성공 표시

## 시트 매핑
- B 시작일시
- C 종료일시
- D 모드
- E 시작 강도
- F 종료 강도
- I 감정 변화
- J 머릿속 규칙
- K 알아차림
- L 다음 선택
- Q 전송 중복 방지 키

A, G, H, M, N, O, P는 기존 ARRAYFORMULA를 그대로 사용합니다.
