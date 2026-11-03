# Immediate room cleanup — 3 November 2026

Owner request: clean up a room as soon as its game ends, rather than retaining finished games against the per-source admission limit.

## Active rooms and final results

`RoomManager.changed()` removes a `GAME_OVER` room from the active map before saving the mutation. File snapshots and the singleton remote snapshot therefore omit it immediately. Its room/seat admission reservations are released even when local test bots remain online. Failed persistence restores the active room and does not publish an uncommitted result. Startup also removes completed games from older saved snapshots while retaining unfinished rooms.

The final result is separate from an active room: the Node process keeps at most 100 authenticated final results for 15 minutes, without renewing their lifetime on reads or presence updates. Existing player tokens are still required and kicked tokens remain revoked. Completed rooms cannot accept joins or new game commands. This short result cache does not consume active room/seat quotas and is not saved in the Node room file.

SSE sends each remaining participant their final projection and closes the stream. The browser stops polling/reconnecting at game over, retains the video element, and saves its own authenticated final projection in session storage. Refresh can restore that ending after the server's result cache is gone. Going home clears the stored result along with the session. Original winner rules, phase durations and card/media files are unchanged.

## Vercel/Supabase

Apply `supabase/migrations/20261103_completed_results.sql` after the existing serverless migration before deploying the updated Function. The SQL atomically moves completed payloads from `green_trap_trial.rooms` to a private `completed_results` table, preserving request receipts and compare-and-swap versions. Only active rooms count toward admission. The read RPC can retrieve final results for 15 minutes; limit cleanup physically purges expired results. Public/anonymous/authenticated database roles cannot access the table or private RPCs.

The migration backfills older completed rows. It has been executed against an isolated PostgreSQL-compatible runtime with quota release, expiry, stale-write, replay and access-control checks. It has not been applied to a hosted Supabase project as part of this local change.

## Verification

Tests cover immediate active-map/file removal with online bots, replacement admission after hitting the 10-room source limit, legacy-file cleanup, failed-write rollback, terminal SSE delivery/close, health counts, cross-invocation polling results, credential boundaries, result expiry without extension, and ending/video/refresh behavior after the server record is removed. Local test controls remain outside the Git checkout and build.
