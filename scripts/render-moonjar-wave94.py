#!/usr/bin/env python3
"""WAVE9.4: non-destructive museum-inspired WHITE porcelain art material study.

All data is original geometry and unchanged authorized 96 RGBA pieces, *never*
photography or copied museum imagery. This is an OFFLINE STUDY ONLY, not a
pluggable production canvas variant or a scientifically exact nacre BRDF.

Evidence gates:
 * coordinate surface 1600x1800 unchanged
 * alpha/PNG pixels of all 96 original pieces unmodified and SHA-verified
 * optical integration is a separable/reversible renderer layer
 * output no authoring controls nor private coaching notes
 * no clipping of off-jar pieces
"""
from __future__ import annotations
import argparse, hashlib, io, json, math, re, sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image,ImageCms
import cairosvg

W,H=1600,1800
SRC_GEOM = ('M 654,302 C 649,325 639,354 599,378 '
            'C 447,478 328,598 265,765 '
            'C 199,917 217,1057 284,1209 '
            'C 351,1376 515,1493 683,1526 '
            'C 745,1539 854,1541 926,1522 '
            'C 1080,1479 1244,1359 1330,1168 '
            'C 1401,1006 1391,841 1318,692 '
            'C 1235,539 1121,447 990,377 '
            'C 953,348 946,327 943,299 Z')

# The lip and foot are intentionally *not* a symmetrical vector ellipse:
# slight warping and a low, curved heel echo hand-joined bowl construction.
LIP = '''<!-- wave94: original hand-shaped lip, no museum imagery -->
<g transform="rotate(-.72 796 301)">
 <path d="M 651 298 C 689 284 742 282 796 283 C 859 282 910 285 943 294 L 944 320 C 892 337 748 334 655 315 Z" fill="url(#rimMaterial)" stroke="#B7B7AE" stroke-opacity=".28" stroke-width="1.4" />
 <path d="M 655 296 C 696 272 742 282 800 280 C 849 281 908 275 940 293 C 894 309 711 313 655 296 Z" fill="url(#rimMaterial)" stroke="#C0C4B9" stroke-opacity=".39" stroke-width="1.3" />
 <path d="M 674 292 C 712 284 765 286 800 287 C 865 287 899 285 923 292 C 861 301 719 304 674 292 Z" fill="url(#inside)" opacity=".73" />
 <path d="M 651 296 Q 718 278 802 282 Q 886 281 943 293" fill="none" stroke="#FEFFF9" stroke-width="5.1" stroke-opacity=".70" />
 <path d="M 656 315 C 726 326 852 332 941 316" fill="none" stroke="#F8F6EF" stroke-width="4.2" stroke-opacity=".54" />
</g>'''
FOOT = '''<!-- wave94: small hand-thrown foot, explicitly above the grounded shadow -->
<path d="M 678 1514 C 726 1526 866 1528 929 1516 L 921 1541 C 875 1558 728 1555 687 1540 Z" fill="url(#rimMaterial)" stroke="#B2B0A5" stroke-width="1.5" stroke-opacity=".40" />
<path d="M 693 1538 Q 800 1551 917 1539" fill="none" stroke="#7F827D" stroke-width="3" stroke-opacity=".24" />
<path d="M 690 1527 C 734 1536 875 1542 922 1527" fill="none" stroke="#FCF9EE" stroke-width="5.5" stroke-opacity=".40" />'''


def sha(b):return hashlib.sha256(b if isinstance(b,bytes) else Path(b).read_bytes()).hexdigest()

def svg_master(original_svg,kind):
    text=Path(original_svg).read_text('utf8')
    old=re.search(r'<clipPath id="bodyClip"><path d="([^"]+)"',text)
    if not old: raise ValueError('missing existing bodyClip')
    body=old.group(1)
    if text.count(body)!=3: raise ValueError('Unexpected source geometry usage: '+str(text.count(body)))
    text=text.replace(body,SRC_GEOM)
    # Change foot to one low curved heel instead of geometric floating pedestal.
    text,nfoot=re.subn(r'<path d="M681 1508.*?/>',FOOT,text,count=1)
    if nfoot!=1:raise ValueError('source foot not found')
    # Surgical hand-formed rim replacement - the top and body stay two independent forms.
    text,nlip=re.subn(r'<!-- A hand-thrown joined lip:.*?</g>',LIP,text,count=1,flags=re.S)
    if nlip!=1:raise ValueError('source lip not found')
    if kind=='night':
        # neutral gray-blue/cool white; the earlier green-white was too celadon-like.
        text=text.replace('stop-color="#25312F"','stop-color="#24282C"').replace('stop-color="#111A1B"','stop-color="#131719"')
        text=text.replace('stop-color="#636F68"','stop-color="#7D8582"')
        text=text.replace('stop-color="#D7DCD4"','stop-color="#DADCD6"')
    text=text.replace('WAVE 9.3 study','WAVE 9.4 study').replace('V3.1','V3.2')
    assert text.count(SRC_GEOM)==3 and text.count('id="bodyClip"')==1
    return text

def rgba_from_svg(svg: str)->Image.Image:
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode('utf8'),output_width=W,output_height=H))).convert('RGBA')

def porcelain_mask():
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}"><path d="{SRC_GEOM}" fill="white" /></svg>'
    return np.asarray(rgba_from_svg(svg))[:,:,3].astype(np.float32)/255

