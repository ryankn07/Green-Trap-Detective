# Architecture

## Product overview

GREEN TRAP DETECTIVE is a Vietnamese-language, browser-based multiplayer social-deduction game built around environmental project cards. Players discuss one project, submit a private action, and then review the round result.

The repository deliberately uses a small dependency-free runtime: Node.js, the built-in HTTP module, browser HTML/CSS/JavaScript, and server-sent events (SSE).

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

## Runtime responsibilities

| Area | Responsibility | Main files |
| --- | --- | --- |
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

Use the configured remote store or a persistent volume for durable recovery. Horizontal scaling still requires additional coordination. Do not describe configured safety ceilings as measured hosting capacity.

## Deployment shape

The current deployment configuration builds a static frontend for Vercel and rewrites API and health requests to the Node service configured in vercel.json. The Node service can also be run locally with npm start.

Review vercel.json and the hosting provider's current configuration before changing domains, origins, build commands, or persistence settings. Documentation describes the repository configuration; it does not guarantee that a hosted service is currently healthy.
