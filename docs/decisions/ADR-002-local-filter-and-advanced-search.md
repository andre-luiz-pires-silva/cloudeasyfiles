# ADR-002: Separate Local Filter from Advanced Search

## Status
Accepted

## Context

The product needs both quick on-screen refinement and a future path for richer search capabilities.

Treating these as the same feature would blur UX expectations and mix local UI behavior with provider-aware remote search behavior.

## Decision

CloudEasyFiles adopts two distinct concepts:

- `Filter`
  - local, in-memory, visible-items-only refinement
- `Advanced Search`
  - separate modal-based workflow that may trigger provider calls

## Alternatives Considered

- One generic search box for every use case
- Local filter only, with no advanced search concept
- Provider-specific search surfaces with no shared entry point

## Consequences

- Basic filtering stays fast and predictable
- Advanced search can grow independently
- The UI can expose a shared search entry point without pretending provider capabilities are identical
- Documentation and implementation can treat the two behaviors separately
