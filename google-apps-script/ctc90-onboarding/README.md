# DAILYCOACHING CTC90 온보딩 Form 설치

Google Drive 연결은 현재 Google Forms 파일을 직접 생성하지 못하므로, 운영원장에 바인딩된 Apps Script에서 설치 함수를 한 번 실행한다.

## 대상 운영원장

- [DAILYCOACHING CTC90 운영원장](https://docs.google.com/spreadsheets/d/162wOpWzWOik5pSz6qWS_0Yo2zh3yrrNx3sZ6A91cGVQ/edit)

## 설치 순서

1. 운영원장을 연다.
2. `확장 프로그램 → Apps Script`를 선택한다.
3. 기본 `Code.gs` 내용을 이 폴더의 `Code.gs`로 교체한다.
4. 프로젝트 설정에서 `appsscript.json` 표시를 켠 뒤 이 폴더의 manifest와 맞춘다.
5. 함수 목록에서 `installCtc90Form`을 선택하고 실행한다.
6. 최초 1회 Google Forms·Sheets 권한을 승인한다.

실행이 끝나면 다음이 자동 처리된다.

- `DAILYCOACHING 코치더코치 90 | 참여코치 사전 온보딩` Form 생성
- KAC/KPC 섹션 분기
- 최대 3개 선택 검증
- 파일적격·고객동의 필수 체크
- 운영원장에 응답 연결
- `Form 설계!H1:I4`에 응답자 URL·편집 URL·Form ID 기록
- `출시 게이트` G2 상태를 `검토중`으로 변경

같은 문서 속성에 Form ID가 남아 있으면 재실행해도 새 Form을 중복 생성하지 않는다.

## 실행 후 필수 검수

- KAC 선택 시 KAC 문항만 표시되는가
- KPC 선택 시 KPC 문항만 표시되는가
- 최대 3개 선택 제한이 작동하는가
- 고객동의 6개 항목과 최종 확인이 필수인가
- 완료화면에 카카오 1:1톡 링크가 표시되는가
- 응답 탭이 운영원장에 생성되는가

검수 전에는 `출시 게이트` G2를 `통과`로 바꾸지 않는다.
