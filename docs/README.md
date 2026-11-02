# Documentation index

Use this page to find the right project document. The root [README](../README.md) is the public project overview; this index is for maintainers and contributors.

## Start here

| Document | Purpose |
| --- | --- |
| [Project overview](../README.md) | What the game is, its features, technology, and local quick start |
| [Repository instructions](../AGENTS.md) | Current engineering rules, source-of-truth map, and verified gameplay contract |
| [Architecture](ARCHITECTURE.md) | Runtime components, data flow, trust boundaries, and scaling model |
| [Development guide](DEVELOPMENT.md) | Local setup, configuration, tests, builds, and contribution workflow |
| [Contributing](../CONTRIBUTING.md) | Branches, commits, reviews, and pull requests |
| [Security policy](../SECURITY.md) | How to report a security concern |
| [AI-assisted development](AI_ASSISTED_DEVELOPMENT.md) | Transparent and reviewable AI-assisted development practices |
| [Architecture decisions](decisions/README.md) | Technical choices and their trade-offs |

## Engineering references

- [Static delivery performance](PERFORMANCE.md) — gzip negotiation, lossless WebP delivery, cache behavior, and verification.

- [Scale and security report](SCALE_AND_SECURITY.md) — implementation details, local load measurements, security controls, and operational limits. Read its dated scope note before using the measurements.
- [Game glossary](GLOSSARY.md) — Vietnamese game terminology.
- [Project completion record](PRODUCT_FINISH.md) — product/content and deployment notes as recorded on 31 October 2026.

## Implementation and verification records

These documents preserve the scope, decisions, and test evidence from specific implementation tasks:

- [In-game removal and admission](GAME_KICK_AND_ADMISSION.md)
- [Lobby recovery and load test](LOBBY_KICK_AND_SOAK.md)
- [Brand and card finish](BRAND_AND_CARD_FINISH.md)
- [Native HD card images](CARD_HD_FIX.md)
- [Video endings and card QR links](ENDINGS.md)
- [PC gameplay redesign](PC_GAME_REDESIGN.md)
- [Entry-page redesign](UI_REDESIGN.md)

They are dated records, not live monitoring. A statement such as "local", "uncommitted", or "not deployed" describes the state at the time that document was written. Use the current Git history and source/tests for repository state; verify Vercel and Render separately before making claims about the live deployment.

## Historical briefs and superseded plans

- [Earlier UI refactor brief](UI_REFACTOR_BRIEF.md) — contains older fixed-layout and player-cap assumptions that later owner decisions superseded.
- [Earlier lobby redesign](LOBBY_REDESIGN.md) — design record for an earlier lobby pass.
- [Earlier reset plan](NEXT_RESET_PLAN.md) — planning snapshot; its 12-player ceiling and reject-player-13 criteria are explicitly superseded.

These files are retained for context. Do not treat them as current requirements when they conflict with AGENTS.md, later implementation records, or the current source code.

## Documentation rules

- Keep the root README focused on onboarding; put engineering detail here.
- Use links relative to the document containing them.
- Date time-sensitive findings and include the command or test that supports them.
- Distinguish verified behavior from proposals, assumptions, local measurements, and hosting limits.
- Update the relevant guide when a command, configuration variable, or system boundary changes.
