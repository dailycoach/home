# NAL 우선 런칭 롤백 v1

문제가 발생하면 다음 순서로 되돌린다.

1. `nal/index.html`에서 `/nal/assets/css/launch.css`와 `/nal/assets/js/launch.js` 로드를 제거한다.
2. `nal/data/launches.json`, `nal/assets/css/launch.css`, `nal/assets/js/launch.js`를 제거한다.
3. `programs/art-psychology-coaching/config.js`의 `applyUrl`을 빈 문자열로 되돌린다.
4. `programs/art-psychology-coaching/app.js`를 Google Form 전용 검증 방식으로 되돌린다.
5. NAL 홈과 미술심리코칭 페이지의 캐시를 새로 확인한다.

기존 NAL 카탈로그 데이터, 이미지, 검색, 찜, 최근 본 항목은 본 작업에서 변경하지 않았으므로 별도 롤백이 필요하지 않다.
