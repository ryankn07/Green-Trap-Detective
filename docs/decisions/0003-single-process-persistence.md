# ADR 0003: Keep file-based persistence single-process

- Status: Local-mode decision; extended by [durable room storage](../DURABLE_ROOMS.md)
- Recorded: 2026-11-02

## Context

The current server stores room snapshots in a local JSON file. The store validates snapshots and replaces the file atomically. Room maps, SSE subscriptions, and rate-limit buckets remain in process memory.

## Decision

Retain the current single-process file store for the present deployment model, while documenting that it is not shared or distributed storage.

## Consequences

- A persistent filesystem is required for room recovery across host restarts or redeployments.
- Multiple server replicas are not supported by this storage and coordination model.
- In-memory rate limits are process-local and are not distributed DDoS protection.
- Before horizontal scaling, introduce shared persistence and coordination, then add multi-process concurrency and recovery tests.
- Resource ceilings must not be presented as measured hosting capacity.
