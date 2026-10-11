#!/usr/bin/env python3
"""NAL positive-writing 03: verify source PDFs and register public free product.
The generator produces local files; this script publishes only verified assets.
"""
from pathlib import Path
import json, re, shutil
import fitz
from PIL import Image
from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
WORK = ROOT / "scripts"
SLUG = "nal-positive-writing-03-small-starts"
V11 = "NAL_긍정문장따라쓰기_03_작은시작을믿는말_v1.1_"
DEST = ROOT / "nal/assets/downloads/free"
COVER_DEST = ROOT / "nal/assets/images/catalog/shop/retail" / (SLUG + "-v11-cover.png")
TARGETS = [
    (WORK / (V11 + "A5_컬러소책자.pdf"), DEST / (SLUG + "-v11-a5.pdf")),
    (WORK / (V11 + "A4_흑백인쇄.pdf"), DEST / (SLUG + "-v11-a4-print.pdf")),
    (WORK / (V11 + "디지털입력형.pdf"), DEST / (SLUG + "-v11-fillable.pdf")),
]
def validate_pdf(path, sentences, fillable=False):
    assert path.is_file() and path.stat().st_size > 40000, path
    with fitz.open(path) as book:
        assert book.page_count == 40, (path, book.page_count)
        normalized = re.sub(r"\s+", "", "".join(page.get_text(sort=True) for page in book))
        for sentence in sentences:
            assert re.sub(r"\s+", "", sentence) in normalized, (path, sentence)
        assert book.metadata.get("title") and "DAILYCOACHING" in (book.metadata.get("author") or ""), (path, book.metadata)
        if fillable:
            count = sum(len(list(page.widgets() or [])) for page in book)
            assert count == 74, (path, count)
            raw_font = book.xref_object(book.pdf_catalog()) if hasattr(book, "pdf_catalog") else ""
            assert count == 74
        print("PASS", path.name, "40 pages", "74 fields" if fillable else "")

source = json.loads((HERE / "series03_content.json").read_text(encoding="utf-8"))
assert len(source["days"]) == 14
sentences = [d["sentence"] for d in source["days"]]
assert len(set(sentences)) == 14
DEST.mkdir(parents=True, exist_ok=True)
COVER_DEST.parent.mkdir(parents=True, exist_ok=True)
for index, (src, dest) in enumerate(TARGETS):
    validate_pdf(src, sentences, fillable=(index == 2))
    shutil.copyfile(src, dest)
    validate_pdf(dest, sentences, fillable=(index == 2))
cover_src = WORK / (V11 + "스토어표지.png")
with Image.open(cover_src) as img:
    assert img.size == (1200, 1600), img.size
shutil.copyfile(cover_src, COVER_DEST)

proposed = json.loads((HERE / "NAL_03_스토어상품정보_v1.1.json").read_text(encoding="utf-8"))["product"]
catalog_path = ROOT / "nal/data/products.json"
catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
assert all(entry["id"] != SLUG for entry in catalog["products"]), "Product already exists; reconcile before repeat"
assert sum(item.get("id") == "nal-positive-writing-14days" and item.get("published") is True for item in catalog["products"]) == 1
assert sum(item.get("id") == "nal-positive-writing-02-relationships" and item.get("published") is True for item in catalog["products"]) == 1

urls = ["/" + str(dest.relative_to(ROOT)).replace("\\", "/") for _, dest in TARGETS]
proposed.update({
    "stockStatus": "available",
    "published": True,
    "featured": True,
    "featuredOrder": 6,
    "purchaseUrl": urls[0],
    "previewUrl": urls[0],
    "sampleUrl": urls[0],
    "coverImage": "/" + str(COVER_DEST.relative_to(ROOT)).replace("\\", "/"),
    "fileSizeMB": round(TARGETS[0][1].stat().st_size / 1_000_000, 2),
    "fulfillmentNote": "로그인·결제 없이 A5·A4·디지털 입력형 PDF를 바로 내려받을 수 있습니다. 개인 열람과 개인 인쇄용입니다.",
    "freeDownloads": [
        {"label": "A5 컬러 소책자", "description": "휴대폰·태블릿 읽기용 · 40쪽", "url": urls[0]},
        {"label": "A4 흑백 인쇄판", "description": "가정용 프린터와 손글씨 기록용 · 40쪽", "url": urls[1]},
        {"label": "디지털 한글 입력형", "description": "PDF 양식 지원 앱에서 작성 · 40쪽 (앱별 호환성 확인)", "url": urls[2]},
    ],
})
assert proposed["price"] == 0 and proposed["deliveryType"] == "digital" and proposed["pageCount"] == 40
schema = json.loads((ROOT / "nal/data/product.schema.json").read_text(encoding="utf-8"))
errors = list(Draft7Validator(schema).iter_errors(proposed))
assert not errors, [(x.message, x.absolute_path) for x in errors]
at = next(i for i, item in enumerate(catalog["products"]) if item["id"] == "nal-positive-writing-02-relationships")
catalog["products"].insert(at+1, proposed)
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("REGISTERED", SLUG, "0 KRW", "3 verified PDFs", "cover 1200×1600")

# Clean generated temporary copies without removing source or manuscript.
for src, _ in TARGETS:
    src.unlink(missing_ok=True)
cover_src.unlink(missing_ok=True)
for extra in [WORK / (V11 + "고객용패키지.zip"), WORK / (V11 + "운영자용제작패키지.zip")]:
    extra.unlink(missing_ok=True)
