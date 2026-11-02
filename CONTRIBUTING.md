# Contributing

Thank you for helping improve GREEN TRAP DETECTIVE. This guide keeps changes understandable, reviewable, and safe.

## Before changing code

1. Read AGENTS.md.
2. Read docs/ARCHITECTURE.md and docs/DEVELOPMENT.md.
3. Check the relevant engine, server, and tests before proposing a change.
4. Keep existing behavior unless the change explicitly intends to alter it.

The engine and server are the source of truth for game rules and private data. Do not change them merely to match a UI idea or a documentation assumption.

## Branch naming

Use a short, descriptive prefix:

- feat/ for a new capability
- fix/ for a bug fix
- docs/ for documentation
- test/ for test-only changes
- refactor/ for behavior-preserving restructuring
- chore/ for tooling and repository maintenance

Do not commit directly to main for normal development.

## Commit messages

Use a simple Conventional Commits style:

~~~text
docs: clarify local development setup
fix: reject stale round submissions
test: cover private player projections
refactor: isolate room snapshot rendering
chore: add repository quality checks
~~~

Keep each commit focused on one logical change. Prefer several understandable commits over one large mixed commit.

## Required checks

Run the checks relevant to your change:

~~~bash
npm run check
npm test
npm run bundle:check
npm run build:web
~~~

If a command cannot run in your environment, say why in the pull request. Do not report optional browser tests as passing when they were skipped.

## Pull requests

A useful pull request includes:

- the problem being solved;
- a short explanation of the approach;
- the files or modules affected;
- commands and tests actually run;
- screenshots only when a visual change needs them;
- known limitations and follow-up work.

Keep pull requests small enough to review. Avoid mixing unrelated refactors, formatting sweeps, or generated assets into a behavior change.

## Security and data handling

- Never commit .env files, bearer tokens, room snapshots, private player data, or hosting credentials.
- Do not add secrets to screenshots, logs, issues, or AI prompts.
- Preserve the server-side authorization and per-player projection boundary.
- Treat player-provided text as untrusted input.
- Report vulnerabilities privately as described in SECURITY.md.

## AI-assisted contributions

AI tools may be used for exploration, drafting, implementation assistance, and test suggestions. The contributor remains responsible for reviewing the diff, running checks, and accurately describing what was verified. See docs/AI_ASSISTED_DEVELOPMENT.md.
