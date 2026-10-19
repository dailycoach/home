#!/usr/bin/env python3
"""WAVE 9.6 — Offline self-contained A-only museum-style pilot package.

This is NOT part of the Moonjar production renderer. It reuses existing
unmodified, QA-verified A-only concept PNGs, stores losslessly encoded pixels
in a local JS data file, and enables safe file:// canvas exports offline.
No API calls, no personal data collection and no changes to artwork sources.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image, ImageChops

REPO=Path(__file__).resolve().parents[1]
SCENES=(0,1,8,48,96)
THEMES=('day','night')

def digest(path: Path)->str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def produce(source: Path, destination: Path):
    destination.mkdir(parents=True, exist_ok=True)
    records={};checks={}
    for theme in THEMES:
        for count in SCENES:
            key=f'craft-{theme}-{count:02d}'
            original=source/f'{key}.png'
            if not original.is_file():
                raise FileNotFoundError(f'Original craft scene missing: {original}')
            with Image.open(original) as raw:
                image=raw.convert('RGB')
                if image.size!=(1600,1800):
                    raise ValueError('Incorrect scene dimensions: '+str(original))
                temp=destination/f'{key}.webp'
                image.save(temp,'WEBP',lossless=True,method=6)
                with Image.open(temp) as decoded:
                    difference=ImageChops.difference(image,decoded.convert('RGB'))
                    if difference.getbbox():
                        raise AssertionError('WebP is NOT pixel-perfect: '+key)
                encoded=base64.b64encode(temp.read_bytes()).decode('ascii')
            records[key]='data:image/webp;base64,'+encoded
            checks[key]={'originalPngSHA256':digest(original),
                         'offlineWebpSHA256':digest(temp),
                         'dimensions':[1600,1800],'pixelPerfectWebP':True}
            temp.unlink()  # The complete file:// capable payload is in art-data.js
    artwork={'version':'wave9.6-A-only','artwork':records}
    (destination/'art-data.js').write_text(
        'window.__MOONJAR_A_STUDY__='+json.dumps(
            artwork,ensure_ascii=False,separators=(',',':'))+';\n',
        encoding='utf-8')
    shutil.copyfile(REPO/'design/moonjar-craft/pilot.html',
                    destination/'index.html')
    final={
        'version':'W9.6-A-ARCHIVE-PILOT',
        'artDirection':'A TACTILE CRAFT ONLY',
        'retiredStyles':[],
        'productIntegrated':False,
        'productionDataModified':False,
        'telemetry':False,
        'artCount':len(checks),
        'artwork':checks,
        'dataBundleSha256':digest(destination/'art-data.js'),
        'pilotHtmlSha256':digest(destination/'index.html'),
        'note':'Only offline authentic A-only rendered scenes. No B concept, no remote collection. No physical users have been tested.'
    }
    (destination/'source-qa.json').write_text(
        json.dumps(final,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('A-ONLY OFFLINE PILOT PASS',len(checks),'pixel-identical scene assets',
          f"{(destination/'art-data.js').stat().st_size/1024/1024:.2f} MiB")
    return final

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=Path,default=REPO/'artifacts/moonjar-craft/artwork')
    parser.add_argument('--out',type=Path,default=REPO/'artifacts/moonjar-craft-pilot')
    args=parser.parse_args()
    produce(args.source,args.out)
