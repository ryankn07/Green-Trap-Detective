# Mobile component verification — 3 November 2026

Owner scope: audit the mobile elements and their code after card sizing and hold-to-view defects. Preserve the existing mobile design, desktop layout, original images, rules and the independently delivered ending implementation.

## Code findings and fixes

- The original mobile eye showed text only; PR24 connected it to the existing original private-card picture. It shows only the authenticated viewer's artwork and hides on release/cancellation.
- The extended audit reproduced a pressed-state mismatch when the pointer left the eye. Concealment now resets `aria-pressed` as well as hiding the image. Losing focus also conceals it.
- The hidden private image was lazy-loaded, so a first hold could wait for its first network request. The mobile viewer's own image now loads eagerly with asynchronous decoding. Original HD/WebP-to-PNG fallback remains intact. No peer private data is fetched or inferred.
- No additional page-width or control-width defect was found in the tested matrix. Existing wrapping rules cover long text/player names. No ending or desktop product source was changed in this audit.

## Executed coverage

`test/mobile-components.test.cjs` uses the real local Node server/renderer, disposable rooms with 14 people, and Chrome with mobile/touch emulation. Dimensions: 320×568, 360×640, 390×844, 430×932, 600×800, 844×390, and 390×360 (a reduced-height viewport, not a physical keyboard test).

Checks cover entry forms, browser create/join, host/guest lobby, all four phases, no horizontal page overflow, control bounds, loaded project artwork, private-card fit/release/pointer-leave state, original PNG fallback when role HD/WebP requests fail, project zoom/close, drawer fit/open/close, stance modal selection/edit/confirm, draft preservation, bank affordability/locking, and the existing final screen including draws. There were no uncaught page errors in the completed run. Existing focused mobile tests also cover repeated holds, keyboard release, pointer cancellation, card-source fallback and private projection.

The report is saved outside Git at task outputs/mobile-audit/mobile-component-audit.json. This is browser emulation evidence; it is not a physical Android Messenger, iOS Safari, software-keyboard or device-specific compatibility certification. Installed Chrome is available; bundled WebKit/Firefox engines are not installed. The ending media itself remains owned by the other implementation and was not modified.
