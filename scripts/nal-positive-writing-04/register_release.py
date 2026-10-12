#!/usr/bin/env python3
"""Build and publish NAL positive-writing 04 from the v1.1 signed-off manuscript.
No checkout, order, entitlement, or existing product files are modified here.
"""
from pathlib import Path
import base64, io, json, re, shutil, subprocess, sys, zipfile
import fitz
from PIL import Image
from jsonschema import Draft7Validator

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SLUG = "nal-positive-writing-04-self-care"
TEMP = ROOT / ".nal-positive-writing-04-release"
payload = base64.b64decode((HERE / "payload-v11.base64").read_text(encoding="ascii").strip())
TEMP.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(io.BytesIO(payload)) as archive:
    assert set(archive.namelist()) == {"build_series04_v11.py","series04_content.json"}, archive.namelist()
    archive.extractall(TEMP)
source = json.loads((TEMP / "series04_content.json").read_text(encoding="utf-8"))
assert len(source["days"]) == 14
sentences = [entry["sentence"] for entry in source["days"]]
assert len(set(sentences)) == 14

subprocess.run([sys.executable, str(TEMP / "build_series04_v11.py")], cwd=ROOT, check=True)
prefix = "NAL_긍정문장따라쓰기_04_지친날에도나를돌보는말_v1.1_"
pdf_dir = ROOT / "nal/assets/downloads/free"
cover_dir = ROOT / "nal/assets/images/catalog/shop/retail"
pdf_dir.mkdir(parents=True, exist_ok=True)
cover_dir.mkdir(parents=True, exist_ok=True)
paths = [
    (ROOT / (prefix + "A5_컬러소책자.pdf"), pdf_dir / (SLUG + "-v11-a5.pdf")),
    (ROOT / (prefix + "A4_흑백인쇄.pdf"), pdf_dir / (SLUG + "-v11-a4-print.pdf")),
    (ROOT / (prefix + "디지털입력형.pdf"), pdf_dir / (SLUG + "-v11-fillable.pdf"))
]
def check_pdf(path, digital=False):
    assert path.exists() and path.stat().st_size > 100000, path
    with fitz.open(path) as doc:
        assert len(doc)==40, (path,len(doc))
        joined = re.sub(r"\s+", "", "".join(p.get_text(sort=True) for p in doc))
        for sentence in sentences:
            assert re.sub(r"\s+", "", sentence) in joined, (path, sentence)
        assert "DAILYCOACHING" in (doc.metadata.get("author") or ""), path
        if digital:
            assert sum(len(list(p.widgets() or [])) for p in doc)==74, path
    print("VERIFIED",path.name, path.stat().st_size, "bytes")

for n,(source_path,target_path) in enumerate(paths):
    check_pdf(source_path,digital=n==2)
    shutil.copyfile(source_path,target_path)
    check_pdf(target_path,digital=n==2)
cover_original = ROOT / (prefix+"스토어표지.png")
cover_target = cover_dir / (SLUG+"-v11-cover.png")
with Image.open(cover_original) as image:
    assert image.size == (1200,1600), image.size
shutil.copyfile(cover_original,cover_target)
with Image.open(cover_target) as image:
    assert image.size == (1200,1600), image.size

meta = json.loads((TEMP / "NAL_04_스토어상품정보_v1.1.json").read_text(encoding="utf-8"))
product = meta["product"]
catalog_file = ROOT/"nal/data/products.json"
catalog = json.loads(catalog_file.read_text(encoding="utf-8"))
books = ["nal-positive-writing-14days","nal-positive-writing-02-relationships","nal-positive-writing-03-small-starts"]
for book in books:
    matches = [p for p in catalog["products"] if p.get("id")==book and p.get("published") and p.get("price")==0]
    assert len(matches)==1, ("Missing existing series product",book)
assert all(x.get("id") != SLUG for x in catalog["products"]), "Reconcile existing product before repeat"
files = ["/"+str(path.relative_to(ROOT)).replace("\\","/") for _,path in paths]
product.update({
    "published":True, "price":0,"stockStatus":"available",
    "featured":True,"featuredOrder":7,
    "purchaseUrl":files[0],"sampleUrl":files[0],"previewUrl":files[0],
    "fileSizeMB":round(paths[0][1].stat().st_size/1_000_000,2),
    "fulfillmentNote":"회원가입과 결제 없이 A5·A4·디지털 입력형 PDF를 바로 받습니다. 개인 열람·인쇄용이며 일부 PDF 앱은 한글 입력 표시가 다를 수 있습니다.",
    "freeDownloads":[
        {"label":"A5 컬러 소책자","description":"읽기·태블릿 필사용 40쪽 PDF","url":files[0]},
        {"label":"A4 흑백 인쇄판","description":"가정용 인쇄·손글씨 필사용 40쪽 PDF","url":files[1]},
        {"label":"디지털 한글 입력형","description":"PDF 양식 지원 앱에서 작성하는 40쪽 PDF · 앱별 호환성 확인","url":files[2]}
    ],
})
product["coverImage"]="/"+str(cover_target.relative_to(ROOT)).replace("\\","/")
schema = json.loads((ROOT/"nal/data/product.schema.json").read_text(encoding="utf-8"))
errors=list(Draft7Validator(schema).iter_errors(product))
assert not errors, [(err.message,list(err.absolute_path)) for err in errors]
idx=next(i for i,p in enumerate(catalog["products"]) if p.get("id")==books[-1])
catalog["products"].insert(idx+1,product)
catalog_file.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("NAL VOL 04 PUBLISHED IN STAGED GIT BRANCH",SLUG,files)

# These generated originals are untracked runtime intermediates.
for source_path,_ in paths:
    source_path.unlink(missing_ok=True)
cover_original.unlink(missing_ok=True)
for suffix in ("고객용패키지.zip","운영자용제작패키지.zip"):
    (ROOT/(prefix+suffix)).unlink(missing_ok=True)
