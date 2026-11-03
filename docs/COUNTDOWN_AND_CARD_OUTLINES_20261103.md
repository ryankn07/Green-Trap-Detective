# Continuous countdown and exterior card cleanup

Owner requests, 3 November 2026: make the countdown drain continuously instead of jumping, then remove erroneous exterior card bleed and check the whole card set. Baseline: `ed06b8b`.

## Countdown

The progress element now receives fractional seconds on animation frames; its adjacent label changes only when the displayed whole second changes. A monotonic clock anchor is keyed by room, game, round, phase and authoritative deadline. Same-phase updates cannot refill the bar; a new phase/deadline resets it. Hidden pages stop frame updates and resume from elapsed time. Both SSE and polling use the same accepted-snapshot path, including unchanged revisions. The backend still controls phase transitions and action deadlines; no rules or server behavior changed.

The display remains an estimate based on the server timestamp received by the browser. It does not measure in-flight network latency or claim clock-synchronization precision under arbitrary transport delay.

## Card outlines

The original volcano export, PROJ_03, includes pale illustration fragments outside its green frame. The previous non-white silhouette retained those fragments. The replacement measures the connected outer frame and its enclosed area, preserving the white interior, illustrations, text and emblem. Only CSS crop/outline variables change; no PNG, WebP, logo, coin, role-card or ending asset is rewritten.

Regenerate the 25 thumbnail and 25 HD outlines using built-in Node modules:

```text
node scripts/generate-card-outlines.cjs
node scripts/generate-card-outlines.cjs --check
```

The utility accepts the repository's non-interlaced 8-bit RGB/RGBA PNGs and fails on unsupported formats, missing/disconnected frames, implausible areas or open contours. Its frame-color heuristics are validated for the current supplied artwork, not advertised as arbitrary-image background removal. Contour simplification keeps CSS transfer growth small: gzip increased from 28,997 to 30,311 bytes at this baseline.

## Verification

- Full local Chrome suite: **112 passed, 0 failed, 0 skipped**. Includes smooth fractional draining, same-phase no-rewind, polling unchanged revisions, phase reset/end, the reported exterior bleed and preserved interior/frame, plus existing PC/mobile/privacy/ending/backend tests.
- Both fixes had failing regressions before implementation. Repository, runtime-bundle, static-build and outline reproducibility checks passed. Impeccable's scoped layout detector returned no findings.
- All **50 project variants** were rendered and checked for retained interior and excluded exterior points. The utility's decoded RGB bytes were independently compared with Chrome canvas for all 50: **50 matches**.
- All **32 original HD assets** were inventoried and visually inspected: 25 project fronts plus 7 roles/backs/coin source pages. The seven other sources remain unchanged; their original white page areas were not treated as project-card errors.
- Evidence is outside the repository at `../outputs/card-outline-audit/`: five labeled project rows, HD/fallback galleries, the seven other originals, source hashes/check results, and a larger PROJ_03 image after correction.
- ChatGPT web supplied an independent risk checklist. Its suggestions were treated as hypotheses and checked against the source, actual assets and browser results. Separate spec/standards review found one polling-path blocker; it was fixed and locked down by a regression before release. No remaining concrete blocker was reported.

Validation uses local Chrome and mobile emulation; it is not a physical-device performance guarantee.
