#!/usr/bin/env python3
"""DAILYCOACHING Moonjar: selected A-only tactile craft research renderer.

B editorial/hanji collage concept is discontinued by the product owner.
This offline study is a visual proposal, never a physically accurate BRDF/PBR
or a production export pipeline. Preserve the original 96 transparent PNG
assets, their SHA256, off-vessel placements and all existing user records.
"""
from __future__ import annotations
import hashlib, json, math, os, sys, statistics
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import cv2
import numpy as np

_SCRIPT_DIR=Path(__file__).resolve().parent
_REPO_ROOT=_SCRIPT_DIR.parent
HERE=_REPO_ROOT/'artifacts/moonjar-craft'
SRC=_REPO_ROOT
BASE=_REPO_ROOT/'artifacts/moonjar-wave94/study'
W,H=1600,1800
FONT_REG='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
FONT_BOLD='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
PALETTE_COLOR={'A':(198,160,115),'B':(144,173,157),'C':(136,157,172),'D':(179,128,146),'E':(212,205,180),'F':(60,94,137),'G':(193,116,100),'H':(156,139,172)}

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def font(sz,bold=False):return ImageFont.truetype(FONT_BOLD if bold else FONT_REG,sz)

def load():
    manifest=json.loads((SRC/'activities/moonjar/data/manifest.json').read_text())
    assert len(manifest['pieces'])==96
    pieces={}
    for info in manifest['pieces']:
        p=SRC/'activities/moonjar'/info['src']
        assert sha(p)==info['sha256'], 'Original source changed '+str(info['id'])
        im=Image.open(p).convert('RGBA')
        assert im.size==(info['width'],info['height'])
        pieces[info['id']]=im
    backgrounds={}
    for theme in ['day','night']:
        p=BASE/f'porcelain-{theme}.png';assert p.exists()
        backgrounds[theme]=Image.open(p).convert('RGB')
    return manifest,pieces,backgrounds

# Shared poses inherited from prior real-material comparison. Arbitrary starter
# arrangement for QA, not a 'correct' therapeutic or aesthetic composition.
from pathlib import Path as _P
import importlib.util
legacy=_P(__file__).resolve().parent/'moonjar_craft_helpers.py'
spec=importlib.util.spec_from_file_location('legacy_review',legacy)
legacy_review=importlib.util.module_from_spec(spec);sys.modules['legacy_review']=legacy_review;spec.loader.exec_module(legacy_review)
ids_for_count=legacy_review.ids_for_count
positions=legacy_review.positions
prepare_node=legacy_review.prepare_node


def mask_data():
    p=Path(__file__).resolve().parent/'render-moonjar-wave94.py'
    spec2=importlib.util.spec_from_file_location('w94geom',p)
    m=importlib.util.module_from_spec(spec2);sys.modules['w94geom']=m;spec2.loader.exec_module(m)
    mask=np.uint8(m.porcelain_mask()*255)
    rows=mask>150
    left=np.zeros(H,np.float32);right=np.ones(H,np.float32)*W
    for y in range(H):
        xs=np.flatnonzero(rows[y]);
        if len(xs):left[y]=xs[0];right[y]=xs[-1]
    return mask,left,right


def limit_box(x,y,w,h):
    x0,y0=round(x),round(y);x1=x0+w;y1=y0+h
    left=max(0,-x0);top=max(0,-y0);right=max(0,x1-W);bot=max(0,y1-H)
    if left+right>=w or top+bot>=h:return None
    return (max(0,x0),max(0,y0),min(W,x1),min(H,y1)),(left,top,w-right,h-bot)


