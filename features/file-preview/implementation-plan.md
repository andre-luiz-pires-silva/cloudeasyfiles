# Implementation Plan: File Preview

## Affected Areas

- main content explorer toolbar
- main content listing and selected file state
- preview panel rendering in the main content area
- provider read adapters for object preview reads
- Tauri command surface for bounded object reads
- AWS and Azure provider service implementations
- local cache and transfer state interaction
- file type detection helpers
- i18n copy for preview labels, states, and errors
- component and command test coverage

## Proposed Changes

- add a toolbar checkbox to enable or disable preview mode for the main content area
- keep preview mode scoped to the current main content explorer state
- render a right-side preview panel when preview mode is enabled and a supported file is selected
- preserve the existing list and compact explorer modes while preview mode changes only the available layout width
- trigger preview from the currently selected file row rather than from directories or connection-level container rows
- support text previews for small, UTF-8 compatible text-like files
- support image previews for common static image formats
- introduce a provider-agnostic preview request model that uses connection, container, object path, size, and provider metadata
- add bounded provider read commands instead of downloading the full object through the transfer monitor
- enforce a maximum preview byte limit before issuing provider reads
- return preview payloads as either decoded text or base64 image bytes with an explicit MIME type
- avoid persisting preview file contents locally
- cancel or ignore stale preview responses when selection, folder, connection, or preview mode changes
- show clear preview states for empty selection, unsupported type, loading, too large, archived/restoring, failed read, and successful preview
- keep restore and rehydration behavior separate from preview; archived unavailable files should not initiate restore from the preview panel
- reuse existing normalized explorer entries and provider adapter boundaries where possible
- add localized strings for the preview checkbox, panel title, empty states, unsupported states, size limit messages, and retry action

## Implementation Steps

- create a preview capability model in the navigation feature for supported MIME types, file extensions, maximum preview size, and display mode
- extend `NavigationContentExplorerItem` only with metadata needed to decide preview eligibility from listing data
- add preview state to `useContentListingState`, including enabled flag, active item id, loading state, payload, and error
- wire the toolbar checkbox through `ContentExplorerHeader` and keep it available only for bucket/folder contexts
- adjust the main content layout so the preview panel sits beside the file list without nesting cards inside cards
- select a file for preview from row click or selection state without breaking existing context menu and multi-select behavior
- add `FilePreviewPanel` under `src/features/navigation/components/` for text and image rendering
- add `navigationFilePreview.ts` helpers for type detection, size checks, stale response guards, and UI-state derivation
- add provider adapter functions such as `previewObjectForSavedConnection` to keep React components independent from AWS and Azure credentials
- add Tauri wrappers in `src/lib/tauri/awsConnections.ts` and `src/lib/tauri/azureConnections.ts`
- add Rust commands for AWS and Azure preview reads and register them in `src-tauri/src/app/bootstrap.rs`
- implement bounded object reads in `aws_connection_service.rs` and `azure_connection_service.rs`
- decode text only after validating size and UTF-8 compatibility
- return image data only for the initially supported static formats
- update styles in `src/styles.css` for the split explorer and preview panel
- add English and Portuguese i18n entries in `src/locales/en-US.json` and `src/locales/pt-BR.json`
- add focused tests for preview eligibility, header checkbox rendering, panel states, stale response handling, and provider command parameter mapping

## Data / State Considerations

- preview enabled flag
- selected preview item id
- active connection
- active container
- active logical path
- active provider and region context
- normalized object path
- listed object size and availability state
- preview support decision derived from filename, extension, content type when available, size, and availability
- preview request id or nonce for stale response suppression
- preview loading and error state
- preview payload kind: text or image
- preview text content
- preview image MIME type and base64 payload
- maximum preview byte limit
- no persisted preview payloads
- no change to existing download, cache, or transfer monitor state

## Initial Support Matrix

- text: `.txt`, `.md`, `.json`, `.csv`, `.log`, `.xml`, `.yaml`, `.yml`, `.ini`, `.toml`
- images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`
- excluded initially: PDFs, videos, audio, office documents, archives, directories, provider containers, binary unknown files
- excluded initially: files larger than the configured preview byte limit
- excluded initially: archived or restoring objects that are not currently readable

## Edge Cases

- preview mode enabled with no file selected
- selected item is a directory
- selected context is a connection rather than a bucket or folder
- selected file is unsupported
- selected file has no extension or misleading extension
- selected file exceeds the preview size limit
- selected file is empty
- selected file is not valid UTF-8
- image payload is valid bytes but cannot be rendered by the browser
- file is deleted, moved, or overwritten between listing and preview read
- provider credentials expire or become invalid between listing and preview read
- AWS bucket region is unavailable or stale
- restricted AWS bucket settings block the preview request
- Azure archived blobs are listed but not readable
- user changes folder, connection, filter, status filter, or preview checkbox while a preview request is in flight
- user opens the context menu or starts multi-select while preview mode is active
- local cache contains a downloaded copy but cloud remains the source of truth for preview
- provider returns a partial read shorter than expected

## Testing Notes

- verify the toolbar checkbox toggles preview mode without reloading provider listings
- verify preview mode does not change continuation token or `Carregar mais` behavior
- verify selecting a supported text file renders decoded text
- verify selecting a supported image file renders an image preview
- verify unsupported files render a stable unsupported state
- verify oversized files are blocked before provider reads
- verify archived or restoring files do not issue preview reads
- verify stale preview responses are ignored after navigation or selection changes
- verify failed provider reads show a retryable error without clearing the listing
- verify preview state resets when the active connection, container, or folder changes
- verify existing download, restore, delete, change-tier, and context menu actions still work with preview mode enabled
- verify list and compact view modes both support preview selection
- verify i18n keys exist for English and Portuguese
- verify Rust command tests cover size limits, unsupported local guards, and provider error propagation
