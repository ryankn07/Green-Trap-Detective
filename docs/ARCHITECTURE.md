# Architecture

## Product overview

GREEN TRAP DETECTIVE is a Vietnamese-language, browser-based multiplayer social-deduction game built around environmental project cards. Players discuss one project, submit a private action, and then review the round result.

The repository uses Node.js, browser HTML/CSS/JavaScript, and the built-in HTTP module without third-party npm runtime packages. It supports two delivery paths: a long-running local Node server with server-sent events (SSE), and a Vercel Function using HTTP polling and private Supabase room persistence.

## System context

~~~mermaid
flowchart LR
    Browser[Browser client]
    HTTP[HTTP server]
    Rooms[Room manager]
    Engine[Game engine]
    Projection[Per-player view projection]
    Store[File room store]

    Browser -->|Authenticated JSON requests| HTTP
    HTTP -->|Validated commands| Rooms
    Rooms -->|State transitions| Engine
    Rooms -->|Persist snapshots| Store
    Rooms -->|Build viewer-specific snapshot| Projection
    Projection -->|Private-safe state| HTTP
    HTTP -->|SSE snapshots| Browser
~~~

The diagram above describes the long-running Node server path. On Vercel, `api/game.js` handles short-lived requests, invokes `server/serverless-game.cjs`, and stores room state in Supabase. The browser uses polling rather than an SSE subscription in that path.

## Runtime responsibilities

| Area | Responsibility | Main files |
| --- | --- | --- |
| Vercel Function | Stateless HTTP request handling, authenticated commands and per-room persistence | api/game.js, server/serverless-game.cjs |
| Supabase per-room storage | Atomic state updates and request receipts for serverless requests | server/supabase-room-store.cjs, supabase/migrations/ |
| Game engine | Game setup, role assignment, project selection, phase transitions, action validation, round resolution, win conditions | engine/dist/ |
| Room management | Room lifecycle, player sessions, host permissions, phase deadlines, timeout defaults | server/rooms.cjs |
| HTTP and realtime transport | Routes, bearer authentication, origin/body validation, rate limits, static assets, SSE subscriptions | server/server.cjs, server/http-guards.cjs, server/rate-limit.cjs |
| Persistence | Validated room snapshots and atomic file replacement | server/room-store.cjs |
| Browser client | Session handling, API requests, snapshot rendering, user interactions | public/app.js |
| UI shell and assets | Page shell, styles, card presentation, fonts, original card images | ui/ |
| Build and recovery | Static web output and compatibility recovery bundle | scripts/ |

## Game lifecycle

The engine owns the game state and phase transitions. The active phases are:

1. DEBATE — players submit one public statement for the current round.
2. BLIND_ACTION — players lock an investment decision and an optional bank action.
3. REVEAL — the round result is made public.
4. GAME_OVER — the final outcome is available.

The normal transition is DEBATE → BLIND_ACTION → REVEAL → the next round's DEBATE, or GAME_OVER when the engine ends the game. Inspection and expulsion are bank actions; they are not separate phases.

The server owns phase deadlines and timeout handling. The browser displays the server-provided phase and timing data; it must not independently advance the game.

## Trust and privacy boundaries

- A player is authenticated with the room/session credentials supplied by the server. The server derives the player identity from that authenticated session.
- The server calls the per-player projection in engine/dist/view.js before returning game state.
- During a game, a player receives their own role, wallet, locked action, and inspection history. Other players' private role, wallet, inspection results, and locked action are not part of that player's projection.
- Project alignment and verdict are withheld until the reveal stage. Roles become public only when the game is over.
- Public statements are visible to the room.
- Treat room snapshots as sensitive: they contain session credentials and private game state. They must stay outside public static directories and must not be committed.

UI hiding is not a security boundary. Any private-information rule must be enforced by the server projection and covered by tests against raw HTTP/SSE responses.

## Persistence and scaling model

By default, the room store writes snapshots to a local file using a temporary file, fsync, and atomic rename. With `GAME_SUPABASE_URL` and `GAME_SUPABASE_SERVICE_KEY`, it uses a private Supabase snapshot with commit-before-acknowledgment and writer fencing. Both modes serve one active server process. See [durable room configuration](DURABLE_ROOMS.md).

This has important operational limits:

- Local file mode can recover rooms only if the backing filesystem survives; ephemeral files do not survive redeploys.
- Remote mode loads validated database state before listening and refuses to serve uncertain state after a failed commit.
- Multiple server replicas do not share in-memory rooms, SSE subscriptions, or rate-limit state.
- The current design is not a distributed database or a multi-region deployment.

The Vercel Function path is different from the singleton Node/SSE modes: it loads per-room data from Supabase for each request and uses conditional writes with idempotency receipts. Its polling, hosting quotas and concurrent write behavior must be evaluated separately; local Node load results are not Vercel capacity guarantees. See [the Vercel and Supabase implementation record](VERCEL_SUPABASE_TRIAL.md).

Use a remote store or a persistent volume when room recovery must survive process restarts. Horizontal scaling and operational capacity require evidence for the chosen deployment path.

## Deployment shape

The checked-in `vercel.json` builds the static frontend, routes `/api/*` and `/health` to `api/game.js`, and selects Vercel's Singapore region (`sin1`). The Function requires `GAME_TRIAL_ENABLED=1`, `GAME_SUPABASE_URL` and `GAME_SUPABASE_SERVICE_KEY` for its Supabase-backed room store; missing configuration fails closed. The traditional Node/SSE server can still be run locally using `npm start` and has its own local-file or remote singleton storage configuration.

Review the active Vercel project configuration, credentials and deployment history before changing routing or persistence. Repository configuration alone does not prove a hosted service is healthy.
