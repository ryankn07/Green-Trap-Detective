# Flame countdown after all actions — 3 November 2026

Owner request: in the investment/action stage, once everyone has finished, put a flame at the live end of the timer bar, rapidly drain the bar and automatically transition to results.

Owner extension (4 November): unanimous discussion Skip uses the identical two-second countdown flame, alongside the completed Skip button gradient, before the action-phase chapter. Both triggers share one presentation hold and cleanup path. See [DISCUSSION_SKIP.md](DISCUSSION_SKIP.md).

## Behavior

- A valid locked action counts whether the player invests or chooses not to invest. All living players must lock; offline living players still count, while eliminated/host-removed players do not. Invalid actions do not count. Removing the last non-ready player recomputes readiness unless that removal itself ends the game.
- The room manager atomically resolves the final valid lock using the existing engine economy/win rules. The public result carries only a `fastForward: true` marker; individual investments, bank targets, amounts and peer wallets remain outside the public action projection.
- Each observing browser accepts the confirmed result and keeps the old board inert for **2 seconds**, following the owner's latest refinement. A visible glowing fuse burns from its live end to zero over 1.82 seconds. Per the owner's 4 November refinement, the consumed section clears to the normal timer track with **no black ash trail**. Canvas flame tongues, rising sparks and smoke remain around the moving front; an inline SVG flame marks the leading edge. The empty bar remains visible for the last 180 ms before the ordinary result chapter. Timer-expiry defaults retain their existing transition and do not trigger this effect.
- The accepted result's deadline continues running during presentation. A terminal room is retired immediately; the browser saves the final projection and stops transport before showing the short burn. A final expulsion then plays its in-match effect before the ending chapter, preserving the existing ordering.
- Same-phase presence updates keep the same burn start time. A newer phase/round cancels it immediately. Hidden/pagehide cleanup releases the hold, and refreshing into a completed result does not replay the flame. Reduced motion preserves the two-second countdown and moving flame, with flicker, sparks and smoke suppressed.
- The real `<progress>` element and the normal clock remain in place. The decorative canvas/SVG layers ignore pointer input and are removed when the effect finishes or is superseded. Card, logo, coin and supplied ending footage remain unchanged. No new phase, dependency or database migration is required.

## Verification

`test/action-burn.test.cjs` covers all-ready/offline eligibility, invalid final actions, timeout defaults, kick recomputation, persistence rollback, a flame aligned to fractional progress on desktop/mobile, polling, presence/no-rewind, final expulsion/ending order, cached results, reduced motion, hiding and a superseding round. The serverless regression verifies final-lock receipt replay after resolution across independent invocations.

Full-suite validation before the duration refinement: **145 passed, 0 failed, 0 skipped** with `node --test --test-concurrency=2`, Chrome/Playwright and isolated PGlite. Source/asset checks (73 JS files, 25 cards), runtime-bundle parity, static frontend build and diff whitespace checks passed. Flame screenshots at 1440, 390 and 320 px were visually reviewed. The pagehide/BFCache regression verifies that a terminal expulsion flushes to the accepted ending instead of restoring a stale board. Loopback serves the current client and styles.

The 1.5-second refinement passed all **6 focused action-burn/countdown tests**, with no failures or skips. Browser probes measure the flame lifetime before the chapter, track its alignment to the fill edge and cover desktop/mobile. The larger flame, longer flicker/sparks and glowing trail were visually reviewed; source, bundle and build checks passed again.

The latest **2-second combustion refinement** passed the same **6 focused tests**, without failures or skips. Added checks verify visible ash/fire pixels, monotonic drainage, a brief visible zero before the chapter and cleanup of the canvas layer. Desktop/mobile screenshots were reviewed from the actual renderer.

## Real-play investigation — 4 November 2026

A three-browser check against `localhost:3141` used the ordinary create/join/start forms, public statement submissions, unanimous discussion Skip and each player's own action form. It did not inject sessions, prepare engine fixtures or use the temporary TEST LOCAL actions. The check reproduced a reduced-motion defect: that client jumped straight to an empty bar and dismissed the effect after about 204 ms, while normal clients displayed the full two seconds. This reproduces a possible cause of a missing effect; it does not establish the setting of the owner's existing browser tab.

The countdown now drains over the same two seconds for both preferences. Reduced motion suppresses decorative flicker/particles instead of skipping the countdown. A new browser regression creates all three players through the real UI and checks both live peers and the final submitter, including mobile and reduced motion. The focused action-burn/countdown suite passed **7/7**, with no failures or skips; source checks, runtime-bundle parity and frontend build also passed.

The repeated two-round check on port 3141 measured **2011–2053 ms** across all six client observations, including **2026 ms** for reduced motion, with continuously decreasing progress, no page errors or horizontal overflow, and no leftover inert board. The served JavaScript/CSS matched local source, and the disposable QA room was retired. The local server was restarted to invalidate its process-held static cache; already-open pages need a reload to load the revised script.

This records a local implementation, not a production deployment. Temporary QA artifacts and local test controls remain outside the Git checkout.

The owner's subsequent no-ash refinement passed all **5 action-burn tests**, without failures or skips, including the real three-player UI flow and reduced motion. Pixel checks retain visible fuel/fire and reject the former black trail; desktop/mobile screenshots were reviewed. Runtime-bundle parity, frontend build and diff checks passed, and port 3141 serves the updated script.
