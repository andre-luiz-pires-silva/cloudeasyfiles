# Implementation Plan: File Restore

## Affected Areas

- `features/file-restore/` documentation
- AWS-specific restore UI under `src/features/aws-restore/`
- central listing file actions and status rendering
- content summary label near the loaded-count indicator
- AWS provider adapter and metadata interpretation
- shared domain/application models for availability

## Proposed Changes

- add an AWS-specific restore action for archived files in the explorer
- implement an AWS restore modal with tier selection, retention days, advisory cost/time content, and AWS documentation links
- prevent the restore modal from becoming a fake provider-generic component
- read AWS object restore state from provider metadata and map it into normalized availability states
- include restore counts in the current-context summary based only on the items already loaded for that bucket or folder
- avoid connection-wide restore discovery so the restore summary scales with the current listing context
- refresh restore state when the current context is loaded and when the user explicitly refreshes it
- remove assumptions that restore monitoring depends on automatic polling

## Data / State Considerations

- normalized file availability state from provider metadata
- provider-native restore metadata retained for AWS-specific messaging when useful
- advisory restore-tier catalog for AWS, maintained statically in the repository
- ephemeral UI state for the open restore modal
- no persisted restore history and no locally authoritative restore state

## Edge Cases

- archived file becomes available between list render and restore submission
- restore already in progress when the user opens the modal
- provider metadata lacks an estimate for completion timing
- unsupported AWS tier for a specific object or region
- large files where size materially affects user cost expectations
- bucket or folder listings that contain no restoring files

## Testing Notes

- verify archived AWS files expose `Restore` and restoring files do not invite duplicate requests
- verify the modal is explicitly AWS-specific and contains the documented guidance
- verify restore state comes from provider metadata after navigation and manual refresh
- verify the loaded-context summary reflects ready and restoring counts for the current listing only
- verify navigating to a different folder or bucket recalculates the summary from that context
