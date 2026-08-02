# 흐르는 강물처럼 공식 런칭 QA v1.0

- 검수일: 2026-08-02
- 브랜치: `agent/flowing-river-official-launch-v1`
- 검수 결과: 코드·콘텐츠·반응형 통과 / 실제 Form과 비공개 운영값 확정 전 배포 보류

## 1. 요약

| 영역 | 결과 | 비고 |
|---|---|---|
| NAL 데이터·생성 페이지 | 통과 | 31개 페이지 생성, 9개 공개 프로그램 검증 |
| 흐르는 강물처럼 홈·상세 | 통과 | 유일한 NOW OPEN, 창립 멤버 10명, 월 10,000원 |
| Instagram 흐름 | 통과 | 신청완료·승인·결제·입장 안내를 DM으로 통일 |
| 이메일 제거 | 통과 | 프로그램·런칭 범위에서 제거, 공용 사이트 이메일은 유지 |
| 공개 비밀정보 검사 | 통과 | Zoom 링크·카카오톡 링크·참여코드 실값 없음 |
| 반응형 | 통과 | 360, 390, 412, 768, 1280, 1440px |
| 접근성 | 통과 | 10개 axe 스캔, 위반 0건 |
| Google Sheets | 통과 | 네이티브 Sheet 4개 탭, 상태 드롭다운 칩, 조건부 표시 |
| Apps Script 정적검사 | 통과 | 구문, 필수 함수, 이메일 수집 차단 로직 확인 |
| 실제 Google Form | 대기 | 소스 준비 완료, 운영자 계정에서 Apps Script 실행 필요 |
| Form 제출·트리거 종단간 | 대기 | 실제 Form 생성 후 테스트 필요 |
| 배포 | 보류 | Form URL·카카오톡 정보·결제계좌 확정 필요 |

## 2. 실행한 기술검수

```text
node scripts/generate-nal-pages.mjs
node scripts/generate-nal-sitemap.mjs
node scripts/check-nal-platform.mjs
node --check nal/assets/js/app.js
node --check < integrations/google-apps-script/flowing-river-community/Code.gs
git diff --check
```

결과:

```text
Generated 31 NAL pages from published data.
Generated sitemap with 52 URLs.
NAL QA passed: flowing-river-form=pending, pages=31, programs=10 (9 public), products=8 (4 public), hosts=2 (2 public), content=1 (1 public)
```

정적 명령은 모두 종료 코드 0으로 통과했다.

## 3. 브라우저·반응형 QA

`scripts/nal-browser-qa.mjs`를 Chromium과 axe-core로 실행했다.

- 공개 경로: 31개
- 화면폭별 레이아웃 기록: 108개
- 확인 화면폭: 360, 390, 412, 768, 1280, 1440px
- 상호작용 흐름: 5개
- JavaScript 비활성화 확인: 7개
- 접근성 스캔: 10개
- 최종 실패: 0건

첫 실행에서 모바일 홈의 가로 스크롤 핵심정보 목록에 키보드 포커스가 없고, 상세 페이지의 참가비가 `10,000원 / 월` 순서로 표시되는 문제를 발견했다. 목록에 키보드 포커스를 제공하고 모든 상세 표기를 `월 10,000원`으로 통일한 뒤 전체 검수를 재실행해 통과했다.

## 4. 사이트 확인

- [x] 상태가 `모집 중`으로 표시됨
- [x] 창립 멤버 10명이 표시됨
- [x] 월 10,000원이 표시됨
- [x] 매월 10일 오후 8:00~9:30가 표시됨
- [x] 주 1회 카카오톡 미션이 표시됨
- [x] COACHING FLEX MOVE 링크가 새 탭으로 연결됨
- [x] Instagram 문의가 `@daily_coach_ing`으로 연결됨
- [x] 기존 연령 범위 표현이 프로그램·런칭 범위에서 제거됨
- [x] 이메일 신청·승인·결제·입장 안내가 제거됨
- [x] Zoom 실제 링크가 공개되지 않음
- [x] 카카오톡 링크와 참여코드가 공개되지 않음
- [x] Google Form 실주소가 없을 때 신청 버튼이 비활성 상태로 표시됨
- [ ] 실제 Google Form URL 연결 후 CTA 클릭 테스트

