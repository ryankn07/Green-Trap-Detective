# GREEN IMPACT Multiplayer

GREEN IMPACT is a browser-based Vietnamese multiplayer social-deduction game about environmental projects. Players discuss a project, privately choose an investment and optional bank action, then review the round result.

## Stack

- Node.js 20+
- Built-in Node HTTP server
- Vanilla HTML, CSS, and JavaScript
- Server-sent events for live room updates

## Run locally

Install Node.js 20 or later, then run:

```bash
npm start
```

The server uses port `3000` by default and respects the `PORT` environment variable.

Before running, verify that the files referenced by the server exist in your checkout: `public/app.js` and `engine/dist/data/projects.json`. If either is missing, inspect the repository's runtime bundle/history and restore the actual project source; do not create placeholder files.

## Main areas

- `engine/dist/` — game rules, setup, and per-player view projection.
- `server/` — room management, authentication, timers, HTTP routes, and live updates.
- `ui/` — page shell, styles, Canva-card integration, card manifest, and original card images.
- `ui/cards/` — original project and role card PNG assets.

## Gameplay phases

`DEBATE → BLIND_ACTION → REVEAL → next round`, or `GAME_OVER` when the engine determines the game has ended. Inspection and expulsion are actions inside `BLIND_ACTION`, not separate phases.

## Working with Codex

- Read [AGENTS.md](./AGENTS.md) before making repository changes.
- For the current gameplay UI correction, follow [docs/UI_REFACTOR_BRIEF.md](./docs/UI_REFACTOR_BRIEF.md).
- The engine and server define the rules and private-information boundary. The UI must reflect them; do not change gameplay to fit a mockup.
