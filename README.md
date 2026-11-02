# GREEN TRAP DETECTIVE

[![CI](https://github.com/ryankn07/ee/actions/workflows/runtime-recovery-checks.yml/badge.svg?branch=main)](https://github.com/ryankn07/ee/actions/workflows/runtime-recovery-checks.yml)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![No runtime dependencies](https://img.shields.io/badge/runtime-dependency--free-2f6f4e)

**GREEN TRAP DETECTIVE** is a Vietnamese-language, browser-based multiplayer social-deduction game about environmental projects. Players examine one project at a time, discuss its merits, make private decisions, and discover the round outcome.

The project is built with a deliberately lightweight stack: Node.js, the built-in HTTP server, vanilla JavaScript, HTML, CSS, and server-sent events.

## Project highlights

- Room-based multiplayer sessions with live server-sent event (SSE) updates.
- A role-based social-deduction game with public statements and private actions.
- Server-owned game phases, deadlines, validation, and round resolution.
- Viewer-specific state projection to protect roles, wallets, locked actions, and inspection results.
- 25 original project records and their original Canva card artwork; 10 projects are selected for a match.
- File-based room snapshot recovery with atomic replacement.
- Responsive browser client and a static frontend build.
- Node.js automated tests for gameplay, room management, HTTP security, persistence, assets, and runtime-bundle integrity.

## Technology

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 20+ |
| HTTP server | Node.js built-in HTTP module |
| Browser client | Vanilla JavaScript, HTML, CSS |
| Realtime transport | Server-sent events (SSE) |
| Game logic | JavaScript modules under engine/dist/ |
| Persistence | Validated JSON snapshots on the local filesystem |
| Static deployment | Vercel build output in .web-dist/ |
| Backend deployment | Node.js service; current Vercel rewrites are defined in vercel.json |
| Automated tests | Node.js built-in test runner |
| CI | GitHub Actions |

The current runtime has no third-party npm dependencies.

## Quick start

### Requirements

- Node.js 20 or later. The recommended local version is in .nvmrc.
- Git.

### Run locally

~~~bash
git clone https://github.com/ryankn07/ee.git
cd ee
npm ci
npm start
~~~

Open http://localhost:3000.

No environment file is required for the default local setup. The start lifecycle checks the compatibility bundle and restores only missing runtime files; existing source files are not overwritten.

## Quality checks

Run these commands before submitting a change:

| Command | Purpose |
| --- | --- |
| npm run check | Check JavaScript syntax, project records, manifest consistency, and required card assets |
| npm test | Run the automated Node.js test suite |
| npm run bundle:check | Verify that the compatibility archive matches its source files |
| npm run build:web | Build the static frontend into .web-dist/ |
| npm run bundle:pack | Regenerate the compatibility archive after changing bundled source files or the project catalog |

GitHub Actions runs the quality gates on Node.js 20 and 22 for pushes and pull requests targeting main.

The browser regression suite is optional and requires an existing Playwright installation. Set PLAYWRIGHT_MODULE_PATH to its module path and, if needed, BROWSER_CHANNEL to the installed browser. If Playwright is unavailable, browser tests are reported as skipped; they are not counted as executed browser coverage.

## Repository map

~~~text
.
├── .github/
│   ├── ISSUE_TEMPLATE/       # Structured bug and feature reports
│   ├── workflows/            # CI and reviewed asset-import automation
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/                     # Architecture, development, and project records
├── engine/dist/              # Game rules, setup, validation, and player projection
├── public/                   # Browser application runtime
├── scripts/                  # Checks, build, asset import, and bundle utilities
├── server/                   # HTTP API, rooms, authentication, SSE, persistence
├── test/                     # Unit, integration, security, and regression tests
├── ui/
│   ├── brand/                # Brand assets
│   ├── cards/                # Original card artwork
│   ├── cards-hd/             # High-resolution card artwork
│   ├── fonts/                # Local font assets and licenses
│   ├── index.html            # Frontend page shell
│   ├── style.css             # Frontend styles
│   └── card-ui.js            # Card and role-art integration
├── runtime.bundle.part*      # Split compatibility archive
├── AGENTS.md                 # Repository-specific engineering rules
├── CONTRIBUTING.md           # Contribution workflow
├── SECURITY.md               # Vulnerability reporting policy
└── README.md
~~~

For a guided tour of each subsystem, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). For local setup and operational configuration, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). The full documentation index is in [docs/README.md](docs/README.md).

## Runtime configuration

| Variable | Default | Description |
| --- | --- | --- |
| PORT | 3000 | HTTP listening port |
| ROOM_STORE_PATH | data/rooms.json | Room snapshot file |
| ROOM_MAX_PLAYERS | Unset | Optional room-specific player limit; integer of at least 3 |
| PUBLIC_ORIGIN | Unset | Canonical allowed origin for write requests |
| PUBLIC_ORIGINS | Unset | Comma-separated list of exact allowed origins |
| TRUSTED_PROXY_IPS | Unset | Exact proxy IP addresses trusted for client-address resolution |

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) before changing production configuration. In particular, only trust forwarded client-address headers from verified proxy addresses.

## Architecture and security

The game engine owns rules and state transitions. The room manager coordinates sessions and deadlines. The HTTP layer authenticates requests and validates input. The browser receives a projection created for the authenticated player.

The UI is not a security boundary. Private information must be excluded by the server before a snapshot is sent. Room snapshots contain session credentials and private game state, so they must remain outside public directories and version control.

The current persistence and rate-limit model is **single-process**. Local snapshots can survive a process restart only when the backing filesystem survives. Multiple service replicas do not share room state, SSE subscriptions, or in-memory limits. These constraints are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SCALE_AND_SECURITY.md](docs/SCALE_AND_SECURITY.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before making changes. Use focused branches and small commits, run the relevant checks, and open a pull request with verification evidence.

## AI-assisted development

AI tools may assist with exploration, implementation suggestions, documentation, and test ideas. Changes still require human review and verification. The project documents its approach and suggested disclosure in [docs/AI_ASSISTED_DEVELOPMENT.md](docs/AI_ASSISTED_DEVELOPMENT.md).

## License

No open-source license is currently included. Public visibility does not by itself grant permission to reuse, modify, or redistribute this project.
