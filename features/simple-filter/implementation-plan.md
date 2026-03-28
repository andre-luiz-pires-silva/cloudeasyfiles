# Implementation Plan: Simple Filter

## Affected Areas

- sidebar rendering state
- main content listing state
- local UI state management

## Proposed Changes

- keep filter text local to each area
- apply filtering to the already loaded visible dataset
- avoid coupling filter state to provider fetching logic
- apply main-panel filtering over normalized explorer entries rather than raw provider payloads
- keep continuation state independent from filter state

## Data / State Considerations

- visible sidebar items
- loaded normalized main-panel entries
- filtered displayed main-panel entries
- current filter text per area
- independent continuation state for the active explorer context

## Edge Cases

- empty result sets
- filter changes while visible datasets are refreshed

## Testing Notes

- verify no provider call is triggered by filter changes
- verify filtering affects only the current area and visible dataset
- verify main-panel filter does not change loaded-count semantics
- verify main-panel filter does not reset or alter `Carregar mais` availability
