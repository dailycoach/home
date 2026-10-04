from pathlib import Path
import json

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

pdfmetrics.registerFont(UnicodeCIDFont("HYSMyeongJo-Medium"))
W, H = 362.8, 532.9
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "nal" / "data"
OUT = ROOT / "nal" / "assets" / "downloads" / "free"
OUT.mkdir(parents=True, exist_ok=True)

SPECS = [
    ("01", "nal-free-small-book-v7-01.json", "nal-small-book-01-mind-reset-v7.pdf"),
    ("02", "nal-free-small-book-v7-02.json", "nal-small-book-02-relationship-v7.pdf"),
    ("03", "nal-free-small-book-v7-03.json", "nal-small-book-03-next-step-v7.pdf"),
]

def wrap(value, size=38):
    value = (value or "").strip()
    return [value[i:i + size] for i in range(0, len(value), size)] or [""]

def clean_free_text(text):
    return (text or "").replace("\x00", "") \
        .replace("구매자 한 사람의", "사용자 한 사람의") \
        .replace("구매자 본인의", "사용자 본인의") \
        .replace("Retail v7", "FREE v7") \
        .replace("구매자", "사용자")

for num, data_name, output_name in SPECS:
    spec = json.loads((DATA / data_name).read_text(encoding="utf-8"))
    pages = spec["pages"]
    accent = spec["accent"]
    title = spec["title"]
    subtitle = spec["subtitle"]
    out = OUT / output_name

    c = canvas.Canvas(str(out), pagesize=(W, H), pageCompression=1)
    c.setTitle(title)
    c.setAuthor("DAILYCOACHING · NAL")
    c.setSubject("NAL · 날빛 무료 작은 책 · 에세이형 마음도구")

    for idx, raw in enumerate(pages, 1):
        text = clean_free_text(raw).strip()
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

        c.setFillColor(HexColor("#F7F2E8"))
        c.rect(0, 0, W, H, fill=1, stroke=0)
        c.setFillColor(HexColor(accent))
        c.rect(0, H - 7, W, 7, fill=1, stroke=0)

        if idx == 1:
            c.setFillColor(HexColor(accent))
            c.setFont("Helvetica-Bold", 7.5)
            c.drawString(30, H - 50, f"NAL · FREE EDITION {num}")
            y = H - 95
            c.setFillColor(HexColor("#22211F"))
            c.setFont("HYSMyeongJo-Medium", 17)
            for title_line in wrap(title, 15):
                c.drawString(30, y, title_line)
                y -= 26
            y -= 8
            c.setFillColor(HexColor("#666057"))
            c.setFont("HYSMyeongJo-Medium", 9.5)
            c.drawString(30, y, subtitle)
            y -= 42
            c.setFillColor(HexColor("#4B4944"))
            c.setFont("HYSMyeongJo-Medium", 8.3)
            note = "읽는 책처럼 펼치고, 쓰는 시간으로 머무는 날빛의 무료 작은 책입니다. 개인 사용과 개인 인쇄가 가능합니다."
            for note_line in wrap(note, 34):
                c.drawString(30, y, note_line)
                y -= 14
        else:
            c.setFillColor(HexColor("#77736C"))
            c.setFont("Helvetica", 6.5)
            c.drawString(28, H - 25, f"NAL · FREE EDITION {num}")
            c.drawRightString(W - 28, H - 25, f"{idx:02d}")
            y = H - 56
            if lines:
                first = lines[0]
                if first.startswith("NAL ") or first.startswith("DAILYCOACHING"):
                    lines = lines[1:]
                    first = lines[0] if lines else ""
                c.setFillColor(HexColor("#22211F"))
                c.setFont("HYSMyeongJo-Medium", 12.5)
                for title_line in wrap(first, 20)[:3]:
                    c.drawString(30, y, title_line)
                    y -= 20
                y -= 6
                c.setFont("HYSMyeongJo-Medium", 7.6)
                c.setFillColor(HexColor("#4B4944"))
                for line in lines[1:]:
                    for body_line in wrap(line, 38):
                        if y < 42:
                            break
                        c.drawString(30, y, body_line)
                        y -= 11
                    y -= 2
                    if y < 42:
                        break

        c.setStrokeColor(HexColor("#D8D0C3"))
        c.line(28, 28, W - 28, 28)
        c.setFillColor(HexColor("#77736C"))
        c.setFont("Helvetica", 5.5)
        c.drawString(28, 17, "DAILYCOACHING · NAL")
        c.drawRightString(W - 28, 17, "FREE")
        c.showPage()

    c.save()
    print(f"{out.relative_to(ROOT)} · {out.stat().st_size} bytes · {len(pages)} pages")
