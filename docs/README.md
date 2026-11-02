# Documentation index

This page is the entry point for repository documentation.

## Start here

| Document | What it covers |
| --- | --- |
| README.md | Project overview, stack, quick start, scripts, and limitations |
| AGENTS.md | Repository-specific instructions and non-negotiable engineering rules |
| docs/ARCHITECTURE.md | Runtime components, data flow, trust boundaries, and scaling model |
| docs/DEVELOPMENT.md | Local setup, configuration, tests, builds, and contribution workflow |
| CONTRIBUTING.md | Branch, commit, review, and pull-request process |
| SECURITY.md | How to report a security concern |
| docs/AI_ASSISTED_DEVELOPMENT.md | Transparent and reviewable AI-assisted development practices |
| docs/decisions/ | Architecture decision records and technical trade-offs |

## Engineering references

- docs/SCALE_AND_SECURITY.md — implementation notes, capacity boundaries, security controls, and test evidence.
- docs/UI_REFACTOR_BRIEF.md — task-specific UI requirements; verify against the current engine and server before making changes.
- GLOSSARY.md — Vietnamese game terminology.
- docs/PRODUCT_FINISH.md — recorded product and deployment decisions at the time it was written.

## Design and implementation history

The following documents record specific design briefs, fixes, or earlier plans:

- docs/BRAND_AND_CARD_FINISH.md
- docs/CARD_HD_FIX.md
- docs/GAME_KICK_AND_ADMISSION.md
- docs/LOBBY_KICK_AND_SOAK.md
- docs/LOBBY_REDESIGN.md
- docs/NEXT_RESET_PLAN.md
- docs/PC_GAME_REDESIGN.md
- docs/UI_REDESIGN.md

These documents are useful context, but they are not automatically current specifications. Some contain dated assumptions or superseded proposals. For current behavior, use the source code and tests as the final authority; use AGENTS.md for repository-wide constraints.

## Documentation rules

- Keep the root README concise and focused on onboarding.
- Put architecture and operational detail in docs/.
- Date time-sensitive findings and include the command or test that supports them.
- Distinguish verified behavior from proposals, assumptions, and hosting limits.
- Update the relevant guide when a command, configuration variable, or system boundary changes.
