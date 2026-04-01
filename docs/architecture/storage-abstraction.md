# Storage Abstraction

## Overview

Provider-specific storage tiers and availability behavior are normalized where that improves usability, while preserving provider-specific details where they matter operationally.

The same principle applies to listing and navigation: provider-native listing payloads are adapted into a shared explorer model, but the abstraction must stay honest about provider limitations such as continuation-based listing and flat namespaces.

## Provider Listing Normalization

AWS S3 and Azure Blob Storage may expose listing data in forms that are not directly suitable for the explorer UX.

Examples:

- flat object namespaces that must be interpreted as folders
- provider prefix-grouping structures
- folder-marker objects or blobs
- continuation tokens or markers instead of page numbers

The application must normalize these responses into navigable explorer entries before the UI consumes them.

Shared expectations:

- the explorer works with `File` and `Folder` entries
- the normalized explorer dataset is the source for UI rendering and counters
- raw provider item counts must not be reused as the displayed explorer count
- provider continuation details may be mapped into a uniform internal contract, but must not be exposed to the end user as UX terminology
- folder creation uses an explicit empty object/blob whose key ends with `/` when the provider model supports that representation
- listing normalization must merge prefix-derived folders and explicit trailing-slash sentinels into one explorer folder entry
- the hybrid folder model must remain valid for AWS S3 and Azure Blob Storage

## Listing Contract Expectations

The listing abstraction should support:

- current context identity: connection, container, logical path
- normalized loaded entries for the current context
- continuation state for requesting additional data
- an internal provider cursor or equivalent token when more data exists
- a reliable `has_more` style signal for the UI

The listing abstraction should not require:

- numbered pages
- exact global totals for the current directory
- user-configurable page size as part of V1 explorer UX

## StorageClass

`StorageClass` should retain the provider-native label when that is more operationally useful to the user.

Examples:

- AWS examples:
  - `STANDARD`
  - `STANDARD_IA`
  - `GLACIER`
  - `DEEP_ARCHIVE`
- Azure examples:
  - `Hot`
  - `Cool`
  - `Cold`
  - `Archive`

The current direction is to expose these provider-specific tier names directly in file listings so the UI stays transparent about what the provider is really using.

Cross-provider simplification should happen primarily through `AvailabilityStatus`, not by erasing the native storage tier label.

## AvailabilityStatus

`AvailabilityStatus` represents whether content can be used immediately.

Normalized states:

- `Available`
- `Archived`
- `Restoring`

Examples:

- AWS Glacier or Deep Archive content maps to `Archived`
- Azure Archive content maps to `Archived`
- AWS restore in progress maps to `Restoring`
- Azure rehydration in progress maps to `Restoring`
- AWS archival content with a provider-reported temporary restored copy may map to `Available` while the UI still retains archival context for the same row

This is the preferred layer for cross-provider normalization in the file list.

## DownloadState

`DownloadState` represents the user-facing tracked download lifecycle for a file.

Normalized states:

- `NotDownloaded`
- `Restoring`
- `AvailableToDownload`
- `Downloaded`

Rules:

- `DownloadState` is resolved from provider availability plus tracked cache information.
- `Restoring` in `DownloadState` is driven by provider restore or rehydration status, regardless of provider terminology.
- `AvailableToDownload` means the file is eligible for the tracked `Download` action and has no current tracked local copy.
- `Downloaded` means the tracked cache already contains the current file version.
- `NotDownloaded` is the fallback state when no tracked local copy exists and the file is not currently in restore.
- A file may have normalized `AvailabilityStatus = Available` while still having `DownloadState = Downloaded` when the provider copy is usable and the app already has a tracked cached copy.
- A temporarily restored archival file may remain visually associated with archival context while `DownloadState = AvailableToDownload`.
- The UI may show provider-native storage class and normalized availability alongside `DownloadState` when that adds operational clarity.

## Restore Options

Restore options are provider-specific and must not be flattened into a fake universal abstraction.

AWS examples:

- `Expedited`
- `Standard`
- `Bulk`

Azure examples:

- `Standard`
- `High priority`

The product may expose a common concept of restoring archived content, but the workflow UI and orchestration should remain provider-specific when those differences materially affect user decisions.

## Restore Execution and Monitoring

- restore is triggered through the provider API
- restore is a single-file action
- restore execution details are provider-specific
- AWS restore state is inferred from object metadata such as restore headers rather than from a global restore-jobs API
- the current AWS implementation requests `RestoreStatus` during object listing so the same loaded dataset can represent archived, restoring, and temporarily restored items
- AWS restore-expiry metadata can be surfaced in the UI to show how long a temporary restored copy remains downloadable
- restore activity is rediscovered from the provider on connection initialization, screen open, navigation, and explicit refresh
- the app does not persist restore history locally
- the app does not continuously poll restore status in the background
- manual refresh is also available
- status is shown directly in the file list
- loaded-context status summaries belong beside the listing counter rather than in a separate global restore footer indicator
- the current AWS explorer can also refine already loaded files by normalized status such as `Downloaded`, `Available`, `Restoring`, and `Archived`

## Download Rule

Download is only allowed when the file is `Available`.

Once available, the existing download modes still apply:

- `CacheDownload`
- `DirectDownload`

Rules:

- `CacheDownload` is the product meaning of `Download`.
- In the current AWS implementation, `CacheDownload` stores the file in the globally configured local cache and participates in tracked progress monitoring.
- `DirectDownload` is the product meaning of `Download As`.
- In the current AWS implementation, `DirectDownload` writes to a user-selected destination, participates in active transfer monitoring while running, and does not participate in tracked local-cache state after completion.
- The current implementation exposes cancel controls for active downloads, but not pause or resume.
- The current UI emits progress events for active `CacheDownload` and `DirectDownload` operations and summarizes them in the bottom bar and transfer modal.
- Cached-file detection is based on deterministic local file paths derived from connection, container, and object key.
