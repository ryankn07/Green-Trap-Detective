> Current owner override, 2026-11-01: the original fixed-layout/8-player statements below are historical. Current PC design uses one horizontally scrolling player box; mobile retains its vertical panel. No hardcoded maximum of 12. See SCALE_AND_SECURITY.md.

# GREEN IMPACT — UI Refactor Brief for Codex

## Objective

Correct the existing gameplay UI so it represents the real GREEN IMPACT rules and server data. **Keep the current mockup and its layout direction. Do not redesign the product from scratch.** The task is primarily a UI/data-flow correction, not a gameplay rewrite.

The intended desktop composition has four functional columns/areas, preserving the approved mockup:
1. Player list.
2. Large central project card — the visual focal point.
3. Current player's wallet, private role, and phase-specific actions.
4. Public discussion / submitted-statement feed.

Keep the existing relative arrangement from the mockup. In particular, the project card must remain large and visually dominant; the wallet/action area belongs beside it, not as a replacement for the card. On narrower screens, collapse responsively without horizontal overflow while keeping the card prominent and controls usable.

## What to preserve

- Existing overall mockup, visual identity, typography, colors, spacing, and component styling wherever they are already sound.
- Four functional columns/areas described above.
- Original Canva card artwork from `ui/cards/PROJ_01.png` through `PROJ_25.png`. Display the selected card image at full aspect ratio with `object-fit: contain`; do not crop, redraw, recolor, regenerate, or replace it.
- Player list, but make it scroll within its panel when it grows.
- Phase/progress header, but make its state and timing truthful.
- A personal action panel whose controls change with the real phase.
- A discussion area, but it is a feed of submitted public statements, not a free-form chat room.

## Actual phase model

Use the engine's phase values, not UI-invented stages:

| Engine phase | Duration | UI meaning |
|---|---:|---|
| `DEBATE` | 120 s | Players submit one public statement about the current project. |
| `BLIND_ACTION` | 60 s | Players privately lock their investment and optional bank action. |
| `REVEAL` | 25 s | Show the public round result and each player's own private inspection result. |
| `GAME_OVER` | No active timer | Show the final outcome and the roles now made public by the engine. |

The normal flow is `DEBATE → BLIND_ACTION → REVEAL → next round's DEBATE`, or `REVEAL → GAME_OVER` when the engine ends the game. There is **no separate VERIFY, INSPECT, or EXPEL phase**. Inspection and expulsion are bank actions submitted during `BLIND_ACTION`.

The server provides `phase`, `serverTime`, and `deadline`. Calculate remaining time from the server deadline and server time, accounting for the actual phase duration. Do not parse translated phase text to guess the duration. The server owns phase transitions and timeout defaults.

## Four-area UI requirements

### 1. Player list

- Show public identity/status only: name, online/alive status where available, and progress indicators such as `hasStatement` or `hasLockedAction`.
- Allow vertical scrolling inside the player-list panel instead of stretching the whole page.
- Do not show another player's role, coin balance, inspection history, bank target, investment choice, or expulsion contribution.
- The current server room limit is 8 players, even though the engine setup accepts up to 12. Keep the UI truthful to the current room manager; do not silently change the cap.

### 2. Large central Canva project card

- The card is the primary visual element. Keep it large and readable.
- Use the exact original image at `/cards/{project.id}.png` (or the existing verified card-serving path). Preserve the entire image and its original aspect ratio.
- No card picker, deck browser, card carousel, or player-controlled project selection. The server selects the project.
- Do not invent COST, REWARD, resource, or score values. The current player-facing project projection includes the project ID, title, description, and glossary; alignment, verdict label, and explanation are hidden until reveal. Only show extra fields if they exist in the actual project data and are permitted in the current phase.
- Keep accessible text/fallback information so the project remains understandable if the image fails to load.

### 3. Current player's wallet, role, and action panel

- Wallet value comes only from `game.myPlayer.coins`. Remove plus/minus money controls and any manual balance editing.
- Investment is a binary choice: invest 0 or 1 coin. It is not an arbitrary amount selector.
- Investment and a bank action are **not mutually exclusive**. The same locked submission may contain `invest: true/false` and one `bankAction`, provided the total cost is affordable.
- Supported bank actions:
  - `NONE`: no bank action, cost 0.
  - `INSPECT`: choose one other living player, cost 3 coins.
  - `EXPEL`: choose one other living player and a contribution from 1–5 coins; that amount is the cost.
