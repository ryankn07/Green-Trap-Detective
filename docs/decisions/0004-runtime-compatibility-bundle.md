# ADR 0004: Preserve and verify the runtime compatibility bundle

- Status: Accepted
- Recorded: 2026-11-02

## Context

The repository retains a split runtime compatibility bundle for an existing hosting recovery path. Its three base64 segments live in `runtime/compatibility/`, separate from application source and root-level project files. The archive contains selected runtime source files and the project catalog. A stale archive could otherwise restore outdated code over a deployment's expected runtime.

## Decision

Keep the archive until the legacy hosting path is retired. Regenerate it through the repository script and verify source parity in automated tests and CI.

## Consequences

- Contributors changing bundled source files or the project catalog must run npm run bundle:pack.
- npm run bundle:check and the runtime-package regression test must pass before merging.
- The recovery script restores only missing files by default; forced overwrite is an explicit operation.
- The archive can be removed only after all deployment configurations and recovery paths no longer depend on it.
