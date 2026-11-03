# In-match vote-out motion — 3 November 2026

The owner clarified that the approved elimination demo belongs **inside the match when a turn resolves an expulsion**, rather than in the ending roster. The existing player tile briefly flashes, shakes, dims, draws a horizontal stroke across the name, then reveals **Đã bị trục xuất**. The motion lasts two seconds. Host kicks retain their separate pencil effect, and bankruptcy retains its static eliminated-name treatment.

The authenticated projection derives `history[].expelledPlayerIds` from the engine's actual expulsion reasons and the round's public `newlyEliminatedIds`. These are the eliminated targets, not contributors. Actor IDs, amounts, roles, wallets and inspection results remain private during active play. The existing final-only attribution is unchanged.

The renderer detects a living-to-eliminated change in the same game/round at `REVEAL` or `GAME_OVER`. An initial snapshot, refresh into an already-resolved turn, bankruptcy or a host kick does not trigger this motion. Presence updates retain the original animation start and resume elapsed motion after rerendering. A new round, changed room, hidden page or session loss clears stale motion.

For an ordinary round, the player-tile animation begins after the existing two-second reveal chapter has cleared. The server clock and controls continue normally. On mobile/tablet the existing Council drawer opens so the tile is visible; the roster scrolls to the first affected player. Names remain struck through after the animation. The tile's layout size is preserved, including on phones; paint is clipped with `overflow:clip` rather than creating a shrinking grid item.

If the expulsion itself ends the match, the final snapshot is accepted and cached immediately, transport stops and the server retires the room as usual. Only presentation is held: the existing board becomes inert for the two-second vote-out motion, then the normal ending chapter and result page appear. No fake engine phase, postponed result, extra action or extended server deadline is introduced. Hiding the page flushes this presentation to the final result and releases `inert` immediately.

The finite CSS motion follows the owner's requested demo behavior under the existing reduced-motion setting, as already approved for phase and kick effects. It uses the current fonts, colors and markup; original artwork and supplied films are unchanged.

Regression checks cover multiple targets, PC/mobile visibility and row size, motion under reduced preference, private contributors, elapsed motion across presence updates, refresh deduplication, rapid next-round changes, bankruptcy, final-vote retirement/transport/cache behavior and hidden-page cleanup. The standalone design-video prototype remains outside the Git checkout.
