# AGENTS.md — Green Trap Detective

Current owner override (2026-11-01): support groups larger than 10; do not assume a maximum of 12. PC player boxes scroll horizontally, mobile player panels vertically. Preserve the existing redesign and native HD images. See docs/SCALE_AND_SECURITY.md for verified implementation and limits.

Current owner/team decision (2026-11-03): endings show the supplied video directly in the game page, using the full content width. **Do not add QR codes, scan instructions, camera/scanner flows or the former card/role scan sidebar.** The team approved removing QR entirely in favor of showing the video. This supersedes the scanning proposal in `GREEN IMPACT PLAN.md` rule 11 and any earlier documentation or screenshots. Preserve this decision during later Codex work unless the owner explicitly changes it. See `docs/ENDINGS.md`.

## Project purpose

Ending refinement (2026-11-03): keep the “Dấu vết của ván chơi / Những lá thẻ cùng tương lai” gallery removed. `TRUTH` verdict text stays green in reveals and journals, including within Bad Ending; the ending's faction color must not override it.

Vote-out motion clarification (2026-11-03): the two-second elimination effect runs on player tiles **inside the match when a turn resolves a successful expulsion**, after the reveal chapter. For a final vote, accept/cache/retire the result immediately while showing the inert board's brief effect before the ending chapter. Keep the ending roster static and contributors private during play. See `docs/ELIMINATION_EFFECT.md`.

GREEN TRAP DETECTIVE is a browser-based Vietnamese multiplayer social-deduction game about environmental projects. The current stack is Node.js (20+), a built-in HTTP server, and vanilla HTML/CSS/JavaScript. Keep the existing stack unless the owner explicitly approves a change.

## Required context for UI work

Read the current design record that matches the surface being changed:

- `docs/UI_REDESIGN.md` for the entry page and overall visual direction.
- `docs/DESKTOP_GAME_RELEASE_20261103.md` for the current PC gameplay layout and the owner-approved 760–1199px compact-window adaptation (the earlier plan is archived).
- `docs/BRAND_AND_CARD_FINISH.md` and `docs/CARD_HD_FIX.md` for brand treatment and original card assets.
- `docs/ENDINGS.md` for winner-based video playback, ending presentation and the team's no-QR decision.
- `docs/TUTORIAL_VIDEO.md` for the owner-requested right masthead guide button and fast tutorial player.
- `docs/GAME_RULES.md` for the full rules reader opened from the lobby's Cách chơi panel.
- `docs/ACTION_EFFECTS.md` for private, server-confirmed action feedback and immediate role-hiding requirements.

`docs/history/briefs/UI_REFACTOR_BRIEF.md` and `docs/history/briefs/LOBBY_REDESIGN.md` are historical task records. Their older layout and capacity assumptions are superseded where they conflict with later owner-approved work. Always verify current behavior against source code and tests.

## Non-negotiable rules

1. **The engine and server are the source of truth.** Make the UI represent existing rules and data. Do not change gameplay, economy, phase transitions, room capacity, or server behavior merely to make a mockup appear to work.
2. **Preserve the current approved design.** Keep its established visual language and component hierarchy; do not replace it with a generic dashboard. A redesign is in scope only when the owner explicitly requests one. The approved entry-page and PC gameplay directions are recorded in `docs/UI_REDESIGN.md` and `docs/DESKTOP_GAME_RELEASE_20261103.md`.
3. **Preserve original Canva artwork.** Keep the source PNG pixels unchanged; never redraw, regenerate, recolor, or substitute card artwork. CSS may trim only measured exterior export margins where the current card treatment documents it; never clip meaningful interior artwork or text.
4. **Do not invent game mechanics or data.** No new resource types, costs, rewards, counters, buttons, phases, or player abilities unless the engine explicitly supports them.
5. **Protect private information.** Render only information present in the authenticated player's server projection. Never infer or reveal another player's role, wallet, inspection result, or locked action.
6. Do not add frameworks or dependencies without approval. Keep the existing vanilla implementation and Vietnamese UI copy.
7. Inspect `git status` and existing diffs before editing. Preserve unrelated user work. Do not reset, clean, overwrite, commit, push, or deploy unless explicitly requested.

