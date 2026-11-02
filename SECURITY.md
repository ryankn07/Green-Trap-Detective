# Security policy

## Scope

GREEN TRAP DETECTIVE is a small multiplayer application. Security-sensitive areas include player session authentication, room authorization, private game-state projection, HTTP input validation, SSE delivery, rate limiting, and room snapshot persistence.

## Reporting a vulnerability

Please do not publish exploitable details, session tokens, room snapshots, or private player data in a public issue.

If GitHub private vulnerability reporting is enabled for this repository, use the repository's **Report a vulnerability** flow. Otherwise, contact the repository maintainer privately through their GitHub profile and include:

- a concise description of the issue;
- the affected route, module, or commit, if known;
- safe reproduction steps;
- the potential impact;
- any suggested mitigation.

Do not include real user credentials or data. The maintainer will acknowledge and investigate reports as time and severity allow; no response-time guarantee is made by this policy.

## Operational guidance

- Keep room snapshots outside public directories and out of version control.
- Use HTTPS for deployed traffic.
- Configure exact allowed origins.
- Trust forwarded client-address headers only from verified proxy addresses.
- Do not expose session tokens or private state in logs.
- Remember that the current file store and in-memory limits are single-process controls, not distributed security infrastructure or DDoS protection.

## Supported versions

Security fixes should target the current default branch. Older commits and unmaintained branches are not guaranteed to receive fixes.
