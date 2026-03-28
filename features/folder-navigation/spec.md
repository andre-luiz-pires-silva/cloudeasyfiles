# Feature Spec: Folder Navigation

## Objective

Define how users navigate cloud structure across connections, containers, and folders.

## Context

Cloud object storage does not expose real directories. The product must still provide a familiar folder navigation experience while staying faithful to flat namespace and prefix-based storage behavior.

## Functional Requirements

- The sidebar must display saved connections.
- The sidebar must display containers for connected connections.
- The sidebar must not display file objects.
- The selected context must determine what the main panel shows.
- Folder navigation must work even when the provider only exposes flat object data.

## Non-Functional Requirements

- Navigation should remain understandable for large datasets.
- The sidebar should stay lightweight and structurally focused.
- The model should work across AWS and Azure.

## Business Rules

- The tree defines context, not full object exploration.
- Path resolution must be deterministic and provider-agnostic.
- Users should be shown folders as the navigable concept without exposing storage-model jargon.

## UX Expectations

- Sidebar navigation should feel familiar and easy to scan.
- The user should always understand the current container or directory context.
- Object browsing should continue in the main content area rather than inside the tree.
- The explorer should present folders and files as navigable entries even when the provider uses a flat object namespace.

## Acceptance Criteria

- Connections and containers are visible in the tree.
- Files are not rendered in the tree.
- Selecting a connection updates the main panel context with connection-level information and the currently loaded containers.
- Selecting a container or folder updates the main panel context correctly.
- Folders remain navigable whether they were inferred from descendants or created explicitly in the provider representation.
- The navigation model does not depend on provider-native directory entities existing.

## Out of Scope

- Full object hierarchy inside the sidebar
- Local filesystem synchronization behavior
