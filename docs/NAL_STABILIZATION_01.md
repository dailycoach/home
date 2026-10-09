# NAL-STABILIZATION-01 — 운영 계약 정상화

기준: `dailycoach/home` main `1ccaa503aa7823ab1711ed70f1880bc83084b671`.  
범위: 검증 계약과 CI만 보완. **운영 페이지·상품·PDF·DB·결제·Supabase·main/Pages 배포는 변경하지 않는다.**

## 원인

NAL READ W0 전체 검사에는 기존 페이지/상품을 기준으로 작성된 `scripts/check-nal-platform.mjs`가 사용되었다. 2026-10-07 측정 시 **baseline FAIL 107 / HEAD FAIL 107 / 신규 회귀 0**으로, 회귀 없음과 플랫폼 검증 통과를 구분해야 한다. 이후 무료 스타터 최종본 및 게시상태 갱신이 main에 병합되었다. 과거 107건 수치는 현행 main의 재검사 결과가 아니다.

문제군:
- 구형 카탈로그 계약: 공개 상품을 정확히 4개, catalog 이미지를 정확히 28개/WebP만으로 고정.
- 미게시 상품 계약: 리다이렉트용 예전 무료판과 비공개 3종 세트의 가격 기록까지 `null`이어야 한다고 요구.
- 미게시 옛 주소를 실운영 공개 상품 페이지로 착각.
- noindex checkout/HTML 미리보기/리다이렉트를 공개 콘텐츠용 메타데이터·디자인 시스템과 동일하게 검사.
- noindex 리다이렉트의 `canonical`이 **다른 실제 공개 주소**를 지칭하는 것을 sitemap 위반으로 오판.

## 바뀐 검사 기준

1. 공개 핵심 상품을 명시적으로 보장: 물리 카드 4종, 로그인 없이 무료 이용 가능한 스타터 PDF 3종, 결제 전 단계의 AWARENESS 3종. 신규 정규 상품이 생겨도 개수 고정으로 검사 자체가 실패하지 않는다.
2. 비공개 유료 상품은 `available`로 팔 수 없도록 검사하면서, 과거 무료판의 0원 기록과 미래 출시상품의 가격 메타데이터를 보존한다.
3. 기존 WebP 자산 계약은 유지하고 `shop/retail/` 폴더의 실제 출판 표지 PNG와 SVG만 추가로 허용한다. PNG 파일 시그니처·크기와 SVG 위험한 inline 코드도 검사한다.
4. `published:false`인데 HTML이 존재하면 `noindex`와 내부 리다이렉트(목적지 존재)를 강제한다. 일반 공개 페이지에는 SEO/접근성·canonical·JSON-LD 검증을 유지한다.
5. noindex 화면은 공개 검색 색인 계약과 분리하되, 페이지 제목과 `main` 영역을 보장한다. sitemap에서는 **실제 noindex 경로 자체가 없는지** 검사한다.

## 정상화 게이트

- [ ] 수정 브랜치에서 `node --check scripts/check-nal-platform.mjs` PASS
- [ ] 수정 브랜치에서 `node scripts/check-nal-platform.mjs` PASS
- [ ] 테마 검사 PASS
- [ ] 상품 누락·가격 변조·noindex 노출 시 검사가 FAIL하는지 반례 확인
- [ ] 본문 SEO와 보조 noindex 화면의 규칙 분리를 검토
- [ ] PR #160(READ 개발)·#166(호스팅 후보)의 CI 기준을 최신 main과 일치시켜 재검사
- [ ] 실제 상품 PDF, 가격, 공개 플래그, 판매 준비 스위치는 변경 없음 확인
- [ ] **고객 판매 직전** 브라우저/실로그인/결제 테스트, 서비스 공개 승인

**출시 원칙:** NAL READ `off`, Toss/유료 결제 `off`, 운영 DB/Storage/Edge 변화 없음. 이 브랜치는 고객에게 새 기능을 공개하지 않는다. 다른 Draft PR과 자동 병합하지 않는다.