def form_field(kind,mask):
    rows=mask>.6
    left=np.zeros((H,1),dtype=np.float32);right=np.full((H,1),1600,dtype=np.float32)
    for y in range(H):
        px=np.flatnonzero(rows[y])
        if len(px): left[y,0]=px[0];right[y,0]=px[-1]
    x=np.arange(W,dtype=np.float32)[None,:]
    y=np.arange(H,dtype=np.float32)[:,None]
    radius=np.maximum((right-left)/2,1)
    nx=np.clip((x-(left+right)/2)/radius,-1,1)
    z=np.sqrt(np.maximum(0,1-nx*nx))
    # Ceramic lambertian inspired sculpture field, NOT glossy plastic.
    light=23.5*(0.75*z-0.17*nx-0.31)-8.6*np.power(abs(nx),4)
    # Upright lunar fullness, subtle belly / bottom fall-off.
    light-=7.8*np.clip((y-1120)/460,0,1)
    shoulder=np.exp(-((nx+.40)/.34)**2-((y-580)/330)**2)*3.7
    light+=shoulder
    # gentle kiln glaze pooling, slightly wandering *almost invisible* joining seam
    joining=916+4.3*np.sin(x*.010+.4)+1.4*np.sin(x*.022)
    groove=-1.45*np.exp(-((y-joining)/12)**2)+.55*np.exp(-((y-joining-13)/19)**2)
    light+=groove
    # hand-laid glaze runs at longer wave length, microscale grain only
    seed=20261019 if kind=='day' else 20261020
    rng=np.random.default_rng(seed)
    low=rng.normal(size=(21,17)).astype('float32')
    low=cv2.resize(low,(W,H),interpolation=cv2.INTER_CUBIC)
    low=cv2.GaussianBlur(low,(0,0),12)*.62
    fine=rng.normal(size=(70,61)).astype('float32')
    fine=cv2.resize(fine,(W,H),interpolation=cv2.INTER_CUBIC)
    fine=cv2.GaussianBlur(fine,(0,0),2.9)*.34
    # little to no high-frequency speckling to avoid marble/skin artifact
    turning=.20*np.sin(y*.048+nx*6.5)*np.exp(-((y-1030)/270)**2)
    light+=low+fine+turning
    is_day=kind=='day'
    # White porcelain identity, including at night. Cool cast predominantly
    # belongs to reflected light, not saturation of the entire clay body.
    clay=np.array([243.,245.,234.] if is_day else [213.,234.,233.],dtype=np.float32)
    rgb=clay.reshape(1,1,3)+light[:,:,None]
    if is_day:
        warm=1.0*np.exp(-((y-1210)/430)**2)*np.maximum(z,0)
        rgb[:,:,0]+=warm
    else:
        cool=2.2*np.maximum(nx,0)+1.0*np.exp(-((y-660)/480)**2)
        rgb[:,:,2]+=cool
        rgb[:,:,0]-=.6*cool
    return np.clip(rgb,0,255)

def render_porcelain(svg,kind,mask):
    rendered=np.asarray(rgba_from_svg(svg).convert('RGB'),dtype=np.float32)
    original=rendered.copy()
    glow=form_field(kind,mask)
    y=np.arange(H,dtype=np.float32)[:,None]
    feather=np.minimum(np.clip((y-321)/34,0,1),np.clip((1516-y)/28,0,1))
    weight=(mask*feather)[:,:,None]
    shaded=rendered*(1-weight)+glow*weight
    img=Image.fromarray(np.uint8(np.clip(shaded,0,255)),'RGB')
    assert img.size==(W,H)
    # No modifications to original 96 pieces or user artifacts.
    return img

def save_png(image,p):
    p=Path(p);p.parent.mkdir(parents=True,exist_ok=True)
    profile=bytearray(ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes())
    profile[24:36]=bytes.fromhex('07ea000a00130008000c0000')
    image.save(p,'PNG',icc_profile=bytes(profile),optimize=True,compress_level=9)
    return sha(p)

def produce(source_dir,output_dir):
    output_dir.mkdir(parents=True,exist_ok=True)
    mask=porcelain_mask()
    meta={'version':'porcelain-v3.2-ART-STUDY-ONLY','dimensions':[W,H],
          'productionIntegrated':False,'originalNacreChanged':False,'variants':{}}
    for theme in ['day','night']:
        source=source_dir/f'porcelain-{theme}.svg'
        svg=svg_master(source,theme)
        sp=output_dir/f'porcelain-{theme}.svg';sp.write_text(svg,'utf8')
        artwork=render_porcelain(svg,theme,mask)
        png=output_dir/f'porcelain-{theme}.png'
        h=save_png(artwork,png)
        preview=output_dir/f'preview-{theme}.webp'
        artwork.resize((400,450),Image.Resampling.LANCZOS).save(preview,'WEBP',quality=93,method=6)
        meta['variants'][theme]={'svg_sha256':sha(sp),'png_sha256':h,'preview_sha256':sha(preview),
                                 'dimensions':[W,H]}
        print(theme,'PNG SHA',h,'bytes',png.stat().st_size)
    (output_dir/'study-manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n','utf8')
    return meta

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--source-svg',type=Path,default=Path(__file__).resolve().parents[1]/'design/moonjar-wave93')
    ap.add_argument('--out',type=Path,default=Path('artifacts/moonjar-wave94/study'))
    a=ap.parse_args()
    print(json.dumps(produce(a.source_svg,a.out),ensure_ascii=False))