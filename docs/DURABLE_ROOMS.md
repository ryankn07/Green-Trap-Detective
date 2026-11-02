# Durable rooms on ephemeral hosting

The default local mode keeps the existing atomic JSON file store. For hosting where files disappear on deployment, the server can instead use the private Supabase snapshot store.

## Configure

1. Run `supabase/migrations/20261102_private_game_snapshot.sql` once as the project owner. It creates only the game schema, singleton snapshot and three server-only RPC functions.
2. Set `GAME_SUPABASE_URL` and `GAME_SUPABASE_SERVICE_KEY` in the backend hosting service's secret environment. Both are required. Never put the key in the Vercel frontend, source, logs or a committed environment file.
3. Start one Node server process. It claims writer ownership and loads a validated snapshot before listening. With remote mode configured, an unavailable or invalid database prevents startup; an empty local file is not substituted.

Local `.env` files are not loaded automatically by `npm start`. For an explicitly configured local check, Node's `--env-file` option can load an ignored environment file.

## Guarantees and limits

- A mutation's HTTP success and SSE snapshots wait for its database commit. Concurrent callbacks are batched before saving the complete snapshot.
- The snapshot preserves room membership, bearer sessions, hidden game state and locked actions. Connection presence is rebuilt when clients reconnect.
- Database RPC access is denied to `anon` and `authenticated`. Browser clients continue to receive only their authenticated player projection.
- Startup atomically claims a writer token. An older process cannot commit or return a verified read after a replacement claims ownership. This supports deployment handoff; it does not support multiple active replicas.
- A failed or ambiguous database operation makes that process return HTTP 503 and close its streams. Restart it after resolving the database problem. No success is reported for an uncertain commit.
- Rate limits and SSE subscriptions remain process-local. Supabase storage does not remove the free backend's cold-start delay or guarantee hosting capacity.

## Verification

`npm test` covers restart recovery, delayed commit acknowledgments, writer fencing between two processes, and competing SSE reconnects using a local HTTP database stand-in. These checks do not verify real PostgreSQL permissions; verify those separately after applying the migration.

An operator test that claims the shared writer must never run against an active production snapshot. Use isolated storage before enabling production. Restoring a file or starting a second server against the same snapshot is an operational change, not a read-only health check.
