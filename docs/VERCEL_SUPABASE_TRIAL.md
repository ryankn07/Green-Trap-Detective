# Vercel + Supabase trial

Owner-approved isolated preview to remove the Render dependency. Baseline: `ad4fd3fdcc6ee316bd8e231444066de8e59d7835`; branch `codex/vercel-supabase-prototype`. No changes to engine, original artwork, CSS/mobile layout, or ending videos (owned by another Codex).

## Architecture and public behavior

- `api/game.js` handles short Node HTTP invocations in Singapore; no background server, local disk state, writer claim, or process-global room manager.
- Each request reads a fresh room from `green_trap_trial` in the existing Supabase project. The legacy production singleton is never claimed or mutated. This is an isolated schema, **not** a separate database/project.
- Writes compare the database version. Conflicts reload the room and recheck authentication/host/phase; the existing engine determines the result. A receipt bound to the authenticated token (or entry request source), UUID and exact command payload is committed atomically with the room. Failed/ambiguous writes are not blindly retried.
- Database time drives deadlines. Expired phases catch up from their original deadlines when a player requests state. Presence is a 45-second lease, refreshed at most every 15 seconds. Endpoints derive each response through the existing per-player projection.
- Browser sessions returned by the trial use adaptive polling (1.5 seconds plus jitter; at least 10 seconds when hidden; backoff to 15 seconds on errors). Unchanged room revisions update the timer without rerendering drafts. Legacy sessions continue using SSE.

## Preview-only configuration

`vercel.json` on this branch routes directly to the Function. No live alias is switched by preparing this branch. `vercel.serverless.json` is the equivalent explicit trial configuration.

Backend-only Vercel **Preview** variables:

- `GAME_TRIAL_ENABLED=1`
- `GAME_SUPABASE_URL` (existing project URL)
- `GAME_SUPABASE_SERVICE_KEY` (Sensitive secret; never Git/frontend)

Apply `supabase/migrations/20261102_serverless_trial.sql`. All tables are in a private, RLS-enabled schema; only `service_role` can execute the three public RPCs. Expired trial rooms/rate buckets/receipts are cleaned in bounded/expiry-indexed queries. SQL resource ceilings intentionally match the existing operator policy: 100 active rooms, 1,200 active seats, 10 rooms/300 seats per source; no artificial per-room player maximum.

## Verification recorded so far

- HTTP tests alternate separate Function handlers backed by copied persistence records: concurrent joins, idempotent replay, changed-payload rejection, host-only operations, private-role projection, stale next actions, kick revocation, and presence expiry.
- Existing full suite with bundled Playwright and Chrome: 80 pass, 0 fail, 0 skipped at the initial integration checkpoint.
- Actual PostgreSQL script `../outputs/SERVERLESS_SQL_CHECK.sql` passed create/read, replay receipt, stale CAS, revision update, rate ceiling, expiry cleanup and private RPC checks, inside a rolled-back synthetic QA transaction. SQL Editor result was observed directly. This does not substitute for cross-request load testing or a live preview flow.
- Independent Standards/Spec review found and fixed SQL reserved identifier/conflict ambiguity, expired-row accumulation, and the invocation-wide deadline. Full cloud preview validation remains required.

## Limits before production

Polling is a prototype transport, not a claim of unlimited free capacity: 50 continuously active clients at roughly 1.6 seconds means about 112,500 Function calls/hour, plus database RPCs and per-room snapshot egress. Measure actual quota/latency before cutover; use Supabase Realtime revision notifications or another measured transport if the free budget is insufficient. No Render shutdown or production migration until the tested replacement is ready and active rooms have a cutover plan.

Secrets are not included in test logs, source packages, screenshots or shared memory. UI redesign and ending-video tasks use independent branches/checkouts.
