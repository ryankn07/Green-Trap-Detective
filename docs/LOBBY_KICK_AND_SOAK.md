# Lobby recovery and measured load finish

Baseline: `47625f42c07e7aa9edbce350ddfc4545c351d8dc`, clean worktree at task start. Owner requests in the current conversation are the spec.

1. Host may kick another attendee in an unstarted lobby, including an offline attendee. Reject non-host, self, foreign/missing target and any game already started. Save removal before acknowledging, close target SSE, revoke old token, update remaining roster; preserve original roster/token on save failure. Show accessible host-only control on PC and mobile without changing game rules.
2. Run50 authenticated cloud protocol clients for600seconds after ready, natural game phases, sample reads and reconnect. Record p95, errors, privacy, reconnects and exact duration; optimize based on measured bottlenecks and compare. This does not imply maximum players or browser rendering capacity.
3. Replace successful invitation-copy alert with subtle viewport-edge glow and small bottom toast “Đã sao chép”, hidden after3000ms. No blocking success dialog. Respect reduced motion and safe-area insets.
4. Inspect the supplied Vercel mobile demo and merge its missing gameplay layout into the shared real multiplayer UI, keeping desktop layout and original HD artwork. Demo-only data/buttons/phase simulation must not replace authoritative engine phases or leak private state.
5. Investigate an alternative to Render free cold-start splash using current official hosting documentation; do not purchase hosting or change billing without authorization.

Verification: public HTTP/SSE kick tests, real browser host/guest flow and mobile controls, existing test suite (report browser skips), cloud600second evidence and component profile. Code review uses this file plus AGENTS.md against the baseline above. No dependency/framework change or mobile-only game server.

## Results before cloud release

- Existing cloud backend at47625f4 completed600.01seconds with50 SSE clients,300 game commands,117 state samples,9 deliberate reconnects and0 request/transport/privacy errors. Action-to-own-SSE p95 was2206.28ms, with later-phase warnings up to2349.43ms; this is not a clean latency pass.
- Profiling found repeated full-snapshot persistence materially larger than projection work. FileRoomStore now reuses serialized unchanged rooms and avoids repeated directory creation. It still synchronously fsyncs and atomically renames before success; cache entries publish after commit. Snapshot format remains version1 JSON.
- Same local5-room/60-client/1200-command benchmark: p95471.52→348.94ms; persistence wall time8310→6453ms. Local measurement is not substituted for an optimized cloud soak.
- Browser QA: host kicked an online guest and guest saw the removal screen; revoked HTTP token rejected. PC and390px mobile shared a real three-person room; mobile OPPOSE statement appeared on PC. HD artwork natural width1414, document width390 without horizontal overflow. Native stance dialog, drawer and full-phase controls require final deployed smoke as well.
-36 tests:34pass,0fail,2browser tests skipped without Playwright configuration. Browser evidence above was collected separately through computer use.
- Shared frontend can be built as static Vercel output; only public assets are copied. Relative API/SSE paths proxy to the Node backend. Configure PUBLIC_ORIGINS explicitly for intended owned frontend origins. Render free can still sleep, but its interstitial no longer owns the frontend document. No paid service or billing change.
- The owner requests a short common domain, preferably greentrap.vercel.app if available. alwaysdata signup currently demands card verification, so registration was stopped without entering personal/card data.
