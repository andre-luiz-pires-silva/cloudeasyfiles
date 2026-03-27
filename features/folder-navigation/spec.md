# Feature Spec: Folder Navigation

## Objective

Define how users navigate cloud structure across connections, containers, and virtual directories.

## Context

Cloud object storage does not expose real directories. The product must provide a familiar navigation experience while staying faithful to prefix-based storage behavior.

## Functional Requirements

- The sidebar must display saved connections.
- The sidebar must display containers for connected connections.
- The sidebar must not display file objects.
- The selected context must determine what the main panel shows.
- Virtual directories must be resolved dynamically from object key prefixes.

## Non-Functional Requirements

- Navigation should remain understandable for large datasets.
- The sidebar should stay lightweight and structurally focused.
- The model should work across AWS and Azure.

## Business Rules

- The tree defines context, not full object exploration.
- Virtual directories are synthetic.
- Path resolution must be deterministic and provider-agnostic.

## UX Expectations

- Sidebar navigation should feel familiar and easy to scan.
- The user should always understand the current container or directory context.
- Object browsing should continue in the main content area rather than inside the tree.

## Acceptance Criteria

- Connections and containers are visible in the tree.
- Files are not rendered in the tree.
- Selecting a connection updates the main panel context with connection-level information and the currently loaded containers.
- Selecting a container or virtual directory updates the main panel context correctly.
- Virtual directories are derived from prefixes rather than assumed as real resources.

## Out of Scope

- Full object hierarchy inside the sidebar
- Local filesystem synchronization behavior
