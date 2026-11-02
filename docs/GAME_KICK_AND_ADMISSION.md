# In-game host removal and anonymous admission

Owner request, 2026-11-02: finish defects and let the host kick an AFK player during a game. This supersedes the lobby-only kick restriction in the older lobby brief.

## Behavior

- Only the authenticated host may kick another attendee. Reject self, foreign/missing/already-removed targets and finished games. No automatic AFK inference or new gameplay timer is introduced.
- During play, retain the attendee's record for names and historical results, mark them removed/offline and make the engine player inactive. Revoke token authentication and end existing SSE connections with the terminal `kicked` event. Existing locked actions from an inactive actor do not execute. Previously finalized results remain unchanged.
- Use the existing faction elimination win condition when administrative removal ends a faction. Do not use the ten-round ending condition before that round is resolved. Public endgame roles still include removed players.
- The host-only control is available in the PC member list and mobile member drawer, with confirmation before removal.

## Admission boundary

HTTP create and join derive ownership from the existing validated network address, then persist its SHA-256 fingerprint. Neither JSON fields nor untrusted forwarding headers select ownership. Per-source active reservations are limited to 10 created rooms and 300 active seats across rooms; these are process resource policies, not a per-room gameplay maximum. Fifty players on one classroom network are a tested legitimate control.

Removal/leave/expiry releases the applicable reservation. Failed storage writes retain the old reservation; successful reservations survive local snapshot reload. Legacy snapshots without ownership remain readable. Historical removed records do not consume active seat reservations. Source fingerprints are never included in authenticated public projections.

The default forwarded-address policy remains conservative. Behind an unconfigured proxy, clients may share an ingress-source allowance. These quotas mitigate one-source reservation exhaustion; sufficiently distributed sources can still reach the global resource ceilings. No bot-proof or capacity guarantee is claimed.

## Verification

Focused manager and HTTP/SSE tests cover create/join quotas, spoofed headers/body fields, 50-person shared-network play, local restart and failed persistence, active-game removal/revocation, removed locked actions, retained history and faction endings. Separate browser smoke verified mobile OPPOSE statement synchronization to PC, native 1414x2000 artwork without horizontal overflow, mobile host controls and the removed guest screen. The existing optional browser automation suite requires its external runtime and skips when unavailable.

Supabase cloud durability is a separate pending integration. A successful local file reload does not imply survival across Render Free deployment or filesystem replacement.
