# Implementation Plan: Central Listing

## Affected Areas

- main content explorer component
- provider list-items use cases
- availability state rendering
- path navigation state
- connection-level container listing
- breadcrumb navigation state

## Proposed Changes

- reuse the main panel to show loaded containers when the selected context is a connection
- render immediate subdirectories and files for the selected context
- keep navigation level-based rather than recursively rendering the full hierarchy
- enrich file rows with normalized availability and local file state
- support in-place restore status updates while the view is open
- add a globally persisted view mode for the central listing
- expose list and compact toggles in the content header near the current context controls

## Data / State Considerations

- active connection
- active container
- active logical path
- visible items dataset
- current filter state
- persisted global content view mode
- loaded containers for the selected connection
- breadcrumb segments derived from connection plus current logical path

## Edge Cases

- empty directories
- prefix-only structures with no immediate files
- archived objects that become available after restore polling

## Testing Notes

- verify connection-level container listing
- verify immediate-only listing behavior
- verify path transitions
- verify breadcrumb transitions back to connection and intermediate levels
- verify cloud-first listing rules
- verify restore-state updates in the current view
- verify list and compact rendering for the same dataset
- verify persisted mode after app restart
