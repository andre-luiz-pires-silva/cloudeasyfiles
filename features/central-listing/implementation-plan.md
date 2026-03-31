# Implementation Plan: Central Listing

## Affected Areas

- main content explorer component
- provider list-items use cases
- availability state rendering
- local status-filter state in the content toolbar
- path navigation state
- connection-level container listing
- breadcrumb navigation state
- incremental listing state and continuation controls
- explorer counter state

## Proposed Changes

- reuse the main panel to show loaded containers when the selected context is a connection
- render immediate subdirectories and files for the selected context
- keep navigation level-based rather than recursively rendering the full hierarchy
- enrich file rows with normalized availability and local file state
- derive file availability from provider metadata, including restore-status metadata when available
- add a globally persisted view mode for the central listing
- expose list and compact toggles in the content header near the current context controls
- expose toolbar controls to refine loaded files by normalized status without reloading the provider dataset
- model a normalized explorer listing result separate from the raw provider response
- retain provider continuation tokens only in internal state
- expose a UI-facing `has more` or end-of-listing state to drive `Carregar mais`
- derive counter values from normalized loaded entries and filtered displayed entries
- append a loaded-context status breakdown near the counter when the current dataset includes known file states
- normalize folder entries from both prefix-grouping data and explicit trailing-slash sentinels
- deduplicate folder entries that are simultaneously implicit and explicit
- preserve enough metadata to support future folder operations consistently across AWS and Azure

## Data / State Considerations

- active connection
- active container
- active logical path
- raw provider continuation state for the active context
- normalized loaded explorer entries for the active context
- displayed filtered entries for the active context
- current filter state
- current local status-filter state
- persisted global content view mode
- loaded containers for the selected connection
- breadcrumb segments derived from connection plus current logical path
- end-of-listing state for `Carregar mais`
- normalized folder identity for deduplication across provider response shapes
- loaded-context status summary derived from normalized file entries

## Edge Cases

- empty directories
- prefix-only structures with no immediate files
- explicit folder sentinels with no descendants
- archived objects that become available after navigation, refresh, or reconnect-driven state refresh
- provider responses that include folder markers or prefix-grouping data
- duplicate-looking entries that must collapse into one navigable explorer item
- local filter active while additional provider pages are loaded
- local status filters active while additional provider pages are loaded
- no reliable global total available from provider listing

## Testing Notes

- verify connection-level container listing
- verify immediate-only listing behavior
- verify path transitions
- verify breadcrumb transitions back to connection and intermediate levels
- verify cloud-first listing rules
- verify restore-state updates after navigation and explicit refresh
- verify list and compact rendering for the same dataset
- verify persisted mode after app restart
- verify `Carregar mais` loads additional data for the same context without numbered pages
- verify `Carregar mais` becomes disabled at the end of the available listing
- verify counter values use normalized explorer entries rather than raw provider response lengths
- verify local filter affects only displayed entries and does not reset continuation state
- verify local status filters affect only the loaded dataset and do not reset continuation state
- verify the loaded-context status breakdown reflects the currently loaded file set
- verify one visible folder entry when both prefix inference and sentinel object exist
