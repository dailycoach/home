# NAL STARTER FREE v7 · DIRECT DOWNLOAD

## Product decision

The three upgraded NAL starter books are **free editions**.

- No payment.
- No checkout.
- No login.
- Direct PDF download from the public NAL site.
- Personal reading and personal printing are allowed.
- Resale, re-upload, paid redistribution, and bulk copying for classes/organizations are not included.

## Canonical free products

| Product | Pages | Price | Delivery |
| --- | ---: | ---: | --- |
| `nal-small-book-01-mind-reset` | 37 | 0 KRW | direct PDF |
| `nal-small-book-02-relationship` | 39 | 0 KRW | direct PDF |
| `nal-small-book-03-next-step` | 37 | 0 KRW | direct PDF |

The previous short `nal-starter-*` pages redirect to the upgraded books so existing links continue to work.

The previously planned paid 3-book set is unpublished.

## Runtime contract

Each product uses:

- `price=0`
- `stockStatus=available`
- root-relative public `purchaseUrl`
- `deliveryMethod=digital-download`
- `licenseType=personal-use`

`NALStore.purchase()` therefore resolves to **무료 다운로드** and the detail runtime adds the browser `download` attribute. Toss Payments is not part of this three-book flow.

## Payment foundation

The existing Toss/private-delivery foundation remains available for future paid NAL products. It is not used by these three free editions and does not need to be enabled for their release.

## Generated PDFs

The free PDFs are generated from source page text by:

`scripts/generate-nal-free-starter-v7.py`

The workflow commits the generated PDFs to:

- `/nal/assets/downloads/free/nal-small-book-01-mind-reset-v7.pdf`
- `/nal/assets/downloads/free/nal-small-book-02-relationship-v7.pdf`
- `/nal/assets/downloads/free/nal-small-book-03-next-step-v7.pdf`
