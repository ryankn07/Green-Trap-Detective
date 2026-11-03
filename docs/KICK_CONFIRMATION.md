# Inline kick confirmation and pencil removal — 3 November 2026

The owner's kick refinement replaces the browser `confirm()` dialog with a gradient overlay clipped inside the selected player's existing tile. The underlying identity fades/blurs; the tile keeps its original dimensions. A short “Kick ‘name’?” prompt and two icon buttons appear: the green back arrow cancels and the red X submits the existing authenticated host-only command. Accessible labels retain the full confirmation question and action names. Escape cancels confirmation before closing a mobile player drawer. Player names are escaped, only one confirmation opens at a time, and buttons are disabled during submission. The original Kick control remains invisible and disabled under the overlay to preserve tile geometry.

Opening/canceling confirmation updates only player lists, preserving statement/action drafts. Presence rerenders preserve the question and keyboard focus; roster scroll is retained. A failed request leaves the real player intact and does not show an optimistic removal.

The later visual refinement enlarges the centered prompt to 14–16px and places a small green back arrow in the lower-left corner and a red X in the lower-right. Both icons are 14px with transparent, borderless click targets; there are no circular button backgrounds. Touch targets remain 40px without enlarging the icon or tile.

The back arrow uses a curved undo shape. Removal uses only the animated pencil zigzag; the separate diagonal cross-out strokes have been removed.

When an in-game snapshot marks a player `removed`, that tile dims and an animated graphite scribble/pencil covers it. Public removal status permits the same effect on other viewers. The stroke lasts about 1.15 seconds; its elapsed time survives presence rerenders, so it does not restart. Static pencil marks remain on the removed in-game tile. Ordinary eliminations do not receive these kick marks.

Lobby removal deletes the player from the server roster. After the host receives a successful kick response, their UI briefly retains the public tile as a 2.4-second exit animation, then removes it. Other lobby viewers do not infer “kicked” from an unexplained roster disappearance, since the server projection does not distinguish it from a normal leave.

The ending roster uses its own dark theme surface and accent-colored pencil marks instead of the pale paper used during play. Removed identities stay dimmed but readable, and the mark is clipped inside its tile; no bright rectangle is placed over a Good or Bad Ending. The same static mark survives a cached-result refresh without replaying the pencil.

Ordinary game eliminations now strike only the player-name span. They do not receive the host-kick pencil mark. The ending separately identifies the cause: bankruptcy, all contributors to a successful expulsion, or the public host's kick. Expulsion attribution is terminal-only; the active game still keeps contributors private.

The owner-requested pencil motion is scoped to these finite removal effects even under reduced-motion preference, consistent with the requested phase effects; other surfaces retain their existing preference handling. No engine, API, host permission, expulsion cost or private projection changes are made. The compatibility bundle is regenerated for the client change.

The browser regression covers cancellation, Escape, escaped names, green/red controls, confirmation/focus across snapshots, a rejected kick, successful lobby/game kicks, public observer updates, persistent marks without animation replay, draft preservation and a 320px drawer.
