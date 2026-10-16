#!/usr/bin/env python3
"""Build original DAILYCOACHING porcelain backgrounds, reproducibly.
No museum photography, external visual assets, or user reflection data.
Outputs 1600x1800 full-resolution PNG + original SVG + thumbnails.
"""
from pathlib import Path
import random, json, hashlib
import cairosvg
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "activities/moonjar/assets/moonjar-v2"
W,H = 1600,1800
BODY = ("M 643 289 C 642 327 626 347 588 376 "
 "C 484 454 368 559 297 713 C 218 871 202 1044 247 1189 "
 "C 317 1396 484 1510 681 1572 Q 690 1592 706 1602 "
 "C 748 1621 856 1621 896 1602 Q 915 1593 920 1573 "
 "C 1127 1500 1295 1354 1352 1153 C 1407 981 1366 805 1282 656 "
 "C 1208 526 1098 443 985 371 C 956 351 959 318 957 289 Z")
RIM = "M 643 290 C 690 250 910 249 957 289 C 921 321 678 327 643 290 Z"
FOOT = ("M 681 1572 C 691 1584 699 1598 712 1603 "
 "C 754 1616 853 1616 894 1602 C 905 1597 915 1585 920 1573")

def build_svg(kind):
    night = kind == "night"
    bg = "#10262D" if night else "#F7F4ED"
    bg2 = "#193840" if night else "#EEECE5"
    outline = "#aab8b0" if night else "#BBC8BD"
    shade = "#92a8a7" if night else "#aeb9b3"
    rimdark = "#bacac6" if night else "#c6cdc5"
    colors = ("#fbfbf6","#f3f7f5","#e4ece9","#cbdad9","#a9bebc") if night else ("#fffefa","#fbfaf5","#f0f1e9","#dfe7de","#bfcbbf")
    h = "#f9fff9" if night else "#ffffff"
    gen = random.Random(1193)
    dots = []
    for i in range(300):
        x=gen.randint(220,1380)
        y=gen.randint(305,1590)
        r=gen.choice([.8,1.0,1.35,1.9,2.3,2.6])
        opacity=round(gen.uniform(.024,.08),3)
        dots.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{"#8f9c9d" if night else "#7b8c7d"}" opacity="{opacity}"/>')
    strokes = []
    for i in range(29):
        rng=random.Random(3000+i)
        x=rng.randint(350,1220);y=rng.randint(480,1510);dx=rng.randint(15,77)
        strokes.append(f'<path d="M{x} {y} q{dx//2} {-rng.randint(1,8)} {dx} {-rng.randint(0,4)}" fill="none" stroke="#899e94" stroke-width="{rng.choice([1.0,1.3,1.6])}" opacity="{rng.uniform(.022,.06):.3f}"/>')
    grain='\n'.join(dots+strokes)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">
<title id="title">달항아리 백자 — {'달빛 밤' if night else '햇살 낮'}</title>
<desc id="desc">DAILYCOACHING 오리지널 달항아리 백자 도안. 은은한 유약 질감과 넉넉한 몸체를 가진 유백색 항아리. 자유 배치를 위한 종이 여백.</desc>
<defs>
 <radialGradient id="paper" cx="48%" cy="30%" r="85%"><stop stop-color="{bg}"/><stop offset="1" stop-color="{bg2}"/></radialGradient>
 <radialGradient id="body" cx="34%" cy="27%" r="80%"><stop offset="0" stop-color="{colors[0]}"/><stop offset=".22" stop-color="{colors[1]}"/><stop offset=".49" stop-color="{colors[2]}"/><stop offset=".75" stop-color="{colors[3]}"/><stop offset="1" stop-color="{colors[4]}"/></radialGradient>
 <linearGradient id="shading" x1="0" y1="0" x2="1" y2=".35"><stop stop-color="#ffffff" stop-opacity=".23"/><stop offset=".22" stop-color="#ffffff" stop-opacity=".12"/><stop offset=".67" stop-color="{shade}" stop-opacity="0"/><stop offset="1" stop-color="{shade}" stop-opacity=".28"/></linearGradient>
 <radialGradient id="halo" cx="51%" cy="52%" r="50%"><stop stop-color="{'#436065' if night else '#fffefa'}" stop-opacity="{'0.29' if night else '0.65'}"/><stop offset="1" stop-color="{bg}" stop-opacity="0"/></radialGradient>
 <linearGradient id="lip" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fcfcf5"/><stop offset=".22" stop-color="#e1eae5"/><stop offset=".50" stop-color="#c5d0c9"/><stop offset=".75" stop-color="#fafaf5"/><stop offset="1" stop-color="#a2b1aa"/></linearGradient>
 <linearGradient id="inside" x1="0" y1="0" x2="0" y2="1"><stop stop-color="{'#6f8b8d' if night else '#97aaa2'}"/><stop offset=".55" stop-color="{rimdark}"/><stop offset="1" stop-color="#f8f9f4"/></linearGradient>
 <radialGradient id="ground" cx="50%" cy="50%" r="50%"><stop stop-color="{'#030f13' if night else '#87958e'}" stop-opacity="{'0.44' if night else '0.2'}"/><stop offset="1" stop-color="{bg}" stop-opacity="0"/></radialGradient>
 <radialGradient id="highlight" cx="31%" cy="22%" r="52%"><stop stop-color="{h}" stop-opacity=".36"/><stop offset=".65" stop-color="{h}" stop-opacity=".10"/><stop offset="1" stop-color="{h}" stop-opacity="0"/></radialGradient>
 <clipPath id="vessel"><path d="{BODY}"/></clipPath>
