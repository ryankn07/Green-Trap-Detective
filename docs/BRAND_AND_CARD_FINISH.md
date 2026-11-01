# Green Trap Detective — logo and card finish

Owner refinements on 2026-11-01: remove exterior white margins around gameplay cards and enlarge them within the PC frame; rename the visible website to Green Trap Detective; use the supplied logo, remove its background and apply golden-ratio proportions.

## Card treatment

Only a new `min-width:1200px` CSS block changes gameplay cards. Each of the 25 original PNGs has an individually measured outer silhouette, a matching visible-frame aspect ratio and source offsets. A 12 px panel inset replaces the large empty margins, and the old 352 px thumbnail cap is removed. The visible card occupies approximately 94.7–95.4% of its panel's width. Text, artwork and the green frame remain intact; source image proportions remain unchanged. The zoom dialog still shows the complete original image.

All 25 cards were rendered in a local gallery and visually inspected. Every image loaded, received its own outline, filled its viewport and retained its original source aspect ratio (measured error below 0.0001). Faint compression specks in the white export margin were excluded when measuring the silhouettes. No PNG artwork was edited; the combined SHA-256 for the 32 original card assets remains `be387ef0e41063b632aff7809784fa0d7ed8de713c53cd9a6233f7b88984f946`.

The old/new card CSS was compared with the same newly requested branding applied to both versions: seven mobile/tablet cases (320, 390, 768 and 1199 px; all four phases at 390 px) had identical computed layout/style and byte-identical screenshots. PC checks covered 1200, 1201, 1366, 1440 and 1920 px, all four game phases at 1440 px, no horizontal overflow and a working zoom dialog. The original mobile gameplay layout remains unchanged.

## Logo and identity

The supplied source logo is preserved. Two AI extraction attempts changed its appearance and were not used in the website. The owner explicitly chose pixel processing to preserve the original logo. The final PNG uses deterministic background removal: neutral near-white exterior pixels become transparent; the lens interior and its white reflections are protected. Every retained foreground RGB pixel was verified identical to the source. A safe transparent margin is retained around the artwork. Output: `ui/brand/green-trap-detective.png`, 799 × 1030, real RGBA PNG. Source crop offset: 32,75. Removed background pixels: 859518; retained foreground pixels: 260482.

Visible page title, description, masthead and card-region label now say Green Trap Detective. The logo also supplies the favicon. The former decorative masthead sprig was replaced by the supplied brand mark. Desktop type uses 25.888 px over 16 px: exactly 1.618. The same scale sets spacing and logo sizing; the image itself is never stretched into a golden rectangle. A compact logo/type treatment fits 320, 390, 768 and 1199 px without horizontal overflow. This requested identity update applies across the site; it does not restructure mobile gameplay.

The server adds one exact static PNG path under `/brand/`. CSP is unchanged, and unrelated/traversal paths remain inaccessible. Session keys, engine data, gameplay and existing client actions are unchanged.

## QA, helpers and release state

Antigravity CLI supplied a three-line read-only QA checklist. Separately, the user's existing ChatGPT web chat was used through Computer Use, not an API or Dot. It received a textual brief, produced five QA criteria, and did not receive source or screenshots. Its useful checks for all cards, phase changes, breakpoint boundaries, zoom and source hashes were executed by the primary integrator. Its mention of card-selection state was not treated as a new game mechanic. Helper responses and the browser screenshot of the web QA reply are retained in the parent outputs folder.

The new brand HTTP test failed against the old identity, then passed after implementation. Final Node suite: 10 passed, 0 failed, 2 automated-browser tests skipped due to no local Playwright module. Separate connected-browser checks described above actually ran; they are not claimed as execution of those skipped tests. Syntax, diff whitespace and runtime-package parity checks passed. Primary scoped review found no open implementation blocker: new static access is strictly limited; CSS clipping is PC-only; production renderer and private-role behavior are unchanged.

Screenshots and check records are in the parent outputs folder, notably `GREEN_TRAP_DETECTIVE_HOME.png`, `GREEN_TRAP_DETECTIVE_HOME_MOBILE.png`, `GREEN_TRAP_DETECTIVE_GAME_PC.png`, `EE_PC_CARD_FIT_GALLERY.png`, `EE_PC_CARD_FIT_CHECKS.json` and `GREEN_TRAP_DETECTIVE_BRAND_CHECKS.json`.

The changes are local and uncommitted. They have not been pushed or published. Ordinary preview: http://127.0.0.1:3031/ . Frozen layout-test preview: http://127.0.0.1:3033/?qa=DEBATE . The gallery server used for verification was stopped afterward.
