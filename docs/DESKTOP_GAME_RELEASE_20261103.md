# Desktop gameplay release — 3 November 2026

The owner requested the previously prepared desktop redesign be integrated into the live website, then requested a different font in the phase band. Baseline is main `b58ab7d2ce04d94e87176bd383ad74f68e972709`, including the production Vercel/Supabase migration and mobile card fix.

Only the gameplay-scoped CSS appendix at `min-width:1200px` changes product presentation. It adapts the earlier isolated Garden table draft: forest phase band with contour decoration, cream participant tiles, framed project surface, private-profile sheet, action form, and discussion bubbles. Existing entry-page colors and fonts are reused. The phase band now uses Hanken Grotesk sans-serif as requested; the numeric countdown retains its existing mono treatment.

The grid follows viewport width, with fluid gutters. Card size follows both available column width and viewport height, preserving each original card's measured aspect ratio and existing export-margin crop. There is no fixed screen canvas or forced screen aspect ratio. The participant strip scrolls horizontally and introduces no player limit. Header, profile and form spacing are compacted to keep controls closer to the card. Existing zoom remains the way to inspect original artwork at larger size.

No mobile/tablet rule is changed. Entry/lobby, the recent mobile card fix, original image files, coin, private data projection, game rules, backend and ending-video code remain intact. The removed discussion subtitle stays removed. This supersedes the older desktop presentation described in [the earlier desktop plan](history/briefs/PC_GAME_REDESIGN.md).

Validation: full suite **98 passed, 0 failed, 0 skipped** with Chrome. New desktop browser check covers 1200×800, 1366×768, 1440×900, 1920×1080, 2560×1440 and 2560×1080, checking page overflow, bounded card height, centering, adjacent controls, participant order and requested phase font. DEBATE, BLIND_ACTION, REVEAL and GAME_OVER screenshots were generated from the actual renderer. At 390, 768 and 1199px, computed geometry and main-region styles match with the appendix enabled/disabled. Existing mobile zoom, fallback, privacy, cost validation and phase tests still pass. Repository check (55 JS, 25 cards), frontend build and diff whitespace check pass.

Evidence is outside the repository in the task outputs/desktop-release folder. Screenshots contain disposable local QA names/state, not production room data. The local preview fixture on loopback port3054 is also outside the repository and is not shipped.

## Owner refinements during release

The owner then requested smaller right-aligned Kick controls, larger card occupancy, less page scrolling, and moving the phase/round into the site header. The final desktop layout uses the full remaining window height: the phase band is alongside the logo in the header, the card spans the left side, actions/discussion occupy the middle, and a compact participant/Kick column sits on the right. Dense panels scroll internally; the page itself does not scroll. Container-relative card sizing preserves the original aspect ratio while using the available table height/width. No mobile rules changed.

The revised full suite passed 98/98 with Chrome. Additional geometry checks verify zero vertical page overflow, phase placement within the 64px header, the full card within the window, and participants to the right at all six desktop sizes. Protected-layout A/B checks at390/768/1199px still pass. Four phase screenshots were refreshed and inspected. Earlier references above to a horizontal desktop participant strip are superseded by this owner-requested right column.
