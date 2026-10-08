# NAL READ BUILD29 — 프런트 자산 버전 정렬과 배포 전용 overlay

## 구현 범위
기존 READ 페이지 안에 혼재하던 read-w0, build05, build08, build13, build16, build17, build18, build20 등의 asset query 버전을 **read29-54ef9714**로 통일합니다. 33개 READ/계정 관련 HTML과 지연 로딩되는 read-editorial-loader, read-open-loader, read-shell 등 3개 JS를 조정합니다.

33개 HTML의 script/style 태그에서 /nal/assets/js·css를 같은 자산 버전으로 조회하도록 바꾸며, 정적 HTML의 텍스트·버튼·라우팅·계정·결제 로직은 재작성하지 않습니다. Theme/nal.css는 기존 사이트 의존 자산으로서 버전 표기는 통일하지만 배포용 overlay에는 복사하지 않습니다.

## 배포 전용 산출물
scripts/package-nal-read-build29.py는 로컬의 **커밋된 Git 객체만** 읽는 오프라인 패키징 도구입니다. BUILD29 plan과 source SHA가 맞아야 실행하며 HTML 33, JS 31, CSS 14, data 1 = 총 79개 READ 전용 파일의 참조 관계와 캐시 버전이 맞지 않으면 패키징을 중단합니다. 이 검사는 정적 패키지 일관성 조건이며 고객 브라우저·Auth·결제 기능 테스트가 아닙니다.

산출물은 public-overlay/nal/...와 파일 해시 목록/이관 안내만 담는 ZIP입니다. 이전 BUILD20/21 전체 ZIP과 달리 **DB SQL·Edge 서버 코드·실제 환경 설정·비밀키는 포함하지 않습니다.** 현재 DB에는 이미 선언 SQL 19개가 설치되어 있으므로 이전 after-fix03.forward.sql을 배포용 ZIP에 재포함하거나 재실행하지 않습니다.

기존 사이트에는 선택한 READ 경로만 덮어쓰는 overlay 방식으로 적용해야 합니다. `--delete`/삭제 동기화 금지. free PDF·스토어·이미지·폰트·공통 테마·기존 backend.json은 보존합니다.

## 현재 경계
BUILD28 Edge Function 11/11 배포를 유지합니다. 이번 BUILD29는 정적 웹 소스 버전과 배포용 소스 구성에 관한 것이며, 운영 main 병합·도메인/호스팅 배포·READ 공개/유료 결제 활성화·첫 기수 생성·운영자 권한 부여·실제 로그인·모바일/결제 QA는 수행하지 않습니다.

Staging용 read-backend.staging.json은 원래 OFF 상태로 유지합니다. README/manifest의 배포 범위와 실제 배포 완료 주장은 별개입니다.
