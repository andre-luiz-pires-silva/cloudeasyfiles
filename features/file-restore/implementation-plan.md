# Implementation Plan: File Restore

## Affected Areas

- `features/file-restore/` documentation
- AWS-specific restore UI under `src/features/aws-restore/`
- central listing file actions and status rendering
- footer activity summary and restore activity panel
- AWS provider adapter and metadata interpretation
- shared domain/application models for availability and active operations

## Proposed Changes

- add an AWS-specific restore action for archived files in the explorer
- implement an AWS restore modal with tier selection, retention days, advisory cost/time content, and AWS documentation links
- prevent the restore modal from becoming a fake provider-generic component
- read AWS object restore state from provider metadata and map it into normalized availability states
- discover active restores by listing objects and inspecting restore-related metadata rather than querying a non-existent global restore-jobs API
- add a footer restore indicator and restore activity view that shows only currently active operations
- refresh restore state on connection initialization, screen open, navigation changes, and explicit refresh actions
- remove assumptions that restore monitoring depends on automatic polling

## Data / State Considerations

- normalized file availability state from provider metadata
- provider-native restore metadata retained for AWS-specific messaging when useful
- advisory restore-tier catalog for AWS, maintained statically in the repository
- ephemeral UI state for the open restore modal and currently visible restore activity list
- no persisted restore history and no locally authoritative restore state

## Edge Cases

- archived file becomes available between list render and restore submission
- restore already in progress when the user opens the modal
- provider metadata lacks an estimate for completion timing
- unsupported AWS tier for a specific object or region
- large files where size materially affects user cost expectations
- reconnect flow where active restore operations must be rediscovered from AWS

## Testing Notes

- verify archived AWS files expose `Restore` and restoring files do not invite duplicate requests
- verify the modal is explicitly AWS-specific and contains the documented guidance
- verify restore state comes from provider metadata after navigation and manual refresh
- verify footer counters distinguish downloads, uploads, and restores
- verify only active restores appear in the restore activity list
- verify app restart does not create fake restore history and active restores reappear only if AWS still reports them
