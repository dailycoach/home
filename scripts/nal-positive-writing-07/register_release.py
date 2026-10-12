#!/usr/bin/env python3
"""Release volume 07 v1.1 without changing checkout or paid-product logic."""
from pathlib import Path
import json, re, shutil, subprocess, sys
import fitz
from PIL import Image
from jsonschema import Draft7Validator

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
SRC=HERE/"source"
SLUG="nal-positive-writing-07-self-respect"
PREFIX="NAL_긍정문장따라쓰기_07_실수한날에도나를존중하는말_v1.1_"
IDS=["nal-positive-writing-14days","nal-positive-writing-02-relationships","nal-positive-writing-03-small-starts","nal-positive-writing-04-self-care","nal-positive-writing-05-small-joys","nal-positive-writing-06-changing-days"]
data=json.loads((SRC/"series07_content_v11.json").read_text(encoding="utf-8"))
assert data["volume"]==7 and len(data["days"])==14
sentences=[x["sentence"] for x in data["days"]]
assert len(set(sentences))==14

subprocess.run([sys.executable,str(SRC/"build_series07_v11.py")],cwd=ROOT,check=True)

downloads=ROOT/"nal/assets/downloads/free"
covers=ROOT/"nal/assets/images/catalog/shop/retail"
downloads.mkdir(parents=True,exist_ok=True)
covers.mkdir(parents=True,exist_ok=True)
spec=[
 (HERE/(PREFIX+"A5_컬러소책자.pdf"),downloads/(SLUG+"-v11-a5.pdf")),
 (HERE/(PREFIX+"A4_흑백인쇄.pdf"),downloads/(SLUG+"-v11-a4-print.pdf")),
 (HERE/(PREFIX+"디지털입력형.pdf"),downloads/(SLUG+"-v11-fillable.pdf"))
]

for index,(src,dst) in enumerate(spec):
    assert src.is_file() and src.stat().st_size>100_000,src
    with fitz.open(src) as doc:
        assert doc.page_count==40,src
        book=re.sub(r"\s+","", "".join(p.get_text(sort=True) for p in doc))
        for sentence in sentences:
            assert re.sub(r"\s+","",sentence) in book,(src,sentence)
        assert "DAILYCOACHING" in (doc.metadata.get("author") or ""),src
        if index==2:
            widgets=[w for p in doc for w in (list(p.widgets() or []))]
            assert len(widgets)==74,len(widgets)
            assert len({w.field_name for w in widgets})==74
    shutil.copyfile(src,dst)
    assert dst.stat().st_size==src.stat().st_size
    print("PASS",dst.relative_to(ROOT),dst.stat().st_size)

src_cover=HERE/(PREFIX+"스토어표지.png")
dst_cover=covers/(SLUG+"-v11-cover.png")
with Image.open(src_cover) as image:
    assert image.size==(1200,1600),image.size
shutil.copyfile(src_cover,dst_cover)

catalog_path=ROOT/"nal/data/products.json"
catalog=json.loads(catalog_path.read_text(encoding="utf-8"))
products=catalog["products"]
for name in IDS:
    items=[x for x in products if x.get("id")==name]
    assert len(items)==1 and items[0]["published"] and items[0]["price"]==0, name
    assert len(items[0].get("freeDownloads",[]))==3,name
ids=[x.get("id") for x in products if x.get("id")]
assert len(ids)==len(set(ids)), "duplicate product IDs"

product_meta=json.loads((SRC/"NAL_07_스토어상품정보_v1.1.json").read_text(encoding="utf-8"))
product=product_meta["product"]
assert product["id"]==product["slug"]==SLUG
paths=["/"+str(dst.relative_to(ROOT)).replace("\\","/") for _,dst in spec]
product.update({
  "published":True,"price":0,"stockStatus":"available",
  "featured":True,"featuredOrder":10,
  "purchaseUrl":paths[0],"sampleUrl":paths[0],"previewUrl":paths[0],
  "fileSizeMB":round(spec[0][1].stat().st_size/1_000_000,2),
  "coverImage":"/"+str(dst_cover.relative_to(ROOT)).replace("\\","/"),
  "fulfillmentNote":"회원가입과 결제 없이 A5·A4·디지털 입력형 PDF를 직접 받습니다. 개인 열람·인쇄용이며 일부 PDF 앱의 한글 입력 표시는 다를 수 있습니다.",
  "freeDownloads":[
    {"label":"A5 컬러 소책자","description":"에세이 읽기·태블릿 필사용 40쪽 PDF","url":paths[0]},
    {"label":"A4 흑백 인쇄판","description":"가정용 프린터·손글씨 기록용 40쪽 PDF","url":paths[1]},
    {"label":"디지털 한글 입력형","description":"PDF 양식 지원 앱에서 작성하는 40쪽 PDF · 앱별 호환성 확인","url":paths[2]}
  ]
})
schema=json.loads((ROOT/"nal/data/product.schema.json").read_text(encoding="utf-8"))
errors=list(Draft7Validator(schema).iter_errors(product))
assert not errors,[(x.message,list(x.absolute_path)) for x in errors]
at=next((i for i,x in enumerate(products) if x.get("id")==SLUG),None)
if at is None:
    after=next(i for i,x in enumerate(products) if x.get("id")==IDS[-1])
    products.insert(after+1,product)
else:
    products[at]=product
catalog_path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("PASS: staged volume 07, catalog + 3 public PDFs + cover")
