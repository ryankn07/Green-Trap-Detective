# GREEN IMPACT — UI design finish

Date: 2026-11-01. Git baseline: `4b7eb19f3402cfbec7b14ede1a7ed92453f32b6d`.

## Delivered design

The owner requested a full visual redesign, superseding the older instruction to preserve the mockup. The entry page now uses warm paper, forest ink, self-hosted Vollkorn and Hanken Grotesk with Vietnamese subsets, larger original project cards, two distinct room forms, botanical linework and layered terrain. Pointer movement gently moves the terrain; reduced-motion, touch and hidden-page states suppress it. The decoration is hidden in the lobby/game.

The product name remains the identity. Removed notes, statistics, invented logo and duplicate header actions stay removed. The original form IDs, constraints and handlers are retained. The 32 Canva PNGs are unchanged. Only the white export padding around the three home previews is hidden using the owner-approved CSS outlines.

Desktop keeps artwork and forms alongside each other. Tablet keeps the artwork beside the introduction and balances the two forms below. Phones put the forms before the artwork. The original game layout keeps its four areas and now shares the body font and paper palette.

## Skills and execution

Taste Skill and Hallmark were installed and executed only inside Vercel Sandbox, not into the user's Windows skill directories. The final direction combines Hallmark Garden (dealt 1/3) with Taste Accent ladder (current draw seed 100693831). Existing token names are retained instead of introducing parallel imported stylesheets. Garden's type/material reference was visually checked; its layout and example content were not copied.

The owner explicitly authorized source and 32-card transfer to the replacement sandbox `green-impact-design-finish-2`. No .git, .env or credentials were included. A public source-transfer endpoint was rejected and was not used; assets went through sandbox commands. The final runtime served only the ordinary app and allowlisted static assets. All results were copied back, matching source/font hashes and card hashes were verified, and Vercel confirmed the sandbox stopped.

The only server addition is a strict allowlist for four font binaries and their two OFL licenses. CSP, room APIs, game engine, private projections, economy and rules are unchanged. There are no new application dependencies. Font installation means project asset files, not an OS font installation.

## Verification

- Final sandbox suite: **11 passed, 0 failed, 0 skipped**, including both existing Chromium browser tests. Coverage includes game phases, role/privacy boundaries, draft/locked-action persistence, room recovery, viewport behavior and image fallback.
- New public HTTP regression test: local Latin/Vietnamese font files return valid WOFF2; unknown and traversal paths return 404. It failed with 404 before the route and passed after implementation. It also passed locally with the required loopback permission.
- Hallmark on the actual HTTP page and stylesheet: **0 FAIL, 0 WARN, 1 WAIVED**. Rule 80 is recorded as waived because the owner explicitly requested graphics implemented with JS/elements; SVG scenery stays behind the actual original artwork.
- Taste at 1440, 768, 390 and 320 px: **0 FAIL, 0 WARN**. Two explicit allowances retain the selected warm Garden palette (`palette-cream`) and the entry headline's scale (`app-title-size`). These are intentional design choices, not claims of passing unmodified app defaults.
- Manual browser: local images load; card dialog opens; create/leave works; the scenery disappears in the lobby. In reduced-motion emulation, the terrain's pointer transform resets and stays absent; emulation was cleared afterward.
- Keyboard at 320 px: Enter opens a card, focus enters its dialog, Esc closes it and focus returns to the originating card. No horizontal overflow was observed. This does not claim testing a physical phone's software keyboard.
- Syntax, whitespace and runtime-package parity checks passed. Code/font copy parity was verified after LF normalization. Card-byte hashes matched exactly.

## Review

Standards review: the final integration retains vanilla HTML/CSS/JS and the existing Node server. The font route rejects all names outside its allowlist; preview sources are restricted to the existing project-card route. Decorative SVGs are aria-hidden and do not capture pointer input. No open issue was found in this scoped review.

Spec review: the complete entry composition changed; original art and game rules remain. The requested removals are preserved and no new marketing notes, metrics or duplicate actions were added. No open requirement was identified in this scoped review. This was the primary integrator's review, not a claim of an independent source audit.

Antigravity CLI (Gemini 3.8 Flash Low) returned four text-only QA suggestions in 9.15 seconds. It received a brief, not source or images, and did not inspect this design or execute tests. Its Enter/Esc/focus suggestion was checked in the actual browser. Advice about Space on a native link and custom per-field errors was not adopted blindly. No helper-written code was applied.

## Artifacts and release

Local preview: http://127.0.0.1:3031/ . Desktop/mobile screenshots and `EE_DESIGN_FINISH_CHECKS.json` are under the parent workspace's outputs directory. The check record includes the local-copy/source and card SHA-256 values. Antigravity's raw response and bounded QA advice are retained there as well.

The redesign is uncommitted and has not been pushed or published. The existing live release was not changed by this design task.
