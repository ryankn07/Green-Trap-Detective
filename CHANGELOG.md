# Changelog

Notable repository and product changes are documented here.

This project follows a lightweight Keep a Changelog structure. Entries describe user-visible or maintainer-relevant changes; routine internal commits remain in Git history.

## [Unreleased]

### Fixed
- Keep removed-player pencil marks on a matching dark ending tile, without the former pale rectangle.
- Retire completed rooms immediately, release admission reservations and preserve authenticated ending results independently.
- Prevent early timer wakeups from adding an unintended polling cycle to the serverless soak check.

### Changed
- Remove the ending card gallery and keep Truth verdict text green across reveals and journals, including Bad Ending.
- Show ending films across the full content width; remove QR codes and scan instructions following the team's approved direct-video decision.
- Simplify Vietnamese player-facing copy, use consistent action/statement terms and clarify that phase changes wait for the server deadline.
- Serve all 32 native HD cards through pixel-exact lossless WebP derivatives when supported, retaining the original PNG assets as fallback.
- Negotiate and cache gzip-compressed static text responses on the Node server while preserving byte-identical identity responses.
- Reduce homepage hero image transfer by using lazy low-resolution thumbnails for the two decorative side cards while retaining native HD previews and the full gameplay HD catalog.

- Align maintainer instructions with the current Green Trap Detective design and runtime boundaries.
- Add a linked documentation index and clarify the historical scope of dated implementation reports.
- Document the legacy frontend files retained by the runtime recovery bundle.

### Added
- Play the two-second vote-out motion on in-match player tiles at turn resolution, including a brief inert-board presentation before a final-vote ending.
- Strike through eliminated player names and show final elimination causes, with all successful expulsion contributors disclosed only after game over.
- Inline green/red kick confirmation and server-confirmed pencil strike-through effects on player tiles.
- Full-screen animated phase introductions with mobile layouts, owner-requested demo motion across motion preferences and snapshot-based deduplication.
- Winner-based Good/Bad Ending videos, an animated final screen and full last-round reveal.
- Repository architecture, development, contribution, security, and AI-assisted development guides.
- Automated repository checks for JavaScript syntax, project records, and original card assets.
- Pull request and issue templates, plus consistent editor and Git attributes.
