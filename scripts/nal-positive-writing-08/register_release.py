#!/usr/bin/env python3
"""NAL positive-writing volume 08 v1.1: release signed-off 40-page free PDFs only.

No checkout, paid products, entitlement, or production secrets are changed.
All source assets are reconstructed from a verified in-repository package.
"""
from pathlib import Path
import base64, hashlib, io, json, re, shutil, subprocess, sys, zipfile

import fitz
from PIL import Image
from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SRC = HERE / "source"
SLUG = "nal-positive-writing-08-my-own-pace"
PREFIX = "NAL_긍정문장따라쓰기_08_비교하는마음을지나나의기준을찾는말_v1.1_"
PRIOR = [
    "nal-positive-writing-14days",
    "nal-positive-writing-02-relationships",
    "nal-positive-writing-03-small-starts",
    "nal-positive-writing-04-self-care",
    "nal-positive-writing-05-small-joys",
    "nal-positive-writing-06-changing-days",
    "nal-positive-writing-07-self-respect",
]

encoded = (HERE / "payload-v11.base64").read_text(encoding="ascii").strip()
payload = base64.b64decode(encoded, validate=True)
assert hashlib.sha256(payload).hexdigest() == "3d0b766c251891cd6ab9c995ecff2a46d33e20c59b92ac4ef9dfc8c0275e6cdc", "unapproved manuscript payload"
SRC.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(io.BytesIO(payload)) as archive:
    wanted = {"build_series08_v11.py", "series08_content_v11.json", "NAL_08_스토어상품정보_v1.1.json"}
    assert set(archive.namelist()) == wanted, archive.namelist()
    archive.extractall(SRC)

manuscript = json.loads((SRC / "series08_content_v11.json").read_text(encoding="utf-8"))
assert manuscript["volume"] == 8 and len(manuscript["days"]) == 14
sentences = [entry["sentence"] for entry in manuscript["days"]]
assert len(set(sentences)) == 14

subprocess.run([sys.executable, str(SRC / "build_series08_v11.py")], cwd=ROOT, check=True)

downloads = ROOT / "nal/assets/downloads/free"
covers = ROOT / "nal/assets/images/catalog/shop/retail"
downloads.mkdir(parents=True, exist_ok=True)
covers.mkdir(parents=True, exist_ok=True)
variants = [
    (HERE / (PREFIX + "A5_컬러소책자.pdf"), downloads / (SLUG + "-v11-a5.pdf")),
    (HERE / (PREFIX + "A4_흑백인쇄.pdf"), downloads / (SLUG + "-v11-a4-print.pdf")),
    (HERE / (PREFIX + "디지털입력형.pdf"), downloads / (SLUG + "-v11-fillable.pdf")),
]
for idx, (source, destination) in enumerate(variants):
    assert source.is_file() and source.stat().st_size > 100_000, source
    with fitz.open(source) as pdf:
        assert pdf.page_count == 40, (source, pdf.page_count)
        alltext = re.sub(r"\s+", "", "".join(page.get_text(sort=True) for page in pdf))
        for sentence in sentences:
            assert re.sub(r"\s+", "", sentence) in alltext, (source, sentence)
        assert "DAILYCOACHING" in (pdf.metadata.get("author") or ""), source
        if idx == 2:
            widgets = [w for page in pdf for w in (list(page.widgets() or []))]
            assert len(widgets) == 74 and len({w.field_name for w in widgets}) == 74
    shutil.copyfile(source, destination)
    assert destination.stat().st_size == source.stat().st_size
    print("VERIFIED", destination.relative_to(ROOT), destination.stat().st_size)

cover_src = HERE / (PREFIX + "스토어표지.png")
cover_dst = covers / (SLUG + "-v11-cover.png")
with Image.open(cover_src) as img:
    assert img.size == (1200, 1600)
shutil.copyfile(cover_src, cover_dst)

catalog_file = ROOT / "nal/data/products.json"
catalog = json.loads(catalog_file.read_text(encoding="utf-8"))
products = catalog["products"]
for ident in PRIOR:
    found = [x for x in products if x.get("id") == ident]
    assert len(found) == 1 and found[0]["published"] and found[0]["price"] == 0
    assert found[0]["stockStatus"] == "available" and len(found[0].get("freeDownloads", [])) == 3
ids = [p.get("id") for p in products if p.get("id")]
assert len(ids) == len(set(ids))

product = json.loads((SRC / "NAL_08_스토어상품정보_v1.1.json").read_text(encoding="utf-8"))["product"]
assert product["id"] == product["slug"] == SLUG
urls = ["/" + str(dest.relative_to(ROOT)).replace("\\", "/") for _, dest in variants]
product.update({
    "published": True,
    "price": 0,
    "stockStatus": "available",
    "featured": True,
    "featuredOrder": 11,
    "purchaseUrl": urls[0],
    "sampleUrl": urls[0],
    "previewUrl": urls[0],
    "fileSizeMB": round(variants[0][1].stat().st_size / 1_000_000, 2),
    "coverImage": "/" + str(cover_dst.relative_to(ROOT)).replace("\\", "/"),
    "fulfillmentNote": "결제·로그인 없이 A5·A4·디지털 입력형 PDF 3종을 다운로드할 수 있습니다. 개인 열람·인쇄용이며 PDF 앱에 따라 한글 입력 표시가 다를 수 있습니다.",
    "freeDownloads": [
        {"label": "A5 컬러 소책자", "description": "읽기·태블릿 필사용 40쪽 PDF", "url": urls[0]},
        {"label": "A4 흑백 인쇄판", "description": "가정용 프린터·손글씨 필사용 40쪽 PDF", "url": urls[1]},
        {"label": "디지털 한글 입력형", "description": "PDF 양식 지원 앱에서 작성 · 기기별 호환성 확인", "url": urls[2]},
    ],
})
schema = json.loads((ROOT / "nal/data/product.schema.json").read_text(encoding="utf-8"))
errors = list(Draft7Validator(schema).iter_errors(product))
assert not errors, [(error.message, list(error.absolute_path)) for error in errors]
existing = next((i for i, item in enumerate(products) if item.get("id") == SLUG), None)
if existing is not None:
    products[existing] = product
else:
    after = next(i for i, item in enumerate(products) if item.get("id") == PRIOR[-1])
    products.insert(after + 1, product)
catalog_file.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("STAGED", SLUG, "FREE", len(urls), "variants; existing paid products untouched")
