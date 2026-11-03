# Website motion plan — 3 November 2026

Status: implemented, verified and live at https://greentrap.vercel.app/ through PR #34, application commit `27ec9046cdeb53063b0cbe87e1a2eef33fe4538d`. Original baseline: main `9a7eed2ce997a868a9417d19899bd10253fd1b7d`. Verification details: `docs/MOTION_VERIFICATION_20261103.md`.

The owner assigns this work to effects, independently of Plus 2's visual-design proposal. The motion direction below is authored for the investigation/card-game interaction; it does not adopt Plus 2's proposed palette, materials, composition or redesign. Existing product assets, game rules and functional layout remain authoritative.

## Motion idea

Treat a round as a dossier arriving on a table and the reveal as its conclusion being disclosed. That is the focal sequence. Routine actions use quieter, faster feedback. Transitions explain real state changes instead of adding decorative loops.

| Priority | Trigger | Proposed effect | Timing target |
|---|---|---|---|
| P1 | Own statement accepted / own action locked | Form contracts; public discussion moves into released space with continuous motion. Controls remain responsive. | 220–280 ms |
| P1 | New round/project confirmed | Original card settles onto the table with a short translation and subtle rotation, then becomes completely still. No invented card back or altered artwork. | 250–350 ms |
| P1 | Authoritative REVEAL begins | Approval result appears, then verdict/explanation and public counters receive a restrained reveal/stamp accent. Content and controls are available immediately; decoration never delays access. | One sequence, at most 450 ms |
| P2 | Own confirmed wallet changes | Original coin gives one small emphasis; the own balance change is highlighted once. Preserve the exact current value and private scope. | 150–220 ms |
| P2 | New public statement / lobby member | Newly added item appears with a small displacement. Existing items remain still; preserve reader scroll and focus. | 120–180 ms |
| P2 | Form submission pending / success / failure | Immediate button feedback and clear pending state; confirmed success integrates with collapse. Failure preserves the form and draft and highlights the existing error. | 100–150 ms feedback |
| P3 | First home-page visit / open-close panels | One entrance for the supplied card fan; short panel transitions. Reuse existing copy toast/edge acknowledgment and role controls. | Home at most 450 ms; panels 150–220 ms |

## Scope and boundaries

- In: a separate, lightweight motion layer for home, lobby, active gameplay and existing control feedback; desktop first, then reduced mobile motion without changing mobile geometry.
- Out: a new design system, replacement layout, new claims/mechanics, asset conversion, sound/autoplay, persistent particles, extra status notes or counters, backend changes, and the separately owned ending/video implementation.
- Do not animate role disclosure automatically. Hide private artwork immediately on release, cancel, blur or page hiding; never retain a ghost copy during a transition.
- Use the current DOM as the integration boundary. Avoid style overrides that change the design or observers that reconstruct layout. Separate proposed `ui/motion.css` and `ui/motion.js` from the main visual stylesheet. A small renderer lifecycle hook may be required during implementation; assess it against current main then.

## Ordered implementation checklist

1. [x] Inventory actual motion triggers and current source revision, then establish short feedback, layout-transition and focal-sequence durations. Preserve existing author-owned ending effects.
2. [x] Prototype the submit/lock expansion-collapse sequence on the existing PC layout. Compare before/after snapshots and animate only on confirmed state changes.
3. [x] Implement the new-project entrance using original card artwork. Trigger once per game/round/project, not per poll or reconnect.
4. [x] Implement the reveal focal sequence without hiding, delaying or inferring any authoritative result. Respect the server deadline and immediate next-action availability.
5. [x] Add own-balance and new-public-statement feedback. Key events by stable identity and preserve the message-list reading position.
6. [x] Add bounded home/lobby/panel feedback and reuse existing copy acknowledgment; prevent double animation of controls that already have an effect.
7. [x] Verify interruption, rapid repeated actions, replayed snapshots, reconnect, page hiding, keyboard use, reduced motion and narrow screens. Retain all current draft/privacy/layout/ending regressions.
8. [x] Capture actual before/after motion evidence, profile a representative PC/mobile-emulation session, and commit each verified unit. Release only the tested integration with current main.

Implementation uses the Web Animations API in a separate motion module with no new dependencies. Drawer feedback is opacity-only so its bounds remain inside narrow viewports; closing and private-role hiding remain immediate. The reveal uses one brief accent on the existing result rather than delaying its individual text blocks.

## Implementation acceptance criteria

- Compare the previous accepted snapshot with the next accepted snapshot. Same-revision polling, presence-only changes, stale snapshots and reconnect replays must not replay effects. Cancel obsolete animations when a new phase/state arrives.
- Ordinary feedback acknowledges the input immediately; a success accent occurs only after acknowledgment. Motion never postpones game state, API calls, timers, interaction, focus restoration or error recovery.
- Use CSS/Web Animations where sufficient; no new motion dependency. Batch measurements and transforms for the middle-column transition; avoid full-page blur, repeated forced layout and permanent `will-change`.
- Reduced motion removes translation/rotation and uses brief, static state/color emphasis. Hidden tabs stop nonessential work. Touch does not acquire desktop hover/parallax behavior.
- Public effects use public data; own-wallet effects use only the authenticated player's data. No opponent role, wallet or hidden decision is suggested by motion.
- Existing layout dimensions, readable original cards, current coin assets, mobile controls and ending playback remain intact. Target smooth motion, then measure; do not claim device-wide frame-rate guarantees from emulation.

## Coordination

This is a motion-only proposal on its own branch. Plus 2 independently owns additional gameplay design. There is no requirement to copy that direction or wait for its visual choices. At integration, preserve each side's functional changes and test actual current main; do not overwrite whole renderer or stylesheet files. Shared-memory publication is a file update, not proof that the other chat has read or acknowledged it.
