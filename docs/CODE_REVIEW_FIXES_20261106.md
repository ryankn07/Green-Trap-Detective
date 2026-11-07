# Review fixes — 6 November 2026

The owner approved implementing the eight findings from the full review of
`48e577d`. This change preserves the approved design, gameplay rules, original
artwork and private player projections.

## Rendering and media

- Peer statements, readiness, Skip votes and presence updates within the same
  phase patch the changed content instead of replacing the game board. The
  original project image, editable form, native select, cursor and history
  disclosure stay mounted. Structural changes such as a phase transition,
  own submission or removal still use the full renderer, preserving history
  expansion and any surviving focused control. When the project is unchanged,
  its already-decoded image is retained even across an own-action confirmation;
  this prevents the offscreen mobile investment preview racing image decode.
- Public statement markup remains escaped. `test/live-render.test.cjs` covers
  real peer actions, a removed target, cursor/focus, node identity and an HTML
  payload on desktop and phone.
- Card enhancement ignores text mutations and already-bound pictures. Timer
  flames do not trigger repeated full image scans. The timer label itself is
  written only when the displayed second changes.
- Failed ending sources are caught, with a retry control that reloads the same
  approved film. Tests cover actual HTTP 404 responses and successful recovery
  for both endings.
- Branding uses smaller lossless WebP derivatives through `picture`, with the
  original PNG fallback. The favicon has a separate small derivative. Canonical
  logo, coin and card PNGs are unchanged.

## Server and verification

- Node validates game/round/phase context before advancing from a reveal, just
  as the serverless adapter does. A stale command cannot skip a later reveal.
- The Node room clock checks whether work is due before entering a durable
  transaction. Real reads and writes retain fencing and commit guarantees.
  Repeated identical presence notifications no longer persist a new revision.
- An additive SQL migration combines rate checks and initial room/receipt reads
  into one RPC and throttles global expiry cleanup. Expiry, admission limits,
  private receipts and access controls still apply. See the serverless
  deployment record for the migration and compatibility fallback.
- CI installs pinned browser/PostgreSQL test dependencies and uses a strict
  runner that rejects skipped tests. Runtime dependencies remain empty.
- Removed unused wallet enhancement, CSS selectors, server variables/routes and
  unused room connection maps. The recovery bundle and canonical image assets
  remain supported.

## Delivery boundary

Applying the additive Supabase migration is a separate deployment step; it does
not execute merely by editing, committing or building the repository. Existing
databases remain usable through the documented compatibility path until
migrated. No production data was changed during this work.

The implementation was completed by the Codex review team. ASTRA 6 Ultra began
an independent final audit of the renderer, branding fallback, server context,
combined RPC and CI runner on 6 November. It reported no confirmed defect in
those areas before its review was interrupted by a workspace credit limit. This
record does not attribute the completed implementation or a full audit to ASTRA.

## Verification

- Final strict suite: **169 passed, 0 failed, 0 skipped** with Chrome and PGlite;
  log outside Git: `../outputs/REVIEW_FIXES_FINAL_TESTS.txt`.
- Syntax/assets check: 86 JavaScript files and 25 original project cards. Runtime
  archive parity, static build and whitespace checks pass.
- Brand check verifies every decoded pixel; the two original PNGs also match
  their bytes in Git HEAD. Combined logo/coin payload is 46.1% smaller.
- Actual desktop (1440px) and phone (390px) captures show no horizontal overflow
  or page errors, and use the new WebP sources. Browser tests additionally cover
  failed derivatives falling back to PNG, source-video 404/retry, the offscreen
  touch investment and all existing motion/privacy/layout checks.
- The strict test runner was explicitly checked to reject both skipped tests
  and missing required dependencies. GitHub execution awaits publication; local
  verification does not claim a completed remote CI run.
- The loopback preview at port 3141 serves the current app/card/brand code.
  Disposable preview/test helpers remain outside Git.
