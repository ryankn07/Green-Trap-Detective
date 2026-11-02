# ADR 0004: Preserve and verify the runtime compatibility bundle

- Status: Accepted
- Recorded: 2026-11-02

## Context

The repository retains split runtime bundle files for compatibility with an existing hosting build path. The archive contains selected runtime source files and the project catalog. A stale archive could otherwise restore outdated code over a deployment's expected runtime.

## Decision

Keep the archive until the legacy hosting path is retired. Regenerate it through the repository script and verify source parity in automated tests and CI.

## Consequences

- Contributors changing bundled source files or the project catalog must run npm run bundle:pack.
- npm run bundle:check and the runtime-package regression test must pass before merging.
- The recovery script restores only missing files by default; forced overwrite is an explicit operation.
- The archive can be removed only after all deployment configurations and recovery paths no longer depend on it.
