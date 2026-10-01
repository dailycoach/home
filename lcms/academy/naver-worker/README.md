# LMC Naver integration

기존 Academy/R2와 분리된 주문 연동 Worker. 운영 자동화는 기본 OFF이며 API secret 없이 mock/VM 테스트가 가능하다.

```sh
npm ci
npm test
npm run check
```

`npm run check`는 업로드하지 않는 Wrangler dry-run이다. 테스트는 기존 Apps Script 전체 파일을 VM에서 실행하며 MailApp/Sheets/NAVER만 모의 서비스로 대체한다. 100회 중복 발급 방어, 기존 로그인/R2 authorize, 취소, HTTP/JWT/HMAC, 오류/재시작을 검증한다.

* [C0](../../../docs/LMC_NAVER_C0_RECON_REPORT.md)
* [계약](../../../docs/LMC_NAVER_CONTRACT.md)
* [배포·운영](../../../docs/LMC_NAVER_RUNBOOK.md)
* [검증·산출물](../../../docs/LMC_NAVER_DELIVERY_REPORT.md)

위 docs 링크는 저장소 루트의 docs를 가리킨다. 실운영은 staging에서 API 권한/IP/mapping 검증 후 단건 canary를 통과해야 한다. Secrets는 Cloudflare Secret 및 Apps Script Script Properties에만 설정하고 파일·명령 인자·채팅·로그에 값이 남지 않도록 한다.
