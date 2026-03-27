# Feature Spec: Simple Filter

## Objective

Provide fast local filtering for the currently visible dataset.

## Context

Users need a lightweight way to narrow visible items without triggering provider calls or entering a more advanced search flow.

## Functional Requirements

- `Filter` must be available in the sidebar.
- `Filter` must be available in the main content area.
- Filtering must apply only to the currently visible items in that area.
- Filtering must be client-side only.

## Non-Functional Requirements

- Filtering should feel immediate.
- Filtering should not trigger provider/API calls.

## Business Rules

- `Filter` is not global search.
- `Filter` is an in-memory refinement of the rendered dataset.
- The main panel filter applies only to the visible items for the active path.

## UX Expectations

- Users should understand `Filter` as a quick narrowing tool.
- The UI should not imply provider-side search behavior.

## Acceptance Criteria

- Filtering in the sidebar affects only visible sidebar items.
- Filtering in the main panel affects only visible main-panel items.
- No provider calls occur when the filter changes.

## Out of Scope

- Global search
- Provider-aware search parameters
- Search across unloaded datasets
