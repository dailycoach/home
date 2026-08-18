# LMC ORDER BRIDGE v1.0

스마트스토어 결제 이후 사람의 주문 확인 없이 LMC Academy 초대장을 발송하고, Google Form 제출 뒤 기존 Apps Script 수강권 발급 흐름을 자동으로 이어주는 Cloudflare Worker입니다.

## 운영 흐름

1. Cron Trigger가 네이버 Commerce API의 `PAYED` 변경 주문을 2분 간격으로 조회합니다.
2. `productId=13702661269`이고 현재 상태가 `PAYED`, 활성 클레임이 없는 주문만 통과시킵니다.
3. 주문 상세의 `ordererTel`로 NAVER Cloud SENS LMS 초대장을 1회 발송합니다.
4. 초대장에는 상품주문번호와 기존 Google Form 링크가 포함됩니다.
5. Worker는 초대장을 보낸 PAYED 주문을 보류 목록으로 유지합니다.
6. Google Form이 제출되어 운영DB에 동일 상품주문번호 행이 생기면, 다음 Cron에서 기존 Apps Script `confirmPayment` 훅을 호출합니다.
7. 기존 `confirmPaymentByOrder_()`가 `확인완료` 처리, 8자리 코드, 180일 수강권, 이메일 발송을 수행합니다.
8. `/verify-order`는 운영 점검과 향후 Form 즉시검증 강화에 사용할 수 있습니다.

## 외부 공식 API

- NAVER Commerce OAuth2: `POST /external/v1/oauth2/token`
- 변경 주문: `GET /external/v1/pay-order/seller/product-orders/last-changed-statuses`
- 주문 상세: `POST /external/v1/pay-order/seller/product-orders/query`
- NAVER Cloud SENS: `POST /sms/v2/services/{serviceId}/messages`

## Cloudflare 리소스

### KV

먼저 KV namespace를 생성하고 `wrangler.jsonc`의 32자리 0 placeholder를 실제 ID로 교체합니다.

```bash
npx wrangler kv namespace create ORDER_STATE
```

KV에는 다음 최소 상태만 저장합니다.

- Commerce OAuth token 캐시
- 마지막 주문 조회 커서
- 상품주문번호별 초대장 발송 여부 및 SENS requestId
- 수강권 자동발급 재시도 상태

구매자 이름이나 전체 휴대전화 번호는 KV에 저장하지 않습니다.

### Secrets

```bash
npx wrangler secret put NAVER_CLIENT_ID
npx wrangler secret put NAVER_CLIENT_SECRET
npx wrangler secret put SENS_SERVICE_ID
npx wrangler secret put SENS_ACCESS_KEY
npx wrangler secret put SENS_SECRET_KEY
npx wrangler secret put SENS_FROM
npx wrangler secret put BRIDGE_SHARED_SECRET
npx wrangler secret put APPS_SCRIPT_URL
npx wrangler secret put APPS_SCRIPT_SYNC_SECRET
```

`NAVER_TOKEN_TYPE=SELF`가 기본입니다. 판매자 대행형 앱에서 `SELLER` 토큰을 사용한다면 `NAVER_SELLER_ACCOUNT_ID`도 secret으로 추가하고 vars의 `NAVER_TOKEN_TYPE`을 변경합니다.

`SENS_FROM`은 SENS 콘솔에 사전 등록된 발신번호만 사용할 수 있습니다.

## Google Form → 기존 Apps Script 자동확인 연결

기존 Apps Script 수정은 필요하지 않습니다. 이미 배포된 웹앱의 `confirmPayment` 훅을 그대로 사용합니다.

- `APPS_SCRIPT_URL`: 기존 LMC Apps Script 웹앱 배포 URL
- `APPS_SCRIPT_SYNC_SECRET`: 기존 Apps Script Script Properties의 `SYNC_SECRET`과 동일한 값

Worker가 PAYED 주문의 초대장 발송 상태를 KV에 보관하고 2분마다 `confirmPayment`를 재시도합니다. Form 제출 전에는 일치하는 수강생 행이 없어 보류되고, 제출 후 다음 Cron에서 자동으로 `확인완료 → 입장코드 → 이메일`이 실행됩니다. 기본 재시도 창은 14일이며 `INVITE_PROVISION_WINDOW_DAYS`로 조정합니다. `/verify-order`는 서버 간 즉시검증용 보조 엔드포인트로 유지합니다.

## 선택: 상품주문번호 미리 채우기

Google Form에서 상품주문번호 문항의 pre-filled URL을 만든 뒤 해당 entry 값 부분을 `{productOrderId}`로 바꿔 `FORM_PREFILL_URL_TEMPLATE`에 설정하면 초대장 링크에서 주문번호가 자동 입력됩니다. 미설정 시 기존 Form URL을 그대로 사용합니다.

## 검증

```bash
npm install
npm test
npx wrangler deploy --dry-run
```

배포 후:

```bash
curl https://<worker>/health
curl -X POST https://<worker>/admin/poll -H "Authorization: Bearer <BRIDGE_SHARED_SECRET>"
```

실제 비용이 발생하는 LMS 전송은 테스트 주문/수신번호를 확인한 뒤 실행합니다.
