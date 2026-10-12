#!/usr/bin/env python3
"""NAL positive-writing 05 v1.1: reproduce verified assets and stage free catalog."""
from pathlib import Path
import base64
import io
import json
import re
import shutil
import subprocess
import sys
import zipfile

import fitz
from PIL import Image
from pypdf import PdfReader
from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
TEMP = ROOT / ".nal-positive-writing-05-release"
SLUG = "nal-positive-writing-05-small-joys"
IDS = [
    "nal-positive-writing-14days",
    "nal-positive-writing-02-relationships",
    "nal-positive-writing-03-small-starts",
    "nal-positive-writing-04-self-care",
    SLUG,
]
payload_text = (HERE / "payload-v11.base64").read_text(encoding="ascii")
payload = base64.b64decode("".join(payload_text.split()), validate=True)
with zipfile.ZipFile(io.BytesIO(payload)) as archive:
    assert set(archive.namelist()) == {
        "build_series05_v11.py", "series05_content.json"
    }, "Unexpected source payload"
    TEMP.mkdir(exist_ok=True)
    archive.extractall(TEMP)

manuscript = json.loads((TEMP / "series05_content.json").read_text(encoding="utf-8"))
assert len(manuscript["days"]) == 14
sentences = [day["sentence"] for day in manuscript["days"]]
assert len(set(sentences)) == 14
subprocess.run([sys.executable, str(TEMP / "build_series05_v11.py")], cwd=ROOT, check=True)

prefix = "NAL_긍정문장따라쓰기_05_오늘의작은기쁨을발견하는말_v1.1_"
pdf_dir = ROOT / "nal/assets/downloads/free"
cover_dir = ROOT / "nal/assets/images/catalog/shop/retail"
pdf_dir.mkdir(parents=True, exist_ok=True)
cover_dir.mkdir(parents=True, exist_ok=True)
paths = [
    (ROOT / (prefix + "A5_컬러소책자.pdf"), pdf_dir / (SLUG + "-v11-a5.pdf")),
    (ROOT / (prefix + "A4_흑백인쇄.pdf"), pdf_dir / (SLUG + "-v11-a4-print.pdf")),
    (ROOT / (prefix + "디지털입력형.pdf"), pdf_dir / (SLUG + "-v11-fillable.pdf")),
]

def verify_pdf(path: Path, digital=False):
    assert path.exists() and path.stat().st_size > 100_000, path
    with fitz.open(path) as book:
        assert book.page_count == 40, (path, book.page_count)
        text = re.sub(r"\s+", "", "".join(page.get_text(sort=True) for page in book))
        for sentence in sentences:
            assert re.sub(r"\s+", "", sentence) in text, (path, sentence)
        assert "오늘은비워두어도좋은칸" in text, (path, "day 08 optional writing")
        assert "DAILYCOACHING" in (book.metadata.get("author") or ""), path
        if digital:
            count = sum(len(list(page.widgets() or [])) for page in book)
            assert count == 74, (path, count)
    if digital:
        reader = PdfReader(path)
        acro = reader.trailer["/Root"]["/AcroForm"].get_object()
        assert "/Ko" in str(acro.get("/DA")), "Embedded Korean entry font missing"
        appearances = [
            ref.get_object()["/AP"].raw_get("/N").idnum
            for page in reader.pages for ref in page.get("/Annots", [])
            if ref.get_object().get("/Subtype") == "/Widget"
        ]
        assert len(appearances) == len(set(appearances)) == 74, "Form appearance streams shared"
    print("VERIFIED", path.name, path.stat().st_size)

for n, (source, target) in enumerate(paths):
    verify_pdf(source, digital=(n == 2))
    shutil.copyfile(source, target)
    verify_pdf(target, digital=(n == 2))

cover_source = ROOT / (prefix + "스토어표지.png")
cover_target = cover_dir / (SLUG + "-v11-cover.png")
with Image.open(cover_source) as image:
    assert image.size == (1200, 1600)
shutil.copyfile(cover_source, cover_target)

meta = json.loads((TEMP / "NAL_05_스토어상품정보_v1.1.json").read_text(encoding="utf-8"))
product = meta["product"]
assert product["id"] == product["slug"] == SLUG
catalog_path = ROOT / "nal/data/products.json"
catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
catalog_items = catalog["products"]
assert not any(row.get("id") == SLUG for row in catalog_items), "Existing 05 product: reconcile before releasing"
for id in IDS[:-1]:
    found = [row for row in catalog_items if row.get("id") == id]
    assert len(found) == 1 and found[0]["published"] and found[0]["price"] == 0, id
assert len({row["id"] for row in catalog_items if row.get("id")}) == len([row for row in catalog_items if row.get("id")])

urls = ["/" + path.relative_to(ROOT).as_posix() for _, path in paths]
assert all(Path(ROOT / url.lstrip("/")).exists() for url in urls)
product.update({
    "published": True,
    "stockStatus": "available",
    "price": 0,
    "featured": True,
    "featuredOrder": 8,
    "purchaseUrl": urls[0],
    "sampleUrl": urls[0],
    "previewUrl": urls[0],
    "fileSizeMB": round(paths[0][1].stat().st_size / 1_000_000, 2),
    "coverImage": "/" + cover_target.relative_to(ROOT).as_posix(),
    "fulfillmentNote": "로그인·결제 없이 A5·A4·디지털 입력형 PDF를 바로 받습니다. 개인 열람·인쇄용입니다. 일부 PDF 앱의 한글 입력 표시가 다를 수 있습니다.",
    "freeDownloads": [
        {"label": "A5 컬러 소책자", "description": "읽기·태블릿 필사용 40쪽 PDF", "url": urls[0]},
        {"label": "A4 흑백 인쇄판", "description": "A4 출력·손글씨 기록용 40쪽 PDF", "url": urls[1]},
        {"label": "디지털 한글 입력형", "description": "PDF 양식 앱에서 입력하는 40쪽 PDF · 앱별 호환성 확인", "url": urls[2]},
    ],
})
schema = json.loads((ROOT / "nal/data/product.schema.json").read_text(encoding="utf-8"))
errors = list(Draft7Validator(schema).iter_errors(product))
assert not errors, [(e.message, list(e.absolute_path)) for e in errors]
last = next(i for i, row in enumerate(catalog_items) if row.get("id") == IDS[-2])
catalog_items.insert(last + 1, product)
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("STAGED", SLUG, "published=TRUE price=0 formats=3")

# Generated originals are build intermediates, never publish these paths.
for source, _ in paths:
    source.unlink(missing_ok=True)
cover_source.unlink(missing_ok=True)
for suffix in ("고객용패키지.zip", "운영자용제작패키지.zip"):
    (ROOT / (prefix + suffix)).unlink(missing_ok=True)
