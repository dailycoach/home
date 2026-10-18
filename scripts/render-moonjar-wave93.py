#!/usr/bin/env python3
"""DAILYCOACHING WAVE9.3 reproducible kiln-matte PNG renderer.

Reads only the original editable vectors at design/moonjar-wave93/.
Writes review artifacts; never modifies published backgrounds, 96 original
nacre PNGs, project data or production code. No external photos.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import re
from pathlib import Path
import numpy as np
import cv2
import cairosvg
from PIL import Image, ImageCms

W, H = 1600, 1800
REPO = Path(__file__).resolve().parents[1]

def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def surface(kind: str, mask: np.ndarray) -> np.ndarray:
    rows = mask > .5
    left = np.zeros((H, 1), dtype=np.float32)
    right = np.zeros((H, 1), dtype=np.float32)
    for y in range(H):
        xs = np.flatnonzero(rows[y])
        left[y] = xs[0] if len(xs) else 0
        right[y] = xs[-1] if len(xs) else 1600
    radius = np.maximum((right-left)/2, 1)
    x = np.arange(W, dtype=np.float32)[None, :]
    y = np.arange(H, dtype=np.float32)[:, None]
    sx = np.clip((x-(left+right)/2)/radius, -1, 1)
    convex = np.sqrt(np.maximum(0, 1-sx*sx))
    shade = 25.5*(.78*convex-.29*sx-.22) - 7.3*np.power(abs(sx), 4)
    shade -= 8*np.clip((y-1080)/480, 0, 1)
    shade += np.exp(-((sx+.51)/.28)**2-((y-650)/380)**2)*5.2
    rng = np.random.default_rng(20261019 if kind == 'day' else 20261020)
    fleck = rng.normal(size=(52, 45)).astype('float32')
    fleck = cv2.resize(fleck, (W, H), interpolation=cv2.INTER_CUBIC)
    fleck = cv2.GaussianBlur(fleck, (0, 0), 5.0)*.85
    slow = rng.normal(size=(18, 14)).astype('float32')
    slow = cv2.resize(slow, (W, H), interpolation=cv2.INTER_CUBIC)
    slow = cv2.GaussianBlur(slow, (0, 0), 13)*.38
    turning = np.sin(y*.052+sx*8.0)*.22*np.exp(-((y-1040)/340)**2)
    shade += fleck+slow+turning
    day = kind == 'day'
    clay = np.array([239., 240., 231.] if day else [212., 233., 229.], dtype=np.float32)
    rgb = clay.reshape(1, 1, 3) + shade[:, :, None]
    if day:
        warmth = np.exp(-((y-1270)/360)**2)*np.clip(convex, 0, 1)*1.8
        rgb[:, :, 0] += warmth
        rgb[:, :, 2] -= warmth*.34
    else:
        cool = np.maximum(sx, 0)*3.3+np.exp(-((y-670)/490)**2)*.8
        rgb[:, :, 2] += cool
        rgb[:, :, 0] -= cool*.12
    return rgb

def render_svg(svg: str, kind: str) -> Image.Image:
    base = Image.open(io.BytesIO(cairosvg.svg2png(
        bytestring=svg.encode('utf8'), output_width=W, output_height=H
    ))).convert('RGB')
    body = re.search(r'<clipPath id="bodyClip"><path d="([^"]+)"', svg)
    if body is None:
        raise ValueError('Study SVG missing original bodyClip')
    mask_svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}">'
        f'<path d="{body.group(1)}" fill="white" /></svg>'
    )
    mask = np.asarray(Image.open(io.BytesIO(cairosvg.svg2png(
        bytestring=mask_svg.encode()
    ))).convert('RGBA'))[:, :, 3].astype('float32')/255
    y = np.arange(H, dtype=np.float32)[:, None]
    feather = np.minimum(np.clip((y-318)/47, 0, 1),
                         np.clip((1512-y)/35, 0, 1))
    weight = mask*feather
    original = np.asarray(base, dtype=np.float32)
    shaded = surface(kind, mask)
    composited = original*(1-weight[:, :, None]) + shaded*weight[:, :, None]
    return Image.fromarray(np.uint8(np.clip(composited, 0, 255)), 'RGB')

def save_png(image: Image.Image, path: Path):
    icc = bytearray(ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes())
    icc[24:36] = bytes.fromhex('07ea000a00130008000c0000')
    image.save(path, 'PNG', icc_profile=bytes(icc), optimize=True, compress_level=9)

def build(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    data = {'version': 'porcelain-v3.1-STUDY-ONLY',
            'dimensions': [W, H],
            'productionIntegrated': False,
            'originalPieceAssetsModified': False,
            'variants': {}}
    for kind in ('day', 'night'):
        svg_path = REPO/'design'/'moonjar-wave93'/f'porcelain-{kind}.svg'
        svg = svg_path.read_text(encoding='utf8')
        assert svg.count('id="bodyClip"') == 1
        assert 'width="1600"' in svg and 'height="1800"' in svg
        (out/svg_path.name).write_text(svg, encoding='utf8')
        image = render_svg(svg, kind)
        png = out/f'porcelain-{kind}.png'
        save_png(image, png)
        image.resize((400, 450), Image.Resampling.LANCZOS).save(
            out/f'preview-{kind}.webp', 'WEBP', quality=93, method=6
        )
        data['variants'][kind] = {
            'png_sha256': sha(png),
            'svg_sha256': sha(out/svg_path.name),
            'pngBytes': png.stat().st_size,
            'source': 'Original vector + reproducible painterly matte glaze'
        }
    (out/'study-manifest.json').write_text(
        json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf8'
    )
    print(json.dumps(data, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, default=Path('artifacts/moonjar-wave93/study'))
    args = parser.parse_args()
    build(args.out)
