# THE ATELIER V3.1 · design QA

**Local rendered visual/interaction review: PASS. Work cloud preview: BLOCKED. Final aesthetic approval: reserved for the separate ChatGPT review.**

## Source and capture alignment

- Source visual truth: user-selected central B THE ATELIER panel, `review/v3/reference-B.png`, 499×779 px.
- Source intent: dark craft space, bright original porcelain/nacre, Korean wordmark/serif, one decorate CTA, three secondary destinations. Preserve the real product renderer/assets rather than duplicating the photographic hand/gold/floral composition.
- Baseline: PR #208 head `99c7cda61e84487afdfd02213fe80401a9c7c256`, captured from an unmodified detached worktree.
- Implementation: `review/v3.1/after/`, fourteen required screens per engine. `capture-index.json` records actual CSS viewports and PNG dimensions. deviceScaleFactor=1, no device chrome. Mobile 320×568 / 360×800 / 390×844 / 430×932, plus desktop 1440×900. Additional 768×1024 / 1024×768 / 844×390 regression captures are in the CI artifact.
- States: fresh INTRO/START; identical one-A01 selected editor state; materials; reflection; completion; the exact same original six-piece fixture in ARCHIVE. The legacy fixture is a disposable QA work, never personal data.
- Full-view source and implementation in one comparison input: `review/v3.1/compare-intro-320.png` (opened and reviewed). B is proportionally scaled to 320×500 and letterboxed. It is not stretched or claimed to establish a 320px source CSS viewport.
- Focused region: `review/v3.1/compare-intro-detail.png`, title/body area cropped from that joint comparison. Additional same-state focused layout evidence: `compare-studio-320.png`, `compare-start-320.png`, `compare-archive-390.png` (all opened/reviewed).
- Cross-screen inspection: `chromium-mobile-overview.png`, `webkit-mobile-overview.png`, full-size individual mobile images and 1440 INTRO/ATELIER. Contact sheets are for navigation; readable full-size views and the original PNGs underpin review.

## Findings and comparison history

| Earlier finding | Fix | Post-fix evidence |
|---|---|---|
| P1-01: 320 title/body crossed white porcelain and became illegible. | Remove overlapping absolute mobile hero layout. Copy and real SVG occupy independent grid tracks on ink black. | compare-intro-320 / compare-intro-detail; both engines at all four phone sizes. Actual glyph ranges never intersect the artwork frame. CTA and destinations stay in view. |
| P1-02: inspector/header density left ~160px artwork height. | Mobile studio header 52px, compact status/finish row, secondary tools in dialog, compact inspector tabs. | Same selected A01: 142×159.75 → 198×222.75px on 320. Materials also exceed 190px high. Action-by-action real SVG visibility assertions and compare-studio-320. |
| P2-01: START submit was below the 320 initial viewport. | Scrollable choice area inside a form with a separate persistent lower action region; remove only duplicate intro text. | compare-start-320, both engines' START 320/390. All original storage meanings remain visible or scroll-accessible. |
| P2-02: too many simultaneous controls. | Move viewing/mode/snapshot tools to a mobile dialog; preserve the actual outline control by temporary DOM relocation. Move/rotate/size/advanced tabs retain all tools, with undo/redo beside the artwork. | studio-320/390, actual outline toggle/return node identity and advanced actions, all 959 regressions plus new checks. |
| P2-03: disconnected white square and dark chrome. | Restrained olive-charcoal stage frame and matching tray surfaces; no image filters, fake textures or output changes. | studio-320/390/1440 and reflection. Original white output rectangle remains an explicit product constraint. |
| P2-04: archive felt like an admin list. | Large artwork first, then title/update/resume, with rename/delete secondary. | Exact same six-piece legacy fixture, compare-archive-390. Rename, stored identity and actual resume verified. |
| Functional finding while checking P2-04: completed work's resume opened the result page and could reacquire its own edit lock. | Reuse the current editor for the same work; explicitly request studio when opening another stored work. | New regression finishes, archives, renames, resumes and verifies the same project id in every viewport/engine. |

No remaining actionable P0/P1/P2 captured-layout defect was found in the reviewed local evidence. This is an evidence-scoped result, not a claim that all devices or independent design judgment passed.

## Required fidelity surfaces

- **Typography:** existing self-hosted Gowun display and Pretendard body. Korean serif hierarchy and emblem-free wordmark remain; 320 title is 27px and body 12px. Reviewed actual wrapping, entire title/body contrast, labels, status, native controls and long archive title. Source's lighter photographic display treatment differs from the preserved available font. Native 200% text-setting and screen-reader validation remain unverified.
- **Spacing/layout:** separate title/art tracks and persistent CTA; enlarged actual SVG with a 116px small-phone inspector and 144px materials tray. Modal/reading/advanced surfaces own scrolling. Required phone buttons remain at least 44px high, and the four tab targets plus close remain reachable on 320. Short landscape remains usable with a smaller artwork; native touch ergonomics still need physical-device review.
- **Colors/tokens:** #171715 ink, porcelain text, muted bronze, restrained olive-charcoal stage/panels. No new gradients/shadows/filters. Copy no longer depends on which source image pixel lies behind it. Original jar/nacre colors remain intact and previous AA token pairs remain unchanged.
- **Image/asset fidelity:** same real porcelain and 96 nacre source PNGs; no generated hand, floral pattern, gold leaf or logo. The mobile arch is a UI image-window shape, not a replacement art asset/logo. Original renderer, project coordinates and output pixels remain unchanged. Gallery legacy fixture shows its actual outline background. The photographic texture is intentionally not recreated.
- **Copy/content:** Korean wordmark, one decorate CTA, three secondary destinations; local-only storage, non-persistent loss and optional private text remain explicit. DAILY, source stories and original help content retain their meaning. Removed only a redundant START subtitle.

## Verification and remaining gates

- 74 unit tests and **1,689 browser assertions** passed, including the unchanged 959-count regression baseline and 730 new checks. New suite: 16 viewports/engine combinations, actual actions, storage/resume, glyph/image separation, CTA visibility, geometry and errors.
- Actual JS and request failures are collected in browser suites; final passing contexts had no unexpected JS/resource errors. No personal-data remote transport was added.
- Optional outline has the same real event handler and state after closing the viewing dialog; old module remains byte-identical. PNG/JSON/card/privacy/save-error/conflict regressions passed.
- Work cloud browser retry returned **net::ERR_BLOCKED_BY_CLIENT**. This is separate from actual local Chromium/WebKit verification. User V3.1 policy 09 explicitly directs continued independent testing while keeping this gate blocked.
- Product Design image-to-code instruction: “If the cloud browser cannot be used, report verification as blocked.” Source: `/root/.codex/plugins/cache/openai-curated-remote/product-design/0.1.56/skills/image-to-code/SKILL.md`.
- Physical Android/iPhone, VoiceOver/TalkBack, native 200% browser text settings, and OS print/PDF save remain unverified. Final 9.0 design judgment belongs to the separate review, not this implementation report.

## Checklist

- [x] Both P1 and all four P2 implementations, real screenshots, same-state comparisons.
- [x] Whole existing functional/compatibility regression re-executed; new tests and original checks pass.
- [x] Protected asset/data hashes and unchanged renderer/storage modules verified.
- [x] Draft-only handoff with no main merge or production deployment.
- [ ] Work cloud interactive preview; independent final design approval; physical-device and assistive-technology checks.

final result: blocked

PRODUCTION DEPLOYMENT: NOT PERFORMED
