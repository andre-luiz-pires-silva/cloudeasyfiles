# Implementation Plan: Simple Filter

## Affected Areas

- sidebar rendering state
- main content listing state
- local UI state management

## Proposed Changes

- keep filter text local to each area
- apply filtering to the already loaded visible dataset
- avoid coupling filter state to provider fetching logic

## Data / State Considerations

- visible sidebar items
- visible main-panel items
- current filter text per area

## Edge Cases

- empty result sets
- filter changes while visible datasets are refreshed

## Testing Notes

- verify no provider call is triggered by filter changes
- verify filtering affects only the current area and visible dataset
