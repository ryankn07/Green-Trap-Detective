# Development guide

## Requirements

- Node.js 20 or later. The repository's recommended local version is recorded in .nvmrc.
- Git.
- A browser for manual checks.

The current project has no third-party npm runtime dependencies. You do not need to install a framework or package set to start the server.

## Get started

~~~bash
git clone https://github.com/ryankn07/ee.git
cd ee
npm start
~~~

Open http://localhost:3000.

The start lifecycle runs the runtime recovery script first. It restores only missing files from the checked-in compatibility bundle; it does not overwrite existing source files.

## Quality commands

Run these before opening a pull request:

| Command | Purpose |
| --- | --- |
| npm run check | Check JavaScript syntax and required project data/assets |
| npm test | Run the Node.js test suite |
| npm run bundle:check | Verify the compatibility bundle matches its source files |
| npm run build:web | Build the static frontend into .web-dist/ |

The browser regression suite is optional and requires an existing Playwright installation. Set PLAYWRIGHT_MODULE_PATH to that installation's module path. BROWSER_CHANNEL can select the installed browser; it defaults to msedge. Tests that are skipped because Playwright is unavailable must be reported as skipped, not passed.

## Static response compression

The Node server serves the page shell, JavaScript, and CSS with gzip when the client advertises support. Binary PNG and WOFF2 assets are sent unchanged. See [PERFORMANCE.md](PERFORMANCE.md) for the implementation and byte-for-byte verification coverage.

## Native card WebP derivatives

The original HD PNGs remain canonical. To verify the checked-in lossless WebP derivatives locally, install the image build tool and run:

~~~bash
python -m pip install Pillow==12.3.0
python scripts/generate-card-webp.py --check
~~~

The generator checks every decoded RGBA pixel and only publishes a WebP file when it is smaller than its PNG. The GitHub Actions workflow regenerates the derivatives when a source HD PNG or the generator changes. Pillow is a build-time tool only; the game runtime remains dependency-free. Do not edit the generated manifest or WebP files manually.

## Runtime configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| PORT | 3000 | HTTP listening port |
| ROOM_STORE_PATH | data/rooms.json | Absolute or relative path for room snapshots |
| ROOM_MAX_PLAYERS | Unset | Optional per-room limit; when set it must be an integer of at least 3 |
| PUBLIC_ORIGIN | Unset | Canonical allowed origin for write requests |
| PUBLIC_ORIGINS | Unset | Comma-separated exact allowed origins; takes precedence over PUBLIC_ORIGIN |
| TRUSTED_PROXY_IPS | Unset | Exact proxy addresses trusted when resolving client addresses |

Do not set TRUSTED_PROXY_IPS until the actual proxy chain has been verified. Do not trust client-supplied forwarded headers as identity. Origin checks are an additional browser-request safeguard, not a replacement for bearer authentication.

## Runtime bundle maintenance

The compatibility archive is split across `runtime/compatibility/part01.b64`, `runtime/compatibility/part02.b64`, and `runtime/compatibility/part03.b64`. It contains the legacy runtime files and the project catalog.

When changing one of the bundled source files or the project catalog, regenerate the archive:

~~~bash
npm run bundle:pack
npm run bundle:check
npm test
~~~

The bundle parity regression test intentionally fails if the checked-in archive is stale. Do not manually edit the encoded parts.

## Static frontend build

~~~bash
npm run build:web
~~~

The build writes to .web-dist/. This directory is generated output and must not be committed.

## Suggested contribution workflow

1. Start from an up-to-date main branch.
2. Create one focused branch, such as docs/architecture-guide or fix/session-recovery.
3. Make one logical change at a time.
4. Run the relevant checks and inspect the final diff.
5. Open a pull request with the reason for the change, verification evidence, and known limitations.
6. Merge only after required checks and review are complete.

See CONTRIBUTING.md for commit and pull-request conventions.
