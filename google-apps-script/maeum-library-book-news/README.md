# 마음서재 도서뉴스 승인 발행 동기화

`마음서재 도서뉴스 편집실`의 검수 결과를 기존 마음서재 Worker에 보내는 Apps Script 어댑터입니다. 후보 수집기는 대체하지 않으며 자동수집 결과를 공개하지 않습니다.

공개 조건은 두 가지를 모두 만족해야 합니다.

- `발행목록`의 `상태`가 `발행됨`
- 같은 `news_id`인 `뉴스편집` 행의 `최종검수`가 `승인`

`발행 예약`, `최종 검수`, `검토 대기`, `검토 필요` 행은 전송하지 않습니다. 이미지도 `이미지권리확인=확인 완료`이고 `이미지출처`가 마음서재 자체 제작인 경우만 전송합니다.

## 설치

1. `마음서재 도서뉴스 편집실`에서 확장 프로그램 → Apps Script를 엽니다.
2. `Code.gs` 내용을 붙여 넣습니다.
3. 스크립트 속성에 기존 Worker와 같은 `SHEETS_SYNC_TOKEN`을 저장합니다. 토큰을 시트 셀이나 코드에 기록하지 않습니다.
4. 필요하면 `MAEUM_BOOK_NEWS_API_URL`을 설정합니다. 기본값은 `https://maeum-api.daily-coach-ing.com/api/news/sync`입니다.
5. 먼저 `previewMaeumApprovedBookNews()`를 실행해 전송 대상을 확인합니다.
6. `installMaeumBookNewsSync()`를 한 번 실행하면 15분 트리거가 설치됩니다.

Worker는 승인된 행만 D1 `book_news_publications`에 추가·갱신하며, 후보나 예약 행은 거부합니다.

## 로컬 검증

```bash
node google-apps-script/maeum-library-book-news/test-transform.mjs
```
