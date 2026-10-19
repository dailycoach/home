#!/usr/bin/env python3
"""Assemble an isolated full working Moonjar app with optional A craft study.

The GitHub PR contains only source code and study controls. This builder
copies deterministic W9.4 porcelain PNGs to a private CI checkout before
browser verification and produces a complete static preview ZIP artifact.

Never edits the original manifest, existing backgrounds, user JSON, IndexedDB,
or any deployed GitHub Pages file on main.
"""
from __future__ import annotations
import hashlib,json,shutil,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'activities/moonjar'
STUDY=ROOT/'artifacts/moonjar-wave94/study'
TARGET=SRC/'assets/moonjar-a-study'
OUT=ROOT/'artifacts/moonjar-wave97-preview'
EXPECTED={
 'day':'7a3221962cad4f4dda870efd5228da2c8e763ad06ff226ea543ddbc448ceb674',
 'night':'3ee24ef9e940577a9c9390abfe886f155794e1dad187a8e9c7535b61081faa1d'
}
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    assert not TARGET.exists(),'Study assets must not already be committed to product sources'
    TARGET.mkdir(parents=True)
    backgrounds={}
    try:
        for kind in ('day','night'):
            path=STUDY/f'porcelain-{kind}.png'
            if not path.exists():raise FileNotFoundError(f'Missing isolated W9.4 source: {path}')
            signature=digest(path)
            if signature!=EXPECTED[kind]:
                raise AssertionError(f'Unexpected porcelain checksum {kind}: {signature}')
            dest=TARGET/path.name
            shutil.copy2(path,dest)
            backgrounds[kind]={'path':f'activities/moonjar/assets/moonjar-a-study/porcelain-{kind}.png',
                               'sha256':signature,'size':dest.stat().st_size}
        APP=OUT/'site/activities/moonjar'
        shutil.copytree(SRC,APP,dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns('__pycache__','.DS_Store'))
        # Reuse the local OFL display font via the existing CSS absolute URL.
        font=ROOT/'programs/art-psychology-coaching/assets/fonts/gowun-batang-700.woff2'
        if font.exists():
            target=OUT/'site/programs/art-psychology-coaching/assets/fonts'
            target.mkdir(parents=True,exist_ok=True)
            shutil.copy2(font,target/font.name)
        readme='''# 달항아리 A형 W9.7 실제 편집기 검토

이 폴더는 제품 운영 사이트가 아닌 별도 미술 연구용 정적 웹앱입니다.

1. 이 README 파일이 있는 폴더에서 터미널을 엽니다.
2. `python3 -m http.server 8000 --directory site` 명령으로 로컬 서버를 실행합니다.
3. 브라우저에서 http://127.0.0.1:8000/activities/moonjar/?artStudy=craft-a 를 엽니다.
4. "자개로 마음껏 꾸미기" → 조각 배치 → "A형 공예 미술 시안"을 선택합니다.
5. 같은 작품의 원본·A형 시안·A형 아트카드를 감상하고, 원할 때만 PNG를 저장합니다.

일반 URL http://127.0.0.1:8000/activities/moonjar/ 은 기존 작품을 변경하지 않은
평소 편집기 화면을 표시합니다. A형 시안 플래그는 URL에만 있습니다.
사용자의 작품, 감정 기록 및 조각 이미지를 별도 서버로 전송하지 않습니다.

이 연구용 앱은 웹 편집 중 A형 효과를 영구적으로 사용하지 않습니다.
미술 시안 보기/이미지 보관/카드에만 A형 재렌더링을 적용합니다.
W9.5 Python 연구 출력과 완전히 일치하는 엔진 또는 실제 PBR이 아닙니다.
같은 A형 캔버스 렌더링에서 미리보기 PNG와 저장 PNG는 바이트까지 같습니다.
실제 사람/실물 휴대전화 검증과 상용 미술 승인 전까지 운영용으로 배포하지 마세요.
'''
        (OUT/'README_KO.md').write_text(readme,encoding='utf-8')
        report={'version':'W9.7-A-EDITOR-STUDY','assetStudy':backgrounds,
                'mode':'runtime query only', 'productionIntegrated':False,
                'manifestChanged':False,'schemaChanged':False,
                'engine':'same Canvas A-only raster for dialog and PNG; same PNG embedded in archive card',
                'artStudyQuery':'?artStudy=craft-a'}
        (OUT/'study-assets.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print('W9.7 STUDY ASSEMBLED PASS',json.dumps(backgrounds,ensure_ascii=False))
    except Exception:
        shutil.rmtree(TARGET,ignore_errors=True)
        raise
if __name__=='__main__':main()
