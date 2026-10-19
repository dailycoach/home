#!/usr/bin/env python3
"""DAILYCOACHING Moonjar WAVE9.5: two non-destructive artistic render proposals.

A: tactile 2.5D porcelain/craft impression (NOT physical PBR).
B: intentional museum/editorial hanji collage, not a fake craft simulation.

Original 96 PNG images are loaded without modification, SHA256 checked against
manifest, with original coordinate-space transforms shared across both styles.
Neither proposal modifies product files or archived user projects.
The look belongs to the renderer, not permanently to original nacre bitmaps.
"""
from __future__ import annotations
import hashlib, json, math, os, sys, statistics
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import cv2
import numpy as np

_SCRIPT_DIR=Path(__file__).resolve().parent
_IS_PACKAGE=(_SCRIPT_DIR/'legacy_review_moonjar_wave93.py').exists()
_REPO_ROOT=_SCRIPT_DIR.parent
HERE=_REPO_ROOT if _IS_PACKAGE else _REPO_ROOT/'artifacts/moonjar-wave95'
SRC=HERE/'sources' if _IS_PACKAGE else _REPO_ROOT
BASE=HERE/'sources'/'baselines' if _IS_PACKAGE else _REPO_ROOT/'artifacts/moonjar-wave94/study' 
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
legacy=_P(__file__).resolve().parent/'moonjar_wave95_helpers.py'
spec=importlib.util.spec_from_file_location('legacy_review',legacy)
legacy_review=importlib.util.module_from_spec(spec);sys.modules['legacy_review']=legacy_review;spec.loader.exec_module(legacy_review)
ids_for_count=legacy_review.ids_for_count
positions=legacy_review.positions
prepare_node=legacy_review.prepare_node


def mask_data():
    p=Path(__file__).resolve().parent/('build_wave94.py' if _IS_PACKAGE else 'render-moonjar-wave94.py')
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


def paper_background(base,theme,mask):
    # A genuinely distinct authored composition: a cut-paper vessel in an
    # asymmetrical exhibition-space colour field, rather than random glitter.
    rng=np.random.default_rng(9501 if theme=='day' else 9502)
    is_day=theme=='day'
    basecolor=np.array([236,230,218] if is_day else [32,43,49],np.float32)
    h,w=H,W
    low=cv2.resize(rng.normal(size=(59,45)).astype('float32'),(w,h),interpolation=cv2.INTER_CUBIC)
    fine=cv2.resize(rng.normal(size=(390,355)).astype('float32'),(w,h),interpolation=cv2.INTER_LINEAR)
    yy=np.arange(h,dtype=np.float32)[:,None];xx=np.arange(w,dtype=np.float32)[None,:]
    fibre=np.sin(xx*.11+np.sin(yy*.013)*.9)*.52+np.sin(yy*.15+xx*.004)*.28
    paper=np.clip(basecolor[None,None,:]+low[:,:,None]*2.0+fine[:,:,None]*.69+fibre[:,:,None],0,255).astype('uint8')
    bg=Image.fromarray(paper,'RGB').convert('RGBA')
    d=ImageDraw.Draw(bg,'RGBA')
    ink=(36,53,52) if is_day else (194,198,179)
    # Offset circular lunar 'ink press', placed behind the jar and translucent.
    d.ellipse((115,202,1455,1552),outline=(*ink,36),width=3)
    d.arc((60,110,1450,1470),206,350,fill=(*ink,60),width=9)
    d.arc((115,220,1475,1600),35,130,fill=(*ink,42),width=4)
    # A single large hand-torn indigo paper slip far behind porcelain left edge.
    # This is intentionally visible; the source vessel's shape is never changed.
    points=[]
    for t in range(70):
        y=385+int(t*15.2)
        edge=320+int(22*math.sin(t*.23)+8*math.sin(t*1.38))
        points.append((edge,y))
    for t in reversed(range(70)):
        y=385+int(t*15.2)
        edge=415+int(25*math.sin(t*.20+.7)+7*math.sin(t*1.7))
        points.append((edge,y))
    inkpaper=(48,69,70,65) if is_day else (188,179,146,42)
    d.polygon(points,fill=inkpaper)
    # Ragged paper collage ground deckle edges as a separate material.
    torn=[]
    for x in range(-25, W+35,12):
        torn.append((x,1589+int(9*math.sin(x*.043)+3*math.sin(x*.26))))
    torn += [(W+20,H),(-20,H)]
    d.polygon(torn,fill=(215,205,188,74) if is_day else (19,25,28,85))
    # Backing pearl-white cutout: the exact same historic working silhouette,
    # with a soft 3D offset shadow rather than a new invented moonjar outline.
    arr=np.asarray(base.convert('RGB'),dtype=np.float32)
    paperarr=np.asarray(bg.convert('RGB'),dtype=np.float32)
    # Lighten source porcelain only slightly and give it a matte paper surface.
    clay=np.clip(arr*(.88 if is_day else .87)+np.array([29,27,21] if is_day else [34,19,11]),0,255)
    # Edge relief from dilation, subtle and directional.
    shadow=cv2.GaussianBlur(mask,(0,0),11)/255
    shadow=np.roll(np.roll(shadow,12,axis=0),12,axis=1)
    shadow=np.maximum(shadow-mask.astype(float)/255,0)
    paperarr-=shadow[:,:,None]*(21 if is_day else 18)
    alpha=(mask.astype(np.float32)/255)[:,:,None]
    paperarr=paperarr*(1-alpha)+clay*alpha
    out=Image.fromarray(np.uint8(np.clip(paperarr,0,255)),'RGB').convert('RGBA')
    d=ImageDraw.Draw(out,'RGBA')
    # Distinctly contemporary composition: one fine oxblood register, a blue
    # under-glaze brush flick on the left, and two asymmetrical ink strokes.
    cobalt=(35,75,96,79) if is_day else (153,176,176,92)
    d.arc((180,330,1430,1650),199,270,fill=cobalt,width=7)
    d.arc((200,270,1380,1590),19,67,fill=cobalt,width=6)
    rust=(157,89,74,92) if is_day else (188,135,104,82)
    d.line([(1350,460),(1379,490),(1368,525)],fill=rust,width=7,joint='curve')
    # Quiet typeset study marks / print registration are deliberately placed
    # on background margins, not on the participant's actual nacre pixels.
    # Participant's artwork has no compulsory words or psychological labels.
    # Typography belongs only on an optional, separately created art card.
    return out


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


