# Video endings — 2 November 2026

The owner's `GREEN IMPACT PLAN.md`, rule 11, calls for a project-card scan leading to a video about the future chosen by the players. The owner supplied `good end.mp4` and `bad end.mp4` and requested an ending screen with additional effects.

## Implemented behavior

- The authenticated snapshot's `game.outcome.winner` chooses the film: `PROTECTOR` → Good Ending; `SABOTEUR` → Bad Ending. This is shared by every player, including players on the losing faction. Approval totals do not independently override the engine's winner.
- A draw stays neutral and does not select either film. The plan supplies no draw film or tie-specific narrative.
- After game over, the page shows the real outcome, approval totals, full last-round reveal, history and now-public roles. A player explicitly starts the film; it does not autoplay with sound.
- Relevant played project cards link to `/ending.html?ending=good|bad&project=PROJ_nn`. A QR code next to the latest matching card opens that same page on a phone. This implements a QR beside the original artwork, rather than camera recognition of the illustration. Original card PNG pixels are unchanged.
- If a game ends before a matching project is resolved, the main QR still opens the correct film beside the winning faction's role card. No played project is fabricated.
- All 25 catalog records now have an `endingVideoUrl` corresponding to their own alignment. These fields are not added to the private pre-reveal player projection.
- Further presence snapshots update the final roster without replacing the video element or resetting playback.

The standalone viewer deliberately needs no room credentials: a phone can scan the code without receiving private room state. The link contains an ending key and, when available, a public card ID; it never contains a room code or bearer token.

## Media and delivery

The two MP4 files in `ui/endings/` are byte-for-byte copies of the owner's supplied videos, with portable filenames. Both are H.264, 3840 × 2160: Good Ending is approximately 8.03 seconds, Bad Ending 7.23 seconds. The JPEG posters are frames extracted from those videos; no generated illustration replaces the supplied footage.

`server/ending-media.cjs` exposes only those two filenames and their posters. It streams files and implements single byte ranges, suffix ranges, HEAD and 416 responses, so playback and seeking do not require buffering whole films in server memory. `scripts/build-web.cjs` also copies the videos, posters and viewer into the Vercel static output.

QR codes are generated locally in `ui/qr-code.js`: Model 2, version 5-L, byte mode and a four-module quiet zone. It handles links of at most 106 UTF-8 bytes; an unusually long deployment URL falls back to an ordinary viewer link. No QR service, camera permission or new application dependency is involved. See the [DENSO version reference](https://www.qrcode.com/en/about/version.html). The rendered codes were decoded independently with ZXing during local QA.

The QR uses the page's current origin. On a deployed site it points to that site's viewer. A QR containing `localhost` or `127.0.0.1` is a local preview URL; a different phone needs a reachable host/domain.

## Presentation and boundaries

The owner's later design refinement uses a deep emerald surface for Good Ending and a crimson surface for Bad Ending. A matching fixed glow outlines the browser viewport, with a slow light traveling around the edge. The overlay ignores pointer input. Reduced-motion preference stops the traveling light and decorative animation while retaining the static colored edge.

The separate “Mở video riêng” link has been removed. The highlighted “Quay về trang chủ” control is centered directly below the film/QR section, before the detailed game records; the standalone viewer uses the same treatment. The home, lobby, active phases, artwork and gameplay rules are retained. No winner-rule or phase-timer change is part of this work.

The ending label now appears in the shared masthead. Logo sizing, title capitalization, type spacing and desktop bar height match the home page; the duplicate brand/ending row inside the standalone viewer was removed. Bad Ending uses decorative broken buildings, smokestacks, bare trees and cracked ground instead of the botanical backdrop. These SVG elements are aria-hidden, remain behind the content and do not capture pointer input.

The viewer and in-game result now share the same fluid outer gutters and stage. Desktop video width is proportional to the stage, with an additional viewport-height bound, instead of stopping at 980 px while the surrounding stage keeps growing. Heading sizes also account for available height. The video retains its native 16:9 ratio with `object-fit: contain`; the page scrolls naturally when its full content exceeds the window. The masthead still uses the home page's sizing.

Good Ending uses those same responsive proportions and adds a dedicated recovering landscape: tree canopies, layered green hills, a winding river, sun rays, birds and foreground meadow/ripples. The brief sunlight and bird entrance animations settle within five seconds and stop under reduced motion. These elements are decorative SVG/CSS behind the copy; original cards and supplied footage remain unchanged. Draws keep their neutral backdrop.

Each tree now groups its crown, trunk, branches and root shadow under one local SVG transform. The forest corners have independent responsive sizes, rather than enlarging the trees with the entire 175%-wide mobile landscape. This keeps tree axes aligned and reduces the mobile decoration without changing the video proportions.

## Verification

- Added tests cover media byte accuracy/ranges, HEAD, malformed requests, exact public routes, winner-to-film mapping, draws, escaped project text, catalog links and private projection boundaries.
- The existing Playwright tests ran using the installed Chrome browser and bundled Playwright module; they were not treated as skipped coverage.
- Separate browser QA covered good/bad/draw at widths 320, 390, 768 and 1440; selected-film playback, seeking, standalone links, presence-update playback preservation, QR decoding and reduced motion.
- Syntax, runtime bundle parity, full tests and static build were checked. Screenshots and current command results are retained outside the checkout in the task's outputs directory.

This implementation is local. No commit, push, hosting configuration change or deployment is implied.
