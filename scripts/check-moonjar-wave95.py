#!/usr/bin/env python3
"""Deterministic local review acceptance: actual inputs, output files and free placement."""
from pathlib import Path
import sys, json, hashlib, re
import numpy as np
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parent))
import importlib.util
_this_dir=Path(__file__).resolve().parent
_renderer=(_this_dir/'build_wave95.py') if (_this_dir/'build_wave95.py').exists() else (_this_dir/'render-moonjar-wave95.py')
_spec=importlib.util.spec_from_file_location('moonjar_w95_renderer',_renderer)
b=importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(b)
ROOT=b.HERE
meta=json.loads((ROOT/'QUALITY_MANIFEST.json').read_text())
manifest,pieces,bgs=b.load()
assert len(pieces)==96, len(pieces)
assert all(b.sha(b.SRC/'activities/moonjar'/piece['src'])==piece['sha256'] for piece in manifest['pieces'])
assert len(meta['renders'])==20
assert set(r['nacre'] for r in meta['renders'])=={0,1,8,48,96}
assert set(r['style'] for r in meta['renders'])=={'A','B'}
assert set(r['theme'] for r in meta['renders'])=={'day','night'}
for r in meta['renders']:
    path=ROOT/'artwork'/f"{r['style']}-{r['theme']}-{r['nacre']:02d}.png"
    assert path.exists() and b.sha(path)==r['sha256'], path
    with Image.open(path) as image:
        assert image.size==(1600,1800) and image.mode=='RGB', path
for style in 'AB':
    for theme in ['day','night']:
        with Image.open(ROOT/'cards'/f'{style}-{theme}-art-card.png') as image:
            assert image.size==(1600,2400)
        assert (ROOT/'thumbs'/f'{style}-{theme}.webp').exists()
assert meta['productionIntegrated'] is False
mask,_,_=b.mask_data()
outside=(mask<5)
for style in 'AB':
    for theme in ['day','night']:
        bg=np.asarray(Image.open(ROOT/'artwork'/f'{style}-{theme}-00.png').convert('RGB'))
        art=np.asarray(Image.open(ROOT/'artwork'/f'{style}-{theme}-96.png').convert('RGB'))
        changed=np.any(bg[outside]!=art[outside],axis=1)
        assert changed.sum()>200, (style,theme,changed.sum())
        print('OUTSIDE-JAR FREEDOM',style,theme,int(changed.sum()),'changed pixels')
html=(ROOT/'index.html').read_text()
assert 'https://' not in html and '<script src=' not in html
assert 'data-theme' in html and 'data-n' in html and 'aria-label' in html
# Pixel-wise deterministic reproduction of two focal samples.
for style,theme,count in [('A','day',8),('B','night',8)]:
    scene,_=b.render_art(theme,style,count,pieces,bgs,*b.mask_data())
    original=np.asarray(Image.open(ROOT/'artwork'/f'{style}-{theme}-{count:02d}.png').convert('RGB'))
    assert np.array_equal(np.asarray(scene),original), 'Non-deterministic art: '+style+' '+theme
    print('REPRODUCED',style,theme,count)
print('WAVE 9.5 QA PASS: 96 source SHA, 20 art files, 4 cards, 4 non-clipped outside-jar cases, 2 pixel-exact renders')