## 5. Google Form 코드 확인

- [x] 제목과 소개문 설정
- [x] 4개 섹션, 17개 신청 문항 구성
- [x] 이메일 자동 수집 비활성화
- [x] 1인 1응답 로그인 제한 비활성화
- [x] 이메일·전화번호·파일 업로드 문항 없음
- [x] Instagram ID 필수
- [x] Instagram DM 사용이 어려운 선택지에 사전 안내 페이지 표시
- [x] 운영규칙, FLEX MOVE, 참가비 체크박스 전 항목 선택 검증
- [x] 개인정보 동의 거부 시 제출 대신 처음으로 이동
- [x] 제출 완료 메시지에 신청완료 DM 형식 표시
- [x] 카카오톡 링크·참여코드를 완료 메시지에 넣지 않음
- [ ] 실제 생성된 Form의 로그인 없는 제출 확인
- [ ] 실제 제출 응답의 정규화·동기화 확인

Google Forms의 관리 화면 일부 설정은 Apps Script API만으로 완전한 교차 확인이 어려우므로, 공개 전 시크릿 창 제출 테스트를 필수로 둔다.

## 6. Google Sheets 확인

파일: [NAL_흐르는강물처럼_창립멤버_운영관리](https://docs.google.com/spreadsheets/d/1rXKPPE_RSK2jqy3z86jSfkdiw7mkB1fdB6kzmvq-AaA/edit)

- [x] 네이티브 Google Sheets로 변환
- [x] `신청응답`, `운영관리`, `설정`, `DM문구` 4개 탭
- [x] 한국어 로케일과 `Asia/Seoul` 시간대
- [x] `FlowingRiverOperations` 네이티브 테이블
- [x] 운영관리 A:P 16개 열
- [x] 신청·DM·결제·입장·단톡방·Zoom 상태를 네이티브 드롭다운 칩으로 설정
- [x] 결제 확인, 대기와 입장 완료 조건부 표시
- [x] 운영관리 첫 행과 첫 두 열 고정
- [x] Instagram 프로필 HYPERLINK 수식
- [x] 7종 Instagram DM 문구
- [x] 비공개 카카오톡·계좌 값은 빈 셀로 유지
- [x] 수식 오류 0건
- [ ] 실제 Form 응답 연결
- [ ] 실제 제출 이벤트 트리거
- [ ] 입금 확인 10명 경고·신규 대기 전환 종단간 테스트

## 7. 개인정보·보안 확인

- 수집 항목을 이름, Instagram 사용자 이름, 카카오톡 이름, 입금자명과 신청 내용으로 제한했다.
- 이용 목적, 보유 기간, 동의 거부 권리와 거부 시 불이익을 안내하는 초안을 포함했다.
- Instagram 비밀번호, 인증정보, 자동 로그인과 자동 DM 기능은 포함하지 않았다.
- 카카오톡 링크·참여코드·계좌는 `설정` 시트의 비공개 운영값으로만 입력한다.
- 공개 전 운영자의 실제 보유정책과 법률 검토에 맞춰 보유 기간을 확정해야 한다.

## 8. 배포 차단 항목

다음 항목이 완료되기 전에는 `main` 병합과 운영 배포를 하지 않는다.

- [ ] Apps Script 실행으로 실제 Google Form 생성
- [ ] Form 공개 URL을 NAL 프로그램 데이터와 NOW OPEN CTA에 연결
- [ ] 로그인 없이 실제 제출 가능 확인
- [ ] 이메일 자동 수집과 응답 사본 발송 비활성 상태 확인
- [ ] 개인정보 보유 기간 최종 승인
- [ ] 카카오톡방 링크와 참여코드 입력
- [ ] 월 참가비 결제계좌 입력
- [ ] 입금기한과 입장기한 입력
- [ ] Form → 운영관리 → 승인 DM → 결제 → 입장 DM 종단간 테스트
- [ ] 운영자 최종 승인

## 9. GitHub

- 브랜치: `agent/flowing-river-official-launch-v1`
- 커밋: 생성 예정
- Draft PR: 생성 예정
- `main` 병합: 하지 않음
