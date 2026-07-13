from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "tests" / "kgm210" / "index.html"

CSS_TAG = '<link rel="stylesheet" href="./kgm210-profile-v314.css" data-kgm-profile-v314="style">'
ENGINE_TAG = '<script src="./kgm210-profile-engine-v314.js" data-kgm-profile-v314="engine"></script>'
UI_TAG = '<script src="./kgm210-profile-ui-v314.js" data-kgm-profile-v314="ui"></script>'


def main() -> None:
    text = INDEX.read_text(encoding="utf-8")
    original = text

    if 'data-kgm-profile-v314="style"' not in text:
        if "</head>" not in text:
            raise RuntimeError("index.html에 </head>가 없습니다.")
        text = text.replace("</head>", f" {CSS_TAG}\n</head>", 1)

    if 'data-kgm-profile-v314="engine"' not in text:
        if "</body>" not in text:
            raise RuntimeError("index.html에 </body>가 없습니다.")
        text = text.replace("</body>", f"{ENGINE_TAG}\n{UI_TAG}\n</body>", 1)

    if "KGM210 성장검사 · v3.13e 배포준비판" in text:
        text = text.replace(
            "KGM210 성장검사 · v3.13e 배포준비판",
            "KGM210 성장검사 · 유형매핑 v3.14 개발판",
            1,
        )

    if text != original:
        INDEX.write_text(text, encoding="utf-8")
        print("patched tests/kgm210/index.html for profile v3.14")
    else:
        print("profile v3.14 tags already present; no changes")


if __name__ == "__main__":
    main()
