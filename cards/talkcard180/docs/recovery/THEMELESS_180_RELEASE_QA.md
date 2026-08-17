# TALK CARD 180 v2.1 — THEMELESS 180 RELEASE QA

- Date: 2026-08-17
- Candidate: `cards/talkcard180/index-v21.html`
- Production target: `cards/talkcard180/index.html`
- Product structure: `QUESTION 120` + `IMAGE 60`
- Status: PASS

## 1. Product decision

The 12 themes are no longer participant-facing navigation. Their original purpose was content development, not the final product hierarchy.

Theme codes remain only in the preserved source data so existing card IDs, the 120 original text questions, the 60 image assets, ALT copy, and historical reports remain intact.

The participant now chooses only one of two experiences:

1. **대화 질문 120** — shuffle once, then reveal one preserved question at a time in a fixed sequence.
2. **그림 카드 60** — show a 15-card hand of backs, let the participant pick any card, flip to the image only, then replenish the same table slot from the remaining pool.

## 2. Image-only lock

- No image question is rendered.
- No follow-up question is rendered.
- No `질문 열기` or `한 걸음 더` control exists.
- The image runtime deck exposes only `id`, `type`, internal source theme, image path, and ALT.
- The selected image is the only image face requested by the browser.
- Source prompt/follow-up fields remain preserved in historical runtime data but never enter the participant UI or session state.

## 3. Engine QA

`node cards/talkcard180/scripts/validate-r02-pick-engine.mjs`

- Result: **14 / 14 PASS**
- Question pool: 120 unique cards
- Image pool: 60 unique cards
- Image hand: 15 fixed slots
- Question completion: all 120 without repetition
- Image completion: all 60 without repetition
- Session restoration: exact question position and exact image hand/slot order
- Stored participant content: none
- Stored theme selection: none

## 4. Browser QA

`node cards/talkcard180/scripts/validate-r03-pilot-browser.mjs`

| Viewport | Result | Image table |
| --- | --- | --- |
| 390 × 844 | PASS | 3 columns |
| 430 × 932 | PASS | 3 columns |
| 768 × 1024 | PASS | 5 columns |
| 1440 × 1000 | PASS | 5 columns |

Every viewport passed:

- zero participant-facing themes
- exactly two deck choices
- sequential Question 120 progress and session restore
- 15-card Image 60 hand
- arbitrary tap/click/keyboard pick
- image-only reveal
- zero image-question and follow-up controls
- selected-slot replenishment
- stable unselected slots
- used-card duplicate prevention
- image session restore
- Tab, Space, and Escape operation
- preserved image ALT and ARIA labels
- minimum 44 × 44px card target
- no horizontal overflow
- no console, page, or HTTP errors

## 5. Visual QA fixes

Visual screenshot review found and corrected two issues before the final pass:

1. Added `height: auto` so the image `width`/`height` attributes preserve the 1122:1402 card ratio responsively instead of forcing a 1402px CSS height.
2. Added an explicit Korean fallback stack to editorial headings so Hangul remains readable in minimal-font environments.

## 6. Preserved content

- 120 / 120 original text questions
- 60 / 60 image assets
- 180 / 180 existing card IDs
- 60 / 60 image ALT values
- existing internal theme codes and historical reports
- WebP assets and deferred image loading

## 7. Release decision

The theme-free candidate satisfies the requested product definition and is ready to replace the previous T01/I01 production pilot.
