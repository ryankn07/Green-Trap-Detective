# Unanimous discussion skip — 3 November 2026

Owner request: a small Skip button in discussion, with a small vote count above it. After everyone agrees, show a gradient on the button and automatically enter the next voting/action phase.

## Behavior

- The compact button is beside **Ý kiến trong phòng** during `DEBATE`, on desktop and phones. Its badge appears after the first vote and shows accepted votes / eligible players. A selected button stays pressed/disabled, including after refresh; failed requests do not fabricate a vote.
- Every living player has one consent per round. Offline living players still count; eliminated or host-removed players do not. Host removal recomputes consent, unless that removal ends the game. Consent cannot be withdrawn.
- Sending a statement does not imply Skip. All statements being sent still waits for the timer unless everyone also consents. Skip is allowed before sending a statement; existing statements remain intact, and missing statements receive the normal `UNSURE` timeout default.
- The authenticated server owns progression. The final vote atomically enters `BLIND_ACTION` with its usual 60-second deadline. Per the owner's 4 November refinement, each observing browser accepts that snapshot, locks the old board and burns the discussion timer for **2 seconds using the same flame renderer as all-locked actions**, without a black trail. The completed button's emerald gradient runs alongside it. Only after the bar reaches zero does the client render the action phase and its usual chapter. The deadline continues running throughout presentation.
- Polling clients also recognize consensus on their next snapshot, even if they did not observe the last partial count. Presence updates do not replay or restart the effect. Refresh directly into the action phase does not replay it. Reduced motion preserves the two-second drain with a static flame and no flicker/particles. Leaving/hiding the page releases the presentation hold. A later phase supersedes it immediately without burning the stale discussion board again.
- Counts reset next round. Expulsion contributor privacy, role visibility, bank actions, ending playback and local test tools are unchanged.

## Implementation

The engine stores `discussionSkipVotes` and `discussionSkipped` in existing JSON state. Its projection exposes only `{count, required, voted, complete}`. The new authenticated `skip_discussion` command validates game/round/phase context on both Node/SSE and serverless/polling paths. Duplicate votes have no effect; serverless request receipts preserve committed retries across phase changes. Existing snapshots without these fields begin with zero votes. No database schema migration or dependency is needed.

The client renders from confirmed snapshots and preserves statement drafts while partial votes arrive. The completed-button feedback and shared flame hold are presentation only, with no extra engine phase and no timer extension. See [ACTION_CLOCK_BURN.md](ACTION_CLOCK_BURN.md) for the common two-second flame treatment.

## Verification

`test/discussion-skip.test.cjs` covers independent consent/default statements, duplicates, old states, round reset, eliminated/offline players, kick quorum changes, persistence/recovery/rollback, HTTP authentication and stale context. Its Chrome test uses three real sessions at 1440, 390 and 320 px, including polling, refresh, shared badges and gradient-before-chapter ordering. `test/serverless-game.test.cjs` also covers persisted votes and receipt replay across cold Function invocations.

Final local validation: **140 passed, 0 failed, 0 skipped** with `node --test --test-concurrency=2`, Chrome/Playwright and the isolated PGlite SQL runtime. Source/asset checks (72 JS files, 25 cards), runtime-bundle parity, static frontend build and diff whitespace checks passed. Desktop/mobile screenshots of the badge were visually reviewed; the loopback preview serves the updated client.

This is a local implementation record. No commit, push, hosted migration or production deployment is implied.

## Shared flame verification — 4 November 2026

The focused discussion-skip, action-burn and countdown suites passed **14/14**, with no failures or skips. Browser checks cover flame alignment, continuous drainage to a briefly visible zero, exactly one two-second burn before the chapter, PC/mobile, polling, reduced motion, presence updates and cleanup on hide/pagehide/refresh or a superseding result. The real UI test verifies both consecutive burns after create/join/start, statement submission, unanimous Skip and all players locking actions. Desktop/mobile flame screenshots were visually reviewed.

A further two-round run using three ordinary UI sessions on `localhost:3141` measured Skip burns of **2006–2030 ms** across six observations, including **2022 ms** with reduced motion. Action completion also retained its two-second burn. There were no page errors, overflow or leftover inert boards; the disposable QA room was retired. Source checks, runtime-bundle parity, frontend build and whitespace checks passed, and the local server was restarted with the updated client.

## Latest-main integration — 4 November 2026

Integrated upstream main `db363b75a9103e5929f6ec71d79852f7e3be438f` (PR #44: draw-ending presentation and desktop discussion-header polish). The two upstream ending files remain identical to main; the shared stylesheet retains both upstream refinements and the local Skip/flame rules. All other pending local feature files were preserved byte-for-byte from a verified backup. Full validation passed **147/147**, without failures or skips, with Chrome/Playwright and isolated PGlite, followed by source/bundle/build/whitespace checks. Restarted localhost:3141 serves the integrated app, stylesheet and ending assets. The owner subsequently approved publishing this integrated version to main; temporary test controls and QA artifacts stay outside the Git checkout.
