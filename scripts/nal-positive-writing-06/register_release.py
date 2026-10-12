#!/usr/bin/env python3
"""Publish verified NAL positive-writing volume 06 v1.1 as a free digital workbook."""
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
TEMP = ROOT / ".nal-positive-writing-06-release"
SLUG = "nal-positive-writing-06-changing-days"
IDS = [
    "nal-positive-writing-14days",
    "nal-positive-writing-02-relationships",
    "nal-positive-writing-03-small-starts",
    "nal-positive-writing-04-self-care",
    "nal-positive-writing-05-small-joys",
    SLUG,
]

encoded = "".join((HERE / "payload-v11.base64").read_text(encoding="ascii").split())
payload = base64.b64decode(encoded, validate=True)
with zipfile.ZipFile(io.BytesIO(payload)) as archive:
    allowed = {
        "build_series06_v11.py", "series06_content.json",
        "NAL_06_스토어상품정보_v1.1.json"
    }
    assert set(archive.namelist()) == allowed, "Unrecognized release payload"
    TEMP.mkdir(exist_ok=True)
    archive.extractall(TEMP)

manuscript = json.loads((TEMP / "series06_content.json").read_text(encoding="utf-8"))
assert manuscript["volume"] == 6 and len(manuscript["days"]) == 14
sentences = [day["sentence"] for day in manuscript["days"]]
assert len(set(sentences)) == 14

subprocess.run([sys.executable, str(TEMP / "build_series06_v11.py")], cwd=ROOT, check=True)

prefix = "NAL_긍정문장따라쓰기_06_낯선내일에도나를믿는말_v1.1_"
pdf_dir = ROOT / "nal/assets/downloads/free"
cover_dir = ROOT / "nal/assets/images/catalog/shop/retail"
pdf_dir.mkdir(parents=True, exist_ok=True)
cover_dir.mkdir(parents=True, exist_ok=True)
variants = [
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
        assert "DAILYCOACHING" in (book.metadata.get("author") or ""), path
        if digital:
            fields = sum(len(list(page.widgets() or [])) for page in book)
            assert fields == 74, (path, fields)
    if digital:
        reader = PdfReader(path)
        acro = reader.trailer["/Root"]["/AcroForm"].get_object()
        assert "/Ko" in str(acro.get("/DA")), "Korean entry font missing"
        appearances = [
            widget.get_object()["/AP"].raw_get("/N").idnum
            for page in reader.pages
            for widget in page.get("/Annots", [])
            if widget.get_object().get("/Subtype") == "/Widget"
        ]
        assert len(appearances) == len(set(appearances)) == 74, "Shared PDF form appearance detected"
    print("VERIFIED", path.name, path.stat().st_size)

for i, (original, destination) in enumerate(variants):
    verify_pdf(original, digital=i == 2)
    shutil.copyfile(original, destination)
    verify_pdf(destination, digital=i == 2)

cover_source = ROOT / (prefix + "스토어표지.png")
cover_target = cover_dir / (SLUG + "-v11-cover.png")
with Image.open(cover_source) as cover:
    assert cover.size == (1200, 1600), cover.size
shutil.copyfile(cover_source, cover_target)

catalog_path = ROOT / "nal/data/products.json"
catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
items = catalog["products"]
assert all(p.get("id") != SLUG for p in items), "Volume 06 already registered; reconcile instead of duplicating"
assert len(set(p["id"] for p in items if p.get("id"))) == len([p for p in items if p.get("id")])
for ident in IDS[:-1]:
    found = [p for p in items if p.get("id") == ident]
    assert len(found) == 1 and found[0]["published"] and found[0]["price"] == 0, ident

meta = json.loads((TEMP / "NAL_06_스토어상품정보_v1.1.json").read_text(encoding="utf-8"))
product = meta["product"]
assert product["id"] == product["slug"] == SLUG
urls = ["/" + destination.relative_to(ROOT).as_posix() for _, destination in variants]
product.update({
    "published": True, "price": 0, "stockStatus": "available",
    "featured": True, "featuredOrder": 9,
    "version": "1.1-free",
    "purchaseUrl": urls[0], "sampleUrl": urls[0], "previewUrl": urls[0],
    "fileSizeMB": round(variants[0][1].stat().st_size / 1_000_000, 2),
    "coverImage": "/" + cover_target.relative_to(ROOT).as_posix(),
    "fulfillmentNote": "회원가입·결제 없이 A5·A4·디지털 입력형 PDF를 바로 받습니다. 개인 열람·인쇄용입니다. 일부 PDF 앱의 한글 입력 표시가 다를 수 있습니다.",
    "freeDownloads": [
        {"label": "A5 컬러 소책자", "description": "읽기·태블릿 필사용 40쪽 PDF", "url": urls[0]},
        {"label": "A4 흑백 인쇄판", "description": "A4 출력·손글씨 기록용 40쪽 PDF", "url": urls[1]},
        {"label": "디지털 한글 입력형", "description": "PDF 양식 앱에서 입력하는 40쪽 PDF · 앱별 호환성 확인", "url": urls[2]},
    ],
})
schema = json.loads((ROOT / "nal/data/product.schema.json").read_text(encoding="utf-8"))
errors = list(Draft7Validator(schema).iter_errors(product))
assert not errors, [(e.message, list(e.absolute_path)) for e in errors]
previous = next(i for i, row in enumerate(items) if row.get("id") == IDS[-2])
items.insert(previous + 1, product)
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("STAGED", SLUG, "free=TRUE downloadable_forms=3")

# Never add intermediate working files or the internally generated customer bundle to Git.
for original, _ in variants:
    original.unlink(missing_ok=True)
cover_source.unlink(missing_ok=True)
for suffix in ("고객용패키지.zip", "운영자용제작패키지.zip"):
    (ROOT / (prefix + suffix)).unlink(missing_ok=True)
