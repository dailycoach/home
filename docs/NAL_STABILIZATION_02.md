# NAL-STABILIZATION-02 · 운영 카탈로그 정합성

기준: 2026-10-10 KST, 운영 `main` `1ccaa503`, P1 검사 커밋 `e66634ff`.  
프로젝트: Supabase `nal-platform`. DB 읽기 전용 점검 수행.

## 수량 차이의 원인

| 항목 | GitHub `nal/data/products.json` | Supabase `nal_catalog` |
| --- | ---: | ---: |
| 전체 상품 | 15 | 18 |
| 공개 상태 | 10 | 10 |
| 미공개 상태 | 5 | 8 |

운영 DB에만 남아 있는 3건:
- `nal-starter-01-mind-reset`
- `nal-starter-02-relationship-dialogue`
- `nal-starter-03-next-step`

세 항목 모두 `published=false`, 이전 무료 PDF(0원) 메타데이터. 기존 링크 이력·운영 기록을 보존하기 위해 **삭제하거나 다시 게시하지 않는다**. `nal_public_catalog()` 응답에는 존재하지 않아야 한다.

## 실제 공개 상품 비교

10종의 22개 주요 표시/판매 메타데이터(가격, 재고 상태, 표지, 미리보기, 파일 버전/페이지 수, PDF 다운로드, 환불 안내 포함)를 대조한 결과:
- 무료 PDF 3종: DB/GitHub 일치, 0원, `available`, 동일 PDF 다운로드·미리보기 주소.
- AWARENESS 3종: DB/GitHub 일치, 100/1,000/10,000원, `comingSoon`, 구매 링크 NULL.
- 실물 카드 4종: DB의 기존 유형 `card`와 GitHub의 `physicalCard`만 다름. `NALStore.type()`에서 `card → physicalCard`로 정규화해 필터를 제공하므로 현재 확인된 범위에서는 의도된 레거시 호환. **DB를 일괄 UPDATE하지 않는다**.

상품별 `id/slug/published`는 DB 행의 별도 열에 저장되어 있고, `body`만으로 판단하면 누락으로 오해할 수 있다. 비교기는 API 최종 계약을 기준으로 검증한다.

## 비공개 자산과 출시 경계

- `nal_private.product_files`: AWARENESS 3건의 active 매핑 존재. 이것만으로 공개 판매 가능하다는 의미는 아님.
- 운영 사이트 결제 기능: `storePurchase=false`, `checkout=false`, `secureDownload=false`.
- READ 공개: `off`.
- 주문·결제·디지털 구매권한: 확인 시 각 0건.
- **운영 DB/Storage/Edge/가격/원고/고객 데이터/공개 플래그 수정 없음**.

## 이번 변경: 영구적인 자동 계약 검증

1. `scripts/nal-catalog-contract.mjs`: 공개 상품/프로그램/진행자/콘텐츠 목록 및 속성, 공개 사이트 정책, private 파일 정보 누출 여부 확인.
2. `scripts/test-nal-catalog-contract.mjs`: 무료 PDF 가격·미리보기 변경, 유료 조기 판매, 옛 상품 재노출, 카드 유형 오기, 상품 누락, 비공개 파일 데이터 누출 등 10종 차단 사례.
3. `scripts/check-nal-catalog-consistency.mjs`: 공개 publishable key로 **읽기 전용** `nal_public_catalog` 호출 후 저장소와 비교. 계정·service role·DB 쓰기 사용 금지.
4. 기존 NAL Platform Contract CI에 검사 연결. PR에서 자동으로 실행, **운영 배포 없음**.

## 후속 게이트

- [ ] P2 전체 CI에서 오프라인 반례 및 운영 공개 RPC 대조 PASS
- [ ] 기존 P1 PR #167과 통합 순서 확정
- [ ] READ 개발 #160 / 호스팅 #166의 신규 코드와 다시 병합·충돌 검사
- [ ] 개인정보 owner 인증 경계 승인 및 실제 서버 권한 검증
- [ ] 유료 결제·다운로드 서비스 실사용 QA는 판매 직전 수행

운영 사이트는 여전히 무료 3종 중심으로 유지. 사용자 판매 동의 없이 기능 공개하지 않음.
