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
- `engine/dist/data/projects.json` — the 10 original project records used by the engine.
- `server/` — room management, authentication, timers, HTTP routes, and live updates.
- `public/app.js` — browser client and session recovery.
- `ui/` — page shell, styles, Canva-card integration, card manifest, and original card images.
- `ui/cards/` — original project and role card PNG assets.
- `runtime.bundle.part01` … `runtime.bundle.part03` — source bundle used only to recover missing runtime files.

## Gameplay phases

`DEBATE → BLIND_ACTION → REVEAL → next round`, or `REVEAL → GAME_OVER` when the engine ends the game. Inspection and expulsion are actions inside `BLIND_ACTION`, not separate phases.

## Tests

Run the built-in Node test suite:

```bash
npm test
```

## Working with Codex

- Read [AGENTS.md](./AGENTS.md) before making repository changes.
- For the gameplay UI, follow [docs/UI_REFACTOR_BRIEF.md](./docs/UI_REFACTOR_BRIEF.md).
- The engine and server define the rules and private-information boundary. The UI must reflect them; do not change gameplay to fit a mockup.
