#!/usr/bin/env python3
"""Original DAILYCOACHING porcelain day/night art reproduction.
Deterministic pixels via SVG vector geometry + clipped low-amplitude glaze noise.
No museum photography or external image asset.
"""
from __future__ import annotations
import io, json, hashlib, math
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageCms
import cairosvg

ROOT=Path(__file__).resolve().parents[1]/"activities/moonjar/assets/moonjar-v2"
(ROOT/"master").mkdir(parents=True,exist_ok=True)
W,H=1600,1800
BODY=('M 654,282 C 650,311 637,333 602,357 '
      'C 450,454 336,568 271,716 '
      'C 210,850 209,994 264,1139 '
      'C 333,1316 479,1437 655,1498 '
      'Q 663,1519 671,1535 '
      'C 742,1553 850,1553 922,1537 '
      'Q 934,1519 941,1498 '
      'C 1141,1422 1304,1320 1366,1148 '
      'C 1419,1001 1400,826 1334,694 '
      'C 1261,541 1146,443 996,354 '
      'C 963,335 949,313 946,282 Z')

TONE={
 'day':{
 'bg0':'#F7F5EF','bg1':'#ECECE5','halo0':'#FFFFFF','halo1':'#F8F5EC',
 'ground':'#667569','shadow':'#7D8C83','edge':'#A7ADA5',
 'body0':'#FAFBF8','body1':'#F6F7F4','body2':'#ECF0EC','body3':'#DEE4DE','body4':'#C9D4CE','body5':'#A8B7B0',
 'glow':'#FFFDF6','glaze':'#CFDAD5','rim0':'#FEFFFB','rim1':'#B4C1BA','rim2':'#F9F9F3',
 'inside0':'#9DADA6','inside1':'#D9DFDA','inside2':'#F5F7EF','seam':'#94A59B',
 'dust':'#E5E8E1','blue':'#A6C7C0'},
 'night':{
 'bg0':'#142831','bg1':'#1E353C','halo0':'#68898D','halo1':'#1F3D45',
 'ground':'#03161C','shadow':'#072731','edge':'#B9CECE',
 'body0':'#F3F8F4','body1':'#ECF4EF','body2':'#DCE9E3','body3':'#CBDDD5','body4':'#AEC8C2','body5':'#7F9FA0',
 'glow':'#F7FAF8','glaze':'#B0C6C5','rim0':'#F4FAF6','rim1':'#98ADB1','rim2':'#F6F8F1',
 'inside0':'#637D88','inside1':'#A4BAB8','inside2':'#E0EAE5','seam':'#648891',
 'dust':'#B6CDCD','blue':'#A1C7C8'},
}
def render_svg_art(mode):
 t=TONE[mode]
 raw=r'''<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1800" viewBox="0 0 1600 1800">
 <title>달항아리 백자 @@MODE@@ · DAILYCOACHING 자체제작 벡터 마스터</title>
 <desc>원본 사진을 사용하지 않고 새로 그린 유백색 달항아리. 입구와 굽, 부드럽고 비대칭인 둥근 몸통, 완만한 빛과 도자기의 질감을 표현한다. 자개는 별도 레이어에 자유 배치한다.</desc>
 <defs>
  <linearGradient id="background" x1=".5" y1="0" x2=".5" y2="1"><stop stop-color="@@BG0@@"/><stop offset="1" stop-color="@@BG1@@"/></linearGradient>
  <radialGradient id="halo" cx="49%" cy="48%" r="57%"><stop stop-color="@@HALO0@@" stop-opacity=".55"/><stop offset=".5" stop-color="@@HALO1@@" stop-opacity=".21"/><stop offset="1" stop-color="@@HALO1@@" stop-opacity="0"/></radialGradient>
  <linearGradient id="vessel" x1="0" y1="0.18" x2="1" y2=".86">
    <stop stop-color="@@BODY2@@"/><stop offset=".16" stop-color="@@BODY0@@"/><stop offset=".40" stop-color="@@BODY1@@"/><stop offset=".58" stop-color="@@BODY2@@"/><stop offset=".80" stop-color="@@BODY3@@"/><stop offset=".95" stop-color="@@BODY4@@"/><stop offset="1" stop-color="@@BODY5@@"/>
  </linearGradient>
  <radialGradient id="vesselLight" cx="35%" cy="27%" r="74%">
    <stop stop-color="@@GLOW@@" stop-opacity=".62"/><stop offset=".22" stop-color="@@GLOW@@" stop-opacity=".33"/><stop offset=".65" stop-color="@@GLOW@@" stop-opacity=".04"/><stop offset="1" stop-color="@@GLOW@@" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="edgeShade" x1="0" y1="0" x2="1" y2="0"><stop stop-color="@@BLUE@@" stop-opacity=".16"/><stop offset=".2" stop-color="@@BLUE@@" stop-opacity="0"/><stop offset=".72" stop-color="@@BLUE@@" stop-opacity="0"/><stop offset="1" stop-color="@@BLUE@@" stop-opacity=".25"/></linearGradient>
  <linearGradient id="rim" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="@@RIM0@@"/><stop offset=".46" stop-color="@@RIM1@@"/><stop offset=".62" stop-color="@@RIM2@@"/><stop offset="1" stop-color="@@RIM1@@"/></linearGradient>
  <linearGradient id="inside" x1="0" y1="0" x2="0" y2="1"><stop stop-color="@@INSIDE0@@"/><stop offset=".52" stop-color="@@INSIDE1@@"/><stop offset="1" stop-color="@@INSIDE2@@"/></linearGradient>
  <radialGradient id="glaze" cx="50%" cy="43%" r="58%"><stop stop-color="@@GLOW@@" stop-opacity=".08"/><stop offset=".6" stop-color="@@GLAZE@@" stop-opacity=".02"/><stop offset="1" stop-color="@@GLAZE@@" stop-opacity=".16"/></radialGradient>
  <radialGradient id="contact" cx="50%" cy="50%" r="50%"><stop stop-color="@@GROUND@@" stop-opacity=".32"/><stop offset=".66" stop-color="@@GROUND@@" stop-opacity=".08"/><stop offset="1" stop-color="@@GROUND@@" stop-opacity="0"/></radialGradient>
  <clipPath id="clayClip"><path d="@@BODY@@"/></clipPath>
 </defs>
 <rect width="1600" height="1800" fill="url(#background)"/>
 <ellipse cx="798" cy="913" rx="790" ry="810" fill="url(#halo)"/>
 <ellipse cx="799" cy="1570" rx="398" ry="54" fill="url(#contact)" />
 <path d="@@BODY@@" fill="@@SHADOW@@" fill-opacity=".16" transform="translate(10 13)"/>
 <path d="@@BODY@@" fill="url(#vessel)" stroke="@@EDGE@@" stroke-width="2.1"/>
 <g clip-path="url(#clayClip)">
   <rect x="208" y="280" width="1199" height="1285" fill="url(#vesselLight)"/>
   <rect x="208" y="280" width="1199" height="1285" fill="url(#edgeShade)"/>
   <rect x="208" y="280" width="1199" height="1285" fill="url(#glaze)"/>
   <path d="M 397,468 C 288,605 270,840 302,1060 C 315,1170 365,1290 429,1339" fill="none" stroke="@@GLOW@@" stroke-width="68" stroke-linecap="round" stroke-opacity=".15"/>
   <path d="M 1105,419 C 1312,598 1371,826 1333,1089 C 1297,1230 1205,1360 1145,1395" fill="none" stroke="@@BLUE@@" stroke-width="62" stroke-opacity=".065"/>
   <path d="M 286,884 C 550,852 945,867 1349,884" stroke="@@SEAM@@" stroke-width="4" stroke-opacity=".055" fill="none" />
   <path d="M 279,916 C 550,900 962,903 1353,925" stroke="@@GLOW@@" stroke-width="6" stroke-opacity=".07" fill="none" />
 </g>
 <path d="M 656,277 C 693,295 911,301 944,275" fill="none" stroke="@@RIM1@@" stroke-width="20" stroke-linecap="round" opacity=".72"/>
 <path d="M 658,270 C 677,291 924,297 946,269" fill="none" stroke="@@GLOW@@" stroke-width="10" opacity=".65"/>
 <ellipse cx="801" cy="266" rx="153" ry="22" fill="url(#rim)" stroke="@@EDGE@@" stroke-width="2.3"/>
 <ellipse cx="802" cy="264" rx="135" ry="14" fill="url(#inside)" stroke="@@RIM1@@" stroke-width=".7"/>
 <path d="M 650,268 C 672,287 926,288 953,267" fill="none" stroke="@@GLOW@@" stroke-width="8" opacity=".82"/>
 <path d="M 663,284 C 685,297 921,297 940,285" fill="none" stroke="@@SEAM@@" stroke-width="3" opacity=".30"/>
 <path d="M 654,1500 C 722,1516 883,1524 946,1499 L 925,1534 C 849,1554 745,1555 672,1536 Z" fill="url(#rim)" stroke="@@EDGE@@" stroke-width="1.3" opacity=".78"/>
 <path d="M 681,1531 Q 800,1565 915,1532" fill="none" stroke="@@SEAM@@" stroke-width="2.2" stroke-opacity=".48"/>
 <path d="M 682,1524 C 760,1540 856,1542 918,1524" fill="none" stroke="@@GLOW@@" stroke-width="4" stroke-opacity=".34"/>
</svg>'''
 replacements={
 '@@MODE@@':'낮' if mode=='day' else '달빛 밤', '@@BODY@@':BODY,
 '@@BG0@@':t['bg0'],'@@BG1@@':t['bg1'],'@@HALO0@@':t['halo0'],'@@HALO1@@':t['halo1'],
 '@@BODY0@@':t['body0'],'@@BODY1@@':t['body1'],'@@BODY2@@':t['body2'],'@@BODY3@@':t['body3'],'@@BODY4@@':t['body4'],'@@BODY5@@':t['body5'],
 '@@EDGE@@':t['edge'],'@@SHADOW@@':t['shadow'],'@@GROUND@@':t['ground'],'@@GLOW@@':t['glow'],'@@GLAZE@@':t['glaze'],'@@BLUE@@':t['blue'],
 '@@RIM0@@':t['rim0'],'@@RIM1@@':t['rim1'],'@@RIM2@@':t['rim2'],
 '@@INSIDE0@@':t['inside0'],'@@INSIDE1@@':t['inside1'],'@@INSIDE2@@':t['inside2'],'@@SEAM@@':t['seam'],
 }
 for k,v in replacements.items():raw=raw.replace(k,v)
 assert '@@' not in raw
 return raw

