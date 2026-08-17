# TALK CARD 180 v2.0 — A07 PERFORMANCE / QA / RELEASE REPORT

## RUN

A07 PERFORMANCE / QA / RELEASE

## STATUS

PARTIAL / BLOCKED — 11 / 14 RELEASE GATES PASS

The hidden v2 candidate is deployed and desktop E2E is complete. The production `index.html` remains the unchanged v1 source because mobile viewport QA, a Chrome DevTools performance trace, and post-swap Production E2E are not yet complete.

## COMPLETED

- Reduced browser card data from the A01/A02 authoring payload to an exact runtime projection.
  - Source data: 93,560 bytes
  - Runtime data: 43,465 bytes
  - Reduction: 53.5%
- Added 12 WebP deck thumbnails at 360×450.
  - Thumbnails: 114,944 bytes
  - Matching full assets: 1,374,702 bytes
  - Reduction: 91.6%
- Theme selection and deck intro use lazy, async-decoded thumbnails.
- Image play loads the current card and preloads no more than the next two cards.
- Added a bounded engine `peekNext(2)` API and preload deduplication.
- Added version keys to the v2 stylesheet and module entry to prevent stale candidate assets.
- Kept the hidden candidate `noindex, nofollow`.
- Kept the production `cards/talkcard180/index.html` blob unchanged at `4078aa8a9ba1c37ce6e5d20049c8d3f438860bac`.
- Completed real cloud-Chromium interaction for all 12 themes and all 180 card positions.
- Verified keyboard Enter interaction, focus-visible, objective ALT binding, Closing, one-more, and home restart.
- Fixed three A07 issues found by actual rendering:
  1. Active image vertical distortion — fixed with `height: auto`; retest rendered 520×650 from a 1122×1402 source.
  2. Accent and focus contrast — darkened muted terracotta to `#a85e43`; 4.55:1 accent and 4.21:1 focus contrast.
  3. Stale browser CSS — added `?v=2.0.0-a07` cache keys.

## OUTPUT

- `index-v2.html`
- `css/talkcard.css`
- `data/runtime-cards.js`
- `js/talkcard-view.js`
- `js/talkcard-engine.js`
- `scripts/validate-a07-release.mjs`
- `docs/a07/A07_STATIC_QA_RESULT.json`
- `docs/a07/A07_BROWSER_QA_RESULT.json`
- `docs/A07_PERFORMANCE_QA_RELEASE_REPORT.md`
- Candidate: <https://daily-coach-ing.com/cards/talkcard180/index-v2.html>
- Staging PRs: #135, #136, #137, #138

## QA

### Automated regression

- A00–A07 validator set: 9 / 9 PASS
- A05 UX validator: 55 / 55 PASS
- A06 engine validator: 99 / 99 PASS
- A07 static validator: 91 / 91 PASS
- Runtime data: 120 text + 60 image = 180
- Runtime IDs: 180 / 180 unique
- Theme mapping: 12 themes × 15 cards

### Actual browser E2E

- Environment: cloud Chromium, 1363×936, DPR 1
- Theme entry: 12 / 12 PASS
- Text decks: 8 / 8 PASS
- Image decks: 4 / 4 PASS
- Cards observed: 180
- Globally unique card IDs: 180
- No repeat before deck completion: 12 / 12 PASS
- Progress `01 / 15` through `15 / 15`: 12 / 12 PASS
- Previous/next order stability: 12 / 12 PASS
- Closing: 12 / 12 PASS
- Image load: 60 / 60 PASS
- Image ALT present: 60 / 60 PASS
- Image → main question → follow-up → next-card reset: 4 / 4 decks PASS
- One more: PASS
- Home restart: PASS
- Horizontal overflow at desktop: none
- Smallest visible desktop button: 184×48
- Focus-visible: 3px solid `rgb(168, 94, 67)`

## RELEASE GATES

| Gate | Status | Evidence |
|---|---|---|
| G01 v1 backup | PASS | `legacy/index-v1.html`, `legacy/cards-v1.json` |
| G02 12-theme structure | PASS | 8 text + 4 image |
| G03 180 slots | PASS | 120 + 60, unique IDs |
| G04 image manifest 60 | PASS | A02 manifest validator |
| G05 visual master 12 | PASS | A03 pilot QA |
| G06 image assets 60 | PASS | A04 batch QA |
| G07 text decks | PASS | 8 decks, 120 positions clicked |
| G08 image decks | PASS | 4 decks, 60 images clicked and loaded |
| G09 progress | PASS | 12 complete `01 / 15` → `15 / 15` sequences |
| G10 Closing | PASS | 12 / 12 plus one-more and home restart |
| G11 mobile QA | BLOCKED | Responsive contracts pass statically; viewport-capable browser/device unavailable |
| G12 performance QA | BLOCKED | Load strategy and payload optimization pass; Chrome DevTools trace unavailable |
| G13 basic accessibility | PASS | keyboard, focus, contrast, ALT, ARIA/static fallback contracts |
| G14 Production E2E | BLOCKED | Production index intentionally not swapped |

## ISSUES

### G11 — mobile device sizes

The available cloud browser is fixed at 1363×936 and ignores requested tab viewport values. CSS contracts exist for 390, 560 (covering 430), 768, 1040, and mobile landscape, but this is not accepted as a substitute for actual 390/430/768 rendering.

### G12 — quantified performance trace

The `cloudflare:web-perf` workflow requires Chrome DevTools MCP calls such as navigation and performance trace start/stop. Those tools are not available in this session. Core Web Vitals were therefore not invented or marked PASS.

### G14 — Production E2E

The live v1 file remains untouched until G11 and G12 pass. The hidden candidate remains `noindex, nofollow`.

## NEXT

1. Run actual 390, 430, 768, and 1440 viewport QA, including mobile landscape and safe-area behavior.
2. Run a Chrome DevTools reload trace and record FCP, LCP, CLS, TBT, and request behavior.
3. Re-run the affected Gates if either check finds an issue.
4. Only after G11 and G12 pass, prepare the final `index.html` from the candidate, remove staging `noindex`, and review the exact production diff.
5. Deploy and run Production E2E for G14.
6. Mark RELEASE COMPLETE only at 14 / 14.
