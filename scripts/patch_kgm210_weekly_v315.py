from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "tests" / "kgm210" / "index.html"
PROFILE_ENGINE = ROOT / "tests" / "kgm210" / "kgm210-profile-engine-v314.js"

CSS_TAG = '<link rel="stylesheet" href="./kgm210-weekly-journey-v315.css" data-kgm-weekly-v315="style">'
ENGINE_TAG = '<script src="./kgm210-weekly-journey-engine-v315.js" data-kgm-weekly-v315="engine"></script>'
UI_TAG = '<script src="./kgm210-weekly-journey-ui-v315.js" data-kgm-weekly-v315="ui"></script>'
QA_CSS_TAG = '<link rel="stylesheet" href="./kgm210-weekly-journey-qa-v3151.css" data-kgm-weekly-qa-v3151="style">'
QA_JS_TAG = '<script src="./kgm210-weekly-journey-qa-v3151.js" data-kgm-weekly-qa-v3151="script"></script>'


def main() -> None:
    text = INDEX.read_text(encoding="utf-8")
    original = text
    bootstrap_active = PROFILE_ENGINE.exists() and "KGM_WEEKLY_V315_BOOTSTRAP" in PROFILE_ENGINE.read_text(encoding="utf-8")

    if not bootstrap_active:
        if 'data-kgm-weekly-v315="style"' not in text:
            if "</head>" not in text:
                raise RuntimeError("index.html에 </head>가 없습니다.")
            text = text.replace("</head>", f" {CSS_TAG}\n</head>", 1)

        if 'data-kgm-weekly-v315="engine"' not in text:
            if "</body>" not in text:
                raise RuntimeError("index.html에 </body>가 없습니다.")
            text = text.replace("</body>", f"{ENGINE_TAG}\n{UI_TAG}\n</body>", 1)

    if 'data-kgm-weekly-qa-v3151="style"' not in text:
        if "</head>" not in text:
            raise RuntimeError("index.html에 </head>가 없습니다.")
        text = text.replace("</head>", f" {QA_CSS_TAG}\n</head>", 1)

    if 'data-kgm-weekly-qa-v3151="script"' not in text:
        if "</body>" not in text:
            raise RuntimeError("index.html에 </body>가 없습니다.")
        text = text.replace("</body>", f"{QA_JS_TAG}\n</body>", 1)

    if "KGM210 성장검사 · 유형매핑 v3.14 개발판" in text:
        text = text.replace(
            "KGM210 성장검사 · 유형매핑 v3.14 개발판",
            "KGM210 성장검사 · 유형매핑·7주여정 v3.15 개발판",
            1,
        )

    if text != original:
        INDEX.write_text(text, encoding="utf-8")
        print("patched tests/kgm210/index.html for seven-week journey v3.15.1")
    elif bootstrap_active:
        print("seven-week journey v3.15 loads through bootstrap; QA assets already present")
    else:
        print("seven-week journey v3.15.1 tags already present; no changes")


if __name__ == "__main__":
    main()
