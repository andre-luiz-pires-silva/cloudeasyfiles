# ADR-001: No Objects in the Navigation Tree

## Status
Accepted

## Context

The project needs a navigation model that remains understandable and scalable for object storage providers with potentially large datasets.

Rendering files directly in the sidebar would increase UI complexity, blur the distinction between structural navigation and content browsing, and introduce pagination and loading concerns into the tree.

## Decision

The left navigation tree will display only higher-level structural items such as saved connections and cloud containers.

Files and folders will be displayed in the main content area.

## Alternatives Considered

- Show the full object hierarchy in the tree
- Show connections, containers, and folders in the tree
- Use the tree as the primary explorer for all levels

## Consequences

- The sidebar stays smaller and easier to scan
- Object browsing logic remains concentrated in the main panel
- Pagination and object-list complexity can be managed outside the tree
- The product keeps a clearer distinction between context selection and content exploration
