# ADR 0002: Keep game rules and private data server-authoritative

- Status: Accepted
- Recorded: 2026-11-02

## Context

Players share a room but must not receive one another's private role, wallet, locked action, or inspection result. Hiding an element in the browser is insufficient because clients can inspect network responses.

## Decision

The engine owns game rules and state transitions. The server authenticates the player, derives their identity from the session, and creates a viewer-specific projection before returning state through HTTP or SSE.

## Consequences

- UI code renders only the authenticated player's projection.
- Public player entries contain only information allowed by the game rules.
- Private data must be tested against raw API and SSE payloads, not only against rendered DOM.
- Any future real-time transport or client rewrite must preserve the same server-side projection boundary.
- Game rules must not be reimplemented as client-side authority.