def vessel_mask():
 mask_svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1800" viewBox="0 0 1600 1800"><path d="{BODY}" fill="white"/></svg>'
 return np.asarray(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=mask_svg.encode()))).convert('RGBA'))[:,:,3].astype(np.float32)/255.

def texture_art(img,mask,mode):
 a=np.asarray(img.convert('RGB'),dtype=np.float32).copy()
 rng=np.random.default_rng(20261016 if mode=='day' else 20261017)
 n1=rng.normal(0,1,(60,55)).astype(np.float32)
 n1=cv2.resize(n1,(W,H),interpolation=cv2.INTER_CUBIC)
 n1=cv2.GaussianBlur(n1,(0,0),3.5)
 n2=rng.normal(0,1,(230,205)).astype(np.float32)
 n2=cv2.resize(n2,(W,H),interpolation=cv2.INTER_CUBIC)
 n2=cv2.GaussianBlur(n2,(0,0),.8)
 n3=rng.normal(0,1,(H,W)).astype(np.float32)
 yy,xx=np.mgrid[:H,:W].astype(np.float32)
 diagonal=np.sin((xx*.012+yy*.003)+.8)*.7 + np.sin((xx*.003-yy*.009)+1.8)*.45
 diff=(2.05*n1 + .8*n2 + .65*n3 + diagonal)*mask
 a += diff[:,:,None]*np.array([1.,1.02,1.0],dtype=np.float32)[None,None,:]
 a=np.uint8(np.clip(a,0,255))
 return Image.fromarray(a,'RGB')

