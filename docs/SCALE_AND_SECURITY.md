# Larger rooms and baseline security

Implemented locally, 2026-11-01. Nothing was committed, pushed or deployed.
Starting HEAD: 4b7eb19f3402cfbec7b14ede1a7ed92453f32b6d; the existing UI/branding/HD worktree was preserved.

## Owner requirement and correction

The owner requires support for groups greater than 10, with no agreed final player count. The initial plan incorrectly treated 12 as the maximum. That assumption is superseded: both engine upper-bound checks and the room/store hardcoded limits were removed. The existing minimum to start remains 3; the clarification concerned supported scale, not an instruction to prohibit small groups.

`ROOM_MAX_PLAYERS` is an optional operator policy, unset by default. It is validated at startup, used by the manager and exposed as nullable `room.maxPlayers`. The client only displays a maximum when configured. An operator limit does not make older, larger saved rooms invalid on load. There remain separate process resource budgets (100 rooms, 1200 total player slots/SSE, 1500 sockets). These are overload guards, not a claim that a small hosting instance can sustain those numbers.

The role formula, costs, timers, 10-round deck and win conditions were retained. PC member lists use one horizontal scroll box; mobile retains vertical scrolling. Scroll positions, focused member box, statement draft and caret survive live rerenders. Native Canva HD sources remain unchanged.

## Security changes and verified boundaries

- All write bodies must be JSON objects; an 8000-byte boundary is enforced on streamed bytes. Malformed/null/array bodies return 400, unsupported media types 415 and oversize 413. Unexpected errors return generic 500 responses, not paths/messages. Existing CSP and static whitelists remain.
- Foreign Origin on API writes is rejected. `PUBLIC_ORIGIN` optionally pins the canonical origin; otherwise the host must match. Bearer authentication is still required; Origin checks are not authentication.
- Submit includes gameId/round/phase. Old-round commands return 409 without mutation; concurrent duplicate submits accept only one. Host identity is derived from bearer, not payload. Engine validation continues to reject invalid target, self-target, bad amount, invalid investment type and unaffordable total cost.
- API rate limits: create 30/minute/IP, join 180/minute/IP, general API 3000/minute/IP; authenticated actions 60/minute/player, state 120, reconnect 30. Responses include Retry-After. Buckets expire and the map cannot exceed 10000 entries. Forwarded IPs are ignored by default; explicit trusted proxy addresses are walked from the socket right to left. Same-NAT 100-player accelerated play passed locally. Actual hosting proxy topology has not been inspected or configured.
- SSE broadcasts coalesce simultaneous room changes over 16ms. A slow writer retains at most the latest pending full snapshot, drains in order and is disconnected if blocked for 10 seconds. Empty subscription groups are removed. Replacing a player's stream keeps them online until the final stream closes. Request/header timeouts bound slow uploads.
- Synchronous persistence still precedes successful acknowledgement. A write error rolls back room membership/revision/state; failed room removal restores the room. Clock/disconnect errors are caught without printing credentials or raw internal messages. File snapshots contain secrets and must remain outside public routes/Git, as before.

Raw HTTP tests and the load-reader assertions verify that public player arrays omit coins, locks and inspections, that roles remain hidden before GAME_OVER, and that current project alignment remains hidden in DEBATE/BLIND_ACTION. The viewer's own private projection remains available to that viewer. A name containing `<svg onload=alert(1)>` was rendered as text in the connected browser, with no injected SVG in the member list.

## Load measurements

Windows, Node v24.14.0, AMD Ryzen 7 H 255, 16 logical CPUs. Real HTTP commands and simultaneously open SSE readers; temporary FileRoomStore with synchronous fsync; real 10-round engine with accelerated deadlines; no investment to avoid early elimination; 12 concurrent native HD asset downloads per scenario. Each command is timed from POST start until its player's matching statement/lock is observed in SSE. All clients' private projections are checked. No browser rendering is measured, and there is no real-device/WAN or live-host capacity claim.

| Scenario | Commands | p50 | p95 | Event-loop p95 | RSS at sample |
|---|---:|---:|---:|---:|---:|
| 1 room × 12 | 240 | 56 ms | 85 ms | 53 ms | 146 MiB |
| 5 rooms × 12 | 1200 | 446 ms | 578 ms | 396 ms | 233 MiB |
| 1 room × 25 | 500 | 139 ms | 171 ms | 117 ms | 208 MiB |
| 1 room × 50 | 1000 | 343 ms | 398 ms | 281 ms | 299 MiB |
| 1 room × 100 | 2000 | 810 ms | 983 ms | 539 ms | 370 MiB |

The 100-player burst is close to the 1-second local target, with significant event-loop and bandwidth cost; it is not evidence of spare production capacity. A test of the 1200-slot guard only verifies admission bounds, not 1200-player performance. Larger production scale requires measurements on the selected host. Multi-process deployment still needs a shared store and distributed admission/rate controls.

Coalescing broadcasts reduced the 60-session trial from roughly 807ms p95 / 232MB SSE traffic to 578ms / 45.5MB in this local setup. An initial immediate-close-on-backpressure approach failed the load test and was replaced by bounded latest-snapshot draining.

## Verification and review

Connected-browser checks with 50 members: PC widths 1200/1440/1920 scroll horizontally inside the box; mobile widths 320/390/430 scroll vertically, no page horizontal overflow. Member count is 50 with no `/12`. Lobby, DEBATE, BLIND_ACTION, REVEAL, GAME_OVER rendered; a real public statement submitted successfully. Scroll offset 80, statement caret 46 and draft/focus survived a local SSE pulse. Names with HTML metacharacters remained escaped. This used local visual fixtures, not a remote multiplayer playtest.

Two review axes were applied: standards (vanilla stack, privacy projection, no dependency additions, resource bounds) and spec (unknown upper room size, correct scroll directions, preserved artwork/mobile). A redundant SSE frame reparse was removed during review. Persistence error rollback and concurrent submit/join tests were added after review. ChatGPT web provided bounded text-only review advice from a summary; it did not receive source or run tests. Antigravity CLI was attempted but authentication timed out, so it contributed no review result. Dot was not used, as requested.

Evidence in the parent outputs directory: LOAD_12_60.json, LOAD_25_50.json, LOAD_100.json, ROOM_LARGE_UI_CHECKS.json, ROOM_LARGE_PC.png, ROOM_LARGE_MOBILE.png. The optional Playwright tests require an external module path and remain skipped; browser checks above ran separately through Computer Use. Final test counts and syntax/bundle checks are recorded in FINAL_SCALE_CHECKS.txt.

## Operational limits

No promise of DDoS immunity, participant identity verification or fair play against colluding humans. A shared room code permits joining before start; session theft can control that player's seat. Snapshot durability across deploys depends on persistent storage; ephemeral hosting cannot supply it. Proxy trust must be validated before production configuration changes. No new paid services, deployment or external credentials were created.
