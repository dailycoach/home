#!/usr/bin/env python3
"""Independent QA for approved A-only Moonjar art research (not user editor)."""
from __future__ import annotations
from pathlib import Path
import hashlib,importlib.util,json,re,sys
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
SCRIPT=ROOT/'scripts/render-moonjar-craft.py'
spec=importlib.util.spec_from_file_location('moonjar_craft',SCRIPT)
render=importlib.util.module_from_spec(spec)
sys.modules['moonjar_craft']=render
spec.loader.exec_module(render)
ART=render.HERE
assert ART.is_dir()
manifest,pieces,backgrounds=render.load()
assert len(pieces)==96
assert all(render.sha(render.SRC/'activities/moonjar'/p['src'])==p['sha256']
           for p in manifest['pieces'])
meta=json.loads((ART/'QUALITY_MANIFEST.json').read_text())
assert meta['version']=='wave9.5-craft-only'
assert meta['activeArtDirection']=='tactile-craft'
assert meta['productionIntegrated'] is False
assert len(meta['renders'])==10
assert {item['theme'] for item in meta['renders']}=={'day','night'}
assert {item['nacre'] for item in meta['renders']}=={0,1,8,48,96}
assert {item['direction'] for item in meta['renders']}=={'tactile-craft'}
for entry in meta['renders']:
    path=ART/'artwork'/f"craft-{entry['theme']}-{entry['nacre']:02d}.png"
    assert path.is_file(),path
    assert render.sha(path)==entry['sha256']
    with Image.open(path) as im:
        assert im.size==(1600,1800),path
        assert im.mode=='RGB',path
    assert entry['nodes']==entry['nacre'],entry
for theme in ('day','night'):
    with Image.open(ART/'cards'/f'craft-{theme}-art-card.png') as im:
        assert im.size==(1600,2400)
    assert (ART/'thumbs'/f'craft-{theme}.webp').is_file()
assert len(list((ART/'artwork').glob('*.png')))==10
assert len(list((ART/'cards').glob('*.png')))==2

# Ensure original pieces positioned outside the jar remain visible, not clipped.
mask,_,_=render.mask_data()
outside=mask<5
for theme in ('day','night'):
    empty=np.asarray(Image.open(ART/'artwork'/f'craft-{theme}-00.png').convert('RGB'))
    full=np.asarray(Image.open(ART/'artwork'/f'craft-{theme}-96.png').convert('RGB'))
    changed=np.any(empty[outside]!=full[outside],axis=1).sum()
    assert changed>200,(theme,changed)
    print('OFF-JAR FREE PLACEMENT',theme,int(changed),'changed pixels')

# Absent production files here is intentional. Verify gallery has no remote dependencies.
gallery=(ART/'index.html').read_text(encoding='utf-8')
assert 'https://' not in gallery and '<script src=' not in gallery
assert 'data-theme' in gallery and 'data-count' in gallery
assert 'craft-day-' in gallery and 'craft-night-' in gallery
print('MOONJAR A-ONLY QA PASS: 96 immutable original nacre sources, 10 craft scenes, 2 cards, two off-jar freedom checks')
