# Motion verification — 3 November 2026

Baseline: `9a7eed2`; plan commit: `4bf3a3a`. Motion is independent of Plus 2's proposed visual redesign. Original assets, layout CSS, rules and ending implementation are outside this change.

## Behavior

- Confirmed own statement/lock: desktop action card contracts over 260 ms; public discussion follows it. Pending submissions disable only their existing submit control and set `aria-busy`; errors release it and retain the draft.
- A confirmed new round brings in the original project card once (340 ms on desktop; a 180 ms opacity-only appearance on narrow screens to preserve artwork bounds). A reveal accents the existing authoritative result once (420 ms), with no delayed controls or data.
- Own balance changes receive a 200 ms emphasis. New public statements and lobby members receive a 160 ms entrance. Existing list positions and same-round discussion scroll are preserved.
- Home card fan appears once; the existing player drawer fades in. Polls, presence updates and reconnects do not replay scene effects. An equal-revision snapshot refreshes clock synchronization without rebuilding the DOM.
- Reduced motion uses opacity only, without spatial/layout animation. Preference changes, page hiding and exit cancel running effects. Private role controls are excluded from press animation and conceal immediately.

## Checks

- `npm run bundle:pack`, `npm run bundle:check`, `npm run check`: passed.
- Full `node --test` with local Chrome/Playwright enabled: **109 passed, 0 failed, 0 skipped**. Includes the existing desktop size matrix, mobile phase/size matrix, ending, privacy, engine, persistence, security and serverless checks.
- New browser tests exercise confirmed collapse, once-only replay behavior, new-round/reveal/own-balance/new-statement effects, scroll preservation while receiving messages, failed draft/pending recovery, reduced motion, preference/page-exit cancellation, lobby/home and mobile privacy.
- Existing desktop geometry matrix now requests reduced motion to measure settled layout; the motion suite separately checks the live confirmation transition and final discussion position.
- Impeccable layout detector: no findings (`detect --json --scope layout ui`). This is the detector's scoped result, not proof of all accessibility or visual properties.
- Independent standards/spec review: no remaining concrete blocker after fixing public discussion scroll and mobile panel bounds.

Integrated main through `3cf5626` (the separately authored heading/copy, sentence-case and ending-scroll fixes) without changing those fixes. The runtime archive was regenerated from the combined source. Final integration verification with `node --test --test-concurrency=1`: **109 passed, 0 failed, 0 skipped**. An earlier parallel run exposed a timing-sensitive existing soak test: its 2.03-second window sometimes ended before the second 2-second poll under browser-worker load. The unchanged test passed alone and in the full sequential run; no polling/backend change was made for this motion work.

## Local visual and timing evidence

After main advanced again to `2c8e64c`, preserved its larger discussion heading and removal of redundant notes. Rechecked all affected browser/mobile/motion/static-build cases: **10 passed, 0 failed, 0 skipped**; repository and regenerated bundle checks also passed. The motion hook retains the public statement identity attribute without restoring removed copy.

Artifacts are outside the repository at `../outputs/motion-verification/`: three screenshots capture expanded, contracting and confirmed states; another shows the mobile panel. `MOTION_MEASUREMENTS.json` records exact geometry and one natural transition sample.

At 1440×900, the action card measured **538.66 → 258.23 → 250.09 px** high; discussion top moved **626.66 → 346.23 → 338.09 px**. The intermediate screenshot holds the actual WAAPI animation at 130 ms for inspection. A separate natural lock transition sample recorded no long task during its roughly 900 ms observation. At 390×844 the panel remained inside the viewport, with no horizontal overflow or page error.

These observations are from local Chrome and mobile emulation. They do not establish a frame-rate guarantee or physical-phone performance.

## Release

PR #34 merged as `27ec9046cdeb53063b0cbe87e1a2eef33fe4538d`; Node 20/22 CI passed on its final head `fe794c6`. The merge also included the separately authored compact-empty-discussion CSS from PR #36. All 10 affected browser/mobile/motion/static-build cases passed again on the exact merged application commit, with no skips.

Vercel production deployment `dpl_GdFXtLoyy6X2yazmeUBEaS57FUxj` reached READY and assigned `greentrap.vercel.app` to that application commit. Public verification: root HTTP 200, `/health` reports `ok`, and live `app.js`, `motion.js`, `motion.css` match the merged source after newline normalization. The home page was visually inspected in a separate Edge tab; existing player tabs were not reloaded or altered. This final documentation update does not change the released application code.
