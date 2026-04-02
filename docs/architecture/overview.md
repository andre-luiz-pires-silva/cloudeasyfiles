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
- Local cache is optional, configured globally in the app, and limited to downloaded files.
- Default upload parameters are configured per connection when the provider supports them, and the current upload workflow only uses AWS `StorageClass`.
- Navigation context is defined structurally in the sidebar.
- Object exploration happens in the main content area.
- Filtering and advanced search are distinct architectural concepts.
- Explorer listing uses incremental loading rather than numbered pages.
- Provider-native listing responses must be normalized before they drive explorer UI counts or rows.
- The explorer folder model is a domain abstraction over flat object storage, using prefix inference plus explicit trailing-slash sentinels when the app creates folders.
- Automatic refresh is activity-driven rather than continuous.
- Restore and rehydration flows may be provider-specific when provider behavior materially affects UX or orchestration.
- The current transfer monitor covers downloads and simple uploads, but the upload MVP has no local queue, no `pending` state, and no explicit concurrency cap.
- The current simple upload flow can start multiple file uploads from a single picker or drag-and-drop action.
- The current simple upload flow resolves overwrite conflicts in a dedicated batch modal rather than chaining browser confirms.
- The app does not expose advanced upload parameterization; users who need provider-specific upload options must use the provider console.
- Outside explicit refresh, navigation, screen-open, and reconnection events, the UI does not continuously poll restore state.

## Related Documents

- [Domain Model](./domain-model.md)
- [Navigation Model](./navigation-model.md)
- [Storage Abstraction](./storage-abstraction.md)
- [Search and Filter](./search-and-filter.md)