def outward_shadow(stage,x,y,alpha,mask,theme,soft=8,offset=4,opacity=0.33):
    """Subtle contact occlusion from actual alpha, only under the jar."""
    h,w=alpha.shape[:2]
    box=limit_box(x,y,w,h)
    if not box:return
    dest,src=box;dx0,dy0,dx1,dy1=dest; sx0,sy0,sx1,sy1=src
    a=alpha[sy0:sy1,sx0:sx1].astype(np.float32)/255
    # Dilate on source region, shift 2px right + 3px down then blur.
    blurred=cv2.GaussianBlur(a,(0,0),soft)
    blurred=np.roll(blurred,offset,axis=1);blurred=np.roll(blurred,offset//2,axis=0)
    contact=np.clip(blurred-a,0,1)*(mask[dy0:dy1,dx0:dx1]/255)
    if np.max(contact)<.004:return
    patch=np.asarray(stage.crop(dest).convert('RGB'),dtype=np.float32)
    shade=np.array([47,45,39] if theme=='day' else [14,20,21],dtype=np.float32)
    k=(contact*opacity)[:,:,None]
    patch=patch*(1-k)+shade*k
    stage.paste(Image.fromarray(np.uint8(np.clip(patch,0,255)),'RGB'),(dx0,dy0))


def sphere_warp(sprite,node,left,right):
    """Shallow cylindrical perspective deformation only if center inside jar.

    No physically correct projection claim. Preserve alpha and off-jar pixels by
    restricting this to pieces whose centers are comfortably inside the vessel.
    """
    cx,cy=node['x'],node['y'];row=min(H-1,max(0,int(cy)))
    radius=max(1,(right[row]-left[row])/2);xcenter=(right[row]+left[row])/2
    relative=abs(cx-xcenter)/radius
    if relative>=.81 or cy<338 or cy>1490:return sprite
    # Compression grows toward contour; subtle enough to avoid geometric damage.
    compression=1-0.19*(relative**1.3)
    if compression>.985:return sprite
    neww=max(1,int(round(sprite.width*compression)))
    return sprite.resize((neww,sprite.height),Image.Resampling.BICUBIC)


def apply_reflected_light(sprite,node,theme,left,right):
    arr=np.asarray(sprite.convert('RGBA'),dtype=np.float32)
    h,w=arr.shape[:2];yy,xx=np.mgrid[:h,:w].astype(np.float32)
    row=np.clip(int(node['y']),0,H-1)
    frac=(node['x']-(right[row]+left[row])/2)/max(1,(right[row]-left[row])/2)
    # white diffuse glaze & direction-sensitive nacre brightness along top left
    u=(xx+.5)/max(1,w);v=(yy+.5)/max(1,h)
    streak=np.exp(-((u-.28)/.34)**2-((v-.24)/.65)**2)
    shade=2.7*streak-3.3*u-1.3*frac+1.5*np.sin((u*.9-v*.48)*math.pi)
    # Subtle blue-magenta shift, static tonal approximation. Original alpha intact.
    arr[:,:,0]=np.clip(arr[:,:,0]+shade+.7*streak,0,255)
    arr[:,:,1]=np.clip(arr[:,:,1]+shade*.82,0,255)
    arr[:,:,2]=np.clip(arr[:,:,2]+shade*1.14,0,255)
    return Image.fromarray(np.uint8(np.round(arr)),'RGBA')


def render_art(theme,count,pieces,backgrounds,mask,left,right):
    """A-only quiet porcelain presentation; no paper mats, pasted collage
    ornaments, preselected narrative symbols, or artificial craft claims."""
    background=backgrounds[theme].convert('RGB')
    if theme=='night':
        # Local neutralization is constrained to clay pixels. The owner's
        # untouched, individually SHA-checked nacre pieces stay independent.
        srcarr=np.asarray(background,dtype=np.float32)
        gray=srcarr.mean(axis=2,keepdims=True)
        tuned=np.clip(srcarr*.45+gray*.55+np.array([7.,0.,-9.],np.float32),0,255)
        a=(mask.astype(np.float32)/255)[:,:,None]
        background=Image.fromarray(np.uint8(np.clip(srcarr*(1-a)+tuned*a,0,255)),'RGB')
    canvas=background.copy()
    nodes=positions(ids_for_count(count),count)
    for node in nodes:
        src=pieces[node['id']]
        sprite=prepare_node(src,node['max_size'],node['angle']).convert('RGBA')
        sprite=sphere_warp(sprite,node,left,right)
        sprite=apply_reflected_light(sprite,node,theme,left,right)
        xx=round(node['x']-sprite.width/2); yy=round(node['y']-sprite.height/2)
        outward_shadow(canvas,xx,yy,np.asarray(sprite)[:,:,3],mask,theme,soft=2.7,opacity=.13)
        canvas.paste(sprite,(xx,yy),sprite)
    return canvas,nodes


def archive_card(art,theme):
    """Opt-in sample card with placeholder title; no private records."""
    cw,ch=1600,2400
    ink='#33403B' if theme=='day' else '#EAE5DB'
    ground='#F1EDE5' if theme=='day' else '#202B2C'
    card=Image.new('RGB',(cw,ch),ground);d=ImageDraw.Draw(card)
    for y,txt,s,b in [(170,'ATELIER  /  MOONJAR',29,False),
                      (300,'빛을 놓는 자리',105,True),
                      (485,'A personal artwork / sample title only',27,False)]:
        d.text((130,y),txt,font=font(s,b),fill=ink)
    artwork=art[theme,8].resize((1190,1339),Image.Resampling.LANCZOS)
    card.paste(artwork,(205,628))
    d.line((130,2140,1470,2140),fill=ink,width=2)
    d.text((130,2180),'빛을 담는 달항아리    ·    DAILYCOACHING',font=font(27),fill=ink)
    d.text((130,2240),'Concept sample: private coaching notes excluded.',font=font(20),fill=ink)
    card.save(HERE/'cards'/f'craft-{theme}-art-card.png',optimize=True)


def main():
    for directory in ['artwork','cards','thumbs']:
        (HERE/directory).mkdir(exist_ok=True,parents=True)
    manifest,pieces,backgrounds=load()
    mask,left,right=mask_data()
    saved={}; checksum=[]
    for theme in ('day','night'):
        for count in (0,1,8,48,96):
            print('CRAFT RENDER',theme,count,flush=True)
            artwork,nodes=render_art(theme,count,pieces,backgrounds,mask,left,right)
            output=HERE/'artwork'/f'craft-{theme}-{count:02d}.png'
            artwork.save(output,optimize=True,compress_level=6)
            if count==8:
                saved[theme,8]=artwork
                artwork.resize((440,495),Image.Resampling.LANCZOS).save(
                    HERE/'thumbs'/f'craft-{theme}.webp','WEBP',quality=88,method=5)
            checksum.append({'direction':'tactile-craft','theme':theme,'nacre':count,
                             'sha256':sha(output),'nodes':len(nodes)})
    for theme in ('day','night'):archive_card(saved,theme)
    metadata={'version':'wave9.5-craft-only','coordinateSystem':[W,H],
              'sourceNacreCount':len(pieces),
              'originalNacreSHA256':{x['id']:x['sha256'] for x in manifest['pieces']},
              'productionIntegrated':False,'artistReviewRequired':True,
              'activeArtDirection':'tactile-craft','renders':checksum,
              'outputWarning':'Offline concept only; no live canvas, project JSON or print renderer changed.'}
    (HERE/'QUALITY_MANIFEST.json').write_text(
        json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('A-ONLY CRAFT STUDY COMPLETE',len(checksum),'scenes, 2 cards',flush=True)


if __name__=='__main__':main()
