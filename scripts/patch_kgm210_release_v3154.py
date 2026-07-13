from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "tests" / "kgm210" / "index.html"
PROFILE_UI = ROOT / "tests" / "kgm210" / "kgm210-profile-ui-v314.js"

TITLE_OLD = "KGM210 성장검사 · 유형매핑·7주여정 v3.15 개발판"
TITLE_NEW = "KGM210 성장검사 · 유형매핑·7주여정 v3.15.4 운영판"
RESULT_TITLE_OLD = "KGM210 성장검사 · 유형매핑 v3.14"
RESULT_TITLE_NEW = "KGM210 성장검사 · 유형매핑·7주여정 v3.15.4"

PROTECTED = {
    "기존 7일 기록": "__KGM_LEGACY_SEVEN_DAY_RECORD__",
    "이전 7일 기록": "__KGM_PREVIOUS_SEVEN_DAY_RECORD__",
}

REPLACEMENTS = [
    ("7일 성장기록", "7주 성장여정"),
    ("7일 기록 시작", "7주 성장여정 시작"),
    ("오늘 기록하기", "이번 주 기록하기"),
    ("7일 동안", "7주 동안"),
    ("7일 완료", "7주 성장통합"),
    ("7일 기록", "7주 성장여정"),
]


def patch_index() -> bool:
    text = INDEX.read_text(encoding="utf-8")
    original = text

    if TITLE_OLD in text:
        text = text.replace(TITLE_OLD, TITLE_NEW, 1)
    elif TITLE_NEW not in text:
        raise RuntimeError("KGM210 문서 제목 기준 문자열을 찾지 못했습니다.")

    for phrase, token in PROTECTED.items():
        text = text.replace(phrase, token)

    for before, after in REPLACEMENTS:
        text = text.replace(before, after)

    for phrase, token in PROTECTED.items():
        text = text.replace(token, phrase)

    if "### 7일 성장기록" in text:
        raise RuntimeError("정적 결과지에 7일 성장기록 제목이 남아 있습니다.")

    if text != original:
        INDEX.write_text(text, encoding="utf-8")
        return True
    return False


def patch_profile_ui() -> bool:
    text = PROFILE_UI.read_text(encoding="utf-8")
    original = text

    if RESULT_TITLE_OLD in text:
        text = text.replace(RESULT_TITLE_OLD, RESULT_TITLE_NEW, 1)
    elif RESULT_TITLE_NEW not in text:
        raise RuntimeError("결과 화면 document.title 기준 문자열을 찾지 못했습니다.")

    if text != original:
        PROFILE_UI.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = []
    if patch_index():
        changed.append(str(INDEX.relative_to(ROOT)))
    if patch_profile_ui():
        changed.append(str(PROFILE_UI.relative_to(ROOT)))

    if changed:
        print("patched: " + ", ".join(changed))
    else:
        print("KGM210 v3.15.4 release wording already applied")


if __name__ == "__main__":
    main()
