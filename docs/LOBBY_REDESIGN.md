# PC waiting-room design

Owner requested a waiting-room redesign and then more graphical elements. This changes only desktop lobby styling at min-width 1200px and adds aria-hidden decorative lobby markup. It retains the Garden palette / Accent ladder direction already selected for the project.

The room code and invite/start actions share one forest-green bar. A larger member shelf scrolls horizontally, with individual avatar/status tiles; the instructions occupy a narrow side column. Duplicate visual room-code text and technical notes are hidden on PC; the original h1 remains available to accessibility tools. The lower composition uses three original HD Canva project cards, botanical SVG linework and a subtle CSS magnifier. Decorations do not receive pointer events, add controls or reveal the active deck. Mobile hides the new decorative block.

Baseline HEAD: 4b7eb19f3402cfbec7b14ede1a7ed92453f32b6d, preserving the previously dirty worktree. The starting CSS, client and working diff were saved in ../work/lobby-redesign. Only ui/style.css, the lobby branch of public/app.js and the repacked runtime parts changed for this request; no engine/server/artwork changes.

Verification:
- PC 1200/1440/1920: 50 members, internal horizontal overflow, no page overflow.
- Lobby 320/390/1199: before/after viewport screenshot hashes match once fonts have loaded. The first 320px cold capture differed; the repeated loaded-font comparison matched, with identical page height/width.
- Gameplay 1440: loaded-image before/after viewport hashes match, native image width 1414 and rendered width 646.02px unchanged. The first cold-image capture differed; the repeated fully loaded comparison matched.
- Actual app on port 3039: create room, copy invitation (alert observed/dismissed), and start with one player (correct server message requiring at least 3) remain functional. All original button IDs/handlers remain. No added behavioral code needs a new unit test.
- npm test: 26 passed, 0 failed, 2 optional Playwright tests skipped. Connected-browser checks above were run independently through Computer Use. Syntax, runtime bundle parity and whitespace checks passed.
- Standards review: existing vanilla stack/tokens, original art bytes, aria-hidden graphics, no dependencies, no new notes or controls. Spec review: PC lobby redesigned, graphical detail added, mobile/gameplay rendering preserved. No unresolved scoped issue found.

Evidence: ../outputs/LOBBY_REDESIGN_FINAL.png and LOBBY_REDESIGN_CHECKS.json. Current work is local; no push/deployment.