- Total cost is investment cost (0 or 1) plus bank-action cost. Show a clear live affordability calculation using the player's actual wallet. The server remains authoritative and validates the final submission.
- Once the player locks the action, show a locked/confirmed state and disable editing. Do not imply that the action is a draft or can be changed.
- The private role card may only be shown to its owner, using the existing safe reveal interaction. Do not render hidden roles for other players.
- Do not show another player's chosen investment or bank action.

Phase-specific panel:
- `DEBATE`: show the statement form and optional stance (`SUPPORT`, `OPPOSE`, `UNSURE`). Enforce the 1–500 character range in the UI and disable resubmission after the player's statement is accepted.
- `BLIND_ACTION`: show the binary investment option and one bank-action selector. Allow both to be selected together if affordable. After lock, show only the current player's own locked choice.
- `REVEAL`: show the result and the current player's own inspection record(s), if any. Do not create a new inspection phase.
- `GAME_OVER`: show final outcome and roles only because the engine now exposes them.

### 4. Public discussion / statement feed

- This is not a chat application. Do not add arbitrary messages, replies, reactions, or a free-chat composer.
- During `DEBATE`, render submitted statements from `game.currentStatements`, including the public stance when supplied.
- Preserve the per-player one-statement rule. Use player IDs from the snapshot to associate statements with names.
- In `REVEAL`, use the round's public statement history from `game.history`.
- Empty states should explain that statements will appear as players submit them.

## Rules that the UI must not misrepresent

- Investment approval is determined by the engine's majority threshold: `ceil(livingPlayers / 2)`.
- Investors pay 1 coin even if the project is not approved. The engine's payout applies only when the investor's role matches the project's alignment.
- Inspection costs 3 coins and its result is visible only to the player who made that inspection.
- Expulsion contributions are pooled by target. A target is expelled at a pooled total of at least 5. Do not display individual hidden contributions to the table.
- The public reveal may show project verdict/explanation, approval counts, and newly eliminated players because those fields are included in the reveal projection. Do not invent a public breakdown of who paid what.
- Timeout behavior is server-controlled: missing debate statements become the server's default `UNSURE` statement; missing blind actions become no investment and no bank action.

## Implementation order

1. **Audit first.** Inspect the actual current worktree, `git status`, the UI renderer, engine, view projection, room manager, and server routes. Confirm the exact data shape used by the browser before editing.
2. **Resolve repository integrity blockers.** At the handoff baseline, `ui/index.html` loads `/app.js`, served from `public/app.js`, and `server/rooms.cjs` imports `engine/dist/data/projects.json`; those paths were not present in the tracked GitHub tree. Inspect the local workspace, ignored files, runtime bundle parts, and history. Do not fabricate replacements. If either dependency is genuinely missing, report it and avoid claiming the app runs.
3. **Map the current mockup to the four areas.** Keep the existing visual hierarchy and identify which current DOM nodes/data belong in each area.
4. **Correct the UI structure and phase-specific controls** using the engine's existing contract. Do not change engine or server gameplay rules.
5. **Refactor `ui/card-ui.js` and `ui/style.css`** after the structure/data mapping is correct. Avoid fragile repeated DOM relocation if the real renderer can produce the intended structure directly.
6. **Verify** all phases, player counts within the current 3–8 room limit, private-information boundaries, card image integrity, and responsive behavior.

## Acceptance checklist

- [ ] Existing mockup is preserved; this is not a visual redesign.
- [ ] Desktop gameplay has four functional areas in the approved arrangement.
- [ ] Project card is large, central, original, complete, and uncropped.
- [ ] Player list scrolls internally and reveals no private player data.
- [ ] Progress reflects the real engine phase and server deadline.
- [ ] Only the four real engine states are represented; no invented verification/expulsion phase.
- [ ] Debate form follows one-statement-per-player and valid stance/length rules.
- [ ] Blind action allows investment and one bank action in the same submission when affordable.
- [ ] Investment is 0/1 coin; inspect is 3; expel contribution is 1–5.
- [ ] No plus/minus wallet controls or invented resources/rewards/costs.
- [ ] Locked actions cannot be edited and remain private from other players.
- [ ] Inspection results are visible only to the inspecting player.
- [ ] Discussion panel displays submitted statements, not free chat.
- [ ] Reveal and game-over content matches the server projection.
- [ ] Desktop, tablet, and mobile layouts have no horizontal overflow.
- [ ] Changed JavaScript passes `node --check`; all other reported checks were actually run.

## Scope boundary

This task is a **frontend/UI correction**. Do not modify `engine/**` or `server/**` to accommodate the mockup. If an actual engine/server defect blocks the UI, explain the evidence and propose the smallest backend change separately before making it.
