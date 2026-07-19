# 마음서재 운영실 관문

`/operator/`는 DAILYCOACHING 홈페이지에서 마음서재 운영자 콘솔로 이동하는 전용 관문입니다.

- 실제 인증·권한 검사는 `https://maeum-library-talk.dailycoaching.chatgpt.site/admin`에서 수행합니다.
- 이 관문에는 운영 데이터나 개인정보를 저장하지 않습니다.
- PWA 설치를 위해 `manifest.webmanifest`, `sw.js`, `icon.svg`를 함께 사용합니다.
- 메인 홈페이지에는 푸터의 작은 `운영자` 링크로만 노출합니다.

## 2차 패치 범위

웹서재 원본 프로젝트에서 `/operator` 로그인 화면, 역할별 권한, 토스 연결 현황 카드와 오늘의 운영 대시보드를 구현합니다.