</defs>
<rect width="1600" height="1800" fill="url(#paper)"/>
<ellipse cx="803" cy="916" rx="650" ry="745" fill="url(#halo)"/>
<ellipse cx="806" cy="1610" rx="390" ry="75" fill="url(#ground)"/>
<g aria-label="달항아리 입체 백자">
 <path d="{BODY}" transform="translate(8 13)" fill="#627b71" opacity=".07"/>
 <path d="{BODY}" fill="url(#body)" stroke="{outline}" stroke-width="4"/>
 <g clip-path="url(#vessel)">
   <path d="{BODY}" fill="url(#shading)"/>
   <ellipse cx="640" cy="649" rx="260" ry="635" fill="url(#highlight)" transform="rotate(-10 640 649)"/>
   <path d="M 374 651 C 280 802 294 1121 469 1341" stroke="#ffffff" stroke-width="61" opacity=".10" stroke-linecap="round" fill="none"/>
   <path d="M 1275 735 C 1344 984 1288 1209 1153 1368" stroke="#98aaa4" stroke-width="63" opacity=".07" stroke-linecap="round" fill="none"/>
   <path d="M 529 1060 Q 831 1041 1233 1063" stroke="#becbc1" stroke-opacity=".065" stroke-width="8" fill="none"/>
   {grain}
 </g>
 <path d="{FOOT}" fill="none" stroke="{'#a9bfba' if night else '#a6b5aa'}" stroke-width="7" opacity=".54"/>
 <path d="M694 1587 Q805 1608 906 1586" fill="none" stroke="#f6f8f2" stroke-width="6" opacity=".57"/>
 <path d="M641 293 Q635 323 632 335" stroke="#ffffff" stroke-width="5" opacity=".35" fill="none"/>
 <path d="{RIM}" fill="url(#lip)" stroke="{outline}" stroke-width="3"/>
 <ellipse cx="800" cy="286" rx="144" ry="17" fill="url(#inside)" stroke="{rimdark}" stroke-width="1.5"/>
 <path d="M646 293 C699 321 907 319 952 293" fill="none" stroke="#fafff8" stroke-width="7" opacity=".83"/>
 <path d="M658 315 C730 327 886 329 943 313" fill="none" stroke="#bbc7be" stroke-width="2" opacity=".45"/>
</g></svg>"""

def build():
    (OUT/"master").mkdir(parents=True, exist_ok=True)
    variants={}
    for kind in ("day","night"):
        svg=build_svg(kind)
        svg_path=OUT/"master"/f"porcelain-{kind}.svg"
        svg_path.write_text(svg,encoding="utf-8")
        png=OUT/f"porcelain-{kind}.png"
        cairosvg.svg2png(bytestring=svg.encode("utf-8"),write_to=str(png),output_width=W,output_height=H)
        with Image.open(png) as im:
            if im.size!=(W,H):raise ValueError("Canvas changed")
            im.convert("RGB").resize((400,450),Image.Resampling.LANCZOS).save(OUT/f"thumbnail-{kind}.webp",quality=94,method=6)
        digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
        variants[kind]={
          "src":f"assets/moonjar-v2/porcelain-{kind}.png",
          "originalSvg":f"assets/moonjar-v2/master/porcelain-{kind}.svg",
          "thumbnail":f"assets/moonjar-v2/thumbnail-{kind}.webp",
          "width":W, "height":H, "sha256":digest(png), "byteSize":png.stat().st_size,
          "svgSha256":digest(svg_path),"creator":"DAILYCOACHING","original":True
        }
    (OUT/"variants.json").write_text(json.dumps({
      "version":"porcelain-v2.0","coordinateSystem":{"width":W,"height":H},
      "variants":variants,"existingV3AssetsUnchanged":True
    },ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(variants,ensure_ascii=False))
if __name__=="__main__":build()
