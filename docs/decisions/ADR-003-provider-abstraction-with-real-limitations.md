# ADR-003: Provider Abstraction with Real Limitations

## Status
Accepted

## Context

CloudEasyFiles needs a unified product experience across AWS S3 and Azure Blob Storage, but the providers do not expose identical behavior for storage, archival workflows, and future advanced search.

A purely generic abstraction would simplify some interfaces but could hide important provider differences and mislead both users and implementers.

## Decision

The project will use a shared provider abstraction layer for common concepts and workflows, while preserving provider-specific options and limitations where they materially affect behavior.

## Alternatives Considered

- Fully generic abstraction that masks provider differences
- Provider-specific UX with minimal shared concepts
- Separate products or modules per provider

## Consequences

- The core application remains provider-agnostic where it should
- AWS and Azure differences remain visible when they affect restore, search, or operational behavior
- The UI can stay unified without becoming dishonest
- Provider adapters need explicit translation logic rather than simplistic one-to-one assumptions
