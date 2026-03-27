# Implementation Plan: Central Listing

## Affected Areas

- main content explorer component
- provider list-items use cases
- availability state rendering
- path navigation state

## Proposed Changes

- render immediate subdirectories and files for the selected context
- keep navigation level-based rather than recursively rendering the full hierarchy
- enrich file rows with normalized availability and local file state
- support in-place restore status updates while the view is open

## Data / State Considerations

- active connection
- active container
- active logical path
- visible items dataset
- current filter state

## Edge Cases

- empty directories
- prefix-only structures with no immediate files
- archived objects that become available after restore polling

## Testing Notes

- verify immediate-only listing behavior
- verify path transitions
- verify cloud-first listing rules
- verify restore-state updates in the current view
