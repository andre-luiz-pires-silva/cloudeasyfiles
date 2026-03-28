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
- In the main explorer, filtering must apply only to already loaded normalized entries for the active path.

## Non-Functional Requirements

- Filtering should feel immediate.
- Filtering should not trigger provider/API calls.

## Business Rules

- `Filter` is not global search.
- `Filter` is an in-memory refinement of the rendered dataset.
- The main panel filter applies only to the loaded items for the active path.
- The main panel filter does not change provider cursor state or listing continuation rules.
- The main panel filter does not redefine the loaded universe.

## UX Expectations

- Users should understand `Filter` as a quick narrowing tool.
- The UI should not imply provider-side search behavior.
- When filter is active in the main explorer, the counter should read `X itens filtrados de Y carregados`.
- `Carregar mais` remains a valid action when more provider data exists, even if filter text is active.

## Acceptance Criteria

- Filtering in the sidebar affects only visible sidebar items.
- Filtering in the main panel affects only visible main-panel items.
- No provider calls occur when the filter changes.
- In the main explorer, filtering updates only the displayed subset of already loaded normalized entries.
- In the main explorer, filter changes do not disable `Carregar mais` when more provider data exists.

## Out of Scope

- Global search
- Provider-aware search parameters
- Search across unloaded datasets