def sRGB_png(img,path):
 icc=ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
 img.save(path,format='PNG',icc_profile=icc,optimize=True,compress_level=9)

def digest(path):
 return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
 mask=vessel_mask()
 variants={}
 for mode in ('day','night'):
  stem=f'porcelain-{mode}'
  svg=render_svg_art(mode)
  master=ROOT/'master'/f'{stem}.svg'
  master.write_text(svg,encoding='utf-8')
  raster=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=W,output_height=H))).convert('RGB')
  refined=texture_art(raster,mask,mode)
  png=ROOT/f'{stem}.png'
  sRGB_png(refined,png)
  thumb=ROOT/f'thumbnail-{mode}.webp'
  refined.resize((400,450),Image.Resampling.LANCZOS).save(thumb,format='WEBP',quality=94,method=6)
  variants[mode]={
   'src':f'assets/moonjar-v2/{stem}.png',
   'originalSvg':f'assets/moonjar-v2/master/{stem}.svg',
   'thumbnail':f'assets/moonjar-v2/thumbnail-{mode}.webp',
   'width':W,'height':H,'sha256':digest(png),'byteSize':png.stat().st_size,
   'svgSha256':digest(master),'creator':'DAILYCOACHING','original':True
  }
 (ROOT/'variants.json').write_text(json.dumps({
  'version':'porcelain-v2.0','coordinateSystem':{'width':W,'height':H},
  'variants':variants,'existingV3AssetsUnchanged':True
 },ensure_ascii=False,indent=2),encoding='utf-8')
 manifestPath=ROOT.parents[1]/'data/manifest.json'
 manifest=json.loads(manifestPath.read_text(encoding='utf-8'))
 manifest['backgroundVariants']['porcelain-v2']['assets']=variants
 manifestPath.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(variants,ensure_ascii=False))
if __name__=='__main__':main()
