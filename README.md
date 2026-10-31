# GREEN IMPACT Multiplayer

GREEN IMPACT is a browser-based Vietnamese multiplayer social-deduction game about environmental projects. Players discuss a project, privately choose an investment and optional bank action, then review the round result.

## Stack

- Node.js 20+
- Built-in Node HTTP server
- Vanilla HTML, CSS, and JavaScript
- Server-sent events for live room updates

## Run locally

Install Node.js 20 or later, clone the repository, then run:

```bash
npm start
```

The server uses port `3000` by default and respects the `PORT` environment variable.

The `prestart` hook runs `scripts/restore-runtime-bundle.cjs` before the server starts. It restores only missing runtime files from the checked-in split bundle; it does not overwrite existing source files. To validate the bundle without writing files, run:

```bash
node scripts/restore-runtime-bundle.cjs --check
```

## Main areas

- `engine/dist/` — game rules, setup, and per-player view projection.
- `engine/dist/data/projects.json` — all 25 original project records; the engine selects 10 per game.
- `server/` — room management, authentication, timers, HTTP routes, and live updates.
- `public/app.js` — browser client and session recovery.
- `ui/` — page shell, styles, Canva-card integration, card manifest, and original card images.
- `ui/cards/` — original project and role card PNG assets.
- `runtime.bundle.part01` … `runtime.bundle.part03` — source bundle used only to recover missing runtime files.

After changing a bundled source or the catalog, run `npm run bundle:pack`.
The test suite checks that the archive matches the current source, so a legacy
Render build command cannot unpack an older client over a newer one. For new
hosting configurations use `npm install` as the build command and `npm start`
as the start command; extraction is only a compatibility path.

## Room recovery

`npm start` saves room snapshots to `data/rooms.json`. Set `ROOM_STORE_PATH` to
an absolute filename to use a different location. Writes use an atomic rename;
snapshots preserve sessions, phase, private locked choices and game history.
Connections are marked offline on restart and reconnect using the same token.
Snapshots contain private game data and session credentials; keep them outside
public assets and Git. The store supports one service process only.

Local files survive a process restart only while that filesystem survives.
Render's free filesystem does **not** retain them across redeploy/restart.
For production recovery mount persistent storage and set, for example,
`ROOM_STORE_PATH=/var/data/green-impact/rooms.json`. This repository does not
provision a paid plan or disk automatically.

The original plan's video ending assets have not been provided. The game shows
the final result without a fabricated video or placeholder link.

## Gameplay phases

`DEBATE → BLIND_ACTION → REVEAL → next round`, or `REVEAL → GAME_OVER` when the engine ends the game. Inspection and expulsion are actions inside `BLIND_ACTION`, not separate phases.

## Tests

Run the built-in Node test suite:

```bash
npm test
```

The HTTP/runtime tests run with Node alone. Browser regression tests in
`test/browser.test.cjs` are optional and require an existing Playwright installation;
no browser or npm dependency is installed automatically. Set `PLAYWRIGHT_MODULE_PATH`
to that installation's module path, and optionally `BROWSER_CHANNEL` (defaults to
`msedge`), before running `npm test`. Without that variable, browser tests are
reported as skipped. With it, they cover real DOM interactions, private choices,
server-clock timing, mobile/tablet/desktop widths, expired-session recovery and
the ten-round flow against a local server. Set `BROWSER_ARTIFACT_DIR` to an optional
output directory to save screenshots; otherwise tests do not write screenshots.

Gameplay is rendered directly as four functional areas: players, the original
project card, personal actions, and public statements. On mobile the player list
is opened with the council button; the project and statement feed remain in the
page flow. Original Canva images are displayed whole, with accessible text if an
image cannot load.

## Working with Codex

- Read [AGENTS.md](./AGENTS.md) before making repository changes.
- For the gameplay UI, follow [docs/UI_REFACTOR_BRIEF.md](./docs/UI_REFACTOR_BRIEF.md).
- The engine and server define the rules and private-information boundary. The UI must reflect them; do not change gameplay to fit a mockup.
