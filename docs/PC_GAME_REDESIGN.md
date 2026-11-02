# PC gameplay redesign — 2026-11-01

Superseded for desktop presentation by [the 3 November release](DESKTOP_GAME_RELEASE_20261103.md). The original record below is retained as history.

## Scope and acceptance

Owner request: redesign the PC gameplay layout and visual treatment; mobile must not be changed. The earlier four-column arrangement is superseded by this request. Existing game rules, actions, privacy, artwork, homepage and lobby remain outside this change.

Git baseline: `4b7eb19f3402cfbec7b14ede1a7ed92453f32b6d`, with the existing uncommitted redesign preserved. A starting diff and exact stylesheet copy were saved under `work/pc-layout-redesign` in the parent workspace before editing.

Acceptance: at desktop widths, participants form a horizontal strip above a board containing the full project card and adjacent action controls; discussion follows below. Existing mobile/tablet layouts and pixels must be unchanged. Original card pixels and aspect ratio remain intact.

## Implementation

The only application file edited in this task is `ui/style.css`. All new rules are in one appended `@media(min-width:1200px)` block. Every preceding stylesheet byte is preserved. No HTML, renderer, server, engine, font, image or runtime-bundle change was needed.

The compact phase header and eight-player strip lead into a two-column board. The project sits on a pale table surface with an uncropped, zoomable card. Personal identity and private role controls sit above a wider phase-action panel. Discussion and the existing collapsible history follow the board. Typography, paper surfaces, field edges, spacing and controls reuse the approved Garden/Taste Accent-ladder design system.

Antigravity CLI / Gemini 3.8 Flash Low supplied three text-only composition suggestions in 3.68 seconds. It received a textual brief, not source or screenshots. It wrote no code; its advice was adapted and checked by the primary integrator.

## Verification

- Before editing, measured desktop acceptance checks failed: participants were alongside the card and discussion was alongside the board. They passed after editing.
- Browser checks covered DEBATE, BLIND_ACTION, REVEAL and GAME_OVER at 1200, 1440 and 1920 px: 12 combinations, all with no horizontal overflow, participants above the board, adjacent project/actions, discussion below and original `object-fit:contain` images.
- Protected-layout A/B checks compared the original saved CSS with the new CSS against identical engine-generated fixtures. At 320, 390, 768 and 1199 px, and all four phases at 390 px: seven comparisons had identical computed layout/style and byte-identical screenshots.
- Initial screenshot differences were traced to the monotonic countdown, not CSS. The local-only fixture subsequently froze both clocks, and the A/B comparisons above were repeated with identical state. This fixture is outside the application and binds only to loopback.
- Actual PC interactions: choosing INSPECT with two coins disables locking; one-coin investment enables locking and updates cost; project zoom opens its dialog and closes normally.
- Node suite: 9 passed, 0 failed, 2 existing automated-browser tests skipped because this local environment has no configured Playwright module. The separate browser checks above actually ran through the connected browser; they are not represented as execution of those two skipped tests.
- Whitespace check and a prefix/media-boundary assertion passed: original stylesheet preserved; exactly one new desktop media block.

## Review and artifacts

Standards review: existing vanilla stack retained; all new colors/fonts use existing tokens; the original DOM/actions and private-role behavior are preserved; the media boundary protects mobile. No open scoped blocker found.

Spec review: PC layout and styling redesigned; all seven protected mobile/tablet A/B cases are identical. No unrequested interface copy, buttons or game data were added. This review was performed by the primary integrator, not an independent source reviewer.

Screenshots for all four PC phases, the before image, Antigravity response and `EE_PC_LAYOUT_CHECKS.json` are in the parent workspace's outputs directory. Preview: `http://127.0.0.1:3033/?qa=DEBATE` is a frozen local visual-test fixture, not a live multiplayer room. The ordinary application preview remains on port 3031. No commit, push or publication was performed.
