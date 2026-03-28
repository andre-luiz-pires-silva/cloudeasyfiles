# Architecture Overview

## Goal

CloudEasyFiles is structured to keep product behavior coherent while isolating provider-specific implementation details.

## Layering

- Frontend UI
  - renders navigation, content panels, dialogs, and status indicators
- Application / Orchestration Layer
  - coordinates use cases, workflows, and UI-facing state transitions
- Domain / Core Logic
  - defines shared concepts, business rules, and provider-agnostic models
- Provider Adapters
  - translate AWS and Azure APIs into shared domain concepts
- Infrastructure
  - handles SDK wiring, serialization, persistence, and platform integration

## Architectural Intent

- Keep the core application independent from raw provider SDK models.
- Allow AWS and Azure implementations to evolve independently.
- Preserve shared user-facing concepts without inventing fake provider parity.
- Keep the codebase readable, maintainable, and suitable for AI-assisted implementation.

## Cross-Cutting Rules

- The cloud is always the source of truth.
- Local cache is optional and limited to downloaded files.
- Navigation context is defined structurally in the sidebar.
- Object exploration happens in the main content area.
- Filtering and advanced search are distinct architectural concepts.
- Explorer listing uses incremental loading rather than numbered pages.
- Provider-native listing responses must be normalized before they drive explorer UI counts or rows.
- The explorer folder model is a domain abstraction over flat object storage, using prefix inference plus explicit trailing-slash sentinels when the app creates folders.

## Related Documents

- [Domain Model](./domain-model.md)
- [Navigation Model](./navigation-model.md)
- [Storage Abstraction](./storage-abstraction.md)
- [Search and Filter](./search-and-filter.md)
