# NAL SMALL BOOK RETAIL v7 · STOREFRONT PRELAUNCH

- 무료 NAL STARTER 3종은 유지한다.
- Retail v7은 별도 유료 상품군 **NAL · 날빛 작은 책**으로 등록한다.
- 개별권 4,900원.
- 3권 세트 정가 14,900원 / 런칭가 9,900원.
- 현재 stockStatus=comingSoon, purchaseUrl=null. 결제 CTA는 비활성.
- 공개 미리보기만 GitHub에 포함하며 유료 원본 PDF는 public repo에 넣지 않는다.

## 실제 판매 오픈 전 게이트
1. Retail v7 원본 PDF 3권을 nal-products-private bucket에 업로드.
2. private product file row를 각 상품 ID에 active로 등록.
3. 3권 세트 전달 방식 확정: ZIP 1건 또는 entitlement 3건.
4. Toss merchant client/secret key 설정.
5. PAYMENT_STATUS_CHANGED webhook 등록.
6. checkout/success/fail 프런트 연결 및 테스트 결제.
7. catalog stockStatus=available, checkout purchaseUrl 적용.
8. NAL_TOSS_PAYMENTS_ENABLED=true는 마지막에 활성화.
9. 결제 → entitlement → signed download E2E PASS 후 판매 오픈.


## Checkout frontend · prelaunch
- /nal/checkout/?product=<id>
- /nal/checkout/success/
- /nal/checkout/fail/
- Supabase email magic-link authentication
- Toss Payments V2 widget frontend
- server-authoritative create-order
- success redirect 뒤 server confirm
- entitlementId 기반 nal-digital-download signed link 발급
- 상품 purchaseUrl은 checkout URL로 미리 연결하지만 stockStatus=comingSoon이므로 공개 구매 CTA는 계속 비활성
- payment/delivery feature flags는 그대로 OFF

### Bundle delivery
3권 세트는 현재 private delivery가 PDF-only이므로 ZIP이 아니라 3권 합본 PDF 113쪽을 1개 상품 파일로 연결한다.
