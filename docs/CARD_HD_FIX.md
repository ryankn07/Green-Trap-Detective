# Native card image quality

Scope: all 25 project cards in gameplay on PC and mobile. Preserve mobile layout.
Baseline HEAD: 4b7eb19f3402cfbec7b14ede1a7ed92453f32b6d; existing redesign changes were already present.

The old images were Canva thumbnails, 376 x 532 pixels. Exported the original 25 pages from Canva design DAHZYyymT30 as native PNGs, 1414 x 2000, without generative changes or sharpening. Stored separately in ui/cards-hd; original files and URLs remain intact.

Gameplay selects the HD source at every viewport size. Zoom opens the selected source. A failed HD request retries the original image, then retains the existing accessible text fallback if both fail. PC crop masks were measured from the HD export; mobile layout rules are unchanged. Source page 1 touches the native canvas at its top; no artwork was reconstructed.

Verified in the connected browser:
- All 25 HD images load at 1414 x 2000.
- 390px viewport at DPR 3: source 1414px, displayed width 285.33 CSS px; sufficient native pixels, no horizontal overflow.
- 1440px viewport at DPR 2: source 1414px, displayed width 651.65 CSS px; sufficient native pixels, no horizontal overflow.
- Mobile zoom uses the same native HD PNG.
- Simulated HD 404 falls back to the original PNG and zoom remains usable.

npm test: 11 passed, 0 failed, 2 optional browser tests skipped. The connected-browser checks above were run separately. Runtime bundle parity and git diff whitespace checks pass. Antigravity and ChatGPT web supplied read-only QA advice; their advice was checked against browser behavior, not treated as test results.

Evidence in ../outputs: CARD_HD_BOTH_CHECKS.json, CARD_HD_FINAL.png, CARD_SHARPNESS_BEFORE.png, CARD_SHARPNESS_AFTER.png, CANVA_HD_EXPORT.png. Current changes are local; not published.


## Homepage transfer optimization — 2 November 2026

The homepage keeps the front hero card (PROJ_01) at native HD resolution and gives the two angled side cards (PROJ_11 and PROJ_25) their original 376 × 532 thumbnails for the initial page view. Both side-card links still open their untouched native HD PNGs in the preview dialog. The side thumbnails are lazy-loaded at low fetch priority; the front card is eager and high priority. Gameplay card rendering and all 25 native HD source files are unchanged.

Based on the current repository file sizes, the three hero images fall from 5,558,276 bytes to 2,694,733 bytes when all three are loaded — a 2,863,543-byte (about 51.5%) reduction before HTTP compression or cache effects. This is a source-size estimate, not a measured browser network trace.


## Pixel-exact WebP derivatives — 2 November 2026

The 32 native HD PNGs remain the canonical source artwork and were not modified. A lossless WebP derivative was generated for every project card, role card, card back, and Green Coin. All 32 derivatives are smaller than their PNG source: the full HD set decreases from 46,494,252 bytes to 29,804,754 bytes, saving 16,689,498 bytes (35.9%) if the complete set is transferred. This total is an asset-library comparison, not a claim that every page view downloads all 32 images.

Each WebP was reopened and decoded to RGBA, then compared byte-for-byte with its source PNG at the same dimensions. Transparent-pixel RGB values and available ICC/EXIF/XMP metadata are preserved. The browser manifest only advertises derivatives smaller than their source. The active page uses WebP where available and retains the original HD PNG or thumbnail as its fallback. Vercel's static build and the Node server both include the WebP assets; gameplay rules and card pixels are unchanged.
