# AGENTS.md — GREEN IMPACT

## Project purpose

GREEN IMPACT is a browser-based Vietnamese multiplayer social-deduction game about environmental projects. The current stack is Node.js (20+), a built-in HTTP server, and vanilla HTML/CSS/JavaScript. Keep the existing stack unless the owner explicitly approves a change.

## Required context for UI work

Before changing gameplay UI, read `docs/UI_REFACTOR_BRIEF.md`. It is the task-specific specification for the current four-column UI correction.

## Non-negotiable rules

1. **The engine and server are the source of truth.** Make the UI represent existing rules and data. Do not change gameplay, economy, phase transitions, room capacity, or server behavior merely to make a mockup appear to work.
2. **Preserve the current mockup.** This is a correction/refactor, not a redesign. Keep its established layout, visual language, and component hierarchy as much as possible. Do not replace it with a new theme or a generic dashboard.
3. **Preserve original Canva artwork.** Use the existing project-card PNGs as-is. Never redraw, regenerate, crop, recolor, or substitute card artwork.
4. **Do not invent game mechanics or data.** No new resource types, costs, rewards, counters, buttons, phases, or player abilities unless the engine explicitly supports them.
5. **Protect private information.** Render only information present in the authenticated player's server projection. Never infer or reveal another player's role, wallet, inspection result, or locked action.
6. Do not add frameworks or dependencies without approval. Keep the existing vanilla implementation and Vietnamese UI copy.
7. Inspect `git status` and existing diffs before editing. Preserve unrelated user work. Do not reset, clean, overwrite, commit, push, or deploy unless explicitly requested.

## Source-of-truth map

- `engine/dist/engine.js`: phase transitions, statement validation, action validation/costs, round resolution, elimination and win conditions.
- `engine/dist/view.js`: per-player data projection and the visibility boundary for private information.
- `engine/dist/setup.js`: role assignment and project-deck selection.
- `server/rooms.cjs`: room lifecycle, current room-size limit, phase deadlines, timeout defaults, and engine calls.
- `server/server.cjs`: HTTP routes, authentication, server-sent events, static-file serving, and card-image routes.
- `ui/index.html`: page shell and script/style loading.
- `ui/style.css`: current visual system and responsive styling.
- `ui/card-ui.js`: Canva-card integration, private role-card presentation, and current DOM/layout enhancement logic.
- `ui/cards/PROJ_01.png` … `PROJ_25.png`: original project-card images.
- `ui/cards/ROLE_PROTECTOR.png`, `ROLE_SABOTEUR.png`: original role-card images.
- `ui/cards-manifest.json`: Canva source metadata.
- `package.json`: Node version and available npm scripts.
- `scripts/restore-runtime-bundle.cjs`: portable Node-only recovery for missing bundled runtime files.

The page shell loads `/app.js`, served from `public/app.js`. The room manager imports `engine/dist/data/projects.json`. These original files are restored from the checked-in `runtime.bundle.part*` archive and are tracked. `npm start` runs `scripts/restore-runtime-bundle.cjs` first; it restores only missing files and never overwrites existing source unless explicitly invoked with `--force`. Use `--check` to validate the archive without writing.

## Verified gameplay contract

The following behavior is confirmed by the engine and room manager at the handoff baseline. Re-check the current code before relying on it if those files have changed.

- Actual phases are `DEBATE`, `BLIND_ACTION`, `REVEAL`, and `GAME_OVER`. There is no standalone verification or expulsion phase.
- Server phase durations are 120 seconds for `DEBATE`, 60 seconds for `BLIND_ACTION`, and 25 seconds for `REVEAL`.
- In `DEBATE`, each living player submits one public statement (1–500 characters). The optional stance is `SUPPORT`, `OPPOSE`, or `UNSURE`. A statement cannot be submitted twice in the same round. At timeout, the server supplies a default `UNSURE` statement for anyone who did not submit.
- In `BLIND_ACTION`, each living player locks one final action. The action contains both an `invest` boolean and a `bankAction`; these are independent parts of the same submission and may be combined if the player can afford the total cost.
- Investment is either 0 or 1 coin. `INSPECT` costs 3 coins. `EXPEL` contributes an integer amount from 1 to 5 coins to a target. The total action cost is investment cost plus bank-action cost. The server rejects an action whose total exceeds the player's wallet.
- A locked action is final for that round. The UI must not imply that a player can edit it afterward.
- Inspection results are private to the inspecting player. Expulsion contributions are pooled by target; a target is expelled when pooled contributions reach at least 5. Do not publish individual contributors or their amounts.
- Investment approval requires at least half of the living players, rounded up. Investors pay the investment cost whether or not the project is approved. An investor receives the engine-defined payout only when their role aligns with the project's alignment.
- During play, `projectForPlayer` exposes the viewer's own role, coins, locked action, and inspection history. Other players' public entries contain identity/status and whether they have submitted or locked; they do not contain their role, wallet, inspection results, or action details. Project alignment/verdict/explanation are withheld until `REVEAL` or `GAME_OVER`. All roles become visible at `GAME_OVER`.
- The engine accepts 3–12 players, but the current room manager rejects joins once a room has 8 players. The current playable room limit is therefore 3–8. Do not change that limit as part of a UI-only task.

## Implementation and verification

- Prefer rendering the correct four-column structure in the actual UI renderer over repeatedly moving existing nodes with a `MutationObserver`. Keep `card-ui.js` focused on card/role-art behavior where practical.
- Derive phase labels, action availability, and progress from the actual game snapshot. The snapshot includes `phase`; the room view includes `serverTime` and `deadline`. Do not guess phase duration by parsing translated label text.
- Use `textContent` for player-controlled text. Do not introduce unsafe HTML rendering.
- Check `package.json` before running commands. At this baseline it only defines `npm start`; do not claim that lint/test scripts exist. Run `node --check` on changed JavaScript files and any tests that are actually present.
- Verify all three active phases, game-over rendering, private-information boundaries, card-image loading, and desktop/tablet/mobile layouts. If a runtime dependency is missing, state that testing is blocked rather than claiming success.
- Make small, logically grouped changes. Summarize files changed, checks actually run, remaining issues, and any backend changes proposed separately.