def irregular_mat(sprite,node,theme,count,index):
    """Ragged hanji backing beneath the unchanged source nacre.

    Small placement-dependent cut-paper mat is a DIFFERENT artistic medium,
    not presented as actual nacre glued to white porcelain.
    """
    arr=np.asarray(sprite.convert('RGBA'))
    alpha=arr[:,:,3]
    size=min(sprite.size)
    pad=14 if count<=8 else 6 if count<=48 else 4
    ph,pw=alpha.shape
    h,w=ph+2*pad,pw+2*pad
    paper=np.zeros((h,w),np.uint8)
    paper[pad:pad+ph,pad:pad+pw]=alpha
    radius=min(27,max(2,int(min(pw,ph)*(.10 if count<=8 else .07))))
    k=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(radius*2+1,radius*2+1))
    expanded=cv2.dilate(paper,k,iterations=1)
    # deterministic slight deckle/fibre roughness on edges, independent of piece alpha
    rng=np.random.default_rng(95000+index)
    rough=cv2.resize(rng.normal(size=(max(3,h//17),max(3,w//17))).astype('float32'),(w,h),interpolation=cv2.INTER_CUBIC)
    dist=cv2.distanceTransform((expanded>20).astype('uint8'),cv2.DIST_L2,3)
    inside=(dist>np.clip(2+rough*1.1,1,5)).astype('uint8')*255
    return Image.fromarray(inside,'L'),pad


_BG_CACHE={}
def render_art(theme,style,count,pieces,backgrounds,mask,left,right,work=HERE):
    # The same authored background is used across every fragment density.
    key=(theme,style)
    if key not in _BG_CACHE:
        if style=='A':
            background=backgrounds[theme].convert('RGB')
            if theme=='night':
                # Neutralize only the porcelain to protect its white identity,
                # not any original nacre, dark background or customer work.
                srcarr=np.asarray(background,dtype=np.float32)
                gray=srcarr.mean(axis=2,keepdims=True)
                tuned=np.clip(srcarr*.45+gray*.55+np.array([7.,0.,-9.],np.float32),0,255)
                a=(mask.astype(np.float32)/255)[:,:,None]
                background=Image.fromarray(np.uint8(np.clip(srcarr*(1-a)+tuned*a,0,255)),'RGB')
        else:
            background=paper_background(backgrounds[theme],theme,mask).convert('RGB')
        _BG_CACHE[key]=background
    canvas=_BG_CACHE[key].copy()
    nodes=positions(ids_for_count(count),count)
    for i,node in enumerate(nodes):
        src=pieces[node['id']]
        sprite=prepare_node(src,node['max_size'],node['angle']).convert('RGBA')
        if style=='A':
            sprite=sphere_warp(sprite,node,left,right)
            sprite=apply_reflected_light(sprite,node,theme,left,right)
            xx=round(node['x']-sprite.width/2);yy=round(node['y']-sprite.height/2)
            outward_shadow(canvas,xx,yy,np.asarray(sprite)[:,:,3],mask,theme,soft=2.7,opacity=.13)
            canvas.paste(sprite,(xx,yy),sprite)
        else:
            xx=round(node['x']-sprite.width/2);yy=round(node['y']-sprite.height/2)
            mat,pad=irregular_mat(sprite,node,theme,count,i)
            # matte ragged backing creates actual paper-layer hierarchy.
            mx=xx-pad;my=yy-pad
            if count<=8:
                shadow=Image.new('RGBA',mat.size,(10,13,15,0));shadow.putalpha(mat.point(lambda a:int(a*.30)))
                layer=Image.new('RGBA',(W,H),(0,0,0,0));layer.paste(shadow,(mx+5,my+7),shadow);canvas=Image.alpha_composite(canvas.convert('RGBA'),layer).convert('RGB')
            backdrop=(249,246,234,227) if theme=='day' else (223,222,213,235)
            paper_layer=Image.new('RGBA',mat.size,backdrop);paper_layer.putalpha(mat.point(lambda a:int(a*.84)))
            canvas.paste(paper_layer,(mx,my),paper_layer)
            canvas.paste(sprite,(xx,yy),sprite)
    return canvas, nodes


def board(tone,art,outname,description):
    # 2 image columns @ 440x495 => 1000x680, printable design critique board.
    margin=34;gap=24;tw=470;th=529;header=132;footer=88
    w=margin*2+tw*2+gap;h=header+th+footer
    sheet=Image.new('RGB',(w,h),'#ECE8DF');d=ImageDraw.Draw(sheet)
    d.text((margin,20),f'MOONJAR  /  WAVE 9.5   ·   {tone.upper()}',font=font(29,True),fill='#303B35')
    d.text((margin,72),description,font=font(16),fill='#6E776F')
    for i,style in enumerate(['A','B']):
        x=margin+i*(tw+gap)
        img=art[style,tone].resize((tw,th),Image.Resampling.LANCZOS)
        sheet.paste(img,(x,header))
        d.rectangle((x,header,x+tw-1,header+th-1),outline='#B6B0A5',width=2)
        title='A / TACTILE CRAFT' if style=='A' else 'B / EDITORIAL HANJI COLLAGE'
        d.text((x,header+th+12),title,font=font(20,True),fill='#29362F')
        d.text((x,header+th+40),'Two renderers · same original nacre pieces and placements',font=font(13),fill='#626F64')
    sheet.save(HERE/'boards'/outname,optimize=True)


def density_board(art,theme):
    num=[0,8,48,96];tw=310;th=349;gap=14;margin=28;hdr=112;gaprow=62
    w=margin*2+len(num)*tw+(len(num)-1)*gap
    h=hdr+2*(th+gaprow)+40
    sheet=Image.new('RGB',(w,h),'#EEE9DE');d=ImageDraw.Draw(sheet)
    d.text((margin,12),'MOONJAR  /  ART DIRECTION 9.5  ·  '+theme.upper(),font=font(28,True),fill='#303B35')
    d.text((margin,58),'A: craft-impression renderer   /   B: deliberately flat contemporary hanji collage   ·   same original nodes',font=font(15),fill='#6D776D')
    for yindex,style in enumerate(['A','B']):
        y=hdr+yindex*(th+gaprow)
        for idx,n in enumerate(num):
            img=art[style,theme,n].resize((tw,th),Image.Resampling.LANCZOS)
            x=margin+idx*(tw+gap)
            sheet.paste(img,(x,y))
            d.rectangle((x,y,x+tw-1,y+th-1),outline='#BAB1A2',width=1)
            d.text((x,y+th+9),f'{style}   |   {n:02d} ORIGINAL NACRE',font=font(15,True),fill='#344137')
    sheet.save(HERE/'boards'/f'density-{theme}.png',optimize=True)


def archive_card(style,art,theme):
    # This is a design sample with a SAMPLE title, not a user-owned piece.
    # No reflection data is read, inferred or exported.
    cw,ch=1600,2400
    ink='#33403B' if theme=='day' else '#EAE5DB'
    ground='#F1EDE5' if theme=='day' else '#202B2C'
    card=Image.new('RGB',(cw,ch),ground);d=ImageDraw.Draw(card)
    for y,txt,s,b in [(170,'ATELIER  /  MOONJAR',29,False),(300,'빛을 놓는 자리',105,True),
                      (485,'A personal artwork / sample title only',27,False)]:
        d.text((130,y),txt,font=font(s,b),fill=ink)
    artwork=art[style,theme,8].resize((1190,1339),Image.Resampling.LANCZOS)
    card.paste(artwork,(205,628))
    d.line((130,2140,1470,2140),fill=ink,width=2)
    d.text((130,2180),'빛을 담는 달항아리    ·    DAILYCOACHING',font=font(27),fill=ink)
    d.text((130,2240),'This is a concept card; no private notes are included.',font=font(20),fill=ink)
    card.save(HERE/'cards'/f'{style}-{theme}-art-card.png',optimize=True)


def main():
    for s in ['artwork','boards','cards','thumbs','source']: (HERE/s).mkdir(exist_ok=True,parents=True)
    manifest,pieces,backgrounds=load()
    mask,left,right=mask_data()
    saved={};checksum=[]
    for theme in ['day','night']:
        for count in [0,1,8,48,96]:
            for style in ['A','B']:
                print('RENDER',style,theme,count,flush=True)
                p=HERE/'artwork'/f'{style}-{theme}-{count:02d}.png'
                if p.exists() and p.stat().st_size>6000:
                    comp=Image.open(p).convert('RGB')
                    nodes=positions(ids_for_count(count),count)
                    print('  cached',p.name,flush=True)
                else:
                    comp,nodes=render_art(theme,style,count,pieces,backgrounds,mask,left,right)
                    comp.save(p,optimize=True,compress_level=6)
                if count in (0,8,48,96):saved[style,theme,count]=comp
                if count==8:
                    thumb=comp.resize((440,495),Image.Resampling.LANCZOS)
                    thumb.save(HERE/'thumbs'/f'{style}-{theme}.webp','WEBP',quality=88,method=5)
                checksum.append({'style':style,'theme':theme,'nacre':count,'sha256':sha(p),'nodes':len(nodes)})
    for theme in ['day','night']:
        board(theme,{(style,theme):saved[style,theme,8] for style in ['A','B']},f'A-vs-B-{theme}-08.png','Preserved original PNG material · same positions · different artistic intention')
        density_board(saved,theme)
        for style in ['A','B']:archive_card(style,saved,theme)
    meta={'version':'wave9.5-study-only','coordinateSystem':[W,H],
          'sourceNacreCount':len(pieces),'originalNacreSHA256':{x['id']:x['sha256'] for x in manifest['pieces']},
          'productionIntegrated':False,'artistReviewRequired':True,'renders':checksum,
          'renderModes':{'A':'2.5D plausible craft impression, not physically correct shading',
                         'B':'deliberate 2D Korean hanji editorial collage, not traditional lacquer craft'},
          'outputWarning':'Offline concept render only; neither renderer is integrated with the user editor or print/export pipelines.'}
    (HERE/'QUALITY_MANIFEST.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    print('COMPLETE',len(checksum),'scenes, 4 cards',flush=True)

if __name__=='__main__':main()