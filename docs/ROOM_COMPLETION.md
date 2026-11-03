# Immediate room cleanup — 3 November 2026

Owner request: clean up a room as soon as its game ends, rather than retaining finished games against the per-source admission limit.

## Active rooms and final results

`RoomManager.changed()` removes a `GAME_OVER` room from the active map before saving the mutation. File snapshots and the singleton remote snapshot therefore omit it immediately. Its room/seat admission reservations are released even when local test bots remain online. Failed persistence restores the active room and does not publish an uncommitted result. Startup also removes completed games from older saved snapshots while retaining unfinished rooms.

The final result is separate from an active room: the Node process keeps at most 100 authenticated final results for two minutes, without renewing their lifetime on reads or presence updates. Existing player tokens are still required and kicked tokens remain revoked. Completed rooms cannot accept joins or new game commands. This short result cache does not consume active room/seat quotas and is not saved in the Node room file.

SSE sends each remaining participant their final projection and closes the stream. The browser stops polling/reconnecting at game over, retains the video element, and saves its own authenticated final projection in session storage. Refresh can restore that ending after the server's result cache is gone. Going home clears the stored result along with the session. Original winner rules, phase durations and card/media files are unchanged.

## Vercel/Supabase

Apply `supabase/migrations/20261103_release_finished_rooms.sql` after the existing serverless migration before deploying the updated Function. One private `green_trap_trial.rooms` table holds both active games and short final-delivery records. Completed games immediately stop counting toward every admission budget. Authenticated `finish_leave` commands delete the row once all remaining participants have departed; receipt replay still works after deletion. Terminal records cannot be written back into an active phase.

New clients advertise `x-game-result-cache: 1`. New rooms keep `completionProtocol: 1` only while every observed client supports cached endings; any older client conservatively disables this capability for that room. Compatible rooms receive a fixed two-minute delivery expiry at completion, never extended by reads or departure writes. Older rooms retain the existing four-hour delivery behavior during rollout, and the migration does not shorten existing rows. The existing rate-limit RPC physically purges expired records. Browser refresh restores the locally cached ending even after the server row is gone. Database access remains service-role-only.

The optional real-SQL regression uses an isolated PGlite installation through `PGLITE_MODULE_PATH`; it checks legacy preservation, immediate quota release, expiry, stale writes, resurrection prevention, receipt replay, purge and privileges. Hosted application is recorded separately in the release evidence.

## Verification

Tests cover immediate active-map/file removal with online bots, replacement admission after hitting the 10-room source limit, legacy-file cleanup, failed-write rollback, terminal SSE delivery/close, health counts, cross-invocation polling results, credential boundaries, result expiry without extension, and ending/video/refresh behavior after the server record is removed. Local test controls remain outside the Git checkout and build.