## Source-of-truth map

- `engine/dist/engine.js`: phase transitions, statement validation, action validation/costs, round resolution, elimination and win conditions.
- `engine/dist/view.js`: per-player data projection and the visibility boundary for private information.
- `engine/dist/setup.js`: role assignment and project-deck selection.
- `server/rooms.cjs`: room lifecycle, optional room-size policy, admission reservations, phase deadlines, timeout defaults, and engine calls.
- `server/limits.cjs`: minimum room size, optional operator limit, and process-level resource budgets.
- `server/rate-limit.cjs`: in-memory request limits and trusted-proxy address resolution.
- `server/http-guards.cjs`: request-body, media-type, submission, and Origin validation.
- `server/server.cjs`: HTTP routes, authentication, server-sent events, static-file serving, and card-image routes.
- `ui/index.html`: page shell and script/style loading.
- `ui/style.css`: current visual system and responsive styling.
- `ui/card-ui.js`: Canva-card integration, private role-card presentation, and current DOM/layout enhancement logic.
- `ui/ending-ui.js`, `ui/ending.css`, `ui/ending.html`: final results, supplied films and the standalone ending viewer.
- `ui/tutorial-ui.js`, `ui/tutorial.css`, `ui/tutorials/`: in-page guide player and the approved fast tutorial.
- `ui/rules-ui.js`, `ui/rules.css`: full rules dialog behavior and presentation; its content is in `ui/index.html`.
- `ui/action-fx.js`, `ui/action-fx.css`: local choice feedback, confirmed coin flights and authorized private role effects; renderer hooks live in `public/app.js`.
- `server/ending-media.cjs`: exact ending/tutorial media allowlists, streaming and byte-range handling.
- `ui/cards/PROJ_01.png` … `PROJ_25.png`: original project-card images.
- `ui/cards-hd/`: canonical native-resolution PNG artwork; never modify it as part of WebP conversion.
- `ui/cards-hd-webp/`: generated pixel-exact WebP derivatives; retain the PNG fallback.
- `ui/cards/ROLE_PROTECTOR.png`, `ROLE_SABOTEUR.png`: original role-card images.
- `ui/cards-manifest.json`: Canva source metadata.
- `ui/cards-hd-webp/` and `ui/card-webp-manifest.js`: generated lossless derivatives, advertised only when smaller than the source PNG.
- `scripts/generate-card-webp.py`: build-time generator and byte-for-byte RGBA verification for the HD derivatives.
- `package.json`: Node version and available npm scripts.
- `scripts/restore-runtime-bundle.cjs`: portable Node-only recovery for missing bundled runtime files.

The page shell loads `/app.js`, served from `public/app.js`. The legacy `public/index.html` and `public/style.css` are retained as compatibility-bundle inputs for the older Render recovery path; the active server and Vercel build use `ui/index.html` and `ui/style.css`. Do not remove those legacy files without updating the archive, restore script, and parity tests. The room manager imports `engine/dist/data/projects.json`. These original files are restored from the checked-in `runtime/compatibility/part*.b64` archive and are tracked. `npm start` runs `scripts/restore-runtime-bundle.cjs` first; it restores only missing files and never overwrites existing source unless explicitly invoked with `--force`. Use `--check` to validate the archive without writing.

## Verified gameplay contract

The following behavior is confirmed by the engine and room manager at the handoff baseline. Re-check the current code before relying on it if those files have changed.

