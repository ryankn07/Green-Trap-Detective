# ADR 0001: Keep the runtime dependency-free

- Status: Accepted
- Recorded: 2026-11-02

## Context

The application currently runs on Node.js and browser-native HTML, CSS, and JavaScript. The HTTP server, test runner, compression, filesystem access, and cryptographic operations use Node.js built-ins. The browser client does not require a framework runtime.

## Decision

Keep the production runtime free of third-party npm dependencies unless a concrete requirement justifies adding one.

## Consequences

### Benefits

- Smaller dependency and supply-chain surface.
- No framework installation or bundler is required for local server startup.
- The project can use the built-in Node.js test runner.
- Deployment setup remains straightforward.

### Trade-offs

- Browser UI organization and state management must be maintained explicitly.
- Contributors must avoid recreating large framework features ad hoc.
- If a dependency is proposed, document the use case, maintenance cost, security posture, and deployment impact before adding it.
