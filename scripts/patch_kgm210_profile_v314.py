from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "tests" / "kgm210" / "index.html"
UI = ROOT / "tests" / "kgm210" / "kgm210-profile-ui-v314.js"

CSS_TAG = '<link rel="stylesheet" href="./kgm210-profile-v314.css" data-kgm-profile-v314="style">'
ENGINE_TAG = '<script src="./kgm210-profile-engine-v314.js" data-kgm-profile-v314="engine"></script>'
UI_TAG = '<script src="./kgm210-profile-ui-v314.js" data-kgm-profile-v314="ui"></script>'

OLD_DOMAIN_PREFIX = "function domainDetailsHtml(profile,{saved=false}={}){const openKeys=profile.kind==='profile'?[profile.primary.key,profile.focus.key]:[];return `<section id=\"profileDetailsV314\" class=\"profileDetailsV314 ${saved?'saved':''}\" data-profile-code=\"${esc(profile.profileCode)}\">"
NEW_DOMAIN_PREFIX = "function domainDetailsHtml(profile,{saved=false}={}){const openKeys=profile.kind==='profile'?[profile.primary.key,profile.focus.key]:[];const signature=profile.domains.map(d=>`${d.key}:${num(d.avg).toFixed(2)}`).join('|');return `<section id=\"${saved?'savedProfileDetailsV314':'profileDetailsV314'}\" class=\"profileDetailsV314 ${saved?'saved':''}\" data-profile-code=\"${esc(profile.profileCode)}\" data-profile-signature=\"${esc(signature)}\">"

OLD_ENSURE = "function ensureDomainDetails(profile){const hero=by('resultHero13a');if(!hero)return;let section=by('profileDetailsV314');if(!section){hero.insertAdjacentHTML('afterend',domainDetailsHtml(profile));section=by('profileDetailsV314');}else if(section.dataset.profileCode!==profile.profileCode){section.outerHTML=domainDetailsHtml(profile);}}"
NEW_ENSURE = "function ensureDomainDetails(profile){const hero=by('resultHero13a');if(!hero)return;let section=by('profileDetailsV314');if(!section){hero.insertAdjacentHTML('afterend',domainDetailsHtml(profile));section=by('profileDetailsV314');}else{const signature=profile.domains.map(d=>`${d.key}:${num(d.avg).toFixed(2)}`).join('|');if(section.dataset.profileCode!==profile.profileCode||section.dataset.profileSignature!==signature){section.outerHTML=domainDetailsHtml(profile);}}}"


def patch_index() -> bool:
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
        return True
    return False


def patch_ui() -> bool:
    text = UI.read_text(encoding="utf-8")
    original = text

    if OLD_DOMAIN_PREFIX in text:
        text = text.replace(OLD_DOMAIN_PREFIX, NEW_DOMAIN_PREFIX, 1)
    elif "savedProfileDetailsV314" not in text:
        raise RuntimeError("UI의 영역 해설 렌더러를 찾지 못했습니다.")

    if OLD_ENSURE in text:
        text = text.replace(OLD_ENSURE, NEW_ENSURE, 1)
    elif "dataset.profileSignature" not in text:
        raise RuntimeError("UI의 영역 해설 갱신 함수를 찾지 못했습니다.")

    if text != original:
        UI.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = []
    if patch_index():
        changed.append("tests/kgm210/index.html")
    if patch_ui():
        changed.append("tests/kgm210/kgm210-profile-ui-v314.js")

    if changed:
        print("patched: " + ", ".join(changed))
    else:
        print("KGM210 profile v3.14 assets already up to date")


if __name__ == "__main__":
    main()