- Actual phases are `DEBATE`, `BLIND_ACTION`, `REVEAL`, and `GAME_OVER`. There is no standalone verification or expulsion phase.
- Server phase durations are 120 seconds for `DEBATE`, 60 seconds for `BLIND_ACTION`, and 25 seconds for `REVEAL`.
- In `DEBATE`, each living player submits one public statement (1–500 characters). The optional stance is `SUPPORT`, `OPPOSE`, or `UNSURE`. A statement cannot be submitted twice in the same round. At timeout, the server supplies a default `UNSURE` statement for anyone who did not submit.
- Owner-approved exception (2026-11-03, visual refinement 2026-11-04): each living player may separately vote to skip discussion. Only unanimous consent advances `DEBATE` early; submitting all statements alone still waits for the timer. Offline living players remain eligible; eliminated/kicked players do not count. Missing statements receive the existing timeout default. The server commits `BLIND_ACTION` and its normal deadline immediately; the client shows the completed Skip button's gradient and the same two-second timer flame as all-locked actions, without a black trail, before the usual phase chapter. See `docs/DISCUSSION_SKIP.md`.
- In `BLIND_ACTION`, each living player locks one final action. The action contains both an `invest` boolean and a `bankAction`; these are independent parts of the same submission and may be combined if the player can afford the total cost.
- Investment is either 0 or 1 coin. `INSPECT` costs 3 coins. `EXPEL` contributes an integer amount from 1 to 5 coins to a target. The total action cost is investment cost plus bank-action cost. The server rejects an action whose total exceeds the player's wallet.
- A locked action is final for that round. The UI must not imply that a player can edit it afterward.
- Owner-approved early action completion (2026-11-03): once all living players have locked, the server resolves immediately instead of waiting out `BLIND_ACTION`. The client briefly burns down the old timer with a flame before the result chapter. Missing/invalid actions still wait for the normal deadline/defaults; final-result caching and room retirement must never wait for the visual effect. See `docs/ACTION_CLOCK_BURN.md`.
- Inspection results are private to the inspecting player. Expulsion contributions are pooled by target; a target is expelled when pooled contributions reach at least 5. Contributor identities and amounts stay private during active play. Owner refinement (2026-11-03): at `GAME_OVER`, the ending names all eligible contributors to each successful expulsion; contribution amounts, inspection results and other locked actions remain private. Do not invent an actor for bankruptcy or older results without attribution.
- Investment approval requires at least half of the living players, rounded up. Investors pay the investment cost whether or not the project is approved. An investor receives the engine-defined payout only when their role aligns with the project's alignment.
- During play, `projectForPlayer` exposes the viewer's own role, coins, locked action, and inspection history. Other players' public entries contain identity/status and whether they have submitted or locked; they do not contain their role, wallet, inspection results, or action details. Project alignment/verdict/explanation are withheld until `REVEAL` or `GAME_OVER`. All roles become visible at `GAME_OVER`.
- The engine accepts groups of at least 3 with no hardcoded upper player count. ROOM_MAX_PLAYERS is an optional operator policy, default unset. Separate process resource budgets protect the server; these are not hosting capacity guarantees. Derive any displayed maximum from the authenticated room projection.

## Implementation and verification

- Prefer changing the actual renderer in `public/app.js` for structural gameplay UI. Keep `ui/card-ui.js` focused on card-specific presentation and image behavior; do not use a `MutationObserver` to reconstruct the main layout. Any observer used for card enhancement must be idempotent and must not duplicate controls or disrupt focus, drafts, or scroll position during live rerenders.
- Derive phase labels, action availability, and progress from the actual game snapshot. The snapshot includes `phase`; the room view includes `serverTime` and `deadline`. Do not guess phase duration by parsing translated label text.
- Use `textContent` for player-controlled text. Do not introduce unsafe HTML rendering.
- Check `package.json` before running commands. It defines `npm start` with runtime recovery and `npm test` for the Node test runner. Browser tests additionally require `PLAYWRIGHT_MODULE_PATH`; report skipped tests accurately. Run `node --check` on changed JavaScript files and the applicable tests.
- Verify all three active phases, game-over rendering, private-information boundaries, card-image loading, and desktop/tablet/mobile layouts. If a runtime dependency is missing, state that testing is blocked rather than claiming success.
- Make small, logically grouped changes. Summarize files changed, checks actually run, remaining issues, and any backend changes proposed separately.

